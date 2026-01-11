/**
 * Project-level role-based access control (RBAC) roles
 * 
 * Defines hierarchical access levels for project members:
 * - OWNER: Project creator with full control (cannot be changed/removed)
 * - ADMIN: Can manage members and all project resources
 * - EDITOR: Can create and modify content (dashboards, data models)
 * - VIEWER: Read-only access to all project resources
 */
export enum EProjectRole {
    OWNER = 'owner',      // Creator of project, full control
    ADMIN = 'admin',      // Can manage users, settings
    EDITOR = 'editor',    // Can create/edit content
    VIEWER = 'viewer'     // Read-only access
}
