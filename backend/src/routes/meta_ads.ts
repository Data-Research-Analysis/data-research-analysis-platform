import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProductionAccess } from '../middleware/requiresProductionAccess.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { MetaAdsService } from '../services/MetaAdsService.js';
import { MetaOAuthService } from '../services/MetaOAuthService.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { IMetaSyncConfig } from '../types/IMetaAds.js';

const router = express.Router();

/**
 * Initiate OAuth flow
 * GET /api/meta-ads/connect
 */
router.get('/connect', validateJWT, async (req, res) => {
    try {
        const state = req.query.state as string || Math.random().toString(36).substring(7);
        
        const metaOAuthService = MetaOAuthService.getInstance();
        const authUrl = metaOAuthService.getAuthorizationURL(state);
        
        res.json({
            success: true,
            authUrl: authUrl,
            state: state,
        });
    } catch (error: any) {
        console.error('Failed to generate Meta OAuth URL:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate OAuth URL'
        });
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
        
        const metaOAuthService = MetaOAuthService.getInstance();
        
        // Exchange code for short-lived token
        const shortLivedToken = await metaOAuthService.exchangeCodeForToken(code);
        
        // Exchange for long-lived token (60 days)
        const longLivedToken = await metaOAuthService.getLongLivedToken(shortLivedToken.access_token);
        
        // Validate the token
        const tokenInfo = await metaOAuthService.validateToken(longLivedToken.access_token);
        
        console.log('✅ [Meta Ads] Token exchange completed successfully');
        
        res.json({
            success: true,
            access_token: longLivedToken.access_token,
            token_type: longLivedToken.token_type,
            expires_in: longLivedToken.expires_in,
            token_info: tokenInfo,
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
        
        const metaAdsService = MetaAdsService.getInstance();
        const accounts = await metaAdsService.listAdAccounts(accessToken);
        
        // Filter to only active accounts
        const activeAccounts = accounts.filter(account => account.account_status === 1);
        
        console.log(`✅ Found ${activeAccounts.length} active ad accounts`);
        
        res.json({
            success: true,
            accounts: activeAccounts,
        });
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
        
        const syncConfig: IMetaSyncConfig = req.body.syncConfig;
        
        if (!syncConfig || !syncConfig.name || !syncConfig.adAccountId || !syncConfig.accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, adAccountId, accessToken'
            });
        }
        
        console.log('[Meta Ads] Adding data source:', syncConfig.name);
        
        // Calculate token expiry (long-lived tokens expire in ~60 days)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 60);
        
        // Prepare API connection details
        const apiConnectionDetails: IAPIConnectionDetails = {
            oauth_access_token: syncConfig.accessToken,
            oauth_refresh_token: '', // Meta doesn't use refresh tokens for long-lived tokens
            token_expiry: expiryDate,
            api_config: {
                ad_account_id: syncConfig.adAccountId,
                report_types: syncConfig.syncTypes || ['campaigns', 'adsets', 'ads', 'insights'],
                start_date: syncConfig.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: syncConfig.endDate || new Date().toISOString().split('T')[0],
            }
        };
        
        const dataSourceId = await DataSourceProcessor.getInstance().addMetaAdsDataSource(
            syncConfig.name,
            apiConnectionDetails,
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
            DataSourceProcessor.getInstance().syncMetaAdsDataSource(dataSourceId, user_id).catch((err: any) => {
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
        
        const success = await DataSourceProcessor.getInstance().syncMetaAdsDataSource(
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
        
        const { MetaAdsDriver } = await import('../drivers/MetaAdsDriver.js');
        const driver = MetaAdsDriver.getInstance();
        
        const lastSyncTime = await driver.getLastSyncTime(dataSourceId);
        const syncHistory = await driver.getSyncHistory(dataSourceId, 10);
        
        res.json({
            success: true,
            lastSyncTime: lastSyncTime,
            syncHistory: syncHistory,
        });
    } catch (error: any) {
        console.error('Failed to get Meta Ads sync status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get sync status'
        });
    }
});

export default router;
