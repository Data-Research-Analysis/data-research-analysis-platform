import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DataModelProcessor } from '../processors/DataModelProcessor.js';
import {
    KPI_METRIC_PATTERNS,
    KPI_DIMENSION_PATTERNS,
    KPI_TIME_PATTERNS,
    COMPOSITE_KPI_DEFINITIONS,
    type ColumnClassification,
    type IKPIPatternEntry,
    type ICompositeKPI,
} from '../constants/kpiPatterns.js';
import {
    computeColumnCorrelations,
    detectAnomalies,
    computeTrends,
    type CorrelationResult,
    type AnomalyResult,
    type TrendResult,
} from '../utils/statistics.js';

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
 * KPI classification for a single column
 */
export interface ColumnKPIClassification {
    column_name: string;
    classification: ColumnClassification;
    kpi: string | null;
    label: string;
    is_rate: boolean;
    confidence: number;
    matched_pattern?: string;
}

/**
 * A detected composite KPI (derivable from two or more source columns)
 */
export interface DetectedCompositeKPI {
    kpi: string;
    label: string;
    formula: string;
    required_kpis: string[];
    confidence: number;
    available: boolean;
}

/**
 * Complete KPI classification response for a data model
 */
export interface KPIClassificationResult {
    data_model_id: number;
    data_model_name: string | null;
    columns: ColumnKPIClassification[];
    detected_composites: DetectedCompositeKPI[];
    summary: {
        total_columns: number;
        metrics: number;
        dimensions: number;
        time_columns: number;
        unrecognized: number;
    };
    is_marketing_data: boolean;
    classified_at: string;
    from_cache: boolean;
}

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
 * Complete statistical analysis result for a data model (DM-003).
 * Combines summary statistics with correlations, anomaly detection, and trend analysis.
 */
export interface DataModelAnalysisResult {
    data_model_id: number;
    data_model_name: string | null;
    row_count: number;
    column_count: number;
    numeric_columns: number;
    summary: ColumnSummary[];
    correlations: CorrelationResult[];
    anomalies: AnomalyResult[];
    trends: TrendResult[];
    computed_at: string;
    query_execution_ms: number;
    analysis_execution_ms: number;
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
     * Get KPI classification for a data model's columns.
     * Scans column names against known marketing KPI patterns and classifies
     * each as metric, dimension, or time. Also detects composite KPIs.
     *
     * @param dataModelId - The ID of the data model
     * @param tokenDetails - User token details for authorization
     * @param organizationId - Optional organization ID
     * @param forceRefresh - If true, recompute even if cached classification exists
     * @returns KPIClassificationResult with per-column classification and composite KPIs
     */
    public async getKPIClassification(
        dataModelId: number,
        tokenDetails: any,
        organizationId?: number | null,
        forceRefresh: boolean = false
    ): Promise<KPIClassificationResult> {
        // Check for cached classification stored alongside summary
        if (!forceRefresh) {
            const cached = await this.getCachedClassification(dataModelId);
            if (cached) {
                return cached;
            }
        }

        // Get the data model details to access column names
        const processor = DataModelProcessor.getInstance();
        const dataModel = await processor.getDataModelById(dataModelId, tokenDetails, organizationId);

        if (!dataModel) {
            throw new Error(`Data model with ID ${dataModelId} not found`);
        }

        // Execute the query to get actual column names from the result set
        let rows: any[];
        try {
            rows = await processor.executeDataModelQuery(dataModelId, tokenDetails, organizationId);
        } catch (error: any) {
            throw new Error(`Failed to execute data model query for classification: ${error.message}`);
        }

        if (!rows || rows.length === 0) {
            // Return empty classification for empty data models
            return {
                data_model_id: dataModelId,
                data_model_name: dataModel.name || null,
                columns: [],
                detected_composites: [],
                summary: { total_columns: 0, metrics: 0, dimensions: 0, time_columns: 0, unrecognized: 0 },
                is_marketing_data: false,
                classified_at: new Date().toISOString(),
                from_cache: false,
            };
        }

        const columnNames = Object.keys(rows[0]);
        const classifications = this.classifyColumns(columnNames);
        const detectedComposites = this.detectCompositeKPIs(classifications);

        const summary = {
            total_columns: classifications.length,
            metrics: classifications.filter(c => c.classification === 'metric').length,
            dimensions: classifications.filter(c => c.classification === 'dimension').length,
            time_columns: classifications.filter(c => c.classification === 'time').length,
            unrecognized: classifications.filter(c => c.kpi === null).length,
        };

        // A data model is considered "marketing data" if it has at least
        // one metric and one non-unrecognized column matching marketing patterns
        const isMarketingData = summary.metrics >= 1 && (summary.dimensions >= 1 || summary.time_columns >= 1);

        const result: KPIClassificationResult = {
            data_model_id: dataModelId,
            data_model_name: dataModel.name || null,
            columns: classifications,
            detected_composites: detectedComposites,
            summary,
            is_marketing_data: isMarketingData,
            classified_at: new Date().toISOString(),
            from_cache: false,
        };

        // Store classification alongside summary data for caching
        await this.storeClassification(dataModelId, result);

        return result;
    }

