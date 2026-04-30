import express, { Request, Response } from 'express';
import { body, matchedData, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { validateJWT } from '../middleware/authenticate.js';
import { SSOProcessor } from '../processors/SSOProcessor.js';
import { SSOService } from '../services/SSOService.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
const processor = SSOProcessor.getInstance();
const ssoService = SSOService.getInstance();

router.get(
    '/login',
    validate([query('email').isEmail().withMessage('A valid email is required')]),
    async (req: Request, res: Response) => {
        try {
            const { email } = matchedData(req);
            const result = await processor.initiateLogin(email);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: 'No SSO configuration found for this email domain.'
                });
            }

            res.status(200).json({
                success: true,
                redirectUrl: result.redirectUrl,
                relayState: result.relayState
            });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/callback',
    authLimiter,
    validate([
        body('SAMLResponse').notEmpty().withMessage('SAMLResponse is required'),
        body('RelayState').notEmpty().withMessage('RelayState is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { SAMLResponse, RelayState } = matchedData(req);
            const result = await processor.processSamlCallback(SAMLResponse, RelayState);
            const frontendUrl = ssoService.getFrontendUrl();

            const redirectUrl = `${frontendUrl}/sso/callback?token=${encodeURIComponent(result.token)}&organizationId=${result.organizationId}`;
            res.redirect(redirectUrl);
        } catch (error: any) {
            const frontendUrl = ssoService.getFrontendUrl();
            const redirectUrl = `${frontendUrl}/sso/callback?error=${encodeURIComponent(error.message || 'SSO callback failed')}`;
            res.redirect(redirectUrl);
        }
    }
);

/**
 * GET /auth/saml/logout?organizationId=
 * Initiates IdP-side Single Logout for the authenticated user.
 */
router.get(
    '/logout',
    validateJWT,
    validate([query('organizationId').isInt({ min: 1 }).withMessage('organizationId is required')]),
    async (req: Request, res: Response) => {
        try {
            const { organizationId } = matchedData(req);
            const result = await processor.initiateLogout((req as any).tokenDetails, Number(organizationId));

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: 'No active SSO session found for this organization.'
                });
            }

            // If the caller is a browser redirect, redirect to IdP logout; otherwise return the URL.
            const acceptsHtml = req.accepts('html');
            if (acceptsHtml) {
                return res.redirect(result.logoutUrl);
            }
            res.status(200).json({ success: true, logoutUrl: result.logoutUrl });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

/**
 * POST /auth/saml/logout/callback  (IdP-initiated SLO callback)
 * The IdP sends a LogoutRequest/LogoutResponse here after processing the logout.
 * We simply invalidate any local session and redirect to the login page.
 */
router.post(
    '/logout/callback',
    async (_req: Request, res: Response) => {
        const frontendUrl = ssoService.getFrontendUrl();
        // Local JWT sessions are stateless so there's nothing to invalidate server-side.
        // The frontend handles token removal in the /sso/callback page.
        res.redirect(`${frontendUrl}/login?sso_logout=1`);
    }
);

export default router;