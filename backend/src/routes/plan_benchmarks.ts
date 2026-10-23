import { Router, Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { PlanBenchmarkService } from '../services/PlanBenchmarkService.js';
import { EUserType } from '../types/EUserType.js';

const router = Router();

router.get(
    '/',
    validateJWT,
    async (req: any, res: any) => {
        try {
            const benchmarks = await PlanBenchmarkService.getInstance().list({
                industry: req.query.industry ? String(req.query.industry) : undefined,
                market: req.query.market ? String(req.query.market) : undefined,
                platform: req.query.platform ? String(req.query.platform) : undefined,
                source: req.query.source ? String(req.query.source) : undefined,
            });
            res.status(200).json({ success: true, data: benchmarks });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message ?? 'Failed to load benchmarks' });
        }
    }
);

router.post(
    '/recompute',
    validateJWT,
    async (req: any, res: any) => {
        const tokenDetails = req.tokenDetails ?? (req as any).tokenDetails;
        if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }
        try {
            const written = await PlanBenchmarkService.getInstance().recompute();
            res.status(200).json({ success: true, data: { written } });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message ?? 'Recompute failed' });
        }
    }
);

export default router;
