import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { MetaAdsService } from '../services/MetaAdsService.js';
import { MetaOAuthService } from '../services/MetaOAuthService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';
import { SyncType } from '../entities/SyncHistory.js';
import { DBDriver } from './DBDriver.js';
import { TableMetadataService } from '../services/TableMetadataService.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { RetryHandler } from '../utils/RetryHandler.js';
import {
    IMetaCampaign,
    IMetaAdSet,
    IMetaAd,
    IMetaInsights,
    IInsightsParams,
} from '../types/IMetaAds.js';

/**
 * Meta Ads Driver
 * Handles data synchronization from Meta Ads to PostgreSQL
 */
export class MetaAdsDriver implements IAPIDriver {
    private static instance: MetaAdsDriver;
    private metaAdsService: MetaAdsService;
    private metaOAuthService: MetaOAuthService;
    private syncHistoryService: SyncHistoryService;
    
    private constructor() {
        this.metaAdsService = MetaAdsService.getInstance();
        this.metaOAuthService = MetaOAuthService.getInstance();
        this.syncHistoryService = SyncHistoryService.getInstance();
    }
    
    public static getInstance(): MetaAdsDriver {
        if (!MetaAdsDriver.instance) {
            MetaAdsDriver.instance = new MetaAdsDriver();
        }
        return MetaAdsDriver.instance;
    }
    
    /**
     * Authenticate with Meta Ads API
     */
    public async authenticate(connectionDetails: IAPIConnectionDetails): Promise<boolean> {
        try {
            // Check if token is expired and needs refresh (Meta doesn't have refresh tokens, but tokens are long-lived)
            if (connectionDetails.token_expiry) {
                const expiryDate = new Date(connectionDetails.token_expiry).getTime();
                if (this.metaOAuthService.isTokenExpired(expiryDate)) {
                    console.log('⚠️ Access token expired. Please re-authenticate with Meta.');
                    return false;
                }
            }
            
            // Test authentication by fetching ad accounts
            await this.metaAdsService.listAdAccounts(connectionDetails.oauth_access_token);
            
            console.log('✅ Meta Ads authentication successful');
            return true;
        } catch (error) {
            console.error('❌ Meta Ads authentication failed:', error);
            return false;
        }
    }
    
