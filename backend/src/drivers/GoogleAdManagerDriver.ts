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
     * Get the schema structure of the synced GAM data
     */
    public async getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any> {
        // Fallback: This service method was missing in GoogleAdManagerService, 
        // implementing directly here using table metadata service logic.
        const networkCode = connectionDetails.api_config?.network_code || 'default';
        const tableMetadataService = TableMetadataService.getInstance();
        const reportTypes = ['revenue', 'geography', 'device', 'ad_unit', 'advertiser', 'time_series'];
        const schemaName = 'dra_google_ad_manager';
        
        const tables = reportTypes.map((reportType: string) => {
            const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, reportType, networkCode);
            return {
                schema: schemaName,
                table: physicalTableName,
                columns: [], // Column introspection not fully supported via this driver currently
            };
        });
        
        return { schemaName, tables };
    }
    
    /**
     * Get last sync timestamp for a data source
     */
    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        return await this.syncHistoryService.getLastSync(dataSourceId).then(sync => sync?.completedAt || null);
    }
    
    /**
     * Get sync history for a data source
     */
    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        return await this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }
    
    /**
     * Authenticate with Google Ad Manager API
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
                networkCode: connectionDetails.api_config?.network_code,
            }
        );
        
        try {
            console.log(`🔄 Starting Google Ad Manager sync for data source ${dataSourceId}`);
            await this.syncHistoryService.markAsRunning(syncRecord.id);
            
            const isAuthenticated = await this.authenticate(connectionDetails);
            if (!isAuthenticated) throw new Error('Authentication failed');
            
            const networkCode = connectionDetails.api_config?.network_code;
            if (!networkCode) throw new Error('Network code not configured');
            
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) throw new Error('Database driver not available');
            const dbConnector = await driver.getConcreteDriver();
            const manager = dbConnector.manager;
            
            const schemaName = 'dra_google_ad_manager';
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            
            const reportTypes = connectionDetails.api_config?.report_types || ['revenue'];
            const startDate = connectionDetails.api_config?.start_date || this.getDefaultStartDate();
            const endDate = connectionDetails.api_config?.end_date || this.getDefaultEndDate();
            
            // --- NEW: Pre-create all required tables ---
            await this.ensureTablesExist(manager, schemaName, dataSourceId, networkCode);
            // ------------------------------------------
            
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            const errors: string[] = [];
            
            for (const reportType of reportTypes) {
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
            console.error('❌ Google Ad Manager sync failed:', error);
            await this.syncHistoryService.markAsFailed(syncRecord.id, error.message || 'Unknown error');
            return false;
        }
    }

    /**
     * Pre-create tables for all possible report types
     */
    private async ensureTablesExist(manager: any, schemaName: string, dataSourceId: number, networkCode: string): Promise<void> {
        const tableMetadataService = TableMetadataService.getInstance();
        const reportTypes = ['revenue', 'geography', 'device', 'ad_unit', 'advertiser', 'time_series'];
        
        for (const type of reportTypes) {
            const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, type, networkCode);
            const fullTableName = `${schemaName}.${physicalTableName}`;
            
            let query = '';
            switch (type) {
                case 'revenue':
                    query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, ad_unit_id VARCHAR(255), ad_unit_name TEXT, country_code VARCHAR(10), country_name VARCHAR(255), impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, revenue DECIMAL(15,2) DEFAULT 0, cpm DECIMAL(10,2) DEFAULT 0, ctr DECIMAL(10,4) DEFAULT 0, fill_rate DECIMAL(10,4) DEFAULT 0, network_code VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, extended_metrics JSONB DEFAULT '{}', UNIQUE(date, ad_unit_id, country_code))`;
                    break;
                case 'geography':
                    query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, country_code VARCHAR(10), country_name VARCHAR(255), region VARCHAR(255), city VARCHAR(255), impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, revenue DECIMAL(15,2) DEFAULT 0, network_code VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, extended_metrics JSONB DEFAULT '{}', UNIQUE(date, country_code, region, city))`;
                    break;
                case 'device':
                    query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, device_category VARCHAR(50), browser_name VARCHAR(100), operating_system VARCHAR(100), impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, revenue DECIMAL(15,2) DEFAULT 0, ctr DECIMAL(10,4) DEFAULT 0, cpm DECIMAL(10,2) DEFAULT 0, network_code VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, extended_metrics JSONB DEFAULT '{}', UNIQUE(date, device_category, browser_name, operating_system))`;
                    break;
                case 'ad_unit':
                    query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, ad_unit_id VARCHAR(255), ad_unit_name TEXT, impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, revenue DECIMAL(15,2) DEFAULT 0, ad_server_impressions BIGINT DEFAULT 0, ad_server_clicks BIGINT DEFAULT 0, ctr DECIMAL(10,4) DEFAULT 0, fill_rate DECIMAL(10,4) DEFAULT 0, ecpm DECIMAL(10,2) DEFAULT 0, network_code VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, extended_metrics JSONB DEFAULT '{}', UNIQUE(date, ad_unit_id))`;
                    break;
                case 'advertiser':
                    query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL, advertiser_id VARCHAR(255), advertiser_name TEXT, order_id VARCHAR(255), order_name TEXT, line_item_id VARCHAR(255), line_item_name TEXT, impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, revenue DECIMAL(15,2) DEFAULT 0, ctr DECIMAL(10,4) DEFAULT 0, cpm DECIMAL(10,2) DEFAULT 0, network_code VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, extended_metrics JSONB DEFAULT '{}', UNIQUE(date, advertiser_id, order_id, line_item_id))`;
                    break;
                case 'time_series':
                    query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (id SERIAL PRIMARY KEY, date DATE NOT NULL UNIQUE, impressions BIGINT DEFAULT 0, clicks BIGINT DEFAULT 0, revenue DECIMAL(15,2) DEFAULT 0, unfilled_impressions BIGINT DEFAULT 0, ad_requests BIGINT DEFAULT 0, ctr DECIMAL(10,4) DEFAULT 0, fill_rate DECIMAL(10,4) DEFAULT 0, ecpm DECIMAL(10,2) DEFAULT 0, network_code VARCHAR(255) NOT NULL, synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, extended_metrics JSONB DEFAULT '{}')`;
                    break;
            }
            if (query) await manager.query(query);
            console.log(`✅ Table ${fullTableName} ready`);
        }
    }
    
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

    // ... [Rest of the file with existing syncRevenueData, syncGeographyData, etc., kept unchanged] ...
    private async syncRevenueData(manager: any, schemaName: string, dataSourceId: number, startDate: string, endDate: string, connectionDetails: IAPIConnectionDetails): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const networkCode = connectionDetails.api_config?.network_code!;
        const tableMetadataService = TableMetadataService.getInstance();
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'revenue', networkCode);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        const reportQuery = this.gamService.buildRevenueReportQuery(networkCode, startDate, endDate);
        const reportResult = await RetryHandler.execute(() => this.gamService.runReport(reportQuery, connectionDetails), RetryHandler.getRecommendedConfig('rate_limit'));
        
        if (!reportResult.success || !reportResult.data) throw reportResult.error || new Error('Failed to fetch revenue report');
        const reportResponse = reportResult.data;
        if (!reportResponse.rows || reportResponse.rows.length === 0) return { recordsSynced: 0, recordsFailed: 0 };
        
        let transformedData = this.transformRevenueData(reportResponse, networkCode);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'ad_unit_id', 'country_code']);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private async syncGeographyData(manager: any, schemaName: string, dataSourceId: number, startDate: string, endDate: string, connectionDetails: IAPIConnectionDetails): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const networkCode = connectionDetails.api_config?.network_code!;
        const tableMetadataService = TableMetadataService.getInstance();
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'geography', networkCode);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        const reportQuery = this.gamService.buildGeographyReportQuery(networkCode, startDate, endDate);
        const reportResult = await RetryHandler.execute(() => this.gamService.runReport(reportQuery, connectionDetails), RetryHandler.getRecommendedConfig('rate_limit'));
        
        if (!reportResult.success || !reportResult.data) throw reportResult.error || new Error('Failed to fetch geography report');
        const reportResponse = reportResult.data;
        if (!reportResponse.rows || reportResponse.rows.length === 0) return { recordsSynced: 0, recordsFailed: 0 };
        
        const transformedData = this.transformGeographyData(reportResponse, networkCode);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'country_code', 'region', 'city']);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private async syncDeviceData(manager: any, schemaName: string, dataSourceId: number, startDate: string, endDate: string, connectionDetails: IAPIConnectionDetails): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const networkCode = connectionDetails.api_config?.network_code!;
        const tableMetadataService = TableMetadataService.getInstance();
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'device', networkCode);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        const reportQuery = this.gamService.buildDeviceReportQuery(networkCode, startDate, endDate);
        const reportResult = await RetryHandler.execute(() => this.gamService.runReport(reportQuery, connectionDetails), RetryHandler.getRecommendedConfig('rate_limit'));
        
        if (!reportResult.success || !reportResult.data) throw reportResult.error || new Error('Failed to fetch device report');
        const reportResponse = reportResult.data;
        if (!reportResponse.rows || reportResponse.rows.length === 0) return { recordsSynced: 0, recordsFailed: 0 };
        
        const transformedData = this.transformDeviceData(reportResponse, networkCode);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'device_category', 'browser_name', 'operating_system']);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private async syncAdUnitData(manager: any, schemaName: string, dataSourceId: number, startDate: string, endDate: string, connectionDetails: IAPIConnectionDetails): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const networkCode = connectionDetails.api_config?.network_code!;
        const tableMetadataService = TableMetadataService.getInstance();
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'ad_unit', networkCode);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        const reportQuery = this.gamService.buildAdUnitReportQuery(networkCode, startDate, endDate);
        const reportResult = await RetryHandler.execute(() => this.gamService.runReport(reportQuery, connectionDetails), RetryHandler.getRecommendedConfig('rate_limit'));
        
        if (!reportResult.success || !reportResult.data) throw reportResult.error || new Error('Failed to fetch ad unit report');
        const reportResponse = reportResult.data;
        if (!reportResponse.rows || reportResponse.rows.length === 0) return { recordsSynced: 0, recordsFailed: 0 };
        
        const transformedData = this.transformAdUnitData(reportResponse, networkCode);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'ad_unit_id']);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private async syncAdvertiserData(manager: any, schemaName: string, dataSourceId: number, startDate: string, endDate: string, connectionDetails: IAPIConnectionDetails): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const networkCode = connectionDetails.api_config?.network_code!;
        const tableMetadataService = TableMetadataService.getInstance();
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'advertiser', networkCode);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        const reportQuery = this.gamService.buildAdvertiserReportQuery(networkCode, startDate, endDate);
        const reportResult = await RetryHandler.execute(() => this.gamService.runReport(reportQuery, connectionDetails), RetryHandler.getRecommendedConfig('rate_limit'));
        
        if (!reportResult.success || !reportResult.data) throw reportResult.error || new Error('Failed to fetch advertiser report');
        const reportResponse = reportResult.data;
        if (!reportResponse.rows || reportResponse.rows.length === 0) return { recordsSynced: 0, recordsFailed: 0 };
        
        const transformedData = this.transformAdvertiserData(reportResponse, networkCode);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'advertiser_id', 'order_id', 'line_item_id']);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private async syncTimeSeriesData(manager: any, schemaName: string, dataSourceId: number, startDate: string, endDate: string, connectionDetails: IAPIConnectionDetails): Promise<{ recordsSynced: number; recordsFailed: number }> {
        const networkCode = connectionDetails.api_config?.network_code!;
        const tableMetadataService = TableMetadataService.getInstance();
        const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'time_series', networkCode);
        const fullTableName = `${schemaName}.${physicalTableName}`;
        
        const reportQuery = this.gamService.buildTimeSeriesReportQuery(networkCode, startDate, endDate);
        const reportResult = await RetryHandler.execute(() => this.gamService.runReport(reportQuery, connectionDetails), RetryHandler.getRecommendedConfig('rate_limit'));
        
        if (!reportResult.success || !reportResult.data) throw reportResult.error || new Error('Failed to fetch time series report');
        const reportResponse = reportResult.data;
        if (!reportResponse.rows || reportResponse.rows.length === 0) return { recordsSynced: 0, recordsFailed: 0 };
        
        const transformedData = this.transformTimeSeriesData(reportResponse, networkCode);
        await this.bulkUpsert(manager, fullTableName, transformedData, ['date']);
        return { recordsSynced: transformedData.length, recordsFailed: 0 };
    }

    private transformRevenueData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) return [];
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            const cpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            return {
                date: row.dimensions['DATE'],
                ad_unit_id: row.dimensions['AD_UNIT_ID'] || null,
                ad_unit_name: row.dimensions['AD_UNIT_NAME'] || null,
                country_code: row.dimensions['COUNTRY_CODE'] || null,
                country_name: row.dimensions['COUNTRY_NAME'] || null,
                impressions, clicks,
                revenue: parseFloat(revenue.toString()),
                cpm: parseFloat(cpm.toFixed(2)),
                ctr: parseFloat(ctr.toFixed(4)),
                fill_rate: 0,
                network_code: networkCode,
            };
        });
    }

    private transformGeographyData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) return [];
        return reportResponse.rows.map(row => {
            return {
                date: row.dimensions['DATE'],
                country_code: row.dimensions['COUNTRY_CODE'] || null,
                country_name: row.dimensions['COUNTRY_NAME'] || null,
                region: row.dimensions['REGION_NAME'] || null,
                city: row.dimensions['CITY_NAME'] || null,
                impressions: row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0,
                clicks: row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0,
                revenue: parseFloat((row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0).toString()),
                network_code: networkCode,
            };
        });
    }

    private transformDeviceData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) return [];
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            return {
                date: row.dimensions['DATE'],
                device_category: row.dimensions['DEVICE_CATEGORY_NAME'] || 'Unknown',
                browser_name: row.dimensions['BROWSER_NAME'] || 'Unknown',
                operating_system: row.dimensions['OPERATING_SYSTEM_NAME'] || 'Unknown',
                impressions, clicks,
                revenue: parseFloat(revenue.toString()),
                ctr: parseFloat((impressions > 0 ? (clicks / impressions) * 100 : 0).toFixed(4)),
                cpm: parseFloat((impressions > 0 ? (revenue / impressions) * 1000 : 0).toFixed(2)),
                network_code: networkCode,
            };
        });
    }

    private transformAdUnitData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) return [];
        return reportResponse.rows.map(row => {
            const impressions = row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0;
            const clicks = row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0;
            const revenue = row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0;
            return {
                date: row.dimensions['DATE'],
                ad_unit_id: row.dimensions['AD_UNIT_ID'] || null,
                ad_unit_name: row.dimensions['AD_UNIT_NAME'] || null,
                impressions, clicks,
                revenue: parseFloat(revenue.toString()),
                network_code: networkCode,
            };
        });
    }

    private transformAdvertiserData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) return [];
        return reportResponse.rows.map(row => {
            return {
                date: row.dimensions['DATE'],
                advertiser_id: row.dimensions['ADVERTISER_ID'] || null,
                advertiser_name: row.dimensions['ADVERTISER_NAME'] || null,
                order_id: row.dimensions['ORDER_ID'] || null,
                order_name: row.dimensions['ORDER_NAME'] || null,
                line_item_id: row.dimensions['LINE_ITEM_ID'] || null,
                line_item_name: row.dimensions['LINE_ITEM_NAME'] || null,
                impressions: row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0,
                clicks: row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0,
                revenue: parseFloat((row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0).toString()),
                network_code: networkCode,
            };
        });
    }

    private transformTimeSeriesData(reportResponse: IGAMReportResponse, networkCode: string): any[] {
        if (!reportResponse.rows) return [];
        return reportResponse.rows.map(row => {
            return {
                date: row.dimensions['DATE'],
                impressions: row.metrics['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS'] || 0,
                clicks: row.metrics['TOTAL_LINE_ITEM_LEVEL_CLICKS'] || 0,
                revenue: parseFloat((row.metrics['TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE'] || 0).toString()),
                network_code: networkCode,
            };
        });
    }

    private async bulkUpsert(manager: any, tableName: string, data: any[], conflictColumns: string[]): Promise<void> {
        if (data.length === 0) return;
        const batchSize = 1000;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const columns = Object.keys(batch[0]);
            const placeholders = batch.map((_, rowIndex) => `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`).join(', ');
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
}