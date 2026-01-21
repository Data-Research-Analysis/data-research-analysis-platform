import {
    GoogleAdsReportType,
    IGoogleAdsReportQuery,
    IGoogleAdsReportResponse,
    IGoogleAdsAccount,
    IGoogleAdsRow
} from '../types/IGoogleAds.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';

/**
 * Google Ads Service
 * Handles Google Ads API interactions including account listing and report generation
 */
export class GoogleAdsService {
    private static instance: GoogleAdsService;
    private static readonly API_VERSION = 'v22';  // Google Ads API version (updated to current stable)
    private static readonly BASE_URL = 'https://googleads.googleapis.com';
    
    private constructor() {}
    
    public static getInstance(): GoogleAdsService {
        if (!GoogleAdsService.instance) {
            GoogleAdsService.instance = new GoogleAdsService();
        }
        return GoogleAdsService.instance;
    }
    
    /**
     * Get developer token from environment
     */
    private getDeveloperToken(): string {
        const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (!token) {
            throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured in environment');
        }
        return token;
    }
    
    /**
     * List accessible Google Ads accounts
     */
    public async listAccounts(accessToken: string): Promise<IGoogleAdsAccount[]> {
        const url = `${GoogleAdsService.BASE_URL}/${GoogleAdsService.API_VERSION}/customers:listAccessibleCustomers`;
        
        console.log('[GoogleAds] Calling listAccessibleCustomers:', url);
        
        const response = await fetch(url, {
            method: 'GET',  // Must use GET for listAccessibleCustomers
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': this.getDeveloperToken()
            }
        });
        
        console.log('[GoogleAds] Response status:', response.status);
        
        if (!response.ok) {
            const error = await response.text();
            console.error('[GoogleAds] Error response:', error);
            throw new Error(`Failed to list accounts: ${error}`);
        }
        
        const data = await response.json();
        
        if (!data.resourceNames || data.resourceNames.length === 0) {
            return [];
        }
        
        // Fetch details for each customer
        const accounts: IGoogleAdsAccount[] = [];
        let hasTestTokenError = false;
        
        for (const resourceName of data.resourceNames) {
            const customerId = resourceName.split('/')[1];
            try {
                const details = await this.getAccountDetails(customerId, accessToken);
                
                // Check if it's a manager account and fetch client accounts
                const isManager = await this.isManagerAccount(customerId, accessToken);
                if (isManager) {
                    const clientIds = await this.listClientAccounts(customerId, accessToken);
                    const clientAccounts = [];
                    
                    // Fetch details for each client (limit to prevent timeout)
                    const maxClients = 10;
                    for (const clientId of clientIds.slice(0, maxClients)) {
                        try {
                            const clientDetails = await this.getAccountDetails(clientId, accessToken);
                            clientAccounts.push({
                                customerId: clientId,
                                descriptiveName: clientDetails.descriptiveName
                            });
                        } catch (error) {
                            console.warn(`Failed to get client details for ${clientId}`);
                            clientAccounts.push({
                                customerId: clientId,
                                descriptiveName: `Client ${clientId}`
                            });
                        }
                    }
                    
                    details.isManager = true;
                    details.clientAccounts = clientAccounts;
                }
                
                accounts.push(details);
            } catch (error: any) {
                const errorMessage = error.message || '';
                
                // Check if it's a test token limitation error
                if (errorMessage.includes('DEVELOPER_TOKEN_NOT_APPROVED') || 
                    errorMessage.includes('only approved for use with test accounts')) {
                    hasTestTokenError = true;
                    console.warn(`⚠️  Test developer token - skipping non-test account ${customerId}`);
                    
                    // Return basic account info without detailed fetch
                    accounts.push({
                        customerId,
                        descriptiveName: `Account ${customerId} (Test Token - Limited Access)`,
                        currencyCode: 'USD',
                        timeZone: 'America/New_York'
                    });
                } else {
                    console.error(`Failed to get details for customer ${customerId}:`, error);
                    // Skip accounts with other errors
                }
            }
        }
        
        // If test token error occurred, log a warning
        if (hasTestTokenError) {
            console.warn(`\n⚠️  DEVELOPER TOKEN LIMITATION DETECTED`);
            console.warn(`Your developer token is only approved for test accounts.`);
            console.warn(`To access production accounts, apply for Basic or Standard access at:`);
            console.warn(`https://ads.google.com/aw/apicenter\n`);
        }
        
