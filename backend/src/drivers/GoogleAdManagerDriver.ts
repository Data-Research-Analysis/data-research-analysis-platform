import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleAdManagerService } from '../services/GoogleAdManagerService.js';
import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
import { DBDriver } from './DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import {
    IGAMReportQuery,
    IGAMReportResponse,
    IGAMRevenueData,
    IGAMInventoryData,
    IGAMOrderData,
    IGAMGeographyData,
    IGAMDeviceData,
    GAMReportType,
} from '../types/IGoogleAdManager.js';

/**
 * Google Ad Manager Driver
 * Handles data synchronization from Google Ad Manager to PostgreSQL
 */
export class GoogleAdManagerDriver implements IAPIDriver {
    private static instance: GoogleAdManagerDriver;
    private gamService: GoogleAdManagerService;
    private oauthService: GoogleOAuthService;
    
    private constructor() {
        this.gamService = GoogleAdManagerService.getInstance();
        this.oauthService = GoogleOAuthService.getInstance();
    }
    
    public static getInstance(): GoogleAdManagerDriver {
        if (!GoogleAdManagerDriver.instance) {
            GoogleAdManagerDriver.instance = new GoogleAdManagerDriver();
        }
        return GoogleAdManagerDriver.instance;
    }
    
    /**
     * Authenticate with Google Ad Manager API
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
            
            // Test authentication by fetching networks
            await this.gamService.listNetworks(connectionDetails.oauth_access_token);
            
            console.log('✅ Google Ad Manager authentication successful');
            return true;
        } catch (error) {
            console.error('❌ Google Ad Manager authentication failed:', error);
            return false;
        }
    }
    
    /**
     * Sync Google Ad Manager data to PostgreSQL
     * Creates schema and tables if they don't exist, then syncs data
     */
    public async syncToDatabase(
        dataSourceId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        try {
            console.log(`🔄 Starting Google Ad Manager sync for data source ${dataSourceId}`);
            
            // Ensure authentication is valid
            const isAuthenticated = await this.authenticate(connectionDetails);
            if (!isAuthenticated) {
                throw new Error('Authentication failed');
            }
            
            const networkCode = connectionDetails.api_config?.network_code;
            if (!networkCode) {
                throw new Error('Network code not configured');
            }
            
            // Get database connection
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                throw new Error('Database driver not available');
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            
            // Create schema if it doesn't exist
            const schemaName = 'dra_google_ad_manager';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            console.log(`✅ Schema ${schemaName} ready`);
            
            // Get sync configuration
            const reportTypes = connectionDetails.api_config?.report_types || ['revenue'];
            const startDate = connectionDetails.api_config?.start_date || this.getDefaultStartDate();
            const endDate = connectionDetails.api_config?.end_date || this.getDefaultEndDate();
            
            console.log(`📅 Sync period: ${startDate} to ${endDate}`);
            console.log(`📊 Report types: ${reportTypes.join(', ')}`);
            
            // Sync selected report types
            for (const reportType of reportTypes) {
                try {
                    await this.syncReportType(
                        manager,
                        schemaName,
                        networkCode,
                        reportType,
                        startDate,
                        endDate,
                        connectionDetails
                    );
                } catch (error) {
                    console.error(`❌ Failed to sync ${reportType} report:`, error);
                    // Continue with other reports even if one fails
                }
            }
            
            console.log(`✅ Google Ad Manager sync completed for data source ${dataSourceId}`);
            return true;
        } catch (error) {
            console.error('❌ Google Ad Manager sync failed:', error);
            return false;
        }
    }
    
