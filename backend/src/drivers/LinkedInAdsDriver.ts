import { DataSource } from 'typeorm';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { LinkedInAdsService } from '../services/LinkedInAdsService.js';
import { LinkedInOAuthService } from '../services/LinkedInOAuthService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';
import { DBDriver } from './DBDriver.js';
import { TableMetadataService } from '../services/TableMetadataService.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import {
    ILinkedInAdAccount,
    ILinkedInCampaign,
    ILinkedInCampaignGroup,
    ILinkedInCreative,
    ILinkedInAnalyticsRecord,
    ILinkedInDate,
    ILinkedInDateRange,
} from '../types/ILinkedInAds.js';

/**
 * LinkedIn Ads Driver
 * Syncs LinkedIn Marketing API data into PostgreSQL under the dra_linkedin_ads schema.
 *
 * Tables written:
 *  - ad_accounts        — account metadata
 *  - campaign_groups    — campaign group metadata
 *  - campaigns          — campaign metadata
 *  - creatives          — creative metadata
 *  - campaign_analytics — daily campaign-level performance metrics
 *  - account_analytics  — monthly account-level performance metrics
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
            const startDate = this.isoToLinkedInDate(
                connectionDetails.api_config?.start_date || this.defaultStartDateIso()
            );
            const endDate = this.isoToLinkedInDate(
                connectionDetails.api_config?.end_date || this.defaultEndDateIso()
            );
            const dateRange: ILinkedInDateRange = { start: startDate, end: endDate };

            console.log('📊 Sync Configuration:');
            console.log(`   - Ad Account ID: ${adAccountId}`);
            console.log(`   - Schema: ${LinkedInAdsDriver.SCHEMA_NAME}`);
            console.log(
                `   - Date Range: ${this.linkedInDateToIso(startDate)} → ${this.linkedInDateToIso(endDate)}\n`
            );

            // ── Sync structural entities ──────────────────────────────────
            const accountsCount = await this.syncAdAccounts(
                manager, dataSourceId, usersPlatformId, accessToken
            );
            totalSynced += accountsCount;

            const groupsCount = await this.syncCampaignGroups(
                manager, dataSourceId, usersPlatformId, accessToken, adAccountId
            );
            totalSynced += groupsCount;

            const campaignsCount = await this.syncCampaigns(
                manager, dataSourceId, usersPlatformId, accessToken, adAccountId
            );
            totalSynced += campaignsCount;

            const creativesCount = await this.syncCreatives(
                manager, dataSourceId, usersPlatformId, accessToken, adAccountId
            );
            totalSynced += creativesCount;

            // ── Sync analytics ────────────────────────────────────────────
            const campaignAnalyticsCount = await this.syncCampaignAnalytics(
                manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange
            );
            totalSynced += campaignAnalyticsCount;

            const accountAnalyticsCount = await this.syncAccountAnalytics(
                manager, dataSourceId, usersPlatformId, accessToken, adAccountId, dateRange
            );
            totalSynced += accountAnalyticsCount;

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
            'account_analytics',
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

        const records = await this.linkedInAdsService.getCampaignAnalytics(
            accessToken, adAccountId, dateRange, 'DAILY'
        );
        if (records.length === 0) return 0;

        for (let i = 0; i < records.length; i += LinkedInAdsDriver.BATCH_SIZE) {
            const batch = records.slice(i, i + LinkedInAdsDriver.BATCH_SIZE);
            await this.batchUpsert(
                manager, schema, tableName,
                batch.map(r => this.transformAnalytics(r, 'campaign')),
                ['date_start', 'date_end', 'entity_id']
            );
        }

        console.log(`✅ Synced ${records.length} campaign analytics record(s)`);
        return records.length;
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

    private transformAnalytics(r: ILinkedInAnalyticsRecord, entityType: string): Record<string, unknown> {
        // Extract pivot value (first URN in pivotValues array) and strip URN prefix
        const rawPivotValue = r.pivotValues?.[0] || '';
        const entityId = rawPivotValue.includes(':') ? rawPivotValue.split(':').pop() || null : rawPivotValue || null;

        // Convert structured dateRange to ISO date strings
        const dateStart = this.linkedInDateToIso(r.dateRange.start);
        const dateEnd = r.dateRange.end ? this.linkedInDateToIso(r.dateRange.end) : dateStart;

        return {
            date_start: dateStart,
            date_end: dateEnd,
            entity_type: entityType,
            entity_id: entityId,
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
     * as entity_id to keep the schema uniform.
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
                synced_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (date_start, date_end, entity_id)
            )
        `);
        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_entity ON ${t}(entity_id)`);
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

    private defaultStartDateIso(): string {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    }

    private defaultEndDateIso(): string {
        return new Date().toISOString().split('T')[0];
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
            default:
                return [];
        }
    }
}
