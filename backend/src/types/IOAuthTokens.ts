/**
 * OAuth 2.0 token response structure
 * Used for Google Analytics, Google Ads, and other OAuth providers
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
 * OAuth authorization URL parameters
 */
export interface IOAuthUrlParams {
    client_id: string;
    redirect_uri: string;
    response_type: string;
    scope: string[];
    access_type: string;
    prompt?: string;
    state?: string;
}
