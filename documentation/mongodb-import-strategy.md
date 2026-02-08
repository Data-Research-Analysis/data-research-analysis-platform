# MongoDB Data Import Strategy

## Overview

This document outlines the complete implementation plan for importing MongoDB data into PostgreSQL to enable full platform features including joins, AI data modeling, cross-source queries, and data quality checks.

### Current State

**Architecture**: External Query Approach
- MongoDB data remains in external MongoDB Atlas/standalone instances
- Queries executed directly against MongoDB using native driver
- Connection via connection string or individual fields
- Synthetic schema `dra_mongodb` (logical, not physical PostgreSQL schema)

**Limitations**:
- ❌ No support for joins with other data sources
- ❌ No AI data modeling suggestions
- ❌ No cross-source queries
- ❌ No data quality checks
- ❌ Limited query optimization
- ❌ No offline access if MongoDB is unavailable

### Proposed State

**Architecture**: Data Import Approach (Similar to Google Analytics, Excel, PDF)
- Import MongoDB collections into PostgreSQL
- Physical schema `dra_mongodb` in PostgreSQL
- Support for all platform features
- Scheduled sync for data freshness

**Benefits**:
- ✅ Full platform feature support (joins, AI, data quality)
- ✅ Consistent architecture with other API-based sources
- ✅ Better query performance (local PostgreSQL vs external MongoDB)
- ✅ Offline access to data
- ✅ Unified data governance
- ✅ Cross-source analytics

**Trade-offs**:
- ❌ Storage duplication (MongoDB + PostgreSQL)
- ❌ Sync latency (not real-time)
- ❌ Complex nested document handling
- ❌ Additional infrastructure (sync workers, schedulers)

---

## Implementation Phases

### Phase 1: Schema & Database Foundation

**Objective**: Create physical PostgreSQL schema and sync tracking infrastructure

#### 1.1 PostgreSQL Schema Creation

Create physical schema in PostgreSQL:
```sql
CREATE SCHEMA IF NOT EXISTS dra_mongodb;
```

#### 1.2 Data Source Table Updates

Add sync tracking columns to `dra_data_sources`:

```typescript
// Migration: AddMongoDBSyncTracking.ts
export class AddMongoDBSyncTracking implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add sync status tracking
        await queryRunner.addColumn('dra_data_sources', new TableColumn({
            name: 'sync_status',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'Values: pending, in_progress, completed, failed'
        }));

        await queryRunner.addColumn('dra_data_sources', new TableColumn({
            name: 'last_sync_at',
            type: 'timestamp',
            isNullable: true
        }));

        await queryRunner.addColumn('dra_data_sources', new TableColumn({
            name: 'sync_error_message',
            type: 'text',
            isNullable: true
        }));

        await queryRunner.addColumn('dra_data_sources', new TableColumn({
            name: 'total_records_synced',
            type: 'integer',
            default: 0
        }));

        await queryRunner.addColumn('dra_data_sources', new TableColumn({
            name: 'sync_config',
            type: 'jsonb',
            isNullable: true,
            comment: 'Sync configuration: schedule, batch size, incremental settings'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_data_sources', 'sync_status');
        await queryRunner.dropColumn('dra_data_sources', 'last_sync_at');
        await queryRunner.dropColumn('dra_data_sources', 'sync_error_message');
        await queryRunner.dropColumn('dra_data_sources', 'total_records_synced');
        await queryRunner.dropColumn('dra_data_sources', 'sync_config');
    }
}
```

#### 1.3 Sync History Table

Create table to track sync operations:

```typescript
// models/DRAMongoDBSyncHistory.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DRADataSource } from './DRADataSource.js';

@Entity('dra_mongodb_sync_history')
export class DRAMongoDBSyncHistory {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    data_source_id!: number;

    @ManyToOne(() => DRADataSource)
    @JoinColumn({ name: 'data_source_id' })
    dataSource!: DRADataSource;

    @Column({ type: 'varchar', length: 100 })
    collection_name!: string;

    @Column({ type: 'varchar', length: 100 })
    table_name!: string; // PostgreSQL table name

    @Column({ type: 'varchar', length: 50 })
    sync_type!: string; // 'full' | 'incremental'

    @Column({ type: 'varchar', length: 50 })
    status!: string; // 'in_progress' | 'completed' | 'failed'

    @Column({ type: 'integer', default: 0 })
    records_synced!: number;

    @Column({ type: 'integer', default: 0 })
    records_failed!: number;

    @CreateDateColumn()
    started_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    completed_at!: Date | null;

    @Column({ type: 'text', nullable: true })
    error_message!: string | null;

    @Column({ type: 'jsonb', nullable: true })
    sync_metadata!: Record<string, any> | null; // Last sync timestamps, filters, etc.
}
```

**Deliverables**:
- [ ] Migration: Create `dra_mongodb` schema
- [ ] Migration: Add sync tracking columns to `dra_data_sources`
- [ ] Migration: Create `dra_mongodb_sync_history` table
- [ ] Entity: `DRAMongoDBSyncHistory.ts`
- [ ] Update `DRADataSource.ts` with sync fields

---

### Phase 2: Data Import Service

**Objective**: Create service to import MongoDB collections into PostgreSQL

#### 2.1 MongoDB to PostgreSQL Type Mapping

Define type conversion strategy:

