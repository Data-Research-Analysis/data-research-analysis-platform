import { useDataSourceStore } from '@/stores/data_sources';
import type { 
    IGoogleAnalyticsProperty,
    IGoogleAnalyticsSyncConfig,
    IGoogleAnalyticsSyncStatus,
    IReportPreset
} from '~/types/IGoogleAnalytics';

/**
 * Composable for Google Analytics operations
 */
export const useGoogleAnalytics = () => {
    const dataSourceStore = useDataSourceStore();

    /**
     * List accessible Google Analytics properties
     */
    const listProperties = async (accessToken: string): Promise<IGoogleAnalyticsProperty[]> => {
        try {
            const properties = await dataSourceStore.listGoogleAnalyticsProperties(accessToken);
            return properties;
        } catch (error) {
            console.error('Failed to list properties:', error);
            return [];
        }
    };

    /**
     * Add Google Analytics data source
     */
    const addDataSource = async (config: IGoogleAnalyticsSyncConfig): Promise<boolean> => {
        try {
            const success: number | null = await dataSourceStore.addGoogleAnalyticsDataSource(config);
            return success !== null;
        } catch (error) {
            console.error('Failed to add data source:', error);
            return false;
        }
    };

    /**
     * Trigger manual sync
     */
    const syncNow = async (dataSourceId: number): Promise<boolean> => {
        try {
            console.log('syncNow called with dataSourceId:', dataSourceId);
            const success = await dataSourceStore.syncGoogleAnalytics(dataSourceId);
            return success;
        } catch (error) {
            console.error('Failed to sync data:', error);
            return false;
        }
    };

    /**
     * Get sync status and history
     */
    const getSyncStatus = async (dataSourceId: number): Promise<IGoogleAnalyticsSyncStatus | null> => {
        try {
            const status = await dataSourceStore.getGoogleAnalyticsSyncStatus(dataSourceId);
            return status;
        } catch (error) {
            console.error('Failed to get sync status:', error);
            return null;
        }
    };

    /**
     * Get available report presets
     */
    const getReportPresets = (): Record<string, IReportPreset> => {
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

    return {
        listProperties,
        addDataSource,
        syncNow,
        getSyncStatus,
        getReportPresets,
        formatSyncTime,
        getSyncFrequencyText,
    };
};
