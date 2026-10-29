import { IGoogleAdsReportQuery, IGoogleAdsReportResponse, IGoogleAdsAccount, IGoogleAdsRow } from '../types/IGoogleAds.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleOAuthService } from './GoogleOAuthService.js';

/**
 * Keyword Planner metrics returned for one keyword.
 */
export interface IGoogleAdsKeywordMetrics {
    keyword: string;
    closeVariants: string[];
    avgMonthlySearches: number | null;
    monthlySearchVolumes: Array<{ year: string; month: string; monthlySearches: number }>;
    competition: string | null;
    competitionIndex: number | null;
    lowTopOfPageBidMicros: number | null;
    highTopOfPageBidMicros: number | null;
    averageCpcMicros: number | null;
}

export interface IGoogleAdsGeoTargetResolution {
    resourceNames: string[];
    resolved: Array<{ market: string; resourceName: string }>;
    unresolved: string[];
}

/**
 * Google Ads Service
 * Handles Google Ads API interactions including account listing and report generation.
 *
 * Uses API version v25. Developer tokens were sunset on September 9, 2026;
 * API access levels are now managed per Google Cloud project, so no
 * `developer-token` header is sent.
 */
export class GoogleAdsService {
    private static instance: GoogleAdsService;
    private static readonly API_VERSION = 'v25';  // Google Ads API version (v26 changed report fields; keyword planning works on v25)
    private static readonly BASE_URL = 'https://googleads.googleapis.com';
    private readonly currencyCache = new Map<string, string>();
    
    private constructor() {}
    
    public static getInstance(): GoogleAdsService {
        if (!GoogleAdsService.instance) {
            GoogleAdsService.instance = new GoogleAdsService();
        }
        return GoogleAdsService.instance;
    }
    
