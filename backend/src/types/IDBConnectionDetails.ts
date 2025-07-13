import { EDataSourceType } from "./EDataSourceType.js";

export interface IDBConnectionDetails {
    data_source_type: EDataSourceType;
    host: string;
    port: number;
    schema: string;
    database: string;
    username: string;
    password: string;
}