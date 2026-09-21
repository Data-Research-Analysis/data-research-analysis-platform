/**
 * Campaign Targets Routes
 *
 * REST endpoints for CMO/manager-defined campaign and ad set / ad group
 * targets (north-star metrics) used to track actual performance.
 *
 * Endpoints:
 *   GET    /campaign-targets        - List targets for a project (optionally scoped)
 *   PUT    /campaign-targets        - Create/update the target for one entity
 *   POST   /campaign-targets/copy   - Copy one entity's targets onto other entities
 *   DELETE /campaign-targets/:id    - Delete a target
 *
 * Reads require project membership; writes require the cmo or manager role.
 */

import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProjectRole } from '../middleware/requiresProjectRole.js';
import { CampaignTargetsController } from '../controllers/CampaignTargetsController.js';

const router = Router();

router.use(validateJWT);

router.get(
    '/',
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    CampaignTargetsController.list,
);

router.put(
    '/',
    requiresProjectRole(['manager', 'cmo']),
    CampaignTargetsController.upsert,
);

router.post(
    '/copy',
    requiresProjectRole(['manager', 'cmo']),
    CampaignTargetsController.copy,
);

router.delete(
    '/:id',
    requiresProjectRole(['manager', 'cmo']),
    CampaignTargetsController.remove,
);

export default router;
