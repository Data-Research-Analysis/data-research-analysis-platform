import { Column, Entity, JoinColumn, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataSource } from './DRADataSource.js';
import { DRADashboard } from './DRADashboard.js';
import { DRAProjectMember } from './DRAProjectMember.js';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspace } from './DRAWorkspace.js';

/**
 * Project entity - organization-owned for multi-tenant architecture
 * 
 * REQUIRED: Every project must belong to an organization and workspace.
 * Legacy users_platform_id field kept for backward compatibility.
 * 
 * @see Issue #283: Multi-Tenant Organization Management
 * @see Phase 1 Migration: EnforceOrganizationWorkspacePhase1
 */
@Entity('dra_projects')
export class DRAProject {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 255 })
    name!: string
    @Column({ type: 'text', nullable: true })
    description!: string
    @Column({ type: 'timestamp', nullable: true })
    created_at!: Date

    // Legacy: Keep for migration compatibility (will become nullable after migration)
    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.projects, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: Relation<DRAUsersPlatform>
    
    // REQUIRED: Multi-tenant organization ownership (NOT NULL after Phase 1 migration)
    @ManyToOne(() => DRAOrganization, org => org.projects, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @ManyToOne(() => DRAWorkspace, workspace => workspace.projects, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspace_id' })
    workspace!: Relation<DRAWorkspace>;

    @Column({ type: 'int', name: 'workspace_id' })
    workspace_id!: number;

    @OneToMany(() => DRADataSource, (dataSource) => dataSource.project, { cascade: ["remove", "update"] })
    data_sources!: Relation<DRADataSource>[]

    @OneToMany(() => DRADashboard, (visualization) => visualization.project, { cascade: ["remove", "update"] })
    dashboards!: Relation<DRADashboard>[]

    @OneToMany(() => DRAProjectMember, (member) => member.project, { cascade: ["remove", "update"] })
    members!: Relation<DRAProjectMember>[]

}