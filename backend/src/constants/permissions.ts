import { EProjectRole } from '../types/EProjectRole.js';

/**
 * Granular permissions for RBAC system
 * 
 * Format: resource:action
 * Used by RBACService to determine what actions users can perform
 */
export enum Permission {
    // Project permissions
    PROJECT_VIEW = 'project:view',
    PROJECT_EDIT = 'project:edit',
    PROJECT_DELETE = 'project:delete',
    PROJECT_MANAGE_MEMBERS = 'project:manage_members',
    
    // Data source permissions
    DATA_SOURCE_VIEW = 'data_source:view',
    DATA_SOURCE_CREATE = 'data_source:create',
    DATA_SOURCE_EDIT = 'data_source:edit',
    DATA_SOURCE_DELETE = 'data_source:delete',
    
    // Data model permissions
    DATA_MODEL_VIEW = 'data_model:view',
    DATA_MODEL_CREATE = 'data_model:create',
    DATA_MODEL_EDIT = 'data_model:edit',
    DATA_MODEL_DELETE = 'data_model:delete',
    DATA_MODEL_EXECUTE = 'data_model:execute',
    
    // Dashboard permissions
    DASHBOARD_VIEW = 'dashboard:view',
    DASHBOARD_CREATE = 'dashboard:create',
    DASHBOARD_EDIT = 'dashboard:edit',
    DASHBOARD_DELETE = 'dashboard:delete',
    DASHBOARD_SHARE = 'dashboard:share',
}

/**
 * Maps project roles to their allowed permissions
 * 
 * NOTE: These permissions are checked by authorize() middleware ONLY.
 * Actual DELETE operations are also gated by PermissionService which blocks
 * deletion for non-owners. See PermissionService.ts for the enforcement matrix.
 * 
 * OWNER: All permissions (full control, including deletion)
 * ADMIN: Manage team + create/edit resources (CANNOT delete resources)
 * EDITOR: Create/edit resources only (CANNOT delete or manage team)
 * VIEWER: Read-only access, can execute data models
 */
export const ROLE_PERMISSIONS: Record<EProjectRole, Permission[]> = {
    [EProjectRole.OWNER]: [
        // All permissions
        ...Object.values(Permission)
    ],
    [EProjectRole.ADMIN]: [
        // Project permissions
        Permission.PROJECT_VIEW,
        Permission.PROJECT_EDIT,
        Permission.PROJECT_MANAGE_MEMBERS,  // ← Key admin privilege
        
        // Data source permissions (NO DELETE)
        Permission.DATA_SOURCE_VIEW,
        Permission.DATA_SOURCE_CREATE,
        Permission.DATA_SOURCE_EDIT,
        
        // Data model permissions (NO DELETE)
        Permission.DATA_MODEL_VIEW,
        Permission.DATA_MODEL_CREATE,
        Permission.DATA_MODEL_EDIT,
        Permission.DATA_MODEL_EXECUTE,
        
        // Dashboard permissions (NO DELETE)
        Permission.DASHBOARD_VIEW,
        Permission.DASHBOARD_CREATE,
        Permission.DASHBOARD_EDIT,
        Permission.DASHBOARD_SHARE,
    ],
    [EProjectRole.EDITOR]: [
        // Project permissions
        Permission.PROJECT_VIEW,
        
        // Data source permissions
        Permission.DATA_SOURCE_VIEW,
        
        // Data model permissions
        Permission.DATA_MODEL_VIEW,
        Permission.DATA_MODEL_CREATE,
        Permission.DATA_MODEL_EDIT,
        Permission.DATA_MODEL_EXECUTE,
        
        // Dashboard permissions
        Permission.DASHBOARD_VIEW,
        Permission.DASHBOARD_CREATE,
        Permission.DASHBOARD_EDIT,
        Permission.DASHBOARD_SHARE,
    ],
    [EProjectRole.VIEWER]: [
        Permission.PROJECT_VIEW,
        Permission.DATA_SOURCE_VIEW,
        Permission.DATA_MODEL_VIEW,
        Permission.DATA_MODEL_EXECUTE,
        Permission.DASHBOARD_VIEW,
    ],
};
