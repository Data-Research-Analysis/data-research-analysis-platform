import { DBDriver } from "../drivers/DBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { IAPIConnectionDetails } from "../types/IAPIConnectionDetails.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";

export class MetaAdsProcessor {
    private static instance: MetaAdsProcessor;
    private constructor() { }

    public static getInstance(): MetaAdsProcessor {
        if (!MetaAdsProcessor.instance) {
            MetaAdsProcessor.instance = new MetaAdsProcessor();
        }
        return MetaAdsProcessor.instance;
    }

    public async addMetaAdsDataSource(
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

            const schemaName = 'dra_meta_ads';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

            const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
            const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
            const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
            const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
            const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

            const hybridConnection: IDBConnectionDetails = {
                data_source_type: EDataSourceType.META_ADS,
                host, port: parseInt(port), schema: schemaName,
                database, username, password,
                api_connection_details: connectionDetails,
            };

            const dataSource = new DRADataSource();
            dataSource.name = name;
            dataSource.connection_details = hybridConnection;
            dataSource.data_type = EDataSourceType.META_ADS;
            dataSource.project = project;
            dataSource.users_platform = user;
            dataSource.created_at = new Date();
            const saved = await manager.save(dataSource);
            console.log('✅ Meta Ads data source added successfully with ID:', saved.id);
            return resolve(saved.id);
        });
    }

    public async syncMetaAdsDataSource(
        dataSourceId: number,
        user_id: number
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, _reject) => {
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncMetaAdsDataSource] Invalid data source ID:', dataSourceId);
                return resolve(false);
            }
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return resolve(false);
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) return resolve(false);
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) return resolve(false);

            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.META_ADS },
            });
            if (!dataSource) { console.error('Data source not found or not a Meta Ads source'); return resolve(false); }

            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('API connection details not found in data source');
                return resolve(false);
            }
            const apiConnectionDetails = connection.api_connection_details;

            const { MetaAdsDriver } = await import('../drivers/MetaAdsDriver.js');
            const metaAdsDriver = MetaAdsDriver.getInstance();
            const syncResult = await metaAdsDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);

            if (syncResult) {
                apiConnectionDetails.api_config.last_sync = new Date();
                connection.api_connection_details = apiConnectionDetails;
                dataSource.connection_details = connection;
                await manager.save(dataSource);
            }
            return resolve(syncResult);
        });
    }

    public async getMetaOAuthUrl(state: string): Promise<string> {
        const { MetaOAuthService } = await import('../services/MetaOAuthService.js');
        return MetaOAuthService.getInstance().getAuthorizationURL(state);
    }

    public async exchangeMetaCode(code: string): Promise<{ access_token: string; token_type: string; expires_in: number; token_info: any }> {
        const { MetaOAuthService } = await import('../services/MetaOAuthService.js');
        const svc = MetaOAuthService.getInstance();
        const shortLived = await svc.exchangeCodeForToken(code);
        const longLived = await svc.getLongLivedToken(shortLived.access_token);
        const token_info = await svc.validateToken(longLived.access_token);
        return { access_token: longLived.access_token, token_type: longLived.token_type, expires_in: longLived.expires_in, token_info };
    }

    public async listMetaAdsAccounts(accessToken: string): Promise<any[]> {
        const { MetaAdsService } = await import('../services/MetaAdsService.js');
        const accounts = await MetaAdsService.getInstance().listAdAccounts(accessToken);
        return accounts.filter((a: any) => a.account_status === 1);
    }

    public async addMetaAdsDataSourceFromParams(
        name: string,
        accessToken: string,
        adAccountId: string,
        syncTypes: string[],
        startDate: string,
        endDate: string,
        tokenDetails: ITokenDetails,
        projectId: number
    ): Promise<number | null> {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 60);
        const apiConnectionDetails: IAPIConnectionDetails = {
            oauth_access_token: accessToken,
            oauth_refresh_token: '',
            token_expiry: expiryDate,
            api_config: {
                ad_account_id: adAccountId,
                report_types: syncTypes || ['campaigns', 'adsets', 'ads', 'insights'],
                start_date: startDate,
                end_date: endDate,
            },
        };
        return this.addMetaAdsDataSource(name, apiConnectionDetails, tokenDetails, projectId);
    }

    public async getMetaAdsSyncStatus(dataSourceId: number): Promise<{ lastSyncTime: any; syncHistory: any[] }> {
        const { MetaAdsDriver } = await import('../drivers/MetaAdsDriver.js');
        const driver = MetaAdsDriver.getInstance();
        const lastSyncTime = await driver.getLastSyncTime(dataSourceId);
        const syncHistory = await driver.getSyncHistory(dataSourceId, 10);
        return { lastSyncTime, syncHistory };
    }
}
