import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { HubSpotService } from '../services/HubSpotService.js';
import { HubSpotOAuthService } from '../services/HubSpotOAuthService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';

/**
 * HubSpot Driver
 * Owns SyncHistoryService and data sync logic for HubSpot CRM.
 * The Processor delegates syncToDatabase() here and handles
 * model persistence (last_sync, token refresh) after the call returns.
 */
export class HubSpotDriver implements IAPIDriver {
    private static instance: HubSpotDriver;
    private readonly hubSpotService: HubSpotService;
    private readonly hubSpotOAuthService: HubSpotOAuthService;
    private readonly syncHistoryService: SyncHistoryService;

    private constructor() {
        this.hubSpotService = HubSpotService.getInstance();
        this.hubSpotOAuthService = HubSpotOAuthService.getInstance();
        this.syncHistoryService = SyncHistoryService.getInstance();
    }

    public static getInstance(): HubSpotDriver {
        if (!HubSpotDriver.instance) {
            HubSpotDriver.instance = new HubSpotDriver();
        }
        return HubSpotDriver.instance;
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — authenticate
    // -------------------------------------------------------------------------

    public async authenticate(connectionDetails: IAPIConnectionDetails): Promise<boolean> {
        try {
            if (connectionDetails.token_expiry) {
                const expired = new Date(connectionDetails.token_expiry).getTime() < Date.now();
                if (expired) {
                    console.warn('⚠️ [HubSpot] Access token expired.');
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error('❌ [HubSpot] Authentication check failed:', error);
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
        console.log(`🔄 Starting HubSpot Sync for Data Source ID: ${dataSourceId}`);
        console.log(`${'═'.repeat(55)}\n`);

        const syncRecord = await this.syncHistoryService.createSyncRecord(dataSourceId);
        await this.syncHistoryService.markAsRunning(syncRecord.id);

        try {
            const result = await this.hubSpotService.syncAll(
                dataSourceId,
                usersPlatformId,
                connectionDetails
            );

            const totalRecords = (result.contacts || 0) + (result.deals || 0);
            await this.syncHistoryService.completeSyncRecord(syncRecord.id, totalRecords, 0);

            console.log(`\n${'═'.repeat(55)}`);
            console.log(`✅ HubSpot Sync Completed: ${result.contacts} contacts, ${result.deals} deals`);
            console.log(`${'═'.repeat(55)}\n`);

            return true;
        } catch (error: any) {
            console.error(`\n❌ HubSpot Sync Failed:`, error);
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