```typescript
// services/MongoDBImportService.ts
interface MongoDBTypeMapping {
    mongodb: string;
    postgresql: string;
    converter?: (value: any) => any;
}

const TYPE_MAPPINGS: MongoDBTypeMapping[] = [
    { mongodb: 'string', postgresql: 'TEXT' },
    { mongodb: 'number', postgresql: 'NUMERIC' },
    { mongodb: 'boolean', postgresql: 'BOOLEAN' },
    { mongodb: 'date', postgresql: 'TIMESTAMP' },
    { mongodb: 'objectId', postgresql: 'VARCHAR(24)' },
    { mongodb: 'array', postgresql: 'JSONB' },
    { mongodb: 'object', postgresql: 'JSONB' },
    { mongodb: 'null', postgresql: 'TEXT' },
];
```

#### 2.2 MongoDBImportService Implementation

Create comprehensive import service:

```typescript
// services/MongoDBImportService.ts
import { DataSource, QueryRunner } from 'typeorm';
import { MongoDBNativeService } from './MongoDBNativeService.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRAMongoDBSyncHistory } from '../models/DRAMongoDBSyncHistory.js';
import { IConnectionDetails } from '../types/IDBConnectionDetails.js';

interface ImportOptions {
    batchSize?: number;
    incremental?: boolean;
    lastSyncField?: string; // Field to use for incremental sync (e.g., 'updatedAt')
}

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
        
        try {
            // Update sync status
            await this.updateSyncStatus(dataSource.id, 'in_progress');

            // Connect to MongoDB
            const clientId = await mongoService.connect(
                dataSource.connection_details as IConnectionDetails,
                dataSource.connection_string || undefined
            );

            // Get all collections
            const db = mongoService.getDatabase(clientId);
            const collections = await mongoService.getCollections(clientId);

            let totalRecordsSynced = 0;

            // Import each collection
            for (const collectionName of collections) {
                const recordsSynced = await this.importCollection(
                    dataSource,
                    clientId,
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

        } catch (error: any) {
            await this.updateSyncStatus(dataSource.id, 'failed', {
                sync_error_message: error.message
            });
            throw error;
        }
    }

    /**
     * Import single MongoDB collection into PostgreSQL table
     */
    public async importCollection(
        dataSource: DRADataSource,
        clientId: string,
        collectionName: string,
        options: ImportOptions = {}
    ): Promise<number> {
        const { batchSize = 1000, incremental = false, lastSyncField } = options;
        
        const mongoService = MongoDBNativeService.getInstance();
        const db = mongoService.getDatabase(clientId);
        const collection = db.collection(collectionName);

        // Create sync history record
        const syncHistory = await this.createSyncHistory(
            dataSource.id,
            collectionName,
            incremental ? 'incremental' : 'full'
        );

        try {
            // Get collection schema
            const schema = await mongoService.inferCollectionSchema(clientId, collectionName, 100);

            // Create or update PostgreSQL table
            const tableName = this.sanitizeTableName(collectionName);
            await this.createOrUpdateTable(tableName, schema);

            // Build query for incremental sync
            const query = incremental && lastSyncField && dataSource.last_sync_at
                ? { [lastSyncField]: { $gt: dataSource.last_sync_at } }
                : {};

            // Count total documents
            const totalDocuments = await collection.countDocuments(query);
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
                            schema
                        );
                        processedDocuments += success;
                        failedDocuments += failed;
                        batch = [];
                    }
                }

                // Insert remaining documents
                if (batch.length > 0) {
                    const { success, failed } = await this.insertBatch(
                        queryRunner,
                        tableName,
                        batch,
                        schema
                    );
                    processedDocuments += success;
                    failedDocuments += failed;
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
        schema: any
    ): Promise<void> {
        const queryRunner = this.pgDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            // Check if table exists
            const tableExists = await queryRunner.hasTable(`dra_mongodb.${tableName}`);

            if (!tableExists) {
                // Create table
                const columns = this.buildColumnDefinitions(schema);
                const createTableSQL = `
                    CREATE TABLE dra_mongodb.${tableName} (
                        _id VARCHAR(24) PRIMARY KEY,
                        ${columns.join(',\n                        ')},
                        _imported_at TIMESTAMP DEFAULT NOW(),
                        _source_document JSONB
                    )
                `;
                await queryRunner.query(createTableSQL);
            } else {
                // TODO: Handle schema changes (add new columns, alter types)
                // For now, we'll skip updates
            }

        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Build PostgreSQL column definitions from MongoDB schema
     */
    private buildColumnDefinitions(schema: any): string[] {
        const columns: string[] = [];

        for (const [fieldName, fieldInfo] of Object.entries(schema.fields || {})) {
            if (fieldName === '_id') continue; // Already in PK

            const sanitizedName = this.sanitizeColumnName(fieldName);
            const pgType = this.mapMongoDBTypeToPostgreSQL((fieldInfo as any).type);

            columns.push(`${sanitizedName} ${pgType}`);
        }

        return columns;
    }

    /**
     * Map MongoDB type to PostgreSQL type
     */
    private mapMongoDBTypeToPostgreSQL(mongoType: string): string {
        const mapping = TYPE_MAPPINGS.find(m => m.mongodb === mongoType);
        return mapping?.postgresql || 'TEXT';
    }

    /**
     * Insert batch of documents into PostgreSQL
     */
    private async insertBatch(
        queryRunner: QueryRunner,
        tableName: string,
        documents: any[],
        schema: any
    ): Promise<{ success: number; failed: number }> {
        let success = 0;
        let failed = 0;

        await queryRunner.startTransaction();

        try {
            for (const doc of documents) {
                try {
                    const flatDoc = this.flattenDocument(doc, schema);
                    const columns = Object.keys(flatDoc);
                    const values = Object.values(flatDoc);

                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                    const insertSQL = `
                        INSERT INTO dra_mongodb.${tableName} (${columns.join(', ')})
                        VALUES (${placeholders})
                        ON CONFLICT (_id) DO UPDATE SET
                            ${columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}
                    `;

                    await queryRunner.query(insertSQL, values);
                    success++;

                } catch (error) {
                    console.error(`Failed to insert document ${doc._id}:`, error);
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
     */
    private flattenDocument(doc: any, schema: any): Record<string, any> {
        const flattened: Record<string, any> = {
            _id: doc._id.toString(),
            _source_document: JSON.stringify(doc),
            _imported_at: new Date()
        };

        for (const [key, value] of Object.entries(doc)) {
            if (key === '_id') continue;

            const fieldType = schema.fields?.[key]?.type;

            if (fieldType === 'object' || fieldType === 'array') {
                // Store complex types as JSONB
                flattened[this.sanitizeColumnName(key)] = JSON.stringify(value);
            } else if (fieldType === 'date' && value) {
                flattened[this.sanitizeColumnName(key)] = new Date(value as any);
            } else if (fieldType === 'objectId' && value) {
                flattened[this.sanitizeColumnName(key)] = value.toString();
            } else {
                flattened[this.sanitizeColumnName(key)] = value;
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
            .replace(/^[0-9]/, '_$&');
    }

    /**
     * Sanitize column name for PostgreSQL
     */
    private sanitizeColumnName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&');
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
```

