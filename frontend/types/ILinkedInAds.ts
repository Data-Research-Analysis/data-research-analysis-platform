/**
 * LinkedIn Ads Integration Types — Frontend
 * Mirrors backend/src/types/ILinkedInAds.ts
 *
 * LinkedIn Marketing API Version: 202601 (January 2026)
 */

// ─── Date / Date Range ────────────────────────────────────────────────────────

/**
 * LinkedIn structured date object used in analytics requests.
 * Plain ISO strings (YYYY-MM-DD) are NOT accepted by the API.
 */
export interface ILinkedInDate {
    year: number;
    month: number;  // 1-based
    day: number;
}

export interface ILinkedInDateRange {
    start: ILinkedInDate;
    end?: ILinkedInDate;
}

// ─── Ad Accounts ─────────────────────────────────────────────────────────────

export interface ILinkedInAdAccount {
    id: number;              // Long integer — NOT a URN string
    name: string;
    type: 'BUSINESS' | 'ENTERPRISE';
    status: 'ACTIVE' | 'DRAFT' | 'CANCELED' | 'PENDING_DELETION' | 'REMOVED';
    currency: string;
    test: boolean;
    servingStatuses: string[];
    reference?: string;      // urn:li:organization:{id}
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export interface ILinkedInCampaign {
    id: number;
    name: string;
    account: string;
    campaignGroup?: string;
    status: string;
    type: string;
    costType?: string;
    objectiveType?: string;
    test: boolean;
}

// ─── Campaign Groups ──────────────────────────────────────────────────────────

export interface ILinkedInCampaignGroup {
    id: number;
    name: string;
    account: string;
    status: string;
    test: boolean;
    totalBudget?: { amount: string; currencyCode: string };
}

// ─── Creatives ────────────────────────────────────────────────────────────────

export interface ILinkedInCreative {
    id: number;
    campaign: string;
    status: string;
    test: boolean;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export type TLinkedInTimeGranularity = 'ALL' | 'DAILY' | 'MONTHLY' | 'YEARLY';

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
    | 'MEMBER_REGION_V2';

// ─── Sync Config & Status ─────────────────────────────────────────────────────

export interface ILinkedInSyncConfig {
    adAccountId: number;
    startDate: ILinkedInDate;
    endDate: ILinkedInDate;
    timeGranularity: TLinkedInTimeGranularity;
    includeDemographics: boolean;
    includeRevenueAttribution: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a JS Date to LinkedIn's structured date format.
 * Use this before sending sync config to the backend.
 */
export function toLinkedInDate(date: Date): ILinkedInDate {
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1, // getMonth() is 0-based
        day: date.getDate(),
    };
}

/**
 * Convert a LinkedIn structured date back to a JS Date.
 */
export function fromLinkedInDate(d: ILinkedInDate): Date {
    return new Date(d.year, d.month - 1, d.day);
}

/**
 * Format a LinkedIn structured date as a human-readable string.
 * e.g. { year: 2026, month: 2, day: 15 } → "Feb 15, 2026"
 */
export function formatLinkedInDate(d: ILinkedInDate): string {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(fromLinkedInDate(d));
}

/**
 * Build a LinkedIn-format date range string for display.
 * e.g. "Jan 1, 2026 – Feb 1, 2026"
 */
export function formatLinkedInDateRange(range: ILinkedInDateRange): string {
    const start = formatLinkedInDate(range.start);
    const end = range.end ? formatLinkedInDate(range.end) : 'Today';
    return `${start} – ${end}`;
}
