/**
 * Marketing KPI Column Name Patterns for Auto-KPI Detection (DM-002)
 *
 * Maps column name regex patterns to standardized KPI identifiers.
 * Used by DataModelAnalysisService to automatically classify data model
 * columns as known marketing KPIs without user configuration.
 *
 * Supports common naming conventions: camelCase, snake_case, kebab-case, spaces.
 */

/**
 * Classification category for a column
 */
export type ColumnClassification = 'metric' | 'dimension' | 'time';

/**
 * A single KPI pattern entry
 */
export interface IKPIPatternEntry {
    /** Regex pattern to match column names */
    pattern: RegExp;
    /** Standardized KPI identifier (e.g., "spend", "impressions") */
    kpi: string;
    /** Human-readable label for display */
    label: string;
    /** Classification category */
    classification: ColumnClassification;
    /** Whether this KPI is a rate/ratio metric */
    is_rate: boolean;
    /** Confidence score (0-1) */
    confidence: number;
}

/**
 * A detected composite KPI (computed from two or more source columns)
 */
export interface ICompositeKPI {
    /** Standardized KPI identifier */
    kpi: string;
    /** Human-readable label */
    label: string;
    /** Formula string (e.g., "clicks / impressions") */
    formula: string;
    /** Required column KPI identifiers */
    required_kpis: string[];
    /** Confidence score */
    confidence: number;
}

// ── Metric Patterns ─────────────────────────────────────────────────────────

