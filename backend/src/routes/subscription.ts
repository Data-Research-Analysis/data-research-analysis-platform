import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { RowLimitService } from '../services/RowLimitService.js';
import { TierEnforcementService } from '../services/TierEnforcementService.js';

const router = express.Router();

// Get current user's subscription and usage stats
router.get('/current', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    try {
        const { user_id } = req.body.tokenDetails;
        const rowLimitService = RowLimitService.getInstance();
        
        const stats = await rowLimitService.getUsageStats(user_id);
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch subscription details'
        });
    }
});

// Get enhanced usage stats with tier enforcement flags
router.get('/usage', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    try {
        const { user_id } = req.body.tokenDetails;
        const tierService = TierEnforcementService.getInstance();
        
        const stats = await tierService.getUsageStats(user_id);
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('Error fetching usage stats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch usage statistics'
        });
    }
});

export default router;
