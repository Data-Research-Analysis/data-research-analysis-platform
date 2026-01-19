import { UtilityService } from "./UtilityService.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADataModelRefreshHistory } from "../models/DRADataModelRefreshHistory.js";
import { DRADataModelSource } from "../models/DRADataModelSource.js";
import { PostgresDataSource } from "../datasources/PostgresDataSource.js";
import { SocketIODriver } from "../drivers/SocketIODriver.js";
import EventEmitter from 'events';
import dotenv from 'dotenv';

dotenv.config();

export interface RefreshOptions {
    triggeredBy: 'user' | 'cascade' | 'schedule' | 'api';
    triggerUserId?: number;
    triggerSourceId?: number;
    reason?: string;
}

export interface RefreshResult {
    success: boolean;
    dataModelId: number;
    rowsBefore: number;
    rowsAfter: number;
    rowsChanged: number;
    durationMs: number;
    error?: string;
}

export class DataModelRefreshService extends EventEmitter {
    private static instance: DataModelRefreshService;

    private constructor() {
        super();
    }

    public static getInstance(): DataModelRefreshService {
        if (!DataModelRefreshService.instance) {
            DataModelRefreshService.instance = new DataModelRefreshService();
        }
        return DataModelRefreshService.instance;
    }

    /**
     * Get the application data source
     */
    private getAppDataSource() {
        const host = process.env.POSTGRESQL_HOST || 'localhost';
        const port = parseInt(process.env.POSTGRESQL_PORT || '5432');
        const database = process.env.POSTGRESQL_DB_NAME || 'dataresearchanalysisdb';
        const username = process.env.POSTGRESQL_USERNAME || 'dataresearchanalysisuser';
        const password = process.env.POSTGRESQL_PASSWORD || 'password';
        return PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);
    }

    /**
     * Refresh a single data model by recreating it with fresh data
     */
    public async refreshDataModel(dataModelId: number, options: RefreshOptions): Promise<RefreshResult> {
        const startTime = Date.now();
        const appDataSource = this.getAppDataSource();

        try {
            // Load the data model
            const dataModel = await appDataSource
                .getRepository(DRADataModel)
                .findOne({ 
                    where: { id: dataModelId },
                    relations: ['users_platform']
                });

            if (!dataModel) {
                throw new Error(`Data model with ID ${dataModelId} not found`);
            }

            console.log(`[DataModelRefresh] Starting refresh for model: ${dataModel.name} (ID: ${dataModelId})`);

            // Update status to REFRESHING
            await this.updateModelStatus(dataModelId, 'REFRESHING', null);

            // Create refresh history record
            const historyId = await this.createRefreshHistory(dataModel, options, 'RUNNING');

            // Emit start event
            this.emit('model:refresh:started', {
                dataModelId,
                modelName: dataModel.name,
                triggeredBy: options.triggeredBy
            });

            // Emit Socket.IO event for frontend
            try {
                await SocketIODriver.getInstance().emitEvent('model:refresh:started', {
                    dataModelId,
                    modelName: dataModel.name,
                    triggeredBy: options.triggeredBy
                });
            } catch (socketError) {
                console.warn('[DataModelRefresh] Failed to emit Socket.IO event:', socketError);
            }

            // Get row count before refresh
            const rowsBefore = await this.countRows(dataModel.schema, dataModel.name);

            // Execute the refresh
            await this.executeRefresh(dataModel);

            // Get row count after refresh
            const rowsAfter = await this.countRows(dataModel.schema, dataModel.name);
            const rowsChanged = rowsAfter - rowsBefore;

            const durationMs = Date.now() - startTime;

            // Update model metadata
            await this.updateModelMetadata(dataModelId, 'COMPLETED', rowsAfter, durationMs, null);

            // Update history record
            await this.updateRefreshHistory(historyId, 'COMPLETED', rowsBefore, rowsAfter, rowsChanged, durationMs, null);

            console.log(`[DataModelRefresh] ✅ Completed: ${dataModel.name} (${rowsAfter} rows, ${durationMs}ms)`);

            // Emit completion event
            this.emit('model:refresh:completed', {
                dataModelId,
                modelName: dataModel.name,
                rowsAfter,
                durationMs
            });

            // Emit Socket.IO event for frontend
            try {
                await SocketIODriver.getInstance().emitEvent('model:refresh:completed', {
                    dataModelId,
                    modelName: dataModel.name,
                    rowsAfter,
                    durationMs
                });
            } catch (socketError) {
                console.warn('[DataModelRefresh] Failed to emit Socket.IO event:', socketError);
            }

            return {
                success: true,
                dataModelId,
                rowsBefore,
                rowsAfter,
                rowsChanged,
                durationMs
            };

        } catch (error: any) {
            const durationMs = Date.now() - startTime;
            const errorMessage = error.message || 'Unknown error during refresh';

            console.error(`[DataModelRefresh] ❌ Failed for model ID ${dataModelId}:`, errorMessage);

            // Update model status to FAILED
            await this.updateModelStatus(dataModelId, 'FAILED', errorMessage);

            // Update history if it exists
            const history = await appDataSource
                .getRepository(DRADataModelRefreshHistory)
                .findOne({
                    where: { data_model: { id: dataModelId } },
                    order: { started_at: 'DESC' }
                });

            if (history) {
                await this.updateRefreshHistory(
                    history.id,
                    'FAILED',
                    0,
                    0,
                    0,
                    durationMs,
                    errorMessage,
                    error.stack
                );
            }

            // Emit failure event
            this.emit('model:refresh:failed', {
                dataModelId,
                error: errorMessage
            });

            // Emit Socket.IO event for frontend
            try {
                await SocketIODriver.getInstance().emitEvent('model:refresh:failed', {
                    dataModelId,
                    error: errorMessage
                });
            } catch (socketError) {
                console.warn('[DataModelRefresh] Failed to emit Socket.IO event:', socketError);
            }

            return {
                success: false,
                dataModelId,
                rowsBefore: 0,
                rowsAfter: 0,
                rowsChanged: 0,
                durationMs,
                error: errorMessage
            };
        }
    }

    /**
     * Find all data models that depend on a specific data source
     */
    public async findDependentModels(dataSourceId: number): Promise<number[]> {
        const appDataSource = this.getAppDataSource();

        try {
            // Find direct dependencies (single-source models)
            const directModels = await appDataSource
                .getRepository(DRADataModel)
                .createQueryBuilder('model')
                .where('model.data_source_id = :dataSourceId', { dataSourceId })
                .andWhere('model.auto_refresh_enabled = true')
                .select('model.id')
                .getMany();

            // Find cross-source dependencies
            const crossSourceModels = await appDataSource
                .getRepository(DRADataModelSource)
                .createQueryBuilder('source')
                .innerJoin('source.data_model', 'model')
                .where('source.data_source_id = :dataSourceId', { dataSourceId })
                .andWhere('model.auto_refresh_enabled = true')
                .select('DISTINCT model.id', 'id')
                .getRawMany();

            // Combine and deduplicate
            const allModelIds = [
                ...directModels.map(m => m.id),
                ...crossSourceModels.map(m => m.id)
            ];

            const uniqueModelIds = [...new Set(allModelIds)];

            console.log(`[DataModelRefresh] Found ${uniqueModelIds.length} dependent models for data source ${dataSourceId}`);

            return uniqueModelIds;

        } catch (error: any) {
            console.error(`[DataModelRefresh] Error finding dependent models:`, error.message);
            return [];
        }
    }

    /**
     * Execute the actual refresh by recreating the table
     */
    private async executeRefresh(dataModel: DRADataModel): Promise<void> {
        const appDataSource = this.getAppDataSource();
        const timestamp = Date.now();
        const tempTableName = `${dataModel.name}_refresh_${timestamp}`;

        const queryRunner = appDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Step 1: Create temp table with data from original query
            console.log(`[DataModelRefresh] Creating temp table: ${tempTableName}`);
            const createTempTableQuery = `
                CREATE TABLE "${dataModel.schema}"."${tempTableName}" AS
                ${dataModel.sql_query}
            `;
            await queryRunner.query(createTempTableQuery);

            // Step 2: Validate temp table has data
            const tempRowCount = await queryRunner.query(
                `SELECT COUNT(*) as count FROM "${dataModel.schema}"."${tempTableName}"`
            );
            const count = parseInt(tempRowCount[0].count);

            if (count === 0) {
                throw new Error('Temp table is empty after refresh query execution');
            }

            console.log(`[DataModelRefresh] Temp table created with ${count} rows`);

            // Step 3: Drop old table and rename temp table (atomic swap)
            console.log(`[DataModelRefresh] Performing atomic swap`);
            await queryRunner.query(`DROP TABLE IF EXISTS "${dataModel.schema}"."${dataModel.name}" CASCADE`);
            await queryRunner.query(`ALTER TABLE "${dataModel.schema}"."${tempTableName}" RENAME TO "${dataModel.name}"`);

            await queryRunner.commitTransaction();
            console.log(`[DataModelRefresh] Atomic swap completed successfully`);

        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            
            // Clean up temp table if it exists
            try {
                await queryRunner.query(`DROP TABLE IF EXISTS "${dataModel.schema}"."${tempTableName}" CASCADE`);
            } catch (cleanupError) {
                console.error(`[DataModelRefresh] Error cleaning up temp table:`, cleanupError);
            }

            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Count rows in a table
     */
    private async countRows(schema: string, tableName: string): Promise<number> {
        const appDataSource = this.getAppDataSource();

        try {
            const result = await appDataSource.query(
                `SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`
            );
            return parseInt(result[0].count);
        } catch (error) {
            console.warn(`[DataModelRefresh] Could not count rows for ${schema}.${tableName}, returning 0`);
            return 0;
        }
    }

    /**
     * Update data model status
     */
    private async updateModelStatus(
        dataModelId: number,
        status: 'IDLE' | 'QUEUED' | 'REFRESHING' | 'COMPLETED' | 'FAILED',
        error: string | null
    ): Promise<void> {
        const appDataSource = this.getAppDataSource();

        await appDataSource
            .getRepository(DRADataModel)
            .update(dataModelId, {
                refresh_status: status,
                refresh_error: error
            });
    }

    /**
     * Update data model metadata after successful refresh
     */
    private async updateModelMetadata(
        dataModelId: number,
        status: 'COMPLETED' | 'FAILED',
        rowCount: number,
        durationMs: number,
        error: string | null
    ): Promise<void> {
        const appDataSource = this.getAppDataSource();

        await appDataSource
            .getRepository(DRADataModel)
            .update(dataModelId, {
                refresh_status: status,
                last_refreshed_at: new Date(),
                row_count: rowCount,
                last_refresh_duration_ms: durationMs,
                refresh_error: error
            });
    }

    /**
     * Create refresh history record
     */
    private async createRefreshHistory(
        dataModel: DRADataModel,
        options: RefreshOptions,
        status: 'QUEUED' | 'RUNNING'
    ): Promise<number> {
        const appDataSource = this.getAppDataSource();

        const history = appDataSource.getRepository(DRADataModelRefreshHistory).create({
            data_model: { id: dataModel.id },
            status,
            started_at: new Date(),
            triggered_by: options.triggeredBy,
            trigger_user: options.triggerUserId ? { id: options.triggerUserId } : undefined,
            trigger_source: options.triggerSourceId ? { id: options.triggerSourceId } : undefined,
            reason: options.reason,
            query_executed: dataModel.sql_query
        });

        const saved = await appDataSource.getRepository(DRADataModelRefreshHistory).save(history);
        return saved.id;
    }

    /**
     * Update refresh history record
     */
    private async updateRefreshHistory(
        historyId: number,
        status: 'COMPLETED' | 'FAILED',
        rowsBefore: number,
        rowsAfter: number,
        rowsChanged: number,
        durationMs: number,
        errorMessage?: string,
        errorStack?: string
    ): Promise<void> {
        const appDataSource = this.getAppDataSource();

        await appDataSource
            .getRepository(DRADataModelRefreshHistory)
            .update(historyId, {
                status,
                completed_at: new Date(),
                duration_ms: durationMs,
                rows_before: rowsBefore,
                rows_after: rowsAfter,
                rows_changed: rowsChanged,
                error_message: errorMessage,
                error_stack: errorStack
            });
    }
}
