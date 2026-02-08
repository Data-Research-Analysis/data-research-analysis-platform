import { MongoClient, Db, Collection } from 'mongodb';

/**
 * MongoDBNativeService - Handles MongoDB connections using native driver
 * 
 * This service is used when connecting via connection strings (e.g., mongodb+srv://...)
 * which typically point to MongoDB Atlas or other managed MongoDB services.
 * 
 * For connections using individual fields (host, port, username, etc.),
 * the TypeORM-based connection is used instead.
 */
export class MongoDBNativeService {
    private static instance: MongoDBNativeService;
    private activeClients: Map<string, MongoClient> = new Map();

    private constructor() {}

    public static getInstance(): MongoDBNativeService {
        if (!MongoDBNativeService.instance) {
            MongoDBNativeService.instance = new MongoDBNativeService();
        }
        return MongoDBNativeService.instance;
    }

    /**
     * Connect to MongoDB using a connection string
     * @param connectionString - Full MongoDB connection string (e.g., mongodb+srv://...)
     * @param clientId - Unique identifier for this connection (typically data_source_id)
     * @returns Connected MongoClient instance
     */
    public async connect(connectionString: string, clientId: string): Promise<MongoClient> {
        try {
            console.log(`[MongoDBNativeService] Connecting with connection string for client: ${clientId}`);
            
            // Check if client already exists
            if (this.activeClients.has(clientId)) {
                const existingClient = this.activeClients.get(clientId)!;
                // Test if connection is still alive
                try {
                    await existingClient.db().admin().ping();
                    console.log(`[MongoDBNativeService] Reusing existing connection for client: ${clientId}`);
                    return existingClient;
                } catch (error) {
                    console.log(`[MongoDBNativeService] Existing connection dead, creating new one for client: ${clientId}`);
                    await this.disconnect(clientId);
                }
            }

            // Create new client
            const client = new MongoClient(connectionString, {
                serverSelectionTimeoutMS: 10000, // 10 second timeout
                connectTimeoutMS: 10000,
            });

            await client.connect();
            
            // Verify connection
            await client.db().admin().ping();
            
            this.activeClients.set(clientId, client);
            console.log(`[MongoDBNativeService] Successfully connected for client: ${clientId}`);
            
            return client;
        } catch (error) {
            console.error(`[MongoDBNativeService] Connection failed for client ${clientId}:`, error);
            throw error;
        }
    }

    /**
     * Get database instance from connection string
     * @param connectionString - MongoDB connection string
     * @param clientId - Unique identifier for this connection
     * @returns Database instance
     */
    public async getDatabase(connectionString: string, clientId: string): Promise<Db> {
        const client = await this.connect(connectionString, clientId);
        
        // Extract database name from connection string
        const dbName = this.extractDatabaseName(connectionString);
        
        if (!dbName) {
            throw new Error('Database name not found in connection string. Please include database name in the connection string.');
        }
        
        return client.db(dbName);
    }

    /**
     * Extract database name from MongoDB connection string
     * @param connectionString - MongoDB connection string
     * @returns Database name or null
     */
    private extractDatabaseName(connectionString: string): string | null {
        try {
            // Pattern: mongodb://... or mongodb+srv://...
            // Database name is between the last / and first ? (or end of string)
            const match = connectionString.match(/\/([^/?]+)(\?|$)/);
            return match ? match[1] : null;
        } catch (error) {
            console.error('[MongoDBNativeService] Error extracting database name:', error);
            return null;
        }
    }

    /**
     * List all collections in the database
     * @param connectionString - MongoDB connection string
     * @param clientId - Unique identifier for this connection
     * @returns Array of collection names
     */
    public async getCollections(connectionString: string, clientId: string): Promise<string[]> {
        try {
            const db = await this.getDatabase(connectionString, clientId);
            const collections = await db.listCollections().toArray();
            return collections.map(col => col.name);
        } catch (error) {
            console.error('[MongoDBNativeService] Error getting collections:', error);
            throw error;
        }
    }

    /**
     * Execute MongoDB aggregation pipeline
     * @param connectionString - MongoDB connection string
     * @param clientId - Unique identifier for this connection
     * @param collectionName - Name of the collection
     * @param pipeline - MongoDB aggregation pipeline
     * @returns Query results
     */
    public async executeAggregation(
        connectionString: string,
        clientId: string,
        collectionName: string,
        pipeline: any[]
    ): Promise<any[]> {
        try {
            const db = await this.getDatabase(connectionString, clientId);
            const collection = db.collection(collectionName);
            const results = await collection.aggregate(pipeline).toArray();
            return results;
        } catch (error) {
            console.error('[MongoDBNativeService] Error executing aggregation:', error);
            throw error;
        }
    }

