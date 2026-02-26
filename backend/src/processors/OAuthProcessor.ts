import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
import { OAuthSessionService } from '../services/OAuthSessionService.js';

export class OAuthProcessor {
    private static instance: OAuthProcessor;

    public static getInstance(): OAuthProcessor {
        if (!OAuthProcessor.instance) {
            OAuthProcessor.instance = new OAuthProcessor();
        }
        return OAuthProcessor.instance;
    }

    /**
     * Generate a Google OAuth authorization URL for the requested service.
     * Returns { configured: false } if Google OAuth is not set up on this server.
     */
    public async generateGoogleOAuthUrl(
        service: 'analytics' | 'ad_manager' | 'google_ads',
        state: string
    ): Promise<{ configured: boolean; authUrl?: string }> {
        const oauthService = GoogleOAuthService.getInstance();
        if (!oauthService.isConfigured()) return { configured: false };

        let scopes: string[] = [];
        if (service === 'analytics') scopes = GoogleOAuthService.getGoogleAnalyticsScopes();
        else if (service === 'ad_manager') scopes = GoogleOAuthService.getGoogleAdManagerScopes();
        else if (service === 'google_ads') scopes = GoogleOAuthService.getGoogleAdsScopes();

        const authUrl = oauthService.generateAuthUrl(scopes, state);
        return { configured: true, authUrl };
    }

    /**
     * Exchange a Google authorization code for tokens and persist them in a Redis session.
     */
    public async exchangeGoogleCode(
        code: string,
        userId: number,
        projectId: number
    ): Promise<{ sessionId: string; expiresIn: number; tokenType: string }> {
        const tokens = await GoogleOAuthService.getInstance().exchangeCodeForTokens(code);
        const sessionId = await OAuthSessionService.getInstance().storeTokens(userId, projectId, tokens);
        return { sessionId, expiresIn: tokens.expires_in, tokenType: tokens.token_type };
    }

    /**
     * Refresh a Google access token using the provided refresh token.
     */
    public async refreshGoogleToken(refreshToken: string): Promise<any> {
        return GoogleOAuthService.getInstance().refreshAccessToken(refreshToken);
    }

    /**
     * Revoke a Google access token.
     */
    public async revokeGoogleToken(accessToken: string): Promise<boolean> {
        return GoogleOAuthService.getInstance().revokeToken(accessToken);
    }

    /**
     * Retrieve OAuth tokens from an active Redis session.
     */
    public async getOAuthSession(sessionId: string): Promise<any> {
        return OAuthSessionService.getInstance().getTokens(sessionId);
    }

    /**
     * Delete an OAuth session from Redis.
     */
    public async deleteOAuthSession(sessionId: string): Promise<void> {
        return OAuthSessionService.getInstance().deleteSession(sessionId);
    }

    /**
     * Get OAuth tokens for a user + project combination.
     */
    public async getOAuthSessionByUser(userId: number, projectId: number): Promise<any> {
        return OAuthSessionService.getInstance().getTokensByUser(userId, projectId);
    }
}
