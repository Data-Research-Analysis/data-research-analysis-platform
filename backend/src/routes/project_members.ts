import express from 'express';
import { body, param } from 'express-validator';
import { validateJWT } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';
import { RBACService } from '../services/RBACService.js';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';

const router = express.Router();

/**
 * Get project members
 * 
 * Returns all members of a project with user details and role information.
 * Requires PROJECT_VIEW permission (all roles have this).
 * 
 * GET /project/:projectId/members
 */
router.get('/:projectId/members',
    validateJWT,
    authorize(Permission.PROJECT_VIEW),
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const rbacService = RBACService.getInstance();
            
            const members = await rbacService.getProjectMembers(projectId);
            
            res.json({
                success: true,
                data: members
            });
        } catch (error: any) {
            console.error('Error fetching project members:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch project members'
            });
        }
    }
);

/**
 * Add member to project
 * 
 * Invites a user to join the project with specified role.
 * Requires PROJECT_MANAGE_MEMBERS permission (OWNER and ADMIN only).
 * 
 * POST /project/:projectId/members
 * Body: { userId: number, role: 'viewer' | 'editor' | 'admin' }
 */
router.post('/:projectId/members',
    validateJWT,
    authorize(Permission.PROJECT_MANAGE_MEMBERS),
    [
        body('userId').isInt().withMessage('Valid user ID required'),
        body('role').isIn(['viewer', 'editor', 'admin']).withMessage('Invalid role')
    ],
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const { userId, role } = req.body;
            const { user_id } = req.body.tokenDetails;
            
            const rbacService = RBACService.getInstance();
            const member = await rbacService.addMember(projectId, userId, role, user_id);
            
            res.json({
                success: true,
                data: member,
                message: 'Member added successfully'
            });
        } catch (error: any) {
            console.error('Error adding project member:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to add member'
            });
        }
    }
);

/**
 * Update member role
 * 
 * Changes a member's role in the project.
 * Requires PROJECT_MANAGE_MEMBERS permission (OWNER and ADMIN only).
 * Cannot change OWNER role.
 * 
 * PUT /project/:projectId/members/:userId
 * Body: { role: 'viewer' | 'editor' | 'admin' }
 */
router.put('/:projectId/members/:userId',
    validateJWT,
    authorize(Permission.PROJECT_MANAGE_MEMBERS),
    [
        body('role').isIn(['viewer', 'editor', 'admin']).withMessage('Invalid role')
    ],
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const memberUserId = parseInt(req.params.userId);
            const { role } = req.body;
            const { user_id } = req.body.tokenDetails;
            
            const rbacService = RBACService.getInstance();
            await rbacService.updateMemberRole(projectId, memberUserId, role, user_id);
            
            res.json({
                success: true,
                message: 'Member role updated successfully'
            });
        } catch (error: any) {
            console.error('Error updating member role:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to update member role'
            });
        }
    }
);

/**
 * Remove member from project
 * 
 * Removes a user from the project.
 * Requires PROJECT_MANAGE_MEMBERS permission (OWNER and ADMIN only).
 * Cannot remove project OWNER.
 * 
 * DELETE /project/:projectId/members/:userId
 */
router.delete('/:projectId/members/:userId',
    validateJWT,
    authorize(Permission.PROJECT_MANAGE_MEMBERS),
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const memberUserId = parseInt(req.params.userId);
            const { user_id } = req.body.tokenDetails;
            
            const rbacService = RBACService.getInstance();
            await rbacService.removeMember(projectId, memberUserId, user_id);
            
            res.json({
                success: true,
                message: 'Member removed successfully'
            });
        } catch (error: any) {
            console.error('Error removing member:', error);
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to remove member'
            });
        }
    }
);

/**
 * Get user's role in project
 * 
 * Returns the authenticated user's role in the specified project.
 * Useful for frontend to determine what actions user can perform.
 * 
 * GET /project/:projectId/my-role
 */
router.get('/:projectId/my-role',
    validateJWT,
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const { user_id } = req.body.tokenDetails;
            
            const rbacService = RBACService.getInstance();
            const role = await rbacService.getUserRole(user_id, projectId);
            
            if (!role) {
                return res.status(403).json({
                    success: false,
                    message: 'Not a member of this project'
                });
            }
            
            res.json({
                success: true,
                data: { role }
            });
        } catch (error: any) {
            console.error('Error fetching user role:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch user role'
            });
        }
    }
);

export default router;
