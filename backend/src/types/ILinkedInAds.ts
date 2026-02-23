/**
 * LinkedIn Ads Integration Types
 * TypeScript interfaces for LinkedIn Marketing API (Version: 202601)
 *
 * API Reference: https://learn.microsoft.com/en-us/linkedin/marketing/
 *
 * Key facts:
 *  - LinkedIn-Version header must be: 202601 (January 2026, latest)
 *  - Ad Account id is a LONG integer, NOT a URN string
 *  - Analytics date ranges use structured { year, month, day } objects
 *  - Analytics requests MUST specify a `fields` param (max 20 metrics)
 *  - Campaigns / campaign groups / creatives are nested under adAccounts
 *  - adAnalytics has 3 finders: analytics, statistics, attributedRevenueMetrics
 *  - adAnalytics does NOT support pagination (max 15,000 elements per call)
 *  - Search/list APIs use cursor-based pagination (pageToken / nextPageToken)
 */

// ─── OAuth ────────────────────────────────────────────────────────────────────

export interface ILinkedInTokens {
    access_token: string;
    refresh_token?: string;
    token_type: 'Bearer';
    expires_in: number;       // seconds until expiry
    expires_at: number;       // Unix timestamp (ms) when token expires
    scope: string;            // space-separated granted scopes
}

export interface ILinkedInTokenResponse {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    refresh_token_expires_in?: number;
    scope: string;
}

// ─── Date / Date Range ────────────────────────────────────────────────────────

/**
 * LinkedIn structured date object used in analytics query params and responses.
 * Plain ISO strings (YYYY-MM-DD) are NOT accepted by the API.
 */
export interface ILinkedInDate {
    year: number;
    month: number;   // 1-based
    day: number;
}

export interface ILinkedInDateRange {
    start: ILinkedInDate;
    end?: ILinkedInDate;  // optional — omitting end means up to today
}

// ─── Ad Accounts ─────────────────────────────────────────────────────────────

/**
 * LinkedIn Ad Account
 * id is a long integer — URN is constructed as urn:li:sponsoredAccount:{id}
 * Ref: GET /rest/adAccounts?q=search
 */
