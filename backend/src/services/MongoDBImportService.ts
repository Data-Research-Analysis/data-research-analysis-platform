import { DataSource, QueryRunner } from 'typeorm';
import { MongoDBNativeService } from './MongoDBNativeService.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRAMongoDBSyncHistory } from '../models/DRAMongoDBSyncHistory.js';

interface ImportOptions {
    batchSize?: number;
    incremental?: boolean;
    lastSyncField?: string; // Field to use for incremental sync (e.g., 'updatedAt')
}

interface MongoDBTypeMapping {
    mongodb: string;
    postgresql: string;
}

const TYPE_MAPPINGS: MongoDBTypeMapping[] = [
    { mongodb: 'string', postgresql: 'TEXT' },
    { mongodb: 'integer', postgresql: 'INTEGER' },
    { mongodb: 'double', postgresql: 'NUMERIC' },
    { mongodb: 'boolean', postgresql: 'BOOLEAN' },
    { mongodb: 'date', postgresql: 'TIMESTAMP' },
    { mongodb: 'objectid', postgresql: 'VARCHAR(24)' },
    { mongodb: 'array', postgresql: 'JSONB' },
    { mongodb: 'object', postgresql: 'JSONB' },
    { mongodb: 'null', postgresql: 'TEXT' },
];

/**
 * MongoDBImportService - Imports MongoDB collections into PostgreSQL
 * 
 * This service handles the complete import process:
 * 1. Connect to MongoDB using native driver
 * 2. Discover collections and infer schemas
 * 3. Create PostgreSQL tables in dra_mongodb schema
 * 4. Import documents with type mapping and flattening
 * 5. Track sync history and status
 */
export class MongoDBImportService {
    private static instance: MongoDBImportService;
    private pgDataSource: DataSource;

    private constructor(pgDataSource: DataSource) {
        this.pgDataSource = pgDataSource;
    }

    public static getInstance(pgDataSource: DataSource): MongoDBImportService {
        if (!MongoDBImportService.instance) {
            MongoDBImportService.instance = new MongoDBImportService(pgDataSource);
        }
        return MongoDBImportService.instance;
    }

    /**
     * Import entire MongoDB data source (all collections)
     */
    public async importDataSource(
        dataSource: DRADataSource,
        options: ImportOptions = {}
    ): Promise<void> {
        const mongoService = MongoDBNativeService.getInstance();
        
        // Validate connection string exists
        if (!dataSource.connection_string) {
            throw new Error('MongoDB data source must have a connection_string to import data');
        }

        const clientId = `import_${dataSource.id}`;
        
        try {
            // Update sync status
            await this.updateSyncStatus(dataSource.id, 'in_progress');

            // Get all collections
            const collections = await mongoService.getCollections(
                dataSource.connection_string,
                clientId
            );

            console.log(`[MongoDBImportService] Found ${collections.length} collections to import`);

            let totalRecordsSynced = 0;

            // Import each collection
            for (const collectionName of collections) {
                console.log(`[MongoDBImportService] Importing collection: ${collectionName}`);
                const recordsSynced = await this.importCollection(
                    dataSource,
                    collectionName,
                    options
                );
                totalRecordsSynced += recordsSynced;
            }

            // Update success status
            await this.updateSyncStatus(dataSource.id, 'completed', {
                total_records_synced: totalRecordsSynced,
                last_sync_at: new Date()
            });

            console.log(`[MongoDBImportService] Import completed: ${totalRecordsSynced} total records`);

        } catch (error: any) {
            console.error('[MongoDBImportService] Import failed:', error);
            await this.updateSyncStatus(dataSource.id, 'failed', {
                sync_error_message: error.message
            });
            throw error;
        } finally {
            // Disconnect MongoDB client
            await mongoService.disconnect(clientId);
        }
    }

