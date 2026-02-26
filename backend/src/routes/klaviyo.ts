import express from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProductionAccess } from '../middleware/requiresProductionAccess.js';
import { KlaviyoProcessor } from '../processors/KlaviyoProcessor.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /klaviyo/validate
// Validate a Klaviyo private API key before saving the data source.
// Body: { api_key }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/validate', validateJWT, async (req, res) => {
    try {
        const { api_key } = req.body;

        if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
            return res.status(400).json({ success: false, error: 'api_key is required' });
        }

        const valid = await KlaviyoProcessor.getInstance().validateApiKey(api_key.trim());

        if (valid) {
            res.json({ success: true, message: 'Klaviyo API key is valid' });
        } else {
            res.status(401).json({ success: false, error: 'Invalid Klaviyo API key' });
        }
    } catch (error: any) {
        console.error('[Klaviyo] Validation error:', error);
        res.status(500).json({ success: false, error: error.message || 'API key validation failed' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /klaviyo/add
// Create a new Klaviyo Email Marketing data source and trigger initial sync.
// Body: { name, api_key, projectId }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/add', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const userId: number = req.body?.tokenDetails?.user_id;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { name, api_key, projectId } = req.body;

        if (!name || !api_key || !projectId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, api_key, projectId',
            });
        }

        // Validate key before persisting
        const valid = await KlaviyoProcessor.getInstance().validateApiKey(api_key.trim());
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Invalid Klaviyo API key' });
        }

        console.log(`[Klaviyo] Adding data source: ${name}`);

        const dataSourceId = await KlaviyoProcessor.getInstance().addDataSource(
            name,
            api_key.trim(),
            Number(projectId),
            req.body.tokenDetails
        );

        if (!dataSourceId) {
            throw new Error('Failed to create Klaviyo data source');
        }

        console.log(`✅ [Klaviyo] Data source created with ID: ${dataSourceId}`);
        res.json({
            success: true,
            dataSourceId,
            message: 'Klaviyo Email Marketing data source added successfully',
        });

        // Fire-and-forget initial sync
        KlaviyoProcessor.getInstance()
            .syncDataSource(dataSourceId, userId)
            .catch((err: any) => {
                console.error(`[Klaviyo] Initial sync failed for data source ${dataSourceId}:`, err);
            });
    } catch (error: any) {
        console.error('[Klaviyo] Failed to add data source:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to add data source' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /klaviyo/sync/:id
// Manually trigger a sync for an existing Klaviyo data source.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync/:id', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const userId: number = req.body?.tokenDetails?.user_id;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const dataSourceId = parseInt(req.params.id);
        if (isNaN(dataSourceId)) {
            return res.status(400).json({ success: false, error: 'Invalid data source ID' });
        }

        console.log(`[Klaviyo] Starting sync for data source ${dataSourceId}`);
        const success = await KlaviyoProcessor.getInstance().syncDataSource(dataSourceId, userId);

        if (success) {
            res.json({ success: true, message: 'Klaviyo sync completed successfully' });
        } else {
            throw new Error('Sync failed');
        }
    } catch (error: any) {
        console.error('[Klaviyo] Sync error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to sync data source' });
    }
});

export default router;
