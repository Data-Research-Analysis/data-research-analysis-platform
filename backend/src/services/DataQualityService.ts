import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import {
    IDataProfile,
    IColumnProfile,
    IQualityReport,
    IQualityIssue
} from '../interfaces/IDataQuality.js';
import Logger from '../utils/Logger.js';

/**
 * Data Quality Service
 * Profiles data models and calculates quality metrics
 * Part of Phase 1: Data Quality & Marketing Attribution Engine
 */
export class DataQualityService {
    private static instance: DataQualityService;

    private constructor() {}

    public static getInstance(): DataQualityService {
        if (!DataQualityService.instance) {
            DataQualityService.instance = new DataQualityService();
        }
        return DataQualityService.instance;
    }

    /**
     * Profile a data model - get comprehensive statistics
     */
    public async profileDataModel(dataModel: DRADataModel): Promise<IDataProfile> {
        try {
            Logger.info(`Profiling data model: ${dataModel.name} (ID: ${dataModel.id})`);

            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                // Get total row count
                const countResult = await queryRunner.query(
                    `SELECT COUNT(*) as total_rows FROM "${dataModel.schema}"."${dataModel.name}"`
                );
                const totalRows = parseInt(countResult[0].total_rows);

                // Get column information from information_schema
                const columnsInfo = await queryRunner.query(
                    `SELECT 
                        column_name,
                        data_type,
                        udt_name,
                        character_maximum_length,
                        numeric_precision,
                        numeric_scale,
                        is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = $1 AND table_name = $2
                    ORDER BY ordinal_position`,
                    [dataModel.schema, dataModel.name]
                );

                // Profile each column
                const columnProfiles: IColumnProfile[] = [];
                
                for (const colInfo of columnsInfo) {
                    const profile = await this.profileColumn(
                        queryRunner,
                        dataModel.schema,
                        dataModel.name,
                        colInfo.column_name,
                        colInfo.data_type,
                        totalRows
                    );
                    columnProfiles.push(profile);
                }

                return {
                    dataModelId: dataModel.id,
                    totalRows,
                    columnCount: columnProfiles.length,
                    columns: columnProfiles,
                    profiledAt: new Date()
                };
            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            Logger.error(`Error profiling data model ${dataModel.id}:`, error);
            throw new Error(`Failed to profile data model: ${error.message}`);
        }
    }

    /**
     * Profile a single column
     */
    private async profileColumn(
        queryRunner: any,
        schema: string,
        tableName: string,
        columnName: string,
        dataType: string,
        totalRows: number
    ): Promise<IColumnProfile> {
        const fullyQualifiedTable = `"${schema}"."${tableName}"`;
        const quotedColumn = `"${columnName}"`;

        // Get null count
        const nullResult = await queryRunner.query(
            `SELECT COUNT(*) as null_count 
             FROM ${fullyQualifiedTable} 
             WHERE ${quotedColumn} IS NULL`
        );
        const nullCount = parseInt(nullResult[0].null_count);
        const nullRate = totalRows > 0 ? (nullCount / totalRows) * 100 : 0;

        // Get distinct count
        const distinctResult = await queryRunner.query(
            `SELECT COUNT(DISTINCT ${quotedColumn}) as distinct_count 
             FROM ${fullyQualifiedTable} 
             WHERE ${quotedColumn} IS NOT NULL`
        );
        const distinctCount = parseInt(distinctResult[0].distinct_count);
        const nonNullRows = totalRows - nullCount;
        const distinctRate = nonNullRows > 0 ? (distinctCount / nonNullRows) * 100 : 0;

        // Get sample values
        const sampleResult = await queryRunner.query(
            `SELECT DISTINCT ${quotedColumn} 
             FROM ${fullyQualifiedTable} 
             WHERE ${quotedColumn} IS NOT NULL 
             LIMIT 10`
        );
        const sampleValues = sampleResult.map((row: any) => row[columnName]);

        const profile: IColumnProfile = {
            name: columnName,
            type: dataType,
            nullCount,
            nullRate: Math.round(nullRate * 100) / 100,
            distinctCount,
            distinctRate: Math.round(distinctRate * 100) / 100,
            sampleValues
        };

        // Add numeric statistics for numeric columns
        if (this.isNumericType(dataType)) {
            const statsResult = await queryRunner.query(
                `SELECT 
                    MIN(${quotedColumn}) as min_val,
                    MAX(${quotedColumn}) as max_val,
                    AVG(${quotedColumn}) as mean_val,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${quotedColumn}) as median_val,
                    STDDEV(${quotedColumn}) as stddev_val
                 FROM ${fullyQualifiedTable}
                 WHERE ${quotedColumn} IS NOT NULL`
            );
            
            if (statsResult[0]) {
                profile.min = parseFloat(statsResult[0].min_val);
                profile.max = parseFloat(statsResult[0].max_val);
                profile.mean = parseFloat(statsResult[0].mean_val);
                profile.median = parseFloat(statsResult[0].median_val);
                profile.stdDev = parseFloat(statsResult[0].stddev_val);
            }
        }

        // Add date statistics for date/timestamp columns
        if (this.isDateType(dataType)) {
            const dateStatsResult = await queryRunner.query(
                `SELECT 
                    MIN(${quotedColumn}) as min_val,
                    MAX(${quotedColumn}) as max_val
                 FROM ${fullyQualifiedTable}
                 WHERE ${quotedColumn} IS NOT NULL`
            );
            
            if (dateStatsResult[0]) {
                profile.min = new Date(dateStatsResult[0].min_val);
                profile.max = new Date(dateStatsResult[0].max_val);
            }
        }

        return profile;
    }

