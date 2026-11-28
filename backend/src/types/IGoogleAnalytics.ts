/**
 * Google Analytics 4 (GA4) Integration Types
 * TypeScript interfaces for the GA4 Data API integration.
 */

/**
 * A GA4 report preset: the dimensions/metrics that back one logical table
 * in the `dra_google_analytics` schema. Dimension and metric names must match
 * the GA4 Data API schema exactly (see
 * https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema).
 */
export interface IGA4ReportPreset {
    /** Human readable report name. */
    name: string;
    /** Logical table name in the `dra_google_analytics` schema. */
    logicalTableName: string;
    /** GA4 dimension names (camelCase API names). */
    dimensions: string[];
    /** GA4 metric names (camelCase API names). */
    metrics: string[];
    /** Number of days of history to pull for this report. */
    dateRangeDays: number;
    /** Short description shown in the connection wizard. */
    description: string;
}

/**
 * The reports synced for every GA4 property. Keyed by logical table name.
 * Consumers rely on the logical names: `traffic_overview` (sessions summary,
 * intelligence report) and `user_acquisition` (funnel matching) are required.
 */
export const GA4_REPORT_TYPES = [
    'traffic_overview',
    'user_acquisition',
    'session_attribution',
    'page_performance',
    'geographic',
    'device',
    'events',
    'demographics',
    'technology',
    'first_user_source_medium',
    'landing_pages',
    'search_console',
    'ecommerce',
    'revenue',
    // combined session grain (source + medium + channel + device + country +
    // city + landing page) so the engaged-traffic filter (source exclusions +
    // engagement thresholds) can be applied to every breakdown. The separate
    // device/geographic/landing reports each drop the source dimension, so
    // they cannot be filtered.
    'session_breakdown',
] as const;

export type IGA4ReportType = typeof GA4_REPORT_TYPES[number];
