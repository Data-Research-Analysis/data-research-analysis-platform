export const DATA_SOURCE_CLASSIFICATIONS = [
    {
        value: 'marketing_campaign_data',
        label: 'Marketing Campaign Data',
        icon: ['fas', 'bullhorn'] as [string, string],
        description: 'Ad performance data, UTM tracking, marketing KPIs, paid media exports',
        color: 'blue',
    },
    {
        value: 'crm_sales',
        label: 'CRM / Sales Data',
        icon: ['fas', 'handshake'] as [string, string],
        description: 'Contacts, deals, pipeline stages, customer records, CRM exports',
        color: 'green',
    },
    {
        value: 'budget_finance',
        label: 'Budget & Finance',
        icon: ['fas', 'file-invoice-dollar'] as [string, string],
        description: 'Spend plans, budget allocations, cost actuals, financial reports',
        color: 'yellow',
    },
    {
        value: 'offline_marketing',
        label: 'Offline Marketing Activity',
        icon: ['fas', 'print'] as [string, string],
        description: 'Event records, print placements, OOH, direct mail response data',
        color: 'purple',
    },
    {
        value: 'brand_research',
        label: 'Brand Research & Surveys',
        icon: ['fas', 'chart-bar'] as [string, string],
        description: 'Survey responses, brand tracking studies, NPS scores, focus group data',
        color: 'orange',
    },
    {
        value: 'general_analytics',
        label: 'General Analytics',
        icon: ['fas', 'chart-line'] as [string, string],
        description: 'Website analytics, product usage data, operational metrics, other data',
        color: 'gray',
    },
] as const;

export type ClassificationValue = typeof DATA_SOURCE_CLASSIFICATIONS[number]['value'];

/**
 * Source types that skip the classification modal and are auto-classified as
 * 'marketing_campaign_data' on the backend.
 */
export const AUTO_CLASSIFIED_SOURCE_TYPES = [
    'google_ads',
    'meta_ads',
    'linkedin_ads',
    'google_analytics',
    'google_ad_manager',
    'tiktok_ads',
] as const;

/**
 * Source types that require the user to select a classification.
 */
export const MANUAL_CLASSIFICATION_SOURCE_TYPES = [
    'excel',
    'csv',
    'postgresql',
    'mysql',
    'mariadb',
    'mongodb',
] as const;

/** Look up a classification definition by value. */
export function getClassification(value: string | null | undefined) {
    if (!value) return null;
    return DATA_SOURCE_CLASSIFICATIONS.find((c) => c.value === value) ?? null;
}

/** Colour → Tailwind class mappings used by the badge component. */
export const CLASSIFICATION_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
    blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
    green:  { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    gray:   { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300' },
};
