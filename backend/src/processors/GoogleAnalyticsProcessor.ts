import { DBDriver } from "../drivers/DBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { IAPIConnectionDetails } from "../types/IAPIConnectionDetails.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";
import { GoogleAnalyticsDriver } from "../drivers/GoogleAnalyticsDriver.js";
import { GoogleAnalyticsService } from "../services/GoogleAnalyticsService.js";
import { AppDataSource } from "../datasources/PostgresDS.js";
import { TableMetadataService } from "../services/TableMetadataService.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";

export class GoogleAnalyticsProcessor {
    private static instance: GoogleAnalyticsProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
    private constructor() { }

    public static getInstance(): GoogleAnalyticsProcessor {
        if (!GoogleAnalyticsProcessor.instance) {
            GoogleAnalyticsProcessor.instance = new GoogleAnalyticsProcessor();
        }
        return GoogleAnalyticsProcessor.instance;
    }

    public async addGoogleAnalyticsDataSource(
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

            const schemaName = 'dra_google_analytics';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

            const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
            const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
            const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
            const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
            const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

            const hybridConnection: IDBConnectionDetails = {
                data_source_type: EDataSourceType.GOOGLE_ANALYTICS,
                host, port: parseInt(port), schema: schemaName,
                database, username, password,
                api_connection_details: connectionDetails,
            };

            const dataSource = new DRADataSource();
            dataSource.name = name;
            dataSource.connection_details = hybridConnection;
            dataSource.data_type = EDataSourceType.GOOGLE_ANALYTICS;
            dataSource.project = project;
            dataSource.users_platform = user;
            dataSource.created_at = new Date();
            const saved = await manager.save(dataSource);
            console.log('✅ Google Analytics data source added successfully with ID:', saved.id);
            return resolve(saved.id);
        });
    }

    public async syncGoogleAnalyticsDataSource(
        dataSourceId: number,
        tokenDetails: ITokenDetails
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, _reject) => {
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncGoogleAnalyticsDataSource] Invalid data source ID:', dataSourceId);
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
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.GOOGLE_ANALYTICS },
            });
            if (!dataSource) { console.error('Data source not found or not a Google Analytics source'); return resolve(false); }

            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('API connection details not found in data source');
                return resolve(false);
            }
            const apiConnectionDetails = connection.api_connection_details;

            const gaDriver = GoogleAnalyticsDriver.getInstance();
            const syncResult = await gaDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);

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

    public async addGA4DataSource(
        name: string,
        propertyId: string,
        accessToken: string,
        refreshToken: string,
        tokenExpiry: string,
        projectId: number,
        tokenDetails: ITokenDetails,
        syncFrequency = 'manual',
        accountName?: string
    ): Promise<number | null> {
        const connectionDetails: IAPIConnectionDetails = {
            oauth_access_token: accessToken,
            oauth_refresh_token: refreshToken,
            token_expiry: new Date(tokenExpiry),
            api_config: {
                property_id: propertyId,
                account_name: accountName,
                sync_frequency: (syncFrequency as 'hourly' | 'daily' | 'weekly' | 'manual') || 'manual',
            },
        };
        return this.addGoogleAnalyticsDataSource(name, connectionDetails, tokenDetails, projectId);
    }

    public async listGA4Properties(accessToken: string): Promise<any[]> {
        return GoogleAnalyticsService.getInstance().listProperties(accessToken);
    }

    public async getGA4PropertyMetadata(
        propertyId: string,
        accessToken: string,
        refreshToken: string
    ): Promise<any> {
        const connectionDetails: IAPIConnectionDetails = {
            oauth_access_token: accessToken,
            oauth_refresh_token: refreshToken,
            token_expiry: new Date(Date.now() + 3_600_000),
            api_config: { property_id: propertyId },
        };
        return GoogleAnalyticsService.getInstance().getMetadata(propertyId, connectionDetails);
    }

    public getGA4ReportPresets(): any {
        return GoogleAnalyticsService.getReportPresets();
    }

    public async getGA4SyncStatus(
        dataSourceId: number
    ): Promise<{ lastSync: Date | null; history: any[] }> {
        const driver = GoogleAnalyticsDriver.getInstance();
        const lastSync = await driver.getLastSyncTime(dataSourceId);
        const rawHistory = await driver.getSyncHistory(dataSourceId, 10);
        const history = rawHistory.map((r: any) => ({
            id: r.id,
            sync_started_at: r.startedAt,
            sync_completed_at: r.completedAt,
            status: r.status?.toLowerCase() ?? 'idle',
            rows_synced: r.recordsSynced,
            error_message: r.errorMessage,
        }));
        return { lastSync, history };
    }

    public async getGA4SessionsSummary(
        projectId: number,
        startDate?: string,
        endDate?: string
    ): Promise<number | null> {
        const manager = AppDataSource.manager;
        const tmService = TableMetadataService.getInstance();

        const dataSources = await manager.find(DRADataSource, {
            where: { project_id: projectId, data_type: EDataSourceType.GOOGLE_ANALYTICS } as any,
        });
        if (!dataSources.length) return null;

        let total = 0;
        for (const ds of dataSources) {
            const physicalName = await tmService.getPhysicalTableName(manager, ds.id, 'traffic_overview');
            if (!physicalName) continue;

            const fullTable = `dra_google_analytics.${physicalName}`;
            const params: any[] = [];
            const where = startDate && endDate ? 'WHERE date >= $1 AND date <= $2' : '';
            if (startDate && endDate) params.push(startDate, endDate);

            const result = await manager.query(
                `SELECT COALESCE(SUM(sessions), 0) AS total_sessions FROM ${fullTable} ${where}`,
                params
            );
            total += parseInt(result[0]?.total_sessions ?? '0', 10);
        }
        return total;
    }
}
