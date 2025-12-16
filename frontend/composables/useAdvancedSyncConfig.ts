/**
 * Composable for advanced GAM sync configuration
 * Provides utilities for configuring sync options, date presets, field selection
 */

import { ref, computed } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';
export interface DateRangePreset {
    id: string;
    label: string;
    description: string;
    dates: {
        startDate: string;
        endDate: string;
    } | null;
}

export interface ReportFieldOptions {
    dimensions: Record<string, string[]>;
    metrics: Record<string, string[]>;
}

export interface SyncFrequency {
    type: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    interval?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour?: number;
    minute?: number;
}

export interface DimensionFilter {
    dimension: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'in' | 'notIn';
    values: string[];
}

export interface MetricFilter {
    metric: string;
    operator: 'greaterThan' | 'lessThan' | 'equals' | 'between';
    value: number;
    maxValue?: number;
}

export interface AdvancedSyncConfig {
    dateRangePreset?: string;
    startDate?: string;
    endDate?: string;
    reportTypes: string[];
    reportFieldConfigs?: Array<{
        reportType: string;
        dimensions: string[];
        metrics: string[];
    }>;
    dimensionFilters?: DimensionFilter[];
    metricFilters?: MetricFilter[];
    frequency?: SyncFrequency;
    networkCode: string;
    incrementalSync?: boolean;
    deduplication?: boolean;
    dataValidation?: boolean;
    maxRecordsPerReport?: number;
    notifyOnComplete?: boolean;
    notifyOnFailure?: boolean;
    notificationEmails?: string[];
}

export const useAdvancedSyncConfig = () => {
    const runtimeConfig = useRuntimeConfig();
    const API_BASE_URL = runtimeConfig.public.apiUrl;

    // State
    const datePresets = ref<DateRangePreset[]>([]);
    const reportFieldOptions = ref<ReportFieldOptions>({ dimensions: {}, metrics: {} });
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Computed
    const availableReportTypes = computed(() => Object.keys(reportFieldOptions.value.dimensions));

    /**
     * Fetch date range presets
     */
    const fetchDatePresets = async (): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const response = await fetch(`${API_BASE_URL}/google-ad-manager/date-presets`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch date presets: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch date presets');
            }

            datePresets.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch date presets';
            console.error('❌ Error fetching date presets:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Fetch available report fields (dimensions and metrics)
     */
    const fetchReportFields = async (): Promise<void> => {
        const token = getToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            isLoading.value = true;
            error.value = null;

            const response = await fetch(`${API_BASE_URL}/google-ad-manager/report-fields`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch report fields: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch report fields');
            }

            reportFieldOptions.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch report fields';
            console.error('❌ Error fetching report fields:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Validate sync configuration
     */
    const validateConfig = async (config: AdvancedSyncConfig): Promise<{ valid: boolean; errors: string[] }> => {
        const token = getToken();
        if (!token) {
            return {
                valid: false,
                errors: ['Authentication required']
            };
        }

        try {
            isLoading.value = true;
            error.value = null;

            const response = await fetch(`${API_BASE_URL}/google-ad-manager/validate-config`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                throw new Error(`Failed to validate config: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to validate configuration');
            }

            return {
                valid: result.valid,
                errors: result.errors || []
            };
        } catch (err: any) {
            error.value = err.message || 'Failed to validate configuration';
            console.error('❌ Error validating config:', err);
            return {
                valid: false,
                errors: [err.message || 'Validation failed']
            };
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Get dates for a preset
     */
    const getDatesForPreset = (presetId: string): { startDate: string; endDate: string } | null => {
        const preset = datePresets.value.find(p => p.id === presetId);
        return preset?.dates || null;
    };

    /**
     * Get dimensions for a report type
     */
    const getDimensionsForReport = (reportType: string): string[] => {
        return reportFieldOptions.value.dimensions[reportType] || [];
    };

    /**
     * Get metrics for a report type
     */
    const getMetricsForReport = (reportType: string): string[] => {
        return reportFieldOptions.value.metrics[reportType] || [];
    };

    /**
     * Create default config
     */
    const createDefaultConfig = (networkCode: string): AdvancedSyncConfig => {
        return {
            dateRangePreset: 'last30days',
            reportTypes: ['revenue'],
            networkCode,
            incrementalSync: false,
            deduplication: true,
            dataValidation: true,
            notifyOnComplete: false,
            notifyOnFailure: true,
            notificationEmails: []
        };
    };

    /**
     * Format frequency for display
     */
    const formatFrequency = (frequency: SyncFrequency): string => {
        switch (frequency.type) {
            case 'manual':
                return 'Manual';
            case 'hourly':
                return frequency.interval === 1 
                    ? 'Every hour' 
                    : `Every ${frequency.interval} hours`;
            case 'daily':
                return `Daily at ${frequency.hour || 0}:${String(frequency.minute || 0).padStart(2, '0')}`;
            case 'weekly':
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return `Weekly on ${days[frequency.dayOfWeek || 0]} at ${frequency.hour || 0}:${String(frequency.minute || 0).padStart(2, '0')}`;
            case 'monthly':
                return `Monthly on day ${frequency.dayOfMonth || 1} at ${frequency.hour || 0}:${String(frequency.minute || 0).padStart(2, '0')}`;
            default:
                return 'Unknown';
        }
    };

    /**
     * Validate email address
     */
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    /**
     * Initialize composable
     */
    const initialize = async (): Promise<void> => {
        await Promise.all([
            fetchDatePresets(),
            fetchReportFields()
        ]);
    };

    return {
        // State
        datePresets,
        reportFieldOptions,
        isLoading,
        error,

        // Computed
        availableReportTypes,

        // Methods
        fetchDatePresets,
        fetchReportFields,
        validateConfig,
        getDatesForPreset,
        getDimensionsForReport,
        getMetricsForReport,
        createDefaultConfig,
        formatFrequency,
        isValidEmail,
        initialize,
    };
};
