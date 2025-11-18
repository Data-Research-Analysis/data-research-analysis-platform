import type { IDataModel } from "./IDataModel";
import type { IDataSourceConnectionDetails } from "./IDataSourceConnectionDetails";
import type { IProject } from "./IProject";

export interface IDataSource {
    id: number;
    name: string;
    data_type: string;
    connection_details: IDataSourceConnectionDetails;
    project_id: number;
    user_platform_id: number;
    project?: IProject; // Loaded via relation
    DataModels: IDataModel[];
}