/**
 * Marketing KPI Pattern Matcher (CONN-005)
 *
 * Classifies columns based on their names against known marketing analytics
 * patterns: KPI metrics, dimensions, and time columns.
 *
 * Used by all schema detectors (database, file, API) for consistent classification.
 */

import { ColumnRole, DetectedDataType } from "./ISchemaDetectionResult.js";

export interface IColumnClassification {
    detected_type: DetectedDataType;
    role: ColumnRole;
    kpi_match: string | null;
    dimension_match: string | null;
    confidence: number;
}

interface IPatternEntry {
    pattern: RegExp;
    kpi: string | null;
    dimension: string | null;
    role: ColumnRole;
    confidence: number;
}

/**
 * Marketing KPI patterns — column names that match these are classified as 'fact' role
 * Patterns are case-insensitive and support common naming conventions (camelCase, snake_case, spaces)
 */
const KPI_PATTERNS: IPatternEntry[] = [
    // Spend / Cost
    { pattern: /\b(spend|cost|cost[_\s]?per|budget|amount[_\s]?spent|total[_\s]?cost|ad[_\s]?spend|media[_\s]?spend)\b/i, kpi: "spend", dimension: null, role: "fact", confidence: 0.95 },
    // Impressions
    { pattern: /\b(impressions?|impr(?:essions?)?|views?\b(?!_id))\b/i, kpi: "impressions", dimension: null, role: "fact", confidence: 0.95 },
    // Clicks
    { pattern: /\b(clicks?|click[_\s]?count|link[_\s]?clicks?)\b/i, kpi: "clicks", dimension: null, role: "fact", confidence: 0.95 },
    // Conversions
    { pattern: /\b(conversions?|conv[_\s]?rate|all[_\s]?conv(?:ersions?)?|conversions?\b)\b/i, kpi: "conversions", dimension: null, role: "fact", confidence: 0.95 },
    // Revenue
    { pattern: /\b(revenue|sales|total[_\s]?revenue|gross[_\s]?revenue|net[_\s]?revenue|income|earnings)\b/i, kpi: "revenue", dimension: null, role: "fact", confidence: 0.95 },
    // Leads
    { pattern: /\b(leads?|lead[_\s]?count|new[_\s]?leads?|mqls?|sqls?|qualified[_\s]?leads?)\b/i, kpi: "leads", dimension: null, role: "fact", confidence: 0.9 },
    // Engagement
    { pattern: /\b(engagement[_\s]?rate|engagements?|engaged[_\s]?sessions?)\b/i, kpi: "engagement", dimension: null, role: "fact", confidence: 0.85 },
    // Opens (email)
    { pattern: /\b(opens?|open[_\s]?rate|email[_\s]?opens?)\b/i, kpi: "opens", dimension: null, role: "fact", confidence: 0.9 },
    // Sends (email)
    { pattern: /\b(sends?|emails?[_\s]?sent|total[_\s]?sends?)\b/i, kpi: "sends", dimension: null, role: "fact", confidence: 0.9 },
    // Unsubscribes
    { pattern: /\b(unsubscribes?|unsubscribe[_\s]?rate)\b/i, kpi: "unsubscribes", dimension: null, role: "fact", confidence: 0.9 },
    // Bounces
    { pattern: /\b(bounces?|bounce[_\s]?rate|hard[_\s]?bounces?|soft[_\s]?bounces?)\b/i, kpi: "bounces", dimension: null, role: "fact", confidence: 0.9 },
    // Sessions / Users / Traffic
    { pattern: /\b(sessions?|users?|visitors?|active[_\s]?users?|new[_\s]?users?|unique[_\s]?visitors?|pageviews?)\b/i, kpi: "traffic", dimension: null, role: "fact", confidence: 0.8 },
    // Shares / Social
    { pattern: /\b(shares?|retweets?|reposts?|social[_\s]?shares?)\b/i, kpi: "shares", dimension: null, role: "fact", confidence: 0.85 },
    // Likes / Reactions
    { pattern: /\b(likes?|reactions?|favorites?|hearts?)\b/i, kpi: "likes", dimension: null, role: "fact", confidence: 0.8 },
    // Comments
    { pattern: /\b(comments?|replies?|comment[_\s]?count)\b/i, kpi: "comments", dimension: null, role: "fact", confidence: 0.8 },
    // Video Views
    { pattern: /\b(video[_\s]?views?|watch[_\s]?time|play[_\s]?count)\b/i, kpi: "video_views", dimension: null, role: "fact", confidence: 0.9 },
    // ROAS
    { pattern: /\b(roas|return[_\s]?on[_\s]?ad[_\s]?spend)\b/i, kpi: "roas", dimension: null, role: "fact", confidence: 0.95 },
    // CTR
    { pattern: /\b(ctr|click[_\s]?through[_\s]?rate)\b/i, kpi: "ctr", dimension: null, role: "fact", confidence: 0.95 },
    // CPC
    { pattern: /\b(cpc|cost[_\s]?per[_\s]?click|avg[_\s]?cpc|average[_\s]?cpc)\b/i, kpi: "cpc", dimension: null, role: "fact", confidence: 0.95 },
    // CPA
    { pattern: /\b(cpa|cost[_\s]?per[_\s]?acquisition|cost[_\s]?per[_\s]?conversion|cost[_\s]?per[_\s]?action)\b/i, kpi: "cpa", dimension: null, role: "fact", confidence: 0.95 },
    // CPL
    { pattern: /\b(cpl|cost[_\s]?per[_\s]?lead)\b/i, kpi: "cpl", dimension: null, role: "fact", confidence: 0.95 },
    // CPM
    { pattern: /\b(cpm|cost[_\s]?per[_\s]?mille|cost[_\s]?per[_\s]?thousand)\b/i, kpi: "cpm", dimension: null, role: "fact", confidence: 0.95 },
    // Frequency
    { pattern: /\b(frequency|avg[_\s]?frequency)\b/i, kpi: "frequency", dimension: null, role: "fact", confidence: 0.85 },
    // Reach
    { pattern: /\b(reach|unique[_\s]?reach)\b/i, kpi: "reach", dimension: null, role: "fact", confidence: 0.85 },
    // Profit / Margin
    { pattern: /\b(profit|margin|gross[_\s]?profit|net[_\s]?profit|profit[_\s]?margin)\b/i, kpi: "profit", dimension: null, role: "fact", confidence: 0.9 },
    // Deals / Opportunities
    { pattern: /\b(deals?|opportunities?|pipeline|won[_\s]?deals?|closed[_\s]?deals?)\b/i, kpi: "deals", dimension: null, role: "fact", confidence: 0.85 },
];

