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
                id: 'campaign',
                name: 'Campaign Performance',
                description: 'Ad spend, conversions, and ROAS by campaign',
                dimensions: ['Date', 'Campaign'],
                metrics: ['Cost', 'Conversions', 'Conversion Value', 'ROAS', 'CTR', 'CPC', 'CPM']
            },
            {
                id: 'keyword',
                name: 'Keyword Performance',
                description: 'CPC, quality score, and conversions by keyword',
                dimensions: ['Date', 'Campaign', 'Ad Group', 'Keyword', 'Match Type'],
                metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'CTR', 'CPC', 'Quality Score']
            },
            {
                id: 'geographic',
                name: 'Geographic Performance',
                description: 'Performance by country, region, city',
                dimensions: ['Date', 'Country', 'Region', 'City'],
                metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'Conversion Value']
            },
            {
                id: 'device',
                name: 'Device Performance',
                description: 'Mobile, desktop, tablet breakdown',
                dimensions: ['Date', 'Device'],
                metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'Conversion Value', 'CTR', 'CPC']
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
            console.log('syncNow called with dataSourceId:', dataSourceId);
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
        
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        
        const last90Days = new Date(today);
        last90Days.setDate(last90Days.getDate() - 90);
        
        return [
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
