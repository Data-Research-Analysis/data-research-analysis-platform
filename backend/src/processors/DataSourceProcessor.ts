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
import { GoogleAnalyticsDriver } from "../drivers/GoogleAnalyticsDriver.js";
import { GoogleAdManagerDriver } from "../drivers/GoogleAdManagerDriver.js";
import { FederatedQueryService } from "../services/FederatedQueryService.js";
import { TableMetadataService } from "../services/TableMetadataService.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import { SchemaCollectorService } from "../services/SchemaCollectorService.js";
import { ExcelFileService } from "../services/ExcelFileService.js";
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

    /**
     * Escape SQL string values to prevent SQL injection
     * @param value - The value to escape
     * @returns Escaped string or 'null' for null/undefined values
     */
    private escapeSQL(value: any): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        // Escape single quotes by doubling them (SQL standard)
        return String(value).replace(/'/g, "''");
    }

    /**
     * Format a date value for SQL insertion based on column data type
     * @param value - The date value to format (Date object, string, or timestamp)
     * @param columnType - The PostgreSQL date type
     * @param columnName - The column name (for error logging)
     * @returns Formatted SQL date string
     */
    private formatDateForSQL(value: any, columnType: string, columnName: string): string {
        if (value === null || value === undefined) {
            return 'null';
        }

        try {
            let dateObj: Date;

            // Convert value to Date object
            if (value instanceof Date) {
                dateObj = value;
            } else if (typeof value === 'string') {
                // Handle empty or invalid strings
                if (value.trim() === '' || value === '0000-00-00' || value === '0000-00-00 00:00:00') {
                    return 'null';
                }

                // Handle JavaScript Date.toString() format
                // e.g., "Sun Nov 23 2025 00:00:00 GMT+0000 (Coordinated Universal Time)"
                if (value.includes('GMT')) {
                    // Parse using Date constructor which handles this format
                    dateObj = new Date(value);
                    if (isNaN(dateObj.getTime())) {
                        // If that fails, try to extract just the date portion
                        const datePart = value.split(' GMT')[0];
                        dateObj = new Date(datePart);
                    }
                } else {
                    dateObj = new Date(value);
                }
            } else if (typeof value === 'number') {
                // Unix timestamp
                dateObj = new Date(value);
            } else {
                console.warn(`Unexpected date value type for column ${columnName}:`, typeof value, value);
                return 'null';
            }

            // Validate Date object
            if (isNaN(dateObj.getTime())) {
                console.error(`Invalid date value for column ${columnName}:`, value);
                return 'null';
            }

            const upperType = columnType.toUpperCase();

            // Format based on column type
            // CRITICAL: Check TIMESTAMP types BEFORE TIME types
            // because 'TIMESTAMP WITHOUT TIME ZONE' contains 'TIME WITHOUT'
            // and would incorrectly match the TIME handler, stripping the date portion
            if (upperType === 'DATE') {
                // DATE: YYYY-MM-DD format
                const formatted = dateObj.toISOString().split('T')[0];
                return `'${formatted}'`;
            } 
            else if (upperType === 'TIMESTAMP WITH TIME ZONE' || upperType === 'TIMESTAMPTZ' || upperType.includes('TIMESTAMPTZ')) {
                // TIMESTAMP WITH TIME ZONE: ISO 8601 format with timezone
                return `'${dateObj.toISOString()}'`;
            } 
            else if (upperType === 'TIMESTAMP' || upperType.startsWith('TIMESTAMP(') || upperType.includes('TIMESTAMP WITHOUT') || upperType.includes('TIMESTAMP ')) {
                // TIMESTAMP: YYYY-MM-DD HH:MM:SS format (no timezone)
                const formatted = dateObj.toISOString()
                    .replace('T', ' ')
                    .split('.')[0];
                return `'${formatted}'`;
            }
            else if (upperType === 'TIME' || upperType.startsWith('TIME(') || upperType.includes('TIME WITHOUT')) {
                // TIME: HH:MM:SS format (must come AFTER TIMESTAMP checks)
                const timeString = dateObj.toISOString().split('T')[1].split('.')[0];
                return `'${timeString}'`;
            }

            // Fallback: use ISO string for timestamp with timezone
            return `'${dateObj.toISOString()}'`;

        } catch (error) {
            console.error(`Failed to format date for column ${columnName}:`, error, 'Value:', value);
            return 'null';
        }
    }

    /**
     * Format a value for SQL insertion based on column data type
     * @param value - The value to format
     * @param columnType - The PostgreSQL column type
     * @param columnName - The column name (for error logging)
     * @returns Formatted SQL value string
     */
    private formatValueForSQL(value: any, columnType: string, columnName: string): string {
        if (value === null || value === undefined) {
            return 'null';
        }

        // Auto-detect Date objects regardless of declared column type
        // External DB drivers may return Date objects for columns not recognized as date types
        if (value instanceof Date) {
            const upperType = columnType.toUpperCase();
            const dateType = (upperType.includes('DATE') || upperType.includes('TIME') || upperType.includes('TIMESTAMP'))
                ? upperType : 'TIMESTAMP';
            return this.formatDateForSQL(value, dateType, columnName);
        }

        const upperType = columnType.toUpperCase();

        // Handle DATE, TIME, and TIMESTAMP types
        if (upperType.includes('DATE') ||
            upperType.includes('TIME') ||
            upperType.includes('TIMESTAMP')) {
            return this.formatDateForSQL(value, upperType, columnName);
        }

        // Handle JSON and JSONB types
        if (upperType === 'JSON' || upperType === 'JSONB') {
            try {
                // Check if value is already stringified as "[object Object]"
                const valueStr = String(value);
                if (valueStr === '[object Object]' || valueStr.startsWith('[object ')) {
                    console.error(`Detected [object Object] for column ${columnName}. Value type: ${typeof value}`);
                    if (typeof value === 'object') {
                        const jsonString = JSON.stringify(value);
                        return `'${this.escapeSQL(jsonString)}'`;
                    }
                    return 'null';
                }

                if (typeof value === 'object') {
                    const jsonString = JSON.stringify(value);
                    return `'${this.escapeSQL(jsonString)}'`;
                } else if (typeof value === 'string') {
                    if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
                        try {
                            JSON.parse(value);
                            return `'${this.escapeSQL(value)}'`;
                        } catch {
                            return `'${this.escapeSQL(JSON.stringify(value))}'`;
                        }
                    } else {
                        return `'${this.escapeSQL(JSON.stringify(value))}'`;
                    }
                } else {
                    return `'${JSON.stringify(value)}'`;
                }
            } catch (error) {
                console.error(`Failed to serialize JSON for column ${columnName}:`, error, 'Value:', value, 'Type:', typeof value);
                return 'null';
            }
        }

        // Auto-detect date-like strings as safety net
        // Catches JavaScript Date.toString() format ("Thu Nov 23 2025 00:00:00 GMT+0000...")
        // that external DB drivers may return as strings instead of Date objects.
        // Without this, such strings get inserted raw into DATE/TIMESTAMP columns,
        // causing PostgreSQL DateTimeParseError (code 22007).
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.includes('GMT') || trimmed.includes('UTC') || trimmed.includes('Coordinated Universal Time')) {
                const dateObj = new Date(trimmed);
                if (!isNaN(dateObj.getTime())) {
                    console.warn(`[formatValueForSQL] Auto-detected date string for column ${columnName} (declared ${columnType}): "${trimmed.substring(0, 60)}"`);
                    return this.formatDateForSQL(trimmed, 'TIMESTAMP', columnName);
                }
            }
        }

        // Handle NUMERIC/INTEGER/REAL/FLOAT types - don't wrap numbers in quotes
        if (upperType.includes('NUMERIC') || upperType.includes('INTEGER') || upperType.includes('INT') ||
            upperType.includes('REAL') || upperType.includes('FLOAT') || upperType.includes('DOUBLE') ||
            upperType.includes('DECIMAL') || upperType.includes('BIGINT') || upperType.includes('SMALLINT')) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                return `${numValue}`;
            }
            return 'null';
        }

        // Handle BOOLEAN type
        if (upperType === 'BOOLEAN' || upperType === 'BOOL') {
            return this.convertToPostgresBoolean(value);
        }

        // Handle all other types with proper escaping
        return `'${this.escapeSQL(value)}'`;
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
     * Validates that SQL aggregate queries have proper GROUP BY clauses
     * When aggregate functions are used, all non-aggregated columns must appear in GROUP BY
     * Uses group_by_columns array for GROUP BY column references
     */
    private validateGroupByRequirements(queryJSON: string): { valid: boolean, error?: string } {
        try {
            const sourceTable = JSON.parse(queryJSON);
            const aggregateFunctions = sourceTable?.query_options?.group_by?.aggregate_functions || [];
            const aggregateExpressions = sourceTable?.query_options?.group_by?.aggregate_expressions || [];

            // Check if any aggregation is being done
            const hasAggregation = aggregateFunctions.length > 0 ||
                (aggregateExpressions.length > 0 && typeof aggregateExpressions[0] === 'object');

            if (!hasAggregation) {
                return { valid: true }; // No aggregates, no GROUP BY needed
            }

            // Has aggregates - check GROUP BY exists
            // Use group_by_columns (new field) for GROUP BY column references
            const groupByColumns = sourceTable?.query_options?.group_by?.group_by_columns || [];
            const columns = sourceTable?.columns || [];

            // Build list of aggregated column references from aggregate_functions
            const aggregatedColumns = new Set(
                aggregateFunctions.map((agg: any) => agg.column)
            );

            // Find non-aggregated columns (columns that appear in SELECT but not in aggregate functions)
            const nonAggregatedColumns = columns.filter((col: any) => {
                const colRef = `${col.schema}.${col.table_name}.${col.column_name}`;
                return !aggregatedColumns.has(colRef) && col.is_selected_column;
            });

            // All non-aggregated columns must be in group_by_columns
            const missingGroupBy = nonAggregatedColumns.filter((col: any) => {
                const colRef = `${col.schema}.${col.table_name}.${col.column_name}`;
                return !groupByColumns.includes(colRef);
            });

            if (missingGroupBy.length > 0) {
                const missingCols = missingGroupBy.map((col: any) =>
                    `${col.schema}.${col.table_name}.${col.column_name}`
                ).join(', ');
                return {
                    valid: false,
                    error: `SQL aggregate validation error: Non-aggregated columns must appear in GROUP BY clause (group_by_columns array). Missing columns: ${missingCols}. Use actual schema name from data source.`
                };
            }

            return { valid: true };
        } catch (error) {
            console.error('[DataSourceProcessor] Error validating GROUP BY requirements:', error);
            return {
                valid: false,
                error: `GROUP BY validation error: ${error.message}`
            };
        }
    }

    private async executeMongoDBQuery(dataSourceId: number, queryJSON: string, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ success: false, error: 'Internal driver error' });
            }
            const manager = (await driver.getConcreteDriver()).manager;

            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve({ success: false, error: 'User not found' });
            }

            // Find data source
            let dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId },
                relations: { project: true, users_platform: true }
            });

            if (!dataSource) {
                return resolve({ success: false, error: 'Data source not found' });
            }

            // Verify access (ownership or project membership)
            if (dataSource.users_platform?.id !== user.id) {
                const membership = await manager.findOne(DRAProjectMember, {
                    where: {
                        user: { id: user_id },
                        project: { id: dataSource.project.id }
                    }
                });
                if (!membership) {
                    return resolve({ success: false, error: 'Access denied' });
                }
            }

            // Validate query JSON structure
            const { MongoDBValidator } = await import('../utilities/MongoDBValidator.js');
            const validation = MongoDBValidator.validateQueryJSON(queryJSON);
            
            if (!validation.valid) {
                return resolve({ 
                    success: false, 
                    error: validation.error || 'Invalid query',
                    data: [],
                    rowCount: 0
                });
            }

            const { collection: collectionName, pipeline } = validation;

            // Check if data is imported to PostgreSQL (new approach)
            if (dataSource.sync_status === 'completed' && dataSource.last_sync_at) {
                console.log(`[DataSourceProcessor] Querying MongoDB data from PostgreSQL for collection: ${collectionName}`);
                try {
                    const results = await this.executeMongoDBQueryFromPostgreSQL(
                        collectionName!,
                        pipeline!,
                        dataSourceId
                    );
                    
                    return resolve({
                        success: true,
                        data: results,
                        rowCount: results.length
                    });
                } catch (error: any) {
                    console.error('[DataSourceProcessor] PostgreSQL query failed, falling back to MongoDB:', error);
                    // Fall through to direct MongoDB query
                }
            }

            // Fall back to direct MongoDB query (legacy approach or if PostgreSQL query fails)
            console.log(`[DataSourceProcessor] Querying MongoDB directly for collection: ${collectionName}`);

            // Connect to MongoDB
            const connection = dataSource.connection_details;
            
            // If connection_string exists in the database column, add it to connection object
            if (dataSource.connection_string) {
                connection.connection_string = dataSource.connection_string;
            }
            
            const mongoDriver = await DBDriver.getInstance().getDriver(EDataSourceType.MONGODB);
            let dbConnector: DataSource;
            try {
                dbConnector = await mongoDriver.connectExternalDB(connection);
            } catch (error) {
                return resolve({ success: false, error: 'Failed to connect to MongoDB' });
            }

            try {
                // Execute aggregation - type-safe check for optional method
                if (!mongoDriver.executeAggregation || typeof mongoDriver.executeAggregation !== 'function') {
                    return resolve({ success: false, error: 'MongoDB driver does not support aggregation' });
                }
                
                const results = await mongoDriver.executeAggregation(collectionName!, pipeline!);

                return resolve({
                    success: true,
                    data: results,
                    rowCount: results.length
                });

            } catch (error: any) {
                console.error('MongoDB query execution error:', error);
                return resolve({ 
                    success: false, 
                    error: error.message || 'Query execution failed',
                    data: [],
                    rowCount: 0
                });
            } finally {
                await mongoDriver.close();
            }
        });
    }

    /**
     * Execute MongoDB query against PostgreSQL (for imported data)
     * @private
     */
    private async executeMongoDBQueryFromPostgreSQL(
        collectionName: string,
        pipeline: any[],
        dataSourceId: number
    ): Promise<any[]> {
        const { MongoDBQueryTranslator } = await import('../services/MongoDBQueryTranslator.js');
        
        // Sanitize collection name to table name base
        const sanitizedBase = collectionName
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&')
            .substring(0, 63);
        
        // Generate unique table name with data source ID (matches MongoDBImportService pattern)
        const tableName = `${sanitizedBase}_data_source_${dataSourceId}`;
        
        // Translate MongoDB aggregation pipeline to SQL
        const translator = new MongoDBQueryTranslator();
        const sql = translator.translatePipeline(tableName, pipeline);
        
        console.log(`[DataSourceProcessor] Translated SQL: ${sql}`);

        // Execute SQL query against PostgreSQL
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const pgDataSource = await driver.getConcreteDriver();
        const results = await pgDataSource.query(sql);

        return results;
    }

    public async getTablesFromDataSource(dataSourceId: number, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }

            // First try to find data source owned by user
            let dataSource: DRADataSource | null = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user },
                relations: { project: true }
            });

            // If not owned, check if user is a member of the project that owns this data source
            if (!dataSource) {
                dataSource = await manager.findOne(DRADataSource, {
                    where: { id: dataSourceId },
                    relations: { project: true }
                });

                if (dataSource && dataSource.project) {
                    // Check if user is a member of this project
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: { id: user_id },
                            project: { id: dataSource.project.id }
                        }
                    });

                    if (!membership) {
                        return resolve(null);
                    }
                } else {
                    return resolve(null);
                }
            }

            if (!dataSource) {
                return resolve(null);
            }

            if (dataSource.data_type === EDataSourceType.MONGODB) {
                // MongoDB data is synced to PostgreSQL in dra_mongodb schema
                // Query PostgreSQL directly instead of connecting to MongoDB
                const connection = dataSource.connection_details;
                const schemaCollector = new SchemaCollectorService();
                
                // Get internal PostgreSQL connection (where MongoDB data is synced)
                const pgDriver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!pgDriver) {
                    console.error('[DataSourceProcessor] Cannot get PostgreSQL driver for MongoDB data');
                    return resolve(null);
                }
                
                const pgManager = (await pgDriver.getConcreteDriver()).manager;
                if (!pgManager) {
                    console.error('[DataSourceProcessor] Cannot get PostgreSQL manager for MongoDB data');
                    return resolve(null);
                }
                
                const pgConnection = pgManager.connection;
                const schemaName = 'dra_mongodb';
                
                try {
                    console.log(`[DataSourceProcessor] Querying PostgreSQL schema '${schemaName}' for MongoDB data source ${dataSourceId}`);
                    
                    // Collect schema from PostgreSQL where MongoDB data is stored
                    const tables = await schemaCollector.collectSchema(pgConnection, schemaName);
                    
                    // Filter tables to only include those for this data source
                    // MongoDB tables are named: {collection}_data_source_{id}
                    const dataSourceSuffix = `_data_source_${dataSourceId}`;
                    const filteredTables = tables.filter((table: any) => 
                        table.tableName.endsWith(dataSourceSuffix)
                    );
                    
                    // Transform to match frontend expected format (table_name with underscore)
                    // KEEP the physical table name with suffix (just like dra_excel does)
                    const cleanedTables = filteredTables.map((table: any) => {
                        const physicalTableName = table.tableName;
                        const logicalName = table.tableName.replace(dataSourceSuffix, '');
                        return {
                            table_name: physicalTableName,  // Keep full physical name for queries
                            logical_name: logicalName,      // Display name without suffix
                            original_sheet_name: null,
                            table_type: null,
                            schema: schemaName,
                            columns: table.columns.map((col: any) => ({
                                column_name: col.column_name,
                                data_type: col.data_type,
                                character_maximum_length: col.character_maximum_length,
                                table_name: physicalTableName,  // Use physical name
                                schema: schemaName,
                                alias_name: '',
                                is_selected_column: true,
                                reference: {
                                    local_table_schema: null,
                                    local_table_name: null,
                                    local_column_name: null,
                                    foreign_table_schema: null,
                                    foreign_table_name: null,
                                    foreign_column_name: null,
                                }
                            })),
                            references: table.foreignKeys.map((fk: any) => ({
                                local_table_schema: fk.table_schema,
                                local_table_name: fk.table_name,  // Keep physical name
                                local_column_name: fk.column_name,
                                foreign_table_schema: fk.foreign_table_schema,
                                foreign_table_name: fk.foreign_table_name,  // Keep physical name
                                foreign_column_name: fk.foreign_column_name,
                            }))
                        };
                    });
                    
                    console.log(`[DataSourceProcessor] Found ${cleanedTables.length} tables for MongoDB data source ${dataSourceId}`);
                    return resolve(cleanedTables);
                    
                } catch (error) {
                    console.error('[DataSourceProcessor] Error getting MongoDB tables from PostgreSQL:', error);
                    return resolve(null);
                }
            } else if (dataSource.data_type === EDataSourceType.POSTGRESQL || dataSource.data_type === EDataSourceType.MYSQL || dataSource.data_type === EDataSourceType.MARIADB || dataSource.data_type === EDataSourceType.EXCEL || dataSource.data_type === EDataSourceType.PDF || dataSource.data_type === EDataSourceType.GOOGLE_ANALYTICS || dataSource.data_type === EDataSourceType.GOOGLE_AD_MANAGER || dataSource.data_type === EDataSourceType.GOOGLE_ADS || dataSource.data_type === EDataSourceType.META_ADS) {
                const connection = dataSource.connection_details;
                console.log('[DEBUG - DataSourceProcessor] Connecting to data source ID:', dataSource.id);
                console.log('[DEBUG - DataSourceProcessor] Data source type:', dataSource.data_type);

                // API-integrated sources store their data in internal PostgreSQL under dedicated schemas
                const isApiIntegratedSource = (
                    dataSource.data_type === EDataSourceType.GOOGLE_ANALYTICS ||
                    dataSource.data_type === EDataSourceType.GOOGLE_AD_MANAGER ||
                    dataSource.data_type === EDataSourceType.GOOGLE_ADS ||
                    dataSource.data_type === EDataSourceType.META_ADS
                );

                // Determine schema name based on data source type
                // For API-based sources (Google Analytics, Ads, Ad Manager, Meta Ads), connection_details doesn't have 'schema'
                // We need to derive it from the data_type instead
                let schemaName: string;
                if (dataSource.data_type === EDataSourceType.GOOGLE_ANALYTICS) {
                    schemaName = 'dra_google_analytics';
                } else if (dataSource.data_type === EDataSourceType.GOOGLE_AD_MANAGER) {
                    schemaName = 'dra_google_ad_manager';
                } else if (dataSource.data_type === EDataSourceType.GOOGLE_ADS) {
                    schemaName = 'dra_google_ads';
                } else if (dataSource.data_type === EDataSourceType.META_ADS) {
                    schemaName = 'dra_meta_ads';
                } else if (dataSource.data_type === EDataSourceType.EXCEL) {
                    schemaName = 'dra_excel';
                } else if (dataSource.data_type === EDataSourceType.PDF) {
                    schemaName = 'dra_pdf';
                } else {
                    // For PostgreSQL, MySQL, MariaDB - use schema from connection_details
                    schemaName = connection.schema;
                }

                console.log('[DEBUG - DataSourceProcessor] Using schema name:', schemaName);

                // Skip API-based data sources that haven't been synced yet
                if ('oauth_access_token' in connection) {
                    // For OAuth sources, we only return tables if they've been synced to PostgreSQL
                    // We'll fetch metadata to see if tables exist
                    console.log('[DEBUG - DataSourceProcessor] OAuth source detected, checking for synced tables');
                }

                const dataSourceType = isApiIntegratedSource
                    ? EDataSourceType.POSTGRESQL  // API sources are synced to PostgreSQL
                    : UtilityService.getInstance().getDataSourceType(connection.data_source_type);

                if (!dataSourceType) {
                    return resolve(null);
                }
                const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
                if (!externalDriver) {
                    return resolve(null);
                }
                let dbConnector: DataSource;
                try {
                    // For OAuth sources, connect to our internal PostgreSQL where data is synced
                    if ('oauth_access_token' in connection) {
                        dbConnector = await driver.getConcreteDriver();
                    } else {
                        dbConnector = await externalDriver.connectExternalDB(connection);
                    }
                    if (!dbConnector) {
                        return resolve(false);
                    }
                } catch (error) {
                    console.log('Error connecting to external DB', error);
                    return resolve(false);
                }

                // Fetch table metadata first to get physical table names
                let tableMetadata: any[] = [];
                try {
                    const metadataQuery = `
                        SELECT 
                            physical_table_name,
                            logical_table_name,
                            original_sheet_name,
                            file_id,
                            table_type
                        FROM dra_table_metadata
                        WHERE data_source_id = $1 AND schema_name = $2
                    `;
                    tableMetadata = await manager.query(metadataQuery, [dataSource.id, schemaName]);
                    console.log(`[DEBUG] Found ${tableMetadata.length} metadata records for schema ${schemaName}`);
                } catch (error) {
                    console.error('[DEBUG] Error fetching table metadata:', error);
                }

                // Build the base query
                let query = await externalDriver.getTablesColumnDetails(schemaName);

                // If we have metadata, use physical_table_names; otherwise fall back to old pattern
                if (tableMetadata.length > 0) {
                    const physicalTableNames = tableMetadata.map(m => m.physical_table_name);
                    const tableNamesList = physicalTableNames.map(name => `'${name}'`).join(',');
                    query += ` AND tb.table_name IN (${tableNamesList})`;
                    console.log(`[DEBUG] Using metadata-based filter for ${physicalTableNames.length} tables`);
                } else {
                    // Fallback to old naming pattern for tables without metadata
                    console.log(`[DEBUG] No metadata found, using legacy naming pattern`);
                    if (schemaName === 'dra_excel') {
                        query += ` AND tb.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                    } else if (schemaName === 'dra_pdf') {
                        query += ` AND tb.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                    } else if (schemaName === 'dra_google_analytics') {
                        query += ` AND tb.table_name LIKE '%_${dataSource.id}'`;
                    } else if (schemaName === 'dra_google_ad_manager') {
                        query += ` AND tb.table_name LIKE '%_${dataSource.id}'`;
                    } else if (schemaName === 'dra_google_ads') {
                        query += ` AND tb.table_name LIKE '%_${dataSource.id}'`;
                    } else if (schemaName === 'dra_meta_ads') {
                        query += ` AND tb.table_name LIKE '%_${dataSource.id}'`;
                    } else {
                        // For PostgreSQL, MySQL, MariaDB - no additional filter needed
                        // The schema filter in getTablesColumnDetails() is sufficient
                        // These connect to external databases where all tables in the schema belong to this connection
                        console.log(`[DEBUG] External database source: using schema filter only`);
                    }
                }

                let tablesSchema = await dbConnector.query(query);

                // Create metadata lookup map
                const metadataMap = new Map();
                tableMetadata.forEach((meta: any) => {
                    metadataMap.set(meta.physical_table_name, meta);
                });

                let tables = tablesSchema.map((table: any) => {
                    const physicalTableName = table?.table_name || table?.TABLE_NAME;
                    const metadata = metadataMap.get(physicalTableName);

                    return {
                        table_name: physicalTableName,
                        logical_name: metadata?.logical_table_name || physicalTableName,
                        original_sheet_name: metadata?.original_sheet_name || null,
                        table_type: metadata?.table_type || null,
                        schema: table.table_schema || table?.TABLE_SCHEMA,
                        columns: [],
                        references: [],
                    }
                });
                tables = _.uniqBy(tables, 'table_name');

                console.log('[DEBUG - DataSourceProcessor] Tables before column population:', tables.length);

                tables.forEach((table: any) => {
                    const columnsBefore = table.columns.length;
                    tablesSchema.forEach((result: any) => {
                        const resultTableName = result?.table_name || result?.TABLE_NAME;
                        const resultSchema = result?.table_schema || result?.TABLE_SCHEMA;

                        // Match on both table name AND schema to prevent cross-schema pollution
                        if (table?.table_name === resultTableName && table?.schema === resultSchema) {
                            table.columns.push({
                                column_name: result?.column_name || result?.COLUMN_NAME,
                                data_type: result?.data_type || result?.DATA_TYPE,
                                character_maximum_length: result?.character_maximum_length || result?.CHARACTER_MAXIMUM_LENGTH,
                                table_name: table?.table_name || table?.TABLE_NAME,
                                schema: table?.schema || table?.TABLE_SCHEMA,
                                alias_name: '',
                                is_selected_column: true,
                                reference: {
                                    local_table_schema: null,
                                    local_table_name: null,
                                    local_column_name: null,

                                    foreign_table_schema: null,
                                    foreign_table_name: null,
                                    foreign_column_name: null,
                                }
                            });
                        }
                    });

                    // Defensive filter: Remove any columns that don't match the table's schema
                    const beforeFilter = table.columns.length;
                    table.columns = table.columns.filter((col: any) => col.schema === table.schema);
                    const afterFilter = table.columns.length;

                    if (beforeFilter !== afterFilter) {
                        console.warn(`[DEBUG - DataSourceProcessor] ⚠️ SCHEMA MISMATCH: Filtered ${beforeFilter - afterFilter} columns with wrong schema from ${table.table_name}`);
                    }

                    console.log(`[DEBUG - DataSourceProcessor] Table ${table.table_name}: Added ${table.columns.length - columnsBefore} columns (total: ${table.columns.length})`);

                    // Check for duplicate columns
                    const columnNames = table.columns.map((c: any) => c.column_name);
                    const duplicates = columnNames.filter((name: string, index: number) => columnNames.indexOf(name) !== index);
                    if (duplicates.length > 0) {
                        console.error(`[DEBUG - DataSourceProcessor] DUPLICATES FOUND in ${table.table_name}:`, [...new Set(duplicates)]);
                    }
                });
                query = await externalDriver.getTablesRelationships(schemaName);
                if (schemaName === 'dra_excel') {
                    query += ` AND tc.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                } else if (schemaName === 'dra_pdf') {
                    query += ` AND tc.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                }
                tablesSchema = await dbConnector.query(query);

                console.log('[DEBUG - DataSourceProcessor] Foreign key relationships found:', tablesSchema.length);

                tablesSchema.forEach((result: any) => {
                    tables.forEach((table: any) => {
                        if (table?.table_name === result?.local_table_name || table?.table_name === result?.LOCAL_TABLE_NAME) {
                            table.columns.forEach((column: any) => {
                                if (column?.column_name === result?.local_column_name || column?.column_name === result?.LOCAL_COLUMN_NAME) {
                                    column.reference.local_table_schema = result?.local_table_schema || result?.LOCAL_TABLE_SCHEMA;
                                    column.reference.local_table_name = result?.local_table_name || result?.LOCAL_TABLE_NAME;
                                    column.reference.local_column_name = result?.local_column_name || result?.LOCAL_COLUMN_NAME;

                                    column.reference.foreign_table_schema = result?.foreign_table_schema || result?.FOREIGN_TABLE_SCHEMA;
                                    column.reference.foreign_table_name = result?.foreign_table_name || result?.FOREIGN_TABLE_NAME;
                                    column.reference.foreign_column_name = result?.foreign_column_name || result?.FOREIGN_COLUMN_NAME;
                                    table.references.push(column.reference);
                                }
                            });
                        }
                    });
                });

                // CRITICAL FIX: Deduplicate columns in each table
                console.log('[DEBUG - DataSourceProcessor] Deduplicating columns...');
                tables.forEach((table: any) => {
                    const beforeCount = table.columns.length;
                    table.columns = _.uniqBy(table.columns, (col: any) =>
                        `${col.schema}.${col.table_name}.${col.column_name}`
                    );
                    const afterCount = table.columns.length;

                    if (beforeCount !== afterCount) {
                        console.log(`[DEBUG - DataSourceProcessor] ✓ Removed ${beforeCount - afterCount} duplicate columns from ${table.table_name}`);
                    }
                });

                // Final diagnostic before returning
                console.log('[DEBUG - DataSourceProcessor] Final table summary:');
                tables.forEach((table: any) => {
                    console.log(`  - ${table.table_name}: ${table.columns.length} columns, ${table.references.length} foreign keys`);
                });

                return resolve(tables);
            }
        });
    }

    public async executeQueryOnExternalDataSource(
        dataSourceId: number,
        query: string,
        tokenDetails: ITokenDetails,
        queryJSON?: string,
        isCrossSource?: boolean,
        projectId?: number
    ): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }


            // Handle cross-source queries
            if (isCrossSource && projectId) {
                console.log('[DataSourceProcessor] Executing cross-source query for project:', projectId);
                try {
                    // Check if this is a JOIN query or simple single-table query
                    const hasJoins = queryJSON && JSON.parse(queryJSON).join_conditions &&
                        JSON.parse(queryJSON).join_conditions.length > 0;

                    if (hasJoins) {
                        // For queries with JOINs, we need to execute on synced PostgreSQL data
                        console.log('[DataSourceProcessor] Cross-source query has JOINs, using synced data approach');

                        // Get the internal PostgreSQL connector
                        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                        if (!driver) {
                            return resolve(null);
                        }
                        const manager = (await driver.getConcreteDriver()).manager;
                        if (!manager) {
                            return resolve(null);
                        }

                        // Resolve table names and transform query
                        const tableMap = await this.resolveTableNamesForCrossSource(projectId, queryJSON, manager);

                        if (tableMap.size === 0) {
                            console.warn('[DataSourceProcessor] Tables not synced to PostgreSQL. Checking if all tables from same data source...');

                            // Parse queryJSON to get all unique data_source_ids from columns
                            const parsedQuery = JSON.parse(queryJSON);
                            const uniqueDataSourceIds = new Set<number>();

                            if (parsedQuery.columns && Array.isArray(parsedQuery.columns)) {
                                parsedQuery.columns.forEach((col: any) => {
                                    if (col.data_source_id) {
                                        uniqueDataSourceIds.add(col.data_source_id);
                                    }
                                });
                            }

                            console.log(`[DataSourceProcessor] Found ${uniqueDataSourceIds.size} unique data source(s) in query`);

                            if (uniqueDataSourceIds.size === 1) {
                                // All tables from same source - execute directly on that data source
                                const dataSourceId = Array.from(uniqueDataSourceIds)[0];
                                console.log(`[DataSourceProcessor] All tables from same data source (${dataSourceId}), executing directly on external database`);

                                const results = await this.executeQueryOnExternalDataSource(
                                    dataSourceId,
                                    query,
                                    tokenDetails,
                                    queryJSON,
                                    false, // Not cross-source anymore - executing on single source
                                    undefined
                                );
                                return resolve(results);
                            } else if (uniqueDataSourceIds.size > 1) {
                                // True cross-source query - tables not synced, cannot execute
                                console.error('[DataSourceProcessor] True cross-source query with JOIN requires tables to be synced to PostgreSQL');
                                console.error(`[DataSourceProcessor] Data sources involved: ${Array.from(uniqueDataSourceIds).join(', ')}`);
                                return resolve([]);
                            } else {
                                // No data_source_id found in columns
                                console.error('[DataSourceProcessor] Could not determine data source IDs from query columns');
                                return resolve([]);
                            }
                        }

                        const transformedQuery = this.transformQueryForCrossSource(query, tableMap);
                        console.log('[DataSourceProcessor] Executing transformed cross-source JOIN query:', transformedQuery);

                        const internalDbConnector = await driver.getConcreteDriver();
                        const results = await internalDbConnector.query(transformedQuery);
                        return resolve(results);
                    } else {
                        // For simple queries (no JOINs), execute on the first table's data source
                        // This is for preview purposes (LIMIT 5)
                        if (queryJSON) {
                            const parsedQuery = JSON.parse(queryJSON);
                            if (parsedQuery.columns && parsedQuery.columns.length > 0) {
                                // Get the first column's data source ID
                                const firstDataSourceId = parsedQuery.columns[0].data_source_id;
                                if (firstDataSourceId) {
                                    console.log('[DataSourceProcessor] Executing simple sample query on data source:', firstDataSourceId);
                                    // Execute on the specific data source and return results
                                    const results = await this.executeQueryOnExternalDataSource(
                                        firstDataSourceId,
                                        query,
                                        tokenDetails,
                                        queryJSON,
                                        false, // Not cross-source anymore
                                        undefined
                                    );
                                    return resolve(results);
                                }
                            }
                        }
                    }

                    // If we can't determine a data source, return empty
                    console.warn('[DataSourceProcessor] Could not determine data source for cross-source query');
                    return resolve([]);
                } catch (error) {
                    console.error('[DataSourceProcessor] Error executing cross-source query:', error);
                    return resolve(null);
                }
            }


            // Handle single-source queries (original logic)
            // First try to find data source owned by user
            let dataSource: DRADataSource | null = await manager.findOne(DRADataSource, { where: { id: dataSourceId, users_platform: user } });

            // If not owned by user, check if user is a member of the data source's project
            if (!dataSource) {
                dataSource = await manager.findOne(DRADataSource, {
                    where: { id: dataSourceId },
                    relations: { project: true }
                });

                if (dataSource?.project) {
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: { id: user_id },
                            project: { id: dataSource.project.id }
                        }
                    });

                    if (!membership) {
                        return resolve(null);
                    }
                } else {
                    // Data source not associated with a project, user can't access it
                    return resolve(null);
                }
            }

            // Handle MongoDB queries
            if (dataSource.data_type === EDataSourceType.MONGODB) {
                // Check if MongoDB data is synced to PostgreSQL
                // If synced, treat as PostgreSQL query on dra_mongodb schema tables
                // If not synced, execute as native MongoDB aggregation pipeline
                if (dataSource.sync_status === 'completed' && dataSource.last_sync_at) {
                    console.log(`[DataSourceProcessor] MongoDB data source ${dataSource.id} is synced to PostgreSQL, executing SQL query on internal database`);
                    
                    try {
                        // Get internal PostgreSQL driver
                        const internalDriver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                        if (!internalDriver) {
                            return resolve({ success: false, error: 'Internal PostgreSQL driver not available', data: [], rowCount: 0 });
                        }
                        const internalDbConnector = await internalDriver.getConcreteDriver();
                        if (!internalDbConnector) {
                            return resolve({ success: false, error: 'Internal PostgreSQL connection not available', data: [], rowCount: 0 });
                        }

                        // Reconstruct SQL from JSON if provided
                        let finalQuery = query;
                        if (queryJSON) {
                            finalQuery = this.reconstructSQLFromJSON(queryJSON);

                            // Extract LIMIT/OFFSET from original query if not in JSON
                            const limitMatch = query.match(/LIMIT\s+(\d+)/i);
                            const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
                            if (limitMatch && !finalQuery.includes('LIMIT')) {
                                const limit = limitMatch[1];
                                const offset = offsetMatch ? offsetMatch[1] : '0';
                                finalQuery += ` LIMIT ${limit} OFFSET ${offset}`;
                            }
                        }

                        console.log('[DataSourceProcessor] Executing SQL query on synced MongoDB data:', finalQuery);
                        const results = await internalDbConnector.query(finalQuery);
                        console.log('[DataSourceProcessor] Query results count:', results?.length || 0);
                        return resolve(results);
                    } catch (error) {
                        console.error('[DataSourceProcessor] Error executing query on synced MongoDB data:', error);
                        console.error('[DataSourceProcessor] Failed query was:', query);
                        return reject(error);
                    }
                } else {
                    // Not synced - execute as native MongoDB query with aggregation pipeline
                    console.log(`[DataSourceProcessor] MongoDB data source ${dataSource.id} not synced, executing as native MongoDB query`);
                    const jsonToUse = queryJSON || query;
                    return resolve(await this.executeMongoDBQuery(dataSource.id, jsonToUse, tokenDetails));
                }
            }

            const connection = dataSource.connection_details;
            // Skip API-based data sources
            if ('oauth_access_token' in connection) {
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
                    return resolve(false);
                }
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return resolve(false);
            }
            try {
                // If JSON query is provided, reconstruct SQL from it (ensures JOINs are included)
                // The reconstructed SQL already includes LIMIT/OFFSET from query_options
                let finalQuery = query;
                if (queryJSON) {                    
                    finalQuery = this.reconstructSQLFromJSON(queryJSON);

                    // Extract LIMIT/OFFSET from original query if not in JSON
                    // This handles cases where LIMIT is added as SQL string (e.g., 'LIMIT 5 OFFSET 0')
                    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
                    const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
                    if (limitMatch && !finalQuery.includes('LIMIT')) {
                        const limit = limitMatch[1];
                        const offset = offsetMatch ? offsetMatch[1] : '0';
                        finalQuery += ` LIMIT ${limit} OFFSET ${offset}`;
                    }
                }

                console.log('[DataSourceProcessor] Executing query on external datasource:', finalQuery);
                const results = await dbConnector.query(finalQuery);
                console.log('[DataSourceProcessor] Query results count:', results?.length || 0);
                return resolve(results);
            } catch (error) {
                console.error('[DataSourceProcessor] Error executing query:', error);
                console.error('[DataSourceProcessor] Failed query was:', query);
                return reject(error);
            }
        });
    }

    /**
     * Resolves original external table names to their synced PostgreSQL equivalents
     * For cross-source queries, this maps original schema.table references (e.g., mysql_dra_db.orders)
     * to their synced PostgreSQL equivalents (e.g., dra_mysql_22.orders_abc123_22)
     * 
     * @param projectId - The project ID
     * @param queryJSON - The query JSON containing table references with data_source_id
     * @param manager - TypeORM EntityManager
     * @returns Map of original table references to synced table info
     */
    private async resolveTableNamesForCrossSource(
        projectId: number,
        queryJSON: string,
        manager: any
    ): Promise<Map<string, { schema: string; table_name: string; data_source_id: number }>> {
        const tableMap = new Map<string, { schema: string; table_name: string; data_source_id: number }>();

        try {
            const parsedQuery = JSON.parse(queryJSON);

            // Extract unique table references from columns
            const tableRefs = new Map<string, { schema: string; table: string; data_source_id: number }>();
            const uniqueDataSourceIds = new Set<number>();

            if (parsedQuery.columns && Array.isArray(parsedQuery.columns)) {
                parsedQuery.columns.forEach((col: any) => {
                    if (col.schema && col.table_name && col.data_source_id) {
                        const key = `${col.schema}.${col.table_name}`;
                        if (!tableRefs.has(key)) {
                            tableRefs.set(key, {
                                schema: col.schema,
                                table: col.table_name,
                                data_source_id: col.data_source_id
                            });
                        }
                        uniqueDataSourceIds.add(col.data_source_id);
                    }
                });
            }

            const isSameSource = uniqueDataSourceIds.size === 1;
            console.log(`[DataSourceProcessor] Resolving ${tableRefs.size} unique table references for cross-source query`);
            console.log(`[DataSourceProcessor] Query involves ${uniqueDataSourceIds.size} data source(s): ${Array.from(uniqueDataSourceIds).join(', ')}`);

            // For each unique table reference, find its synced PostgreSQL equivalent
            for (const [originalRef, ref] of tableRefs) {
                console.log(`[DataSourceProcessor] Looking up synced table for: ${originalRef} (data_source_id: ${ref.data_source_id})`);

                // First, try to find in dra_table_metadata using physical_table_name or logical_table_name
                let metadata = await manager.query(`
                    SELECT 
                        physical_table_name,
                        schema_name,
                        data_source_id,
                        logical_table_name
                    FROM dra_table_metadata
                    WHERE data_source_id = $1
                    AND (physical_table_name = $2 OR logical_table_name = $2)
                    LIMIT 1
                `, [ref.data_source_id, ref.table]);

                // If not found by physical_table_name or logical_table_name, try matching by schema pattern
                // This handles cases where the table is from the original MySQL/PostgreSQL database
                if (!metadata || metadata.length === 0) {
                    // For external databases (MySQL, MariaDB, PostgreSQL), the tables are NOT synced
                    // They exist in their original schemas. We need to use foreign data wrapper approach
                    // OR we need to check if data has been synced to a DRA schema

                    // Check if this is a synced table by looking at the data source
                    const dataSource = await manager.query(`
                        SELECT id, data_type, connection_details
                        FROM dra_data_source
                        WHERE id = $1
                    `, [ref.data_source_id]);

                    if (dataSource && dataSource.length > 0) {
                        const dsType = dataSource[0].data_type;

                        // For API-based data sources (Google Analytics, Excel, CSV, PDF), tables are already in PostgreSQL
                        // They use their original schema.table names directly
                        if (dsType === 'google_analytics' || dsType === 'google_ads' || dsType === 'google_ads_manager' ||
                            dsType === 'excel' || dsType === 'csv' || dsType === 'pdf') {
                            console.log(`[DataSourceProcessor] API/File data source (${dsType}) - table already in PostgreSQL: ${originalRef}`);
                            tableMap.set(originalRef, {
                                schema: ref.schema,
                                table_name: ref.table,
                                data_source_id: ref.data_source_id
                            });
                            continue;
                        }

                        // For MySQL, MariaDB, PostgreSQL data sources that are external
                        // The query should use the original schema.table names
                        // But we need to qualify them with the synced schema if they've been imported
                        if (dsType === 'mysql' || dsType === 'mariadb' || dsType === 'postgresql') {
                            // Look for any table in metadata for this data source
                            const anyTable = await manager.query(`
                                SELECT 
                                    physical_table_name,
                                    schema_name,
                                    data_source_id
                                FROM dra_table_metadata
                                WHERE data_source_id = $1
                                LIMIT 1
                            `, [ref.data_source_id]);

                            if (anyTable && anyTable.length > 0) {
                                // Data IS synced - find the specific table
                                // Try matching by physical_table_name pattern (which may include original table name)
                                const tablePattern = await manager.query(`
                                    SELECT 
                                        physical_table_name,
                                        schema_name,
                                        data_source_id,
                                        logical_table_name
                                    FROM dra_table_metadata
                                    WHERE data_source_id = $1
                                    AND (
                                        physical_table_name = $2
                                        OR logical_table_name = $2
                                        OR physical_table_name LIKE $3
                                        OR physical_table_name LIKE $4
                                    )
                                    LIMIT 1
                                `, [ref.data_source_id, ref.table, `${ref.table}_%`, `%_${ref.table}_%`]);

                                if (tablePattern && tablePattern.length > 0) {
                                    metadata = tablePattern;
                                    console.log(`[DataSourceProcessor] Found synced table by pattern: ${tablePattern[0].schema_name}.${tablePattern[0].physical_table_name}`);
                                }
                            } else {
                                // Data is NOT synced - use original schema.table
                                console.log(`[DataSourceProcessor] Table not synced, using original reference: ${originalRef}`);
                                tableMap.set(originalRef, {
                                    schema: ref.schema,
                                    table_name: ref.table,
                                    data_source_id: ref.data_source_id
                                });
                                continue;
                            }
                        }
                    }
                }

                if (metadata && metadata.length > 0) {
                    const syncedInfo = {
                        schema: metadata[0].schema_name,
                        table_name: metadata[0].physical_table_name,
                        data_source_id: metadata[0].data_source_id
                    };

                    tableMap.set(originalRef, syncedInfo);
                    console.log(`[DataSourceProcessor] ✓ Mapped ${originalRef} → ${syncedInfo.schema}.${syncedInfo.table_name}`);
                } else {
                    // Fallback: Only use original names if ALL tables are from same data source
                    // For true cross-source queries (multiple sources), we need proper synced tables
                    if (isSameSource) {
                        console.warn(`[DataSourceProcessor] ⚠️ Could not find synced table for: ${originalRef} (data_source_id: ${ref.data_source_id})`);
                        console.log(`[DataSourceProcessor] Same-source query detected - using original table reference as fallback`);
                        tableMap.set(originalRef, {
                            schema: ref.schema,
                            table_name: ref.table,
                            data_source_id: ref.data_source_id
                        });
                    } else {
                        // True cross-source - don't add fallback, let it fail properly
                        console.error(`[DataSourceProcessor] ⚠️ Could not find synced table for: ${originalRef} (data_source_id: ${ref.data_source_id})`);
                        console.error(`[DataSourceProcessor] True cross-source query requires all tables to be synced to PostgreSQL`);
                    }
                }
            }

            console.log(`[DataSourceProcessor] Successfully resolved ${tableMap.size} table mappings`);
            return tableMap;

        } catch (error) {
            console.error('[DataSourceProcessor] Error resolving cross-source table names:', error);
            return tableMap;
        }
    }

    /**
     * Transforms cross-source SQL query to use synced PostgreSQL table names
     * Replaces original external table references with their synced equivalents
     * 
     * @param originalQuery - Original SQL with external table names (e.g., mysql_dra_db.orders)
     * @param tableMap - Map of original references to synced table info
     * @returns Transformed SQL query with synced table names
     */
    private transformQueryForCrossSource(
        originalQuery: string,
        tableMap: Map<string, { schema: string; table_name: string }>
    ): string {
        let transformedQuery = originalQuery;

        console.log('[DataSourceProcessor] Transforming query with synced table names...');

        // Sort table references by length (longest first) to avoid partial replacements
        const sortedRefs = Array.from(tableMap.entries()).sort((a, b) => b[0].length - a[0].length);

        for (const [originalRef, syncedInfo] of sortedRefs) {
            const replacement = `${syncedInfo.schema}.${syncedInfo.table_name}`;

            // Create regex that matches the table reference as a whole word
            // This handles: schema.table, schema.table.column, FROM schema.table, JOIN schema.table
            const escapedRef = originalRef.replace(/\./g, '\\.');
            const regex = new RegExp(`\\b${escapedRef}\\b`, 'g');

            const beforeCount = (transformedQuery.match(regex) || []).length;
            transformedQuery = transformedQuery.replace(regex, replacement);
            const afterCount = (transformedQuery.match(new RegExp(`\\b${replacement.replace(/\./g, '\\.')}\\b`, 'g')) || []).length;

            if (beforeCount > 0) {
                console.log(`[DataSourceProcessor] Replaced ${beforeCount} occurrences: ${originalRef} → ${replacement}`);
            }
        }

        return transformedQuery;
    }

    public async buildDataModelOnQuery(dataSourceId: number | null, query: string, queryJSON: string, dataModelName: string, tokenDetails: ITokenDetails, isCrossSource?: boolean, projectId?: number, dataModelId?: number): Promise<number | null> {
        return new Promise<number | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const internalDbConnector = await driver.getConcreteDriver();
            if (!internalDbConnector) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }

            let dataSource: DRADataSource | null = null;
            let externalDBConnector: DataSource;
            let dataSourceType: any = null;

            // Handle cross-source vs single-source
            if (isCrossSource && projectId) {
                console.log('[DataSourceProcessor] Building cross-source data model for project:', projectId);

                // Parse queryJSON to check data sources
                const parsedQuery = JSON.parse(queryJSON);
                const uniqueDataSourceIds = new Set<number>();

                if (parsedQuery.columns && Array.isArray(parsedQuery.columns)) {
                    parsedQuery.columns.forEach((col: any) => {
                        if (col.data_source_id) {
                            uniqueDataSourceIds.add(col.data_source_id);
                        }
                    });
                }

                console.log(`[DataSourceProcessor] Found ${uniqueDataSourceIds.size} unique data source(s) in data model`);

                // If all tables from same source, use that source directly (no transformation needed)
                if (uniqueDataSourceIds.size === 1) {
                    const singleDataSourceId = Array.from(uniqueDataSourceIds)[0];
                    console.log(`[DataSourceProcessor] All tables from same data source (${singleDataSourceId}), using direct connection`);

                    // Fetch the data source
                    const singleDataSource = await manager.findOne(DRADataSource, {
                        where: { id: singleDataSourceId },
                        relations: { project: true, users_platform: true }
                    });

                    if (!singleDataSource) {
                        console.error('[DataSourceProcessor] Could not find data source:', singleDataSourceId);
                        return resolve(null);
                    }

                    // Check if user has access
                    if (singleDataSource.users_platform?.id !== user_id) {
                        const membership = await manager.findOne(DRAProjectMember, {
                            where: {
                                user: { id: user_id },
                                project: { id: singleDataSource.project?.id }
                            }
                        });

                        if (!membership) {
                            console.error('[DataSourceProcessor] User does not have access to data source:', singleDataSourceId);
                            return resolve(null);
                        }
                    }

                    const connection = singleDataSource.connection_details;

                    // Check if it's Excel/CSV/PDF or synced MongoDB (already in PostgreSQL)
                    if (connection.data_source_type === 'excel' || connection.data_source_type === 'csv' || connection.data_source_type === 'pdf') {
                        console.log('[DataSourceProcessor] Excel/CSV/PDF data source - using internal PostgreSQL');
                        externalDBConnector = internalDbConnector;
                        dataSourceType = EDataSourceType.POSTGRESQL;
                    } else if (singleDataSource.data_type === EDataSourceType.MONGODB && singleDataSource.sync_status === 'completed' && singleDataSource.last_sync_at) {
                        console.log('[DataSourceProcessor] Synced MongoDB data source - using internal PostgreSQL');
                        externalDBConnector = internalDbConnector;
                        dataSourceType = EDataSourceType.POSTGRESQL;
                    } else if ('oauth_access_token' in connection) {
                        console.error('[DataSourceProcessor] API-based data sources not supported for data models');
                        return resolve(null);
                    } else {
                        // External database (MySQL, MariaDB, PostgreSQL) - connect directly
                        dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                        if (!dataSourceType) {
                            return resolve(null);
                        }

                        const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
                        if (!externalDriver) {
                            return resolve(null);
                        }

                        externalDBConnector = await externalDriver.connectExternalDB(connection);
                        if (!externalDBConnector) {
                            return resolve(null);
                        }
                    }
                } else if (uniqueDataSourceIds.size > 1) {
                    // True cross-source - need to resolve synced table names
                    console.log('[DataSourceProcessor] True cross-source model - attempting to resolve synced tables');

                    const tableMap = await this.resolveTableNamesForCrossSource(projectId, queryJSON, manager);

                    if (tableMap.size === 0) {
                        console.error('[DataSourceProcessor] Could not resolve cross-source table names. Tables must be synced to PostgreSQL for cross-source JOINs.');
                        return resolve(null);
                    }

                    // Transform the query to use synced table names
                    const transformedQuery = this.transformQueryForCrossSource(query, tableMap);

                    if (transformedQuery === query) {
                        console.warn('[DataSourceProcessor] Query was not transformed. This may indicate table mapping failed.');
                    }

                    // Update the query with the transformed version
                    query = transformedQuery;

                    console.log('[DataSourceProcessor] Cross-source query transformation complete');
                    console.log('[DataSourceProcessor] Transformed query:', query);

                    // Execute on internal PostgreSQL connector with synced tables
                    externalDBConnector = internalDbConnector;
                    dataSourceType = EDataSourceType.POSTGRESQL;
                } else {
                    console.error('[DataSourceProcessor] No data source IDs found in query columns');
                    return resolve(null);
                }
            } else if (dataSourceId) {
                // Single-source: fetch data source and connect
                dataSource = await manager.findOne(DRADataSource, {
                    where: { id: dataSourceId, users_platform: user }
                });
                if (!dataSource) {
                    return resolve(null);
                }

                const connection = dataSource.connection_details;
                
                // Check if it's synced MongoDB (already in PostgreSQL)
                if (dataSource.data_type === EDataSourceType.MONGODB && dataSource.sync_status === 'completed' && dataSource.last_sync_at) {
                    console.log('[DataSourceProcessor] Synced MongoDB data source - using internal PostgreSQL');
                    externalDBConnector = internalDbConnector;
                    dataSourceType = EDataSourceType.POSTGRESQL;
                } else if ('oauth_access_token' in connection) {
                    // Skip API-based data sources
                    return resolve(null);
                } else {
                    // External database (MySQL, MariaDB, PostgreSQL) - connect directly
                    dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                    if (!dataSourceType) {
                        return resolve(null);
                    }

                    const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
                    if (!externalDriver) {
                        return resolve(null);
                    }

                    externalDBConnector = await externalDriver.connectExternalDB(connection);
                    if (!externalDBConnector) {
                        return resolve(null);
                    }
                }
            } else {
                return resolve(null);
            }
            try {
                // Validate SQL aggregate correctness before executing query
                const validation = this.validateGroupByRequirements(queryJSON);
                if (!validation.valid) {
                    console.error('[DataSourceProcessor] SQL validation failed:', validation.error);
                    throw new Error(validation.error);
                }

                dataModelName = UtilityService.getInstance().uniquiseName(dataModelName);
                
                // CRITICAL FIX: Always reconstruct SQL from JSON for data model building
                // The frontend buildSQLQuery() generates different column aliases than what the
                // INSERT code expects. For single-table queries, frontend uses "tableName_col"
                // but INSERT code looks up rows by "schema_tableName_col". Reconstructing from
                // JSON ensures aliases match the INSERT row key format, preventing null data.
                // This is consistent with executeQueryOnExternalDataSource() which also reconstructs.
                let selectTableQuery: string;
                try {
                    selectTableQuery = this.reconstructSQLFromJSON(queryJSON);
                    
                    // Preserve LIMIT/OFFSET from original query if not in reconstructed SQL
                    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
                    const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
                    if (limitMatch && !selectTableQuery.toUpperCase().includes('LIMIT')) {
                        selectTableQuery += ` LIMIT ${limitMatch[1]}`;
                    }
                    if (offsetMatch && !selectTableQuery.toUpperCase().includes('OFFSET')) {
                        selectTableQuery += ` OFFSET ${offsetMatch[1]}`;
                    }
                    
                    console.log('[DataSourceProcessor] Reconstructed SQL for data model build:', selectTableQuery);
                } catch (reconstructError) {
                    console.error('[DataSourceProcessor] SQL reconstruction failed, falling back to frontend SQL:', reconstructError);
                    selectTableQuery = `${query}`;
                }
                const rowsFromDataSource = await externalDBConnector.query(selectTableQuery);
                //Create the table first then insert the data.
                let createTableQuery = `CREATE TABLE ${dataModelName} `;
                const sourceTable = JSON.parse(queryJSON);
                
                // CRITICAL FIX: Filter columns for table creation but preserve full array in saved query JSON
                // Only create table columns for: selected columns OR hidden referenced columns
                const columnsForTableCreation = sourceTable.columns.filter((col: any) => {
                    // Include if selected for display
                    if (col.is_selected_column) return true;
                    
                    // Include if tracked as hidden reference (aggregate, GROUP BY, WHERE, HAVING, ORDER BY, etc.)
                    const isTracked = sourceTable.hidden_referenced_columns?.some(
                        (tracked: any) => tracked.schema === col.schema &&
                                   tracked.table_name === col.table_name &&
                                   tracked.column_name === col.column_name
                    );
                    return isTracked;
                });
                
                console.log(`[DataSourceProcessor] Column preservation: Total=${sourceTable.columns.length}, ForTable=${columnsForTableCreation.length}`);
                
                let columns = '';
                let insertQueryColumns = '';
                columnsForTableCreation.forEach((column: any, index: number) => {
                    let columnSize = '';

                    // Only apply character_maximum_length to string types, and cap NUMERIC precision at 1000
                    if (column?.character_maximum_length) {
                        const maxLength = column.character_maximum_length;
                        const columnDataType = column.data_type?.toUpperCase() || '';

                        // For NUMERIC/DECIMAL types, cap precision at 1000 (PostgreSQL limit)
                        if (columnDataType.includes('NUMERIC') || columnDataType.includes('DECIMAL')) {
                            columnSize = maxLength > 1000 ? '' : `(${maxLength})`;
                        }
                        // For string types, use the length as-is
                        else if (columnDataType.includes('CHAR') || columnDataType.includes('TEXT') || columnDataType.includes('VARCHAR')) {
                            columnSize = `(${maxLength})`;
                        }
                        // For other types, don't apply size
                    }

                    // Check if column.data_type already contains size information (e.g., "varchar(1024)")
                    // If it does, don't append columnSize again to avoid "VARCHAR(1024)(1024)"
                    const dataTypeAlreadyHasSize = column.data_type && /\(\s*\d+(?:,\d+)?\s*\)/.test(column.data_type);
                    const columnType = dataTypeAlreadyHasSize ? column.data_type : `${column.data_type}${columnSize}`;


                    // For cross-source models, use the column's data_source_type; for single-source, use the global dataSourceType
                    const columnDataSourceType = isCrossSource && column.data_source_type
                        ? UtilityService.getInstance().getDataSourceType(column.data_source_type)
                        : dataSourceType;

                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(columnDataSourceType, columnType);
                    let dataTypeString = '';
                    if (dataType.size) {
                        dataTypeString = `${dataType.type}(${dataType.size})`;
                    } else {
                        dataTypeString = `${dataType.type}`;
                    }

                    // Override data type if transform function is applied
                    if (column.transform_function) {
                        const transformFunc = column.transform_function.toUpperCase();
                        if (transformFunc === 'DATE') {
                            dataTypeString = 'DATE';
                        } else if (transformFunc === 'YEAR' || transformFunc === 'MONTH' || transformFunc === 'DAY') {
                            dataTypeString = 'INTEGER';
                        } else if (transformFunc === 'UPPER' || transformFunc === 'LOWER' || transformFunc === 'TRIM') {
                            dataTypeString = 'TEXT';
                        } else if (transformFunc === 'ROUND') {
                            dataTypeString = 'NUMERIC';
                        }
                    }

                    // Determine column name - use alias if provided, otherwise construct from schema_table_column
                    let columnName;
                    if (column.alias_name && column.alias_name !== '') {
                        columnName = column.alias_name;
                    } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_mongodb' || column.schema === 'dra_meta_ads')) {
                        // For special schemas (Excel, PDF, GA, GAM, Google Ads, MongoDB, Meta Ads), always use table_name regardless of aliases
                        // This preserves datasource IDs in table names (e.g., device_15, sheet_123, revenue_12345_7)
                        columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                    } else {
                        columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                    }
                    
                    if (index < columnsForTableCreation.length - 1) {
                        columns += `${columnName} ${dataTypeString}, `;
                        insertQueryColumns += `${columnName},`;
                    } else {
                        columns += `${columnName} ${dataTypeString} `;
                        insertQueryColumns += `${columnName}`;
                    }
                });
                // Handle calculated columns
                if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                    columns += ', ';
                    insertQueryColumns += ', ';
                    sourceTable.calculated_columns.forEach((column: any, index: number) => {
                        if (index < sourceTable.calculated_columns.length - 1) {
                            columns += `${column.column_name} NUMERIC, `;
                            insertQueryColumns += `${column.column_name}, `;
                        } else {
                            columns += `${column.column_name} NUMERIC`;
                            insertQueryColumns += `${column.column_name}`;
                        }
                    });
                }

                // Handle GROUP BY aggregate function columns
                if (sourceTable.query_options?.group_by?.aggregate_functions && sourceTable.query_options.group_by.aggregate_functions.length > 0) {
                    const aggregateFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
                    const validAggFuncs = sourceTable.query_options.group_by.aggregate_functions.filter(
                        (aggFunc: any) => aggFunc.aggregate_function !== '' && aggFunc.column !== ''
                    );

                    if (validAggFuncs.length > 0) {
                        // Only add comma if there's content before (regular columns always exist, or calculated columns were added)
                        columns += ', ';
                        insertQueryColumns += ', ';

                        validAggFuncs.forEach((aggFunc: any, index: number) => {
                            // Determine column alias name
                            let aliasName = aggFunc.column_alias_name;
                            if (!aliasName || aliasName === '') {
                                const columnParts = aggFunc.column.split('.');
                                const columnName = columnParts[columnParts.length - 1];
                                aliasName = `${aggregateFunctions[aggFunc.aggregate_function]}_${columnName}`.toLowerCase();
                            }

                            // Add column to CREATE TABLE statement
                            if (index < validAggFuncs.length - 1) {
                                columns += `${aliasName} NUMERIC, `;
                                insertQueryColumns += `${aliasName}, `;
                            } else {
                                columns += `${aliasName} NUMERIC`;
                                insertQueryColumns += `${aliasName}`;
                            }
                        });
                    }
                }
                
                // Handle GROUP BY aggregate expressions (complex expressions like quantity * price, CASE statements)
                if (sourceTable.query_options?.group_by?.aggregate_expressions && 
                    sourceTable.query_options.group_by.aggregate_expressions.length > 0) {
                    const validExpressions = sourceTable.query_options.group_by.aggregate_expressions.filter(
                        (expr: any) => expr.column_alias_name && expr.column_alias_name !== ''
                    );

                    if (validExpressions.length > 0) {
                        columns += ', ';
                        insertQueryColumns += ', ';

                        validExpressions.forEach((expr: any, index: number) => {
                            const aliasName = expr.column_alias_name;
                            
                            // CRITICAL: Use column_data_type if provided (inferred from expression), otherwise default to NUMERIC
                            let dataTypeString = 'NUMERIC';
                            if (expr.column_data_type && expr.column_data_type !== '') {
                                // Map frontend data types to PostgreSQL types
                                const exprType = expr.column_data_type.toLowerCase();
                                if (exprType === 'text' || exprType.includes('char') || exprType.includes('varchar')) {
                                    dataTypeString = 'TEXT';
                                } else if (exprType === 'numeric' || exprType === 'decimal' || exprType.includes('int')) {
                                    dataTypeString = 'NUMERIC';
                                } else if (exprType === 'boolean') {
                                    dataTypeString = 'BOOLEAN';
                                } else if (exprType.includes('timestamp') || exprType.includes('date')) {
                                    dataTypeString = exprType.toUpperCase();
                                } else {
                                    dataTypeString = expr.column_data_type.toUpperCase();
                                }
                                console.log(`[DataSourceProcessor] Using inferred data type for aggregate expression ${aliasName}: ${dataTypeString} (from ${expr.column_data_type})`);
                            }
                            
                            if (index < validExpressions.length - 1) {
                                columns += `${aliasName} ${dataTypeString}, `;
                                insertQueryColumns += `${aliasName}, `;
                            } else {
                                columns += `${aliasName} ${dataTypeString}`;
                                insertQueryColumns += `${aliasName}`;
                            }
                        });
                    }
                }

                createTableQuery += `(${columns})`;

                await internalDbConnector.query(createTableQuery);

                insertQueryColumns = `(${insertQueryColumns})`;

                // Track column data types for proper value formatting
                const columnDataTypes = new Map<string, string>();
                columnsForTableCreation.forEach((column: any) => {
                    // Use same column name construction logic as INSERT loop to ensure key match
                    let columnName;
                    if (column.alias_name && column.alias_name !== '') {
                        columnName = column.alias_name;
                    } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_mongodb' || column.schema === 'dra_meta_ads')) {
                        // For special schemas (Excel, PDF, GA, GAM, Google Ads, MongoDB, Meta Ads), always use table_name regardless of aliases
                        columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                    } else {
                        columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                    }
                    const columnSize = column?.character_maximum_length ? `(${column?.character_maximum_length})` : '';
                    const columnType = `${column.data_type}${columnSize}`;

                    // For cross-source models, use the column's data_source_type; for single-source, use the global dataSourceType
                    const columnDataSourceType = isCrossSource && column.data_source_type
                        ? UtilityService.getInstance().getDataSourceType(column.data_source_type)
                        : dataSourceType;

                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(columnDataSourceType, columnType);
                    let dataTypeString = '';
                    if (dataType.size) {
                        dataTypeString = `${dataType.type}(${dataType.size})`;
                    } else {
                        dataTypeString = `${dataType.type}`;
                    }

                    // Override data type if transform function is applied
                    if (column.transform_function) {
                        const transformFunc = column.transform_function.toUpperCase();
                        if (transformFunc === 'DATE') {
                            dataTypeString = 'DATE';
                        } else if (transformFunc === 'YEAR' || transformFunc === 'MONTH' || transformFunc === 'DAY') {
                            dataTypeString = 'INTEGER';
                        } else if (transformFunc === 'UPPER' || transformFunc === 'LOWER' || transformFunc === 'TRIM') {
                            dataTypeString = 'TEXT';
                        } else if (transformFunc === 'ROUND') {
                            dataTypeString = 'NUMERIC';
                        }
                    }

                    columnDataTypes.set(columnName, dataTypeString);
                });

                // Add aggregate expressions to columnDataTypes map
                if (sourceTable.query_options?.group_by?.aggregate_expressions) {
                    sourceTable.query_options.group_by.aggregate_expressions.forEach((expr: any) => {
                        if (expr.column_alias_name && expr.column_alias_name !== '') {
                            // Use column_data_type if provided, otherwise default to NUMERIC
                            const dataType = expr.column_data_type || 'NUMERIC';
                            columnDataTypes.set(expr.column_alias_name, dataType.toUpperCase());
                            console.log(`[DataSourceProcessor] Set data type for aggregate expression ${expr.column_alias_name}: ${dataType}`);
                        }
                    });
                }
                
                let failedInserts = 0;
                for (let index = 0; index < rowsFromDataSource.length; index++) {
                    const row = rowsFromDataSource[index];
                    let insertQuery = `INSERT INTO ${dataModelName} `;
                    let values = '';
                    columnsForTableCreation.forEach((column: any, columnIndex: number) => {
                        // Determine row key - use alias if provided for data lookup
                        let rowKey;
                        let columnName;
                        if (column.alias_name && column.alias_name !== '') {
                            rowKey = column.alias_name;
                            columnName = column.alias_name;
                        } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_mongodb' || column.schema === 'dra_meta_ads')) {
                            // For special schemas (Excel, PDF, GA, GAM, Google Ads, MongoDB, Meta Ads), always use table_name regardless of aliases
                            // This preserves datasource IDs in table names and ensures frontend-backend consistency
                            columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                            rowKey = columnName;
                        } else {
                            columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                            // When alias is empty, frontend generates alias as schema_table_column
                            rowKey = `${column.schema}_${column.table_name}_${column.column_name}`;
                        }

                        // Get the column data type and format the value accordingly
                        const columnType = columnDataTypes.get(columnName) || 'TEXT';

                        // Log JSON/JSONB/DATE columns for debugging (first row only)
                        if ((columnType.toUpperCase().includes('JSON') ||
                            columnType.toUpperCase().includes('DATE') ||
                            columnType.toUpperCase().includes('TIME') ||
                            columnType.toUpperCase().includes('TIMESTAMP')) &&
                            index === 0) {
                            console.log(`Column ${columnName} (${columnType}):`, typeof row[rowKey], row[rowKey]);
                        }

                        const formattedValue = this.formatValueForSQL(row[rowKey], columnType, columnName);
                        
                        if (columnIndex < columnsForTableCreation.length - 1) {
                            values += `${formattedValue},`;
                        } else {
                            values += formattedValue;
                        }
                    });
                    // Handle calculated column values - use formatValueForSQL for proper type handling
                    if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                        values += ',';
                        sourceTable.calculated_columns.forEach((column: any, columnIndex: number) => {
                            const columnName = column.column_name;
                            const formattedVal = this.formatValueForSQL(row[columnName], 'NUMERIC', columnName);
                            if (columnIndex < sourceTable.calculated_columns.length - 1) {
                                values += `${formattedVal},`;
                            } else {
                                values += `${formattedVal}`;
                            }
                        });
                    }
                    
                    // Handle aggregate function values - use formatValueForSQL for proper type handling
                    if (sourceTable.query_options?.group_by?.aggregate_functions && sourceTable.query_options.group_by.aggregate_functions.length > 0) {
                        const aggregateFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
                        const validAggFuncs = sourceTable.query_options.group_by.aggregate_functions.filter(
                            (aggFunc: any) => aggFunc.aggregate_function !== '' && aggFunc.column !== ''
                        );

                        if (validAggFuncs.length > 0) {
                            values += ',';
                            validAggFuncs.forEach((aggFunc: any, columnIndex: number) => {
                                let aliasName = aggFunc.column_alias_name;
                                let rowKey = aliasName; // Key to lookup in row data

                                if (!aliasName || aliasName === '') {
                                    // When no alias is provided, PostgreSQL uses lowercase function name as column name
                                    const funcName = aggregateFunctions[aggFunc.aggregate_function].toLowerCase();
                                    rowKey = funcName; // PostgreSQL default: 'sum', 'avg', 'count', 'min', 'max'

                                    // Generate alias for table column name
                                    const columnParts = aggFunc.column.split('.');
                                    const columnName = columnParts[columnParts.length - 1];
                                    aliasName = `${funcName}_${columnName}`.toLowerCase();
                                }
                                
                                const formattedVal = this.formatValueForSQL(row[rowKey], 'NUMERIC', aliasName);
                                if (columnIndex < validAggFuncs.length - 1) {
                                    values += `${formattedVal},`;
                                } else {
                                    values += `${formattedVal}`;
                                }
                            });
                        }
                    }
                    
                    // Handle aggregate expression values - use formatValueForSQL with inferred data type
                    if (sourceTable.query_options?.group_by?.aggregate_expressions && 
                        sourceTable.query_options.group_by.aggregate_expressions.length > 0) {
                        const validExpressions = sourceTable.query_options.group_by.aggregate_expressions.filter(
                            (expr: any) => expr.column_alias_name && expr.column_alias_name !== ''
                        );

                        if (validExpressions.length > 0) {
                            values += ',';
                            validExpressions.forEach((expr: any, index: number) => {
                                const aliasName = expr.column_alias_name;
                                const exprDataType = columnDataTypes.get(aliasName) || 'NUMERIC';
                                const formattedVal = this.formatValueForSQL(row[aliasName], exprDataType, aliasName);
                                
                                if (index < validExpressions.length - 1) {
                                    values += `${formattedVal},`;
                                } else {
                                    values += `${formattedVal}`;
                                }
                            });
                        }
                    }

                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                    try {
                        await internalDbConnector.query(insertQuery);
                    } catch (insertError: any) {
                        failedInserts++;
                        if (failedInserts <= 3) {
                            console.error(`[DataSourceProcessor] INSERT failed for row ${index}:`, insertError?.message || insertError);
                            console.error(`[DataSourceProcessor] Failed query:`, insertQuery.substring(0, 500));
                        }
                    }
                }
                const successfulInserts = rowsFromDataSource.length - failedInserts;
                console.log(`[DataSourceProcessor] Inserted ${successfulInserts}/${rowsFromDataSource.length} rows into ${dataModelName} (${failedInserts} failed)`);
                const dataModel = new DRADataModel();
                dataModel.schema = 'public';
                dataModel.name = dataModelName;
                dataModel.sql_query = selectTableQuery;
                dataModel.query = JSON.parse(queryJSON);

                // Set data_source for single-source, null for cross-source
                if (isCrossSource) {
                    dataModel.data_source = null;
                    dataModel.is_cross_source = true;
                } else {
                    dataModel.data_source = dataSource;
                    dataModel.is_cross_source = false;
                }

                dataModel.users_platform = user;
                const savedDataModel = await manager.save(dataModel);

                // For cross-source models, populate the DRADataModelSource junction table
                if (isCrossSource && projectId) {
                    // Extract unique data source IDs from the query JSON
                    const parsedQuery = JSON.parse(queryJSON);
                    const dataSourceIds = new Set<number>();

                    if (parsedQuery.columns) {
                        parsedQuery.columns.forEach((col: any) => {
                            if (col.data_source_id) {
                                dataSourceIds.add(col.data_source_id);
                            }
                        });
                    }

                    // Create junction table entries for each data source
                    for (const dsId of dataSourceIds) {
                        const junction = new DRADataModelSource();
                        junction.data_model_id = savedDataModel.id;
                        junction.data_source_id = dsId;
                        junction.users_platform_id = user.id;
                        await manager.save(junction);
                    }

                    console.log(`[DataSourceProcessor] Created ${dataSourceIds.size} data model source links`);
                }

                return resolve(savedDataModel.id);
            } catch (error) {
                console.error('[DataSourceProcessor] Error building data model:', error);
                return reject(error);
            }
        });
    }

    public async addExcelDataSource(dataSourceName: string, fileId: string, data: string, tokenDetails: ITokenDetails, projectId: number, dataSourceId: number = null, sheetInfo?: any): Promise<IExcelDataSourceReturn> {
        return new Promise<IExcelDataSourceReturn>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { id: projectId, users_platform: user } });
            if (project) {
                let dataSource = new DRADataSource();
                const sheetsProcessed = [];
                if (!dataSourceId) {
                    //the tables will be saved in the platform's own database but in a dedicated schema
                    const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                    const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                    const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                    const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                    const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                    //The excel files will be saved as tables in the dra_excel schema which will be separate from the public schema.
                    let query = `CREATE SCHEMA IF NOT EXISTS dra_excel`;
                    await dbConnector.query(query);
                    const connection: IDBConnectionDetails = {
                        data_source_type: UtilityService.getInstance().getDataSourceType('postgresql'),
                        host: host,
                        port: port,
                        schema: 'dra_excel',
                        database: database,
                        username: username,
                        password: password,
                    };
                    dataSource.name = dataSourceName;
                    dataSource.connection_details = connection;
                    dataSource.data_type = EDataSourceType.EXCEL;
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId, project: project, users_platform: user } });
                }

                try {
                    const parsedTableStructure = JSON.parse(data);
                    // Get sheet information
                    const sheetName = sheetInfo?.sheet_name || 'Sheet1';
                    const sheetId = sheetInfo?.sheet_id || `sheet_${Date.now()}`;
                    const originalSheetName = sheetInfo?.original_sheet_name || sheetName;
                    const sheetIndex = sheetInfo?.sheet_index || 0;

                    // CRITICAL: Use hash-based short table name to avoid PostgreSQL 63-char limit
                    // Generate logical name (human-readable, can be any length)
                    const logicalTableName = `${sheetName}`;

                    // Generate short physical name using hash (e.g., ds23_a7b3c9d1)
                    const tableMetadataService = TableMetadataService.getInstance();
                    const physicalTableName = tableMetadataService.generatePhysicalTableName(
                        dataSource.id,
                        logicalTableName,
                        fileId
                    );

                    console.log(`[Excel Upload] Physical table: ${physicalTableName}, Logical: ${logicalTableName}`);

                    let createTableQuery = `CREATE TABLE dra_excel."${physicalTableName}" `;
                    let columns = '';
                    let insertQueryColumns = '';
                    const sanitizedColumns: Array<{
                        original: string,
                        sanitized: string,
                        type: string,
                        title?: string,
                        key?: string,
                        originalTitle?: string,
                        displayTitle?: string
                    }> = [];

                    if (parsedTableStructure.columns && parsedTableStructure.columns.length > 0) {
                        parsedTableStructure.columns.forEach((column: any, index: number) => {
                            // Use renamed title if available, fall back to original names
                            const displayColumnName = column.title || column.column_name || `column_${index}`;
                            const originalColumnName = column.originalTitle || column.original_title || column.column_name || displayColumnName;
                            const columnKey = column.originalKey || column.original_key || column.key || displayColumnName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');

                            // Sanitize the display name for database usage
                            const sanitizedColumnName = this.sanitizeColumnName(displayColumnName);

                            sanitizedColumns.push({
                                original: originalColumnName,
                                sanitized: sanitizedColumnName,
                                type: column.type,
                                title: displayColumnName,
                                key: columnKey,
                                originalTitle: originalColumnName,
                                displayTitle: displayColumnName
                            });

                            const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.EXCEL, column.type);
                            let dataTypeString = '';
                            if (dataType.size) {
                                dataTypeString = `${dataType.type}(${dataType.size})`;
                            } else {
                                dataTypeString = `${dataType.type}`;
                            }

                            if (index < parsedTableStructure.columns.length - 1) {
                                columns += `${sanitizedColumnName} ${dataTypeString},`;
                                insertQueryColumns += `${sanitizedColumnName},`;
                            } else {
                                columns += `${sanitizedColumnName} ${dataTypeString}`;
                                insertQueryColumns += `${sanitizedColumnName}`;
                            }
                        });

                        createTableQuery += `(${columns})`;

                        try {
                            // Create the table
                            await dbConnector.query(createTableQuery);
                            console.log('[Excel Upload] Successfully created physical table:', physicalTableName, 'for logical table:', logicalTableName);

                            insertQueryColumns = `(${insertQueryColumns})`;

                            // Insert data rows
                            if (parsedTableStructure.rows && parsedTableStructure.rows.length > 0) {
                                let successfulInserts = 0;
                                let failedInserts = 0;

                                for (let rowIndex = 0; rowIndex < parsedTableStructure.rows.length; rowIndex++) {
                                    const row = parsedTableStructure.rows[rowIndex];
                                    let insertQuery = `INSERT INTO dra_excel."${physicalTableName}" `;
                                    let values = '';

                                    sanitizedColumns.forEach((columnInfo, colIndex) => {
                                        // Try multiple ways to get the value for renamed columns
                                        let value = undefined;
                                        const originalColumn = parsedTableStructure.columns[colIndex];

                                        // Frontend sends flattened row data, so try direct access first
                                        // Strategy 1: Use current column title (handles renamed columns)
                                        if (originalColumn?.title && row[originalColumn.title] !== undefined) {
                                            value = row[originalColumn.title];
                                        }
                                        // Strategy 2: Use original title if column was renamed
                                        else if (columnInfo.originalTitle && row[columnInfo.originalTitle] !== undefined) {
                                            value = row[columnInfo.originalTitle];
                                        }
                                        // Strategy 3: Use column key 
                                        else if (originalColumn?.key && row[originalColumn.key] !== undefined) {
                                            value = row[originalColumn.key];
                                        }
                                        // Strategy 4: Use original key if available
                                        else if (columnInfo.key && row[columnInfo.key] !== undefined) {
                                            value = row[columnInfo.key];
                                        }
                                        // Strategy 5: Use original column name
                                        else if (row[columnInfo.original] !== undefined) {
                                            value = row[columnInfo.original];
                                        }
                                        // Strategy 4: Try nested data structure (fallback)
                                        else if (row.data) {
                                            if (originalColumn?.title && row.data[originalColumn.title] !== undefined) {
                                                value = row.data[originalColumn.title];
                                            } else if (originalColumn?.key && row.data[originalColumn.key] !== undefined) {
                                                value = row.data[originalColumn.key];
                                            } else if (row.data[columnInfo.original] !== undefined) {
                                                value = row.data[columnInfo.original];
                                            }
                                        }
                                        if (colIndex > 0) {
                                            values += ', ';
                                        }

                                        // Handle different data types properly with comprehensive escaping
                                        if (value === null || value === undefined || value === '') {
                                            values += 'NULL';
                                        } else if (columnInfo.type === 'boolean') {
                                            const boolValue = this.convertToPostgresBoolean(value);
                                            values += boolValue;
                                        } else if (typeof value === 'string') {
                                            const escapedValue = this.escapeStringValue(value);
                                            values += `'${escapedValue}'`;
                                        } else if (typeof value === 'number') {
                                            // Ensure it's a valid number
                                            if (isNaN(value) || !isFinite(value)) {
                                                values += 'NULL';
                                            } else {
                                                values += `${value}`;
                                            }
                                        } else {
                                            // For other types, convert to string and escape
                                            const stringValue = String(value);
                                            const escapedValue = this.escapeStringValue(stringValue);
                                            values += `'${escapedValue}'`;
                                        }
                                    });

                                    insertQuery += `${insertQueryColumns} VALUES(${values})`;
                                    try {
                                        const result = await dbConnector.query(insertQuery);
                                        successfulInserts++;
                                    } catch (error) {
                                        failedInserts++;
                                        console.error(`ERROR inserting row ${rowIndex + 1}:`, error);
                                        console.error('Failed query:', insertQuery);
                                        console.error('Row data:', JSON.stringify(row, null, 2));
                                        console.error('Column mappings:', sanitizedColumns);
                                        throw error;
                                    }
                                }

                                // Verify data was actually inserted by counting rows in the table
                                try {
                                    const countQuery = `SELECT COUNT(*) as row_count FROM dra_excel."${physicalTableName}"`;
                                    const countResult = await dbConnector.query(countQuery);
                                    const actualRowCount = countResult[0]?.row_count || 0;

                                    if (actualRowCount === 0 && parsedTableStructure.rows.length > 0) {
                                        console.error('WARNING: No rows found in database despite successful insertions!');
                                    } else if (actualRowCount !== parsedTableStructure.rows.length) {
                                        console.warn(`Row count mismatch: Expected ${parsedTableStructure.rows.length}, found ${actualRowCount}`);
                                    }
                                } catch (error) {
                                    console.error('Error verifying row count:', error);
                                }
                                console.log(`Successfully inserted all ${parsedTableStructure.rows.length} rows`);
                            } else {
                                console.log('No rows to insert - parsedTableStructure.rows is empty or undefined');
                            }
                            // Log column mapping for renamed columns
                            const renamedColumns = sanitizedColumns.filter(col =>
                                col.originalTitle && col.displayTitle && col.originalTitle !== col.displayTitle
                            );
                            // Track processed sheet
                            sheetsProcessed.push({
                                sheet_id: sheetId,
                                sheet_name: sheetName,
                                table_name: physicalTableName, // Physical hash-based table name
                                original_sheet_name: originalSheetName,
                                sheet_index: sheetIndex
                            });
                            console.log(`[Excel Upload] Successfully processed sheet: ${sheetName} -> physical table: ${physicalTableName}`);

                            // Store table metadata for physical-to-logical name mapping
                            await tableMetadataService.storeTableMetadata(manager, {
                                dataSourceId: dataSource.id,
                                usersPlatformId: user.id,
                                schemaName: 'dra_excel',
                                physicalTableName: physicalTableName,
                                logicalTableName: logicalTableName,
                                originalSheetName: originalSheetName,
                                fileId: fileId,
                                tableType: 'excel'
                            });
                            console.log('[Excel Upload] Table metadata stored for:', physicalTableName);
                        } catch (error) {
                            console.error('Error creating table:', error);
                            console.error('Failed query:', createTableQuery);
                            throw error;
                        }
                    }

                    console.log('Excel data source processing completed successfully');
                    return resolve({
                        status: 'success',
                        file_id: fileId,
                        data_source_id: dataSource.id,
                        sheets_processed: sheetsProcessed
                    });

                } catch (error) {
                    console.error('Error processing Excel data source:', error);
                    console.error('Sheet info:', sheetInfo);
                    console.error('Data structure:', data?.substring(0, 500) + '...');
                    return resolve({ status: 'error', file_id: fileId });
                }
            }
            return resolve({ status: 'error', file_id: fileId });
        });
    }

    /**
     * Add Excel data source from uploaded file (server-side processing)
     * This method handles large Excel files by processing them server-side,
     * avoiding the "request entity too large" error from JSON payloads
     * @param dataSourceName - Name for the data source
     * @param fileId - Unique file identifier
     * @param filePath - Path to the uploaded Excel file
     * @param tokenDetails - User authentication details
     * @param projectId - Project ID
     * @param dataSourceId - Existing data source ID (optional, for multi-sheet updates)
     * @returns Promise with upload result
     */
    public async addExcelDataSourceFromFile(
        dataSourceName: string,
        fileId: string,
        filePath: string,
        tokenDetails: ITokenDetails,
        projectId: number,
        dataSourceId: number = null
    ): Promise<IExcelDataSourceReturn & { error?: string }> {
        return new Promise(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ status: 'error', file_id: fileId, error: 'Database driver not available' });
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve({ status: 'error', file_id: fileId, error: 'Database connector not available' });
            }
            const manager = dbConnector.manager;
            if (!manager) {
                return resolve({ status: 'error', file_id: fileId, error: 'Database manager not available' });
            }

            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve({ status: 'error', file_id: fileId, error: 'User not found' });
            }

            const project: DRAProject | null = await manager.findOne(DRAProject, { 
                where: { id: projectId, users_platform: user } 
            });
            if (!project) {
                return resolve({ status: 'error', file_id: fileId, error: 'Project not found' });
            }

            try {
                // Parse the Excel file server-side
                console.log('[Excel File Upload] Parsing file:', filePath);
                const parseResult = await ExcelFileService.getInstance().parseExcelFileFromPath(filePath);
                
                if (!parseResult.sheets || parseResult.sheets.length === 0) {
                    return resolve({ 
                        status: 'error', 
                        file_id: fileId, 
                        error: 'No valid sheets found in Excel file' 
                    });
                }

                let dataSource: DRADataSource;
                const sheetsProcessed = [];

                if (!dataSourceId) {
                    // Create new data source
                    dataSource = new DRADataSource();
                    const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                    const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                    const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                    const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                    const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                    // Create dra_excel schema if it doesn't exist
                    let query = `CREATE SCHEMA IF NOT EXISTS dra_excel`;
                    await dbConnector.query(query);

                    const connection: IDBConnectionDetails = {
                        data_source_type: UtilityService.getInstance().getDataSourceType('postgresql'),
                        host: host,
                        port: port,
                        schema: 'dra_excel',
                        database: database,
                        username: username,
                        password: password,
                    };

                    dataSource.name = dataSourceName;
                    dataSource.connection_details = connection;
                    dataSource.data_type = EDataSourceType.EXCEL;
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { 
                        where: { id: dataSourceId, project: project, users_platform: user } 
                    });
                    if (!dataSource) {
                        return resolve({ 
                            status: 'error', 
                            file_id: fileId, 
                            error: 'Data source not found' 
                        });
                    }
                }

                const tableMetadataService = TableMetadataService.getInstance();

                // Process each sheet
                for (const sheet of parseResult.sheets) {
                    console.log(`[Excel File Upload] Processing sheet: ${sheet.name}`);

                    // Generate physical and logical table names
                    const logicalTableName = sheet.name;
                    const physicalTableName = tableMetadataService.generatePhysicalTableName(
                        dataSource.id,
                        logicalTableName,
                        fileId
                    );

                    console.log(`[Excel File Upload] Physical: ${physicalTableName}, Logical: ${logicalTableName}`);

                    // Build CREATE TABLE query
                    let createTableQuery = `CREATE TABLE dra_excel."${physicalTableName}" `;
                    let columns = '';
                    let insertQueryColumns = '';
                    const sanitizedColumns: Array<{
                        original: string;
                        sanitized: string;
                        type: string;
                        title: string;
                        key: string;
                    }> = [];

                    sheet.columns.forEach((column, index) => {
                        const displayColumnName = column.title || `column_${index}`;
                        const sanitizedColumnName = this.sanitizeColumnName(displayColumnName);

                        sanitizedColumns.push({
                            original: column.title,
                            sanitized: sanitizedColumnName,
                            type: column.type,
                            title: displayColumnName,
                            key: column.key
                        });

                        const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(
                            EDataSourceType.EXCEL, 
                            column.type
                        );
                        let dataTypeString = dataType.size 
                            ? `${dataType.type}(${dataType.size})` 
                            : `${dataType.type}`;

                        if (index < sheet.columns.length - 1) {
                            columns += `${sanitizedColumnName} ${dataTypeString},`;
                            insertQueryColumns += `${sanitizedColumnName},`;
                        } else {
                            columns += `${sanitizedColumnName} ${dataTypeString}`;
                            insertQueryColumns += `${sanitizedColumnName}`;
                        }
                    });

                    createTableQuery += `(${columns})`;

                    try {
                        // Create the table
                        await dbConnector.query(createTableQuery);
                        console.log('[Excel File Upload] Created table:', physicalTableName);

                        insertQueryColumns = `(${insertQueryColumns})`;

                        // Insert data rows in batches for better performance
                        if (sheet.rows && sheet.rows.length > 0) {
                            const batchSize = 1000;
                            let successfulInserts = 0;

                            for (let batchStart = 0; batchStart < sheet.rows.length; batchStart += batchSize) {
                                const batchEnd = Math.min(batchStart + batchSize, sheet.rows.length);
                                const batch = sheet.rows.slice(batchStart, batchEnd);

                                for (const row of batch) {
                                    let insertQuery = `INSERT INTO dra_excel."${physicalTableName}" `;
                                    let values = '';

                                    sanitizedColumns.forEach((columnInfo, colIndex) => {
                                        let value = row[columnInfo.original];

                                        if (colIndex > 0) {
                                            values += ', ';
                                        }

                                        // Handle different data types
                                        if (value === null || value === undefined || value === '') {
                                            values += 'NULL';
                                        } else if (typeof value === 'boolean') {
                                            values += value ? 'TRUE' : 'FALSE';
                                        } else if (typeof value === 'number') {
                                            values += value;
                                        } else if (value instanceof Date) {
                                            values += `'${value.toISOString()}'`;
                                        } else {
                                            // Escape string values
                                            const stringValue = String(value).replace(/'/g, "''");
                                            values += `'${stringValue}'`;
                                        }
                                    });

                                    insertQuery += `${insertQueryColumns} VALUES(${values})`;

                                    try {
                                        await dbConnector.query(insertQuery);
                                        successfulInserts++;
                                    } catch (error) {
                                        console.error(`Error inserting row:`, error.message);
                                        throw error;
                                    }
                                }

                                console.log(`[Excel File Upload] Inserted batch ${batchStart}-${batchEnd} (${successfulInserts}/${sheet.rows.length})`);
                            }

                            console.log(`[Excel File Upload] Successfully inserted ${successfulInserts} rows`);
                        }

                        // Store table metadata
                        await tableMetadataService.storeTableMetadata(manager, {
                            dataSourceId: dataSource.id,
                            usersPlatformId: user.id,
                            schemaName: 'dra_excel',
                            physicalTableName: physicalTableName,
                            logicalTableName: logicalTableName,
                            originalSheetName: sheet.metadata.originalSheetName,
                            fileId: fileId,
                            tableType: 'excel'
                        });

                        sheetsProcessed.push({
                            sheet_id: `sheet_${sheet.index}`,
                            sheet_name: sheet.name,
                            table_name: physicalTableName,
                            original_sheet_name: sheet.metadata.originalSheetName,
                            sheet_index: sheet.index
                        });

                        console.log(`[Excel File Upload] Sheet processed: ${sheet.name}`);

                    } catch (error) {
                        console.error('Error creating/populating table:', error);
                        throw error;
                    }
                }

                // Clean up: add to deletion queue
                await QueueService.getInstance().addFilesDeletionJob(user.id);

                console.log('[Excel File Upload] Processing completed successfully');
                return resolve({
                    status: 'success',
                    file_id: fileId,
                    data_source_id: dataSource.id,
                    sheets_processed: sheetsProcessed
                });

            } catch (error) {
                console.error('Error processing Excel file:', error);
                return resolve({ 
                    status: 'error', 
                    file_id: fileId, 
                    error: error.message 
                });
            }
        });
    }

    public async addPDFDataSource(dataSourceName: string, fileId: string, data: string, tokenDetails: ITokenDetails, projectId: number, dataSourceId: number = null, sheetInfo?: any): Promise<IPDFDataSourceReturn> {
        return new Promise<IPDFDataSourceReturn>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { id: projectId, users_platform: user } });
            if (project) {
                let dataSource = new DRADataSource();
                const sheetsProcessed = [];
                if (!dataSourceId) {
                    // Create new data source - tables will be saved in the platform's own database but in a dedicated schema
                    const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                    const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                    const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                    const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                    const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                    // The PDF files will be saved as tables in the dra_pdf schema which will be separate from the public schema
                    let query = `CREATE SCHEMA IF NOT EXISTS dra_pdf`;
                    await dbConnector.query(query);
                    const connection: IDBConnectionDetails = {
                        data_source_type: UtilityService.getInstance().getDataSourceType('postgresql'),
                        host: host,
                        port: port,
                        schema: 'dra_pdf',
                        database: database,
                        username: username,
                        password: password,
                    };
                    dataSource.name = `${dataSourceName}_${new Date().getTime()}`;
                    dataSource.connection_details = connection;
                    dataSource.data_type = EDataSourceType.PDF;
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId, project: project, users_platform: user } });
                }

                try {
                    // Parse the data - could be a single sheet or multiple sheets
                    const parsedTableStructure = JSON.parse(data);
                    const sheetName = sheetInfo?.sheet_name || 'Sheet1';
                    const sheetId = sheetInfo?.sheet_id || `sheet_${Date.now()}`;
                    const sheetIndex = sheetInfo?.sheet_index || 0;

                    // CRITICAL: Use hash-based short table name to avoid PostgreSQL 63-char limit
                    // Generate logical name (human-readable, can be any length)
                    const logicalTableName = `${sheetName}`;

                    // Generate short physical name using hash (e.g., ds23_a7b3c9d1)
                    const tableMetadataService = TableMetadataService.getInstance();
                    const physicalTableName = tableMetadataService.generatePhysicalTableName(
                        dataSource.id,
                        logicalTableName,
                        fileId
                    );

                    console.log(`[PDF Upload] Physical table: ${physicalTableName}, Logical: ${logicalTableName}`);

                    let createTableQuery = `CREATE TABLE dra_pdf.${physicalTableName} `;
                    let columns = '';
                    let insertQueryColumns = '';

                    const sanitizedPdfColumns: Array<{
                        original: string,
                        sanitized: string,
                        type: string,
                        title?: string,
                        key?: string,
                        originalTitle?: string,
                        displayTitle?: string
                    }> = [];

                    if (parsedTableStructure.columns && parsedTableStructure.columns.length > 0) {
                        parsedTableStructure.columns.forEach((column: any, index: number) => {
                            // Handle renamed columns for PDF similar to Excel
                            const displayColumnName = column.title || column.column_name || `column_${index}`;
                            const originalColumnName = column.originalTitle || column.original_title || column.column_name || displayColumnName;
                            const columnKey = column.originalKey || column.original_key || column.key || displayColumnName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');

                            // Sanitize the display name for database usage
                            const sanitizedColumnName = this.sanitizeColumnName(displayColumnName);

                            sanitizedPdfColumns.push({
                                original: originalColumnName,
                                sanitized: sanitizedColumnName,
                                type: column.type,
                                title: displayColumnName,
                                key: columnKey,
                                originalTitle: originalColumnName,
                                displayTitle: displayColumnName
                            });

                            const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.PDF, column.type);
                            let dataTypeString = '';
                            if (dataType.size) {
                                dataTypeString = `${dataType.type}(${dataType.size})`;
                            } else {
                                dataTypeString = `${dataType.type}`;
                            }
                            if (index < parsedTableStructure.columns.length - 1) {
                                columns += `${sanitizedColumnName} ${dataTypeString}, `;
                            } else {
                                columns += `${sanitizedColumnName} ${dataTypeString} `;
                            }
                            if (index < parsedTableStructure.columns.length - 1) {
                                insertQueryColumns += `${sanitizedColumnName},`;
                            } else {
                                insertQueryColumns += `${sanitizedColumnName}`;
                            }
                        });

                        createTableQuery += `(${columns})`;

                        insertQueryColumns = `(${insertQueryColumns})`;
                        try {
                            // Create the table
                            await dbConnector.query(createTableQuery);
                            // await dbConnector.query(alterTableQuery);
                            console.log('[PDF Upload] Successfully created physical table:', physicalTableName, 'for logical table:', logicalTableName);
                            // Insert data rows
                            if (parsedTableStructure.rows && parsedTableStructure.rows.length > 0) {
                                for (const row of parsedTableStructure.rows) {
                                    let insertQuery = `INSERT INTO dra_pdf.${physicalTableName} `;
                                    let values = '';

                                    sanitizedPdfColumns.forEach((columnInfo, colIndex) => {
                                        // Try multiple ways to get the value for renamed columns (similar to Excel)
                                        let value = undefined;
                                        const originalColumn = parsedTableStructure.columns[colIndex];

                                        // Strategy 1: Use current column title (handles renamed columns)
                                        if (originalColumn?.title && row[originalColumn.title] !== undefined) {
                                            value = row[originalColumn.title];
                                        }
                                        // Strategy 2: Use original title if column was renamed
                                        else if (columnInfo.originalTitle && row[columnInfo.originalTitle] !== undefined) {
                                            value = row[columnInfo.originalTitle];
                                        }
                                        // Strategy 3: Use column key 
                                        else if (originalColumn?.key && row[originalColumn.key] !== undefined) {
                                            value = row[originalColumn.key];
                                        }
                                        // Strategy 4: Try nested data structure (fallback)
                                        else if (row.data) {
                                            if (originalColumn?.title && row.data[originalColumn.title] !== undefined) {
                                                value = row.data[originalColumn.title];
                                            } else if (columnInfo.originalTitle && row.data[columnInfo.originalTitle] !== undefined) {
                                                value = row.data[columnInfo.originalTitle];
                                            } else if (originalColumn?.key && row.data[originalColumn.key] !== undefined) {
                                                value = row.data[originalColumn.key];
                                            }
                                        }

                                        if (colIndex > 0) {
                                            values += ', ';
                                        }

                                        // Handle different data types properly with comprehensive escaping
                                        if (value === null || value === undefined || value === '') {
                                            values += 'NULL';
                                        } else if (columnInfo.type === 'boolean') {
                                            const boolValue = this.convertToPostgresBoolean(value);
                                            values += boolValue;
                                        } else if (typeof value === 'string') {
                                            const escapedValue = this.escapeStringValue(value);
                                            values += `'${escapedValue}'`;
                                        } else if (typeof value === 'number') {
                                            // Ensure it's a valid number
                                            if (isNaN(value) || !isFinite(value)) {
                                                values += 'NULL';
                                            } else {
                                                values += `${value}`;
                                            }
                                        } else {
                                            // For other types, convert to string and escape
                                            const escapedValue = this.escapeStringValue(String(value));
                                            values += `'${escapedValue}'`;
                                        }
                                    });

                                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                                    await dbConnector.query(insertQuery);
                                }
                            }

                            // Log column mapping for renamed columns (PDF)
                            const renamedPdfColumns = sanitizedPdfColumns.filter(col =>
                                col.originalTitle && col.displayTitle && col.originalTitle !== col.displayTitle
                            );
                            if (renamedPdfColumns.length > 0) {
                                renamedPdfColumns.forEach(col => {
                                    console.log(`  "${col.originalTitle}" -> "${col.displayTitle}" (DB: ${col.sanitized})`);
                                });
                            }
                        } catch (error) {
                            console.error('Error creating table:', physicalTableName, error);
                            throw error;
                        }
                        // Track processed sheet
                        sheetsProcessed.push({
                            sheet_id: sheetId,
                            sheet_name: sheetName,
                            table_name: physicalTableName, // Physical hash-based table name
                            sheet_index: sheetIndex
                        });

                        // Store table metadata for physical-to-logical name mapping
                        await tableMetadataService.storeTableMetadata(manager, {
                            dataSourceId: dataSource.id,
                            usersPlatformId: user.id,
                            schemaName: 'dra_pdf',
                            physicalTableName: physicalTableName,
                            logicalTableName: logicalTableName,
                            originalSheetName: sheetName,
                            fileId: fileId,
                            tableType: 'pdf'
                        });
                        console.log('[PDF Upload] Table metadata stored for:', physicalTableName);
                    }
                } catch (error) {
                    console.error('Error processing Excel data source:', error);
                    console.error('Sheet info:', sheetInfo);
                    console.error('Data structure:', data?.substring(0, 500) + '...');
                    return resolve({ status: 'error', file_id: fileId });
                }

                // Add the user to the delete files queue, which will get all of the
                //files uploaded by the user and will be deleted
                await QueueService.getInstance().addFilesDeletionJob(user.id);

                // FilesService.getInstance().deleteFileFromDisk()

                return resolve({
                    status: 'success',
                    file_id: fileId,
                    data_source_id: dataSource.id,
                    sheets_processed: sheetsProcessed.length,
                    sheet_details: sheetsProcessed
                });
            }
            return resolve({ status: 'error', file_id: fileId });
        });
    }

    /**
     * Sanitizes column names to be PostgreSQL-compliant
     */
    private sanitizeColumnName(columnName: string): string {
        // Remove special characters and replace spaces with underscores
        let sanitized = columnName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        // Ensure it starts with a letter or underscore
        if (!/^[a-zA-Z_]/.test(sanitized)) {
            sanitized = `col_${sanitized}`;
        }

        // Ensure it's not empty
        if (!sanitized) {
            sanitized = `col_${Date.now()}`;
        }

        // Check against PostgreSQL reserved keywords
        const reservedKeywords = [
            'user', 'table', 'select', 'insert', 'update', 'delete', 'create', 'drop',
            'alter', 'index', 'view', 'grant', 'revoke', 'commit', 'rollback', 'transaction',
            'primary', 'foreign', 'key', 'constraint', 'check', 'unique', 'not', 'null',
            'default', 'auto_increment', 'timestamp', 'date', 'time', 'year', 'month',
            'order', 'group', 'having', 'where', 'limit', 'offset', 'union', 'join',
            'inner', 'outer', 'left', 'right', 'cross', 'natural', 'on', 'using'
        ];

        if (reservedKeywords.includes(sanitized.toLowerCase())) {
            sanitized = `${sanitized}_col`;
        }

        return sanitized;
    }

    /**
     * Sanitizes table names to be PostgreSQL-compliant
     */
    private sanitizeTableName(tableName: string): string {
        return tableName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
    }

    /**
     * Properly escapes string values for PostgreSQL queries
     */
    private escapeStringValue(value: string): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''")
            .replace(/\0/g, '\\0');
    }

    /**
     * Converts various boolean representations to PostgreSQL boolean format
     */
    private convertToPostgresBoolean(value: any): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }

        const stringValue = String(value).trim().toLowerCase();

        // Handle common true values
        if (['true', '1', 'yes', 'y', 'on', 'active', 'enabled'].includes(stringValue)) {
            return 'TRUE';
        }

        // Handle common false values
        if (['false', '0', 'no', 'n', 'off', 'inactive', 'disabled'].includes(stringValue)) {
            return 'FALSE';
        }

        // If we can't determine the boolean value, default to NULL
        console.warn(`Unable to convert value "${value}" to boolean, using NULL`);
        return 'NULL';
    }

    /**
     * Reconstruct SQL query from JSON query structure
     * This ensures JOIN conditions are properly included when executing queries
     * 
     * CRITICAL FIX (2026-02-13): Now uses group_by_columns array from AI/frontend
     * Previously rebuilt GROUP BY from columns array, ignoring the group_by_columns
     * that the AI Data Modeler was correctly generating. This caused SQL errors when
     * aggregates were present but GROUP BY was not properly included in the final query.
     */
    public reconstructSQLFromJSON(queryJSON: any): string {
        const query = typeof queryJSON === 'string' ? JSON.parse(queryJSON) : queryJSON;

        let sqlParts: string[] = [];

        // Build SELECT clause
        const aggregateFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
        const aggregateColumns = new Set<string>();

        // Track columns used in aggregate functions
        query?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                aggregateColumns.add(aggFunc.column);
            }
        });

        // Build column selections (excluding aggregate-only columns)
        const selectColumns: string[] = [];

        if (query.columns && Array.isArray(query.columns)) {
            query.columns.forEach((column: any) => {
                if (column.is_selected_column) {
                    const columnFullPath = `${column.schema}.${column.table_name}.${column.column_name}`;
                    const isAggregateOnly = aggregateColumns.has(columnFullPath);

                    if (!isAggregateOnly) {
                        // CRITICAL: Alias names must EXACTLY match the INSERT loop's rowKey construction
                        // to ensure row value lookups succeed during data model building.
                        // Special schemas use table_name_column_name (no schema prefix).
                        // Regular schemas use schema_table_name_column_name.
                        // Always use table_name (NOT table_alias) because INSERT loop uses table_name.
                        let aliasName: string;
                        if (column?.alias_name && column.alias_name !== '') {
                            aliasName = column.alias_name;
                        } else if (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_mongodb' || column.schema === 'dra_meta_ads') {
                            // Special schemas: match INSERT loop's truncation logic
                            aliasName = `${column.table_name}`.length > 20 
                                ? `${column.table_name}`.slice(-20) + `_${column.column_name}` 
                                : `${column.table_name}_${column.column_name}`;
                        } else {
                            aliasName = `${column.schema}_${column.table_name}_${column.column_name}`;
                        }
                        
                        let columnRef = column.table_alias
                            ? `${column.schema}.${column.table_alias}.${column.column_name}`
                            : `${column.schema}.${column.table_name}.${column.column_name}`;

                        if (column.transform_function) {
                            const closeParens = ')'.repeat(column.transform_close_parens || 1);
                            columnRef = `${column.transform_function}(${columnRef}${closeParens}`;
                        }

                        selectColumns.push(`${columnRef} AS ${aliasName}`);
                    }
                }
            });
        }

        // Add aggregate functions to SELECT
        query?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any) => {
            if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                const distinctKeyword = aggFunc.use_distinct ? 'DISTINCT ' : '';
                const aggregateFunc = aggregateFunctions[aggFunc.aggregate_function];

                let aliasName = aggFunc.column_alias_name;
                if (!aliasName || aliasName === '') {
                    const columnParts = aggFunc.column.split('.');
                    const columnName = columnParts[columnParts.length - 1];
                    aliasName = `${aggregateFunc.toLowerCase()}_${columnName}`;
                }

                selectColumns.push(`${aggregateFunc}(${distinctKeyword}${aggFunc.column}) AS ${aliasName}`);
            }
        });

        // Add aggregate expressions to SELECT (use expression as-is, already contains complete SQL)
        query?.query_options?.group_by?.aggregate_expressions?.forEach((aggExpr: any) => {
            if (aggExpr.expression && aggExpr.expression.trim() !== '') {
                const aliasName = aggExpr?.column_alias_name && aggExpr.column_alias_name !== '' ? aggExpr.column_alias_name : `agg_expr`;
                // Clean up expression: remove square brackets (invalid PostgreSQL syntax)
                const cleanExpression = aggExpr.expression.replace(/\[\[/g, '').replace(/\]\]/g, '').replace(/\[/g, '').replace(/\]/g, '');
                selectColumns.push(`${cleanExpression} AS ${aliasName}`);
            }
        });

        // Add calculated columns to SELECT
        if (query.calculated_columns && Array.isArray(query.calculated_columns)) {
            query.calculated_columns.forEach((calcCol: any) => {
                // Frontend sends 'expression' not 'column_expression'
                const expression = calcCol.expression || calcCol.column_expression;
                if (expression && calcCol.column_name) {
                    selectColumns.push(`${expression} AS ${calcCol.column_name}`);
                }
            });
        }

        sqlParts.push(`SELECT ${selectColumns.join(', ')}`);

        // Build FROM/JOIN clauses
        if (query.join_conditions && Array.isArray(query.join_conditions) && query.join_conditions.length > 0) {
            console.log('[DataSourceProcessor] Building FROM/JOIN clauses from join_conditions:', query.join_conditions.length);

            const fromJoinClauses: any[] = [];

            // Map join_conditions to the format expected
            query.join_conditions.forEach((join: any) => {
                fromJoinClauses.push({
                    left_table_schema: join.left_table_schema,
                    left_table_name: join.left_table_name,
                    left_table_alias: join.left_table_alias,
                    left_column_name: join.left_column_name,
                    right_table_schema: join.right_table_schema,
                    right_table_name: join.right_table_name,
                    right_table_alias: join.right_table_alias,
                    right_column_name: join.right_column_name,
                    join_type: join.join_type || 'INNER',
                    primary_operator: join.primary_operator || '=',
                    additional_conditions: join.additional_conditions || []
                });
            });

            const fromJoinClause: string[] = [];
            const addedTables = new Set<string>();

            // Get table aliases helper
            const getTableAlias = (schema: string, tableName: string) => {
                if (query.columns && Array.isArray(query.columns)) {
                    const col = query.columns.find((c: any) =>
                        c.schema === schema && c.table_name === tableName && c.table_alias
                    );
                    return col?.table_alias || null;
                }
                return null;
            };

            fromJoinClauses.forEach((clause, index) => {
                const leftAlias = clause.left_table_alias || getTableAlias(clause.left_table_schema, clause.left_table_name);
                const rightAlias = clause.right_table_alias || getTableAlias(clause.right_table_schema, clause.right_table_name);

                const leftTableFull = `${clause.left_table_schema}.${clause.left_table_name}`;
                const rightTableFull = `${clause.right_table_schema}.${clause.right_table_name}`;

                const leftTableSQL = leftAlias ? `${leftTableFull} AS ${leftAlias}` : leftTableFull;
                const rightTableSQL = rightAlias ? `${rightTableFull} AS ${rightAlias}` : rightTableFull;

                const leftRef = leftAlias || clause.left_table_name;
                const rightRef = rightAlias || clause.right_table_name;

                const joinType = clause.join_type || 'INNER';

                if (index === 0) {
                    // First JOIN - establish FROM and first JOIN
                    const operator = clause.primary_operator || '=';
                    fromJoinClause.push(`FROM ${leftTableSQL}`);
                    fromJoinClause.push(`${joinType} JOIN ${rightTableSQL}`);
                    fromJoinClause.push(`ON ${clause.left_table_schema}.${leftRef}.${clause.left_column_name} ${operator} ${clause.right_table_schema}.${rightRef}.${clause.right_column_name}`);

                    addedTables.add(leftTableFull);
                    addedTables.add(rightTableFull);

                    // Add additional conditions if present
                    if (clause.additional_conditions && clause.additional_conditions.length > 0) {
                        clause.additional_conditions.forEach((addCond: any) => {
                            if (addCond.left_column && addCond.right_column && addCond.operator) {
                                fromJoinClause.push(`${addCond.logic} ${clause.left_table_schema}.${leftRef}.${addCond.left_column} ${addCond.operator} ${clause.right_table_schema}.${rightRef}.${addCond.right_column}`);
                            }
                        });
                    }
                } else {
                    // Subsequent JOINs
                    const leftTableExists = addedTables.has(leftTableFull);
                    const rightTableExists = addedTables.has(rightTableFull);

                    const operator = clause.primary_operator || '=';
                    const joinCondition = `${clause.left_table_schema}.${leftRef}.${clause.left_column_name} ${operator} ${clause.right_table_schema}.${rightRef}.${clause.right_column_name}`;

                    if (!leftTableExists && !rightTableExists) {
                        // Neither table exists - add right table
                        fromJoinClause.push(`${joinType} JOIN ${rightTableSQL}`);
                        fromJoinClause.push(`ON ${joinCondition}`);
                        addedTables.add(rightTableFull);
                    } else if (!leftTableExists) {
                        // Only left table missing
                        fromJoinClause.push(`${joinType} JOIN ${leftTableSQL}`);
                        fromJoinClause.push(`ON ${joinCondition}`);
                        addedTables.add(leftTableFull);
                    } else if (!rightTableExists) {
                        // Only right table missing
                        fromJoinClause.push(`${joinType} JOIN ${rightTableSQL}`);
                        fromJoinClause.push(`ON ${joinCondition}`);
                        addedTables.add(rightTableFull);
                    }

                    // Add additional conditions if present
                    if (clause.additional_conditions && clause.additional_conditions.length > 0) {
                        clause.additional_conditions.forEach((addCond: any) => {
                            if (addCond.left_column && addCond.right_column && addCond.operator) {
                                fromJoinClause.push(`${addCond.logic} ${clause.left_table_schema}.${leftRef}.${addCond.left_column} ${addCond.operator} ${clause.right_table_schema}.${rightRef}.${addCond.right_column}`);
                            }
                        });
                    }
                }
            });

            sqlParts.push(fromJoinClause.join(' '));
        } else if (query.columns && query.columns.length > 0) {
            // No JOINs - use simple FROM clause from first selected column
            const firstColumn = query.columns.find((c: any) => c.is_selected_column);
            if (firstColumn) {
                sqlParts.push(`FROM ${firstColumn.schema}.${firstColumn.table_name}`);
            }
        }

        // Build WHERE clause
        if (query.query_options?.where && Array.isArray(query.query_options.where) && query.query_options.where.length > 0) {
            const whereClauses: string[] = [];
            // CRITICAL: This array MUST match the frontend's state.equality array order exactly
            // Frontend: ['=', '>', '<', '>=', '<=', '!=', 'IN', 'NOT IN']
            const equalityOperators = ['=', '>', '<', '>=', '<=', '!=', 'IN', 'NOT IN'];
            
            query.query_options.where.forEach((whereClause: any, index: number) => {
                if (whereClause.column && whereClause.equality !== undefined && whereClause.equality !== '' && whereClause.value !== undefined && whereClause.value !== '') {
                    // Get operator from equality index
                    const operator = equalityOperators[whereClause.equality] || '=';
                    
                    // Determine if value should be quoted based on column_data_type
                    let formattedValue = whereClause.value;
                    const dataType = whereClause.column_data_type?.toLowerCase() || '';                    
                    // Handle numeric types - do NOT quote
                    if (dataType === 'numeric' || dataType === 'integer' || dataType === 'bigint' || 
                        dataType === 'smallint' || dataType === 'real' || dataType === 'double precision' ||
                        dataType === 'decimal' || dataType === 'float' || dataType === 'money') {
                        formattedValue = whereClause.value; // No quotes for numbers
                    } 
                    // Handle IN/NOT IN operators - value already contains parentheses
                    else if (operator === 'IN' || operator === 'NOT IN') {
                        formattedValue = `(${whereClause.value})`; // User enters: 'val1','val2','val3'
                    }
                    // Handle NULL checks
                    else if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
                        formattedValue = ''; // No value needed for NULL checks
                    }
                    // Default: quote the value for text types
                    else {
                        formattedValue = `'${whereClause.value}'`;
                    }
                    
                    const sqlClause = operator === 'IS NULL' || operator === 'IS NOT NULL'
                        ? `${whereClause.column} ${operator}`
                        : `${whereClause.column} ${operator} ${formattedValue}`;
                    whereClauses.push(sqlClause);
                }
            });
            if (whereClauses.length > 0) {
                const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;
                sqlParts.push(whereSQL);
            }
        }

        // Build GROUP BY clause
        // CRITICAL: Check for group_by.name (UI flag) OR presence of aggregates/group_by_columns
        // The AI model may not set the 'name' field, but still provide group_by_columns and aggregate_expressions
        const hasGroupByName = !!query.query_options?.group_by?.name;
        const hasGroupByColumns = query.query_options?.group_by?.group_by_columns?.length > 0;
        const hasAggFuncs = query.query_options?.group_by?.aggregate_functions?.some(
            (agg: any) => agg.aggregate_function !== '' && agg.column !== ''
        );
        const hasAggExprs = query.query_options?.group_by?.aggregate_expressions?.some(
            (expr: any) => expr.expression && expr.expression !== ''
        );
        if (hasGroupByName || hasGroupByColumns || hasAggFuncs || hasAggExprs) {
            // CRITICAL: Use group_by_columns array if provided (new format from AI)
            // Otherwise fallback to rebuilding from columns (legacy format)
            let groupByColumns: string[] = [];
            
            if (query.query_options?.group_by?.group_by_columns && 
                Array.isArray(query.query_options.group_by.group_by_columns) &&
                query.query_options.group_by.group_by_columns.length > 0) {
                // NEW FORMAT: Use group_by_columns array from AI/frontend
                // CRITICAL: Map column references to use table_alias when present,
                // so GROUP BY references match SELECT column references exactly.
                // Frontend stores group_by_columns as schema.table_name.column_name,
                // but SELECT uses schema.table_alias.column_name when aliases exist.
                groupByColumns = query.query_options.group_by.group_by_columns.map((colRef: string) => {
                    // Check if this is a plain column reference (not wrapped in a transform function)
                    const parts = colRef.split('.');
                    if (parts.length === 3) {
                        const [schema, tableName, columnName] = parts;
                        // Find if any column in the model has a table_alias for this table
                        const aliasedColumn = query.columns?.find((c: any) =>
                            c.schema === schema && c.table_name === tableName && c.table_alias
                        );
                        if (aliasedColumn?.table_alias) {
                            return `${schema}.${aliasedColumn.table_alias}.${columnName}`;
                        }
                    }
                    return colRef;
                });
                console.log('[DataSourceProcessor] Using group_by_columns array (alias-mapped):', groupByColumns);
            } else {
                // LEGACY FORMAT: Rebuild from columns array (backward compatibility)
                console.log('[DataSourceProcessor] Rebuilding GROUP BY from columns array (legacy)');
                query.columns?.forEach((column: any) => {
                    if (column.is_selected_column) {
                        const columnFullPath = `${column.schema}.${column.table_name}.${column.column_name}`;
                        const isAggregateOnly = aggregateColumns.has(columnFullPath);
                        if (!isAggregateOnly) {
                            const tableRef = column.table_alias || column.table_name;
                            groupByColumns.push(`${column.schema}.${tableRef}.${column.column_name}`);
                        }
                    }
                });
            }
            
            if (groupByColumns.length > 0) {
                sqlParts.push(`GROUP BY ${groupByColumns.join(', ')}`);
            } else if (query.query_options?.group_by?.aggregate_functions?.length > 0 ||
                       query.query_options?.group_by?.aggregate_expressions?.length > 0) {
                console.warn('[DataSourceProcessor] WARNING: Aggregates present but GROUP BY is empty!');
            }
        }

        // Build HAVING clause
        if (query.query_options?.group_by?.having_conditions && query.query_options.group_by.having_conditions.length > 0) {
            const havingClauses: string[] = [];
            // CRITICAL: This array MUST match the frontend's state.equality array order exactly
            // Frontend: ['=', '>', '<', '>=', '<=', '!=', 'IN', 'NOT IN']
            const equalityOperators = ['=', '>', '<', '>=', '<=', '!=', 'IN', 'NOT IN'];
            
            query.query_options.group_by.having_conditions.forEach((havingClause: any) => {
                if (havingClause.column && havingClause.equality !== undefined && havingClause.value !== undefined && havingClause.value !== '') {
                    // Get operator from equality index
                    const operator = equalityOperators[havingClause.equality] || '=';
                    
                    // Check if column is an aggregate alias - need to reconstruct full expression
                    let havingColumn = havingClause.column;
                    let formattedValue = havingClause.value;
                    
                    // Check if this matches an aggregate function alias
                    const aggregateFunc = query.query_options?.group_by?.aggregate_functions?.find((aggFunc: any) => {
                        if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                            const funcName = aggregateFunctions[aggFunc.aggregate_function];
                            const columnParts = aggFunc.column.split('.');
                            const columnName = columnParts[columnParts.length - 1];
                            const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${columnName}`;
                            return aliasName === havingClause.column;
                        }
                        return false;
                    });
                    
                    // Check if this matches an aggregate expression alias
                    const aggregateExpr = query.query_options?.group_by?.aggregate_expressions?.find((aggExpr: any) => {
                        return aggExpr.column_alias_name === havingClause.column;
                    });
                    
                    if (aggregateFunc) {
                        // Replace alias with full aggregate function expression
                        const funcName = aggregateFunctions[aggregateFunc.aggregate_function];
                        const distinctKeyword = aggregateFunc.use_distinct ? 'DISTINCT ' : '';
                        havingColumn = `${funcName}(${distinctKeyword}${aggregateFunc.column})`;
                    } else if (aggregateExpr) {
                        // Replace alias with full aggregate expression (use as-is)
                        // Clean up expression: remove square brackets (invalid PostgreSQL syntax)
                        havingColumn = aggregateExpr.expression.replace(/\[\[/g, '').replace(/\]\]/g, '').replace(/\[/g, '').replace(/\]/g, '');
                    }
                    
                    // Handle value formatting - aggregates return numeric values
                    if (operator === 'IN' || operator === 'NOT IN') {
                        formattedValue = `(${havingClause.value})`;
                    } else {
                        // Aggregate results are numeric - don't quote
                        formattedValue = havingClause.value;
                    }
                    
                    havingClauses.push(`${havingColumn} ${operator} ${formattedValue}`);
                }
            });
            if (havingClauses.length > 0) {
                sqlParts.push(`HAVING ${havingClauses.join(' AND ')}`);
            }
        }

        // Build ORDER BY clause
        if (query.query_options?.order_by && Array.isArray(query.query_options.order_by) && query.query_options.order_by.length > 0) {
            const orderByClauses: string[] = [];
            query.query_options.order_by.forEach((orderBy: any) => {
                if (orderBy.column && orderBy.direction) {
                    orderByClauses.push(`${orderBy.column} ${orderBy.direction}`);
                }
            });
            if (orderByClauses.length > 0) {
                sqlParts.push(`ORDER BY ${orderByClauses.join(', ')}`);
            }
        }

        // Build LIMIT/OFFSET clause
        if (query.query_options?.limit && query.query_options.limit !== -1) {
            // CRITICAL: Ensure LIMIT is at least 1 (never 0 or negative)
            const sanitizedLimit = Math.max(1, parseInt(String(query.query_options.limit), 10));
            sqlParts.push(`LIMIT ${sanitizedLimit}`);
        }
        if (query.query_options?.offset && query.query_options.offset !== -1) {
            sqlParts.push(`OFFSET ${query.query_options.offset}`);
        }

        const finalSQL = sqlParts.join(' ');
        console.log('[DataSourceProcessor] Reconstructed SQL from JSON:', finalSQL);
        return finalSQL;
    }

    /**
     * Add Google Analytics data source
     */
    public async addGoogleAnalyticsDataSource(
        name: string,
        connectionDetails: IAPIConnectionDetails,
        tokenDetails: ITokenDetails,
        projectId: number
    ): Promise<number | null> {
        return new Promise<number | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }
            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { id: projectId, users_platform: user } });
            if (project) {
                // Create schema for Google Analytics data
                const schemaName = 'dra_google_analytics';
                await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

                // Get internal database connection details
                const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                // Create hybrid connection details: database connection + API connection
                const hybridConnection: IDBConnectionDetails = {
                    data_source_type: EDataSourceType.GOOGLE_ANALYTICS,
                    host: host,
                    port: parseInt(port),
                    schema: schemaName,
                    database: database,
                    username: username,
                    password: password,
                    api_connection_details: connectionDetails
                };

                const dataSource = new DRADataSource();
                dataSource.name = name;
                dataSource.connection_details = hybridConnection;
                dataSource.data_type = EDataSourceType.GOOGLE_ANALYTICS;
                dataSource.project = project;
                dataSource.users_platform = user;
                dataSource.created_at = new Date();
                const savedDataSource = await manager.save(dataSource);

                console.log('✅ Google Analytics data source added successfully with ID:', savedDataSource.id);
                return resolve(savedDataSource.id);
            }
            return resolve(null);
        });
    }

    /**
     * Sync Google Analytics data source
     */
    public async syncGoogleAnalyticsDataSource(
        dataSourceId: number,
        tokenDetails: ITokenDetails
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            // Defensive validation at the start
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncGoogleAnalyticsDataSource] Invalid data source ID:', dataSourceId, 'Type:', typeof dataSourceId);
                return resolve(false);
            }

            console.log('[syncGoogleAnalyticsDataSource] Starting sync for data source ID:', dataSourceId);

            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error('[syncGoogleAnalyticsDataSource] Database driver not available');
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                console.error('[syncGoogleAnalyticsDataSource] Database manager not available');
                return resolve(false);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                console.error('[syncGoogleAnalyticsDataSource] User not found:', user_id);
                return resolve(false);
            }

            // Get data source
            console.log('[syncGoogleAnalyticsDataSource] Fetching data source with ID:', dataSourceId);
            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.GOOGLE_ANALYTICS }
            });

            if (!dataSource) {
                console.error('Data source not found or not a Google Analytics source');
                return resolve(false);
            }

            // Get connection details - extract API connection from hybrid structure
            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('API connection details not found in data source');
                return resolve(false);
            }

            const apiConnectionDetails = connection.api_connection_details;

            // Trigger sync
            const gaDriver = GoogleAnalyticsDriver.getInstance();
            const syncResult = await gaDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);

            if (syncResult) {
                // Update last sync time in API connection details
                apiConnectionDetails.api_config.last_sync = new Date();
                connection.api_connection_details = apiConnectionDetails;
                dataSource.connection_details = connection;
                await manager.save(dataSource);

                // Send success notification (simple version - can be enhanced with record count)
                await this.notificationHelper.notifyDataSourceSyncComplete(
                    user_id,
                    dataSourceId,
                    dataSource.name,
                    0 // Record count not available in current implementation
                );
            } else {
                // Send failure notification
                await this.notificationHelper.notifyDataSourceSyncFailed(
                    user_id,
                    dataSourceId,
                    dataSource.name,
                    'Sync operation failed'
                );
            }

            return resolve(syncResult);
        });
    }

    /**
     * Add Google Ad Manager data source
     */
    public async addGoogleAdManagerDataSource(
        name: string,
        connectionDetails: IAPIConnectionDetails,
        tokenDetails: ITokenDetails,
        projectId: number
    ): Promise<number | null> {
        return new Promise<number | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }
            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { id: projectId, users_platform: user } });
            if (project) {
                // Create schema for Google Ad Manager data
                const schemaName = 'dra_google_ad_manager';
                await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

                // Get internal database connection details
                const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                // Create hybrid connection details: database connection + API connection
                const hybridConnection: IDBConnectionDetails = {
                    data_source_type: EDataSourceType.GOOGLE_AD_MANAGER,
                    host: host,
                    port: parseInt(port),
                    schema: schemaName,
                    database: database,
                    username: username,
                    password: password,
                    api_connection_details: connectionDetails
                };

                const dataSource = new DRADataSource();
                dataSource.name = name;
                dataSource.connection_details = hybridConnection;
                dataSource.data_type = EDataSourceType.GOOGLE_AD_MANAGER;
                dataSource.project = project;
                dataSource.users_platform = user;
                dataSource.created_at = new Date();
                const savedDataSource = await manager.save(dataSource);

                console.log('✅ Google Ad Manager data source added successfully with ID:', savedDataSource.id);
                return resolve(savedDataSource.id);
            }
            return resolve(null);
        });
    }

    /**
     * Sync Google Ad Manager data source
     */
    public async syncGoogleAdManagerDataSource(
        dataSourceId: number,
        tokenDetails: ITokenDetails
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            // Defensive validation at the start
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncGoogleAdManagerDataSource] Invalid data source ID:', dataSourceId, 'Type:', typeof dataSourceId);
                return resolve(false);
            }

            console.log('[syncGoogleAdManagerDataSource] Starting sync for data source ID:', dataSourceId);

            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error('[syncGoogleAdManagerDataSource] Database driver not available');
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                console.error('[syncGoogleAdManagerDataSource] Database manager not available');
                return resolve(false);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                console.error('[syncGoogleAdManagerDataSource] User not found:', user_id);
                return resolve(false);
            }

            // Get data source
            console.log('[syncGoogleAdManagerDataSource] Fetching data source with ID:', dataSourceId);
            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.GOOGLE_AD_MANAGER }
            });

            if (!dataSource) {
                console.error('Data source not found or not a Google Ad Manager source');
                return resolve(false);
            }

            // Get connection details - extract API connection from hybrid structure
            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('API connection details not found in data source');
                return resolve(false);
            }

            const apiConnectionDetails = connection.api_connection_details;

            // Trigger sync
            const gamDriver = GoogleAdManagerDriver.getInstance();
            const syncResult = await gamDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);
            console.log('📊 [GAM Sync] Sync result for data source ID', dataSourceId, ':', syncResult);
            if (syncResult) {
                // Update last sync time in API connection details
                apiConnectionDetails.api_config.last_sync = new Date();
                connection.api_connection_details = apiConnectionDetails;
                dataSource.connection_details = connection;
                await manager.save(dataSource);

                // Send success notification
                await this.notificationHelper.notifyDataSourceSyncComplete(
                    user_id,
                    dataSourceId,
                    dataSource.name,
                    0 // Record count not available
                );
            } else {
                // Send failure notification
                await this.notificationHelper.notifyDataSourceSyncFailed(
                    user_id,
                    dataSourceId,
                    dataSource.name,
                    'Sync operation failed'
                );
            }

            return resolve(syncResult);
        });
    }

    /**
     * Add Google Ads data source
     */
    public async addGoogleAdsDataSource(
        user_id: number,
        syncConfig: any
    ): Promise<number | null> {
        return new Promise<number | null>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }

            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { users_platform: user } });
            if (project) {
                // Create schema for Google Ads data
                const schemaName = 'dra_google_ads';
                await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

                // Get internal database connection details
                const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                // Prepare API connection details
                const apiConnectionDetails: IAPIConnectionDetails = {
                    oauth_access_token: syncConfig.accessToken,
                    oauth_refresh_token: syncConfig.refreshToken,
                    token_expiry: new Date(Date.now() + 3600 * 1000), // 1 hour from now
                    api_config: {
                        customer_id: syncConfig.customerId,
                        manager_customer_id: syncConfig.managerCustomerId, // For client accounts under a manager
                        report_types: syncConfig.reportTypes || ['campaign'],
                        start_date: syncConfig.startDate,
                        end_date: syncConfig.endDate
                    }
                };

                // Create hybrid connection details: database connection + API connection
                const hybridConnection: IDBConnectionDetails = {
                    data_source_type: EDataSourceType.GOOGLE_ADS,
                    host: host,
                    port: parseInt(port),
                    schema: schemaName,
                    database: database,
                    username: username,
                    password: password,
                    api_connection_details: apiConnectionDetails
                };

                const dataSource = new DRADataSource();
                dataSource.name = syncConfig.name;
                dataSource.connection_details = hybridConnection;
                dataSource.data_type = EDataSourceType.GOOGLE_ADS;
                dataSource.project = project;
                dataSource.users_platform = user;
                dataSource.created_at = new Date();
                const savedDataSource = await manager.save(dataSource);

                console.log('✅ Google Ads data source added successfully with ID:', savedDataSource.id);
                return resolve(savedDataSource.id);
            }
            return resolve(null);
        });
    }

    /**
     * Sync Google Ads data source
     */
    public async syncGoogleAdsDataSource(
        dataSourceId: number,
        user_id: number
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncGoogleAdsDataSource] Invalid data source ID:', dataSourceId);
                return resolve(false);
            }

            console.log('[syncGoogleAdsDataSource] Starting sync for data source ID:', dataSourceId);

            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error('[syncGoogleAdsDataSource] Database driver not available');
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                console.error('[syncGoogleAdsDataSource] Database manager not available');
                return resolve(false);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                console.error('[syncGoogleAdsDataSource] User not found:', user_id);
                return resolve(false);
            }

            // Get data source
            console.log('[syncGoogleAdsDataSource] Fetching data source with ID:', dataSourceId);
            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.GOOGLE_ADS }
            });

            if (!dataSource) {
                console.error('Data source not found or not a Google Ads source');
                return resolve(false);
            }

            // Get connection details - extract API connection from hybrid structure
            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('API connection details not found in data source');
                return resolve(false);
            }

            const apiConnectionDetails = connection.api_connection_details;

            // Trigger sync
            const { GoogleAdsDriver } = await import('../drivers/GoogleAdsDriver.js');
            const adsDriver = GoogleAdsDriver.getInstance();
            const syncResult = await adsDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);

            if (syncResult) {
                // Update last sync time in API connection details
                apiConnectionDetails.api_config.last_sync = new Date();
                connection.api_connection_details = apiConnectionDetails;
                dataSource.connection_details = connection;
                await manager.save(dataSource);

                // Send success notification
                await this.notificationHelper.notifyDataSourceSyncComplete(
                    user_id,
                    dataSourceId,
                    dataSource.name,
                    0 // Record count not available
                );
            } else {
                // Send failure notification
                await this.notificationHelper.notifyDataSourceSyncFailed(
                    user_id,
                    dataSourceId,
                    dataSource.name,
                    'Sync operation failed'
                );
            }

            return resolve(syncResult);
        });
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

    /**
     * Add Meta Ads data source
     */
    public async addMetaAdsDataSource(
        name: string,
        connectionDetails: IAPIConnectionDetails,
        tokenDetails: ITokenDetails,
        projectId: number
    ): Promise<number | null> {
        return new Promise<number | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(null);
            }
            const project: DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}});
            if (project) {
                // Create schema for Meta Ads data
                const schemaName = 'dra_meta_ads';
                await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
                
                // Get internal database connection details
                const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');
                
                // Create hybrid connection details: database connection + API connection
                const hybridConnection: IDBConnectionDetails = {
                    data_source_type: EDataSourceType.META_ADS,
                    host: host,
                    port: parseInt(port),
                    schema: schemaName,
                    database: database,
                    username: username,
                    password: password,
                    api_connection_details: connectionDetails
                };
                
                const dataSource = new DRADataSource();
                dataSource.name = name;
                dataSource.connection_details = hybridConnection;
                dataSource.data_type = EDataSourceType.META_ADS;
                dataSource.project = project;
                dataSource.users_platform = user;
                dataSource.created_at = new Date();
                const savedDataSource = await manager.save(dataSource);
                
                console.log('✅ Meta Ads data source added successfully with ID:', savedDataSource.id);
                return resolve(savedDataSource.id);
            }
            return resolve(null);
        });
    }

    /**
     * Sync Meta Ads data source
     */
    public async syncMetaAdsDataSource(
        dataSourceId: number,
        user_id: number
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncMetaAdsDataSource] Invalid data source ID:', dataSourceId);
                return resolve(false);
            }
            
            console.log('[syncMetaAdsDataSource] Starting sync for data source ID:', dataSourceId);
            
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error('[syncMetaAdsDataSource] Database driver not available');
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                console.error('[syncMetaAdsDataSource] Database manager not available');
                return resolve(false);
            }
            
            // Get user
            console.log('[syncMetaAdsDataSource] Fetching user with ID:', user_id);
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                console.error('[syncMetaAdsDataSource] User not found:', user_id);
                return resolve(false);
            }
            
            // Get data source
            console.log('[syncMetaAdsDataSource] Fetching data source with ID:', dataSourceId);
            const dataSource = await manager.findOne(DRADataSource, {
                where: {id: dataSourceId, users_platform: user, data_type: EDataSourceType.META_ADS}
            });
            
            if (!dataSource) {
                console.error('Data source not found or not a Meta Ads source');
                return resolve(false);
            }
            
            // Get connection details - extract API connection from hybrid structure
            const connection = dataSource.connection_details;
            if (!connection.api_connection_details) {
                console.error('API connection details not found in data source');
                return resolve(false);
            }
            
            const apiConnectionDetails = connection.api_connection_details;
            
            // Trigger sync
            const { MetaAdsDriver } = await import('../drivers/MetaAdsDriver.js');
            const metaAdsDriver = MetaAdsDriver.getInstance();
            const syncResult = await metaAdsDriver.syncToDatabase(dataSourceId, user.id, apiConnectionDetails);
            
            if (syncResult) {
                // Update last sync time in API connection details
                apiConnectionDetails.api_config.last_sync = new Date();
                connection.api_connection_details = apiConnectionDetails;
                dataSource.connection_details = connection;
                await manager.save(dataSource);
            }
            
            return resolve(syncResult);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LinkedIn Ads
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a new LinkedIn Ads data source record in the database.
     */
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

            const project: DRAProject | null = await manager.findOne(DRAProject, {
                where: { id: projectId, users_platform: user },
            });
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
                host,
                port: parseInt(port),
                schema: schemaName,
                database,
                username,
                password,
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

    /**
     * Trigger a sync for an existing LinkedIn Ads data source.
     */
    public async syncLinkedInAdsDataSource(
        dataSourceId: number,
        user_id: number
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve, _reject) => {
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[syncLinkedInAdsDataSource] Invalid data source ID:', dataSourceId);
                return resolve(false);
            }

            console.log('[syncLinkedInAdsDataSource] Starting sync for data source ID:', dataSourceId);

            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error('[syncLinkedInAdsDataSource] Database driver not available');
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                console.error('[syncLinkedInAdsDataSource] Database manager not available');
                return resolve(false);
            }

            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                console.error('[syncLinkedInAdsDataSource] User not found:', user_id);
                return resolve(false);
            }

            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user, data_type: EDataSourceType.LINKEDIN_ADS },
            });
            if (!dataSource) {
                console.error('[syncLinkedInAdsDataSource] Data source not found or not a LinkedIn Ads source');
                return resolve(false);
            }

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
}