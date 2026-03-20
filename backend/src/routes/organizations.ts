import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, query, matchedData } from 'express-validator';
import { OrganizationProcessor } from '../processors/OrganizationProcessor.js';
import { EOrganizationRole } from '../services/OrganizationService.js';
import { organizationContext, requireOrganizationRole } from '../middleware/organizationContext.js';

const router = express.Router();
const processor = OrganizationProcessor.getInstance();

/**
 * POST /organizations
 * Create a new organization
 * 
 * Body:
 * - name: string (required)
 * - domain: string (optional)
 * - logoUrl: string (optional)
 * - subscriptionTierId: number (optional, defaults to FREE tier)
 */
router.post(
    '/',
    validateJWT,
    validate([
        body('name').notEmpty().trim().withMessage('Organization name is required'),
        body('domain').optional().trim().isURL({ require_protocol: false }),
        body('logoUrl').optional().trim().isURL(),
        body('subscriptionTierId').optional().isInt().withMessage('Subscription tier ID must be an integer')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { name, domain, logoUrl, subscriptionTierId } = matchedData(req);

            const organization = await processor.createOrganization({
                name,
                domain,
                logoUrl,
                subscriptionTierId: subscriptionTierId ? parseInt(subscriptionTierId) : undefined,
                tokenDetails: req.body.tokenDetails
            });

            if (organization) {
                res.status(201).json({
                    success: true,
                    message: 'Organization created successfully',
                    data: organization
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to create organization'
                });
            }
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /organizations
 * Get all organizations for the authenticated user
 */
router.get(
    '/',
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const organizations = await processor.getUserOrganizations(req.body.tokenDetails);

            res.status(200).json({
                success: true,
                data: organizations
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /organizations/:id
 * Get organization by ID with full details
 * User must be a member of the organization
 */
router.get(
    '/:id',
    validateJWT,
    validate([param('id').notEmpty().isInt().withMessage('Organization ID must be an integer')]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const organization = await processor.getOrganizationById(
                parseInt(id),
                req.body.tokenDetails
            );

            if (organization) {
                res.status(200).json({
                    success: true,
                    data: organization
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Organization not found or access denied'
                });
            }
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /organizations/:id/usage
 * Get organization usage statistics (member count, limits)
 * User must be a member of the organization
 */
router.get(
    '/:id/usage',
    validateJWT,
    organizationContext,
    validate([param('id').notEmpty().isInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const usage = await processor.getOrganizationUsage(parseInt(id));

            res.status(200).json({
                success: true,
                data: usage
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /organizations/:id/members
 * Get all members of an organization
 * User must be a member of the organization
 */
router.get(
    '/:id/members',
    validateJWT,
    organizationContext,
    validate([param('id').notEmpty().isInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const members = await processor.getOrganizationMembers(
                parseInt(id),
                req.body.tokenDetails
            );

            // Format member data for frontend
            const formattedMembers = members.map(member => ({
                id: member.id,
                users_platform_id: member.users_platform_id,
                role: member.role,
                joined_at: member.joined_at,
                is_active: member.is_active,
                user_email: member.user.email,
                user_name: `${member.user.first_name} ${member.user.last_name}`
            }));

            res.status(200).json({
                success: true,
                members: formattedMembers
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * POST /organizations/:id/members
 * Add a member to an organization
 * Requires ADMIN or OWNER role
 * 
 * Body:
 * - userId: number (required)
 * - role: 'owner' | 'admin' | 'member' (required)
 */
router.post(
    '/:id/members',
    validateJWT,
    organizationContext,
    requireOrganizationRole(EOrganizationRole.ADMIN),
    validate([
        param('id').notEmpty().isInt(),
        body('userId').notEmpty().isInt().withMessage('User ID is required'),
        body('role')
            .notEmpty()
            .isIn(['owner', 'admin', 'member'])
            .withMessage('Role must be owner, admin, or member')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, userId, role } = matchedData(req);

            const member = await processor.addMemberById(
                parseInt(id),
                parseInt(userId),
                role as EOrganizationRole,
                req.body.tokenDetails.user_id
            );

            res.status(201).json({
                success: true,
                message: 'Member added successfully',
                data: member
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * DELETE /organizations/:id/members/:userId
 * Remove a member from an organization
 * Requires ADMIN or OWNER role
 * Cannot remove the last owner
 */
router.delete(
    '/:id/members/:userId',
    validateJWT,
    organizationContext,
    requireOrganizationRole(EOrganizationRole.ADMIN),
    validate([
        param('id').notEmpty().isInt(),
        param('userId').notEmpty().isInt().withMessage('User ID is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, userId } = matchedData(req);

            await processor.removeMember(
                parseInt(id),
                parseInt(userId),
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                message: 'Member removed successfully'
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * PUT /organizations/:id/members/:userId/role
 * Update a member's role
 * Requires OWNER role (only owners can change roles)
 * Cannot demote the last owner
 * 
 * Body:
 * - newRole: 'owner' | 'admin' | 'member' (required)
 */
router.put(
    '/:id/members/:userId/role',
    validateJWT,
    organizationContext,
    requireOrganizationRole(EOrganizationRole.OWNER),
    validate([
        param('id').notEmpty().isInt(),
        param('userId').notEmpty().isInt(),
        body('newRole')
            .notEmpty()
            .isIn(['owner', 'admin', 'member'])
            .withMessage('Role must be owner, admin, or member')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, userId, newRole } = matchedData(req);

            const member = await processor.updateMemberRole(
                {
                    organizationId: parseInt(id),
                    userId: parseInt(userId),
                    newRole: newRole as EOrganizationRole
                },
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                message: 'Member role updated successfully',
                data: member
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /organizations/:id/workspaces
 * Get all workspaces for an organization
 * User must be a member of the organization
 */
router.get(
    '/:id/workspaces',
    validateJWT,
    organizationContext,
    validate([param('id').notEmpty().isInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);

            const workspaces = await processor.getOrganizationWorkspaces(
                parseInt(id),
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                data: workspaces
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * PUT /organizations/:id
 * Update organization details
 * Requires OWNER or ADMIN role
 * 
 * Body:
 * - name: string (optional)
 * - domain: string (optional)
 * - logoUrl: string (optional)
 */
router.put(
    '/:id',
    validateJWT,
    organizationContext,
    requireOrganizationRole(EOrganizationRole.ADMIN),
    validate([
        param('id').notEmpty().isInt(),
        body('name').optional().trim(),
        body('domain').optional().trim().isURL({ require_protocol: false }),
        body('logoUrl').optional().trim().isURL()
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, name, domain, logoUrl } = matchedData(req);

            const organization = await processor.updateOrganization({
                organizationId: parseInt(id),
                name,
                domain,
                logoUrl
            });

            res.status(200).json({
                success: true,
                message: 'Organization updated successfully',
                data: organization
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * DELETE /organizations/:id
 * Delete an organization
 * Requires OWNER role
 * Will cascade delete all workspaces and related data
 * 
 * Body:
 * - confirmName: string (required, must match organization name)
 */
router.delete(
    '/:id',
    validateJWT,
    organizationContext,
    requireOrganizationRole(EOrganizationRole.OWNER),
    validate([
        param('id').notEmpty().isInt(),
        body('confirmName').notEmpty().withMessage('Organization name confirmation is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, confirmName } = matchedData(req);

            await processor.deleteOrganization(
                parseInt(id),
                confirmName,
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                message: 'Organization deleted successfully'
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

export default router;
