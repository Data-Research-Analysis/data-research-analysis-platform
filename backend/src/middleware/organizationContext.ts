import { OrganizationService, EOrganizationRole } from '../services/OrganizationService.js';
import { Request, Response, NextFunction } from 'express';

/**
 * Extended Express Request with organization context
 */
export interface IOrganizationContextRequest extends Request {
    organizationId?: number;
    organizationRole?: EOrganizationRole;
    user?: {
        id: number;
        email: string;
        user_type: string;
    };
    tokenDetails?: {
        user_id: number;
        email: string;
        user_type: string;
    };
}

/**
 * Middleware: organizationContext
 * 
 * Extracts and validates organization context for requests.
 * User must be a member of the specified organization.
 * 
 * **Organization ID Sources** (checked in order):
 * 1. `X-Organization-Id` header (preferred for all requests)
 * 2. `req.query.organizationId` (GET requests)
 * 3. `req.body.organizationId` (POST/PUT requests)
 * 
 * **Flow**:
 * 1. Extract organizationId from request
 * 2. Validate user is an active member of the organization
 * 3. Set `req.organizationId` and `req.organizationRole` for downstream use
 * 4. Call next() or return 403 if unauthorized
 * 
 * **Usage**: Apply AFTER `validateJWT` so `req.tokenDetails` is populated
 * 
 * @example
 * ```typescript
 * router.get('/projects', validateJWT, organizationContext, async (req, res) => {
 *     const orgId = req.organizationId; // Already validated
 *     const role = req.organizationRole; // User's role in org
 *     // ... fetch projects for organization
 * });
 * ```
 * 
 * **Error Responses**:
 * - 400: Missing organization ID
 * - 403: User not a member of organization
 * - 500: Service error
 */
export async function organizationContext(
    req: IOrganizationContextRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Extract user ID from token (set by validateJWT middleware)
        const userId = req.tokenDetails?.user_id || req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: 'Authentication required. Use validateJWT middleware before organizationContext.'
            });
            return;
        }

        // Extract organization ID from request (header preferred, then query, then body)
        let organizationId: number | undefined;

        // 1. Check X-Organization-Id header (recommended approach)
        const headerOrgId = req.headers['x-organization-id'] as string;
        if (headerOrgId) {
            organizationId = parseInt(headerOrgId, 10);
        }

        // 2. Check query parameter (GET requests)
        if (!organizationId && req.query.organizationId) {
            organizationId = parseInt(String(req.query.organizationId), 10);
        }

        // 3. Check body parameter (POST/PUT requests)
        if (!organizationId && req.body?.organizationId) {
            organizationId = parseInt(String(req.body.organizationId), 10);
        }

        // Validate organization ID was provided
        if (!organizationId || isNaN(organizationId)) {
            res.status(400).json({
                success: false,
                error: 'Organization ID is required. Provide via X-Organization-Id header, query param, or request body.'
            });
            return;
        }

        // Check if user is a member of the organization
        const organizationService = OrganizationService.getInstance();
        const isMember = await organizationService.isUserMember(userId, organizationId);

        if (!isMember) {
            res.status(403).json({
                success: false,
                error: `You do not have access to organization ID ${organizationId}.`
            });
            return;
        }

        // Get user's role in the organization
        const role = await organizationService.getUserRole(userId, organizationId);
        if (!role) {
            res.status(403).json({
                success: false,
                error: `Unable to determine your role in organization ID ${organizationId}.`
            });
            return;
        }

        // Set organization context on request for downstream handlers
        req.organizationId = organizationId;
        req.organizationRole = role;

        next();
    } catch (error: any) {
        console.error('[organizationContext] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate organization context',
            details: error.message
        });
    }
}

/**
 * Middleware: requireOrganizationRole
 * 
 * Enforces minimum organization role requirement.
 * Must be used AFTER organizationContext middleware.
 * 
 * **Role Hierarchy** (most → least privileged):
 * OWNER > ADMIN > MEMBER
 * 
 * @param minimumRole - Minimum role required to proceed
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * // Only OWNER and ADMIN can add members
 * router.post('/members',
 *     validateJWT,
 *     organizationContext,
 *     requireOrganizationRole(EOrganizationRole.ADMIN),
 *     async (req, res) => { ... }
 * );
 * ```
 */
export function requireOrganizationRole(minimumRole: EOrganizationRole) {
    const roleHierarchy = {
        [EOrganizationRole.OWNER]: 3,
        [EOrganizationRole.ADMIN]: 2,
        [EOrganizationRole.MEMBER]: 1
    };

    return (req: IOrganizationContextRequest, res: Response, next: NextFunction): void => {
        if (!req.organizationRole) {
            res.status(403).json({
                success: false,
                error: 'Organization context not set. Use organizationContext middleware first.'
            });
            return;
        }

        const userRoleLevel = roleHierarchy[req.organizationRole];
        const requiredRoleLevel = roleHierarchy[minimumRole];

        if (userRoleLevel < requiredRoleLevel) {
            res.status(403).json({
                success: false,
                error: `Insufficient permissions. ${minimumRole} role or higher required.`
            });
            return;
        }

        next();
    };
}

/**
 * Middleware: Optional organizationContext
 * 
 * Same as organizationContext but doesn't fail if no organization ID provided.
 * Useful for routes that can operate in both single-user and multi-tenant modes.
 * 
 * If organization ID is provided, validates membership.
 * If not provided, simply proceeds without setting organization context.
 * 
 * **Usage**: During migration phase when some users are in organizations and some aren't
 */
export async function optionalOrganizationContext(
    req: IOrganizationContextRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.tokenDetails?.user_id || req.user?.id;
        if (!userId) {
            return next(); // No user, no organization context needed
        }

        // Extract organization ID (same logic as organizationContext)
        let organizationId: number | undefined;
        const headerOrgId = req.headers['x-organization-id'] as string;
        if (headerOrgId) organizationId = parseInt(headerOrgId, 10);
        if (!organizationId && req.query.organizationId) {
            organizationId = parseInt(String(req.query.organizationId), 10);
        }
        if (!organizationId && req.body?.organizationId) {
            organizationId = parseInt(String(req.body.organizationId), 10);
        }

        // If no organization ID provided, proceed without context
        if (!organizationId || isNaN(organizationId)) {
            return next();
        }

        // If organization ID provided, validate membership
        const organizationService = OrganizationService.getInstance();
        const isMember = await organizationService.isUserMember(userId, organizationId);

        if (!isMember) {
            res.status(403).json({
                success: false,
                error: `You do not have access to organization ID ${organizationId}.`
            });
            return;
        }

        // Get user's role
        const role = await organizationService.getUserRole(userId, organizationId);
        if (role) {
            req.organizationId = organizationId;
            req.organizationRole = role;
        }

        next();
    } catch (error: any) {
        console.error('[optionalOrganizationContext] Error:', error);
        // Don't fail the request - just log and proceed
        next();
    }
}
