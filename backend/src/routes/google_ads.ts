import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { GoogleAdsProcessor } from '../processors/GoogleAdsProcessor.js';
import { IGoogleAdsSyncConfig } from '../types/IGoogleAds.js';

const router = express.Router();

/**
 * List accessible Google Ads accounts
 * POST /api/google-ads/accounts
 */
router.post('/accounts', validateJWT, async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Access token is required'
            });
        }
        
        const accounts = await GoogleAdsProcessor.getInstance().listGoogleAdsAccounts(accessToken);
        
        res.json({
            success: true,
            accounts
        });
    } catch (error: any) {
        console.error('Failed to list Google Ads accounts:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list accounts'
        });
    }
});

/**
 * Get available report types
 * GET /api/google-ads/report-types
 */
router.get('/report-types', async (req, res) => {
    try {
        const reportTypes = [
            {
                id: 'campaigns',
                name: 'Campaign Settings',
                description: 'Campaign configuration, channel type, budgets and bidding strategy',
                dimensions: ['Campaign'],
                metrics: ['Budget', 'Target CPA', 'Target ROAS', 'Optimization Score']
            },
            {
                id: 'ad_groups',
                name: 'Ad Groups',
                description: 'Ad group configuration and bids per campaign',
                dimensions: ['Campaign', 'Ad Group'],
                metrics: ['CPC Bid']
            },
            {
                id: 'ads',
                name: 'Ads',
                description: 'Ad-level configuration, headlines, descriptions and final URLs',
                dimensions: ['Campaign', 'Ad Group', 'Ad'],
                metrics: ['Headlines', 'Descriptions', 'Final URLs']
            },
            {
                id: 'insights',
                name: 'Campaign Performance',
                description: 'Daily ad spend, conversions, ROAS and share metrics by campaign',
                dimensions: ['Date', 'Campaign'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'CPM', 'ROAS', 'Impression Share']
            },
            {
                id: 'ad_group_insights',
                name: 'Ad Group Performance',
                description: 'Daily ad spend, conversions and metrics by ad group',
                dimensions: ['Date', 'Campaign', 'Ad Group'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'CPM']
            },
            {
                id: 'demographic_insights',
                name: 'Demographic Performance',
                description: 'Daily performance by age range and gender',
                dimensions: ['Date', 'Campaign', 'Age Range', 'Gender'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'CTR', 'CPC']
            },
            {
                id: 'device_insights',
                name: 'Device Performance',
                description: 'Daily mobile, desktop, tablet breakdown',
                dimensions: ['Date', 'Campaign', 'Device'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'CPM']
            },
            {
                id: 'geographic_insights',
                name: 'Geographic Performance',
                description: 'Daily performance by country, region and city',
                dimensions: ['Date', 'Country', 'Region', 'City'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value']
            },
            {
                id: 'placement_insights',
                name: 'Placement Performance',
                description: 'Daily performance by ad network (Search, Display, YouTube) and slot',
                dimensions: ['Date', 'Campaign', 'Placement', 'Slot'],
                metrics: ['Cost', 'Impressions', 'Clicks', 'Conversions', 'CTR', 'CPC', 'CPM']
            },
            {
                id: 'keyword_insights',
                name: 'Keyword Performance',
                description: 'Daily CPC, quality score and conversions by keyword',
                dimensions: ['Date', 'Campaign', 'Ad Group', 'Keyword', 'Match Type'],
                metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'Quality Score']
            },
            {
                id: 'conversion_actions',
                name: 'Conversion Actions',
                description: 'Conversion actions configuration, attribution and lookback windows',
                dimensions: ['Conversion Action'],
                metrics: ['Category', 'Counting Type', 'Attribution Model', 'Default Value']
            }
        ];
        
        res.json({
            success: true,
            reportTypes
        });
    } catch (error: any) {
        console.error('Failed to get report types:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get report types'
        });
    }
});

/**
 * Add Google Ads data source
 * POST /api/google-ads/add
 */
router.post('/add', validateJWT, async (req, res) => {
    console.log('🔵 [GoogleAds] /add endpoint called');
    
    try {
        const user_id = req.body?.tokenDetails?.user_id;
        
        if (!user_id) {
            console.log('❌ No user_id found in request');
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        const syncConfig: IGoogleAdsSyncConfig = req.body;
        
        // Validate required fields
        if (!syncConfig.name || !syncConfig.customerId || !syncConfig.accessToken || !syncConfig.refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, customerId, accessToken, refreshToken'
            });
        }
        
        const dataSourceId = await GoogleAdsProcessor.getInstance().addGoogleAdsDataSource(
            user_id,
            syncConfig
        );
        
        if (dataSourceId) {
            console.log(`✅ Google Ads data source created with ID: ${dataSourceId}`);
            res.json({
                success: true,
                dataSourceId: dataSourceId,
                message: 'Google Ads data source added successfully'
            });
            
            // Fire-and-forget: trigger initial sync to create tables and populate data
            GoogleAdsProcessor.getInstance().syncGoogleAdsDataSource(dataSourceId, user_id).catch((err: any) => {
                console.error(`[Google Ads] Initial sync failed for data source ${dataSourceId}:`, err);
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to create data source'
            });
        }
    } catch (error: any) {
        console.error('Failed to add Google Ads data source:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add data source'
        });
    }
});

/**
 * Trigger sync for Google Ads data source
 * POST /api/google-ads/sync/:id
 */
router.post('/sync/:id', validateJWT, async (req, res) => {
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
        
        console.log(`[Google Ads Sync] Starting sync for data source ${dataSourceId}`);
        
        const success = await GoogleAdsProcessor.getInstance().syncGoogleAdsDataSource(
            dataSourceId,
            user_id
        );
        
        if (success) {
            console.log(`✅ [Google Ads Sync] Completed successfully for data source ${dataSourceId}`);
            res.json({
                success: true,
                message: 'Sync completed successfully'
            });
        } else {
            throw new Error('Sync failed');
        }
    } catch (error: any) {
        console.error('Failed to sync Google Ads data:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to sync data'
        });
    }
});

/**
 * Get sync status for Google Ads data source
 * GET /api/google-ads/status/:id
 */
router.get('/status/:id', validateJWT, async (req, res) => {
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
        
        const { lastSyncTime, syncHistory } = await GoogleAdsProcessor.getInstance().getGoogleAdsSyncStatus(dataSourceId);
        
        res.json({
            success: true,
            lastSyncTime,
            syncHistory
        });
    } catch (error: any) {
        console.error('Failed to get sync status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get sync status'
        });
    }
});

export default router;
