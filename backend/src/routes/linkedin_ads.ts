import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProductionAccess } from '../middleware/requiresProductionAccess.js';
import { LinkedInAdsProcessor } from '../processors/LinkedInAdsProcessor.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /linkedin-ads/connect
// Generate LinkedIn OAuth authorization URL.
// Client redirects the user to this URL to start the OAuth flow.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/connect', validateJWT, async (req, res) => {
    try {
        const state = req.query.state as string || Math.random().toString(36).substring(7);
        const result = await LinkedInAdsProcessor.getInstance().getLinkedInOAuthUrl(state);

        if (!result.configured) {
            return res.status(500).json({
                success: false,
                error: 'LinkedIn OAuth is not configured on this server. Please contact the administrator.',
            });
        }

        console.log('[LinkedIn Ads] Generated authorization URL');
        res.json({ success: true, authUrl: result.authUrl, state });
    } catch (error: any) {
        console.error('[LinkedIn Ads] Failed to generate OAuth URL:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to generate OAuth URL' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /linkedin-ads/callback
// Handles the OAuth redirect from LinkedIn.
// Exchanges the authorization code for tokens, then redirects to the frontend
// with the token data so the user can pick their ad account.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
    try {
        const code = req.query.code as string;
        const state = req.query.state as string;
        const error = req.query.error as string;

        const frontendUrl = process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';

        // LinkedIn sends error= if the user denied access
        if (error) {
            console.error('[LinkedIn Ads] OAuth error from LinkedIn:', error);
            return res.redirect(`${frontendUrl}/oauth/error?error=${encodeURIComponent(error)}`);
        }

        if (!code) {
            return res.redirect(`${frontendUrl}/oauth/error?error=missing_code`);
        }

        console.log('[LinkedIn Ads] OAuth callback received');
        console.log('   - Code:', code.substring(0, 20) + '...');
        console.log('   - State:', state);

        const tokens = await LinkedInAdsProcessor.getInstance().exchangeLinkedInCode(code);

        console.log('✅ [LinkedIn Ads] Token exchange completed successfully');

        // Redirect to the frontend connect page with token data encoded as query params.
        // Using base64 so the token doesn't appear naked in URLs.
        const tokenPayload = Buffer.from(
            JSON.stringify({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || '',
                expires_at: tokens.expires_at,
                scope: tokens.scope,
                state: state || '',
            })
        ).toString('base64url');

        return res.redirect(
            `${frontendUrl}/connect/linkedin-ads?tokens=${tokenPayload}&state=${state || ''}`
        );
    } catch (error: any) {
        console.error('[LinkedIn Ads] Failed to handle OAuth callback:', error);
        const frontendUrl = process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
        return res.redirect(
            `${frontendUrl}/oauth/error?error=${encodeURIComponent(error.message || 'callback_failed')}`
        );
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /linkedin-ads/accounts
// List all accessible LinkedIn ad accounts for the given access token.
// Caller provides access_token in the request body.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/accounts', validateJWT, async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'accessToken is required',
            });
        }

        console.log('[LinkedIn Ads] Listing ad accounts');

        const accounts = await LinkedInAdsProcessor.getInstance().listLinkedInAdsAccounts(accessToken);

        // Separate live vs test accounts — in LinkedIn's Development Tier only
        // test accounts are available. We include both so the setup wizard works
        // during development/sandbox. Test accounts are labelled in the response.
        const liveAccounts = accounts.filter(a => !a.test);
        const testAccounts = accounts.filter(a => a.test);

        // Return live accounts when available, otherwise fall back to test accounts
        // so developers can complete the OAuth wizard before production approval.
        const returnedAccounts = liveAccounts.length > 0 ? liveAccounts : testAccounts;

        console.log(
            `✅ [LinkedIn Ads] Found ${liveAccounts.length} live account(s) and ` +
            `${testAccounts.length} test account(s). Returning ${returnedAccounts.length}.`
        );

        res.json({
            success: true,
            accounts: returnedAccounts,
            total: returnedAccounts.length,
            hasTestAccounts: testAccounts.length > 0 && liveAccounts.length === 0,
        });
    } catch (error: any) {
        console.error('[LinkedIn Ads] Failed to list ad accounts:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list ad accounts',
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /linkedin-ads/add
// Create a new LinkedIn Ads data source and trigger initial sync.
// Body: { name, accessToken, refreshToken, expiresAt, adAccountId, adAccountName,
//         projectId, startDate?, endDate? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/add', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const userId = req.body?.tokenDetails?.user_id;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const {
            name,
            accessToken,
            refreshToken,
            expiresAt,
            adAccountId,
            adAccountName,
            projectId,
            startDate,
            endDate,
        } = req.body;

        if (!name || !accessToken || !adAccountId || !projectId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, accessToken, adAccountId, projectId',
            });
        }

        console.log(`[LinkedIn Ads] Adding data source: ${name}`);

        const tokenExpiresAt = expiresAt ? Number(expiresAt) : Date.now() + 60 * 24 * 60 * 60 * 1000;
        const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const dataSourceId = await LinkedInAdsProcessor.getInstance().addLinkedInAdsDataSourceFromParams(
            name,
            accessToken,
            refreshToken || '',
            tokenExpiresAt,
            Number(adAccountId),
            adAccountName || '',
            projectId,
            startDate || defaultStart,
            endDate || new Date().toISOString().split('T')[0],
            req.body.tokenDetails
        );

        if (!dataSourceId) {
            throw new Error('Failed to create LinkedIn Ads data source');
        }

        console.log(`✅ [LinkedIn Ads] Data source created with ID: ${dataSourceId}`);

        res.json({
            success: true,
            dataSourceId,
            message: 'LinkedIn Ads data source added successfully',
        });

        // Fire-and-forget: kick off initial sync in the background
        LinkedInAdsProcessor.getInstance()
            .syncLinkedInAdsDataSource(dataSourceId, userId)
            .catch((err: any) => {
                console.error(`[LinkedIn Ads] Initial sync failed for data source ${dataSourceId}:`, err);
            });
    } catch (error: any) {
        console.error('[LinkedIn Ads] Failed to add data source:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add data source',
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /linkedin-ads/sync/:id
// Trigger a manual sync for an existing LinkedIn Ads data source.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync/:id', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const userId = req.body?.tokenDetails?.user_id;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dataSourceId = parseInt(req.params.id);

        if (isNaN(dataSourceId)) {
            return res.status(400).json({ success: false, error: 'Invalid data source ID' });
        }

        console.log(`[LinkedIn Ads Sync] Starting sync for data source ${dataSourceId}`);

        const success = await LinkedInAdsProcessor.getInstance().syncLinkedInAdsDataSource(
            dataSourceId,
            userId
        );

        if (success) {
            console.log(`✅ [LinkedIn Ads Sync] Completed for data source ${dataSourceId}`);
            res.json({ success: true, message: 'Sync completed successfully' });
        } else {
            throw new Error('Sync failed');
        }
    } catch (error: any) {
        console.error('[LinkedIn Ads] Failed to sync data source:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to sync data source',
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /linkedin-ads/sync-status/:id
// Return the last sync time and recent history for a LinkedIn Ads data source.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sync-status/:id', validateJWT, async (req, res) => {
    try {
        const userId = req.body?.tokenDetails?.user_id;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dataSourceId = parseInt(req.params.id);

        if (isNaN(dataSourceId)) {
            return res.status(400).json({ success: false, error: 'Invalid data source ID' });
        }

        const { lastSyncTime, syncHistory } = await LinkedInAdsProcessor.getInstance().getLinkedInAdsSyncStatus(dataSourceId);

        res.json({ success: true, lastSyncTime, syncHistory });
    } catch (error: any) {
        console.error('[LinkedIn Ads] Failed to get sync status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get sync status',
        });
    }
});

export default router;
