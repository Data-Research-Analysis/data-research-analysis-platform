import { IMetaTokens } from '../types/IMetaAds.js';

/**
 * Meta OAuth Service
 * Handles Meta (Facebook) OAuth 2.0 flow and token management
 */
export class MetaOAuthService {
    private static instance: MetaOAuthService;
    private static readonly API_VERSION = 'v22.0';
    private static readonly BASE_URL = 'https://graph.facebook.com';
    private static readonly OAUTH_URL = 'https://www.facebook.com';
    
    private constructor() {
        console.log('🔐 Meta OAuth Service initialized');
    }
    
    public static getInstance(): MetaOAuthService {
        if (!MetaOAuthService.instance) {
            MetaOAuthService.instance = new MetaOAuthService();
        }
        return MetaOAuthService.instance;
    }
    
    /**
     * Get Meta App ID from environment
     */
    private getAppId(): string {
        const appId = process.env.META_APP_ID;
        if (!appId) {
            throw new Error('META_APP_ID not configured in environment');
        }
        return appId;
    }
    
    /**
     * Get Meta App Secret from environment
     */
    private getAppSecret(): string {
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret) {
            throw new Error('META_APP_SECRET not configured in environment');
        }
        return appSecret;
    }
    
    /**
     * Get redirect URI from environment
     */
    private getRedirectUri(): string {
        const redirectUri = process.env.META_REDIRECT_URI;
        if (!redirectUri) {
            throw new Error('META_REDIRECT_URI not configured in environment');
        }
        return redirectUri;
    }
    
    /**
     * Get Meta Ads API scopes
     */
    public static getMetaAdsScopes(): string[] {
        return [
            'ads_management',        // Read and manage ad account data
            'business_management',   // Access Business Manager accounts
        ];
    }
    
    /**
     * Generate authorization URL for Meta OAuth flow
     * @param state - CSRF protection state parameter
     * @returns Authorization URL to redirect user to
     */
    public getAuthorizationURL(state: string): string {
        const appId = this.getAppId();
        const redirectUri = this.getRedirectUri();
        const scopes = MetaOAuthService.getMetaAdsScopes();
        
        const params = new URLSearchParams({
            client_id: appId,
            redirect_uri: redirectUri,
            state: state,
            scope: scopes.join(','),
            response_type: 'code',
        });
        
        const authUrl = `${MetaOAuthService.OAUTH_URL}/${MetaOAuthService.API_VERSION}/dialog/oauth?${params.toString()}`;
        
        console.log('📝 Generated Meta OAuth URL');
        console.log('   - App ID:', appId);
        console.log('   - Redirect URI:', redirectUri);
        console.log('   - Scopes:', scopes.join(', '));
        
        return authUrl;
    }
    
    /**
     * Exchange authorization code for access token
     * @param code - Authorization code from OAuth callback
     * @returns Access token and expiry information
     */
    public async exchangeCodeForToken(code: string): Promise<IMetaTokens> {
        const appId = this.getAppId();
        const appSecret = this.getAppSecret();
        const redirectUri = this.getRedirectUri();
        
        const url = `${MetaOAuthService.BASE_URL}/${MetaOAuthService.API_VERSION}/oauth/access_token`;
        const params = new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code: code,
        });
        
        console.log('🔄 Exchanging authorization code for Meta access token');
        
        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Meta OAuth token exchange failed:', errorData);
                throw new Error(`Token exchange failed: ${errorData.error?.message || 'Unknown error'}`);
            }
            
            const data: IMetaTokens = await response.json();
            
            console.log('✅ Successfully exchanged authorization code for Meta token');
            console.log('   - Access token received:', !!data.access_token);
            console.log('   - Token type:', data.token_type);
            console.log('   - Expires in:', data.expires_in, 'seconds');
            
            return data;
        } catch (error: any) {
            console.error('❌ Failed to exchange Meta authorization code:', error);
            throw new Error(`Failed to exchange authorization code: ${error.message}`);
        }
    }
    
    /**
     * Exchange short-lived token for long-lived token (60 days)
     * @param shortLivedToken - Short-lived access token from code exchange
     * @returns Long-lived access token
     */
    public async getLongLivedToken(shortLivedToken: string): Promise<IMetaTokens> {
        const appId = this.getAppId();
        const appSecret = this.getAppSecret();
        
        const url = `${MetaOAuthService.BASE_URL}/${MetaOAuthService.API_VERSION}/oauth/access_token`;
        const params = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortLivedToken,
        });
        
        console.log('🔄 Exchanging short-lived token for long-lived token');
        
        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Long-lived token exchange failed:', errorData);
                throw new Error(`Long-lived token exchange failed: ${errorData.error?.message || 'Unknown error'}`);
            }
            
            const data: IMetaTokens = await response.json();
            
            console.log('✅ Successfully obtained long-lived token');
            console.log('   - Expires in:', data.expires_in, 'seconds (~', Math.floor(data.expires_in / 86400), 'days)');
            
            return data;
        } catch (error: any) {
            console.error('❌ Failed to get long-lived token:', error);
            throw new Error(`Failed to get long-lived token: ${error.message}`);
        }
    }
    
    /**
     * Validate and inspect an access token
     * @param accessToken - Access token to validate
     * @returns Token metadata including app ID, user ID, expiry, scopes
     */
    public async validateToken(accessToken: string): Promise<any> {
        const appId = this.getAppId();
        const appSecret = this.getAppSecret();
        
        const url = `${MetaOAuthService.BASE_URL}/${MetaOAuthService.API_VERSION}/debug_token`;
        const params = new URLSearchParams({
            input_token: accessToken,
            access_token: `${appId}|${appSecret}`, // App access token
        });
        
        console.log('🔍 Validating Meta access token');
        
        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Token validation failed:', errorData);
                throw new Error(`Token validation failed: ${errorData.error?.message || 'Unknown error'}`);
            }
            
            const result = await response.json();
            const tokenData = result.data;
            
            console.log('✅ Token validated successfully');
            console.log('   - Valid:', tokenData.is_valid);
            console.log('   - App ID:', tokenData.app_id);
            console.log('   - User ID:', tokenData.user_id);
            console.log('   - Expires:', tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : 'Never');
            console.log('   - Scopes:', tokenData.scopes?.join(', '));
            
            return tokenData;
        } catch (error: any) {
            console.error('❌ Failed to validate token:', error);
            throw new Error(`Failed to validate token: ${error.message}`);
        }
    }
    
    /**
     * Check if token is expired
     * @param expiryDate - Token expiry timestamp in milliseconds
     * @returns True if token is expired or will expire in next 5 minutes
     */
    public isTokenExpired(expiryDate: number): boolean {
        const now = Date.now();
        const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
        return (expiryDate - now) < bufferTime;
    }
    
    /**
     * Revoke an access token
     * @param accessToken - Access token to revoke
     * @returns True if successfully revoked
     */
    public async revokeToken(accessToken: string): Promise<boolean> {
        const url = `${MetaOAuthService.BASE_URL}/${MetaOAuthService.API_VERSION}/me/permissions`;
        
        console.log('🔒 Revoking Meta access token');
        
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Token revocation failed:', errorData);
                return false;
            }
            
            const result = await response.json();
            console.log('✅ Token revoked successfully:', result);
            return result.success === true;
        } catch (error: any) {
            console.error('❌ Failed to revoke token:', error);
            return false;
        }
    }
}