    /**
     * Sync Meta Ads data to PostgreSQL
     */
    public async syncToDatabase(
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        const startTime = Date.now();
        let totalRecordsSynced = 0;
        let totalRecordsFailed = 0;
        
        console.log(`[1;34m
═══════════════════════════════════════════════════════`);
        console.log(`🔄 Starting Meta Ads Sync for Data Source ID: ${dataSourceId}`);
        console.log(`═══════════════════════════════════════════════════════[0m\n`);
        
        // Create sync history record
        const syncRecord = await this.syncHistoryService.createSyncRecord(dataSourceId);
        await this.syncHistoryService.markAsRunning(syncRecord.id);
        
        try {
            // Authenticate first
            const isAuthenticated = await this.authenticate(connectionDetails);
            if (!isAuthenticated) {
                throw new Error('Meta Ads authentication failed');
            }
            
            // Get database connection
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                throw new Error('PostgreSQL driver not available');
            }
            const dbSource: DataSource = await driver.getConcreteDriver();
            const manager = dbSource.manager;
            
            // Get schema and ad account details
            const schemaName = 'dra_meta_ads';
            const adAccountId = connectionDetails.api_config?.ad_account_id;
            
            if (!adAccountId) {
                throw new Error('Ad account ID not found in connection details');
            }
            
            // Ensure schema exists
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            
            // Get sync configuration
            const syncTypes = connectionDetails.api_config?.report_types || ['campaigns', 'adsets', 'ads', 'insights'];
            const startDate = connectionDetails.api_config?.start_date || this.getDefaultStartDate();
            const endDate = connectionDetails.api_config?.end_date || this.getDefaultEndDate();
            
            console.log(`📊 Sync Configuration:`);
            console.log(`   - Ad Account: ${adAccountId}`);
            console.log(`   - Schema: ${schemaName}`);
            console.log(`   - Types: ${syncTypes.join(', ')}`);
            console.log(`   - Date Range: ${startDate} to ${endDate}\n`);
            
            // Sync each entity type
            for (const syncType of syncTypes) {
                console.log(`\n📁 Syncing ${syncType}...`);
                
                const recordCount = await this.syncEntityType(
                    manager,
                    schemaName,
                    dataSourceId,
                    usersPlatformId,
                    syncType,
                    connectionDetails,
                    { startDate, endDate }
                );
                
                totalRecordsSynced += recordCount;
                console.log(`✅ Synced ${recordCount} ${syncType}`);
            }
            
            // Record successful sync in history
            await this.syncHistoryService.completeSyncRecord(
                syncRecord.id,
                totalRecordsSynced,
                totalRecordsFailed
            );
            
            console.log(`\n═══════════════════════════════════════════════════════`);
            console.log(`✅ Meta Ads Sync Completed Successfully`);
            console.log(`   - Total Records Synced: ${totalRecordsSynced}`);
            console.log(`   - Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
            console.log(`═══════════════════════════════════════════════════════\n`);
            
            return true;
        } catch (error: any) {
            console.error(`\n❌ Meta Ads Sync Failed:`, error);
            
            // Record failed sync in history
            await this.syncHistoryService.markAsFailed(
                syncRecord.id,
                error.message
            );
            
            return false;
        }
    }
    
    /**
     * Dispatch to appropriate sync method based on entity type
     */
    private async syncEntityType(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        entityType: string,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        switch (entityType.toLowerCase()) {
            case 'campaigns':
                return await this.syncCampaigns(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            case 'adsets':
                return await this.syncAdSets(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails);
            case 'ads':
                return await this.syncAds(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails);
            case 'insights':
                return await this.syncInsights(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            default:
                console.warn(`⚠️ Unknown sync type: ${entityType}`);
                return 0;
        }
    }
    
    /**
     * Sync campaigns
     */
    private async syncCampaigns(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'campaigns';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalTableName);
        const adAccountId = connectionDetails.api_config?.ad_account_id!;
        
        // Create table if not exists
        await this.createCampaignsTable(manager, schemaName, tableName);
        
        // Fetch campaigns from Meta API
        const campaigns = await this.metaAdsService.getCampaigns(
            adAccountId,
            connectionDetails.oauth_access_token,
            { startDate: dateRange.startDate, endDate: dateRange.endDate }
        );
        
        if (campaigns.length === 0) {
            console.log('   No campaigns found');
            return 0;
        }
        
        // Insert or update campaigns in batches
        const batchSize = 500;
        let totalInserted = 0;
        
        for (let i = 0; i < campaigns.length; i += batchSize) {
            const batch = campaigns.slice(i, i + batchSize);
            const records = batch.map(campaign => this.transformCampaign(campaign));
            
            await this.batchUpsert(manager, schemaName, tableName, records, ['id']);
            totalInserted += batch.length;
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName: tableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            tableType: 'meta_ads'
        });

        return totalInserted;
    }
    
    /**
     * Sync ad sets
     */
    private async syncAdSets(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'adsets';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalTableName);
        const adAccountId = connectionDetails.api_config?.ad_account_id!;
        
        // Create table if not exists
        await this.createAdSetsTable(manager, schemaName, tableName);
        
        // Fetch ad sets from Meta API
        const adsets = await this.metaAdsService.getAdSets(
            adAccountId,
            connectionDetails.oauth_access_token
        );
        
        if (adsets.length === 0) {
            console.log('   No ad sets found');
            return 0;
        }
        
        // Insert or update ad sets in batches
        const batchSize = 500;
        let totalInserted = 0;
        
        for (let i = 0; i < adsets.length; i += batchSize) {
            const batch = adsets.slice(i, i + batchSize);
            const records = batch.map(adset => this.transformAdSet(adset));
            
            await this.batchUpsert(manager, schemaName, tableName, records, ['id']);
            totalInserted += batch.length;
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName: tableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            tableType: 'meta_ads'
        });
        
        return totalInserted;
    }
    
    /**
     * Sync ads
     */
    private async syncAds(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'ads';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalTableName);
        const adAccountId = connectionDetails.api_config?.ad_account_id!;
        
        // Create table if not exists
        await this.createAdsTable(manager, schemaName, tableName);
        
        // Fetch ads from Meta API
        const ads = await this.metaAdsService.getAds(
            adAccountId,
            connectionDetails.oauth_access_token
        );
        
        if (ads.length === 0) {
            console.log('   No ads found');
            return 0;
        }
        
        // Insert or update ads in batches
        const batchSize = 500;
        let totalInserted = 0;
        
        for (let i = 0; i < ads.length; i += batchSize) {
            const batch = ads.slice(i, i + batchSize);
            const records = batch.map(ad => this.transformAd(ad));
            
            await this.batchUpsert(manager, schemaName, tableName, records, ['id']);
            totalInserted += batch.length;
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName: tableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            tableType: 'meta_ads'
        });
        
        return totalInserted;
    }
    
    /**
     * Sync insights (performance metrics)
     */
    private async syncInsights(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalTableName = 'insights';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalTableName);
        const adAccountId = connectionDetails.api_config?.ad_account_id!;
        
        // Create table if not exists
        await this.createInsightsTable(manager, schemaName, tableName);
        
        // Fetch insights at campaign level
        const insightsParams: IInsightsParams = {
            time_range: {
                since: dateRange.startDate,
                until: dateRange.endDate,
            },
            level: 'campaign',
            fields: [
                'impressions',
                'clicks',
                'spend',
                'reach',
                'frequency',
                'ctr',
                'cpc',
                'cpm',
            ],
            time_increment: 1, // Daily breakdown
        };
        
        const insights = await this.metaAdsService.getCampaignInsights(
            adAccountId,
            connectionDetails.oauth_access_token,
            insightsParams
        );
        
        if (insights.length === 0) {
            console.log('   No insights found');
            return 0;
        }
        
        // Insert or update insights in batches
        const batchSize = 500;
        let totalInserted = 0;
        
        for (let i = 0; i < insights.length; i += batchSize) {
            const batch = insights.slice(i, i + batchSize);
            const records = batch.map(insight => this.transformInsight(insight, 'campaign'));
            
            await this.batchUpsert(manager, schemaName, tableName, records, ['date_start', 'date_stop']);
            totalInserted += batch.length;
        }
        
        // Store table metadata
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName,
            physicalTableName: tableName,
            logicalTableName,
            originalSheetName: logicalTableName,
            tableType: 'meta_ads'
        });
        
        return totalInserted;
    }
    
    /**
     * Transform campaign data for database insertion
     */
    private transformCampaign(campaign: IMetaCampaign): any {
        return {
            id: campaign.id,
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
            lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
            created_time: campaign.created_time,
            updated_time: campaign.updated_time,
            start_time: campaign.start_time || null,
            stop_time: campaign.stop_time || null,
            synced_at: new Date(),
        };
    }
    
    /**
     * Transform ad set data for database insertion
     */
    private transformAdSet(adset: IMetaAdSet): any {
        return {
            id: adset.id,
            name: adset.name,
            campaign_id: adset.campaign_id,
            status: adset.status,
            billing_event: adset.billing_event,
            optimization_goal: adset.optimization_goal,
            daily_budget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : null,
            lifetime_budget: adset.lifetime_budget ? parseFloat(adset.lifetime_budget) / 100 : null,
            bid_amount: adset.bid_amount ? parseFloat(adset.bid_amount) / 100 : null,
            targeting: adset.targeting ? JSON.stringify(adset.targeting) : null,
            start_time: adset.start_time || null,
            end_time: adset.end_time || null,
            created_time: adset.created_time,
            updated_time: adset.updated_time,
            synced_at: new Date(),
        };
    }
    
    /**
     * Transform ad data for database insertion
     */
    private transformAd(ad: IMetaAd): any {
        return {
            id: ad.id,
            name: ad.name,
            adset_id: ad.adset_id,
            campaign_id: ad.campaign_id,
            status: ad.status,
            creative_id: ad.creative?.id || null,
            created_time: ad.created_time,
            updated_time: ad.updated_time,
            synced_at: new Date(),
        };
    }
    
    /**
     * Transform insight data for database insertion
     */
    private transformInsight(insight: IMetaInsights, entityType: string): any {
        return {
            entity_type: entityType,
            date_start: insight.date_start,
            date_stop: insight.date_stop,
            impressions: parseInt(insight.impressions) || 0,
            clicks: parseInt(insight.clicks) || 0,
            spend: parseFloat(insight.spend) || 0,
            reach: insight.reach ? parseInt(insight.reach) : null,
            frequency: insight.frequency ? parseFloat(insight.frequency) : null,
            ctr: insight.ctr ? parseFloat(insight.ctr) : null,
            cpc: insight.cpc ? parseFloat(insight.cpc) : null,
            cpm: insight.cpm ? parseFloat(insight.cpm) : null,
            synced_at: new Date(),
        };
    }
    
    /**
     * Batch upsert records (INSERT ... ON CONFLICT UPDATE)
     */
    private async batchUpsert(
        manager: any,
        schemaName: string,
        tableName: string,
        records: any[],
        conflictKeys: string[]
    ): Promise<void> {
        if (records.length === 0) return;
        
        const fullTableName = `${schemaName}.${tableName}`;
        const columns = Object.keys(records[0]);
        const conflictClause = conflictKeys.join(', ');
        
        // Build update clause for ON CONFLICT
        const updateClause = columns
            .filter(col => !conflictKeys.includes(col))
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(', ');
        
        // Build values placeholder
        const valuesPlaceholder = records.map((_, idx) => {
            const offset = idx * columns.length;
            const placeholders = columns.map((__, colIdx) => `$${offset + colIdx + 1}`).join(', ');
            return `(${placeholders})`;
        }).join(', ');
        
        // Flatten all values
        const values = records.flatMap(record => columns.map(col => record[col]));
        
        const query = `
            INSERT INTO ${fullTableName} (${columns.join(', ')})
            VALUES ${valuesPlaceholder}
            ON CONFLICT (${conflictClause}) 
            DO UPDATE SET ${updateClause}
        `;
        
        await manager.query(query, values);
    }
    
    /**
     * Create campaigns table
     */
    private async createCampaignsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `${schemaName}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                objective VARCHAR(50),
                status VARCHAR(20),
                daily_budget DECIMAL(12,2),
                lifetime_budget DECIMAL(12,2),
                created_time TIMESTAMP,
                updated_time TIMESTAMP,
                start_time TIMESTAMP,
                stop_time TIMESTAMP,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Create indexes
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_name ON ${fullTableName}(name)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${fullTableName}(status)`);
    }
    
    /**
     * Create ad sets table
     */
    private async createAdSetsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `${schemaName}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                campaign_id VARCHAR(50),
                status VARCHAR(20),
                billing_event VARCHAR(50),
                optimization_goal VARCHAR(50),
                daily_budget DECIMAL(12,2),
                lifetime_budget DECIMAL(12,2),
                bid_amount DECIMAL(10,4),
                targeting JSONB,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                created_time TIMESTAMP,
                updated_time TIMESTAMP,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Create indexes
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${fullTableName}(status)`);
    }
    
    /**
     * Create ads table
     */
    private async createAdsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `${schemaName}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                adset_id VARCHAR(50),
                campaign_id VARCHAR(50),
                status VARCHAR(20),
                creative_id VARCHAR(50),
                created_time TIMESTAMP,
                updated_time TIMESTAMP,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Create indexes
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_adset ON ${fullTableName}(adset_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${fullTableName}(status)`);
    }
    
    /**
     * Create insights table
     */
    private async createInsightsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `${schemaName}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                entity_type VARCHAR(20),
                date_start DATE,
                date_stop DATE,
                impressions BIGINT,
                clicks BIGINT,
                spend DECIMAL(12,2),
                reach BIGINT,
                frequency DECIMAL(10,4),
                ctr DECIMAL(10,6),
                cpc DECIMAL(10,4),
                cpm DECIMAL(10,4),
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(entity_type, date_start, date_stop)
            )
        `);
        
        // Create indexes
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_entity ON ${fullTableName}(entity_type)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${fullTableName}(date_start, date_stop)`);
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
     * Get schema metadata for Meta Ads data source
     */
    public async getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any> {
        const syncTypes = connectionDetails.api_config?.report_types || ['campaigns', 'adsets', 'ads', 'insights'];
        const schemaName = 'dra_meta_ads';
        const tableMetadataService = TableMetadataService.getInstance();
        
        const tables = syncTypes.map((syncType: string) => {
            const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, syncType);
            return {
                schema: schemaName,
                table: physicalTableName,
                logicalName: syncType,
                columns: this.getTableColumns(syncType),
            };
        });
        
        return {
            schemaName,
            tables,
        };
    }
    
