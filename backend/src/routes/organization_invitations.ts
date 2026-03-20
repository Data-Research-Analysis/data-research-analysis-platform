import { Router, Request, Response } from 'express';
import { OrganizationInvitationService } from '../services/OrganizationInvitationService.js';
import { validateJWT } from '../middleware/authenticate.js';
import { organizationContext, requireOrganizationRole } from '../middleware/organizationContext.js';
import { EOrganizationRole } from '../services/OrganizationService.js';
import { invitationLimiter } from '../middleware/rateLimit.js';

const router = Router();
const invitationService = OrganizationInvitationService.getInstance();

/**
 * POST /organization-invitations
 * Create a new organization invitation
 * 
 * Body:
 * - organizationId: number
 * - email: string
 * - role: 'owner' | 'admin' | 'member'
 * 
 * Auth: Required (JWT + Organization Context)
 * Permission: Admin or Owner
 * Rate Limit: 10 requests per 15 minutes
 */
router.post(
    '/',
    validateJWT,
    organizationContext,
    requireOrganizationRole([EOrganizationRole.ADMIN, EOrganizationRole.OWNER]),
    invitationLimiter,
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { organizationId, email, role } = req.body;
            const userId = (req as any).body.tokenDetails?.user_id;

            if (!userId) {
                res.status(401).json({ success: false, message: 'Authentication required' });
                return;
            }

            // Validation
            if (!organizationId || !email || !role) {
                res.status(400).json({ success: false, message: 'Missing required fields' });
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                res.status(400).json({ success: false, message: 'Invalid email format' });
                return;
            }

            // Validate role
            if (!['owner', 'admin', 'member'].includes(role)) {
                res.status(400).json({ success: false, message: 'Invalid role' });
                return;
            }

            const result = await invitationService.createInvitation({
                organizationId: parseInt(organizationId),
                email: email,
                role: role as 'owner' | 'admin' | 'member',
                invitedByUserId: userId
            });

            if ('addedDirectly' in result) {
                res.status(200).json({
                    success: true,
                    message: 'User added directly to organization',
                    addedDirectly: true
                });
            } else {
                res.status(201).json({
                    success: true,
                    message: 'Invitation sent successfully',
                    invitation: result
                });
            }
        } catch (error: any) {
            console.error('Error creating organization invitation:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    }
);

/**
 * GET /organization-invitations/org/:orgId
 * Get all invitations for an organization
 * 
 * Query params:
 * - includeExpired: boolean (optional, default: false)
 * 
 * Auth: Required (JWT + Organization Context)
 * Permission: Admin or Owner
 */
router.get(
    '/org/:orgId',
    validateJWT,
    organizationContext,
    requireOrganizationRole([EOrganizationRole.ADMIN, EOrganizationRole.OWNER]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { orgId } = req.params;
            const includeExpired = req.query.includeExpired === 'true';

            const invitations = await invitationService.getOrganizationInvitations(
                parseInt(orgId),
                includeExpired
            );

            res.status(200).json({ success: true, invitations });
        } catch (error: any) {
            console.error('Error fetching organization invitations:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    }
);

/**
 * GET /organization-invitations/user
 * Get all pending invitations for the authenticated user
 * 
 * Auth: Required (JWT)
 */
router.get('/user', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).body.tokenDetails?.email;

        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }

        const invitations = await invitationService.getUserPendingOrgInvitations(userEmail);

        res.status(200).json({ success: true, invitations });
    } catch (error: any) {
        console.error('Error fetching user org invitations:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /organization-invitations/token/:token
 * Get invitation details by token (for preview before accept)
 * 
 * Auth: Not required (public endpoint for invitation preview)
 */
router.get('/token/:token', async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.params;

        const invitation = await invitationService.getInvitationByToken(token);

        if (!invitation) {
            res.status(404).json({ success: false, message: 'Invitation not found' });
            return;
        }

        res.status(200).json({ success: true, invitation });
    } catch (error: any) {
        console.error('Error fetching invitation by token:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /organization-invitations/accept
 * Accept an organization invitation
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
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }

        if (!token) {
            res.status(400).json({ success: false, message: 'Token is required' });
            return;
        }

        const result = await invitationService.acceptInvitation({ token, userId });

        res.status(200).json({
            success: true,
            message: result.message,
            organizationId: result.organizationId
        });
    } catch (error: any) {
        console.error('Error accepting organization invitation:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * DELETE /organization-invitations/:invitationId
 * Cancel a pending invitation
 * 
 * Auth: Required (JWT + Organization Context)
 * Permission: Admin or Owner
 */
router.delete(
    '/:invitationId',
    validateJWT,
    organizationContext,
    requireOrganizationRole([EOrganizationRole.ADMIN, EOrganizationRole.OWNER]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { invitationId } = req.params;
            const userId = (req as any).body.tokenDetails?.user_id;

            if (!userId) {
                res.status(401).json({ success: false, message: 'Authentication required' });
                return;
            }

            await invitationService.cancelInvitation(parseInt(invitationId), userId);

            res.status(200).json({ success: true, message: 'Invitation cancelled' });
        } catch (error: any) {
            console.error('Error cancelling invitation:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    }
);

/**
 * POST /organization-invitations/resend/:invitationId
 * Resend invitation email
 * 
 * Auth: Required (JWT + Organization Context)
 * Permission: Admin or Owner
 */
router.post(
    '/resend/:invitationId',
    validateJWT,
    organizationContext,
    requireOrganizationRole([EOrganizationRole.ADMIN, EOrganizationRole.OWNER]),
    invitationLimiter,
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { invitationId } = req.params;

            await invitationService.resendInvitation(parseInt(invitationId));

            res.status(200).json({ success: true, message: 'Invitation resent' });
        } catch (error: any) {
            console.error('Error resending invitation:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    }
);

export default router;
