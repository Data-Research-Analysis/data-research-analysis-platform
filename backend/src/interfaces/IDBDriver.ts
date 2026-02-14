import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { DataSource } from "typeorm";

export interface IDBDriver {
    initialize(dataSource: DataSource): Promise<boolean>;
    getConcreteDriver(): Promise<DataSource>;
    query(query: string, params: any): Promise<any>;
    close(): Promise<void>;
    connectExternalDB(connection: IDBConnectionDetails): Promise<DataSource>;
    getExternalConnection(): Promise<any>;
    getTablesColumnDetails(schema: string): Promise<string>;
    getTablesRelationships(schema: string): Promise<string>;
    
    // MongoDB-specific methods (optional implementation)
    executeAggregation?(collectionName: string, pipeline: any[]): Promise<any>;
    inferCollectionSchema?(collectionName: string, sampleSize?: number): Promise<any>;
    getMongoDBCollections?(): Promise<string[]>;
}