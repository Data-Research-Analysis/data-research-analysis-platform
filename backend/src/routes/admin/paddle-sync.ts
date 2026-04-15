import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';
import { PaddleService } from '../../services/PaddleService.js';
import { PaddleSyncService } from '../../services/PaddleSyncService.js';

const router = express.Router();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

/**
 * POST /admin/paddle/sync
 * Sync products/prices (→ tiers) and discounts (→ promo codes) from Paddle dashboard.
 * Admin-only. Manual trigger — no scheduled execution.
 */
router.post('/sync', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        console.log('[PaddleSyncRoute] Manual Paddle sync triggered by admin');
        const paddleService = PaddleService.getInstance();
        const paddle = paddleService.getPaddleClient();
        const results = await PaddleSyncService.getInstance().sync(paddle);
        res.json({ success: true, data: results });
    } catch (error: any) {
        console.error('[PaddleSyncRoute] Sync failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
