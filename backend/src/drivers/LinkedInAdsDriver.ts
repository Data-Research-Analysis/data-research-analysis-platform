import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { LinkedInAdsService } from '../services/LinkedInAdsService.js';
import { LinkedInOAuthService } from '../services/LinkedInOAuthService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';
import { DBDriver } from './DBDriver.js';
import { TableMetadataService } from '../services/TableMetadataService.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { resolveSyncWindow } from '../utils/SyncWindowUtils.js';
import {
    ILinkedInAdAccount,
    ILinkedInCampaign,
    ILinkedInCampaignGroup,
    ILinkedInCreative,
    ILinkedInAnalyticsRecord,
    ILinkedInDate,
    ILinkedInDateRange,
    TLinkedInAnalyticsPivot,
} from '../types/ILinkedInAds.js';

/**
 * LinkedIn Ads Driver
 * Syncs LinkedIn Marketing API data into PostgreSQL under the dra_linkedin_ads schema.
 *
 * Tables written:
 *  - ad_accounts          — account metadata
 *  - campaign_groups      — campaign group metadata
 *  - campaigns            — campaign metadata
 *  - creatives            — creative metadata
 *  - campaign_analytics   — daily campaign-level performance metrics (campaign_id linked)
 *  - creative_analytics   — daily creative (ad) level performance metrics
 *  - account_analytics    — monthly account-level performance metrics
 *  - device_insights      — daily device-type breakdown per campaign
 *  - placement_insights   — daily placement breakdown per campaign
 *  - industry_insights    — daily member-industry breakdown per campaign
 *  - seniority_insights   — daily member-seniority breakdown per campaign
 *  - job_function_insights— daily member-job-function breakdown per campaign
 *  - country_insights     — daily member-country breakdown per campaign
 */
export class LinkedInAdsDriver implements IAPIDriver {
    private static instance: LinkedInAdsDriver;

    private readonly linkedInAdsService: LinkedInAdsService;
    private readonly linkedInOAuthService: LinkedInOAuthService;
    private readonly syncHistoryService: SyncHistoryService;

    private static readonly SCHEMA_NAME = 'dra_linkedin_ads';
    private static readonly BATCH_SIZE = 500;

    private constructor() {
        this.linkedInAdsService = LinkedInAdsService.getInstance();
        this.linkedInOAuthService = LinkedInOAuthService.getInstance();
        this.syncHistoryService = SyncHistoryService.getInstance();
    }

