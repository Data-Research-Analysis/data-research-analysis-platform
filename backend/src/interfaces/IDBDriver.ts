import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { DataSource } from "typeorm";

export interface IDBDriver {
    initialize(dataSource: DataSource): Promise<boolean>;
    getConcreteDriver(): Promise<DataSource>;
    query(query: string, params: any): Promise<any>;
    close(): Promise<void>;
    connectExternalDB(connection: IDBConnectionDetails): Promise<DataSource>;
    getExternalConnection(): Promise<any>;
}