**Deliverables**:
- [ ] `MongoDBImportService.ts` with full implementation
- [ ] Type mapping utilities
- [ ] Batch insert logic (1000 records per batch)
- [ ] Nested document flattening strategy
- [ ] Error handling and retry logic
- [ ] Unit tests for import service

---

### Phase 3: Integration Points

**Objective**: Integrate import service into existing workflows

#### 3.1 Update DataSourceProcessor

Modify `addDataSource()` to trigger import after connection success:

```typescript
// processors/DataSourceProcessor.ts
public async addDataSource(
    userId: number,
    projectId: number,
    name: string,
    description: string,
    type: string,
    connectionDetails: IConnectionDetails,
    connectionString?: string
): Promise<DRADataSource> {
    // ... existing code ...

    // Save data source
    const savedDataSource = await dataSourceRepo.save(newDataSource);

    // For MongoDB, trigger initial import
    if (type === 'mongodb' && connectionString) {
        try {
            const importService = MongoDBImportService.getInstance(this.dataSource);
            
            // Queue import job (async, don't await)
            QueueService.getInstance().addJob('mongodb-import', {
                dataSourceId: savedDataSource.id,
                syncType: 'full'
            });

        } catch (error) {
            console.error('Failed to queue MongoDB import:', error);
            // Don't fail data source creation if import fails
        }
    }

    return savedDataSource;
}
```

#### 3.2 Add Manual Sync Endpoint

Create route for manual synchronization:

```typescript
// routes/data_source.ts
router.post(
    '/sync/:data_source_id',
    authenticate,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const dataSourceId = parseInt(req.params.data_source_id);
            const { syncType = 'full' } = req.body;

            const processor = DataSourceProcessor.getInstance();
            const dataSource = await processor.getDataSourceById(dataSourceId);

            if (!dataSource) {
                return res.status(404).json({ message: 'Data source not found' });
            }

            if (dataSource.type !== 'mongodb') {
                return res.status(400).json({ 
                    message: 'Only MongoDB data sources support sync' 
                });
            }

            // Queue sync job
            QueueService.getInstance().addJob('mongodb-sync', {
                dataSourceId,
                syncType,
                userId: req.user?.id
            });

            res.json({
                message: 'Sync queued successfully',
                dataSourceId,
                syncType
            });

        } catch (error: any) {
            res.status(500).json({ 
                message: 'Failed to queue sync',
                error: error.message 
            });
        }
    }
);

// Get sync status
router.get(
    '/sync-status/:data_source_id',
    authenticate,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const dataSourceId = parseInt(req.params.data_source_id);

            const processor = DataSourceProcessor.getInstance();
            const dataSource = await processor.getDataSourceById(dataSourceId);

            if (!dataSource) {
                return res.status(404).json({ message: 'Data source not found' });
            }

            // Get recent sync history
            const historyRepo = AppDataSource.getRepository(DRAMongoDBSyncHistory);
            const syncHistory = await historyRepo.find({
                where: { data_source_id: dataSourceId },
                order: { started_at: 'DESC' },
                take: 10
            });

            res.json({
                sync_status: dataSource.sync_status,
                last_sync_at: dataSource.last_sync_at,
                total_records_synced: dataSource.total_records_synced,
                sync_error_message: dataSource.sync_error_message,
                history: syncHistory
            });

        } catch (error: any) {
            res.status(500).json({ 
                message: 'Failed to get sync status',
                error: error.message 
            });
        }
    }
);
```