    /**
     * Get column definitions for a table type
     */
    private getTableColumns(syncType: string): any[] {
        switch (syncType) {
            case 'campaigns':
                return this.getCampaignColumns();
            case 'adsets':
                return this.getAdSetColumns();
            case 'ads':
                return this.getAdColumns();
            case 'insights':
                return this.getInsightColumns();
            default:
                return [];
        }
    }
    
    private getCampaignColumns(): any[] {
        return [
            { name: 'id', type: 'VARCHAR(50)', nullable: false },
            { name: 'name', type: 'VARCHAR(255)', nullable: true },
            { name: 'objective', type: 'VARCHAR(50)', nullable: true },
            { name: 'status', type: 'VARCHAR(20)', nullable: true },
            { name: 'daily_budget', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'lifetime_budget', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'created_time', type: 'TIMESTAMP', nullable: true },
            { name: 'updated_time', type: 'TIMESTAMP', nullable: true },
            { name: 'start_time', type: 'TIMESTAMP', nullable: true },
            { name: 'stop_time', type: 'TIMESTAMP', nullable: true },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    private getAdSetColumns(): any[] {
        return [
            { name: 'id', type: 'VARCHAR(50)', nullable: false },
            { name: 'name', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_id', type: 'VARCHAR(50)', nullable: true },
            { name: 'status', type: 'VARCHAR(20)', nullable: true },
            { name: 'billing_event', type: 'VARCHAR(50)', nullable: true },
            { name: 'optimization_goal', type: 'VARCHAR(50)', nullable: true },
            { name: 'daily_budget', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'lifetime_budget', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'bid_amount', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'targeting', type: 'JSONB', nullable: true },
            { name: 'start_time', type: 'TIMESTAMP', nullable: true },
            { name: 'end_time', type: 'TIMESTAMP', nullable: true },
            { name: 'created_time', type: 'TIMESTAMP', nullable: true },
            { name: 'updated_time', type: 'TIMESTAMP', nullable: true },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    private getAdColumns(): any[] {
        return [
            { name: 'id', type: 'VARCHAR(50)', nullable: false },
            { name: 'name', type: 'VARCHAR(255)', nullable: true },
            { name: 'adset_id', type: 'VARCHAR(50)', nullable: true },
            { name: 'campaign_id', type: 'VARCHAR(50)', nullable: true },
            { name: 'status', type: 'VARCHAR(20)', nullable: true },
            { name: 'creative_id', type: 'VARCHAR(50)', nullable: true },
            { name: 'created_time', type: 'TIMESTAMP', nullable: true },
            { name: 'updated_time', type: 'TIMESTAMP', nullable: true },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    private getInsightColumns(): any[] {
        return [
            { name: 'id', type: 'SERIAL', nullable: false },
            { name: 'entity_type', type: 'VARCHAR(20)', nullable: true },
            { name: 'date_start', type: 'DATE', nullable: true },
            { name: 'date_stop', type: 'DATE', nullable: true },
            { name: 'impressions', type: 'BIGINT', nullable: true },
            { name: 'clicks', type: 'BIGINT', nullable: true },
            { name: 'spend', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'reach', type: 'BIGINT', nullable: true },
            { name: 'frequency', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'ctr', type: 'DECIMAL(10,6)', nullable: true },
            { name: 'cpc', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'cpm', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    /**
     * Get last sync timestamp for a data source
     */
    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        const lastSync = await this.syncHistoryService.getLastSync(dataSourceId);
        return lastSync?.completedAt || null;
    }
    
    /**
     * Get sync history for a data source
     */
    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        return await this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }
}
