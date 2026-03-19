/**
 * Organization TypeScript Interfaces (Frontend)
 * 
 * Maps to backend models: DRAOrganization, DRAOrganizationMember, DRAOrganizationSubscription
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */

export enum OrganizationRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    MEMBER = 'member'
}

export interface IOrganization {
    id: number;
    name: string;
    domain?: string | null;
    settings?: {
        migrated_from_user_id?: number;
        migration_date?: string;
        [key: string]: any;
    };
    created_at: Date;
    updated_at: Date;
    
    // Relations (populated when needed)
    subscription?: IOrganizationSubscription;
    members?: IOrganizationMember[];
    workspaces?: any[];  // Will be defined in IWorkspace.ts
    
    // User context (added by API)
    user_role?: OrganizationRole;
    is_owner?: boolean;
}

export interface IOrganizationMember {
    id: number;
    organization_id: number;
    user_id: number;
    role: OrganizationRole;
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

export interface IOrganizationSubscription {
    id: number;
    organization_id: number;
    subscription_tier_id: number;
    stripe_subscription_id?: string | null;
    stripe_customer_id?: string | null;
    max_members?: number | null;  // null = unlimited (ENTERPRISE)
    current_members: number;
    is_active: boolean;
    started_at: Date;
    ends_at?: Date | null;
    cancelled_at?: Date | null;
    trial_ends_at?: Date | null;
    
    // Relations (populated when needed)
    subscription_tier?: {
        id: number;
        tier_name: string;
        max_rows_per_data_model: number;
        max_projects?: number | null;
        price_per_month_usd: number;
    };
}

export interface IOrganizationUsage {
    currentMembers: number;
    maxMembers: number | null;  // null = unlimited
    canAddMembers: boolean;
    membersRemaining?: number | null;  // null if unlimited
}

export interface ICreateOrganizationRequest {
    name: string;
    slug: string;
    subscriptionTierId: number;
    domain?: string;
}

export interface IAddMemberRequest {
    email: string;
    role: OrganizationRole;
}

export interface IUpdateMemberRoleRequest {
    role: OrganizationRole;
}
