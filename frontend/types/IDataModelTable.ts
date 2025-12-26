import type { IDataModelTableColumn } from "./IDataModelTableColumn";

export interface IDataModelTable {
    table_name: string; // Physical table name for SQL queries
    logical_name?: string; // Logical/display name for UI
    original_sheet_name?: string; // Original sheet/file name
    table_type?: string; // excel, pdf, google_analytics, etc
    schema: string;
    columns: IDataModelTableColumn[];
}