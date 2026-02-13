import { DataSource, QueryRunner } from 'typeorm';
import { MongoDBNativeService } from './MongoDBNativeService.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRAMongoDBSyncHistory } from '../models/DRAMongoDBSyncHistory.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { SocketIODriver } from '../drivers/SocketIODriver.js';
import { ISyncProgress, ICollectionProgress } from '../interfaces/ISyncProgress.js';

// PostgreSQL reserved keywords that need to be quoted
const POSTGRESQL_RESERVED_KEYWORDS = new Set([
    'user', 'group', 'order', 'select', 'table', 'column', 'index', 'database',
    'schema', 'view', 'trigger', 'function', 'procedure', 'constraint', 'primary',
    'foreign', 'unique', 'check', 'default', 'where', 'from', 'join', 'on',
    'left', 'right', 'inner', 'outer', 'full', 'cross', 'union', 'intersect',
    'except', 'limit', 'offset', 'fetch', 'for', 'with', 'as', 'case', 'when',
    'then', 'else', 'end', 'and', 'or', 'not', 'in', 'exists', 'between', 'like',
    'is', 'null', 'true', 'false', 'all', 'any', 'some', 'distinct', 'having',
    'grant', 'revoke', 'commit', 'rollback', 'transaction', 'begin', 'start',
    'create', 'drop', 'alter', 'truncate', 'insert', 'update', 'delete', 'cast',
    'convert', 'count', 'sum', 'avg', 'min', 'max', 'date', 'time', 'timestamp',
    'interval', 'year', 'month', 'day', 'hour', 'minute', 'second', 'zone',
    'current', 'session', 'system', 'type', 'value', 'values', 'references'
]);

interface ImportOptions {
    batchSize?: number;
    incremental?: boolean;
    lastSyncField?: string; // Field to use for incremental sync (e.g., 'updatedAt')
    adaptiveBatchSize?: boolean; // Enable adaptive batch sizing based on collection size
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
    private socketIO: SocketIODriver;
    
    // Progress tracking
    private currentProgress: ISyncProgress | null = null;
    private collectionProgressMap: Map<string, ICollectionProgress> = new Map();
    private recordsProcessedPerSecond: number = 0;
    private lastProgressEmitTime: Date = new Date();

