import { EntityManager } from 'typeorm';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRADashboard } from '../models/DRADashboard.js';
import { DRAProject } from '../models/DRAProject.js';

export enum EProjectRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    EDITOR = 'editor',
    VIEWER = 'viewer'
}

export enum EResourceType {
    DATA_SOURCE = 'data_source',
    DATA_MODEL = 'data_model',
    DASHBOARD = 'dashboard',
    PROJECT = 'project'
}

export enum EAction {
    CREATE = 'create',
    READ = 'read',
    UPDATE = 'update',
    DELETE = 'delete'
}

interface PermissionMatrix {
    [key: string]: {
        [key: string]: boolean;
    };
}

/**
 * Permission Service for Role-Based Access Control (RBAC)
 * Singleton service that manages permissions across all resources
 */
export class PermissionService {
    private static instance: PermissionService;

    /**
     * Permission matrix defining what each role can do
     * Format: [role][action] = boolean
     */
    private permissionMatrix: PermissionMatrix = {
        [EProjectRole.OWNER]: {
            [EAction.CREATE]: true,
            [EAction.READ]: true,
            [EAction.UPDATE]: true,
            [EAction.DELETE]: true,
        },
        [EProjectRole.ADMIN]: {
            [EAction.CREATE]: true,
            [EAction.READ]: true,
            [EAction.UPDATE]: true,
            [EAction.DELETE]: false, // Admins cannot delete
        },
        [EProjectRole.EDITOR]: {
            [EAction.CREATE]: true,
            [EAction.READ]: true,
            [EAction.UPDATE]: true,
            [EAction.DELETE]: false,
        },
        [EProjectRole.VIEWER]: {
            [EAction.CREATE]: false,
            [EAction.READ]: true,
            [EAction.UPDATE]: false,
            [EAction.DELETE]: false,
        },
    };

    private constructor() {}

    public static getInstance(): PermissionService {
        if (!PermissionService.instance) {
            PermissionService.instance = new PermissionService();
        }
        return PermissionService.instance;
    }

    /**
     * Get user's role in a project
     * @param userId - User's platform ID
     * @param projectId - Project ID
     * @param manager - TypeORM EntityManager
     * @returns User's role or null if not a member
     */
    async getUserProjectRole(
        userId: number,
        projectId: number,
        manager: EntityManager
    ): Promise<EProjectRole | null> {
        // Check if user is the project owner
        const project = await manager.findOne(DRAProject, {
            where: { id: projectId },
            relations: ['users_platform']
        });

        if (project && project.users_platform.id === userId) {
            return EProjectRole.OWNER;
        }

        // Check if user is a project member
        const member = await manager.findOne(DRAProjectMember, {
            where: {
                project: { id: projectId },
                user: { id: userId }
            }
        });

        if (member) {
            return member.role as EProjectRole;
        }

        return null;
    }

    /**
     * Check if user can perform action on resource
     * @param role - User's role in the project
     * @param action - Action to perform (create, read, update, delete)
     * @returns Boolean indicating permission
     */
    canPerformAction(role: EProjectRole, action: EAction): boolean {
        return this.permissionMatrix[role]?.[action] ?? false;
    }

    /**
     * Check if user has access to a project
     * @param userId - User's platform ID
     * @param projectId - Project ID
     * @param manager - TypeORM EntityManager
     * @returns Boolean indicating access
     */
    async hasProjectAccess(
        userId: number,
        projectId: number,
        manager: EntityManager
    ): Promise<boolean> {
        const role = await this.getUserProjectRole(userId, projectId, manager);
        return role !== null;
    }

    /**
     * Check if user can perform action on a specific resource
     * Verifies both project membership and action permission
     * @param userId - User's platform ID
     * @param projectId - Project ID
     * @param action - Action to perform
     * @param manager - TypeORM EntityManager
     * @returns Boolean indicating permission
     */
    async canPerformActionOnProject(
        userId: number,
        projectId: number,
        action: EAction,
        manager: EntityManager
    ): Promise<boolean> {
        const role = await this.getUserProjectRole(userId, projectId, manager);
        
        if (!role) {
            return false;
        }

        return this.canPerformAction(role, action);
    }