    /**
     * Sync a specific report type
     */
    private async syncReportType(
        manager: any,
        schemaName: string,
        networkCode: string,
        reportTypeString: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const reportType = this.gamService.getReportType(reportTypeString);
        
        console.log(`📊 Syncing ${reportType} report...`);
        
        switch (reportType) {
            case GAMReportType.REVENUE:
                await this.syncRevenueData(manager, schemaName, networkCode, startDate, endDate, connectionDetails);
                break;
            case GAMReportType.INVENTORY:
                await this.syncInventoryData(manager, schemaName, networkCode, startDate, endDate, connectionDetails);
                break;
            case GAMReportType.ORDERS:
                await this.syncOrdersData(manager, schemaName, networkCode, startDate, endDate, connectionDetails);
                break;
            case GAMReportType.GEOGRAPHY:
                await this.syncGeographyData(manager, schemaName, networkCode, startDate, endDate, connectionDetails);
                break;
            case GAMReportType.DEVICE:
                await this.syncDeviceData(manager, schemaName, networkCode, startDate, endDate, connectionDetails);
                break;
            default:
                console.warn(`⚠️  Unknown report type: ${reportType}`);
        }
    }
    
    /**
     * Sync revenue report data
     */
    private async syncRevenueData(
        manager: any,
        schemaName: string,
        networkCode: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `revenue_${networkCode}`;
        const fullTableName = `${schemaName}.${tableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                ad_unit_id VARCHAR(255),
                ad_unit_name TEXT,
                country_code VARCHAR(10),
                country_name VARCHAR(255),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                revenue DECIMAL(15,2) DEFAULT 0,
                cpm DECIMAL(10,2) DEFAULT 0,
                ctr DECIMAL(10,4) DEFAULT 0,
                fill_rate DECIMAL(10,4) DEFAULT 0,
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, ad_unit_id, country_code)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        
        // Build and execute report query
        const reportQuery = this.gamService.buildRevenueReportQuery(networkCode, startDate, endDate);
        const reportResponse = await this.gamService.runReport(reportQuery, connectionDetails);
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for revenue report');
            return;
        }
        
        // Transform and insert data
        const transformedData = this.transformRevenueData(reportResponse, networkCode);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'ad_unit_id', 'country_code']);
        
        console.log(`✅ Synced ${transformedData.length} revenue records`);
    }
    
    /**
     * Sync inventory report data
     */
    private async syncInventoryData(
        manager: any,
        schemaName: string,
        networkCode: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `inventory_${networkCode}`;
        const fullTableName = `${schemaName}.${tableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                ad_unit_id VARCHAR(255),
                ad_unit_name TEXT,
                device_category VARCHAR(100),
                ad_requests BIGINT DEFAULT 0,
                matched_requests BIGINT DEFAULT 0,
                impressions BIGINT DEFAULT 0,
                fill_rate DECIMAL(10,4) DEFAULT 0,
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, ad_unit_id, device_category)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        console.log('ℹ️  Inventory sync - placeholder (will implement with actual API)');
    }
    
    /**
     * Sync orders & line items data
     */
    private async syncOrdersData(
        manager: any,
        schemaName: string,
        networkCode: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `orders_${networkCode}`;
        const fullTableName = `${schemaName}.${tableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                order_id VARCHAR(255),
                order_name TEXT,
                line_item_id VARCHAR(255),
                line_item_name TEXT,
                advertiser_id VARCHAR(255),
                advertiser_name TEXT,
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                revenue DECIMAL(15,2) DEFAULT 0,
                delivery_status VARCHAR(100),
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, line_item_id)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        console.log('ℹ️  Orders sync - placeholder (will implement with actual API)');
    }
    
    /**
     * Sync geography performance data
     */
    private async syncGeographyData(
        manager: any,
        schemaName: string,
        networkCode: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `geography_${networkCode}`;
        const fullTableName = `${schemaName}.${tableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                country_code VARCHAR(10),
                country_name VARCHAR(255),
                region VARCHAR(255),
                city VARCHAR(255),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                revenue DECIMAL(15,2) DEFAULT 0,
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, country_code, region, city)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        console.log('ℹ️  Geography sync - placeholder (will implement with actual API)');
    }
    