    /**
     * Check if data type is numeric
     */
    private isNumericType(dataType: string): boolean {
        const numericTypes = [
            'integer', 'bigint', 'smallint', 'decimal', 'numeric',
            'real', 'double precision', 'money', 'int', 'int2', 'int4', 'int8',
            'float4', 'float8'
        ];
        return numericTypes.includes(dataType.toLowerCase());
    }

    /**
     * Check if data type is date/time
     */
    private isDateType(dataType: string): boolean {
        const dateTypes = [
            'date', 'timestamp', 'timestamp without time zone',
            'timestamp with time zone', 'time', 'time without time zone',
            'time with time zone'
        ];
        return dateTypes.includes(dataType.toLowerCase());
    }

    /**
     * Calculate quality scores from profile data
     */
    public calculateQualityScores(profile: IDataProfile): {
        completenessScore: number;
        uniquenessScore: number;
        validityScore: number;
    } {
        let completenessTotal = 0;
        let uniquenessTotal = 0;
        let validityTotal = 0;
        let columnCount = profile.columns.length;

        for (const col of profile.columns) {
            // Completeness: 100 - null rate
            completenessTotal += (100 - col.nullRate);

            // Uniqueness: distinct rate (higher is better for most columns)
            uniquenessTotal += col.distinctRate;

            // Validity: basic check (100 if type is valid, could be enhanced)
            validityTotal += 100;
        }

        return {
            completenessScore: Math.round(completenessTotal / columnCount),
            uniquenessScore: Math.round(uniquenessTotal / columnCount),
            validityScore: Math.round(validityTotal / columnCount)
        };
    }

    /**
     * Detect duplicate rows based on key columns
     */
    public async detectDuplicates(
        dataModel: DRADataModel,
        keyColumns: string[]
    ): Promise<{ duplicateCount: number; affectedRows: number }> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                const columnList = keyColumns.map(col => `"${col}"`).join(', ');
                const fullyQualifiedTable = `"${dataModel.schema}"."${dataModel.name}"`;

                const result = await queryRunner.query(
                    `SELECT 
                        COUNT(*) as total_duplicates,
                        SUM(dup_count) as affected_rows
                     FROM (
                        SELECT COUNT(*) as dup_count
                        FROM ${fullyQualifiedTable}
                        GROUP BY ${columnList}
                        HAVING COUNT(*) > 1
                     ) duplicates`
                );

                return {
                    duplicateCount: parseInt(result[0].total_duplicates) || 0,
                    affectedRows: parseInt(result[0].affected_rows) || 0
                };
            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            Logger.error(`Error detecting duplicates for model ${dataModel.id}:`, error);
            throw new Error(`Failed to detect duplicates: ${error.message}`);
        }
    }

    /**
     * Detect outliers using IQR method for numeric columns
     */
    public async detectOutliers(
        dataModel: DRADataModel,
        columnName: string
    ): Promise<{ outlierCount: number; lowerBound: number; upperBound: number }> {
        try {
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                const fullyQualifiedTable = `"${dataModel.schema}"."${dataModel.name}"`;
                const quotedColumn = `"${columnName}"`;

                // Calculate quartiles and IQR
                const statsResult = await queryRunner.query(
                    `SELECT 
                        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${quotedColumn}) as q1,
                        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${quotedColumn}) as q3
                     FROM ${fullyQualifiedTable}
                     WHERE ${quotedColumn} IS NOT NULL`
                );

                const q1 = parseFloat(statsResult[0].q1);
                const q3 = parseFloat(statsResult[0].q3);
                const iqr = q3 - q1;
                const lowerBound = q1 - (1.5 * iqr);
                const upperBound = q3 + (1.5 * iqr);

                // Count outliers
                const outlierResult = await queryRunner.query(
                    `SELECT COUNT(*) as outlier_count
                     FROM ${fullyQualifiedTable}
                     WHERE ${quotedColumn} IS NOT NULL
                       AND (${quotedColumn} < $1 OR ${quotedColumn} > $2)`,
                    [lowerBound, upperBound]
                );

                return {
                    outlierCount: parseInt(outlierResult[0].outlier_count),
                    lowerBound,
                    upperBound
                };
            } finally {
                await queryRunner.release();
            }
        } catch (error) {
            Logger.error(`Error detecting outliers for model ${dataModel.id}, column ${columnName}:`, error);
            throw new Error(`Failed to detect outliers: ${error.message}`);
        }
    }
}
