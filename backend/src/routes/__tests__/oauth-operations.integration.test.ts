import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Application } from 'express';
import oauthRouter from '../oauth.js';
import { GoogleOAuthService } from '../../services/GoogleOAuthService.js';
import { OAuthSessionService } from '../../services/OAuthSessionService.js';
import { TokenProcessor } from '../../processors/TokenProcessor.js';
import { ITokenDetails } from '../../types/ITokenDetails.js';
import { EUserType } from '../../types/EUserType.js';

// Mock GoogleOAuthService
jest.mock('../../services/GoogleOAuthService.js', () => ({
    GoogleOAuthService: {
        getInstance: jest.fn(() => ({
            isConfigured: jest.fn(),
            generateAuthUrl: jest.fn(),
            exchangeCodeForTokens: jest.fn(),
            refreshAccessToken: jest.fn(),
            revokeToken: jest.fn()
        })),
        getGoogleAnalyticsScopes: jest.fn(() => ['https://www.googleapis.com/auth/analytics.readonly']),
        getGoogleAdManagerScopes: jest.fn(() => ['https://www.googleapis.com/auth/dfp']),
        getGoogleAdsScopes: jest.fn(() => ['https://www.googleapis.com/auth/adwords'])
    }
}));

// Mock OAuthSessionService
jest.mock('../../services/OAuthSessionService.js', () => ({
    OAuthSessionService: {
        getInstance: jest.fn(() => ({
            storeTokens: jest.fn(),
            getTokens: jest.fn(),
            deleteSession: jest.fn(),
            getTokensByUser: jest.fn()
        }))
    }
}));

// Mock TokenProcessor
const mockValidateToken: any = jest.fn();
jest.mock('../../processors/TokenProcessor.js', () => ({
    TokenProcessor: {
        getInstance: jest.fn(() => ({
            validateToken: mockValidateToken
        }))
    }
}));

