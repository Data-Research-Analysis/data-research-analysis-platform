import type { IDataSource } from "./IDataSource";
import type { IUsersPlatform } from "./IUsersPlatform";
import type { IDataModelSource } from "./IDataModelSource";

export interface IDataModel {
    id: number;
    schema: string;
    name: string;
    sql_query: string;
    data_source?: IDataSource; // Now optional since cross-source models may not have a single data source
    users_platform: IUsersPlatform;
    is_cross_source?: boolean; // Flag indicating if this is a cross-source data model
    data_model_sources?: IDataModelSource[]; // Array of data sources for cross-source models
    execution_metadata?: Record<string, any>; // Metadata for query execution
    created_at?: string; // Creation timestamp
}