import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { FunnelController } from '../controllers/FunnelController.js';

const router = Router();

router.use(validateJWT);

/**
 * POST /funnels
 * Create a new funnel definition.
 * Body: { project_id, name, steps: [{ name, order, match_type, conditions: [{ field, operator, value }] }] }
 */
router.post('/', FunnelController.create);

/**
 * GET /funnels?projectId=X
 * List all funnels for a project.
 */
router.get('/', FunnelController.list);

/**
 * GET /funnels/attribution-summary?projectId=X&startDate=Y&endDate=Z
 * Multi-model channel credit comparison (all 6 models at once).
 * Must be before /:id routes to avoid Express matching "attribution-summary" as :id.
 */
router.get('/attribution-summary', FunnelController.attributionSummary);

/**
 * GET /funnels/:id
 * Get a single funnel by ID.
 */
router.get('/:id', FunnelController.getById);

/**
 * PUT /funnels/:id
 * Update a funnel definition.
 * Body: { name?, steps? }
 */
router.put('/:id', FunnelController.update);

/**
 * DELETE /funnels/:id
 * Delete a funnel and its analysis results.
 */
router.delete('/:id', FunnelController.delete);

/**
 * POST /funnels/preview-stage
 * Preview an estimated match count for a stage definition.
 * Body: { project_id, stage: { conditions, matchType } }
 */
router.post('/preview-stage', FunnelController.previewStageMatch);

/**
 * GET /funnels/:id/analysis?startDate=X&endDate=Y
 * Run funnel analysis (match events to steps).
 */
router.get('/:id/analysis', FunnelController.analyze);

/**
 * GET /funnels/:id/attribution?model=X&startDate=Y&endDate=Z&source=ad_platforms
 * Run attribution models against funnel-matched events.
 * model: first_touch | last_touch | linear | time_decay | u_shaped | data_driven
 * source (optional): 'ad_platforms' to query ad platform tables instead of dra_attribution_events
 */
router.get('/:id/attribution', FunnelController.funnelAttribution);

/**
 * GET /funnels/attribution-summary?projectId=X&startDate=Y&endDate=Z&source=ad_platforms
 * Multi-model channel credit comparison (all 6 models at once).
 * source (optional): 'ad_platforms' to query ad platform tables instead of dra_attribution_touchpoints
 */
router.get('/attribution-summary', FunnelController.attributionSummary);

export default router;
