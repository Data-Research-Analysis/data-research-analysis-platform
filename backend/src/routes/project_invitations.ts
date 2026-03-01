import { Router, Request, Response } from 'express';
import { InvitationService } from '../services/InvitationService.js';
import { validateJWT } from '../middleware/authenticate.js';
import { invitationLimiter } from '../middleware/rateLimit.js';
import { EProjectRole } from '../types/EProjectRole.js';
import { requiresProjectRole } from '../middleware/requiresProjectRole.js';

const router = Router();
const invitationService = InvitationService.getInstance();

/**
 * POST /api/project-invitations
 * Create a new project invitation
 * 
 * Body:
 * - projectId: number
 * - email: string
 * - role: EProjectRole
 * 
 * Auth: Required (JWT)
 * Rate Limit: 10 requests per 15 minutes
 */
router.post('/', validateJWT, invitationLimiter, requiresProjectRole(['analyst']), async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, email, role, marketing_role } = req.body;
        const userId = (req as any).body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        // Validation
        if (!projectId || !email || !role) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields: projectId, email, role'
            });
            return;
        }

        // Validate marketing_role — required
        const validMarketingRoles = ['analyst', 'manager', 'cmo'];
        if (!marketing_role || !validMarketingRoles.includes(marketing_role)) {
            res.status(400).json({
                success: false,
                message: `Invalid or missing marketing_role. Must be one of: ${validMarketingRoles.join(', ')}`
            });
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
            return;
        }

        // Validate role
        const validRoles = Object.values(EProjectRole);
        if (!validRoles.includes(role)) {
            res.status(400).json({
                success: false,
                message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
            return;
        }

        const result = await invitationService.createInvitation({
            projectId: parseInt(projectId),
            email: email.toLowerCase().trim(),
            role,
            marketing_role: marketing_role as 'analyst' | 'manager' | 'cmo',
            invitedByUserId: userId
        });

        if ('addedDirectly' in result) {
            res.status(200).json({
                success: true,
                message: 'User added directly to project',
                addedDirectly: true,
                userId: result.userId
            });
        } else {
            res.status(201).json({
                success: true,
                message: 'Invitation sent successfully',
                invitation: result
            });
        }
    } catch (error: any) {
        console.error('Error creating invitation:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to create invitation'
        });
    }
});

/**
 * GET /api/project-invitations/project/:projectId
 * Get all invitations for a project
 * 
 * Query params:
 * - includeExpired: boolean (optional, default: false)
 * 
 * Auth: Required (JWT)
 */
router.get('/project/:projectId', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const includeExpired = req.query.includeExpired === 'true';

        const invitations = await invitationService.getProjectInvitations(
            parseInt(projectId),
            includeExpired
        );

        res.status(200).json({
            success: true,
            invitations
        });
    } catch (error: any) {
        console.error('Error fetching project invitations:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to fetch invitations'
        });
    }
});

/**
 * GET /api/project-invitations/user
 * Get all pending invitations for the authenticated user
 * 
 * Auth: Required (JWT)
 */
router.get('/user', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).body.tokenDetails?.email;
        
        if (!userEmail) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const invitations = await invitationService.getUserPendingInvitations(userEmail);

        res.status(200).json({
            success: true,
            invitations
        });
    } catch (error: any) {
        console.error('Error fetching user invitations:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to fetch invitations'
        });
    }
});

/**
 * GET /api/project-invitations/token/:token
 * Get invitation details by token (for preview before accept)
 * 
 * Auth: Not required (public endpoint for invitation preview)
 */
router.get('/token/:token', async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.params;

        const invitation = await invitationService.getInvitationByToken(token);

        if (!invitation) {
            res.status(404).json({
                success: false,
                message: 'Invitation not found'
            });
            return;
        }

        // Don't return the token in response for security
        const { invitation_token, ...safeInvitation } = invitation;

        res.status(200).json({
            success: true,
            invitation: safeInvitation
        });
    } catch (error: any) {
        console.error('Error fetching invitation by token:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to fetch invitation'
        });
    }
});

/**
 * POST /api/project-invitations/accept
 * Accept a project invitation
 * 
 * Body:
 * - token: string
 * 
 * Auth: Required (JWT)
 */
router.post('/accept', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.body;
        const userId = (req as any).body.tokenDetails?.user_id;
        
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        if (!token) {
            res.status(400).json({
                success: false,
                message: 'Token is required'
            });
            return;
        }

        const result = await invitationService.acceptInvitation({
            token,
            userId
        });

        res.status(200).json({
            success: true,
            message: result.message,
            projectId: result.projectId
        });
    } catch (error: any) {
        console.error('Error accepting invitation:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to accept invitation'
        });
    }
});

/**
 * DELETE /api/project-invitations/:invitationId
 * Cancel a pending invitation
 * 
 * Auth: Required (JWT)
 */
router.delete('/:invitationId', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { invitationId } = req.params;
        const userId = (req as any).body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const result = await invitationService.cancelInvitation(
            parseInt(invitationId),
            userId
        );

        res.status(200).json(result);
    } catch (error: any) {
        console.error('Error cancelling invitation:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to cancel invitation'
        });
    }
});

/**
 * POST /api/project-invitations/:invitationId/resend
 * Resend an invitation email
 * 
 * Auth: Required (JWT)
 */
router.post('/:invitationId/resend', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { invitationId } = req.params;
        const userId = (req as any).body.tokenDetails?.user_id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const result = await invitationService.resendInvitation(
            parseInt(invitationId),
            userId
        );

        res.status(200).json(result);
    } catch (error: any) {
        console.error('Error resending invitation:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to resend invitation'
        });
    }
});

/**
 * POST /api/project-invitations/expire-old
 * Expire old invitations (cron job endpoint)
 * 
 * Auth: Required (JWT) - Admin only
 * Note: In production, this should be called by a cron job with system credentials
 */
router.post('/expire-old', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        // TODO: Add admin-only check here
        // const isAdmin = (req as any).user.role === 'admin';
        // if (!isAdmin) {
        //     res.status(403).json({ success: false, message: 'Admin access required' });
        //     return;
        // }

        const result = await invitationService.expireOldInvitations();

        res.status(200).json({
            success: true,
            message: `${result.expiredCount} invitations expired`,
            expiredCount: result.expiredCount
        });
    } catch (error: any) {
        console.error('Error expiring old invitations:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to expire invitations'
        });
    }
});

export default router;
