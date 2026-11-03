import express, { Request, Response } from 'express';
import { body, param, matchedData } from 'express-validator';
import { validateJWT } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validator.js';
import { OrganizationProcessor } from '../../processors/OrganizationProcessor.js';
import { EUserType } from '../../types/EUserType.js';

const router = express.Router();
const processor = OrganizationProcessor.getInstance();

// Middleware to check if user is admin
async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    console.log('Checking admin access for user type:', tokenDetails?.user_type);
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).send({ message: 'Admin access required' });
    }
    next();
}

/**
 * GET /admin/organizations
 * Get all organizations in the system (admin only)
 * 
 * Returns:
 * - Organizations with member counts, workspace counts, subscription details
 */
router.get(
    '/',
    validateJWT,
    requireAdmin,
    async (req: Request, res: Response) => {
        try {
            const organizations = await processor.getAllOrganizations(req.body.tokenDetails);
            
            // Enrich with computed fields for admin view
            const enrichedOrgs = organizations.map(org => ({
                id: org.id,
                name: org.name,
                domain: org.domain,
                logoUrl: org.logo_url,
                isActive: org.is_active,
                createdAt: org.created_at,
                members: org.members || [],
                memberCount: org.members?.length || 0,
                workspaceCount: org.workspaces?.length || 0,
                subscription: org.subscription ? {
                    id: org.subscription.id,
                    tier: org.subscription.subscription_tier?.tier_name || 'free',
                } : null,
                settings: org.settings
            }));

            res.status(200).json({
                success: true,
                data: enrichedOrgs
            });
        } catch (error: any) {
            console.error('[Admin Organizations] Error fetching organizations:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * PATCH /admin/organizations/:id/active
 * Activate or deactivate an organization (admin only)
 *
 * Body:
 * - isActive: boolean (required)
 */
router.patch(
    '/:id/active',
    validateJWT,
    requireAdmin,
    validate([
        param('id').notEmpty().isInt().withMessage('Organization ID must be an integer'),
        body('isActive').isBoolean().withMessage('isActive must be a boolean').toBoolean()
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, isActive } = matchedData(req);

            const organization = await processor.setOrganizationActive(
                parseInt(id),
                isActive,
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                message: `Organization ${isActive ? 'activated' : 'deactivated'} successfully`,
                data: organization
            });
        } catch (error: any) {
            console.error('[Admin Organizations] Error updating organization status:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

export default router;
