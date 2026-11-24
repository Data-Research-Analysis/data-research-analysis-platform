import { google } from 'googleapis';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleOAuthService } from './GoogleOAuthService.js';
import { IGA4ReportPreset, GA4_REPORT_TYPES, IGA4ReportType } from '../types/IGoogleAnalytics.js';

/**
 * Google Analytics 4 (GA4) Service
 * Handles data fetching from the Google Analytics Data API.
 *
 * The GA4 Data API is pageable: `runReport` returns up to `limit` rows per
 * page plus a `nextPageToken`. This service follows the token until the full
 * result set is fetched so large reports are not silently truncated.
 */
export class GoogleAnalyticsService {
    private static instance: GoogleAnalyticsService;
    /** GA4 Data API caps a single report page at 100k rows. */
    private static readonly MAX_PAGE_SIZE = 100000;
    /** Hard safety cap on pages followed per report (~5M rows worst case). */
    private static readonly MAX_PAGES = 50;

    private constructor() {}

    public static getInstance(): GoogleAnalyticsService {
        if (!GoogleAnalyticsService.instance) {
            GoogleAnalyticsService.instance = new GoogleAnalyticsService();
        }
        return GoogleAnalyticsService.instance;
    }

    /**
     * Get an authenticated GA4 Data API client using googleapis.
     */
    private getGA4Client(connectionDetails: IAPIConnectionDetails): any {
        const oauthService = GoogleOAuthService.getInstance();
        const oauth2Client = oauthService.getAuthenticatedClient(
            connectionDetails.oauth_access_token,
            connectionDetails.oauth_refresh_token
        );

        return google.analyticsdata({
            version: 'v1beta',
            auth: oauth2Client
        });
    }

    /**
     * List accessible Google Analytics properties
     * @param accessToken - OAuth access token
     * @returns List of GA4 properties user has access to
     */
    public async listProperties(accessToken: string): Promise<any[]> {
        try {
            const oauthService = GoogleOAuthService.getInstance();
            const oauth2Client = oauthService.getAuthenticatedClient(accessToken);

            const analyticsAdmin = google.analyticsadmin({
                version: 'v1beta',
                auth: oauth2Client
            });

            const response = await analyticsAdmin.accountSummaries.list({
                pageSize: 200
            });

            const properties: any[] = [];
            if (response.data.accountSummaries) {
                for (const accountSummary of response.data.accountSummaries) {
                    if (accountSummary.propertySummaries) {
                        for (const propertySummary of accountSummary.propertySummaries) {
                            properties.push({
                                name: propertySummary.property,
                                displayName: propertySummary.displayName,
                                parent: propertySummary.parent
                            });
                        }
                    }
                }
            }

            console.log(`✅ Found ${properties.length} Google Analytics properties`);
            return properties;
        } catch (error) {
            console.error('❌ Failed to list GA properties:', error);
            throw new Error('Failed to fetch Google Analytics properties');
        }
    }

    /**
     * Get metadata for a GA4 property (available dimensions and metrics).
     * The metadata method lives on the `properties` resource.
     * @param propertyId - GA4 property ID (format: properties/123456789)
     * @param connectionDetails - API connection details
     * @returns Metadata about available dimensions and metrics
     */
    public async getMetadata(propertyId: string, connectionDetails: IAPIConnectionDetails): Promise<any> {
        try {
            const client = this.getGA4Client(connectionDetails);

            const response = await client.properties.getMetadata({
                name: `${propertyId}/metadata`
            });

            const metadata = response.data;
            console.log('✅ Retrieved GA4 metadata');
            console.log(`   - Dimensions: ${metadata.dimensions?.length || 0}`);
            console.log(`   - Metrics: ${metadata.metrics?.length || 0}`);

            return {
                dimensions: metadata.dimensions,
                metrics: metadata.metrics
            };
        } catch (error) {
            console.error('❌ Failed to get GA4 metadata:', error);
            throw new Error('Failed to retrieve Google Analytics metadata');
        }
    }

