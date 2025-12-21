import { google } from 'googleapis';
import { NetworkServiceClient, ReportServiceClient } from '@google-ads/admanager';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleOAuthService } from './GoogleOAuthService.js';
import { RateLimiter, RateLimiterRegistry } from '../utils/RateLimiter.js';
import {
    IGAMNetwork,
    IGAMReportQuery,
    IGAMReportResponse,
    GAMReportType,
    IGAMReportRow,
} from '../types/IGoogleAdManager.js';

/**
 * Google Ad Manager Service
 * Handles data fetching from Google Ad Manager API
 */
export class GoogleAdManagerService {
    private static instance: GoogleAdManagerService;
    private rateLimiter: RateLimiter;
    
    private constructor() {
        // Initialize rate limiter for Google Ad Manager API
        const registry = RateLimiterRegistry.getInstance();
        this.rateLimiter = registry.getOrCreate('google-ad-manager', {
            maxRequests: 10,
            windowMs: 60 * 1000, // 1 minute
            burstSize: 20,
            minInterval: 100, // 100ms between requests
        });
        console.log('🚦 Rate limiter initialized for Google Ad Manager API');
    }
    
    public static getInstance(): GoogleAdManagerService {
        if (!GoogleAdManagerService.instance) {
            GoogleAdManagerService.instance = new GoogleAdManagerService();
        }
        return GoogleAdManagerService.instance;
    }
    
    /**
     * Get authenticated OAuth2 client for GAM API
     * @param connectionDetails - API connection details with OAuth tokens
     * @returns Authenticated OAuth2 client
     */
    private getAuthenticatedClient(connectionDetails: IAPIConnectionDetails): any {
        const oauthService = GoogleOAuthService.getInstance();
        const oauth2Client = oauthService.getAuthenticatedClient(
            connectionDetails.oauth_access_token,
            connectionDetails.oauth_refresh_token
        );
        
        return oauth2Client;
    }
    
    /**
     * List accessible Google Ad Manager networks
     * @param accessToken - OAuth access token
     * @returns List of GAM networks user has access to
     */
    public async listNetworks(accessToken: string): Promise<IGAMNetwork[]> {
        try {
            const oauthService = GoogleOAuthService.getInstance();
            const oauth2Client = oauthService.getAuthenticatedClient(accessToken);
            
            // Initialize Network Service client with OAuth credentials
            const networkClient = new NetworkServiceClient({
                auth: oauth2Client as any
            });
            
            // Apply rate limiting
            await this.rateLimiter.acquire();
            
            console.log('📊 Fetching Google Ad Manager networks via API');
            
            // Call list networks method - returns [response, request, apiResponse]
            const [response] = await networkClient.listNetworks({});
            
            // Extract networks from response
            const networksArray = response?.networks || [];
            
            // Transform API response to our format
            const gamNetworks: IGAMNetwork[] = networksArray.map((network: any) => ({
                networkCode: network.networkCode || '',
                networkId: network.name?.split('/').pop() || '',
                displayName: network.displayName || '',
                currencyCode: network.currencyCode,
                timeZone: network.timeZone
            }));
            
            console.log(`✅ Found ${gamNetworks.length} Google Ad Manager networks`);
            
            return gamNetworks;
        } catch (error: any) {
            console.error('❌ Failed to list GAM networks:', error);
            
            // Provide user-friendly error messages
            if (error.code === 7 || error.code === 16) { // PERMISSION_DENIED or UNAUTHENTICATED
                throw new Error('Authentication failed. Please reconnect your Google account.');
            }
            
            throw new Error('Failed to fetch Google Ad Manager networks');
        }
    }
    
    /**
     * Build revenue report query
     * @param networkCode - GAM network code
     * @param startDate - Start date (YYYY-MM-DD)
     * @param endDate - End date (YYYY-MM-DD)
     * @returns Report query configuration
     */
    public buildRevenueReportQuery(
        networkCode: string,
        startDate: string,
        endDate: string
    ): IGAMReportQuery {
        return {
            networkCode,
            startDate,
            endDate,
            dimensions: [
                'DATE',
                'AD_UNIT_ID',
                'AD_UNIT_NAME',
                'COUNTRY_CODE',
                'COUNTRY_NAME',
            ],
            metrics: [
                'TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS',
                'TOTAL_LINE_ITEM_LEVEL_CLICKS',
                'TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE',
                'TOTAL_LINE_ITEM_LEVEL_CTR',
            ],
        };
    }
    
    /**
     * Build inventory report query
     * @param networkCode - GAM network code
     * @param startDate - Start date (YYYY-MM-DD)
     * @param endDate - End date (YYYY-MM-DD)
     * @returns Report query configuration
     */
    public buildInventoryReportQuery(
        networkCode: string,
        startDate: string,
        endDate: string
    ): IGAMReportQuery {
        return {
            networkCode,
            startDate,
            endDate,
            dimensions: [
                'DATE',
                'AD_UNIT_ID',
                'AD_UNIT_NAME',
                'DEVICE_CATEGORY_NAME',
            ],
            metrics: [
                'TOTAL_AD_REQUESTS',
                'TOTAL_MATCHED_REQUESTS',
                'TOTAL_IMPRESSIONS',
            ],
        };
    }
    
