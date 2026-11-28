import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { GA4OverviewService } from '../services/GA4OverviewService.js';
import { GA4DatePreset } from '../services/GA4DateRangeService.js';

const router = Router();

router.use(validateJWT);

/**
 * GET /ga4/overview/:projectId?preset=&startDate=&endDate=
 * Prebuilt GA4 overview — KPIs and chart-ready series. Reads the GA4 Data API
 * aggregate tables (no BigQuery layer required).
 */
router.get('/overview/:projectId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            res.status(400).json({ success: false, message: 'Invalid projectId' });
            return;
        }
        const preset = (req.query.preset as GA4DatePreset) || 'last_90_days';
        const startDate = req.query.startDate as string | undefined;
        const endDate = req.query.endDate as string | undefined;
        const rawSource = req.query.dataSourceId as string | undefined;
        const dataSourceId = rawSource != null ? parseInt(rawSource, 10) : undefined;
        if (rawSource != null && isNaN(dataSourceId as number)) {
            res.status(400).json({ success: false, message: 'Invalid dataSourceId' });
            return;
        }
        // Defaults on: the acquisition page shows engaged traffic unless the
        // caller explicitly opts out for raw GA4 parity.
        const rawExclude = req.query.engagedTrafficOnly as string | undefined;
        const engagedTrafficOnly = rawExclude === undefined ? true : rawExclude !== 'false';

        res.json({
            success: true,
            data: await GA4OverviewService.getInstance().getOverviewForPreset(
                projectId,
                preset,
                startDate,
                endDate,
                dataSourceId,
                engagedTrafficOnly,
            ),
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Failed to load GA4 overview', error: error.message });
    }
});

export default router;
