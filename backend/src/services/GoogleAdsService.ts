import { IGoogleAdsReportQuery, IGoogleAdsReportResponse, IGoogleAdsAccount, IGoogleAdsRow } from '../types/IGoogleAds.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';

/**
 * Google Ads Service
 * Handles Google Ads API interactions including account listing and report generation.
 *
 * Uses the current stable API version (v25). Developer tokens are no longer
 * required since Google Ads API access levels moved to Google Cloud projects
 * (September 2026); the token header is only sent when one is configured in the
 * environment so existing setups keep working during the transition.
 */
export class GoogleAdsService {
    private static instance: GoogleAdsService;
    private static readonly API_VERSION = 'v25';  // Google Ads API version (current stable)
    private static readonly BASE_URL = 'https://googleads.googleapis.com';
    
    private constructor() {}
    
    public static getInstance(): GoogleAdsService {
        if (!GoogleAdsService.instance) {
            GoogleAdsService.instance = new GoogleAdsService();
        }
        return GoogleAdsService.instance;
    }
    
    /**
     * Get developer token from environment. Optional since access levels moved
     * to Google Cloud projects; the header is omitted when it is not configured.
     */
    private getDeveloperToken(): string | undefined {
        const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (token && token.trim().length > 0) {
            return token.trim();
        }
        return undefined;
    }
    
