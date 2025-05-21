import type { IDataModelTableColumn } from "./IDataModelTableColumn";

export interface IDataModelTable {
    table_name: string;
    schema: string;
    columns: IDataModelTableColumn[];
}