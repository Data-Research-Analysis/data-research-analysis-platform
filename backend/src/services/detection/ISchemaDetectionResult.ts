/**
 * Interfaces for Schema Auto-Detection Service (CONN-005)
 * 
 * Defines the unified result structure returned by all schema detectors
 * (database, file, API) regardless of the underlying data source type.
 */

/**
 * Classification of how a column should be used in analytics/data modeling
 */
export type ColumnRole = 'fact' | 'dimension' | 'time' | 'unknown';

/**
 * Simplified data type after detection
 */
export type DetectedDataType = 'numeric' | 'categorical' | 'date' | 'boolean' | 'json' | 'text' | 'unknown';

/**
 * Classification of the table's primary purpose
 */
export type TableClassification = 'fact_table' | 'dimension_table' | 'mixed' | 'unknown';

/**
 * A single detected column with its classification metadata
 */
export interface IDetectedColumn {
    /** Original column name from the data source */
    column_name: string;
    /** Native data type as reported by the source (e.g., "integer", "varchar", "timestamp") */
    native_type: string;
    /** Simplified detected type for cross-source compatibility */
    detected_type: DetectedDataType;
    /** Role classification for data modeling */
    role: ColumnRole;
    /** If this column matches a known marketing KPI pattern, the KPI identifier (e.g., "spend", "impressions") */
    kpi_match: string | null;
    /** If this column matches a known dimension pattern, the dimension identifier (e.g., "campaign", "channel") */
    dimension_match: string | null;
    /** Whether the column allows NULL values */
    is_nullable: boolean;
    /** Whether this column is part of the primary key */
    is_primary_key: boolean;
    /** Column default value if any */
    column_default: string | null;
    /** Maximum character length for string types */
    max_length: number | null;
    /** Confidence score for the classification (0-1) */
    confidence: number;
}

/**
 * A detected table/sheet/report with its columns and metadata
 */
export interface IDetectedTable {
    /** Table/sheet/report name */
    table_name: string;
    /** Original name before any sanitization (useful for Excel sheets) */
    original_name: string | null;
    /** Schema name this table belongs to */
    schema_name: string | null;
    /** Classified table type based on column composition */
    classification: TableClassification;
    /** All detected columns */
    columns: IDetectedColumn[];
    /** Primary key column names */
    primary_keys: string[];
    /** Foreign key relationships */
    foreign_keys: IDetectedForeignKey[];
    /** Estimated row count (null if unknown) */
    row_count_estimate: number | null;
    /** Count of metric/fact columns */
    fact_column_count: number;
    /** Count of dimension columns */
    dimension_column_count: number;
    /** Count of time/date columns */
    time_column_count: number;
    /** Any notes or warnings about this table */
    notes: string[];
}

/**
 * Foreign key relationship between tables
 */
export interface IDetectedForeignKey {
    constraint_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
}

/**
 * Complete schema detection result for a data source
 */
/**
 * Request to detect schema for a single data source
 */
export interface ISchemaDetectionRequest {
    /** The type of data source (postgresql, excel, google_ads, etc.) */
    source_type: string;
    /** Data source ID to detect from */
    data_source_id: number;
    /** Optional schema name override */
    schema_name?: string;
    /** Whether to include row count estimates (slower, requires table scans) */
    include_row_estimates?: boolean;
}

/**
 * Request to detect schema for multiple data sources in a single call
 */
export interface ISchemaDetectionBatchRequest {
    /** Array of individual detection requests */
    data_sources: ISchemaDetectionRequest[];
}

/**
 * Result of a batch schema detection operation
 */
export interface ISchemaDetectionBatchResult {
    /** Individual detection results, one per data source */
    results: ISchemaDetectionResult[];
    /** Any errors encountered across all detections */
    errors: string[];
}

export interface ISchemaDetectionResult {
    /** Data source ID (null if detection was done before saving) */
    data_source_id: number | null;
    /** The type of data source (postgresql, excel, google_ads, etc.) */
    source_type: string;
    /** All detected tables/sheets/reports */
    tables: IDetectedTable[];
    /** Timestamp of detection */
    detected_at: string;
    /** Any errors encountered during detection (non-fatal) */
    errors: string[];
    /** Total tables detected */
    total_tables: number;
    /** Summary counts */
    summary: {
        fact_tables: number;
        dimension_tables: number;
        total_columns: number;
        total_kpi_columns: number;
        total_dimension_columns: number;
        total_time_columns: number;
    };
}