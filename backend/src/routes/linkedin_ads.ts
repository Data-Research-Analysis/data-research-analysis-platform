import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProductionAccess } from '../middleware/requiresProductionAccess.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { LinkedInAdsService } from '../services/LinkedInAdsService.js';
import { LinkedInOAuthService } from '../services/LinkedInOAuthService.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /linkedin-ads/connect
// Generate LinkedIn OAuth authorization URL.
// Client redirects the user to this URL to start the OAuth flow.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/connect', validateJWT, async (req, res) => {
    try {
        const oauthService = LinkedInOAuthService.getInstance();

        if (!oauthService.isConfigured()) {
            return res.status(500).json({
                success: false,
                error: 'LinkedIn OAuth is not configured on this server. Please contact the administrator.',
            });
        }

        const state = req.query.state as string || Math.random().toString(36).substring(7);
        const authUrl = oauthService.generateAuthorizationUrl(state);

        console.log('[LinkedIn Ads] Generated authorization URL');

        res.json({
            success: true,
            authUrl,
            state,
        });
    } catch (error: any) {
        console.error('[LinkedIn Ads] Failed to generate OAuth URL:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate OAuth URL',
        });
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

        const oauthService = LinkedInOAuthService.getInstance();
        const tokens = await oauthService.exchangeCodeForToken(code);

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

        const service = LinkedInAdsService.getInstance();
        const accounts = await service.listAdAccounts(accessToken);

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

        // Build IAPIConnectionDetails from request values
        const tokenExpiresAt = expiresAt ? Number(expiresAt) : Date.now() + 60 * 24 * 60 * 60 * 1000; // 60 days default

        const apiConnectionDetails: IAPIConnectionDetails = {
            oauth_access_token: accessToken,
            oauth_refresh_token: refreshToken || '',
            token_expiry: new Date(tokenExpiresAt),
            api_config: {
                linkedin_ads_account_id: Number(adAccountId),
                linkedin_ads_account_name: adAccountName || '',
                linkedin_ads_token_expires_at: tokenExpiresAt,
                linkedin_ads_refresh_token: refreshToken || '',
                start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: endDate || new Date().toISOString().split('T')[0],
            },
        };

        const dataSourceId = await DataSourceProcessor.getInstance().addLinkedInAdsDataSource(
            name,
            apiConnectionDetails,
            req.body.tokenDetails,
            projectId
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
        DataSourceProcessor.getInstance()
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

        const success = await DataSourceProcessor.getInstance().syncLinkedInAdsDataSource(
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

        const { LinkedInAdsDriver } = await import('../drivers/LinkedInAdsDriver.js');
        const driver = LinkedInAdsDriver.getInstance();

        const lastSyncTime = await driver.getLastSyncTime(dataSourceId);
        const syncHistory = await driver.getSyncHistory(dataSourceId, 10);

        res.json({
            success: true,
            lastSyncTime,
            syncHistory,
        });
    } catch (error: any) {
        console.error('[LinkedIn Ads] Failed to get sync status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get sync status',
        });
    }
});

export default router;