    /**
     * Classify an array of column names against known marketing KPI patterns.
     * Returns a classification for each column.
     *
     * @param columnNames - Array of column names from the data model result set
     * @returns Array of column classifications
     */
    public classifyColumns(columnNames: string[]): ColumnKPIClassification[] {
        const allPatterns = [
            ...KPI_METRIC_PATTERNS,
            ...KPI_DIMENSION_PATTERNS,
            ...KPI_TIME_PATTERNS,
        ];

        return columnNames.map(columnName => this.classifySingleColumn(columnName, allPatterns));
    }

    /**
     * Classify a single column name against the pattern registry.
     * Uses a scoring system: the highest-confidence match wins.
     */
    private classifySingleColumn(
        columnName: string,
        allPatterns: IKPIPatternEntry[]
    ): ColumnKPIClassification {
        let bestMatch: IKPIPatternEntry | null = null;
        let bestConfidence = 0;

        for (const entry of allPatterns) {
            if (entry.pattern.test(columnName)) {
                // Prefer higher confidence, then prefer exact word-boundary matches
                if (entry.confidence > bestConfidence ||
                    (entry.confidence === bestConfidence && bestMatch && this.isBetterMatch(columnName, entry, bestMatch))) {
                    bestMatch = entry;
                    bestConfidence = entry.confidence;
                }
            }
        }

        if (bestMatch) {
            return {
                column_name: columnName,
                classification: bestMatch.classification,
                kpi: bestMatch.kpi,
                label: bestMatch.label,
                is_rate: bestMatch.is_rate,
                confidence: bestMatch.confidence,
                matched_pattern: bestMatch.pattern.source,
            };
        }

        // No match — column is unrecognized
        return {
            column_name: columnName,
            classification: 'dimension', // default classification for unrecognized columns
            kpi: null,
            label: columnName,
            is_rate: false,
            confidence: 0,
        };
    }

    /**
     * Tiebreaker logic: prefer the pattern that more specifically matches the column name.
     * Patterns with more specific (longer) regex sources are preferred.
     */
    private isBetterMatch(columnName: string, candidate: IKPIPatternEntry, current: IKPIPatternEntry): boolean {
        // Prefer more specific patterns (longer regex = more specific)
        return candidate.pattern.source.length > current.pattern.source.length;
    }

    /**
     * Detect composite KPIs that can be computed from the available columns.
     * For example, if both "clicks" and "impressions" are detected,
     * CTR can be derived as clicks / impressions.
     */
    public detectCompositeKPIs(classifications: ColumnKPIClassification[]): DetectedCompositeKPI[] {
        // Collect all detected KPI identifiers
        const detectedKPIs = new Set<string>(
            classifications
                .filter(c => c.kpi !== null)
                .map(c => c.kpi as string)
        );

        return COMPOSITE_KPI_DEFINITIONS.map(def => ({
            kpi: def.kpi,
            label: def.label,
            formula: def.formula,
            required_kpis: def.required_kpis,
            confidence: def.confidence,
            available: def.required_kpis.every(rk => detectedKPIs.has(rk)),
        }));
    }

    /**
     * Retrieve cached KPI classification from the database.
     * Classification is stored as part of the data_model_summaries table's summary_data.
     */
    private async getCachedClassification(dataModelId: number): Promise<KPIClassificationResult | null> {
        try {
            const dataSource = await getAppDataSource();
            const result = await dataSource.query(
                `SELECT summary_data, computed_at
                 FROM data_model_summaries
                 WHERE data_model_id = $1 AND error_message IS NULL
                 ORDER BY computed_at DESC
                 LIMIT 1`,
                [dataModelId]
            );

            if (!result || result.length === 0) {
                return null;
            }

            const summaryData = typeof result[0].summary_data === 'string'
                ? JSON.parse(result[0].summary_data)
                : result[0].summary_data;

            // Only return if classification data exists in the cache
            if (!summaryData.kpi_classification) {
                return null;
            }

            return {
                ...summaryData.kpi_classification,
                from_cache: true,
            };
        } catch (error: any) {
            console.error(`[DataModelAnalysisService] Error fetching cached classification:`, error.message);
            return null;
        }
    }

