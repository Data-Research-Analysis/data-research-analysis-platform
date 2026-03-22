import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
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
                createdAt: org.created_at,
                members: org.members || [],
                memberCount: org.members?.length || 0,
                workspaceCount: org.workspaces?.length || 0,
                subscription: org.subscription ? {
                    id: org.subscription.id,
                    tier: org.subscription.subscription_tier?.tier_name || 'free',
                    maxMembers: org.subscription.max_members,
                    maxProjects: org.subscription.subscription_tier?.max_projects || null,
                    maxDataSourcesPerProject: org.subscription.subscription_tier?.max_data_sources_per_project || null,
                    maxDashboards: org.subscription.subscription_tier?.max_dashboards || null,
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

export default router;