        return accounts;
    }
    
    /**
     * Check if an account is a manager account
     */
    public async isManagerAccount(customerId: string, accessToken: string): Promise<boolean> {
        try {
            const query = `
                SELECT
                    customer.manager
                FROM customer
                WHERE customer.id = '${customerId.replace(/-/g, '')}'
                LIMIT 1
            `;
            
            const url = `${GoogleAdsService.BASE_URL}/${GoogleAdsService.API_VERSION}/customers/${customerId}/googleAds:search`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': this.getDeveloperToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });
            
            if (!response.ok) {
                console.warn(`Failed to check manager status for ${customerId}`);
                return false;
            }
            
            const data = await response.json();
            return data.results?.[0]?.customer?.manager === true;
        } catch (error) {
            console.error(`Error checking manager status for ${customerId}:`, error);
            return false;
        }
    }
    
    /**
     * List client accounts under a manager account
     */
    public async listClientAccounts(managerCustomerId: string, accessToken: string): Promise<string[]> {
        try {
            const query = `
                SELECT
                    customer_client.client_customer,
                    customer_client.status,
                    customer_client.manager
                FROM customer_client
                WHERE customer_client.status = 'ENABLED'
                AND customer_client.manager = false
            `;
            
            const url = `${GoogleAdsService.BASE_URL}/${GoogleAdsService.API_VERSION}/customers/${managerCustomerId}/googleAds:search`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': this.getDeveloperToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });
            
            if (!response.ok) {
                const error = await response.text();
                console.error(`Failed to list client accounts:`, error);
                return [];
            }
            
            const data = await response.json();
            
            if (!data.results || data.results.length === 0) {
                console.log('No client accounts found under manager');
                return [];
            }
            
            // Extract client customer IDs
            const clientIds = data.results
                .map((result: any) => result.customerClient?.clientCustomer)
                .filter((id: any) => id)
                .map((resourceName: string) => {
                    // Extract ID from resource name format: customers/1234567890
                    const parts = resourceName.split('/');
                    return parts[parts.length - 1];
                });
            
            console.log(`Found ${clientIds.length} client accounts under manager ${managerCustomerId}`);
            return clientIds;
        } catch (error) {
            console.error(`Error listing client accounts for ${managerCustomerId}:`, error);
            return [];
        }
    }
    
    /**
     * Get account details
     */
    private async getAccountDetails(customerId: string, accessToken: string): Promise<IGoogleAdsAccount> {
        const query = `
            SELECT
                customer.id,
                customer.descriptive_name,
                customer.currency_code,
                customer.time_zone
            FROM customer
            LIMIT 1
        `;
        
        const url = `${GoogleAdsService.BASE_URL}/${GoogleAdsService.API_VERSION}/customers/${customerId}/googleAds:search`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': this.getDeveloperToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get account details: ${error}`);
        }
        
        const data = await response.json();
        const customer = data.results?.[0]?.customer;
        
        return {
            customerId,
            descriptiveName: customer?.descriptiveName || 'Unknown Account',
            currencyCode: customer?.currencyCode || 'USD',
            timeZone: customer?.timeZone || 'America/Los_Angeles'
        };
    }
    
    /**
     * Run Google Ads report query
     */
    public async runReport(
        query: IGoogleAdsReportQuery,
        connectionDetails: IAPIConnectionDetails
    ): Promise<IGoogleAdsReportResponse> {
        const googleAdsQuery = this.buildGoogleAdsQuery(query);
        
        const url = `${GoogleAdsService.BASE_URL}/${GoogleAdsService.API_VERSION}/customers/${query.customerId}/googleAds:search`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${connectionDetails.oauth_access_token}`,
                'developer-token': this.getDeveloperToken(),
                'login-customer-id': query.customerId.replace(/-/g, ''), // Remove hyphens
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: googleAdsQuery })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google Ads API error: ${error}`);
        }
        
        const data = await response.json();
        
        return {
            rows: data.results || [],
            totalRows: data.totalResultsCount || 0,
            queryResourceConsumption: data.fieldMask?.length || 0
        };
    }
    
    /**
     * Build Google Ads Query Language (GAQL) string
     */
    private buildGoogleAdsQuery(query: IGoogleAdsReportQuery): string {
        switch (query.reportType) {
            case GoogleAdsReportType.CAMPAIGN:
                return this.buildCampaignQuery(query.startDate, query.endDate);
            case GoogleAdsReportType.KEYWORD:
                return this.buildKeywordQuery(query.startDate, query.endDate);
            case GoogleAdsReportType.GEOGRAPHIC:
                return this.buildGeographicQuery(query.startDate, query.endDate);
            case GoogleAdsReportType.DEVICE:
                return this.buildDeviceQuery(query.startDate, query.endDate);
            default:
                throw new Error(`Unsupported report type: ${query.reportType}`);
        }
    }
    
    /**
     * Build campaign performance query
     */
    public buildCampaignQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY segments.date DESC
        `;
    }
    
    /**
     * Build keyword performance query
     */
    public buildKeywordQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.name,
                ad_group.name,
                ad_group_criterion.keyword.text,
                ad_group_criterion.keyword.match_type,
                ad_group_criterion.quality_info.quality_score,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.ctr,
                metrics.average_cpc
            FROM keyword_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                AND ad_group_criterion.type = 'KEYWORD'
            ORDER BY metrics.cost_micros DESC
        `;
    }
    
    /**
     * Build geographic performance query
     */
    public buildGeographicQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                geographic_view.country_criterion_id,
                segments.geo_target_country,
                segments.geo_target_region,
                segments.geo_target_city,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM geographic_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY metrics.cost_micros DESC
        `;
    }
    
    /**
     * Build device performance query
     */
    public buildDeviceQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                segments.device,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.ctr,
                metrics.average_cpc
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY segments.date DESC
        `;
    }
    
    /**
     * Convert report type string to enum
     */
    public getReportType(reportTypeString: string): GoogleAdsReportType {
        const normalized = reportTypeString.toLowerCase();
        
        const map: Record<string, GoogleAdsReportType> = {
            'campaign': GoogleAdsReportType.CAMPAIGN,
            'keyword': GoogleAdsReportType.KEYWORD,
            'geographic': GoogleAdsReportType.GEOGRAPHIC,
            'geo': GoogleAdsReportType.GEOGRAPHIC,
            'device': GoogleAdsReportType.DEVICE
        };
        
        const reportType = map[normalized];
        if (!reportType) {
            throw new Error(`Unknown report type: ${reportTypeString}`);
        }
        
        return reportType;
    }
}
