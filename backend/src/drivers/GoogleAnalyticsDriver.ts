import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleAnalyticsService } from '../services/GoogleAnalyticsService.js';
import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
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
            
            // Sync various reports
            await this.syncTrafficOverview(manager, schemaName, dataSourceId, propertyId, connectionDetails);
            await this.syncPagePerformance(manager, schemaName, dataSourceId, propertyId, connectionDetails);
            await this.syncUserAcquisition(manager, schemaName, dataSourceId, propertyId, connectionDetails);
            await this.syncGeographic(manager, schemaName, dataSourceId, propertyId, connectionDetails);
            await this.syncDeviceData(manager, schemaName, dataSourceId, propertyId, connectionDetails);
            await this.syncEvents(manager, schemaName, dataSourceId, propertyId, connectionDetails);
            
            // Update last sync timestamp
            await this.updateLastSyncTime(manager, schemaName, dataSourceId);
            
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
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `${schemaName}.traffic_overview_${dataSourceId}`;
        
        // Create table
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
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
                INSERT INTO ${tableName} 
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
        
        console.log(`✅ Synced ${rows.length} rows to ${tableName}`);
    }
    
    /**
     * Sync page performance data
     */
    private async syncPagePerformance(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `${schemaName}.page_performance_${dataSourceId}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id SERIAL PRIMARY KEY,
                page_path VARCHAR(2048),
                page_title VARCHAR(500),
                screen_page_views INTEGER,
                average_session_duration DECIMAL(10,2),
                bounce_rate DECIMAL(5,2),
                exit_rate DECIMAL(5,2),
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
                INSERT INTO ${tableName} 
                (page_path, page_title, screen_page_views, average_session_duration, bounce_rate, exit_rate)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (page_path) 
                DO UPDATE SET
                    page_title = EXCLUDED.page_title,
                    screen_page_views = EXCLUDED.screen_page_views,
                    average_session_duration = EXCLUDED.average_session_duration,
                    bounce_rate = EXCLUDED.bounce_rate,
                    exit_rate = EXCLUDED.exit_rate,
                    synced_at = NOW()
            `, [
                row.pagePath || '/',
                row.pageTitle || 'Unknown',
                row.screenPageViews || 0,
                row.averageSessionDuration || 0,
                row.bounceRate || 0,
                row.exitRate || 0
            ]);
        }
        
        console.log(`✅ Synced ${rows.length} rows to ${tableName}`);
    }
    
    /**
     * Sync user acquisition data
     */
    private async syncUserAcquisition(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `${schemaName}.user_acquisition_${dataSourceId}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                first_user_source VARCHAR(255),
                first_user_medium VARCHAR(255),
                first_user_campaign VARCHAR(255),
                new_users INTEGER,
                sessions INTEGER,
                engagement_rate DECIMAL(5,2),
                conversions INTEGER,
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(date, first_user_source, first_user_medium, first_user_campaign)
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
                INSERT INTO ${tableName} 
                (date, first_user_source, first_user_medium, first_user_campaign, 
                 new_users, sessions, engagement_rate, conversions)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (date, first_user_source, first_user_medium, first_user_campaign) 
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
                row.firstUserCampaign || '(not set)',
                row.newUsers || 0,
                row.sessions || 0,
                row.engagementRate || 0,
                row.conversions || 0
            ]);
        }
        
        console.log(`✅ Synced ${rows.length} rows to ${tableName}`);
    }
    
    /**
     * Sync geographic data
     */
    private async syncGeographic(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `${schemaName}.geographic_${dataSourceId}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
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
                INSERT INTO ${tableName} 
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
        
        console.log(`✅ Synced ${rows.length} rows to ${tableName}`);
    }
    
    /**
     * Sync device data
     */
    private async syncDeviceData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `${schemaName}.device_${dataSourceId}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
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
                INSERT INTO ${tableName} 
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
        
        console.log(`✅ Synced ${rows.length} rows to ${tableName}`);
    }
    
    /**
     * Sync events data
     */
    private async syncEvents(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `${schemaName}.events_${dataSourceId}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
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
                INSERT INTO ${tableName} 
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
        
        console.log(`✅ Synced ${rows.length} rows to ${tableName}`);
    }
    
    /**
     * Update last sync timestamp
     */
    private async updateLastSyncTime(manager: any, schemaName: string, dataSourceId: number): Promise<void> {
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
            (data_source_id, sync_started_at, sync_completed_at, status)
            VALUES ($1, NOW(), NOW(), 'success')
        `, [dataSourceId]);
    }
    
    /**
     * Get schema metadata
     */
    public async getSchema(connectionDetails: IAPIConnectionDetails): Promise<any> {
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
     * Get last sync time
     */
    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return null;
            
            const dbConnector = await driver.getConcreteDriver();
            const result = await dbConnector.query(`
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
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return [];
            
            const dbConnector = await driver.getConcreteDriver();
            const result = await dbConnector.query(`
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