    /**
     * Store KPI classification alongside the summary data.
     * Merges with existing summary_data if present, or creates a new record.
     */
    private async storeClassification(
        dataModelId: number,
        classification: KPIClassificationResult
    ): Promise<void> {
        try {
            const dataSource = await getAppDataSource();

            // Try to update existing summary record to include classification
            const existing = await dataSource.query(
                `SELECT id, summary_data FROM data_model_summaries
                 WHERE data_model_id = $1 AND error_message IS NULL
                 ORDER BY computed_at DESC LIMIT 1`,
                [dataModelId]
            );

            if (existing && existing.length > 0) {
                const summaryData = typeof existing[0].summary_data === 'string'
                    ? JSON.parse(existing[0].summary_data)
                    : existing[0].summary_data;

                summaryData.kpi_classification = {
                    columns: classification.columns,
                    detected_composites: classification.detected_composites,
                    summary: classification.summary,
                    is_marketing_data: classification.is_marketing_data,
                    classified_at: classification.classified_at,
                };

                await dataSource.query(
                    `UPDATE data_model_summaries SET summary_data = $1 WHERE id = $2`,
                    [JSON.stringify(summaryData), existing[0].id]
                );
            } else {
                // No existing summary — create a minimal record for classification only
                await dataSource.query(
                    `INSERT INTO data_model_summaries (data_model_id, row_count, column_count, summary_data, computed_at, query_execution_ms)
                     VALUES ($1, $2, $3, $4, NOW(), 0)`,
                    [
                        dataModelId,
                        0,
                        classification.summary.total_columns,
                        JSON.stringify({
                            columns: [],
                            kpi_classification: {
                                columns: classification.columns,
                                detected_composites: classification.detected_composites,
                                summary: classification.summary,
                                is_marketing_data: classification.is_marketing_data,
                                classified_at: classification.classified_at,
                            },
                        }),
                    ]
                );
            }
        } catch (error: any) {
            console.error(`[DataModelAnalysisService] Error storing classification:`, error.message);
            // Storing is best-effort
        }
    }

    /**
     * Perform full statistical analysis on a data model (DM-003).
     * Combines summary statistics with correlations, anomaly detection, and trend analysis.
     *
     * @param dataModelId - The ID of the data model
     * @param tokenDetails - User token details for authorization
     * @param organizationId - Optional organization ID
     * @param forceRefresh - If true, recompute even if cached analysis exists
     * @returns DataModelAnalysisResult with all statistical analyses
     */
    public async analyzeModel(
        dataModelId: number,
        tokenDetails: any,
        organizationId?: number | null,
        forceRefresh: boolean = false
    ): Promise<DataModelAnalysisResult> {
        const startTime = Date.now();

        // Check for cached analysis unless force refresh
        if (!forceRefresh) {
            const cached = await this.getCachedAnalysis(dataModelId);
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

        // Execute the data model's SQL query
        const queryStartTime = Date.now();
        let rows: any[];
        try {
            rows = await processor.executeDataModelQuery(dataModelId, tokenDetails, organizationId);
        } catch (error: any) {
            throw new Error(`Failed to execute data model query: ${error.message}`);
        }
        const queryExecutionMs = Date.now() - queryStartTime;

        if (!rows || rows.length === 0) {
            return {
                data_model_id: dataModelId,
                data_model_name: dataModel.name || null,
                row_count: 0,
                column_count: 0,
                numeric_columns: 0,
                summary: [],
                correlations: [],
                anomalies: [],
                trends: [],
                computed_at: new Date().toISOString(),
                query_execution_ms: queryExecutionMs,
                analysis_execution_ms: Date.now() - startTime,
                from_cache: false,
            };
        }

        // 1. Column-level summary statistics
        const summary = this.analyzeResultSet(rows);

        // 2. Identify numeric columns for statistical analysis
        const numericColumnNames = summary
            .filter(col => col.data_type === 'numeric')
            .map(col => col.column_name);

        // 3. Correlations between numeric columns
        const correlations = computeColumnCorrelations(rows, numericColumnNames);

        // 4. Anomaly detection across numeric columns
        const anomalies = detectAnomalies(rows, numericColumnNames);

        // 5. Trend analysis on numeric columns
        const trends = computeTrends(rows, numericColumnNames);

        const analysisResult: DataModelAnalysisResult = {
            data_model_id: dataModelId,
            data_model_name: dataModel.name || null,
            row_count: rows.length,
            column_count: summary.length,
            numeric_columns: numericColumnNames.length,
            summary,
            correlations,
            anomalies,
            trends,
            computed_at: new Date().toISOString(),
            query_execution_ms: queryExecutionMs,
            analysis_execution_ms: Date.now() - startTime,
            from_cache: false,
        };

        // Store the analysis in the database
        await this.storeAnalysis(dataModelId, analysisResult, queryExecutionMs);

        return analysisResult;
    }

    /**
     * Retrieve cached analysis result for a data model.
     * Returns null if no cached analysis exists.
     */
    public async getCachedAnalysis(dataModelId: number): Promise<DataModelAnalysisResult | null> {
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

            // Only return if full analysis data exists in the cache
            if (!summaryData.analysis) {
                return null;
            }

            const analysisData = summaryData.analysis;

            return {
                data_model_id: dataModelId,
                data_model_name: summaryData.data_model_name || null,
                row_count: row.row_count,
                column_count: row.column_count,
                numeric_columns: analysisData.numeric_columns || 0,
                summary: summaryData.columns || [],
                correlations: analysisData.correlations || [],
                anomalies: analysisData.anomalies || [],
                trends: analysisData.trends || [],
                computed_at: row.computed_at instanceof Date
                    ? row.computed_at.toISOString()
                    : String(row.computed_at),
                query_execution_ms: row.query_execution_ms || 0,
                analysis_execution_ms: analysisData.analysis_execution_ms || 0,
                from_cache: true,
            };
        } catch (error: any) {
            console.error(`[DataModelAnalysisService] Error fetching cached analysis:`, error.message);
            return null;
        }
    }

