import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { TableMetadataService } from './TableMetadataService.js';
import { GoogleAnalyticsService } from './GoogleAnalyticsService.js';
import { GA4DateRangeService, type GA4DatePreset, type IResolvedDateRange } from './GA4DateRangeService.js';

/**
 * GA4 prebuilt overview report.
 *
 * Reads the aggregate Data API tables (traffic_overview, session_attribution,
 * page_performance, geographic, device, events). No BigQuery layer required.
 */

export interface IOverviewKpis {
    sessions: number;
    users: number;
    newUsers: number;
    pageViews: number;
    averageSessionDuration: number;
    /** Percentage (0-100). */
    bounceRate: number;
    engagementRate: number;
    conversions: number;
}

export interface IOverviewChartData {
    categories: string[];
    series: Array<{ name: string; data: number[] }>;
}

export interface IOverviewCategoryValue {
    category: string;
    value: number;
}

export interface IOverviewSource {
    id: number;
    name: string;
    syncWindowDays: number;
}

/** Session-level performance for one channel group (GA4 default channel group). */
export interface IChannelPerformanceRow {
    channel: string;
    sessions: number;
    engagedSessions: number;
    /** Percentage (0-100). */
    engagementRate: number;
    /** Average engagement time per session, in seconds. */
    avgEngagementTimePerSession: number;
    keyEvents: number;
    /** Percentage (0-100). */
    sessionKeyEventRate: number;
    eventCount: number;
    /** Events per session (GA4 "events per session"). */
    eventsPerSession: number;
    totalRevenue: number;
    purchases: number;
    revenuePerSession: number;
}

/** Session-level performance for a campaign, landing page or source/medium. */
export interface IAcquisitionPerformanceRow {
    name: string;
    secondary?: string;
    sessions: number;
    engagedSessions: number;
    /** Percentage (0-100). */
    engagementRate: number;
    keyEvents: number;
    /** Percentage (0-100). */
    sessionKeyEventRate: number;
    totalRevenue?: number;
    revenuePerSession?: number;
}

export interface IOrganicSearchRow {
    landingPage: string;
    clicks: number;
    impressions: number;
    /** Click-through rate as a percentage (0-100). */
    ctr: number;
    /** Impression-weighted average position. */
    averagePosition: number;
}

export interface IOverviewResult {
    kpis: IOverviewKpis;
    trend: IOverviewChartData;
    channels: IOverviewCategoryValue[];
    sources: IOverviewCategoryValue[];
    pages: IOverviewCategoryValue[];
    countries: IOverviewCategoryValue[];
    devices: IOverviewCategoryValue[];
    events: IOverviewCategoryValue[];
    // Bucket 1 — derivable from existing tables
    newUsersByChannel: IOverviewCategoryValue[];
    keyEventsByChannel: IOverviewCategoryValue[];
    engagementByFirstSource: IOverviewCategoryValue[];
    sessionKeyEventRate: IOverviewCategoryValue[];
    eventConversions: IOverviewCategoryValue[];
    activeUsersByCountry: IOverviewCategoryValue[];
    activeUsersByCity: IOverviewCategoryValue[];
    activeUsersByDevice: IOverviewCategoryValue[];
    activeUsersByOs: IOverviewCategoryValue[];
    activeUsersByBrowser: IOverviewCategoryValue[];
    pageTitleViews: IOverviewCategoryValue[];
    // Bucket 2 — new aggregate tables
    ageUsers: IOverviewCategoryValue[];
    genderUsers: IOverviewCategoryValue[];
    languageUsers: IOverviewCategoryValue[];
    newVsReturning: IOverviewCategoryValue[];
    platformUsers: IOverviewCategoryValue[];
    deviceModelUsers: IOverviewCategoryValue[];
    screenResolutionUsers: IOverviewCategoryValue[];
    firstUserSourceMedium: Array<{ category: string; users: number; newUsers: number; sessions: number; conversions: number }>;
    landingPages: IOverviewCategoryValue[];
    searchQueries: IOverviewCategoryValue[];
    searchImpressions: IOverviewCategoryValue[];
    itemsByName: IOverviewCategoryValue[];
    revenueByCategory: IOverviewCategoryValue[];
    quantityByProductId: IOverviewCategoryValue[];
    revenueKpis: {
        totalRevenue: number;
        itemRevenue: number;
        purchaseRevenue: number;
        ecommercePurchases: number;
        arpu: number;
        arppu: number;
        purchaserRate: number;
    };
    avgEngagementTimePerActiveUser: number;
    // Acquisition — channel, campaign, landing page and source performance
    channelPerformance: IChannelPerformanceRow[];
    channelTrend: IOverviewChartData;
    revenueByChannelTrend: IOverviewChartData;
    paidOrganicSplit: IOverviewCategoryValue[];
    campaignPerformance: IAcquisitionPerformanceRow[];
    landingPagePerformance: IAcquisitionPerformanceRow[];
    sourceMediumPerformance: IAcquisitionPerformanceRow[];
    newUsersByChannelTrend: IOverviewChartData;
    channelEfficiency: Array<{ label: string; x: number; y: number; value: number }>;
    eventValueByEvent: IOverviewCategoryValue[];
    keyEventsByCountry: IOverviewCategoryValue[];
    keyEventsByDevice: IOverviewCategoryValue[];
    organicSearchPerformance: IOrganicSearchRow[];
    organicSearchTrend: IOverviewChartData;
}

const GA_SCHEMA = 'dra_google_analytics';

/**
 * "Engaged traffic" filter definition. It combines source/medium exclusions
 * with per-session quality thresholds so low-engagement sessions and suspected
 * bots/crawlers are dropped from the breakdowns. These are code constants
 * (never user input) so they are safe to inline into SQL.
 */
const ENGAGED_EXCLUDED_SOURCES = ['accounts.google.com'];
const ENGAGED_EXCLUDED_MEDIUMS = ['referral'];
/** Minimum engagement time per session, in seconds. */
const ENGAGED_MIN_SECONDS_PER_SESSION = 10;
/** Minimum engaged-session rate (engaged_sessions / sessions). */
const ENGAGED_MIN_ENGAGEMENT_RATE = 0.1;

/**
 * Logical tables whose category/value columns also live in the combined
 * `session_breakdown` table, so their breakdowns can be filtered. Datasets not
 * listed here (events, demographics, technology, page performance, revenue,
 * search console, ecommerce, first-user source) do not carry the session
 * source dimension and cannot be filtered.
 */
const BREAKDOWN_TABLES = new Set(['geographic', 'device', 'session_attribution', 'landing_pages']);

/** A resolved engaged-traffic table and its extra WHERE fragment. */
interface IBreakdownSource {
    full: string;
    where: string;
}

export class GA4OverviewService {
    private static instance: GA4OverviewService;
    private readonly tableMetadataService = TableMetadataService.getInstance();

    /** Short-lived cache for live GA4 totals so preset toggles stay fast. */
    private readonly liveCache = new Map<string, { expires: number; value: Awaited<ReturnType<GA4OverviewService['fetchLiveTotalsAndTrend']>> }>();
    private static readonly LIVE_CACHE_TTL_MS = 5 * 60 * 1000;

    static getInstance(): GA4OverviewService {
        if (!GA4OverviewService.instance) {
            GA4OverviewService.instance = new GA4OverviewService();
        }
        return GA4OverviewService.instance;
    }