    /**
     * Get project ID from data source
     * @param dataSourceId - Data source ID
     * @param manager - TypeORM EntityManager
     * @returns Project ID or null
     */
    async getProjectIdFromDataSource(
        dataSourceId: number,
        manager: EntityManager
    ): Promise<number | null> {
        const dataSource = await manager.findOne(DRADataSource, {
            where: { id: dataSourceId },
            relations: ['project']
        });

        return dataSource?.project?.id ?? null;
    }

    /**
     * Get project ID from data model
     * @param dataModelId - Data model ID
     * @param manager - TypeORM EntityManager
     * @returns Project ID or null
     */
    async getProjectIdFromDataModel(
        dataModelId: number,
        manager: EntityManager
    ): Promise<number | null> {
        const dataModel = await manager.findOne(DRADataModel, {
            where: { id: dataModelId },
            relations: ['data_source', 'data_source.project']
        });

        return dataModel?.data_source?.project?.id ?? null;
    }

    /**
     * Get project ID from dashboard
     * @param dashboardId - Dashboard ID
     * @param manager - TypeORM EntityManager
     * @returns Project ID or null
     */
    async getProjectIdFromDashboard(
        dashboardId: number,
        manager: EntityManager
    ): Promise<number | null> {
        const dashboard = await manager.findOne(DRADashboard, {
            where: { id: dashboardId },
            relations: ['project']
        });

        return dashboard?.project?.id ?? null;
    }

    /**
     * Check if user can perform action on a data source
     * @param userId - User's platform ID
     * @param dataSourceId - Data source ID
     * @param action - Action to perform
     * @param manager - TypeORM EntityManager
     * @returns Boolean indicating permission
     */
    async canPerformActionOnDataSource(
        userId: number,
        dataSourceId: number,
        action: EAction,
        manager: EntityManager
    ): Promise<boolean> {
        const projectId = await this.getProjectIdFromDataSource(dataSourceId, manager);
        
        if (!projectId) {
            return false;
        }

        return this.canPerformActionOnProject(userId, projectId, action, manager);
    }

    /**
     * Check if user can perform action on a data model
     * @param userId - User's platform ID
     * @param dataModelId - Data model ID
     * @param action - Action to perform
     * @param manager - TypeORM EntityManager
     * @returns Boolean indicating permission
     */
    async canPerformActionOnDataModel(
        userId: number,
        dataModelId: number,
        action: EAction,
        manager: EntityManager
    ): Promise<boolean> {
        const projectId = await this.getProjectIdFromDataModel(dataModelId, manager);
        
        if (!projectId) {
            return false;
        }

        return this.canPerformActionOnProject(userId, projectId, action, manager);
    }

    /**
     * Check if user can perform action on a dashboard
     * @param userId - User's platform ID
     * @param dashboardId - Dashboard ID
     * @param action - Action to perform
     * @param manager - TypeORM EntityManager
     * @returns Boolean indicating permission
     */
    async canPerformActionOnDashboard(
        userId: number,
        dashboardId: number,
        action: EAction,
        manager: EntityManager
    ): Promise<boolean> {
        const projectId = await this.getProjectIdFromDashboard(dashboardId, manager);
        
        if (!projectId) {
            return false;
        }

        return this.canPerformActionOnProject(userId, projectId, action, manager);
    }

    /**
     * Get user's effective permissions for a project
     * Returns object with boolean flags for each action
     * @param userId - User's platform ID
     * @param projectId - Project ID
     * @param manager - TypeORM EntityManager
     * @returns Object with permission flags
     */
    async getProjectPermissions(
        userId: number,
        projectId: number,
        manager: EntityManager
    ): Promise<{
        canCreate: boolean;
        canRead: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        role: EProjectRole | null;
    }> {
        const role = await this.getUserProjectRole(userId, projectId, manager);

        if (!role) {
            return {
                canCreate: false,
                canRead: false,
                canUpdate: false,
                canDelete: false,
                role: null
            };
        }

        return {
            canCreate: this.canPerformAction(role, EAction.CREATE),
            canRead: this.canPerformAction(role, EAction.READ),
            canUpdate: this.canPerformAction(role, EAction.UPDATE),
            canDelete: this.canPerformAction(role, EAction.DELETE),
            role
        };
    }
}
