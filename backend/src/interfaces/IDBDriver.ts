import { Sequelize } from "sequelize";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";

export interface IDBDriver {
    initialize(): Promise<boolean>;
    getConcreteDriver(): Promise<Sequelize>;
    query(query: string, params: any): Promise<any>;
    close(): Promise<void>;
    connectExternalDB(connection: IDBConnectionDetails): Promise<Sequelize>;
    getExternalConnection(): Promise<any>;
}