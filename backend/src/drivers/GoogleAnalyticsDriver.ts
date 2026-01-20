import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleAnalyticsService } from '../services/GoogleAnalyticsService.js';
import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
import { TableMetadataService } from '../services/TableMetadataService.js';
import { DBDriver } from './DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';

/**
 * Google Analytics Driver
 * Handles data synchronization from Google Analytics to PostgreSQL
 */
export class GoogleAnalyticsDriver implements IAPIDriver {
    private static instance: GoogleAnalyticsDriver;
    private gaService: GoogleAnalyticsService;
    private oauthService: GoogleOAuthService;
    
    private constructor() {
        this.gaService = GoogleAnalyticsService.getInstance();
        this.oauthService = GoogleOAuthService.getInstance();
    }
    
    public static getInstance(): GoogleAnalyticsDriver {
        if (!GoogleAnalyticsDriver.instance) {
            GoogleAnalyticsDriver.instance = new GoogleAnalyticsDriver();
        }
        return GoogleAnalyticsDriver.instance;
    }
    
    /**
     * Authenticate with Google Analytics API
     */
    public async authenticate(connectionDetails: IAPIConnectionDetails): Promise<boolean> {
        try {
            // Check if token is expired and refresh if needed
            if (connectionDetails.token_expiry) {
                const expiryDate = new Date(connectionDetails.token_expiry).getTime();
                if (this.oauthService.isTokenExpired(expiryDate)) {
                    console.log('🔄 Access token expired, refreshing...');
                    const newTokens = await this.oauthService.refreshAccessToken(
                        connectionDetails.oauth_refresh_token
                    );
                    
                    // Update connection details with new tokens
                    connectionDetails.oauth_access_token = newTokens.access_token;
                    if (newTokens.expiry_date) {
                        connectionDetails.token_expiry = new Date(newTokens.expiry_date);
                    }
                }
            }
            
            // Test authentication by fetching properties
            await this.gaService.listProperties(connectionDetails.oauth_access_token);
            
            console.log('✅ Google Analytics authentication successful');
            return true;
        } catch (error) {
            console.error('❌ Google Analytics authentication failed:', error);
            return false;
        }
    }
    
    /**
     * Sync Google Analytics data to PostgreSQL
     * Creates schema and tables if they don't exist, then syncs data
     */
    public async syncToDatabase(
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        try {
            console.log(`🔄 Starting Google Analytics sync for data source ${dataSourceId}`);
            
            // Ensure authentication is valid
            const isAuthenticated = await this.authenticate(connectionDetails);
            if (!isAuthenticated) {
                throw new Error('Authentication failed');
            }
            
            const propertyId = connectionDetails.api_config.property_id;
            if (!propertyId) {
                throw new Error('Property ID not configured');
            }
            
            // Get database connection
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                throw new Error('Database driver not available');
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            
            // Create schema if it doesn't exist
            const schemaName = 'dra_google_analytics';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            console.log(`✅ Schema ${schemaName} ready`);
            
            // Sync various reports and track row counts
            let totalRowsSynced = 0;
            totalRowsSynced += await this.syncTrafficOverview(manager, schemaName, dataSourceId, usersPlatformId, propertyId, connectionDetails);
            totalRowsSynced += await this.syncPagePerformance(manager, schemaName, dataSourceId, usersPlatformId, propertyId, connectionDetails);
            totalRowsSynced += await this.syncUserAcquisition(manager, schemaName, dataSourceId, usersPlatformId, propertyId, connectionDetails);
            totalRowsSynced += await this.syncGeographic(manager, schemaName, dataSourceId, usersPlatformId, propertyId, connectionDetails);
            totalRowsSynced += await this.syncDeviceData(manager, schemaName, dataSourceId, usersPlatformId, propertyId, connectionDetails);
            totalRowsSynced += await this.syncEvents(manager, schemaName, dataSourceId, usersPlatformId, propertyId, connectionDetails);
            
            // Update last sync timestamp and record sync history
            await this.updateLastSyncTime(manager, schemaName, dataSourceId, totalRowsSynced);
            
            console.log('✅ Google Analytics sync completed successfully');
            return true;
        } catch (error) {
            console.error('❌ Google Analytics sync failed:', error);
            return false;
        }
    }
    