/**
 * Dimension patterns — column names matching these are classified as 'dimension' role
 */
const DIMENSION_PATTERNS: IPatternEntry[] = [
    // Campaign
    { pattern: /\b(campaign[_\s]?(?:name|id|type|status|group)?|campaigns?)\b/i, kpi: null, dimension: "campaign", role: "dimension", confidence: 0.95 },
    // Ad Group
    { pattern: /\b(ad[_\s]?group[_\s]?(?:name|id|type)?|ad[_\s]?set|adgroups?)\b/i, kpi: null, dimension: "ad_group", role: "dimension", confidence: 0.95 },
    // Ad / Creative
    { pattern: /\b(ad[_\s]?(?:name|id|type|creative|copy|headline|text)?|creative[_\s]?(?:name|id|type)?)\b/i, kpi: null, dimension: "ad", role: "dimension", confidence: 0.9 },
    // Keyword
    { pattern: /\b(keyword[_\s]?(?:name|id|text|match[_\s]?type)?|keywords?)\b/i, kpi: null, dimension: "keyword", role: "dimension", confidence: 0.95 },
    // Channel / Source
    { pattern: /\b(channel[_\s]?(?:name|id|type)?|source|traffic[_\s]?source|medium|utm[_\s]?source|utm[_\s]?medium)\b/i, kpi: null, dimension: "channel", role: "dimension", confidence: 0.9 },
    // Platform / Network
    { pattern: /\b(platform[_\s]?(?:name|id|type)?|network[_\s]?(?:name|id)?|publisher)\b/i, kpi: null, dimension: "platform", role: "dimension", confidence: 0.85 },
    // Geo / Location
    { pattern: /\b(country|region|city|geo(?:graphy)?[_\s]?(?:name|id|code)?|location|state|province|zip[_\s]?code|postal[_\s]?code|market)\b/i, kpi: null, dimension: "geo", role: "dimension", confidence: 0.9 },
    // Device
    { pattern: /\b(device[_\s]?(?:name|type|category)?|device|mobile|desktop|tablet)\b/i, kpi: null, dimension: "device", role: "dimension", confidence: 0.9 },
    // Audience / Segment
    { pattern: /\b(audience[_\s]?(?:name|id|segment)?|segment[_\s]?(?:name|id)?|target[_\s]?audience|customer[_\s]?segment)\b/i, kpi: null, dimension: "audience", role: "dimension", confidence: 0.9 },
    // Content / Page
    { pattern: /\b(content[_\s]?(?:name|id|type|group)?|page[_\s]?(?:name|title|path|url)?|landing[_\s]?page)\b/i, kpi: null, dimension: "content", role: "dimension", confidence: 0.85 },
    // Account
    { pattern: /\b(account[_\s]?(?:name|id|type)?|customer[_\s]?(?:name|id)?|client[_\s]?(?:name|id)?)\b/i, kpi: null, dimension: "account", role: "dimension", confidence: 0.85 },
    // Gender / Demographic
    { pattern: /\b(gender|age[_\s]?(?:group|range)?|demographic)\b/i, kpi: null, dimension: "demographic", role: "dimension", confidence: 0.85 },
    // Placement
    { pattern: /\b(placement[_\s]?(?:name|id|type)?|placements?)\b/i, kpi: null, dimension: "placement", role: "dimension", confidence: 0.9 },
    // Objective / Goal
    { pattern: /\b(objective[_\s]?(?:name|type)?|goal|bid[_\s]?(?:strategy|type)?)\b/i, kpi: null, dimension: "objective", role: "dimension", confidence: 0.8 },
    // Status
    { pattern: /\b(status|state|lifecycle[_\s]?stage|lead[_\s]?status|deal[_\s]?stage|pipeline[_\s]?stage)\b/i, kpi: null, dimension: "status", role: "dimension", confidence: 0.8 },
];

