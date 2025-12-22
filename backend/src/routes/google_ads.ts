import express from 'express';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { GoogleAdsService } from '../services/GoogleAdsService.js';
import { GoogleAdsDriver } from '../drivers/GoogleAdsDriver.js';
import { IGoogleAdsSyncConfig } from '../types/IGoogleAds.js';

const router = express.Router();

/**
 * List accessible Google Ads accounts
 * POST /api/google-ads/accounts
 */
router.post('/accounts', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Access token is required'
            });
        }
        
        const adsService = GoogleAdsService.getInstance();
        const accounts = await adsService.listAccounts(accessToken);
        
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
                id: 'campaign',
                name: 'Campaign Performance',
                description: 'Ad spend, conversions, and ROAS by campaign',
                dimensions: ['Date', 'Campaign'],
                metrics: ['Cost', 'Conversions', 'Conversion Value', 'ROAS', 'CTR', 'CPC', 'CPM']
            },
            {
                id: 'keyword',
                name: 'Keyword Performance',
                description: 'CPC, quality score, and conversions by keyword',
                dimensions: ['Date', 'Campaign', 'Ad Group', 'Keyword', 'Match Type'],
                metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'CTR', 'CPC', 'Quality Score']
            },
            {
                id: 'geographic',
                name: 'Geographic Performance',
                description: 'Performance by country, region, city',
                dimensions: ['Date', 'Country', 'Region', 'City'],
                metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'Conversion Value']
            },
            {
                id: 'device',
                name: 'Device Performance',
                description: 'Mobile, desktop, tablet breakdown',
                dimensions: ['Date', 'Device'],
                metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'Conversion Value', 'CTR', 'CPC']
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
router.post('/add', async (req, res) => {
    try {
        const user_id = (req as any).user?.id;
        
        if (!user_id) {
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
        
        const dataSourceId = await DataSourceProcessor.getInstance().addGoogleAdsDataSource(
            user_id,
            syncConfig
        );
        
        res.json({
            success: true,
            dataSourceId
        });
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
router.post('/sync/:id', async (req, res) => {
    try {
        const user_id = (req as any).user?.id;
        
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
        
        const success = await DataSourceProcessor.getInstance().syncGoogleAdsDataSource(
            dataSourceId,
            user_id
        );
        
        res.json({
            success,
            message: success ? 'Sync completed successfully' : 'Sync failed'
        });
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
router.get('/status/:id', async (req, res) => {
    try {
        const user_id = (req as any).user?.id;
        
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
        
        const adsDriver = GoogleAdsDriver.getInstance();
        const history = await adsDriver.getSyncHistory(dataSourceId, 10);
        
        const lastSync = history[0];
        const status = {
            lastSyncTime: lastSync?.completed_at || null,
            status: lastSync?.status || 'IDLE',
            recordsSynced: lastSync?.records_synced || 0,
            recordsFailed: lastSync?.records_failed || 0,
            error: lastSync?.error_message || undefined
        };
        
        res.json({
            success: true,
            status,
            history
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
