/**
 * Connection Sources
 *
 * Defines all available data source options for the Smart Connection Wizard.
 * Each source includes metadata for display, routing, and categorization.
 */

export type SourceCategory = 'ad_platforms' | 'analytics' | 'crm' | 'email_marketing' | 'files' | 'databases';

export type ConnectionMethod = 'oauth' | 'file_upload' | 'database_credentials';

export interface ConnectionSource {
    id: string;
    name: string;
    description: string;
    category: SourceCategory;
    categoryLabel: string;
    icon: string;           // font-awesome icon class
    image: string;          // image asset path (relative import name)
    popular: boolean;
    comingSoon: boolean;
    connectionMethod: ConnectionMethod;
    featureFlag?: string;   // feature flag key from FEATURE_FLAGS
    connectRoute: string;   // existing connect page route segment
}

import pdfImage from '/assets/images/pdf.png';
import excelImage from '/assets/images/excel.png';
import postgresqlImage from '/assets/images/postgresql.png';
import mysqlImage from '/assets/images/mysql.png';
import mariadbImage from '/assets/images/mariadb.png';
import googleAnalyticsImage from '/assets/images/google-analytics.png';
import googleAdsImage from '/assets/images/google-ads.png';
import metaAdsImage from '/assets/images/meta.png';
import mongodbImage from '/assets/images/mongodb.png';
import linkedInAdsImage from '/assets/images/linkedin.png';
import hubspotImage from '/assets/images/hubspot.png';
import klaviyoImage from '/assets/images/klaviyo.png';

export const CONNECTION_SOURCES: ConnectionSource[] = [
    // ── Ad Platforms ──
    {
        id: 'google_ads',
        name: 'Google Ads',
        description: 'Import campaign, ad group, and keyword performance data',
        category: 'ad_platforms',
        categoryLabel: 'Ad Platforms',
        icon: 'fab fa-google',
        image: googleAdsImage,
        popular: true,
        comingSoon: false,
        connectionMethod: 'oauth',
        connectRoute: 'google-ads',
    },
    {
        id: 'meta_ads',
        name: 'Meta Ads',
        description: 'Import Facebook and Instagram ad campaign data',
        category: 'ad_platforms',
        categoryLabel: 'Ad Platforms',
        icon: 'fab fa-meta',
        image: metaAdsImage,
        popular: true,
        comingSoon: false,
        connectionMethod: 'oauth',
        featureFlag: 'META_ADS_ENABLED',
        connectRoute: 'meta-ads',
    },
    {
        id: 'linkedin_ads',
        name: 'LinkedIn Ads',
        description: 'Import LinkedIn advertising campaign and lead data',
        category: 'ad_platforms',
        categoryLabel: 'Ad Platforms',
        icon: 'fab fa-linkedin',
        image: linkedInAdsImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'oauth',
        featureFlag: 'LINKEDIN_ADS_ENABLED',
        connectRoute: 'linkedin-ads',
    },

    // ── Analytics ──
    {
        id: 'google_analytics',
        name: 'Google Analytics',
        description: 'Import website traffic, user behavior, and conversion data',
        category: 'analytics',
        categoryLabel: 'Analytics',
        icon: 'fas fa-chart-line',
        image: googleAnalyticsImage,
        popular: true,
        comingSoon: false,
        connectionMethod: 'oauth',
        connectRoute: 'google-analytics',
    },

    // ── CRM ──
    {
        id: 'hubspot',
        name: 'HubSpot',
        description: 'Import CRM contacts, deals, and marketing automation data',
        category: 'crm',
        categoryLabel: 'CRM',
        icon: 'fas fa-address-book',
        image: hubspotImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'oauth',
        featureFlag: 'HUBSPOT_ENABLED',
        connectRoute: 'hubspot',
    },

    // ── Email / Marketing Automation ──
    {
        id: 'klaviyo',
        name: 'Klaviyo',
        description: 'Import email campaigns, flows, and subscriber engagement data',
        category: 'email_marketing',
        categoryLabel: 'Email & Marketing Automation',
        icon: 'fas fa-envelope',
        image: klaviyoImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'oauth',
        featureFlag: 'KLAVIYO_ENABLED',
        connectRoute: 'klaviyo',
    },

    // ── Files ──
    {
        id: 'excel',
        name: 'Excel / CSV',
        description: 'Upload spreadsheets with your marketing or business data',
        category: 'files',
        categoryLabel: 'Files',
        icon: 'fas fa-file-excel',
        image: excelImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'file_upload',
        connectRoute: 'excel',
    },
    {
        id: 'pdf',
        name: 'PDF',
        description: 'Upload PDF reports for data extraction and analysis',
        category: 'files',
        categoryLabel: 'Files',
        icon: 'fas fa-file-pdf',
        image: pdfImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'file_upload',
        connectRoute: 'pdf',
    },

    // ── Databases ──
    {
        id: 'postgresql',
        name: 'PostgreSQL',
        description: 'Connect to a PostgreSQL database instance',
        category: 'databases',
        categoryLabel: 'Databases',
        icon: 'fas fa-database',
        image: postgresqlImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'database_credentials',
        connectRoute: 'postgresql',
    },
    {
        id: 'mysql',
        name: 'MySQL',
        description: 'Connect to a MySQL database instance',
        category: 'databases',
        categoryLabel: 'Databases',
        icon: 'fas fa-database',
        image: mysqlImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'database_credentials',
        connectRoute: 'mysql',
    },
    {
        id: 'mariadb',
        name: 'MariaDB',
        description: 'Connect to a MariaDB database instance',
        category: 'databases',
        categoryLabel: 'Databases',
        icon: 'fas fa-database',
        image: mariadbImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'database_credentials',
        connectRoute: 'mariadb',
    },
    {
        id: 'mongodb',
        name: 'MongoDB',
        description: 'Connect to a MongoDB database instance',
        category: 'databases',
        categoryLabel: 'Databases',
        icon: 'fas fa-database',
        image: mongodbImage,
        popular: false,
        comingSoon: false,
        connectionMethod: 'database_credentials',
        connectRoute: 'mongodb',
    },
];

/**
 * Get sources grouped by category for display in the selection grid.
 */
export function getSourcesByCategory(): { category: SourceCategory; label: string; sources: ConnectionSource[] }[] {
    const categoryOrder: { category: SourceCategory; label: string }[] = [
        { category: 'ad_platforms', label: 'Ad Platforms' },
        { category: 'analytics', label: 'Analytics' },
        { category: 'crm', label: 'CRM' },
        { category: 'email_marketing', label: 'Email & Marketing Automation' },
        { category: 'files', label: 'Files' },
        { category: 'databases', label: 'Databases' },
    ];

    return categoryOrder
        .map(({ category, label }) => ({
            category,
            label,
            sources: CONNECTION_SOURCES.filter(s => s.category === category),
        }))
        .filter(group => group.sources.length > 0);
}

/**
 * Resolve which sources are visible based on feature flags and admin status.
 */
export function getVisibleSources(isAdmin: boolean, featureFlags: Record<string, boolean>): ConnectionSource[] {
    return CONNECTION_SOURCES.filter(source => {
        if (source.comingSoon && !isAdmin) return false;
        if (source.featureFlag && !isAdmin) {
            return !!featureFlags[source.featureFlag];
        }
        return true;
    });
}