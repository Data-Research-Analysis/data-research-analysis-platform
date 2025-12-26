import type { IDataModelTable } from "./IDataModelTable";

/**
 * Represents a table with additional data source metadata
 * Used for cross-source data model building
 */
export interface ITableWithSource extends IDataModelTable {
    data_source_id: number;
    data_source_name: string;
    data_source_type: string;
}

/**
 * Represents a data source with its tables
 * This is the structure returned by the fetchAllProjectTables API
 */
export interface IDataSourceWithTables {
    dataSourceId: number;
    dataSourceName: string;
    dataSourceType: string;
    tables: IDataModelTable[];
}
