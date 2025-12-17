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
        
        // Future: Google Ads specific
        customer_id?: string;
        developer_token?: string;
        
        // Additional metadata
        account_name?: string;
        last_sync?: Date;
        sync_frequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
    };
}