/**
 * Time column patterns
 */
const TIME_PATTERNS: IPatternEntry[] = [
    { pattern: /\b(date[_\s]?(?:created|modified|updated|start|end|range)?|date)\b/i, kpi: null, dimension: null, role: "time", confidence: 0.95 },
    { pattern: /\b(day|daily|day[_\s]?of[_\s]?week)\b/i, kpi: null, dimension: null, role: "time", confidence: 0.85 },
    { pattern: /\b(week|weekly|week[_\s]?(?:number|start|end)?)\b/i, kpi: null, dimension: null, role: "time", confidence: 0.85 },
    { pattern: /\b(month|monthly|month[_\s]?(?:name|number|start|end)?)\b/i, kpi: null, dimension: null, role: "time", confidence: 0.85 },
    { pattern: /\b(quarter|quarterly|q[1-4])\b/i, kpi: null, dimension: null, role: "time", confidence: 0.85 },
    { pattern: /\b(year|yearly|annual|fiscal[_\s]?(?:year|quarter)?)\b/i, kpi: null, dimension: null, role: "time", confidence: 0.85 },
    { pattern: /\b(timestamp|datetime|created[_\s]?(?:at|on|date)|updated[_\s]?(?:at|on|date)|modified[_\s]?(?:at|on|date)|inserted[_\s]?(?:at|on))\b/i, kpi: null, dimension: null, role: "time", confidence: 0.9 },
    { pattern: /\b(hour|hourly|time[_\s]?(?:stamp|period|zone)?)\b/i, kpi: null, dimension: null, role: "time", confidence: 0.8 },
];

export class MarketingKPIMatcher {
    private static instance: MarketingKPIMatcher;

    private constructor() {}

    public static getInstance(): MarketingKPIMatcher {
        if (!MarketingKPIMatcher.instance) {
            MarketingKPIMatcher.instance = new MarketingKPIMatcher();
        }
        return MarketingKPIMatcher.instance;
    }

