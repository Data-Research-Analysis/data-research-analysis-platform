import { ILinkedInTokens } from '../types/ILinkedInAds.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';

/**
 * LinkedIn OAuth Service
 * Handles LinkedIn OAuth 2.0 flow and token management for Marketing API.
 * Access tokens valid for 60 days; refresh tokens valid for 1 year.
 */
export class LinkedInOAuthService {
    private static instance: LinkedInOAuthService;

    // LinkedIn OAuth endpoints
    private static readonly AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
    private static readonly TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
    private static readonly REVOKE_URL = 'https://www.linkedin.com/oauth/v2/revoke';

    // Access token TTL is 60 days — refresh if < 5 days remain
    private static readonly REFRESH_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000;

    private constructor() {
        console.log('🔐 LinkedIn OAuth Service initialized');
    }

    public static getInstance(): LinkedInOAuthService {
        if (!LinkedInOAuthService.instance) {
            LinkedInOAuthService.instance = new LinkedInOAuthService();
        }
        return LinkedInOAuthService.instance;
    }

    // -------------------------------------------------------------------------
    // Private env helpers
    // -------------------------------------------------------------------------

    private getClientId(): string {
        const clientId = process.env.LINKEDIN_CLIENT_ID;
        if (!clientId) {
            throw new Error('LINKEDIN_CLIENT_ID not configured in environment');
        }
        return clientId;
    }

    private getClientSecret(): string {
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
        if (!clientSecret) {
            throw new Error('LINKEDIN_CLIENT_SECRET not configured in environment');
        }
        return clientSecret;
    }

    private getRedirectUri(): string {
        const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
        if (!redirectUri) {
            throw new Error('LINKEDIN_REDIRECT_URI not configured in environment');
        }
        return redirectUri;
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    /**
     * Required LinkedIn Marketing API scopes
     */
    public static getLinkedInAdsScopes(): string[] {
        return [
            'r_ads',           // Read ad account data, budgets, campaign details
            'r_ads_reporting', // Access ad performance analytics
        ];
    }

    // -------------------------------------------------------------------------
    // Authorization URL
    // -------------------------------------------------------------------------

    /**
     * Generate the Authorization URL to redirect the user to for LinkedIn OAuth.
     * @param state - CSRF protection state parameter
     * @returns Authorization URL
     */
    public generateAuthorizationUrl(state: string): string {
        const clientId = this.getClientId();
        const redirectUri = this.getRedirectUri();
        const scopes = LinkedInOAuthService.getLinkedInAdsScopes();

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            state: state,
            scope: scopes.join(' '),
        });

        const authUrl = `${LinkedInOAuthService.AUTH_URL}?${params.toString()}`;

        console.log('📝 Generated LinkedIn OAuth URL');
        console.log('   - Client ID:', clientId);
        console.log('   - Redirect URI:', redirectUri);
        console.log('   - Scopes:', scopes.join(', '));