    /**
     * Sync traffic overview data
     */
    private async syncTrafficOverview(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'traffic_overview';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            propertyId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        // Create table
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                session_source VARCHAR(255),
                session_medium VARCHAR(255),
                sessions INTEGER,
                total_users INTEGER,
                new_users INTEGER,
                screen_page_views INTEGER,
                average_session_duration DECIMAL(10,2),
                bounce_rate DECIMAL(5,2),
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(date, session_source, session_medium)
            )
        `);
        
        // Fetch data from GA4
        const preset = GoogleAnalyticsService.getReportPresets().traffic_overview;
        const response = await this.gaService.runReport(
            propertyId,
            connectionDetails,
            preset.dimensions,
            preset.metrics,
            [{startDate: '90daysAgo', endDate: 'today'}]
        );
        
        const rows = this.gaService.transformReportToRows(response);
        
        // Insert data (upsert)
        for (const row of rows) {
            await manager.query(`
                INSERT INTO ${fullTableName} 
                (date, session_source, session_medium, sessions, total_users, new_users, 
                 screen_page_views, average_session_duration, bounce_rate)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (date, session_source, session_medium) 
                DO UPDATE SET
                    sessions = EXCLUDED.sessions,
                    total_users = EXCLUDED.total_users,
                    new_users = EXCLUDED.new_users,
                    screen_page_views = EXCLUDED.screen_page_views,
                    average_session_duration = EXCLUDED.average_session_duration,
                    bounce_rate = EXCLUDED.bounce_rate,
                    synced_at = NOW()
            `, [
                row.date,
                row.sessionSource || 'direct',
                row.sessionMedium || 'none',
                row.sessions || 0,
                row.totalUsers || 0,
                row.newUsers || 0,
                row.screenPageViews || 0,
                row.averageSessionDuration || 0,
                row.bounceRate || 0
            ]);
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: propertyId,
            tableType: 'google_analytics'
        });
        
        console.log(`✅ Synced ${rows.length} rows to ${logicalTableName} (${physicalTableName})`);
        return rows.length;
    }
    
    /**
     * Sync page performance data
     */
    private async syncPagePerformance(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'page_performance';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            propertyId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                page_path VARCHAR(2048),
                page_title VARCHAR(500),
                screen_page_views INTEGER,
                average_session_duration DECIMAL(10,2),
                bounce_rate DECIMAL(5,2),
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(page_path)
            )
        `);
        
        const preset = GoogleAnalyticsService.getReportPresets().page_performance;
        const response = await this.gaService.runReport(
            propertyId,
            connectionDetails,
            preset.dimensions,
            preset.metrics,
            [{startDate: '30daysAgo', endDate: 'today'}]
        );
        
        const rows = this.gaService.transformReportToRows(response);
        
        for (const row of rows) {
            await manager.query(`
                INSERT INTO ${fullTableName} 
                (page_path, page_title, screen_page_views, average_session_duration, bounce_rate)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (page_path) 
                DO UPDATE SET
                    page_title = EXCLUDED.page_title,
                    screen_page_views = EXCLUDED.screen_page_views,
                    average_session_duration = EXCLUDED.average_session_duration,
                    bounce_rate = EXCLUDED.bounce_rate,
                    synced_at = NOW()
            `, [
                row.pagePath || '/',
                row.pageTitle || 'Unknown',
                row.screenPageViews || 0,
                row.averageSessionDuration || 0,
                row.bounceRate || 0
            ]);
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: propertyId,
            tableType: 'google_analytics'
        });
        
        console.log(`✅ Synced ${rows.length} rows to ${logicalTableName} (${physicalTableName})`);
        return rows.length;
    }
    
    /**
     * Sync user acquisition data
     */
    private async syncUserAcquisition(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'user_acquisition';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            propertyId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        // Drop and recreate the table to ensure schema matches
        await manager.query(`DROP TABLE IF EXISTS ${fullTableName}`);
        
        await manager.query(`
            CREATE TABLE ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                first_user_source VARCHAR(255),
                first_user_medium VARCHAR(255),
                first_user_campaign_id VARCHAR(255),
                new_users INTEGER,
                sessions INTEGER,
                engagement_rate DECIMAL(5,2),
                conversions INTEGER,
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(date, first_user_source, first_user_medium, first_user_campaign_id)
            )
        `);
        
        const preset = GoogleAnalyticsService.getReportPresets().user_acquisition;
        const response = await this.gaService.runReport(
            propertyId,
            connectionDetails,
            preset.dimensions,
            preset.metrics,
            [{startDate: '90daysAgo', endDate: 'today'}]
        );
        
        const rows = this.gaService.transformReportToRows(response);
        
        for (const row of rows) {
            await manager.query(`
                INSERT INTO ${fullTableName} 
                (date, first_user_source, first_user_medium, first_user_campaign_id, 
                 new_users, sessions, engagement_rate, conversions)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (date, first_user_source, first_user_medium, first_user_campaign_id) 
                DO UPDATE SET
                    new_users = EXCLUDED.new_users,
                    sessions = EXCLUDED.sessions,
                    engagement_rate = EXCLUDED.engagement_rate,
                    conversions = EXCLUDED.conversions,
                    synced_at = NOW()
            `, [
                row.date,
                row.firstUserSource || 'direct',
                row.firstUserMedium || 'none',
                row.firstUserCampaignId || '(not set)',
                row.newUsers || 0,
                row.sessions || 0,
                row.engagementRate || 0,
                row.conversions || 0
            ]);
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: propertyId,
            tableType: 'google_analytics'
        });
        
        console.log(`✅ Synced ${rows.length} rows to ${logicalTableName} (${physicalTableName})`);
        return rows.length;
    }
    
    /**
     * Sync geographic data
     */
    private async syncGeographic(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'geographic';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            propertyId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                country VARCHAR(100),
                city VARCHAR(100),
                total_users INTEGER,
                sessions INTEGER,
                screen_page_views INTEGER,
                average_session_duration DECIMAL(10,2),
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(country, city)
            )
        `);
        
        const preset = GoogleAnalyticsService.getReportPresets().geographic;
        const response = await this.gaService.runReport(
            propertyId,
            connectionDetails,
            preset.dimensions,
            preset.metrics,
            [{startDate: '30daysAgo', endDate: 'today'}]
        );
        
        const rows = this.gaService.transformReportToRows(response);
        
        for (const row of rows) {
            await manager.query(`
                INSERT INTO ${fullTableName} 
                (country, city, total_users, sessions, screen_page_views, average_session_duration)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (country, city) 
                DO UPDATE SET
                    total_users = EXCLUDED.total_users,
                    sessions = EXCLUDED.sessions,
                    screen_page_views = EXCLUDED.screen_page_views,
                    average_session_duration = EXCLUDED.average_session_duration,
                    synced_at = NOW()
            `, [
                row.country || 'Unknown',
                row.city || 'Unknown',
                row.totalUsers || 0,
                row.sessions || 0,
                row.screenPageViews || 0,
                row.averageSessionDuration || 0
            ]);
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: propertyId,
            tableType: 'google_analytics'
        });
        
        console.log(`✅ Synced ${rows.length} rows to ${logicalTableName} (${physicalTableName})`);
        return rows.length;
    }
    
    /**
     * Sync device data
     */
    private async syncDeviceData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'device';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            propertyId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                device_category VARCHAR(50),
                operating_system VARCHAR(100),
                browser VARCHAR(100),
                total_users INTEGER,
                sessions INTEGER,
                screen_page_views INTEGER,
                bounce_rate DECIMAL(5,2),
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(device_category, operating_system, browser)
            )
        `);
        
        const preset = GoogleAnalyticsService.getReportPresets().device;
        const response = await this.gaService.runReport(
            propertyId,
            connectionDetails,
            preset.dimensions,
            preset.metrics,
            [{startDate: '30daysAgo', endDate: 'today'}]
        );
        
        const rows = this.gaService.transformReportToRows(response);
        
        for (const row of rows) {
            await manager.query(`
                INSERT INTO ${fullTableName} 
                (device_category, operating_system, browser, total_users, sessions, 
                 screen_page_views, bounce_rate)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (device_category, operating_system, browser) 
                DO UPDATE SET
                    total_users = EXCLUDED.total_users,
                    sessions = EXCLUDED.sessions,
                    screen_page_views = EXCLUDED.screen_page_views,
                    bounce_rate = EXCLUDED.bounce_rate,
                    synced_at = NOW()
            `, [
                row.deviceCategory || 'desktop',
                row.operatingSystem || 'Unknown',
                row.browser || 'Unknown',
                row.totalUsers || 0,
                row.sessions || 0,
                row.screenPageViews || 0,
                row.bounceRate || 0
            ]);
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: propertyId,
            tableType: 'google_analytics'
        });
        
        console.log(`✅ Synced ${rows.length} rows to ${logicalTableName} (${physicalTableName})`);
        return rows.length;
    }
    
    /**
     * Sync events data
     */
    private async syncEvents(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'events';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            propertyId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                event_name VARCHAR(255),
                event_count INTEGER,
                event_value DECIMAL(10,2),
                conversions INTEGER,
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(date, event_name)
            )
        `);
        
        const preset = GoogleAnalyticsService.getReportPresets().events;
        const response = await this.gaService.runReport(
            propertyId,
            connectionDetails,
            preset.dimensions,
            preset.metrics,
            [{startDate: '30daysAgo', endDate: 'today'}]
        );
        
        const rows = this.gaService.transformReportToRows(response);
        
        for (const row of rows) {
            await manager.query(`
                INSERT INTO ${fullTableName} 
                (date, event_name, event_count, event_value, conversions)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (date, event_name) 
                DO UPDATE SET
                    event_count = EXCLUDED.event_count,
                    event_value = EXCLUDED.event_value,
                    conversions = EXCLUDED.conversions,
                    synced_at = NOW()
            `, [
                row.date,
                row.eventName || 'unknown',
                row.eventCount || 0,
                row.eventValue || 0,
                row.conversions || 0
            ]);
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: propertyId,
            tableType: 'google_analytics'
        });
        
        console.log(`✅ Synced ${rows.length} rows to ${logicalTableName} (${physicalTableName})`);
        return rows.length;
    }
    
    /**
     * Update last sync timestamp
     */
    private async updateLastSyncTime(manager: any, schemaName: string, dataSourceId: number, rowsSynced: number = 0): Promise<void> {
        // Create sync_history table if it doesn't exist
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${schemaName}.sync_history (
                id SERIAL PRIMARY KEY,
                data_source_id INTEGER NOT NULL,
                sync_started_at TIMESTAMP NOT NULL,
                sync_completed_at TIMESTAMP NOT NULL,
                status VARCHAR(50),
                rows_synced INTEGER,
                error_message TEXT
            )
        `);
        
        await manager.query(`
            INSERT INTO ${schemaName}.sync_history 
            (data_source_id, sync_started_at, sync_completed_at, status, rows_synced)
            VALUES ($1, NOW(), NOW(), 'success', $2)
        `, [dataSourceId, rowsSynced]);
    }
    
    /**
     * Get schema metadata
     */
    public async getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any> {
        // Return schema structure of synced tables
        return {
            schema: 'dra_google_analytics',
            tables: [
                { name: 'traffic_overview', type: 'table' },
                { name: 'page_performance', type: 'table' },
                { name: 'user_acquisition', type: 'table' },
                { name: 'geographic', type: 'table' },
                { name: 'device', type: 'table' },
                { name: 'events', type: 'table' }
            ]
        };
    }
    
    /**
     * Ensure schema and sync_history table exist
     */
    private async ensureSchemaAndSyncHistoryTable(): Promise<any> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return null;
            
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            
            // Create schema if it doesn't exist
            await manager.query(`CREATE SCHEMA IF NOT EXISTS dra_google_analytics`);
            
            // Create sync_history table if it doesn't exist
            await manager.query(`
                CREATE TABLE IF NOT EXISTS dra_google_analytics.sync_history (
                    id SERIAL PRIMARY KEY,
                    data_source_id INTEGER NOT NULL,
                    sync_started_at TIMESTAMP NOT NULL,
                    sync_completed_at TIMESTAMP NOT NULL,
                    status VARCHAR(50),
                    rows_synced INTEGER,
                    error_message TEXT
                )
            `);
            
            return manager;
        } catch (error) {
            console.error('Error ensuring schema and sync_history table:', error);
            return null;
        }
    }
    
    /**
     * Get last sync time
     */
    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        try {
            const manager = await this.ensureSchemaAndSyncHistoryTable();
            if (!manager) return null;
            
            const result = await manager.query(`
                SELECT sync_completed_at 
                FROM dra_google_analytics.sync_history 
                WHERE data_source_id = $1 
                ORDER BY sync_completed_at DESC 
                LIMIT 1
            `, [dataSourceId]);
            
            return result[0]?.sync_completed_at || null;
        } catch (error) {
            console.error('Error getting last sync time:', error);
            return null;
        }
    }
    
    /**
     * Get sync history
     */
    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        try {
            const manager = await this.ensureSchemaAndSyncHistoryTable();
            if (!manager) return [];
            
            const result = await manager.query(`
                SELECT * 
                FROM dra_google_analytics.sync_history 
                WHERE data_source_id = $1 
                ORDER BY sync_completed_at DESC 
                LIMIT $2
            `, [dataSourceId, limit]);
            
            return result;
        } catch (error) {
            console.error('Error getting sync history:', error);
            return [];
        }
    }
}
