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
            if (connectionDetails.token_expiry) {
                const expiryDate = new Date(connectionDetails.token_expiry).getTime();
                if (this.oauthService.isTokenExpired(expiryDate)) {
                    console.log('🔄 Access token expired, refreshing...');
                    const newTokens = await this.oauthService.refreshAccessToken(
                        connectionDetails.oauth_refresh_token
                    );
                    
                    connectionDetails.oauth_access_token = newTokens.access_token;
                    if (newTokens.expiry_date) {
                        connectionDetails.token_expiry = new Date(newTokens.expiry_date);
                    }
                }
            }
            
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
            
            await this.syncHistoryService.markAsRunning(syncRecord.id);
            
            const isAuthenticated = await this.authenticate(connectionDetails);
            if (!isAuthenticated) {
                throw new Error('Authentication failed');
            }
            
            const customerId = connectionDetails.api_config?.customer_id;
            if (!customerId) {
                throw new Error('Customer ID not configured');
            }
            
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                throw new Error('Database driver not available');
            }
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            
            const schemaName = 'dra_google_ads';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            
            const reportTypes = connectionDetails.api_config?.report_types || ['campaign'];
            const startDate = connectionDetails.api_config?.start_date || this.getDefaultStartDate();
            const endDate = connectionDetails.api_config?.end_date || this.getDefaultEndDate();
            
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            const errors: string[] = [];
            
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
                } catch (error: any) {
                    console.error(`❌ Failed to sync ${reportType} report:`, error);
                    errors.push(`${reportType}: ${error.message}`);
                    totalRecordsFailed++;
                }
            }
            
            const errorMessage = errors.length > 0 ? errors.join('; ') : undefined;
            
            await this.syncHistoryService.completeSyncRecord(
                syncRecord.id,
                totalRecordsSynced,
                totalRecordsFailed,
                errorMessage
            );
            
            return true;
        } catch (error: any) {
            console.error('❌ Google Ads sync failed:', error);
            await this.syncHistoryService.markAsFailed(syncRecord.id, error.message || 'Unknown error');
            return false;
        }
    }
    
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
    
    private async syncCampaignData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) throw new Error('Customer ID not configured');

        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        
        if (isManager) {
            const clientAccounts = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            for (const clientId of clientAccounts) {
                try {
                    const result = await this.syncCampaignDataForAccount(manager, schemaName, dataSourceId, usersPlatformId, clientId, startDate, endDate, connectionDetails);
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                } catch (error: any) { totalRecordsFailed++; }
            }
            return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
        }
        
        return await this.syncCampaignDataForAccount(manager, schemaName, dataSourceId, usersPlatformId, customerId, startDate, endDate, connectionDetails);
    }
    
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
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'campaigns';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalTableName, customerId);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await this.ensureTableExists(manager, fullTableName, logicalTableName);
        
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId, usersPlatformId, schemaName, physicalTableName, logicalTableName,
            originalSheetName: logicalTableName, fileId: customerId, tableType: 'google_ads'
        });
        
        const reportQuery: IGoogleAdsReportQuery = {
            customerId, startDate, endDate, reportType: GoogleAdsReportType.CAMPAIGN,
            metrics: [], dimensions: []
        };
        
        const reportResult = await RetryHandler.execute(
            () => this.adsService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            throw reportResult.error || new Error('Failed to fetch campaign report');
        }
        
        const reportResponse = reportResult.data;
        if (!reportResponse.rows || reportResponse.rows.length === 0) return { recordsSynced: 0, recordsFailed: 0 };
        
        const transformedData = this.transformCampaignData(reportResponse, customerId);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'campaign_id']);
        
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private async syncKeywordData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) throw new Error('Customer ID not configured');

        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        
        if (isManager) {
            const clientAccounts = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            for (const clientId of clientAccounts) {
                try {
                    const result = await this.syncKeywordDataForAccount(manager, schemaName, dataSourceId, usersPlatformId, clientId, startDate, endDate, connectionDetails);
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                } catch (error: any) { totalRecordsFailed++; }
            }
            return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
        }
        
        return await this.syncKeywordDataForAccount(manager, schemaName, dataSourceId, usersPlatformId, customerId, startDate, endDate, connectionDetails);
    }

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
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'keywords';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalTableName, customerId);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await this.ensureTableExists(manager, fullTableName, logicalTableName);
        
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId, usersPlatformId, schemaName, physicalTableName, logicalTableName,
            originalSheetName: logicalTableName, fileId: customerId, tableType: 'google_ads'
        });
        
        const reportQuery: IGoogleAdsReportQuery = {
            customerId, startDate, endDate, reportType: GoogleAdsReportType.KEYWORD,
            metrics: [], dimensions: []
        };
        
        const reportResult = await RetryHandler.execute(
            () => this.adsService.runReport(reportQuery, connectionDetails),
            RetryHandler.getRecommendedConfig('rate_limit')
        );
        
        if (!reportResult.success || !reportResult.data) {
            throw reportResult.error || new Error('Failed to fetch keyword report');
        }
        
        const reportResponse = reportResult.data;
        if (!reportResponse.rows || reportResponse.rows.length === 0) return { recordsSynced: 0, recordsFailed: 0 };
        
        const transformedData = this.transformKeywordData(reportResponse, customerId);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'keyword_text', 'match_type', 'campaign_name', 'ad_group_name']);
        
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private async syncGeographicData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) throw new Error('Customer ID not configured');

        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        
        if (isManager) {
            const clientAccounts = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            for (const clientId of clientAccounts) {
                try {
                    const result = await this.syncGeographicDataForAccount(manager, schemaName, dataSourceId, usersPlatformId, clientId, startDate, endDate, connectionDetails);
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                } catch (error: any) { totalRecordsFailed++; }
            }
            return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
        }
        
        return await this.syncGeographicDataForAccount(manager, schemaName, dataSourceId, usersPlatformId, customerId, startDate, endDate, connectionDetails);
    }
    
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
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'geographic';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalTableName, customerId);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await this.ensureTableExists(manager, fullTableName, logicalTableName);
        
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId, usersPlatformId, schemaName, physicalTableName, logicalTableName,
            originalSheetName: logicalTableName, fileId: customerId, tableType: 'google_ads'
        });
        
        const reportQuery: IGoogleAdsReportQuery = {
            customerId, startDate, endDate, reportType: GoogleAdsReportType.GEOGRAPHIC,
            metrics: [], dimensions: []
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
        
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }
    
    private async syncDeviceData(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        startDate: string,
        endDate: string,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) throw new Error('Customer ID not configured');

        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        
        if (isManager) {
            const clientAccounts = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            for (const clientId of clientAccounts) {
                try {
                    const result = await this.syncDeviceDataForAccount(manager, schemaName, dataSourceId, usersPlatformId, clientId, startDate, endDate, connectionDetails);
                    totalRecordsSynced += result.recordsSynced;
                    totalRecordsFailed += result.recordsFailed;
                } catch (error: any) { totalRecordsFailed++; }
            }
            return { recordsSynced: totalRecordsSynced, recordsFailed: totalRecordsFailed };
        }
        
        return await this.syncDeviceDataForAccount(manager, schemaName, dataSourceId, usersPlatformId, customerId, startDate, endDate, connectionDetails);
    }
    
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
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'device';
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalTableName, customerId);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        await this.ensureTableExists(manager, fullTableName, logicalTableName);
        
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId, usersPlatformId, schemaName, physicalTableName, logicalTableName,
            originalSheetName: logicalTableName, fileId: customerId, tableType: 'google_ads'
        });
        
        const reportQuery: IGoogleAdsReportQuery = {
            customerId, startDate, endDate, reportType: GoogleAdsReportType.DEVICE,
            metrics: [], dimensions: []
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
        
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private async ensureTableExists(manager: any, fullTableName: string, logicalTableName: string): Promise<void> {
        let createQuery = '';
        if (logicalTableName === 'campaigns') {
            createQuery = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, campaign_id VARCHAR(255) NOT NULL, campaign_name TEXT, campaign_status VARCHAR(50), impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, cost DECIMAL(15,2) DEFAULT 0, conversions DECIMAL(10,2) DEFAULT 0, conversion_value DECIMAL(15,2) DEFAULT 0, ctr DECIMAL(10,4) DEFAULT 0, average_cpc DECIMAL(10,2) DEFAULT 0, average_cpm DECIMAL(10,2) DEFAULT 0, customer_id VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(date, campaign_id))`;
        } else if (logicalTableName === 'keywords') {
            createQuery = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, campaign_name TEXT, ad_group_name TEXT, keyword_text TEXT NOT NULL, match_type VARCHAR(50), quality_score INTEGER, impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, cost DECIMAL(15,2) DEFAULT 0, conversions DECIMAL(10,2) DEFAULT 0, ctr DECIMAL(10,4) DEFAULT 0, average_cpc DECIMAL(10,2) DEFAULT 0, customer_id VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(date, keyword_text, match_type, campaign_name, ad_group_name))`;
        } else if (logicalTableName === 'geographic') {
            createQuery = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, country VARCHAR(100), region VARCHAR(255), city VARCHAR(255), impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, cost DECIMAL(15,2) DEFAULT 0, conversions DECIMAL(10,2) DEFAULT 0, conversion_value DECIMAL(15,2) DEFAULT 0, customer_id VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(date, country, region, city))`;
        } else if (logicalTableName === 'device') {
            createQuery = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, device VARCHAR(50), impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, cost DECIMAL(15,2) DEFAULT 0, conversions DECIMAL(10,2) DEFAULT 0, conversion_value DECIMAL(15,2) DEFAULT 0, ctr DECIMAL(10,4) DEFAULT 0, average_cpc DECIMAL(10,2) DEFAULT 0, customer_id VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(date, device))`;
        }
        if (createQuery) await manager.query(createQuery);
    }
    
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
    
    private async bulkUpsert(
        manager: any,
        tableName: string,
        data: any[],
        conflictColumns: string[]
    ): Promise<void> {
        if (data.length === 0) return;
        const batchSize = 1000;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const columns = Object.keys(batch[0]);
            const placeholders = batch.map((_, rowIndex) => {
                const rowPlaceholders = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
                return `(${rowPlaceholders.join(', ')})`;
            }).join(', ');
            const values = batch.flatMap(row => columns.map(col => row[col]));
            const updateClause = columns.filter(col => !conflictColumns.includes(col) && col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ');
            const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateClause}, synced_at = CURRENT_TIMESTAMP`;
            await manager.query(query, values);
        }
    }
    
    private getDefaultStartDate(): string {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    }
    
    private getDefaultEndDate(): string {
        return new Date().toISOString().split('T')[0];
    }
    
    public async getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any> {
        const reportTypes = connectionDetails.api_config?.report_types || ['campaign'];
        const schemaName = 'dra_google_ads';
        const tables = reportTypes.map((reportType: string) => ({
            schema: schemaName,
            table: `${reportType}_${dataSourceId}`,
            columns: this.getTableColumns(reportType),
        }));
        return { schemaName, tables };
    }
    
    private getTableColumns(reportType: string): any[] {
        const baseColumns = [{ name: 'id', type: 'integer', nullable: false }, { name: 'date', type: 'date', nullable: false }];
        switch (reportType) {
            case 'campaign':
                return [...baseColumns, { name: 'campaign_id', type: 'varchar', nullable: false }, { name: 'campaign_name', type: 'text', nullable: true }, { name: 'campaign_status', type: 'varchar', nullable: true }, { name: 'impressions', type: 'bigint', nullable: false }, { name: 'clicks', type: 'bigint', nullable: false }, { name: 'cost', type: 'decimal', nullable: false }, { name: 'conversions', type: 'decimal', nullable: false }, { name: 'conversion_value', type: 'decimal', nullable: false }, { name: 'ctr', type: 'decimal', nullable: false }, { name: 'average_cpc', type: 'decimal', nullable: false }, { name: 'average_cpm', type: 'decimal', nullable: false }, { name: 'customer_id', type: 'varchar', nullable: false }, { name: 'synced_at', type: 'timestamp', nullable: false }];
            case 'keyword':
                return [...baseColumns, { name: 'campaign_name', type: 'text', nullable: true }, { name: 'ad_group_name', type: 'text', nullable: true }, { name: 'keyword_text', type: 'text', nullable: false }, { name: 'match_type', type: 'varchar', nullable: true }, { name: 'quality_score', type: 'integer', nullable: true }, { name: 'impressions', type: 'bigint', nullable: false }, { name: 'clicks', type: 'bigint', nullable: false }, { name: 'cost', type: 'decimal', nullable: false }, { name: 'conversions', type: 'decimal', nullable: false }, { name: 'ctr', type: 'decimal', nullable: false }, { name: 'average_cpc', type: 'decimal', nullable: false }, { name: 'customer_id', type: 'varchar', nullable: false }, { name: 'synced_at', type: 'timestamp', nullable: false }];
            case 'geographic':
                return [...baseColumns, { name: 'country', type: 'varchar', nullable: true }, { name: 'region', type: 'varchar', nullable: true }, { name: 'city', type: 'varchar', nullable: true }, { name: 'impressions', type: 'bigint', nullable: false }, { name: 'clicks', type: 'bigint', nullable: false }, { name: 'cost', type: 'decimal', nullable: false }, { name: 'conversions', type: 'decimal', nullable: false }, { name: 'conversion_value', type: 'decimal', nullable: false }, { name: 'customer_id', type: 'varchar', nullable: false }, { name: 'synced_at', type: 'timestamp', nullable: false }];
            case 'device':
                return [...baseColumns, { name: 'device', type: 'varchar', nullable: true }, { name: 'impressions', type: 'bigint', nullable: false }, { name: 'clicks', type: 'bigint', nullable: false }, { name: 'cost', type: 'decimal', nullable: false }, { name: 'conversions', type: 'decimal', nullable: false }, { name: 'conversion_value', type: 'decimal', nullable: false }, { name: 'ctr', type: 'decimal', nullable: false }, { name: 'average_cpc', type: 'decimal', nullable: false }, { name: 'customer_id', type: 'varchar', nullable: false }, { name: 'synced_at', type: 'timestamp', nullable: false }];
            default:
                return baseColumns;
        }
    }
    
    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return null;
            const dbConnector = await driver.getConcreteDriver();
            const result = await dbConnector.query(`SELECT MAX(synced_at) as last_sync FROM information_schema.tables WHERE table_schema = 'dra_google_ads' AND table_name LIKE '%_${dataSourceId}'`);
            if (result && result[0] && result[0].last_sync) return new Date(result[0].last_sync);
            return null;
        } catch (error) {
            console.error('❌ Failed to get last sync time:', error);
            return null;
        }
    }
    
    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        return await this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }
}