        return authUrl;
    }

    // -------------------------------------------------------------------------
    // Token Exchange
    // -------------------------------------------------------------------------

    /**
     * Exchange an authorization code for access + refresh tokens.
     * @param code - Authorization code received from OAuth callback
     * @returns LinkedIn token set with expiry timestamps
     */
    public async exchangeCodeForToken(code: string): Promise<ILinkedInTokens> {
        const clientId = this.getClientId();
        const clientSecret = this.getClientSecret();
        const redirectUri = this.getRedirectUri();

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
        });

        try {
            const response = await fetch(LinkedInOAuthService.TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ LinkedIn token exchange failed:', response.status, errorText);
                throw new Error(`LinkedIn token exchange failed: ${response.status} ${errorText}`);
            }

            const data = await response.json() as {
                access_token: string;
                expires_in: number;
                refresh_token?: string;
                refresh_token_expires_in?: number;
                scope: string;
                token_type: string;
            };

            const now = Date.now();
            const tokens: ILinkedInTokens = {
                access_token: data.access_token,
                expires_in: data.expires_in,
                token_type: (data.token_type || 'Bearer') as 'Bearer',
                scope: data.scope,
                expires_at: now + data.expires_in * 1000,
                refresh_token: data.refresh_token,
            };

            // Log refresh token expiry separately (not stored in ILinkedInTokens)
            const refreshExpiresAt = data.refresh_token_expires_in
                ? now + data.refresh_token_expires_in * 1000
                : null;

            console.log('✅ Successfully exchanged LinkedIn authorization code for tokens');
            console.log('   - Access token expires:', new Date(tokens.expires_at).toISOString());
            if (refreshExpiresAt) {
                console.log('   - Refresh token expires:', new Date(refreshExpiresAt).toISOString());
            }

            return tokens;
        } catch (error) {
            console.error('❌ Failed to exchange LinkedIn authorization code:', error);
            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // Token Refresh
    // -------------------------------------------------------------------------

    /**
     * Refresh an expired access token using the refresh token.
     * LinkedIn refresh tokens are valid for 1 year.
     * @param refreshToken - The refresh token
     * @returns New LinkedIn token set
     */
    public async refreshAccessToken(refreshToken: string): Promise<ILinkedInTokens> {
        const clientId = this.getClientId();
        const clientSecret = this.getClientSecret();

        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        });

        try {
            const response = await fetch(LinkedInOAuthService.TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ LinkedIn token refresh failed:', response.status, errorText);
                throw new Error(`LinkedIn token refresh failed: ${response.status} ${errorText}`);
            }

            const data = await response.json() as {
                access_token: string;
                expires_in: number;
                refresh_token?: string;
                refresh_token_expires_in?: number;
                scope: string;
                token_type: string;
            };

            const now = Date.now();
            const tokens: ILinkedInTokens = {
                access_token: data.access_token,
                expires_in: data.expires_in,
                token_type: (data.token_type || 'Bearer') as 'Bearer',
                scope: data.scope,
                expires_at: now + data.expires_in * 1000,
                refresh_token: data.refresh_token || refreshToken, // Keep old token if none returned
            };

            console.log('✅ Successfully refreshed LinkedIn access token');
            console.log('   - New access token expires:', new Date(tokens.expires_at).toISOString());

            return tokens;
        } catch (error) {
            console.error('❌ Failed to refresh LinkedIn access token:', error);
            throw new Error('Failed to refresh LinkedIn access token. User may need to re-authenticate.');
        }
    }

    // -------------------------------------------------------------------------
    // Token Revocation
    // -------------------------------------------------------------------------

    /**
     * Revoke a LinkedIn access token (sign out / disconnect).
     * @param accessToken - Access token to revoke
     */
    public async revokeToken(accessToken: string): Promise<void> {
        const clientId = this.getClientId();
        const clientSecret = this.getClientSecret();

        const body = new URLSearchParams({
            token: accessToken,
            client_id: clientId,
            client_secret: clientSecret,
        });

        try {
            const response = await fetch(LinkedInOAuthService.REVOKE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ LinkedIn token revocation failed:', response.status, errorText);
                throw new Error(`LinkedIn token revocation failed: ${response.status} ${errorText}`);
            }

            console.log('✅ Successfully revoked LinkedIn access token');
        } catch (error) {
            console.error('❌ Failed to revoke LinkedIn token:', error);
            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // Token Validity Helpers
    // -------------------------------------------------------------------------

    /**
     * Check whether a token is near expiry (< 5 days remaining).
     * @param expiresAt - Token expiry Unix timestamp (ms)
     * @returns True if token should be refreshed
     */
    public isTokenNearExpiry(expiresAt: number): boolean {
        return Date.now() >= expiresAt - LinkedInOAuthService.REFRESH_THRESHOLD_MS;
    }

    /**
     * Ensure the access token stored in connection details is valid,
     * refreshing it automatically if it is near expiry.
     * @param connectionDetails - Current IAPIConnectionDetails
     * @returns Updated IAPIConnectionDetails (token refreshed if needed)
     */
    public async ensureValidToken(connectionDetails: IAPIConnectionDetails): Promise<IAPIConnectionDetails> {
        const expiresAt = connectionDetails.api_config?.linkedin_ads_token_expires_at;
        const refreshToken = connectionDetails.api_config?.linkedin_ads_refresh_token
            || connectionDetails.oauth_refresh_token;
        const accessToken = connectionDetails.oauth_access_token;

        if (!accessToken) {
            throw new Error('No LinkedIn access token found in oauth_access_token. Please reconnect your LinkedIn account.');
        }

        // Token is still valid — nothing to do
        if (expiresAt && !this.isTokenNearExpiry(expiresAt)) {
            return connectionDetails;
        }

        // Attempt refresh
        if (!refreshToken) {
            throw new Error('LinkedIn access token has expired and no refresh token is available. Please reconnect.');
        }

        console.log('🔄 LinkedIn access token near expiry — refreshing...');

        const newTokens = await this.refreshAccessToken(refreshToken);

        const updated: IAPIConnectionDetails = {
            ...connectionDetails,
            oauth_access_token: newTokens.access_token,
            oauth_refresh_token: (newTokens.refresh_token || refreshToken) as string,
            token_expiry: new Date(newTokens.expires_at),
            api_config: {
                ...connectionDetails.api_config,
                linkedin_ads_token_expires_at: newTokens.expires_at,
                linkedin_ads_refresh_token: newTokens.refresh_token || refreshToken,
            },
        };

        return updated;
    }

    // -------------------------------------------------------------------------
    // Configuration Check
    // -------------------------------------------------------------------------

    /**
     * Check whether LinkedIn OAuth credentials are present in the environment.
     */
    public isConfigured(): boolean {
        return !!(
            process.env.LINKEDIN_CLIENT_ID &&
            process.env.LINKEDIN_CLIENT_SECRET &&
            process.env.LINKEDIN_REDIRECT_URI
        );
    }
}
