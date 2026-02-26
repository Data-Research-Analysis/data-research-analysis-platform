import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProductionAccess } from '../middleware/requiresProductionAccess.js';
import { MetaAdsProcessor } from '../processors/MetaAdsProcessor.js';

const router = express.Router();

/**
 * Initiate OAuth flow
 * GET /api/meta-ads/connect
 */
router.get('/connect', validateJWT, async (req, res) => {
    try {
        const state = req.query.state as string || Math.random().toString(36).substring(7);
        const authUrl = await MetaAdsProcessor.getInstance().getMetaOAuthUrl(state);
        res.json({ success: true, authUrl, state });
    } catch (error: any) {
        console.error('Failed to generate Meta OAuth URL:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to generate OAuth URL' });
    }
});

/**
 * OAuth callback handler
 * GET /api/meta-ads/callback
 */
router.get('/callback', async (req, res) => {
    try {
        const code = req.query.code as string;
        const state = req.query.state as string;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'Authorization code not provided'
            });
        }
        
        console.log('[Meta Ads] OAuth callback received');
        console.log('   - Code:', code.substring(0, 20) + '...');
        console.log('   - State:', state);

        const result = await MetaAdsProcessor.getInstance().exchangeMetaCode(code);
        console.log('✅ [Meta Ads] Token exchange completed successfully');

        res.json({
            success: true,
            access_token: result.access_token,
            token_type: result.token_type,
            expires_in: result.expires_in,
            token_info: result.token_info,
        });
    } catch (error: any) {
        console.error('Failed to handle Meta OAuth callback:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to exchange authorization code'
        });
    }
});

/**
 * List ad accounts
 * POST /api/meta-ads/accounts
 */
router.post('/accounts', validateJWT, async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Access token required'
            });
        }
        
        console.log('[Meta Ads] Listing ad accounts');
        const accounts = await MetaAdsProcessor.getInstance().listMetaAdsAccounts(accessToken);
        console.log(`✅ Found ${accounts.length} active ad accounts`);
        res.json({ success: true, accounts });
    } catch (error: any) {
        console.error('Failed to list Meta ad accounts:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list ad accounts'
        });
    }
});

/**
 * Add Meta Ads data source
 * POST /api/meta-ads/add
 */
router.post('/add', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const user_id = req.body?.tokenDetails?.user_id;
        
        if (!user_id) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        const syncConfig = req.body.syncConfig as any;
        
        if (!syncConfig || !syncConfig.name || !syncConfig.adAccountId || !syncConfig.accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, adAccountId, accessToken'
            });
        }
        
        console.log('[Meta Ads] Adding data source:', syncConfig.name);

        const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const dataSourceId = await MetaAdsProcessor.getInstance().addMetaAdsDataSourceFromParams(
            syncConfig.name,
            syncConfig.accessToken,
            syncConfig.adAccountId,
            syncConfig.syncTypes || ['campaigns', 'adsets', 'ads', 'insights'],
            syncConfig.startDate || defaultStart,
            syncConfig.endDate || new Date().toISOString().split('T')[0],
            req.body.tokenDetails,
            req.body.projectId
        );
        
        if (dataSourceId) {
            console.log(`✅ Meta Ads data source created with ID: ${dataSourceId}`);
            res.json({
                success: true,
                dataSourceId: dataSourceId,
                message: 'Meta Ads data source added successfully'
            });
            
            // Fire-and-forget: trigger initial sync to create tables and populate data
            MetaAdsProcessor.getInstance().syncMetaAdsDataSource(dataSourceId, user_id).catch((err: any) => {
                console.error(`[Meta Ads] Initial sync failed for data source ${dataSourceId}:`, err);
            });
        } else {
            throw new Error('Failed to create data source');
        }
    } catch (error: any) {
        console.error('Failed to add Meta Ads data source:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add data source'
        });
    }
});

/**
 * Trigger sync for Meta Ads data source
 * POST /api/meta-ads/sync/:id
 */
router.post('/sync/:id', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const user_id = req.body?.tokenDetails?.user_id;
        
        if (!user_id) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        const dataSourceId = parseInt(req.params.id);
        
        if (isNaN(dataSourceId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid data source ID'
            });
        }
        
        console.log(`[Meta Ads Sync] Starting sync for data source ${dataSourceId}`);
        
        const success = await MetaAdsProcessor.getInstance().syncMetaAdsDataSource(
            dataSourceId,
            user_id
        );
        
        if (success) {
            console.log(`✅ [Meta Ads Sync] Completed successfully for data source ${dataSourceId}`);
            res.json({
                success: true,
                message: 'Sync completed successfully'
            });
        } else {
            throw new Error('Sync failed');
        }
    } catch (error: any) {
        console.error('Failed to sync Meta Ads data source:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to sync data source'
        });
    }
});

/**
 * Get sync status for Meta Ads data source
 * GET /api/meta-ads/sync-status/:id
 */
router.get('/sync-status/:id', validateJWT, async (req, res) => {
    try {
        const user_id = req.body?.tokenDetails?.user_id;
        
        if (!user_id) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        const dataSourceId = parseInt(req.params.id);
        
        if (isNaN(dataSourceId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid data source ID'
            });
        }
        
        const { lastSyncTime, syncHistory } = await MetaAdsProcessor.getInstance().getMetaAdsSyncStatus(dataSourceId);
        res.json({ success: true, lastSyncTime, syncHistory });
    } catch (error: any) {
        console.error('Failed to get Meta Ads sync status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get sync status'
        });
    }
});

export default router;