    private constructor(pgDataSource: DataSource) {
        this.pgDataSource = pgDataSource;
        this.socketIO = SocketIODriver.getInstance();
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
        options: ImportOptions = {},
        userId?: number
    ): Promise<void> {
        const mongoService = MongoDBNativeService.getInstance();
        
        // Validate connection string exists
        if (!dataSource.connection_string) {
            throw new Error('MongoDB data source must have a connection_string to import data');
        }

        const clientId = `import_${dataSource.id}`;
        const startTime = new Date();
        
        try {
            // Initialize progress tracking
            this.currentProgress = {
                dataSourceId: dataSource.id,
                userId: userId || 0,
                status: 'initializing',
                totalCollections: 0,
                processedCollections: 0,
                currentCollection: null,
                totalRecords: 0,
                processedRecords: 0,
                failedRecords: 0,
                percentage: 0,
                estimatedTimeRemaining: null,
                startTime,
                lastUpdateTime: new Date(),
                collections: []
            };
            
            // Emit initial progress
            await this.emitProgress();
            
            // Update sync status
            await this.updateSyncStatus(dataSource.id, 'in_progress');

            // Get all collections
            const collections = await mongoService.getCollections(
                dataSource.connection_string,
                clientId
            );

            console.log(`[MongoDBImportService] Found ${collections.length} collections to import`);

            // Update progress with collection count
            if (this.currentProgress) {
                this.currentProgress.status = 'in_progress';
                this.currentProgress.totalCollections = collections.length;
                this.currentProgress.collections = collections.map(name => ({
                    name,
                    status: 'pending' as const,
                    recordCount: 0,
                    processedCount: 0
                }));
                await this.emitProgress();
            }

            let totalRecordsSynced = 0;

            // Import each collection
            for (const collectionName of collections) {
                console.log(`[MongoDBImportService] Importing collection: ${collectionName}`);
                
                // Update current collection in progress
                if (this.currentProgress) {
                    this.currentProgress.currentCollection = collectionName;
                    await this.emitProgress();
                }
                
                const recordsSynced = await this.importCollection(
                    dataSource,
                    collectionName,
                    options
                );
                totalRecordsSynced += recordsSynced;
                
                // Update processed collections count
                if (this.currentProgress) {
                    this.currentProgress.processedCollections++;
                    await this.emitProgress();
                }
            }

            // Update success status
            await this.updateSyncStatus(dataSource.id, 'completed', {
                total_records_synced: totalRecordsSynced,
                last_sync_at: new Date()
            });

            // Emit completion progress
            if (this.currentProgress) {
                this.currentProgress.status = 'completed';
                this.currentProgress.percentage = 100;
                this.currentProgress.estimatedTimeRemaining = 0;
                this.currentProgress.currentCollection = null;
                await this.emitProgress();
            }

            console.log(`[MongoDBImportService] Import completed: ${totalRecordsSynced} total records`);

        } catch (error: any) {
            console.error('[MongoDBImportService] Import failed:', error);
            await this.updateSyncStatus(dataSource.id, 'failed', {
                sync_error_message: error.message
            });
            
            // Emit failure progress
            if (this.currentProgress) {
                this.currentProgress.status = 'failed';
                this.currentProgress.errorMessage = error.message;
                await this.emitProgress();
            }
            
            throw error;
        } finally {
            // Disconnect MongoDB client
            await mongoService.disconnect(clientId);
            
            // Clear progress tracking
            this.currentProgress = null;
            this.collectionProgressMap.clear();
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
        const { 
            batchSize = 1000, 
            incremental = false, 
            lastSyncField, 
            adaptiveBatchSize = true 
        } = options;
        
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

        // Initialize collection progress
        const collectionProgress: ICollectionProgress = {
            collectionName,
            totalRecords: 0,
            processedRecords: 0,
            failedRecords: 0,
            status: 'in_progress'
        };
        this.collectionProgressMap.set(collectionName, collectionProgress);

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
                
                collectionProgress.status = 'completed';
                if (this.currentProgress) {
                    const collIdx = this.currentProgress.collections?.findIndex(c => c.name === collectionName);
                    if (collIdx !== undefined && collIdx >= 0 && this.currentProgress.collections) {
                        this.currentProgress.collections[collIdx].status = 'completed';
                    }
                    await this.emitProgress();
                }
                
                await this.completeSyncHistory(syncHistory.id, 'completed', {
                    records_synced: 0,
                    records_failed: 0
                });
                return 0;
            }

            // Create or update PostgreSQL table with unique name including data source ID
            const tableName = this.generateUniqueTableName(collectionName, dataSource.id);
            
            // Fetch users_platform_id from data source (needed for metadata)
            const dsResult = await this.pgDataSource.query(
                'SELECT users_platform_id FROM dra_data_sources WHERE id = $1',
                [dataSource.id]
            );
            const usersPlatformId = dsResult[0]?.users_platform_id;
            
            await this.createOrUpdateTable(tableName, schemaResult.fields, dataSource.id, usersPlatformId, collectionName);

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

            // Calculate optimal batch size if adaptive is enabled
            const effectiveBatchSize = adaptiveBatchSize 
                ? this.calculateOptimalBatchSize(totalDocuments, batchSize)
                : batchSize;
            
            console.log(`[MongoDBImportService] Using batch size: ${effectiveBatchSize} for ${totalDocuments} documents`);

            // Update collection progress with total count
            collectionProgress.totalRecords = totalDocuments;
            if (this.currentProgress) {
                this.currentProgress.totalRecords += totalDocuments;
                const collIdx = this.currentProgress.collections?.findIndex(c => c.name === collectionName);
                if (collIdx !== undefined && collIdx >= 0 && this.currentProgress.collections) {
                    this.currentProgress.collections[collIdx].recordCount = totalDocuments;
                    this.currentProgress.collections[collIdx].status = 'in_progress';
                }
                await this.emitProgress();
            }

            let processedDocuments = 0;
            let failedDocuments = 0;

            // Process in batches with adaptive batch size
            const cursor = collection.find(query).batchSize(effectiveBatchSize);

            const queryRunner = this.pgDataSource.createQueryRunner();
            await queryRunner.connect();

            try {
                let batch: any[] = [];

                for await (const doc of cursor) {
                    batch.push(doc);

                    if (batch.length >= effectiveBatchSize) {
                        const { success, failed } = await this.insertBatch(
                            queryRunner,
                            tableName,
                            batch,
                            schemaResult.fields
                        );
                        processedDocuments += success;
                        failedDocuments += failed;
                        
                        // Update progress tracking
                        collectionProgress.processedRecords = processedDocuments;
                        collectionProgress.failedRecords = failedDocuments;
                        
                        if (this.currentProgress) {
                            this.currentProgress.processedRecords += success;
                            this.currentProgress.failedRecords += failed;
                            
                            const collIdx = this.currentProgress.collections?.findIndex(c => c.name === collectionName);
                            if (collIdx !== undefined && collIdx >= 0 && this.currentProgress.collections) {
                                this.currentProgress.collections[collIdx].processedCount = processedDocuments;
                            }
                            
                            // Emit progress every 5 batches or 5000 records (whichever comes first)
                            const shouldEmit = processedDocuments % 5000 === 0 || 
                                             (processedDocuments / effectiveBatchSize) % 5 === 0;
                            if (shouldEmit) {
                                await this.emitProgress();
                            }
                        }
                        
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
                    
                    // Update final progress
                    collectionProgress.processedRecords = processedDocuments;
                    collectionProgress.failedRecords = failedDocuments;
                    
                    if (this.currentProgress) {
                        this.currentProgress.processedRecords += success;
                        this.currentProgress.failedRecords += failed;
                        
                        const collIdx = this.currentProgress.collections?.findIndex(c => c.name === collectionName);
                        if (collIdx !== undefined && collIdx >= 0 && this.currentProgress.collections) {
                            this.currentProgress.collections[collIdx].processedCount = processedDocuments;
                        }
                        await this.emitProgress();
                    }
                    
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

            // Mark collection as completed
            collectionProgress.status = 'completed';
            if (this.currentProgress) {
                const collIdx = this.currentProgress.collections?.findIndex(c => c.name === collectionName);
                if (collIdx !== undefined && collIdx >= 0 && this.currentProgress.collections) {
                    this.currentProgress.collections[collIdx].status = 'completed';
                }
                await this.emitProgress();
            }

            return processedDocuments;

        } catch (error: any) {
            console.error(`[MongoDBImportService] Error importing collection ${collectionName}:`, error);
            await this.completeSyncHistory(syncHistory.id, 'failed', {
                error_message: error.message
            });
            
            // Mark collection as failed
            collectionProgress.status = 'failed';
            if (this.currentProgress) {
                const collIdx = this.currentProgress.collections?.findIndex(c => c.name === collectionName);
                if (collIdx !== undefined && collIdx >= 0 && this.currentProgress.collections) {
                    this.currentProgress.collections[collIdx].status = 'failed';
                }
                await this.emitProgress();
            }
            
            throw error;
        }
    }

    /**
     * Create PostgreSQL table from MongoDB collection schema
     * Also creates metadata entry for AI data modeler
     */
    private async createOrUpdateTable(
        tableName: string,
        fields: any[],
        dataSourceId: number,
        usersPlatformId: number,
        collectionName: string
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

                // Create metadata entry for AI data modeler
                await this.createTableMetadata(
                    dataSourceId,
                    usersPlatformId,
                    tableName,
                    collectionName
                );
            } else {
                console.log(`[MongoDBImportService] Table exists: dra_mongodb.${tableName}, will update existing records`);
                
                // Ensure metadata exists for existing tables
                await this.ensureTableMetadata(
                    dataSourceId,
                    usersPlatformId,
                    tableName,
                    collectionName
                );
            }

        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Create table metadata entry for AI data modeler
     */
    private async createTableMetadata(
        dataSourceId: number,
        usersPlatformId: number,
        physicalTableName: string,
        collectionName: string
    ): Promise<void> {
        try {
            const manager = this.pgDataSource.manager;
            
            // Check if metadata already exists using a query (more reliable than findOne)
            const existing = await manager.query(`
                SELECT id FROM dra_table_metadata 
                WHERE schema_name = $1 AND physical_table_name = $2
            `, ['dra_mongodb', physicalTableName]);

            if (existing && existing.length > 0) {
                console.log(`[MongoDBImportService] Metadata already exists for table: ${physicalTableName}`);
                return;
            }

            // Create new metadata entry
            await manager.query(`
                INSERT INTO dra_table_metadata (
                    data_source_id,
                    users_platform_id,
                    schema_name,
                    physical_table_name,
                    logical_table_name,
                    original_sheet_name,
                    table_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                dataSourceId,
                usersPlatformId,
                'dra_mongodb',
                physicalTableName,
                collectionName, // Use original collection name as display name
                collectionName,
                'mongodb'
            ]);

            console.log(`[MongoDBImportService] Created metadata for table: ${physicalTableName} (${collectionName})`);
        } catch (error) {
            console.error(`[MongoDBImportService] Failed to create metadata for ${physicalTableName}:`, error);
            // Don't throw - metadata creation failure shouldn't block data import
        }
    }

    /**
     * Ensure table metadata exists for existing tables
     */
    private async ensureTableMetadata(
        dataSourceId: number,
        usersPlatformId: number,
        physicalTableName: string,
        collectionName: string
    ): Promise<void> {
        try {
            const manager = this.pgDataSource.manager;
            
            // Check if metadata exists using a query
            const existing = await manager.query(`
                SELECT id FROM dra_table_metadata 
                WHERE schema_name = $1 AND physical_table_name = $2
            `, ['dra_mongodb', physicalTableName]);

            if (!existing || existing.length === 0) {
                console.log(`[MongoDBImportService] Backfilling metadata for existing table: ${physicalTableName}`);
                await this.createTableMetadata(
                    dataSourceId,
                    usersPlatformId,
                    physicalTableName,
                    collectionName
                );
            }
        } catch (error) {
            console.error(`[MongoDBImportService] Failed to ensure metadata for ${physicalTableName}:`, error);
            // Don't throw - metadata issues shouldn't block data import
        }
    }

    /**
     * Emit progress update via Socket.IO
     * Calculates percentage, ETA, and processing rate
     */
    private async emitProgress(): Promise<void> {
        if (!this.currentProgress) return;

        const now = new Date();
        const elapsedSeconds = (now.getTime() - this.currentProgress.startTime.getTime()) / 1000;
        
        // Calculate progress percentage
        if (this.currentProgress.totalRecords > 0) {
            this.currentProgress.percentage = Math.min(
                100,
                Math.round((this.currentProgress.processedRecords / this.currentProgress.totalRecords) * 100)
            );
        } else if (this.currentProgress.totalCollections > 0) {
            // Use collection progress if no records counted yet
            this.currentProgress.percentage = Math.min(
                100,
                Math.round((this.currentProgress.processedCollections / this.currentProgress.totalCollections) * 100)
            );
        }

        // Calculate processing rate and ETA
        if (elapsedSeconds > 0 && this.currentProgress.processedRecords > 0) {
            this.recordsProcessedPerSecond = this.currentProgress.processedRecords / elapsedSeconds;
            
            const remainingRecords = this.currentProgress.totalRecords - this.currentProgress.processedRecords;
            if (remainingRecords > 0 && this.recordsProcessedPerSecond > 0) {
                const estimatedSecondsRemaining = remainingRecords / this.recordsProcessedPerSecond;
                this.currentProgress.estimatedTimeRemaining = Math.round(estimatedSecondsRemaining * 1000);
            } else {
                this.currentProgress.estimatedTimeRemaining = null;
            }
        }

        // Update last update time
        this.currentProgress.lastUpdateTime = now;

        // Emit to specific user if userId is set, otherwise broadcast
        try {
            if (this.currentProgress.userId > 0) {
                await this.socketIO.emitToUser(
                    this.currentProgress.userId,
                    'mongodb-sync-progress',
                    this.currentProgress
                );
            } else {
                await this.socketIO.emitEvent(
                    'mongodb-sync-progress',
                    this.currentProgress
                );
            }
            
            console.log(`[MongoDBImportService] Progress emitted: ${this.currentProgress.percentage}% ` +
                       `(${this.currentProgress.processedRecords}/${this.currentProgress.totalRecords} records, ` +
                       `${this.currentProgress.processedCollections}/${this.currentProgress.totalCollections} collections)`);
        } catch (error) {
            console.error('[MongoDBImportService] Failed to emit progress:', error);
        }
    }

    /**
     * Build PostgreSQL column definitions from MongoDB schema
     */
    private buildColumnDefinitions(fields: any[]): string[] {
        const columns: string[] = [];
        const seenColumnNames = new Set<string>();

        for (const field of fields) {
            const fieldName = field.field_name;
            
            // Skip _id as it's already the primary key
            if (fieldName === '_id') continue;
            
            // Skip nested fields (those with dots) - they'll be in _source_document JSONB
            if (fieldName.includes('.')) continue;

            const sanitizedName = this.sanitizeColumnName(fieldName);
            
            // Skip duplicate column names (can occur when long field names are truncated)
            if (seenColumnNames.has(sanitizedName)) {
                console.log(`[MongoDBImportService] Skipping duplicate column: ${sanitizedName} (original: ${fieldName})`);
                continue;
            }
            
            seenColumnNames.add(sanitizedName);
            const pgType = this.mapMongoDBTypeToPostgreSQL(field.data_type);
            
            // Quote column name to handle reserved keywords and special characters
            const quotedName = this.quoteIdentifier(sanitizedName);
            columns.push(`${quotedName} ${pgType}`);
        }

        return columns;
    }

    /**
     * Calculate optimal batch size based on collection size
     * Larger collections use smaller batches to avoid memory issues
     * Smaller collections use larger batches for efficiency
     */
    private calculateOptimalBatchSize(totalRecords: number, defaultBatchSize: number): number {
        // For very small collections (< 1K), use larger batches
        if (totalRecords < 1000) {
            return Math.min(500, totalRecords);
        }
        // For small collections (1K-10K), use default or slightly larger
        else if (totalRecords < 10000) {
            return Math.min(2000, defaultBatchSize * 2);
        }
        // For medium collections (10K-100K), use default
        else if (totalRecords < 100000) {
            return defaultBatchSize;
        }
        // For large collections (100K-1M), use smaller batches
        else if (totalRecords < 1000000) {
            return Math.max(500, Math.floor(defaultBatchSize / 2));
        }
        // For very large collections (>1M), use very small batches
        else {
            return Math.max(250, Math.floor(defaultBatchSize / 4));
        }
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
     * Quote PostgreSQL identifier to handle reserved keywords and special characters
     * Always quotes identifiers for safety
     */
    private quoteIdentifier(identifier: string): string {
        // Always quote for safety - handles reserved keywords and special characters
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    /**
     * Insert batch of documents into PostgreSQL
     * Uses optimized bulk INSERT with multi-row VALUES clause
     */
    private async insertBatch(
        queryRunner: QueryRunner,
        tableName: string,
        documents: any[],
        fields: any[]
    ): Promise<{ success: number; failed: number }> {
        if (documents.length === 0) {
            return { success: 0, failed: 0 };
        }

        let success = 0;
        let failed = 0;

        // Start transaction for batch
        await queryRunner.startTransaction();

        try {
            // Flatten all documents first
            const flatDocuments = documents.map(doc => {
                try {
                    return { doc, flatDoc: this.flattenDocument(doc, fields), error: null };
                } catch (error: any) {
                    return { doc, flatDoc: null, error };
                }
            });

            // Filter out documents that failed to flatten
            const validDocuments = flatDocuments.filter(d => d.flatDoc !== null);
            const failedDocuments = flatDocuments.filter(d => d.flatDoc === null);
            
            failed += failedDocuments.length;
            failedDocuments.forEach(({ doc, error }) => {
                console.error(`[MongoDBImportService] Failed to flatten document ${doc._id}:`, error?.message);
            });

            if (validDocuments.length === 0) {
                await queryRunner.commitTransaction();
                return { success: 0, failed };
            }

            // Get column names from first document (all should have same structure)
            const firstFlatDoc = validDocuments[0].flatDoc!;
            const columns = Object.keys(firstFlatDoc);

            // Build multi-row VALUES clause
            const allValues: any[] = [];
            const valuePlaceholders: string[] = [];
            let parameterIndex = 1;

            for (const { flatDoc } of validDocuments) {
                const rowValues = columns.map(col => flatDoc![col]);
                allValues.push(...rowValues);
                
                const rowPlaceholders = columns.map(() => `$${parameterIndex++}`);
                valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
            }

            // Build UPSERT query with multi-row INSERT
            const quotedColumns = columns.map(col => this.quoteIdentifier(col));
            const updateClauses = columns
                .filter(col => col !== '_id') // Don't update primary key
                .map(col => `${this.quoteIdentifier(col)} = EXCLUDED.${this.quoteIdentifier(col)}`)
                .join(', ');

            const bulkInsertSQL = `
                INSERT INTO dra_mongodb.${tableName} (${quotedColumns.join(', ')})
                VALUES ${valuePlaceholders.join(',\n')}
                ON CONFLICT (_id) DO UPDATE SET
                    ${updateClauses}
            `;

            await queryRunner.query(bulkInsertSQL, allValues);
            success += validDocuments.length;

            await queryRunner.commitTransaction();

        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            console.error(`[MongoDBImportService] Bulk insert failed, falling back to individual inserts:`, error.message);
            
            // Fallback: try inserting documents one by one
            return await this.insertBatchIndividual(queryRunner, tableName, documents, fields);
        }

        return { success, failed };
    }

    /**
     * Fallback method: Insert documents individually with savepoints
     * Used when bulk insert fails
     */
    private async insertBatchIndividual(
        queryRunner: QueryRunner,
        tableName: string,
        documents: any[],
        fields: any[]
    ): Promise<{ success: number; failed: number }> {
        let success = 0;
        let failed = 0;

        await queryRunner.startTransaction();

        try {
            for (const doc of documents) {
                const savepointName = `sp_${doc._id.toString().replace(/[^a-zA-Z0-9]/g, '')}`;
                
                try {
                    await queryRunner.query(`SAVEPOINT ${savepointName}`);
                    
                    const flatDoc = this.flattenDocument(doc, fields);
                    const columns = Object.keys(flatDoc);
                    const quotedColumns = columns.map(col => this.quoteIdentifier(col));
                    const values = Object.values(flatDoc);

                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                    
                    const updateClauses = columns
                        .filter(col => col !== '_id')
                        .map(col => `${this.quoteIdentifier(col)} = EXCLUDED.${this.quoteIdentifier(col)}`)
                        .join(', ');

                    const insertSQL = `
                        INSERT INTO dra_mongodb.${tableName} (${quotedColumns.join(', ')})
                        VALUES (${placeholders})
                        ON CONFLICT (_id) DO UPDATE SET
                            ${updateClauses}
                    `;

                    await queryRunner.query(insertSQL, values);
                    await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
                    success++;

                } catch (error: any) {
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

        // Track sanitized names to handle duplicates
        const seenSanitizedNames = new Set<string>();
        const fieldNameToSanitized = new Map<string, string>();
        
        // Build map of original field names to their sanitized versions (only first occurrence)
        for (const field of fields) {
            if (field.field_name === '_id' || field.field_name.includes('.')) continue;
            
            const sanitized = this.sanitizeColumnName(field.field_name);
            if (!seenSanitizedNames.has(sanitized)) {
                seenSanitizedNames.add(sanitized);
                fieldNameToSanitized.set(field.field_name, sanitized);
            }
        }

        for (const [key, value] of Object.entries(doc)) {
            if (key === '_id') continue;

            // Only process top-level fields that have a valid sanitized column name
            if (!topLevelFields.includes(key)) continue;
            
            const sanitizedKey = fieldNameToSanitized.get(key);
            if (!sanitizedKey) {
                // This field was skipped due to duplication
                continue;
            }
            
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
     * Generate unique table name with data source ID
     * Pattern: {collection_name}_data_source_{dataSourceId}
     * This ensures uniqueness across multiple MongoDB data sources
     */
    private generateUniqueTableName(collectionName: string, dataSourceId: number): string {
        const sanitized = this.sanitizeTableName(collectionName);
        return `${sanitized}_data_source_${dataSourceId}`;
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
            table_name: this.generateUniqueTableName(collectionName, dataSourceId),
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
