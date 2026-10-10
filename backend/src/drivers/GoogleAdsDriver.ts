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
import { IGoogleAdsReportQuery, IGoogleAdsReportResponse, IGoogleAdsRow, GOOGLE_DEFAULT_SYNC_TYPES } from '../types/IGoogleAds.js';

/**
 * Reusable metric column DDL shared by every Google Ads insights table.
 * Mirrors the Meta Ads insights metric schema so the generic analysis
 * services (campaign analysis, intelligence, anomalies, budget optimization)
 * pick Google Ads up automatically.
 */
const GOOGLE_INSIGHT_METRIC_COLUMNS_SQL = `
                impressions BIGINT,
                clicks BIGINT,
                spend DECIMAL(12,2),
                conversions DECIMAL(10,2) DEFAULT 0,
                conversion_value DECIMAL(15,2) DEFAULT 0,
                all_conversions DECIMAL(10,2) DEFAULT 0,
                all_conversions_value DECIMAL(15,2) DEFAULT 0,
                view_through_conversions BIGINT DEFAULT 0,
                cross_device_conversions DECIMAL(10,2) DEFAULT 0,
                search_impression_share DECIMAL(5,4),
                search_lost_impression_share DECIMAL(5,4),
                search_top_impression_share DECIMAL(5,4),
                search_absolute_top_impression_share DECIMAL(5,4),
                click_share DECIMAL(5,4),
                interactions BIGINT DEFAULT 0,
                interaction_rate DECIMAL(10,6),
                ctr DECIMAL(10,6),
                cpc DECIMAL(10,4),
                cpm DECIMAL(10,4),
                cpa DECIMAL(10,4),
                cpv DECIMAL(10,4),
                video_views BIGINT DEFAULT 0,
                video_view_rate DECIMAL(10,6),
                reach BIGINT,
                active_view_impressions BIGINT DEFAULT 0,
                active_view_ctr DECIMAL(10,6),
                active_view_viewability DECIMAL(10,6),
                invalid_click_rate DECIMAL(10,6),
                customer_id VARCHAR(255),
                synced_at TIMESTAMP DEFAULT NOW()`;

