import { useDataSourceStore } from '@/stores/data_sources';
import type { 
    IGAMNetwork,
    IGAMReportType,
    IGAMSyncConfig,
    IGAMSyncStatus
} from '~/types/IGoogleAdManager';

/**
 * Composable for Google Ad Manager operations
 */
export const useGoogleAdManager = () => {
    const dataSourceStore = useDataSourceStore();

    /**
     * List accessible Google Ad Manager networks
     */
    const listNetworks = async (accessToken: string): Promise<IGAMNetwork[]> => {
        try {
            const networks = await dataSourceStore.listGoogleAdManagerNetworks(accessToken);
            return networks;
        } catch (error) {
            console.error('Failed to list networks:', error);
            return [];
        }
    };

    /**
     * Get available report types (simplified to essential reports only)
     */
    const getReportTypes = (): IGAMReportType[] => {
        return [
            {
                id: 'revenue',
                name: 'Revenue Report',
                description: 'Ad revenue, impressions, clicks, CPM, and CTR by ad unit and country',
                dimensions: ['Date', 'Ad Unit', 'Country'],
                metrics: ['Impressions', 'Clicks', 'Revenue', 'CPM', 'CTR']
            },
            {
                id: 'geography',
                name: 'Geographic Performance',
                description: 'Ad performance broken down by country, region, and city',
                dimensions: ['Date', 'Country', 'Region', 'City'],
                metrics: ['Impressions', 'Clicks', 'Revenue']
            },
            {
                id: 'device',
                name: 'Device & Browser Analysis',
                description: 'Performance metrics by device category, browser, and operating system',
                dimensions: ['Date', 'Device Category', 'Browser', 'Operating System'],
                metrics: ['Impressions', 'Clicks', 'Revenue', 'CTR', 'CPM']
            },
            {
                id: 'ad_unit',
                name: 'Ad Unit Performance',
                description: 'Detailed ad unit metrics including fill rates and eCPM',
                dimensions: ['Date', 'Ad Unit ID', 'Ad Unit Name'],
                metrics: ['Impressions', 'Clicks', 'Revenue', 'Fill Rate', 'eCPM', 'CTR']
            },
            {
                id: 'advertiser',
                name: 'Advertiser Performance',
                description: 'Performance by advertiser, order, and line item',
                dimensions: ['Date', 'Advertiser', 'Order', 'Line Item'],
                metrics: ['Impressions', 'Clicks', 'Revenue', 'CTR', 'CPM']
            },
            {
                id: 'time_series',
                name: 'Daily Aggregates',
                description: 'Daily performance totals including ad requests and fill rates',
                dimensions: ['Date'],
                metrics: ['Impressions', 'Clicks', 'Revenue', 'Ad Requests', 'Fill Rate', 'eCPM', 'CTR']
            }
        ];
    };

    /**
     * Add Google Ad Manager data source
     */
    const addDataSource = async (config: IGAMSyncConfig): Promise<number | null> => {
        try {
            const dataSourceId = await dataSourceStore.addGoogleAdManagerDataSource(config);
            return dataSourceId;
        } catch (error) {
            console.error('Failed to add GAM data source:', error);
            return null;
        }
    };

    /**
     * Trigger manual sync
     */
    const syncNow = async (dataSourceId: number): Promise<boolean> => {
        try {
            console.log('syncNow called with dataSourceId:', dataSourceId);
            const success = await dataSourceStore.syncGoogleAdManager(dataSourceId);
            return success;
        } catch (error) {
            console.error('Failed to sync GAM data:', error);
            return false;
        }
    };

    /**
     * Get sync status and history
     */
    const getSyncStatus = async (dataSourceId: number): Promise<IGAMSyncStatus | null> => {
        try {
            const status = await dataSourceStore.getGoogleAdManagerSyncStatus(dataSourceId);
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
     * Get sync frequency display text
     */
    const getSyncFrequencyText = (frequency: string): string => {
        const map: Record<string, string> = {
            'manual': 'Manual (on demand)',
            'hourly': 'Every hour',
            'daily': 'Daily at 2 AM',
            'weekly': 'Weekly (Sunday 2 AM)'
        };
        return map[frequency] || 'Manual';
    };

    /**
     * Calculate date range presets (simplified)
     */
    const getDateRangePresets = () => {
        const today = new Date();
        
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        
        return [
            { 
                value: 'last_30_days',
                label: 'Last 30 days', 
                startDate: formatDateISO(last30Days), 
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

    return {
        listNetworks,
        getReportTypes,
        addDataSource,
        syncNow,
        getSyncStatus,
        formatSyncTime,
        getSyncFrequencyText,
        getDateRangePresets,
        formatDateISO,
        validateDateRange,
    };
};
