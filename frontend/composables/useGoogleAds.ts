import { useDataSourceStore } from '@/stores/data_sources';
import type { 
    IGoogleAdsAccount,
    IGoogleAdsReportTypeDefinition,
    IGoogleAdsSyncConfig,
    IGoogleAdsSyncStatus
} from '~/types/IGoogleAds';

/**
 * Composable for Google Ads operations
 */
export const useGoogleAds = () => {
    const dataSourceStore = useDataSourceStore();

    /**
     * List accessible Google Ads accounts
     */
    const listAccounts = async (accessToken: string): Promise<IGoogleAdsAccount[]> => {
        try {
            const accounts = await dataSourceStore.listGoogleAdsAccounts(accessToken);
            return accounts;
        } catch (error) {
            console.error('Failed to list Google Ads accounts:', error);
            return [];
        }
    };

    /**
     * Get available report types
     */
    const getReportTypes = (): IGoogleAdsReportTypeDefinition[] => {
        return [
            {
                id: 'campaigns',
                name: 'Campaign Settings',
                description: 'Campaign configuration, channel type, budgets and bidding strategy',
                dimensions: ['Campaign'],
                metrics: ['Budget', 'Target CPA', 'Target ROAS', 'Optimization Score']
            },
            {
                id: 'ad_groups',
                name: 'Ad Groups',
                description: 'Ad group configuration and bids per campaign',
                dimensions: ['Campaign', 'Ad Group'],
                metrics: ['CPC Bid']
            },
            {
                id: 'ads',
                name: 'Ads',
                description: 'Ad-level configuration, headlines, descriptions and final URLs',
                dimensions: ['Campaign', 'Ad Group', 'Ad'],
                metrics: ['Headlines', 'Descriptions', 'Final URLs']
            },
            {
                id: 'insights',
                name: 'Campaign Performance',
                description: 'Daily ad spend, conversions, ROAS and share metrics by campaign',
                dimensions: ['Date', 'Campaign'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'CPM', 'ROAS', 'Impression Share']
            },
            {
                id: 'ad_group_insights',
                name: 'Ad Group Performance',
                description: 'Daily ad spend, conversions and metrics by ad group',
                dimensions: ['Date', 'Campaign', 'Ad Group'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'CPM']
            },
            {
                id: 'demographic_insights',
                name: 'Demographic Performance',
                description: 'Daily performance by age range and gender',
                dimensions: ['Date', 'Campaign', 'Age Range', 'Gender'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'CTR', 'CPC']
            },
            {
                id: 'device_insights',
                name: 'Device Performance',
                description: 'Daily mobile, desktop, tablet breakdown',
                dimensions: ['Date', 'Campaign', 'Device'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'CPM']
            },
            {
                id: 'geographic_insights',
                name: 'Geographic Performance',
                description: 'Daily performance by country, region and city',
                dimensions: ['Date', 'Country', 'Region', 'City'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value']
            },
            {
                id: 'placement_insights',
                name: 'Placement Performance',
                description: 'Daily performance by ad network (Search, Display, YouTube) and slot',
                dimensions: ['Date', 'Campaign', 'Placement', 'Slot'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'CTR', 'CPC', 'CPM']
            },
            {
                id: 'keyword_insights',
                name: 'Keyword Performance',
                description: 'Daily CPC, quality score and conversions by keyword',
                dimensions: ['Date', 'Campaign', 'Ad Group', 'Keyword', 'Match Type'],
                metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'Quality Score']
            },
            {
                id: 'conversion_actions',
                name: 'Conversion Actions',
                description: 'Conversion actions configuration, attribution and lookback windows',
                dimensions: ['Conversion Action'],
                metrics: ['Category', 'Counting Type', 'Attribution Model', 'Default Value']
            }
        ];
    };

    /**
     * Add Google Ads data source
     */
    const addDataSource = async (config: IGoogleAdsSyncConfig): Promise<number | null> => {
        try {
            const dataSourceId = await dataSourceStore.addGoogleAdsDataSource(config);
            return dataSourceId;
        } catch (error) {
            console.error('Failed to add Google Ads data source:', error);
            return null;
        }
    };

    /**
     * Trigger manual sync
     */
    const syncNow = async (dataSourceId: number): Promise<boolean> => {
        try {
            const success = await dataSourceStore.syncGoogleAds(dataSourceId);
            return success;
        } catch (error) {
            console.error('Failed to sync Google Ads data:', error);
            return false;
        }
    };

    /**
     * Get sync status and history
     */
    const getSyncStatus = async (dataSourceId: number): Promise<IGoogleAdsSyncStatus | null> => {
        try {
            const status = await dataSourceStore.getGoogleAdsSyncStatus(dataSourceId);
            return status;
        } catch (error) {
            console.error('Failed to get sync status:', error);
            return null;
        }
    };

    /**
     * Format sync timestamp for display
     */
    const formatSyncTime = (timestamp: string | null): string => {
        if (!timestamp) return 'Never synced';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    };

    /**
     * Calculate date range presets
     */
    const getDateRangePresets = () => {
        const today = new Date();
        
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        
        const last90Days = new Date(today);
        last90Days.setDate(last90Days.getDate() - 90);
        
        return [
            { 
                value: 'last_7_days',
                label: 'Last 7 days', 
                startDate: formatDateISO(last7Days), 
                endDate: formatDateISO(today) 
            },
            { 
                value: 'last_30_days',
                label: 'Last 30 days', 
                startDate: formatDateISO(last30Days), 
                endDate: formatDateISO(today) 
            },
            { 
                value: 'last_90_days',
                label: 'Last 90 days', 
                startDate: formatDateISO(last90Days), 
                endDate: formatDateISO(today) 
            }
        ];
    };

    /**
     * Format date to ISO string (YYYY-MM-DD)
     */
    const formatDateISO = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    /**
     * Validate custom date range
     */
    const validateDateRange = (startDate: string, endDate: string): { isValid: boolean; error?: string } => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
            return { isValid: false, error: 'Start date must be before end date' };
        }
        
        const diffMs = end.getTime() - start.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays > 365) {
            return { isValid: false, error: 'Date range cannot exceed 365 days' };
        }
        
        return { isValid: true };
    };

    /**
     * Format cost from micros to dollars
     */
    const formatCost = (costMicros: number): string => {
        const dollars = costMicros / 1000000;
        return `$${dollars.toFixed(2)}`;
    };

    /**
     * Calculate ROAS (Return on Ad Spend)
     */
    const calculateROAS = (conversionValue: number, cost: number): string => {
        if (cost === 0) return 'N/A';
        const roas = conversionValue / cost;
        return `${roas.toFixed(2)}x`;
    };

    return {
        listAccounts,
        getReportTypes,
        addDataSource,
        syncNow,
        getSyncStatus,
        formatSyncTime,
        getDateRangePresets,
        formatDateISO,
        validateDateRange,
        formatCost,
        calculateROAS,
    };
};
