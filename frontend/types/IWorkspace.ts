/**
 * Workspace TypeScript Interfaces (Frontend)
 * 
 * Maps to backend models: DRAWorkspace, DRAWorkspaceMember
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */

export enum WorkspaceRole {
    ADMIN = 'admin',
    EDITOR = 'editor',
    VIEWER = 'viewer'
}

export interface IWorkspace {
    id: number;
    organization_id: number;
    name: string;
    slug: string;
    description?: string | null;
    is_default: boolean;
    created_at: Date;
    updated_at: Date;
    
    // Relations (populated when needed)
    members?: IWorkspaceMember[];
    projects?: any[];  // Will reference IProject
    
    // User context (added by API)
    user_role?: WorkspaceRole;
    is_admin?: boolean;
}

export interface IWorkspaceMember {
    id: number;
    workspace_id: number;
    user_id: number;
    role: WorkspaceRole;
    joined_at: Date;
    invited_by?: number | null;
    is_active: boolean;
    
    // Relations (populated when needed)
    user?: {
        id: number;
        email: string;
        first_name?: string;
        last_name?: string;
    };
}

export interface ICreateWorkspaceRequest {
    organizationId: number;
    name: string;
    slug?: string;
    description?: string;
}

export interface IAddWorkspaceMemberRequest {
    userId: number;
    role: WorkspaceRole;
}

export interface IUpdateWorkspaceMemberRoleRequest {
    role: WorkspaceRole;
}
