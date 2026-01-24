/**
 * Composable for monitoring GAM sync performance metrics
 * Provides insights into sync timing, bottlenecks, and trends
 */

import { ref, computed } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';
import type { IAggregatedMetrics, IPerformanceSnapshot, IBottleneckAnalysis } from '~/types/performance/metrics';

export const usePerformanceMetrics = () => {
    const runtimeConfig = useRuntimeConfig();
    const API_BASE_URL = runtimeConfig.public.apiUrl;

    // State
    const allMetrics = ref<IAggregatedMetrics[]>([]);
    const slowestOperations = ref<IPerformanceSnapshot[]>([]);
    const bottlenecks = ref<IBottleneckAnalysis[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Computed properties
    const gamSyncMetrics = computed(() => {
        return allMetrics.value.filter(m => m.operationName.includes('GAM Sync'));
    });

    const avgSyncDuration = computed(() => {
        if (gamSyncMetrics.value.length === 0) return 0;
        const total = gamSyncMetrics.value.reduce((sum, m) => sum + m.avgDuration, 0);
        return Math.round(total / gamSyncMetrics.value.length);
    });

    const totalSyncCount = computed(() => {
        return gamSyncMetrics.value.reduce((sum, m) => sum + m.count, 0);
    });

    const overallSuccessRate = computed(() => {
        if (gamSyncMetrics.value.length === 0) return 100;
        const totalSuccess = gamSyncMetrics.value.reduce(
            (sum, m) => sum + (m.successRate * m.count),
            0
        );
        const totalCount = gamSyncMetrics.value.reduce((sum, m) => sum + m.count, 0);
        return totalCount > 0 ? Math.round(totalSuccess / totalCount) : 100;
    });

    const performanceGrade = computed(() => {
        const avgDuration = avgSyncDuration.value;
        const successRate = overallSuccessRate.value;

        if (successRate >= 95 && avgDuration < 30000) return 'A'; // < 30s
        if (successRate >= 90 && avgDuration < 60000) return 'B'; // < 1min
        if (successRate >= 80 && avgDuration < 120000) return 'C'; // < 2min
        if (successRate >= 70 && avgDuration < 300000) return 'D'; // < 5min
        return 'F';
    });

    const topBottlenecks = computed(() => {
        return bottlenecks.value.slice(0, 5);
    });

    /**
     * Fetch all performance metrics
     */
    const fetchAllMetrics = async (): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const result = await $fetch(`${API_BASE_URL}/performance/metrics`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch metrics');
            }

            allMetrics.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch performance metrics';
            console.error('❌ Error fetching performance metrics:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Fetch metrics for a specific operation
     */
    const fetchOperationMetrics = async (operationName: string): Promise<IAggregatedMetrics | null> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return null;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const result = await $fetch(
                `${API_BASE_URL}/performance/metrics/${encodeURIComponent(operationName)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            ).catch((error) => {
                if (error.statusCode === 404) {
                    return null;
                }
                throw error;
            });

            if (!result) return null;

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch operation metrics');
            }

            return result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch operation metrics';
            console.error('❌ Error fetching operation metrics:', err);
            return null;
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Fetch slowest operations
     */
    const fetchSlowestOperations = async (limit: number = 10): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const result = await $fetch(
                `${API_BASE_URL}/performance/slowest?limit=${limit}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch slowest operations');
            }

            slowestOperations.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch slowest operations';
            console.error('❌ Error fetching slowest operations:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Fetch bottleneck analysis
     */
    const fetchBottlenecks = async (): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const result = await $fetch(`${API_BASE_URL}/performance/bottlenecks`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch bottlenecks');
            }

            bottlenecks.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch bottlenecks';
            console.error('❌ Error fetching bottlenecks:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Fetch all performance data
     */
    const fetchAllPerformanceData = async (): Promise<void> => {
        await Promise.all([
            fetchAllMetrics(),
            fetchSlowestOperations(10),
            fetchBottlenecks()
        ]);
    };

    /**
     * Clear performance metrics
     */
    const clearMetrics = async (operationName?: string): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const url = operationName
                ? `${API_BASE_URL}/performance/metrics?operation=${encodeURIComponent(operationName)}`
                : `${API_BASE_URL}/performance/metrics`;

            const result = await $fetch<{success: boolean, message: string, deletedCount: number}>(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });

            if (!result.success) {
                throw new Error(result.message || 'Failed to clear metrics');
            }

            // Refresh data after clearing
            await fetchAllPerformanceData();
        } catch (err: any) {
            error.value = err.message || 'Failed to clear metrics';
            console.error('❌ Error clearing metrics:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Format duration for display
     */
    const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}min`;
    };

    /**
     * Format memory for display
     */
    const formatMemory = (bytes: number): string => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    /**
     * Get performance color based on duration
     */
    const getDurationColor = (avgDuration: number): string => {
        if (avgDuration < 10000) return 'green'; // < 10s
        if (avgDuration < 30000) return 'yellow'; // < 30s
        if (avgDuration < 60000) return 'orange'; // < 1min
        return 'red'; // >= 1min
    };

    /**
     * Get success rate color
     */
    const getSuccessRateColor = (rate: number): string => {
        if (rate >= 95) return 'green';
        if (rate >= 80) return 'yellow';
        if (rate >= 60) return 'orange';
        return 'red';
    };

    return {
        // State
        allMetrics,
        slowestOperations,
        bottlenecks,
        isLoading,
        error,

        // Computed
        gamSyncMetrics,
        avgSyncDuration,
        totalSyncCount,
        overallSuccessRate,
        performanceGrade,
        topBottlenecks,

        // Methods
        fetchAllMetrics,
        fetchOperationMetrics,
        fetchSlowestOperations,
        fetchBottlenecks,
        fetchAllPerformanceData,
        clearMetrics,
        formatDuration,
        formatMemory,
        getDurationColor,
        getSuccessRateColor,
    };
};