    /**
     * Build orders & line items report query
     * @param networkCode - GAM network code
     * @param startDate - Start date (YYYY-MM-DD)
     * @param endDate - End date (YYYY-MM-DD)
     * @returns Report query configuration
     */
    public buildOrdersReportQuery(
        networkCode: string,
        startDate: string,
        endDate: string
    ): IGAMReportQuery {
        return {
            networkCode,
            startDate,
            endDate,
            dimensions: [
                'DATE',
                'ORDER_ID',
                'ORDER_NAME',
                'LINE_ITEM_ID',
                'LINE_ITEM_NAME',
                'ADVERTISER_ID',
                'ADVERTISER_NAME',
            ],
            metrics: [
                'TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS',
                'TOTAL_LINE_ITEM_LEVEL_CLICKS',
                'TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE',
            ],
        };
    }
    
    /**
     * Build geography performance report query
     * @param networkCode - GAM network code
     * @param startDate - Start date (YYYY-MM-DD)
     * @param endDate - End date (YYYY-MM-DD)
     * @returns Report query configuration
     */
    public buildGeographyReportQuery(
        networkCode: string,
        startDate: string,
        endDate: string
    ): IGAMReportQuery {
        return {
            networkCode,
            startDate,
            endDate,
            dimensions: [
                'DATE',
                'COUNTRY_CODE',
                'COUNTRY_NAME',
                'REGION_NAME',
                'CITY_NAME',
            ],
            metrics: [
                'TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS',
                'TOTAL_LINE_ITEM_LEVEL_CLICKS',
                'TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE',
            ],
        };
    }
    
    /**
     * Build device & browser report query
     * @param networkCode - GAM network code
     * @param startDate - Start date (YYYY-MM-DD)
     * @param endDate - End date (YYYY-MM-DD)
     * @returns Report query configuration
     */
    public buildDeviceReportQuery(
        networkCode: string,
        startDate: string,
        endDate: string
    ): IGAMReportQuery {
        return {
            networkCode,
            startDate,
            endDate,
            dimensions: [
                'DATE',
                'DEVICE_CATEGORY_NAME',
                'BROWSER_NAME',
                'OPERATING_SYSTEM_NAME',
            ],
            metrics: [
                'TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS',
                'TOTAL_LINE_ITEM_LEVEL_CLICKS',
                'TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE',
            ],
        };
    }
    
    /**
     * Run a report and wait for completion
     * @param reportQuery - Report query configuration
     * @param connectionDetails - API connection details
     * @returns Report response with data
     */
    public async runReport(
        reportQuery: IGAMReportQuery,
        connectionDetails: IAPIConnectionDetails
    ): Promise<IGAMReportResponse> {
        // Acquire rate limit permission before making API call
        const startWaitTime = Date.now();
        await this.rateLimiter.acquire();
        const waitTime = Date.now() - startWaitTime;
        
        if (waitTime > 0) {
            console.log(`🚦 Rate limiter wait: ${waitTime}ms`);
        }
        
        const status = this.rateLimiter.getStatus();
        console.log(`🚦 Rate limit status: ${status.remainingRequests} requests remaining`);
        
        try {
            console.log('📊 Starting GAM report execution');
            console.log(`   - Network: ${reportQuery.networkCode}`);
            console.log(`   - Date range: ${reportQuery.startDate} to ${reportQuery.endDate}`);
            console.log(`   - Dimensions: ${reportQuery.dimensions.join(', ')}`);
            console.log(`   - Metrics: ${reportQuery.metrics.join(', ')}`);
            
            // Get authenticated OAuth2 client
            const oauthService = GoogleOAuthService.getInstance();
            const oauth2Client = oauthService.getAuthenticatedClient(
                connectionDetails.oauth_access_token,
                connectionDetails.oauth_refresh_token
            );
            
            // Initialize Report Service client
            const reportClient = new ReportServiceClient({
                auth: oauth2Client as any
            });
            
            // Step 1: Create report with dimensions and metrics
            const reportRequest: any = {
                parent: `networks/${reportQuery.networkCode}`,
                report: {
                    dimensions: reportQuery.dimensions,
                    metrics: reportQuery.metrics,
                    dateRange: {
                        startDate: this.formatDateForAPI(reportQuery.startDate),
                        endDate: this.formatDateForAPI(reportQuery.endDate)
                    }
                }
            };
            
            console.log('📝 Creating report job...');
            const createResponse = await reportClient.createReport(reportRequest);
            const report = Array.isArray(createResponse) ? createResponse[0] : createResponse;
            const reportName = report.name!;
            
            console.log(`📋 Report created: ${reportName}`);
            
            // Step 2: Run the report (initiates async generation)
            console.log('🚀 Starting report generation...');
            await reportClient.runReport({ name: reportName });
            
            // Step 3: Poll for completion with exponential backoff
            await this.pollReportCompletion(reportClient, reportName, 300000); // 5 min timeout
            
            // Step 4: Fetch report results
            const rows = await this.fetchReportResults(reportClient, reportName);
            
            const response: IGAMReportResponse = {
                reportId: reportName,
                status: 'COMPLETED',
                rows: rows
            };
            
            console.log(`✅ Report execution completed with ${rows.length} rows`);
            
            return response;
        } catch (error: any) {
            console.error('❌ Failed to run GAM report:', error);
            
            // Provide user-friendly error messages
            if (error.code === 7 || error.code === 16) {
                throw new Error('Authentication failed. Please reconnect your Google account.');
            }
            
            if (error.message?.includes('timeout')) {
                throw new Error('Report generation timed out. Please try a smaller date range.');
            }
            
            throw new Error('Failed to execute Google Ad Manager report');
        }
    }
    
