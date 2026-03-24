import type { IDataModelTableColumn } from "./IDataModelTableColumn";

export interface IDataModelTable {
    data_model_id: number; // Data model ID (required)
    table_name: string; // Physical table name for SQL queries
    logical_name?: string; // Logical/display name for UI
    original_sheet_name?: string; // Original sheet/file name
    table_type?: string; // excel, pdf, google_analytics, etc
    schema: string;
    columns: IDataModelTableColumn[];
    row_count: number; // Total row count (always present, fast to compute)
    rows?: any[]; // Optional: Only populated when explicitly fetched via pagination endpoint
    is_cross_source: boolean; // Whether this is a cross-source data model
    health_status?: string; // 'healthy' | 'warning' | 'blocked' | 'unknown'
    model_type?: string; // 'dimension' | 'fact' | 'aggregate' | null
    source_row_count?: number | null; // Cached total rows across all source tables
}