export const KPI_METRIC_PATTERNS: IKPIPatternEntry[] = [
    // Spend / Cost
    { pattern: /\b(spend|cost_micros|cost|amount_spent|total_cost|ad_spend|media_spend|budget|budget_spend)\b/i, kpi: "spend", label: "Total Spend", classification: "metric", is_rate: false, confidence: 0.95 },

    // Impressions
    { pattern: /\b(impressions?|impr(?:essions?)?)\b/i, kpi: "impressions", label: "Impressions", classification: "metric", is_rate: false, confidence: 0.95 },

    // Clicks
    { pattern: /\b(clicks?|click_count|link_clicks?)\b/i, kpi: "clicks", label: "Clicks", classification: "metric", is_rate: false, confidence: 0.95 },

    // Conversions
    { pattern: /\b(conversions?|all_conversions?|purchases?|signups?|signup_count)\b/i, kpi: "conversions", label: "Conversions", classification: "metric", is_rate: false, confidence: 0.95 },

    // Leads
    { pattern: /\b(leads?|lead_count|new_leads?|mqls?|sqls?|qualified_leads?)\b/i, kpi: "leads", label: "Leads", classification: "metric", is_rate: false, confidence: 0.9 },

    // Revenue / Conversion Value
    { pattern: /\b(revenue|conversion_value|purchase_value|total_revenue|gross_revenue|net_revenue|income|earnings)\b/i, kpi: "revenue", label: "Revenue", classification: "metric", is_rate: false, confidence: 0.95 },

    // Engagement
    { pattern: /\b(engagement_rate|engagements?|engaged_sessions?)\b/i, kpi: "engagement", label: "Engagement", classification: "metric", is_rate: false, confidence: 0.85 },

    // Opens (email)
    { pattern: /\b(opens?|open_rate|email_opens?)\b/i, kpi: "opens", label: "Opens", classification: "metric", is_rate: false, confidence: 0.9 },

    // Sends (email)
    { pattern: /\b(sends?|emails?_?sent|total_sends?)\b/i, kpi: "sends", label: "Sends", classification: "metric", is_rate: false, confidence: 0.9 },

    // Bounces
    { pattern: /\b(bounces?|hard_bounces?|soft_bounces?)\b/i, kpi: "bounces", label: "Bounces", classification: "metric", is_rate: false, confidence: 0.9 },

    // Unsubscribes
    { pattern: /\b(unsubscribes?)\b/i, kpi: "unsubscribes", label: "Unsubscribes", classification: "metric", is_rate: false, confidence: 0.9 },

    // Sessions / Users / Traffic
    { pattern: /\b(sessions?|visitors?|active_users?|new_users?|unique_visitors?|pageviews?)\b/i, kpi: "traffic", label: "Traffic", classification: "metric", is_rate: false, confidence: 0.8 },

    // Shares / Social
    { pattern: /\b(shares?|retweets?|reposts?|social_shares?)\b/i, kpi: "shares", label: "Shares", classification: "metric", is_rate: false, confidence: 0.85 },

    // Likes / Reactions
    { pattern: /\b(likes?|reactions?|favorites?)\b/i, kpi: "likes", label: "Likes", classification: "metric", is_rate: false, confidence: 0.8 },

    // Comments
    { pattern: /\b(comments?|replies?|comment_count)\b/i, kpi: "comments", label: "Comments", classification: "metric", is_rate: false, confidence: 0.8 },

    // Video Views
    { pattern: /\b(video_views?|watch_time|play_count)\b/i, kpi: "video_views", label: "Video Views", classification: "metric", is_rate: false, confidence: 0.9 },

    // Reach
    { pattern: /\b(reach|unique_reach)\b/i, kpi: "reach", label: "Reach", classification: "metric", is_rate: false, confidence: 0.85 },

    // Frequency
    { pattern: /\b(frequency|avg_frequency)\b/i, kpi: "frequency", label: "Frequency", classification: "metric", is_rate: false, confidence: 0.85 },

    // Profit / Margin
    { pattern: /\b(profit|margin|gross_profit|net_profit|profit_margin)\b/i, kpi: "profit", label: "Profit", classification: "metric", is_rate: false, confidence: 0.9 },

    // Deals / Opportunities
    { pattern: /\b(deals?|opportunities?|pipeline|won_deals?|closed_deals?)\b/i, kpi: "deals", label: "Deals", classification: "metric", is_rate: false, confidence: 0.85 },

    // ── Rate / Ratio Metrics ─────────────────────────────────────────────

    // CTR (Click-Through Rate)
    { pattern: /\b(ctr|click_through_rate|clickthrough_rate)\b/i, kpi: "ctr", label: "Click-Through Rate (CTR)", classification: "metric", is_rate: true, confidence: 0.95 },

    // CPC (Cost Per Click)
    { pattern: /\b(cpc|cost_per_click|avg_cpc|average_cpc)\b/i, kpi: "cpc", label: "Cost Per Click (CPC)", classification: "metric", is_rate: true, confidence: 0.95 },

    // CPA (Cost Per Acquisition)
    { pattern: /\b(cpa|cost_per_acquisition|cost_per_conversion|cost_per_action)\b/i, kpi: "cpa", label: "Cost Per Acquisition (CPA)", classification: "metric", is_rate: true, confidence: 0.95 },

    // CPL (Cost Per Lead)
    { pattern: /\b(cpl|cost_per_lead)\b/i, kpi: "cpl", label: "Cost Per Lead (CPL)", classification: "metric", is_rate: true, confidence: 0.95 },

    // CPM (Cost Per Mille)
    { pattern: /\b(cpm|cost_per_mille|cost_per_thousand)\b/i, kpi: "cpm", label: "Cost Per Mille (CPM)", classification: "metric", is_rate: true, confidence: 0.95 },

    // ROAS (Return On Ad Spend)
    { pattern: /\b(roas|return_on_ad_spend)\b/i, kpi: "roas", label: "Return On Ad Spend (ROAS)", classification: "metric", is_rate: true, confidence: 0.95 },

    // Conversion Rate
    { pattern: /\b(conversion_rate|conv_rate|cvr)\b/i, kpi: "conversion_rate", label: "Conversion Rate", classification: "metric", is_rate: true, confidence: 0.95 },

    // Bounce Rate
    { pattern: /\b(bounce_rate)\b/i, kpi: "bounce_rate", label: "Bounce Rate", classification: "metric", is_rate: true, confidence: 0.9 },

    // Open Rate
    { pattern: /\b(open_rate)\b/i, kpi: "open_rate", label: "Open Rate", classification: "metric", is_rate: true, confidence: 0.9 },

    // Unsubscribe Rate
    { pattern: /\b(unsubscribe_rate)\b/i, kpi: "unsubscribe_rate", label: "Unsubscribe Rate", classification: "metric", is_rate: true, confidence: 0.9 },

    // Engagement Rate
    { pattern: /\b(engagement_rate)\b/i, kpi: "engagement_rate", label: "Engagement Rate", classification: "metric", is_rate: true, confidence: 0.9 },
];

