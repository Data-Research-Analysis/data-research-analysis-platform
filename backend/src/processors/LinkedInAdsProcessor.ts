import { DBDriver } from "../drivers/DBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { IAPIConnectionDetails } from "../types/IAPIConnectionDetails.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";

export class LinkedInAdsProcessor {
    private static instance: LinkedInAdsProcessor;
    private constructor() { }

    public static getInstance(): LinkedInAdsProcessor {
        if (!LinkedInAdsProcessor.instance) {
            LinkedInAdsProcessor.instance = new LinkedInAdsProcessor();
        }
        return LinkedInAdsProcessor.instance;
    }

    public async addLinkedInAdsDataSource(
        name: string,
        connectionDetails: IAPIConnectionDetails,
        tokenDetails: ITokenDetails,
        projectId: number
    ): Promise<number | null> {
        return new Promise<number | null>(async (resolve, _reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return resolve(null);
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            if (!manager) return resolve(null);
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) return resolve(null);
            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { id: projectId, users_platform: user } });
            if (!project) return resolve(null);

            const schemaName = 'dra_linkedin_ads';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

            const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
            const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
            const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
            const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
            const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

            const hybridConnection: IDBConnectionDetails = {
                data_source_type: EDataSourceType.LINKEDIN_ADS,
                host, port: parseInt(port), schema: schemaName,
                database, username, password,
                api_connection_details: connectionDetails,
            };

            const dataSource = new DRADataSource();
            dataSource.name = name;
            dataSource.connection_details = hybridConnection;
            dataSource.data_type = EDataSourceType.LINKEDIN_ADS;
            dataSource.project = project;
            dataSource.users_platform = user;
            dataSource.created_at = new Date();
            const saved = await manager.save(dataSource);
            console.log('✅ LinkedIn Ads data source added successfully with ID:', saved.id);
            return resolve(saved.id);
        });
    }

    public async syncLinkedInAdsDataSource(
        dataSourceId: number,
        user_id: number
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, _reject) => {
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncLinkedInAdsDataSource] Invalid data source ID:', dataSourceId);
                return resolve(false);
            }
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return resolve(false);
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) return resolve(false);
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) return resolve(false);

            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.LINKEDIN_ADS },
            });
            if (!dataSource) { console.error('[syncLinkedInAdsDataSource] Data source not found'); return resolve(false); }

            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('[syncLinkedInAdsDataSource] API connection details not found');
                return resolve(false);
            }
            const apiConnectionDetails = connection.api_connection_details;

            const { LinkedInAdsDriver } = await import('../drivers/LinkedInAdsDriver.js');
            const linkedInDriver = LinkedInAdsDriver.getInstance();
            const syncResult = await linkedInDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);

            if (syncResult) {
                apiConnectionDetails.api_config.last_sync = new Date();
                connection.api_connection_details = apiConnectionDetails;
                dataSource.connection_details = connection;
                await manager.save(dataSource);
            }
            return resolve(syncResult);
        });
    }

    public async getLinkedInOAuthUrl(state: string): Promise<{ configured: boolean; authUrl?: string }> {
        const { LinkedInOAuthService } = await import('../services/LinkedInOAuthService.js');
        const svc = LinkedInOAuthService.getInstance();
        if (!svc.isConfigured()) return { configured: false };
        return { configured: true, authUrl: svc.generateAuthorizationUrl(state) };
    }

    public async exchangeLinkedInCode(code: string): Promise<any> {
        const { LinkedInOAuthService } = await import('../services/LinkedInOAuthService.js');
        return LinkedInOAuthService.getInstance().exchangeCodeForToken(code);
    }

    public async listLinkedInAdsAccounts(accessToken: string): Promise<any[]> {
        const { LinkedInAdsService } = await import('../services/LinkedInAdsService.js');
        return LinkedInAdsService.getInstance().listAdAccounts(accessToken);
    }

    public async addLinkedInAdsDataSourceFromParams(
        name: string,
        accessToken: string,
        refreshToken: string,
        expiresAt: number,
        adAccountId: number,
        adAccountName: string,
        projectId: number,
        startDate: string,
        endDate: string,
        tokenDetails: ITokenDetails
    ): Promise<number | null> {
        const apiConnectionDetails: IAPIConnectionDetails = {
            oauth_access_token: accessToken,
            oauth_refresh_token: refreshToken || '',
            token_expiry: new Date(expiresAt),
            api_config: {
                linkedin_ads_account_id: Number(adAccountId),
                linkedin_ads_account_name: adAccountName || '',
                linkedin_ads_token_expires_at: expiresAt,
                linkedin_ads_refresh_token: refreshToken || '',
                start_date: startDate,
                end_date: endDate,
            },
        };
        return this.addLinkedInAdsDataSource(name, apiConnectionDetails, tokenDetails, projectId);
    }

    public async getLinkedInAdsSyncStatus(dataSourceId: number): Promise<{ lastSyncTime: any; syncHistory: any[] }> {
        const { LinkedInAdsDriver } = await import('../drivers/LinkedInAdsDriver.js');
        const driver = LinkedInAdsDriver.getInstance();
        const lastSyncTime = await driver.getLastSyncTime(dataSourceId);
        const syncHistory = await driver.getSyncHistory(dataSourceId, 10);
        return { lastSyncTime, syncHistory };
    }
}
