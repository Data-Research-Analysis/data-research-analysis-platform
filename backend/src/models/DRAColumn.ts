/**
 * Represents a column in a data model.
 * This was formerly a TypeORM entity backed by the dra_columns table,
 * which was removed in migration 1781454109000000000-DropDRAColumnsTable.
 * Column data is now sourced from data_model_summaries.summary_data.
 * This interface is retained for backward compatibility with type imports.
 */
export interface DRAColumn {
    id: number;
    data_model_id: number;
    name: string;
    physical_name?: string;
    data_type: string;
    is_nullable: boolean;
    is_primary_key: boolean;
    ordinal_position?: number;
    description?: string;
    label?: string;
    classification?: string;
    kpi_pattern?: string;
    data_source_id?: number;
    created_at: Date;
    updated_at: Date;
    data_source?: any;
}