describe('OAuth Routes Integration Tests', () => {
    let app: Application;
    let mockOAuthService: any;
    let mockSessionService: any;
    
    const validToken = 'valid-jwt-token';
    const validTokenDetails: ITokenDetails = {
        user_id: 1,
        email: 'test@example.com',
        user_type: EUserType.ADMIN,
        iat: Date.now()
    };

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/oauth', oauthRouter);
        
        mockOAuthService = GoogleOAuthService.getInstance();
        mockSessionService = OAuthSessionService.getInstance();
        
        jest.clearAllMocks();
        mockValidateToken.mockResolvedValue(validTokenDetails);
    });

    describe('Authorization URL Generation', () => {
        it('should generate auth URL for Google Analytics', async () => {
            mockOAuthService.isConfigured.mockReturnValue(true);
            mockOAuthService.generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?...');

            const response = await request(app)
                .get('/oauth/google/auth-url?service=analytics')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.auth_url).toBeDefined();
            expect(response.body.message).toBe('Authorization URL generated successfully');
            expect(mockOAuthService.generateAuthUrl).toHaveBeenCalled();
        });

        it('should generate auth URL for Google Ad Manager', async () => {
            mockOAuthService.isConfigured.mockReturnValue(true);
            mockOAuthService.generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?...');

            const response = await request(app)
                .get('/oauth/google/auth-url?service=ad_manager')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.auth_url).toBeDefined();
            expect(mockOAuthService.generateAuthUrl).toHaveBeenCalled();
        });

        it('should generate auth URL for Google Ads', async () => {
            mockOAuthService.isConfigured.mockReturnValue(true);
            mockOAuthService.generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?...');

            const response = await request(app)
                .get('/oauth/google/auth-url?service=google_ads&project_id=5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.auth_url).toBeDefined();
        });

        it('should reject invalid service types', async () => {
            const response = await request(app)
                .get('/oauth/google/auth-url?service=invalid_service')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(mockOAuthService.generateAuthUrl).not.toHaveBeenCalled();
        });

        it('should return error if OAuth not configured', async () => {
            mockOAuthService.isConfigured.mockReturnValue(false);

            const response = await request(app)
                .get('/oauth/google/auth-url?service=analytics')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.message).toContain('not configured');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/oauth/google/auth-url?service=analytics')
                .expect(401);

            expect(mockOAuthService.generateAuthUrl).not.toHaveBeenCalled();
        });

        it('should include CSRF state parameter', async () => {
            mockOAuthService.isConfigured.mockReturnValue(true);
            mockOAuthService.generateAuthUrl.mockImplementation((scopes: any, state: string) => {
                expect(state).toBeDefined();
                const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
                expect(decoded.user_id).toBe(1);
                expect(decoded.service).toBe('analytics');
                expect(decoded.timestamp).toBeDefined();
                return 'https://accounts.google.com/o/oauth2/auth?...';
            });

            await request(app)
                .get('/oauth/google/auth-url?service=analytics&project_id=10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);
        });
    });

    describe('OAuth Callback (GET)', () => {
        it('should redirect to frontend with code and state', async () => {
            const response = await request(app)
                .get('/oauth/google/callback?code=auth_code_123&state=state_abc')
                .expect(302);

            expect(response.header.location).toContain('/oauth/google/callback');
            expect(response.header.location).toContain('code=auth_code_123');
            expect(response.header.location).toContain('state=state_abc');
        });

        it('should handle OAuth errors from Google', async () => {
            const response = await request(app)
                .get('/oauth/google/callback?error=access_denied')
                .expect(302);

            expect(response.header.location).toContain('/oauth/error');
            expect(response.header.location).toContain('error=access_denied');
        });

        it('should require authorization code', async () => {
            const response = await request(app)
                .get('/oauth/google/callback')
                .expect(400);
        });

        it('should handle missing state parameter gracefully', async () => {
            const response = await request(app)
                .get('/oauth/google/callback?code=auth_code_123')
                .expect(302);

            expect(response.header.location).toContain('code=auth_code_123');
        });
    });

    describe('OAuth Callback (POST - Token Exchange)', () => {
        it('should exchange authorization code for tokens', async () => {
            const mockTokens = {
                access_token: 'ya29.access_token',
                refresh_token: 'refresh_token_123',
                expires_in: 3600,
                token_type: 'Bearer',
                expiry_date: Date.now() + 3600000
            };

            mockOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
            mockSessionService.storeTokens.mockResolvedValue('session_123');

            const state = Buffer.from(JSON.stringify({
                user_id: 1,
                service: 'analytics',
                project_id: 5,
                timestamp: Date.now()
            })).toString('base64');

            const response = await request(app)
                .post('/oauth/google/callback')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    code: 'auth_code_123',
                    state: state
                })
                .expect(200);

            expect(response.body.session_id).toBe('session_123');
            expect(response.body.expires_in).toBe(3600);
            expect(mockOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith('auth_code_123');
            expect(mockSessionService.storeTokens).toHaveBeenCalledWith(1, 5, mockTokens);
        });

        it('should validate state parameter matches user', async () => {
            const state = Buffer.from(JSON.stringify({
                user_id: 999, // Different user ID
                service: 'analytics',
                timestamp: Date.now()
            })).toString('base64');

            const response = await request(app)
                .post('/oauth/google/callback')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    code: 'auth_code_123',
                    state: state
                })
                .expect(400);

            expect(response.body.message).toContain('Invalid state parameter');
            expect(mockOAuthService.exchangeCodeForTokens).not.toHaveBeenCalled();
        });

        it('should reject malformed state parameter', async () => {
            const response = await request(app)
                .post('/oauth/google/callback')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    code: 'auth_code_123',
                    state: 'invalid_base64'
                })
                .expect(400);

            expect(response.body.message).toContain('Invalid state parameter');
        });

        it('should require authorization code', async () => {
            const response = await request(app)
                .post('/oauth/google/callback')
                .set('Authorization', `Bearer ${validToken}`)
                .send({})
                .expect(400);

            expect(mockOAuthService.exchangeCodeForTokens).not.toHaveBeenCalled();
        });

        it('should handle token exchange failures', async () => {
            mockOAuthService.exchangeCodeForTokens.mockRejectedValue(new Error('Token exchange failed'));

            const response = await request(app)
                .post('/oauth/google/callback')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ code: 'auth_code_123' })
                .expect(500);

            expect(response.body.message).toContain('Failed to complete authentication');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/oauth/google/callback')
                .send({ code: 'auth_code_123' })
                .expect(401);
        });
    });

    describe('Token Refresh', () => {
        it('should refresh access token with valid refresh token', async () => {
            const mockRefreshedTokens = {
                access_token: 'new_access_token',
                refresh_token: 'new_refresh_token',
                expires_in: 3600,
                token_type: 'Bearer',
                expiry_date: Date.now() + 3600000
            };

            mockOAuthService.refreshAccessToken.mockResolvedValue(mockRefreshedTokens);

            const response = await request(app)
                .post('/oauth/google/refresh')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ refresh_token: 'old_refresh_token' })
                .expect(200);

            expect(response.body.access_token).toBe('new_access_token');
            expect(response.body.message).toBe('Token refreshed successfully');
            expect(mockOAuthService.refreshAccessToken).toHaveBeenCalledWith('old_refresh_token');
        });

        it('should require refresh token parameter', async () => {
            const response = await request(app)
                .post('/oauth/google/refresh')
                .set('Authorization', `Bearer ${validToken}`)
                .send({})
                .expect(400);

            expect(mockOAuthService.refreshAccessToken).not.toHaveBeenCalled();
        });

        it('should handle invalid refresh tokens', async () => {
            mockOAuthService.refreshAccessToken.mockRejectedValue(new Error('Invalid refresh token'));

            const response = await request(app)
                .post('/oauth/google/refresh')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ refresh_token: 'invalid_token' })
                .expect(401);

            expect(response.body.message).toContain('Failed to refresh token');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/oauth/google/refresh')
                .send({ refresh_token: 'token' })
                .expect(401);
        });
    });

    describe('Token Revocation', () => {
        it('should revoke access token successfully', async () => {
            mockOAuthService.revokeToken.mockResolvedValue(true);

            const response = await request(app)
                .post('/oauth/google/revoke')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ access_token: 'token_to_revoke' })
                .expect(200);

            expect(response.body.message).toBe('Token revoked successfully');
            expect(mockOAuthService.revokeToken).toHaveBeenCalledWith('token_to_revoke');
        });

        it('should handle revocation failures', async () => {
            mockOAuthService.revokeToken.mockResolvedValue(false);

            const response = await request(app)
                .post('/oauth/google/revoke')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ access_token: 'token_to_revoke' })
                .expect(500);

            expect(response.body.message).toBe('Failed to revoke token');
        });

        it('should require access token parameter', async () => {
            const response = await request(app)
                .post('/oauth/google/revoke')
                .set('Authorization', `Bearer ${validToken}`)
                .send({})
                .expect(400);

            expect(mockOAuthService.revokeToken).not.toHaveBeenCalled();
        });

        it('should handle revocation errors', async () => {
            mockOAuthService.revokeToken.mockRejectedValue(new Error('Revocation failed'));

            const response = await request(app)
                .post('/oauth/google/revoke')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ access_token: 'token' })
                .expect(500);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/oauth/google/revoke')
                .send({ access_token: 'token' })
                .expect(401);
        });
    });

    describe('Session Retrieval by Session ID', () => {
        it('should retrieve tokens by session ID', async () => {
            const mockTokens = {
                access_token: 'stored_access_token',
                refresh_token: 'stored_refresh_token',
                expires_in: 3600,
                token_type: 'Bearer',
                expiry_date: Date.now() + 3600000
            };

            mockSessionService.getTokens.mockResolvedValue(mockTokens);

            const response = await request(app)
                .get('/oauth/session/session_123')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.access_token).toBe('stored_access_token');
            expect(response.body.message).toBe('Tokens retrieved successfully');
            expect(mockSessionService.getTokens).toHaveBeenCalledWith('session_123');
        });

        it('should return 404 for non-existent session', async () => {
            mockSessionService.getTokens.mockResolvedValue(null);

            const response = await request(app)
                .get('/oauth/session/invalid_session')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(404);

            expect(response.body.message).toContain('Session not found');
        });

        it('should handle retrieval errors', async () => {
            mockSessionService.getTokens.mockRejectedValue(new Error('Redis error'));

            const response = await request(app)
                .get('/oauth/session/session_123')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.message).toBe('Failed to retrieve session');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/oauth/session/session_123')
                .expect(401);
        });
    });

    describe('Session Deletion', () => {
        it('should delete session successfully', async () => {
            mockSessionService.deleteSession.mockResolvedValue(true);

            const response = await request(app)
                .delete('/oauth/session/session_123')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.message).toBe('Session deleted successfully');
            expect(mockSessionService.deleteSession).toHaveBeenCalledWith('session_123');
        });

        it('should handle deletion errors', async () => {
            mockSessionService.deleteSession.mockRejectedValue(new Error('Deletion failed'));

            const response = await request(app)
                .delete('/oauth/session/session_123')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.message).toBe('Failed to delete session');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .delete('/oauth/session/session_123')
                .expect(401);
        });
    });

    describe('Session Retrieval by User and Project', () => {
        it('should retrieve tokens by user ID and project ID', async () => {
            const mockTokens = {
                access_token: 'user_access_token',
                refresh_token: 'user_refresh_token',
                expires_in: 3600,
                token_type: 'Bearer',
                expiry_date: Date.now() + 3600000
            };

            mockSessionService.getTokensByUser.mockResolvedValue(mockTokens);

            const response = await request(app)
                .get('/oauth/session/user/5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.access_token).toBe('user_access_token');
            expect(mockSessionService.getTokensByUser).toHaveBeenCalledWith(1, 5);
        });

        it('should return 404 if no session found for user and project', async () => {
            mockSessionService.getTokensByUser.mockResolvedValue(null);

            const response = await request(app)
                .get('/oauth/session/user/999')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(404);

            expect(response.body.message).toContain('Session not found');
        });

        it('should handle retrieval errors', async () => {
            mockSessionService.getTokensByUser.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/oauth/session/user/5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.message).toBe('Failed to retrieve session');
        });

        it('should parse project ID as integer', async () => {
            mockSessionService.getTokensByUser.mockResolvedValue({
                access_token: 'token',
                refresh_token: 'refresh',
                expires_in: 3600,
                token_type: 'Bearer'
            });

            await request(app)
                .get('/oauth/session/user/42')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockSessionService.getTokensByUser).toHaveBeenCalledWith(1, 42);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/oauth/session/user/5')
                .expect(401);
        });
    });

    describe('Security & Input Validation', () => {
        it('should validate service parameter strictly', async () => {
            const invalidServices = ['', 'facebook', 'twitter', 'analytics; DROP TABLE'];

            for (const service of invalidServices) {
                const response = await request(app)
                    .get(`/oauth/google/auth-url?service=${service}`)
                    .set('Authorization', `Bearer ${validToken}`)
                    .expect(400);
            }
        });

        it('should sanitize session IDs to prevent injection', async () => {
            mockSessionService.getTokens.mockResolvedValue(null);

            const maliciousIds = [
                "'; DROP TABLE sessions;--",
                "../../../etc/passwd",
                "<script>alert('xss')</script>"
            ];

            for (const id of maliciousIds) {
                await request(app)
                    .get(`/oauth/session/${encodeURIComponent(id)}`)
                    .set('Authorization', `Bearer ${validToken}`)
                    .expect(404);

                expect(mockSessionService.getTokens).toHaveBeenCalledWith(id);
            }
        });

        it('should validate numeric project IDs', async () => {
            mockSessionService.getTokensByUser.mockResolvedValue(null);

            await request(app)
                .get('/oauth/session/user/abc')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(404);

            // Should parse 'abc' to NaN which becomes 0 with parseInt
            expect(mockSessionService.getTokensByUser).toHaveBeenCalledWith(1, expect.any(Number));
        });
    });
});
