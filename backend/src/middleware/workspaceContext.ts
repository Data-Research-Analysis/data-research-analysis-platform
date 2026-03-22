import { WorkspaceService, EWorkspaceRole } from '../services/WorkspaceService.js';
import { Request, Response, NextFunction } from 'express';
import type { IOrganizationContextRequest } from './organizationContext.js';

/**
 * Extended Express Request with workspace context
 */
export interface IWorkspaceContextRequest extends IOrganizationContextRequest {
    workspaceId?: number;
    workspaceRole?: EWorkspaceRole;
}

/**
 * Middleware: workspaceContext
 * 
 * Extracts and validates workspace context for requests.
 * User must be a member of the specified workspace.
 * Must be used AFTER organizationContext middleware.
 * 
 * **Workspace ID Sources** (checked in order):
 * 1. `X-Workspace-Id` header (preferred)
 * 2. `req.query.workspaceId` (GET requests)
 * 3. `req.body.workspaceId` (POST/PUT requests)
 * 
 * **Flow**:
 * 1. Extract workspaceId from request
 * 2. Validate workspace belongs to organization (from organizationContext)
 * 3. Validate user is an active member of the workspace
 * 4. Set `req.workspaceId` and `req.workspaceRole` for downstream use
 * 5. Call next() or return 403 if unauthorized
 * 
 * **Usage**: Apply AFTER `validateJWT` and `organizationContext`
 * 
 * @example
 * ```typescript
 * router.post('/projects', validateJWT, organizationContext, workspaceContext, async (req, res) => {
 *     const workspaceId = req.workspaceId; // Already validated
 *     const role = req.workspaceRole; // User's role in workspace
 *     // ... create project in workspace
 * });
 * ```
 * 
 * **Error Responses**:
 * - 400: Missing workspace ID or organizationContext not run first
 * - 403: User not a member of workspace, workspace doesn't belong to org
 * - 404: Workspace not found
 * - 500: Service error
 */
export async function workspaceContext(
    req: IWorkspaceContextRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Validate organizationContext ran first
        if (!req.organizationId) {
            res.status(400).json({
                success: false,
                error: 'Organization context required. Use organizationContext middleware before workspaceContext.'
            });
            return;
        }

        // Extract user ID from token (set by validateJWT middleware)
        const userId = req.tokenDetails?.user_id || req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: 'Authentication required.'
            });
            return;
        }

        // Extract workspace ID from request (header preferred, then query, then body)
        let workspaceId: number | undefined;

        // 1. Check X-Workspace-Id header (recommended approach)
        const headerWorkspaceId = req.headers['x-workspace-id'] as string;
        if (headerWorkspaceId) {
            workspaceId = parseInt(headerWorkspaceId, 10);
        }

        // 2. Check query parameter (GET requests)
        if (!workspaceId && req.query.workspaceId) {
            workspaceId = parseInt(String(req.query.workspaceId), 10);
        }

        // 3. Check body parameter (POST/PUT requests)
        if (!workspaceId && req.body?.workspaceId) {
            workspaceId = parseInt(String(req.body.workspaceId), 10);
        }

        // Validate workspace ID was provided
        if (!workspaceId || isNaN(workspaceId)) {
            res.status(400).json({
                success: false,
                error: 'Workspace ID is required. Provide via X-Workspace-Id header, query param, or request body.'
            });
            return;
        }

        // Get workspace and validate it belongs to organization
        const workspaceService = WorkspaceService.getInstance();
        const workspace = await workspaceService.getWorkspaceById(workspaceId);
        
        if (!workspace) {
            res.status(404).json({
                success: false,
                error: `Workspace ID ${workspaceId} not found.`
            });
            return;
        }

        if (workspace.organization_id !== req.organizationId) {
            res.status(403).json({
                success: false,
                error: `Workspace ${workspaceId} does not belong to organization ${req.organizationId}.`
            });
            return;
        }

        // Check if user is workspace member
        const isMember = await workspaceService.isUserMember(userId, workspaceId);
        if (!isMember) {
            res.status(403).json({
                success: false,
                error: `You do not have access to workspace ID ${workspaceId}.`
            });
            return;
        }

        // Get user's role in workspace
        const role = await workspaceService.getUserRole(userId, workspaceId);
        if (!role) {
            res.status(403).json({
                success: false,
                error: `Unable to determine your role in workspace ID ${workspaceId}.`
            });
            return;
        }

        // Set workspace context on request for downstream handlers
        req.workspaceId = workspaceId;
        req.workspaceRole = role;

        next();
    } catch (error: any) {
        console.error('[workspaceContext] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate workspace context',
            details: error.message
        });
    }
}