    /**
     * Infer schema from a MongoDB collection by sampling documents
     * @param connectionString - MongoDB connection string
     * @param clientId - Unique identifier for this connection
     * @param collectionName - Name of the collection
     * @param sampleSize - Number of documents to sample (default: 100)
     * @returns Inferred schema structure
     */
    public async inferCollectionSchema(
        connectionString: string,
        clientId: string,
        collectionName: string,
        sampleSize: number = 100
    ): Promise<any> {
        try {
            const db = await this.getDatabase(connectionString, clientId);
            const collection = db.collection(collectionName);
            
            // Sample documents
            const documents = await collection.aggregate([
                { $sample: { size: sampleSize } }
            ]).toArray();

            if (documents.length === 0) {
                return { fields: [], message: 'Collection is empty' };
            }

            // Analyze fields across all sampled documents
            const fieldTypes: Map<string, Set<string>> = new Map();

            documents.forEach(doc => {
                this.analyzeDocument(doc, fieldTypes);
            });

            // Convert to schema format
            const schema = Array.from(fieldTypes.entries()).map(([field, types]) => ({
                field_name: field,
                data_type: types.size === 1 ? Array.from(types)[0] : `Mixed(${Array.from(types).join(', ')})`,
                is_nullable: true, // MongoDB fields are inherently nullable
            }));

            return { fields: schema, sample_size: documents.length };
        } catch (error) {
            console.error('[MongoDBNativeService] Error inferring schema:', error);
            throw error;
        }
    }

    /**
     * Recursively analyze document structure
     * @param doc - MongoDB document
     * @param fieldTypes - Map of field names to their observed types
     * @param prefix - Field name prefix for nested objects
     */
    private analyzeDocument(doc: any, fieldTypes: Map<string, Set<string>>, prefix: string = ''): void {
        for (const [key, value] of Object.entries(doc)) {
            const fieldName = prefix ? `${prefix}.${key}` : key;
            const fieldType = this.getMongoType(value);

            if (!fieldTypes.has(fieldName)) {
                fieldTypes.set(fieldName, new Set());
            }

            fieldTypes.get(fieldName)!.add(fieldType);

            // Recursively analyze nested objects (but not arrays)
            if (fieldType === 'object' && value !== null && !Array.isArray(value)) {
                this.analyzeDocument(value, fieldTypes, fieldName);
            }
        }
    }

    /**
     * Determine MongoDB type of a value
     * @param value - Any value from MongoDB document
     * @returns String representation of the type
     */
    private getMongoType(value: any): string {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        if (typeof value === 'object' && value.constructor.name === 'ObjectId') return 'objectid';
        if (typeof value === 'object') return 'object';
        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'integer' : 'double';
        }
        if (typeof value === 'boolean') return 'boolean';
        return 'unknown';
    }

    /**
     * Disconnect a specific MongoDB client
     * @param clientId - Unique identifier for the connection
     */
    public async disconnect(clientId: string): Promise<void> {
        try {
            const client = this.activeClients.get(clientId);
            if (client) {
                await client.close();
                this.activeClients.delete(clientId);
                console.log(`[MongoDBNativeService] Disconnected client: ${clientId}`);
            }
        } catch (error) {
            console.error(`[MongoDBNativeService] Error disconnecting client ${clientId}:`, error);
        }
    }

    /**
     * Disconnect all active MongoDB clients
     */
    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.activeClients.keys()).map(clientId =>
            this.disconnect(clientId)
        );
        await Promise.all(disconnectPromises);
        console.log('[MongoDBNativeService] All clients disconnected');
    }

    /**
     * Test connection with a connection string
     * @param connectionString - MongoDB connection string
     * @returns True if connection successful
     */
    public async testConnection(connectionString: string): Promise<boolean> {
        const testClientId = `test_${Date.now()}`;
        try {
            const client = await this.connect(connectionString, testClientId);
            const db = client.db();
            await db.admin().ping();
            await this.disconnect(testClientId);
            return true;
        } catch (error) {
            await this.disconnect(testClientId);
            throw error;
        }
    }
}
