/**
 * Connection Templates
 *
 * Pre-built combinations of data sources for quick-start connections.
 * Selecting a template auto-selects the relevant sources in the wizard.
 */

export interface ConnectionTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;        // font-awesome icon class
    sourceIds: string[]; // IDs matching CONNECTION_SOURCES
}

export const CONNECTION_TEMPLATES: ConnectionTemplate[] = [
    {
        id: 'multi_channel_ads',
        name: 'Multi-Channel Ads',
        description: 'Google Ads + Meta Ads + LinkedIn Ads',
        icon: 'fas fa-bullhorn',
        sourceIds: ['google_ads', 'meta_ads', 'linkedin_ads'],
    },
    {
        id: 'ads_crm',
        name: 'Ads + CRM',
        description: 'Google Ads + HubSpot',
        icon: 'fas fa-handshake',
        sourceIds: ['google_ads', 'hubspot'],
    },
    {
        id: 'ecommerce',
        name: 'E-commerce',
        description: 'Google Ads + Google Analytics',
        icon: 'fas fa-shopping-cart',
        sourceIds: ['google_ads', 'google_analytics'],
    },
    {
        id: 'lead_gen',
        name: 'Lead Gen',
        description: 'Meta Ads + HubSpot + Klaviyo',
        icon: 'fas fa-funnel-dollar',
        sourceIds: ['meta_ads', 'hubspot', 'klaviyo'],
    },
];