    /**
     * Build the headers shared by every Google Ads API call. The
     * `developer-token` header is only included when configured.
     */
    private buildHeaders(accessToken: string, extraHeaders: Record<string, string> = {}): Record<string, string> {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...extraHeaders,
        };
        const devToken = this.getDeveloperToken();
        if (devToken) {
            headers['developer-token'] = devToken;
        }
        return headers;
    }
    
    /**
     * Parse a Google Ads API error body into a human readable message.
     */
    private parseApiError(raw: string): string {
        try {
            const parsed = JSON.parse(raw);
            const error = parsed.error;
            if (error) {
                const details = error.details || [];
                const quotaFailure = details.find((d: any) => d['@type']?.includes('ErrorDetails'))
                    || details.find((d: any) => d['@type']?.includes('QuotaError'));
                if (quotaFailure?.errors?.length) {
                    const messages = quotaFailure.errors
                        .map((e: any) => `${e.reason || 'error'}: ${e.message || ''}`)
                        .filter((m: string) => m.trim().length > 0);
                    if (messages.length > 0) return messages.join('; ');
                }
                if (details?.length) {
                    const reasonMessages = details
                        .flatMap((d: any) => d.errors || [])
                        .map((e: any) => e.message)
                        .filter((m: string) => m && m.trim().length > 0);
                    if (reasonMessages.length > 0) return reasonMessages.join('; ');
                }
                return error.message || `HTTP ${error.code || ''}`;
            }
            if (parsed.errorCode) {
                return `${parsed.errorCode}: ${parsed.message || ''}`;
            }
            return raw;
        } catch {
            return raw;
        }
    }
    
    /**
     * List accessible Google Ads accounts
     */
    public async listAccounts(accessToken: string): Promise<IGoogleAdsAccount[]> {
        const url = `${GoogleAdsService.BASE_URL}/${GoogleAdsService.API_VERSION}/customers:listAccessibleCustomers`;
        
        console.log('[GoogleAds] Calling listAccessibleCustomers:', url);
        
        const response = await fetch(url, {
            method: 'GET',  // Must use GET for listAccessibleCustomers
            headers: this.buildHeaders(accessToken),
        });
        
        console.log('[GoogleAds] Response status:', response.status);
        
        if (!response.ok) {
            const error = await response.text();
            console.error('[GoogleAds] Error response:', error);
            throw new Error(`Failed to list accounts: ${this.parseApiError(error)}`);
        }
        
        const data = await response.json();
        
        if (!data.resourceNames || data.resourceNames.length === 0) {
            return [];
        }
        
        // Fetch details for each customer
        const accounts: IGoogleAdsAccount[] = [];
        let hasTestTokenError = false;
        let hasCloudProjectError = false;
        
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
                
                if (errorMessage.includes('CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION')) {
                    hasCloudProjectError = true;
                    console.warn(`⚠️ Google Cloud project not approved for production - skipping ${customerId}`);
                } else if (errorMessage.includes('DEVELOPER_TOKEN_NOT_APPROVED') || 
                           errorMessage.includes('only approved for use with test accounts')) {
                    hasTestTokenError = true;
                    console.warn(`⚠️ Test access - skipping non-test account ${customerId}`);
                    
                    // Return basic account info without detailed fetch
                    accounts.push({
                        customerId,
                        descriptiveName: `Account ${customerId} (Test Access - Limited)`,
                        currencyCode: 'USD',
                        timeZone: 'America/New_York'
                    });
                } else {
                    console.error(`Failed to get details for customer ${customerId}:`, error);
                    // Skip accounts with other errors
                }
            }
        }
        
        if (hasCloudProjectError) {
            console.warn(`\n⚠️  GOOGLE CLOUD PROJECT NOT APPROVED FOR PRODUCTION`);
            console.warn(`Some accounts were skipped because the Google Cloud project used for`);
            console.warn(`OAuth is not approved for production Google Ads API calls.`);
            console.warn(`Manage API access at: Google Cloud Console > Google Ads API > Overview`);
        }
        
        if (hasTestTokenError) {
            console.warn(`\n⚠️  TEST ACCESS LIMITATION DETECTED`);
            console.warn(`Your Google Ads API access is limited to test accounts.`);
            console.warn(`Apply for Basic or Standard access from the Google Cloud Console`);
            console.warn(`(Google Ads API > Overview) to access production accounts.`);
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
                headers: this.buildHeaders(accessToken),
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
                headers: this.buildHeaders(accessToken),
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
            headers: this.buildHeaders(accessToken),
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get account details: ${this.parseApiError(error)}`);
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
        const googleAdsQuery = this.buildQuery(query.reportType, query.startDate, query.endDate);
        
        const url = `${GoogleAdsService.BASE_URL}/${GoogleAdsService.API_VERSION}/customers/${query.customerId}/googleAds:search`;
        
        // For client accounts under a manager, use manager ID in login-customer-id header
        // Otherwise use the account's own customer ID
        const loginCustomerId = connectionDetails.api_config?.manager_customer_id || query.customerId;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: this.buildHeaders(accessTokenFrom(connectionDetails), {
                'login-customer-id': loginCustomerId.replace(/-/g, ''), // Remove hyphens
            }),
            body: JSON.stringify({ query: googleAdsQuery })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google Ads API error: ${this.parseApiError(error)}`);
        }
        
        const data = await response.json();
        
        return {
            rows: data.results || [],
            totalRows: data.totalResultsCount || 0,
            queryResourceConsumption: data.fieldMask?.length || 0
        };
    }
    
    /**
     * Build the GAQL query for a sync type
     */
    public buildQuery(reportType: string, startDate: string, endDate: string): string {
        switch (reportType) {
            case 'campaigns':
                return this.buildCampaignSettingsQuery();
            case 'ad_groups':
                return this.buildAdGroupSettingsQuery();
            case 'ads':
                return this.buildAdsQuery();
            case 'insights':
                return this.buildCampaignInsightsQuery(startDate, endDate);
            case 'ad_group_insights':
                return this.buildAdGroupInsightsQuery(startDate, endDate);
            case 'demographic_insights':
                return this.buildDemographicAgeQuery(startDate, endDate);
            case 'gender_insights':
                return this.buildDemographicGenderQuery(startDate, endDate);
            case 'device_insights':
                return this.buildDeviceInsightsQuery(startDate, endDate);
            case 'geographic_insights':
                return this.buildGeographicQuery(startDate, endDate);
            case 'placement_insights':
                return this.buildPlacementInsightsQuery(startDate, endDate);
            case 'keyword_insights':
                return this.buildKeywordQuery(startDate, endDate);
            case 'conversion_actions':
                return this.buildConversionActionsQuery();
            default:
                throw new Error(`Unsupported report type: ${reportType}`);
        }
    }
    
    /**
     * Build campaign settings query (no date segment)
     */
    public buildCampaignSettingsQuery(): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                campaign.advertising_channel_sub_type,
                campaign.primary_status,
                campaign.serving_status,
                campaign.start_date_time,
                campaign.end_date_time,
                campaign.bidding_strategy_type,
                campaign.optimization_score,
                campaign.target_cpa.target_cpa_micros,
                campaign.target_roas.target_roas,
                campaign.tracking_url_template,
                campaign_budget.id,
                campaign_budget.amount_micros,
                campaign_budget.total_amount_micros,
                campaign_budget.explicitly_shared,
                campaign_budget.delivery_method,
                campaign_budget.period,
                campaign_budget.status
            FROM campaign
            ORDER BY campaign.name
        `;
    }
    
    /**
     * Build ad group settings query (no date segment)
     */
    public buildAdGroupSettingsQuery(): string {
        return `
            SELECT
                ad_group.id,
                ad_group.name,
                ad_group.status,
                ad_group.type,
                ad_group.cpc_bid_micros,
                campaign.id,
                campaign.name,
                campaign.status
            FROM ad_group
            ORDER BY ad_group.name
        `;
    }
    
    /**
     * Build ads (ad group ad) settings query (no date segment)
     */
    public buildAdsQuery(): string {
        return `
            SELECT
                ad_group_ad.ad.id,
                ad_group_ad.ad.name,
                ad_group_ad.status,
                ad_group.id,
                ad_group.name,
                campaign.id,
                campaign.name,
                ad_group_ad.ad.type,
                ad_group_ad.ad.final_urls,
                ad_group_ad.ad.display_url,
                ad_group_ad.ad.tracking_url_template,
                ad_group_ad.ad.responsive_search_ad.headlines,
                ad_group_ad.ad.responsive_search_ad.descriptions
            FROM ad_group_ad
            ORDER BY ad_group_ad.name
        `;
    }
    
    /**
     * Build campaign-level daily performance query
     */
    public buildCampaignInsightsQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.all_conversions_value,
                metrics.view_through_conversions,
                metrics.cross_device_conversions,
                metrics.search_impression_share,
                metrics.search_rank_lost_impression_share,
                metrics.search_top_impression_share,
                metrics.search_absolute_top_impression_share,
                metrics.search_click_share,
                metrics.interactions,
                metrics.interaction_rate,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm,
                metrics.average_cpa,
                metrics.average_cpv,
                metrics.video_views,
                metrics.video_view_rate,
                metrics.reach,
                metrics.active_view_impressions,
                metrics.active_view_ctr,
                metrics.active_view_viewability,
                metrics.invalid_click_rate
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY segments.date DESC
        `;
    }
    
    /**
     * Build ad group-level daily performance query
     */
    public buildAdGroupInsightsQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                ad_group.id,
                ad_group.name,
                ad_group.status,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.all_conversions_value,
                metrics.view_through_conversions,
                metrics.interactions,
                metrics.interaction_rate,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm,
                metrics.average_cpa,
                metrics.video_views,
                metrics.video_view_rate,
                metrics.active_view_impressions,
                metrics.active_view_ctr,
                metrics.active_view_viewability
            FROM ad_group
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY segments.date DESC
        `;
    }
    
    /**
     * Build demographic (age range) daily performance query.
     *
     * In v25 the age_range_view resource exposes only its resource_name; the
     * criteria dimension is fetched via `ad_group_criterion.age_range.type`
     * in the same request (see "Criteria Metrics" reporting docs). The Google
     * Ads API cannot segment by age range and gender in a single query, so
     * age and gender are synced through two separate queries.
     */
    public buildDemographicAgeQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                ad_group.id,
                ad_group.name,
                ad_group_criterion.age_range.type,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm,
                metrics.interactions,
                metrics.cross_device_conversions
            FROM age_range_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
              AND ad_group_criterion.status != 'REMOVED'
            ORDER BY segments.date DESC
        `;
    }
    
    /**
     * Build demographic (gender) daily performance query
     */
    public buildDemographicGenderQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                ad_group.id,
                ad_group.name,
                ad_group_criterion.gender.type,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm,
                metrics.interactions,
                metrics.cross_device_conversions
            FROM gender_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
              AND ad_group_criterion.status != 'REMOVED'
            ORDER BY segments.date DESC
        `;
    }
    
    /**
     * Build device daily performance query
     */
    public buildDeviceInsightsQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                segments.device,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.all_conversions_value,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm,
                metrics.interactions,
                metrics.video_views
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY segments.date DESC
        `;
    }
    
    /**
     * Build geographic daily performance query.
     * `segments.geo_target_country` is NOT selectable with `geographic_view`,
     * so the country is captured through `geographic_view.country_criterion_id`.
     */
    public buildGeographicQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                geographic_view.country_criterion_id,
                segments.geo_target_region,
                segments.geo_target_city,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.ctr,
                metrics.average_cpc
            FROM geographic_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY metrics.cost_micros DESC
        `;
    }
    
    /**
     * Build placement (ad network / slot) daily performance query
     */
    public buildPlacementInsightsQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                segments.ad_network_type,
                segments.slot,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm,
                metrics.interactions,
                metrics.active_view_impressions,
                metrics.active_view_viewability
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY segments.date DESC
        `;
    }
    
    /**
     * Build keyword daily performance query
     */
    public buildKeywordQuery(startDate: string, endDate: string): string {
        return `
            SELECT
                campaign.id,
                campaign.name,
                ad_group.id,
                ad_group.name,
                ad_group_criterion.keyword.text,
                ad_group_criterion.keyword.match_type,
                ad_group_criterion.quality_info.quality_score,
                segments.date,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.all_conversions,
                metrics.ctr,
                metrics.average_cpc,
                metrics.average_cpm,
                metrics.interactions
            FROM keyword_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                AND ad_group_criterion.type = 'KEYWORD'
            ORDER BY metrics.cost_micros DESC
        `;
    }
    
    /**
     * Build conversion actions query (no date segment)
     */
    public buildConversionActionsQuery(): string {
        return `
            SELECT
                conversion_action.id,
                conversion_action.name,
                conversion_action.status,
                conversion_action.type,
                conversion_action.category,
                conversion_action.counting_type,
                conversion_action.attribution_model_settings.attribution_model,
                conversion_action.include_in_conversions_metric,
                conversion_action.click_through_lookback_window_days,
                conversion_action.view_through_lookback_window_days,
                conversion_action.origin,
                conversion_action.primary_for_goal,
                conversion_action.value_settings.default_value,
                conversion_action.value_settings.default_currency_code
            FROM conversion_action
            ORDER BY conversion_action.name
        `;
    }

    /**
     * Convert report type string to a normalized sync type key.
     * Maps legacy pre-v25 names to their new equivalents so existing configs
     * keep working after the schema upgrade.
     */
    public getReportType(reportTypeString: string): string {
        const normalized = reportTypeString.toLowerCase().trim();
        
        const map: Record<string, string> = {
            'campaign': 'campaigns',
            'campaigns': 'campaigns',
            'ad_group': 'ad_group_insights',
            'ad_group_insights': 'ad_group_insights',
            'adgroup': 'ad_group_insights',
            'ads': 'ads',
            'keyword': 'keyword_insights',
            'keyword_insights': 'keyword_insights',
            'geographic': 'geographic_insights',
            'geographic_insights': 'geographic_insights',
            'geo': 'geographic_insights',
            'device': 'device_insights',
            'device_insights': 'device_insights',
            'demographic_insights': 'demographic_insights',
            'placement_insights': 'placement_insights',
            'conversion_actions': 'conversion_actions',
            'insights': 'insights',
        };
        
        const reportType = map[normalized];
        if (!reportType) {
            throw new Error(`Unknown report type: ${reportTypeString}`);
        }
        
        return reportType;
    }
}

/**
 * Resolve the access token used for the API call. A refreshed token may have
 * been written back into the connection details by the driver's authentication.
 */
function accessTokenFrom(connectionDetails: IAPIConnectionDetails): string {
    if (connectionDetails.oauth_access_token) return connectionDetails.oauth_access_token;
    throw new Error('Google Ads OAuth access token not available');
}
