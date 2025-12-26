/**
 * Composable for Google Ad Manager Admin Dashboard
 * Provides data and methods for dashboard overview and monitoring
 */

import { ref, computed } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';
import type {
    DashboardStats,
    GAMSyncStatus,
    DataSourceHealth,
    RecentActivity
} from '~/types/IGoogleAdManagerDashboard';

export const useGAMDashboard = () => {
    const runtimeConfig = useRuntimeConfig();
    const API_BASE_URL = runtimeConfig.public.apiUrl;

    // State
    const stats = ref<DashboardStats | null>(null);
    const recentSyncs = ref<GAMSyncStatus[]>([]);
    const dataSourceHealth = ref<DataSourceHealth[]>([]);
    const recentActivity = ref<RecentActivity[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Computed
    const successRate = computed(() => {
        if (!stats.value || stats.value.totalSyncs === 0) return 0;
        return Math.round((stats.value.successfulSyncs / stats.value.totalSyncs) * 100);
    });

    const activeDataSourcesPercent = computed(() => {
        if (!stats.value || stats.value.totalDataSources === 0) return 0;
        return Math.round((stats.value.activeDataSources / stats.value.totalDataSources) * 100);
    });

    const healthyDataSources = computed(() => {
        return dataSourceHealth.value.filter(ds => ds.status === 'healthy').length;
    });

    const warningDataSources = computed(() => {
        return dataSourceHealth.value.filter(ds => ds.status === 'warning').length;
    });

    const errorDataSources = computed(() => {
        return dataSourceHealth.value.filter(ds => ds.status === 'error').length;
    });

    /**
     * Fetch dashboard statistics
     */
    const fetchStats = async (): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const response = await fetch(`/api/google-ad-manager/dashboard/stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch stats: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch stats');
            }

            stats.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch dashboard stats';
            console.error('❌ Failed to fetch dashboard stats:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Fetch recent syncs
     */
    const fetchRecentSyncs = async (limit: number = 10): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            const response = await fetch(`/api/google-ad-manager/dashboard/recent-syncs?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Page not found: ${response.url}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch recent syncs');
            }

            recentSyncs.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch recent syncs';
            console.error('❌ Failed to fetch recent syncs:', err);
        }
    };

    /**
     * Fetch data source health
     */
    const fetchDataSourceHealth = async (): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            const response = await fetch(`/api/google-ad-manager/dashboard/health`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch data source health: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch data source health');
            }

            dataSourceHealth.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch data source health';
            console.error('❌ Failed to fetch data source health:', err);
        }
    };

    /**
     * Fetch recent activity
     */
    const fetchRecentActivity = async (limit: number = 20): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            const response = await fetch(`/api/google-ad-manager/dashboard/activity?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch recent activity: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch recent activity');
            }

            recentActivity.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch recent activity';
            console.error('❌ Failed to fetch recent activity:', err);
        }
    };

    /**
     * Refresh all dashboard data
     */
    const refreshDashboard = async (): Promise<void> => {
        await Promise.all([
            fetchStats(),
            fetchRecentSyncs(),
            fetchDataSourceHealth(),
            fetchRecentActivity()
        ]);
    };

    /**
     * Format duration for display
     */
    const formatDuration = (seconds: number): string => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    };

    /**
     * Format number with abbreviation
     */
    const formatNumber = (num: number): string => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    /**
     * Get status color
     */
    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            'COMPLETED': 'green',
            'IN_PROGRESS': 'blue',
            'PENDING': 'yellow',
            'FAILED': 'red',
            'PARTIAL': 'orange',
            'healthy': 'green',
            'warning': 'yellow',
            'error': 'red',
            'inactive': 'gray',
            'success': 'green',
            'failure': 'red',
            'info': 'blue',
        };
        return colors[status] || 'gray';
    };

    /**
     * Get status icon
     */
    const getStatusIcon = (status: string): string => {
        const icons: Record<string, string> = {
            'COMPLETED': '✅',
            'IN_PROGRESS': '⏳',
            'PENDING': '⏸️',
            'FAILED': '❌',
            'PARTIAL': '⚠️',
            'healthy': '💚',
            'warning': '⚠️',
            'error': '❌',
            'inactive': '⭕',
            'success': '✅',
            'failure': '❌',
            'info': 'ℹ️',
        };
        return icons[status] || '•';
    };

    /**
     * Format relative time
     */
    const formatRelativeTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return {
        // State
        stats,
        recentSyncs,
        dataSourceHealth,
        recentActivity,
        isLoading,
        error,

        // Computed
        successRate,
        activeDataSourcesPercent,
        healthyDataSources,
        warningDataSources,
        errorDataSources,

        // Methods
        fetchStats,
        fetchRecentSyncs,
        fetchDataSourceHealth,
        fetchRecentActivity,
        refreshDashboard,
        formatDuration,
        formatNumber,
        getStatusColor,
        getStatusIcon,
        formatRelativeTime,
    };
};
