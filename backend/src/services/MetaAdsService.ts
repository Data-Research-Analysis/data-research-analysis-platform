import {
    IMetaAdAccount,
    IMetaCampaign,
    IMetaAdSet,
    IMetaAd,
    IMetaInsights,
    IInsightsParams,
    IMetaAPIResponse,
    IMetaAPIError,
} from '../types/IMetaAds.js';
import { RetryHandler } from '../utils/RetryHandler.js';

/**
 * Meta Ads Service
 * Handles Meta Marketing API interactions including account listing and data fetching
 */
export class MetaAdsService {
    private static instance: MetaAdsService;
    private static readonly API_VERSION = 'v22.0';
    private static readonly BASE_URL = 'https://graph.facebook.com';
    private static readonly MAX_RETRIES = 3;
    private static readonly INITIAL_RETRY_DELAY = 1000; // 1 second
    
    private constructor() {
        console.log('📘 Meta Ads Service initialized');
    }
    
    public static getInstance(): MetaAdsService {
        if (!MetaAdsService.instance) {
            MetaAdsService.instance = new MetaAdsService();
        }
        return MetaAdsService.instance;
    }
    
    /**
     * Make API request with retry logic and error handling
     */
    private async makeAPIRequest<T>(
        url: string,
        accessToken: string,
        retries: number = MetaAdsService.MAX_RETRIES
    ): Promise<T> {
        const result = await RetryHandler.execute(
            async () => {
                console.log(`📡 [Meta API] Calling: ${url}`);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json',
                    },
                });
                
                if (!response.ok) {
                    const errorData: { error: IMetaAPIError } = await response.json();
                    const error = errorData.error;
                    
                    console.error(`❌ [Meta API] Error ${error.code}:`, error.message);
                    console.error(`   - Type: ${error.type}`);
                    console.error(`   - Trace ID: ${error.fbtrace_id}`);
                    
                    // Handle specific error codes
                    if (error.code === 190) {
                        // Invalid OAuth 2.0 Access Token
                        throw new Error(`Authentication failed: ${error.message}`);
                    } else if (error.code === 17 || error.code === 32) {
                        // Rate limit errors - should retry
                        throw new Error(`Rate limit exceeded: ${error.message}`);
                    } else if (error.code === 4) {
                        // Application request limit reached
                        throw new Error(`API limit reached: ${error.message}`);
                    }
                    
                    throw new Error(`Meta API error (${error.code}): ${error.message}`);
                }
                