    /**
     * Resolve the date range for a project from a preset (or explicit dates)
     * and return the overview. This is the entry point used by the acquisition
     * page — it reads the GA4 Data API aggregate tables only.
     */
    async getOverviewForPreset(
        projectId: number,
        preset: GA4DatePreset = 'last_90_days',
        startDate?: string,
        endDate?: string,
        dataSourceId?: number,
        engagedTrafficOnly: boolean = true,
    ): Promise<{
        range: IResolvedDateRange;
        dataSources: IOverviewSource[];
        dataSourceId: number | null;
    } & IOverviewResult> {
        const manager = AppDataSource.manager;
        const dataSources = await manager.find(DRADataSource, {
            where: { project: { id: projectId }, data_type: EDataSourceType.GOOGLE_ANALYTICS },
            order: { id: 'ASC' },
        });

        // Every GA4 property connected to the project, exposed so the UI can
        // offer a property selector. Falls back to the first property.
        const availableSources: IOverviewSource[] = dataSources.map(ds => ({
            id: ds.id,
            name: ds.name,
            syncWindowDays: Number(
                (ds.connection_details as any)?.api_connection_details?.api_config?.sync_window_days,
            ) || 365,
        }));
        const selectedId = (dataSourceId != null
            ? availableSources.find(s => s.id === dataSourceId)?.id
            : undefined) ?? availableSources[0]?.id ?? null;

        const tz = dataSources[0]?.connection_details?.api_connection_details?.api_config?.property_timezone || 'UTC';
        const range = GA4DateRangeService.resolvePreset(
            preset,
            tz,
            new Date(),
            startDate && endDate ? { start: startDate, end: endDate } : undefined,
        );
        const overview = await this.getOverview(projectId, range.start, range.end, selectedId ?? undefined, engagedTrafficOnly);
        return { range, dataSources: availableSources, dataSourceId: selectedId, ...overview };
    }