#### 3.3 Queue Worker Implementation

Create worker to process sync jobs:

```typescript
// workers/mongodbSyncWorker.ts
import { QueueService } from '../services/QueueService.js';
import { MongoDBImportService } from '../services/MongoDBImportService.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { AppDataSource } from '../datasources/AppDataSource.js';

export class MongoDBSyncWorker {
    private static instance: MongoDBSyncWorker;

    public static getInstance(): MongoDBSyncWorker {
        if (!MongoDBSyncWorker.instance) {
            MongoDBSyncWorker.instance = new MongoDBSyncWorker();
        }
        return MongoDBSyncWorker.instance;
    }

    public async start(): Promise<void> {
        const queueService = QueueService.getInstance();

        // Register handlers
        queueService.registerHandler('mongodb-import', this.handleImport.bind(this));
        queueService.registerHandler('mongodb-sync', this.handleSync.bind(this));
    }

    private async handleImport(job: any): Promise<void> {
        const { dataSourceId, syncType = 'full' } = job.data;

        const processor = DataSourceProcessor.getInstance();
        const dataSource = await processor.getDataSourceById(dataSourceId);

        if (!dataSource) {
            throw new Error(`Data source ${dataSourceId} not found`);
        }

        const importService = MongoDBImportService.getInstance(AppDataSource);
        
        await importService.importDataSource(dataSource, {
            batchSize: 1000,
            incremental: syncType === 'incremental'
        });
    }

    private async handleSync(job: any): Promise<void> {
        // Same as handleImport
        await this.handleImport(job);
    }
}
```

#### 3.4 Scheduled Sync Service

Add scheduled sync support:

```typescript
// services/MongoDBSyncScheduler.ts
import cron from 'node-cron';
import { DataSource } from 'typeorm';
import { DRADataSource } from '../models/DRADataSource.js';
import { QueueService } from './QueueService.js';

export class MongoDBSyncScheduler {
    private static instance: MongoDBSyncScheduler;
    private pgDataSource: DataSource;
    private jobs: Map<number, cron.ScheduledTask> = new Map();

    private constructor(pgDataSource: DataSource) {
        this.pgDataSource = pgDataSource;
    }

    public static getInstance(pgDataSource: DataSource): MongoDBSyncScheduler {
        if (!MongoDBSyncScheduler.instance) {
            MongoDBSyncScheduler.instance = new MongoDBSyncScheduler(pgDataSource);
        }
        return MongoDBSyncScheduler.instance;
    }

    /**
     * Start scheduler for all MongoDB data sources with sync_config
     */
    public async startAll(): Promise<void> {
        const repo = this.pgDataSource.getRepository(DRADataSource);
        const mongoDataSources = await repo.find({
            where: { type: 'mongodb' }
        });

        for (const dataSource of mongoDataSources) {
            if (dataSource.sync_config?.schedule) {
                this.scheduleSync(dataSource);
            }
        }
    }

    /**
     * Schedule sync for a data source
     */
    public scheduleSync(dataSource: DRADataSource): void {
        const schedule = dataSource.sync_config?.schedule;
        
        if (!schedule) return;

        // Stop existing job if any
        this.stopSync(dataSource.id);

        // Create new cron job
        const job = cron.schedule(schedule, async () => {
            console.log(`Running scheduled sync for data source ${dataSource.id}`);
            
            await QueueService.getInstance().addJob('mongodb-sync', {
                dataSourceId: dataSource.id,
                syncType: 'incremental'
            });
        });

        this.jobs.set(dataSource.id, job);
    }

    /**
     * Stop scheduled sync for a data source
     */
    public stopSync(dataSourceId: number): void {
        const job = this.jobs.get(dataSourceId);
        if (job) {
            job.stop();
            this.jobs.delete(dataSourceId);
        }
    }
}
```

**Deliverables**:
- [ ] Update `DataSourceProcessor.addDataSource()` to trigger import
- [ ] Add `/sync/:data_source_id` endpoint
- [ ] Add `/sync-status/:data_source_id` endpoint
- [ ] Create `MongoDBSyncWorker.ts`
- [ ] Create `MongoDBSyncScheduler.ts`
- [ ] Update `server.ts` to start worker and scheduler
- [ ] Integration tests for sync endpoints

---

### Phase 4: Query Execution Updates

**Objective**: Update query execution to use PostgreSQL instead of external MongoDB

#### 4.1 Update executeMongoDBQuery()

Modify query execution to target PostgreSQL:

```typescript
// processors/DataSourceProcessor.ts
public async executeMongoDBQuery(
    dataSourceId: number,
    collectionName: string,
    pipeline: any[]
): Promise<any[]> {
    const dataSource = await this.getDataSourceById(dataSourceId);
    
    if (!dataSource || dataSource.type !== 'mongodb') {
        throw new Error('Invalid MongoDB data source');
    }

    // Check if data is imported to PostgreSQL
    if (dataSource.sync_status === 'completed' && dataSource.last_sync_at) {
        // Query PostgreSQL instead of MongoDB
        return this.executeMongoDBQueryFromPostgreSQL(
            collectionName,
            pipeline
        );
    } else {
        // Fall back to direct MongoDB query (legacy)
        return this.executeMongoDBQueryDirect(
            dataSource,
            collectionName,
            pipeline
        );
    }
}

/**
 * Execute MongoDB query against PostgreSQL (new approach)
 */
private async executeMongoDBQueryFromPostgreSQL(
    collectionName: string,
    pipeline: any[]
): Promise<any[]> {
    const tableName = this.sanitizeTableName(collectionName);
    
    // Translate MongoDB aggregation pipeline to SQL
    const translator = new MongoDBQueryTranslator();
    const sql = translator.translatePipeline(tableName, pipeline);

    // Execute SQL query
    const results = await this.dataSource.query(sql);

    return results;
}

/**
 * Execute MongoDB query directly (legacy approach)
 */
private async executeMongoDBQueryDirect(
    dataSource: DRADataSource,
    collectionName: string,
    pipeline: any[]
): Promise<any[]> {
    // Existing implementation
    // ... (current code for direct MongoDB queries)
}
```

#### 4.2 MongoDB to SQL Query Translator

Create translator for common MongoDB operations:

```typescript
// services/MongoDBQueryTranslator.ts
export class MongoDBQueryTranslator {
    /**
     * Translate MongoDB aggregation pipeline to SQL
     */
    public translatePipeline(tableName: string, pipeline: any[]): string {
        let sql = `SELECT * FROM dra_mongodb.${tableName}`;
        const whereClauses: string[] = [];
        const groupBy: string[] = [];
        const orderBy: string[] = [];
        let limit: number | null = null;
        let skip: number | null = null;

        for (const stage of pipeline) {
            const stageType = Object.keys(stage)[0];
            const stageValue = stage[stageType];

            switch (stageType) {
                case '$match':
                    whereClauses.push(this.translateMatch(stageValue));
                    break;

                case '$project':
                    // TODO: Implement projection translation
                    break;

                case '$group':
                    // TODO: Implement grouping translation
                    break;

                case '$sort':
                    orderBy.push(this.translateSort(stageValue));
                    break;

                case '$limit':
                    limit = stageValue;
                    break;

                case '$skip':
                    skip = stageValue;
                    break;

                // Add more stages as needed
            }
        }

        // Build complete SQL query
        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        if (orderBy.length > 0) {
            sql += ` ORDER BY ${orderBy.join(', ')}`;
        }

        if (limit !== null) {
            sql += ` LIMIT ${limit}`;
        }

        if (skip !== null) {
            sql += ` OFFSET ${skip}`;
        }

        return sql;
    }

    /**
     * Translate $match stage to WHERE clause
     */
    private translateMatch(match: Record<string, any>): string {
        const conditions: string[] = [];

        for (const [field, condition] of Object.entries(match)) {
            if (typeof condition === 'object' && condition !== null) {
                // Handle operators: $gt, $lt, $gte, $lte, $eq, $ne, $in
                for (const [op, value] of Object.entries(condition)) {
                    switch (op) {
                        case '$gt':
                            conditions.push(`${field} > ${this.formatValue(value)}`);
                            break;
                        case '$gte':
                            conditions.push(`${field} >= ${this.formatValue(value)}`);
                            break;
                        case '$lt':
                            conditions.push(`${field} < ${this.formatValue(value)}`);
                            break;
                        case '$lte':
                            conditions.push(`${field} <= ${this.formatValue(value)}`);
                            break;
                        case '$eq':
                            conditions.push(`${field} = ${this.formatValue(value)}`);
                            break;
                        case '$ne':
                            conditions.push(`${field} != ${this.formatValue(value)}`);
                            break;
                        case '$in':
                            const values = (value as any[]).map(v => this.formatValue(v)).join(', ');
                            conditions.push(`${field} IN (${values})`);
                            break;
                    }
                }
            } else {
                // Simple equality
                conditions.push(`${field} = ${this.formatValue(condition)}`);
            }
        }

        return conditions.join(' AND ');
    }

    /**
     * Translate $sort stage to ORDER BY clause
     */
    private translateSort(sort: Record<string, number>): string {
        const orderItems: string[] = [];

        for (const [field, direction] of Object.entries(sort)) {
            const dir = direction === 1 ? 'ASC' : 'DESC';
            orderItems.push(`${field} ${dir}`);
        }

        return orderItems.join(', ');
    }

    /**
     * Format value for SQL
     */
    private formatValue(value: any): string {
        if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
        } else if (value instanceof Date) {
            return `'${value.toISOString()}'`;
        } else if (value === null) {
            return 'NULL';
        } else {
            return String(value);
        }
    }

    private sanitizeTableName(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }
}
```

**Deliverables**:
- [ ] Update `executeMongoDBQuery()` with PostgreSQL path
- [ ] Create `MongoDBQueryTranslator.ts`
- [ ] Implement basic stages: $match, $sort, $limit, $skip
- [ ] Add support for complex stages: $project, $group, $lookup
- [ ] Unit tests for query translation
- [ ] Integration tests for query execution

---

### Phase 5: UI/UX Updates

**Objective**: Add UI for sync management and status display

#### 5.1 Data Source Card Updates

Add sync status display to data source cards:

