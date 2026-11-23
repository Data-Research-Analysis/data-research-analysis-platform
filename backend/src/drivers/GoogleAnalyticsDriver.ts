import crypto from 'crypto';
import { IAPIDriver } from '../interfaces/IAPIDriver.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleAnalyticsService } from '../services/GoogleAnalyticsService.js';
import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
import { TableMetadataService } from '../services/TableMetadataService.js';
import { SyncHistoryService } from '../services/SyncHistoryService.js';
import { SyncType } from '../entities/SyncHistory.js';
import { DBDriver } from './DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { RetryHandler } from '../utils/RetryHandler.js';
import { IGA4ReportType } from '../types/IGoogleAnalytics.js';

const GA_SCHEMA = 'dra_google_analytics';
const BATCH_SIZE = 500;

/**
 * Columns that must not be summed when collapsing duplicate GA4 rows sharing
 * the same conflict key: rates and durations are weighted averages, so the
 * last value wins instead of being added.
 */
const NON_ADDITIVE_COLUMNS = new Set([
    'bounce_rate',
    'exit_rate',
    'engagement_rate',
    'average_session_duration',
    'user_engagement_duration',
]);

/**
 * Per-report sync behavior: how to create the backing table, how to turn a
 * GA4 report row into an insertable row, and which columns form the upsert key.
 */
interface IGAReportSyncConfig {
    createTable: (manager: any, schemaName: string, tableName: string) => Promise<void>;
    transform: (row: any) => any;
    conflictKeys: string[];
    /**
     * When set, a pre-existing table that lacks this column is treated as a
     * legacy schema and dropped once (data is repopulated by the sync). This
     * is how destructive schema changes are applied without re-dropping the
     * table on every sync.
     */
    legacyColumn?: string;
}

/**
 * Google Analytics Driver
 * Syncs GA4 reports into the `dra_google_analytics` schema.
 *
 * Design (mirrors the Google Ads driver):
 * - Every report type is synced independently. A failure in one report never
 *   aborts the others or wipes previously synced tables.
 * - Tables are created with CREATE TABLE IF NOT EXISTS; they are only dropped
 *   once when a legacy schema is detected, not on every sync.
 * - Rows are written in batches (multi-row INSERT ... ON CONFLICT DO UPDATE).
 * - Report fetching is retried with exponential backoff and paginated.
 */
export class GoogleAnalyticsDriver implements IAPIDriver {
    private static instance: GoogleAnalyticsDriver;

    private readonly gaService: GoogleAnalyticsService;
    private readonly tableMetadataService: TableMetadataService;
    private readonly syncHistoryService: SyncHistoryService;

    private constructor() {
        this.gaService = GoogleAnalyticsService.getInstance();
        this.tableMetadataService = TableMetadataService.getInstance();
        this.syncHistoryService = SyncHistoryService.getInstance();
    }

    public static getInstance(): GoogleAnalyticsDriver {
        if (!GoogleAnalyticsDriver.instance) {
            GoogleAnalyticsDriver.instance = new GoogleAnalyticsDriver();
        }
        return GoogleAnalyticsDriver.instance;
    }

    // -----------------------------------------------------------------------
    // Authentication
    // -----------------------------------------------------------------------

    /**
     * Validate the stored OAuth tokens by refreshing the access token if needed.
     */
    public async authenticate(connectionDetails: IAPIConnectionDetails): Promise<boolean> {
        try {
            if (!connectionDetails.oauth_access_token) {
                console.error('❌ No access token available for Google Analytics');
                return false;
            }
            const oauthService = GoogleOAuthService.getInstance();
            const oauth2Client = oauthService.getAuthenticatedClient(
                connectionDetails.oauth_access_token,
                connectionDetails.oauth_refresh_token
            );
            // Force a token refresh check so expired credentials fail here,
            // before any report call.
            await oauth2Client.getAccessToken();
            console.log('✅ Google Analytics authentication successful');
            return true;
        } catch (error) {
            console.error('❌ Google Analytics authentication failed:', error);
            return false;
        }
    }

    // -----------------------------------------------------------------------
    // Report configuration
    // -----------------------------------------------------------------------

    /**
     * Deterministic compact key for the upsert conflict. Composite unique
     * indexes on several VARCHAR(255) columns can exceed the PostgreSQL btree
     * row-size limit for long UTM parameters and click IDs, so dimension
     * combinations are keyed by an md5 hash instead.
     */
    private rowKey(...parts: Array<string | number | null | undefined>): string {
        const data = parts
            .map((p) => (p === null || p === undefined ? '(not set)' : String(p)))
            .join('|');
        return crypto.createHash('md5').update(data).digest('hex');
    }

