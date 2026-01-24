/**
 * Composable for monitoring Google Ad Manager API rate limit status
 * Provides real-time visibility into rate limiting state
 */

import { ref, computed, onUnmounted } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';
import type { IRateLimitStatus, IRateLimitStats, IRateLimitData } from '~/types/google-ad-manager/rate-limit';

export const useGAMRateLimit = () => {
    const runtimeConfig = useRuntimeConfig();
    const API_BASE_URL = runtimeConfig.public.apiUrl;

    // State
    const rateLimitData = ref<IRateLimitData | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const autoRefreshEnabled = ref(false);
    let refreshInterval: NodeJS.Timeout | null = null;

    // Computed properties
    const isRateLimited = computed(() => rateLimitData.value?.status.isLimited ?? false);
    const remainingRequests = computed(() => rateLimitData.value?.status.remainingRequests ?? 0);
    const queueLength = computed(() => rateLimitData.value?.stats.queueLength ?? 0);
    const utilizationPercent = computed(() => {
        if (!rateLimitData.value) return 0;
        const { requestsInWindow } = rateLimitData.value.stats;
        const { maxRequests } = rateLimitData.value.stats.config;
        return Math.round((requestsInWindow / maxRequests) * 100);
    });

    const statusColor = computed(() => {
        const utilization = utilizationPercent.value;
        if (utilization >= 90) return 'red';
        if (utilization >= 70) return 'orange';
        if (utilization >= 50) return 'yellow';
        return 'green';
    });

    const statusMessage = computed(() => {
        if (!rateLimitData.value) return 'Unknown';
        
        const { isLimited } = rateLimitData.value.status;
        const { remainingRequests } = rateLimitData.value.status;
        const { queueLength } = rateLimitData.value.stats;

        if (isLimited && queueLength > 0) {
            return `Rate limited - ${queueLength} requests queued`;
        }
        if (isLimited) {
            return 'Rate limited';
        }
        if (remainingRequests <= 2) {
            return 'Near limit';
        }
        return 'OK';
    });

    const resetTimeFormatted = computed(() => {
        if (!rateLimitData.value?.status.resetTime) return '';
        const resetTime = new Date(rateLimitData.value.status.resetTime);
        return resetTime.toLocaleTimeString();
    });

    /**
     * Fetch current rate limit status
     */
    const fetchRateLimitStatus = async (): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const result = await $fetch(`${API_BASE_URL}/google-ad-manager/rate-limit`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch rate limit status');
            }

            rateLimitData.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch rate limit status';
            console.error('❌ Error fetching rate limit status:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Start auto-refresh of rate limit status
     * @param intervalMs Refresh interval in milliseconds (default: 5000ms)
     */
    const startAutoRefresh = (intervalMs: number = 5000): void => {
        if (autoRefreshEnabled.value) {
            return; // Already running
        }

        autoRefreshEnabled.value = true;
        
        // Fetch immediately
        fetchRateLimitStatus();

        // Set up interval
        refreshInterval = setInterval(() => {
            fetchRateLimitStatus();
        }, intervalMs);
    };

    /**
     * Stop auto-refresh
     */
    const stopAutoRefresh = (): void => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        autoRefreshEnabled.value = false;
    };

    /**
     * Get warning level based on current state
     * @returns 'none' | 'low' | 'medium' | 'high' | 'critical'
     */
    const getWarningLevel = (): 'none' | 'low' | 'medium' | 'high' | 'critical' => {
        if (!rateLimitData.value) return 'none';

        const utilization = utilizationPercent.value;
        const { isLimited } = rateLimitData.value.status;
        const { queueLength } = rateLimitData.value.stats;

        if (isLimited && queueLength > 5) return 'critical';
        if (isLimited) return 'high';
        if (utilization >= 90) return 'high';
        if (utilization >= 70) return 'medium';
        if (utilization >= 50) return 'low';
        return 'none';
    };

    /**
     * Check if API requests should be delayed
     * Useful for deciding whether to show a warning before making requests
     */
    const shouldDelayRequests = computed(() => {
        return isRateLimited.value || utilizationPercent.value >= 90;
    });

    /**
     * Get estimated wait time in milliseconds before making next request
     */
    const estimatedWaitTimeMs = computed(() => {
        if (!rateLimitData.value) return 0;
        return rateLimitData.value.status.retryAfterMs || 0;
    });

    /**
     * Format wait time for display
     */
    const estimatedWaitTimeFormatted = computed(() => {
        const ms = estimatedWaitTimeMs.value;
        if (ms === 0) return '0s';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    });

    // Cleanup on unmount
    onUnmounted(() => {
        stopAutoRefresh();
    });

    return {
        // State
        rateLimitData,
        isLoading,
        error,
        autoRefreshEnabled,

        // Computed
        isRateLimited,
        remainingRequests,
        queueLength,
        utilizationPercent,
        statusColor,
        statusMessage,
        resetTimeFormatted,
        shouldDelayRequests,
        estimatedWaitTimeMs,
        estimatedWaitTimeFormatted,

        // Methods
        fetchRateLimitStatus,
        startAutoRefresh,
        stopAutoRefresh,
        getWarningLevel,
    };
};
