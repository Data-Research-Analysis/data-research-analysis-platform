import {
    ILinkedInAdAccount,
    ILinkedInCampaign,
    ILinkedInCampaignGroup,
    ILinkedInCreative,
    ILinkedInAnalyticsRecord,
    ILinkedInRevenueMetrics,
    ILinkedInDate,
    ILinkedInDateRange,
    TLinkedInTimeGranularity,
    TLinkedInAnalyticsPivot,
    LINKEDIN_PERFORMANCE_FIELDS,
    LINKEDIN_DEMOGRAPHIC_FIELDS,
} from '../types/ILinkedInAds.js';
import { RetryHandler } from '../utils/RetryHandler.js';

/**
 * LinkedIn Ads Service
 * Wraps LinkedIn Marketing API v202601 calls with retry logic.
 *
 * Key rules from the API:
 *  - LinkedIn-Version header MUST be 202601 (the version 202501 is sunset)
 *  - dateRange structured objects { year, month, day } — NOT ISO strings
 *  - `fields` param is REQUIRED for adAnalytics (API defaults to impressions+clicks only)
 *  - Analytics has NO pagination — max 15,000 elements; split by date or campaign chunks
 *  - Search/list APIs use cursor-based pagination (pageToken / nextPageToken in metadata)
 *  - adAccount id is a LONG integer, NOT a URN string
 *  - Campaigns/creatives are nested: /rest/adAccounts/{id}/adCampaigns
 */
export class LinkedInAdsService {
    private static instance: LinkedInAdsService;

    private static readonly API_VERSION = '202601';
    private static readonly BASE_URL = 'https://api.linkedin.com';
    private static readonly MAX_RETRIES = 3;
    private static readonly INITIAL_RETRY_DELAY_MS = 1000;
    private static readonly DEFAULT_PAGE_SIZE = 1000; // Max per cursor page

    private constructor() {
        console.log('📘 LinkedIn Ads Service initialized');
    }

    public static getInstance(): LinkedInAdsService {
        if (!LinkedInAdsService.instance) {
            LinkedInAdsService.instance = new LinkedInAdsService();
        }
        return LinkedInAdsService.instance;
    }

    // -------------------------------------------------------------------------
    // Core request helper
    // -------------------------------------------------------------------------

    /**
     * Make a GET request to the LinkedIn Marketing API with retry logic.
     */
    private async makeRequest<T>(
        path: string,
        accessToken: string,
        params?: Record<string, string>
    ): Promise<T> {
        const url = new URL(`${LinkedInAdsService.BASE_URL}${path}`);
        if (params) {
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        }

        // URLSearchParams encodes commas (%2C), parentheses (%28/%29), and colons (%3A).
        // LinkedIn's API requires these characters to be literal in the query string:
        //   - commas in `fields` parameter (field projection list)
        //   - parentheses and colons in `accounts`, `dateRange`, and restli URN values
        // Un-encode them so the API can parse projections and structured params correctly.
        const fullUrl = url.toString()
            .replace(/%2C/gi, ',')
            .replace(/%28/gi, '(')
            .replace(/%29/gi, ')')
            .replace(/%3A/gi, ':');

        const result = await RetryHandler.execute(
            async () => {
                console.log(`📡 [LinkedIn API] GET ${path}`);

                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'LinkedIn-Version': LinkedInAdsService.API_VERSION,
                        'X-Restli-Protocol-Version': '2.0.0',
                        'Accept': 'application/json',
                    },
                });

                if (!response.ok) {
                    let errorBody: Record<string, unknown> = {};
                    try { errorBody = await response.json(); } catch (_) { /* ignore */ }

                    const status = response.status;
                    const message = (errorBody.message as string) || response.statusText;

                    console.error(`❌ [LinkedIn API] ${status} on ${path}: ${message}`);

                    if (status === 401) {
                        throw new Error(`LinkedIn authentication failed: ${message}`);
                    }
                    if (status === 403) {
                        throw new Error(`LinkedIn access denied: ${message}`);
                    }
                    if (status === 429) {
                        throw new Error(`LinkedIn rate limit exceeded: ${message}`);
                    }
                    if (status >= 500) {
                        throw new Error(`LinkedIn server error (${status}): ${message}`);
                    }

                    throw new Error(`LinkedIn API error (${status}): ${message}`);
                }

