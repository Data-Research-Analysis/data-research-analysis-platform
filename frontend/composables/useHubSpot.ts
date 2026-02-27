import { getAuthToken } from '@/composables/AuthToken';

/**
 * Composable for HubSpot CRM data source operations.
 * HubSpot uses OAuth 2.0 — the user is redirected to HubSpot to authorize,
 * then returns to /connect/hubspot with token data in the URL.
 */
export const useHubSpot = () => {
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
    // OAuth helpers
    // -------------------------------------------------------------------------

    /**
     * Redirect the user to HubSpot OAuth authorization.
     * Generates a random state for CSRF protection.
     */
    const startOAuthFlow = async (projectId: number): Promise<void> => {
        const state = btoa(JSON.stringify({ projectId, ts: Date.now() }));

        try {
            const response = await $fetch<{ success: boolean; authUrl: string }>(
                `${config.public.apiBase}/hubspot/connect`,
                {
                    method: 'GET',
                    headers: authHeaders(),
                    params: { state },
                }
            );

            if (response?.authUrl) {
                if (import.meta.client) {
                    window.location.href = response.authUrl;
                }
            }
        } catch (error) {
            console.error('[useHubSpot] Failed to get OAuth URL:', error);
            throw error;
        }
    };

    // -------------------------------------------------------------------------
    // Add data source
    // -------------------------------------------------------------------------

    /**
     * Create a HubSpot data source from OAuth tokens (called after callback redirect).
     */
    const addDataSource = async (params: {
        name: string;
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
        portalId: string;
        projectId: number;
    }): Promise<number | null> => {
        try {
            const response = await $fetch<{ success: boolean; dataSourceId: number }>(
                `${config.public.apiBase}/hubspot/add`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: {
                        name: params.name,
                        accessToken: params.accessToken,
                        refreshToken: params.refreshToken,
                        expiresAt: params.expiresAt,
                        portalId: params.portalId,
                        projectId: params.projectId,
                    },
                }
            );
            return response?.dataSourceId ?? null;
        } catch (error) {
            console.error('[useHubSpot] Failed to add data source:', error);
            return null;
        }
    };

    // -------------------------------------------------------------------------
    // Sync
    // -------------------------------------------------------------------------

    /**
     * Trigger a manual sync for an existing HubSpot data source.
     */
    const syncNow = async (dataSourceId: number): Promise<boolean> => {
        try {
            const response = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/hubspot/sync/${dataSourceId}`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                }
            );
            return response?.success === true;
        } catch (error) {
            console.error('[useHubSpot] Sync error:', error);
            return false;
        }
    };

    // -------------------------------------------------------------------------
    // Token parsing helper (used on /connect/hubspot callback page)
    // -------------------------------------------------------------------------

    /**
     * Parse the base64url token payload from the OAuth callback URL.
     * Returns null if parsing fails.
     */
    const parseCallbackTokens = (tokenPayload: string): {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        portal_id: string;
        state: string;
    } | null => {
        if (!import.meta.client) return null;
        try {
            const json = atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(json);
        } catch {
            return null;
        }
    };

    // -------------------------------------------------------------------------
    // Display helpers
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Sync status / history
    // -------------------------------------------------------------------------

    const getSyncStatus = async (dataSourceId: number): Promise<{ lastSyncTime: string | null; syncHistory: any[] } | null> => {
        try {
            const response = await $fetch<{ success: boolean; lastSyncTime: string | null; syncHistory: any[] }>(
                `${config.public.apiBase}/hubspot/sync-status/${dataSourceId}`,
                { headers: authHeaders() }
            );
            return response?.success ? { lastSyncTime: response.lastSyncTime, syncHistory: response.syncHistory } : null;
        } catch (error) {
            console.error('[useHubSpot] Failed to get sync status:', error);
            return null;
        }
    };

    return {
        startOAuthFlow,
        addDataSource,
        syncNow,
        parseCallbackTokens,
        formatSyncTime,
        getSyncStatus,
    };
};
