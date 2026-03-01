import type { IDataSource } from "./IDataSource";

export interface IProjectMember {
    id: number;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
    marketing_role: 'analyst' | 'manager' | 'cmo';
    user: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
    added_at: string;
    invited_by: any;
}

export interface IProject {
    id: number;
    user_platform_id: number;
    name: string;
    description?: string;
    created_at?: string;
    // Owner/member status
    is_owner: boolean;
    user_role: 'owner' | 'admin' | 'editor' | 'viewer';
    /** Marketing role of the currently authenticated user on this project */
    my_role: 'analyst' | 'manager' | 'cmo' | null;
    // Counts from backend API
    data_sources_count?: number;
    data_models_count?: number;
    dashboards_count?: number;
    // Full relations (for backward compatibility)
    DataSources: IDataSource[];
    // Project members with RBAC
    members?: IProjectMember[];
}