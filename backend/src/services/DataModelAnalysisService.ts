import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DataModelProcessor } from '../processors/DataModelProcessor.js';

/**
 * Per-column summary statistics for numeric columns
 */
export interface NumericColumnSummary {
    column_name: string;
    data_type: 'numeric';
    count: number;
    null_count: number;
    non_null_count: number;
    min: number | null;
    max: number | null;
    mean: number | null;
    median: number | null;
    std_dev: number | null;
    sum: number | null;
}

/**
 * Per-column summary statistics for categorical columns
 */
export interface CategoricalColumnSummary {
    column_name: string;
    data_type: 'categorical';
    count: number;
    null_count: number;
    non_null_count: number;
    unique_count: number;
    top_values: Array<{ value: string; count: number; percentage: number }>;
}

/**
 * Per-column summary statistics for date columns
 */
export interface DateColumnSummary {
    column_name: string;
    data_type: 'date';
    count: number;
    null_count: number;
    non_null_count: number;
    min: string | null;
    max: string | null;
    range_days: number | null;
    gaps: Array<{ from: string; to: string; gap_days: number }>;
}

/**
 * Union type for all column summaries
 */
export type ColumnSummary = NumericColumnSummary | CategoricalColumnSummary | DateColumnSummary;

/**
 * Complete summary response for a data model
 */
export interface DataModelSummary {
    data_model_id: number;
    data_model_name: string | null;
    row_count: number;
    column_count: number;
    columns: ColumnSummary[];
    computed_at: string;
    query_execution_ms: number;
    from_cache: boolean;
}

/**
 * Service for computing per-column summary statistics for data models.
 * Executes the data model's SQL query and analyzes the result set.
 */
export class DataModelAnalysisService {
    private static instance: DataModelAnalysisService;

    private constructor() {}

    public static getInstance(): DataModelAnalysisService {
        if (!DataModelAnalysisService.instance) {
            DataModelAnalysisService.instance = new DataModelAnalysisService();
        }
        return DataModelAnalysisService.instance;
    }

    /**
     * Compute or retrieve cached summary statistics for a data model.
     * 
     * @param dataModelId - The ID of the data model
     * @param tokenDetails - User token details for authorization
     * @param organizationId - Optional organization ID
     * @param forceRefresh - If true, recompute even if cached summary exists
     * @returns DataModelSummary with per-column statistics
     */
    public async computeSummary(
        dataModelId: number,
        tokenDetails: any,
        organizationId?: number | null,
        forceRefresh: boolean = false
    ): Promise<DataModelSummary> {
        const startTime = Date.now();

        // Check for cached summary unless force refresh
        if (!forceRefresh) {
            const cached = await this.getCachedSummary(dataModelId);
            if (cached) {
                return { ...cached, from_cache: true };
            }
        }

        // Get the data model details
        const processor = DataModelProcessor.getInstance();
        const dataModel = await processor.getDataModelById(dataModelId, tokenDetails, organizationId);

        if (!dataModel) {
            throw new Error(`Data model with ID ${dataModelId} not found`);
        }

        const queryRaw = dataModel.query;
        const queryString = typeof queryRaw === 'string' ? queryRaw : JSON.stringify(queryRaw);
        if (!queryString || queryString.trim().length === 0) {
            throw new Error(`Data model ${dataModelId} has no query defined`);
        }

        // Execute the data model's SQL query to get the result set
        const queryStartTime = Date.now();
        let rows: any[];
        try {
            rows = await processor.executeDataModelQuery(dataModelId, tokenDetails, organizationId);
        } catch (error: any) {
            throw new Error(`Failed to execute data model query: ${error.message}`);
        }
        const queryExecutionMs = Date.now() - queryStartTime;

        // Compute summary statistics
        const columns = this.analyzeResultSet(rows);
        const computedAt = new Date().toISOString();

        const summary: DataModelSummary = {
            data_model_id: dataModelId,
            data_model_name: dataModel.name || null,
            row_count: rows.length,
            column_count: columns.length,
            columns,
            computed_at: computedAt,
            query_execution_ms: queryExecutionMs,
            from_cache: false,
        };

        // Store the summary in the database
        await this.storeSummary(dataModelId, summary, queryExecutionMs);

        return summary;
    }

    /**
     * Retrieve cached summary for a data model.
     * Returns null if no cached summary exists.
     */
    public async getCachedSummary(dataModelId: number): Promise<DataModelSummary | null> {
        try {
            const dataSource = await getAppDataSource();
            const result = await dataSource.query(
                `SELECT summary_data, computed_at, row_count, column_count, query_execution_ms
                 FROM data_model_summaries
                 WHERE data_model_id = $1 AND error_message IS NULL
                 ORDER BY computed_at DESC
                 LIMIT 1`,
                [dataModelId]
            );

            if (!result || result.length === 0) {
                return null;
            }

            const row = result[0];
            const summaryData = typeof row.summary_data === 'string'
                ? JSON.parse(row.summary_data)
                : row.summary_data;

            return {
                data_model_id: dataModelId,
                data_model_name: summaryData.data_model_name || null,
                row_count: row.row_count,
                column_count: row.column_count,
                columns: summaryData.columns || [],
                computed_at: row.computed_at instanceof Date
                    ? row.computed_at.toISOString()
                    : String(row.computed_at),
                query_execution_ms: row.query_execution_ms || 0,
                from_cache: true,
            };
        } catch (error: any) {
            console.error(`[DataModelAnalysisService] Error fetching cached summary:`, error.message);
            return null;
        }
    }

