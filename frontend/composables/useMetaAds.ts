import { useDataSourceStore } from '@/stores/data_sources';
import type { 
    IMetaAdAccount,
    IMetaSyncConfig,
    IMetaSyncStatus
} from '~/types/IMetaAds';

/**
 * Composable for Meta (Facebook) Ads operations
 */
export const useMetaAds = () => {
    const dataSourceStore = useDataSourceStore();

    /**
     * List accessible Meta Ad accounts
     */
    const listAccounts = async (accessToken: string): Promise<IMetaAdAccount[]> => {
        try {
            const accounts = await dataSourceStore.listMetaAdAccounts(accessToken);
            return accounts;
        } catch (error) {
            console.error('Failed to list Meta ad accounts:', error);
            return [];
        }
    };

    /**
     * Get available report types for Meta Ads
     */
    const getReportTypes = () => {
        return [
            {
                id: 'campaigns',
                name: 'Campaigns',
                description: 'Campaign-level data (name, status, budget, objective)'
            },
            {
                id: 'adsets',
                name: 'Ad Sets',
                description: 'Ad set-level data (targeting, schedule, bid strategy)'
            },
            {
                id: 'ads',
                name: 'Ads',
                description: 'Individual ads (creative, status, preview URL)'
            },
            {
                id: 'insights',
                name: 'Insights',
                description: 'Performance metrics (impressions, clicks, spend, conversions)'
            }
        ];
    };

    /**
     * Add Meta Ads data source
     */
    const addDataSource = async (config: IMetaSyncConfig, projectId: number): Promise<number | null> => {
        try {
            const dataSourceId = await dataSourceStore.addMetaAdsDataSource(config, projectId);
            return dataSourceId;
        } catch (error) {
            console.error('Failed to add Meta Ads data source:', error);
            return null;
        }
    };

    /**
     * Trigger manual sync
     */
    const syncNow = async (dataSourceId: number): Promise<boolean> => {
        try {
            console.log('syncNow called for Meta Ads with dataSourceId:', dataSourceId);
            const success = await dataSourceStore.syncMetaAds(dataSourceId);
            return success;
        } catch (error) {
            console.error('Failed to sync Meta Ads data:', error);
            return false;
        }
    };

    /**
     * Get sync status and history
     */
    const getSyncStatus = async (dataSourceId: number): Promise<IMetaSyncStatus | null> => {
        try {
            const status = await dataSourceStore.getMetaAdsSyncStatus(dataSourceId);
            return status;
        } catch (error) {
            console.error('Failed to get Meta Ads sync status:', error);
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
     * Format cost from cents to dollars
     */
    const formatCost = (costCents: number): string => {
        const dollars = costCents / 100;
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

    /**
     * Format CTR (Click-Through Rate)
     */
    const formatCTR = (clicks: number, impressions: number): string => {
        if (impressions === 0) return '0%';
        const ctr = (clicks / impressions) * 100;
        return `${ctr.toFixed(2)}%`;
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
        formatCTR,
    };
};
