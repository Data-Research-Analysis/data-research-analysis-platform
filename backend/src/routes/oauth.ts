import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, query, matchedData } from 'express-validator';
import { GoogleOAuthService } from '../services/GoogleOAuthService.js';
import { GoogleAnalyticsService } from '../services/GoogleAnalyticsService.js';
import { OAuthSessionService } from '../services/OAuthSessionService.js';

const router = express.Router();

/**
 * Generate Google OAuth authorization URL
 * GET /api/oauth/google/auth-url?service=analytics
 */
router.get('/google/auth-url', 
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        query('service').isIn(['analytics', 'ad_manager', 'google_ads']).withMessage('Service must be analytics, ad_manager, or google_ads'),
        query('project_id').optional().isString()
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const service = data.service;
            const projectId = data.project_id;
            const oauthService = GoogleOAuthService.getInstance();
            
            if (!oauthService.isConfigured()) {
                return res.status(500).send({
                    message: 'Google OAuth not configured. Please contact administrator.'
                });
            }
            
            // Get appropriate scopes based on service
            let scopes: string[] = [];
            if (service === 'analytics') {
                scopes = GoogleOAuthService.getGoogleAnalyticsScopes();
            } else if (service === 'ad_manager') {
                scopes = GoogleOAuthService.getGoogleAdManagerScopes();
            } else if (service === 'google_ads') {
                scopes = GoogleOAuthService.getGoogleAdsScopes();
            }
            
            // Generate state parameter for CSRF protection
            const state = Buffer.from(JSON.stringify({
                user_id: req.body.tokenDetails.user_id,
                service: service,
                project_id: projectId,
                timestamp: Date.now()
            })).toString('base64');
            
            const authUrl = oauthService.generateAuthUrl(scopes, state);
            
            res.status(200).send({
                auth_url: authUrl,
                message: 'Authorization URL generated successfully'
            });
        } catch (error) {
            console.error('Error generating OAuth URL:', error);
            res.status(500).send({
                message: 'Failed to generate authorization URL'
            });
        }
    }
);

/**
 * Handle Google OAuth callback (GET)
 * This receives the redirect from Google after user authorizes
 * GET /api/oauth/google/callback?code=xxx&state=xxx
 */
