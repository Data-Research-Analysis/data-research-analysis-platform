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
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspace } from './DRAWorkspace.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAPaidMediaPlanStep } from './DRAPaidMediaPlanStep.js';
import {
    PlanMode,
    PlanStatus,
    PlanFunnelCoverage,
    PlanBuildMode,
    IPlanState,
} from '../types/IPaidMediaPlan.js';

@Entity('dra_paid_media_plans')
export class DRAPaidMediaPlan {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'project_id' })
    project_id!: number;

    @Column({ type: 'int', name: 'organization_id' })
    organization_id!: number;

    @Column({ type: 'int', name: 'workspace_id' })
    workspace_id!: number;

    @Column({ type: 'int', name: 'created_by' })
    created_by!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'varchar', length: 255 })
    slug!: string;

    @Column({ type: 'enum', enum: ['basic', 'advanced'], default: 'basic' })
    mode!: PlanMode;

    @Column({ type: 'enum', enum: ['draft', 'running', 'paused', 'completed', 'failed', 'archived'], default: 'draft' })
    status!: PlanStatus;

    @Column({ type: 'enum', enum: ['bofu', 'bofu_mofu', 'full_funnel'], default: 'bofu_mofu' })
    funnel_coverage!: PlanFunnelCoverage;

    @Column({ type: 'enum', enum: ['test_only', 'build_to_scale'], default: 'test_only' })
    build_mode!: PlanBuildMode;

    @Column({ type: 'jsonb', default: [] })
    platforms!: string[];

    @Column({ type: 'jsonb', default: [] })
    markets!: string[];

    @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
    budget_total!: number | null;

    @Column({ type: 'varchar', length: 3, default: 'USD' })
    currency!: string;

    @Column({ type: 'date', nullable: true })
    start_date!: Date | null;

    @Column({ type: 'date', nullable: true })
    end_date!: Date | null;

    @Column({ type: 'int', default: 0 })
    current_step!: number;

    @Column({ type: 'jsonb', default: {} })
    state!: IPlanState;

    @Column({ type: 'jsonb', default: {} })
    settings!: Record<string, any>;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    @ManyToOne(() => DRAProject, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
    project!: Relation<DRAProject>;

    @ManyToOne(() => DRAOrganization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
    organization!: Relation<DRAOrganization>;

    @ManyToOne(() => DRAWorkspace, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspace_id', referencedColumnName: 'id' })
    workspace!: Relation<DRAWorkspace>;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'created_by', referencedColumnName: 'id' })
    creator!: Relation<DRAUsersPlatform>;

    @OneToMany(() => DRAPaidMediaPlanStep, (step) => step.plan, { cascade: ['remove'] })
    steps!: Relation<DRAPaidMediaPlanStep>[];
}
