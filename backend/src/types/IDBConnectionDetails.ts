import { EDataSourceType } from "./EDataSourceType.js";
import { IAPIConnectionDetails } from "./IAPIConnectionDetails.js";

export interface IDBConnectionDetails {
    data_source_type: EDataSourceType;
    host: string;
    port: number;
    schema: string;
    database: string;
    username: string;
    password: string;
}

// Union type to support both database and API connections
export type IConnectionDetails = IDBConnectionDetails | IAPIConnectionDetails;