import { DataSource } from "typeorm";
import { IDBDriver } from "../interfaces/IDBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { MongoDBDataSource } from "../datasources/MongoDBDataSource.js";
import { MongoDBNativeService } from "../services/MongoDBNativeService.js";
import { MongoClient, Db } from "mongodb";

/**
 * MongoDBDriver - Handles MongoDB connections with dual strategy
 * 
 * Connection Strategies:
 * 1. Connection String (mongodb+srv://...) -> Uses native MongoDB driver
 * 2. Individual Fields (host, port, etc.) -> Uses TypeORM
 * 
 * The driver automatically routes to the appropriate strategy based on
 * whether a connection_string is provided in IDBConnectionDetails
 */
export class MongoDBDriver implements IDBDriver {
    private static instance: MongoDBDriver;
    private dataSource!: DataSource;
    private externalDataSource!: DataSource | null;
    
    // Track connection type and details for native driver
    private connectionType: 'native' | 'typeorm' = 'typeorm';
    private nativeConnectionString?: string;
    private nativeClientId?: string;

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
        if (this.connectionType === 'typeorm') {
            if (this.externalDataSource && this.externalDataSource.isInitialized) {
                await this.externalDataSource.destroy();
                this.externalDataSource = null;
            }
        } else if (this.connectionType === 'native') {
            if (this.nativeClientId) {
                await MongoDBNativeService.getInstance().disconnect(this.nativeClientId);
                this.nativeClientId = undefined;
                this.nativeConnectionString = undefined;
            }
        }
    }

    /**
     * Connect to external MongoDB database
     * Routes to native driver if connection_string is provided, otherwise uses TypeORM
     */
    public async connectExternalDB(connection: IDBConnectionDetails): Promise<DataSource> {
        return new Promise<DataSource>(async (resolve, reject) => {
            console.log('[MongoDBDriver] Connecting to external MongoDB');
            
            const connectionString = connection.connection_string;

            // Route based on connection type
            if (connectionString) {
                // Use native MongoDB driver for connection strings
                console.log('[MongoDBDriver] Using native driver with connection string');
                return this.connectNative(connectionString, resolve, reject);
            } else {
                // Use TypeORM for individual field connections
                console.log('[MongoDBDriver] Using TypeORM with individual fields');
                return this.connectTypeORM(connection, resolve, reject);
            }
        });
    }

    /**
     * Connect using native MongoDB driver (for connection strings)
     */
    private async connectNative(
        connectionString: string,
        resolve: (value: DataSource | PromiseLike<DataSource>) => void,
        reject: (reason?: any) => void
    ): Promise<void> {
        try {
            // Generate unique client ID for this connection
            this.nativeClientId = `mongodb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.connectionType = 'native';
            this.nativeConnectionString = connectionString;

            // Test connection
            const testResult = await MongoDBNativeService.getInstance().testConnection(connectionString);
            
            if (testResult) {
                console.log('[MongoDBDriver] Native MongoDB connection established successfully');
                // Return a mock DataSource to maintain interface compatibility
                // The actual connection is handled by MongoDBNativeService
                resolve({} as DataSource);
            } else {
                console.error('[MongoDBDriver] Unable to connect with native driver');
                reject(new Error('Native MongoDB connection failed'));
            }
        } catch (error) {
            console.error('[MongoDBDriver] Native connection error:', error);
            this.connectionType = 'typeorm'; // Reset on failure
            reject(error);
        }
    }

    /**
     * Connect using TypeORM (for individual fields)
     */
    private async connectTypeORM(
        connection: IDBConnectionDetails,
        resolve: (value: DataSource | PromiseLike<DataSource>) => void,
        reject: (reason?: any) => void
    ): Promise<void> {
        try {
            const { host, port, database, username, password } = connection;

            const dataSource = MongoDBDataSource.getInstance().getDataSource(
                host,
                port,
                database,
                username,
                password
            );

            await dataSource.initialize();
            
            if (dataSource.isInitialized) {
                this.externalDataSource = dataSource;
                this.connectionType = 'typeorm';
                console.log('[MongoDBDriver] TypeORM MongoDB connection established successfully');
                resolve(this.externalDataSource);
            } else {
                console.error('[MongoDBDriver] Unable to connect to the database');
                reject(new Error('TypeORM MongoDB connection failed'));
            }
        } catch (error) {
            console.error('[MongoDBDriver] TypeORM connection error:', error);
            reject(error);
        }
    }

    public async getExternalConnection(): Promise<any> {
        if (this.connectionType === 'native') {
            // Return mock connection for native driver
            return Promise.resolve({ type: 'native', clientId: this.nativeClientId });
        }
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

    /**
     * Get MongoDB collections from the connected database
     * Works with both native and TypeORM connections
     * @returns Array of collection names
     */
    public async getMongoDBCollections(): Promise<string[]> {
        if (this.connectionType === 'native') {
            if (!this.nativeConnectionString || !this.nativeClientId) {
                throw new Error("Native MongoDB connection is not established");
            }
            return await MongoDBNativeService.getInstance().getCollections(
                this.nativeConnectionString,
                this.nativeClientId
            );
        } else {
            // TypeORM connection
            if (!this.externalDataSource || !this.externalDataSource.isInitialized) {
                throw new Error("MongoDB data source is not initialized");
            }

            const mongoDriver = this.externalDataSource.driver as any;
            const client = mongoDriver.queryRunner.databaseConnection as MongoClient;
            const dbName = this.externalDataSource.options.database as string;
            const db: Db = client.db(dbName);

            const collections = await db.listCollections().toArray();
            return collections.map(c => c.name);
        }
    }

    /**
     * Infer schema from a MongoDB collection by sampling documents
     * Works with both native and TypeORM connections
     * @param collectionName - Name of the collection
     * @param sampleSize - Number of documents to sample (default: 100)
     * @returns Array of sampled documents
     */
    public async inferCollectionSchema(collectionName: string, sampleSize: number = 100): Promise<any> {
        if (this.connectionType === 'native') {
            if (!this.nativeConnectionString || !this.nativeClientId) {
                throw new Error("Native MongoDB connection is not established");
            }
            return await MongoDBNativeService.getInstance().inferCollectionSchema(
                this.nativeConnectionString,
                this.nativeClientId,
                collectionName,
                sampleSize
            );
        } else {
            // TypeORM connection
            if (!this.externalDataSource || !this.externalDataSource.isInitialized) {
                throw new Error("MongoDB data source is not initialized");
            }

            const mongoDriver = this.externalDataSource.driver as any;
            const client = mongoDriver.queryRunner.databaseConnection as MongoClient;
            const dbName = this.externalDataSource.options.database as string;
            const db: Db = client.db(dbName);
            const collection = db.collection(collectionName);

            const docs = await collection.find({}).limit(sampleSize).toArray();
            return docs;
        }
    }

    /**
     * Execute MongoDB aggregation pipeline
     * Works with both native and TypeORM connections
     * @param collectionName - Name of the collection to query
     * @param pipeline - MongoDB aggregation pipeline array
     * @returns Array of result documents
     */
    public async executeAggregation(collectionName: string, pipeline: any[]): Promise<any[]> {
        if (this.connectionType === 'native') {
            if (!this.nativeConnectionString || !this.nativeClientId) {
                throw new Error("Native MongoDB connection is not established");
            }
            return await MongoDBNativeService.getInstance().executeAggregation(
                this.nativeConnectionString,
                this.nativeClientId,
                collectionName,
                pipeline
            );
        } else {
            // TypeORM connection
            if (!this.externalDataSource || !this.externalDataSource.isInitialized) {
                throw new Error("MongoDB data source is not initialized");
            }

            const mongoDriver = this.externalDataSource.driver as any;
            const client = mongoDriver.queryRunner.databaseConnection as MongoClient;
            const dbName = this.externalDataSource.options.database as string;
            const db: Db = client.db(dbName);
            const collection = db.collection(collectionName);

            const results = await collection.aggregate(pipeline).toArray();
            return results;
        }
    }
}