router.get('/google/callback',
    validate([
        query('code').notEmpty().withMessage('Authorization code is required'),
        query('state').optional(),
        query('error').optional()
    ]),
    async (req: Request, res: Response) => {
        try {
            const { code, state, error } = req.query;
            
            // Handle OAuth errors
            if (error) {
                console.error('OAuth error from Google:', error);
                const frontendUrl = process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
                return res.redirect(`${frontendUrl}/oauth/error?error=${error}`);
            }
            
            // Redirect to frontend with code and state
            // Frontend will handle token exchange
            const frontendUrl = process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
            const redirectUrl = `${frontendUrl}/oauth/google/callback?code=${code}&state=${state || ''}`;
            
            console.log('✅ Redirecting to frontend with auth code');
            res.redirect(redirectUrl);
        } catch (error) {
            console.error('Error in OAuth GET callback:', error);
            const frontendUrl = process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/oauth/error?error=callback_failed`);
        }
    }
);

/**
 * Handle Google OAuth callback (POST)
 * Frontend uses this to exchange code for tokens
 * POST /api/oauth/google/callback
 */
router.post('/google/callback',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        body('code').notEmpty().withMessage('Authorization code is required'),
        body('state').optional()
    ]),
    async (req: Request, res: Response) => {
        try {
            const { code, state } = matchedData(req);
            const oauthService = GoogleOAuthService.getInstance();
            
            // Validate state parameter
            if (state) {
                try {
                    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
                    if (stateData.user_id !== req.body.tokenDetails.user_id) {
                        return res.status(400).send({
                            message: 'Invalid state parameter'
                        });
                    }
                } catch (error) {
                    return res.status(400).send({
                        message: 'Invalid state parameter'
                    });
                }
            }
            
            // Exchange code for tokens
            const tokens = await oauthService.exchangeCodeForTokens(code);
            
            // Store tokens securely in Redis
            const oauthSessionService = OAuthSessionService.getInstance();
            const projectId = state ? JSON.parse(Buffer.from(state, 'base64').toString()).project_id : 0;
            const sessionId = await oauthSessionService.storeTokens(
                req.body.tokenDetails.user_id,
                parseInt(projectId) || 0,
                tokens
            );
            
            res.status(200).send({
                session_id: sessionId,
                expires_in: tokens.expires_in,
                token_type: tokens.token_type,
                message: 'Authentication successful'
            });
        } catch (error) {
            console.error('Error in OAuth callback:', error);
            res.status(500).send({
                message: 'Failed to complete authentication'
            });
        }
    }
);

/**
 * Refresh access token
 * POST /api/oauth/google/refresh
 */
router.post('/google/refresh',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        body('refresh_token').notEmpty().withMessage('Refresh token is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { refresh_token } = matchedData(req);
            const oauthService = GoogleOAuthService.getInstance();
            
            const tokens = await oauthService.refreshAccessToken(refresh_token);
            
            res.status(200).send({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expires_in,
                token_type: tokens.token_type,
                expiry_date: tokens.expiry_date,
                message: 'Token refreshed successfully'
            });
        } catch (error) {
            console.error('Error refreshing token:', error);
            res.status(401).send({
                message: 'Failed to refresh token. Please re-authenticate.'
            });
        }
    }
);

/**
 * Revoke OAuth token
 * POST /api/oauth/google/revoke
 */
router.post('/google/revoke',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        body('access_token').notEmpty().withMessage('Access token is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { access_token } = matchedData(req);
            const oauthService = GoogleOAuthService.getInstance();
            
            const revoked = await oauthService.revokeToken(access_token);
            
            if (revoked) {
                res.status(200).send({
                    message: 'Token revoked successfully'
                });
            } else {
                res.status(500).send({
                    message: 'Failed to revoke token'
                });
            }
        } catch (error) {
            console.error('Error revoking token:', error);
            res.status(500).send({
                message: 'Failed to revoke token'
            });
        }
    }
);

/**
 * Get OAuth tokens from session
 * GET /api/oauth/session/:sessionId
 */
router.get('/session/:sessionId',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const { sessionId } = req.params;
            const oauthSessionService = OAuthSessionService.getInstance();
            
            const tokens = await oauthSessionService.getTokens(sessionId);
            
            if (!tokens) {
                return res.status(404).send({
                    message: 'Session not found or expired'
                });
            }
            
            res.status(200).send({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expires_in,
                token_type: tokens.token_type,
                expiry_date: tokens.expiry_date,
                message: 'Tokens retrieved successfully'
            });
        } catch (error) {
            console.error('Error retrieving OAuth session:', error);
            res.status(500).send({
                message: 'Failed to retrieve session'
            });
        }
    }
);

/**
 * Delete OAuth session
 * DELETE /api/oauth/session/:sessionId
 */
router.delete('/session/:sessionId',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const { sessionId } = req.params;
            const oauthSessionService = OAuthSessionService.getInstance();
            
            await oauthSessionService.deleteSession(sessionId);
            
            res.status(200).send({
                message: 'Session deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting OAuth session:', error);
            res.status(500).send({
                message: 'Failed to delete session'
            });
        }
    }
);

/**
 * Get OAuth tokens by user and project
 * GET /api/oauth/session/user/:projectId
 */
router.get('/session/user/:projectId',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const { projectId } = req.params;
            const userId = req.body.tokenDetails.user_id;
            const oauthSessionService = OAuthSessionService.getInstance();
            
            const tokens = await oauthSessionService.getTokensByUser(userId, parseInt(projectId));
            
            if (!tokens) {
                return res.status(404).send({
                    message: 'Session not found or expired'
                });
            }
            
            res.status(200).send({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expires_in,
                token_type: tokens.token_type,
                expiry_date: tokens.expiry_date,
                message: 'Tokens retrieved successfully'
            });
        } catch (error) {
            console.error('Error retrieving OAuth session by user:', error);
            res.status(500).send({
                message: 'Failed to retrieve session'
            });
        }
    }
);

export default router;
