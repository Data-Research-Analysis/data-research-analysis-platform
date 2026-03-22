import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    Relation,
    UpdateDateColumn,
} from 'typeorm';
import { DRAProject } from './DRAProject.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRACampaignChannel } from './DRACampaignChannel.js';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspace } from './DRAWorkspace.js';

/**
 * Campaign entity for marketing attribution tracking
 * 
 * REQUIRED: Every campaign must belong to an organization and workspace.
 * Inherits organization_id and workspace_id from parent project.
 * 
 * @see Phase 1 Migration: EnforceOrganizationWorkspacePhase1
 */
@Entity('dra_campaigns')
export class DRACampaign {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'project_id' })
    project_id!: number;

    @Column({ type: 'int', name: 'created_by' })
    created_by!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 50 })
    objective!: string;

    @Column({ type: 'varchar', length: 20, default: 'draft' })
    status!: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
    budget_total!: number | null;

    @Column({ type: 'int', nullable: true })
    target_leads!: number | null;

    @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
    target_cpl!: number | null;

    @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
    target_roas!: number | null;

    @Column({ type: 'bigint', nullable: true })
    target_impressions!: number | null;

    @Column({ type: 'date', nullable: true })
    start_date!: Date | null;

    @Column({ type: 'date', nullable: true })
    end_date!: Date | null;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    // REQUIRED: Multi-tenant organization & workspace (inherited from project)
    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id' })
    organization!: Relation<DRAOrganization>;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @ManyToOne(() => DRAWorkspace, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspace_id' })
    workspace!: Relation<DRAWorkspace>;

    @Column({ type: 'int', name: 'workspace_id' })
    workspace_id!: number;

    @ManyToOne(() => DRAProject, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project!: Relation<DRAProject>;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'created_by' })
    creator!: Relation<DRAUsersPlatform>;

    @OneToMany(() => DRACampaignChannel, (ch) => ch.campaign, { cascade: ['remove'] })
    channels!: Relation<DRACampaignChannel>[];
}
