import { Request, Response, NextFunction } from 'express';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';

export type MarketingRole = 'analyst' | 'manager' | 'cmo';

/**
 * Express middleware that gates a route to users who hold one of the specified
 * marketing roles on the active project.
 *
 * Short-circuits (always allows) for:
 *  - System admin users  (req.user.role === 'admin' or tokenDetails.user_type === 'admin')
 *  - The project creator (dra_projects.users_platform_id === req.user.id)
 *
 * The project ID is resolved from (in priority order):
 *   req.params.projectId → req.params.projectid → req.body.projectId → req.query.projectId
 *
 * On success the resolved marketing role is attached to the request as
 *   (req as any).projectRole  — downstream handlers may read this.
 */
export function requiresProjectRole(allowedRoles: MarketingRole[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Resolve the calling user from the JWT middleware output
            const tokenDetails = (req as any).body?.tokenDetails;
            const userId: number | undefined =
                tokenDetails?.user_id ?? (req as any).user?.id;

            if (!userId) {
                res.status(401).json({ success: false, error: 'Authentication required' });
                return;
            }

            // System admin bypasses all project role checks
            const userType: string | undefined =
                tokenDetails?.user_type ?? (req as any).user?.role;
            if (userType === 'admin') {
                (req as any).projectRole = 'analyst'; // admins are treated as analysts
                next();
                return;
            }

            // Resolve the project ID (supports both camelCase and snake_case variants)
            const rawProjectId =
                req.params.projectId ??
                req.params.projectid ??
                req.body?.projectId ??
                req.body?.project_id ??
                (req.query?.projectId as string | undefined) ??
                (req.query?.project_id as string | undefined);

            const projectId = rawProjectId ? parseInt(String(rawProjectId), 10) : NaN;

            if (!projectId || isNaN(projectId)) {
                res.status(400).json({ success: false, error: 'Project ID is required for this operation' });
                return;
            }

            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                res.status(500).json({ success: false, error: 'Database not available' });
                return;
            }
            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver) {
                res.status(500).json({ success: false, error: 'Database not available' });
                return;
            }
            const manager = concreteDriver.manager;

            // Check if the user is the project creator (implicit analyst)
            const project = await manager.query(
                `SELECT users_platform_id FROM dra_projects WHERE id = $1`,
                [projectId],
            );
            if (project?.[0]?.users_platform_id === userId) {
                (req as any).projectRole = 'analyst';
                next();
                return;
            }

            // Check dra_project_members for the user's marketing_role
            const membership = await manager.query(
                `SELECT marketing_role FROM dra_project_members
                 WHERE project_id = $1 AND users_platform_id = $2`,
                [projectId, userId],
            );

            if (!membership?.[0]) {
                res.status(403).json({
                    success: false,
                    error: 'You do not have access to this project',
                    code: 'NO_PROJECT_ACCESS',
                });
                return;
            }

            const userRole: MarketingRole =
                (membership[0].marketing_role as MarketingRole) ?? 'cmo';

            if (!allowedRoles.includes(userRole)) {
                res.status(403).json({
                    success: false,
                    error: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
                    code: 'INSUFFICIENT_PROJECT_ROLE',
                });
                return;
            }

            // Attach resolved role to request for downstream use
            (req as any).projectRole = userRole;
            next();
        } catch (err) {
            console.error('[requiresProjectRole]', err);
            res.status(500).json({ success: false, error: 'Role check failed' });
        }
    };
}