    /**
     * Store analysis results in the data_model_summaries table.
     * Merges with existing summary_data if present, or creates a new record.
     */
    private async storeAnalysis(
        dataModelId: number,
        analysisResult: DataModelAnalysisResult,
        queryExecutionMs: number
    ): Promise<void> {
        try {
            const dataSource = await getAppDataSource();

            // Try to update existing summary record to include analysis
            const existing = await dataSource.query(
                `SELECT id, summary_data FROM data_model_summaries
                 WHERE data_model_id = $1 AND error_message IS NULL
                 ORDER BY computed_at DESC LIMIT 1`,
                [dataModelId]
            );

            if (existing && existing.length > 0) {
                const summaryData = typeof existing[0].summary_data === 'string'
                    ? JSON.parse(existing[0].summary_data)
                    : existing[0].summary_data;

                // Update columns and add analysis data
                summaryData.columns = analysisResult.summary;
                summaryData.data_model_name = analysisResult.data_model_name;
                summaryData.analysis = {
                    numeric_columns: analysisResult.numeric_columns,
                    correlations: analysisResult.correlations,
                    anomalies: analysisResult.anomalies,
                    trends: analysisResult.trends,
                    analysis_execution_ms: analysisResult.analysis_execution_ms,
                };

                await dataSource.query(
                    `UPDATE data_model_summaries
                     SET summary_data = $1, row_count = $2, column_count = $3, computed_at = NOW(), query_execution_ms = $4
                     WHERE id = $5`,
                    [JSON.stringify(summaryData), analysisResult.row_count, analysisResult.column_count, queryExecutionMs, existing[0].id]
                );
            } else {
                // No existing summary — create a new record
                await dataSource.query(
                    `INSERT INTO data_model_summaries (data_model_id, row_count, column_count, summary_data, computed_at, query_execution_ms)
                     VALUES ($1, $2, $3, $4, NOW(), $5)`,
                    [
                        dataModelId,
                        analysisResult.row_count,
                        analysisResult.column_count,
                        JSON.stringify({
                            data_model_name: analysisResult.data_model_name,
                            columns: analysisResult.summary,
                            analysis: {
                                numeric_columns: analysisResult.numeric_columns,
                                correlations: analysisResult.correlations,
                                anomalies: analysisResult.anomalies,
                                trends: analysisResult.trends,
                                analysis_execution_ms: analysisResult.analysis_execution_ms,
                            },
                        }),
                        queryExecutionMs,
                    ]
                );
            }
        } catch (error: any) {
            console.error(`[DataModelAnalysisService] Error storing analysis:`, error.message);
            // Don't throw — storing is best-effort, the analysis was still computed
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