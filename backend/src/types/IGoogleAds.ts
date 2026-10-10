/**
 * Google Ads Integration Types
 * TypeScript interfaces for Google Ads API integration
 */

/**
 * Sync types supported by the Google Ads data source.
 *
 * Settings tables mirror the Meta Ads driver (`campaigns`/`ad_groups`/`ads`/
 * `conversion_actions`), while `*_insights` tables hold daily performance data
 * the same way Meta stores `insights` and its breakdown variants.
 */
export const GOOGLE_DEFAULT_SYNC_TYPES = [
    'campaigns',
    'ad_groups',
    'ads',
    'insights',
    'ad_group_insights',
    'demographic_insights',
    'device_insights',
    'geographic_insights',
    'placement_insights',
    'keyword_insights',
    'conversion_actions',
];

/**
 * Sync type names used by the pre-v25 implementation. They are mapped to the
 * new schema on sync so existing sources pick up the new tables.
 */
export const GOOGLE_LEGACY_SYNC_TYPES = [
    'campaign',
    'keyword',
    'geographic',
    'device',
    'ad_group',
];

/**
 * Legacy logical table names that must be cleaned up after the schema upgrade.
 */
export const GOOGLE_LEGACY_TABLE_NAMES = [
    'campaigns',
    'keywords',
    'geographic',
    'device',
    'ad_groups',
];

// API Query Structure
export interface IGoogleAdsReportQuery {
    customerId: string;        // Google Ads customer ID (format: 123-456-7890)
    startDate: string;          // YYYY-MM-DD
    endDate: string;            // YYYY-MM-DD
    reportType: string;         // One of GOOGLE_DEFAULT_SYNC_TYPES
}

// API Response
export interface IGoogleAdsReportResponse {
    rows: IGoogleAdsRow[];
    totalRows: number;
    queryResourceConsumption: number;
}

export interface IGoogleAdsRow {
    campaign?: {
        id: string;
        name: string;
        status: string;
        advertisingChannelType?: string;
        advertisingChannelSubType?: string;
        primaryStatus?: string;
        servingStatus?: string;
        startDateTime?: string;
        endDateTime?: string;
        biddingStrategyType?: string;
        optimizationScore?: number;
        targetCpa?: { targetCpaMicros: string | number };
        targetRoas?: { targetRoas: number };
        trackingUrlTemplate?: string;
        labels?: Array<{ labelNames: string[] }>;
    };
    campaignBudget?: {
        id: string;
        amountMicros: string | number;
        explicitlyShared: boolean;
        deliveryMethod?: string;
        period?: string;
        status?: string;
        totalAmountMicros?: string | number;
    };
    adGroup?: {
        id: string;
        name: string;
        status: string;
        type?: string;
        cpcBidMicros?: string | number;
        targetingSetting?: { targetRestrictions: Array<{ targetingDimension: string; bidOnly: boolean }> };
        effectiveTargetCpa?: { value?: string | number };
        baseAdGroup?: string;
        createdTime?: string;
    };
    adGroupAd?: {
        id?: string;
        name?: string;
        status: string;
        ad?: {
            id?: string;
            name?: string;
            type?: string;
            finalUrls?: string[];
            finalMobileUrls?: string[];
            displayUrl?: string;
            trackingUrlTemplate?: string;
            responsiveSearchAd?: {
                headlines?: Array<{ text: string }>;
                descriptions?: Array<{ text: string }>;
            };
            videoResponsiveAd?: {
                headlines?: Array<{ text: string }>;
                descriptions?: Array<{ text: string }>;
            };
        };
    };
    adGroupCriterion?: {
        keyword?: {
            text: string;
            matchType: string;
        };
        qualityInfo?: {
            qualityScore: number;
        };
        ageRange?: {
            type: string;
        };
        gender?: {
            type: string;
        };
        status?: string;
    };
    geographicView?: {
        countryCriterionId: string | number;
        locationType?: string;
    };
    conversionAction?: {
        id: string;
        name: string;
        status: string;
        type: string;
        category: string;
        countingType: string;
        attributionModelSettings?: {
            attributionModel: string;
        };
        includeInConversionsMetric: boolean;
        clickThroughLookbackWindowDays: number;
        viewThroughLookbackWindowDays: number;
        origin: string;
        primaryForGoal: boolean;
        valueSettings?: {
            defaultValue: number;
            defaultCurrencyCode: string;
        };
    };
    metrics: {
        impressions: number;
        clicks: number;
        costMicros: number;        // Cost in micros (1,000,000 = $1)
        conversions: number;
        conversionsValue: number;
        allConversions: number;
        allConversionsValue: number;
        viewThroughConversions: number;
        searchImpressionShare: number;
        searchRankLostImpressionShare: number;
        searchTopImpressionShare: number;
        searchAbsoluteTopImpressionShare: number;
        searchClickShare: number;
        interactions: number;
        interactionRate: number;
        ctr: number;
        averageCpc: number;
        averageCpm: number;
        averageCpa: number;
        averageCpv: number;
        videoViews: number;
        videoViewRate: number;
        reach: number;
        crossDeviceConversions: number;
        activeViewImpressions: number;
        activeViewCtr: number;
        activeViewViewability: number;
        gmailForwards: number;
        gmailSaves: number;
        gmailSecondaryClicks: number;
        invalidClickRate: number;
    };
    segments?: {
        date: string;
        device: string;
        adNetworkType: string;
        slot: string;
        geoTargetRegion: string;
        geoTargetCity: string;
    };
}

// Sync Configuration
export interface IGoogleAdsSyncConfig {
    name: string;
    customerId: string;
    managerCustomerId?: string;  // When selecting a client under a manager
    accessToken: string;
    refreshToken: string;
    reportTypes: string[];      // Sync type keys from GOOGLE_DEFAULT_SYNC_TYPES
    startDate: string;
    endDate: string;
    project_id?: number;        // Project the data source belongs to
}

// Frontend Types
export interface IGoogleAdsAccount {
    customerId: string;
    descriptiveName: string;
    currencyCode: string;
    timeZone: string;
    isManager?: boolean;
    clientAccounts?: IGoogleAdsClientAccount[];
}

export interface IGoogleAdsClientAccount {
    customerId: string;
    descriptiveName: string;
}

export interface IGoogleAdsReportTypeDefinition {
    id: string;
    name: string;
    description: string;
    dimensions: string[];
    metrics: string[];
}

// Sync Status
export interface IGoogleAdsSyncStatus {
    lastSyncTime: string | null;
    status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    recordsSynced: number;
    recordsFailed: number;
    error?: string;
}