                return (await response.json()) as T;
            },
            {
                maxRetries: LinkedInAdsService.MAX_RETRIES,
                initialDelayMs: LinkedInAdsService.INITIAL_RETRY_DELAY_MS,
                backoffMultiplier: 2,
                retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate limit'],
                onRetry: (attempt, error, nextDelayMs) => {
                    console.log(
                        `⚠️  [LinkedIn API] Retry ${attempt}/${LinkedInAdsService.MAX_RETRIES} in ${nextDelayMs}ms — ${error.message}`
                    );
                },
            }
        );

        if (!result.success || !result.data) {
            throw result.error || new Error('LinkedIn API request failed');
        }

        return result.data;
    }

    // -------------------------------------------------------------------------
    // Date helpers
    // -------------------------------------------------------------------------

    /**
     * Serialize a structured LinkedIn date as the restli-encoded URL segment.
     * e.g. { year: 2025, month: 10, day: 1 } → "(year:2025,month:10,day:1)"
     */
    private serializeDate(d: ILinkedInDate): string {
        return `(year:${d.year},month:${d.month},day:${d.day})`;
    }

    /**
     * Build the dateRange restli parameter string.
     * e.g. "(start:(year:2025,month:10,day:1),end:(year:2025,month:10,day:31))"
     */
    private serializeDateRange(range: ILinkedInDateRange): string {
        const start = this.serializeDate(range.start);
        const end = range.end ? `,end:${this.serializeDate(range.end)}` : '';
        return `(start:${start}${end})`;
    }

    /**
     * Build a sponsoredAccount URN string from a long integer id.
     */
    private accountUrn(adAccountId: number): string {
        return `urn:li:sponsoredAccount:${adAccountId}`;
    }

    // -------------------------------------------------------------------------
    // Ad Accounts
    // -------------------------------------------------------------------------

    /**
     * List all accessible ad accounts for the authenticated user.
     * Ref: GET /rest/adAccounts?q=search
     * Uses cursor-based pagination internally.
     */
    public async listAdAccounts(accessToken: string): Promise<ILinkedInAdAccount[]> {
        console.log('[LinkedIn Ads] Fetching ad accounts');

        const fields = [
            'id',
            'name',
            'type',
            'status',
            'currency',
            'test',
            'servingStatuses',
            'reference',
        ].join(',');

        const allAccounts: ILinkedInAdAccount[] = [];
        let pageToken: string | undefined;

        do {
            const params: Record<string, string> = {
                q: 'search',
                pageSize: String(LinkedInAdsService.DEFAULT_PAGE_SIZE),
                fields,
            };
            if (pageToken) params.pageToken = pageToken;

            const response = await this.makeRequest<{
                elements: ILinkedInAdAccount[];
                metadata?: { nextPageToken?: string };
                paging?: { count: number; start: number; total?: number };
            }>('/rest/adAccounts', accessToken, params);

            allAccounts.push(...(response.elements || []));
            pageToken = response.metadata?.nextPageToken;
        } while (pageToken);

        console.log(`✅ [LinkedIn Ads] Fetched ${allAccounts.length} ad account(s)`);
        return allAccounts;
    }

    // -------------------------------------------------------------------------
    // Campaigns
    // -------------------------------------------------------------------------

    /**
     * Fetch all campaigns under an ad account (cursor-paginated).
     * Ref: GET /rest/adAccounts/{adAccountId}/adCampaigns?q=search
     */
    public async getCampaigns(
        accessToken: string,
        adAccountId: number
    ): Promise<ILinkedInCampaign[]> {
        console.log(`[LinkedIn Ads] Fetching campaigns for account ${adAccountId}`);

        const fields = [
            'id',
            'name',
            'account',
            'campaignGroup',
            'status',
            'type',
            'costType',
            'objectiveType',
            'dailyBudget',
            'totalBudget',
            'unitCost',
            'test',
            'changeAuditStamps',
        ].join(',');

        const allCampaigns: ILinkedInCampaign[] = [];
        let pageToken: string | undefined;

        do {
            const params: Record<string, string> = {
                q: 'search',
                pageSize: String(LinkedInAdsService.DEFAULT_PAGE_SIZE),
                fields,
            };
            if (pageToken) params.pageToken = pageToken;

            const response = await this.makeRequest<{
                elements: ILinkedInCampaign[];
                metadata?: { nextPageToken?: string };
            }>(`/rest/adAccounts/${adAccountId}/adCampaigns`, accessToken, params);

            allCampaigns.push(...(response.elements || []));
            pageToken = response.metadata?.nextPageToken;
        } while (pageToken);

        console.log(`✅ [LinkedIn Ads] Fetched ${allCampaigns.length} campaign(s) for account ${adAccountId}`);
        return allCampaigns;
    }

    // -------------------------------------------------------------------------
    // Campaign Groups
    // -------------------------------------------------------------------------

    /**
     * Fetch all campaign groups under an ad account (cursor-paginated).
     * Ref: GET /rest/adAccounts/{adAccountId}/adCampaignGroups?q=search
     */
    public async getCampaignGroups(
        accessToken: string,
        adAccountId: number
    ): Promise<ILinkedInCampaignGroup[]> {
        console.log(`[LinkedIn Ads] Fetching campaign groups for account ${adAccountId}`);

        const fields = [
            'id',
            'name',
            'account',
            'status',
            'totalBudget',
            'runSchedule',
            'test',
            'changeAuditStamps',
        ].join(',');

        const allGroups: ILinkedInCampaignGroup[] = [];
        let pageToken: string | undefined;

        do {
            const params: Record<string, string> = {
                q: 'search',
                pageSize: String(LinkedInAdsService.DEFAULT_PAGE_SIZE),
                fields,
            };
            if (pageToken) params.pageToken = pageToken;

            const response = await this.makeRequest<{
                elements: ILinkedInCampaignGroup[];
                metadata?: { nextPageToken?: string };
            }>(`/rest/adAccounts/${adAccountId}/adCampaignGroups`, accessToken, params);

            allGroups.push(...(response.elements || []));
            pageToken = response.metadata?.nextPageToken;
        } while (pageToken);

        console.log(`✅ [LinkedIn Ads] Fetched ${allGroups.length} campaign group(s) for account ${adAccountId}`);
        return allGroups;
    }

    // -------------------------------------------------------------------------
    // Creatives
    // -------------------------------------------------------------------------

    /**
     * Fetch all creatives under an ad account (cursor-paginated).
     * Ref: GET /rest/adAccounts/{adAccountId}/adCreatives?q=search
     */
    public async getCreatives(
        accessToken: string,
        adAccountId: number
    ): Promise<ILinkedInCreative[]> {
        console.log(`[LinkedIn Ads] Fetching creatives for account ${adAccountId}`);

        const fields = [
            'id',
            'campaign',
            'account',
            'status',
            'intendedStatus',
            'servingHoldReasons',
            'test',
            'changeAuditStamps',
        ].join(',');

        const allCreatives: ILinkedInCreative[] = [];
        let pageToken: string | undefined;

        do {
            const params: Record<string, string> = {
                q: 'search',
                pageSize: String(LinkedInAdsService.DEFAULT_PAGE_SIZE),
                fields,
            };
            if (pageToken) params.pageToken = pageToken;

            const response = await this.makeRequest<{
                elements: ILinkedInCreative[];
                metadata?: { nextPageToken?: string };
            }>(`/rest/adAccounts/${adAccountId}/adCreatives`, accessToken, params);

            allCreatives.push(...(response.elements || []));
            pageToken = response.metadata?.nextPageToken;
        } while (pageToken);

        console.log(`✅ [LinkedIn Ads] Fetched ${allCreatives.length} creative(s) for account ${adAccountId}`);
        return allCreatives;
    }

    // -------------------------------------------------------------------------
    // Analytics — Campaign-level (q=analytics, single CAMPAIGN pivot)
    // -------------------------------------------------------------------------

    /**
     * Fetch campaign-level performance analytics.
     * Uses the Analytics Finder (q=analytics) with a CAMPAIGN pivot.
     * NO pagination — returns up to 15,000 elements.
     *
     * The `fields` param is REQUIRED — omitting it returns only impressions+clicks.
     *
     * Ref: GET /rest/adAnalytics?q=analytics&pivot=CAMPAIGN&...
     */
    public async getCampaignAnalytics(
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange,
        timeGranularity: TLinkedInTimeGranularity = 'DAILY'
    ): Promise<ILinkedInAnalyticsRecord[]> {
        console.log(
            `[LinkedIn Ads] Fetching campaign analytics for account ${adAccountId} (${timeGranularity})`
        );

        const params: Record<string, string> = {
            q: 'analytics',
            pivot: 'CAMPAIGN',
            timeGranularity,
            dateRange: this.serializeDateRange(dateRange),
            accounts: `List(${this.accountUrn(adAccountId)})`,
            fields: LINKEDIN_PERFORMANCE_FIELDS,
        };

        const response = await this.makeRequest<{ elements: ILinkedInAnalyticsRecord[] }>(
            '/rest/adAnalytics',
            accessToken,
            params
        );

        const records = response.elements || [];
        console.log(`✅ [LinkedIn Ads] Fetched ${records.length} campaign analytics record(s)`);
        return records;
    }

    // -------------------------------------------------------------------------
    // Analytics — Creative-level (q=analytics, single CREATIVE pivot)
    // -------------------------------------------------------------------------

    /**
     * Fetch creative-level performance analytics.
     * Uses the Analytics Finder (q=analytics) with a CREATIVE pivot.
     */
    public async getCreativeAnalytics(
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange,
        timeGranularity: TLinkedInTimeGranularity = 'DAILY'
    ): Promise<ILinkedInAnalyticsRecord[]> {
        console.log(
            `[LinkedIn Ads] Fetching creative analytics for account ${adAccountId} (${timeGranularity})`
        );

        const params: Record<string, string> = {
            q: 'analytics',
            pivot: 'CREATIVE',
            timeGranularity,
            dateRange: this.serializeDateRange(dateRange),
            accounts: `List(${this.accountUrn(adAccountId)})`,
            fields: LINKEDIN_PERFORMANCE_FIELDS,
        };

        const response = await this.makeRequest<{ elements: ILinkedInAnalyticsRecord[] }>(
            '/rest/adAnalytics',
            accessToken,
            params
        );

        const records = response.elements || [];
        console.log(`✅ [LinkedIn Ads] Fetched ${records.length} creative analytics record(s)`);
        return records;
    }

    // -------------------------------------------------------------------------
    // Analytics — Account-level (q=analytics, ACCOUNT pivot)
    // -------------------------------------------------------------------------

    /**
     * Fetch account-level performance summary analytics.
     * Uses the Analytics Finder (q=analytics) with an ACCOUNT pivot.
     */
    public async getAccountAnalytics(
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange,
        timeGranularity: TLinkedInTimeGranularity = 'MONTHLY'
    ): Promise<ILinkedInAnalyticsRecord[]> {
        console.log(
            `[LinkedIn Ads] Fetching account analytics for account ${adAccountId} (${timeGranularity})`
        );

        const params: Record<string, string> = {
            q: 'analytics',
            pivot: 'ACCOUNT',
            timeGranularity,
            dateRange: this.serializeDateRange(dateRange),
            accounts: `List(${this.accountUrn(adAccountId)})`,
            fields: LINKEDIN_PERFORMANCE_FIELDS,
        };

        const response = await this.makeRequest<{ elements: ILinkedInAnalyticsRecord[] }>(
            '/rest/adAnalytics',
            accessToken,
            params
        );

        const records = response.elements || [];
        console.log(`✅ [LinkedIn Ads] Fetched ${records.length} account analytics record(s)`);
        return records;
    }

    // -------------------------------------------------------------------------
    // Analytics — Demographic (q=statistics, MEMBER_* pivots)
    // -------------------------------------------------------------------------

    /**
     * Fetch demographic analytics using the Statistics Finder (q=statistics).
     * Supports up to 3 pivots simultaneously (e.g. CAMPAIGN + MEMBER_COUNTRY_V2).
     * Note: demographic data has a 12–24h reporting delay and 2-year retention.
     * LinkedIn drops values with < 3 events for privacy.
     *
     * Ref: GET /rest/adAnalytics?q=statistics&pivots=List(CAMPAIGN,MEMBER_COUNTRY_V2)&...
     */
    public async getDemographicAnalytics(
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange,
        demographicPivot: TLinkedInAnalyticsPivot,
        timeGranularity: TLinkedInTimeGranularity = 'ALL'
    ): Promise<ILinkedInAnalyticsRecord[]> {
        console.log(
            `[LinkedIn Ads] Fetching demographic analytics (${demographicPivot}) for account ${adAccountId}`
        );

        // Statistics finder uses pivots=List(...) plural, unlike analytics finder which uses pivot= singular
        const params: Record<string, string> = {
            q: 'statistics',
            pivots: `List(CAMPAIGN,${demographicPivot})`,
            timeGranularity,
            dateRange: this.serializeDateRange(dateRange),
            accounts: `List(${this.accountUrn(adAccountId)})`,
            fields: LINKEDIN_DEMOGRAPHIC_FIELDS,
        };

        const response = await this.makeRequest<{ elements: ILinkedInAnalyticsRecord[] }>(
            '/rest/adAnalytics',
            accessToken,
            params
        );

        const records = response.elements || [];
        console.log(`✅ [LinkedIn Ads] Fetched ${records.length} demographic analytics record(s)`);
        return records;
    }

    // -------------------------------------------------------------------------
    // Revenue Attribution (q=attributedRevenueMetrics)
    // -------------------------------------------------------------------------

    /**
     * Fetch CRM revenue attribution metrics.
     * Only returns data for accounts with Salesforce/HubSpot/Dynamics 365
     * connected in LinkedIn Business Manager.
     *
     * Ref: GET /rest/adAnalytics?q=attributedRevenueMetrics&...
     */
    public async getRevenueMetrics(
        accessToken: string,
        adAccountId: number,
        dateRange: ILinkedInDateRange
    ): Promise<ILinkedInRevenueMetrics[]> {
        console.log(
            `[LinkedIn Ads] Fetching revenue attribution metrics for account ${adAccountId}`
        );

        const fields = [
            'dateRange',
            'pivotValues',
            'revenueAttributionMetrics',
        ].join(',');

        const params: Record<string, string> = {
            q: 'attributedRevenueMetrics',
            pivot: 'CAMPAIGN',
            dateRange: this.serializeDateRange(dateRange),
            accounts: `List(${this.accountUrn(adAccountId)})`,
            fields,
        };

        const response = await this.makeRequest<{ elements: ILinkedInRevenueMetrics[] }>(
            '/rest/adAnalytics',
            accessToken,
            params
        );

        const records = response.elements || [];
        console.log(`✅ [LinkedIn Ads] Fetched ${records.length} revenue attribution record(s)`);
        return records;
    }

    // -------------------------------------------------------------------------
    // Validation helper
    // -------------------------------------------------------------------------

    /**
     * Validate that an access token can reach the LinkedIn API by fetching accounts.
     * Returns true if at least the API responds without a 401/403.
     */
    public async validateAccessToken(accessToken: string): Promise<boolean> {
        try {
            await this.listAdAccounts(accessToken);
            return true;
        } catch (error) {
            const msg = (error as Error).message || '';
            if (msg.includes('authentication') || msg.includes('401') || msg.includes('403')) {
                return false;
            }
            // Other errors (network, 5xx) — treat token as potentially valid
            return true;
        }
    }
}
