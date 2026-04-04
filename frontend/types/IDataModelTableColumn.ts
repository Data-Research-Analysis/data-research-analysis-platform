export interface IDataModelTableColumn {
    column_name: string;
    data_type: string;
    character_maximum_length: number;
    table_name: string;
    schema: string;
    alias_name: string;
    data_model_id?: number; // Optional: ID of the data model this column belongs to (Issue #361)
}