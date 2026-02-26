import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DataQualityService } from '../services/DataQualityService.js';
import { DataQualityExecutionService } from '../services/DataQualityExecutionService.js';
import { DataQualityHistoryService } from '../services/DataQualityHistoryService.js';
import {
    IQualityReport,
    IQualityIssue,
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
            
            // Log for debugging
            console.log(`[DataQuality] Profiling results for model ${dataModelId}:`, {
                schema: dataModel.schema,
                tableName: dataModel.name,
                totalRows: profile.totalRows,
                columnCount: profile.columnCount
            });
            
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
            const outliersByColumn = new Map<string, number>();
            for (const col of profile.columns) {
                if (this.isNumericColumn(col.type)) {
                    try {
                        const outlierInfo = await this.dataQualityService.detectOutliers(
                            dataModel,
                            col.name
                        );
                        outlierCount += outlierInfo.outlierCount;
                        if (outlierInfo.outlierCount > 0) {
                            outliersByColumn.set(col.name, outlierInfo.outlierCount);
                        }
                    } catch (error) {
                        console.warn(`Could not detect outliers for column ${col.name}:`, error);
                    }
                }
            }
            
            // Check cross-column consistency (date ordering, negative values, casing, format mix)
            const consistency = await this.dataQualityService.checkConsistency(dataModel, profile);

            // Calculate overall quality score (weighted average)
            // Completeness 35% | Validity 30% | Uniqueness 20% | Consistency 15%
            const overallScore = Math.round(
                scores.completenessScore * 0.35 +
                scores.validityScore * 0.30 +
                scores.uniquenessScore * 0.20 +
                consistency.score * 0.15
            );
            
            // Build issues array from detected problems
            const issues: IQualityIssue[] = [];
            let issueId = 1;

            // Missing values issues — one entry per affected column
            for (const col of profile.columns) {
                if (col.nullCount > 0) {
                    const pct = profile.totalRows > 0 ? (col.nullCount / profile.totalRows) * 100 : 0;
                    issues.push({
                        id: issueId++,
                        severity: pct > 50 ? 'critical' : pct > 20 ? 'high' : pct > 5 ? 'medium' : 'low',
                        type: 'missing_values',
                        column: col.name,
                        description: `"${col.name}" has ${col.nullCount.toLocaleString()} null value${col.nullCount === 1 ? '' : 's'} (${Math.round(pct)}% of rows)`,
                        affectedRows: col.nullCount,
                        affectedPercent: Math.round(pct * 100) / 100,
                        recommendation: `Fill or remove null values in "${col.name}"`,
                        estimatedImpact: pct > 20 ? 'High — large number of incomplete records' : 'Low — minor data gaps'
                    });
                }
            }

            // Duplicate rows issue
            if (duplicateCount > 0) {
                const pct = profile.totalRows > 0 ? (duplicateCount / profile.totalRows) * 100 : 0;
                issues.push({
                    id: issueId++,
                    severity: pct > 20 ? 'high' : pct > 5 ? 'medium' : 'low',
                    type: 'duplicates',
                    description: `${duplicateCount.toLocaleString()} duplicate row${duplicateCount === 1 ? '' : 's'} detected (${Math.round(pct)}% of rows)`,
                    affectedRows: duplicateCount,
                    affectedPercent: Math.round(pct * 100) / 100,
                    recommendation: 'Remove duplicate rows to ensure data accuracy',
                    estimatedImpact: pct > 10 ? 'High — significant duplication detected' : 'Medium — some duplicate records'
                });
            }

            // Outlier issues — one entry per affected numeric column (reuses results from detection loop above)
            for (const [colName, colOutlierCount] of outliersByColumn.entries()) {
                const pct = profile.totalRows > 0 ? (colOutlierCount / profile.totalRows) * 100 : 0;
                issues.push({
                    id: issueId++,
                    severity: pct > 10 ? 'medium' : 'low',
                    type: 'outliers',
                    column: colName,
                    description: `"${colName}" has ${colOutlierCount.toLocaleString()} outlier value${colOutlierCount === 1 ? '' : 's'} (${Math.round(pct)}% of rows)`,
                    affectedRows: colOutlierCount,
                    affectedPercent: Math.round(pct * 100) / 100,
                    recommendation: `Review and cap outlier values in "${colName}"`,
                    estimatedImpact: 'Medium — unusual values may skew analysis'
                });
            }

            // Consistency issues from cross-column checks
            const CONSISTENCY_SEVERITY: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
                date_ordering:    'critical',
                future_date:      'high',
                implausible_date: 'high',
                negative_value:   'high',
                date_format_mix:  'medium',
                mixed_case:       'low',
            };
            for (const v of consistency.violations) {
                issues.push({
                    id: issueId++,
                    severity: CONSISTENCY_SEVERITY[v.check] ?? 'medium',
                    type: 'inconsistent_format',
                    column: v.affectedColumns.length === 1 ? v.affectedColumns[0] : undefined,
                    description: v.description,
                    affectedRows: v.violationCount,
                    affectedPercent: v.violationRate,
                    recommendation: `Fix consistency issue in: ${v.affectedColumns.join(', ')}`,
                    estimatedImpact: v.violationRate > 20
                        ? 'High — widespread data inconsistency'
                        : 'Medium — isolated inconsistencies'
                });
            }

            // Save report to database
            const report = await this.saveQualityReport({
                dataModelId,
                userId: tokenDetails.user_id,
                qualityScore: overallScore,
                completenessScore: scores.completenessScore,
                uniquenessScore: scores.uniquenessScore,
                validityScore: scores.validityScore,
                consistencyScore: consistency.score,
                totalRows: profile.totalRows,
                duplicateCount,
                nullCount,
                outlierCount,
                issues,
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
            const sql = await this.generateCleaningSQL(dataModel, cleaningConfig, dataModelId);
            
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
                    tokenDetails.user_id,
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
    private async generateCleaningSQL(dataModel: DRADataModel, config: ICleaningConfig, dataModelId?: number): Promise<string> {
        const fullyQualifiedTable = `"${dataModel.schema}"."${dataModel.name}"`;
        
        switch (config.cleaningType) {
            case 'auto':
                return this.generateAutoCleanSQL(fullyQualifiedTable, dataModel, dataModelId);
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
     * Generate automatic cleaning SQL from the latest quality report's issues
     */
    private async generateAutoCleanSQL(table: string, dataModel: DRADataModel, dataModelId?: number): Promise<string> {
        const sqls: string[] = [];

        if (dataModelId) {
            const latestReport = await this.getLatestReport(dataModelId);
            if (latestReport && latestReport.issues && latestReport.issues.length > 0) {
                for (const issue of latestReport.issues) {
                    if (issue.type === 'missing_values' && issue.column) {
                        // Delete rows where this column is null
                        sqls.push(`DELETE FROM ${table} WHERE "${issue.column}" IS NULL;`);
                    } else if (issue.type === 'duplicates') {
                        // Deduplicate by keeping the row with the lowest ctid for each identical row
                        sqls.push(`DELETE FROM ${table} t1 USING ${table} t2 WHERE t1.ctid > t2.ctid AND t1 = t2;`);
                    } else if (issue.type === 'outliers' && issue.column) {
                        // Cap outliers to p5–p95 range
                        sqls.push(`
UPDATE ${table}
SET "${issue.column}" = CASE
    WHEN "${issue.column}" < (SELECT PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY "${issue.column}") FROM ${table} WHERE "${issue.column}" IS NOT NULL)
        THEN (SELECT PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY "${issue.column}") FROM ${table} WHERE "${issue.column}" IS NOT NULL)
    WHEN "${issue.column}" > (SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "${issue.column}") FROM ${table} WHERE "${issue.column}" IS NOT NULL)
        THEN (SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "${issue.column}") FROM ${table} WHERE "${issue.column}" IS NOT NULL)
    ELSE "${issue.column}"
END
WHERE "${issue.column}" IS NOT NULL;`.trim());
                    }
                }
            }
        }

        if (sqls.length === 0) {
            throw new Error('No fixable issues found in the latest quality report. Please run a new analysis first.');
        }

        return `BEGIN;\n\n${sqls.join('\n\n')}\n\nCOMMIT;`;
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
