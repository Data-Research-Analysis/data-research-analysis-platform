import { DBDriver } from "../drivers/DBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { IAPIConnectionDetails } from "../types/IAPIConnectionDetails.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";

export class GoogleAdsProcessor {
    private static instance: GoogleAdsProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
    private constructor() { }

    public static getInstance(): GoogleAdsProcessor {
        if (!GoogleAdsProcessor.instance) {
            GoogleAdsProcessor.instance = new GoogleAdsProcessor();
        }
        return GoogleAdsProcessor.instance;
    }

    public async addGoogleAdsDataSource(
        user_id: number,
        syncConfig: any
    ): Promise<number | null> {
        return new Promise<number | null>(async (resolve, _reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return resolve(null);
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            if (!manager) return resolve(null);
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) return resolve(null);

            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { users_platform: user } });
            if (!project) return resolve(null);

            const schemaName = 'dra_google_ads';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

            const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
            const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
            const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
            const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
            const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

            const apiConnectionDetails: IAPIConnectionDetails = {
                oauth_access_token: syncConfig.accessToken,
                oauth_refresh_token: syncConfig.refreshToken,
                token_expiry: new Date(Date.now() + 3600 * 1000),
                api_config: {
                    customer_id: syncConfig.customerId,
                    manager_customer_id: syncConfig.managerCustomerId,
                    report_types: syncConfig.reportTypes || ['campaign'],
                    start_date: syncConfig.startDate,
                    end_date: syncConfig.endDate,
                },
            };

            const hybridConnection: IDBConnectionDetails = {
                data_source_type: EDataSourceType.GOOGLE_ADS,
                host, port: parseInt(port), schema: schemaName,
                database, username, password,
                api_connection_details: apiConnectionDetails,
            };

            const dataSource = new DRADataSource();
            dataSource.name = syncConfig.name;
            dataSource.connection_details = hybridConnection;
            dataSource.data_type = EDataSourceType.GOOGLE_ADS;
            dataSource.project = project;
            dataSource.users_platform = user;
            dataSource.created_at = new Date();
            const saved = await manager.save(dataSource);
            console.log('✅ Google Ads data source added successfully with ID:', saved.id);
            return resolve(saved.id);
        });
    }

    public async syncGoogleAdsDataSource(
        dataSourceId: number,
        user_id: number
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, _reject) => {
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncGoogleAdsDataSource] Invalid data source ID:', dataSourceId);
                return resolve(false);
            }
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return resolve(false);
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) return resolve(false);
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) return resolve(false);

            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.GOOGLE_ADS },
            });
            if (!dataSource) { console.error('Data source not found or not a Google Ads source'); return resolve(false); }

            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('API connection details not found in data source');
                return resolve(false);
            }
            const apiConnectionDetails = connection.api_connection_details;

            const { GoogleAdsDriver } = await import('../drivers/GoogleAdsDriver.js');
            const adsDriver = GoogleAdsDriver.getInstance();
            const syncResult = await adsDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);

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

    public async listGoogleAdsAccounts(accessToken: string): Promise<any[]> {
        const { GoogleAdsService } = await import('../services/GoogleAdsService.js');
        return GoogleAdsService.getInstance().listAccounts(accessToken);
    }

    public async getGoogleAdsSyncStatus(dataSourceId: number): Promise<{ status: any; history: any[] }> {
        const { GoogleAdsDriver } = await import('../drivers/GoogleAdsDriver.js');
        const adsDriver = GoogleAdsDriver.getInstance();
        const history = await adsDriver.getSyncHistory(dataSourceId, 10);
        const lastSync = history[0];
        const status = {
            lastSyncTime: lastSync?.completed_at || null,
            status: lastSync?.status || 'IDLE',
            recordsSynced: lastSync?.records_synced || 0,
            recordsFailed: lastSync?.records_failed || 0,
            error: lastSync?.error_message || undefined,
        };
        return { status, history };
    }
}
