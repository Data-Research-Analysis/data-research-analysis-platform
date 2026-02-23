import { useDataSourceStore } from '@/stores/data_sources';
import type {
    ILinkedInAdAccount,
    ILinkedInOAuthSyncConfig,
    ILinkedInSyncStatus
} from '~/types/ILinkedInAds';

/**
 * Composable for LinkedIn Ads operations
 */
export const useLinkedInAds = () => {
    const dataSourceStore = useDataSourceStore();

    /**
     * List accessible LinkedIn Ad accounts
     */
    const listAccounts = async (accessToken: string): Promise<ILinkedInAdAccount[]> => {
        try {
            const accounts = await dataSourceStore.listLinkedInAdAccounts(accessToken);
            return accounts;
        } catch (error) {
            console.error('Failed to list LinkedIn ad accounts:', error);
            return [];
        }
    };

    /**
     * Get available report/data types for LinkedIn Ads
     */
    const getDataTypes = () => {
        return [
            {
                id: 'ad_accounts',
                name: 'Ad Accounts',
                description: 'Account-level information (name, status, currency, type)'
            },
            {
                id: 'campaign_groups',
                name: 'Campaign Groups',
                description: 'Campaign group (objective) data (name, status, budget)'
            },
            {
                id: 'campaigns',
                name: 'Campaigns',
                description: 'Campaign-level data (name, status, targeting, bid type)'
            },
            {
                id: 'creatives',
                name: 'Creatives',
                description: 'Ad creative data (type, status, reference)'
            },
            {
                id: 'campaign_analytics',
                name: 'Campaign Analytics',
                description: 'Performance metrics per campaign (impressions, clicks, spend, conversions)'
            },
            {
                id: 'account_analytics',
                name: 'Account Analytics',
                description: 'Aggregated performance metrics at the account level'
            }
        ];
    };

    /**
     * Add LinkedIn Ads data source
     */
    const addDataSource = async (config: ILinkedInOAuthSyncConfig, projectId: number): Promise<number | null> => {
        try {
            const dataSourceId = await dataSourceStore.addLinkedInAdsDataSource(config, projectId);
            return dataSourceId;
        } catch (error) {
            console.error('Failed to add LinkedIn Ads data source:', error);
            return null;
        }
    };

    /**
     * Trigger manual sync
     */
    const syncNow = async (dataSourceId: number): Promise<boolean> => {
        try {
            const success = await dataSourceStore.syncLinkedInAds(dataSourceId);
            return success;
        } catch (error) {
            console.error('Failed to sync LinkedIn Ads data:', error);
            return false;
        }
    };

    /**
     * Get sync status and history
     */
    const getSyncStatus = async (dataSourceId: number): Promise<ILinkedInSyncStatus | null> => {
        try {
            const status = await dataSourceStore.getLinkedInAdsSyncStatus(dataSourceId);
            return status;
        } catch (error) {
            console.error('Failed to get LinkedIn Ads sync status:', error);
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
     * LinkedIn Ads API supports up to 365 days per request
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
     * Format spend amount (LinkedIn reports in micro-currency: 1/1,000,000 of base currency)
     * Divide by 1,000,000 to get base currency value
     */
    const formatSpend = (microAmount: number, currencyCode = 'USD'): string => {
        const amount = microAmount / 1_000_000;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount);
    };

    /**
     * Format CTR (Click-Through Rate)
     */
    const formatCTR = (clicks: number, impressions: number): string => {
        if (impressions === 0) return '0%';
        const ctr = (clicks / impressions) * 100;
        return `${ctr.toFixed(2)}%`;
    };

    /**
     * Format CPC (Cost Per Click) from micro-currency
     */
    const formatCPC = (spendMicro: number, clicks: number, currencyCode = 'USD'): string => {
        if (clicks === 0) return 'N/A';
        const cpc = spendMicro / 1_000_000 / clicks;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(cpc);
    };

    /**
     * Map LinkedIn campaign status to a human-readable label
     */
    const formatCampaignStatus = (status: string): string => {
        const statusMap: Record<string, string> = {
            'ACTIVE': 'Active',
            'PAUSED': 'Paused',
            'ARCHIVED': 'Archived',
            'COMPLETED': 'Completed',
            'CANCELED': 'Canceled',
            'DRAFT': 'Draft',
        };
        return statusMap[status] || status;
    };

    return {
        listAccounts,
        getDataTypes,
        addDataSource,
        syncNow,
        getSyncStatus,
        formatSyncTime,
        getDateRangePresets,
        formatDateISO,
        validateDateRange,
        formatSpend,
        formatCTR,
        formatCPC,
        formatCampaignStatus,
    };
};
