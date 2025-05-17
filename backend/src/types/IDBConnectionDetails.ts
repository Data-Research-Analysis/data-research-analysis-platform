import { EDataSourceType } from "./EDataSourceType";

export interface IDBConnectionDetails {
    data_source_type: EDataSourceType;
    host: string;
    port: number;
    schema: string;
    database: string;
    username: string;
    password: string;
}