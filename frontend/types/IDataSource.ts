import type { IDataSourceConnectionDetails } from "./IDataSourceConnectionDetails";

export interface IDataSource {
    id: number;
    name: string;
    data_type: string;
    connection_details:IDataSourceConnectionDetails;
    project_id: number;
    user_platform_id: number;
}