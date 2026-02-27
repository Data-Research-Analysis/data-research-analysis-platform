import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { KlaviyoService } from '../services/KlaviyoService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';

/**
 * Klaviyo Driver
 * Owns SyncHistoryService and data sync logic for Klaviyo Email Marketing.
 * The Processor delegates syncToDatabase() here and handles
 * model persistence (last_sync) after the call returns.
 */
export class KlaviyoDriver implements IAPIDriver {
    private static instance: KlaviyoDriver;
    private readonly klaviyoService: KlaviyoService;
    private readonly syncHistoryService: SyncHistoryService;

    private constructor() {
        this.klaviyoService = KlaviyoService.getInstance();
        this.syncHistoryService = SyncHistoryService.getInstance();
    }

    public static getInstance(): KlaviyoDriver {
        if (!KlaviyoDriver.instance) {
            KlaviyoDriver.instance = new KlaviyoDriver();
        }
        return KlaviyoDriver.instance;
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — authenticate
    // -------------------------------------------------------------------------

    public async authenticate(connectionDetails: IAPIConnectionDetails): Promise<boolean> {
        try {
            const apiKey = connectionDetails.api_config?.klaviyo_api_key;
            if (!apiKey) {
                console.warn('⚠️ [Klaviyo] No API key found in connection details.');
                return false;
            }
            return true;
        } catch (error) {
            console.error('❌ [Klaviyo] Authentication check failed:', error);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — syncToDatabase
    // -------------------------------------------------------------------------

    public async syncToDatabase(
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        console.log(`\n${'═'.repeat(55)}`);
        console.log(`🔄 Starting Klaviyo Sync for Data Source ID: ${dataSourceId}`);
        console.log(`${'═'.repeat(55)}\n`);

        const apiKey = connectionDetails.api_config?.klaviyo_api_key;
        if (!apiKey) {
            console.error('❌ [Klaviyo] API key not found in connection details');
            return false;
        }

        const syncRecord = await this.syncHistoryService.createSyncRecord(dataSourceId);
        await this.syncHistoryService.markAsRunning(syncRecord.id);

        try {
            const result = await this.klaviyoService.syncAll(
                dataSourceId,
                usersPlatformId,
                apiKey
            );

            await this.syncHistoryService.completeSyncRecord(syncRecord.id, result.campaigns || 0, 0);

            console.log(`\n${'═'.repeat(55)}`);
            console.log(`✅ Klaviyo Sync Completed: ${result.campaigns} campaigns`);
            console.log(`${'═'.repeat(55)}\n`);

            return true;
        } catch (error: any) {
            console.error(`\n❌ Klaviyo Sync Failed:`, error);
            await this.syncHistoryService.markAsFailed(syncRecord.id, error.message || 'Sync failed');
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — getSchema (schema introspection handled by SchemaCollectorService)
    // -------------------------------------------------------------------------

    public async getSchema(_dataSourceId: number, _connectionDetails: IAPIConnectionDetails): Promise<any> {
        return null;
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — sync history helpers
    // -------------------------------------------------------------------------

    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        const lastSync = await this.syncHistoryService.getLastSync(dataSourceId);
        return lastSync?.completedAt || null;
    }

    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        return this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }
}
