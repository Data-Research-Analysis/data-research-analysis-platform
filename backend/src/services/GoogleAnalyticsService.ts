import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { GoogleOAuthService } from './GoogleOAuthService.js';

/**
 * Google Analytics 4 (GA4) Service
 * Handles data fetching from Google Analytics Data API
 */
export class GoogleAnalyticsService {
    private static instance: GoogleAnalyticsService;
    
    private constructor() {}
    
    public static getInstance(): GoogleAnalyticsService {
        if (!GoogleAnalyticsService.instance) {
            GoogleAnalyticsService.instance = new GoogleAnalyticsService();
        }
        return GoogleAnalyticsService.instance;
    }
    
    /**
     * Initialize Google Analytics Data API client with OAuth credentials
     * @param connectionDetails - API connection details with OAuth tokens
     * @returns Authenticated GA4 client
     */
    private getAuthenticatedClient(connectionDetails: IAPIConnectionDetails): any {
        const oauthService = GoogleOAuthService.getInstance();
        const oauth2Client = oauthService.getAuthenticatedClient(
            connectionDetails.oauth_access_token,
            connectionDetails.oauth_refresh_token
        );
        
        google.options({ auth: oauth2Client });
        
        return google.analytics('v3');
    }
    
    /**
     * Get authenticated GA4 Data API client
     * @param connectionDetails - API connection details
     * @returns BetaAnalyticsDataClient instance
     */
    private getGA4Client(connectionDetails: IAPIConnectionDetails): BetaAnalyticsDataClient {
        const oauthService = GoogleOAuthService.getInstance();
        const oauth2Client = oauthService.getAuthenticatedClient(
            connectionDetails.oauth_access_token,
            connectionDetails.oauth_refresh_token
        );
        
        return new BetaAnalyticsDataClient({
            auth: oauth2Client
        });
    }
    
    /**
     * List accessible Google Analytics properties
     * @param accessToken - OAuth access token
     * @returns List of GA4 properties user has access to
     */
    public async listProperties(accessToken: string): Promise<any[]> {
        try {
            const oauthService = GoogleOAuthService.getInstance();
            const oauth2Client = oauthService.getAuthenticatedClient(accessToken);
            
            const analyticsAdmin = google.analyticsadmin({
                version: 'v1beta',
                auth: oauth2Client
            });
            
            const response = await analyticsAdmin.properties.list({
                filter: 'parent:accounts/*'
            });
            
            console.log(`✅ Found ${response.data.properties?.length || 0} Google Analytics properties`);
            
            return response.data.properties || [];
        } catch (error) {
            console.error('❌ Failed to list GA properties:', error);
            throw new Error('Failed to fetch Google Analytics properties');
        }
    }
    
    /**
     * Get metadata for a GA4 property (available dimensions and metrics)
     * @param propertyId - GA4 property ID (format: properties/123456789)
     * @param connectionDetails - API connection details
     * @returns Metadata about available dimensions and metrics
     */
    public async getMetadata(propertyId: string, connectionDetails: IAPIConnectionDetails): Promise<any> {
        try {
            const client = this.getGA4Client(connectionDetails);
            
            const [metadata] = await client.getMetadata({
                name: `${propertyId}/metadata`
            });
            
            console.log('✅ Retrieved GA4 metadata');
            console.log(`   - Dimensions: ${metadata.dimensions?.length || 0}`);
            console.log(`   - Metrics: ${metadata.metrics?.length || 0}`);
            
            return {
                dimensions: metadata.dimensions,
                metrics: metadata.metrics
            };
        } catch (error) {
            console.error('❌ Failed to get GA4 metadata:', error);
            throw new Error('Failed to retrieve Google Analytics metadata');
        }
    }
    
    /**
     * Run a report query on GA4
     * @param propertyId - GA4 property ID (format: properties/123456789)
     * @param connectionDetails - API connection details
     * @param dimensions - Array of dimension names (e.g., ['date', 'country'])
     * @param metrics - Array of metric names (e.g., ['activeUsers', 'sessions'])
     * @param dateRanges - Date ranges to query
     * @param limit - Maximum number of rows to return
     * @returns Report data
     */
    public async runReport(
        propertyId: string,
        connectionDetails: IAPIConnectionDetails,
        dimensions: string[],
        metrics: string[],
        dateRanges: Array<{startDate: string, endDate: string}> = [{startDate: '30daysAgo', endDate: 'today'}],
        limit: number = 10000
    ): Promise<any> {
        try {
            const client = this.getGA4Client(connectionDetails);
            
            const [response] = await client.runReport({
                property: propertyId,
                dimensions: dimensions.map(d => ({ name: d })),
                metrics: metrics.map(m => ({ name: m })),
                dateRanges: dateRanges,
                limit: limit,
            });
            
            console.log('✅ Successfully ran GA4 report');
            console.log(`   - Rows returned: ${response.rows?.length || 0}`);
            console.log(`   - Dimensions: ${dimensions.join(', ')}`);
            console.log(`   - Metrics: ${metrics.join(', ')}`);
            
            return response;
        } catch (error) {
            console.error('❌ Failed to run GA4 report:', error);
            throw new Error('Failed to run Google Analytics report');
        }
    }
    
    /**
     * Transform GA4 report response to tabular format
     * @param response - GA4 API response
     * @returns Array of row objects
     */
    public transformReportToRows(response: any): any[] {
        if (!response.rows || response.rows.length === 0) {
            return [];
        }
        
        const dimensionHeaders = response.dimensionHeaders?.map((h: any) => h.name) || [];
        const metricHeaders = response.metricHeaders?.map((h: any) => h.name) || [];
        
        return response.rows.map((row: any) => {
            const rowData: any = {};
            
            // Add dimension values
            row.dimensionValues?.forEach((value: any, index: number) => {
                rowData[dimensionHeaders[index]] = value.value;
            });
            
            // Add metric values
            row.metricValues?.forEach((value: any, index: number) => {
                rowData[metricHeaders[index]] = parseFloat(value.value) || value.value;
            });
            
            return rowData;
        });
    }
    
    /**
     * Get common report presets
     * @returns Object with predefined report configurations
     */
    public static getReportPresets(): any {
        return {
            traffic_overview: {
                name: 'Traffic Overview',
                dimensions: ['date', 'sessionSource', 'sessionMedium'],
                metrics: ['sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'averageSessionDuration', 'bounceRate']
            },
            user_acquisition: {
                name: 'User Acquisition',
                dimensions: ['date', 'firstUserSource', 'firstUserMedium', 'firstUserCampaign'],
                metrics: ['newUsers', 'sessions', 'engagementRate', 'conversions']
            },
            page_performance: {
                name: 'Page Performance',
                dimensions: ['pagePath', 'pageTitle'],
                metrics: ['screenPageViews', 'averageSessionDuration', 'bounceRate', 'exitRate']
            },
            geographic: {
                name: 'Geographic',
                dimensions: ['country', 'city'],
                metrics: ['totalUsers', 'sessions', 'screenPageViews', 'averageSessionDuration']
            },
            device: {
                name: 'Device & Technology',
                dimensions: ['deviceCategory', 'operatingSystem', 'browser'],
                metrics: ['totalUsers', 'sessions', 'screenPageViews', 'bounceRate']
            },
            events: {
                name: 'Events',
                dimensions: ['eventName', 'date'],
                metrics: ['eventCount', 'eventValue', 'conversions']
            }
        };
    }
}
