import { Column, Entity, JoinColumn, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataSource } from './DRADataSource.js';
import { DRADashboard } from './DRADashboard.js';
import { DRAProjectMember } from './DRAProjectMember.js';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspace } from './DRAWorkspace.js';

/**
 * Project entity - now organization-owned for multi-tenant architecture
 * 
 * MIGRATION NOTE: users_platform_id kept for backwards compatibility during migration.
 * After Phase 2 migration, all projects will have organization_id and workspace_id populated.
 * 
 * @see Issue #283: Multi-Tenant Organization Management
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
    
    // NEW: Multi-tenant organization ownership
    @ManyToOne(() => DRAOrganization, org => org.projects, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization> | null;

    @Column({ type: 'int', nullable: true, name: 'organization_id' })
    organization_id!: number | null;

    @ManyToOne(() => DRAWorkspace, workspace => workspace.projects, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'workspace_id' })
    workspace!: Relation<DRAWorkspace> | null;

    @Column({ type: 'int', nullable: true, name: 'workspace_id' })
    workspace_id!: number | null;

    @OneToMany(() => DRADataSource, (dataSource) => dataSource.project, { cascade: ["remove", "update"] })
    data_sources!: Relation<DRADataSource>[]

    @OneToMany(() => DRADashboard, (visualization) => visualization.project, { cascade: ["remove", "update"] })
    dashboards!: Relation<DRADashboard>[]

    @OneToMany(() => DRAProjectMember, (member) => member.project, { cascade: ["remove", "update"] })
    members!: Relation<DRAProjectMember>[]

}