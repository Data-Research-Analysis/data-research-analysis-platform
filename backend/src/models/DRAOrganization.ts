import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    OneToOne,
    Relation
} from 'typeorm';
import { DRAWorkspace } from './DRAWorkspace.js';
import { DRAOrganizationMember } from './DRAOrganizationMember.js';
import { DRAOrganizationSubscription } from './DRAOrganizationSubscription.js';
import { DRAProject } from './DRAProject.js';

/**
 * Organization entity for multi-tenant architecture
 * 
 * Organizations own all data (projects, data sources, models, dashboards).
 * Users can belong to multiple organizations (consultant use case).
 * Each organization has one subscription that covers all members.
 * 
 * Even FREE/STARTER single-user plans get a personal organization with max_members=1.
 * This provides a unified architecture with seamless upgrade paths.
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 */
@Entity('dra_organizations')
export class DRAOrganization {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
    slug!: string | null;  // URL-friendly identifier

    @Column({ type: 'varchar', length: 255, nullable: true })
    domain!: string | null;  // For auto-join (e.g., users@acme.com → Acme Corp org)

    @Column({ type: 'text', nullable: true })
    logo_url!: string | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'jsonb', default: {} })
    settings!: Record<string, any>;  // Org-wide preferences, branding, API keys

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    // Relations
    @OneToMany(() => DRAWorkspace, workspace => workspace.organization, { cascade: ['remove', 'update'] })
    workspaces!: Relation<DRAWorkspace>[];

    @OneToMany(() => DRAOrganizationMember, member => member.organization, { cascade: ['remove', 'update'] })
    members!: Relation<DRAOrganizationMember>[];

    @OneToOne(() => DRAOrganizationSubscription, subscription => subscription.organization)
    subscription!: Relation<DRAOrganizationSubscription>;

    @OneToMany(() => DRAProject, project => project.organization)
    projects!: Relation<DRAProject>[];
}