// ── Dimension Patterns ──────────────────────────────────────────────────────

export const KPI_DIMENSION_PATTERNS: IKPIPatternEntry[] = [
    // Campaign
    { pattern: /\b(campaign_name|campaign_id|campaign_type|campaign_status|campaign)\b/i, kpi: "campaign", label: "Campaign", classification: "dimension", is_rate: false, confidence: 0.95 },

    // Ad Group
    { pattern: /\b(ad_group_name|ad_group_id|ad_group|adgroup|ad_set)\b/i, kpi: "ad_group", label: "Ad Group", classification: "dimension", is_rate: false, confidence: 0.95 },

    // Ad / Creative
    { pattern: /\b(ad_name|ad_id|ad_type|creative_name|creative_id|ad_creative)\b/i, kpi: "ad", label: "Ad / Creative", classification: "dimension", is_rate: false, confidence: 0.9 },

    // Keyword
    { pattern: /\b(keyword|keyword_text|keyword_id|keyword_match_type|keywords)\b/i, kpi: "keyword", label: "Keyword", classification: "dimension", is_rate: false, confidence: 0.95 },

    // Channel / Source
    { pattern: /\b(channel|channel_name|source|traffic_source|medium|utm_source|utm_medium|channel_type)\b/i, kpi: "channel", label: "Channel / Source", classification: "dimension", is_rate: false, confidence: 0.9 },

    // Platform / Network
    { pattern: /\b(platform|platform_name|network|network_name|publisher|publisher_name)\b/i, kpi: "platform", label: "Platform / Network", classification: "dimension", is_rate: false, confidence: 0.85 },

    // Geo / Location
    { pattern: /\b(country|region|city|geo|geography|location|state|province|zip_code|postal_code|market)\b/i, kpi: "geo", label: "Location", classification: "dimension", is_rate: false, confidence: 0.9 },

    // Device
    { pattern: /\b(device|device_name|device_type|device_category)\b/i, kpi: "device", label: "Device", classification: "dimension", is_rate: false, confidence: 0.9 },

    // Audience / Segment
    { pattern: /\b(audience|audience_name|segment|segment_name|target_audience|customer_segment)\b/i, kpi: "audience", label: "Audience / Segment", classification: "dimension", is_rate: false, confidence: 0.9 },

    // Content / Page
    { pattern: /\b(content|content_name|page|page_name|page_title|landing_page|page_path)\b/i, kpi: "content", label: "Content / Page", classification: "dimension", is_rate: false, confidence: 0.85 },

    // Account
    { pattern: /\b(account|account_name|customer_name|client_name)\b/i, kpi: "account", label: "Account", classification: "dimension", is_rate: false, confidence: 0.85 },

    // Placement
    { pattern: /\b(placement|placement_name|placement_id|placement_type)\b/i, kpi: "placement", label: "Placement", classification: "dimension", is_rate: false, confidence: 0.9 },

    // Objective / Goal
    { pattern: /\b(objective|objective_type|goal|bid_strategy|bid_type)\b/i, kpi: "objective", label: "Objective", classification: "dimension", is_rate: false, confidence: 0.8 },

    // Status
    { pattern: /\b(status|lifecycle_stage|lead_status|deal_stage|pipeline_stage)\b/i, kpi: "status", label: "Status", classification: "dimension", is_rate: false, confidence: 0.8 },
];

