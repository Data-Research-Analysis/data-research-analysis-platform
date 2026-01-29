import { DataSource } from "typeorm";
import { IDBDriver } from "../interfaces/IDBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { MongoDBDataSource } from "../datasources/MongoDBDataSource.js";
import { MongoClient, Db } from "mongodb";

export class MongoDBDriver implements IDBDriver {
    private static instance: MongoDBDriver;
    private dataSource!: DataSource;
    private externalDataSource!: DataSource;

    private constructor() {
    }

    public static getInstance(): MongoDBDriver {
        if (!MongoDBDriver.instance) {
            MongoDBDriver.instance = new MongoDBDriver();
        }
        return MongoDBDriver.instance;
    }

    public async initialize(dataSource: DataSource): Promise<boolean> {
        this.dataSource = dataSource;
        return true;
    }

    public getConcreteDriver(): Promise<DataSource> {
        return Promise.resolve(this.dataSource);
    }

    public async query(query: string, params: any): Promise<any> {
        // Not used for MongoDB in this context, use executeAggregation instead
        return Promise.resolve(null);
    }

    public async close(): Promise<void> {
        if (this.externalDataSource && this.externalDataSource.isInitialized) {
            await this.externalDataSource.destroy();
        }
    }

    public async connectExternalDB(connection: IDBConnectionDetails): Promise<DataSource> {
        return new Promise<DataSource>(async (resolve, reject) => {
            console.log('Connecting to external MongoDB');
            const host = connection.host;
            const port = connection.port;
            const database = connection.database;
            const username = connection.username;
            const password = connection.password;

            let dataSource = MongoDBDataSource.getInstance().getDataSource(host, port, database, username, password);
            try {
                const result = await dataSource.initialize();
                if (dataSource.isInitialized) {
                    this.externalDataSource = dataSource;
                    console.log('External MongoDB connection has been established successfully.');
                    return resolve(this.externalDataSource);
                }
                console.error('Unable to connect to the database');
                return reject(null);
            } catch (error) {
                console.error('Unable to connect to the database:', error);
                return reject(null);
            }
        });
    }

    public async getExternalConnection(): Promise<any> {
        return Promise.resolve(this.externalDataSource);
    }

    public getTablesColumnDetails(schema: string): Promise<string> {
        // Not used for MongoDB schema inference
        return Promise.resolve("");
    }

    public getTablesRelationships(schema: string): Promise<string> {
        // Not used for MongoDB
        return Promise.resolve("");
    }

    // MongoDB Specific Methods

    public async getMongoDBCollections(): Promise<string[]> {
        if (!this.externalDataSource || !this.externalDataSource.isInitialized) {
            throw new Error("MongoDB data source is not initialized");
        }

        // TypeORM's mongo driver exposes the native client
        const client = (this.externalDataSource.driver as any).queryRunner.databaseConnection as MongoClient;
        const dbName = this.externalDataSource.options.database as string;
        const db = client.db(dbName);

        const collections = await db.listCollections().toArray();
        return collections.map(c => c.name);
    }

    public async inferCollectionSchema(collectionName: string, sampleSize: number = 100): Promise<any> {
        if (!this.externalDataSource || !this.externalDataSource.isInitialized) {
            throw new Error("MongoDB data source is not initialized");
        }

        const client = (this.externalDataSource.driver as any).queryRunner.databaseConnection as MongoClient;
        const dbName = this.externalDataSource.options.database as string;
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const docs = await collection.find({}).limit(sampleSize).toArray();

        // Simple schema inference: Check fields in validation
        // Real implementation in SchemaCollectorService will handle the mapping
        return docs;
    }

    public async executeAggregation(collectionName: string, pipeline: any[]): Promise<any[]> {
        if (!this.externalDataSource || !this.externalDataSource.isInitialized) {
            throw new Error("MongoDB data source is not initialized");
        }

        const client = (this.externalDataSource.driver as any).queryRunner.databaseConnection as MongoClient;
        const dbName = this.externalDataSource.options.database as string;
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        return await collection.aggregate(pipeline).toArray();
    }
}