/**
 * Google Ads Driver
 * Handles data synchronization from Google Ads to PostgreSQL.
 *
 * The schema mirrors the Meta Ads data source: `campaigns`/`ad_groups`/`ads`/
 * `conversion_actions` hold entity settings while `*_insights` tables hold
 * daily performance data (campaign, ad group, demographic, device, geographic,
 * placement and keyword level).
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
            
            const startDate = connectionDetails.api_config?.start_date || this.getDefaultStartDate();
            const endDate = connectionDetails.api_config?.end_date || this.getDefaultEndDate();
            
            // Normalize configured report types (legacy pre-v25 names map to the
            // new schema) and fall back to the full default set when nothing is
            // configured.
            const configuredTypes = (connectionDetails.api_config?.report_types || [])
                .map((type: string) => {
                    try { return this.adsService.getReportType(type); } catch { return null; }
                })
                .filter((type: string | null): type is string => type !== null);
            const reportTypes = configuredTypes.length > 0 ? configuredTypes : [...GOOGLE_DEFAULT_SYNC_TYPES];
            
            console.log(`📊 Sync Configuration:`);
            console.log(`   - Customer ID: ${customerId}`);
            console.log(`   - Schema: ${schemaName}`);
            console.log(`   - Types: ${reportTypes.join(', ')}`);
            console.log(`   - Date Range: ${startDate} to ${endDate}\n`);
            
            // Sync each entity type. Isolate failures so a single unsupported
            // or failing report type does not abort the remaining types.
            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            let succeededTypes = 0;
            const failedTypes: Array<{ syncType: string; error: string }> = [];
            
            for (const reportType of reportTypes) {
                console.log(`\n📁 Syncing ${reportType}...`);
                try {
                    const recordCount = await this.syncEntityType(
                        manager,
                        schemaName,
                        dataSourceId,
                        usersPlatformId,
                        reportType,
                        connectionDetails,
                        { startDate, endDate }
                    );
                    
                    totalRecordsSynced += recordCount;
                    succeededTypes++;
                    console.log(`✅ Synced ${recordCount} ${reportType}`);
                } catch (error: any) {
                    totalRecordsFailed++;
                    const message = error?.message || String(error);
                    failedTypes.push({ syncType: reportType, error: message });
                    console.error(`⚠️ Failed to sync ${reportType}: ${message}`);
                }
            }
            
            if (succeededTypes === 0 && failedTypes.length > 0) {
                throw new Error(
                    `All sync types failed: ${failedTypes.map(f => `${f.syncType}: ${f.error}`).join('; ')}`
                );
            }
            if (failedTypes.length > 0) {
                console.warn(
                    `⚠️ Sync completed with ${failedTypes.length} failed type(s): ${failedTypes.map(f => f.syncType).join(', ')}`
                );
            }
            
            const errorMessage = failedTypes.length > 0
                ? failedTypes.map(f => `${f.syncType}: ${f.error}`).join('; ')
                : undefined;
            
            await this.syncHistoryService.completeSyncRecord(
                syncRecord.id,
                totalRecordsSynced,
                totalRecordsFailed,
                errorMessage
            );
            
            console.log(`✅ Google Ads sync completed: ${totalRecordsSynced} records synced, ${totalRecordsFailed} failed`);
            return true;
        } catch (error: any) {
            console.error('❌ Google Ads sync failed:', error);
            await this.syncHistoryService.markAsFailed(syncRecord.id, error.message || 'Unknown error');
            return false;
        }
    }
    
    /**
     * Dispatch to the appropriate sync method based on the sync type
     */
    private async syncEntityType(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        syncType: string,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        switch (syncType) {
            case 'campaigns':
                return await this.syncCampaignSettings(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails);
            case 'ad_groups':
                return await this.syncAdGroupSettings(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails);
            case 'ads':
                return await this.syncAds(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails);
            case 'insights':
                return await this.syncCampaignInsights(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            case 'ad_group_insights':
                return await this.syncAdGroupInsights(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            case 'demographic_insights':
                return await this.syncDemographicInsights(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            case 'device_insights':
                return await this.syncDeviceInsights(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            case 'geographic_insights':
                return await this.syncGeographicInsights(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            case 'placement_insights':
                return await this.syncPlacementInsights(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            case 'keyword_insights':
                return await this.syncKeywordInsights(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, dateRange);
            case 'conversion_actions':
                return await this.syncConversionActions(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails);
            default:
                console.warn(`⚠️ Unknown sync type: ${syncType}`);
                return 0;
        }
    }
    
    /**
     * Resolve the list of customer IDs to sync. Manager accounts expand to
     * their enabled client accounts; regular accounts sync themselves.
     */
    private async resolveCustomerIds(connectionDetails: IAPIConnectionDetails): Promise<string[]> {
        const customerId = connectionDetails.api_config?.customer_id;
        if (!customerId) throw new Error('Customer ID not configured');
        
        const isManager = await this.adsService.isManagerAccount(customerId, connectionDetails.oauth_access_token);
        if (isManager) {
            const clients = await this.adsService.listClientAccounts(customerId, connectionDetails.oauth_access_token);
            if (clients.length === 0) return [customerId];
            console.log(`   ↪ Manager account - syncing ${clients.length} client account(s)`);
            return clients;
        }
        return [customerId];
    }
    
    /**
     * Generic sync routine for a Google Ads report type across one or more
     * customer IDs (manager accounts sync all clients).
     */
    private async syncReportForAccounts(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        options: {
            logicalTableName: string;
            reportType: string;
            createTable: (manager: any, schemaName: string, tableName: string) => Promise<void>;
            transform: (row: IGoogleAdsRow, customerId: string) => any;
            conflictKeys: string[];
            startDate?: string;
            endDate?: string;
        }
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const customerIds = await this.resolveCustomerIds(connectionDetails);
        let total = 0;
        
        for (const customerId of customerIds) {
            const physicalTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, options.logicalTableName, customerId);
            const fullTableName = `${schemaName}.${physicalTableName}`;
            
            await options.createTable(manager, schemaName, physicalTableName);
            
            await tableMetadataService.storeTableMetadata(manager, {
                dataSourceId, usersPlatformId, schemaName, physicalTableName, logicalTableName: options.logicalTableName,
                originalSheetName: options.logicalTableName, fileId: customerId, tableType: 'google_ads'
            });
            
            const reportQuery: IGoogleAdsReportQuery = {
                customerId, startDate: options.startDate || '', endDate: options.endDate || '',
                reportType: options.reportType,
            };
            
            const reportResult = await RetryHandler.execute(
                () => this.adsService.runReport(reportQuery, connectionDetails),
                RetryHandler.getRecommendedConfig('rate_limit')
            );
            
            if (!reportResult.success || !reportResult.data) {
                throw reportResult.error || new Error(`Failed to fetch ${options.reportType} report`);
            }
            
            const reportResponse: IGoogleAdsReportResponse = reportResult.data;
            if (!reportResponse.rows || reportResponse.rows.length === 0) continue;
            
            const transformedData = reportResponse.rows.map(row => options.transform(row, customerId));
            await this.batchUpsert(manager, fullTableName, transformedData, options.conflictKeys);
            total += transformedData.length;
        }
        
        return total;
    }
    
    // -----------------------------------------------------------------------
    // Settings tables
    // -----------------------------------------------------------------------
    
    private async syncCampaignSettings(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'campaigns',
            reportType: 'campaigns',
            createTable: (m, s, t) => this.createCampaignsTable(m, s, t),
            transform: (row, customerId) => this.transformCampaignSettings(row, customerId),
            conflictKeys: ['id'],
        });
    }
    
    private async syncAdGroupSettings(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'ad_groups',
            reportType: 'ad_groups',
            createTable: (m, s, t) => this.createAdGroupsTable(m, s, t),
            transform: (row, customerId) => this.transformAdGroupSettings(row, customerId),
            conflictKeys: ['id'],
        });
    }
    
    private async syncAds(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'ads',
            reportType: 'ads',
            createTable: (m, s, t) => this.createAdsTable(m, s, t),
            transform: (row, customerId) => this.transformAd(row, customerId),
            conflictKeys: ['id'],
        });
    }
    
    private async syncConversionActions(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'conversion_actions',
            reportType: 'conversion_actions',
            createTable: (m, s, t) => this.createConversionActionsTable(m, s, t),
            transform: (row, customerId) => this.transformConversionAction(row, customerId),
            conflictKeys: ['id'],
        });
    }
    
    // -----------------------------------------------------------------------
    // Insights tables
    // -----------------------------------------------------------------------
    
    private async syncCampaignInsights(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'insights',
            reportType: 'insights',
            createTable: (m, s, t) => this.createInsightsTable(m, s, t),
            transform: (row, customerId) => this.transformCampaignInsight(row, customerId),
            conflictKeys: ['campaign_id', 'date_start', 'date_stop'],
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        });
    }
    
    private async syncAdGroupInsights(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'ad_group_insights',
            reportType: 'ad_group_insights',
            createTable: (m, s, t) => this.createAdGroupInsightsTable(m, s, t),
            transform: (row, customerId) => this.transformAdGroupInsight(row, customerId),
            conflictKeys: ['campaign_id', 'ad_group_id', 'date_start', 'date_stop'],
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        });
    }
    
    /**
     * Demographic insights combine age range and gender. The Google Ads API
     * cannot segment by both in a single query, so two queries are run into
     * the same physical table (rows carry either an age_range or a gender).
     */
    private async syncDemographicInsights(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        const ageCount = await this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'demographic_insights',
            reportType: 'demographic_insights',
            createTable: (m, s, t) => this.createDemographicInsightsTable(m, s, t),
            transform: (row, customerId) => this.transformDemographicInsight(row, customerId, 'age_range'),
            conflictKeys: ['campaign_id', 'ad_group_id', 'age_range', 'gender', 'date_start', 'date_stop'],
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        });
        
        const genderCount = await this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'demographic_insights',
            reportType: 'gender_insights',
            createTable: (m, s, t) => this.createDemographicInsightsTable(m, s, t),
            transform: (row, customerId) => this.transformDemographicInsight(row, customerId, 'gender'),
            conflictKeys: ['campaign_id', 'ad_group_id', 'age_range', 'gender', 'date_start', 'date_stop'],
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        });
        
        return ageCount + genderCount;
    }
    
    private async syncDeviceInsights(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'device_insights',
            reportType: 'device_insights',
            createTable: (m, s, t) => this.createDeviceInsightsTable(m, s, t),
            transform: (row, customerId) => this.transformDeviceInsight(row, customerId),
            conflictKeys: ['campaign_id', 'device', 'date_start', 'date_stop'],
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        });
    }
    
    private async syncGeographicInsights(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'geographic_insights',
            reportType: 'geographic_insights',
            createTable: (m, s, t) => this.createGeographicInsightsTable(m, s, t),
            transform: (row, customerId) => this.transformGeographicInsight(row, customerId),
            conflictKeys: ['country_criterion_id', 'region', 'city', 'date_start', 'date_stop'],
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        });
    }
    
    private async syncPlacementInsights(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'placement_insights',
            reportType: 'placement_insights',
            createTable: (m, s, t) => this.createPlacementInsightsTable(m, s, t),
            transform: (row, customerId) => this.transformPlacementInsight(row, customerId),
            conflictKeys: ['campaign_id', 'placement', 'slot', 'date_start', 'date_stop'],
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        });
    }
    
    private async syncKeywordInsights(
        manager: any,
        schemaName: string,
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails,
        dateRange: { startDate: string; endDate: string }
    ): Promise<number> {
        return this.syncReportForAccounts(manager, schemaName, dataSourceId, usersPlatformId, connectionDetails, {
            logicalTableName: 'keyword_insights',
            reportType: 'keyword_insights',
            createTable: (m, s, t) => this.createKeywordInsightsTable(m, s, t),
            transform: (row, customerId) => this.transformKeywordInsight(row, customerId),
            conflictKeys: ['campaign_id', 'ad_group_id', 'keyword_text', 'match_type', 'date_start', 'date_stop'],
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
        });
    }
    
    // -----------------------------------------------------------------------
    // Transforms
    // -----------------------------------------------------------------------
    
    /**
     * Human readable objective label derived from the advertising channel type.
     */
    private objectiveForChannelType(channelType?: string): string | null {
        if (!channelType) return null;
        const map: Record<string, string> = {
            SEARCH: 'Search',
            DISPLAY: 'Display',
            SHOPPING: 'Shopping',
            HOTEL: 'Hotel',
            VIDEO: 'Video',
            MULTI_CHANNEL: 'Performance Max',
            LOCAL: 'Local',
            SMART: 'Smart',
            PERFORMANCE_MAX: 'Performance Max',
            TRAVEL_ACTIVITIES: 'Travel Activities',
            DEMAND_GEN: 'Demand Gen',
        };
        return map[channelType] || channelType;
    }
    
    private transformCampaignSettings(row: IGoogleAdsRow, customerId: string): any {
        const budgetMicros = row.campaignBudget?.amountMicros;
        const totalBudgetMicros = row.campaignBudget?.totalAmountMicros;
        const targetCpaMicros = row.campaign?.targetCpa?.targetCpaMicros;
        
        return {
            id: row.campaign?.id,
            name: row.campaign?.name,
            status: row.campaign?.status || null,
            advertising_channel_type: row.campaign?.advertisingChannelType || null,
            advertising_channel_sub_type: row.campaign?.advertisingChannelSubType || null,
            primary_status: row.campaign?.primaryStatus || null,
            serving_status: row.campaign?.servingStatus || null,
            objective: this.objectiveForChannelType(row.campaign?.advertisingChannelType),
            start_date: row.campaign?.startDateTime ? row.campaign.startDateTime.slice(0, 10) : null,
            end_date: row.campaign?.endDateTime ? row.campaign.endDateTime.slice(0, 10) : null,
            bidding_strategy_type: row.campaign?.biddingStrategyType || null,
            optimization_score: row.campaign?.optimizationScore ?? null,
            target_cpa: targetCpaMicros != null ? parseFloat(Number(targetCpaMicros).toFixed(2)) / 1000000 : null,
            target_roas: row.campaign?.targetRoas?.targetRoas ?? null,
            budget_id: row.campaignBudget?.id || null,
            daily_budget: budgetMicros != null ? parseFloat(Number(budgetMicros).toFixed(2)) / 1000000 : null,
            total_budget: totalBudgetMicros != null ? parseFloat(Number(totalBudgetMicros).toFixed(2)) / 1000000 : null,
            budget_explicitly_shared: row.campaignBudget?.explicitlyShared ?? false,
            budget_delivery_method: row.campaignBudget?.deliveryMethod || null,
            budget_period: row.campaignBudget?.period || null,
            budget_status: row.campaignBudget?.status || null,
            tracking_url_template: row.campaign?.trackingUrlTemplate || null,
            customer_id: customerId,
            synced_at: new Date(),
        };
    }
    
    private transformAdGroupSettings(row: IGoogleAdsRow, customerId: string): any {
        return {
            id: row.adGroup?.id,
            name: row.adGroup?.name,
            campaign_id: row.campaign?.id || null,
            campaign_name: row.campaign?.name || null,
            campaign_status: row.campaign?.status || null,
            status: row.adGroup?.status || null,
            ad_group_type: row.adGroup?.type || null,
            cpc_bid: row.adGroup?.cpcBidMicros != null
                ? parseFloat(Number(row.adGroup.cpcBidMicros).toFixed(4)) / 1000000
                : null,
            customer_id: customerId,
            synced_at: new Date(),
        };
    }
    
    private transformAd(row: IGoogleAdsRow, customerId: string): any {
        const ad = row.adGroupAd?.ad;
        const headlines = ad?.responsiveSearchAd?.headlines?.map(h => h.text).filter(Boolean) || [];
        const descriptions = ad?.responsiveSearchAd?.descriptions?.map(d => d.text).filter(Boolean) || [];
        
        return {
            id: row.adGroupAd?.ad?.id,
            name: row.adGroupAd?.ad?.name || null,
            status: row.adGroupAd?.status || null,
            ad_group_id: row.adGroup?.id || null,
            ad_group_name: row.adGroup?.name || null,
            campaign_id: row.campaign?.id || null,
            campaign_name: row.campaign?.name || null,
            ad_type: ad?.type || null,
            headlines: headlines.length > 0 ? JSON.stringify(headlines) : null,
            descriptions: descriptions.length > 0 ? JSON.stringify(descriptions) : null,
            headline: headlines[0] || null,
            description: descriptions[0] || null,
            final_urls: ad?.finalUrls?.length ? JSON.stringify(ad.finalUrls) : null,
            display_url: ad?.displayUrl || null,
            tracking_url_template: ad?.trackingUrlTemplate || null,
            customer_id: customerId,
            synced_at: new Date(),
        };
    }
    
    private transformConversionAction(row: IGoogleAdsRow, customerId: string): any {
        const valueSettings = row.conversionAction?.valueSettings;
        return {
            id: row.conversionAction?.id,
            name: row.conversionAction?.name || null,
            status: row.conversionAction?.status || null,
            type: row.conversionAction?.type || null,
            category: row.conversionAction?.category || null,
            counting_type: row.conversionAction?.countingType || null,
            attribution_model: row.conversionAction?.attributionModelSettings?.attributionModel || null,
            include_in_conversions_metric: row.conversionAction?.includeInConversionsMetric ?? false,
            click_through_conversion_lookback_window_days: row.conversionAction?.clickThroughLookbackWindowDays ?? null,
            view_through_conversion_lookback_window_days: row.conversionAction?.viewThroughLookbackWindowDays ?? null,
            source: row.conversionAction?.origin || null,
            primary_for_conversion_goal: row.conversionAction?.primaryForGoal ?? false,
            default_conversion_value: valueSettings?.defaultValue ?? null,
            default_conversion_currency: valueSettings?.defaultCurrencyCode || null,
            customer_id: customerId,
            synced_at: new Date(),
        };
    }
    
    /**
     * Build the shared metric columns for an insights row.
     */
    private buildInsightMetrics(row: IGoogleAdsRow): Record<string, any> {
        const m = row.metrics || {} as any;
        return {
            impressions: m.impressions || 0,
            clicks: m.clicks || 0,
            spend: m.costMicros != null ? parseFloat((m.costMicros / 1000000).toFixed(2)) : 0,
            conversions: m.conversions || 0,
            conversion_value: m.conversionsValue || 0,
            all_conversions: m.allConversions || 0,
            all_conversions_value: m.allConversionsValue || 0,
            view_through_conversions: m.viewThroughConversions || 0,
            cross_device_conversions: m.crossDeviceConversions || 0,
            search_impression_share: m.searchImpressionShare ?? null,
            search_lost_impression_share: m.searchRankLostImpressionShare ?? null,
            search_top_impression_share: m.searchTopImpressionShare ?? null,
            search_absolute_top_impression_share: m.searchAbsoluteTopImpressionShare ?? null,
            click_share: m.searchClickShare ?? null,
            interactions: m.interactions || 0,
            interaction_rate: m.interactionRate ?? null,
            ctr: m.ctr ?? null,
            cpc: m.averageCpc ?? null,
            cpm: m.averageCpm ?? null,
            cpa: m.averageCpa ?? null,
            cpv: m.averageCpv ?? null,
            video_views: m.videoViews || 0,
            video_view_rate: m.videoViewRate ?? null,
            reach: m.reach ?? null,
            active_view_impressions: m.activeViewImpressions || 0,
            active_view_ctr: m.activeViewCtr ?? null,
            active_view_viewability: m.activeViewViewability ?? null,
            invalid_click_rate: m.invalidClickRate ?? null,
            synced_at: new Date(),
        };
    }
    
    private transformCampaignInsight(row: IGoogleAdsRow, customerId: string): any {
        const date = row.segments?.date;
        return {
            campaign_id: row.campaign?.id || null,
            campaign_name: row.campaign?.name || null,
            campaign_status: row.campaign?.status || null,
            advertising_channel_type: row.campaign?.advertisingChannelType || null,
            date_start: date,
            date_stop: date,
            customer_id: customerId,
            ...this.buildInsightMetrics(row),
        };
    }
    
    private transformAdGroupInsight(row: IGoogleAdsRow, customerId: string): any {
        const date = row.segments?.date;
        return {
            campaign_id: row.campaign?.id || null,
            campaign_name: row.campaign?.name || null,
            ad_group_id: row.adGroup?.id || null,
            ad_group_name: row.adGroup?.name || null,
            ad_group_status: row.adGroup?.status || null,
            date_start: date,
            date_stop: date,
            customer_id: customerId,
            ...this.buildInsightMetrics(row),
        };
    }
    
    private transformDemographicInsight(row: IGoogleAdsRow, customerId: string, type: 'age_range' | 'gender'): any {
        const date = row.segments?.date;
        return {
            campaign_id: row.campaign?.id || null,
            campaign_name: row.campaign?.name || null,
            ad_group_id: row.adGroup?.id || null,
            ad_group_name: row.adGroup?.name || null,
            age_range: type === 'age_range' ? (row.adGroupCriterion?.ageRange?.type || 'UNKNOWN') : null,
            gender: type === 'gender' ? (row.adGroupCriterion?.gender?.type || 'UNKNOWN') : null,
            date_start: date,
            date_stop: date,
            customer_id: customerId,
            ...this.buildInsightMetrics(row),
        };
    }
    
    private transformDeviceInsight(row: IGoogleAdsRow, customerId: string): any {
        const date = row.segments?.date;
        return {
            campaign_id: row.campaign?.id || null,
            campaign_name: row.campaign?.name || null,
            device: row.segments?.device || 'UNKNOWN',
            date_start: date,
            date_stop: date,
            customer_id: customerId,
            ...this.buildInsightMetrics(row),
        };
    }
    
    private transformGeographicInsight(row: IGoogleAdsRow, customerId: string): any {
        const date = row.segments?.date;
        const countryId = row.geographicView?.countryCriterionId;
        return {
            country_criterion_id: countryId != null ? String(countryId) : null,
            country: countryId != null ? String(countryId) : null,
            region: row.segments?.geoTargetRegion || null,
            city: row.segments?.geoTargetCity || null,
            date_start: date,
            date_stop: date,
            customer_id: customerId,
            ...this.buildInsightMetrics(row),
        };
    }
    
    private transformPlacementInsight(row: IGoogleAdsRow, customerId: string): any {
        const date = row.segments?.date;
        return {
            campaign_id: row.campaign?.id || null,
            campaign_name: row.campaign?.name || null,
            placement: row.segments?.adNetworkType || 'UNKNOWN',
            slot: row.segments?.slot || null,
            date_start: date,
            date_stop: date,
            customer_id: customerId,
            ...this.buildInsightMetrics(row),
        };
    }
    
    private transformKeywordInsight(row: IGoogleAdsRow, customerId: string): any {
        const date = row.segments?.date;
        return {
            campaign_id: row.campaign?.id || null,
            campaign_name: row.campaign?.name || null,
            ad_group_id: row.adGroup?.id || null,
            ad_group_name: row.adGroup?.name || null,
            keyword_text: row.adGroupCriterion?.keyword?.text || null,
            match_type: row.adGroupCriterion?.keyword?.matchType || null,
            quality_score: row.adGroupCriterion?.qualityInfo?.qualityScore ?? null,
            date_start: date,
            date_stop: date,
            customer_id: customerId,
            ...this.buildInsightMetrics(row),
        };
    }
    
    // -----------------------------------------------------------------------
    // Table creation
    // -----------------------------------------------------------------------
    
    /**
     * Drop a legacy `campaigns` table created by the pre-v25 driver. The old
     * table held daily performance (a `date` column) while the new one holds
     * campaign settings. Detection is column-based so it is idempotent.
     */
    private async dropLegacyCampaignsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const exists = await manager.query(`SELECT to_regclass($1) AS tbl`, [`${schemaName}.${tableName}`]);
        if (!exists[0]?.tbl) return;
        
        const columns = await manager.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
            [schemaName, tableName]
        );
        const columnNames = columns.map((c: any) => c.column_name);
        if (columnNames.includes('date') && columnNames.includes('campaign_id')) {
            console.log(`   ↪ Dropping legacy campaigns performance table ${schemaName}.${tableName}`);
            await manager.query(`DROP TABLE IF EXISTS "${schemaName}"."${tableName}"`);
            await manager.query(
                `DELETE FROM dra_table_metadata WHERE schema_name = $1 AND physical_table_name = $2`,
                [schemaName, tableName]
            );
        }
    }
    
    private async createCampaignsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await this.dropLegacyCampaignsTable(manager, schemaName, tableName);
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                status VARCHAR(50),
                advertising_channel_type VARCHAR(50),
                advertising_channel_sub_type VARCHAR(50),
                primary_status VARCHAR(50),
                serving_status VARCHAR(50),
                objective VARCHAR(100),
                start_date DATE,
                end_date DATE,
                bidding_strategy_type VARCHAR(100),
                optimization_score DECIMAL(6,4),
                target_cpa DECIMAL(12,2),
                target_roas DECIMAL(12,4),
                budget_id VARCHAR(255),
                daily_budget DECIMAL(12,2),
                total_budget DECIMAL(14,2),
                budget_explicitly_shared BOOLEAN,
                budget_delivery_method VARCHAR(50),
                budget_period VARCHAR(50),
                budget_status VARCHAR(50),
                tracking_url_template TEXT,
                customer_id VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${fullTableName}(status)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_customer ON ${fullTableName}(customer_id)`);
    }
    
    private async createAdGroupsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                campaign_id VARCHAR(255),
                campaign_name VARCHAR(255),
                campaign_status VARCHAR(50),
                status VARCHAR(50),
                ad_group_type VARCHAR(100),
                cpc_bid DECIMAL(10,4),
                customer_id VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${fullTableName}(status)`);
    }
    
    private async createAdsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                status VARCHAR(50),
                ad_group_id VARCHAR(255),
                ad_group_name VARCHAR(255),
                campaign_id VARCHAR(255),
                campaign_name VARCHAR(255),
                ad_type VARCHAR(100),
                headlines JSONB,
                descriptions JSONB,
                headline TEXT,
                description TEXT,
                final_urls JSONB,
                display_url TEXT,
                tracking_url_template TEXT,
                customer_id VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_ad_group ON ${fullTableName}(ad_group_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${fullTableName}(status)`);
    }
    
    private async createConversionActionsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                status VARCHAR(50),
                type VARCHAR(100),
                category VARCHAR(100),
                counting_type VARCHAR(100),
                attribution_model VARCHAR(100),
                include_in_conversions_metric BOOLEAN,
                click_through_conversion_lookback_window_days INTEGER,
                view_through_conversion_lookback_window_days INTEGER,
                source VARCHAR(100),
                primary_for_conversion_goal BOOLEAN,
                default_conversion_value DECIMAL(15,2),
                default_conversion_currency VARCHAR(10),
                customer_id VARCHAR(255) NOT NULL,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${fullTableName}(status)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_category ON ${fullTableName}(category)`);
    }
    
    private async createInsightsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                campaign_id VARCHAR(255),
                campaign_name VARCHAR(255),
                campaign_status VARCHAR(50),
                advertising_channel_type VARCHAR(50),
                date_start DATE,
                date_stop DATE,${GOOGLE_INSIGHT_METRIC_COLUMNS_SQL},
                UNIQUE(campaign_id, date_start, date_stop)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_id ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${fullTableName}(date_start, date_stop)`);
    }
    
    private async createAdGroupInsightsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                campaign_id VARCHAR(255),
                campaign_name VARCHAR(255),
                ad_group_id VARCHAR(255),
                ad_group_name VARCHAR(255),
                ad_group_status VARCHAR(50),
                date_start DATE,
                date_stop DATE,${GOOGLE_INSIGHT_METRIC_COLUMNS_SQL},
                UNIQUE(campaign_id, ad_group_id, date_start, date_stop)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_id ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_ad_group_id ON ${fullTableName}(ad_group_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${fullTableName}(date_start, date_stop)`);
    }
    
    private async createDemographicInsightsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                campaign_id VARCHAR(255),
                campaign_name VARCHAR(255),
                ad_group_id VARCHAR(255),
                ad_group_name VARCHAR(255),
                age_range VARCHAR(50),
                gender VARCHAR(50),
                date_start DATE,
                date_stop DATE,${GOOGLE_INSIGHT_METRIC_COLUMNS_SQL},
                UNIQUE(campaign_id, ad_group_id, age_range, gender, date_start, date_stop)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_id ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_age ON ${fullTableName}(age_range)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_gender ON ${fullTableName}(gender)`);
    }
    
    private async createDeviceInsightsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                campaign_id VARCHAR(255),
                campaign_name VARCHAR(255),
                device VARCHAR(50),
                date_start DATE,
                date_stop DATE,${GOOGLE_INSIGHT_METRIC_COLUMNS_SQL},
                UNIQUE(campaign_id, device, date_start, date_stop)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_id ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_device ON ${fullTableName}(device)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${fullTableName}(date_start, date_stop)`);
    }
    
    private async createGeographicInsightsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                country_criterion_id VARCHAR(100),
                country VARCHAR(100),
                region VARCHAR(255),
                city VARCHAR(255),
                date_start DATE,
                date_stop DATE,${GOOGLE_INSIGHT_METRIC_COLUMNS_SQL},
                UNIQUE(country_criterion_id, region, city, date_start, date_stop)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_country ON ${fullTableName}(country)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${fullTableName}(date_start, date_stop)`);
    }
    
    private async createPlacementInsightsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                campaign_id VARCHAR(255),
                campaign_name VARCHAR(255),
                placement VARCHAR(50),
                slot VARCHAR(50),
                date_start DATE,
                date_stop DATE,${GOOGLE_INSIGHT_METRIC_COLUMNS_SQL},
                UNIQUE(campaign_id, placement, slot, date_start, date_stop)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_id ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_placement ON ${fullTableName}(placement)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${fullTableName}(date_start, date_stop)`);
    }
    
    private async createKeywordInsightsTable(manager: any, schemaName: string, tableName: string): Promise<void> {
        const fullTableName = `"${schemaName}"."${tableName}"`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${fullTableName} (
                id SERIAL PRIMARY KEY,
                campaign_id VARCHAR(255),
                campaign_name VARCHAR(255),
                ad_group_id VARCHAR(255),
                ad_group_name VARCHAR(255),
                keyword_text VARCHAR(255),
                match_type VARCHAR(50),
                quality_score INTEGER,
                date_start DATE,
                date_stop DATE,${GOOGLE_INSIGHT_METRIC_COLUMNS_SQL},
                UNIQUE(campaign_id, ad_group_id, keyword_text, match_type, date_start, date_stop)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_id ON ${fullTableName}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_keyword ON ${fullTableName}(keyword_text)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${fullTableName}(date_start, date_stop)`);
    }
    
    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    
    private validateTableName(tableName: string): void {
        if (!/^[a-zA-Z0-9_.]+$/.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
    }
    
    private async batchUpsert(
        manager: any,
        tableName: string,
        data: any[],
        conflictKeys: string[]
    ): Promise<void> {
        this.validateTableName(tableName);
        if (data.length === 0) return;
        const batchSize = 500;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const columns = Object.keys(batch[0]);
            const placeholders = batch.map((_, rowIndex) => {
                const rowPlaceholders = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
                return `(${rowPlaceholders.join(', ')})`;
            }).join(', ');
            const values = batch.flatMap(row => columns.map(col => row[col]));
            const updateClause = columns.filter(col => !conflictKeys.includes(col)).map(col => `${col} = EXCLUDED.${col}`).join(', ');
            const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT (${conflictKeys.join(', ')}) DO UPDATE SET ${updateClause}`;
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
        const configuredTypes = (connectionDetails.api_config?.report_types || [])
            .map((type: string) => {
                try { return this.adsService.getReportType(type); } catch { return null; }
            })
            .filter((type: string | null): type is string => type !== null);
        const syncTypes = configuredTypes.length > 0 ? configuredTypes : GOOGLE_DEFAULT_SYNC_TYPES;
        const schemaName = 'dra_google_ads';
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
        
        return { schemaName, tables };
    }
    
    private getTableColumns(syncType: string): any[] {
        switch (syncType) {
            case 'campaigns':
                return this.getCampaignColumns();
            case 'ad_groups':
                return this.getAdGroupColumns();
            case 'ads':
                return this.getAdColumns();
            case 'insights':
                return this.getInsightColumns();
            case 'ad_group_insights':
                return this.getAdGroupInsightColumns();
            case 'demographic_insights':
                return this.getDemographicInsightColumns();
            case 'device_insights':
                return this.getDeviceInsightColumns();
            case 'geographic_insights':
                return this.getGeographicInsightColumns();
            case 'placement_insights':
                return this.getPlacementInsightColumns();
            case 'keyword_insights':
                return this.getKeywordInsightColumns();
            case 'conversion_actions':
                return this.getConversionActionColumns();
            default:
                return [];
        }
    }
    
    private getInsightMetricColumnDefs(): any[] {
        return [
            { name: 'impressions', type: 'BIGINT', nullable: true },
            { name: 'clicks', type: 'BIGINT', nullable: true },
            { name: 'spend', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'conversions', type: 'DECIMAL(10,2)', nullable: true },
            { name: 'conversion_value', type: 'DECIMAL(15,2)', nullable: true },
            { name: 'all_conversions', type: 'DECIMAL(10,2)', nullable: true },
            { name: 'all_conversions_value', type: 'DECIMAL(15,2)', nullable: true },
            { name: 'view_through_conversions', type: 'BIGINT', nullable: true },
            { name: 'cross_device_conversions', type: 'DECIMAL(10,2)', nullable: true },
            { name: 'search_impression_share', type: 'DECIMAL(5,4)', nullable: true },
            { name: 'search_lost_impression_share', type: 'DECIMAL(5,4)', nullable: true },
            { name: 'search_top_impression_share', type: 'DECIMAL(5,4)', nullable: true },
            { name: 'search_absolute_top_impression_share', type: 'DECIMAL(5,4)', nullable: true },
            { name: 'click_share', type: 'DECIMAL(5,4)', nullable: true },
            { name: 'interactions', type: 'BIGINT', nullable: true },
            { name: 'interaction_rate', type: 'DECIMAL(10,6)', nullable: true },
            { name: 'ctr', type: 'DECIMAL(10,6)', nullable: true },
            { name: 'cpc', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'cpm', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'cpa', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'cpv', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'video_views', type: 'BIGINT', nullable: true },
            { name: 'video_view_rate', type: 'DECIMAL(10,6)', nullable: true },
            { name: 'reach', type: 'BIGINT', nullable: true },
            { name: 'active_view_impressions', type: 'BIGINT', nullable: true },
            { name: 'active_view_ctr', type: 'DECIMAL(10,6)', nullable: true },
            { name: 'active_view_viewability', type: 'DECIMAL(10,6)', nullable: true },
            { name: 'invalid_click_rate', type: 'DECIMAL(10,6)', nullable: true },
            { name: 'customer_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    private getCampaignColumns(): any[] {
        return [
            { name: 'id', type: 'VARCHAR(255)', nullable: false },
            { name: 'name', type: 'VARCHAR(255)', nullable: true },
            { name: 'status', type: 'VARCHAR(50)', nullable: true },
            { name: 'advertising_channel_type', type: 'VARCHAR(50)', nullable: true },
            { name: 'advertising_channel_sub_type', type: 'VARCHAR(50)', nullable: true },
            { name: 'primary_status', type: 'VARCHAR(50)', nullable: true },
            { name: 'serving_status', type: 'VARCHAR(50)', nullable: true },
            { name: 'objective', type: 'VARCHAR(100)', nullable: true },
            { name: 'start_date', type: 'DATE', nullable: true },
            { name: 'end_date', type: 'DATE', nullable: true },
            { name: 'bidding_strategy_type', type: 'VARCHAR(100)', nullable: true },
            { name: 'optimization_score', type: 'DECIMAL(6,4)', nullable: true },
            { name: 'target_cpa', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'target_roas', type: 'DECIMAL(12,4)', nullable: true },
            { name: 'budget_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'daily_budget', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'total_budget', type: 'DECIMAL(14,2)', nullable: true },
            { name: 'budget_explicitly_shared', type: 'BOOLEAN', nullable: true },
            { name: 'budget_delivery_method', type: 'VARCHAR(50)', nullable: true },
            { name: 'budget_period', type: 'VARCHAR(50)', nullable: true },
            { name: 'budget_status', type: 'VARCHAR(50)', nullable: true },
            { name: 'tracking_url_template', type: 'TEXT', nullable: true },
            { name: 'customer_id', type: 'VARCHAR(255)', nullable: false },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    private getAdGroupColumns(): any[] {
        return [
            { name: 'id', type: 'VARCHAR(255)', nullable: false },
            { name: 'name', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_status', type: 'VARCHAR(50)', nullable: true },
            { name: 'status', type: 'VARCHAR(50)', nullable: true },
            { name: 'ad_group_type', type: 'VARCHAR(100)', nullable: true },
            { name: 'cpc_bid', type: 'DECIMAL(10,4)', nullable: true },
            { name: 'customer_id', type: 'VARCHAR(255)', nullable: false },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    private getAdColumns(): any[] {
        return [
            { name: 'id', type: 'VARCHAR(255)', nullable: false },
            { name: 'name', type: 'VARCHAR(255)', nullable: true },
            { name: 'status', type: 'VARCHAR(50)', nullable: true },
            { name: 'ad_group_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_group_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_type', type: 'VARCHAR(100)', nullable: true },
            { name: 'headlines', type: 'JSONB', nullable: true },
            { name: 'descriptions', type: 'JSONB', nullable: true },
            { name: 'headline', type: 'TEXT', nullable: true },
            { name: 'description', type: 'TEXT', nullable: true },
            { name: 'final_urls', type: 'JSONB', nullable: true },
            { name: 'display_url', type: 'TEXT', nullable: true },
            { name: 'tracking_url_template', type: 'TEXT', nullable: true },
            { name: 'customer_id', type: 'VARCHAR(255)', nullable: false },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    private getInsightColumns(): any[] {
        return [
            { name: 'id', type: 'SERIAL', nullable: false },
            { name: 'campaign_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_status', type: 'VARCHAR(50)', nullable: true },
            { name: 'advertising_channel_type', type: 'VARCHAR(50)', nullable: true },
            { name: 'date_start', type: 'DATE', nullable: true },
            { name: 'date_stop', type: 'DATE', nullable: true },
            ...this.getInsightMetricColumnDefs(),
        ];
    }
    
    private getAdGroupInsightColumns(): any[] {
        return [
            { name: 'id', type: 'SERIAL', nullable: false },
            { name: 'campaign_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_group_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_group_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_group_status', type: 'VARCHAR(50)', nullable: true },
            { name: 'date_start', type: 'DATE', nullable: true },
            { name: 'date_stop', type: 'DATE', nullable: true },
            ...this.getInsightMetricColumnDefs(),
        ];
    }
    
    private getDemographicInsightColumns(): any[] {
        return [
            { name: 'id', type: 'SERIAL', nullable: false },
            { name: 'campaign_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_group_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_group_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'age_range', type: 'VARCHAR(50)', nullable: true },
            { name: 'gender', type: 'VARCHAR(50)', nullable: true },
            { name: 'date_start', type: 'DATE', nullable: true },
            { name: 'date_stop', type: 'DATE', nullable: true },
            ...this.getInsightMetricColumnDefs(),
        ];
    }
    
    private getDeviceInsightColumns(): any[] {
        return [
            { name: 'id', type: 'SERIAL', nullable: false },
            { name: 'campaign_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'device', type: 'VARCHAR(50)', nullable: true },
            { name: 'date_start', type: 'DATE', nullable: true },
            { name: 'date_stop', type: 'DATE', nullable: true },
            ...this.getInsightMetricColumnDefs(),
        ];
    }
    
    private getGeographicInsightColumns(): any[] {
        return [
            { name: 'id', type: 'SERIAL', nullable: false },
            { name: 'country_criterion_id', type: 'VARCHAR(100)', nullable: true },
            { name: 'country', type: 'VARCHAR(100)', nullable: true },
            { name: 'region', type: 'VARCHAR(255)', nullable: true },
            { name: 'city', type: 'VARCHAR(255)', nullable: true },
            { name: 'date_start', type: 'DATE', nullable: true },
            { name: 'date_stop', type: 'DATE', nullable: true },
            ...this.getInsightMetricColumnDefs(),
        ];
    }
    
    private getPlacementInsightColumns(): any[] {
        return [
            { name: 'id', type: 'SERIAL', nullable: false },
            { name: 'campaign_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'placement', type: 'VARCHAR(50)', nullable: true },
            { name: 'slot', type: 'VARCHAR(50)', nullable: true },
            { name: 'date_start', type: 'DATE', nullable: true },
            { name: 'date_stop', type: 'DATE', nullable: true },
            ...this.getInsightMetricColumnDefs(),
        ];
    }
    
    private getKeywordInsightColumns(): any[] {
        return [
            { name: 'id', type: 'SERIAL', nullable: false },
            { name: 'campaign_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_group_id', type: 'VARCHAR(255)', nullable: true },
            { name: 'ad_group_name', type: 'VARCHAR(255)', nullable: true },
            { name: 'keyword_text', type: 'VARCHAR(255)', nullable: true },
            { name: 'match_type', type: 'VARCHAR(50)', nullable: true },
            { name: 'quality_score', type: 'INTEGER', nullable: true },
            { name: 'date_start', type: 'DATE', nullable: true },
            { name: 'date_stop', type: 'DATE', nullable: true },
            ...this.getInsightMetricColumnDefs(),
        ];
    }
    
    private getConversionActionColumns(): any[] {
        return [
            { name: 'id', type: 'VARCHAR(255)', nullable: false },
            { name: 'name', type: 'VARCHAR(255)', nullable: true },
            { name: 'status', type: 'VARCHAR(50)', nullable: true },
            { name: 'type', type: 'VARCHAR(100)', nullable: true },
            { name: 'category', type: 'VARCHAR(100)', nullable: true },
            { name: 'counting_type', type: 'VARCHAR(100)', nullable: true },
            { name: 'attribution_model', type: 'VARCHAR(100)', nullable: true },
            { name: 'include_in_conversions_metric', type: 'BOOLEAN', nullable: true },
            { name: 'click_through_conversion_lookback_window_days', type: 'INTEGER', nullable: true },
            { name: 'view_through_conversion_lookback_window_days', type: 'INTEGER', nullable: true },
            { name: 'source', type: 'VARCHAR(100)', nullable: true },
            { name: 'primary_for_conversion_goal', type: 'BOOLEAN', nullable: true },
            { name: 'default_conversion_value', type: 'DECIMAL(15,2)', nullable: true },
            { name: 'default_conversion_currency', type: 'VARCHAR(10)', nullable: true },
            { name: 'customer_id', type: 'VARCHAR(255)', nullable: false },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
    
    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        const lastSync = await this.syncHistoryService.getLastSync(dataSourceId);
        return lastSync?.completedAt || null;
    }
    
    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        return await this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }
}
