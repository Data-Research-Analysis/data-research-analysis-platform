import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
    Relation
} from 'typeorm';
import { DRAWorkspace } from './DRAWorkspace.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

/**
 * Workspace member entity for workspace-level access control
 * 
 * Tracks which users have access to which workspaces within an organization.
 * Users must be organization members first before being added to workspaces.
 * 
 * Roles:
 * - admin: Can manage workspace, add/remove members, create projects
 * - editor: Can create/edit projects, data sources, models, dashboards
 * - viewer: Read-only access to workspace resources
 * 
 * Replaces the per-project invitation model (DRAProjectMember) for multi-user plans.
 * Single-user plans (FREE/STARTER) auto-add owner to default workspace.
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */
@Entity('dra_workspace_members')
@Unique(['workspace', 'user'])  // One membership per user per workspace
export class DRAWorkspaceMember {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAWorkspace, ws => ws.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspace_id' })
    workspace!: Relation<DRAWorkspace>;

    @Column({ type: 'int', name: 'workspace_id' })
    workspace_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({ type: 'int', name: 'users_platform_id' })
    users_platform_id!: number;

    @Column({
        type: 'enum',
        enum: ['admin', 'editor', 'viewer'],
        default: 'viewer'
    })
    role!: 'admin' | 'editor' | 'viewer';

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    joined_at!: Date;

    @ManyToOne(() => DRAUsersPlatform, { nullable: true })
    @JoinColumn({ name: 'added_by_user_id' })
    added_by!: Relation<DRAUsersPlatform> | null;

    @Column({ type: 'int', nullable: true, name: 'added_by_user_id' })
    added_by_user_id!: number | null;
}
