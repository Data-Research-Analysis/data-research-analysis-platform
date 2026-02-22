import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleAdsService } from '../services/GoogleAdsService.js';
import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';
import { SyncType } from '../entities/SyncHistory.js';
import { DBDriver } from './DBDriver.js';
import { TableMetadataService } from '../services/TableMetadataService.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { RetryHandler } from '../utils/RetryHandler.js';
import {
    IGoogleAdsReportQuery,
    IGoogleAdsReportResponse,
    GoogleAdsReportType,
} from '../types/IGoogleAds.js';

/**
 * Google Ads Driver
 * Handles data synchronization from Google Ads to PostgreSQL
 */
export class GoogleAdsDriver implements IAPIDriver {
    private static instance: GoogleAdsDriver;
    private adsService: GoogleAdsService;
    private oauthService: GoogleOAuthService;
    private syncHistoryService: SyncHistoryService;
    
    private constructor() {
        this.adsService = GoogleAdsService.getInstance();
        this.oauthService = GoogleOAuthService.getInstance();
        this.syncHistoryService = SyncHistoryService.getInstance();
    }
    
    public static getInstance(): GoogleAdsDriver {
        if (!GoogleAdsDriver.instance) {
            GoogleAdsDriver.instance = new GoogleAdsDriver();
        }
        return GoogleAdsDriver.instance;
    }
    
    /**
     * Authenticate with Google Ads API
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
            
            // Test authentication by fetching accounts
            await this.adsService.listAccounts(connectionDetails.oauth_access_token);
            
            console.log('✅ Google Ads authentication successful');
            return true;
        } catch (error) {
            console.error('❌ Google Ads authentication failed:', error);
            return false;
        }
    }
    
    /**
     * Sync Google Ads data to PostgreSQL
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
                customerId: connectionDetails.api_config?.customer_id,
            }
        );
        
        try {
            console.log(`🔄 Starting Google Ads sync for data source ${dataSourceId}`);
            
            // Mark as running
            await this.syncHistoryService.markAsRunning(syncRecord.id);
            
            // Ensure authentication is valid
            const isAuthenticated = await this.authenticate(connectionDetails);
            if (!isAuthenticated) {
                throw new Error('Authentication failed');
            }
            
            const customerId = connectionDetails.api_config?.customer_id;
            if (!customerId) {
                throw new Error('Customer ID not configured');
            }
            
            // Get database connection
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                throw new Error('Database driver not available');
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            
            // Create schema if it doesn't exist
            const schemaName = 'dra_google_ads';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            console.log(`✅ Schema ${schemaName} ready`);
            
            // Get sync configuration
            const reportTypes = connectionDetails.api_config?.report_types || ['campaign'];
            const startDate = connectionDetails.api_config?.start_date || this.getDefaultStartDate();
            const endDate = connectionDetails.api_config?.end_date || this.getDefaultEndDate();
            
            console.log(`📅 Sync period: ${startDate} to ${endDate}`);
            console.log(`📊 Report types: ${reportTypes.join(', ')}`);
            
            // Track sync results
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            const errors: string[] = [];
            
            // Sync selected report types
            for (const reportType of reportTypes) {
                try {
                    const result = await this.syncReportType(
                        manager,
                        schemaName,
                        dataSourceId,
                        usersPlatformId,
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
                }
            }
            
            // Complete sync record
            const errorMessage = errors.length > 0 ? errors.join('; ') : undefined;
            
            await this.syncHistoryService.completeSyncRecord(
                syncRecord.id,
                totalRecordsSynced,
                totalRecordsFailed,
                errorMessage
            );
            
            console.log(`✅ Google Ads sync completed for data source ${dataSourceId}`);
            console.log(`   Records: ${totalRecordsSynced}, Failed: ${totalRecordsFailed}`);
            
            return true;
        } catch (error: any) {
            console.error('❌ Google Ads sync failed:', error);
            
            await this.syncHistoryService.markAsFailed(syncRecord.id, error.message || 'Unknown error');
            
            return false;
        }
    }
    
    /**
     * Dispatch to appropriate sync method based on report type
     */
    private async syncReportType(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        reportTypeString: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const reportType = this.adsService.getReportType(reportTypeString);

        switch (reportType) {
            case GoogleAdsReportType.CAMPAIGN:
                return await this.syncCampaignData(manager, schemaName, dataSourceId, usersPlatformId, startDate, endDate, connectionDetails);
            case GoogleAdsReportType.KEYWORD:
                return await this.syncKeywordData(manager, schemaName, dataSourceId, usersPlatformId, startDate, endDate, connectionDetails);
            case GoogleAdsReportType.GEOGRAPHIC:
                return await this.syncGeographicData(manager, schemaName, dataSourceId, usersPlatformId, startDate, endDate, connectionDetails);
            case GoogleAdsReportType.DEVICE:
                return await this.syncDeviceData(manager, schemaName, dataSourceId, usersPlatformId, startDate, endDate, connectionDetails);
            default:
                console.warn(`⚠️  Unsupported report type: ${reportType}`);
                return { recordsSynced: 0, recordsFailed: 0 };
        }
    }
    
