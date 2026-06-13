import type { IDataModelTableColumn } from "./IDataModelTableColumn";

export interface IDataModelTable {
    data_model_id: number;
    table_name: string;
    logical_name?: string;
    original_sheet_name?: string;
    table_type?: string;
    schema: string;
    columns: IDataModelTableColumn[];
    row_count: number;
    rows?: any[];
    is_cross_source: boolean;
    is_auto_created?: boolean | null;
    health_status?: string;
    model_type?: string;
    source_row_count?: number | null;
}