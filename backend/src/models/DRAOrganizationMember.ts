import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
    Relation
} from 'typeorm';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

/**
 * Organization member entity for multi-tenant access control
 * 
 * Tracks which users belong to which organizations and their role within the org.
 * Users can belong to multiple organizations (consultant/contractor use case).
 * 
 * Roles:
 * - owner: Full control, billing management, can delete org
 * - admin: Can manage members, workspaces, settings (no billing)
 * - member: Can access permitted workspaces/projects
 * 
 * Single-user plans (FREE/STARTER) have exactly 1 member (the owner).
 * Multi-user plans enforce subscription.max_members limit.
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */
@Entity('dra_organization_members')
@Unique(['organization', 'user'])  // One membership per user per org
export class DRAOrganizationMember {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAOrganization, org => org.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({ type: 'int', name: 'users_platform_id' })
    users_platform_id!: number;

    @Column({
        type: 'enum',
        enum: ['owner', 'admin', 'member'],
        default: 'member'
    })
    role!: 'owner' | 'admin' | 'member';

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    joined_at!: Date;

    @ManyToOne(() => DRAUsersPlatform, { nullable: true })
    @JoinColumn({ name: 'invited_by_user_id' })
    invited_by!: Relation<DRAUsersPlatform> | null;

    @Column({ type: 'int', nullable: true, name: 'invited_by_user_id' })
    invited_by_user_id!: number | null;
}
