import { DataSource as TypeORMDataSource } from 'typeorm';
import { SyncHistory, SyncStatus, SyncType } from '../entities/SyncHistory.js';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';

/**
 * Service for managing sync history records
 */
export class SyncHistoryService {
    private static instance: SyncHistoryService;
    
    private constructor() {}
    
    public static getInstance(): SyncHistoryService {
        if (!SyncHistoryService.instance) {
            SyncHistoryService.instance = new SyncHistoryService();
        }
        return SyncHistoryService.instance;
    }
    
    /**
     * Get TypeORM data source
     */
    private async getDataSource(): Promise<TypeORMDataSource> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        return await driver.getConcreteDriver();
    }
    
    /**
     * Create a new sync history record
     * @param dataSourceId - Data source ID
     * @param syncType - Type of sync (FULL, INCREMENTAL, MANUAL, SCHEDULED)
     * @param metadata - Additional metadata (report types, date range, etc.)
     * @returns Created sync history record
     */
    public async createSyncRecord(
        dataSourceId: number,
        syncType: SyncType = SyncType.MANUAL,
        metadata?: Record<string, any>
    ): Promise<SyncHistory> {
        try {
            const dataSource = await this.getDataSource();
            const syncHistoryRepo = dataSource.getRepository(SyncHistory);
            
            const syncRecord = syncHistoryRepo.create({
                dataSourceId,
                syncType,
                status: SyncStatus.PENDING,
                startedAt: new Date(),
                recordsSynced: 0,
                recordsFailed: 0,
                metadata: metadata || {},
            });
            
            const savedRecord = await syncHistoryRepo.save(syncRecord);
            console.log(`📝 Created sync history record #${savedRecord.id} for data source ${dataSourceId}`);
            
            return savedRecord;
        } catch (error) {
            console.error('❌ Failed to create sync history record:', error);
            throw error;
        }
    }
    
    /**
     * Update sync status to RUNNING
     * @param syncId - Sync history ID
     */
    public async markAsRunning(syncId: number): Promise<void> {
        try {
            const dataSource = await this.getDataSource();
            const syncHistoryRepo = dataSource.getRepository(SyncHistory);
            
            await syncHistoryRepo.update(syncId, {
                status: SyncStatus.RUNNING,
                startedAt: new Date(),
            });
            
            console.log(`🔄 Sync #${syncId} marked as RUNNING`);
        } catch (error) {
            console.error('❌ Failed to mark sync as running:', error);
        }
    }
    
    /**
     * Complete a sync history record
     * @param syncId - Sync history ID
     * @param recordsSynced - Number of records successfully synced
     * @param recordsFailed - Number of records that failed
     * @param errorMessage - Error message if any
     */
    public async completeSyncRecord(
        syncId: number,
        recordsSynced: number,
        recordsFailed: number = 0,
        errorMessage?: string
    ): Promise<void> {
        try {
            const dataSource = await this.getDataSource();
            const syncHistoryRepo = dataSource.getRepository(SyncHistory);
            
            // Get the record to calculate duration
            const record = await syncHistoryRepo.findOne({ where: { id: syncId } });
            if (!record) {
                console.error(`❌ Sync history record #${syncId} not found`);
                return;
            }
            
            const completedAt = new Date();
            const durationMs = completedAt.getTime() - record.startedAt.getTime();
            
            // Determine status
            let status = SyncStatus.COMPLETED;
            if (errorMessage || recordsFailed > 0) {
                status = recordsSynced > 0 ? SyncStatus.PARTIAL : SyncStatus.FAILED;
            }
            
            await syncHistoryRepo.update(syncId, {
                status,
                completedAt,
                durationMs,
                recordsSynced,
                recordsFailed,
                errorMessage: errorMessage || null,
            });
            
            console.log(`✅ Sync #${syncId} completed: ${recordsSynced} synced, ${recordsFailed} failed (${durationMs}ms)`);
        } catch (error) {
            console.error('❌ Failed to complete sync history record:', error);
        }
    }
    
    /**
     * Mark a sync as failed
     * @param syncId - Sync history ID
     * @param errorMessage - Error message
     */
    public async markAsFailed(syncId: number, errorMessage: string): Promise<void> {
        try {
            const dataSource = await this.getDataSource();
            const syncHistoryRepo = dataSource.getRepository(SyncHistory);
            
            const record = await syncHistoryRepo.findOne({ where: { id: syncId } });
            if (!record) {
                console.error(`❌ Sync history record #${syncId} not found`);
                return;
            }
            
            const completedAt = new Date();
            const durationMs = completedAt.getTime() - record.startedAt.getTime();
            
            await syncHistoryRepo.update(syncId, {
                status: SyncStatus.FAILED,
                completedAt,
                durationMs,
                errorMessage,
            });
            
            console.log(`❌ Sync #${syncId} marked as FAILED: ${errorMessage}`);
        } catch (error) {
            console.error('❌ Failed to mark sync as failed:', error);
        }
    }
    
    /**
     * Get sync history for a data source
     * @param dataSourceId - Data source ID
     * @param limit - Maximum number of records to return
     * @returns Array of sync history records
     */
    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<SyncHistory[]> {
        try {
            const dataSource = await this.getDataSource();
            const syncHistoryRepo = dataSource.getRepository(SyncHistory);
            
            const history = await syncHistoryRepo.find({
                where: { dataSourceId },
                order: { startedAt: 'DESC' },
                take: limit,
            });
            
            return history;
        } catch (error) {
            console.error('❌ Failed to get sync history:', error);
            return [];
        }
    }
    
    /**
     * Get the most recent sync for a data source
     * @param dataSourceId - Data source ID
     * @returns Most recent sync record or null
     */
    public async getLastSync(dataSourceId: number): Promise<SyncHistory | null> {
        try {
            const dataSource = await this.getDataSource();
            const syncHistoryRepo = dataSource.getRepository(SyncHistory);
            
            const lastSync = await syncHistoryRepo.findOne({
                where: { dataSourceId },
                order: { startedAt: 'DESC' },
            });
            
            return lastSync;
        } catch (error) {
            console.error('❌ Failed to get last sync:', error);
            return null;
        }
    }
    
    /**
     * Get sync statistics for a data source
     * @param dataSourceId - Data source ID
     * @param days - Number of days to look back (default 30)
     * @returns Sync statistics
     */
    public async getSyncStats(dataSourceId: number, days: number = 30): Promise<{
        totalSyncs: number;
        successfulSyncs: number;
        failedSyncs: number;
        partialSyncs: number;
        totalRecordsSynced: number;
        averageDurationMs: number;
        lastSyncAt: Date | null;
    }> {
        try {
            const dataSource = await this.getDataSource();
            const syncHistoryRepo = dataSource.getRepository(SyncHistory);
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const syncs = await syncHistoryRepo
                .createQueryBuilder('sync')
                .where('sync.dataSourceId = :dataSourceId', { dataSourceId })
                .andWhere('sync.startedAt >= :cutoffDate', { cutoffDate })
                .getMany();
            
            const stats = {
                totalSyncs: syncs.length,
                successfulSyncs: syncs.filter(s => s.status === SyncStatus.COMPLETED).length,
                failedSyncs: syncs.filter(s => s.status === SyncStatus.FAILED).length,
                partialSyncs: syncs.filter(s => s.status === SyncStatus.PARTIAL).length,
                totalRecordsSynced: syncs.reduce((sum, s) => sum + (s.recordsSynced || 0), 0),
                averageDurationMs: syncs.length > 0
                    ? Math.round(syncs.reduce((sum, s) => sum + (s.durationMs || 0), 0) / syncs.length)
                    : 0,
                lastSyncAt: syncs.length > 0 ? syncs[0].startedAt : null,
            };
            
            return stats;
        } catch (error) {
            console.error('❌ Failed to get sync stats:', error);
            return {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                partialSyncs: 0,
                totalRecordsSynced: 0,
                averageDurationMs: 0,
                lastSyncAt: null,
            };
        }
    }
    
    /**
     * Clean up old sync history records
     * @param dataSourceId - Data source ID (optional, cleans all if not provided)
     * @param daysToKeep - Number of days of history to keep (default 90)
     * @returns Number of records deleted
     */
    public async cleanupOldRecords(dataSourceId?: number, daysToKeep: number = 90): Promise<number> {
        try {
            const dataSource = await this.getDataSource();
            const syncHistoryRepo = dataSource.getRepository(SyncHistory);
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const queryBuilder = syncHistoryRepo
                .createQueryBuilder()
                .delete()
                .where('started_at < :cutoffDate', { cutoffDate });
            
            if (dataSourceId) {
                queryBuilder.andWhere('data_source_id = :dataSourceId', { dataSourceId });
            }
            
            const result = await queryBuilder.execute();
            const deletedCount = result.affected || 0;
            
            console.log(`🧹 Cleaned up ${deletedCount} old sync history records`);
            
            return deletedCount;
        } catch (error) {
            console.error('❌ Failed to cleanup old sync records:', error);
            return 0;
        }
    }
}
