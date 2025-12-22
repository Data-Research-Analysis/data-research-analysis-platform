import { useDataSourceStore } from '@/stores/data_sources';
import type { IOAuthTokens, IOAuthState } from '~/types/IOAuthTokens';

/**
 * Composable for Google OAuth operations
 */
export const useGoogleOAuth = () => {
    const dataSourceStore = useDataSourceStore();
    const route = useRoute();
    const router = useRouter();

    /**
     * Initiate Google OAuth flow
     * Opens authorization URL in current window or popup
     */
    const initiateAuth = async (projectId?: string, serviceType: 'analytics' | 'ad_manager' | 'google_ads' = 'analytics'): Promise<void> => {
        try {
            // Get authorization URL from backend
            const authUrl = await dataSourceStore.initiateGoogleOAuth(projectId, serviceType);
            
            if (!authUrl) {
                throw new Error('Failed to generate authorization URL');
            }

            // Redirect to Google OAuth page
            window.location.href = authUrl;
        } catch (error: any) {
            console.error('Failed to initiate OAuth:', error);
            throw error;
        }
    };

    /**
     * Handle OAuth callback
     * Processes the callback and exchanges code for tokens
     */
    const handleCallback = async (code: string, state: string): Promise<IOAuthTokens | null> => {
        try {
            const tokens = await dataSourceStore.handleGoogleOAuthCallback(code, state);
            return tokens;
        } catch (error: any) {
            console.error('Failed to handle OAuth callback:', error);
            throw error;
        }
    };

    /**
     * Check if user has an active OAuth session
     */
    const isAuthenticated = (): boolean => {
        if (!import.meta.client) return false;
        
        const sessionId = sessionStorage.getItem('ga_oauth_session');
        return !!sessionId;
    };

    /**
     * Get stored OAuth tokens from backend session
     */
    const getStoredTokens = async (): Promise<IOAuthTokens | null> => {
        if (!import.meta.client) return null;
        
        const sessionId = sessionStorage.getItem('ga_oauth_session');
        if (!sessionId) return null;
        
        try {
            const tokens = await dataSourceStore.getOAuthTokens(sessionId);
            return tokens;
        } catch (error) {
            console.error('Failed to retrieve OAuth tokens:', error);
            // Clear invalid session
            clearTokens();
            return null;
        }
    };

    /**
     * Clear OAuth session
     */
    const clearTokens = async (): Promise<void> => {
        if (!import.meta.client) return;
        
        const sessionId = sessionStorage.getItem('ga_oauth_session');
        if (sessionId) {
            try {
                await dataSourceStore.deleteOAuthSession(sessionId);
            } catch (error) {
                console.error('Failed to delete OAuth session:', error);
            }
        }
        
        sessionStorage.removeItem('ga_oauth_session');
    };

    /**
     * Check if token is expired
     */
    const isTokenExpired = (expiryDate?: number): boolean => {
        if (!expiryDate) return true;
        return Date.now() >= expiryDate;
    };

    return {
        initiateAuth,
        handleCallback,
        isAuthenticated,
        getStoredTokens,
        clearTokens,
        isTokenExpired,
    };
};
