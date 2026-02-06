import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DataQualityService } from '../services/DataQualityService.js';
import { DataQualityExecutionService } from '../services/DataQualityExecutionService.js';
import { DataQualityHistoryService } from '../services/DataQualityHistoryService.js';
import {
    IQualityReport,
    IQualityAnalysisRequest,
    IQualityAnalysisResponse,
    ICleaningConfig,
    IExecutionResult
} from '../interfaces/IDataQuality.js';
import { ITokenDetails } from '../types/ITokenDetails.js';

/**
 * Data Quality Processor
 * Orchestrates data quality analysis and cleaning operations
 * Part of Phase 1: Data Quality & Marketing Attribution Engine
 */
export class DataQualityProcessor {
    private static instance: DataQualityProcessor;
    private dataQualityService: DataQualityService;
    private executionService: DataQualityExecutionService;
    private historyService: DataQualityHistoryService;

    private constructor() {
        this.dataQualityService = DataQualityService.getInstance();
        this.executionService = DataQualityExecutionService.getInstance();
        this.historyService = DataQualityHistoryService.getInstance();
    }

    public static getInstance(): DataQualityProcessor {
        if (!DataQualityProcessor.instance) {
            DataQualityProcessor.instance = new DataQualityProcessor();
        }
        return DataQualityProcessor.instance;
    }

