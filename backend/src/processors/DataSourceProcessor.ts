import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { IAPIConnectionDetails } from "../types/IAPIConnectionDetails.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAProjectMember } from "../models/DRAProjectMember.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADataModelSource } from "../models/DRADataModelSource.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { DataSource } from "typeorm";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";
import { IDataSourceReturn } from "../types/IDataSourceReturn.js";
import { IPDFDataSourceReturn } from "../types/IPDFDataSourceReturn.js";
import { IExcelDataSourceReturn } from "../types/IExcelDataSourceReturn.js";
import { FilesService } from "../services/FilesService.js";
import { QueueService } from "../services/QueueService.js";
import { FederatedQueryService } from "../services/FederatedQueryService.js";
import { TableMetadataService } from "../services/TableMetadataService.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import { SchemaCollectorService } from "../services/SchemaCollectorService.js";
import { ExcelFileService } from "../services/ExcelFileService.js";
import { DataSourceSQLHelpers } from './helpers/DataSourceSQLHelpers.js';
export class DataSourceProcessor {
    private static instance: DataSourceProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
    private constructor() { }

    public static getInstance(): DataSourceProcessor {
        if (!DataSourceProcessor.instance) {
            DataSourceProcessor.instance = new DataSourceProcessor();
        }
        return DataSourceProcessor.instance;
    }

