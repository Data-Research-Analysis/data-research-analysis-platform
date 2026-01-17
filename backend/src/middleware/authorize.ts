import { Request, Response, NextFunction } from 'express';
import { RBACService } from '../services/RBACService.js';
import { Permission } from '../constants/permissions.js';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADashboard } from '../models/DRADashboard.js';

/**
 * Authorization middleware for RBAC permission checking
 * 
 * Validates that authenticated users have required permissions for project resources.
 * Works with authenticate middleware (expects req.body.tokenDetails).
 * 
 * Usage:
 *   router.delete('/delete/:projectId', authenticate, authorize(Permission.PROJECT_DELETE), handler)
 *   router.post('/add', authenticate, authorize(Permission.DATA_MODEL_CREATE), handler)
 */

/**
 * Helper to extract project ID from various resource types
 */
async function getProjectIdFromRequest(req: Request): Promise<number | null> {
    // Direct project ID in params, body, or query
    let projectId = 
        parseInt(req.params.projectId) ||
        parseInt(req.params.project_id) ||
        parseInt(req.body.projectId) ||
        parseInt(req.body.project_id) ||
        parseInt(req.query.projectId as string) ||
        parseInt(req.query.project_id as string);
    
    if (projectId) return projectId;
    
    // Extract from data model ID
    if (req.params.data_model_id || req.body.data_model_id) {
        const dataModelId = parseInt(req.params.data_model_id || req.body.data_model_id);
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return null;
        
        const manager = (await driver.getConcreteDriver()).manager;
        const dataModel = await manager.findOne(DRADataModel, {
            where: { id: dataModelId },
            relations: ['data_source', 'data_source.project']
        });
        
        if (dataModel?.data_source?.project?.id) {
            return dataModel.data_source.project.id;
        }
    }
    
    // Extract from data source ID
    if (req.params.data_source_id || req.body.data_source_id) {
        const dataSourceId = parseInt(req.params.data_source_id || req.body.data_source_id);
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return null;
        
        const manager = (await driver.getConcreteDriver()).manager;
        const dataSource = await manager.findOne(DRADataSource, {
            where: { id: dataSourceId },
            relations: ['project']
        });
        
        if (dataSource?.project?.id) {
            return dataSource.project.id;
        }
    }
    
    // Extract from dashboard ID
    if (req.params.dashboard_id || req.body.dashboard_id) {
        const dashboardId = parseInt(req.params.dashboard_id || req.body.dashboard_id);
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return null;
        
        const manager = (await driver.getConcreteDriver()).manager;
        const dashboard = await manager.findOne(DRADashboard, {
            where: { id: dashboardId },
            relations: ['project']
        });
        
        if (dashboard?.project?.id) {
            return dashboard.project.id;
        }
    }
    
    return null;
}

/**
 * Middleware to check if user has required permission (ANY)
 * 
 * Checks if user has at least one of the specified permissions.
 * Project ID extracted from params, body, query, or through resource relations.
 * 
 * @param permissions - One or more permissions (user needs ANY)
 * @returns Express middleware function
 * 
 * @example
 * // Require editor or admin permissions
 * router.put('/update/:projectId',
 *   authenticate,
 *   authorize(Permission.PROJECT_EDIT, Permission.PROJECT_MANAGE_MEMBERS),
 *   handler
 * )
 */
export function authorize(...permissions: Permission[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user_id } = req.body.tokenDetails;
            
            // Extract project ID from request (various sources)
            const projectId = await getProjectIdFromRequest(req);
            
            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    message: 'Project ID required or resource not found'
                });
            }
            
            const rbacService = RBACService.getInstance();
            
            // Check if user has ANY of the required permissions
            const hasPermission = await rbacService.hasAnyPermission(
                user_id,
                projectId,
                permissions
            );
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
            }
            
            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({
                success: false,
                message: 'Authorization check failed'
            });
        }
    };
}

/**
 * Middleware to require ALL specified permissions
 * 
 * Checks if user has all of the specified permissions (stricter than authorize()).
 * Project ID extracted from params, body, query, or through resource relations.
 * 
 * @param permissions - One or more permissions (user needs ALL)
 * @returns Express middleware function
 * 
 * @example
 * // Require both edit and member management permissions
 * router.post('/transfer-ownership/:projectId',
 *   authenticate,
 *   authorizeAll(Permission.PROJECT_EDIT, Permission.PROJECT_MANAGE_MEMBERS),
 *   handler
 * )
 */
export function authorizeAll(...permissions: Permission[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user_id } = req.body.tokenDetails;
            const projectId = await getProjectIdFromRequest(req);
            
            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    message: 'Project ID required or resource not found'
                });
            }
            
            const rbacService = RBACService.getInstance();
            const hasAllPermissions = await rbacService.hasAllPermissions(
                user_id,
                projectId,
                permissions
            );
            
            if (!hasAllPermissions) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
            }
            
            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({
                success: false,
                message: 'Authorization check failed'
            });
        }
    };
}
