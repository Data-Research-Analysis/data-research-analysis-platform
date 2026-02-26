import { EDataSourceType } from "./EDataSourceType.js";

/**
 * Connection details for API-based data sources (OAuth)
 * Used for Google Analytics, Google Ads, and other OAuth-based services
 */
export interface IAPIConnectionDetails {
    oauth_access_token: string;
    oauth_refresh_token: string;
    token_expiry: Date;
    
    // API-specific configuration
    api_config: {
        // Google Analytics specific
        property_id?: string;
        view_id?: string;
        
        // Google Ad Manager specific
        network_code?: string;
        network_id?: string;
        network_name?: string;
        report_types?: string[];
        start_date?: string;
        end_date?: string;
        
        // Google Ads specific
        customer_id?: string;
        manager_customer_id?: string;  // For client accounts under a manager
        developer_token?: string;
        
        // Meta Ads specific
        ad_account_id?: string;

        // LinkedIn Ads specific
        linkedin_ads_account_id?: number;       // Long integer (not URN) — LinkedIn adAccount id field
        linkedin_ads_account_name?: string;     // Display name for the selected ad account
        linkedin_ads_organization_id?: string;  // Optional org URN (urn:li:organization:{id})
        linkedin_ads_token_expires_at?: number; // Unix timestamp (ms) when access token expires
        linkedin_ads_refresh_token?: string;    // Stored separately from oauth_refresh_token for LinkedIn

        // HubSpot CRM specific
        hubspot_portal_id?: string;             // HubSpot portal (hub) ID
        hubspot_token_expires_at?: number;      // Unix timestamp (ms) when HubSpot access token expires

        // Klaviyo Email Marketing specific (API key auth — no OAuth)
        klaviyo_api_key?: string;               // Private API key (stored encrypted)

        // Additional metadata
        account_name?: string;
        last_sync?: Date;
        sync_frequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
    };
}
