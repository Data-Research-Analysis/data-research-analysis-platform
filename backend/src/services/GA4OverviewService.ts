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
}

const GA_SCHEMA = 'dra_google_analytics';

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
        const overview = await this.getOverview(projectId, range.start, range.end, selectedId ?? undefined);
        return { range, dataSources: availableSources, dataSourceId: selectedId, ...overview };
    }

    async getOverview(
        projectId: number,
        start: string,
        end: string,
        dataSourceId?: number,
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

        // Kick off the exact-totals query in parallel with the synced
        // aggregation so the extra API round-trip overlaps local DB work.
        const liveTotalsPromise = this.fetchLiveTotalsAndTrend(dataSources, start, end);

        for (const ds of dataSources) {
            await this.aggregateTraffic(manager, ds.id, start, end, kpis, byDate, channels, sources);
            await this.aggregateAttribution(manager, ds.id, start, end, (e, s, c) => {
                engagedSessions += e;
                totalSessions += s;
                totalConversions += c;
            });
            await this.aggregateDimension(manager, ds.id, 'page_performance', 'page_path', 'screen_page_views', pages, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'geographic', 'country', 'sessions', countries, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'device', 'device_category', 'sessions', devices, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'events', 'event_name', 'event_count', events, true, start, end);

            // Bucket 1 — derivable from existing tables
            await this.aggregateDimension(manager, ds.id, 'user_acquisition', 'first_user_default_channel_group', 'new_users', newUsersByChannel, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'session_attribution', 'session_default_channel_group', 'conversions', keyEventsByChannel, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'events', 'event_name', 'conversions', eventConversions, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'geographic', 'country', 'total_users', activeUsersByCountry, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'geographic', 'city', 'total_users', activeUsersByCity, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'device', 'device_category', 'total_users', activeUsersByDevice, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'device', 'operating_system', 'total_users', activeUsersByOs, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'device', 'browser', 'total_users', activeUsersByBrowser, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'page_performance', 'page_title', 'screen_page_views', pageTitleViews, true, start, end);
            await this.aggregateEngagementByFirstSource(manager, ds.id, start, end, engagementAcc);
            await this.aggregateSessionKeyEventRate(manager, ds.id, start, end, skrAcc);

            // Bucket 2 — new aggregate tables
            await this.aggregateDimension(manager, ds.id, 'demographics', 'user_age_bracket', 'total_users', ageUsers, false);
            await this.aggregateDimension(manager, ds.id, 'demographics', 'user_gender', 'total_users', genderUsers, false);
            await this.aggregateDimension(manager, ds.id, 'demographics', 'user_language', 'total_users', languageUsers, false);
            await this.aggregateDimension(manager, ds.id, 'demographics', 'new_vs_returning', 'total_users', newVsReturning, false);
            await this.aggregateDimension(manager, ds.id, 'technology', 'platform', 'total_users', platformUsers, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'technology', 'device_model', 'total_users', deviceModelUsers, true, start, end);
            await this.aggregateDimension(manager, ds.id, 'technology', 'screen_resolution', 'total_users', screenResolutionUsers, true, start, end);
            await this.aggregateFirstUserSourceMedium(manager, ds.id, start, end, fusmAcc);
            await this.aggregateDimension(manager, ds.id, 'landing_pages', 'landing_page', 'sessions', landingPages, true, start, end);
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

        return {
            kpis,
            trend: this.buildTrend(live ? live.byDate : byDate),
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
        };
    }

    // -----------------------------------------------------------------------
    // Data API aggregation
    // -----------------------------------------------------------------------

    private async aggregateTraffic(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        kpis: IOverviewKpis,
        byDate: Map<string, { sessions: number; users: number; newUsers: number }>,
        channels: Map<string, number>,
        sources: Map<string, number>,
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'traffic_overview');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;

        try {
            const rows = await manager.query(
                `SELECT
                    COALESCE(SUM(sessions), 0) AS sessions,
                    COALESCE(SUM(total_users), 0) AS users,
                    COALESCE(SUM(new_users), 0) AS new_users,
                    COALESCE(SUM(screen_page_views), 0) AS page_views,
                    COALESCE(SUM(average_session_duration * sessions), 0) AS duration_total,
                    COALESCE(SUM(bounce_rate * sessions), 0) AS bounce_total
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2`,
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
                 WHERE date BETWEEN $1 AND $2
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

            await this.groupInto(manager, full, `COALESCE(session_default_channel_group, '(not set)')`, 'sessions', channels, start, end);
            await this.groupInto(manager, full, `COALESCE(session_source, '(not set)') || ' / ' || COALESCE(session_medium, '(not set)')`, 'sessions', sources, start, end);
        } catch (error: any) {
            console.warn(`[GA4Overview] traffic aggregation failed for ${physical}:`, error?.message);
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
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_attribution');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;

        try {
            const rows = await manager.query(
                `SELECT COALESCE(SUM(engaged_sessions), 0) AS engaged,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2`,
                [start, end],
            );
            const r = rows?.[0];
            if (r) onRow(Number(r.engaged) || 0, Number(r.sessions) || 0, Number(r.conversions) || 0);
        } catch (error: any) {
            console.warn(`[GA4Overview] attribution aggregation failed for ${physical}:`, error?.message);
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
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, logicalTable);
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;
        const where = hasDate ? 'WHERE date BETWEEN $1 AND $2' : '';
        const params = hasDate ? [start, end] : [];

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
            console.warn(`[GA4Overview] ${logicalTable} aggregation failed for ${physical}:`, error?.message);
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
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'session_attribution');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;
        try {
            const rows = await manager.query(
                `SELECT COALESCE(session_source, '(not set)') || ' / ' || COALESCE(session_medium, '(not set)') AS category,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2
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
            console.warn(`[GA4Overview] session-key-event-rate failed for ${physical}:`, error?.message);
        }
    }

    private async aggregateFirstUserSourceMedium(
        manager: any,
        dataSourceId: number,
        start: string,
        end: string,
        out: Map<string, { users: number; newUsers: number; sessions: number; conversions: number }>,
    ): Promise<void> {
        const physical = await this.tableMetadataService.getPhysicalTableName(manager, dataSourceId, 'first_user_source_medium');
        if (!physical) return;
        const full = `"${GA_SCHEMA}"."${physical}"`;
        try {
            const rows = await manager.query(
                `SELECT COALESCE(first_user_source_medium, '(not set)') AS category,
                        COALESCE(SUM(total_users), 0) AS users,
                        COALESCE(SUM(new_users), 0) AS new_users,
                        COALESCE(SUM(sessions), 0) AS sessions,
                        COALESCE(SUM(conversions), 0) AS conversions
                 FROM ${full}
                 WHERE date BETWEEN $1 AND $2
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
            console.warn(`[GA4Overview] first-user-source/medium failed for ${physical}:`, error?.message);
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
            console.warn(`[GA4Overview] engagement-duration aggregation failed for ${physical}:`, error?.message);
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
    ): Promise<void> {
        const rows = await manager.query(
            `SELECT ${groupExpr} AS category,
                    COALESCE(SUM("${valueExpr}"), 0) AS value
             FROM ${fullTable}
             WHERE ${dateColumn} BETWEEN $1 AND $2
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
