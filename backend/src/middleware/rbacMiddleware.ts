import { Request, Response, NextFunction } from 'express';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { PermissionService, EAction, EResourceType } from '../services/PermissionService.js';

/**
 * RBAC Middleware for protecting routes based on user permissions
 */

interface AuthenticatedRequest extends Request {
    user_id?: number;
}

/**
 * Middleware to check if user has access to a project
 * Verifies that the user is either the owner or a member
 * @param projectIdParam - Name of the route parameter containing project ID (default: 'projectid')
 */
export const requireProjectAccess = (projectIdParam: string = 'projectid') => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user_id;
            const projectId = parseInt(req.params[projectIdParam]);

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (isNaN(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid project ID'
                });
            }

            // Get database driver and manager
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return res.status(500).json({
                    success: false,
                    message: 'Database driver not available'
                });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            const permissionService = PermissionService.getInstance();

            const hasAccess = await permissionService.hasProjectAccess(userId, projectId, manager);

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have access to this project'
                });
            }

            next();
        } catch (error) {
            console.error('Error in requireProjectAccess middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };
};

/**
 * Middleware to check if user can perform action on project
 * @param action - Action to check (create, read, update, delete)
 * @param projectIdParam - Name of the route parameter containing project ID (default: 'projectid')
 */
export const requireProjectPermission = (
    action: EAction,
    projectIdParam: string = 'projectid'
) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user_id;
            // Check both params and body for project_id
            const projectId = parseInt(req.params[projectIdParam] || req.body[projectIdParam]);

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (isNaN(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid project ID'
                });
            }

            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return res.status(500).json({
                    success: false,
                    message: 'Database driver not available'
                });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            const permissionService = PermissionService.getInstance();

            const canPerform = await permissionService.canPerformActionOnProject(
                userId,
                projectId,
                action,
                manager
            );

            if (!canPerform) {
                return res.status(403).json({
                    success: false,
                    message: `You do not have permission to ${action} in this project`
                });
            }

            next();
        } catch (error) {
            console.error('Error in requireProjectPermission middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };
};

/**
 * Middleware to check if user can perform action on a data source
 * @param action - Action to check (create, read, update, delete)
 * @param resourceIdParam - Name of the route parameter containing data source ID
 */
export const requireDataSourcePermission = (
    action: EAction,
    resourceIdParam: string = 'datasourceid'
) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user_id;
            const dataSourceId = parseInt(req.params[resourceIdParam]);

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (isNaN(dataSourceId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid data source ID'
                });
            }

            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return res.status(500).json({
                    success: false,
                    message: 'Database driver not available'
                });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            const permissionService = PermissionService.getInstance();

            const canPerform = await permissionService.canPerformActionOnDataSource(
                userId,
                dataSourceId,
                action,
                manager
            );

            if (!canPerform) {
                return res.status(403).json({
                    success: false,
                    message: `You do not have permission to ${action} this data source`
                });
            }

            next();
        } catch (error) {
            console.error('Error in requireDataSourcePermission middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };
};

/**
 * Middleware to check if user can perform action on a data model
 * @param action - Action to check (create, read, update, delete)
 * @param resourceIdParam - Name of the route parameter containing data model ID
 */
export const requireDataModelPermission = (
    action: EAction,
    resourceIdParam: string = 'datamodelid'
) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user_id;
            // Try to get ID from params first, then from body (for POST requests)
            const dataModelId = parseInt(req.params[resourceIdParam] || req.body[resourceIdParam]);

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (isNaN(dataModelId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid data model ID'
                });
            }

            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return res.status(500).json({
                    success: false,
                    message: 'Database driver not available'
                });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            const permissionService = PermissionService.getInstance();

            const canPerform = await permissionService.canPerformActionOnDataModel(
                userId,
                dataModelId,
                action,
                manager
            );

            if (!canPerform) {
                return res.status(403).json({
                    success: false,
                    message: `You do not have permission to ${action} this data model`
                });
            }

            next();
        } catch (error) {
            console.error('Error in requireDataModelPermission middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };
};

/**
 * Middleware to check if user can perform action on a dashboard
 * @param action - Action to check (create, read, update, delete)
 * @param resourceIdParam - Name of the route parameter containing dashboard ID
 */
export const requireDashboardPermission = (
    action: EAction,
    resourceIdParam: string = 'dashboardid'
) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user_id;
            const dashboardId = parseInt(req.params[resourceIdParam]);

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (isNaN(dashboardId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid dashboard ID'
                });
            }

            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return res.status(500).json({
                    success: false,
                    message: 'Database driver not available'
                });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            const permissionService = PermissionService.getInstance();

            const canPerform = await permissionService.canPerformActionOnDashboard(
                userId,
                dashboardId,
                action,
                manager
            );

            if (!canPerform) {
                return res.status(403).json({
                    success: false,
                    message: `You do not have permission to ${action} this dashboard`
                });
            }

            next();
        } catch (error) {
            console.error('Error in requireDashboardPermission middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };
};