export interface ILinkedInAdAccount {
    id: number;                    // Long integer, NOT a URN
    name: string;
    type: 'BUSINESS' | 'ENTERPRISE';
    status: 'ACTIVE' | 'DRAFT' | 'CANCELED' | 'PENDING_DELETION' | 'REMOVED';
    currency: string;              // ISO 4217 code e.g. USD
    test: boolean;                 // Filter test accounts out during sync
    servingStatuses: string[];     // RUNNABLE | STOPPED | BILLING_HOLD | etc.
    reference?: string;            // urn:li:organization:{id} or urn:li:person:{id}
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

/**
 * LinkedIn Sponsored Campaign
 * Ref: GET /rest/adAccounts/{adAccountId}/adCampaigns?q=search
 */
export interface ILinkedInCampaign {
    id: number;
    name: string;
    account: string;          // URN: urn:li:sponsoredAccount:{id}
    campaignGroup?: string;   // URN: urn:li:sponsoredCampaignGroup:{id}
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'COMPLETED' | 'CANCELED' | 'DRAFT';
    type: 'TEXT_AD' | 'SPONSORED_UPDATES' | 'SPONSORED_INMAILS' | 'DYNAMIC';
    costType?: 'CPM' | 'CPC' | 'CPV';
    objectiveType?: string;
    creativeSelection?: 'OPTIMIZED' | 'ROUND_ROBIN';
    dailyBudget?: { amount: string; currencyCode: string };
    totalBudget?: { amount: string; currencyCode: string };
    unitCost?: { amount: string; currencyCode: string };
    test: boolean;
    changeAuditStamps?: {
        created?: { time: number };
        lastModified?: { time: number };
    };
}

// ─── Campaign Groups ──────────────────────────────────────────────────────────

/**
 * LinkedIn Sponsored Campaign Group
 * Ref: GET /rest/adAccounts/{adAccountId}/adCampaignGroups?q=search
 */
export interface ILinkedInCampaignGroup {
    id: number;
    name: string;
    account: string;          // URN: urn:li:sponsoredAccount:{id}
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'CANCELED' | 'DRAFT';
    totalBudget?: { amount: string; currencyCode: string };
    runSchedule?: { start: number; end?: number };  // Unix timestamps (ms)
    test: boolean;
    changeAuditStamps?: {
        created?: { time: number };
        lastModified?: { time: number };
    };
}

// ─── Creatives ────────────────────────────────────────────────────────────────

/**
 * LinkedIn Ad Creative
 * Ref: GET /rest/adAccounts/{adAccountId}/adCreatives?q=search
 */
export interface ILinkedInCreative {
    id: number;
    campaign: string;   // URN: urn:li:sponsoredCampaign:{id}
    account?: string;   // URN: urn:li:sponsoredAccount:{id}
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'CANCELED' | 'DRAFT';
    intendedStatus?: string;
    servingHoldReasons?: string[];
    test: boolean;
    changeAuditStamps?: {
        created?: { time: number };
        lastModified?: { time: number };
    };
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/**
 * Analytics time granularity options
 */
export type TLinkedInTimeGranularity = 'ALL' | 'DAILY' | 'MONTHLY' | 'YEARLY';

/**
 * Supported analytics pivot values
 * Single pivot: use Analytics Finder (q=analytics)
 * Multi-pivot (up to 3): use Statistics Finder (q=statistics)
 */
export type TLinkedInAnalyticsPivot =
    | 'ACCOUNT'
    | 'CAMPAIGN_GROUP'
    | 'CAMPAIGN'
    | 'CREATIVE'
    | 'CONVERSION'
    | 'SERVING_LOCATION'
    | 'MEMBER_JOB_TITLE'
    | 'MEMBER_SENIORITY'
    | 'MEMBER_INDUSTRY'
    | 'MEMBER_COMPANY_SIZE'
    | 'MEMBER_COUNTRY_V2'
    | 'MEMBER_REGION_V2'
    | 'MEMBER_COUNTY'
    | 'CARD_INDEX';

/**
 * Unified analytics record returned from adAnalytics endpoint.
 * BigDecimal fields (cost, revenue) are returned as strings to avoid
 * floating-point precision loss.
 *
 * Ref: GET /rest/adAnalytics?q=analytics | q=statistics | q=attributedRevenueMetrics
 */
export interface ILinkedInAnalyticsRecord {
    pivotValues: string[];            // URN strings per pivot
    dateRange: ILinkedInDateRange;

    // Core performance metrics
    impressions?: number;
    clicks?: number;
    costInLocalCurrency?: string;     // BigDecimal as string
    costInUsd?: string;               // BigDecimal as string

    // Conversions
    externalWebsiteConversions?: number;
    externalWebsitePostClickConversions?: number;
    externalWebsitePostViewConversions?: number;

    // Lead generation
    oneClickLeads?: number;
    oneClickLeadFormOpens?: number;
    qualifiedLeads?: number;
    validWorkEmailLeads?: number;

    // Video
    videoViews?: number;
    videoStarts?: number;
    videoFirstQuartileCompletions?: number;
    videoMidpointCompletions?: number;
    videoThirdQuartileCompletions?: number;
    videoCompletions?: number;
    videoWatchTime?: number;          // milliseconds

    // Engagement
    totalEngagements?: number;
    landingPageClicks?: number;
    companyPageClicks?: number;
    follows?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reactions?: number;
    otherEngagements?: number;

    // Document ads
    documentCompletions?: number;
    documentFirstQuartileCompletions?: number;
    documentMidpointCompletions?: number;
    documentThirdQuartileCompletions?: number;

    // Reach (only available for date ranges ≤ 92 days)
    approximateMemberReach?: number;