    /**
     * Get report type from string
     * @param reportTypeString - Report type as string
     * @returns GAMReportType enum value
     */
    public getReportType(reportTypeString: string): GAMReportType {
        const reportType = reportTypeString.toLowerCase();
        switch (reportType) {
            case 'revenue':
                return GAMReportType.REVENUE;
            case 'inventory':
                return GAMReportType.INVENTORY;
            case 'orders':
                return GAMReportType.ORDERS;
            case 'geography':
                return GAMReportType.GEOGRAPHY;
            case 'device':
                return GAMReportType.DEVICE;
            default:
                throw new Error(`Unknown report type: ${reportTypeString}`);
        }
    }
    
    /**
     * Poll for report completion with exponential backoff
     * @private
     */
    private async pollReportCompletion(
        client: ReportServiceClient,
        reportName: string,
        maxWaitMs: number
    ): Promise<void> {
        const startTime = Date.now();
        let attempt = 0;
        
        while (Date.now() - startTime < maxWaitMs) {
            const getResponse = await client.getReport({ name: reportName });
            const report: any = Array.isArray(getResponse) ? getResponse[0] : getResponse;
            
            console.log(`   Polling attempt ${attempt + 1}, state: ${report.state}`);
            
            if (report.state === 'DONE' || report.state === 'SUCCEEDED') {
                console.log('✅ Report generation completed');
                return;
            }
            
            if (report.state === 'FAILED' || report.state === 'ERROR') {
                throw new Error(`Report generation failed: ${report.error?.message || 'Unknown error'}`);
            }
            
            // Exponential backoff: 5s, 10s, 20s, 40s, 60s (max)
            const waitMs = Math.min(5000 * Math.pow(2, attempt), 60000);
            console.log(`   Waiting ${waitMs}ms before next check...`);
            await this.sleep(waitMs);
            attempt++;
        }
        
        throw new Error('Report generation timeout after 5 minutes');
    }
    
    /**
     * Fetch report results from completed report
     * @private
     */
    private async fetchReportResults(
        client: ReportServiceClient,
        reportName: string
    ): Promise<IGAMReportRow[]> {
        console.log('📥 Fetching report results...');
        
        const rows: IGAMReportRow[] = [];
        
        // Fetch results with pagination
        const request = { name: reportName };
        const iterable = client.fetchReportResultRowsAsync(request);
        
        for await (const row of iterable) {
            const rowData: any = row; // Type assertion for API compatibility
            rows.push({
                dimensions: this.parseDimensions(rowData.dimensionValues),
                metrics: this.parseMetrics(rowData.metricValues)
            });
        }
        
        console.log(`✅ Fetched ${rows.length} result rows`);
        return rows;
    }
    
    /**
     * Format date string to API format
     * @private
     */
    private formatDateForAPI(dateString: string): { year: number; month: number; day: number } {
        const [year, month, day] = dateString.split('-').map(Number);
        return { year, month, day };
    }
    
    /**
     * Parse dimension values from API response
     * @private
     */
    private parseDimensions(dimensionValues: any): { [key: string]: string | number } {
        const dimensions: { [key: string]: string | number } = {};
        
        if (dimensionValues) {
            Object.keys(dimensionValues).forEach(key => {
                const value = dimensionValues[key];
                // Handle structured date values
                if (value && typeof value === 'object' && 'year' in value) {
                    dimensions[key] = `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
                } else {
                    dimensions[key] = value || '';
                }
            });
        }
        
        return dimensions;
    }
    
    /**
     * Parse metric values from API response
     * @private
     */
    private parseMetrics(metricValues: any): { [key: string]: number } {
        const metrics: { [key: string]: number } = {};
        
        if (metricValues) {
            Object.keys(metricValues).forEach(key => {
                const value = metricValues[key];
                metrics[key] = typeof value === 'number' ? value : parseFloat(value) || 0;
            });
        }
        
        return metrics;
    }
    
    /**
     * Sleep utility for polling delays
     * @private
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get rate limiter status
     * @returns Current rate limit status
     */
    public getRateLimitStatus() {
        return this.rateLimiter.getStatus();
    }
    
    /**
     * Get rate limiter statistics
     * @returns Rate limiter statistics
     */
    public getRateLimitStats() {
        return this.rateLimiter.getStats();
    }
}