    /**
     * Sync device & browser data
     */
    private async syncDeviceData(
        manager: any,
        schemaName: string,
        networkCode: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const tableName = `device_${networkCode}`;
        const fullTableName = `${schemaName}.${tableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                device_category VARCHAR(100),
                browser_name VARCHAR(100),
                operating_system VARCHAR(100),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                revenue DECIMAL(15,2) DEFAULT 0,
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, device_category, browser_name)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        console.log('ℹ️  Device sync - placeholder (will implement with actual API)');
    }
    
    /**
     * Transform GAM revenue report data to PostgreSQL format
     */
    private transformRevenueData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            
            // Calculate derived metrics
            const cpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            
            return {
                date: row.dimensions['DATE'],
                ad_unit_id: row.dimensions['AD_UNIT_ID'] || null,
                ad_unit_name: row.dimensions['AD_UNIT_NAME'] || null,
                country_code: row.dimensions['COUNTRY_CODE'] || null,
                country_name: row.dimensions['COUNTRY_NAME'] || null,
                impressions,
                clicks,
                revenue: parseFloat(revenue.toString()),
                cpm: parseFloat(cpm.toFixed(2)),
                ctr: parseFloat(ctr.toFixed(4)),
                fill_rate: 0, // Will be calculated if ad_requests data available
                network_code: networkCode,
            };
        });
    }
    
    /**
     * Bulk upsert data into table
     */
    private async bulkUpsert(
        manager: any,
        tableName: string,
        data: any[],
        conflictColumns: string[]
    ): Promise<void> {
        if (data.length === 0) {
            return;
        }
        
        const batchSize = 1000;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            
            // Build column names and values
            const columns = Object.keys(batch[0]);
            const placeholders = batch.map((_, rowIndex) => {
                const rowPlaceholders = columns.map((_, colIndex) => {
                    return `$${rowIndex * columns.length + colIndex + 1}`;
                });
                return `(${rowPlaceholders.join(', ')})`;
            }).join(', ');
            
            const values = batch.flatMap(row => columns.map(col => row[col]));
            
            // Build update clause for ON CONFLICT
            const updateClause = columns
                .filter(col => !conflictColumns.includes(col) && col !== 'id')
                .map(col => `${col} = EXCLUDED.${col}`)
                .join(', ');
            
            const query = `
                INSERT INTO ${tableName} (${columns.join(', ')})
                VALUES ${placeholders}
                ON CONFLICT (${conflictColumns.join(', ')})
                DO UPDATE SET ${updateClause}, synced_at = CURRENT_TIMESTAMP
            `;
            
            await manager.query(query, values);
        }
    }
    
    /**
     * Get default start date (30 days ago)
     */
    private getDefaultStartDate(): string {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    }
    
    /**
     * Get default end date (today)
     */
    private getDefaultEndDate(): string {
        return new Date().toISOString().split('T')[0];
    }
    
    /**
     * Get schema metadata for GAM data source
     * Returns table/column structure for all synced GAM tables
     */
    public async getSchema(connectionDetails: IAPIConnectionDetails): Promise<any> {
        const networkCode = connectionDetails.api_config?.network_code;
        if (!networkCode) {
            throw new Error('Network code not configured');
        }
        
        const reportTypes = connectionDetails.api_config?.report_types || ['revenue'];
        const schemaName = 'dra_google_ad_manager';
        
        const tables = reportTypes.map((reportType: string) => {
            const tableName = `${reportType}_${networkCode}`;
            return {
                schema: schemaName,
                table: tableName,
                columns: this.getTableColumns(reportType),
            };
        });
        
        return {
            schemaName,
            tables,
        };
    }
    
    /**
     * Get column definitions for a report type
     */
    private getTableColumns(reportType: string): any[] {
        const baseColumns = [
            { name: 'id', type: 'integer', nullable: false },
            { name: 'date', type: 'date', nullable: false },
        ];
        
        switch (reportType) {
            case 'revenue':
                return [
                    ...baseColumns,
                    { name: 'ad_unit_id', type: 'varchar', nullable: true },
                    { name: 'ad_unit_name', type: 'text', nullable: true },
                    { name: 'country_code', type: 'varchar', nullable: true },
                    { name: 'country_name', type: 'varchar', nullable: true },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'clicks', type: 'bigint', nullable: false },
                    { name: 'revenue', type: 'decimal', nullable: false },
                    { name: 'cpm', type: 'decimal', nullable: false },
                    { name: 'ctr', type: 'decimal', nullable: false },
                    { name: 'fill_rate', type: 'decimal', nullable: false },
                    { name: 'network_code', type: 'varchar', nullable: false },
                    { name: 'synced_at', type: 'timestamp', nullable: false },
                ];
            case 'inventory':
                return [
                    ...baseColumns,
                    { name: 'ad_unit_id', type: 'varchar', nullable: true },
                    { name: 'ad_unit_name', type: 'text', nullable: true },
                    { name: 'device_category', type: 'varchar', nullable: true },
                    { name: 'ad_requests', type: 'bigint', nullable: false },
                    { name: 'matched_requests', type: 'bigint', nullable: false },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'fill_rate', type: 'decimal', nullable: false },
                    { name: 'network_code', type: 'varchar', nullable: false },
                    { name: 'synced_at', type: 'timestamp', nullable: false },
                ];
            case 'orders':
                return [
                    ...baseColumns,
                    { name: 'order_id', type: 'varchar', nullable: true },
                    { name: 'order_name', type: 'text', nullable: true },
                    { name: 'line_item_id', type: 'varchar', nullable: true },
                    { name: 'line_item_name', type: 'text', nullable: true },
                    { name: 'advertiser_id', type: 'varchar', nullable: true },
                    { name: 'advertiser_name', type: 'text', nullable: true },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'clicks', type: 'bigint', nullable: false },
                    { name: 'revenue', type: 'decimal', nullable: false },
                    { name: 'delivery_status', type: 'varchar', nullable: true },
                    { name: 'network_code', type: 'varchar', nullable: false },
                    { name: 'synced_at', type: 'timestamp', nullable: false },
                ];
            case 'geography':
                return [
                    ...baseColumns,
                    { name: 'country_code', type: 'varchar', nullable: true },
                    { name: 'country_name', type: 'varchar', nullable: true },
                    { name: 'region', type: 'varchar', nullable: true },
                    { name: 'city', type: 'varchar', nullable: true },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'clicks', type: 'bigint', nullable: false },
                    { name: 'revenue', type: 'decimal', nullable: false },
                    { name: 'network_code', type: 'varchar', nullable: false },
                    { name: 'synced_at', type: 'timestamp', nullable: false },
                ];
            case 'device':
                return [
                    ...baseColumns,
                    { name: 'device_category', type: 'varchar', nullable: true },
                    { name: 'browser_name', type: 'varchar', nullable: true },
                    { name: 'operating_system', type: 'varchar', nullable: true },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'clicks', type: 'bigint', nullable: false },
                    { name: 'revenue', type: 'decimal', nullable: false },
                    { name: 'network_code', type: 'varchar', nullable: false },
                    { name: 'synced_at', type: 'timestamp', nullable: false },
                ];
            default:
                return baseColumns;
        }
    }
    
    /**
     * Get last sync timestamp for a data source
     */
    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return null;
            }
            const dbConnector = await driver.getConcreteDriver();
            
            // Query the most recent synced_at timestamp from any GAM table
            const result = await dbConnector.query(`
                SELECT MAX(synced_at) as last_sync
                FROM information_schema.tables
                WHERE table_schema = 'dra_google_ad_manager'
            `);
            
            if (result && result[0] && result[0].last_sync) {
                return new Date(result[0].last_sync);
            }
            
            return null;
        } catch (error) {
            console.error('❌ Failed to get last sync time:', error);
            return null;
        }
    }
    
    /**
     * Get sync history for a data source
     */
    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        // TODO: Implement sync history tracking
        // This will require a separate sync_history table
        console.log('📝 getSyncHistory - placeholder implementation');
        return [];
    }
}