    /**
     * Store summary results in the data_model_summaries table.
     */
    private async storeSummary(
        dataModelId: number,
        summary: DataModelSummary,
        queryExecutionMs: number
    ): Promise<void> {
        try {
            const dataSource = await getAppDataSource();
            await dataSource.query(
                `INSERT INTO data_model_summaries (data_model_id, row_count, column_count, summary_data, computed_at, query_execution_ms)
                 VALUES ($1, $2, $3, $4, NOW(), $5)`,
                [
                    dataModelId,
                    summary.row_count,
                    summary.column_count,
                    JSON.stringify({
                        data_model_name: summary.data_model_name,
                        columns: summary.columns,
                    }),
                    queryExecutionMs,
                ]
            );
        } catch (error: any) {
            console.error(`[DataModelAnalysisService] Error storing summary:`, error.message);
            // Don't throw — storing is best-effort, the summary was still computed
        }
    }

    /**
     * Analyze a result set and compute per-column summary statistics.
     * Detects column types automatically and delegates to the appropriate analyzer.
     */
    public analyzeResultSet(rows: any[]): ColumnSummary[] {
        if (!rows || rows.length === 0) {
            return [];
        }

        const columnNames = Object.keys(rows[0]);
        const summaries: ColumnSummary[] = [];

        for (const colName of columnNames) {
            const columnType = this.detectColumnType(rows, colName);

            switch (columnType) {
                case 'numeric':
                    summaries.push(this.analyzeNumericColumn(rows, colName));
                    break;
                case 'date':
                    summaries.push(this.analyzeDateColumn(rows, colName));
                    break;
                case 'categorical':
                default:
                    summaries.push(this.analyzeCategoricalColumn(rows, colName));
                    break;
            }
        }

        return summaries;
    }

