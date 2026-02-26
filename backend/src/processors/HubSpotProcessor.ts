import { DBDriver } from '../drivers/DBDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { ITokenDetails } from '../types/ITokenDetails.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { UtilityService } from '../services/UtilityService.js';
import { HubSpotOAuthService } from '../services/HubSpotOAuthService.js';
import { HubSpotService } from '../services/HubSpotService.js';

export class HubSpotProcessor {
    private static instance: HubSpotProcessor;

    private constructor() {}

    public static getInstance(): HubSpotProcessor {
        if (!HubSpotProcessor.instance) {
            HubSpotProcessor.instance = new HubSpotProcessor();
        }
        return HubSpotProcessor.instance;
    }

    // -------------------------------------------------------------------------
    // OAuth helpers
    // -------------------------------------------------------------------------

    public getOAuthUrl(state: string): { configured: boolean; authUrl?: string } {
        const svc = HubSpotOAuthService.getInstance();
        if (!svc.isConfigured()) return { configured: false };
        return { configured: true, authUrl: svc.generateAuthorizationUrl(state) };
    }

    public async exchangeCode(code: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: number;
        portal_id?: string;
    }> {
        return HubSpotOAuthService.getInstance().exchangeCodeForTokens(code);
    }

    // -------------------------------------------------------------------------
    // Add data source
    // -------------------------------------------------------------------------

    public async addDataSource(
        name: string,
        accessToken: string,
        refreshToken: string,
        expiresAt: number,
        portalId: string,
        projectId: number,
        tokenDetails: ITokenDetails
    ): Promise<number | null> {
        const { user_id } = tokenDetails;
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return null;

        const dbConnector = await driver.getConcreteDriver();
        const manager = dbConnector.manager;
        if (!manager) return null;

        const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
        if (!user) return null;

        const project = await manager.findOne(DRAProject, {
            where: { id: projectId, users_platform: user },
        });
        if (!project) return null;

        const schemaName = 'dra_hubspot';
        await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

        const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
        const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
        const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
        const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
        const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

        const apiConnectionDetails: IAPIConnectionDetails = {
            oauth_access_token: accessToken,
            oauth_refresh_token: refreshToken,
            token_expiry: new Date(expiresAt),
            api_config: {
                hubspot_portal_id: portalId,
                hubspot_token_expires_at: expiresAt,
            },
        };

        const hybridConnection: IDBConnectionDetails = {
            data_source_type: EDataSourceType.HUBSPOT,
            host,
            port: parseInt(port),
            schema: schemaName,
            database,
            username,
            password,
            api_connection_details: apiConnectionDetails,
        };

        const dataSource = new DRADataSource();
        dataSource.name = name;
        dataSource.connection_details = hybridConnection;
        dataSource.data_type = EDataSourceType.HUBSPOT;
        dataSource.project = project;
        dataSource.users_platform = user;
        dataSource.classification = 'marketing_campaign_data';
        dataSource.created_at = new Date();

        const saved = await manager.save(dataSource);
        console.log(`✅ [HubSpot] Data source added with ID: ${saved.id}`);
        return saved.id;
    }

    // -------------------------------------------------------------------------
    // Sync
    // -------------------------------------------------------------------------

    public async syncDataSource(dataSourceId: number, userId: number): Promise<boolean> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return false;

            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
            if (!user) return false;

            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.HUBSPOT },
            });
            if (!dataSource) return false;

            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) return false;

            const apiDetails = connection.api_connection_details;

            const result = await HubSpotService.getInstance().syncAll(dataSourceId, apiDetails);

            // Persist refreshed tokens
            const refreshed = await HubSpotOAuthService.getInstance().ensureValidToken(apiDetails);
            if (refreshed !== apiDetails) {
                connection.api_connection_details = refreshed;
                dataSource.connection_details = connection;
                await manager.save(dataSource);
            }

            console.log(
                `✅ [HubSpot] Sync complete for datasource ${dataSourceId}: ` +
                `${result.contacts} contacts, ${result.deals} deals`
            );
            return true;
        } catch (err) {
            console.error(`❌ [HubSpot] Sync failed for datasource ${dataSourceId}:`, err);
            return false;
        }
    }
}
