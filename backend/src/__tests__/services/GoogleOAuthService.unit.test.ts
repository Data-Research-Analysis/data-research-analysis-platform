import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GoogleOAuthService } from '../GoogleOAuthService.js';

/**
 * Unit tests for GoogleOAuthService - OAuth extension for GAM
 * Tests OAuth scope management and client creation
 */
describe('GoogleOAuthService - OAuth Extension for GAM', () => {
    let oauthService: GoogleOAuthService;
    
    beforeAll(() => {
        // Set up environment variables for testing
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
        process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/oauth/google/callback';
        
        oauthService = GoogleOAuthService.getInstance();
    });
    
    afterAll(() => {
        // Clean up environment variables
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;
        delete process.env.GOOGLE_REDIRECT_URI;
    });
    
    describe('Scope Management', () => {
        it('should return Google Analytics scopes', () => {
            const scopes = GoogleOAuthService.getGoogleAnalyticsScopes();
            
            expect(scopes).toBeDefined();
            expect(Array.isArray(scopes)).toBe(true);
            expect(scopes.length).toBeGreaterThan(0);
            expect(scopes).toContain('https://www.googleapis.com/auth/analytics.readonly');
            expect(scopes).toContain('https://www.googleapis.com/auth/analytics');
        });
        
        it('should return Google Ad Manager scopes', () => {
            const scopes = GoogleOAuthService.getGoogleAdManagerScopes();
            
            expect(scopes).toBeDefined();
            expect(Array.isArray(scopes)).toBe(true);
            expect(scopes.length).toBeGreaterThan(0);
            expect(scopes).toContain('https://www.googleapis.com/auth/dfp');
        });
        
        it('should return combined scopes for all Google services', () => {
            const allScopes = GoogleOAuthService.getAllGoogleScopes();
            const gaScopes = GoogleOAuthService.getGoogleAnalyticsScopes();
            const gamScopes = GoogleOAuthService.getGoogleAdManagerScopes();
            
            expect(allScopes).toBeDefined();
            expect(Array.isArray(allScopes)).toBe(true);
            expect(allScopes.length).toBe(gaScopes.length + gamScopes.length);
            
            // Verify all GA scopes are included
            gaScopes.forEach(scope => {
                expect(allScopes).toContain(scope);
            });
            
            // Verify all GAM scopes are included
            gamScopes.forEach(scope => {
                expect(allScopes).toContain(scope);
            });
        });
        
        it('should not have duplicate scopes in combined list', () => {
            const allScopes = GoogleOAuthService.getAllGoogleScopes();
            const uniqueScopes = [...new Set(allScopes)];
            
            expect(allScopes.length).toBe(uniqueScopes.length);
        });
    });
    
    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = GoogleOAuthService.getInstance();
            const instance2 = GoogleOAuthService.getInstance();
            
            expect(instance1).toBe(instance2);
        });
    });
    
    describe('Configuration Validation', () => {
        it('should validate OAuth configuration is present', () => {
            const isConfigured = oauthService.isConfigured();
            
            expect(isConfigured).toBe(true);
        });
        
        it('should detect missing configuration', () => {
            const originalClientId = process.env.GOOGLE_CLIENT_ID;
            delete process.env.GOOGLE_CLIENT_ID;
            
            // Create new instance to test unconfigured state
            const testService = GoogleOAuthService.getInstance();
            const isConfigured = testService.isConfigured();
            
            expect(isConfigured).toBe(false);
            
            // Restore
            process.env.GOOGLE_CLIENT_ID = originalClientId;
        });
    });
    
    describe('Auth URL Generation', () => {
        it('should generate auth URL with GA scopes', () => {
            const scopes = GoogleOAuthService.getGoogleAnalyticsScopes();
            const authUrl = oauthService.generateAuthUrl(scopes, 'test-state');
            
            expect(authUrl).toBeDefined();
            expect(typeof authUrl).toBe('string');
            expect(authUrl).toContain('https://accounts.google.com/o/oauth2');
            expect(authUrl).toContain('scope=');
            expect(authUrl).toContain('state=test-state');
        });
        
        it('should generate auth URL with GAM scopes', () => {
            const scopes = GoogleOAuthService.getGoogleAdManagerScopes();
            const authUrl = oauthService.generateAuthUrl(scopes, 'gam-test-state');
            
            expect(authUrl).toBeDefined();
            expect(typeof authUrl).toBe('string');
            expect(authUrl).toContain('https://accounts.google.com/o/oauth2');
            expect(authUrl).toContain('dfp');
            expect(authUrl).toContain('state=gam-test-state');
        });
        
        it('should generate auth URL with combined scopes', () => {
            const scopes = GoogleOAuthService.getAllGoogleScopes();
            const authUrl = oauthService.generateAuthUrl(scopes);
            
            expect(authUrl).toBeDefined();
            expect(typeof authUrl).toBe('string');
            expect(authUrl).toContain('https://accounts.google.com/o/oauth2');
            expect(authUrl).toContain('scope=');
            // Should include both GA and GAM scopes
            expect(authUrl).toContain('analytics');
            expect(authUrl).toContain('dfp');
        });
        
        it('should include offline access type', () => {
            const scopes = GoogleOAuthService.getGoogleAdManagerScopes();
            const authUrl = oauthService.generateAuthUrl(scopes);
            
            expect(authUrl).toContain('access_type=offline');
        });
        
        it('should force consent prompt', () => {
            const scopes = GoogleOAuthService.getGoogleAdManagerScopes();
            const authUrl = oauthService.generateAuthUrl(scopes);
            
            expect(authUrl).toContain('prompt=consent');
        });
    });
    
    describe('Token Expiry Checking', () => {
        it('should detect expired tokens', () => {
            const pastTime = Date.now() - 10000; // 10 seconds ago
            const isExpired = oauthService.isTokenExpired(pastTime);
            
            expect(isExpired).toBe(true);
        });
        
        it('should detect tokens about to expire (within buffer)', () => {
            const soonToExpire = Date.now() + 200000; // 200 seconds from now (< 5 min buffer)
            const isExpired = oauthService.isTokenExpired(soonToExpire);
            
            expect(isExpired).toBe(true);
        });
        
        it('should detect valid tokens', () => {
            const futureTime = Date.now() + 3600000; // 1 hour from now
            const isExpired = oauthService.isTokenExpired(futureTime);
            
            expect(isExpired).toBe(false);
        });
        
        it('should respect custom buffer time', () => {
            const nearFuture = Date.now() + 100000; // 100 seconds from now
            const isExpiredWithDefaultBuffer = oauthService.isTokenExpired(nearFuture); // 300s buffer
            const isExpiredWithShortBuffer = oauthService.isTokenExpired(nearFuture, 60); // 60s buffer
            
            expect(isExpiredWithDefaultBuffer).toBe(true);
            expect(isExpiredWithShortBuffer).toBe(false);
        });
    });
    
    describe('Authenticated Client Creation', () => {
        it('should create authenticated client with access token only', () => {
            const client = oauthService.getAuthenticatedClient('test-access-token');
            
            expect(client).toBeDefined();
            expect(client.credentials).toBeDefined();
            expect(client.credentials.access_token).toBe('test-access-token');
        });
        
        it('should create authenticated client with both access and refresh tokens', () => {
            const client = oauthService.getAuthenticatedClient(
                'test-access-token',
                'test-refresh-token'
            );
            
            expect(client).toBeDefined();
            expect(client.credentials).toBeDefined();
            expect(client.credentials.access_token).toBe('test-access-token');
            expect(client.credentials.refresh_token).toBe('test-refresh-token');
        });
    });
    
    describe('Error Handling', () => {
        it('should throw error when generating auth URL without configuration', () => {
            const originalClientId = process.env.GOOGLE_CLIENT_ID;
            const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
            
            delete process.env.GOOGLE_CLIENT_ID;
            delete process.env.GOOGLE_CLIENT_SECRET;
            
            // Force re-initialization
            const testService = new (GoogleOAuthService as any)();
            
            expect(() => {
                testService.generateAuthUrl(['test-scope']);
            }).toThrow();
            
            // Restore
            process.env.GOOGLE_CLIENT_ID = originalClientId;
            process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
        });
    });
});
