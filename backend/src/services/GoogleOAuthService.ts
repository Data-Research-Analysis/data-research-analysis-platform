import { google } from 'googleapis';
import { IOAuthTokens, IOAuthUrlParams } from '../types/IOAuthTokens.js';
import { EncryptionService } from './EncryptionService.js';

/**
 * Google OAuth 2.0 Service
 * Handles authentication flow for Google Analytics and other Google APIs
 */
export class GoogleOAuthService {
    private static instance: GoogleOAuthService;
    private oauth2Client: any;
    
    private constructor() {
        this.initializeOAuthClient();
    }
    
    public static getInstance(): GoogleOAuthService {
        if (!GoogleOAuthService.instance) {
            GoogleOAuthService.instance = new GoogleOAuthService();
        }
        return GoogleOAuthService.instance;
    }
    
    /**
     * Initialize Google OAuth2 client with credentials from environment
     */
    private initializeOAuthClient(): void {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.PUBLIC_BACKEND_URL}/api/oauth/google/callback`;
        
        if (!clientId || !clientSecret) {
            console.warn('⚠️  Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
            return;
        }
        
        console.log('🔐 Initializing Google OAuth2 Client');
        console.log('   - Client ID:', clientId);
        console.log('   - Redirect URI:', redirectUri);
        this.oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );
    }
    
    /**
     * Generate authorization URL for Google OAuth flow
     * @param scopes - Array of Google API scopes to request
     * @param state - Optional state parameter for CSRF protection
     * @returns Authorization URL to redirect user to
     */
    public generateAuthUrl(scopes: string[], state?: string): string {
        if (!this.oauth2Client) {
            throw new Error('Google OAuth client not initialized. Check environment variables.');
        }
        
        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline', // Get refresh token
            scope: scopes,
            state: state || '',
            prompt: 'consent', // Force consent screen to ensure refresh token
        });
        
        console.log('📝 Generated Google OAuth URL');
        return authUrl;
    }
    
    /**
     * Exchange authorization code for access and refresh tokens
     * @param code - Authorization code from OAuth callback
     * @returns OAuth tokens (access_token, refresh_token, etc.)
     */
    public async exchangeCodeForTokens(code: string): Promise<IOAuthTokens> {
        if (!this.oauth2Client) {
            throw new Error('Google OAuth client not initialized');
        }
        
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            
            console.log('✅ Successfully exchanged authorization code for tokens');
            console.log('   - Access token received:', !!tokens.access_token);
            console.log('   - Refresh token received:', !!tokens.refresh_token);
            console.log('   - Expires in:', tokens.expiry_date ? new Date(tokens.expiry_date) : 'N/A');
            
            return {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_type: tokens.token_type || 'Bearer',
                expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
                scope: tokens.scope,
                expiry_date: tokens.expiry_date,
            };
        } catch (error) {
            console.error('❌ Failed to exchange authorization code:', error);
            throw new Error('Failed to exchange authorization code for tokens');
        }
    }
    
    /**
     * Refresh an expired access token using refresh token
     * @param refreshToken - The refresh token
     * @returns New OAuth tokens
     */
    public async refreshAccessToken(refreshToken: string): Promise<IOAuthTokens> {
        if (!this.oauth2Client) {
            throw new Error('Google OAuth client not initialized');
        }
        
        try {
            this.oauth2Client.setCredentials({
                refresh_token: refreshToken
            });
            
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            
            console.log('✅ Successfully refreshed access token');
            console.log('   - New access token received:', !!credentials.access_token);
            console.log('   - Expires in:', credentials.expiry_date ? new Date(credentials.expiry_date) : 'N/A');
            
            return {
                access_token: credentials.access_token,
                refresh_token: credentials.refresh_token || refreshToken, // Keep old refresh token if new one not provided
                token_type: credentials.token_type || 'Bearer',
                expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
                scope: credentials.scope,
                expiry_date: credentials.expiry_date,
            };
        } catch (error) {
            console.error('❌ Failed to refresh access token:', error);
            throw new Error('Failed to refresh access token. User may need to re-authenticate.');
        }
    }
    
    /**
     * Check if access token is expired or about to expire
     * @param expiryDate - Token expiry timestamp (milliseconds)
     * @param bufferSeconds - Refresh token this many seconds before actual expiry (default: 300 = 5 minutes)
     * @returns True if token is expired or about to expire
     */
    public isTokenExpired(expiryDate: number, bufferSeconds: number = 300): boolean {
        const now = Date.now();
        const bufferMs = bufferSeconds * 1000;
        return (expiryDate - bufferMs) <= now;
    }
    
    /**
     * Get authenticated OAuth2 client with credentials
     * @param accessToken - Access token
     * @param refreshToken - Refresh token (optional)
     * @returns Configured OAuth2 client
     */
    public getAuthenticatedClient(accessToken: string, refreshToken?: string): any {
        if (!this.oauth2Client) {
            throw new Error('Google OAuth client not initialized');
        }
        
        const client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || `${process.env.PUBLIC_BACKEND_URL}/api/oauth/google/callback`
        );
        
        client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
        
        return client;
    }
    
    /**
     * Revoke OAuth tokens (sign out)
     * @param accessToken - Access token to revoke
     */
    public async revokeToken(accessToken: string): Promise<boolean> {
        if (!this.oauth2Client) {
            throw new Error('Google OAuth client not initialized');
        }
        
        try {
            await this.oauth2Client.revokeToken(accessToken);
            console.log('✅ Successfully revoked OAuth token');
            return true;
        } catch (error) {
            console.error('❌ Failed to revoke token:', error);
            return false;
        }
    }
    
    /**
     * Get Google Analytics scopes
     * @returns Array of required scopes for Google Analytics
     */
    public static getGoogleAnalyticsScopes(): string[] {
        return [
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/analytics',
        ];
    }
    
    /**
     * Validate OAuth configuration
     * @returns True if OAuth is properly configured
     */
    public isConfigured(): boolean {
        return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    }
}
