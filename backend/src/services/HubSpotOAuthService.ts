import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';

/**
 * HubSpot OAuth 2.0 Service
 * Handles HubSpot OAuth flow and token management.
 *
 * Uses the new developer platform OAuth v3 endpoints:
 *   https://developers.hubspot.com/docs/api-reference/auth-oauth-v3/guide
 *
 * Key differences from legacy v1:
 *  - Token endpoint: api.hubspot.com/oauth/v3/token (not api.hubapi.com/oauth/v1/token)
 *  - hub_id is returned directly in the token exchange response (no second API call needed)
 *  - Token introspect: POST /oauth/v3/token/introspect (not GET /oauth/v1/access-tokens/{token})
 *
 * HubSpot access tokens expire after 30 minutes — refresh via refresh_token.
 */
export class HubSpotOAuthService {
    private static instance: HubSpotOAuthService;

    private static readonly AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
    /** OAuth v3 token endpoint (new developer platform) */
    private static readonly TOKEN_URL = 'https://api.hubspot.com/oauth/v3/token';
    /** OAuth v3 token introspection endpoint */
    private static readonly INTROSPECT_URL = 'https://api.hubspot.com/oauth/v3/token/introspect';

    /** Refresh if access token expires within 5 minutes */
    private static readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

    private constructor() {
        console.log('🟠 HubSpot OAuth Service initialized');
    }

    public static getInstance(): HubSpotOAuthService {
        if (!HubSpotOAuthService.instance) {
            HubSpotOAuthService.instance = new HubSpotOAuthService();
        }
        return HubSpotOAuthService.instance;
    }

    // -------------------------------------------------------------------------
    // Env helpers
    // -------------------------------------------------------------------------

    private getClientId(): string {
        const v = process.env.HUBSPOT_CLIENT_ID;
        if (!v) throw new Error('HUBSPOT_CLIENT_ID not configured');
        return v;
    }

    private getClientSecret(): string {
        const v = process.env.HUBSPOT_CLIENT_SECRET;
        if (!v) throw new Error('HUBSPOT_CLIENT_SECRET not configured');
        return v;
    }

    private getRedirectUri(): string {
        const v = process.env.HUBSPOT_REDIRECT_URI;
        if (!v) throw new Error('HUBSPOT_REDIRECT_URI not configured');
        return v;
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public static getScopes(): string[] {
        return [
            'crm.objects.contacts.read',
            'crm.objects.deals.read',
            'crm.objects.companies.read',
            'crm.objects.line_items.read',
            'sales-email-read',
        ];
    }

    // -------------------------------------------------------------------------
    // Auth URL
    // -------------------------------------------------------------------------

    public generateAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.getClientId(),
            redirect_uri: this.getRedirectUri(),
            scope: HubSpotOAuthService.getScopes().join(' '),
            state,
        });
        return `${HubSpotOAuthService.AUTH_URL}?${params.toString()}`;
    }

    public isConfigured(): boolean {
        return !!(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET && process.env.HUBSPOT_REDIRECT_URI);
    }

    // -------------------------------------------------------------------------
    // Token exchange
    // -------------------------------------------------------------------------

    public async exchangeCodeForTokens(code: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
        expires_at: number;
        portal_id?: string;
    }> {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.getClientId(),
            client_secret: this.getClientSecret(),
            redirect_uri: this.getRedirectUri(),
            code,
        });

        const response = await fetch(HubSpotOAuthService.TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HubSpot token exchange failed (${response.status}): ${err}`);
        }

        const data: any = await response.json();
        const expiresAt = Date.now() + (data.expires_in || 1800) * 1000;

        // OAuth v3 returns hub_id directly in the token response — no second API call needed.
        // Legacy v1 required a separate GET /oauth/v1/access-tokens/{token} call.
        const portalId = data.hub_id ? String(data.hub_id) : undefined;

        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            expires_at: expiresAt,
            portal_id: portalId,
        };
    }

    // -------------------------------------------------------------------------
    // Token refresh
    // -------------------------------------------------------------------------

    public async refreshAccessToken(refreshToken: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: number;
    }> {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.getClientId(),
            client_secret: this.getClientSecret(),
            redirect_uri: this.getRedirectUri(),
            refresh_token: refreshToken,
        });

        const response = await fetch(HubSpotOAuthService.TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HubSpot token refresh failed (${response.status}): ${err}`);
        }

        const data: any = await response.json();
        const expiresAt = Date.now() + (data.expires_in || 1800) * 1000;

        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token || refreshToken,
            expires_at: expiresAt,
        };
    }

    // -------------------------------------------------------------------------
    // Auto-refresh helper
    // -------------------------------------------------------------------------

    /**
     * Ensure the access token is valid; refresh if it expires soon.
     * Updates `connectionDetails` in place and returns the (possibly refreshed) details.
     */
    public async ensureValidToken(
        connectionDetails: IAPIConnectionDetails
    ): Promise<IAPIConnectionDetails> {
        const expiresAt = connectionDetails.api_config?.hubspot_token_expires_at ?? 0;
        const needsRefresh = expiresAt - Date.now() < HubSpotOAuthService.REFRESH_THRESHOLD_MS;

        if (!needsRefresh) return connectionDetails;

        console.log('[HubSpot OAuth] Access token expiring soon — refreshing...');

        const refreshToken = connectionDetails.oauth_refresh_token;
        if (!refreshToken) throw new Error('No HubSpot refresh token available');

        const refreshed = await this.refreshAccessToken(refreshToken);

        connectionDetails.oauth_access_token = refreshed.access_token;
        connectionDetails.oauth_refresh_token = refreshed.refresh_token;
        connectionDetails.api_config = {
            ...connectionDetails.api_config,
            hubspot_token_expires_at: refreshed.expires_at,
        };

        console.log('✅ [HubSpot OAuth] Token refreshed');
        return connectionDetails;
    }
}