    /**
     * Get data source by ID
     * @param dataSourceId - Data source ID
     * @returns Data source or null if not found
     */
    public async getDataSourceById(dataSourceId: number): Promise<DRADataSource | null> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            return null;
        }
        const manager = (await driver.getConcreteDriver()).manager;
        if (!manager) {
            return null;
        }
        
        return await manager.findOne(DRADataSource, { 
            where: { id: dataSourceId }
        });
    }




    async getDataSources(tokenDetails: ITokenDetails): Promise<any[]> {
        return new Promise<any[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve([]);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve([]);
            }

            // 1. Get owned data sources
            const ownedDataSources = await manager.find(DRADataSource, {
                where: { users_platform: user },
                relations: {
                    project: true,
                    data_models: true
                }
            });

            // 2. Get data sources from projects where user is a member
            const memberProjects = await manager.find(DRAProjectMember, {
                where: { user: { id: user_id } },
                relations: {
                    project: {
                        data_sources: {
                            data_models: true,
                            project: true
                        }
                    }
                }
            });

            const memberDataSources = memberProjects.flatMap(m => m.project?.data_sources || []);

            // 3. Combine and deduplicate
            const allDataSourcesMap = new Map();

            ownedDataSources.forEach(ds => {
                allDataSourcesMap.set(ds.id, ds);
            });

            memberDataSources.forEach(ds => {
                if (!allDataSourcesMap.has(ds.id)) {
                    allDataSourcesMap.set(ds.id, ds);
                }
            });

            const dataSources = Array.from(allDataSourcesMap.values());

            // Transform to include counts
            const dataSourcesWithCounts = dataSources.map(ds => ({
                ...ds,
                data_models_count: ds.data_models?.length || 0,
                DataModels: ds.data_models  // Backward compatibility
            }));

            return resolve(dataSourcesWithCounts);
        });
    }

    /**
     * Get all data sources for a specific project
     * Used for cross-data-source feature to fetch all tables across sources
     */
    async getDataSourcesByProject(projectId: number, tokenDetails: ITokenDetails): Promise<DRADataSource[]> {
        return new Promise<DRADataSource[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve([]);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve([]);
            }
            const project = await manager.findOne(DRAProject, {
                where: { id: projectId, users_platform: user }
            });
            if (!project) {
                return resolve([]);
            }
            const dataSources = await manager.find(DRADataSource, {
                where: { project: project, users_platform: user },
                relations: ['project']
            });
            return resolve(dataSources);
        });
    }

    public async connectToDataSource(connection: IDBConnectionDetails): Promise<DataSource> {
        return new Promise<DataSource>(async (resolve, reject) => {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(null);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
            if (!externalDriver) {
                return resolve(null);
            }
            let dbConnector: DataSource;
            try {
                dbConnector = await externalDriver.connectExternalDB(connection);
                if (!dbConnector) {
                    return resolve(null);
                }
                return resolve(dbConnector);
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return resolve(null);
            }
        });
    }

    public async addDataSource(connection: IDBConnectionDetails, tokenDetails: ITokenDetails, projectId: number): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(false);
            }
            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { id: projectId, users_platform: user } });
            if (project) {
                const dataSource = new DRADataSource();
                dataSource.name = connection.database;
                dataSource.connection_details = connection;
                dataSource.data_type = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                dataSource.project = project;
                dataSource.users_platform = user;
                
                // Store connection_string separately if provided (for MongoDB)
                if (connection.connection_string) {
                    dataSource.connection_string = connection.connection_string;
                }

                // Set classification: auto-classify advertising platform sources
                const autoClassifiedTypes = [
                    'google_ads', 'meta_ads', 'linkedin_ads', 'google_analytics',
                    'google_ad_manager', 'tiktok_ads', 'hubspot', 'klaviyo',
                ];
                if (autoClassifiedTypes.includes(connection.data_source_type as string)) {
                    dataSource.classification = 'marketing_campaign_data';
                } else {
                    dataSource.classification = connection.classification || null;
                }
                
                const savedDataSource = await manager.save(dataSource);

                // Send notification
                await this.notificationHelper.notifyDataSourceCreated(
                    user_id,
                    savedDataSource.id,
                    savedDataSource.name,
                    connection.data_source_type
                );

                // For MongoDB, trigger initial import (async, non-blocking)
                if (connection.data_source_type === 'mongodb' && connection.connection_string) {
                    try {
                        const QueueService = (await import('../services/QueueService.js')).QueueService;
                        QueueService.getInstance().addJob('mongodb-import', {
                            dataSourceId: savedDataSource.id,
                            syncType: 'full'
                        });
                        console.log(`[DataSourceProcessor] Queued MongoDB import for data source ${savedDataSource.id}`);
                    } catch (error) {
                        console.error('[DataSourceProcessor] Failed to queue MongoDB import:', error);
                        // Don't fail data source creation if import queueing fails
                    }
                }

                return resolve(true);
            }
            return resolve(false);
        });
    }

    public async updateDataSource(dataSourceId: number, connection: IDBConnectionDetails, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }

            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(false);
            }

            // Find existing data source owned by user
            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user }
            });

            if (!dataSource) {
                return resolve(false);
            }

            // Test new connection before updating
            try {
                const testConnection = await this.connectToDataSource(connection);
                if (!testConnection) {
                    console.error('Failed to connect with new credentials');
                    return resolve(false);
                }
            } catch (error) {
                console.error('Failed to connect with new credentials:', error);
                return resolve(false);
            }

            // Update connection details (will be auto-encrypted by transformer)
            dataSource.connection_details = connection;
            dataSource.name = connection.database;
            dataSource.data_type = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            
            // Update connection_string if provided (for MongoDB)
            if (connection.connection_string) {
                dataSource.connection_string = connection.connection_string;
            } else {
                // Clear connection_string if not provided (switching from connection string to individual fields)
                dataSource.connection_string = null;
            }

            await manager.save(dataSource);
            return resolve(true);
        });
    }

    /**
     * Update only the classification field of a data source.
     * Can be called for any source type.
     */
    public async updateDataSourceClassification(dataSourceId: number, classification: string | null, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const { user_id } = tokenDetails;
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) return resolve(false);
                const manager = (await driver.getConcreteDriver()).manager;
                if (!manager) return resolve(false);
                const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
                if (!user) return resolve(false);
                const dataSource = await manager.findOne(DRADataSource, {
                    where: { id: dataSourceId }
                });
                if (!dataSource) return resolve(false);
                dataSource.classification = classification;
                await manager.save(dataSource);
                return resolve(true);
            } catch (error) {
                console.error('[DataSourceProcessor] updateDataSourceClassification error:', error);
                return resolve(false);
            }
        });
    }

    public async deleteDataSource(dataSourceId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const { user_id } = tokenDetails;
                let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) {
                    return resolve(false);
                }
                const manager = (await driver.getConcreteDriver()).manager;
                const dbConnector = await driver.getConcreteDriver();
                const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
                if (!user) {
                    return resolve(false);
                }
                const dataSource: DRADataSource | null = await manager.findOne(DRADataSource, { where: { id: dataSourceId, users_platform: user }, relations: ['data_models'] });
                if (!dataSource) {
                    return resolve(false);
                }

                // Get all data models for this data source
                const dataModels = dataSource.data_models;

                console.log(`Found ${dataModels.length} data models to delete`);

                // For each data model, drop physical table and clean dashboard references
                for (const dataModel of dataModels) {
                    try {
                        // Drop the physical data model table
                        await dbConnector.query(
                            `DROP TABLE IF EXISTS ${dataModel.schema}.${dataModel.name}`
                        );
                    } catch (error) {
                        console.error(`Error deleting physical data model ${dataModel.schema}.${dataModel.name}:`, error);
                    }
                }
                // Delete Excel schema tables
                if ('schema' in dataSource.connection_details && dataSource.connection_details.schema === 'dra_excel') {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_excel' AND table_name LIKE 'ds${dataSource.id}_%'`;
                        const tables = await dbConnector.query(query);
                        console.log(`Found ${tables.length} Excel tables to delete for data source ${dataSource.id}`);

                        for (let i = 0; i < tables.length; i++) {
                            const tableName = tables[i].table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_excel.${tableName}`);
                            console.log(`Dropped Excel table: ${tableName}`);
                        }
                    } catch (error) {
                        console.error(`Error deleting Excel tables:`, error);
                    }
                }

                // Delete PDF schema tables
                if ('schema' in dataSource.connection_details && dataSource.connection_details.schema === 'dra_pdf') {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_pdf' AND table_name LIKE 'ds${dataSource.id}_%'`;
                        const tables = await dbConnector.query(query);
                        console.log(`Found ${tables.length} PDF tables to delete for data source ${dataSource.id}`);

                        for (let i = 0; i < tables.length; i++) {
                            const tableName = tables[i].table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_pdf.${tableName}`);
                            console.log(`Dropped PDF table: ${tableName}`);
                        }
                    } catch (error) {
                        console.error(`Error deleting PDF tables:`, error);
                    }
                }

                // Delete Google Analytics schema tables
                if ('schema' in dataSource.connection_details && dataSource.connection_details.schema === 'dra_google_analytics') {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_google_analytics' AND table_name LIKE 'ds${dataSource.id}_%'`;
                        const tables = await dbConnector.query(query);
                        console.log(`Found ${tables.length} Google Analytics tables to delete for data source ${dataSource.id}`);

                        for (let i = 0; i < tables.length; i++) {
                            const tableName = tables[i].table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_google_analytics.${tableName}`);
                            console.log(`Dropped Google Analytics table: ${tableName}`);
                        }
                    } catch (error) {
                        console.error(`Error deleting Google Analytics tables:`, error);
                    }
                }

                // Delete Google Ad Manager schema tables
                if ('schema' in dataSource.connection_details && dataSource.connection_details.schema === 'dra_google_ad_manager') {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_google_ad_manager' AND table_name LIKE 'ds${dataSource.id}_%'`;
                        const tables = await dbConnector.query(query);

                        for (const table of tables) {
                            const tableName = table.table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_google_ad_manager.${tableName}`);
                            console.log('Dropped Google Ad Manager table:', tableName);
                        }
                    } catch (error) {
                        console.error('Error dropping Google Ad Manager tables:', error);
                    }
                }

                // Delete Google Ads schema tables
                if ('schema' in dataSource.connection_details && dataSource.connection_details.schema === 'dra_google_ads') {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_google_ads' AND table_name LIKE 'ds${dataSource.id}_%'`;
                        const tables = await dbConnector.query(query);

                        for (const table of tables) {
                            const tableName = table.table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_google_ads.${tableName}`);
                            console.log('Dropped Google Ads table:', tableName);
                        }
                    } catch (error) {
                        console.error('Error dropping Google Ads tables:', error);
                    }
                }

                // Delete Meta Ads schema tables
                if (dataSource.data_type === EDataSourceType.META_ADS) {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        // First drop tables tracked in dra_table_metadata (new ds{id}_{hash} naming)
                        const metadataQuery = `
                            SELECT physical_table_name FROM dra_table_metadata
                            WHERE schema_name = 'dra_meta_ads' AND data_source_id = $1
                        `;
                        const metadataResults = await dbConnector.query(metadataQuery, [dataSource.id]);

                        console.log(`Found ${metadataResults.length} Meta Ads metadata-tracked tables to delete for data source ${dataSource.id}`);
                        for (const row of metadataResults) {
                            const tableName = row.physical_table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_meta_ads.${tableName}`);
                            console.log(`Dropped Meta Ads table (metadata): ${tableName}`);
                        }

                        // Also drop new-format tables (ds{id}_{hash}) that may lack metadata rows
                        // (created before storeTableMetadata fix was deployed)
                        const newFormatQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_meta_ads' AND table_name LIKE 'ds${dataSource.id}_%'`;
                        const newFormatTables = await dbConnector.query(newFormatQuery);

                        for (const table of newFormatTables) {
                            const tableName = table.table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_meta_ads.${tableName}`);
                            console.log(`Dropped Meta Ads table (new-format, no metadata): ${tableName}`);
                        }

                        // Also drop legacy tables using old {type}_{id} naming (e.g. campaigns_78, ads_78)
                        const legacyQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_meta_ads' AND table_name LIKE '%_${dataSource.id}'`;
                        const legacyTables = await dbConnector.query(legacyQuery);

                        for (const table of legacyTables) {
                            const tableName = table.table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_meta_ads.${tableName}`);
                            console.log(`Dropped Meta Ads table (legacy): ${tableName}`);
                        }
                    } catch (error) {
                        console.error('Error dropping Meta Ads tables:', error);
                    }
                }

                // Delete MongoDB schema tables
                if (dataSource.data_type === EDataSourceType.MONGODB) {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        // MongoDB tables can be in format: {collectionName}_{dataSourceId} or just {collectionName}
                        // We'll query metadata to get the exact table names
                        const metadataQuery = `
                            SELECT physical_table_name FROM dra_table_metadata 
                            WHERE schema_name = 'dra_mongodb' AND data_source_id = $1
                        `;
                        const metadataResults = await dbConnector.query(metadataQuery, [dataSource.id]);
                        
                        console.log(`Found ${metadataResults.length} MongoDB tables to delete for data source ${dataSource.id}`);

                        for (const row of metadataResults) {
                            const tableName = row.physical_table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_mongodb.${tableName}`);
                            console.log(`Dropped MongoDB table: ${tableName}`);
                        }
                    } catch (error) {
                        console.error('Error dropping MongoDB tables:', error);
                    }
                }

                // Delete HubSpot schema tables
                if (dataSource.data_type === EDataSourceType.HUBSPOT) {
                    try {
                        // Drop tables registered in dra_table_metadata (ds{id}_{hash} naming)
                        const metadataResults = await dbConnector.query(
                            `SELECT physical_table_name FROM dra_table_metadata
                             WHERE schema_name = 'dra_hubspot' AND data_source_id = $1`,
                            [dataSource.id]
                        );
                        console.log(`Found ${metadataResults.length} HubSpot metadata-tracked tables to delete for data source ${dataSource.id}`);
                        for (const row of metadataResults) {
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_hubspot."${row.physical_table_name}" CASCADE`);
                            console.log(`Dropped HubSpot table: ${row.physical_table_name}`);
                        }

                        // Fallback: drop any ds{id}_* tables not yet in metadata
                        const fallbackTables = await dbConnector.query(
                            `SELECT table_name FROM information_schema.tables
                             WHERE table_schema = 'dra_hubspot' AND table_name LIKE 'ds${dataSource.id}_%'`
                        );
                        for (const row of fallbackTables) {
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_hubspot."${row.table_name}" CASCADE`);
                            console.log(`Dropped HubSpot table (fallback): ${row.table_name}`);
                        }
                    } catch (error) {
                        console.error('Error dropping HubSpot tables:', error);
                    }
                }

                // Delete Klaviyo schema tables
                if (dataSource.data_type === EDataSourceType.KLAVIYO) {
                    try {
                        // Drop tables registered in dra_table_metadata (ds{id}_{hash} naming)
                        const metadataResults = await dbConnector.query(
                            `SELECT physical_table_name FROM dra_table_metadata
                             WHERE schema_name = 'dra_klaviyo' AND data_source_id = $1`,
                            [dataSource.id]
                        );
                        console.log(`Found ${metadataResults.length} Klaviyo metadata-tracked tables to delete for data source ${dataSource.id}`);
                        for (const row of metadataResults) {
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_klaviyo."${row.physical_table_name}" CASCADE`);
                            console.log(`Dropped Klaviyo table: ${row.physical_table_name}`);
                        }

                        // Fallback: drop any ds{id}_* tables not yet in metadata
                        const fallbackTables = await dbConnector.query(
                            `SELECT table_name FROM information_schema.tables
                             WHERE table_schema = 'dra_klaviyo' AND table_name LIKE 'ds${dataSource.id}_%'`
                        );
                        for (const row of fallbackTables) {
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_klaviyo."${row.table_name}" CASCADE`);
                            console.log(`Dropped Klaviyo table (fallback): ${row.table_name}`);
                        }
                    } catch (error) {
                        console.error('Error dropping Klaviyo tables:', error);
                    }
                }

                // Store data source name for notification
                const dataSourceName = dataSource.name;

                // Remove the data source record (CASCADE will handle related metadata)
                await manager.remove(dataSource);
                console.log(`Successfully deleted data source ${dataSourceId}`);

                // Send notification
                await this.notificationHelper.notifyDataSourceDeleted(user_id, dataSourceName);

                return resolve(true);
            } catch (error) {
                console.error(`Fatal error deleting data source ${dataSourceId}:`, error);
                return resolve(false);
            }
        });
    }


    /**
     * @deprecated Use DataSourceSQLHelpers.reconstructSQLFromJSON directly.
     * Kept for backward compatibility with DataModelProcessor.
     */
    public reconstructSQLFromJSON(queryJSON: any): string {
        return DataSourceSQLHelpers.reconstructSQLFromJSON(queryJSON);
    }


    /**
     * Update sync schedule configuration for a data source
     */
    public async updateSyncSchedule(
        dataSourceId: number,
        syncEnabled: boolean,
        syncSchedule: string,
        syncScheduleTime: string | null,
        tokenDetails: ITokenDetails
    ): Promise<{ success: boolean; message?: string; data?: any }> {
        try {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);

            if (!driver) {
                return { success: false, message: 'Database driver not available' };
            }

            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });

            if (!user) {
                return { success: false, message: 'User not found' };
            }

            // Get data source
            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId }
            });

            if (!dataSource) {
                return { success: false, message: 'Data source not found' };
            }

            // Calculate next scheduled sync time if enabled
            let nextScheduledSync: Date | null = null;
            if (syncEnabled && syncSchedule !== 'manual') {
                nextScheduledSync = this.calculateNextScheduledSync(syncSchedule, syncScheduleTime);
            }

            // Strip seconds from time if present (HTML5 time inputs send HH:MM:SS)
            let normalizedTime = syncScheduleTime;
            if (syncScheduleTime && syncScheduleTime.length > 5) {
                normalizedTime = syncScheduleTime.substring(0, 5); // Keep only HH:MM
            }

            // Update using query builder to bypass TypeORM type checking for new columns
            await manager.createQueryBuilder()
                .update(DRADataSource)
                .set({
                    sync_enabled: syncEnabled,
                    sync_schedule: syncSchedule,
                    sync_schedule_time: normalizedTime,
                    next_scheduled_sync: nextScheduledSync,
                    created_at: new Date()
                } as any)
                .where('id = :id', { id: dataSourceId })
                .execute();

            return {
                success: true,
                message: 'Schedule configuration updated successfully',
                data: {
                    sync_enabled: syncEnabled,
                    sync_schedule: syncSchedule,
                    sync_schedule_time: syncScheduleTime,
                    next_scheduled_sync: nextScheduledSync
                }
            };
        } catch (error: any) {
            console.error('Error updating sync schedule:', error);
            return { success: false, message: error.message || 'Failed to update schedule' };
        }
    }

    /**
     * Calculate next scheduled sync time
     */
    private calculateNextScheduledSync(schedule: string, scheduleTime: string | null): Date {
        const now = new Date();

        switch (schedule) {
            case 'hourly':
                return new Date(now.getTime() + 60 * 60 * 1000);

            case 'daily': {
                const nextRun = new Date(now);
                nextRun.setDate(nextRun.getDate() + 1);

                if (scheduleTime) {
                    const [hours, minutes] = scheduleTime.split(':').map(Number);
                    nextRun.setHours(hours, minutes, 0, 0);
                } else {
                    nextRun.setHours(0, 0, 0, 0);
                }

                return nextRun;
            }

            case 'weekly': {
                const nextRun = new Date(now);
                nextRun.setDate(nextRun.getDate() + 7);

                if (scheduleTime) {
                    const [hours, minutes] = scheduleTime.split(':').map(Number);
                    nextRun.setHours(hours, minutes, 0, 0);
                } else {
                    nextRun.setHours(0, 0, 0, 0);
                }

                return nextRun;
            }

            case 'monthly': {
                const nextRun = new Date(now);
                nextRun.setMonth(nextRun.getMonth() + 1);

                if (scheduleTime) {
                    const [hours, minutes] = scheduleTime.split(':').map(Number);
                    nextRun.setHours(hours, minutes, 0, 0);
                } else {
                    nextRun.setHours(0, 0, 0, 0);
                }

                return nextRun;
            }

            default:
                const nextRun = new Date(now);
                nextRun.setDate(nextRun.getDate() + 1);
                nextRun.setHours(0, 0, 0, 0);
                return nextRun;
        }
    }
}