```vue
<!-- frontend/components/DataSourceCard.vue -->
<template>
  <div class="data-source-card">
    <!-- Existing card content -->
    
    <!-- MongoDB Sync Status (new) -->
    <div v-if="dataSource.type === 'mongodb'" class="sync-status">
      <div class="status-badge" :class="syncStatusClass">
        {{ syncStatusText }}
      </div>
      
      <div v-if="dataSource.last_sync_at" class="last-sync">
        Last synced: {{ formatDate(dataSource.last_sync_at) }}
      </div>
      
      <div v-if="dataSource.total_records_synced" class="records-count">
        {{ dataSource.total_records_synced.toLocaleString() }} records
      </div>
      
      <button 
        v-if="canSync"
        @click="triggerSync"
        class="sync-button"
        :disabled="isSyncing"
      >
        <Icon name="mdi:sync" />
        Sync Now
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  dataSource: IDataSource;
}>();

const isSyncing = ref(false);

const syncStatusClass = computed(() => {
  switch (props.dataSource.sync_status) {
    case 'completed': return 'status-success';
    case 'in_progress': return 'status-loading';
    case 'failed': return 'status-error';
    default: return 'status-pending';
  }
});

const syncStatusText = computed(() => {
  switch (props.dataSource.sync_status) {
    case 'completed': return 'Synced';
    case 'in_progress': return 'Syncing...';
    case 'failed': return 'Sync Failed';
    case 'pending': return 'Pending Sync';
    default: return 'Not Synced';
  }
});

const canSync = computed(() => {
  return props.dataSource.sync_status !== 'in_progress';
});

async function triggerSync() {
  isSyncing.value = true;
  
  try {
    const config = useRuntimeConfig();
    await $fetch(`${config.public.apiBase}/data-source/sync/${props.dataSource.id}`, {
      method: 'POST',
      credentials: 'include',
      body: { syncType: 'incremental' }
    });
    
    // Refresh data source status
    // ... (emit event or fetch updated status)
    
  } catch (error) {
    console.error('Failed to trigger sync:', error);
  } finally {
    isSyncing.value = false;
  }
}
</script>
```

#### 5.2 Sync Status Page

Create detailed sync status page:

```vue
<!-- frontend/pages/projects/[projectid]/data-sources/[id]/sync-status.vue -->
<template>
  <div class="sync-status-page">
    <h1>MongoDB Sync Status</h1>
    
    <!-- Current Status -->
    <div class="current-status">
      <div class="status-card">
        <h3>Sync Status</h3>
        <div class="status-badge" :class="syncStatusClass">
          {{ syncStatusText }}
        </div>
      </div>
      
      <div class="status-card">
        <h3>Last Sync</h3>
        <div>{{ formatDate(dataSource?.last_sync_at) || 'Never' }}</div>
      </div>
      
      <div class="status-card">
        <h3>Total Records</h3>
        <div>{{ dataSource?.total_records_synced?.toLocaleString() || 0 }}</div>
      </div>
      
      <div class="status-card">
        <h3>Sync Schedule</h3>
        <div>{{ syncSchedule || 'Manual only' }}</div>
      </div>
    </div>
    
    <!-- Sync Actions -->
    <div class="sync-actions">
      <button @click="triggerFullSync" :disabled="isSyncing">
        Full Sync
      </button>
      <button @click="triggerIncrementalSync" :disabled="isSyncing">
        Incremental Sync
      </button>
    </div>
    
    <!-- Sync History -->
    <div class="sync-history">
      <h2>Sync History</h2>
      
      <table>
        <thead>
          <tr>
            <th>Collection</th>
            <th>Type</th>
            <th>Status</th>
            <th>Records</th>
            <th>Started</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sync in syncHistory" :key="sync.id">
            <td>{{ sync.collection_name }}</td>
            <td>{{ sync.sync_type }}</td>
            <td :class="getSyncStatusClass(sync.status)">
              {{ sync.status }}
            </td>
            <td>{{ sync.records_synced.toLocaleString() }}</td>
            <td>{{ formatDate(sync.started_at) }}</td>
            <td>{{ calculateDuration(sync.started_at, sync.completed_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Sync Configuration -->
    <div class="sync-config">
      <h2>Sync Configuration</h2>
      
      <form @submit.prevent="updateSyncConfig">
        <div class="form-group">
          <label>Sync Schedule (Cron Expression)</label>
          <input 
            v-model="syncConfig.schedule"
            type="text"
            placeholder="0 */6 * * * (every 6 hours)"
          />
        </div>
        
        <div class="form-group">
          <label>Batch Size</label>
          <input 
            v-model.number="syncConfig.batchSize"
            type="number"
            min="100"
            max="10000"
          />
        </div>
        
        <div class="form-group">
          <label>
            <input 
              v-model="syncConfig.incremental"
              type="checkbox"
            />
            Enable Incremental Sync
          </label>
        </div>
        
        <button type="submit">Save Configuration</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
// ... implementation
</script>
```

#### 5.3 Socket.IO Progress Updates

Add real-time sync progress via Socket.IO:

```typescript
// Backend: services/MongoDBImportService.ts
private async importCollection(...) {
    // ... existing code ...
    
    // Emit progress updates
    const io = SocketService.getInstance().getIO();
    const progressInterval = setInterval(() => {
        io.to(`data-source-${dataSource.id}`).emit('sync-progress', {
            dataSourceId: dataSource.id,
            collectionName,
            processed: processedDocuments,
            total: totalDocuments,
            percentage: (processedDocuments / totalDocuments) * 100
        });
    }, 1000);
    
    // ... processing logic ...
    
    clearInterval(progressInterval);
}
```