    /**
     * Detect the semantic type of a column based on its values.
     * Returns 'numeric', 'date', or 'categorical'.
     */
    private detectColumnType(rows: any[], columnName: string): 'numeric' | 'date' | 'categorical' {
        // Sample up to 100 non-null values for type detection
        const sampleSize = Math.min(rows.length, 100);
        let numericCount = 0;
        let dateCount = 0;
        let nonNullCount = 0;

        for (let i = 0; i < sampleSize; i++) {
            const value = rows[i][columnName];
            if (value === null || value === undefined || value === '') {
                continue;
            }
            nonNullCount++;

            if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)))) {
                numericCount++;
            } else if (this.isDateLikeValue(value)) {
                dateCount++;
            }
        }

        // If >80% of non-null values are numeric, classify as numeric
        if (nonNullCount > 0 && numericCount / nonNullCount > 0.8) {
            return 'numeric';
        }

        // If >80% of non-null values are dates, classify as date
        if (nonNullCount > 0 && dateCount / nonNullCount > 0.8) {
            return 'date';
        }

        return 'categorical';
    }

    /**
     * Check if a value looks like a date.
     */
    private isDateLikeValue(value: any): boolean {
        if (value instanceof Date) {
            return !isNaN(value.getTime());
        }
        if (typeof value === 'string') {
            // Match common date patterns: YYYY-MM-DD, MM/DD/YYYY, ISO 8601, etc.
            const datePatterns = [
                /^\d{4}-\d{2}-\d{2}/,                         // YYYY-MM-DD
                /^\d{2}\/\d{2}\/\d{4}/,                       // MM/DD/YYYY
                /^\d{2}-\d{2}-\d{4}/,                         // DD-MM-YYYY
                /^\d{4}\/\d{2}\/\d{2}/,                       // YYYY/MM/DD
                /^\w{3}\s+\d{1,2},?\s+\d{4}/,                 // Jan 1, 2024
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,             // ISO 8601
            ];
            if (datePatterns.some(pattern => pattern.test(value))) {
                const parsed = new Date(value);
                return !isNaN(parsed.getTime());
            }
        }
        return false;
    }

    /**
     * Analyze a numeric column: min, max, mean, median, std dev, sum, count, null count.
     */
    public analyzeNumericColumn(rows: any[], columnName: string): NumericColumnSummary {
        const values: number[] = [];
        let nullCount = 0;

        for (const row of rows) {
            const rawValue = row[columnName];
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                nullCount++;
            } else {
                const numValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
                if (!isNaN(numValue) && isFinite(numValue)) {
                    values.push(numValue);
                } else {
                    nullCount++;
                }
            }
        }

        values.sort((a, b) => a - b);

        const count = values.length;
        let min: number | null = null;
        let max: number | null = null;
        let mean: number | null = null;
        let median: number | null = null;
        let stdDev: number | null = null;
        let sum: number | null = null;

        if (count > 0) {
            min = values[0];
            max = values[count - 1];
            sum = values.reduce((acc, v) => acc + v, 0);
            mean = sum / count;

            // Median
            if (count % 2 === 0) {
                median = (values[count / 2 - 1] + values[count / 2]) / 2;
            } else {
                median = values[Math.floor(count / 2)];
            }

            // Standard deviation (population)
            if (count > 1) {
                const variance = values.reduce((acc, v) => acc + Math.pow(v - mean!, 2), 0) / count;
                stdDev = Math.sqrt(variance);
            } else {
                stdDev = 0;
            }

            // Round to avoid floating point noise
            mean = Math.round(mean * 1e6) / 1e6;
            median = Math.round(median * 1e6) / 1e6;
            stdDev = Math.round(stdDev * 1e6) / 1e6;
            sum = Math.round(sum * 1e6) / 1e6;
        }

        return {
            column_name: columnName,
            data_type: 'numeric',
            count: rows.length,
            null_count: nullCount,
            non_null_count: count,
            min,
            max,
            mean,
            median,
            std_dev: stdDev,
            sum,
        };
    }

    /**
     * Analyze a categorical column: unique count, top 5 values with frequencies.
     */
    public analyzeCategoricalColumn(rows: any[], columnName: string): CategoricalColumnSummary {
        const valueCounts = new Map<string, number>();
        let nullCount = 0;

        for (const row of rows) {
            const rawValue = row[columnName];
            if (rawValue === null || rawValue === undefined) {
                nullCount++;
            } else {
                const strValue = String(rawValue);
                valueCounts.set(strValue, (valueCounts.get(strValue) || 0) + 1);
            }
        }

        // Sort by count descending and take top 5
        const sortedValues = Array.from(valueCounts.entries())
            .sort((a, b) => b[1] - a[1]);

        const nonNullCount = rows.length - nullCount;
        const topValues = sortedValues.slice(0, 5).map(([value, count]) => ({
            value,
            count,
            percentage: nonNullCount > 0 ? Math.round((count / nonNullCount) * 10000) / 100 : 0,
        }));

        return {
            column_name: columnName,
            data_type: 'categorical',
            count: rows.length,
            null_count: nullCount,
            non_null_count: nonNullCount,
            unique_count: valueCounts.size,
            top_values: topValues,
        };
    }

    /**
     * Analyze a date column: min, max, range in days, gap detection.
     */
    public analyzeDateColumn(rows: any[], columnName: string): DateColumnSummary {
        const dates: Date[] = [];
        let nullCount = 0;

        for (const row of rows) {
            const rawValue = row[columnName];
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                nullCount++;
            } else {
                const dateValue = rawValue instanceof Date ? rawValue : new Date(rawValue);
                if (!isNaN(dateValue.getTime())) {
                    dates.push(dateValue);
                } else {
                    nullCount++;
                }
            }
        }

        dates.sort((a, b) => a.getTime() - b.getTime());

        let minDate: string | null = null;
        let maxDate: string | null = null;
        let rangeDays: number | null = null;
        const gaps: Array<{ from: string; to: string; gap_days: number }> = [];

        if (dates.length > 0) {
            minDate = dates[0].toISOString().split('T')[0];
            maxDate = dates[dates.length - 1].toISOString().split('T')[0];
            rangeDays = Math.ceil(
                (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24)
            );

            // Gap detection: find gaps > 2x the median interval
            if (dates.length > 1) {
                const intervals: number[] = [];
                for (let i = 1; i < dates.length; i++) {
                    const diffMs = dates[i].getTime() - dates[i - 1].getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    intervals.push(diffDays);
                }

                intervals.sort((a, b) => a - b);
                const medianInterval = intervals.length % 2 === 0
                    ? (intervals[intervals.length / 2 - 1] + intervals[intervals.length / 2]) / 2
                    : intervals[Math.floor(intervals.length / 2)];

                // A gap is significant if it's more than 3x the median interval
                const gapThreshold = Math.max(medianInterval * 3, 2);
                for (let i = 1; i < dates.length; i++) {
                    const diffMs = dates[i].getTime() - dates[i - 1].getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    if (diffDays > gapThreshold) {
                        gaps.push({
                            from: dates[i - 1].toISOString().split('T')[0],
                            to: dates[i].toISOString().split('T')[0],
                            gap_days: diffDays,
                        });
                    }
                }
            }
        }

        return {
            column_name: columnName,
            data_type: 'date',
            count: rows.length,
            null_count: nullCount,
            non_null_count: dates.length,
            min: minDate,
            max: maxDate,
            range_days: rangeDays,
            gaps: gaps.slice(0, 10), // Return at most 10 gaps
        };
    }
}