    public static getInstance(): LinkedInAdsDriver {
        if (!LinkedInAdsDriver.instance) {
            LinkedInAdsDriver.instance = new LinkedInAdsDriver();
        }
        return LinkedInAdsDriver.instance;
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — authenticate
    // -------------------------------------------------------------------------

    public async authenticate(connectionDetails: IAPIConnectionDetails): Promise<boolean> {
        try {
            // Auto-refresh token if near expiry
            const refreshed = await this.linkedInOAuthService.ensureValidToken(connectionDetails);
            const valid = await this.linkedInAdsService.validateAccessToken(refreshed.oauth_access_token);
            if (valid) {
                console.log('✅ LinkedIn Ads authentication successful');
            }
            return valid;
        } catch (error) {
            console.error('❌ LinkedIn Ads authentication failed:', error);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — syncToDatabase
    // -------------------------------------------------------------------------

    public async syncToDatabase(
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        const startTime = Date.now();
        let totalSynced = 0;
        let totalFailed = 0;

        console.log('\x1b[1;34m');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`🔄 Starting LinkedIn Ads Sync — Data Source ID: ${dataSourceId}`);
        console.log('═══════════════════════════════════════════════════════\x1b[0m\n');

        const syncRecord = await this.syncHistoryService.createSyncRecord(dataSourceId);
        await this.syncHistoryService.markAsRunning(syncRecord.id);

        try {
            // Ensure token is valid (refresh if needed)
            connectionDetails = await this.linkedInOAuthService.ensureValidToken(connectionDetails);

            const adAccountId = connectionDetails.api_config?.linkedin_ads_account_id;
            if (!adAccountId) {
                throw new Error('LinkedIn Ads account ID not found in connection details');
            }

            const accessToken = connectionDetails.oauth_access_token;

            // Get database connection
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) throw new Error('PostgreSQL driver not available');
            const dbSource: DataSource = await driver.getConcreteDriver();
            const manager = dbSource.manager;

            // Ensure schema exists
            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${LinkedInAdsDriver.SCHEMA_NAME}`);

            // Build date range for analytics
            const { startDate: startDateIso, endDate: endDateIso } = resolveSyncWindow(connectionDetails.api_config);
            const startDate = this.isoToLinkedInDate(startDateIso);
            const endDate = this.isoToLinkedInDate(endDateIso);
            const dateRange: ILinkedInDateRange = { start: startDate, end: endDate };

            console.log('📊 Sync Configuration:');
            console.log(`   - Ad Account ID: ${adAccountId}`);
            console.log(`   - Schema: ${LinkedInAdsDriver.SCHEMA_NAME}`);
            console.log(
                `   - Date Range: ${this.linkedInDateToIso(startDate)} → ${this.linkedInDateToIso(endDate)}\n`
            );

            // ── Sync structural entities ──────────────────────────────────
            // Each step is independently fault-tolerant: a failure in one step
            // is logged as a warning and the sync continues, preserving any
            // records already written. Analytics steps are especially prone to
            // 404s in LinkedIn's Development Tier (sandbox) before the app is
            // approved for Production access.

            try {
                const accountsCount = await this.syncAdAccounts(
                    manager, dataSourceId, usersPlatformId, accessToken
                );
                totalSynced += accountsCount;
            } catch (err: any) {
                console.warn(`⚠️  [LinkedIn Ads] syncAdAccounts skipped: ${err.message}`);
                totalFailed++;
            }

            try {
                const groupsCount = await this.syncCampaignGroups(
                    manager, dataSourceId, usersPlatformId, accessToken, adAccountId
                );
                totalSynced += groupsCount;
            } catch (err: any) {
                console.warn(`⚠️  [LinkedIn Ads] syncCampaignGroups skipped: ${err.message}`);
                totalFailed++;
            }

            try {
                const campaignsCount = await this.syncCampaigns(
                    manager, dataSourceId, usersPlatformId, accessToken, adAccountId
                );
                totalSynced += campaignsCount;
            } catch (err: any) {
                console.warn(`⚠️  [LinkedIn Ads] syncCampaigns skipped: ${err.message}`);
                totalFailed++;
            }

            try {
                const creativesCount = await this.syncCreatives(
                    manager, dataSourceId, usersPlatformId, accessToken, adAccountId
                );
                totalSynced += creativesCount;
            } catch (err: any) {
                console.warn(`⚠️  [LinkedIn Ads] syncCreatives skipped: ${err.message}`);
                totalFailed++;
            }

            // ── Sync analytics ─────────────────────────────────────────────
            // NOTE: adAnalytics requires Production-tier API access.
            // In LinkedIn's Development Tier these calls return 404
            // "No virtual resource found". We log a warning and skip rather
            // than failing the entire sync so structural data is preserved.
            try {
                const campaignAnalyticsCount = await this.syncCampaignAnalytics(
                    manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange
                );
                totalSynced += campaignAnalyticsCount;
            } catch (err: any) {
                console.warn(`⚠️  [LinkedIn Ads] syncCampaignAnalytics skipped: ${err.message}`);
                if (err.message?.includes('404')) {
                    console.warn('   ℹ️  adAnalytics requires Production API access — not available in Development Tier');
                }
                totalFailed++;
            }

            // Creative-level (ad-level) analytics — powers the ad-group-style
            // breakdown in the campaign drill-down.
            try {
                const creativeAnalyticsCount = await this.syncCreativeAnalytics(
                    manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange
                );
                totalSynced += creativeAnalyticsCount;
            } catch (err: any) {
                console.warn(`⚠️  [LinkedIn Ads] syncCreativeAnalytics skipped: ${err.message}`);
                totalFailed++;
            }

            // Per-campaign dimension breakdowns (device, placement, and
            // professional demographics). Only campaigns with recorded
            // activity in the window are processed.
            try {
                const breakdownCount = await this.syncCampaignBreakdowns(
                    manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange
                );
                totalSynced += breakdownCount;
            } catch (err: any) {
                console.warn(`⚠️  [LinkedIn Ads] syncCampaignBreakdowns skipped: ${err.message}`);
                totalFailed++;
            }

            try {
                const accountAnalyticsCount = await this.syncAccountAnalytics(
                    manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange
                );
                totalSynced += accountAnalyticsCount;
            } catch (err: any) {
                console.warn(`⚠️  [LinkedIn Ads] syncAccountAnalytics skipped: ${err.message}`);
                totalFailed++;
            }

            // Record success
            await this.syncHistoryService.completeSyncRecord(syncRecord.id, totalSynced, totalFailed);

            const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log('\n═══════════════════════════════════════════════════════');
            console.log('✅ LinkedIn Ads Sync Completed Successfully');
            console.log(`   - Total Records: ${totalSynced}`);
            console.log(`   - Duration: ${durationSec}s`);
            console.log('═══════════════════════════════════════════════════════\n');

            return true;
        } catch (error: any) {
            console.error('\n❌ LinkedIn Ads Sync Failed:', error);
            await this.syncHistoryService.markAsFailed(syncRecord.id, error.message);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — getSchema
    // -------------------------------------------------------------------------

    public async getSchema(dataSourceId: number, _connectionDetails: IAPIConnectionDetails): Promise<any> {
        const tableMetadataService = TableMetadataService.getInstance();
        const schemaName = LinkedInAdsDriver.SCHEMA_NAME;

        const logicalTables = [
            'ad_accounts',
            'campaign_groups',
            'campaigns',
            'creatives',
            'campaign_analytics',
            'creative_analytics',
            'account_analytics',
            'device_insights',
            'placement_insights',
            'industry_insights',
            'seniority_insights',
            'job_function_insights',
            'country_insights',
        ];

        const tables = logicalTables.map(logicalName => ({
            schema: schemaName,
            table: tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName),
            logicalName,
            columns: this.getLogicalTableColumns(logicalName),
        }));

        return { schemaName, tables };
    }

    // -------------------------------------------------------------------------
    // IAPIDriver — sync history helpers
    // -------------------------------------------------------------------------

    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        const last = await this.syncHistoryService.getLastSync(dataSourceId);
        return last?.completedAt || null;
    }

    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        return this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }

    // =========================================================================
    // Private — entity sync methods
    // =========================================================================

    private async syncAdAccounts(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'ad_accounts';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createAdAccountsTable(manager, schema, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        const accounts = await this.linkedInAdsService.listAdAccounts(accessToken);
        if (accounts.length === 0) return 0;

        for (let i = 0; i < accounts.length; i += LinkedInAdsDriver.BATCH_SIZE) {
            const batch = accounts.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
            await this.batchUpsert(manager, schema, tableName, batch.map(a => this.transformAdAccount(a)), ['id']);
        }

        console.log(`✅ Synced ${accounts.length} ad account(s)`);
        return accounts.length;
    }

    private async syncCampaignGroups(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'campaign_groups';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createCampaignGroupsTable(manager, schema, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        const groups = await this.linkedInAdsService.getCampaignGroups(accessToken, adAccountId);
        if (groups.length === 0) return 0;

        for (let i = 0; i < groups.length; i += LinkedInAdsDriver.BATCH_SIZE) {
            const batch = groups.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
            await this.batchUpsert(manager, schema, tableName, batch.map(g => this.transformCampaignGroup(g)), ['id']);
        }

        console.log(`✅ Synced ${groups.length} campaign group(s)`);
        return groups.length;
    }

    private async syncCampaigns(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'campaigns';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createCampaignsTable(manager, schema, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        const campaigns = await this.linkedInAdsService.getCampaigns(accessToken, adAccountId);
        if (campaigns.length === 0) return 0;

        for (let i = 0; i < campaigns.length; i += LinkedInAdsDriver.BATCH_SIZE) {
            const batch = campaigns.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
            await this.batchUpsert(manager, schema, tableName, batch.map(c => this.transformCampaign(c)), ['id']);
        }

        console.log(`✅ Synced ${campaigns.length} campaign(s)`);
        return campaigns.length;
    }

    private async syncCreatives(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'creatives';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createCreativesTable(manager, schema, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        const creatives = await this.linkedInAdsService.getCreatives(accessToken, adAccountId);
        if (creatives.length === 0) return 0;

        for (let i = 0; i < creatives.length; i += LinkedInAdsDriver.BATCH_SIZE) {
            const batch = creatives.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
            await this.batchUpsert(manager, schema, tableName, batch.map(c => this.transformCreative(c)), ['id']);
        }

        console.log(`✅ Synced ${creatives.length} creative(s)`);
        return creatives.length;
    }

    private async syncCampaignAnalytics(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'campaign_analytics';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createAnalyticsTable(manager, schema, tableName, 'campaign_id');
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        // Campaign id -> name map for the campaign_id / campaign_name columns
        const campaignNames = await this.loadCampaignNames(manager, schema, dataSourceId);

        let totalRecords = 0;
        // Chunk the date range so large accounts stay under the 15,000-element
        // per-response cap (campaign × day rows grow quickly).
        for (const window of this.chunkDateRange(dateRange, 30)) {
            const records = await this.linkedInAdsService.getCampaignAnalytics(
                accessToken, adAccountId, window, 'DAILY'
            );
            if (records.length === 0) continue;

            for (let i = 0; i < records.length; i += LinkedInAdsDriver.BATCH_SIZE) {
                const batch = records.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
                await this.batchUpsert(
                    manager, schema, tableName,
                    batch.map(r => this.transformAnalytics(r, 'campaign', campaignNames)),
                    ['date_start', 'date_end', 'entity_id']
                );
            }
            totalRecords += records.length;
        }

        console.log(`✅ Synced ${totalRecords} campaign analytics record(s)`);
        return totalRecords;
    }

    private async syncAccountAnalytics(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'account_analytics';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createAnalyticsTable(manager, schema, tableName, 'account_id');
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        const records = await this.linkedInAdsService.getAccountAnalytics(
            accessToken, adAccountId, dateRange, 'MONTHLY'
        );
        if (records.length === 0) return 0;

        for (let i = 0; i < records.length; i += LinkedInAdsDriver.BATCH_SIZE) {
            const batch = records.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
            await this.batchUpsert(
                manager, schema, tableName,
                batch.map(r => this.transformAnalytics(r, 'account')),
                ['date_start', 'date_end', 'entity_id']
            );
        }

        console.log(`✅ Synced ${records.length} account analytics record(s)`);
        return records.length;
    }

    // -------------------------------------------------------------------------
    // Creative-level (ad-level) analytics
    // -------------------------------------------------------------------------

    private async syncCreativeAnalytics(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'creative_analytics';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createCreativeAnalyticsTable(manager, schema, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        // creative id -> campaign id (from the creatives table's campaign URN)
        const creativeToCampaign = await this.loadCreativeToCampaignMap(manager, schema, dataSourceId);
        const campaignNames = await this.loadCampaignNames(manager, schema, dataSourceId);

        let totalRecords = 0;
        for (const window of this.chunkDateRange(dateRange, 30)) {
            const records = await this.linkedInAdsService.getCreativeAnalytics(
                accessToken, adAccountId, window, 'DAILY'
            );
            if (records.length === 0) continue;

            for (let i = 0; i < records.length; i += LinkedInAdsDriver.BATCH_SIZE) {
                const batch = records.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
                await this.batchUpsert(
                    manager, schema, tableName,
                    batch.map(r => this.transformCreativeAnalytics(r, creativeToCampaign, campaignNames)),
                    ['date_start', 'date_end', 'creative_id']
                );
            }
            totalRecords += records.length;
        }

        console.log(`✅ Synced ${totalRecords} creative analytics record(s)`);
        return totalRecords;
    }

    // -------------------------------------------------------------------------
    // Per-campaign dimension breakdowns (device, placement, demographics)
    // -------------------------------------------------------------------------

    private async syncCampaignBreakdowns(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const schema = LinkedInAdsDriver.SCHEMA_NAME;
        const analyticsTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'campaign_analytics');
        const campaignsTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'campaigns');

        // Only sync breakdowns for campaigns that actually have recorded
        // activity in the window — this keeps the number of API calls bounded.
        let campaignIds: string[] = [];
        try {
            const rows: Array<{ campaign_id: string }> = await manager.query(
                `SELECT DISTINCT campaign_id FROM ${schema}.${analyticsTableName} WHERE campaign_id IS NOT NULL`
            );
            campaignIds = rows.map(r => String(r.campaign_id));
        } catch (err: any) {
            console.warn(`[LinkedIn Ads] breakdown campaign query failed: ${err.message}`);
        }

        if (campaignIds.length === 0) {
            try {
                const rows: Array<{ id: string }> = await manager.query(
                    `SELECT id::text AS id FROM ${schema}.${campaignsTableName}`
                );
                campaignIds = rows.map(r => String(r.id));
            } catch (err: any) {
                console.warn(`[LinkedIn Ads] breakdown campaign fallback failed: ${err.message}`);
            }
        }

        if (campaignIds.length === 0) {
            console.log('ℹ️  No campaigns with activity — skipping breakdown sync');
            return 0;
        }

        const campaignNames = await this.loadCampaignNames(manager, schema, dataSourceId);
        const numericIds = campaignIds
            .map(id => Number(id))
            .filter(n => !Number.isNaN(n) && n > 0);

        let total = 0;
        total += await this.syncDeviceInsights(
            manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange, numericIds, campaignNames
        );
        total += await this.syncPlacementInsights(
            manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange, numericIds, campaignNames
        );
        total += await this.syncDemographicInsights(
            manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange, numericIds, campaignNames
        );

        return total;
    }

    private async syncDeviceInsights(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange,
        campaignIds: number[],
        campaignNames: Map<string, string>
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'device_insights';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createDeviceInsightsTable(manager, schema, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        let totalRecords = 0;
        for (const campaignId of campaignIds) {
            for (const window of this.chunkDateRange(dateRange, 14)) {
                const records = await this.linkedInAdsService.getDeviceAnalytics(
                    accessToken, adAccountId, window, [campaignId], 'DAILY'
                );
                if (records.length === 0) continue;

                for (let i = 0; i < records.length; i += LinkedInAdsDriver.BATCH_SIZE) {
                    const batch = records.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
                    await this.batchUpsert(
                        manager, schema, tableName,
                        batch.map(r => this.transformDeviceInsight(r, campaignId, campaignNames)),
                        ['date_start', 'date_end', 'campaign_id', 'device']
                    );
                }
                totalRecords += records.length;
            }
        }

        console.log(`✅ Synced ${totalRecords} device insight record(s)`);
        return totalRecords;
    }

    private async syncPlacementInsights(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange,
        campaignIds: number[],
        campaignNames: Map<string, string>
    ): Promise<number> {
        const tableMetadataService = TableMetadataService.getInstance();
        const logicalName = 'placement_insights';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        await this.createPlacementInsightsTable(manager, schema, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: schema,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'linkedin_ads',
        });

        let totalRecords = 0;
        for (const campaignId of campaignIds) {
            for (const window of this.chunkDateRange(dateRange, 14)) {
                const records = await this.linkedInAdsService.getPlacementAnalytics(
                    accessToken, adAccountId, window, [campaignId], 'DAILY'
                );
                if (records.length === 0) continue;

                for (let i = 0; i < records.length; i += LinkedInAdsDriver.BATCH_SIZE) {
                    const batch = records.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
                    await this.batchUpsert(
                        manager, schema, tableName,
                        batch.map(r => this.transformPlacementInsight(r, campaignId, campaignNames)),
                        ['date_start', 'date_end', 'campaign_id', 'placement']
                    );
                }
                totalRecords += records.length;
            }
        }

        console.log(`✅ Synced ${totalRecords} placement insight record(s)`);
        return totalRecords;
    }

    private async syncDemographicInsights(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange,
        campaignIds: number[],
        campaignNames: Map<string, string>
    ): Promise<number> {
        // MEMBER_* pivots must be requested individually (Analytics Finder,
        // single pivot), so each demographic has its own logical table whose
        // value column maps to a drill-down dimension.
        const pivotConfigs: Array<{ pivot: TLinkedInAnalyticsPivot; logicalName: string; valueColumn: string }> = [
            { pivot: 'MEMBER_INDUSTRY', logicalName: 'industry_insights', valueColumn: 'industry' },
            { pivot: 'MEMBER_SENIORITY', logicalName: 'seniority_insights', valueColumn: 'seniority' },
            { pivot: 'MEMBER_JOB_FUNCTION', logicalName: 'job_function_insights', valueColumn: 'job_function' },
            { pivot: 'MEMBER_COUNTRY_V2', logicalName: 'country_insights', valueColumn: 'country' },
        ];

        const tableMetadataService = TableMetadataService.getInstance();
        const schema = LinkedInAdsDriver.SCHEMA_NAME;

        // Create all demographic tables up-front
        for (const cfg of pivotConfigs) {
            const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, cfg.logicalName);
            await this.createDemographicTable(manager, schema, tableName, cfg.valueColumn);
            await tableMetadataService.storeTableMetadata(manager, {
                dataSourceId,
                usersPlatformId,
                schemaName: schema,
                physicalTableName: tableName,
                logicalTableName: cfg.logicalName,
                originalSheetName: cfg.logicalName,
                tableType: 'linkedin_ads',
            });
        }

        // Fetch records (one request per campaign × pivot × date window) and
        // collect the pivot URNs so they can be resolved to readable names once.
        const urnSet = new Set<string>();
        const fetchPlan: Array<{
            cfg: { pivot: TLinkedInAnalyticsPivot; logicalName: string; valueColumn: string };
            campaignId: number;
            records: ILinkedInAnalyticsRecord[];
        }> = [];

        for (const cfg of pivotConfigs) {
            for (const campaignId of campaignIds) {
                for (const window of this.chunkDateRange(dateRange, 14)) {
                    const records = await this.linkedInAdsService.getDemographicAnalytics(
                        accessToken, adAccountId, window, cfg.pivot, [campaignId], 'DAILY'
                    );
                    if (records.length === 0) continue;

                    fetchPlan.push({ cfg, campaignId, records });
                    for (const r of records) {
                        const v = r.pivotValues?.[0];
                        if (v && v.includes(':') && !urnSet.has(v)) urnSet.add(v);
                    }
                }
            }
        }

        if (fetchPlan.length === 0) {
            console.log('ℹ️  No demographic analytics returned — skipping demographic tables');
            return 0;
        }

        const nameMap = await this.linkedInAdsService.resolveTargetingEntityNames(
            accessToken, Array.from(urnSet)
        );

        let totalRecords = 0;
        for (const { cfg, campaignId, records } of fetchPlan) {
            const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, cfg.logicalName);
            for (let i = 0; i < records.length; i += LinkedInAdsDriver.BATCH_SIZE) {
                const batch = records.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
                await this.batchUpsert(
                    manager, schema, tableName,
                    batch.map(r => this.transformDemographicInsight(r, campaignId, campaignNames, cfg.valueColumn, nameMap)),
                    ['date_start', 'date_end', 'campaign_id', cfg.valueColumn]
                );
            }
            totalRecords += records.length;
        }

        console.log(`✅ Synced ${totalRecords} demographic insight record(s)`);
        return totalRecords;
    }

    // =========================================================================
    // Private — data transformers
    // =========================================================================

    private transformAdAccount(a: ILinkedInAdAccount): Record<string, unknown> {
        return {
            id: a.id,
            name: a.name,
            type: a.type,
            status: a.status,
            currency: a.currency,
            is_test: a.test,
            serving_statuses: JSON.stringify(a.servingStatuses || []),
            reference: a.reference || null,
            synced_at: new Date(),
        };
    }

    private transformCampaignGroup(g: ILinkedInCampaignGroup): Record<string, unknown> {
        return {
            id: g.id,
            name: g.name,
            account: g.account,
            status: g.status,
            total_budget_amount: g.totalBudget?.amount ? parseFloat(g.totalBudget.amount) : null,
            total_budget_currency: g.totalBudget?.currencyCode || null,
            run_schedule_start: g.runSchedule?.start ? new Date(g.runSchedule.start) : null,
            run_schedule_end: g.runSchedule?.end ? new Date(g.runSchedule.end) : null,
            is_test: g.test,
            created_at: g.changeAuditStamps?.created?.time ? new Date(g.changeAuditStamps.created.time) : null,
            last_modified_at: g.changeAuditStamps?.lastModified?.time
                ? new Date(g.changeAuditStamps.lastModified.time)
                : null,
            synced_at: new Date(),
        };
    }

    private transformCampaign(c: ILinkedInCampaign): Record<string, unknown> {
        return {
            id: c.id,
            name: c.name,
            account: c.account,
            campaign_group: c.campaignGroup || null,
            status: c.status,
            type: c.type,
            cost_type: c.costType || null,
            objective_type: c.objectiveType || null,
            daily_budget_amount: c.dailyBudget?.amount ? parseFloat(c.dailyBudget.amount) : null,
            daily_budget_currency: c.dailyBudget?.currencyCode || null,
            total_budget_amount: c.totalBudget?.amount ? parseFloat(c.totalBudget.amount) : null,
            total_budget_currency: c.totalBudget?.currencyCode || null,
            unit_cost_amount: c.unitCost?.amount ? parseFloat(c.unitCost.amount) : null,
            unit_cost_currency: c.unitCost?.currencyCode || null,
            is_test: c.test,
            created_at: c.changeAuditStamps?.created?.time ? new Date(c.changeAuditStamps.created.time) : null,
            last_modified_at: c.changeAuditStamps?.lastModified?.time
                ? new Date(c.changeAuditStamps.lastModified.time)
                : null,
            synced_at: new Date(),
        };
    }

    private transformCreative(c: ILinkedInCreative): Record<string, unknown> {
        return {
            id: c.id,
            campaign: c.campaign,
            account: c.account || null,
            status: c.status,
            intended_status: c.intendedStatus || null,
            serving_hold_reasons: JSON.stringify(c.servingHoldReasons || []),
            is_test: c.test,
            created_at: c.changeAuditStamps?.created?.time ? new Date(c.changeAuditStamps.created.time) : null,
            last_modified_at: c.changeAuditStamps?.lastModified?.time
                ? new Date(c.changeAuditStamps.lastModified.time)
                : null,
            synced_at: new Date(),
        };
    }

    private transformAnalytics(
        r: ILinkedInAnalyticsRecord,
        entityType: string,
        campaignNames?: Map<string, string>
    ): Record<string, unknown> {
        // Extract pivot value (first URN in pivotValues array) and strip URN prefix
        const rawPivotValue = r.pivotValues?.[0] || '';
        const entityId = rawPivotValue.includes(':') ? rawPivotValue.split(':').pop() || null : rawPivotValue || null;

        // Convert structured dateRange to ISO date strings
        const dateStart = this.linkedInDateToIso(r.dateRange.start);
        const dateEnd = r.dateRange.end ? this.linkedInDateToIso(r.dateRange.end) : dateStart;

        const isCampaign = entityType === 'campaign';
        const campaignId = isCampaign ? entityId : null;

        return {
            date_start: dateStart,
            date_end: dateEnd,
            entity_type: entityType,
            entity_id: entityId,
            campaign_id: campaignId,
            campaign_name: campaignId && campaignNames?.has(campaignId) ? campaignNames.get(campaignId) : null,
            impressions: r.impressions || 0,
            clicks: r.clicks || 0,
            cost_usd: r.costInUsd ? parseFloat(r.costInUsd) : null,
            cost_local: r.costInLocalCurrency ? parseFloat(r.costInLocalCurrency) : null,
            external_conversions: r.externalWebsiteConversions || 0,
            post_click_conversions: r.externalWebsitePostClickConversions || 0,
            post_view_conversions: r.externalWebsitePostViewConversions || 0,
            one_click_leads: r.oneClickLeads || 0,
            video_views: r.videoViews || 0,
            video_completions: r.videoCompletions || 0,
            video_watch_time_ms: r.videoWatchTime || 0,
            total_engagements: r.totalEngagements || 0,
            landing_page_clicks: r.landingPageClicks || 0,
            follows: r.follows || 0,
            likes: r.likes || 0,
            comments: r.comments || 0,
            shares: r.shares || 0,
            approximate_reach: r.approximateMemberReach || null,
            conversion_value: r.conversionValueInLocalCurrency ? parseFloat(r.conversionValueInLocalCurrency) : null,
            synced_at: new Date(),
        };
    }

    /**
     * Load a campaign id -> name map from the physical campaigns table.
     */
    private async loadCampaignNames(manager: any, schema: string, dataSourceId: number): Promise<Map<string, string>> {
        const tableMetadataService = TableMetadataService.getInstance();
        const campaignsTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'campaigns');
        const map = new Map<string, string>();
        try {
            const rows: Array<{ id: string; name: string }> = await manager.query(
                `SELECT id::text AS id, name FROM ${schema}.${campaignsTableName}`
            );
            for (const row of rows) map.set(row.id, row.name);
        } catch (err: any) {
            console.warn(`[LinkedIn Ads] loadCampaignNames failed: ${err.message}`);
        }
        return map;
    }

    /**
     * Load a creative id -> campaign id map from the physical creatives table.
     * The creatives table's `campaign` column holds a sponsoredCampaign URN.
     */
    private async loadCreativeToCampaignMap(manager: any, schema: string, dataSourceId: number): Promise<Map<string, string>> {
        const tableMetadataService = TableMetadataService.getInstance();
        const creativesTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'creatives');
        const map = new Map<string, string>();
        try {
            const rows: Array<{ id: string; campaign: string }> = await manager.query(
                `SELECT id::text AS id, campaign FROM ${schema}.${creativesTableName}`
            );
            for (const row of rows) {
                if (!row.campaign) continue;
                const campaignId = String(row.campaign).split(':').pop();
                if (campaignId) map.set(row.id, campaignId);
            }
        } catch (err: any) {
            console.warn(`[LinkedIn Ads] loadCreativeToCampaignMap failed: ${err.message}`);
        }
        return map;
    }

    /**
     * Strip the URN prefix from a pivot value (e.g. urn:li:industry:4 -> 4),
     * or return the value as-is when it isn't a URN (e.g. enum like DESKTOP).
     */
    private cleanPivotValue(raw?: string): string | null {
        if (!raw) return null;
        if (raw.includes(':')) return raw.split(':').pop() || raw;
        return raw;
    }

    /**
     * Transform a creative-level analytics record.
     * LinkedIn creatives (ads) have no name field, so creative_name is null.
     */
    private transformCreativeAnalytics(
        r: ILinkedInAnalyticsRecord,
        creativeToCampaign: Map<string, string>,
        campaignNames: Map<string, string>
    ): Record<string, unknown> {
        const creativeId = this.cleanPivotValue(r.pivotValues?.[0]);
        const campaignId = creativeId ? creativeToCampaign.get(creativeId) || null : null;
        const dateStart = this.linkedInDateToIso(r.dateRange.start);
        const dateEnd = r.dateRange.end ? this.linkedInDateToIso(r.dateRange.end) : dateStart;

        return {
            date_start: dateStart,
            date_end: dateEnd,
            campaign_id: campaignId,
            campaign_name: campaignId && campaignNames.has(campaignId) ? campaignNames.get(campaignId) : null,
            creative_id: creativeId,
            // LinkedIn creatives have no name field; fall back to the id so the
            // ad-level dimension breakdown has a usable label.
            creative_name: creativeId,
            impressions: r.impressions || 0,
            clicks: r.clicks || 0,
            cost_usd: r.costInUsd ? parseFloat(r.costInUsd) : null,
            cost_local: r.costInLocalCurrency ? parseFloat(r.costInLocalCurrency) : null,
            external_conversions: r.externalWebsiteConversions || 0,
            post_click_conversions: r.externalWebsitePostClickConversions || 0,
            post_view_conversions: r.externalWebsitePostViewConversions || 0,
            one_click_leads: r.oneClickLeads || 0,
            video_views: r.videoViews || 0,
            video_completions: r.videoCompletions || 0,
            video_watch_time_ms: r.videoWatchTime || 0,
            total_engagements: r.totalEngagements || 0,
            landing_page_clicks: r.landingPageClicks || 0,
            comments: r.comments || 0,
            shares: r.shares || 0,
            conversion_value: r.conversionValueInLocalCurrency ? parseFloat(r.conversionValueInLocalCurrency) : null,
            synced_at: new Date(),
        };
    }

    /**
     * Transform a device breakdown record (IMPRESSION_DEVICE_TYPE pivot).
     * Device rows carry no conversion metrics (LinkedIn API restriction).
     */
    private transformDeviceInsight(
        r: ILinkedInAnalyticsRecord,
        campaignId: number,
        campaignNames: Map<string, string>
    ): Record<string, unknown> {
        const device = this.cleanPivotValue(r.pivotValues?.[0]);
        const dateStart = this.linkedInDateToIso(r.dateRange.start);
        const dateEnd = r.dateRange.end ? this.linkedInDateToIso(r.dateRange.end) : dateStart;
        const cid = String(campaignId);

        return {
            date_start: dateStart,
            date_end: dateEnd,
            campaign_id: cid,
            campaign_name: campaignNames.get(cid) || null,
            device,
            impressions: r.impressions || 0,
            clicks: r.clicks || 0,
            cost_usd: r.costInUsd ? parseFloat(r.costInUsd) : null,
            cost_local: r.costInLocalCurrency ? parseFloat(r.costInLocalCurrency) : null,
            video_views: r.videoViews || 0,
            video_completions: r.videoCompletions || 0,
            video_watch_time_ms: r.videoWatchTime || 0,
            total_engagements: r.totalEngagements || 0,
            landing_page_clicks: r.landingPageClicks || 0,
            comments: r.comments || 0,
            shares: r.shares || 0,
            synced_at: new Date(),
        };
    }

    /**
     * Transform a placement breakdown record (PLACEMENT_NAME pivot).
     */
    private transformPlacementInsight(
        r: ILinkedInAnalyticsRecord,
        campaignId: number,
        campaignNames: Map<string, string>
    ): Record<string, unknown> {
        const placement = this.cleanPivotValue(r.pivotValues?.[0]);
        const dateStart = this.linkedInDateToIso(r.dateRange.start);
        const dateEnd = r.dateRange.end ? this.linkedInDateToIso(r.dateRange.end) : dateStart;
        const cid = String(campaignId);

        return {
            date_start: dateStart,
            date_end: dateEnd,
            campaign_id: cid,
            campaign_name: campaignNames.get(cid) || null,
            placement,
            impressions: r.impressions || 0,
            clicks: r.clicks || 0,
            cost_usd: r.costInUsd ? parseFloat(r.costInUsd) : null,
            cost_local: r.costInLocalCurrency ? parseFloat(r.costInLocalCurrency) : null,
            external_conversions: r.externalWebsiteConversions || 0,
            post_click_conversions: r.externalWebsitePostClickConversions || 0,
            post_view_conversions: r.externalWebsitePostViewConversions || 0,
            one_click_leads: r.oneClickLeads || 0,
            video_views: r.videoViews || 0,
            total_engagements: r.totalEngagements || 0,
            landing_page_clicks: r.landingPageClicks || 0,
            comments: r.comments || 0,
            shares: r.shares || 0,
            conversion_value: r.conversionValueInLocalCurrency ? parseFloat(r.conversionValueInLocalCurrency) : null,
            synced_at: new Date(),
        };
    }

    /**
     * Transform a demographic breakdown record (single MEMBER_* pivot).
     * Pivot URNs are resolved to readable names when possible.
     */
    private transformDemographicInsight(
        r: ILinkedInAnalyticsRecord,
        campaignId: number,
        campaignNames: Map<string, string>,
        valueColumn: string,
        nameMap: Map<string, string>
    ): Record<string, unknown> {
        const rawValue = r.pivotValues?.[0] || null;
        const value = rawValue && nameMap.has(rawValue) ? nameMap.get(rawValue) : this.cleanPivotValue(rawValue);
        const dateStart = this.linkedInDateToIso(r.dateRange.start);
        const dateEnd = r.dateRange.end ? this.linkedInDateToIso(r.dateRange.end) : dateStart;
        const cid = String(campaignId);

        return {
            date_start: dateStart,
            date_end: dateEnd,
            campaign_id: cid,
            campaign_name: campaignNames.get(cid) || null,
            [valueColumn]: value,
            impressions: r.impressions || 0,
            clicks: r.clicks || 0,
            cost_usd: r.costInUsd ? parseFloat(r.costInUsd) : null,
            cost_local: r.costInLocalCurrency ? parseFloat(r.costInLocalCurrency) : null,
            external_conversions: r.externalWebsiteConversions || 0,
            one_click_leads: r.oneClickLeads || 0,
            video_views: r.videoViews || 0,
            total_engagements: r.totalEngagements || 0,
            synced_at: new Date(),
        };
    }

    // =========================================================================
    // Private — DDL helpers
    // =========================================================================

    private async createAdAccountsTable(manager: any, schema: string, tableName: string): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGINT PRIMARY KEY,
                name VARCHAR(255),
                type VARCHAR(20),
                status VARCHAR(30),
                currency VARCHAR(10),
                is_test BOOLEAN,
                serving_statuses JSONB,
                reference VARCHAR(100),
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${t}(status)`);
    }

    private async createCampaignGroupsTable(manager: any, schema: string, tableName: string): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGINT PRIMARY KEY,
                name VARCHAR(255),
                account VARCHAR(100),
                status VARCHAR(30),
                total_budget_amount DECIMAL(14,2),
                total_budget_currency VARCHAR(10),
                run_schedule_start TIMESTAMP,
                run_schedule_end TIMESTAMP,
                is_test BOOLEAN,
                created_at TIMESTAMP,
                last_modified_at TIMESTAMP,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_account ON ${t}(account)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${t}(status)`);
    }

    private async createCampaignsTable(manager: any, schema: string, tableName: string): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGINT PRIMARY KEY,
                name VARCHAR(255),
                account VARCHAR(100),
                campaign_group VARCHAR(100),
                status VARCHAR(30),
                type VARCHAR(50),
                cost_type VARCHAR(10),
                objective_type VARCHAR(60),
                daily_budget_amount DECIMAL(14,2),
                daily_budget_currency VARCHAR(10),
                total_budget_amount DECIMAL(14,2),
                total_budget_currency VARCHAR(10),
                unit_cost_amount DECIMAL(14,4),
                unit_cost_currency VARCHAR(10),
                is_test BOOLEAN,
                created_at TIMESTAMP,
                last_modified_at TIMESTAMP,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_account ON ${t}(account)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${t}(status)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_group ON ${t}(campaign_group)`);
    }

    private async createCreativesTable(manager: any, schema: string, tableName: string): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGINT PRIMARY KEY,
                campaign VARCHAR(100),
                account VARCHAR(100),
                status VARCHAR(30),
                intended_status VARCHAR(30),
                serving_hold_reasons JSONB,
                is_test BOOLEAN,
                created_at TIMESTAMP,
                last_modified_at TIMESTAMP,
                synced_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${t}(campaign)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${t}(status)`);
    }

    /**
     * Create a generic analytics table. The entityPivotColumn param names the
     * logical column (e.g. 'campaign_id' or 'account_id') — it's always stored
     * as entity_id to keep the schema uniform. campaign_id / campaign_name /
     * conversion_value columns are added for campaign-level tables (and are
     * simply null for account-level rows).
     */
    private async createAnalyticsTable(
        manager: any,
        schema: string,
        tableName: string,
        _entityPivotColumn: string
    ): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGSERIAL PRIMARY KEY,
                date_start DATE NOT NULL,
                date_end DATE NOT NULL,
                entity_type VARCHAR(20),
                entity_id VARCHAR(50),
                campaign_id VARCHAR(50),
                campaign_name VARCHAR(255),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost_usd DECIMAL(14,4),
                cost_local DECIMAL(14,4),
                external_conversions BIGINT DEFAULT 0,
                post_click_conversions BIGINT DEFAULT 0,
                post_view_conversions BIGINT DEFAULT 0,
                one_click_leads BIGINT DEFAULT 0,
                video_views BIGINT DEFAULT 0,
                video_completions BIGINT DEFAULT 0,
                video_watch_time_ms BIGINT DEFAULT 0,
                total_engagements BIGINT DEFAULT 0,
                landing_page_clicks BIGINT DEFAULT 0,
                follows BIGINT DEFAULT 0,
                likes BIGINT DEFAULT 0,
                comments BIGINT DEFAULT 0,
                shares BIGINT DEFAULT 0,
                approximate_reach BIGINT,
                conversion_value DECIMAL(14,4),
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (date_start, date_end, entity_id)
            )
        `);
        // Backfill the new columns on tables created before this change.
        await this.ensureColumn(manager, t, 'campaign_id', 'VARCHAR(50)');
        await this.ensureColumn(manager, t, 'campaign_name', 'VARCHAR(255)');
        await this.ensureColumn(manager, t, 'conversion_value', 'DECIMAL(14,4)');
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_entity ON ${t}(entity_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${t}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${t}(date_start, date_end)`);
    }

    /**
     * Add a column to an existing table when it's missing (PostgreSQL).
     */
    private async ensureColumn(manager: any, table: string, column: string, dataType: string): Promise<void> {
        try {
            await manager.query(
                `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${dataType}`
            );
        } catch (err: any) {
            console.warn(`[LinkedIn Ads] ensureColumn(${column}) failed: ${err.message}`);
        }
    }

    /**
     * Creative (ad) level analytics table. creative_id is the ad-level
     * dimension used by the drill-down ad-group-style breakdown.
     */
    private async createCreativeAnalyticsTable(manager: any, schema: string, tableName: string): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGSERIAL PRIMARY KEY,
                date_start DATE NOT NULL,
                date_end DATE NOT NULL,
                campaign_id VARCHAR(50),
                campaign_name VARCHAR(255),
                creative_id VARCHAR(50),
                creative_name VARCHAR(255),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost_usd DECIMAL(14,4),
                cost_local DECIMAL(14,4),
                external_conversions BIGINT DEFAULT 0,
                post_click_conversions BIGINT DEFAULT 0,
                post_view_conversions BIGINT DEFAULT 0,
                one_click_leads BIGINT DEFAULT 0,
                video_views BIGINT DEFAULT 0,
                video_completions BIGINT DEFAULT 0,
                video_watch_time_ms BIGINT DEFAULT 0,
                total_engagements BIGINT DEFAULT 0,
                landing_page_clicks BIGINT DEFAULT 0,
                comments BIGINT DEFAULT 0,
                shares BIGINT DEFAULT 0,
                conversion_value DECIMAL(14,4),
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (date_start, date_end, creative_id)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${t}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_creative ON ${t}(creative_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${t}(date_start, date_end)`);
    }

    /**
     * Device-type breakdown table (IMPRESSION_DEVICE_TYPE pivot).
     */
    private async createDeviceInsightsTable(manager: any, schema: string, tableName: string): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGSERIAL PRIMARY KEY,
                date_start DATE NOT NULL,
                date_end DATE NOT NULL,
                campaign_id VARCHAR(50),
                campaign_name VARCHAR(255),
                device VARCHAR(50),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost_usd DECIMAL(14,4),
                cost_local DECIMAL(14,4),
                video_views BIGINT DEFAULT 0,
                video_completions BIGINT DEFAULT 0,
                video_watch_time_ms BIGINT DEFAULT 0,
                total_engagements BIGINT DEFAULT 0,
                landing_page_clicks BIGINT DEFAULT 0,
                comments BIGINT DEFAULT 0,
                shares BIGINT DEFAULT 0,
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (date_start, date_end, campaign_id, device)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${t}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${t}(date_start, date_end)`);
    }

    /**
     * Placement breakdown table (PLACEMENT_NAME pivot).
     */
    private async createPlacementInsightsTable(manager: any, schema: string, tableName: string): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGSERIAL PRIMARY KEY,
                date_start DATE NOT NULL,
                date_end DATE NOT NULL,
                campaign_id VARCHAR(50),
                campaign_name VARCHAR(255),
                placement VARCHAR(50),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost_usd DECIMAL(14,4),
                cost_local DECIMAL(14,4),
                external_conversions BIGINT DEFAULT 0,
                post_click_conversions BIGINT DEFAULT 0,
                post_view_conversions BIGINT DEFAULT 0,
                one_click_leads BIGINT DEFAULT 0,
                video_views BIGINT DEFAULT 0,
                total_engagements BIGINT DEFAULT 0,
                landing_page_clicks BIGINT DEFAULT 0,
                comments BIGINT DEFAULT 0,
                shares BIGINT DEFAULT 0,
                conversion_value DECIMAL(14,4),
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (date_start, date_end, campaign_id, placement)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${t}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${t}(date_start, date_end)`);
    }

    /**
     * Demographic breakdown table. Each MEMBER_* pivot gets its own logical
     * table with a value column named after the demographic
     * (industry / seniority / job_function / country).
     */
    private async createDemographicTable(manager: any, schema: string, tableName: string, valueColumn: string): Promise<void> {
        const t = `${schema}.${tableName}`;
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${t} (
                id BIGSERIAL PRIMARY KEY,
                date_start DATE NOT NULL,
                date_end DATE NOT NULL,
                campaign_id VARCHAR(50),
                campaign_name VARCHAR(255),
                ${valueColumn} VARCHAR(255),
                impressions BIGINT DEFAULT 0,
                clicks BIGINT DEFAULT 0,
                cost_usd DECIMAL(14,4),
                cost_local DECIMAL(14,4),
                external_conversions BIGINT DEFAULT 0,
                one_click_leads BIGINT DEFAULT 0,
                video_views BIGINT DEFAULT 0,
                total_engagements BIGINT DEFAULT 0,
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (date_start, date_end, campaign_id, ${valueColumn})
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${t}(campaign_id)`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_value ON ${t}(${valueColumn})`);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${t}(date_start, date_end)`);
    }

    // =========================================================================
    // Private — batch upsert
    // =========================================================================

    private async batchUpsert(
        manager: any,
        schema: string,
        tableName: string,
        records: Record<string, unknown>[],
        conflictKeys: string[]
    ): Promise<void> {
        if (records.length === 0) return;

        const fullTable = `${schema}.${tableName}`;
        const columns = Object.keys(records[0]);
        const conflictClause = conflictKeys.join(', ');

        const updateClause = columns
            .filter(col => !conflictKeys.includes(col))
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(', ');

        const valuesPlaceholder = records.map((_, idx) => {
            const offset = idx * columns.length;
            const phs = columns.map((__, ci) => `$${offset + ci + 1}`).join(', ');
            return `(${phs})`;
        }).join(', ');

        const values = records.flatMap(rec => columns.map(col => rec[col]));

        await manager.query(
            `INSERT INTO ${fullTable} (${columns.join(', ')})
             VALUES ${valuesPlaceholder}
             ON CONFLICT (${conflictClause})
             DO UPDATE SET ${updateClause}`,
            values
        );
    }

    // =========================================================================
    // Private — date helpers
    // =========================================================================

    /** Parse "YYYY-MM-DD" into a structured ILinkedInDate. */
    private isoToLinkedInDate(iso: string): ILinkedInDate {
        const [y, m, d] = iso.split('-').map(Number);
        return { year: y, month: m, day: d };
    }

    /** Format ILinkedInDate back to "YYYY-MM-DD" for display/storage. */
    private linkedInDateToIso(d: ILinkedInDate): string {
        return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
    }

    /** Format a JS Date as "YYYY-MM-DD". */
    private formatDate(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * Split an analytics date range into consecutive windows of at most
     * maxDays days each. adAnalytics caps responses at 15,000 elements with
     * no pagination, so large windows are chunked to stay under the cap.
     */
    private chunkDateRange(dateRange: ILinkedInDateRange, maxDays: number): ILinkedInDateRange[] {
        const start = new Date(this.linkedInDateToIso(dateRange.start));
        const end = dateRange.end ? new Date(this.linkedInDateToIso(dateRange.end)) : new Date();
        if (end < start) return [];

        const windows: ILinkedInDateRange[] = [];
        let cursor = new Date(start);

        while (cursor <= end) {
            const windowEnd = new Date(cursor);
            windowEnd.setDate(windowEnd.getDate() + maxDays - 1);
            const boundedEnd = windowEnd > end ? new Date(end) : windowEnd;

            windows.push({
                start: this.isoToLinkedInDate(this.formatDate(cursor)),
                end: this.isoToLinkedInDate(this.formatDate(boundedEnd)),
            });

            cursor = new Date(boundedEnd);
            cursor.setDate(cursor.getDate() + 1);
        }

        return windows;
    }

    // =========================================================================
    // Private — schema column descriptors (for getSchema)
    // =========================================================================

    private getLogicalTableColumns(logicalName: string): any[] {
        switch (logicalName) {
            case 'ad_accounts':
                return [
                    { name: 'id', type: 'BIGINT', nullable: false },
                    { name: 'name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'type', type: 'VARCHAR(20)', nullable: true },
                    { name: 'status', type: 'VARCHAR(30)', nullable: true },
                    { name: 'currency', type: 'VARCHAR(10)', nullable: true },
                    { name: 'is_test', type: 'BOOLEAN', nullable: true },
                    { name: 'serving_statuses', type: 'JSONB', nullable: true },
                    { name: 'reference', type: 'VARCHAR(100)', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'campaign_groups':
                return [
                    { name: 'id', type: 'BIGINT', nullable: false },
                    { name: 'name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'account', type: 'VARCHAR(100)', nullable: true },
                    { name: 'status', type: 'VARCHAR(30)', nullable: true },
                    { name: 'total_budget_amount', type: 'DECIMAL(14,2)', nullable: true },
                    { name: 'total_budget_currency', type: 'VARCHAR(10)', nullable: true },
                    { name: 'run_schedule_start', type: 'TIMESTAMP', nullable: true },
                    { name: 'run_schedule_end', type: 'TIMESTAMP', nullable: true },
                    { name: 'is_test', type: 'BOOLEAN', nullable: true },
                    { name: 'created_at', type: 'TIMESTAMP', nullable: true },
                    { name: 'last_modified_at', type: 'TIMESTAMP', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'campaigns':
                return [
                    { name: 'id', type: 'BIGINT', nullable: false },
                    { name: 'name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'account', type: 'VARCHAR(100)', nullable: true },
                    { name: 'campaign_group', type: 'VARCHAR(100)', nullable: true },
                    { name: 'status', type: 'VARCHAR(30)', nullable: true },
                    { name: 'type', type: 'VARCHAR(50)', nullable: true },
                    { name: 'cost_type', type: 'VARCHAR(10)', nullable: true },
                    { name: 'objective_type', type: 'VARCHAR(60)', nullable: true },
                    { name: 'daily_budget_amount', type: 'DECIMAL(14,2)', nullable: true },
                    { name: 'daily_budget_currency', type: 'VARCHAR(10)', nullable: true },
                    { name: 'total_budget_amount', type: 'DECIMAL(14,2)', nullable: true },
                    { name: 'total_budget_currency', type: 'VARCHAR(10)', nullable: true },
                    { name: 'unit_cost_amount', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'unit_cost_currency', type: 'VARCHAR(10)', nullable: true },
                    { name: 'is_test', type: 'BOOLEAN', nullable: true },
                    { name: 'created_at', type: 'TIMESTAMP', nullable: true },
                    { name: 'last_modified_at', type: 'TIMESTAMP', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'creatives':
                return [
                    { name: 'id', type: 'BIGINT', nullable: false },
                    { name: 'campaign', type: 'VARCHAR(100)', nullable: true },
                    { name: 'account', type: 'VARCHAR(100)', nullable: true },
                    { name: 'status', type: 'VARCHAR(30)', nullable: true },
                    { name: 'intended_status', type: 'VARCHAR(30)', nullable: true },
                    { name: 'serving_hold_reasons', type: 'JSONB', nullable: true },
                    { name: 'is_test', type: 'BOOLEAN', nullable: true },
                    { name: 'created_at', type: 'TIMESTAMP', nullable: true },
                    { name: 'last_modified_at', type: 'TIMESTAMP', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'campaign_analytics':
                return [
                    { name: 'id', type: 'BIGSERIAL', nullable: false },
                    { name: 'date_start', type: 'DATE', nullable: false },
                    { name: 'date_end', type: 'DATE', nullable: false },
                    { name: 'entity_type', type: 'VARCHAR(20)', nullable: true },
                    { name: 'entity_id', type: 'VARCHAR(50)', nullable: true },
                    { name: 'campaign_id', type: 'VARCHAR(50)', nullable: true },
                    { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'impressions', type: 'BIGINT', nullable: true },
                    { name: 'clicks', type: 'BIGINT', nullable: true },
                    { name: 'cost_usd', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'cost_local', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'external_conversions', type: 'BIGINT', nullable: true },
                    { name: 'post_click_conversions', type: 'BIGINT', nullable: true },
                    { name: 'post_view_conversions', type: 'BIGINT', nullable: true },
                    { name: 'one_click_leads', type: 'BIGINT', nullable: true },
                    { name: 'video_views', type: 'BIGINT', nullable: true },
                    { name: 'video_completions', type: 'BIGINT', nullable: true },
                    { name: 'video_watch_time_ms', type: 'BIGINT', nullable: true },
                    { name: 'total_engagements', type: 'BIGINT', nullable: true },
                    { name: 'landing_page_clicks', type: 'BIGINT', nullable: true },
                    { name: 'follows', type: 'BIGINT', nullable: true },
                    { name: 'likes', type: 'BIGINT', nullable: true },
                    { name: 'comments', type: 'BIGINT', nullable: true },
                    { name: 'shares', type: 'BIGINT', nullable: true },
                    { name: 'approximate_reach', type: 'BIGINT', nullable: true },
                    { name: 'conversion_value', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'account_analytics':
                return [
                    { name: 'id', type: 'BIGSERIAL', nullable: false },
                    { name: 'date_start', type: 'DATE', nullable: false },
                    { name: 'date_end', type: 'DATE', nullable: false },
                    { name: 'entity_type', type: 'VARCHAR(20)', nullable: true },
                    { name: 'entity_id', type: 'VARCHAR(50)', nullable: true },
                    { name: 'impressions', type: 'BIGINT', nullable: true },
                    { name: 'clicks', type: 'BIGINT', nullable: true },
                    { name: 'cost_usd', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'cost_local', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'external_conversions', type: 'BIGINT', nullable: true },
                    { name: 'post_click_conversions', type: 'BIGINT', nullable: true },
                    { name: 'post_view_conversions', type: 'BIGINT', nullable: true },
                    { name: 'one_click_leads', type: 'BIGINT', nullable: true },
                    { name: 'video_views', type: 'BIGINT', nullable: true },
                    { name: 'video_completions', type: 'BIGINT', nullable: true },
                    { name: 'video_watch_time_ms', type: 'BIGINT', nullable: true },
                    { name: 'total_engagements', type: 'BIGINT', nullable: true },
                    { name: 'landing_page_clicks', type: 'BIGINT', nullable: true },
                    { name: 'follows', type: 'BIGINT', nullable: true },
                    { name: 'likes', type: 'BIGINT', nullable: true },
                    { name: 'comments', type: 'BIGINT', nullable: true },
                    { name: 'shares', type: 'BIGINT', nullable: true },
                    { name: 'approximate_reach', type: 'BIGINT', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'creative_analytics':
                return [
                    { name: 'id', type: 'BIGSERIAL', nullable: false },
                    { name: 'date_start', type: 'DATE', nullable: false },
                    { name: 'date_end', type: 'DATE', nullable: false },
                    { name: 'campaign_id', type: 'VARCHAR(50)', nullable: true },
                    { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'creative_id', type: 'VARCHAR(50)', nullable: true },
                    { name: 'creative_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'impressions', type: 'BIGINT', nullable: true },
                    { name: 'clicks', type: 'BIGINT', nullable: true },
                    { name: 'cost_usd', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'cost_local', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'external_conversions', type: 'BIGINT', nullable: true },
                    { name: 'post_click_conversions', type: 'BIGINT', nullable: true },
                    { name: 'post_view_conversions', type: 'BIGINT', nullable: true },
                    { name: 'one_click_leads', type: 'BIGINT', nullable: true },
                    { name: 'video_views', type: 'BIGINT', nullable: true },
                    { name: 'video_completions', type: 'BIGINT', nullable: true },
                    { name: 'video_watch_time_ms', type: 'BIGINT', nullable: true },
                    { name: 'total_engagements', type: 'BIGINT', nullable: true },
                    { name: 'landing_page_clicks', type: 'BIGINT', nullable: true },
                    { name: 'comments', type: 'BIGINT', nullable: true },
                    { name: 'shares', type: 'BIGINT', nullable: true },
                    { name: 'conversion_value', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'device_insights':
                return [
                    { name: 'id', type: 'BIGSERIAL', nullable: false },
                    { name: 'date_start', type: 'DATE', nullable: false },
                    { name: 'date_end', type: 'DATE', nullable: false },
                    { name: 'campaign_id', type: 'VARCHAR(50)', nullable: true },
                    { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'device', type: 'VARCHAR(50)', nullable: true },
                    { name: 'impressions', type: 'BIGINT', nullable: true },
                    { name: 'clicks', type: 'BIGINT', nullable: true },
                    { name: 'cost_usd', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'cost_local', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'video_views', type: 'BIGINT', nullable: true },
                    { name: 'video_completions', type: 'BIGINT', nullable: true },
                    { name: 'video_watch_time_ms', type: 'BIGINT', nullable: true },
                    { name: 'total_engagements', type: 'BIGINT', nullable: true },
                    { name: 'landing_page_clicks', type: 'BIGINT', nullable: true },
                    { name: 'comments', type: 'BIGINT', nullable: true },
                    { name: 'shares', type: 'BIGINT', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'placement_insights':
                return [
                    { name: 'id', type: 'BIGSERIAL', nullable: false },
                    { name: 'date_start', type: 'DATE', nullable: false },
                    { name: 'date_end', type: 'DATE', nullable: false },
                    { name: 'campaign_id', type: 'VARCHAR(50)', nullable: true },
                    { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'placement', type: 'VARCHAR(50)', nullable: true },
                    { name: 'impressions', type: 'BIGINT', nullable: true },
                    { name: 'clicks', type: 'BIGINT', nullable: true },
                    { name: 'cost_usd', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'cost_local', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'external_conversions', type: 'BIGINT', nullable: true },
                    { name: 'post_click_conversions', type: 'BIGINT', nullable: true },
                    { name: 'post_view_conversions', type: 'BIGINT', nullable: true },
                    { name: 'one_click_leads', type: 'BIGINT', nullable: true },
                    { name: 'video_views', type: 'BIGINT', nullable: true },
                    { name: 'total_engagements', type: 'BIGINT', nullable: true },
                    { name: 'landing_page_clicks', type: 'BIGINT', nullable: true },
                    { name: 'comments', type: 'BIGINT', nullable: true },
                    { name: 'shares', type: 'BIGINT', nullable: true },
                    { name: 'conversion_value', type: 'DECIMAL(14,4)', nullable: true },
                    { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
                ];
            case 'industry_insights':
            case 'seniority_insights':
            case 'job_function_insights':
            case 'country_insights':
                return this.getDemographicTableColumns(logicalName);
            default:
                return [];
        }
    }

    /**
     * Column descriptors for the per-pivot demographic tables. Each table
     * carries exactly one demographic value column named after its pivot.
     */
    private getDemographicTableColumns(logicalName: string): any[] {
        const valueColumn =
            logicalName === 'industry_insights' ? 'industry' :
            logicalName === 'seniority_insights' ? 'seniority' :
            logicalName === 'job_function_insights' ? 'job_function' :
            'country';

        return [
            { name: 'id', type: 'BIGSERIAL', nullable: false },
            { name: 'date_start', type: 'DATE', nullable: false },
            { name: 'date_end', type: 'DATE', nullable: false },
            { name: 'campaign_id', type: 'VARCHAR(50)', nullable: true },
            { name: 'campaign_name', type: 'VARCHAR(255)', nullable: true },
            { name: valueColumn, type: 'VARCHAR(255)', nullable: true },
            { name: 'impressions', type: 'BIGINT', nullable: true },
            { name: 'clicks', type: 'BIGINT', nullable: true },
            { name: 'cost_usd', type: 'DECIMAL(14,4)', nullable: true },
            { name: 'cost_local', type: 'DECIMAL(14,4)', nullable: true },
            { name: 'external_conversions', type: 'BIGINT', nullable: true },
            { name: 'one_click_leads', type: 'BIGINT', nullable: true },
            { name: 'video_views', type: 'BIGINT', nullable: true },
            { name: 'total_engagements', type: 'BIGINT', nullable: true },
            { name: 'synced_at', type: 'TIMESTAMP', nullable: true },
        ];
    }
}