    /**
     * Analyze data model and generate quality report
     */
    public async analyzeDataModel(
        dataModelId: number,
        tokenDetails: ITokenDetails
    ): Promise<IQualityAnalysisResponse> {
        try {
            console.log(`Starting quality analysis for data model ${dataModelId}`);

            // Get data model
            const dataModel = await this.getDataModel(dataModelId);
            
            // Profile the data model
            const profile = await this.dataQualityService.profileDataModel(dataModel);
            
            // Calculate quality scores
            const scores = this.dataQualityService.calculateQualityScores(profile);
            
            // Detect duplicates (check if there are potential key columns)
            let duplicateCount = 0;
            const keyColumns = this.identifyKeyColumns(profile);
            if (keyColumns.length > 0) {
                const duplicateInfo = await this.dataQualityService.detectDuplicates(
                    dataModel,
                    keyColumns
                );
                duplicateCount = duplicateInfo.duplicateCount;
            }
            
            // Count total null values
            const nullCount = profile.columns.reduce(
                (sum, col) => sum + col.nullCount,
                0
            );
            
            // Detect outliers in numeric columns
            let outlierCount = 0;
            for (const col of profile.columns) {
                if (this.isNumericColumn(col.type)) {
                    try {
                        const outlierInfo = await this.dataQualityService.detectOutliers(
                            dataModel,
                            col.name
                        );
                        outlierCount += outlierInfo.outlierCount;
                    } catch (error) {
                        console.warn(`Could not detect outliers for column ${col.name}:`, error);
                    }
                }
            }
            
            // Calculate overall quality score (weighted average)
            const overallScore = Math.round(
                scores.completenessScore * 0.4 +
                scores.uniquenessScore * 0.3 +
                scores.validityScore * 0.3
            );
            
            // Save report to database
            const report = await this.saveQualityReport({
                dataModelId,
                userId: tokenDetails.users_platform_id,
                qualityScore: overallScore,
                completenessScore: scores.completenessScore,
                uniquenessScore: scores.uniquenessScore,
                validityScore: scores.validityScore,
                consistencyScore: null,
                totalRows: profile.totalRows,
                duplicateCount,
                nullCount,
                outlierCount,
                issues: [],
                recommendations: [],
                status: 'completed',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            console.log(`Quality analysis completed for data model ${dataModelId}. Score: ${overallScore}`);
            
            return {
                report,
                autoFixAvailable: duplicateCount > 0 || nullCount > 0 || outlierCount > 0,
                estimatedFixTime: this.estimateFixTime(profile.totalRows)
            };
            
        } catch (error) {
            console.error(`Error analyzing data model ${dataModelId}:`, error);
            throw new Error(`Failed to analyze data model: ${error.message}`);
        }
    }

    /**
     * Apply cleaning rules to data model
     */
    public async applyCleaningRules(
        dataModelId: number,
        cleaningConfig: ICleaningConfig,
        tokenDetails: ITokenDetails
    ): Promise<IExecutionResult> {
        try {
            console.log(
                `Applying cleaning rules to data model ${dataModelId}, type: ${cleaningConfig.cleaningType}`
            );

            // Get data model
            const dataModel = await this.getDataModel(dataModelId);
            
            // Generate cleaning SQL based on config type
            const sql = await this.generateCleaningSQL(dataModel, cleaningConfig);
            
            // Execute the SQL
            const result = await this.executionService.executeCleaningSQL(
                dataModel,
                sql,
                cleaningConfig.dryRun || false
            );
            
            // Log the execution if not a dry run
            if (!cleaningConfig.dryRun && result.success) {
                await this.historyService.logExecution(
                    dataModelId,
                    tokenDetails.users_platform_id,
                    cleaningConfig.cleaningType,
                    cleaningConfig.affectedColumns,
                    cleaningConfig.configuration,
                    result
                );
            }
            
            console.log(
                `Cleaning rules applied to data model ${dataModelId}. ` +
                `Rows affected: ${result.rowsAffected}`
            );
            
            return result;
            
        } catch (error) {
            console.error(`Error applying cleaning rules to model ${dataModelId}:`, error);
            throw new Error(`Failed to apply cleaning rules: ${error.message}`);
        }
    }

    /**
     * Get latest quality report for data model
     */
    public async getLatestReport(dataModelId: number): Promise<IQualityReport | null> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                const result = await queryRunner.query(
                    `SELECT * FROM "dra_data_quality_reports"
                     WHERE data_model_id = $1
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [dataModelId]
                );

                if (result.length === 0) {
                    return null;
                }

                return this.mapReportFromDB(result[0]);

            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            console.error(`Error fetching latest report for model ${dataModelId}:`, error);
            throw new Error(`Failed to fetch latest report: ${error.message}`);
        }
    }

    /**
     * Get cleaning history for data model
     */
    public async getCleaningHistory(
        dataModelId: number,
        limit: number = 50,
        offset: number = 0
    ) {
        return this.historyService.getHistory(dataModelId, limit, offset);
    }

    /**
     * Helper: Get data model by ID
     */
    private async getDataModel(dataModelId: number): Promise<DRADataModel> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const result = await queryRunner.query(
                `SELECT * FROM "dra_data_models" WHERE id = $1`,
                [dataModelId]
            );

            if (result.length === 0) {
                throw new Error(`Data model with ID ${dataModelId} not found`);
            }

            return result[0] as DRADataModel;

        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Helper: Identify potential key columns for duplicate detection
     */
    private identifyKeyColumns(profile: any): string[] {
        const keyColumns: string[] = [];
        
        for (const col of profile.columns) {
            // Look for columns with high uniqueness (>80%) and low null rate (<10%)
            if (col.distinctRate > 80 && col.nullRate < 10) {
                keyColumns.push(col.name);
            }
            
            // Also add columns with common key names
            const keyPatterns = ['id', 'email', 'username', 'code', 'sku'];
            if (keyPatterns.some(pattern => col.name.toLowerCase().includes(pattern))) {
                if (!keyColumns.includes(col.name)) {
                    keyColumns.push(col.name);
                }
            }
        }
        
        return keyColumns.slice(0, 3); // Limit to 3 columns
    }

    /**
     * Helper: Check if column is numeric
     */
    private isNumericColumn(dataType: string): boolean {
        const numericTypes = [
            'integer', 'bigint', 'smallint', 'decimal', 'numeric',
            'real', 'double precision', 'money', 'int', 'int2', 'int4', 'int8',
            'float4', 'float8'
        ];
        return numericTypes.includes(dataType.toLowerCase());
    }

    /**
     * Helper: Estimate fix time based on row count
     */
    private estimateFixTime(totalRows: number): number {
        // Rough estimate: 1 second per 10,000 rows
        return Math.ceil(totalRows / 10000);
    }

    /**
     * Helper: Generate cleaning SQL based on configuration
     */
    private async generateCleaningSQL(
        dataModel: DRADataModel,
        config: ICleaningConfig
    ): Promise<string> {
        const fullyQualifiedTable = `"${dataModel.schema}"."${dataModel.name}"`;
        
        switch (config.cleaningType) {
            case 'deduplicate':
                return this.generateDeduplicateSQL(fullyQualifiedTable, config);
            case 'standardize':
                return this.generateStandardizeSQL(fullyQualifiedTable, config);
            case 'validate':
                return this.generateValidateSQL(fullyQualifiedTable, config);
            case 'impute':
                return this.generateImputeSQL(fullyQualifiedTable, config);
            default:
                throw new Error(`Unknown cleaning type: ${config.cleaningType}`);
        }
    }

    /**
     * Generate deduplication SQL
     */
    private generateDeduplicateSQL(table: string, config: ICleaningConfig): string {
        const dedup = config.configuration.deduplication;
        if (!dedup) {
            throw new Error('Deduplication configuration is required');
        }

        const keyColumns = dedup.keyColumns.map(col => `"${col}"`).join(', ');
        const orderBy = dedup.dateColumn 
            ? `"${dedup.dateColumn}" DESC`
            : 'id DESC';

        return `
BEGIN;

WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY ${keyColumns} ORDER BY ${orderBy}) as rn
    FROM ${table}
)
DELETE FROM ${table}
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

COMMIT;
        `.trim();
    }

    /**
     * Generate standardization SQL
     */
    private generateStandardizeSQL(table: string, config: ICleaningConfig): string {
        const standardize = config.configuration.standardization;
        if (!standardize || !standardize.rules || standardize.rules.length === 0) {
            throw new Error('Standardization rules are required');
        }

        const updates: string[] = [];

        for (const rule of standardize.rules) {
            const column = `"${rule.column}"`;
            
            if (rule.type === 'country' && rule.mapping) {
                const caseStatements = Object.entries(rule.mapping)
                    .map(([key, value]) => `WHEN UPPER(${column}) = '${key.toUpperCase()}' THEN '${value}'`)
                    .join('\n        ');
                
                updates.push(`
UPDATE ${table}
SET ${column} = CASE
        ${caseStatements}
        ELSE ${column}
    END;
                `.trim());
            } else if (rule.pattern) {
                updates.push(`
UPDATE ${table}
SET ${column} = regexp_replace(${column}, '${rule.pattern}', '', 'g')
WHERE ${column} IS NOT NULL;
                `.trim());
            }
        }

        return `
BEGIN;

${updates.join('\n\n')}

COMMIT;
        `.trim();
    }

    /**
     * Generate validation SQL
     */
    private generateValidateSQL(table: string, config: ICleaningConfig): string {
        const validate = config.configuration.validation;
        if (!validate || !validate.rules || validate.rules.length === 0) {
            throw new Error('Validation rules are required');
        }

        const updates: string[] = [];

        for (const rule of validate.rules) {
            const column = `"${rule.column}"`;
            
            if (rule.rule === 'not_null') {
                // Can't fix NULL values without imputation strategy
                continue;
            } else if (rule.rule === 'range' && rule.parameters) {
                const { min, max } = rule.parameters;
                updates.push(`
UPDATE ${table}
SET ${column} = NULL
WHERE ${column} IS NOT NULL
  AND (${column} < ${min} OR ${column} > ${max});
                `.trim());
            }
        }

        if (updates.length === 0) {
            throw new Error('No fixable validation issues found');
        }

        return `
BEGIN;

${updates.join('\n\n')}

COMMIT;
        `.trim();
    }

    /**
     * Generate imputation SQL
     */
    private generateImputeSQL(table: string, config: ICleaningConfig): string {
        const impute = config.configuration.imputation;
        if (!impute) {
            throw new Error('Imputation configuration is required');
        }

        const updates: string[] = [];

        for (const column of impute.columns) {
            const quotedColumn = `"${column}"`;
            
            if (impute.method === 'mean') {
                updates.push(`
UPDATE ${table}
SET ${quotedColumn} = (SELECT AVG(${quotedColumn}) FROM ${table} WHERE ${quotedColumn} IS NOT NULL)
WHERE ${quotedColumn} IS NULL;
                `.trim());
            } else if (impute.method === 'median') {
                updates.push(`
UPDATE ${table}
SET ${quotedColumn} = (
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${quotedColumn})
    FROM ${table}
    WHERE ${quotedColumn} IS NOT NULL
)
WHERE ${quotedColumn} IS NULL;
                `.trim());
            }
        }

        return `
BEGIN;

${updates.join('\n\n')}

COMMIT;
        `.trim();
    }

    /**
     * Helper: Save quality report to database
     */
    private async saveQualityReport(report: Omit<IQualityReport, 'id'>): Promise<IQualityReport> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const result = await queryRunner.query(
                `INSERT INTO "dra_data_quality_reports" (
                    data_model_id, user_id, quality_score, completeness_score,
                    uniqueness_score, validity_score, consistency_score,
                    total_rows, duplicate_count, null_count, outlier_count,
                    issues_detected, recommendations, status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
                RETURNING *`,
                [
                    report.dataModelId,
                    report.userId,
                    report.qualityScore,
                    report.completenessScore,
                    report.uniquenessScore,
                    report.validityScore,
                    report.consistencyScore,
                    report.totalRows,
                    report.duplicateCount,
                    report.nullCount,
                    report.outlierCount,
                    JSON.stringify(report.issues),
                    JSON.stringify(report.recommendations),
                    report.status
                ]
            );

            return this.mapReportFromDB(result[0]);

        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Helper: Map database row to IQualityReport
     */
    private mapReportFromDB(row: any): IQualityReport {
        return {
            id: row.id,
            dataModelId: row.data_model_id,
            userId: row.user_id,
            qualityScore: parseFloat(row.quality_score),
            completenessScore: parseFloat(row.completeness_score),
            uniquenessScore: parseFloat(row.uniqueness_score),
            validityScore: parseFloat(row.validity_score),
            consistencyScore: row.consistency_score ? parseFloat(row.consistency_score) : null,
            totalRows: parseInt(row.total_rows),
            duplicateCount: row.duplicate_count,
            nullCount: row.null_count,
            outlierCount: row.outlier_count,
            issues: row.issues_detected || [],
            recommendations: row.recommendations || [],
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}