```vue
<!-- Frontend: Sync Progress Component -->
<script setup lang="ts">
import { io } from 'socket.io-client';

const socket = io(config.public.apiBase);
const syncProgress = ref<any>(null);

onMounted(() => {
    socket.emit('join-room', `data-source-${dataSourceId}`);
    
    socket.on('sync-progress', (data) => {
        syncProgress.value = data;
    });
});

onUnmounted(() => {
    socket.emit('leave-room', `data-source-${dataSourceId}`);
    socket.disconnect();
});
</script>
```

**Deliverables**:
- [ ] Update `DataSourceCard.vue` with sync status
- [ ] Create sync status page
- [ ] Create sync configuration form
- [ ] Add Socket.IO progress updates
- [ ] Add sync history table
- [ ] UI tests for sync components

---

### Phase 6: Performance Optimizations

**Objective**: Optimize import and query performance

#### 6.1 Batch Insert Optimization

Optimize batch inserts with COPY command:

```typescript
// services/MongoDBImportService.ts
private async insertBatchOptimized(
    queryRunner: QueryRunner,
    tableName: string,
    documents: any[],
    schema: any
): Promise<{ success: number; failed: number }> {
    // Use PostgreSQL COPY for bulk insert (much faster than INSERT)
    const copyStream = await queryRunner.query(`
        COPY dra_mongodb.${tableName} FROM STDIN WITH (FORMAT csv, DELIMITER ',')
    `);
    
    // Convert documents to CSV format
    for (const doc of documents) {
        const flatDoc = this.flattenDocument(doc, schema);
        const csvRow = this.documentToCSV(flatDoc);
        copyStream.write(csvRow);
    }
    
    copyStream.end();
    
    return { success: documents.length, failed: 0 };
}
```

#### 6.2 Incremental Sync Strategy

Implement efficient incremental sync:

```typescript
// Track last sync timestamp per collection
private async getLastSyncTimestamp(
    dataSourceId: number,
    collectionName: string
): Promise<Date | null> {
    const historyRepo = this.pgDataSource.getRepository(DRAMongoDBSyncHistory);
    
    const lastSync = await historyRepo.findOne({
        where: {
            data_source_id: dataSourceId,
            collection_name: collectionName,
            status: 'completed'
        },
        order: { completed_at: 'DESC' }
    });
    
    return lastSync?.sync_metadata?.lastDocumentTimestamp || null;
}

// Query only new/updated documents
const lastSyncTimestamp = await this.getLastSyncTimestamp(
    dataSource.id,
    collectionName
);

if (lastSyncTimestamp) {
    query = { updatedAt: { $gt: lastSyncTimestamp } };
}
```

#### 6.3 Index Creation

Create indexes for better query performance:

```typescript
// Create indexes on commonly queried fields
private async createIndexes(tableName: string, schema: any): Promise<void> {
    const queryRunner = this.pgDataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
        // Create index on _id (primary key, already indexed)
        
        // Create indexes on commonly queried fields
        const indexableFields = this.getIndexableFields(schema);
        
        for (const field of indexableFields) {
            const indexName = `idx_${tableName}_${field}`;
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS ${indexName}
                ON dra_mongodb.${tableName} (${field})
            `);
        }
        
        // Create index on _imported_at for sync tracking
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_${tableName}_imported_at
            ON dra_mongodb.${tableName} (_imported_at)
        `);
        
    } finally {
        await queryRunner.release();
    }
}
```

#### 6.4 Parallel Processing

Process multiple collections in parallel:

```typescript
public async importDataSource(
    dataSource: DRADataSource,
    options: ImportOptions = {}
): Promise<void> {
    // ... existing code ...
    
    // Import collections in parallel (limit to 3 concurrent)
    const limit = pLimit(3);
    const importPromises = collections.map(collectionName =>
        limit(() => this.importCollection(
            dataSource,
            clientId,
            collectionName,
            options
        ))
    );
    
    const results = await Promise.allSettled(importPromises);
    
    // ... handle results ...
}
```

**Deliverables**:
- [ ] Implement COPY command for bulk inserts
- [ ] Add efficient incremental sync
- [ ] Create indexes on imported tables
- [ ] Add parallel collection processing
- [ ] Add connection pooling
- [ ] Performance benchmarks
- [ ] Load tests

---

## Comparison with Google Analytics

### Architecture Similarities

| Aspect | Google Analytics | MongoDB (Proposed) |
|--------|------------------|-------------------|
| **Data Location** | External API → PostgreSQL | External MongoDB → PostgreSQL |
| **Schema** | `dra_google_analytics` | `dra_mongodb` |
| **Import Service** | `GoogleAnalyticsImportService` | `MongoDBImportService` |
| **Sync Tracking** | Yes (sync_status, last_sync_at) | Yes (same fields) |
| **Scheduled Sync** | Yes (cron-based) | Yes (cron-based) |
| **Join Support** | ✅ Full support | ✅ Full support (after import) |
| **AI Features** | ✅ Enabled | ✅ Enabled (after import) |

### Key Implementation References

1. **Google Analytics Import Service**: `backend/src/services/GoogleAnalyticsImportService.ts`
   - Pattern for API → PostgreSQL import
   - Batch processing logic
   - Type mapping strategies

