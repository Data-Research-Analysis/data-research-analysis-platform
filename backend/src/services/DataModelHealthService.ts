import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { EPlatformSettingKey } from '../models/DRAPlatformSettings.js';
import {
    DataModelHealthStatus,
    DataModelType,
    HealthIssueCode,
    IDataModelHealthReport,
    IHealthIssue,
    ISourceTableMeta,
} from '../types/IDataModelHealth.js';
import { EDataLayer } from '../types/IDataLayer.js';
import { DataModelLayerService } from './DataModelLayerService.js';

/**
 * Set of internal DRA-managed schemas where data is stored in the local
 * PostgreSQL instance and can be counted cheaply.
 */
const INTERNAL_SCHEMAS = new Set([
    'dra_excel',
    'dra_pdf',
    'dra_mongodb',
    'dra_google_analytics',
    'dra_google_ad_manager',
    'dra_google_ads',
    'dra_meta_ads',
    'dra_linkedin_ads',
    'dra_hubspot',
    'dra_klaviyo',
]);

/** Default thresholds used when platform settings are not yet seeded (Issue #3) */
const DEFAULT_MAX_DATA_MODEL_ROWS = 100_000;
const DEFAULT_LARGE_SOURCE_THRESHOLD = 500_000;

/** Validate that a string is a safe SQL identifier (no injection) */
function isSafeIdentifier(value: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue detail catalogue
// ─────────────────────────────────────────────────────────────────────────────

const ISSUE_DETAILS: Record<HealthIssueCode, Omit<IHealthIssue, 'code'>> = {
    MISSING_AGGREGATE_FUNCTION: {
        severity: 'warning',
        title: 'GROUP BY without aggregation',
        description:
            'Your model groups rows but does not apply any aggregate function (SUM, COUNT, AVG, etc.). ' +
            'This means every row in each group is returned separately, which can produce a very large result set.',
        recommendation:
            'Add at least one aggregate function to your GROUP BY configuration (e.g. COUNT(*), SUM(amount)) ' +
            'or remove the GROUP BY if you intend a dimension table.',
    },
    NO_AGGREGATION_WITH_FILTER: {
        severity: 'warning',
        title: 'No aggregation — filtered result set',
        description:
            'This model returns raw rows from the source table filtered by a WHERE clause. ' +
            'The WHERE clause reduces data volume, but the result set could still be large depending on filter selectivity.',
        recommendation:
            'Consider adding aggregation (GROUP BY + aggregate functions) to produce a summarised result set ' +
            'suitable for charting. If you need raw rows, mark this model as a Dimension table.',
    },
    NO_AGGREGATION_NO_FILTER_SMALL_SOURCE: {
        severity: 'warning',
        title: 'No aggregation or filters on source table',
        description:
            'This model performs a full table scan with no aggregation or WHERE filter. ' +
            'The source table is currently small, but may grow over time.',
        recommendation:
            'Add aggregation or a WHERE clause to limit the result set. ' +
            'For lookup / dimension data you can mark this model as a Dimension table to suppress this warning.',
    },
    FULL_TABLE_SCAN_LARGE_SOURCE: {
        severity: 'error',
        title: 'Full table scan on a large source — chart queries blocked',
        description:
            'This model has no aggregation and no WHERE filter on a source table with a very large row count. ' +
            'Loading this model in a dashboard would send millions of raw rows to the browser and will crash the tab.',
        recommendation:
            'Add GROUP BY + aggregate functions to summarise the data before charting. ' +
            'Alternatively add a WHERE clause to restrict the rows returned. ' +
            'Until this is fixed, chart builder queries for this model are blocked.',
    },
    FILTER_WITHOUT_AGGREGATION_LARGE_SOURCE: {
        severity: 'warning',
        title: 'Filtered but unaggregated model on a large source',
        description:
            'This model has a WHERE filter but no aggregation on a large source table. ' +
            'The filter provides some protection, but depending on selectivity the result set may still be very large.',
        recommendation:
            'Add GROUP BY + aggregate functions to produce a summarised result set, ' +
            'or tighten the WHERE filter to ensure the output stays within acceptable limits.',
    },
    // Issue #361: Medallion Architecture layer validation issues
    LAYER_MISMATCH_RAW_DATA: {
        severity: 'warning',
        title: 'Raw Data layer mismatch',
        description:
            'This model is assigned to the Raw Data (Bronze) layer but contains transformations or aggregations. ' +
            'Raw Data models should preserve the original source structure with minimal changes.',
        recommendation:
            'Either remove transformations/aggregations to keep as Raw Data, or reassign to Clean Data or Business Ready layer.',
    },
    LAYER_MISMATCH_CLEAN_DATA: {
        severity: 'warning',
        title: 'Clean Data layer requirements not met',
        description:
            'This model is assigned to the Clean Data (Silver) layer but lacks the required transformations or filtering. ' +
            'Clean Data models should include data cleaning, deduplication, or filtering operations.',
        recommendation:
            'Add transformation logic (CASE statements, CAST), filtering (WHERE clause), or deduplication (DISTINCT) ' +
            'to meet Clean Data layer requirements.',
    },
    LAYER_MISMATCH_BUSINESS_READY: {
        severity: 'warning',
        title: 'Business Ready layer requirements not met',
        description:
            'This model is assigned to the Business Ready (Gold) layer but lacks aggregations or joins. ' +
            'Business Ready models should provide analytics-ready data with metrics and joined dimensions.',
        recommendation:
            'Add aggregation (GROUP BY with SUM/COUNT/AVG) or join multiple tables to create consolidated business metrics.',
    },
    NON_STANDARD_LAYER_FLOW: {
        severity: 'info',
        title: 'Non-standard layer flow detected',
        description:
            'This model uses other data models as sources but does not follow the standard layer progression (Raw → Clean → Business). ' +
            'While functional, this may make data lineage harder to understand.',
        recommendation:
            'Consider restructuring your data models to follow the standard Bronze → Silver → Gold flow for clearer data lineage.',
    },
};

function buildIssue(code: HealthIssueCode): IHealthIssue {
    return { code, ...ISSUE_DETAILS[code] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class DataModelHealthService {
    private static instance: DataModelHealthService;

    private constructor() {}

    public static getInstance(): DataModelHealthService {
        if (!DataModelHealthService.instance) {
            DataModelHealthService.instance = new DataModelHealthService();
        }
        return DataModelHealthService.instance;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Pure structural analysis — no DB writes.
     *
     * @param queryJSON       Parsed query JSON from DRADataModel.query
     * @param modelType       Persisted model type (dimension, fact, aggregated, null)
     * @param sourceMeta      Resolved source table metadata (from resolveSourceTableMeta)
     * @param maxOutputRows   Platform threshold: row_count that triggers "blocked" on output
     * @param largeSourceThreshold  Platform threshold: source rows that make a full-table scan "blocked"
     * @param dataLayer       Issue #361: Assigned data layer for validation (optional)
     */
    public analyse(
        queryJSON: any,
        modelType: DataModelType,
        sourceMeta: ISourceTableMeta[],
        maxOutputRows: number = DEFAULT_MAX_DATA_MODEL_ROWS,
        largeSourceThreshold: number = DEFAULT_LARGE_SOURCE_THRESHOLD,
        dataLayer?: EDataLayer | null,
    ): IDataModelHealthReport {
        // Dimension models are always healthy — they are small lookup tables by definition
        if (modelType === 'dimension') {
            return {
                status: 'healthy',
                issues: [],
                totalSourceRows: null,
                analysedAt: new Date(),
            };
        }

        const hasAggregation =
            (queryJSON?.query_options?.group_by?.aggregate_functions?.length ?? 0) > 0 ||
            (queryJSON?.query_options?.group_by?.aggregate_expressions?.length ?? 0) > 0;

        const hasGroupBy =
            (queryJSON?.query_options?.group_by?.group_by_columns?.length ?? 0) > 0;

        const hasWhere = (queryJSON?.query_options?.where?.length ?? 0) > 0;

        const knownSourceRows = sourceMeta.filter((t) => t.rowCount !== null);
        const totalSourceRows =
            knownSourceRows.length > 0
                ? knownSourceRows.reduce((sum, t) => sum + (t.rowCount ?? 0), 0)
                : null;

        const isLargeSource = totalSourceRows !== null && totalSourceRows > largeSourceThreshold;

        // ── Classification matrix ────────────────────────────────────────────
        let status: HealthStatus = 'healthy';
        const issues: IHealthIssue[] = [];

        if (hasAggregation) {
            status = 'healthy';
        } else if (!hasAggregation && hasGroupBy) {
            status = 'warning';
            issues.push(buildIssue('MISSING_AGGREGATE_FUNCTION'));
        } else if (!hasAggregation && !hasWhere && isLargeSource) {
            status = 'blocked';
            issues.push(buildIssue('FULL_TABLE_SCAN_LARGE_SOURCE'));
        } else if (!hasAggregation && hasWhere && isLargeSource) {
            status = 'warning';
            issues.push(buildIssue('FILTER_WITHOUT_AGGREGATION_LARGE_SOURCE'));
        } else if (!hasAggregation && hasWhere) {
            status = 'warning';
            issues.push(buildIssue('NO_AGGREGATION_WITH_FILTER'));
        } else {
            // No aggregation, no where, small or unknown source
            status = 'warning';
            issues.push(buildIssue('NO_AGGREGATION_NO_FILTER_SMALL_SOURCE'));
        }

        // ── Issue #361: Layer validation (Medallion Architecture) ────────────
        if (dataLayer) {
            const layerService = DataModelLayerService.getInstance();
            const layerValidation = layerService.validateLayerRequirements(
                queryJSON,
                dataLayer,
            );

            // Add layer validation issues
            if (!layerValidation.valid) {
                for (const issue of layerValidation.issues) {
                    if (issue.severity === 'error') {
                        if (dataLayer === EDataLayer.RAW_DATA && issue.message.includes('should preserve')) {
                            issues.push(buildIssue('LAYER_MISMATCH_RAW_DATA'));
                        } else if (dataLayer === EDataLayer.CLEAN_DATA && issue.message.includes('requires')) {
                            issues.push(buildIssue('LAYER_MISMATCH_CLEAN_DATA'));
                        } else if (dataLayer === EDataLayer.BUSINESS_READY && issue.message.includes('requires')) {
                            issues.push(buildIssue('LAYER_MISMATCH_BUSINESS_READY'));
                        }
                    }
                }
                // Upgrade status: healthy → warning, leave warning/blocked as-is
                if (status === 'healthy') {
                    status = 'warning';
                }
            }

            // Note: Layer flow validation (checking parent model layers) requires database access
            // and is handled separately in DataModelProcessor.validateLayerFlow()
        }

        return {
            status,
            issues,
            totalSourceRows,
            analysedAt: new Date(),
        };
    }

    /**
     * Resolve source table metadata (including live row counts) for all unique
     * source tables referenced in the query JSON's columns array.
     *
     * Only tables in internal DRA-managed schemas (dra_excel, dra_google_analytics,
     * etc.) are counted — external traditional-DB tables return rowCount: null.
     */
    public async resolveSourceTableMeta(queryJSON: any): Promise<ISourceTableMeta[]> {
        const columns: any[] = queryJSON?.columns ?? [];

        // Collect unique (schema, table_name) pairs
        const seen = new Set<string>();
        const pairs: Array<{ schemaName: string; tableName: string }> = [];

        for (const col of columns) {
            const schemaName: string = col?.schema ?? '';
            const tableName: string = col?.table_name ?? '';
            if (!schemaName || !tableName) continue;
            const key = `${schemaName}.${tableName}`;
            if (seen.has(key)) continue;
            seen.add(key);
            pairs.push({ schemaName, tableName });
        }

        if (pairs.length === 0) return [];

        const manager = AppDataSource.manager;
        const results: ISourceTableMeta[] = [];

        for (const { schemaName, tableName } of pairs) {
            // Look up logical name from dra_table_metadata
            const meta = await manager.findOne(DRATableMetadata, {
                where: { schema_name: schemaName, physical_table_name: tableName },
            });

            const logicalTableName = meta?.logical_table_name ?? tableName;
            let rowCount: number | null = null;

            // Only count rows for internal DRA-managed schemas
            if (
                INTERNAL_SCHEMAS.has(schemaName) &&
                isSafeIdentifier(schemaName) &&
                isSafeIdentifier(tableName)
            ) {
                try {
                    const countResult: Array<{ cnt: string }> = await manager.query(
                        `SELECT COUNT(*) AS cnt FROM "${schemaName}"."${tableName}"`,
                    );
                    rowCount = parseInt(countResult[0]?.cnt ?? '0', 10);
                } catch {
                    // Table might not exist yet; leave rowCount as null
                }
            }

            results.push({ schemaName, physicalTableName: tableName, logicalTableName, rowCount });
        }

        return results;
    }

    /**
     * Full cycle: re-count the data model's output table rows, resolve source
     * metadata, run analysis, and persist the results back to dra_data_models.
     *
     * Used by:
     *  - Issue #4 (persist at model save time)
     *  - Issue #12 (post-sync health re-check)
     */
    public async recomputeAndPersist(dataModelId: number): Promise<IDataModelHealthReport> {
        const manager = AppDataSource.manager;

        const dataModel = await manager.findOne(DRADataModel, { where: { id: dataModelId } });
        if (!dataModel) {
            throw new Error(`DataModel #${dataModelId} not found`);
        }

        // ── 1. Count output rows in the model's physical table ───────────────
        let outputRowCount: number | null = null;
        const schema = dataModel.schema;
        const tableName = dataModel.name;
        if (isSafeIdentifier(schema) && isSafeIdentifier(tableName)) {
            try {
                const countResult: Array<{ cnt: string }> = await manager.query(
                    `SELECT COUNT(*) AS cnt FROM "${schema}"."${tableName}"`,
                );
                outputRowCount = parseInt(countResult[0]?.cnt ?? '0', 10);
            } catch {
                // Model table may not have been materialised yet
            }
        }

        // ── 2. Read thresholds from platform settings (falls back to defaults) ─
        const { maxOutputRows, largeSourceThreshold } = await this.loadThresholds();

        // ── 3. Resolve source table metadata ────────────────────────────────
        const sourceMeta = await this.resolveSourceTableMeta(dataModel.query);

        // ── 4. Run analysis ──────────────────────────────────────────────────
        const report = this.analyse(
            dataModel.query,
            (dataModel.model_type ?? null) as any,
            sourceMeta,
            maxOutputRows,
            largeSourceThreshold,
            dataModel.data_layer as EDataLayer | null,
        );

        // ── 5. Persist ───────────────────────────────────────────────────────
        await manager.update(DRADataModel, dataModelId, {
            row_count: outputRowCount ?? dataModel.row_count,
            health_status: report.status,
            health_issues: report.issues as any,
            source_row_count: report.totalSourceRows,
        });

        return report;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Read `max_data_model_rows` and `large_source_table_threshold` from
     * dra_platform_settings via PlatformSettingsProcessor.
     * Falls back to hardcoded defaults when not yet seeded.
     */
    public async loadThresholds(): Promise<{
        maxOutputRows: number;
        largeSourceThreshold: number;
    }> {
        try {
            // Lazy import avoids circular-dependency issues at module load time
            const { PlatformSettingsProcessor } = await import('../processors/PlatformSettingsProcessor.js');
            const processor = PlatformSettingsProcessor.getInstance();

            const [maxRows, largeThreshold] = await Promise.all([
                processor.getSetting<number>(EPlatformSettingKey.MAX_DATA_MODEL_ROWS),
                processor.getSetting<number>(EPlatformSettingKey.LARGE_SOURCE_TABLE_THRESHOLD),
            ]);

            return {
                maxOutputRows: maxRows ?? DEFAULT_MAX_DATA_MODEL_ROWS,
                largeSourceThreshold: largeThreshold ?? DEFAULT_LARGE_SOURCE_THRESHOLD,
            };
        } catch {
            return {
                maxOutputRows: DEFAULT_MAX_DATA_MODEL_ROWS,
                largeSourceThreshold: DEFAULT_LARGE_SOURCE_THRESHOLD,
            };
        }
    }
}
