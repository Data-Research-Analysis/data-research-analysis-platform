import type { IDataSource } from "./IDataSource";
import type { IUsersPlatform } from "./IUsersPlatform";

export interface IDataModel {
    id: number;
    schema: string;
    name: string;
    sql_query: string;
    data_source: IDataSource;
    users_platform: IUsersPlatform;
}