    async getOverview(
        projectId: number,
        start: string,
        end: string,
        dataSourceId?: number,
        engagedTrafficOnly: boolean = true,
    ): Promise<IOverviewResult> {
        const manager = AppDataSource.manager;
        const allSources = await manager.find(DRADataSource, {
            where: { project: { id: projectId }, data_type: EDataSourceType.GOOGLE_ANALYTICS },
        });
        // When a specific property is selected, aggregate only that one so
        // multiple GA4 properties are never blended together.
        const dataSources = dataSourceId != null
            ? allSources.filter(ds => ds.id === dataSourceId)
            : allSources;

        const kpis: IOverviewKpis = {
            sessions: 0, users: 0, newUsers: 0, pageViews: 0,
            averageSessionDuration: 0, bounceRate: 0, engagementRate: 0, conversions: 0,
        };
        const byDate = new Map<string, { sessions: number; users: number; newUsers: number }>();
        const channels = new Map<string, number>();
        const sources = new Map<string, number>();
        const pages = new Map<string, number>();
        const countries = new Map<string, number>();
        const devices = new Map<string, number>();
        const events = new Map<string, number>();
        let engagedSessions = 0;
        let totalSessions = 0;
        let totalConversions = 0;

        const newUsersByChannel = new Map<string, number>();
        const keyEventsByChannel = new Map<string, number>();
        const engagementAcc = new Map<string, { weighted: number; sessions: number }>();
        const skrAcc = new Map<string, { sessions: number; conversions: number }>();
        const eventConversions = new Map<string, number>();
        const activeUsersByCountry = new Map<string, number>();
        const activeUsersByCity = new Map<string, number>();
        const activeUsersByDevice = new Map<string, number>();
        const activeUsersByOs = new Map<string, number>();
        const activeUsersByBrowser = new Map<string, number>();
        const pageTitleViews = new Map<string, number>();
        const ageUsers = new Map<string, number>();
        const genderUsers = new Map<string, number>();
        const languageUsers = new Map<string, number>();
        const newVsReturning = new Map<string, number>();
        const platformUsers = new Map<string, number>();
        const deviceModelUsers = new Map<string, number>();
        const screenResolutionUsers = new Map<string, number>();
        const fusmAcc = new Map<string, { users: number; newUsers: number; sessions: number; conversions: number }>();
        const landingPages = new Map<string, number>();
        const searchQueries = new Map<string, number>();
        const searchImpressions = new Map<string, number>();
        const itemsByName = new Map<string, number>();
        const revenueByCategory = new Map<string, number>();
        const quantityByProductId = new Map<string, number>();
        let totalRevenue = 0;
        let itemRevenueTotal = 0;
        let purchaseRevenueTotal = 0;
        let ecommercePurchases = 0;
        let totalUsersAll = 0;
        let userEngagementDurationTotal = 0;

        // Acquisition breakdowns (merged across every selected property).
        const channelPerf = new Map<string, { sessions: number; engagedSessions: number; keyEvents: number; eventCount: number; engagementDuration: number }>();
        const channelRevenue = new Map<string, { revenue: number; purchases: number }>();
        const channelTrendMap = new Map<string, Map<string, number>>();
        const revenueChannelTrendMap = new Map<string, Map<string, number>>();
        const campaignPerf = new Map<string, { name: string; secondary: string; sessions: number; engagedSessions: number; keyEvents: number; totalRevenue: number }>();
        const landingPerf = new Map<string, { sessions: number; engagedSessions: number; keyEvents: number }>();
        const sourceMediumPerf = new Map<string, { sessions: number; engagedSessions: number; keyEvents: number }>();
        const newUsersChannelTrendMap = new Map<string, Map<string, number>>();
        const eventValue = new Map<string, number>();
        const keyEventsByCountry = new Map<string, number>();
        const keyEventsByDevice = new Map<string, number>();
        const organicSearch = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();
        const organicSearchByDate = new Map<string, { clicks: number; impressions: number }>();

        // Kick off the exact-totals query in parallel with the synced
        // aggregation so the extra API round-trip overlaps local DB work.
        // These live KPI totals are intentionally unfiltered (the engaged
        // traffic filter cannot be expressed on a no-dimension report); the
        // UI shows a disclaimer on the cards.
        const liveTotalsPromise = this.fetchLiveTotalsAndTrend(dataSources, start, end);

        // Set when at least one selected source has a synced session_breakdown,
        // so the trend chart can use the filtered aggregate.
        let breakdownAvailable = false;

        for (const ds of dataSources) {
            // When the engaged-traffic filter is on, session-scoped metrics are
            // read from the combined session_breakdown table so the quality
            // thresholds and source exclusions apply to device/geography/
            // landing/campaign breakdowns too. Datasets without a source
            // dimension fall back to their own (unfiltered) tables.
            const bd = await this.resolveBreakdownSource(manager, ds.id, engagedTrafficOnly);
            if (bd) breakdownAvailable = true;

            await this.aggregateTraffic(manager, ds.id, start, end, kpis, byDate, channels, sources, bd);
            await this.aggregateAttribution(manager, ds.id, start, end, (e, s, c) => {
                engagedSessions += e;
                totalSessions += s;
                totalConversions += c;
            }, bd);
            await this.aggregateDimension(manager, ds.id, 'page_performance', 'page_path', 'screen_page_views', pages, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'geographic', 'country', 'sessions', countries, true, start, end, bd);
            await this.aggregateDimension(manager, ds.id, 'device', 'device_category', 'sessions', devices, true, start, end, bd);
            await this.aggregateDimension(manager, ds.id, 'events', 'event_name', 'event_count', events, true, start, end);

            // Bucket 1 — derivable from existing tables
            await this.aggregateDimension(manager, ds.id, 'user_acquisition', 'first_user_default_channel_group', 'new_users', newUsersByChannel, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'session_attribution', 'session_default_channel_group', 'conversions', keyEventsByChannel, true, start, end, bd);
            await this.aggregateDimension(manager, ds.id, 'events', 'event_name', 'conversions', eventConversions, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'geographic', 'country', 'total_users', activeUsersByCountry, true, start, end, bd);
            await this.aggregateDimension(manager, ds.id, 'geographic', 'city', 'total_users', activeUsersByCity, true, start, end, bd);
            await this.aggregateDimension(manager, ds.id, 'device', 'device_category', 'total_users', activeUsersByDevice, true, start, end, bd);
            await this.aggregateDimension(manager, ds.id, 'device', 'operating_system', 'total_users', activeUsersByOs, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'device', 'browser', 'total_users', activeUsersByBrowser, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'page_performance', 'page_title', 'screen_page_views', pageTitleViews, true, start, end);
            await this.aggregateEngagementByFirstSource(manager, ds.id, start, end, engagementAcc);
            await this.aggregateSessionKeyEventRate(manager, ds.id, start, end, skrAcc, bd);

            // Bucket 2 — new aggregate tables
            await this.aggregateDimension(manager, ds.id, 'demographics', 'user_age_bracket', 'total_users', ageUsers, false);
            await this.aggregateDimension(manager, ds.id, 'demographics', 'user_gender', 'total_users', genderUsers, false);
            await this.aggregateDimension(manager, ds.id, 'demographics', 'user_language', 'total_users', languageUsers, false);
            await this.aggregateDimension(manager, ds.id, 'demographics', 'new_vs_returning', 'total_users', newVsReturning, false);
            await this.aggregateDimension(manager, ds.id, 'technology', 'platform', 'total_users', platformUsers, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'technology', 'device_model', 'total_users', deviceModelUsers, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'technology', 'screen_resolution', 'total_users', screenResolutionUsers, true, start, end);
            await this.aggregateFirstUserSourceMedium(manager, ds.id, start, end, fusmAcc, bd);
            await this.aggregateDimension(manager, ds.id, 'landing_pages', 'landing_page', 'sessions', landingPages, true, start, end, bd);
            await this.aggregateDimension(manager, ds.id, 'search_console', 'landing_page', 'organic_google_search_clicks', searchQueries, false);
            await this.aggregateDimension(manager, ds.id, 'search_console', 'landing_page', 'organic_google_search_impressions', searchImpressions, false);
            await this.aggregateDimension(manager, ds.id, 'ecommerce', 'item_name', 'items_purchased', itemsByName, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'ecommerce', 'item_category', 'item_revenue', revenueByCategory, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'ecommerce', 'item_id', 'item_purchase_quantity', quantityByProductId, true, start, end);
            await this.aggregateRevenue(manager, ds.id, start, end, r => {
                totalRevenue += r.totalRevenue;
                purchaseRevenueTotal += r.purchaseRevenue;
                ecommercePurchases += r.ecommercePurchases;
                totalUsersAll += r.totalUsers;
            });
            await this.aggregateEngagementDuration(manager, ds.id, start, end, d => {
                userEngagementDurationTotal += d;
            });

            // Acquisition — channel, campaign, landing page and source views
            await this.aggregateChannelPerformance(manager, ds.id, start, end, channelPerf, channelRevenue, bd);
            await this.aggregateChannelTrend(manager, ds.id, start, end, channelTrendMap, bd);
            await this.aggregateRevenueChannelTrend(manager, ds.id, start, end, revenueChannelTrendMap, bd);
            await this.aggregateCampaignPerformance(manager, ds.id, start, end, campaignPerf, bd);
            await this.aggregateLandingPagePerformance(manager, ds.id, start, end, landingPerf, bd);
            await this.aggregateSourceMediumPerformance(manager, ds.id, start, end, sourceMediumPerf, bd);
            await this.aggregateNewUsersChannelTrend(manager, ds.id, start, end, newUsersChannelTrendMap, bd);
            await this.aggregateEventValue(manager, ds.id, start, end, eventValue);
            await this.aggregateDimension(manager, ds.id, 'geographic', 'country', 'conversions', keyEventsByCountry, true, start, end, bd);
            await this.aggregateDimension(manager, ds.id, 'device', 'device_category', 'conversions', keyEventsByDevice, true, start, end, bd);
            await this.aggregateOrganicSearch(manager, ds.id, start, end, organicSearch, organicSearchByDate);
        }

        for (const v of revenueByCategory.values()) itemRevenueTotal += v;

        // Synced fallback KPIs (used only when the live totals query fails).
        if (totalSessions > 0) kpis.engagementRate = Math.round((engagedSessions / totalSessions) * 1000) / 10;
        if (totalConversions > 0) kpis.conversions = totalConversions;
        if (kpis.sessions > 0) {
            kpis.averageSessionDuration = Math.round((kpis.averageSessionDuration / kpis.sessions) * 100) / 100;
            // Stored bounce_rate is a 0..1 fraction; expose a percentage.
            kpis.bounceRate = Math.round((kpis.bounceRate / kpis.sessions) * 1000) / 10;
        }

        // Exact KPI totals: query GA4 with no dimensions so non-additive
        // metrics (totalUsers in particular) are deduplicated for the whole
        // range instead of being summed across pre-aggregated
        // source/medium/campaign/channel rows. Falls back to the synced
        // aggregates above when the API is unavailable.
        const live = await liveTotalsPromise;
        if (live) {
            kpis.sessions = live.totals.sessions;
            kpis.users = live.totals.users;
            kpis.newUsers = live.totals.newUsers;
            kpis.pageViews = live.totals.pageViews;
            kpis.conversions = live.totals.conversions;
            if (live.totals.sessions > 0) {
                kpis.averageSessionDuration = Math.round((live.totals.durationTotal / live.totals.sessions) * 100) / 100;
                kpis.bounceRate = Math.round((live.totals.bounceTotal / live.totals.sessions) * 1000) / 10;
                kpis.engagementRate = Math.round((live.totals.engagedSessions / live.totals.sessions) * 1000) / 10;
            } else {
                kpis.averageSessionDuration = 0;
                kpis.bounceRate = 0;
                kpis.engagementRate = 0;
            }
        }

        const engagementByFirstSource = new Map<string, number>();
        for (const [k, v] of engagementAcc.entries()) {
            engagementByFirstSource.set(k, v.sessions > 0 ? Math.round((v.weighted / v.sessions) * 10) / 10 : 0);
        }
        const sessionKeyEventRate = new Map<string, number>();
        for (const [k, v] of skrAcc.entries()) {
            sessionKeyEventRate.set(k, v.sessions > 0 ? Math.round((v.conversions / v.sessions) * 1000) / 10 : 0);
        }
        const firstUserSourceMedium = Array.from(fusmAcc.entries())
            .map(([category, r]) => ({
                category,
                users: r.users,
                newUsers: r.newUsers,
                sessions: r.sessions,
                conversions: r.conversions,
            }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 20);

        const revenueKpis = {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            itemRevenue: Math.round(itemRevenueTotal * 100) / 100,
            purchaseRevenue: Math.round(purchaseRevenueTotal * 100) / 100,
            ecommercePurchases,
            arpu: totalUsersAll > 0 ? Math.round((totalRevenue / totalUsersAll) * 100) / 100 : 0,
            arppu: ecommercePurchases > 0 ? Math.round((purchaseRevenueTotal / ecommercePurchases) * 100) / 100 : 0,
            purchaserRate: totalUsersAll > 0 ? Math.round((ecommercePurchases / totalUsersAll) * 1000) / 10 : 0,
        };
        const avgEngagementTimePerActiveUser = totalUsersAll > 0
            ? Math.round((userEngagementDurationTotal / totalUsersAll) * 10) / 10
            : 0;

        const pct = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
        const avg = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 10) / 10 : 0);

        const channelPerformance: IChannelPerformanceRow[] = Array.from(channelPerf.entries())
            .map(([channel, p]) => {
                const rev = channelRevenue.get(channel) || { revenue: 0, purchases: 0 };
                return {
                    channel,
                    sessions: p.sessions,
                    engagedSessions: p.engagedSessions,
                    engagementRate: pct(p.engagedSessions, p.sessions),
                    avgEngagementTimePerSession: avg(p.engagementDuration, p.sessions),
                    keyEvents: p.keyEvents,
                    sessionKeyEventRate: pct(p.keyEvents, p.sessions),
                    eventCount: p.eventCount,
                    eventsPerSession: avg(p.eventCount, p.sessions),
                    totalRevenue: Math.round(rev.revenue * 100) / 100,
                    purchases: rev.purchases,
                    revenuePerSession: avg(rev.revenue, p.sessions),
                };
            })
            .sort((a, b) => b.sessions - a.sessions);

