import type { IDataSourceConnectionDetails } from "./IDataSourceConnectionDetails";

export interface IVisualization {
    id: number;
    schema: string;
    name: string;
    sql_query: string;
    query: string;
    data_source_id: number;
    data_model_id: number;
    visualization_id: number;
    user_platform_id: number;
}