    /**
     * Run a report query on GA4, following pagination until all rows are fetched.
     * @param propertyId - GA4 property ID (format: properties/123456789)
     * @param connectionDetails - API connection details
     * @param dimensions - Array of dimension names (e.g., ['date', 'country'])
     * @param metrics - Array of metric names (e.g., ['activeUsers', 'sessions'])
     * @param dateRanges - Date ranges to query
     * @param limit - Maximum rows per page (capped at GA4's 100k page limit)
     * @returns Report data with all rows merged across pages
     */
    public async runReport(
        propertyId: string,
        connectionDetails: IAPIConnectionDetails,
        dimensions: string[],
        metrics: string[],
        dateRanges: Array<{ startDate: string; endDate: string }> = [{ startDate: '30daysAgo', endDate: 'today' }],
        limit: number = GoogleAnalyticsService.MAX_PAGE_SIZE
    ): Promise<any> {
        try {
            const client = this.getGA4Client(connectionDetails);
            const pageSize = Math.min(Math.max(limit, 1), GoogleAnalyticsService.MAX_PAGE_SIZE);

            const allRows: any[] = [];
            let dimensionHeaders: any;
            let metricHeaders: any;
            let rowCount: any;
            let metadata: any;
            let offsetToken: string | undefined;
            let pages = 0;

            do {
                const requestBody: any = {
                    dimensions: dimensions.map(d => ({ name: d })),
                    metrics: metrics.map(m => ({ name: m })),
                    dateRanges: dateRanges,
                    limit: pageSize
                };
                if (offsetToken) {
                    requestBody.offsetToken = offsetToken;
                }

                const response = await client.properties.runReport({
                    property: propertyId,
                    requestBody
                });

                const data = response.data;
                if (data.rows) {
                    allRows.push(...data.rows);
                }
                if (!dimensionHeaders) dimensionHeaders = data.dimensionHeaders;
                if (!metricHeaders) metricHeaders = data.metricHeaders;
                if (rowCount === undefined) rowCount = data.rowCount;
                if (!metadata) metadata = data.metadata;

                offsetToken = data.nextPageToken || undefined;
                pages++;

                if (pages >= GoogleAnalyticsService.MAX_PAGES) {
                    console.warn(`⚠️ GA4 report ${dimensions.join(', ')} hit pagination safety cap (${GoogleAnalyticsService.MAX_PAGES} pages)`);
                    break;
                }
            } while (offsetToken);

            console.log('✅ Successfully ran GA4 report');
            console.log(`   - Rows returned: ${allRows.length}`);
            console.log(`   - Dimensions: ${dimensions.join(', ')}`);
            console.log(`   - Metrics: ${metrics.join(', ')}`);

            return {
                rows: allRows,
                dimensionHeaders,
                metricHeaders,
                rowCount: rowCount ?? allRows.length,
                metadata
            };
        } catch (error) {
            console.error('❌ Failed to run GA4 report:', error);
            throw new Error('Failed to run Google Analytics report');
        }
    }

    /**
     * Transform GA4 report response to tabular format
     * @param response - GA4 API response
     * @returns Array of row objects keyed by dimension/metric header names
     */
    public transformReportToRows(response: any): any[] {
        if (!response || !response.rows || response.rows.length === 0) {
            return [];
        }

        const dimensionHeaders = response.dimensionHeaders?.map((h: any) => h.name) || [];
        const metricHeaders = response.metricHeaders?.map((h: any) => h.name) || [];

        return response.rows.map((row: any) => {
            const rowData: any = {};

            row.dimensionValues?.forEach((value: any, index: number) => {
                rowData[dimensionHeaders[index]] = value.value;
            });

            row.metricValues?.forEach((value: any, index: number) => {
                const parsed = parseFloat(value.value);
                rowData[metricHeaders[index]] = Number.isFinite(parsed) ? parsed : value.value;
            });

            return rowData;
        });
    }

