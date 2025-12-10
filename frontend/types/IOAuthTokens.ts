/**
 * OAuth 2.0 Token Response
 * Returned from OAuth providers (Google, etc.)
 */
export interface IOAuthTokens {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
    expiry_date?: number;
}

/**
 * OAuth State Parameter
 * Used for CSRF protection during OAuth flow
 */
export interface IOAuthState {
    user_id?: number;
    service: 'analytics' | 'ads';
    timestamp: number;
    redirect_path?: string;
}