/**
 * Middleware: optionalWorkspaceContext
 * 
 * Same as workspaceContext but doesn't fail if no workspace ID provided.
 * Useful for endpoints that can work with or without workspace scope.
 * 
 * If workspace ID is provided, validates it. If not provided or invalid, continues without setting context.
 * 
 * @example
 * ```typescript
 * router.get('/projects', validateJWT, optionalOrganizationContext, optionalWorkspaceContext, async (req, res) => {
 *     // req.workspaceId may or may not be set
 *     if (req.workspaceId) {
 *         // Filter by workspace
 *     } else {
 *         // Return all user's projects
 *     }
 * });
 * ```
 */
export async function optionalWorkspaceContext(
    req: IWorkspaceContextRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Extract workspace ID (same logic as required version)
        let workspaceId: number | undefined;

        const headerWorkspaceId = req.headers['x-workspace-id'] as string;
        if (headerWorkspaceId) {
            workspaceId = parseInt(headerWorkspaceId, 10);
        }

        if (!workspaceId && req.query.workspaceId) {
            workspaceId = parseInt(String(req.query.workspaceId), 10);
        }

        if (!workspaceId && req.body?.workspaceId) {
            workspaceId = parseInt(String(req.body.workspaceId), 10);
        }

        // If no workspace ID provided, skip validation (optional)
        if (!workspaceId || isNaN(workspaceId)) {
            next();
            return;
        }

        // If provided, validate it
        const userId = req.tokenDetails?.user_id || req.user?.id;
        if (!userId) {
            next();
            return;
        }

        const workspaceService = WorkspaceService.getInstance();
        const workspace = await workspaceService.getWorkspaceById(workspaceId);
        
        // If workspace not found or doesn't belong to org, silently skip
        if (!workspace || (req.organizationId && workspace.organization_id !== req.organizationId)) {
            next();
            return;
        }

        // Validate user is member
        const isMember = await workspaceService.isUserMember(userId, workspaceId);
        if (!isMember) {
            next();
            return;
        }

        // Get role
        const role = await workspaceService.getUserRole(userId, workspaceId);
        
        // Set context if all validations passed
        req.workspaceId = workspaceId;
        req.workspaceRole = role || undefined;

        next();
    } catch (error: any) {
        console.error('[optionalWorkspaceContext] Error:', error);
        // Don't fail the request on error in optional middleware
        next();
    }
}

/**
 * Middleware: requireWorkspaceRole
 * 
 * Enforces minimum workspace role requirement.
 * Must be used AFTER workspaceContext middleware.
 * 
 * **Role Hierarchy** (most → least privileged):
 * ADMIN > EDITOR > VIEWER
 * 
 * @param minimumRole - Minimum role required to proceed
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * // Only ADMIN can add workspace members
 * router.post('/workspaces/:id/members',
 *     validateJWT,
 *     organizationContext,
 *     workspaceContext,
 *     requireWorkspaceRole(EWorkspaceRole.ADMIN),
 *     async (req, res) => { ... }
 * );
 * 
 * // ADMIN and EDITOR can create projects
 * router.post('/projects',
 *     validateJWT,
 *     organizationContext,
 *     workspaceContext,
 *     requireWorkspaceRole(EWorkspaceRole.EDITOR),
 *     async (req, res) => { ... }
 * );
 * ```
 */
export function requireWorkspaceRole(minimumRole: EWorkspaceRole) {
    const roleHierarchy = {
        [EWorkspaceRole.ADMIN]: 3,
        [EWorkspaceRole.EDITOR]: 2,
        [EWorkspaceRole.VIEWER]: 1
    };

    return (req: IWorkspaceContextRequest, res: Response, next: NextFunction): void => {
        if (!req.workspaceId || !req.workspaceRole) {
            res.status(400).json({
                success: false,
                error: 'Workspace context not set. Use workspaceContext middleware first.'
            });
            return;
        }

        const userRoleLevel = roleHierarchy[req.workspaceRole];
        const requiredRoleLevel = roleHierarchy[minimumRole];

        if (userRoleLevel < requiredRoleLevel) {
            res.status(403).json({
                success: false,
                error: `Insufficient permissions. ${minimumRole} role required, you have ${req.workspaceRole}.`
            });
            return;
        }

        next();
    };
}