    /**
     * Classify a column by name and native data type
     *
     * @param columnName - The column name to classify
     * @param nativeType - The native data type from the source
     * @returns Classification with role, KPI match, dimension match, and confidence
     */
    public classifyColumn(columnName: string, nativeType: string): IColumnClassification {
        const detectedType = this.mapNativeType(nativeType);

        // First, check time patterns (highest priority for date-type columns)
        if (detectedType === "date") {
            const timeMatch = this.matchPatterns(columnName, TIME_PATTERNS);
            if (timeMatch) {
                return {
                    detected_type: "date",
                    role: "time",
                    kpi_match: null,
                    dimension_match: null,
                    confidence: Math.max(timeMatch.confidence, 0.9),
                };
            }
            // Date-type column not matching time patterns is still likely time
            return {
                detected_type: "date",
                role: "time",
                kpi_match: null,
                dimension_match: null,
                confidence: 0.85,
            };
        }

        // Check KPI patterns (fact role)
        const kpiMatch = this.matchPatterns(columnName, KPI_PATTERNS);
        if (kpiMatch) {
            return {
                detected_type: detectedType,
                role: "fact",
                kpi_match: kpiMatch.kpi,
                dimension_match: null,
                confidence: kpiMatch.confidence,
            };
        }

        // Check dimension patterns
        const dimMatch = this.matchPatterns(columnName, DIMENSION_PATTERNS);
        if (dimMatch) {
            return {
                detected_type: detectedType,
                role: "dimension",
                kpi_match: null,
                dimension_match: dimMatch.dimension,
                confidence: dimMatch.confidence,
            };
        }

        // Check time patterns by name (even if type is not date — e.g., "week" stored as string)
        const timeMatch = this.matchPatterns(columnName, TIME_PATTERNS);
        if (timeMatch) {
            return {
                detected_type: detectedType,
                role: "time",
                kpi_match: null,
                dimension_match: null,
                confidence: timeMatch.confidence,
            };
        }

        // Numeric columns without a KPI match are still potential facts
        if (detectedType === "numeric") {
            return {
                detected_type: "numeric",
                role: "fact",
                kpi_match: null,
                dimension_match: null,
                confidence: 0.5,
            };
        }

        // Boolean columns
        if (detectedType === "boolean") {
            return {
                detected_type: "boolean",
                role: "dimension",
                kpi_match: null,
                dimension_match: null,
                confidence: 0.7,
            };
        }

        // Text/categorical columns default to dimension
        if (detectedType === "categorical" || detectedType === "text") {
            return {
                detected_type: detectedType,
                role: "dimension",
                kpi_match: null,
                dimension_match: null,
                confidence: 0.5,
            };
        }

        // Unknown
        return {
            detected_type: detectedType,
            role: "unknown",
            kpi_match: null,
            dimension_match: null,
            confidence: 0.3,
        };
    }

    /**
     * Map a native SQL/OData type string to a simplified DetectedDataType
     */
    public mapNativeType(nativeType: string): DetectedDataType {
        const t = nativeType.toLowerCase().trim();

        // Numeric types
        if (
            /\b(int|integer|bigint|smallint|tinyint|mediumint|serial|bigserial|smallserial|numeric|decimal|number|float|double|real|money)\b/.test(t) ||
            /\b(int4|int8|int2|float4|float8)\b/.test(t)
        ) {
            return "numeric";
        }

        // Date/time types
        if (
            /\b(date|datetime|timestamp|time|timestamptz|timestamp with(out)? time zone|datetime2|smalldatetime|datestamp)\b/.test(t)
        ) {
            return "date";
        }

        // Boolean types
        if (/\b(bool|boolean|bit)\b/.test(t)) {
            return "boolean";
        }

        // JSON types
        if (/\b(json|jsonb|json5|json_each)\b/.test(t)) {
            return "json";
        }

        // Character/text types
        if (
            /\b(char|character|varchar|character varying|nvarchar|text|longtext|mediumtext|tinytext|string|enum|set)\b/.test(t)
        ) {
            return "categorical";
        }

        // Binary/blob types — treat as unknown
        if (/\b(blob|binary|varbinary|bytea|image|file)\b/.test(t)) {
            return "unknown";
        }

        // Array types — treat as json
        if (/\b(array)\b/.test(t)) {
            return "json";
        }

        return "unknown";
    }

    /**
     * Match a column name against an array of pattern entries
     * Returns the first match with highest confidence
     */
    private matchPatterns(columnName: string, patterns: IPatternEntry[]): IPatternEntry | null {
        let bestMatch: IPatternEntry | null = null;
        for (const entry of patterns) {
            if (entry.pattern.test(columnName)) {
                if (!bestMatch || entry.confidence > bestMatch.confidence) {
                    bestMatch = entry;
                }
            }
        }
        return bestMatch;
    }
}