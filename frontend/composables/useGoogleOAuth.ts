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
    const initiateAuth = async (projectId?: string): Promise<void> => {
        try {
            // Get authorization URL from backend
            const authUrl = await dataSourceStore.initiateGoogleOAuth();
            
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
     * Check if user is authenticated with Google
     */
    const isAuthenticated = (): boolean => {
        if (!import.meta.client) return false;
        
        const tokens = sessionStorage.getItem('ga_oauth_tokens');
        return !!tokens;
    };

    /**
     * Get stored OAuth tokens
     */
    const getStoredTokens = (): IOAuthTokens | null => {
        if (!import.meta.client) return null;
        
        const tokens = sessionStorage.getItem('ga_oauth_tokens');
        if (!tokens) return null;
        
        try {
            return JSON.parse(tokens);
        } catch {
            return null;
        }
    };

    /**
     * Clear stored OAuth tokens
     */
    const clearTokens = (): void => {
        if (import.meta.client) {
            sessionStorage.removeItem('ga_oauth_tokens');
        }
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