    /**
     * Import single MongoDB collection into PostgreSQL table
     */
    public async importCollection(
        dataSource: DRADataSource,
        collectionName: string,
        options: ImportOptions = {}
    ): Promise<number> {
        const { batchSize = 1000, incremental = false, lastSyncField } = options;
        
        if (!dataSource.connection_string) {
            throw new Error('MongoDB data source must have a connection_string to import data');
        }

        const mongoService = MongoDBNativeService.getInstance();
        const clientId = `import_${dataSource.id}`;

        // Create sync history record
        const syncHistory = await this.createSyncHistory(
            dataSource.id,
            collectionName,
            incremental ? 'incremental' : 'full'
        );

        try {
            // Get collection schema
            const schemaResult = await mongoService.inferCollectionSchema(
                dataSource.connection_string,
                clientId,
                collectionName,
                100
            );

            // Check if collection is empty
            if (!schemaResult.fields || schemaResult.fields.length === 0) {
                console.log(`[MongoDBImportService] Collection ${collectionName} is empty, skipping`);
                await this.completeSyncHistory(syncHistory.id, 'completed', {
                    records_synced: 0,
                    records_failed: 0
                });
                return 0;
            }

            // Create or update PostgreSQL table
            const tableName = this.sanitizeTableName(collectionName);
            await this.createOrUpdateTable(tableName, schemaResult.fields);

            // Get database and collection
            const db = await mongoService.getDatabase(
                dataSource.connection_string,
                clientId
            );
            const collection = db.collection(collectionName);

            // Build query for incremental sync
            const query = incremental && lastSyncField && dataSource.last_sync_at
                ? { [lastSyncField]: { $gt: dataSource.last_sync_at } }
                : {};

            // Count total documents
            const totalDocuments = await collection.countDocuments(query);
            console.log(`[MongoDBImportService] Processing ${totalDocuments} documents from ${collectionName}`);

            let processedDocuments = 0;
            let failedDocuments = 0;

            // Process in batches
            const cursor = collection.find(query).batchSize(batchSize);

            const queryRunner = this.pgDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                let batch: any[] = [];

                for await (const doc of cursor) {
                    batch.push(doc);

                    if (batch.length >= batchSize) {
                        const { success, failed } = await this.insertBatch(
                            queryRunner,
                            tableName,
                            batch,
                            schemaResult.fields
                        );
                        processedDocuments += success;
                        failedDocuments += failed;
                        console.log(`[MongoDBImportService] Progress: ${processedDocuments}/${totalDocuments} documents`);
                        batch = [];
                    }
                }

                // Insert remaining documents
                if (batch.length > 0) {
                    const { success, failed } = await this.insertBatch(
                        queryRunner,
                        tableName,
                        batch,
                        schemaResult.fields
                    );
                    processedDocuments += success;
                    failedDocuments += failed;
                    console.log(`[MongoDBImportService] Final: ${processedDocuments}/${totalDocuments} documents`);
                }

            } finally {
                await queryRunner.release();
            }

            // Update sync history
            await this.completeSyncHistory(syncHistory.id, 'completed', {
                records_synced: processedDocuments,
                records_failed: failedDocuments
            });

            return processedDocuments;

        } catch (error: any) {
            console.error(`[MongoDBImportService] Error importing collection ${collectionName}:`, error);
            await this.completeSyncHistory(syncHistory.id, 'failed', {
                error_message: error.message
            });
            throw error;
        }
    }

    /**
     * Create PostgreSQL table from MongoDB collection schema
     */
    private async createOrUpdateTable(
        tableName: string,
        fields: any[]
    ): Promise<void> {
        const queryRunner = this.pgDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            // Check if table exists
            const tableExists = await queryRunner.hasTable(`dra_mongodb.${tableName}`);

            if (!tableExists) {
                // Build column definitions
                const columns = this.buildColumnDefinitions(fields);
                
                // Create table
                const createTableSQL = `
                    CREATE TABLE dra_mongodb.${tableName} (
                        _id VARCHAR(24) PRIMARY KEY,
                        ${columns.join(',\n                        ')},
                        _imported_at TIMESTAMP DEFAULT NOW(),
                        _source_document JSONB
                    )
                `;
                
                await queryRunner.query(createTableSQL);
                console.log(`[MongoDBImportService] Created table: dra_mongodb.${tableName}`);
            } else {
                console.log(`[MongoDBImportService] Table exists: dra_mongodb.${tableName}, will update existing records`);
                // TODO: Handle schema changes (add new columns, alter types)
                // For now, we'll just update existing records via UPSERT
            }

        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Build PostgreSQL column definitions from MongoDB schema
     */
    private buildColumnDefinitions(fields: any[]): string[] {
        const columns: string[] = [];

        for (const field of fields) {
            const fieldName = field.field_name;
            
            // Skip _id as it's already the primary key
            if (fieldName === '_id') continue;
            
            // Skip nested fields (those with dots) - they'll be in _source_document JSONB
            if (fieldName.includes('.')) continue;

            const sanitizedName = this.sanitizeColumnName(fieldName);
            const pgType = this.mapMongoDBTypeToPostgreSQL(field.data_type);

            columns.push(`${sanitizedName} ${pgType}`);
        }

        return columns;
    }

    /**
     * Map MongoDB type to PostgreSQL type
     */
    private mapMongoDBTypeToPostgreSQL(mongoType: string): string {
        // Handle Mixed types (e.g., "Mixed(string, integer)")
        if (mongoType.startsWith('Mixed')) {
            return 'TEXT'; // Default to TEXT for mixed types
        }

        const mapping = TYPE_MAPPINGS.find(m => m.mongodb.toLowerCase() === mongoType.toLowerCase());
        return mapping?.postgresql || 'TEXT';
    }

    /**
     * Insert batch of documents into PostgreSQL
     */
    private async insertBatch(
        queryRunner: QueryRunner,
        tableName: string,
        documents: any[],
        fields: any[]
    ): Promise<{ success: number; failed: number }> {
        let success = 0;
        let failed = 0;

        // Start transaction for batch
        await queryRunner.startTransaction();

        try {
            for (const doc of documents) {
                // Create savepoint for each document to allow individual rollbacks
                const savepointName = `sp_${doc._id.toString().replace(/[^a-zA-Z0-9]/g, '')}`;
                
                try {
                    await queryRunner.query(`SAVEPOINT ${savepointName}`);
                    
                    const flatDoc = this.flattenDocument(doc, fields);
                    const columns = Object.keys(flatDoc);
                    const values = Object.values(flatDoc);

                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                    
                    // Build UPSERT query
                    const updateClauses = columns
                        .filter(col => col !== '_id') // Don't update primary key
                        .map(col => `${col} = EXCLUDED.${col}`)
                        .join(', ');

                    const insertSQL = `
                        INSERT INTO dra_mongodb.${tableName} (${columns.join(', ')})
                        VALUES (${placeholders})
                        ON CONFLICT (_id) DO UPDATE SET
                            ${updateClauses}
                    `;

                    await queryRunner.query(insertSQL, values);
                    await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
                    success++;

                } catch (error: any) {
                    // Rollback to savepoint to keep transaction alive
                    try {
                        await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                    } catch (rollbackError) {
                        // Ignore rollback errors
                    }
                    console.error(`[MongoDBImportService] Failed to insert document ${doc._id}:`, error.message);
                    failed++;
                }
            }

            await queryRunner.commitTransaction();

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }

        return { success, failed };
    }

    /**
     * Flatten nested MongoDB document for PostgreSQL
     * Top-level fields go into columns, nested fields stay in _source_document JSONB
     */
    private flattenDocument(doc: any, fields: any[]): Record<string, any> {
        const flattened: Record<string, any> = {
            _id: doc._id.toString(),
            _source_document: JSON.stringify(doc),
            _imported_at: new Date()
        };

        // Get top-level field names (exclude nested fields with dots)
        const topLevelFields = fields
            .filter(f => !f.field_name.includes('.'))
            .map(f => f.field_name);

        for (const [key, value] of Object.entries(doc)) {
            if (key === '_id') continue;

            // Only process top-level fields
            if (!topLevelFields.includes(key)) continue;

            const sanitizedKey = this.sanitizeColumnName(key);
            const fieldInfo = fields.find(f => f.field_name === key);
            const fieldType = fieldInfo?.data_type || 'unknown';

            if (value === null || value === undefined) {
                flattened[sanitizedKey] = null;
            } else if (fieldType.includes('date') && value) {
                // Handle dates (check BEFORE generic object check)
                try {
                    flattened[sanitizedKey] = new Date(value as any);
                } catch {
                    flattened[sanitizedKey] = value;
                }
            } else if (fieldType.includes('objectid') && value) {
                // Handle ObjectIds (check BEFORE generic object check)
                flattened[sanitizedKey] = typeof value === 'object' ? value.toString() : value;
            } else if (fieldType.includes('object') || fieldType.includes('array') || Array.isArray(value) || typeof value === 'object') {
                // Store complex types as JSONB
                flattened[sanitizedKey] = JSON.stringify(value);
            } else {
                // Primitive types
                flattened[sanitizedKey] = value;
            }
        }

        return flattened;
    }

    /**
     * Sanitize table name for PostgreSQL
     */
    private sanitizeTableName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&')
            .substring(0, 63); // PostgreSQL identifier limit
    }

    /**
     * Sanitize column name for PostgreSQL
     */
    private sanitizeColumnName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&')
            .substring(0, 63); // PostgreSQL identifier limit
    }

    /**
     * Update data source sync status
     */
    private async updateSyncStatus(
        dataSourceId: number,
        status: string,
        additionalFields: Record<string, any> = {}
    ): Promise<void> {
        const repo = this.pgDataSource.getRepository(DRADataSource);
        await repo.update(dataSourceId, {
            sync_status: status,
            ...additionalFields
        });
    }

    /**
     * Create sync history record
     */
    private async createSyncHistory(
        dataSourceId: number,
        collectionName: string,
        syncType: string
    ): Promise<DRAMongoDBSyncHistory> {
        const repo = this.pgDataSource.getRepository(DRAMongoDBSyncHistory);
        const history = repo.create({
            data_source_id: dataSourceId,
            collection_name: collectionName,
            table_name: this.sanitizeTableName(collectionName),
            sync_type: syncType,
            status: 'in_progress',
            records_synced: 0,
            records_failed: 0
        });
        return await repo.save(history);
    }

    /**
     * Complete sync history record
     */
    private async completeSyncHistory(
        historyId: number,
        status: string,
        data: Record<string, any>
    ): Promise<void> {
        const repo = this.pgDataSource.getRepository(DRAMongoDBSyncHistory);
        await repo.update(historyId, {
            status,
            completed_at: new Date(),
            ...data
        });
    }
}
