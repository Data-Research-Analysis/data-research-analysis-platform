import { DBDriver } from '../drivers/DBDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { ITokenDetails } from '../types/ITokenDetails.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { UtilityService } from '../services/UtilityService.js';
import { KlaviyoService } from '../services/KlaviyoService.js';
import { KlaviyoDriver } from '../drivers/KlaviyoDriver.js';

export class KlaviyoProcessor {
    private static instance: KlaviyoProcessor;

    private constructor() {}

    public static getInstance(): KlaviyoProcessor {
        if (!KlaviyoProcessor.instance) {
            KlaviyoProcessor.instance = new KlaviyoProcessor();
        }
        return KlaviyoProcessor.instance;
    }

    // -------------------------------------------------------------------------
    // Validate API key
    // -------------------------------------------------------------------------

    public async validateApiKey(apiKey: string): Promise<boolean> {
        return KlaviyoService.getInstance().validateApiKey(apiKey);
    }

    // -------------------------------------------------------------------------
    // Add data source
    // -------------------------------------------------------------------------

    public async addDataSource(
        name: string,
        apiKey: string,
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

        const schemaName = 'dra_klaviyo';
        await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

        const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
        const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
        const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
        const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
        const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

        // Store API key inside api_config (encrypted by ValueTransformer via connection_details)
        const apiConnectionDetails: IAPIConnectionDetails = {
            oauth_access_token: '',       // Klaviyo has no OAuth token
            oauth_refresh_token: '',
            token_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year (never expires)
            api_config: {
                klaviyo_api_key: apiKey,
            },
        };

        const hybridConnection: IDBConnectionDetails = {
            data_source_type: EDataSourceType.KLAVIYO,
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
        dataSource.data_type = EDataSourceType.KLAVIYO;
        dataSource.project = project;
        dataSource.users_platform = user;
        dataSource.classification = 'marketing_campaign_data';
        dataSource.created_at = new Date();

        const saved = await manager.save(dataSource);
        console.log(`✅ [Klaviyo] Data source added with ID: ${saved.id}`);
        return saved.id;
    }

    // -------------------------------------------------------------------------
    // Sync
    // -------------------------------------------------------------------------

    public async getKlaviyoSyncStatus(dataSourceId: number): Promise<{ lastSyncTime: Date | null; syncHistory: any[] }> {
        const driver = KlaviyoDriver.getInstance();
        const lastSyncTime = await driver.getLastSyncTime(dataSourceId);
        const syncHistory = await driver.getSyncHistory(dataSourceId, 10);
        return { lastSyncTime, syncHistory };
    }

    public async syncDataSource(dataSourceId: number, userId: number): Promise<boolean> {
        const dbDriver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!dbDriver) return false;

        const manager = (await dbDriver.getConcreteDriver()).manager;
        const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
        if (!user) return false;

        const dataSource = await manager.findOne(DRADataSource, {
            where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.KLAVIYO },
        });
        if (!dataSource) return false;

        const connection = dataSource.connection_details;
        if (!connection.api_connection_details) return false;

        const syncResult = await KlaviyoDriver.getInstance().syncToDatabase(dataSourceId, user.id, connection.api_connection_details);

        if (syncResult) {
            if (!connection.api_connection_details.api_config) {
                connection.api_connection_details.api_config = {};
            }
            connection.api_connection_details.api_config.last_sync = new Date();
            dataSource.connection_details = connection;
            await manager.save(dataSource);
        }

        return syncResult;
    }
}
