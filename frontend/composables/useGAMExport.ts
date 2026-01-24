/**
 * Composable for GAM data export functionality
 * Provides methods to export data in various formats (CSV, JSON, XLSX)
 */

import { ref } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';
import type { ExportFormat, IExportOptions, IExportResult, IExportHistoryEntry } from '~/types/google-ad-manager/export';

export const useGAMExport = () => {
    const runtimeConfig = useRuntimeConfig();
    const API_BASE_URL = runtimeConfig.public.apiUrl;

    // State
    const isExporting = ref(false);
    const exportProgress = ref(0);
    const error = ref<string | null>(null);
    const exportHistory = ref<IExportHistoryEntry[]>([]);

    /**
     * Create an export
     */
    const createExport = async (options: IExportOptions): Promise<IExportResult> => {
        const token = getAuthToken();
        if (!token) {
            return {
                success: false,
                error: 'Authentication required'
            };
        }

        try {
            isExporting.value = true;
            exportProgress.value = 0;
            error.value = null;

            const result = await $fetch(`${API_BASE_URL}/exports/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: options
            }) as any;

            exportProgress.value = 50;

            exportProgress.value = 100;

            if (!result.success) {
                throw new Error(result.message || 'Export failed');
            }

            return result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to create export';
            console.error('❌ Export failed:', err);
            return {
                success: false,
                error: error.value || undefined
            };
        } finally {
            isExporting.value = false;
        }
    };

    /**
     * Download an export file
     */
    const downloadExport = async (fileName: string): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/exports/download/${fileName}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            // Create blob from response
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            error.value = err.message || 'Failed to download export';
            console.error('❌ Download failed:', err);
        }
    };

    /**
     * Fetch export history for a data source
     */
    const fetchExportHistory = async (dataSourceId: number, limit: number = 20): Promise<void> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return;
        }

        try {
            error.value = null;

            const result = await $fetch(`${API_BASE_URL}/exports/history/${dataSourceId}?limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }) as any;

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch export history');
            }

            exportHistory.value = result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch export history';
            console.error('❌ Failed to fetch export history:', err);
        }
    };

    /**
     * Get available columns for a report type
     */
    const getAvailableColumns = async (reportType: string, networkCode: string): Promise<string[]> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return [];
        }

        try {
            const result = await $fetch(`${API_BASE_URL}/exports/columns/${reportType}/${networkCode}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }) as any;

            if (!result.success) {
                throw new Error(result.message || 'Failed to fetch columns');
            }

            return result.data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch columns';
            console.error('❌ Failed to fetch columns:', err);
            return [];
        }
    };

    /**
     * Delete an export file
     */
    const deleteExport = async (fileName: string): Promise<boolean> => {
        const token = getAuthToken();
        if (!token) {
            error.value = 'Authentication required';
            return false;
        }

        try {
            const result = await $fetch(`${API_BASE_URL}/exports/${fileName}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }) as any;

            return result.success;
        } catch (err: any) {
            error.value = err.message || 'Failed to delete export';
            console.error('❌ Failed to delete export:', err);
            return false;
        }
    };

    /**
     * Format file size for display
     */
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    /**
     * Format date for display
     */
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    /**
     * Get format display name
     */
    const getFormatName = (format: ExportFormat): string => {
        const names: Record<ExportFormat, string> = {
            csv: 'CSV',
            json: 'JSON',
            xlsx: 'Excel (XLSX)'
        };
        return names[format] || format.toUpperCase();
    };

    /**
     * Get format icon
     */
    const getFormatIcon = (format: ExportFormat): string => {
        const icons: Record<ExportFormat, string> = {
            csv: '📄',
            json: '📋',
            xlsx: '📊'
        };
        return icons[format] || '📁';
    };

    return {
        // State
        isExporting,
        exportProgress,
        error,
        exportHistory,

        // Methods
        createExport,
        downloadExport,
        fetchExportHistory,
        getAvailableColumns,
        deleteExport,
        formatFileSize,
        formatDate,
        getFormatName,
        getFormatIcon,
    };
};