    /**
     * Sync campaign performance data
     */
    private async syncCampaignData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get customer ID first
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) {
            throw new Error('Customer ID not configured');
        }

        // Check if this is a manager account
        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        
        if (isManager) {
            console.log(`⚠️  Manager account detected (${customerId}). Fetching client accounts...`);
            const clientAccounts = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            
            if (clientAccounts.length === 0) {
                console.warn('No client accounts found under manager');
                return { recordsSynced: 0, recordsFailed: 0 };
            }
            
            console.log(`📊 Syncing ${clientAccounts.length} client accounts under manager`);
            
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            
            // Sync each client account
            for (const clientId of clientAccounts) {
                try {
                    const result = await this.syncCampaignDataForAccount(
                        manager,
                        schemaName,
                        dataSourceId,
                        usersPlatformId,
                        clientId,
                        startDate,
                        endDate,
                        connectionDetails
                    );
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                } catch (error: any) {
                    console.error(`Failed to sync client account ${clientId}:`, error.message);
                    totalRecordsFailed++;
                }
            }
            
            return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
        }
        
        // Regular account - sync directly
        return await this.syncCampaignDataForAccount(
            manager,
            schemaName,
            dataSourceId,
            usersPlatformId,
            customerId,
            startDate,
            endDate,
            connectionDetails
        );
    }
    
    /**
     * Sync campaign data for a specific account (helper method)
     */
    private async syncCampaignDataForAccount(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        customerId: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'campaigns';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            customerId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        // Create table if not exists
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                campaign_id VARCHAR(255) NOT NULL,
                campaign_name TEXT,
                campaign_status VARCHAR(50),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost DECIMAL(15,2) DEFAULT 0,
                conversions DECIMAL(10,2) DEFAULT 0,
                conversion_value DECIMAL(15,2) DEFAULT 0,
                ctr DECIMAL(10,4) DEFAULT 0,
                average_cpc DECIMAL(10,2) DEFAULT 0,
                average_cpm DECIMAL(10,2) DEFAULT 0,
                customer_id VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, campaign_id)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready for account ${customerId}`);
        
        // Build and execute report query with retry logic
        const reportQuery: IGoogleAdsReportQuery = {
            customerId,
            startDate,
            endDate,
            reportType: GoogleAdsReportType.CAMPAIGN,
            metrics: [],
            dimensions: []
        };
        
        const reportResult = await RetryHandler.execute(
            () => this.adsService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch campaign report for ${customerId} after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch campaign report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log(`ℹ️  No data returned from Google Ads for campaign report (account ${customerId})`);
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformCampaignData(reportResponse, customerId);
        
        // Upsert for deduplication
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'campaign_id']);
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: customerId,
            tableType: 'google_ads'
        });
        
        console.log(`✅ Synced ${transformedData.length} campaign records for account ${customerId}`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    /**
     * Sync keyword performance data
     */
    private async syncKeywordData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get customer ID first
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) {
            throw new Error('Customer ID not configured');
        }

        // Check if this is a manager account
        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        
        if (isManager) {
            console.log(`⚠️  Manager account detected (${customerId}). Fetching client accounts...`);
            const clientAccounts = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            
            if (clientAccounts.length === 0) {
                console.warn('No client accounts found under manager');
                return { recordsSynced: 0, recordsFailed: 0 };
            }
            
            console.log(`📊 Syncing ${clientAccounts.length} client accounts under manager`);
            
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            
            // Sync each client account
            for (const clientId of clientAccounts) {
                try {
                    const result = await this.syncKeywordDataForAccount(
                        manager,
                        schemaName,
                        dataSourceId,
                        usersPlatformId,
                        clientId,
                        startDate,
                        endDate,
                        connectionDetails
                    );
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                } catch (error: any) {
                    console.error(`Failed to sync client account ${clientId}:`, error.message);
                    totalRecordsFailed++;
                }
            }
            
            return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
        }
        
        // Regular account - sync directly
        return await this.syncKeywordDataForAccount(
            manager,
            schemaName,
            dataSourceId,
            usersPlatformId,
            customerId,
            startDate,
            endDate,
            connectionDetails
        );
    }
    
    /**
     * Sync keyword data for a specific account (helper method)
     */
    private async syncKeywordDataForAccount(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        customerId: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'keywords';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            customerId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        // Create table
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                campaign_name TEXT,
                ad_group_name TEXT,
                keyword_text TEXT NOT NULL,
                match_type VARCHAR(50),
                quality_score INTEGER,
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost DECIMAL(15,2) DEFAULT 0,
                conversions DECIMAL(10,2) DEFAULT 0,
                ctr DECIMAL(10,4) DEFAULT 0,
                average_cpc DECIMAL(10,2) DEFAULT 0,
                customer_id VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, keyword_text, match_type, campaign_name, ad_group_name)
            )
        `);
        
        console.log(`✅ Table ${fullTableName} ready for account ${customerId}`);
        
        const reportQuery: IGoogleAdsReportQuery = {
            customerId,
            startDate,
            endDate,
            reportType: GoogleAdsReportType.KEYWORD,
            metrics: [],
            dimensions: []
        };
        
        const reportResult = await RetryHandler.execute(
            () => this.adsService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            throw reportResult.error || new Error('Failed to fetch keyword report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformKeywordData(reportResponse, customerId);
        await this.bulkUpsert(manager, fullTableName, transformedData, 
            ['date', 'keyword_text', 'match_type', 'campaign_name', 'ad_group_name']);
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: customerId,
            tableType: 'google_ads'
        });
        
        console.log(`✅ Synced ${transformedData.length} keyword records for account ${customerId}`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    /**
     * Sync geographic performance data
     */
    private async syncGeographicData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get customer ID first
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) {
            throw new Error('Customer ID not configured');
        }

        // Check if this is a manager account
        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        
        if (isManager) {
            console.log(`⚠️  Manager account detected (${customerId}). Fetching client accounts...`);
            const clientAccounts = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            
            if (clientAccounts.length === 0) {
                console.warn('No client accounts found under manager');
                return { recordsSynced: 0, recordsFailed: 0 };
            }
            
            console.log(`📊 Syncing ${clientAccounts.length} client accounts under manager`);
            
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            
            // Sync each client account
            for (const clientId of clientAccounts) {
                try {
                    const result = await this.syncGeographicDataForAccount(
                        manager,
                        schemaName,
                        dataSourceId,
                        usersPlatformId,
                        clientId,
                        startDate,
                        endDate,
                        connectionDetails
                    );
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                } catch (error: any) {
                    console.error(`Failed to sync client account ${clientId}:`, error.message);
                    totalRecordsFailed++;
                }
            }
            
            return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
        }
        
        // Regular account - sync directly
        return await this.syncGeographicDataForAccount(
            manager,
            schemaName,
            dataSourceId,
            usersPlatformId,
            customerId,
            startDate,
            endDate,
            connectionDetails
        );
    }
    
    /**
     * Sync geographic data for a specific account (helper method)
     */
    private async syncGeographicDataForAccount(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        customerId: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'geographic';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            customerId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                country VARCHAR(100),
                region VARCHAR(255),
                city VARCHAR(255),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost DECIMAL(15,2) DEFAULT 0,
                conversions DECIMAL(10,2) DEFAULT 0,
                conversion_value DECIMAL(15,2) DEFAULT 0,
                customer_id VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, country, region, city)
            )
        `);
        
        const reportQuery: IGoogleAdsReportQuery = {
            customerId,
            startDate,
            endDate,
            reportType: GoogleAdsReportType.GEOGRAPHIC,
            metrics: [],
            dimensions: []
        };
        
        const reportResult = await RetryHandler.execute(
            () => this.adsService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data || !reportResult.data.rows) {
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformGeographicData(reportResult.data, customerId);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'country', 'region', 'city']);
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: customerId,
            tableType: 'google_ads'
        });
        
        console.log(`✅ Synced ${transformedData.length} geographic records for account ${customerId}`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    /**
     * Sync device performance data
     */
    private async syncDeviceData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Get customer ID first
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) {
            throw new Error('Customer ID not configured');
        }

        // Check if this is a manager account
        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        
        if (isManager) {
            console.log(`⚠️  Manager account detected (${customerId}). Fetching client accounts...`);
            const clientAccounts = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            
            if (clientAccounts.length === 0) {
                console.warn('No client accounts found under manager');
                return { recordsSynced: 0, recordsFailed: 0 };
            }
            
            console.log(`📊 Syncing ${clientAccounts.length} client accounts under manager`);
            
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            
            // Sync each client account
            for (const clientId of clientAccounts) {
                try {
                    const result = await this.syncDeviceDataForAccount(
                        manager,
                        schemaName,
                        dataSourceId,
                        usersPlatformId,
                        clientId,
                        startDate,
                        endDate,
                        connectionDetails
                    );
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                } catch (error: any) {
                    console.error(`Failed to sync client account ${clientId}:`, error.message);
                    totalRecordsFailed++;
                }
            }
            
            return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
        }
        
        // Regular account - sync directly
        return await this.syncDeviceDataForAccount(
            manager,
            schemaName,
            dataSourceId,
            usersPlatformId,
            customerId,
            startDate,
            endDate,
            connectionDetails
        );
    }
    
    /**
     * Sync device data for a specific account (helper method)
     */
    private async syncDeviceDataForAccount(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        customerId: string,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        // Generate hash-based physical table name
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'device';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(
            dataSourceId,
            logicalTableName,
            customerId
        );
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                device VARCHAR(50),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost DECIMAL(15,2) DEFAULT 0,
                conversions DECIMAL(10,2) DEFAULT 0,
                conversion_value DECIMAL(15,2) DEFAULT 0,
                ctr DECIMAL(10,4) DEFAULT 0,
                average_cpc DECIMAL(10,2) DEFAULT 0,
                customer_id VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, device)
            )
        `);
        
        const reportQuery: IGoogleAdsReportQuery = {
            customerId,
            startDate,
            endDate,
            reportType: GoogleAdsReportType.DEVICE,
            metrics: [],
            dimensions: []
        };
        
        const reportResult = await RetryHandler.execute(
            () => this.adsService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data || !reportResult.data.rows) {
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        const transformedData = this.transformDeviceData(reportResult.data, customerId);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'device']);
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            fileId: customerId,
            tableType: 'google_ads'
        });
        
        console.log(`✅ Synced ${transformedData.length} device records for account ${customerId}`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    /**
     * Transform campaign data to PostgreSQL format
     */
    private transformCampaignData(reportResponse: IGoogleAdsReportResponse, customerId: string): any[] {
        return reportResponse.rows.map(row => {
            const costInDollars = (row.metrics.costMicros || 0) / 1000000;
            
            return {
                date: row.segments?.date,
                campaign_id: row.campaign?.id,
                campaign_name: row.campaign?.name,
                campaign_status: row.campaign?.status,
                impressions: row.metrics.impressions || 0,
                clicks: row.metrics.clicks || 0,
                cost: parseFloat(costInDollars.toFixed(2)),
                conversions: row.metrics.conversions || 0,
                conversion_value: row.metrics.conversionsValue || 0,
                ctr: row.metrics.ctr || 0,
                average_cpc: row.metrics.averageCpc || 0,
                average_cpm: row.metrics.averageCpm || 0,
                customer_id: customerId,
            };
        });
    }
    
    /**
     * Transform keyword data to PostgreSQL format
     */
    private transformKeywordData(reportResponse: IGoogleAdsReportResponse, customerId: string): any[] {
        return reportResponse.rows.map(row => {
            const costInDollars = (row.metrics.costMicros || 0) / 1000000;
            
            return {
                date: row.segments?.date,
                campaign_name: row.campaign?.name,
                ad_group_name: row.adGroup?.name,
                keyword_text: row.adGroupCriterion?.keyword?.text,
                match_type: row.adGroupCriterion?.keyword?.matchType,
                quality_score: row.adGroupCriterion?.qualityInfo?.qualityScore || null,
                impressions: row.metrics.impressions || 0,
                clicks: row.metrics.clicks || 0,
                cost: parseFloat(costInDollars.toFixed(2)),
                conversions: row.metrics.conversions || 0,
                ctr: row.metrics.ctr || 0,
                average_cpc: row.metrics.averageCpc || 0,
                customer_id: customerId,
            };
        });
    }
    
    /**
     * Transform geographic data to PostgreSQL format
     */
    private transformGeographicData(reportResponse: IGoogleAdsReportResponse, customerId: string): any[] {
        return reportResponse.rows.map(row => {
            const costInDollars = (row.metrics.costMicros || 0) / 1000000;
            
            return {
                date: row.segments?.date,
                country: row.segments?.geoTargetCountry || null,
                region: row.segments?.geoTargetRegion || null,
                city: row.segments?.geoTargetCity || null,
                impressions: row.metrics.impressions || 0,
                clicks: row.metrics.clicks || 0,
                cost: parseFloat(costInDollars.toFixed(2)),
                conversions: row.metrics.conversions || 0,
                conversion_value: row.metrics.conversionsValue || 0,
                customer_id: customerId,
            };
        });
    }
    
    /**
     * Transform device data to PostgreSQL format
     */
    private transformDeviceData(reportResponse: IGoogleAdsReportResponse, customerId: string): any[] {
        return reportResponse.rows.map(row => {
            const costInDollars = (row.metrics.costMicros || 0) / 1000000;
            
            return {
                date: row.segments?.date,
                device: row.segments?.device,
                impressions: row.metrics.impressions || 0,
                clicks: row.metrics.clicks || 0,
                cost: parseFloat(costInDollars.toFixed(2)),
                conversions: row.metrics.conversions || 0,
                conversion_value: row.metrics.conversionsValue || 0,
                ctr: row.metrics.ctr || 0,
                average_cpc: row.metrics.averageCpc || 0,
                customer_id: customerId,
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
            
            const columns = Object.keys(batch[0]);
            const placeholders = batch.map((_, rowIndex) => {
                const rowPlaceholders = columns.map((_, colIndex) => {
                    return `$${rowIndex * columns.length + colIndex + 1}`;
                });
                return `(${rowPlaceholders.join(', ')})`;
            }).join(', ');
            
            const values = batch.flatMap(row => columns.map(col => row[col]));
            
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
     * Get schema metadata for Google Ads data source
     */
    public async getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any> {
        const reportTypes = connectionDetails.api_config?.report_types || ['campaign'];
        const schemaName = 'dra_google_ads';
        
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
            case 'campaign':
                return [
                    ...baseColumns,
                    { name: 'campaign_id', type: 'varchar', nullable: false },
                    { name: 'campaign_name', type: 'text', nullable: true },
                    { name: 'campaign_status', type: 'varchar', nullable: true },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'clicks', type: 'bigint', nullable: false },
                    { name: 'cost', type: 'decimal', nullable: false },
                    { name: 'conversions', type: 'decimal', nullable: false },
                    { name: 'conversion_value', type: 'decimal', nullable: false },
                    { name: 'ctr', type: 'decimal', nullable: false },
                    { name: 'average_cpc', type: 'decimal', nullable: false },
                    { name: 'average_cpm', type: 'decimal', nullable: false },
                    { name: 'customer_id', type: 'varchar', nullable: false },
                    { name: 'synced_at', type: 'timestamp', nullable: false },
                ];
            case 'keyword':
                return [
                    ...baseColumns,
                    { name: 'campaign_name', type: 'text', nullable: true },
                    { name: 'ad_group_name', type: 'text', nullable: true },
                    { name: 'keyword_text', type: 'text', nullable: false },
                    { name: 'match_type', type: 'varchar', nullable: true },
                    { name: 'quality_score', type: 'integer', nullable: true },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'clicks', type: 'bigint', nullable: false },
                    { name: 'cost', type: 'decimal', nullable: false },
                    { name: 'conversions', type: 'decimal', nullable: false },
                    { name: 'ctr', type: 'decimal', nullable: false },
                    { name: 'average_cpc', type: 'decimal', nullable: false },
                    { name: 'customer_id', type: 'varchar', nullable: false },
                    { name: 'synced_at', type: 'timestamp', nullable: false },
                ];
            case 'geographic':
                return [
                    ...baseColumns,
                    { name: 'country', type: 'varchar', nullable: true },
                    { name: 'region', type: 'varchar', nullable: true },
                    { name: 'city', type: 'varchar', nullable: true },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'clicks', type: 'bigint', nullable: false },
                    { name: 'cost', type: 'decimal', nullable: false },
                    { name: 'conversions', type: 'decimal', nullable: false },
                    { name: 'conversion_value', type: 'decimal', nullable: false },
                    { name: 'customer_id', type: 'varchar', nullable: false },
                    { name: 'synced_at', type: 'timestamp', nullable: false },
                ];
            case 'device':
                return [
                    ...baseColumns,
                    { name: 'device', type: 'varchar', nullable: true },
                    { name: 'impressions', type: 'bigint', nullable: false },
                    { name: 'clicks', type: 'bigint', nullable: false },
                    { name: 'cost', type: 'decimal', nullable: false },
                    { name: 'conversions', type: 'decimal', nullable: false },
                    { name: 'conversion_value', type: 'decimal', nullable: false },
                    { name: 'ctr', type: 'decimal', nullable: false },
                    { name: 'average_cpc', type: 'decimal', nullable: false },
                    { name: 'customer_id', type: 'varchar', nullable: false },
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
            
            const result = await dbConnector.query(`
                SELECT MAX(synced_at) as last_sync
                FROM information_schema.tables
                WHERE table_schema = 'dra_google_ads'
                    AND table_name LIKE '%_${dataSourceId}'
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
