import {defineStore} from 'pinia'
import type { IDataSource } from '~/types/IDataSource';
import type { IOAuthTokens } from '~/types/IOAuthTokens';
import type { 
    IGoogleAnalyticsProperty, 
    IGoogleAnalyticsSyncConfig,
    IGoogleAnalyticsSyncStatus 
} from '~/types/IGoogleAnalytics';
import type {
    IGoogleAdsAccount,
    IGoogleAdsSyncConfig,
    IGoogleAdsSyncStatus
} from '~/types/IGoogleAds';
import type {
    IMetaAdAccount,
    IMetaSyncConfig,
    IMetaSyncStatus
} from '~/types/IMetaAds';
import type {
    ILinkedInAdAccount,
    ILinkedInOAuthSyncConfig,
    ILinkedInSyncStatus
} from '~/types/ILinkedInAds';

let dataSourcesInitialized = false;

export const useDataSourceStore = defineStore('dataSourcesDRA', () => {
    const dataSources = ref<IDataSource[]>([])
    const selectedDataSource = ref<IDataSource>()
    
    // Real-time sync state
    const syncStatus = ref<Map<number, { status: string; progress: number }>>(new Map())
    const syncErrors = ref<Map<number, string>>(new Map())
    
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
        const data = await $fetch(`${baseUrl()}/data-source/list`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        }) as any;
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
        const data = await $fetch(`${baseUrl()}/data-source/tables/`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        }) as any;
        setDataSources(data)
    }

    /**
     * Google Analytics OAuth Methods
     */

    /**
     * Initiate Google OAuth flow for Analytics, Ad Manager, or Google Ads
     * Returns the authorization URL to redirect user to
     */
    async function initiateGoogleOAuth(projectId?: string, serviceType: 'analytics' | 'ad_manager' | 'google_ads' = 'analytics'): Promise<string | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const url = projectId 
                ? `${baseUrl()}/oauth/google/auth-url?service=${serviceType}&project_id=${projectId}`
                : `${baseUrl()}/oauth/google/auth-url?service=${serviceType}`;
                
            const data = await $fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            }) as any;
            console.log('Received Google OAuth URL:', data);
            return data.auth_url;
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
            const data = await $fetch(`${baseUrl()}/oauth/google/callback`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: { code, state }
            }) as any;
            return {
                session_id: data.session_id,
                expires_in: data.expires_in,
                token_type: data.token_type
            };
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
            const data = await $fetch(`${baseUrl()}/oauth/session/${sessionId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            }) as any;
            return {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                token_type: data.token_type,
                expires_in: data.expires_in,
                expiry_date: data.expiry_date
            };
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
            await $fetch(`${baseUrl()}/oauth/session/${sessionId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            return true;
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
            const data = await $fetch(`${baseUrl()}/google-analytics/properties`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: { access_token: accessToken }
            }) as any;
            return data.properties || [];
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
            const data = await $fetch(`${baseUrl()}/google-analytics/add-data-source`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: config
            }) as any;
            // Refresh data sources list
            await retrieveDataSources();
            return data.data_source_id || null;
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
            await $fetch(`${baseUrl()}/google-analytics/sync/${dataSourceId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {}
            });
            return true;
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
            const data = await $fetch(`${baseUrl()}/google-analytics/sync-status/${dataSourceId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            }) as any;
            return {
                last_sync: data.last_sync,
                sync_history: data.sync_history || []
            };
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
            const data = await $fetch(`${baseUrl()}/google-ad-manager/networks`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: { access_token: accessToken }
            }) as any;
            return data.networks || [];
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
            const data = await $fetch(`${baseUrl()}/google-ad-manager/add-data-source`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: config
            }) as any;
            // Refresh data sources list
            await retrieveDataSources();
            return data.data_source_id || null;
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
            await $fetch(`${baseUrl()}/google-ad-manager/sync/${dataSourceId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {}
            });
            return true;
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
            const data = await $fetch(`${baseUrl()}/google-ad-manager/sync-status/${dataSourceId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            }) as any;
            return {
                last_sync: data.last_sync,
                sync_history: data.sync_history || []
            };
        } catch (error) {
            console.error('Error getting GAM sync status:', error);
            return null;
        }
    }

    /**
     * List Google Ads accounts accessible to the user
     */
    async function listGoogleAdsAccounts(accessToken: string): Promise<IGoogleAdsAccount[]> {
        const token = getAuthToken();
        if (!token) return [];

        try {
            const data = await $fetch(`${baseUrl()}/google-ads/accounts`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: { accessToken }
            }) as any;
            return data.accounts || [];
        } catch (error) {
            console.error('Error listing Google Ads accounts:', error);
            return [];
        }
    }

    /**
     * Add Google Ads data source
     */
    async function addGoogleAdsDataSource(config: IGoogleAdsSyncConfig): Promise<number | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            console.log('[Store] Calling /google-ads/add with config:', config);
            
            const data = await $fetch(`${baseUrl()}/google-ads/add`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: config
            }) as any;

            console.log('[Store] Success! Data source ID:', data.dataSourceId);
            // Refresh data sources list
            await retrieveDataSources();
            return data.dataSourceId || null;
            
        } catch (error) {
            console.error('Error adding Google Ads data source:', error);
            throw error;  // Re-throw instead of returning null
        }
    }

    /**
     * Trigger manual sync for Google Ads data source
     */
    async function syncGoogleAds(dataSourceId: number): Promise<boolean> {
        const token = getAuthToken();
        console.log('syncGoogleAds called with dataSourceId:', dataSourceId);
        if (!token) return false;

        try {
            await $fetch(`${baseUrl()}/google-ads/sync/${dataSourceId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {}
            });
            return true;
        } catch (error) {
            console.error('Error syncing Google Ads data:', error);
            return false;
        }
    }

    /**
     * Get sync status and history for Google Ads data source
     */
    async function getGoogleAdsSyncStatus(dataSourceId: number): Promise<IGoogleAdsSyncStatus | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const data = await $fetch(`${baseUrl()}/google-ads/status/${dataSourceId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            }) as any;
            return data.status || null;
        } catch (error) {
            console.error('Error getting Google Ads sync status:', error);
            return null;
        }
    }

    /**
     * Real-time sync status management
     */
    function updateSyncStatus(dataSourceId: number, status: string, progress: number = 0) {
        syncStatus.value.set(dataSourceId, { status, progress });
        if (import.meta.client) {
            localStorage.setItem(`sync_status_${dataSourceId}`, JSON.stringify({ status, progress }));
        }
    }

    function getSyncStatus(dataSourceId: number) {
        return syncStatus.value.get(dataSourceId) || { status: 'idle', progress: 0 };
    }

    function clearSyncStatus(dataSourceId: number) {
        syncStatus.value.delete(dataSourceId);
        syncErrors.value.delete(dataSourceId);
        if (import.meta.client) {
            localStorage.removeItem(`sync_status_${dataSourceId}`);
            localStorage.removeItem(`sync_error_${dataSourceId}`);
        }
    }

    function setSyncError(dataSourceId: number, error: string) {
        syncErrors.value.set(dataSourceId, error);
        if (import.meta.client) {
            localStorage.setItem(`sync_error_${dataSourceId}`, error);
        }
    }

    function getSyncError(dataSourceId: number) {
        return syncErrors.value.get(dataSourceId) || null;
    }

    /**
     * Initiate Meta OAuth flow
     */
    async function initiateMetaOAuth(projectId?: string | number): Promise<void> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        try {
            const response = await fetch(`${baseUrl()}/meta-ads/connect`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.authUrl) {
                    // Store projectId so the OAuth callback page can redirect back
                    if (import.meta.client && projectId) {
                        localStorage.setItem('meta_ads_pending_oauth', JSON.stringify({ projectId }));
                    }
                    // Redirect to Meta OAuth
                    if (import.meta.client) {
                        window.location.href = data.authUrl;
                    }
                } else {
                    throw new Error(data.error || 'Failed to initiate OAuth');
                }
            } else {
                throw new Error('Failed to connect to backend');
            }
        } catch (error) {
            console.error('Error initiating Meta OAuth:', error);
            throw error;
        }
    }

    /**
     * List Meta Ad accounts accessible to the user
     */
    async function listMetaAdAccounts(accessToken: string): Promise<IMetaAdAccount[]> {
        const token = getAuthToken();
        if (!token) return [];

        try {
            const response = await fetch(`${baseUrl()}/meta-ads/accounts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({ accessToken })
            });

            if (response.ok) {
                const data = await response.json();
                return data.accounts || [];
            }
            return [];
        } catch (error) {
            console.error('Error listing Meta ad accounts:', error);
            return [];
        }
    }

    /**
     * Add Meta Ads data source
     */
    async function addMetaAdsDataSource(config: IMetaSyncConfig, projectId: number): Promise<number | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/meta-ads/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({
                    syncConfig: config,
                    projectId: projectId
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Refresh data sources list
                    await retrieveDataSources();
                    return data.dataSourceId || null;
                }
            }
            return null;
        } catch (error) {
            console.error('Error adding Meta Ads data source:', error);
            return null;
        }
    }

    /**
     * Trigger manual sync for Meta Ads data source
     */
    async function syncMetaAds(dataSourceId: number): Promise<boolean> {
        const token = getAuthToken();
        if (!token) return false;

        try {
            const response = await fetch(`${baseUrl()}/meta-ads/sync/${dataSourceId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.success;
            }
            return false;
        } catch (error) {
            console.error('Error syncing Meta Ads data:', error);
            return false;
        }
    }

    /**
     * Get sync status and history for Meta Ads data source
     */
    async function getMetaAdsSyncStatus(dataSourceId: number): Promise<IMetaSyncStatus | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/meta-ads/sync-status/${dataSourceId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return {
                        lastSyncTime: data.lastSyncTime,
                        syncHistory: data.syncHistory || []
                    } as IMetaSyncStatus;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting Meta Ads sync status:', error);
            return null;
        }
    }

    /**
     * Initiate LinkedIn OAuth flow
     */
    async function initiateLinkedInOAuth(projectId?: string | number): Promise<void> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        try {
            const response = await fetch(`${baseUrl()}/linkedin-ads/connect`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.authUrl) {
                    if (import.meta.client && projectId) {
                        localStorage.setItem('linkedin_ads_pending_oauth', JSON.stringify({ projectId }));
                    }
                    if (import.meta.client) {
                        window.location.href = data.authUrl;
                    }
                } else {
                    throw new Error(data.error || 'Failed to initiate OAuth');
                }
            } else {
                throw new Error('Failed to connect to backend');
            }
        } catch (error) {
            console.error('Error initiating LinkedIn OAuth:', error);
            throw error;
        }
    }

    /**
     * List LinkedIn Ad accounts accessible by the access token
     */
    async function listLinkedInAdAccounts(accessToken: string): Promise<{ accounts: ILinkedInAdAccount[]; hasTestAccounts: boolean }> {
        const token = getAuthToken();
        if (!token) return { accounts: [], hasTestAccounts: false };

        const response = await fetch(`${baseUrl()}/linkedin-ads/accounts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify({ accessToken })
        });

        const data = await response.json();

        if (!response.ok) {
            // Surface the real API error rather than silently returning []
            throw new Error(data.error || `Failed to list LinkedIn ad accounts (HTTP ${response.status})`);
        }

        return {
            accounts: data.accounts || [],
            hasTestAccounts: data.hasTestAccounts ?? false,
        };
    }

    /**
     * Add LinkedIn Ads data source
     */
    async function addLinkedInAdsDataSource(config: ILinkedInOAuthSyncConfig, projectId: number): Promise<number | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/linkedin-ads/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({
                    name: config.name,
                    accessToken: config.accessToken,
                    refreshToken: config.refreshToken,
                    expiresAt: config.expiresAt,
                    adAccountId: config.adAccountId,
                    adAccountName: config.adAccountName,
                    projectId,
                    startDate: config.startDate,
                    endDate: config.endDate
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    await retrieveDataSources();
                    return data.dataSourceId || null;
                }
            }
            return null;
        } catch (error) {
            console.error('Error adding LinkedIn Ads data source:', error);
            return null;
        }
    }

    /**
     * Trigger manual sync for LinkedIn Ads data source
     */
    async function syncLinkedInAds(dataSourceId: number): Promise<boolean> {
        const token = getAuthToken();
        if (!token) return false;

        try {
            const response = await fetch(`${baseUrl()}/linkedin-ads/sync/${dataSourceId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.success;
            }
            return false;
        } catch (error) {
            console.error('Error syncing LinkedIn Ads data:', error);
            return false;
        }
    }

    /**
     * Get sync status and history for LinkedIn Ads data source
     */
    async function getLinkedInAdsSyncStatus(dataSourceId: number): Promise<ILinkedInSyncStatus | null> {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${baseUrl()}/linkedin-ads/sync-status/${dataSourceId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return {
                        lastSyncTime: data.lastSyncTime,
                        syncHistory: data.syncHistory || []
                    } as ILinkedInSyncStatus;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting LinkedIn Ads sync status:', error);
            return null;
        }
    }

    async function deleteDataSource(dataSourceId: number): Promise<boolean> {
        const token = getAuthToken();
        if (!token) return false;

        try {
            const response = await fetch(`${baseUrl()}/data-source/delete/${dataSourceId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                }
            });

            if (response.ok) {
                // Remove from local store state
                dataSources.value = dataSources.value.filter(ds => ds.id !== dataSourceId);
                if (import.meta.client) {
                    localStorage.setItem('dataSources', JSON.stringify(dataSources.value));
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting data source:', error);
            return false;
        }
    }

    return {
        dataSources,
        selectedDataSource,
        syncStatus,
        syncErrors,
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
        // Google Ads methods
        listGoogleAdsAccounts,
        addGoogleAdsDataSource,
        syncGoogleAds,
        getGoogleAdsSyncStatus,
        // Real-time sync status methods
        updateSyncStatus,
        getSyncStatus,
        clearSyncStatus,
        setSyncError,
        getSyncError,
        // Meta Ads methods
        initiateMetaOAuth,
        listMetaAdAccounts,
        addMetaAdsDataSource,
        syncMetaAds,
        getMetaAdsSyncStatus,
        // LinkedIn Ads methods
        initiateLinkedInOAuth,
        listLinkedInAdAccounts,
        addLinkedInAdsDataSource,
        syncLinkedInAds,
        getLinkedInAdsSyncStatus,
        // Data source management
        deleteDataSource,
    }
    
    // Initialize from localStorage once on client
    if (import.meta.client && !dataSourcesInitialized && localStorage.getItem('dataSources')) {
        dataSources.value = JSON.parse(localStorage.getItem('dataSources') || '[]');
        dataSourcesInitialized = true;
    }
    
    return storeExports;
});
