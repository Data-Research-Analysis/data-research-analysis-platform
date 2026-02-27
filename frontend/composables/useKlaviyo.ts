import { getAuthToken } from '@/composables/AuthToken';

/**
 * Composable for Klaviyo Email Marketing data source operations.
 * Klaviyo uses a private API key — no OAuth redirect needed.
 * The user pastes their key, it is validated, then the data source is created.
 */
export const useKlaviyo = () => {
    const config = useRuntimeConfig();

    const authHeaders = (): Record<string, string> => {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication required');
        return {
            'Authorization': `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json',
        };
    };

    // -------------------------------------------------------------------------
    // Validate API key
    // -------------------------------------------------------------------------

    /**
     * Validate a Klaviyo private API key against the backend before saving.
     * Returns true if valid, false if invalid.
     */
    const validateApiKey = async (apiKey: string): Promise<boolean> => {
        if (!apiKey || apiKey.trim() === '') return false;
        try {
            const response = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/klaviyo/validate`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: { api_key: apiKey.trim() },
                }
            );
            return response?.success === true;
        } catch {
            return false;
        }
    };

    // -------------------------------------------------------------------------
    // Add data source
    // -------------------------------------------------------------------------

    /**
     * Create a Klaviyo data source from a validated private API key.
     */
    const addDataSource = async (params: {
        name: string;
        apiKey: string;
        projectId: number;
    }): Promise<number | null> => {
        try {
            const response = await $fetch<{ success: boolean; dataSourceId: number }>(
                `${config.public.apiBase}/klaviyo/add`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: {
                        name: params.name,
                        api_key: params.apiKey.trim(),
                        projectId: params.projectId,
                    },
                }
            );
            return response?.dataSourceId ?? null;
        } catch (error) {
            console.error('[useKlaviyo] Failed to add data source:', error);
            return null;
        }
    };

    // -------------------------------------------------------------------------
    // Sync
    // -------------------------------------------------------------------------

    /**
     * Trigger a manual sync for an existing Klaviyo data source.
     */
    const syncNow = async (dataSourceId: number): Promise<boolean> => {
        try {
            const response = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/klaviyo/sync/${dataSourceId}`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                }
            );
            return response?.success === true;
        } catch (error) {
            console.error('[useKlaviyo] Sync error:', error);
            return false;
        }
    };

    // -------------------------------------------------------------------------
    // Display helpers
    // -------------------------------------------------------------------------

    /**
     * Compute Klaviyo click-through rate as a formatted string.
     * Returns "—" when sends = 0 to avoid division-by-zero display.
     */
    const formatCtr = (clicks: number, sends: number): string => {
        if (!sends || sends === 0) return '—';
        return `${((clicks / sends) * 100).toFixed(1)}%`;
    };

    const formatSyncTime = (timestamp: string | null): string => {
        if (!timestamp) return 'Never synced';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    const getSyncStatus = async (dataSourceId: number): Promise<{ lastSyncTime: string | null; syncHistory: any[] } | null> => {
        try {
            const response = await $fetch<{ success: boolean; lastSyncTime: string | null; syncHistory: any[] }>(
                `${config.public.apiBase}/klaviyo/sync-status/${dataSourceId}`,
                { headers: authHeaders() }
            );
            return response?.success ? { lastSyncTime: response.lastSyncTime, syncHistory: response.syncHistory } : null;
        } catch (error) {
            console.error('[useKlaviyo] Failed to get sync status:', error);
            return null;
        }
    };

    return {
        validateApiKey,
        addDataSource,
        syncNow,
        formatCtr,
        formatSyncTime,
        getSyncStatus,
    };
};
