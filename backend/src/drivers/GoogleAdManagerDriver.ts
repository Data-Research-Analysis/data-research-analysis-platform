import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleAdManagerService } from '../services/GoogleAdManagerService.js';
import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';
import { SyncType } from '../entities/SyncHistory.js';
import { DBDriver } from './DBDriver.js';
import { TableMetadataService } from '../services/TableMetadataService.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { RetryHandler } from '../utils/RetryHandler.js';
import {
    IGAMReportQuery,
    IGAMReportResponse,
    IGAMRevenueData,
    IGAMGeographyData,
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
    private syncHistoryService: SyncHistoryService;
    
    private constructor() {
        this.gamService = GoogleAdManagerService.getInstance();
        this.oauthService = GoogleOAuthService.getInstance();
        this.syncHistoryService = SyncHistoryService.getInstance();
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
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        // Create sync history record
        const syncRecord = await this.syncHistoryService.createSyncRecord(
            dataSourceId,
            SyncType.MANUAL,
            {
                reportTypes: connectionDetails.api_config?.report_types || [],
                startDate: connectionDetails.api_config?.start_date,
                endDate: connectionDetails.api_config?.end_date,
                networkCode: connectionDetails.api_config?.network_code,
            }
        );
        
        const syncStartTime = Date.now();
        
        try {
            console.log(`🔄 Starting Google Ad Manager sync for data source ${dataSourceId}`);
            
            // Mark as running
            await this.syncHistoryService.markAsRunning(syncRecord.id);
            
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
            
            // Get sync configuration (simplified - no advanced config)
            const reportTypes = connectionDetails.api_config?.report_types || ['revenue'];
            // Get date range from connection details or use defaults
            const startDate = connectionDetails.api_config?.start_date || this.getDefaultStartDate();
            const endDate = connectionDetails.api_config?.end_date || this.getDefaultEndDate();
            
            console.log(`📅 Sync period: ${startDate} to ${endDate}`);
            console.log(`📊 Report types: ${reportTypes.join(', ')}`);
            
            // Track sync results
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            const errors: string[] = [];
            
            // Sync selected report types
            for (let i = 0; i < reportTypes.length; i++) {
                const reportType = reportTypes[i];
                const reportStartTime = Date.now();
                
                try {
                    const result = await this.syncReportType(
                        manager,
                        schemaName,
                        dataSourceId,
                        reportType,
                        startDate,
                        endDate,
                        connectionDetails
                    );
                    
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                    
                    console.log(`✅ ${reportType} report completed: ${result.recordsSynced} records synced`);
                } catch (error: any) {
                    console.error(`❌ Failed to sync ${reportType} report:`, error);
                    errors.push(`${reportType}: ${error.message}`);
                    totalRecordsFailed++;
                    // Continue with other reports even if one fails
                }
            }
            
            // Complete sync record
            const errorMessage = errors.length > 0 ? errors.join('; ') : undefined;
            const syncEndTime = Date.now();
            
            await this.syncHistoryService.completeSyncRecord(
                syncRecord.id,
                totalRecordsSynced,
                totalRecordsFailed,
                errorMessage
            );
            
            // Determine final status
            let finalStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED';
            if (totalRecordsFailed === 0) {
                finalStatus = 'COMPLETED';
            } else if (totalRecordsSynced > 0) {
                finalStatus = 'PARTIAL';
            } else {
                finalStatus = 'FAILED';
            }
            
            console.log(`✅ Google Ad Manager sync completed for data source ${dataSourceId}`);
            console.log(`   Status: ${finalStatus}, Records: ${totalRecordsSynced}, Failed: ${totalRecordsFailed}`);
            
            return true;
        } catch (error: any) {
            console.error('❌ Google Ad Manager sync failed:', error);
            
            await this.syncHistoryService.markAsFailed(syncRecord.id, error.message || 'Unknown error');
            
            return false;
        }
    }
    
    /**
     * Dispatch to appropriate sync method based on report type (simplified - only revenue and geography)
     */
    private async syncReportType(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        reportTypeString: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const reportType = this.gamService.getReportType(reportTypeString);

        switch (reportType) {
            case GAMReportType.REVENUE:
                return await this.syncRevenueData(manager, schemaName, dataSourceId, startDate, endDate, connectionDetails);
            case GAMReportType.GEOGRAPHY:
                return await this.syncGeographyData(manager, schemaName, dataSourceId, startDate, endDate, connectionDetails);
            case GAMReportType.DEVICE:
                return await this.syncDeviceData(manager, schemaName, dataSourceId, startDate, endDate, connectionDetails);
            case GAMReportType.AD_UNIT:
                return await this.syncAdUnitData(manager, schemaName, dataSourceId, startDate, endDate, connectionDetails);
            case GAMReportType.ADVERTISER:
                return await this.syncAdvertiserData(manager, schemaName, dataSourceId, startDate, endDate, connectionDetails);
            case GAMReportType.TIME_SERIES:
                return await this.syncTimeSeriesData(manager, schemaName, dataSourceId, startDate, endDate, connectionDetails);
            default:
                console.warn(`⚠️  Unsupported report type: ${reportType}`);
                return { recordsSynced: 0, recordsFailed: 0 };
        }
    }
    
    /**
     * Sync revenue report data (simplified - always validates and deduplicates)
     */
    private async syncRevenueData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get network code for API calls first
        const networkCode = connectionDetails.api_config?.network_code;
        if (!networkCode) {
            throw new Error('Network code not configured');
        }

        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'revenue';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            networkCode
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
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
        
        // Build and execute report query with retry logic
        const reportQuery = this.gamService.buildRevenueReportQuery(networkCode, startDate, endDate);
        
        const reportResult = await RetryHandler.execute(
            () => this.gamService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch revenue report after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch revenue report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for revenue report');
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        let transformedData = this.transformRevenueData(reportResponse, networkCode);
        
        // Always validate data before inserting
        const validation = this.validateRevenueData(transformedData);
        if (!validation.isValid) {
            console.error('❌ Revenue data validation failed:', validation.errors);
            throw new Error(`Data validation failed: ${validation.errors.slice(0, 3).join(', ')}`);
        }
        
        // Always use upsert for deduplication
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'ad_unit_id', 'country_code']);
        
        console.log(`✅ Synced ${transformedData.length} revenue records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    /**
     * Sync geography report data (simplified - always validates and deduplicates)
     */
    private async syncGeographyData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get network code first
        const networkCode = connectionDetails.api_config?.network_code;
        if (!networkCode) {
            throw new Error('Network code not configured');
        }

        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'geography';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            networkCode
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
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
        
        // Build and execute report query with retry logic
        const reportQuery = this.gamService.buildGeographyReportQuery(networkCode, startDate, endDate);
        
        const reportResult = await RetryHandler.execute(
            () => this.gamService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch geography report after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch geography report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for geography report');
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformGeographyData(reportResponse, networkCode);
        
        // Always use upsert for deduplication
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'country_code', 'region', 'city']);
        
        console.log(`✅ Synced ${transformedData.length} geography records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    /**
     * Sync device & browser report data
     */
    private async syncDeviceData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get network code first
        const networkCode = connectionDetails.api_config?.network_code;
        if (!networkCode) {
            throw new Error('Network code not configured');
        }

        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'device';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            networkCode
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                device_category VARCHAR(50),
                browser_name VARCHAR(100),
                operating_system VARCHAR(100),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                revenue DECIMAL(15,2) DEFAULT 0,
                ctr DECIMAL(10,4) DEFAULT 0,
                cpm DECIMAL(10,2) DEFAULT 0,
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, device_category, browser_name, operating_system)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        
        // Build and execute report query with retry logic
       const reportQuery = this.gamService.buildDeviceReportQuery(networkCode, startDate, endDate);
        
        const reportResult = await RetryHandler.execute(
            () => this.gamService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch device report after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch device report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for device report');
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformDeviceData(reportResponse, networkCode);
        
        // Always use upsert for deduplication
        await this.bulkUpsert(manager, fullTableName, transformedData, 
            ['date', 'device_category', 'browser_name', 'operating_system']);
        
        console.log(`✅ Synced ${transformedData.length} device records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    /**
     * Sync ad unit performance report data
     */
    private async syncAdUnitData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get network code first
        const networkCode = connectionDetails.api_config?.network_code;
        if (!networkCode) {
            throw new Error('Network code not configured');
        }

        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'ad_unit';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            networkCode
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                ad_unit_id VARCHAR(255),
                ad_unit_name TEXT,
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                revenue DECIMAL(15,2) DEFAULT 0,
                ad_server_impressions BIGINT DEFAULT 0,
                ad_server_clicks BIGINT DEFAULT 0,
                ctr DECIMAL(10,4) DEFAULT 0,
                fill_rate DECIMAL(10,4) DEFAULT 0,
                ecpm DECIMAL(10,2) DEFAULT 0,
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, ad_unit_id)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        
        // Build and execute report query with retry logic
        const reportQuery = this.gamService.buildAdUnitReportQuery(networkCode, startDate, endDate);
        
        const reportResult = await RetryHandler.execute(
            () => this.gamService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch ad unit report after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch ad unit report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for ad unit report');
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformAdUnitData(reportResponse, networkCode);
        
        // Always use upsert for deduplication
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'ad_unit_id']);
        
        console.log(`✅ Synced ${transformedData.length} ad unit records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    /**
     * Sync advertiser performance report data
     */
    private async syncAdvertiserData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get network code first
        const networkCode = connectionDetails.api_config?.network_code;
        if (!networkCode) {
            throw new Error('Network code not configured');
        }

        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'advertiser';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            networkCode
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                advertiser_id VARCHAR(255),
                advertiser_name TEXT,
                order_id VARCHAR(255),
                order_name TEXT,
                line_item_id VARCHAR(255),
                line_item_name TEXT,
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                revenue DECIMAL(15,2) DEFAULT 0,
                ctr DECIMAL(10,4) DEFAULT 0,
                cpm DECIMAL(10,2) DEFAULT 0,
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, advertiser_id, order_id, line_item_id)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        
        // Build and execute report query with retry logic
        const reportQuery = this.gamService.buildAdvertiserReportQuery(networkCode, startDate, endDate);
        
        const reportResult = await RetryHandler.execute(
            () => this.gamService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch advertiser report after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch advertiser report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for advertiser report');
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformAdvertiserData(reportResponse, networkCode);
        
        // Always use upsert for deduplication
        await this.bulkUpsert(manager, fullTableName, transformedData, 
            ['date', 'advertiser_id', 'order_id', 'line_item_id']);
        
        console.log(`✅ Synced ${transformedData.length} advertiser records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    /**
     * Sync time series (daily aggregates) report data
     */
    private async syncTimeSeriesData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get network code first
        const networkCode = connectionDetails.api_config?.network_code;
        if (!networkCode) {
            throw new Error('Network code not configured');
        }

        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'time_series';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            networkCode
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
                
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL UNIQUE,
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                revenue DECIMAL(15,2) DEFAULT 0,
                unfilled_impressions BIGINT DEFAULT 0,
                ad_requests BIGINT DEFAULT 0,
                ctr DECIMAL(10,4) DEFAULT 0,
                fill_rate DECIMAL(10,4) DEFAULT 0,
                ecpm DECIMAL(10,2) DEFAULT 0,
                network_code VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready`);
        
        // Build and execute report query with retry logic
        const reportQuery = this.gamService.buildTimeSeriesReportQuery(networkCode, startDate, endDate);
        
        const reportResult = await RetryHandler.execute(
            () => this.gamService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch time series report after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch time series report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for time series report');
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformTimeSeriesData(reportResponse, networkCode);
        
        // Always use upsert for deduplication
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date']);
        
        console.log(`✅ Synced ${transformedData.length} time series records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
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
     * Transform GAM geography report data to PostgreSQL format
     */
    private transformGeographyData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            
            return {
                date: row.dimensions['DATE'],
                country_code: row.dimensions['COUNTRY_CODE'] || null,
                country_name: row.dimensions['COUNTRY_NAME'] || null,
                region: row.dimensions['REGION_NAME'] || null,
                city: row.dimensions['CITY_NAME'] || null,
                impressions,
                clicks,
                revenue: parseFloat(revenue.toString()),
                network_code: networkCode,
            };
        });
    }

        /**
     * Transform device & browser report data to PostgreSQL format
     */
    private transformDeviceData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const cpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;
            
            return {
                date: row.dimensions['DATE'],
                device_category: row.dimensions['DEVICE_CATEGORY_NAME'] || 'Unknown',
                browser_name: row.dimensions['BROWSER_NAME'] || 'Unknown',
                operating_system: row.dimensions['OPERATING_SYSTEM_NAME'] || 'Unknown',
                impressions,
                clicks,
                revenue: parseFloat(revenue.toString()),
                ctr: parseFloat(ctr.toFixed(4)),
                cpm: parseFloat(cpm.toFixed(2)),
                network_code: networkCode,
            };
        });
    }
    
    /**
     * Transform ad unit performance report data to PostgreSQL format
     */
    private transformAdUnitData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            const adServerImpressions = row.metrics['AD_SERVER_IMPRESSIONS'] || 0;
            const adServerClicks = row.metrics['AD_SERVER_CLICKS'] || 0;
            
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const fillRate = adServerImpressions > 0 ? (impressions / adServerImpressions) * 100 : 0;
            const ecpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;
            
            return {
                date: row.dimensions['DATE'],
                ad_unit_id: row.dimensions['AD_UNIT_ID'] || null,
                ad_unit_name: row.dimensions['AD_UNIT_NAME'] || null,
                impressions,
                clicks,
                revenue: parseFloat(revenue.toString()),
                ad_server_impressions: adServerImpressions,
                ad_server_clicks: adServerClicks,
                ctr: parseFloat(ctr.toFixed(4)),
                fill_rate: parseFloat(fillRate.toFixed(4)),
                ecpm: parseFloat(ecpm.toFixed(2)),
                network_code: networkCode,
            };
        });
    }
    
    /**
     * Transform advertiser performance report data to PostgreSQL format
     */
    private transformAdvertiserData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const cpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;
            
            return {
                date: row.dimensions['DATE'],
                advertiser_id: row.dimensions['ADVERTISER_ID'] || null,
                advertiser_name: row.dimensions['ADVERTISER_NAME'] || null,
                order_id: row.dimensions['ORDER_ID'] || null,
                order_name: row.dimensions['ORDER_NAME'] || null,
                line_item_id: row.dimensions['LINE_ITEM_ID'] || null,
                line_item_name: row.dimensions['LINE_ITEM_NAME'] || null,
                impressions,
                clicks,
                revenue: parseFloat(revenue.toString()),
                ctr: parseFloat(ctr.toFixed(4)),
                cpm: parseFloat(cpm.toFixed(2)),
                network_code: networkCode,
            };
        });
    }
    
    /**
     * Transform time series report data to PostgreSQL format
     */
    private transformTimeSeriesData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            const unfilledImpressions = row.metrics['UNFILLED_IMPRESSIONS'] || 0;
            const adRequests = row.metrics['AD_REQUESTS'] || 0;
            
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const fillRate = adRequests > 0 ? (impressions / adRequests) * 100 : 0;
            const ecpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;
            
            return {
                date: row.dimensions['DATE'],
                impressions,
                clicks,
                revenue: parseFloat(revenue.toString()),
                unfilled_impressions: unfilledImpressions,
                ad_requests: adRequests,
                ctr: parseFloat(ctr.toFixed(4)),
                fill_rate: parseFloat(fillRate.toFixed(4)),
                ecpm: parseFloat(ecpm.toFixed(2)),
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
     * Validate revenue data before sync
     * @param data - Revenue data to validate
     * @returns Validation result with errors
     */
    public validateRevenueData(data: any[]): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (!data || data.length === 0) {
            errors.push('No data to validate');
            return { isValid: false, errors };
        }
        
        data.forEach((row, index) => {
            // Required fields
            if (!row.date) {
                errors.push(`Row ${index}: Missing required field 'date'`);
            }
            
            if (!row.network_code) {
                errors.push(`Row ${index}: Missing required field 'network_code'`);
            }
            
            // Numeric validations
            if (row.impressions < 0) {
                errors.push(`Row ${index}: Impressions cannot be negative`);
            }
            
            if (row.clicks < 0) {
                errors.push(`Row ${index}: Clicks cannot be negative`);
            }
            
            if (row.revenue < 0) {
                errors.push(`Row ${index}: Revenue cannot be negative`);
            }
            
            // Logical validations
            if (row.clicks > row.impressions) {
                errors.push(`Row ${index}: Clicks (${row.clicks}) cannot exceed impressions (${row.impressions})`);
            }
            
            // Date format validation
            if (row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
                errors.push(`Row ${index}: Invalid date format '${row.date}' (expected YYYY-MM-DD)`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
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
    public async getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any> {
        const reportTypes = connectionDetails.api_config?.report_types || ['revenue'];
        const schemaName = 'dra_google_ad_manager';
        
        const tables = reportTypes.map((reportType: string) => {
            const tableName = `${reportType}_${dataSourceId}`;
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
        return await this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }
}
