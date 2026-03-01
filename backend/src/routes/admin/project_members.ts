import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';

const router = express.Router();

/**
 * Require the caller to be a system admin.
 * Returns 403 early if not.
 */
function requireSystemAdmin(req: Request, res: Response): boolean {
    const tokenDetails = (req as any).body?.tokenDetails;
    if (tokenDetails?.user_type !== 'admin') {
        res.status(403).json({ success: false, error: 'System administrator access required' });
        return false;
    }
    return true;
}

/**
 * GET /admin/projects/:projectId/members
 * List all members of a project with their marketing_role.
 */
router.get('/:projectId/members', validateJWT, async (req: Request, res: Response): Promise<void> => {
    if (!requireSystemAdmin(req, res)) return;
    try {
        const projectId = parseInt(req.params.projectId, 10);
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            res.status(500).json({ success: false, error: 'Database not available' });
            return;
        }
        const members = await concreteDriver.query(
            `SELECT
                pm.id,
                pm.users_platform_id AS user_id,
                u.email,
                u.first_name,
                u.last_name,
                pm.role,
                pm.marketing_role,
                pm.added_at,
                pm.invited_by_user_id AS invited_by
             FROM dra_project_members pm
             JOIN dra_users_platform u ON u.id = pm.users_platform_id
             WHERE pm.project_id = $1
             ORDER BY pm.added_at ASC`,
            [projectId],
        );
        res.json({ success: true, members });
    } catch (error: any) {
        console.error('[admin/projects] get members error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PATCH /admin/projects/:projectId/members/:userId/role
 * Update a specific member's marketing_role on a project.
 * Body: { marketing_role: 'analyst' | 'manager' | 'cmo' }
 */
router.patch('/:projectId/members/:userId/role', validateJWT, async (req: Request, res: Response): Promise<void> => {
    if (!requireSystemAdmin(req, res)) return;
    try {
        const projectId = parseInt(req.params.projectId, 10);
        const userId = parseInt(req.params.userId, 10);
        const { marketing_role } = req.body;

        const validRoles = ['analyst', 'manager', 'cmo'];
        if (!marketing_role || !validRoles.includes(marketing_role)) {
            res.status(400).json({
                success: false,
                error: `Invalid marketing_role. Must be one of: ${validRoles.join(', ')}`,
            });
            return;
        }

        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            res.status(500).json({ success: false, error: 'Database not available' });
            return;
        }

        // Upsert (update if exists, insert if not)
        await concreteDriver.query(
            `INSERT INTO dra_project_members (project_id, users_platform_id, role, marketing_role, added_at)
             VALUES ($1, $2, 'viewer', $3, NOW())
             ON CONFLICT (project_id, users_platform_id)
             DO UPDATE SET marketing_role = EXCLUDED.marketing_role`,
            [projectId, userId, marketing_role],
        );

        res.json({ success: true, message: `marketing_role updated to '${marketing_role}'` });
    } catch (error: any) {
        console.error('[admin/projects] update role error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/projects/unmapped-roles
 * Returns all project members whose marketing_role is 'cmo' (legacy default).
 * Useful for admins to identify users who may need a role upgrade.
 */
router.get('/unmapped-roles', validateJWT, async (req: Request, res: Response): Promise<void> => {
    if (!requireSystemAdmin(req, res)) return;
    try {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            res.status(500).json({ success: false, error: 'Database not available' });
            return;
        }
        const rows = await concreteDriver.query(
            `SELECT
                pm.id,
                pm.project_id,
                p.name AS project_name,
                pm.users_platform_id AS user_id,
                u.email,
                u.first_name,
                u.last_name,
                pm.marketing_role,
                pm.added_at
             FROM dra_project_members pm
             JOIN dra_users_platform u ON u.id = pm.users_platform_id
             JOIN dra_projects p ON p.id = pm.project_id
             WHERE pm.marketing_role = 'cmo'
             ORDER BY pm.added_at ASC`,
        );
        res.json({ success: true, members: rows });
    } catch (error: any) {
        console.error('[admin/projects] unmapped-roles error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
