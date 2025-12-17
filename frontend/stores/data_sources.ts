import {defineStore} from 'pinia'
import type { IDataSource } from '~/types/IDataSource';
import type { IOAuthTokens } from '~/types/IOAuthTokens';
import type { 
    IGoogleAnalyticsProperty, 
    IGoogleAnalyticsSyncConfig,
    IGoogleAnalyticsSyncStatus 
} from '~/types/IGoogleAnalytics';
export const useDataSourceStore = defineStore('dataSourcesDRA', () => {
    const dataSources = ref<IDataSource[]>([])
    const selectedDataSource = ref<IDataSource>()
    
    function setDataSources(dataSourcesList: IDataSource[]) {
        dataSources.value = dataSourcesList
        if (import.meta.client) {
            localStorage.setItem('dataSources', JSON.stringify(dataSourcesList));
            enableRefreshDataFlag('setDataSources');
        }
    }
    function setSelectedDataSource(dataSource: IDataSource) {
        selectedDataSource.value = dataSource
        if (import.meta.client) {
            localStorage.setItem('selectedDataSource', JSON.stringify(dataSource));
        }
    }
    function getDataSources() {
        if (import.meta.client && localStorage.getItem('dataSources')) {
            dataSources.value = JSON.parse(localStorage.getItem('dataSources') || '[]')
        }
        return dataSources.value;
    }
    async function retrieveDataSources() {
        const token = getAuthToken();
        if (!token) {
            dataSources.value = [];
            return;
        }
        const url = `${baseUrl()}/data-source/list`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setDataSources(data)
    }

    function getSelectedDataSource() {
        if (import.meta.client && localStorage.getItem('selectedDataSource')) {
            selectedDataSource.value = JSON.parse(localStorage.getItem('selectedDataSource') || 'null')
        }        
        return selectedDataSource.value
    }
    function clearDataSources() {
        dataSources.value = []
        if (import.meta.client) {
            localStorage.removeItem('dataSources');
            enableRefreshDataFlag('clearDataSources');
        }
    }
    function clearSelectedDataSource() {
        selectedDataSource.value = undefined
        if (import.meta.client) {
            localStorage.removeItem('selectedDataSource');
        }
    }
    async function retrieveTablesFromDataSources(dataSourceId: string) {
        const token = getAuthToken();
        if (!token) {
            dataSources.value = [];
            return;
        }
        const url = `${baseUrl()}/data-source/tables/`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setDataSources(data)
    }

    /**
     * Google Analytics OAuth Methods
     */

    /**
     * Initiate Google OAuth flow for Analytics
     * Returns the authorization URL to redirect user to
     */
    async function initiateGoogleOAuth(projectId?: string): Promise<string | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const url = projectId 
                ? `${baseUrl()}/oauth/google/auth-url?service=analytics&project_id=${projectId}`
                : `${baseUrl()}/oauth/google/auth-url?service=analytics`;
                
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Received Google OAuth URL:', data);
                return data.auth_url;
            }
            return null;
        } catch (error) {
            console.error('Error initiating Google OAuth:', error);
            return null;
        }
    }

    /**
     * Handle OAuth callback - exchange code for tokens
     * Returns session info instead of tokens (tokens stored server-side)
     */
    async function handleGoogleOAuthCallback(code: string, state: string): Promise<any | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/oauth/google/callback`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({ code, state })
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    session_id: data.session_id,
                    expires_in: data.expires_in,
                    token_type: data.token_type
                };
            }
            return null;
        } catch (error) {
            console.error('Error handling OAuth callback:', error);
            return null;
        }
    }

    /**
     * Get OAuth tokens from session
     */
    async function getOAuthTokens(sessionId: string): Promise<IOAuthTokens | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/oauth/session/${sessionId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    token_type: data.token_type,
                    expires_in: data.expires_in,
                    expiry_date: data.expiry_date
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting OAuth tokens:', error);
            return null;
        }
    }

    /**
     * Delete OAuth session
     */
    async function deleteOAuthSession(sessionId: string): Promise<boolean> {
        const token = getAuthToken();
        if (!token) return false;

        try {
            const response = await fetch(`${baseUrl()}/oauth/session/${sessionId}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });

            return response.ok;
        } catch (error) {
            console.error('Error deleting OAuth session:', error);
            return false;
        }
    }

    /**
     * List Google Analytics properties accessible to the user
     */
    async function listGoogleAnalyticsProperties(accessToken: string): Promise<IGoogleAnalyticsProperty[]> {
        const token = getAuthToken();
        if (!token) return [];

        try {
            const response = await fetch(`${baseUrl()}/google-analytics/properties`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({ access_token: accessToken })
            });

            if (response.ok) {
                const data = await response.json();
                return data.properties || [];
            }
            return [];
        } catch (error) {
            console.error('Error listing GA properties:', error);
            return [];
        }
    }

    /**
     * Add Google Analytics data source
     */
    async function addGoogleAnalyticsDataSource(config: IGoogleAnalyticsSyncConfig): Promise<number | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/google-analytics/add-data-source`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify(config)
            });

            if (response.ok) {
                const data = await response.json();
                // Refresh data sources list
                await retrieveDataSources();
                return data.data_source_id || null;
            }
            return null;
        } catch (error) {
            console.error('Error adding GA data source:', error);
            return null;
        }
    }

    /**
     * Trigger manual sync for Google Analytics data source
     */
    async function syncGoogleAnalytics(dataSourceId: number): Promise<boolean> {
        const token = getAuthToken();
        console.log('syncGoogleAnalytics called with dataSourceId:', dataSourceId);
        console.log('Auth token:', token);
        if (!token) return false;

        try {
            console.log('Sending sync request to backend for dataSourceId:', dataSourceId);
            const response = await fetch(`${baseUrl()}/google-analytics/sync/${dataSourceId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({}), // Send empty body so validateJWT can add tokenDetails
            });

            return response.ok;
        } catch (error) {
            console.error('Error syncing GA data:', error);
            return false;
        }
    }

    /**
     * Get sync status and history for Google Analytics data source
     */
    async function getGoogleAnalyticsSyncStatus(dataSourceId: number): Promise<IGoogleAnalyticsSyncStatus | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/google-analytics/sync-status/${dataSourceId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    last_sync: data.last_sync,
                    sync_history: data.sync_history || []
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting sync status:', error);
            return null;
        }
    }

    /**
     * List Google Ad Manager networks accessible to the user
     */
    async function listGoogleAdManagerNetworks(accessToken: string): Promise<any[]> {
        const token = getAuthToken();
        if (!token) return [];

        try {
            const response = await fetch(`${baseUrl()}/google-ad-manager/networks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({ access_token: accessToken })
            });

            if (response.ok) {
                const data = await response.json();
                return data.networks || [];
            }
            return [];
        } catch (error) {
            console.error('Error listing GAM networks:', error);
            return [];
        }
    }

    /**
     * Add Google Ad Manager data source
     */
    async function addGoogleAdManagerDataSource(config: any): Promise<number | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/google-ad-manager/add-data-source`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify(config)
            });

            if (response.ok) {
                const data = await response.json();
                // Refresh data sources list
                await retrieveDataSources();
                return data.data_source_id || null;
            }
            return null;
        } catch (error) {
            console.error('Error adding GAM data source:', error);
            return null;
        }
    }

    /**
     * Trigger manual sync for Google Ad Manager data source
     */
    async function syncGoogleAdManager(dataSourceId: number): Promise<boolean> {
        const token = getAuthToken();
        console.log('syncGoogleAdManager called with dataSourceId:', dataSourceId);
        if (!token) return false;

        try {
            const response = await fetch(`${baseUrl()}/google-ad-manager/sync/${dataSourceId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({}), // Send empty body so validateJWT can add tokenDetails
            });

            return response.ok;
        } catch (error) {
            console.error('Error syncing GAM data:', error);
            return false;
        }
    }

    /**
     * Get sync status and history for Google Ad Manager data source
     */
    async function getGoogleAdManagerSyncStatus(dataSourceId: number): Promise<any | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/google-ad-manager/sync-status/${dataSourceId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    last_sync: data.last_sync,
                    sync_history: data.sync_history || []
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting GAM sync status:', error);
            return null;
        }
    }

    return {
        dataSources,
        selectedDataSource,
        setDataSources,
        setSelectedDataSource,
        getDataSources,
        retrieveDataSources,
        clearDataSources,
        getSelectedDataSource,
        clearSelectedDataSource,
        retrieveTablesFromDataSources,
        // Google Analytics methods
        initiateGoogleOAuth,
        handleGoogleOAuthCallback,
        getOAuthTokens,
        deleteOAuthSession,
        listGoogleAnalyticsProperties,
        addGoogleAnalyticsDataSource,
        syncGoogleAnalytics,
        getGoogleAnalyticsSyncStatus,
        // Google Ad Manager methods
        listGoogleAdManagerNetworks,
        addGoogleAdManagerDataSource,
        syncGoogleAdManager,
        getGoogleAdManagerSyncStatus,
    }
});
