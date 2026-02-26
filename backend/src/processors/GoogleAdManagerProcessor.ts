import { DBDriver } from "../drivers/DBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { IAPIConnectionDetails } from "../types/IAPIConnectionDetails.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";
import { GoogleAdManagerDriver } from "../drivers/GoogleAdManagerDriver.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";

export class GoogleAdManagerProcessor {
    private static instance: GoogleAdManagerProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
    private constructor() { }

    public static getInstance(): GoogleAdManagerProcessor {
        if (!GoogleAdManagerProcessor.instance) {
            GoogleAdManagerProcessor.instance = new GoogleAdManagerProcessor();
        }
        return GoogleAdManagerProcessor.instance;
    }

    public async addGoogleAdManagerDataSource(
        name: string,
        connectionDetails: IAPIConnectionDetails,
        tokenDetails: ITokenDetails,
        projectId: number
    ): Promise<number | null> {
        return new Promise<number | null>(async (resolve, _reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return resolve(null);
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            if (!manager) return resolve(null);
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) return resolve(null);
            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { id: projectId, users_platform: user } });
            if (!project) return resolve(null);

            const schemaName = 'dra_google_ad_manager';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

            const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
            const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
            const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
            const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
            const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

            const hybridConnection: IDBConnectionDetails = {
                data_source_type: EDataSourceType.GOOGLE_AD_MANAGER,
                host, port: parseInt(port), schema: schemaName,
                database, username, password,
                api_connection_details: connectionDetails,
            };

            const dataSource = new DRADataSource();
            dataSource.name = name;
            dataSource.connection_details = hybridConnection;
            dataSource.data_type = EDataSourceType.GOOGLE_AD_MANAGER;
            dataSource.project = project;
            dataSource.users_platform = user;
            dataSource.created_at = new Date();
            const saved = await manager.save(dataSource);
            console.log('✅ Google Ad Manager data source added successfully with ID:', saved.id);
            return resolve(saved.id);
        });
    }

    public async syncGoogleAdManagerDataSource(
        dataSourceId: number,
        tokenDetails: ITokenDetails
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, _reject) => {
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncGoogleAdManagerDataSource] Invalid data source ID:', dataSourceId);
                return resolve(false);
            }
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return resolve(false);
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) return resolve(false);
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) return resolve(false);

            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.GOOGLE_AD_MANAGER },
            });
            if (!dataSource) { console.error('Data source not found or not a Google Ad Manager source'); return resolve(false); }

            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('API connection details not found in data source');
                return resolve(false);
            }
            const apiConnectionDetails = connection.api_connection_details;

            const gamDriver = GoogleAdManagerDriver.getInstance();
            const syncResult = await gamDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);
            console.log('📊 [GAM Sync] Sync result for data source ID', dataSourceId, ':', syncResult);

            if (syncResult) {
                apiConnectionDetails.api_config.last_sync = new Date();
                connection.api_connection_details = apiConnectionDetails;
                dataSource.connection_details = connection;
                await manager.save(dataSource);
                await this.notificationHelper.notifyDataSourceSyncComplete(user_id, dataSourceId, dataSource.name, 0);
            } else {
                await this.notificationHelper.notifyDataSourceSyncFailed(user_id, dataSourceId, dataSource.name, 'Sync operation failed');
            }
            return resolve(syncResult);
        });
    }

    public async listGAMNetworks(accessToken: string): Promise<any[]> {
        const { GoogleAdManagerService } = await import('../services/GoogleAdManagerService.js');
        return GoogleAdManagerService.getInstance().listNetworks(accessToken);
    }

    public async getGAMSyncStatus(dataSourceId: number): Promise<{ lastSync: any; history: any[] }> {
        const { GoogleAdManagerDriver: GAMDriver } = await import('../drivers/GoogleAdManagerDriver.js');
        const gamDriver = GAMDriver.getInstance();
        const lastSync = await gamDriver.getLastSyncTime(dataSourceId);
        const rawHistory = await gamDriver.getSyncHistory(dataSourceId, 10);
        const history = rawHistory.map((record: any) => ({
            id: record.id,
            sync_started_at: record.startedAt,
            sync_completed_at: record.completedAt,
            status: record.status?.toLowerCase() || 'idle',
            rows_synced: record.recordsSynced,
            error_message: record.errorMessage,
        }));
        return { lastSync, history };
    }

    public async getGAMRateLimitStatus(): Promise<{ status: any; stats: any }> {
        const { GoogleAdManagerService } = await import('../services/GoogleAdManagerService.js');
        const svc = GoogleAdManagerService.getInstance();
        return { status: svc.getRateLimitStatus(), stats: svc.getRateLimitStats() };
    }

    public async addGAMDataSourceFromParams(
        name: string,
        networkCode: string,
        networkId: string,
        networkName: string | undefined,
        accessToken: string,
        refreshToken: string,
        tokenExpiry: string,
        projectId: number,
        reportTypes: string[],
        startDate: string | undefined,
        endDate: string | undefined,
        syncFrequency: string | undefined,
        tokenDetails: ITokenDetails
    ): Promise<number | null> {
        const connectionDetails: IAPIConnectionDetails = {
            oauth_access_token: accessToken,
            oauth_refresh_token: refreshToken,
            token_expiry: new Date(tokenExpiry),
            api_config: {
                network_code: networkCode,
                network_id: networkId,
                network_name: networkName,
                report_types: reportTypes,
                start_date: startDate,
                end_date: endDate,
                sync_frequency: (syncFrequency as 'hourly' | 'daily' | 'weekly' | 'manual') || 'manual',
            },
        };
        return this.addGoogleAdManagerDataSource(name, connectionDetails, tokenDetails, projectId);
    }
}