        // Roll the channel groups into a paid / organic / other split. This is
        // how a performance marketer reads "are we buying traffic or earning it".
        const paidOrganic = { Paid: 0, Organic: 0, Other: 0 };
        for (const row of channelPerformance) {
            const channel = row.channel.toLowerCase();
            if (channel.startsWith('paid') || channel === 'cross-network' || channel === 'display' || channel === 'video') {
                paidOrganic.Paid += row.sessions;
            } else if (channel.startsWith('organic')) {
                paidOrganic.Organic += row.sessions;
            } else {
                paidOrganic.Other += row.sessions;
            }
        }
        const paidOrganicSplit: IOverviewCategoryValue[] = Object.entries(paidOrganic)
            .map(([category, value]) => ({ category, value }))
            .filter(r => r.value > 0);

        const campaignPerformance: IAcquisitionPerformanceRow[] = Array.from(campaignPerf.values())
            .map(r => ({
                name: r.name,
                secondary: r.secondary,
                sessions: r.sessions,
                engagedSessions: r.engagedSessions,
                engagementRate: pct(r.engagedSessions, r.sessions),
                keyEvents: r.keyEvents,
                sessionKeyEventRate: pct(r.keyEvents, r.sessions),
                totalRevenue: Math.round(r.totalRevenue * 100) / 100,
                revenuePerSession: avg(r.totalRevenue, r.sessions),
            }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 20);

        const landingPagePerformance: IAcquisitionPerformanceRow[] = Array.from(landingPerf.entries())
            .map(([name, r]) => ({
                name,
                sessions: r.sessions,
                engagedSessions: r.engagedSessions,
                engagementRate: pct(r.engagedSessions, r.sessions),
                keyEvents: r.keyEvents,
                sessionKeyEventRate: pct(r.keyEvents, r.sessions),
            }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 20);

        const sourceMediumPerformance: IAcquisitionPerformanceRow[] = Array.from(sourceMediumPerf.entries())
            .map(([name, r]) => ({
                name,
                sessions: r.sessions,
                engagedSessions: r.engagedSessions,
                engagementRate: pct(r.engagedSessions, r.sessions),
                keyEvents: r.keyEvents,
                sessionKeyEventRate: pct(r.keyEvents, r.sessions),
            }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 20);

        const channelEfficiency = channelPerformance
            .filter(r => r.sessions > 0)
            .map(r => ({
                label: r.channel,
                x: r.sessions,
                y: r.sessionKeyEventRate,
                value: r.keyEvents,
            }));

        const eventValueByEvent = Array.from(eventValue.entries())
            .map(([category, value]) => ({ category, value: Math.round(value * 100) / 100 }))
            .filter(r => r.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        const organicSearchPerformance: IOrganicSearchRow[] = Array.from(organicSearch.entries())
            .map(([landingPage, r]) => ({
                landingPage,
                clicks: r.clicks,
                impressions: r.impressions,
                ctr: r.impressions > 0 ? Math.round((r.clicks / r.impressions) * 10000) / 100 : 0,
                averagePosition: r.impressions > 0 ? Math.round((r.positionWeighted / r.impressions) * 10) / 10 : 0,
            }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 20);

        const organicSearchDates = Array.from(organicSearchByDate.keys()).sort();
        const organicSearchTrend: IOverviewChartData = {
            categories: organicSearchDates.map((key) => {
                const [, m, d] = key.split('-');
                return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
            }),
            series: [
                { name: 'Clicks', data: organicSearchDates.map(k => organicSearchByDate.get(k)!.clicks) },
                { name: 'Impressions', data: organicSearchDates.map(k => organicSearchByDate.get(k)!.impressions) },
            ],
        };

        return {
            kpis,
            trend: this.buildTrend(engagedTrafficOnly && breakdownAvailable ? byDate : (live ? live.byDate : byDate)),
            channels: this.toSorted(channels, 10),
            sources: this.toSorted(sources, 10),
            pages: this.toSorted(pages, 10),
            countries: this.toSorted(countries, 10),
            devices: this.toSorted(devices, 10),
            events: this.toSorted(events, 10),
            newUsersByChannel: this.toSorted(newUsersByChannel, 10),
            keyEventsByChannel: this.toSorted(keyEventsByChannel, 10),
            engagementByFirstSource: this.toSorted(engagementByFirstSource, 10),
            sessionKeyEventRate: this.toSorted(sessionKeyEventRate, 10),
            eventConversions: this.toSorted(eventConversions, 10),
            activeUsersByCountry: this.toSorted(activeUsersByCountry, 10),
            activeUsersByCity: this.toSorted(activeUsersByCity, 10),
            activeUsersByDevice: this.toSorted(activeUsersByDevice, 10),
            activeUsersByOs: this.toSorted(activeUsersByOs, 10),
            activeUsersByBrowser: this.toSorted(activeUsersByBrowser, 10),
            pageTitleViews: this.toSorted(pageTitleViews, 10),
            ageUsers: this.toSorted(ageUsers, 10),
            genderUsers: this.toSorted(genderUsers, 10),
            languageUsers: this.toSorted(languageUsers, 10),
            newVsReturning: this.toSorted(newVsReturning, 10),
            platformUsers: this.toSorted(platformUsers, 10),
            deviceModelUsers: this.toSorted(deviceModelUsers, 10),
            screenResolutionUsers: this.toSorted(screenResolutionUsers, 10),
            firstUserSourceMedium,
            landingPages: this.toSorted(landingPages, 10),
            searchQueries: this.toSorted(searchQueries, 10),
            searchImpressions: this.toSorted(searchImpressions, 10),
            itemsByName: this.toSorted(itemsByName, 10),
            revenueByCategory: this.toSorted(revenueByCategory, 10),
            quantityByProductId: this.toSorted(quantityByProductId, 10),
            revenueKpis,
            avgEngagementTimePerActiveUser,
            channelPerformance,
            channelTrend: this.buildSeriesTrend(channelTrendMap),
            revenueByChannelTrend: this.buildSeriesTrend(revenueChannelTrendMap),
            paidOrganicSplit,
            campaignPerformance,
            landingPagePerformance,
            sourceMediumPerformance,
            newUsersByChannelTrend: this.buildSeriesTrend(newUsersChannelTrendMap),
            channelEfficiency,
            eventValueByEvent,
            keyEventsByCountry: this.toSorted(keyEventsByCountry, 10),
            keyEventsByDevice: this.toSorted(keyEventsByDevice, 10),
            organicSearchPerformance,
            organicSearchTrend,
        };
    }

    // -----------------------------------------------------------------------
    // Data API aggregation
    // -----------------------------------------------------------------------

    /**
     * Extra WHERE fragment for the "engaged traffic" filter: excludes a few
     * non-human source/medium values and drops session groups whose engagement
     * is too low (short time on site and/or few engaged sessions), which is how
     * suspected bots and low-quality traffic surface in GA4. Built from code
     * constants only, so it is safe to inline into SQL.
     * NULLIF guards the division so zero-session groups are excluded rather
     * than raising a division-by-zero error.
     */
    private engagedTrafficWhere(): string {
        const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;
        let where = '';
        if (ENGAGED_EXCLUDED_SOURCES.length > 0) {
            where += ` AND COALESCE(session_source, '') NOT IN (${ENGAGED_EXCLUDED_SOURCES.map(quote).join(', ')})`;
        }
        if (ENGAGED_EXCLUDED_MEDIUMS.length > 0) {
            where += ` AND COALESCE(session_medium, '') NOT IN (${ENGAGED_EXCLUDED_MEDIUMS.map(quote).join(', ')})`;
        }
        where += ` AND (COALESCE(user_engagement_duration, 0)::numeric / NULLIF(sessions, 0)) > ${ENGAGED_MIN_SECONDS_PER_SESSION}`;
        where += ` AND (COALESCE(engaged_sessions, 0)::numeric / NULLIF(sessions, 0)) > ${ENGAGED_MIN_ENGAGEMENT_RATE}`;
        return where;
    }

    /**
     * Resolve the combined `session_breakdown` table for a source when the
     * engaged-traffic filter is enabled. Returns null (no filtering) when the
     * filter is off or the table has not been synced yet, so the page degrades
     * to the unfiltered breakdown tables instead of failing.
     */
    private async resolveBreakdownSource(
        manager: any,
        dataSourceId: number,
        engagedTrafficOnly: boolean,
    ): Promise<IBreakdownSource | null> {
        if (!engagedTrafficOnly) return null;
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_breakdown');
        if (!physical) return null;
        return { full: `"${GA_SCHEMA}"."${physical}"`, where: this.engagedTrafficWhere() };
    }

    private async aggregateTraffic(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        kpis: IOverviewKpis,
        byDate: Map<string, { sessions: number; users: number; newUsers: number }>,
        channels: Map<string, number>,
        sources: Map<string, number>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'traffic_overview');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }

        // screen_page_views / average_session_duration / bounce_rate are not in
        // the combined session_breakdown grain, so the synced fallback KPIs
        // (only used when the live GA4 totals call fails) omit them there.
        const extraSelect = bd
            ? ''
            : `, COALESCE(SUM(screen_page_views), 0) AS page_views,
                    COALESCE(SUM(average_session_duration * sessions), 0) AS duration_total,
                    COALESCE(SUM(bounce_rate * sessions), 0) AS bounce_total`;

        try {
            const rows = await manager.query(
                `SELECT
                    COALESCE(SUM(sessions), 0) AS sessions,
                    COALESCE(SUM(total_users), 0) AS users,
                    COALESCE(SUM(new_users), 0) AS new_users
                    ${extraSelect}
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}`,
                [start, end],
            );
            const r = rows?.[0];
            if (r) {
                kpis.sessions += Number(r.sessions) || 0;
                kpis.users += Number(r.users) || 0;
                kpis.newUsers += Number(r.new_users) || 0;
                kpis.pageViews += Number(r.page_views) || 0;
                kpis.averageSessionDuration += Number(r.duration_total) || 0;
                kpis.bounceRate += Number(r.bounce_total) || 0;
            }

            const dates = await manager.query(
                `SELECT date,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(total_users), 0) AS users,
                        COALESCE(SUM(new_users), 0) AS new_users
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                 GROUP BY date
                 ORDER BY date ASC`,
                [start, end],
            );
            for (const row of dates || []) {
                const key = this.isoDate(row.date);
                const cur = byDate.get(key) || { sessions: 0, users: 0, newUsers: 0 };
                cur.sessions += Number(row.sessions) || 0;
                cur.users += Number(row.users) || 0;
                cur.newUsers += Number(row.new_users) || 0;
                byDate.set(key, cur);
            }

            await this.groupInto(manager, full, `COALESCE(session_default_channel_group, '(not set)')`, 'sessions', channels, start, end, 'date', where);
            await this.groupInto(manager, full, `COALESCE(session_source, '(not set)') || ' / ' || COALESCE(session_medium, '(not set)')`, 'sessions', sources, start, end, 'date', where);
        } catch (error: any) {
            console.warn(`[GA4Overview] traffic aggregation failed for ${full}:`, error?.message);
        }
    }

    /**
     * Fetch exact KPI totals straight from the GA4 Data API.
     *
     * A no-dimension report returns deduplicated totals for the whole range
     * (the value GA4's own overview cards show), unlike summing the synced
     * `traffic_overview` rows which are split by source/medium/campaign and
     * therefore double-count returning or multi-channel users. The per-day
     * query backs an accurate trend chart. Returns null if any source cannot
     * be queried so the caller can fall back to synced aggregates.
     */
    private async fetchLiveTotalsAndTrend(
        dataSources: DRADataSource[],
        start: string,
        end: string,
    ): Promise<{
        totals: {
            sessions: number;
            users: number;
            newUsers: number;
            pageViews: number;
            durationTotal: number;
            bounceTotal: number;
            engagedSessions: number;
            conversions: number;
        };
        byDate: Map<string, { sessions: number; users: number; newUsers: number }>;
    } | null> {
        if (dataSources.length === 0) return null;

        const cacheKey = `${dataSources.map(d => d.id).join(',')}:${start}:${end}`;
        const cached = this.liveCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            return cached.value;
        }

        const totals = {
            sessions: 0, users: 0, newUsers: 0, pageViews: 0,
            durationTotal: 0, bounceTotal: 0, engagedSessions: 0, conversions: 0,
        };
        const byDate = new Map<string, { sessions: number; users: number; newUsers: number }>();
        const service = GoogleAnalyticsService.getInstance();

        for (const ds of dataSources) {
            const api = (ds.connection_details as any)?.api_connection_details;
            const propertyId = api?.api_config?.property_id;
            if (!api || !propertyId) return null;

            try {
                const [totalsRes, trendRes] = await Promise.all([
                    service.runReport(
                        propertyId,
                        api,
                        [],
                        ['sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'averageSessionDuration', 'bounceRate', 'engagedSessions', 'conversions'],
                        [{ startDate: start, endDate: end }],
                        10,
                    ),
                    service.runReport(
                        propertyId,
                        api,
                        ['date'],
                        ['sessions', 'totalUsers', 'newUsers'],
                        [{ startDate: start, endDate: end }],
                        100000,
                    ),
                ]);

                const trow = totalsRes.rows?.[0];
                if (!trow) return null;
                const tv = (i: number) => Number(trow.metricValues?.[i]?.value) || 0;
                const sessions = tv(0);
                totals.sessions += sessions;
                totals.users += tv(1);
                totals.newUsers += tv(2);
                totals.pageViews += tv(3);
                // averageSessionDuration / bounceRate are per-source averages,
                // so weight them by sessions to combine correctly.
                totals.durationTotal += tv(4) * sessions;
                totals.bounceTotal += tv(5) * sessions;
                totals.engagedSessions += tv(6);
                totals.conversions += tv(7);

                for (const row of trendRes.rows || []) {
                    const key = this.isoDate(row.dimensionValues?.[0]?.value);
                    if (!key) continue;
                    const cur = byDate.get(key) || { sessions: 0, users: 0, newUsers: 0 };
                    cur.sessions += Number(row.metricValues?.[0]?.value) || 0;
                    cur.users += Number(row.metricValues?.[1]?.value) || 0;
                    cur.newUsers += Number(row.metricValues?.[2]?.value) || 0;
                    byDate.set(key, cur);
                }
            } catch (error: any) {
                console.warn('[GA4Overview] live GA4 totals unavailable; using synced aggregates:', error?.message || error);
                return null;
            }
        }

        const value = { totals, byDate };
        this.liveCache.set(cacheKey, { expires: Date.now() + GA4OverviewService.LIVE_CACHE_TTL_MS, value });
        return value;
    }

    private async aggregateAttribution(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        onRow: (engaged: number, sessions: number, conversions: number) => void,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_attribution');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }

        try {
            const rows = await manager.query(
                `SELECT COALESCE(SUM(engaged_sessions), 0) AS engaged,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}`,
                [start, end],
            );
            const r = rows?.[0];
            if (r) onRow(Number(r.engaged) || 0, Number(r.sessions) || 0, Number(r.conversions) || 0);
        } catch (error: any) {
            console.warn(`[GA4Overview] attribution aggregation failed for ${full}:`, error?.message);
        }
    }

    private async aggregateDimension(
        manager: any,
        dataSourceId: number,
        logicalTable: string,
        categoryColumn: string,
        valueColumn: string,
        out: Map<string, number>,
        hasDate: boolean,
        start?: string,
        end?: string,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        // Use the combined session_breakdown table when the filter is on and
        // this dimension is one the breakdown carries (so device/geography/
        // landing/channel breakdowns are source-filtered). Other dimensions
        // (OS, browser, demographics, technology, events, ...) keep their own
        // tables and remain unfiltered.
        const useBreakdown = !!bd && BREAKDOWN_TABLES.has(logicalTable);
        let full: string;
        if (useBreakdown) {
            full = bd!.full;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, logicalTable);
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        const where = (hasDate || useBreakdown) ? `WHERE date BETWEEN $1 AND $2${useBreakdown ? bd!.where : ''}` : '';
        const params = (hasDate || useBreakdown) ? [start, end] : [];

        try {
            const rows = await manager.query(
                `SELECT COALESCE("${categoryColumn}", '(not set)') AS category,
                        COALESCE(SUM("${valueColumn}"), 0) AS value
                 FROM ${full}
                 ${where}
                 GROUP BY category`,
                params,
            );
            for (const row of rows || []) {
                const key = row.category || '(not set)';
                out.set(key, (out.get(key) || 0) + (Number(row.value) || 0));
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] ${logicalTable} aggregation failed for ${full}:`, error?.message);
        }
    }

    // -----------------------------------------------------------------------
    // Bucket 1/2 derived aggregations
    // -----------------------------------------------------------------------

    private async aggregateEngagementByFirstSource(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, { weighted: number; sessions: number }>,
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'user_acquisition');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;
        try {
            const rows = await manager.query(
                `SELECT COALESCE(first_user_source, '(not set)') AS category,
                        COALESCE(SUM(engagement_rate * sessions), 0) AS weighted,
                        COALESCE(SUM(sessions), 0) AS sessions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2
                 GROUP BY category`,
                [start, end],
            );
            for (const row of rows || []) {
                const key = row.category || '(not set)';
                const cur = out.get(key) || { weighted: 0, sessions: 0 };
                cur.weighted += Number(row.weighted) || 0;
                cur.sessions += Number(row.sessions) || 0;
                out.set(key, cur);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] engagement-by-source failed for ${physical}:`, error?.message);
        }
    }

    private async aggregateSessionKeyEventRate(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, { sessions: number; conversions: number }>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_attribution');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        try {
            const rows = await manager.query(
                `SELECT COALESCE(session_source, '(not set)') || ' / ' || COALESCE(session_medium, '(not set)') AS category,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                 GROUP BY category`,
                [start, end],
            );
            for (const row of rows || []) {
                const key = row.category || '(not set)';
                const cur = out.get(key) || { sessions: 0, conversions: 0 };
                cur.sessions += Number(row.sessions) || 0;
                cur.conversions += Number(row.conversions) || 0;
                out.set(key, cur);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] session-key-event-rate failed for ${full}:`, error?.message);
        }
    }

    private async aggregateFirstUserSourceMedium(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, { users: number; newUsers: number; sessions: number; conversions: number }>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        // The combined breakdown carries first_user_source_medium, so the
        // engaged-traffic filter (session source exclusions + engagement
        // thresholds) can be applied to first-touch source/medium too.
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'first_user_source_medium');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        try {
            const rows = await manager.query(
                `SELECT COALESCE(first_user_source_medium, '(not set)') AS category,
                        COALESCE(SUM(total_users), 0) AS users,
                        COALESCE(SUM(new_users), 0) AS new_users,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                 GROUP BY category`,
                [start, end],
            );
            for (const row of rows || []) {
                const key = row.category || '(not set)';
                const cur = out.get(key) || { users: 0, newUsers: 0, sessions: 0, conversions: 0 };
                cur.users += Number(row.users) || 0;
                cur.newUsers += Number(row.new_users) || 0;
                cur.sessions += Number(row.sessions) || 0;
                cur.conversions += Number(row.conversions) || 0;
                out.set(key, cur);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] first-user-source/medium failed for ${full}:`, error?.message);
        }
    }

    private async aggregateRevenue(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        onRow: (r: { totalRevenue: number; purchaseRevenue: number; ecommercePurchases: number; totalUsers: number }) => void,
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'revenue');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;
        try {
            const rows = await manager.query(
                `SELECT COALESCE(SUM(total_revenue), 0) AS total_revenue,
                        COALESCE(SUM(purchase_revenue), 0) AS purchase_revenue,
                        COALESCE(SUM(ecommerce_purchases), 0) AS ecommerce_purchases,
                        COALESCE(SUM(total_users), 0) AS total_users
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2`,
                [start, end],
            );
            const r = rows?.[0];
            if (r) {
                onRow({
                    totalRevenue: Number(r.total_revenue) || 0,
                    purchaseRevenue: Number(r.purchase_revenue) || 0,
                    ecommercePurchases: Number(r.ecommerce_purchases) || 0,
                    totalUsers: Number(r.total_users) || 0,
                });
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] revenue aggregation failed for ${physical}:`, error?.message);
        }
    }

    private async aggregateEngagementDuration(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        onValue: (seconds: number) => void,
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'traffic_overview');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;
        try {
            const rows = await manager.query(
                `SELECT COALESCE(SUM(user_engagement_duration), 0) AS duration
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2`,
                [start, end],
            );
            onValue(Number(rows?.[0]?.duration) || 0);
        } catch (error: any) {
            console.warn(`[GA4Overview] engagement-duration aggregation failed for ${full}:`, error?.message);
        }
    }

    private async aggregateChannelPerformance(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        perf: Map<string, { sessions: number; engagedSessions: number; keyEvents: number; eventCount: number; engagementDuration: number }>,
        revenue: Map<string, { revenue: number; purchases: number }>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        // With the filter on, every channel metric comes from the combined
        // grain in one query (source-filtered). ecommerce_purchases is not in
        // the breakdown, so purchases stay 0 while filtered.
        if (bd) {
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(session_default_channel_group, '(not set)') AS channel,
                            COALESCE(SUM(sessions), 0) AS sessions,
                            COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
                            COALESCE(SUM(conversions), 0) AS conversions,
                            COALESCE(SUM(event_count), 0) AS event_count,
                            COALESCE(SUM(user_engagement_duration), 0) AS duration,
                            COALESCE(SUM(total_revenue), 0) AS revenue
                     FROM ${bd.full}
                     WHERE date BETWEEN $1 AND $2${bd.where}
                     GROUP BY channel`,
                    [start, end],
                );
                for (const row of rows || []) {
                    const key = row.channel || '(not set)';
                    const cur = perf.get(key) || { sessions: 0, engagedSessions: 0, keyEvents: 0, eventCount: 0, engagementDuration: 0 };
                    cur.sessions += Number(row.sessions) || 0;
                    cur.engagedSessions += Number(row.engaged_sessions) || 0;
                    cur.keyEvents += Number(row.conversions) || 0;
                    cur.eventCount += Number(row.event_count) || 0;
                    cur.engagementDuration += Number(row.duration) || 0;
                    perf.set(key, cur);
                    const rev = revenue.get(key) || { revenue: 0, purchases: 0 };
                    rev.revenue += Number(row.revenue) || 0;
                    revenue.set(key, rev);
                }
            } catch (error: any) {
                console.warn(`[GA4Overview] channel performance (breakdown) failed for ${bd.full}:`, error?.message);
            }
            return;
        }

        const sessionTable = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_attribution');
        if (sessionTable) {
            const full = `"${GA_SCHEMA}"."${sessionTable}"`;
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(session_default_channel_group, '(not set)') AS channel,
                            COALESCE(SUM(sessions), 0) AS sessions,
                            COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
                            COALESCE(SUM(conversions), 0) AS conversions
                     FROM ${full}
                     WHERE date BETWEEN $1 AND $2
                     GROUP BY channel`,
                    [start, end],
                );
                for (const row of rows || []) {
                    const key = row.channel || '(not set)';
                    const cur = perf.get(key) || { sessions: 0, engagedSessions: 0, keyEvents: 0, eventCount: 0, engagementDuration: 0 };
                    cur.sessions += Number(row.sessions) || 0;
                    cur.engagedSessions += Number(row.engaged_sessions) || 0;
                    cur.keyEvents += Number(row.conversions) || 0;
                    perf.set(key, cur);
                }
            } catch (error: any) {
                console.warn(`[GA4Overview] channel performance (sessions) failed for ${full}:`, error?.message);
            }

            // event_count is a newer column; keep it isolated so a connection
            // that has not re-synced yet still gets the sessions/engaged data.
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(session_default_channel_group, '(not set)') AS channel,
                            COALESCE(SUM(event_count), 0) AS event_count
                     FROM ${full}
                     WHERE date BETWEEN $1 AND $2
                     GROUP BY channel`,
                    [start, end],
                );
                for (const row of rows || []) {
                    const key = row.channel || '(not set)';
                    const cur = perf.get(key) || { sessions: 0, engagedSessions: 0, keyEvents: 0, eventCount: 0, engagementDuration: 0 };
                    cur.eventCount += Number(row.event_count) || 0;
                    perf.set(key, cur);
                }
            } catch {
                // Column not present until the next sync; event metrics stay 0.
            }
        }

        // Average engagement time per session comes from the session-scoped
        // traffic table, which carries userEngagementDuration by channel group.
        const trafficTable = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'traffic_overview');
        if (trafficTable) {
            const full = `"${GA_SCHEMA}"."${trafficTable}"`;
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(session_default_channel_group, '(not set)') AS channel,
                            COALESCE(SUM(user_engagement_duration), 0) AS duration
                     FROM ${full}
                     WHERE date BETWEEN $1 AND $2
                     GROUP BY channel`,
                    [start, end],
                );
                for (const row of rows || []) {
                    const key = row.channel || '(not set)';
                    const cur = perf.get(key) || { sessions: 0, engagedSessions: 0, keyEvents: 0, eventCount: 0, engagementDuration: 0 };
                    cur.engagementDuration += Number(row.duration) || 0;
                    perf.set(key, cur);
                }
            } catch (error: any) {
                console.warn(`[GA4Overview] channel performance (engagement) failed for ${full}:`, error?.message);
            }
        }

        const revenueTable = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'revenue');
        if (revenueTable) {
            const full = `"${GA_SCHEMA}"."${revenueTable}"`;
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(session_default_channel_group, '(not set)') AS channel,
                            COALESCE(SUM(total_revenue), 0) AS revenue,
                            COALESCE(SUM(ecommerce_purchases), 0) AS purchases
                     FROM ${full}
                     WHERE date BETWEEN $1 AND $2
                     GROUP BY channel`,
                    [start, end],
                );
                for (const row of rows || []) {
                    const key = row.channel || '(not set)';
                    const cur = revenue.get(key) || { revenue: 0, purchases: 0 };
                    cur.revenue += Number(row.revenue) || 0;
                    cur.purchases += Number(row.purchases) || 0;
                    revenue.set(key, cur);
                }
            } catch (error: any) {
                console.warn(`[GA4Overview] channel revenue failed for ${full}:`, error?.message);
            }
        }
    }

    private async aggregateChannelTrend(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, Map<string, number>>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_attribution');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        try {
            const rows = await manager.query(
                `SELECT date,
                        COALESCE(session_default_channel_group, '(not set)') AS channel,
                        COALESCE(SUM(sessions), 0) AS sessions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                 GROUP BY date, channel
                 ORDER BY date ASC`,
                [start, end],
            );
            for (const row of rows || []) {
                this.addSeriesValue(out, row.channel || '(not set)', this.isoDate(row.date), Number(row.sessions) || 0);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] channel trend failed for ${full}:`, error?.message);
        }
    }

    private async aggregateRevenueChannelTrend(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, Map<string, number>>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'revenue');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        try {
            const rows = await manager.query(
                `SELECT date,
                        COALESCE(session_default_channel_group, '(not set)') AS channel,
                        COALESCE(SUM(total_revenue), 0) AS revenue
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                 GROUP BY date, channel
                 ORDER BY date ASC`,
                [start, end],
            );
            for (const row of rows || []) {
                this.addSeriesValue(out, row.channel || '(not set)', this.isoDate(row.date), Number(row.revenue) || 0);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] revenue channel trend failed for ${full}:`, error?.message);
        }
    }

    private async aggregateCampaignPerformance(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, { name: string; secondary: string; sessions: number; engagedSessions: number; keyEvents: number; totalRevenue: number }>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_attribution');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        try {
            const rows = await manager.query(
                `SELECT COALESCE(session_campaign_name, '(not set)') AS campaign,
                        COALESCE(session_source, '(not set)') || ' / ' || COALESCE(session_medium, '(not set)') AS source_medium,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                   AND session_campaign_name IS NOT NULL
                   AND session_campaign_name <> ''
                   AND session_campaign_name <> '(not set)'
                 GROUP BY campaign, source_medium`,
                [start, end],
            );
            for (const row of rows || []) {
                const name = row.campaign || '(not set)';
                const secondary = row.source_medium || '(not set)';
                const key = `${name}\u0000${secondary}`;
                const cur = out.get(key) || { name, secondary, sessions: 0, engagedSessions: 0, keyEvents: 0, totalRevenue: 0 };
                cur.sessions += Number(row.sessions) || 0;
                cur.engagedSessions += Number(row.engaged_sessions) || 0;
                cur.keyEvents += Number(row.conversions) || 0;
                out.set(key, cur);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] campaign performance failed for ${full}:`, error?.message);
        }

        // total_revenue is a newer column; isolate it so older tables still
        // return campaign sessions/engagement.
        try {
            const rows = await manager.query(
                `SELECT COALESCE(session_campaign_name, '(not set)') AS campaign,
                        COALESCE(session_source, '(not set)') || ' / ' || COALESCE(session_medium, '(not set)') AS source_medium,
                        COALESCE(SUM(total_revenue), 0) AS total_revenue
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                   AND session_campaign_name IS NOT NULL
                   AND session_campaign_name <> ''
                   AND session_campaign_name <> '(not set)'
                 GROUP BY campaign, source_medium`,
                [start, end],
            );
            for (const row of rows || []) {
                const name = row.campaign || '(not set)';
                const secondary = row.source_medium || '(not set)';
                const key = `${name}\u0000${secondary}`;
                const cur = out.get(key) || { name, secondary, sessions: 0, engagedSessions: 0, keyEvents: 0, totalRevenue: 0 };
                cur.totalRevenue += Number(row.total_revenue) || 0;
                out.set(key, cur);
            }
        } catch {
            // Column not present until the next sync; revenue stays 0.
        }
    }

    private async aggregateLandingPagePerformance(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, { sessions: number; engagedSessions: number; keyEvents: number }>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'landing_pages');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        try {
            const rows = await manager.query(
                `SELECT COALESCE(landing_page, '(not set)') AS landing_page,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                 GROUP BY landing_page`,
                [start, end],
            );
            for (const row of rows || []) {
                const key = row.landing_page || '(not set)';
                const cur = out.get(key) || { sessions: 0, engagedSessions: 0, keyEvents: 0 };
                cur.sessions += Number(row.sessions) || 0;
                cur.engagedSessions += Number(row.engaged_sessions) || 0;
                cur.keyEvents += Number(row.conversions) || 0;
                out.set(key, cur);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] landing page performance failed for ${full}:`, error?.message);
        }
    }

    private async aggregateSourceMediumPerformance(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, { sessions: number; engagedSessions: number; keyEvents: number }>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_attribution');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        try {
            const rows = await manager.query(
                `SELECT COALESCE(session_source, '(not set)') || ' / ' || COALESCE(session_medium, '(not set)') AS source_medium,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(engaged_sessions), 0) AS engaged_sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                 GROUP BY source_medium`,
                [start, end],
            );
            for (const row of rows || []) {
                const key = row.source_medium || '(not set)';
                const cur = out.get(key) || { sessions: 0, engagedSessions: 0, keyEvents: 0 };
                cur.sessions += Number(row.sessions) || 0;
                cur.engagedSessions += Number(row.engaged_sessions) || 0;
                cur.keyEvents += Number(row.conversions) || 0;
                out.set(key, cur);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] source/medium performance failed for ${full}:`, error?.message);
        }
    }

    private async aggregateNewUsersChannelTrend(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, Map<string, number>>,
        bd: IBreakdownSource | null = null,
    ): Promise<void> {
        // When filtered, new users are attributed to the session channel group
        // (the breakdown grain) rather than first-user channel group.
        const channelCol = bd ? 'session_default_channel_group' : 'first_user_default_channel_group';
        let full: string;
        let where = '';
        if (bd) {
            full = bd.full;
            where = bd.where;
        } else {
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'user_acquisition');
            if (!physical) return;
            full = `"${GA_SCHEMA}"."${physical}"`;
        }
        try {
            const rows = await manager.query(
                `SELECT date,
                        COALESCE(${channelCol}, '(not set)') AS channel,
                        COALESCE(SUM(new_users), 0) AS new_users
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2${where}
                 GROUP BY date, channel
                 ORDER BY date ASC`,
                [start, end],
            );
            for (const row of rows || []) {
                this.addSeriesValue(out, row.channel || '(not set)', this.isoDate(row.date), Number(row.new_users) || 0);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] new-users channel trend failed for ${full}:`, error?.message);
        }
    }

    private async aggregateEventValue(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, number>,
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'events');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;
        try {
            const rows = await manager.query(
                `SELECT COALESCE(event_name, '(not set)') AS event_name,
                        COALESCE(SUM(event_value), 0) AS event_value
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2
                 GROUP BY event_name`,
                [start, end],
            );
            for (const row of rows || []) {
                const key = row.event_name || '(not set)';
                out.set(key, (out.get(key) || 0) + (Number(row.event_value) || 0));
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] event value failed for ${full}:`, error?.message);
        }
    }

    private async aggregateOrganicSearch(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, { clicks: number; impressions: number; positionWeighted: number }>,
        byDate: Map<string, { clicks: number; impressions: number }>,
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'search_console');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;
        try {
            const rows = await manager.query(
                `SELECT COALESCE(landing_page, '(not set)') AS landing_page,
                        COALESCE(SUM(organic_google_search_clicks), 0) AS clicks,
                        COALESCE(SUM(organic_google_search_impressions), 0) AS impressions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2
                 GROUP BY landing_page`,
                [start, end],
            );
            for (const row of rows || []) {
                const key = row.landing_page || '(not set)';
                const cur = out.get(key) || { clicks: 0, impressions: 0, positionWeighted: 0 };
                cur.clicks += Number(row.clicks) || 0;
                cur.impressions += Number(row.impressions) || 0;
                out.set(key, cur);
            }
        } catch (error: any) {
            console.warn(`[GA4Overview] organic search failed for ${full}:`, error?.message);
        }

        // average_position is a newer column; keep it isolated.
        try {
            const rows = await manager.query(
                `SELECT COALESCE(landing_page, '(not set)') AS landing_page,
                        COALESCE(SUM(average_position * organic_google_search_impressions), 0) AS position_weighted
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2
                 GROUP BY landing_page`,
                [start, end],
            );
            for (const row of rows || []) {
                const key = row.landing_page || '(not set)';
                const cur = out.get(key) || { clicks: 0, impressions: 0, positionWeighted: 0 };
                cur.positionWeighted += Number(row.position_weighted) || 0;
                out.set(key, cur);
            }
        } catch {
            // Column not present until the next sync; position stays 0.
        }

        // The date column is added with the newer schema; skip the trend if it
        // is not there yet rather than failing the whole method.
        try {
            const daily = await manager.query(
                `SELECT date,
                        COALESCE(SUM(organic_google_search_clicks), 0) AS clicks,
                        COALESCE(SUM(organic_google_search_impressions), 0) AS impressions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2
                 GROUP BY date
                 ORDER BY date ASC`,
                [start, end],
            );
            for (const row of daily || []) {
                const key = this.isoDate(row.date);
                const cur = byDate.get(key) || { clicks: 0, impressions: 0 };
                cur.clicks += Number(row.clicks) || 0;
                cur.impressions += Number(row.impressions) || 0;
                byDate.set(key, cur);
            }
        } catch {
            // Date column not present until the next sync; no trend yet.
        }
    }

    private async groupInto(
        manager: any,
        fullTable: string,
        groupExpr: string,
        valueExpr: string,
        out: Map<string, number>,
        start: string,
        end: string,
        dateColumn: string = 'date',
        extraWhere: string = '',
    ): Promise<void> {
        const rows = await manager.query(
            `SELECT ${groupExpr} AS category,
                    COALESCE(SUM("${valueExpr}"), 0) AS value
             FROM ${fullTable}
             WHERE ${dateColumn} BETWEEN $1 AND $2${extraWhere}
             GROUP BY category`,
            [start, end],
        );
        for (const row of rows || []) {
            const key = row.category || '(not set)';
            out.set(key, (out.get(key) || 0) + (Number(row.value) || 0));
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private isoDate(value: any): string {
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        const s = String(value ?? '');
        // GA4 returns the `date` dimension as YYYYMMDD.
        if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        return s.slice(0, 10);
    }

    private addSeriesValue(
        out: Map<string, Map<string, number>>,
        name: string,
        date: string,
        value: number,
    ): void {
        let byDate = out.get(name);
        if (!byDate) {
            byDate = new Map<string, number>();
            out.set(name, byDate);
        }
        byDate.set(date, (byDate.get(date) || 0) + value);
    }

    /**
     * Turn a name → date → value map into chart-ready series. Only the top
     * `topN` names keep their own series; the remainder are rolled into
     * "Other" so the stacked chart still adds up to the true total.
     */
    private buildSeriesTrend(
        map: Map<string, Map<string, number>>,
        topN: number = 8,
    ): IOverviewChartData {
        const totals = new Map<string, number>();
        const dates = new Set<string>();
        for (const [name, byDate] of map.entries()) {
            let total = 0;
            for (const [date, value] of byDate.entries()) {
                total += value;
                dates.add(date);
            }
            totals.set(name, total);
        }
        const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, topN).map(([name]) => name);
        const rest = sorted.slice(topN).map(([name]) => name);
        const sortedDates = Array.from(dates).sort();
        const label = (key: string): string => {
            const [, m, d] = key.split('-');
            return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
        };

        const series = top.map(name => ({
            name,
            data: sortedDates.map(date => map.get(name)?.get(date) || 0),
        }));
        if (rest.length > 0) {
            series.push({
                name: 'Other',
                data: sortedDates.map(date => rest.reduce((sum, name) => sum + (map.get(name)?.get(date) || 0), 0)),
            });
        }
        return { categories: sortedDates.map(label), series };
    }

    private buildTrend(
        byDate: Map<string, { sessions: number; users: number; newUsers: number }>,
    ): IOverviewChartData {
        const dates = Array.from(byDate.keys()).sort();
        const label = (key: string): string => {
            const [, m, d] = key.split('-');
            return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
        };
        return {
            categories: dates.map(label),
            series: [
                { name: 'Sessions', data: dates.map(k => byDate.get(k)!.sessions) },
                { name: 'Users', data: dates.map(k => byDate.get(k)!.users) },
                { name: 'New Users', data: dates.map(k => byDate.get(k)!.newUsers) },
            ],
        };
    }

    private toSorted(map: Map<string, number>, limit: number): IOverviewCategoryValue[] {
        return Array.from(map.entries())
            .map(([category, value]) => ({ category, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit);
    }
}

export default GA4OverviewService;