// ── Time Patterns ───────────────────────────────────────────────────────────

export const KPI_TIME_PATTERNS: IKPIPatternEntry[] = [
    { pattern: /\b(date|date_created|date_modified|date_start|date_end|date_range)\b/i, kpi: "date", label: "Date", classification: "time", is_rate: false, confidence: 0.95 },
    { pattern: /\b(day|day_of_week|daily)\b/i, kpi: "day", label: "Day", classification: "time", is_rate: false, confidence: 0.85 },
    { pattern: /\b(week|weekly|week_number|week_start|week_end)\b/i, kpi: "week", label: "Week", classification: "time", is_rate: false, confidence: 0.85 },
    { pattern: /\b(month|monthly|month_name|month_number|month_start|month_end)\b/i, kpi: "month", label: "Month", classification: "time", is_rate: false, confidence: 0.85 },
    { pattern: /\b(quarter|quarterly|q[1-4])\b/i, kpi: "quarter", label: "Quarter", classification: "time", is_rate: false, confidence: 0.85 },
    { pattern: /\b(year|yearly|annual|fiscal_year|fiscal_quarter)\b/i, kpi: "year", label: "Year", classification: "time", is_rate: false, confidence: 0.85 },
    { pattern: /\b(timestamp|datetime|created_at|updated_at|modified_at|inserted_at)\b/i, kpi: "timestamp", label: "Timestamp", classification: "time", is_rate: false, confidence: 0.9 },
];

// ── Composite KPI Definitions ───────────────────────────────────────────────

/**
 * Composite KPIs are computed metrics that can be derived when two or more
 * source KPIs are present in the data model.
 *
 * Example: CTR = clicks / impressions (only detectable if both clicks and
 * impressions columns exist)
 */
export const COMPOSITE_KPI_DEFINITIONS: ICompositeKPI[] = [
    {
        kpi: "ctr",
        label: "Click-Through Rate (CTR)",
        formula: "clicks / impressions",
        required_kpis: ["clicks", "impressions"],
        confidence: 0.9,
    },
    {
        kpi: "conversion_rate",
        label: "Conversion Rate",
        formula: "conversions / clicks",
        required_kpis: ["conversions", "clicks"],
        confidence: 0.9,
    },
    {
        kpi: "cpc",
        label: "Cost Per Click (CPC)",
        formula: "spend / clicks",
        required_kpis: ["spend", "clicks"],
        confidence: 0.9,
    },
    {
        kpi: "cpa",
        label: "Cost Per Acquisition (CPA)",
        formula: "spend / conversions",
        required_kpis: ["spend", "conversions"],
        confidence: 0.9,
    },
    {
        kpi: "cpl",
        label: "Cost Per Lead (CPL)",
        formula: "spend / leads",
        required_kpis: ["spend", "leads"],
        confidence: 0.9,
    },
    {
        kpi: "cpm",
        label: "Cost Per Mille (CPM)",
        formula: "(spend / impressions) * 1000",
        required_kpis: ["spend", "impressions"],
        confidence: 0.9,
    },
    {
        kpi: "roas",
        label: "Return On Ad Spend (ROAS)",
        formula: "revenue / spend",
        required_kpis: ["revenue", "spend"],
        confidence: 0.9,
    },
    {
        kpi: "engagement_rate",
        label: "Engagement Rate",
        formula: "engagement / impressions",
        required_kpis: ["engagement", "impressions"],
        confidence: 0.85,
    },
    {
        kpi: "bounce_rate",
        label: "Bounce Rate",
        formula: "bounces / traffic",
        required_kpis: ["bounces", "traffic"],
        confidence: 0.85,
    },
];