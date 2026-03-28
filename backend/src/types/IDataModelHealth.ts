/**
 * IDataModelHealth.ts
 *
 * Types used by DataModelHealthService (backend) and the health API endpoints.
 * The corresponding frontend types live in frontend/types/IDataModel.ts.
 */

export type DataModelHealthStatus = 'healthy' | 'warning' | 'blocked' | 'unknown';

export type DataModelType = 'dimension' | 'fact' | 'aggregated' | null;

/**
 * A single issue detected during health analysis.
 * Serialised into dra_data_models.health_issues (JSONB).
 */
export interface IHealthIssue {
    /** Machine-readable code matched by the frontend for localisation / icon selection */
    code: HealthIssueCode;
    severity: 'info' | 'warning' | 'error';
    title: string;
    description: string;
    recommendation: string;
}

/** All possible issue codes produced by DataModelHealthService */
export type HealthIssueCode =
    | 'MISSING_AGGREGATE_FUNCTION'
    | 'NO_AGGREGATION_WITH_FILTER'
    | 'NO_AGGREGATION_NO_FILTER_SMALL_SOURCE'
    | 'FULL_TABLE_SCAN_LARGE_SOURCE'
    | 'FILTER_WITHOUT_AGGREGATION_LARGE_SOURCE'
    // Issue #361: Medallion Architecture layer validation codes
    | 'LAYER_MISMATCH_RAW_DATA'
    | 'LAYER_MISMATCH_CLEAN_DATA'
    | 'LAYER_MISMATCH_BUSINESS_READY'
    | 'NON_STANDARD_LAYER_FLOW';

/** Row metadata resolved from dra_table_metadata + live COUNT */
export interface ISourceTableMeta {
    schemaName: string;
    physicalTableName: string;
    logicalTableName: string;
    /** NULL when the source table cannot be counted (e.g. external traditional DB) */
    rowCount: number | null;
}

/** The full report produced by DataModelHealthService.analyse() */
export interface IDataModelHealthReport {
    status: DataModelHealthStatus;
    issues: IHealthIssue[];
    /** Sum of all resolved source table row counts; NULL if none could be determined */
    totalSourceRows: number | null;
    analysedAt: Date;
}