                const data = await response.json();
                return data as T;
            },
            {
                maxRetries: retries,
                initialDelayMs: MetaAdsService.INITIAL_RETRY_DELAY,
                backoffMultiplier: 2,
                retryableErrors: [
                    'RATE_LIMIT_EXCEEDED',
                    'ECONNRESET',
                    'ETIMEDOUT',
                ],
                onRetry: (attempt, error, nextDelayMs) => {
                    console.log(`⚠️  [Meta API] Retry ${attempt}/${retries} after ${nextDelayMs}ms - ${error.message}`);
                },
            }
        );
        
        if (!result.success || !result.data) {
            throw result.error || new Error('API request failed');
        }
        
        return result.data;
    }
    
    /**
     * List accessible ad accounts for the authenticated user
     */
    public async listAdAccounts(accessToken: string): Promise<IMetaAdAccount[]> {
        const fields = [
            'id',
            'name',
            'account_status',
            'currency',
            'timezone_name',
        ].join(',');
        
        const url = `${MetaAdsService.BASE_URL}/${MetaAdsService.API_VERSION}/me/adaccounts?fields=${fields}`;
        
        console.log('[Meta Ads] Fetching ad accounts');
        
        try {
            const response = await this.makeAPIRequest<IMetaAPIResponse<IMetaAdAccount>>(url, accessToken);
            
            console.log(`✅ [Meta Ads] Found ${response.data.length} ad accounts`);
            return response.data;
        } catch (error: any) {
            console.error('❌ [Meta Ads] Failed to list ad accounts:', error);
            throw new Error(`Failed to list ad accounts: ${error.message}`);
        }
    }
    
    /**
     * Get campaigns for an ad account
     */
    public async getCampaigns(
        adAccountId: string,
        accessToken: string,
        params?: { startDate?: string; endDate?: string }
    ): Promise<IMetaCampaign[]> {
        const fields = [
            'id',
            'name',
            'objective',
            'status',
            'daily_budget',
            'lifetime_budget',
            'created_time',
            'updated_time',
            'start_time',
            'stop_time',
        ].join(',');
        
        let url = `${MetaAdsService.BASE_URL}/${MetaAdsService.API_VERSION}/${adAccountId}/campaigns?fields=${fields}`;
        
        // Add time filtering if provided
        if (params?.startDate) {
            const filtering = JSON.stringify([{
                field: 'created_time',
                operator: 'GREATER_THAN',
                value: new Date(params.startDate).getTime() / 1000,
            }]);
            url += `&filtering=${encodeURIComponent(filtering)}`;
        }
        
        console.log(`[Meta Ads] Fetching campaigns for ${adAccountId}`);
        
        try {
            const campaigns: IMetaCampaign[] = [];
            let nextUrl: string | undefined = url;
            
            // Handle pagination
            while (nextUrl) {
                const response = await this.makeAPIRequest<IMetaAPIResponse<IMetaCampaign>>(nextUrl, accessToken);
                campaigns.push(...response.data);
                
                nextUrl = response.paging?.next;
                
                if (nextUrl) {
                    console.log(`   - Fetching next page (${campaigns.length} campaigns so far)...`);
                }
            }
            
            console.log(`✅ [Meta Ads] Fetched ${campaigns.length} campaigns`);
            return campaigns;
        } catch (error: any) {
            console.error('❌ [Meta Ads] Failed to fetch campaigns:', error);
            throw new Error(`Failed to fetch campaigns: ${error.message}`);
        }
    }
    
    /**
     * Get ad sets for an ad account
     */
    public async getAdSets(
        adAccountId: string,
        accessToken: string,
        params?: { campaignId?: string }
    ): Promise<IMetaAdSet[]> {
        const fields = [
            'id',
            'name',
            'campaign_id',
            'status',
            'billing_event',
            'optimization_goal',
            'daily_budget',
            'lifetime_budget',
            'bid_amount',
            'targeting',
            'start_time',
            'end_time',
            'created_time',
            'updated_time',
        ].join(',');
        
        let url = `${MetaAdsService.BASE_URL}/${MetaAdsService.API_VERSION}/${adAccountId}/adsets?fields=${fields}`;
        
        // Filter by campaign if provided
        if (params?.campaignId) {
            const filtering = JSON.stringify([{
                field: 'campaign.id',
                operator: 'EQUAL',
                value: params.campaignId,
            }]);
            url += `&filtering=${encodeURIComponent(filtering)}`;
        }
        
        console.log(`[Meta Ads] Fetching ad sets for ${adAccountId}`);
        
        try {
            const adsets: IMetaAdSet[] = [];
            let nextUrl: string | undefined = url;
            
            while (nextUrl) {
                const response = await this.makeAPIRequest<IMetaAPIResponse<IMetaAdSet>>(nextUrl, accessToken);
                adsets.push(...response.data);
                
                nextUrl = response.paging?.next;
                
                if (nextUrl) {
                    console.log(`   - Fetching next page (${adsets.length} ad sets so far)...`);
                }
            }
            
            console.log(`✅ [Meta Ads] Fetched ${adsets.length} ad sets`);
            return adsets;
        } catch (error: any) {
            console.error('❌ [Meta Ads] Failed to fetch ad sets:', error);
            throw new Error(`Failed to fetch ad sets: ${error.message}`);
        }
    }
    
    /**
     * Get ads for an ad account
     */
    public async getAds(
        adAccountId: string,
        accessToken: string,
        params?: { adSetId?: string; campaignId?: string }
    ): Promise<IMetaAd[]> {
        const fields = [
            'id',
            'name',
            'adset_id',
            'campaign_id',
            'status',
            'creative',
            'created_time',
            'updated_time',
        ].join(',');
        
        let url = `${MetaAdsService.BASE_URL}/${MetaAdsService.API_VERSION}/${adAccountId}/ads?fields=${fields}`;
        
        // Add filtering
        const filters: any[] = [];
        if (params?.adSetId) {
            filters.push({
                field: 'adset.id',
                operator: 'EQUAL',
                value: params.adSetId,
            });
        }
        if (params?.campaignId) {
            filters.push({
                field: 'campaign.id',
                operator: 'EQUAL',
                value: params.campaignId,
            });
        }
        
        if (filters.length > 0) {
            url += `&filtering=${encodeURIComponent(JSON.stringify(filters))}`;
        }
        
        console.log(`[Meta Ads] Fetching ads for ${adAccountId}`);
        
        try {
            const ads: IMetaAd[] = [];
            let nextUrl: string | undefined = url;
            
            while (nextUrl) {
                const response = await this.makeAPIRequest<IMetaAPIResponse<IMetaAd>>(nextUrl, accessToken);
                ads.push(...response.data);
                
                nextUrl = response.paging?.next;
                
                if (nextUrl) {
                    console.log(`   - Fetching next page (${ads.length} ads so far)...`);
                }
            }
            
            console.log(`✅ [Meta Ads] Fetched ${ads.length} ads`);
            return ads;
        } catch (error: any) {
            console.error('❌ [Meta Ads] Failed to fetch ads:', error);
            throw new Error(`Failed to fetch ads: ${error.message}`);
        }
    }
    
    /**
     * Get insights (performance metrics) for an entity
     */
    public async getInsights(
        entityId: string,
        accessToken: string,
        params: IInsightsParams
    ): Promise<IMetaInsights[]> {
        const fields = params.fields.join(',');
        
        const queryParams = new URLSearchParams({
            fields: fields,
            time_range: JSON.stringify(params.time_range),
            level: params.level,
        });
        
        if (params.breakdowns && params.breakdowns.length > 0) {
            queryParams.append('breakdowns', params.breakdowns.join(','));
        }
        
        if (params.time_increment !== undefined) {
            queryParams.append('time_increment', params.time_increment.toString());
        }
        
        const url = `${MetaAdsService.BASE_URL}/${MetaAdsService.API_VERSION}/${entityId}/insights?${queryParams.toString()}`;
        
        console.log(`[Meta Ads] Fetching insights for ${entityId}`);
        console.log(`   - Date range: ${params.time_range.since} to ${params.time_range.until}`);
        console.log(`   - Level: ${params.level}`);
        
        try {
            const insights: IMetaInsights[] = [];
            let nextUrl: string | undefined = url;
            
            while (nextUrl) {
                const response = await this.makeAPIRequest<IMetaAPIResponse<IMetaInsights>>(nextUrl, accessToken);
                insights.push(...response.data);
                
                nextUrl = response.paging?.next;
                
                if (nextUrl) {
                    console.log(`   - Fetching next page (${insights.length} insights so far)...`);
                }
            }
            
            console.log(`✅ [Meta Ads] Fetched ${insights.length} insight records`);
            return insights;
        } catch (error: any) {
            console.error('❌ [Meta Ads] Failed to fetch insights:', error);
            throw new Error(`Failed to fetch insights: ${error.message}`);
        }
    }
    
    /**
     * Get insights for multiple campaigns in batch
     */
    public async getCampaignInsights(
        adAccountId: string,
        accessToken: string,
        params: IInsightsParams
    ): Promise<IMetaInsights[]> {
        return this.getInsights(adAccountId, accessToken, {
            ...params,
            level: 'campaign',
        });
    }
    
    /**
     * Get insights for multiple ad sets in batch
     */
    public async getAdSetInsights(
        adAccountId: string,
        accessToken: string,
        params: IInsightsParams
    ): Promise<IMetaInsights[]> {
        return this.getInsights(adAccountId, accessToken, {
            ...params,
            level: 'adset',
        });
    }
    
    /**
     * Get insights for multiple ads in batch
     */
    public async getAdInsights(
        adAccountId: string,
        accessToken: string,
        params: IInsightsParams
    ): Promise<IMetaInsights[]> {
        return this.getInsights(adAccountId, accessToken, {
            ...params,
            level: 'ad',
        });
    }
}
