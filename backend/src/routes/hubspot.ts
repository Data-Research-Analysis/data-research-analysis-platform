import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProductionAccess } from '../middleware/requiresProductionAccess.js';
import { HubSpotProcessor } from '../processors/HubSpotProcessor.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /hubspot/connect
// Generate HubSpot OAuth authorization URL.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/connect', validateJWT, (req, res) => {
    try {
        const state = (req.query.state as string) || Math.random().toString(36).substring(7);
        const result = HubSpotProcessor.getInstance().getOAuthUrl(state);

        if (!result.configured) {
            return res.status(500).json({
                success: false,
                error: 'HubSpot OAuth is not configured on this server. Please contact the administrator.',
            });
        }

        console.log('[HubSpot] Generated authorization URL');
        res.json({ success: true, authUrl: result.authUrl, state });
    } catch (error: any) {
        console.error('[HubSpot] Failed to generate OAuth URL:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to generate OAuth URL' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /hubspot/callback
// OAuth redirect from HubSpot — exchanges code for tokens, then redirects to
// the frontend connect page with token data.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';

    try {
        const code = req.query.code as string;
        const state = req.query.state as string;
        const error = req.query.error as string;

        if (error) {
            console.error('[HubSpot] OAuth error from HubSpot:', error);
            return res.redirect(`${frontendUrl}/oauth/error?error=${encodeURIComponent(error)}`);
        }

        if (!code) {
            return res.redirect(`${frontendUrl}/oauth/error?error=missing_code`);
        }

        console.log('[HubSpot] OAuth callback received');
        const tokens = await HubSpotProcessor.getInstance().exchangeCode(code);
        console.log('✅ [HubSpot] Token exchange completed');

        const tokenPayload = Buffer.from(
            JSON.stringify({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expires_at,
                portal_id: tokens.portal_id ?? '',
                state: state || '',
            })
        ).toString('base64url');

        return res.redirect(
            `${frontendUrl}/connect/hubspot?tokens=${tokenPayload}&state=${state || ''}`
        );
    } catch (error: any) {
        console.error('[HubSpot] Failed to handle OAuth callback:', error);
        return res.redirect(
            `${frontendUrl}/oauth/error?error=${encodeURIComponent(error.message || 'callback_failed')}`
        );
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /hubspot/add
// Create a new HubSpot CRM data source and trigger initial sync.
// Body: { name, accessToken, refreshToken, expiresAt, portalId, projectId }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/add', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const userId: number = req.body?.tokenDetails?.user_id;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { name, accessToken, refreshToken, expiresAt, portalId, projectId } = req.body;

        if (!name || !accessToken || !projectId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, accessToken, projectId',
            });
        }

        console.log(`[HubSpot] Adding data source: ${name}`);

        const tokenExpiresAt = expiresAt ? Number(expiresAt) : Date.now() + 30 * 60 * 1000;

        const dataSourceId = await HubSpotProcessor.getInstance().addDataSource(
            name,
            accessToken,
            refreshToken || '',
            tokenExpiresAt,
            portalId || '',
            Number(projectId),
            req.body.tokenDetails
        );

        if (!dataSourceId) {
            throw new Error('Failed to create HubSpot data source');
        }

        console.log(`✅ [HubSpot] Data source created with ID: ${dataSourceId}`);
        res.json({ success: true, dataSourceId, message: 'HubSpot CRM data source added successfully' });

        // Fire-and-forget initial sync
        HubSpotProcessor.getInstance()
            .syncDataSource(dataSourceId, userId)
            .catch((err: any) => {
                console.error(`[HubSpot] Initial sync failed for data source ${dataSourceId}:`, err);
            });
    } catch (error: any) {
        console.error('[HubSpot] Failed to add data source:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to add data source' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /hubspot/sync/:id
// Manually trigger a sync for an existing HubSpot data source.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync/:id', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const userId: number = req.body?.tokenDetails?.user_id;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const dataSourceId = parseInt(req.params.id);
        if (isNaN(dataSourceId)) {
            return res.status(400).json({ success: false, error: 'Invalid data source ID' });
        }

        console.log(`[HubSpot] Starting sync for data source ${dataSourceId}`);
        const success = await HubSpotProcessor.getInstance().syncDataSource(dataSourceId, userId);

        if (success) {
            res.json({ success: true, message: 'HubSpot sync completed successfully' });
        } else {
            throw new Error('Sync failed');
        }
    } catch (error: any) {
        console.error('[HubSpot] Sync error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to sync data source' });
    }
});

export default router;