2. **Google Analytics Data Model**: `backend/src/models/DRAGoogleAnalyticsData.ts`
   - Schema structure for imported data
   - Relationship to data source

3. **Sync Scheduler**: `backend/src/services/DataSourceSyncScheduler.ts`
   - Cron-based scheduling
   - Job queue integration
   - Error handling patterns

---

## Implementation Timeline

### Sprint 1 (2 weeks): Foundation
- [ ] Phase 1: Database schema and migrations
- [ ] Initial MongoDBImportService structure
- [ ] Basic type mapping

### Sprint 2 (2 weeks): Core Import
- [ ] Phase 2: Complete MongoDBImportService
- [ ] Batch insert logic
- [ ] Document flattening

### Sprint 3 (1 week): Integration
- [ ] Phase 3: Integration points
- [ ] Queue worker
- [ ] Sync endpoints

### Sprint 4 (2 weeks): Query Updates
- [ ] Phase 4: Query translation
- [ ] Update query execution
- [ ] Testing and validation

### Sprint 5 (1 week): UI
- [ ] Phase 5: Frontend updates
- [ ] Sync status displays
- [ ] Configuration UI

### Sprint 6 (1 week): Optimization & Polish
- [ ] Phase 6: Performance optimization
- [ ] Documentation
- [ ] Final testing

**Total Estimated Time**: 6-7 weeks

---

## Testing Strategy

### Unit Tests
- [ ] MongoDBImportService methods
- [ ] MongoDBQueryTranslator
- [ ] Type mapping utilities
- [ ] Document flattening logic

### Integration Tests
- [ ] End-to-end import flow
- [ ] Sync endpoints
- [ ] Query execution (MongoDB pipeline → SQL)
- [ ] Scheduled sync

### Performance Tests
- [ ] Large dataset imports (1M+ documents)
- [ ] Concurrent collection processing
- [ ] Query performance comparison (direct vs imported)
- [ ] Incremental sync efficiency

### Manual Testing
- [ ] MongoDB Atlas connection
- [ ] Multiple collections import
- [ ] Nested document handling
- [ ] Sync progress UI
- [ ] Error scenarios

---

## Migration Path for Existing Users

### For Users with External MongoDB Connections

1. **Automatic Migration**:
   - Run migration to add sync tracking columns
   - System detects existing MongoDB data sources
   - Queue initial import jobs

2. **User Communication**:
   - In-app notification: "MongoDB data sources now support advanced features!"
   - Email explaining benefits and timeline
   - FAQ about sync latency

3. **Gradual Rollout**:
   - Phase 1: Opt-in beta (power users)
   - Phase 2: Automatic import for new MongoDB connections
   - Phase 3: Migrate all existing connections

---

## Monitoring & Observability

### Metrics to Track
- Import success/failure rates
- Average import duration per collection
- Storage usage (dra_mongodb schema size)
- Query performance (direct vs imported)
- Sync latency
- Error rates

### Logging
- Import start/complete events
- Sync progress (%)
- Failed document details
- Query translation errors

### Alerts
- Import failures
- Sync delays (> 2x expected duration)
- Storage growth (> threshold)
- High error rates

---

## Security Considerations

### Data Encryption
- Connection strings encrypted in database (already implemented)
- Sensitive fields in imported data (PII, credentials) handled via JSONB encryption

### Access Control
- Sync operations require authentication
- RBAC for sync management (admin only)
- Audit log for sync operations

### Data Retention
- Configurable retention policy for sync history
- Automatic cleanup of old sync logs

---

## Future Enhancements

### Phase 7+ (Future)
- [ ] Real-time sync via MongoDB Change Streams
- [ ] Selective collection import (user chooses which collections)
- [ ] Advanced query optimization (query plan analysis)
- [ ] Data transformation rules during import
- [ ] Conflict resolution strategies
- [ ] Export from PostgreSQL back to MongoDB
- [ ] Multi-region sync support

---

## References

- [Google Analytics Implementation](GOOGLE_DATA_SOURCES_COMPLETE_SYSTEM_IMPLEMENTATION.md)
- [AI Data Modeler Implementation](ai-data-modeler-implementation.md)
- [MongoDB Native Service Implementation](../backend/src/services/MongoDBNativeService.ts)
- [MongoDB Driver](../backend/src/drivers/MongoDBDriver.ts)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL COPY Command](https://www.postgresql.org/docs/current/sql-copy.html)

---

## Questions & Support

For questions or issues during implementation:
1. Check existing MongoDB connection implementation
2. Review Google Analytics import service as reference
3. Test with small datasets first
4. Monitor sync history for errors
5. Check logs for detailed error messages

---

## Conclusion

This implementation plan provides a comprehensive path to migrate MongoDB data sources from external query architecture to a fully integrated PostgreSQL import approach. By following the 6 phases sequentially and referencing the Google Analytics implementation, we can achieve feature parity with other data sources while maintaining high performance and reliability.

The key success factors are:
1. **Incremental approach**: Build and test each phase thoroughly
2. **Reference implementation**: Learn from Google Analytics patterns
3. **Performance focus**: Optimize batch processing and indexing
4. **User communication**: Manage expectations around sync latency
5. **Monitoring**: Track metrics to ensure system health

Once complete, MongoDB data sources will have full platform support including joins, AI suggestions, cross-source queries, and unified data governance.
