import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { OrganizationProcessor } from '../processors/OrganizationProcessor.js';
import { EWorkspaceRole } from '../services/WorkspaceService.js';
import { organizationContext } from '../middleware/organizationContext.js';

const router = express.Router();
const processor = OrganizationProcessor.getInstance();

/**
 * POST /workspaces
 * Create a new workspace within an organization
 * User must be a member of the organization
 * 
 * Body:
 * - organizationId: number (required)
 * - name: string (required)
 * - slug: string (required, unique within organization)
 * - description: string (optional)
 */
router.post(
    '/',
    validateJWT,
    organizationContext,
    validate([
        body('organizationId').notEmpty().isInt().withMessage('Organization ID is required'),
        body('name').notEmpty().trim().withMessage('Workspace name is required'),
        body('slug')
            .notEmpty()
            .trim()
            .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .withMessage('Slug must be lowercase alphanumeric with hyphens'),
        body('description').optional().trim()
    ]),
    async (req: Request, res: Response) => {
        try {
            const { organizationId, name, slug, description } = matchedData(req);

            const workspace = await processor.createWorkspace({
                organizationId: parseInt(organizationId),
                name,
                slug,
                description,
                tokenDetails: req.body.tokenDetails
            });

            res.status(201).json({
                success: true,
                message: 'Workspace created successfully',
                data: workspace
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
 * GET /workspaces/:id
 * Get workspace by ID with full details
 * User must be a member of the workspace
 */
router.get(
    '/:id',
    validateJWT,
    validate([param('id').notEmpty().isInt().withMessage('Workspace ID must be an integer')]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const workspace = await processor.getWorkspaceById(
                parseInt(id),
                req.body.tokenDetails
            );

            if (workspace) {
                res.status(200).json({
                    success: true,
                    data: workspace
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Workspace not found or access denied'
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
 * GET /workspaces/:id/projects
 * Get all projects in a workspace
 * User must be a workspace member
 */
router.get(
    '/:id/projects',
    validateJWT,
    validate([param('id').notEmpty().isInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);

            const projects = await processor.getWorkspaceProjects(
                parseInt(id),
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                data: projects
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
 * POST /workspaces/:id/members
 * Add a member to a workspace
 * User must already be an organization member
 * Requires workspace ADMIN role
 * 
 * Body:
 * - userId: number (required)
 * - role: 'admin' | 'editor' | 'viewer' (required)
 */
router.post(
    '/:id/members',
    validateJWT,
    validate([
        param('id').notEmpty().isInt(),
        body('userId').notEmpty().isInt().withMessage('User ID is required'),
        body('role')
            .notEmpty()
            .isIn(['admin', 'editor', 'viewer'])
            .withMessage('Role must be admin, editor, or viewer')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, userId, role } = matchedData(req);

            const member = await processor.addWorkspaceMember({
                workspaceId: parseInt(id),
                userId: parseInt(userId),
                role: role as EWorkspaceRole,
                tokenDetails: req.body.tokenDetails
            });

            res.status(201).json({
                success: true,
                message: 'Workspace member added successfully',
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
 * DELETE /workspaces/:id/members/:userId
 * Remove a member from a workspace
 * Requires workspace ADMIN role
 * Cannot remove the last admin
 */
router.delete(
    '/:id/members/:userId',
    validateJWT,
    validate([
        param('id').notEmpty().isInt(),
        param('userId').notEmpty().isInt().withMessage('User ID is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, userId } = matchedData(req);

            await processor.removeWorkspaceMember(
                parseInt(id),
                parseInt(userId),
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                message: 'Workspace member removed successfully'
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
 * PUT /workspaces/:id/members/:userId/role
 * Update a workspace member's role
 * Requires workspace ADMIN role
 * Cannot demote the last admin
 * 
 * Body:
 * - newRole: 'admin' | 'editor' | 'viewer' (required)
 */
router.put(
    '/:id/members/:userId/role',
    validateJWT,
    validate([
        param('id').notEmpty().isInt(),
        param('userId').notEmpty().isInt(),
        body('newRole')
            .notEmpty()
            .isIn(['admin', 'editor', 'viewer'])
            .withMessage('Role must be admin, editor, or viewer')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, userId, newRole } = matchedData(req);

            const member = await processor.updateWorkspaceMemberRole(
                parseInt(id),
                parseInt(userId),
                newRole as EWorkspaceRole,
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                message: 'Workspace member role updated successfully',
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
 * PUT /workspaces/:id
 * Update workspace details
 * Requires workspace ADMIN role
 * 
 * Body:
 * - name: string (optional)
 * - slug: string (optional, unique within organization)
 * - description: string (optional)
 */
router.put(
    '/:id',
    validateJWT,
    validate([
        param('id').notEmpty().isInt(),
        body('name').optional().trim(),
        body('slug')
            .optional()
            .trim()
            .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .withMessage('Slug must be lowercase alphanumeric with hyphens'),
        body('description').optional().trim()
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, name, slug, description } = matchedData(req);

            const workspace = await processor.updateWorkspace(
                parseInt(id),
                { name, slug, description },
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                message: 'Workspace updated successfully',
                data: workspace
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
 * DELETE /workspaces/:id
 * Delete a workspace
 * Requires workspace ADMIN role
 * Will cascade delete all projects and related data
 * 
 * Body:
 * - confirmName: string (required, must match workspace name)
 */
router.delete(
    '/:id',
    validateJWT,
    validate([
        param('id').notEmpty().isInt(),
        body('confirmName').notEmpty().withMessage('Workspace name confirmation is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, confirmName } = matchedData(req);

            await processor.deleteWorkspace(
                parseInt(id),
                confirmName,
                req.body.tokenDetails
            );

            res.status(200).json({
                success: true,
                message: 'Workspace deleted successfully'
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
