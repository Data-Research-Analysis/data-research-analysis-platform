import { DataSource } from "typeorm";
import { IDBDriver } from "../interfaces/IDBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { MongoDBNativeService } from "../services/MongoDBNativeService.js";
import { MongoClient, Db } from "mongodb";

/**
 * MongoDBDriver - Handles MongoDB connections using native driver exclusively
 * 
 * Connection Strategy:
 * - Requires connection strings (mongodb:// or mongodb+srv://)
 * - Uses MongoDBNativeService for all connections
 * - Supports ALL MongoDB hosting: Atlas, self-hosted, AWS DocumentDB, Azure Cosmos DB, GCP, replica sets
 * - Works with any hostname/port combination
 * 
 * Important:
 * - Individual fields (host, port, username, password) are NO LONGER SUPPORTED
 * - Use connection string format exclusively
 * 
 * Supported Connection String Formats:
 * - Standard: mongodb://user:pass@host:27017/database
 * - SRV (Atlas): mongodb+srv://user:pass@cluster.mongodb.net/database
 * - Replica Set: mongodb://user:pass@host1:27017,host2:27017/db?replicaSet=rs0
 * - With options: mongodb://user:pass@host:27017/db?authSource=admin&retryWrites=true
 */
export class MongoDBDriver implements IDBDriver {
    private static instance: MongoDBDriver;
    private dataSource!: DataSource;
    
    // Native driver connection details
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
        // Close native MongoDB connection
        if (this.nativeClientId) {
            await MongoDBNativeService.getInstance().disconnect(this.nativeClientId);
            this.nativeClientId = undefined;
            this.nativeConnectionString = undefined;
        }
    }

    /**
     * Connect to external MongoDB database using connection string
     * @throws Error if connection_string is not provided
     */
    public async connectExternalDB(connection: IDBConnectionDetails): Promise<DataSource> {
        return new Promise<DataSource>(async (resolve, reject) => {
            console.log('[MongoDBDriver] Connecting to external MongoDB');
            
            const connectionString = connection.connection_string;

            // Require connection string for MongoDB
            if (!connectionString) {
                const error = new Error('MongoDB requires a connection_string. Individual fields (host, port, etc.) are no longer supported.');
                console.error('[MongoDBDriver]', error.message);
                reject(error);
                return;
            }

            try {
                // Generate unique client ID for this connection
                this.nativeClientId = `mongodb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
                reject(error);
            }
        });
    }

    public async getExternalConnection(): Promise<any> {
        // Always use native connection
        if (!this.nativeConnectionString || !this.nativeClientId) {
            throw new Error('No active MongoDB connection. Use connection string to connect.');
        }
        
        // Return mock connection object for compatibility
        // Actual queries use MongoDBNativeService directly
        return Promise.resolve({ type: 'native', clientId: this.nativeClientId });
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
     * @returns Array of collection names
     */
    public async getMongoDBCollections(): Promise<string[]> {
        if (!this.nativeConnectionString || !this.nativeClientId) {
            throw new Error("MongoDB connection is not established");
        }
        
        return await MongoDBNativeService.getInstance().getCollections(
            this.nativeConnectionString,
            this.nativeClientId
        );
    }

    /**
     * Infer schema from a MongoDB collection by sampling documents
     * @param collectionName - Name of the collection
     * @param sampleSize - Number of documents to sample (default: 100)
     * @returns Array of sampled documents
     */
    public async inferCollectionSchema(collectionName: string, sampleSize: number = 100): Promise<any> {
        if (!this.nativeConnectionString || !this.nativeClientId) {
            throw new Error("MongoDB connection is not established");
        }
        
        return await MongoDBNativeService.getInstance().inferCollectionSchema(
            this.nativeConnectionString,
            this.nativeClientId,
            collectionName,
            sampleSize
        );
    }

    /**
     * Execute MongoDB aggregation pipeline
     * @param collectionName - Name of the collection to query
     * @param pipeline - MongoDB aggregation pipeline array
     * @returns Array of result documents
     */
    public async executeAggregation(collectionName: string, pipeline: any[]): Promise<any[]> {
        if (!this.nativeConnectionString || !this.nativeClientId) {
            throw new Error("MongoDB connection is not established");
        }
        
        return await MongoDBNativeService.getInstance().executeAggregation(
            this.nativeConnectionString,
            this.nativeClientId,
            collectionName,
            pipeline
        );
    }
}