    // Viral metrics (Sponsored Content only)
    viralImpressions?: number;
    viralClicks?: number;
    viralTotalEngagements?: number;
    viralLikes?: number;
    viralShares?: number;
    viralComments?: number;
    viralFollows?: number;
    viralExternalWebsiteConversions?: number;
    viralOneClickLeads?: number;
    viralVideoViews?: number;
    viralVideoCompletions?: number;
}

/**
 * Revenue Attribution Metrics record
 * Only populated for accounts with a CRM (Salesforce, HubSpot, Dynamics 365)
 * connected to LinkedIn Business Manager.
 * Ref: GET /rest/adAnalytics?q=attributedRevenueMetrics
 */
export interface ILinkedInRevenueMetrics {
    pivotValues: string[];
    dateRange: ILinkedInDateRange;
    revenueAttributionMetrics: {
        revenueWonInUsd?: string;              // BigDecimal as string
        returnOnAdSpend?: number;
        closedWonOpportunities?: number;
        openOpportunities?: number;            // Only when dateRange.end = today
        opportunityAmountInUsd?: string;       // BigDecimal as string
        opportunityWinRate?: number;
        averageDealSizeInUsd?: string;         // BigDecimal as string
        averageDaysToClose?: number;
    };
}

// ─── Sync Config & Status ─────────────────────────────────────────────────────

/**
 * Configuration object passed to LinkedInAdsDriver.syncToDatabase()
 */
export interface ILinkedInSyncConfig {
    adAccountId: number;             // Long integer
    startDate: ILinkedInDate;        // Structured — NOT an ISO string
    endDate: ILinkedInDate;          // Structured — NOT an ISO string
    timeGranularity: TLinkedInTimeGranularity;
    includeDemographics: boolean;    // Opt-in: MEMBER_* pivots (12–24h delay)
    includeRevenueAttribution: boolean; // Opt-in: requires CRM connection
}

export interface ILinkedInSyncResult {
    adAccounts: number;
    campaigns: number;
    campaignGroups: number;
    creatives: number;
    campaignAnalytics: number;
    creativeAnalytics: number;
    accountAnalytics: number;
    demographicAnalytics: number;
    revenueAttribution: number;
    durationMs: number;
}

export interface ILinkedInSyncStatus {
    lastSync: Date | null;
    status: 'success' | 'failed' | 'running' | null;
    syncResult: ILinkedInSyncResult | null;
    errorMessage?: string;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

/**
 * Default performance metric fields requested from adAnalytics.
 * Always pass these explicitly — the API defaults to impressions+clicks only.
 * Maximum 20 metrics per request.
 */
export const LINKEDIN_PERFORMANCE_FIELDS = [
    'dateRange',
    'pivotValues',
    'impressions',
    'clicks',
    'costInLocalCurrency',
    'costInUsd',
    'externalWebsiteConversions',
    'externalWebsitePostClickConversions',
    'externalWebsitePostViewConversions',
    'oneClickLeads',
    'videoViews',
    'videoCompletions',
    'videoWatchTime',
    'totalEngagements',
    'landingPageClicks',
    'approximateMemberReach',
    'follows',
    'likes',
    'comments',
    'shares',
].join(','); // 20 metrics — at maximum allowed per request

/**
 * Demographic-pivot metric fields (Statistics Finder, MEMBER_* pivots).
 * Smaller set: demographic data excludes some performance-only fields.
 */
export const LINKEDIN_DEMOGRAPHIC_FIELDS = [
    'dateRange',
    'pivotValues',
    'impressions',
    'clicks',
    'costInLocalCurrency',
    'externalWebsiteConversions',
    'oneClickLeads',
    'videoViews',
    'totalEngagements',
].join(',');

/**
 * Minimum engagement threshold for demographic pivots.
 * LinkedIn drops values with fewer than 3 events.
 */
export const LINKEDIN_DEMOGRAPHIC_MIN_EVENTS = 3;

/**
 * Max elements per adAnalytics response (no pagination supported).
 * If a call would return more, split by date range or campaign chunks.
 */
export const LINKEDIN_ANALYTICS_MAX_ELEMENTS = 15000;

/**
 * Data throttle: 45 million metric values per 5-minute window.
 * data_cost = (num_metrics) × (num_records_returned)
 */
export const LINKEDIN_DATA_THROTTLE_5MIN = 45_000_000;

/**
 * Demographic analytics data retention: 2 years.
 * Performance analytics data retention: 10 years.
 */
export const LINKEDIN_DEMOGRAPHIC_RETENTION_YEARS = 2;
export const LINKEDIN_PERFORMANCE_RETENTION_YEARS = 10;
