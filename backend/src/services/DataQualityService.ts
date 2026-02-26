import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import {
    IDataProfile,
    IColumnProfile,
    IQualityReport,
    IQualityIssue,
    IConsistencyViolation
} from '../interfaces/IDataQuality.js';

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
            console.log(`Profiling data model: ${dataModel.name} (ID: ${dataModel.id})`);
            console.log(`Schema: "${dataModel.schema}", Table: "${dataModel.name}"`);

            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                // Get total row count
                const countQuery = `SELECT COUNT(*) as total_rows FROM "${dataModel.schema}"."${dataModel.name}"`;
                console.log(`[DataQualityService] Executing count query: ${countQuery}`);
                
                const countResult = await queryRunner.query(countQuery);
                const totalRows = parseInt(countResult[0].total_rows);
                
                console.log(`[DataQualityService] Count result: ${totalRows} rows found`);
                
                if (totalRows === 0) {
                    console.warn(`[DataQualityService] ⚠️ Table "${dataModel.schema}"."${dataModel.name}" has 0 rows`);
                    // Check if table exists
                    const tableExistsQuery = `
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = $1 AND table_name = $2
                        );
                    `;
                    const existsResult = await queryRunner.query(tableExistsQuery, [dataModel.schema, dataModel.name]);
                    console.log(`[DataQualityService] Table exists check:`, existsResult[0]);
                }

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
            console.error(`Error profiling data model ${dataModel.id}:`, error);
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

        // Validate data type conformance and format
        const validation = await this.validateColumn(
            queryRunner,
            schema,
            tableName,
            columnName,
            dataType,
            totalRows
        );

        const profile: IColumnProfile = {
            name: columnName,
            type: dataType,
            nullCount,
            nullRate: Math.round(nullRate * 100) / 100,
            distinctCount,
            distinctRate: Math.round(distinctRate * 100) / 100,
            invalidCount: validation.invalidCount,
            validityRate: Math.round(validation.validityRate * 100) / 100,
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
     * Validate column data for type conformance and format validity
     * Critical for marketing data quality (email format, phone format, etc.)
     */
    private async validateColumn(
        queryRunner: any,
        schema: string,
        tableName: string,
        columnName: string,
        dataType: string,
        totalRows: number
    ): Promise<{ invalidCount: number; validityRate: number }> {
        const fullyQualifiedTable = `"${schema}"."${tableName}"`;
        const quotedColumn = `"${columnName}"`;
        let invalidCount = 0;

        try {
            // Validate numeric types - check for values that can't be cast to numeric
            if (this.isNumericType(dataType)) {
                const result = await queryRunner.query(
                    `SELECT COUNT(*) as invalid_count
                     FROM ${fullyQualifiedTable}
                     WHERE ${quotedColumn} IS NOT NULL
                       AND ${quotedColumn}::text !~ '^-?[0-9]+(\\.[0-9]+)?$'`
                );
                invalidCount += parseInt(result[0].invalid_count || 0);
            }

            // Validate date types - check for invalid date values
            else if (this.isDateType(dataType)) {
                // Try to cast to date and count failures
                const result = await queryRunner.query(
                    `SELECT COUNT(*) as invalid_count
                     FROM ${fullyQualifiedTable}
                     WHERE ${quotedColumn} IS NOT NULL
                       AND ${quotedColumn}::text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`
                );
                invalidCount += parseInt(result[0].invalid_count || 0);
            }

            // Validate text types with common marketing patterns
            else if (this.isTextType(dataType)) {
                const colNameLower = columnName.toLowerCase();
                
                // Email validation (critical for marketing)
                if (colNameLower.includes('email') || colNameLower.includes('mail')) {
                    const result = await queryRunner.query(
                        `SELECT COUNT(*) as invalid_count
                         FROM ${fullyQualifiedTable}
                         WHERE ${quotedColumn} IS NOT NULL
                           AND ${quotedColumn} !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`
                    );
                    invalidCount += parseInt(result[0].invalid_count || 0);
                }
                
                // Phone validation (important for marketing campaigns)
                else if (colNameLower.includes('phone') || colNameLower.includes('tel') || colNameLower.includes('mobile')) {
                    const result = await queryRunner.query(
                        `SELECT COUNT(*) as invalid_count
                         FROM ${fullyQualifiedTable}
                         WHERE ${quotedColumn} IS NOT NULL
                           AND ${quotedColumn} !~ '^[+]?[0-9\\s\\-\\(\\)]{7,20}$'`
                    );
                    invalidCount += parseInt(result[0].invalid_count || 0);
                }
                
                // URL validation (for tracking links, landing pages)
                else if (colNameLower.includes('url') || colNameLower.includes('link') || colNameLower.includes('website')) {
                    const result = await queryRunner.query(
                        `SELECT COUNT(*) as invalid_count
                         FROM ${fullyQualifiedTable}
                         WHERE ${quotedColumn} IS NOT NULL
                           AND ${quotedColumn} !~* '^https?://[^\\s/$.?#].[^\\s]*$'`
                    );
                    invalidCount += parseInt(result[0].invalid_count || 0);
                }
            }

            // Calculate validity rate
            const validityRate = totalRows > 0 ? ((totalRows - invalidCount) / totalRows) * 100 : 100;

            return {
                invalidCount,
                validityRate
            };
        } catch (error) {
            console.warn(`Could not validate column ${columnName}:`, error);
            // Return 100% valid if validation fails (conservative approach)
            return {
                invalidCount: 0,
                validityRate: 100
            };
        }
    }

    /**
     * Check if data type is text/string
     */
    private isTextType(dataType: string): boolean {
        const textTypes = [
            'character varying', 'varchar', 'character', 'char',
            'text', 'string'
        ];
        return textTypes.includes(dataType.toLowerCase());
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
     * Optimized for marketing data quality requirements
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
            // Completeness: 100 - null rate (critical for marketing targeting)
            completenessTotal += (100 - col.nullRate);

            // Uniqueness: distinct rate (important for deduplication)
            uniquenessTotal += col.distinctRate;

            // Validity: actual validation rate (now properly implemented)
            // Checks type conformance, email formats, phone formats, URL formats
            validityTotal += col.validityRate;
        }

        return {
            completenessScore: Math.round(completenessTotal / columnCount),
            uniquenessScore: Math.round(uniquenessTotal / columnCount),
            validityScore: Math.round(validityTotal / columnCount)
        };
    }

    /**
     * Run cross-column consistency checks and return a 0-100 score plus individual violations.
     *
     * Checks performed:
     *   1. Date ordering — e.g. created_at must be <= updated_at
     *   2. Future / implausible date plausibility — historical timestamps should not be in the future
     *   3. Negative values in inherently positive columns — age, spend, price, etc.
     *   4. Mixed casing in low-cardinality categorical text columns
     *   5. Multiple date formats stored in the same date-like text column
     */
    public async checkConsistency(
        dataModel: DRADataModel,
        profile: IDataProfile
    ): Promise<{ score: number; violations: IConsistencyViolation[] }> {
        const qr = AppDataSource.createQueryRunner();
        await qr.connect();

        const table = `"${dataModel.schema}"."${dataModel.name}"`;
        const violations: IConsistencyViolation[] = [];

        try {
            const dateColumns   = profile.columns.filter(c => this.isDateType(c.type));
            const numericColumns = profile.columns.filter(c => this.isNumericType(c.type));
            const textColumns   = profile.columns.filter(c => this.isTextType(c.type));

            // ── Check 1: Date ordering between related column pairs ─────────────
            const DATE_PAIRS: [string, string][] = [
                ['created_at',   'updated_at'],
                ['created_at',   'deleted_at'],
                ['created_at',   'closed_at'],
                ['created_at',   'resolved_at'],
                ['created_at',   'completed_at'],
                ['created_at',   'expires_at'],
                ['start_date',   'end_date'],
                ['start_at',     'end_at'],
                ['begins_at',    'ends_at'],
                ['opened_at',    'closed_at'],
                ['started_at',   'ended_at'],
                ['published_at', 'expires_at'],
                ['birth_date',   'death_date'],
                ['order_date',   'ship_date'],
                ['order_date',   'delivery_date'],
                ['registered_at','last_login_at'],
            ];

            for (const [beforeName, afterName] of DATE_PAIRS) {
                const beforeCol = dateColumns.find(c => {
                    const n = c.name.toLowerCase();
                    return n === beforeName || n.endsWith(`_${beforeName}`);
                });
                const afterCol = dateColumns.find(c => {
                    const n = c.name.toLowerCase();
                    return n === afterName || n.endsWith(`_${afterName}`);
                });
                if (!beforeCol || !afterCol) continue;

                try {
                    const r = await qr.query(
                        `SELECT
                            COUNT(*) FILTER (WHERE "${beforeCol.name}" > "${afterCol.name}") AS violation_count,
                            COUNT(*) FILTER (WHERE "${beforeCol.name}" IS NOT NULL AND "${afterCol.name}" IS NOT NULL) AS total_checked
                         FROM ${table}`
                    );
                    const vc = parseInt(r[0].violation_count) || 0;
                    const tc = parseInt(r[0].total_checked)   || 0;
                    if (tc > 0 && vc > 0) {
                        violations.push({
                            check: 'date_ordering',
                            description: `"${beforeCol.name}" is later than "${afterCol.name}" for ${vc.toLocaleString()} row${vc === 1 ? '' : 's'} — dates are logically out of order`,
                            affectedColumns: [beforeCol.name, afterCol.name],
                            violationCount: vc,
                            totalChecked: tc,
                            violationRate: Math.round((vc / tc) * 10000) / 100
                        });
                    }
                } catch { /* columns may exist but be incompatible — skip */ }
            }

            // ── Check 2: Future / implausible date plausibility ─────────────────
            const PAST_ONLY_PATTERNS = [
                'created_at', 'created', 'registered_at', 'registered',
                'purchase_date', 'order_date', 'birth_date', 'dob',
                'joined_at', 'signup_at', 'first_seen', 'installed_at',
                'activated_at', 'onboarded_at',
            ];
            for (const col of dateColumns) {
                const lower = col.name.toLowerCase();
                const isPastOnly = PAST_ONLY_PATTERNS.some(p => lower.includes(p));
                if (!isPastOnly) continue;

                try {
                    const r = await qr.query(
                        `SELECT
                            COUNT(*) FILTER (WHERE "${col.name}" > NOW() + INTERVAL '1 day') AS future_count,
                            COUNT(*) FILTER (WHERE "${col.name}" < '1900-01-01'::date)        AS ancient_count,
                            COUNT("${col.name}")                                               AS total_checked
                         FROM ${table}`
                    );
                    const futureVc  = parseInt(r[0].future_count)  || 0;
                    const ancientVc = parseInt(r[0].ancient_count) || 0;
                    const tc        = parseInt(r[0].total_checked) || 0;

                    if (tc > 0 && futureVc > 0) {
                        violations.push({
                            check: 'future_date',
                            description: `"${col.name}" has ${futureVc.toLocaleString()} value${futureVc === 1 ? '' : 's'} in the future — unexpected for a historical timestamp`,
                            affectedColumns: [col.name],
                            violationCount: futureVc,
                            totalChecked: tc,
                            violationRate: Math.round((futureVc / tc) * 10000) / 100
                        });
                    }
                    if (tc > 0 && ancientVc > 0) {
                        violations.push({
                            check: 'implausible_date',
                            description: `"${col.name}" has ${ancientVc.toLocaleString()} value${ancientVc === 1 ? '' : 's'} before 1900-01-01 — likely data entry errors`,
                            affectedColumns: [col.name],
                            violationCount: ancientVc,
                            totalChecked: tc,
                            violationRate: Math.round((ancientVc / tc) * 10000) / 100
                        });
                    }
                } catch { /* skip */ }
            }

            // ── Check 3: Negative values in inherently positive columns ─────────
            const POSITIVE_ONLY_PATTERNS = [
                'age', 'count', 'quantity', 'qty', 'amount', 'price',
                'revenue', 'spend', 'budget', 'clicks', 'impressions',
                'conversions', 'sessions', 'views', 'visits', 'orders',
                'units', 'cost', 'fee', 'total', 'duration', 'size',
            ];
            for (const col of numericColumns) {
                const lower = col.name.toLowerCase();
                const shouldBePositive = POSITIVE_ONLY_PATTERNS.some(p => lower.includes(p));
                if (!shouldBePositive) continue;

                try {
                    const r = await qr.query(
                        `SELECT
                            COUNT(*) FILTER (WHERE "${col.name}" < 0) AS neg_count,
                            COUNT("${col.name}")                       AS total_checked
                         FROM ${table}`
                    );
                    const vc = parseInt(r[0].neg_count)      || 0;
                    const tc = parseInt(r[0].total_checked)  || 0;
                    if (tc > 0 && vc > 0) {
                        violations.push({
                            check: 'negative_value',
                            description: `"${col.name}" has ${vc.toLocaleString()} negative value${vc === 1 ? '' : 's'} — this column is expected to always be positive`,
                            affectedColumns: [col.name],
                            violationCount: vc,
                            totalChecked: tc,
                            violationRate: Math.round((vc / tc) * 10000) / 100
                        });
                    }
                } catch { /* skip */ }
            }

            // ── Check 4: Mixed casing in low-cardinality categorical text columns
            for (const col of textColumns) {
                if (col.distinctCount === 0 || col.distinctCount > 50) continue;

                try {
                    const r = await qr.query(
                        `SELECT
                            COUNT(*) FILTER (WHERE "${col.name}" = LOWER("${col.name}"))    AS lower_count,
                            COUNT(*) FILTER (WHERE "${col.name}" = UPPER("${col.name}"))    AS upper_count,
                            COUNT(*) FILTER (WHERE "${col.name}" = INITCAP("${col.name}"))  AS title_count,
                            COUNT("${col.name}")                                             AS total_checked
                         FROM ${table}
                         WHERE "${col.name}" ~ '[a-zA-Z]'`
                    );
                    const lowerC = parseInt(r[0].lower_count) || 0;
                    const upperC = parseInt(r[0].upper_count) || 0;
                    const titleC = parseInt(r[0].title_count) || 0;
                    const tc     = parseInt(r[0].total_checked) || 0;
                    if (tc === 0) continue;

                    const dominant = Math.max(lowerC, upperC, titleC);
                    const inconsistentCount = tc - dominant;
                    const inconsistentRate  = (inconsistentCount / tc) * 100;

                    if (inconsistentRate > 5 && inconsistentCount > 0) {
                        const dominantCase = lowerC === dominant ? 'lowercase'
                            : upperC === dominant ? 'UPPERCASE' : 'Title Case';
                        violations.push({
                            check: 'mixed_case',
                            description: `"${col.name}" has inconsistent casing — ${inconsistentCount.toLocaleString()} value${inconsistentCount === 1 ? '' : 's'} deviate from the dominant ${dominantCase} format`,
                            affectedColumns: [col.name],
                            violationCount: inconsistentCount,
                            totalChecked: tc,
                            violationRate: Math.round(inconsistentRate * 100) / 100
                        });
                    }
                } catch { /* skip */ }
            }

            // ── Check 5: Multiple date formats in date-like text columns ────────
            for (const col of textColumns) {
                const lower = col.name.toLowerCase();
                const isDateLike = lower.includes('date') || lower.includes('_at')
                    || lower.includes('_on') || lower.includes('time');
                if (!isDateLike) continue;

                try {
                    const r = await qr.query(
                        `SELECT
                            COUNT(*) FILTER (WHERE "${col.name}" ~  '^[0-9]{4}-[0-9]{2}-[0-9]{2}') AS iso_count,
                            COUNT(*) FILTER (WHERE "${col.name}" ~  '^[0-9]{2}/[0-9]{2}/[0-9]{4}') AS us_count,
                            COUNT(*) FILTER (WHERE "${col.name}" ~  '^[0-9]{2}-[0-9]{2}-[0-9]{4}') AS eu_count,
                            COUNT(*) FILTER (WHERE "${col.name}" ~  '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}') AS dot_count,
                            COUNT("${col.name}")                                                     AS total_checked
                         FROM ${table}
                         WHERE "${col.name}" IS NOT NULL`
                    );
                    const fmts = [
                        { name: 'ISO (YYYY-MM-DD)',  n: parseInt(r[0].iso_count)  || 0 },
                        { name: 'US (MM/DD/YYYY)',   n: parseInt(r[0].us_count)   || 0 },
                        { name: 'EU (DD-MM-YYYY)',   n: parseInt(r[0].eu_count)   || 0 },
                        { name: 'dot (DD.MM.YYYY)',  n: parseInt(r[0].dot_count)  || 0 },
                    ].filter(x => x.n > 0);
                    const tc = parseInt(r[0].total_checked) || 0;

                    if (fmts.length > 1 && tc > 0) {
                        const dominant = Math.max(...fmts.map(f => f.n));
                        const vc = tc - dominant;
                        const fmtList = fmts.map(f => `${f.name}: ${f.n}`).join(', ');
                        violations.push({
                            check: 'date_format_mix',
                            description: `"${col.name}" stores dates in multiple formats (${fmtList}) — should use one consistent format`,
                            affectedColumns: [col.name],
                            violationCount: vc,
                            totalChecked: tc,
                            violationRate: Math.round((vc / tc) * 10000) / 100
                        });
                    }
                } catch { /* skip */ }
            }

            // ── Compute overall consistency score ────────────────────────────────
            if (violations.length === 0) {
                return { score: 100, violations: [] };
            }

            // Each check type carries a maximum deduction weight (points off 100)
            const DEDUCTION_WEIGHTS: Record<string, number> = {
                date_ordering:    20,
                future_date:      15,
                implausible_date: 12,
                negative_value:   15,
                mixed_case:        8,
                date_format_mix:  10,
            };

            let totalDeduction = 0;
            for (const v of violations) {
                const weight = DEDUCTION_WEIGHTS[v.check] ?? 10;
                // Scale by violation rate so 5% affected ≠ same penalty as 100% affected
                totalDeduction += weight * (v.violationRate / 100);
            }

            return {
                score: Math.max(0, Math.round(100 - totalDeduction)),
                violations
            };

        } finally {
            await qr.release();
        }
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
            console.error(`Error detecting duplicates for model ${dataModel.id}:`, error);
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
            console.error(`Error detecting outliers for model ${dataModel.id}, column ${columnName}:`, error);
            throw new Error(`Failed to detect outliers: ${error.message}`);
        }
    }
}