    private getReportConfig(syncType: IGA4ReportType): IGAReportSyncConfig {
        switch (syncType) {
            case 'traffic_overview':
                return {
                    conflictKeys: ['row_key'],
                    legacyColumn: 'user_engagement_duration',
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                session_source VARCHAR(255),
                                session_medium VARCHAR(255),
                                session_campaign_id VARCHAR(255),
                                session_campaign_name VARCHAR(255),
                                session_default_channel_group VARCHAR(255),
                                sessions INTEGER,
                                total_users INTEGER,
                                new_users INTEGER,
                                screen_page_views INTEGER,
                                average_session_duration DECIMAL(10,2),
                                bounce_rate DECIMAL(5,2),
                                user_engagement_duration BIGINT,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_source ON ${full}(session_source)`);
                    },
                    transform: (row: any) => {
                        const source = toStringValue(row.sessionSource, 'direct');
                        const medium = toStringValue(row.sessionMedium, '(none)');
                        const campaignId = toStringValue(row.sessionCampaignId, '(not set)');
                        const campaignName = toStringValue(row.sessionCampaignName, '(not set)');
                        const channel = toStringValue(row.sessionDefaultChannelGroup, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, source, medium, campaignId, campaignName, channel),
                            date,
                            session_source: source,
                            session_medium: medium,
                            session_campaign_id: campaignId,
                            session_campaign_name: campaignName,
                            session_default_channel_group: channel,
                            sessions: toNumber(row.sessions),
                            total_users: toNumber(row.totalUsers),
                            new_users: toNumber(row.newUsers),
                            screen_page_views: toNumber(row.screenPageViews),
                            average_session_duration: toNumber(row.averageSessionDuration),
                            bounce_rate: toNumber(row.bounceRate),
                            user_engagement_duration: toNumber(row.userEngagementDuration),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'user_acquisition':
                return {
                    conflictKeys: ['row_key'],
                    legacyColumn: 'campaign_key',
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                first_user_source VARCHAR(255),
                                first_user_medium VARCHAR(255),
                                first_user_campaign_id VARCHAR(255),
                                first_user_campaign_name VARCHAR(255),
                                first_user_google_ads_campaign_id VARCHAR(255),
                                first_user_google_ads_campaign_name VARCHAR(255),
                                campaign_key VARCHAR(255),
                                first_user_default_channel_group VARCHAR(255),
                                new_users INTEGER,
                                sessions INTEGER,
                                engagement_rate DECIMAL(5,2),
                                conversions INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${full}(first_user_campaign_id)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_key ON ${full}(campaign_key)`);
                    },
                    transform: (row: any) => {
                        const source = toStringValue(row.firstUserSource, 'direct');
                        const medium = toStringValue(row.firstUserMedium, '(none)');
                        const campaignId = toStringValue(row.firstUserCampaignId, '(not set)');
                        const campaignName = toStringValue(row.firstUserCampaignName, '(not set)');
                        const gadsCampaignId = toStringValue(row.firstUserGoogleAdsCampaignId, '(not set)');
                        const gadsCampaignName = toStringValue(row.firstUserGoogleAdsCampaignName, '(not set)');
                        const channel = toStringValue(row.firstUserDefaultChannelGroup, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, source, medium, campaignId, campaignName, gadsCampaignId, gadsCampaignName, channel),
                            date,
                            first_user_source: source,
                            first_user_medium: medium,
                            first_user_campaign_id: campaignId,
                            first_user_campaign_name: campaignName,
                            first_user_google_ads_campaign_id: gadsCampaignId,
                            first_user_google_ads_campaign_name: gadsCampaignName,
                            campaign_key: computeCampaignKey(source, gadsCampaignId, campaignId, campaignName),
                            first_user_default_channel_group: channel,
                            new_users: toNumber(row.newUsers),
                            sessions: toNumber(row.sessions),
                            engagement_rate: toNumber(row.engagementRate),
                            conversions: toNumber(row.conversions),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'session_attribution':
                return {
                    conflictKeys: ['row_key'],
                    legacyColumn: 'campaign_key',
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                session_source VARCHAR(255),
                                session_medium VARCHAR(255),
                                session_campaign_id VARCHAR(255),
                                session_campaign_name VARCHAR(255),
                                session_google_ads_campaign_id VARCHAR(255),
                                session_google_ads_campaign_name VARCHAR(255),
                                session_manual_term VARCHAR(255),
                                session_manual_ad_content VARCHAR(255),
                                session_gclid VARCHAR(255),
                                campaign_key VARCHAR(255),
                                session_default_channel_group VARCHAR(255),
                                sessions INTEGER,
                                engaged_sessions INTEGER,
                                total_users INTEGER,
                                conversions INTEGER,
                                session_key_event_rate DOUBLE PRECISION,
                                event_count INTEGER,
                                total_revenue DECIMAL(15,2),
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        // Migrate tables created before session_key_event_rate existed.
                        await manager.query(`ALTER TABLE ${full} ADD COLUMN IF NOT EXISTS session_key_event_rate DOUBLE PRECISION`);
                        await manager.query(`ALTER TABLE ${full} ADD COLUMN IF NOT EXISTS event_count INTEGER`);
                        await manager.query(`ALTER TABLE ${full} ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(15,2)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_gclid ON ${full}(session_gclid)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign ON ${full}(session_campaign_id)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_key ON ${full}(campaign_key)`);
                    },
                    transform: (row: any) => {
                        const source = toStringValue(row.sessionSource, 'direct');
                        const medium = toStringValue(row.sessionMedium, '(none)');
                        const campaignId = toStringValue(row.sessionCampaignId, '(not set)');
                        const campaignName = toStringValue(row.sessionCampaignName, '(not set)');
                        const gadsCampaignId = toStringValue(row.sessionGoogleAdsCampaignId, '(not set)');
                        const gadsCampaignName = toStringValue(row.sessionGoogleAdsCampaignName, '(not set)');
                        const term = toStringValue(row.sessionManualTerm, '(not set)');
                        const content = toStringValue(row.sessionManualAdContent, '(not set)');
                        const channel = toStringValue(row.sessionDefaultChannelGroup, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, source, medium, campaignId, campaignName, gadsCampaignId, gadsCampaignName, term, content, channel),
                            date,
                            session_source: source,
                            session_medium: medium,
                            session_campaign_id: campaignId,
                            session_campaign_name: campaignName,
                            session_google_ads_campaign_id: gadsCampaignId,
                            session_google_ads_campaign_name: gadsCampaignName,
                            session_manual_term: term,
                            session_manual_ad_content: content,
                            session_gclid: '(not set)',
                            campaign_key: computeCampaignKey(source, gadsCampaignId, campaignId, campaignName),
                            session_default_channel_group: channel,
                            sessions: toNumber(row.sessions),
                            engaged_sessions: toNumber(row.engagedSessions),
                            total_users: toNumber(row.totalUsers),
                            conversions: toNumber(row.conversions),
                            session_key_event_rate: toNullableNumber(row.sessionKeyEventRate),
                            event_count: toNumber(row.eventCount),
                            total_revenue: toNumber(row.totalRevenue),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'page_performance':
                return {
                    conflictKeys: ['row_key'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                page_path VARCHAR(2048),
                                page_title VARCHAR(1024),
                                screen_page_views INTEGER,
                                average_session_duration DECIMAL(10,2),
                                bounce_rate DECIMAL(5,2),
                                exit_rate DECIMAL(5,2),
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_path ON ${full}(page_path)`);
                    },
                    transform: (row: any) => {
                        const pagePath = toStringValue(row.pagePath, '/');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, pagePath),
                            date,
                            page_path: pagePath,
                            page_title: toStringValue(row.pageTitle, 'Unknown'),
                            screen_page_views: toNumber(row.screenPageViews),
                            average_session_duration: toNumber(row.averageSessionDuration),
                            bounce_rate: toNumber(row.bounceRate),
                            exit_rate: toNumber(row.exitRate),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'geographic':
                return {
                    conflictKeys: ['row_key'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                country VARCHAR(255),
                                city VARCHAR(255),
                                total_users INTEGER,
                                sessions INTEGER,
                                screen_page_views INTEGER,
                                average_session_duration DECIMAL(10,2),
                                conversions INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`ALTER TABLE ${full} ADD COLUMN IF NOT EXISTS conversions INTEGER`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_country ON ${full}(country)`);
                    },
                    transform: (row: any) => {
                        const country = toStringValue(row.country, '(not set)');
                        const city = toStringValue(row.city, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, country, city),
                            date,
                            country,
                            city,
                            total_users: toNumber(row.totalUsers),
                            sessions: toNumber(row.sessions),
                            screen_page_views: toNumber(row.screenPageViews),
                            average_session_duration: toNumber(row.averageSessionDuration),
                            conversions: toNumber(row.conversions),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'device':
                return {
                    conflictKeys: ['row_key'],
                    legacyColumn: 'platform',
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                device_category VARCHAR(50),
                                operating_system VARCHAR(100),
                                browser VARCHAR(100),
                                platform VARCHAR(50),
                                device_model VARCHAR(100),
                                screen_resolution VARCHAR(50),
                                total_users INTEGER,
                                sessions INTEGER,
                                screen_page_views INTEGER,
                                bounce_rate DECIMAL(5,2),
                                conversions INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`ALTER TABLE ${full} ADD COLUMN IF NOT EXISTS conversions INTEGER`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_device ON ${full}(device_category)`);
                    },
                    transform: (row: any) => {
                        const deviceCategory = toStringValue(row.deviceCategory, '(not set)');
                        const operatingSystem = toStringValue(row.operatingSystem, '(not set)');
                        const browser = toStringValue(row.browser, '(not set)');
                        const platform = toStringValue(row.platform, '(not set)');
                        const deviceModel = toStringValue(row.deviceModel, '(not set)');
                        const screenResolution = toStringValue(row.screenResolution, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, deviceCategory, operatingSystem, browser, platform, deviceModel, screenResolution),
                            date,
                            device_category: deviceCategory,
                            operating_system: operatingSystem,
                            browser,
                            platform,
                            device_model: deviceModel,
                            screen_resolution: screenResolution,
                            total_users: toNumber(row.totalUsers),
                            sessions: toNumber(row.sessions),
                            screen_page_views: toNumber(row.screenPageViews),
                            bounce_rate: toNumber(row.bounceRate),
                            conversions: toNumber(row.conversions),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'events':
                return {
                    conflictKeys: ['date', 'event_name'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                date DATE NOT NULL,
                                event_name VARCHAR(255),
                                event_count INTEGER,
                                event_value DECIMAL(12,2),
                                conversions INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW(),
                                UNIQUE(date, event_name)
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_name ON ${full}(event_name)`);
                    },
                    transform: (row: any) => ({
                        date: toIsoDate(row.date),
                        event_name: toStringValue(row.eventName, '(not set)'),
                        event_count: toNumber(row.eventCount),
                        event_value: toNumber(row.eventValue),
                        conversions: toNumber(row.conversions),
                        synced_at: new Date(),
                    }),
                };
            case 'demographics':
                return {
                    conflictKeys: ['row_key'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                user_age_bracket VARCHAR(100),
                                user_gender VARCHAR(50),
                                user_language VARCHAR(50),
                                new_vs_returning VARCHAR(50),
                                total_users INTEGER,
                                new_users INTEGER,
                                sessions INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                    },
                    transform: (row: any) => {
                        const age = toStringValue(row.userAgeBracket, '(not set)');
                        const gender = toStringValue(row.userGender, '(not set)');
                        const lang = toStringValue(row.language, '(not set)');
                        const nvr = toStringValue(row.newVsReturning, '(not set)');
                        return {
                            row_key: this.rowKey(age, gender, lang, nvr),
                            user_age_bracket: age,
                            user_gender: gender,
                            user_language: lang,
                            new_vs_returning: nvr,
                            total_users: toNumber(row.totalUsers),
                            new_users: toNumber(row.newUsers),
                            sessions: toNumber(row.sessions),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'technology':
                return {
                    conflictKeys: ['row_key'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                platform VARCHAR(50),
                                device_category VARCHAR(50),
                                device_model VARCHAR(100),
                                operating_system VARCHAR(100),
                                browser VARCHAR(100),
                                screen_resolution VARCHAR(50),
                                total_users INTEGER,
                                sessions INTEGER,
                                screen_page_views INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                    },
                    transform: (row: any) => {
                        const platform = toStringValue(row.platform, '(not set)');
                        const deviceCategory = toStringValue(row.deviceCategory, '(not set)');
                        const deviceModel = toStringValue(row.deviceModel, '(not set)');
                        const os = toStringValue(row.operatingSystem, '(not set)');
                        const browser = toStringValue(row.browser, '(not set)');
                        const resolution = toStringValue(row.screenResolution, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, platform, deviceCategory, deviceModel, os, browser, resolution),
                            date,
                            platform,
                            device_category: deviceCategory,
                            device_model: deviceModel,
                            operating_system: os,
                            browser,
                            screen_resolution: resolution,
                            total_users: toNumber(row.totalUsers),
                            sessions: toNumber(row.sessions),
                            screen_page_views: toNumber(row.screenPageViews),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'first_user_source_medium':
                return {
                    conflictKeys: ['row_key'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                first_user_source_medium VARCHAR(255),
                                first_user_default_channel_group VARCHAR(255),
                                total_users INTEGER,
                                new_users INTEGER,
                                sessions INTEGER,
                                conversions INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                    },
                    transform: (row: any) => {
                        const sm = toStringValue(row.firstUserSourceMedium, '(not set)');
                        const channel = toStringValue(row.firstUserDefaultChannelGroup, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, sm, channel),
                            date,
                            first_user_source_medium: sm,
                            first_user_default_channel_group: channel,
                            total_users: toNumber(row.totalUsers),
                            new_users: toNumber(row.newUsers),
                            sessions: toNumber(row.sessions),
                            conversions: toNumber(row.conversions),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'landing_pages':
                return {
                    conflictKeys: ['row_key'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                landing_page VARCHAR(2048),
                                session_default_channel_group VARCHAR(255),
                                sessions INTEGER,
                                total_users INTEGER,
                                engaged_sessions INTEGER,
                                conversions INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_landing ON ${full}(landing_page)`);
                    },
                    transform: (row: any) => {
                        const landing = toStringValue(row.landingPagePlusQueryString, '(not set)');
                        const channel = toStringValue(row.sessionDefaultChannelGroup, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, landing, channel),
                            date,
                            landing_page: landing,
                            session_default_channel_group: channel,
                            sessions: toNumber(row.sessions),
                            total_users: toNumber(row.totalUsers),
                            engaged_sessions: toNumber(row.engagedSessions),
                            conversions: toNumber(row.conversions),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'search_console':
                return {
                    conflictKeys: ['row_key'],
                    // Older tables had no date/CTR/position columns and a
                    // landing-page-only row key; drop them once so the next
                    // sync repopulates the richer schema.
                    legacyColumn: 'ctr',
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE,
                                landing_page VARCHAR(2048),
                                organic_google_search_clicks INTEGER,
                                organic_google_search_impressions INTEGER,
                                ctr DECIMAL(10,4),
                                average_position DECIMAL(10,2),
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_landing ON ${full}(landing_page)`);
                    },
                    transform: (row: any) => {
                        const landing = toStringValue(row.landingPagePlusQueryString, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, landing),
                            date,
                            landing_page: landing,
                            organic_google_search_clicks: toNumber(row.organicGoogleSearchClicks),
                            organic_google_search_impressions: toNumber(row.organicGoogleSearchImpressions),
                            ctr: toNullableNumber(row.ctr),
                            average_position: toNullableNumber(row.averagePosition),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'ecommerce':
                return {
                    conflictKeys: ['row_key'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                item_name VARCHAR(512),
                                item_category VARCHAR(255),
                                item_id VARCHAR(255),
                                item_revenue DECIMAL(15,2),
                                items_purchased INTEGER,
                                item_purchase_quantity INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_item ON ${full}(item_name)`);
                    },
                    transform: (row: any) => {
                        const name = toStringValue(row.itemName, '(not set)');
                        const category = toStringValue(row.itemCategory, '(not set)');
                        const id = toStringValue(row.itemId, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, name, category, id),
                            date,
                            item_name: name,
                            item_category: category,
                            item_id: id,
                            item_revenue: toNumber(row.itemRevenue),
                            items_purchased: toNumber(row.itemsPurchased),
                            item_purchase_quantity: toNumber(row.itemsPurchased),
                            synced_at: new Date(),
                        };
                    },
                };
            case 'revenue':
                return {
                    conflictKeys: ['row_key'],
                    createTable: async (manager, schemaName, tableName) => {
                        const full = this.fullTableName(schemaName, tableName);
                        await manager.query(`
                            CREATE TABLE IF NOT EXISTS ${full} (
                                id SERIAL PRIMARY KEY,
                                row_key VARCHAR(32) NOT NULL UNIQUE,
                                date DATE NOT NULL,
                                session_default_channel_group VARCHAR(255),
                                total_revenue DECIMAL(15,2),
                                item_revenue DECIMAL(15,2),
                                purchase_revenue DECIMAL(15,2),
                                ecommerce_purchases INTEGER,
                                total_users INTEGER,
                                sessions INTEGER,
                                synced_at TIMESTAMP DEFAULT NOW()
                            )
                        `);
                        await manager.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${full}(date)`);
                    },
                    transform: (row: any) => {
                        const channel = toStringValue(row.sessionDefaultChannelGroup, '(not set)');
                        const date = toIsoDate(row.date);
                        return {
                            row_key: this.rowKey(date, channel),
                            date,
                            session_default_channel_group: channel,
                            total_revenue: toNumber(row.totalRevenue),
                            item_revenue: toNumber(row.itemRevenue),
                            purchase_revenue: toNumber(row.purchaseRevenue),
                            ecommerce_purchases: toNumber(row.ecommercePurchases),
                            total_users: toNumber(row.totalUsers),
                            sessions: toNumber(row.sessions),
                            synced_at: new Date(),
                        };
                    },
                };
            default:
                throw new Error(`Unsupported GA4 report type: ${String(syncType)}`);
        }
    }

    // -----------------------------------------------------------------------
    // Sync
    // -----------------------------------------------------------------------

    public async syncToDatabase(
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        const propertyId = connectionDetails.api_config?.property_id;
        const syncRecord = await this.syncHistoryService.createSyncRecord(dataSourceId, SyncType.MANUAL, {
            propertyId,
            reportTypes: GoogleAnalyticsService.getReportTypeList(),
        });

        try {
            if (!propertyId) {
                throw new Error('Google Analytics property ID is not configured');
            }

            const isAuthenticated = await this.authenticate(connectionDetails);
            if (!isAuthenticated) {
                throw new Error('Authentication with Google Analytics failed');
            }

            const dbDriver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!dbDriver) {
                throw new Error('PostgreSQL driver not available');
            }
            const manager = (await dbDriver.getConcreteDriver()).manager;

            await manager.query(`CREATE SCHEMA IF NOT EXISTS ${GA_SCHEMA}`);
            await this.syncHistoryService.markAsRunning(syncRecord.id);

            const reportTypes = GoogleAnalyticsService.getReportTypeList();

            let totalRecordsSynced = 0;
            let totalRecordsFailed = 0;
            let succeededTypes = 0;
            const failedReports: Array<{ syncType: string; error: string }> = [];

            for (const syncType of reportTypes) {
                try {
                    const count = await this.syncReportType(
                        manager, dataSourceId, usersPlatformId, propertyId, connectionDetails, syncType
                    );
                    totalRecordsSynced += count;
                    succeededTypes++;
                } catch (error: any) {
                    totalRecordsFailed++;
                    const message = error?.message || String(error);
                    failedReports.push({ syncType, error: message });
                    console.error(`⚠️  Failed to sync ${syncType}: ${message}`);
                }
            }

            if (succeededTypes === 0 && failedReports.length > 0) {
                throw new Error(
                    `All Google Analytics report types failed: ${failedReports.map(f => `${f.syncType} (${f.error})`).join('; ')}`
                );
            }

            const errorMessage = failedReports.length > 0
                ? failedReports.map(f => `${f.syncType}: ${f.error}`).join('; ')
                : undefined;

            await this.syncHistoryService.completeSyncRecord(
                syncRecord.id,
                totalRecordsSynced,
                totalRecordsFailed,
                errorMessage
            );

            console.log(`✅ Google Analytics sync completed: ${totalRecordsSynced} rows synced, ${totalRecordsFailed} failed`);
            return true;
        } catch (error: any) {
            console.error('❌ Google Analytics sync failed:', error);
            await this.syncHistoryService.markAsFailed(syncRecord.id, error?.message || 'Unknown sync error');
            return false;
        }
    }

    /**
     * Sync a single report type into its backing table. A failure here only
     * affects this report type.
     */
    private async syncReportType(
        manager: any,
        dataSourceId: number,
        usersPlatformId: number,
        propertyId: string,
        connectionDetails: IAPIConnectionDetails,
        syncType: IGA4ReportType
    ): Promise<number> {
        const config = this.getReportConfig(syncType);
        const preset = GoogleAnalyticsService.getReportPresets()[syncType];

        const physicalTableName = this.tableMetadataService.generatePhysicalTableName(dataSourceId, syncType, propertyId);
        this.validateTableName(physicalTableName);

        await this.ensureTableSchema(manager, GA_SCHEMA, physicalTableName, config);
        await this.tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: GA_SCHEMA,
            physicalTableName,
            logicalTableName: syncType,
            originalSheetName: preset.name,
            fileId: propertyId,
            tableType: 'google_analytics',
        });

        console.log(`📊 Syncing ${syncType} report (${preset.name})...`);

        // The connection-time ingestion window wins when set; otherwise fall
        // back to the per-report default so existing sources keep working.
        const windowDays = connectionDetails.api_config?.sync_window_days || preset.dateRangeDays;

        const result = await RetryHandler.execute(
            () => this.gaService.runReport(
                propertyId,
                connectionDetails,
                preset.dimensions,
                preset.metrics,
                [{ startDate: `${windowDays}daysAgo`, endDate: 'today' }],
                100000
            ),
            RetryHandler.getRecommendedConfig('rate_limit')
        );

        if (!result.success || !result.data) {
            throw result.error || new Error(`Failed to run ${syncType} report`);
        }

        const rows = this.gaService.transformReportToRows(result.data);
        if (rows.length === 0) {
            console.log(`   ${syncType}: no rows returned`);
            return 0;
        }

        const transformed = rows.map(row => config.transform(row));
        const fullTableName = this.fullTableName(GA_SCHEMA, physicalTableName);
        await this.batchUpsert(manager, fullTableName, transformed, config.conflictKeys);

        console.log(`✅ Synced ${rows.length} rows to ${syncType} (${physicalTableName})`);
        return rows.length;
    }

    /**
     * Ensure the backing table exists with the current schema. A table with a
     * legacy schema (missing a marker column) is dropped once and recreated;
     * the sync that follows repopulates it.
     */
    private async ensureTableSchema(
        manager: any,
        schemaName: string,
        tableName: string,
        config: IGAReportSyncConfig
    ): Promise<void> {
        if (config.legacyColumn) {
            const full = this.fullTableName(schemaName, tableName);
            const reg = await manager.query(
                `SELECT to_regclass($1) AS tbl`,
                [full]
            );
            if (reg?.[0]?.tbl) {
                const cols = await manager.query(
                    `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
                    [schemaName, tableName]
                );
                const colNames = new Set((cols || []).map((c: any) => c.column_name));
                if (!colNames.has(config.legacyColumn)) {
                    console.log(`   ↪ Detected legacy schema for ${tableName}; dropping and recreating once`);
                    await manager.query(`DROP TABLE IF EXISTS ${full}`);
                    await manager.query(
                        `DELETE FROM dra_table_metadata WHERE schema_name = $1 AND physical_table_name = $2`,
                        [schemaName, tableName]
                    );
                }
            }
        }
        await config.createTable(manager, schemaName, tableName);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private fullTableName(schemaName: string, tableName: string): string {
        return `"${schemaName}"."${tableName}"`;
    }

    private validateTableName(tableName: string): void {
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
    }

    private async batchUpsert(
        manager: any,
        tableName: string,
        data: any[],
        conflictKeys: string[]
    ): Promise<void> {
        if (data.length === 0) return;
        // GA4 Data API can return the same dimension combination multiple
        // times (rows at different scopes/samples). Collapse them by the
        // conflict key first, summing numeric columns, so a single INSERT
        // never targets the same row twice.
        const merged = this.mergeByConflictKey(data, conflictKeys);
        for (let i = 0; i < merged.length; i += BATCH_SIZE) {
            const batch = merged.slice(i, i + BATCH_SIZE);
            const columns = Object.keys(batch[0]);
            const placeholders = batch.map((_, rowIndex) => {
                const rowPlaceholders = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
                return `(${rowPlaceholders.join(', ')})`;
            }).join(', ');
            const values = batch.flatMap(row => columns.map(col => row[col]));
            const updateClause = columns
                .filter(col => !conflictKeys.includes(col))
                .map(col => `${col} = EXCLUDED.${col}`)
                .join(', ');
            const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT (${conflictKeys.join(', ')}) DO UPDATE SET ${updateClause}`;
            await manager.query(query, values);
        }
    }

    private mergeByConflictKey(data: any[], conflictKeys: string[]): any[] {
        const keyOf = (row: any) => conflictKeys.map(k => row[k]).join('|');
        const byKey = new Map<string, any>();
        for (const row of data) {
            const key = keyOf(row);
            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, { ...row });
                continue;
            }
            for (const col of Object.keys(row)) {
                if (conflictKeys.includes(col)) continue;
                const a = existing[col];
                const b = row[col];
                if (typeof a === 'number' && typeof b === 'number' && !NON_ADDITIVE_COLUMNS.has(col)) {
                    existing[col] = a + b;
                } else if (b !== undefined) {
                    existing[col] = b;
                }
            }
        }
        return [...byKey.values()];
    }

    public async getSchema(dataSourceId: number, connectionDetails: IAPIConnectionDetails): Promise<any> {
        const propertyId = connectionDetails.api_config?.property_id;
        const reportTypes = GoogleAnalyticsService.getReportTypeList();
        const tables = reportTypes.map((syncType: IGA4ReportType) => {
            const physicalTableName = this.tableMetadataService.generatePhysicalTableName(dataSourceId, syncType, propertyId);
            return {
                schema: GA_SCHEMA,
                table: physicalTableName,
                logicalName: syncType,
                columns: this.getTableColumns(syncType),
            };
        });
        return { schemaName: GA_SCHEMA, tables };
    }

    private getTableColumns(syncType: string): any[] {
        const id = { name: 'id', type: 'SERIAL', nullable: false };
        const syncedAt = { name: 'synced_at', type: 'TIMESTAMP', nullable: true };
        const base: any[] = [id];
        switch (syncType) {
            case 'traffic_overview':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'session_source', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_medium', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_campaign_id', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_default_channel_group', type: 'VARCHAR(255)', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'new_users', type: 'INTEGER', nullable: true },
                    { name: 'screen_page_views', type: 'INTEGER', nullable: true },
                    { name: 'average_session_duration', type: 'DECIMAL(10,2)', nullable: true },
                    { name: 'bounce_rate', type: 'DECIMAL(5,2)', nullable: true },
                    { name: 'user_engagement_duration', type: 'BIGINT', nullable: true },
                    syncedAt,
                ];
            case 'user_acquisition':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'first_user_source', type: 'VARCHAR(255)', nullable: true },
                    { name: 'first_user_medium', type: 'VARCHAR(255)', nullable: true },
                    { name: 'first_user_campaign_id', type: 'VARCHAR(255)', nullable: true },
                    { name: 'first_user_campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'first_user_google_ads_campaign_id', type: 'VARCHAR(255)', nullable: true },
                    { name: 'first_user_google_ads_campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'campaign_key', type: 'VARCHAR(255)', nullable: true },
                    { name: 'first_user_default_channel_group', type: 'VARCHAR(255)', nullable: true },
                    { name: 'new_users', type: 'INTEGER', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    { name: 'engagement_rate', type: 'DECIMAL(5,2)', nullable: true },
                    { name: 'conversions', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'session_attribution':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'session_source', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_medium', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_campaign_id', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_google_ads_campaign_id', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_google_ads_campaign_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_manual_term', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_manual_ad_content', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_gclid', type: 'VARCHAR(255)', nullable: true },
                    { name: 'campaign_key', type: 'VARCHAR(255)', nullable: true },
                    { name: 'session_default_channel_group', type: 'VARCHAR(255)', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    { name: 'engaged_sessions', type: 'INTEGER', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'conversions', type: 'INTEGER', nullable: true },
                    { name: 'session_key_event_rate', type: 'DOUBLE PRECISION', nullable: true },
                    { name: 'event_count', type: 'INTEGER', nullable: true },
                    { name: 'total_revenue', type: 'DECIMAL(15,2)', nullable: true },
                    syncedAt,
                ];
            case 'page_performance':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'page_path', type: 'VARCHAR(2048)', nullable: true },
                    { name: 'page_title', type: 'VARCHAR(1024)', nullable: true },
                    { name: 'screen_page_views', type: 'INTEGER', nullable: true },
                    { name: 'average_session_duration', type: 'DECIMAL(10,2)', nullable: true },
                    { name: 'bounce_rate', type: 'DECIMAL(5,2)', nullable: true },
                    { name: 'exit_rate', type: 'DECIMAL(5,2)', nullable: true },
                    syncedAt,
                ];
            case 'geographic':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'country', type: 'VARCHAR(255)', nullable: true },
                    { name: 'city', type: 'VARCHAR(255)', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    { name: 'screen_page_views', type: 'INTEGER', nullable: true },
                    { name: 'average_session_duration', type: 'DECIMAL(10,2)', nullable: true },
                    { name: 'conversions', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'device':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'device_category', type: 'VARCHAR(50)', nullable: true },
                    { name: 'operating_system', type: 'VARCHAR(100)', nullable: true },
                    { name: 'browser', type: 'VARCHAR(100)', nullable: true },
                    { name: 'platform', type: 'VARCHAR(50)', nullable: true },
                    { name: 'device_model', type: 'VARCHAR(100)', nullable: true },
                    { name: 'screen_resolution', type: 'VARCHAR(50)', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    { name: 'screen_page_views', type: 'INTEGER', nullable: true },
                    { name: 'bounce_rate', type: 'DECIMAL(5,2)', nullable: true },
                    { name: 'conversions', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'events':
                return [
                    ...base,
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'event_name', type: 'VARCHAR(255)', nullable: true },
                    { name: 'event_count', type: 'INTEGER', nullable: true },
                    { name: 'event_value', type: 'DECIMAL(12,2)', nullable: true },
                    { name: 'conversions', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'demographics':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'user_age_bracket', type: 'VARCHAR(100)', nullable: true },
                    { name: 'user_gender', type: 'VARCHAR(50)', nullable: true },
                    { name: 'user_interest', type: 'VARCHAR(255)', nullable: true },
                    { name: 'user_language', type: 'VARCHAR(50)', nullable: true },
                    { name: 'new_vs_returning', type: 'VARCHAR(50)', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'new_users', type: 'INTEGER', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'technology':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'platform', type: 'VARCHAR(50)', nullable: true },
                    { name: 'device_category', type: 'VARCHAR(50)', nullable: true },
                    { name: 'device_model', type: 'VARCHAR(100)', nullable: true },
                    { name: 'operating_system', type: 'VARCHAR(100)', nullable: true },
                    { name: 'browser', type: 'VARCHAR(100)', nullable: true },
                    { name: 'screen_resolution', type: 'VARCHAR(50)', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    { name: 'screen_page_views', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'first_user_source_medium':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'first_user_source_medium', type: 'VARCHAR(255)', nullable: true },
                    { name: 'first_user_default_channel_group', type: 'VARCHAR(255)', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'new_users', type: 'INTEGER', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    { name: 'conversions', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'landing_pages':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'landing_page', type: 'VARCHAR(2048)', nullable: true },
                    { name: 'session_default_channel_group', type: 'VARCHAR(255)', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'engaged_sessions', type: 'INTEGER', nullable: true },
                    { name: 'conversions', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'search_console':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'organic_google_search_query', type: 'VARCHAR(1024)', nullable: true },
                    { name: 'landing_page', type: 'VARCHAR(2048)', nullable: true },
                    { name: 'organic_google_search_clicks', type: 'INTEGER', nullable: true },
                    { name: 'organic_google_search_impressions', type: 'INTEGER', nullable: true },
                    { name: 'ctr', type: 'DECIMAL(10,4)', nullable: true },
                    { name: 'average_position', type: 'DECIMAL(10,2)', nullable: true },
                    syncedAt,
                ];
            case 'ecommerce':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'item_name', type: 'VARCHAR(512)', nullable: true },
                    { name: 'item_category', type: 'VARCHAR(255)', nullable: true },
                    { name: 'item_id', type: 'VARCHAR(255)', nullable: true },
                    { name: 'item_revenue', type: 'DECIMAL(15,2)', nullable: true },
                    { name: 'items_purchased', type: 'INTEGER', nullable: true },
                    { name: 'item_purchase_quantity', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            case 'revenue':
                return [
                    ...base,
                    { name: 'row_key', type: 'VARCHAR(32)', nullable: false },
                    { name: 'date', type: 'DATE', nullable: false },
                    { name: 'session_default_channel_group', type: 'VARCHAR(255)', nullable: true },
                    { name: 'total_revenue', type: 'DECIMAL(15,2)', nullable: true },
                    { name: 'item_revenue', type: 'DECIMAL(15,2)', nullable: true },
                    { name: 'purchase_revenue', type: 'DECIMAL(15,2)', nullable: true },
                    { name: 'ecommerce_purchases', type: 'INTEGER', nullable: true },
                    { name: 'total_users', type: 'INTEGER', nullable: true },
                    { name: 'sessions', type: 'INTEGER', nullable: true },
                    syncedAt,
                ];
            default:
                return [];
        }
    }

    public async getLastSyncTime(dataSourceId: number): Promise<Date | null> {
        const lastSync = await this.syncHistoryService.getLastSync(dataSourceId);
        return lastSync?.completedAt || null;
    }

    public async getSyncHistory(dataSourceId: number, limit: number = 10): Promise<any[]> {
        return await this.syncHistoryService.getSyncHistory(dataSourceId, limit);
    }
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

/**
 * GA4 returns the `date` dimension in YYYYMMDD form. Normalize to ISO YYYY-MM-DD.
 */
function toIsoDate(value: any): string | null {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (!s) return null;
    if (/^\d{8}$/.test(s)) {
        return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    return s;
}

/**
 * Normalize a GA4 dimension value. GA4 reports "(not set)" for missing
 * dimension values; coerce empty strings to the fallback so unique/conflict
 * key columns are never NULL.
 */
function toStringValue(value: any, fallback: string): string {
    if (value === null || value === undefined) return fallback;
    const s = String(value).trim();
    return s.length > 0 ? s : fallback;
}

function toNumber(value: any, fallback: number = 0): number {
    if (value === null || value === undefined || value === '') return fallback;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse a numeric value, preserving absence as null so downstream consumers can
 * distinguish "not synced yet" from a genuine 0 (e.g. sessionKeyEventRate).
 */
function toNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a cross-source campaign join key.
 *
 * Priority (first non-empty wins):
 * 1. Google Ads campaign ID (matches `google_ads.campaigns.campaign_id`)
 * 2. `utm_id` campaign ID (matches Meta/LinkedIn campaign IDs when tagged)
 * 3. `source::campaign_name` fallback (name-based, fuzzy)
 *
 * IDs are stored raw so they join directly to ad-platform campaign tables.
 */
function computeCampaignKey(
    source: string,
    googleAdsCampaignId: string,
    campaignId: string,
    campaignName: string
): string {
    const notSet = '(not set)';
    if (googleAdsCampaignId && googleAdsCampaignId !== notSet) {
        return googleAdsCampaignId;
    }
    if (campaignId && campaignId !== notSet) {
        return campaignId;
    }
    const name = campaignName && campaignName !== notSet ? campaignName : notSet;
    return `${source}::${name}`;
}
