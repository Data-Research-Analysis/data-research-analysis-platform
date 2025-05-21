import type { IDataSource } from "./IDataSource";

export interface IProject {
    id: number;
    user_platform_id: number;
    name: string;
    DataSources: IDataSource[];
}