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
     * Get available report types
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
                id: 'inventory',
                name: 'Inventory Report',
                description: 'Ad inventory performance including requests, matched requests, and fill rates',
                dimensions: ['Date', 'Ad Unit', 'Device Category'],
                metrics: ['Ad Requests', 'Matched Requests', 'Impressions', 'Fill Rate']
            },
            {
                id: 'orders',
                name: 'Orders & Line Items',
                description: 'Campaign delivery tracking by order, line item, and advertiser',
                dimensions: ['Date', 'Order', 'Line Item', 'Advertiser'],
                metrics: ['Impressions', 'Clicks', 'Revenue', 'Delivery Status']
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
                name: 'Device & Browser',
                description: 'Performance by device category, browser, and operating system',
                dimensions: ['Date', 'Device Category', 'Browser', 'Operating System'],
                metrics: ['Impressions', 'Clicks', 'Revenue']
            }
        ];
    };

    /**
     * Add Google Ad Manager data source
     */
    const addDataSource = async (config: IGAMSyncConfig): Promise<boolean> => {
        try {
            const success: number | null = await dataSourceStore.addGoogleAdManagerDataSource(config);
            return success !== null;
        } catch (error) {
            console.error('Failed to add GAM data source:', error);
            return false;
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
     * Calculate date range presets
     */
    const getDateRangePresets = () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        
        const last90Days = new Date(today);
        last90Days.setDate(last90Days.getDate() - 90);
        
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        
        return [
            { label: 'Yesterday', start: yesterday, end: yesterday },
            { label: 'Last 7 days', start: last7Days, end: today },
            { label: 'Last 30 days', start: last30Days, end: today },
            { label: 'Last 90 days', start: last90Days, end: today },
            { label: 'This month', start: thisMonth, end: today },
            { label: 'Last month', start: lastMonth, end: lastMonthEnd }
        ];
    };

    /**
     * Format date to ISO string (YYYY-MM-DD)
     */
    const formatDateISO = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    /**
     * Validate date range (max 365 days)
     */
    const validateDateRange = (startDate: Date, endDate: Date): { valid: boolean; error?: string } => {
        if (startDate > endDate) {
            return { valid: false, error: 'Start date must be before end date' };
        }
        
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays > 365) {
            return { valid: false, error: 'Date range cannot exceed 365 days' };
        }
        
        return { valid: true };
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
