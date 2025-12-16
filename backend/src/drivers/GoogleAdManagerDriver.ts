import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleAdManagerService } from '../services/GoogleAdManagerService.js';
import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';
import { SyncType } from '../entities/SyncHistory.js';
import { DBDriver } from './DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { RetryHandler } from '../utils/RetryHandler.js';
import { SyncEventEmitter } from '../events/SyncEventEmitter.js';
import { PerformanceMetrics, globalPerformanceAggregator } from '../utils/PerformanceMetrics.js';
import { AdvancedSyncConfig, SyncConfigValidator } from '../types/IAdvancedSyncConfig.js';
import { emailService } from '../services/EmailService.js';
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
    private syncHistoryService: SyncHistoryService;
    private syncEventEmitter: SyncEventEmitter;
    private emailService = emailService;
    
    private constructor() {
        this.gamService = GoogleAdManagerService.getInstance();
        this.oauthService = GoogleOAuthService.getInstance();
        this.syncHistoryService = SyncHistoryService.getInstance();
        this.syncEventEmitter = SyncEventEmitter.getInstance();
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
        
        // Initialize performance tracking
        const perfMetrics = new PerformanceMetrics(`GAM Sync - DS ${dataSourceId}`);
        perfMetrics.addMetadata('dataSourceId', dataSourceId);
        perfMetrics.addMetadata('syncId', syncRecord.id);
        
        try {
            console.log(`🔄 Starting Google Ad Manager sync for data source ${dataSourceId}`);
            
            // Mark as running
            perfMetrics.startTimer('mark-running');
            await this.syncHistoryService.markAsRunning(syncRecord.id);
            perfMetrics.stopTimer('mark-running');
            
            // Emit sync started event
            const reportTypes = connectionDetails.api_config?.report_types || ['revenue'];
            perfMetrics.addMetadata('reportTypes', reportTypes);
            this.syncEventEmitter.emitSyncStarted({
                dataSourceId,
                syncId: syncRecord.id,
                reportTypes,
                startedAt: new Date(),
            });
            
            // Ensure authentication is valid
            perfMetrics.startTimer('authentication');
            const isAuthenticated = await this.authenticate(connectionDetails);
            perfMetrics.stopTimer('authentication');
            if (!isAuthenticated) {
                throw new Error('Authentication failed');
            }
            
            const networkCode = connectionDetails.api_config?.network_code;
            if (!networkCode) {
                throw new Error('Network code not configured');
            }
            perfMetrics.addMetadata('networkCode', networkCode);
            
            // Get database connection
            perfMetrics.startTimer('database-setup');
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                throw new Error('Database driver not available');
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            
            // Create schema if it doesn't exist
            const schemaName = 'dra_google_ad_manager';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            perfMetrics.stopTimer('database-setup');
            console.log(`✅ Schema ${schemaName} ready`);
            
            // Get advanced sync configuration
            const advancedConfig = connectionDetails.api_config?.advanced_sync_config;
            
            // Get sync configuration (reportTypes already declared above)
            const { startDate, endDate } = this.getDateRangeFromConfig(advancedConfig, connectionDetails);
            
            console.log(`📅 Sync period: ${startDate} to ${endDate}`);
            console.log(`📊 Report types: ${reportTypes.join(', ')}`);
            if (advancedConfig) {
                console.log(`⚙️  Advanced config enabled: incremental=${advancedConfig.incrementalSync}, dedup=${advancedConfig.deduplication}, validation=${advancedConfig.dataValidation}`);
            }
            
            // Track sync results
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            const errors: string[] = [];
            
            // Sync selected report types
            for (let i = 0; i < reportTypes.length; i++) {
                const reportType = reportTypes[i];
                const reportStartTime = Date.now();
                perfMetrics.startTimer(`report-${reportType}`);
                
                try {
                    const result = await this.syncReportType(
                        manager,
                        schemaName,
                        networkCode,
                        reportType,
                        startDate,
                        endDate,
                        connectionDetails,
                        advancedConfig
                    );
                    
                    perfMetrics.stopTimer(`report-${reportType}`);
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                    
                    // Emit report completed event
                    this.syncEventEmitter.emitReportCompleted({
                        dataSourceId,
                        syncId: syncRecord.id,
                        reportType,
                        recordsSynced: result.recordsSynced,
                        recordsFailed: result.recordsFailed,
                        durationMs: Date.now() - reportStartTime,
                    });
                } catch (error: any) {
                    console.error(`❌ Failed to sync ${reportType} report:`, error);
                    perfMetrics.stopTimer(`report-${reportType}`);
                    errors.push(`${reportType}: ${error.message}`);
                    totalRecordsFailed++;
                    
                    // Emit report failed event
                    this.syncEventEmitter.emitReportFailed({
                        dataSourceId,
                        syncId: syncRecord.id,
                        reportType,
                        error: error.message,
                        attempt: 1,
                    });
                    // Continue with other reports even if one fails
                }
            }
            
            // Complete sync record
            const errorMessage = errors.length > 0 ? errors.join('; ') : undefined;
            const syncEndTime = Date.now();
            
            perfMetrics.startTimer('complete-sync-record');
            await this.syncHistoryService.completeSyncRecord(
                syncRecord.id,
                totalRecordsSynced,
                totalRecordsFailed,
                errorMessage
            );
            perfMetrics.stopTimer('complete-sync-record');
            
            // Determine final status
            let finalStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED';
            if (totalRecordsFailed === 0) {
                finalStatus = 'COMPLETED';
            } else if (totalRecordsSynced > 0) {
                finalStatus = 'PARTIAL';
            } else {
                finalStatus = 'FAILED';
            }
            
            // Add final metrics
            perfMetrics.addMetadata('finalStatus', finalStatus);
            perfMetrics.addMetadata('totalRecordsSynced', totalRecordsSynced);
            perfMetrics.addMetadata('totalRecordsFailed', totalRecordsFailed);
            perfMetrics.addMetadata('errorCount', errors.length);
            
            // Complete performance tracking and store
            const perfSnapshot = perfMetrics.complete();
            globalPerformanceAggregator.addSnapshot(perfSnapshot);
            
            // Log performance summary
            console.log(PerformanceMetrics.formatSnapshot(perfSnapshot));
            
            // Emit sync completed event
            this.syncEventEmitter.emitSyncCompleted({
                dataSourceId,
                syncId: syncRecord.id,
                status: finalStatus,
                totalRecordsSynced,
                totalRecordsFailed,
                durationMs: syncEndTime - syncStartTime,
                completedAt: new Date(),
            });
            
            // Send email notifications if configured
            if (advancedConfig?.notificationEmails && advancedConfig.notificationEmails.length > 0) {
                const duration = Math.floor((syncEndTime - syncStartTime) / 1000); // Convert to seconds
                
                if (finalStatus === 'COMPLETED' && advancedConfig.notifyOnComplete) {
                    // Send success notification
                    await this.emailService.sendSyncCompleteEmail(
                        advancedConfig.notificationEmails,
                        {
                            dataSourceName: connectionDetails.connection_name || `Data Source ${dataSourceId}`,
                            reportType: reportTypes.join(', '),
                            networkCode,
                            recordCount: totalRecordsSynced,
                            duration,
                            startDate,
                            endDate,
                        }
                    );
                } else if ((finalStatus === 'FAILED' || finalStatus === 'PARTIAL') && advancedConfig.notifyOnFailure) {
                    // Send failure notification
                    await this.emailService.sendSyncFailureEmail(
                        advancedConfig.notificationEmails,
                        {
                            dataSourceName: connectionDetails.connection_name || `Data Source ${dataSourceId}`,
                            reportType: reportTypes.join(', '),
                            networkCode,
                            error: errorMessage || 'Partial sync completed with some failures',
                            timestamp: new Date().toISOString(),
                        }
                    );
                }
            }
            
            console.log(`✅ Google Ad Manager sync completed for data source ${dataSourceId}`);
            return true;
        } catch (error: any) {
            console.error('❌ Google Ad Manager sync failed:', error);
            
            // Add error to metrics
            perfMetrics.addMetadata('error', error.message || 'Unknown error');
            perfMetrics.addMetadata('errorStack', error.stack);
            
            // Complete performance tracking even on failure
            const perfSnapshot = perfMetrics.complete();
            globalPerformanceAggregator.addSnapshot(perfSnapshot);
            console.log(PerformanceMetrics.formatSnapshot(perfSnapshot));
            
            await this.syncHistoryService.markAsFailed(syncRecord.id, error.message || 'Unknown error');
            
            // Emit sync failed event
            this.syncEventEmitter.emitSyncFailed({
                dataSourceId,
                syncId: syncRecord.id,
                error: error.message || 'Unknown error',
                failedAt: new Date(),
            });
            
            // Send failure email notification if configured
            if (advancedConfig?.notificationEmails && advancedConfig.notificationEmails.length > 0 && advancedConfig.notifyOnFailure) {
                await this.emailService.sendSyncFailureEmail(
                    advancedConfig.notificationEmails,
                    {
                        dataSourceName: connectionDetails.connection_name || `Data Source ${dataSourceId}`,
                        reportType: reportTypes.join(', '),
                        networkCode,
                        error: error.message || 'Unknown error',
                        timestamp: new Date().toISOString(),
                    }
                );
            }
            
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
        endDate: string,,
        advancedConfig?: AdvancedSyncConfig
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const reportType = this.gamService.getReportType(reportTypeString);
        
        console.log(`📊 Syncing ${reportType} report...`);
        
        switch (reportType) {
            case GAMReportType.REVENUE:
                return await this.syncRevenueData(manager, schemaName, networkCode, startDate, endDate, connectionDetails, advancedConfig);
            case GAMReportType.INVENTORY:
                return await this.syncInventoryData(manager, schemaName, networkCode, startDate, endDate, connectionDetails, advancedConfig);
            case GAMReportType.ORDERS:
                return await this.syncOrdersData(manager, schemaName, networkCode, startDate, endDate, connectionDetails, advancedConfig);
            case GAMReportType.GEOGRAPHY:
                return await this.syncGeographyData(manager, schemaName, networkCode, startDate, endDate, connectionDetails, advancedConfig);
            case GAMReportType.DEVICE:
                return await this.syncDeviceData(manager, schemaName, networkCode, startDate, endDate, connectionDetails, advancedConfig
                return await this.syncDeviceData(manager, schemaName, networkCode, startDate, endDate, connectionDetails);
            default:
                console.warn(`⚠️  Unknown report type: ${reportType}`);
                return { recordsSynced: 0, recordsFailed: 0 };
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
        endDate: string,,
        advancedConfig?: AdvancedSyncConfig
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
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
        
        // Apply advanced filters if configured
        if (advancedConfig) {
            transformedData = this.applyAdvancedFilters(transformedData, advancedConfig, 'revenue');
            
            // Apply max records limit
            if (advancedConfig.maxRecordsPerReport && transformedData.length > advancedConfig.maxRecordsPerReport) {
                console.log(`⚠️  Limiting records from ${transformedData.length} to ${advancedConfig.maxRecordsPerReport}`);
                transformedData = transformedData.slice(0, advancedConfig.maxRecordsPerReport);
            }
        }
        
        // Validate data before inserting (if enabled)
        if (!advancedConfig || advancedConfig.dataValidation !== false) {
            const validation = this.validateRevenueData(transformedData);
            if (!validation.isValid) {
                console.error('❌ Revenue data validation failed:', validation.errors);
                throw new Error(`Data validation failed: ${validation.errors.slice(0, 3).join(', ')}`);
            }
        }
        
        // Apply deduplication if enabled
        if (advancedConfig?.deduplication !== false) {
            await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'ad_unit_id', 'country_code']);
        } else {
            // Insert without deduplication (may cause duplicates if not handled)
            for (const record of transformedData) {
                await manager.query(`INSERT INTO ${fullTableName} (${Object.keys(record).join(', ')}) VALUES (${Object.keys(record).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(record));
            }
        }
        
        console.log(`✅ Synced ${transformedData.length} revenue records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
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
        connectionDetails: IAPIConnectionDetails,
        advancedConfig?: AdvancedSyncConfig
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
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
        
        // Build and execute report query with retry logic
        const reportQuery = this.gamService.buildInventoryReportQuery(networkCode, startDate, endDate);
        
        const reportResult = await RetryHandler.execute(
            () => this.gamService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch inventory report after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch inventory report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for inventory report');
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        // Transform and insert data
        let transformedData = this.transformInventoryData(reportResponse, networkCode);
        
        // Apply advanced filters if configured
        if (advancedConfig) {
            transformedData = this.applyAdvancedFilters(transformedData, advancedConfig, 'inventory');
            if (advancedConfig.maxRecordsPerReport && transformedData.length > advancedConfig.maxRecordsPerReport) {
                transformedData = transformedData.slice(0, advancedConfig.maxRecordsPerReport);
            }
        }
        
        // Validate data before inserting (if enabled)
        if (!advancedConfig || advancedConfig.dataValidation !== false) {
            const validation = this.validateInventoryData(transformedData);
            if (!validation.isValid) {
                console.error('❌ Inventory data validation failed:', validation.errors);
                throw new Error(`Data validation failed: ${validation.errors.slice(0, 3).join(', ')}`);
            }
        }
        
        // Apply deduplication if enabled
        if (advancedConfig?.deduplication !== false) {
            await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'ad_unit_id', 'device_category']);
        } else {
            for (const record of transformedData) {
                await manager.query(`INSERT INTO ${fullTableName} (${Object.keys(record).join(', ')}) VALUES (${Object.keys(record).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(record));
            }
        }
        
        console.log(`✅ Synced ${transformedData.length} inventory records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
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
        connectionDetails: IAPIConnectionDetails,
        advancedConfig?: AdvancedSyncConfig
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
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
        
        // Build and execute report query with retry logic
        const reportQuery = this.gamService.buildOrdersReportQuery(networkCode, startDate, endDate);
        
        const reportResult = await RetryHandler.execute(
            () => this.gamService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            console.error(`❌ Failed to fetch orders report after ${reportResult.attempts} attempts:`, reportResult.error?.message);
            throw reportResult.error || new Error('Failed to fetch orders report');
        }
        
        const reportResponse = reportResult.data;
        
        if (!reportResponse.rows || reportResponse.rows.length === 0) {
            console.log('ℹ️  No data returned from GAM for orders report');
            return { recordsSynced: 0, recordsFailed: 0 };
        }
        
        // Transform and insert data
        let transformedData = this.transformOrdersData(reportResponse, networkCode);
        
        // Apply advanced filters if configured
        if (advancedConfig) {
            transformedData = this.applyAdvancedFilters(transformedData, advancedConfig, 'orders');
            if (advancedConfig.maxRecordsPerReport && transformedData.length > advancedConfig.maxRecordsPerReport) {
                transformedData = transformedData.slice(0, advancedConfig.maxRecordsPerReport);
            }
        }
        
        // Apply deduplication if enabled
        if (advancedConfig?.deduplication !== false) {
            await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'line_item_id']);
        } else {
            for (const record of transformedData) {
                await manager.query(`INSERT INTO ${fullTableName} (${Object.keys(record).join(', ')}) VALUES (${Object.keys(record).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(record));
            }
        }
        
        console.log(`✅ Synced ${transformedData.length} orders records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
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
        connectionDetails: IAPIConnectionDetails,
        advancedConfig?: AdvancedSyncConfig
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
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
        
        // Transform and insert data
        let transformedData = this.transformGeographyData(reportResponse, networkCode);
        
        // Apply advanced filters if configured
        if (advancedConfig) {
            transformedData = this.applyAdvancedFilters(transformedData, advancedConfig, 'geography');
            if (advancedConfig.maxRecordsPerReport && transformedData.length > advancedConfig.maxRecordsPerReport) {
                transformedData = transformedData.slice(0, advancedConfig.maxRecordsPerReport);
            }
        }
        
        // Apply deduplication if enabled
        if (advancedConfig?.deduplication !== false) {
            await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'country_code', 'region', 'city']);
        } else {
            for (const record of transformedData) {
                await manager.query(`INSERT INTO ${fullTableName} (${Object.keys(record).join(', ')}) VALUES (${Object.keys(record).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(record));
            }
        }
        
        console.log(`✅ Synced ${transformedData.length} geography records`);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
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
        connectionDetails: IAPIConnectionDetails,
        advancedConfig?: AdvancedSyncConfig
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
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
        
        // Transform and insert data
        let transformedData = this.transformDeviceData(reportResponse, networkCode);
        
        // Apply advanced filters if configured
        if (advancedConfig) {
            transformedData = this.applyAdvancedFilters(transformedData, advancedConfig, 'device');
            if (advancedConfig.maxRecordsPerReport && transformedData.length > advancedConfig.maxRecordsPerReport) {
                transformedData = transformedData.slice(0, advancedConfig.maxRecordsPerReport);
            }
        }
        
        // Apply deduplication if enabled
        if (advancedConfig?.deduplication !== false) {
            await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'device_category', 'browser_name']);
        } else {
            for (const record of transformedData) {
                await manager.query(`INSERT INTO ${fullTableName} (${Object.keys(record).join(', ')}) VALUES (${Object.keys(record).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(record));
            }
        }
        
        console.log(`✅ Synced ${transformedData.length} device records`);
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
     * Transform GAM inventory report data to PostgreSQL format
     */
    private transformInventoryData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const adRequests = row.metrics['TOTAL_AD_REQUESTS'] || 0;
            const matchedRequests = row.metrics['TOTAL_MATCHED_REQUESTS'] || 0;
            const impressions = row.metrics['TOTAL_IMPRESSIONS'] || 0;
            
            // Calculate fill rate
            const fillRate = adRequests > 0 ? (impressions / adRequests) * 100 : 0;
            
            return {
                date: row.dimensions['DATE'],
                ad_unit_id: row.dimensions['AD_UNIT_ID'] || null,
                ad_unit_name: row.dimensions['AD_UNIT_NAME'] || null,
                device_category: row.dimensions['DEVICE_CATEGORY_NAME'] || null,
                ad_requests: adRequests,
                matched_requests: matchedRequests,
                impressions,
                fill_rate: parseFloat(fillRate.toFixed(4)),
                network_code: networkCode,
            };
        });
    }
    
    /**
     * Transform GAM orders report data to PostgreSQL format
     */
    private transformOrdersData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            
            return {
                date: row.dimensions['DATE'],
                order_id: row.dimensions['ORDER_ID'] || null,
                order_name: row.dimensions['ORDER_NAME'] || null,
                line_item_id: row.dimensions['LINE_ITEM_ID'] || null,
                line_item_name: row.dimensions['LINE_ITEM_NAME'] || null,
                advertiser_id: row.dimensions['ADVERTISER_ID'] || null,
                advertiser_name: row.dimensions['ADVERTISER_NAME'] || null,
                impressions,
                clicks,
                revenue: parseFloat(revenue.toString()),
                delivery_status: 'ACTIVE', // Placeholder - actual status from API
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
     * Transform GAM device report data to PostgreSQL format
     */
    private transformDeviceData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) {
            return [];
        }
        
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            
            return {
                date: row.dimensions['DATE'],
                device_category: row.dimensions['DEVICE_CATEGORY_NAME'] || null,
                browser_name: row.dimensions['BROWSER_NAME'] || null,
                operating_system: row.dimensions['OPERATING_SYSTEM_NAME'] || null,
                impressions,
                clicks,
                revenue: parseFloat(revenue.toString()),
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
     * Validate inventory data before sync
     * @param data - Inventory data to validate
     * @returns Validation result with errors
     */
    public validateInventoryData(data: any[]): { isValid: boolean; errors: string[] } {
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
            
            // Numeric validations
            if (row.ad_requests < 0) {
                errors.push(`Row ${index}: Ad requests cannot be negative`);
            }
            
            if (row.matched_requests < 0) {
                errors.push(`Row ${index}: Matched requests cannot be negative`);
            }
            
            if (row.impressions < 0) {
                errors.push(`Row ${index}: Impressions cannot be negative`);
            }
            
            // Logical validations
            if (row.matched_requests > row.ad_requests) {
                errors.push(`Row ${index}: Matched requests cannot exceed ad requests`);
            }
            
            if (row.impressions > row.matched_requests) {
                errors.push(`Row ${index}: Impressions cannot exceed matched requests`);
            }
            
            if (row.fill_rate < 0 || row.fill_rate > 100) {
                errors.push(`Row ${index}: Fill rate must be between 0 and 100`);
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
        return await this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }
    
    /**
     * Extract date range from advanced config or fallback to connection details
     */
    private getDateRangeFromConfig(
        advancedConfig: AdvancedSyncConfig | undefined,
        connectionDetails: IAPIConnectionDetails
    ): { startDate: string; endDate: string } {
        if (advancedConfig) {
            // Use advanced config dates if available
            if (advancedConfig.dateRangePreset && advancedConfig.dateRangePreset !== 'custom') {
                const dateRange = SyncConfigValidator.getDateRange(advancedConfig);
                if (dateRange) {
                    return dateRange;
                }
            } else if (advancedConfig.startDate && advancedConfig.endDate) {
                return {
                    startDate: advancedConfig.startDate,
                    endDate: advancedConfig.endDate
                };
            }
        }
        
        // Fallback to connection details or defaults
        return {
            startDate: connectionDetails.api_config?.start_date || this.getDefaultStartDate(),
            endDate: connectionDetails.api_config?.end_date || this.getDefaultEndDate()
        };
    }
    
    /**
     * Apply advanced filters to transformed data
     */
    private applyAdvancedFilters(
        data: any[],
        advancedConfig: AdvancedSyncConfig,
        reportType: string
    ): any[] {
        let filteredData = data;
        
        // Apply dimension filters
        if (advancedConfig.dimensionFilters && advancedConfig.dimensionFilters.length > 0) {
            for (const filter of advancedConfig.dimensionFilters) {
                filteredData = this.applyDimensionFilter(filteredData, filter);
            }
        }
        
        // Apply metric filters
        if (advancedConfig.metricFilters && advancedConfig.metricFilters.length > 0) {
            for (const filter of advancedConfig.metricFilters) {
                filteredData = this.applyMetricFilter(filteredData, filter);
            }
        }
        
        return filteredData;
    }
    
    /**
     * Apply a single dimension filter to data
     */
    private applyDimensionFilter(data: any[], filter: any): any[] {
        const fieldName = filter.dimension.toLowerCase().replace(/_/g, '_');
        
        return data.filter(record => {
            const value = record[fieldName];
            
            if (value === null || value === undefined) {
                return false;
            }
            
            const stringValue = String(value);
            
            switch (filter.operator) {
                case 'equals':
                    return filter.values.includes(stringValue);
                case 'notEquals':
                    return !filter.values.includes(stringValue);
                case 'contains':
                    return filter.values.some((filterValue: string) => stringValue.includes(filterValue));
                case 'notContains':
                    return !filter.values.some((filterValue: string) => stringValue.includes(filterValue));
                case 'in':
                    return filter.values.includes(stringValue);
                case 'notIn':
                    return !filter.values.includes(stringValue);
                default:
                    return true;
            }
        });
    }
    
    /**
     * Apply a single metric filter to data
     */
    private applyMetricFilter(data: any[], filter: any): any[] {
        const fieldName = filter.metric.toLowerCase().replace(/total_|_level/g, '').replace(/_/g, '_');
        
        return data.filter(record => {
            const value = record[fieldName];
            
            if (value === null || value === undefined) {
                return false;
            }
            
            const numValue = typeof value === 'number' ? value : parseFloat(value);
            
            if (isNaN(numValue)) {
                return false;
            }
            
            switch (filter.operator) {
                case 'greaterThan':
                    return numValue > filter.value;
                case 'lessThan':
                    return numValue < filter.value;
                case 'equals':
                    return numValue === filter.value;
                case 'between':
                    return numValue >= filter.value && numValue <= (filter.maxValue || Infinity);
                default:
                    return true;
            }
        });
    }
}