    /**
     * Get the GA4 report presets that back the `dra_google_analytics` tables.
     *
     * Every dimension and metric name here is a valid GA4 Data API name.
     * Notes on attribution-relevant data:
     * - `traffic_overview` is session-scoped (source/medium/campaign + channel group).
     * - `user_acquisition` is first-user scoped and mirrors GA4's "User acquisition"
     *   report; GA4 has no first-user GCLID dimension, so gclid is not requested here.
     * - `session_attribution` carries session-scoped UTM term/content and Google Ads
     *   campaign IDs; GA4 Data API has no session GCLID dimension, so gclid is not
     *   requested here (it stays '(not set)' in the synced rows).
     */
    public static getReportPresets(): Record<IGA4ReportType, IGA4ReportPreset> {
        return {
            traffic_overview: {
                name: 'Traffic Overview',
                logicalTableName: 'traffic_overview',
                dimensions: ['date', 'sessionSource', 'sessionMedium', 'sessionCampaignId', 'sessionCampaignName', 'sessionDefaultChannelGroup'],
                metrics: ['sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'averageSessionDuration', 'bounceRate', 'userEngagementDuration'],
                dateRangeDays: 90,
                description: 'Sessions and users by source, medium, campaign and channel group'
            },
            user_acquisition: {
                name: 'User Acquisition',
                logicalTableName: 'user_acquisition',
                dimensions: ['date', 'firstUserSource', 'firstUserMedium', 'firstUserCampaignId', 'firstUserCampaignName', 'firstUserGoogleAdsCampaignId', 'firstUserGoogleAdsCampaignName', 'firstUserDefaultChannelGroup'],
                metrics: ['newUsers', 'sessions', 'engagementRate', 'conversions'],
                dateRangeDays: 90,
                description: 'New users and conversions by first-touch source, medium and campaign (incl. Google Ads campaign ID)'
            },
            session_attribution: {
                name: 'Session Attribution (UTM)',
                logicalTableName: 'session_attribution',
                dimensions: ['date', 'sessionSource', 'sessionMedium', 'sessionCampaignId', 'sessionCampaignName', 'sessionGoogleAdsCampaignId', 'sessionGoogleAdsCampaignName', 'sessionManualTerm', 'sessionDefaultChannelGroup'],
                metrics: ['sessions', 'engagedSessions', 'totalUsers', 'conversions', 'sessionKeyEventRate', 'eventCount', 'totalRevenue'],
                dateRangeDays: 90,
                description: 'Session-level UTM parameters and Google Ads campaign IDs for ad and funnel linkage'
            },
            page_performance: {
                name: 'Page Performance',
                logicalTableName: 'page_performance',
                dimensions: ['date', 'pagePath', 'pageTitle'],
                metrics: ['screenPageViews', 'averageSessionDuration', 'bounceRate'],
                dateRangeDays: 30,
                description: 'Page-level engagement metrics'
            },
            geographic: {
                name: 'Geographic',
                logicalTableName: 'geographic',
                dimensions: ['date', 'country', 'city'],
                metrics: ['totalUsers', 'sessions', 'screenPageViews', 'averageSessionDuration', 'conversions'],
                dateRangeDays: 30,
                description: 'Users and sessions by country and city'
            },
            device: {
                name: 'Device & Technology',
                logicalTableName: 'device',
                dimensions: ['date', 'deviceCategory', 'operatingSystem', 'browser', 'platform', 'deviceModel', 'screenResolution'],
                metrics: ['totalUsers', 'sessions', 'screenPageViews', 'bounceRate', 'conversions'],
                dateRangeDays: 30,
                description: 'Users and sessions by device, OS and browser'
            },
            events: {
                name: 'Events',
                logicalTableName: 'events',
                dimensions: ['eventName', 'date'],
                metrics: ['eventCount', 'eventValue', 'conversions'],
                dateRangeDays: 30,
                description: 'Custom event counts and conversions'
            },
            demographics: {
                name: 'Demographics & Audience',
                logicalTableName: 'demographics',
                dimensions: ['userAgeBracket', 'userGender', 'language', 'newVsReturning'],
                metrics: ['totalUsers', 'newUsers', 'sessions'],
                dateRangeDays: 30,
                description: 'Users by age, gender, language and new vs returning (30-day aggregate; GA4 cannot combine these dimensions with date)'
            },
            technology: {
                name: 'Technology',
                logicalTableName: 'technology',
                dimensions: ['date', 'platform', 'deviceCategory', 'deviceModel', 'operatingSystem', 'browser', 'screenResolution'],
                metrics: ['totalUsers', 'sessions', 'screenPageViews'],
                dateRangeDays: 30,
                description: 'Users and sessions by platform, device model and screen resolution'
            },
            first_user_source_medium: {
                name: 'First User Source / Medium',
                logicalTableName: 'first_user_source_medium',
                dimensions: ['date', 'firstUserSourceMedium', 'firstUserDefaultChannelGroup'],
                metrics: ['totalUsers', 'newUsers', 'sessions', 'conversions'],
                dateRangeDays: 90,
                description: 'Active and new users by first-touch source/medium'
            },
            landing_pages: {
                name: 'Landing Pages',
                logicalTableName: 'landing_pages',
                dimensions: ['date', 'landingPagePlusQueryString', 'sessionDefaultChannelGroup'],
                metrics: ['sessions', 'totalUsers', 'engagedSessions', 'conversions'],
                dateRangeDays: 90,
                description: 'Sessions and conversions by landing page'
            },
            search_console: {
                name: 'Search Console',
                logicalTableName: 'search_console',
                // GA4 rejects `date` together with `landingPagePlusQueryString`
                // for the organicGoogleSearch* metrics, so this report is
                // aggregated per landing page over the window.
                dimensions: ['landingPagePlusQueryString'],
                metrics: ['organicGoogleSearchClicks', 'organicGoogleSearchImpressions', 'organicGoogleSearchClickThroughRate', 'organicGoogleSearchAveragePosition'],
                dateRangeDays: 90,
                description: 'Organic Google Search clicks, impressions, CTR and average position by landing page'
            },
            ecommerce: {
                name: 'Ecommerce Items',
                logicalTableName: 'ecommerce',
                dimensions: ['date', 'itemName', 'itemCategory', 'itemId'],
                metrics: ['itemRevenue', 'itemsPurchased'],
                dateRangeDays: 90,
                description: 'Item-level revenue and purchase quantity'
            },
            revenue: {
                name: 'Revenue',
                logicalTableName: 'revenue',
                dimensions: ['date', 'sessionDefaultChannelGroup'],
                metrics: ['totalRevenue', 'purchaseRevenue', 'ecommercePurchases', 'totalUsers', 'sessions'],
                dateRangeDays: 90,
                description: 'Revenue and purchases by channel'
            }
        };
    }

    /**
     * List the logical report types synced for every GA4 property.
     */
    public static getReportTypeList(): IGA4ReportType[] {
        return [...GA4_REPORT_TYPES];
    }
}