    /**
     * Build the headers shared by every Google Ads API call.
     */
    private buildHeaders(accessToken: string, extraHeaders: Record<string, string> = {}): Record<string, string> {
        return {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...extraHeaders,
        };
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
     * Return a valid access token, refreshing it with the stored refresh token
     * when it is missing or close to expiry. The refreshed values are written
     * back into the connection details so the caller can persist them.
     */
    public async ensureAccessToken(connectionDetails: IAPIConnectionDetails): Promise<string> {
        const expiry = connectionDetails.token_expiry ? new Date(connectionDetails.token_expiry).getTime() : 0;
        if (connectionDetails.oauth_access_token && expiry > Date.now() + 60_000) {
            return connectionDetails.oauth_access_token;
        }
        if (!connectionDetails.oauth_refresh_token) {
            throw new Error('Google Ads access token expired and no refresh token is stored. Reconnect the Google Ads account.');
        }
        const tokens = await GoogleOAuthService.getInstance().refreshAccessToken(connectionDetails.oauth_refresh_token);
        connectionDetails.oauth_access_token = tokens.access_token;
        if (tokens.refresh_token) {
            connectionDetails.oauth_refresh_token = tokens.refresh_token;
        }
        const expiresIn = tokens.expires_in && tokens.expires_in > 0 ? tokens.expires_in : 3600;
        connectionDetails.token_expiry = new Date(Date.now() + expiresIn * 1000);
        return tokens.access_token;
    }

    /**
     * POST a JSON request to a Google Ads API resource path.
     */
    private async postJson(
        path: string,
        body: Record<string, any>,
        accessToken: string,
        loginCustomerId?: string
    ): Promise<any> {
        const headers = this.buildHeaders(accessToken);
        if (loginCustomerId) {
            headers['login-customer-id'] = loginCustomerId.replace(/-/g, '');
        }
        const response = await fetch(`${GoogleAdsService.BASE_URL}/${GoogleAdsService.API_VERSION}/${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`Google Ads API error: ${this.parseApiError(text)}`);
        }
        return text ? JSON.parse(text) : {};
    }

    /**
     * Generate keyword ideas from keyword seeds and/or a URL, with historical
     * Keyword Planner metrics (average monthly searches, monthly trend,
     * competition, top-of-page bids, average CPC when available).
     */
    public async generateKeywordIdeas(params: {
        customerId?: string;
        keywords?: string[];
        siteUrl?: string;
        geoResourceNames?: string[];
        languageResourceName?: string;
        network?: 'GOOGLE_SEARCH' | 'GOOGLE_SEARCH_AND_PARTNERS';
        includeAdultKeywords?: boolean;
        pageSize?: number;
        maxResults?: number;
    }, connectionDetails: IAPIConnectionDetails): Promise<IGoogleAdsKeywordMetrics[]> {
        const customerId = this.resolveCustomerId(params.customerId, connectionDetails);
        const keywords = (params.keywords ?? []).map((k) => String(k).trim()).filter(Boolean).slice(0, 20);
        const siteUrl = params.siteUrl?.trim();
        if (keywords.length === 0 && !siteUrl) {
            throw new Error('Provide at least one keyword seed or a site URL.');
        }

        const accessToken = await this.ensureAccessToken(connectionDetails);
        const loginCustomerId = connectionDetails.api_config?.manager_customer_id || customerId;
        const body: Record<string, any> = {
            keywordPlanNetwork: params.network || 'GOOGLE_SEARCH',
            includeAdultKeywords: Boolean(params.includeAdultKeywords),
            pageSize: Math.min(Math.max(params.pageSize ?? 200, 1), 10_000),
            historicalMetricsOptions: { includeAverageCpc: true },
        };
        if (keywords.length > 0 && siteUrl) {
            body.keywordAndUrlSeed = { keywords, url: siteUrl };
        } else if (keywords.length > 0) {
            body.keywordSeed = { keywords };
        } else {
            body.urlSeed = { url: siteUrl };
        }
        if (params.languageResourceName) {
            body.language = params.languageResourceName;
        }
        if (params.geoResourceNames?.length) {
            body.geoTargetConstants = params.geoResourceNames.slice(0, 10);
        }

        const maxResults = Math.max(params.maxResults ?? 1000, 1);
        const results: IGoogleAdsKeywordMetrics[] = [];
        let pageToken: string | undefined;
        do {
            if (pageToken) {
                body.pageToken = pageToken;
                await this.sleep(1100); // Keyword planning is limited to 1 request/second per CID.
            }
            const data = await this.postJson(`customers/${customerId}:generateKeywordIdeas`, body, accessToken, loginCustomerId);
            for (const result of data.results ?? []) {
                results.push(this.mapKeywordMetrics(result, result.keywordIdeaMetrics));
            }
            pageToken = data.nextPageToken;
        } while (pageToken && results.length < maxResults);

        return results.slice(0, maxResults);
    }

    /**
     * Return exact Keyword Planner metrics for an existing keyword list
     * (up to 10,000 keywords per call; chunked to keep requests small).
     */
    public async generateKeywordHistoricalMetrics(params: {
        customerId?: string;
        keywords: string[];
        geoResourceNames?: string[];
        languageResourceName?: string;
        network?: 'GOOGLE_SEARCH' | 'GOOGLE_SEARCH_AND_PARTNERS';
    }, connectionDetails: IAPIConnectionDetails): Promise<IGoogleAdsKeywordMetrics[]> {
        const customerId = this.resolveCustomerId(params.customerId, connectionDetails);
        const keywords = (params.keywords ?? []).map((k) => String(k).trim()).filter(Boolean);
        if (keywords.length === 0) {
            throw new Error('Provide at least one keyword to measure.');
        }

        const accessToken = await this.ensureAccessToken(connectionDetails);
        const loginCustomerId = connectionDetails.api_config?.manager_customer_id || customerId;
        const results: IGoogleAdsKeywordMetrics[] = [];
        const chunkSize = 1000;

        for (let offset = 0; offset < keywords.length; offset += chunkSize) {
            if (offset > 0) {
                await this.sleep(1100); // Keyword planning is limited to 1 request/second per CID.
            }
            const body: Record<string, any> = {
                keywords: keywords.slice(offset, offset + chunkSize),
                keywordPlanNetwork: params.network || 'GOOGLE_SEARCH',
                historicalMetricsOptions: { includeAverageCpc: true },
            };
            if (params.languageResourceName) {
                body.language = params.languageResourceName;
            }
            if (params.geoResourceNames?.length) {
                body.geoTargetConstants = params.geoResourceNames.slice(0, 10);
            }
            const data = await this.postJson(`customers/${customerId}:generateKeywordHistoricalMetrics`, body, accessToken, loginCustomerId);
            for (const result of data.results ?? []) {
                results.push(this.mapKeywordMetrics(result, result.keywordMetrics));
            }
        }

        return results;
    }

    /**
     * Resolve country names, ISO codes, or `geoTargetConstants/{id}` values to
     * geo target resource names.
     */
    public async resolveGeoTargets(
        markets: string[],
        connectionDetails: IAPIConnectionDetails
    ): Promise<IGoogleAdsGeoTargetResolution> {
        const direct: string[] = [];
        const isoCodes: string[] = [];
        const names: string[] = [];
        for (const raw of markets ?? []) {
            const value = String(raw ?? '').trim();
            if (!value) continue;
            if (/^geoTargetConstants\/\d+$/.test(value)) {
                direct.push(value);
            } else if (/^[A-Za-z]{2}$/.test(value)) {
                isoCodes.push(value.toUpperCase());
            } else {
                names.push(value);
            }
        }

        const resourceNames = [...new Set(direct)].slice(0, 10);
        const resolved: Array<{ market: string; resourceName: string }> = direct.map((resourceName) => ({ market: resourceName, resourceName }));
        const unresolved: string[] = [];
        if ((isoCodes.length === 0 && names.length === 0) || resourceNames.length >= 10) {
            return { resourceNames, resolved, unresolved };
        }

        const accessToken = await this.ensureAccessToken(connectionDetails);
        const customerId = this.resolveCustomerId(undefined, connectionDetails);
        const loginCustomerId = connectionDetails.api_config?.manager_customer_id || customerId;

        const add = (resourceName: string | undefined, label: string): void => {
            if (!resourceName) {
                unresolved.push(label);
                return;
            }
            if (!resourceNames.includes(resourceName) && resourceNames.length < 10) {
                resourceNames.push(resourceName);
                resolved.push({ market: label, resourceName });
            }
        };

        if (isoCodes.length > 0) {
            const codes = [...new Set(isoCodes)].slice(0, 10);
            const query = `SELECT geo_target_constant.resource_name, geo_target_constant.country_code
                FROM geo_target_constant
                WHERE geo_target_constant.country_code IN (${codes.map((code) => `'${code}'`).join(',')})
                AND geo_target_constant.target_type = 'Country'`;
            const data = await this.postJson(`customers/${customerId}/googleAds:search`, { query }, accessToken, loginCustomerId);
            const byCode = new Map<string, string>();
            for (const row of data.results ?? []) {
                const code = row.geoTargetConstant?.countryCode;
                const resourceName = row.geoTargetConstant?.resourceName;
                if (code && resourceName) byCode.set(String(code).toUpperCase(), String(resourceName));
            }
            for (const code of codes) add(byCode.get(code), code);
        }

        if (names.length > 0 && resourceNames.length < 10) {
            const data = await this.postJson('geoTargetConstants:suggest', {
                locale: 'en',
                locationNames: { names: names.slice(0, 10) },
            }, accessToken);
            const suggestions: any[] = data.geoTargetConstantSuggestions ?? [];
            const countries = suggestions.filter((s) => String(s.geoTargetConstant?.targetType ?? '').toLowerCase() === 'country');
            const pool = countries.length > 0 ? countries : suggestions;

            for (const name of names.slice(0, 10)) {
                const needle = name.toLowerCase();
                const exact = pool.find((s) => String(s.geoTargetConstant?.name ?? '').toLowerCase() === needle);
                const partial = pool.find((s) => String(s.geoTargetConstant?.name ?? '').toLowerCase().includes(needle));
                add((exact ?? partial)?.geoTargetConstant?.resourceName, name);
            }
        }

        return { resourceNames, resolved, unresolved };
    }

    /**
     * Resolve a language name to a `languageConstants/{id}` resource name.
     */
    public async resolveLanguage(
        language: string | undefined,
        connectionDetails: IAPIConnectionDetails
    ): Promise<string> {
        const value = String(language ?? '').trim();
        if (!value) return 'languageConstants/1000'; // English
        if (/^languageConstants\/\d+$/.test(value)) return value;
        if (value.toLowerCase() === 'english') return 'languageConstants/1000';

        const customerId = this.resolveCustomerId(undefined, connectionDetails);
        const accessToken = await this.ensureAccessToken(connectionDetails);
        const loginCustomerId = connectionDetails.api_config?.manager_customer_id || customerId;
        const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const query = `SELECT language_constant.id, language_constant.name, language_constant.resource_name
            FROM language_constant
            WHERE language_constant.name = '${escaped}' AND language_constant.targetable = true
            LIMIT 1`;
        const data = await this.postJson(`customers/${customerId}/googleAds:search`, { query }, accessToken, loginCustomerId);
        const resourceName = data.results?.[0]?.languageConstant?.resourceName;
        if (!resourceName) {
            throw new Error(`Language "${value}" was not found. Pass a languageConstants/{id} resource name instead.`);
        }
        return resourceName;
    }

    private resolveCustomerId(customerId: string | undefined, connectionDetails: IAPIConnectionDetails): string {
        const resolved = String(customerId || connectionDetails.api_config?.customer_id || '').replace(/-/g, '');
        if (!resolved) {
            throw new Error('No Google Ads customer ID is available on this connection.');
        }
        return resolved;
    }

    /**
     * Return the account currency code (e.g. PKR, USD) so bid amounts are not
     * misread as another currency.
     */
    public async getCustomerCurrency(customerId: string, connectionDetails: IAPIConnectionDetails): Promise<string | null> {
        const normalized = customerId.replace(/-/g, '');
        const cached = this.currencyCache.get(normalized);
        if (cached) return cached;
        const accessToken = await this.ensureAccessToken(connectionDetails);
        const loginCustomerId = connectionDetails.api_config?.manager_customer_id || normalized;
        const data = await this.postJson(
            `customers/${normalized}/googleAds:search`,
            { query: 'SELECT customer.currency_code FROM customer LIMIT 1' },
            accessToken,
            loginCustomerId
        );
        const currency = data.results?.[0]?.customer?.currencyCode;
        if (currency) {
            this.currencyCache.set(normalized, currency);
            return currency;
        }
        return null;
    }

    private mapKeywordMetrics(result: any, metrics: any): IGoogleAdsKeywordMetrics {
        const toNumber = (value: any): number | null => {
            if (value === null || value === undefined || value === '') return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };
        return {
            keyword: String(result?.text ?? ''),
            closeVariants: Array.isArray(result?.closeVariants) ? result.closeVariants.map(String) : [],
            avgMonthlySearches: toNumber(metrics?.avgMonthlySearches),
            monthlySearchVolumes: Array.isArray(metrics?.monthlySearchVolumes)
                ? metrics.monthlySearchVolumes.map((entry: any) => ({
                    year: String(entry?.year ?? ''),
                    month: String(entry?.month ?? ''),
                    monthlySearches: toNumber(entry?.monthlySearches) ?? 0,
                }))
                : [],
            competition: metrics?.competition ? String(metrics.competition) : null,
            competitionIndex: toNumber(metrics?.competitionIndex),
            lowTopOfPageBidMicros: toNumber(metrics?.lowTopOfPageBidMicros),
            highTopOfPageBidMicros: toNumber(metrics?.highTopOfPageBidMicros),
            averageCpcMicros: toNumber(metrics?.averageCpcMicros),
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
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
            headers: this.buildHeaders(await this.ensureAccessToken(connectionDetails), {
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
            ORDER BY ad_group_ad.ad.id
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
                metrics.cost_per_conversion,
                metrics.trueview_average_cpv,
                metrics.video_trueview_views,
                metrics.video_trueview_view_rate,
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
                metrics.cost_per_conversion,
                metrics.video_trueview_views,
                metrics.video_trueview_view_rate,
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
                metrics.video_trueview_views
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
                metrics.interactions
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
            'ad_groups': 'ad_groups',
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
