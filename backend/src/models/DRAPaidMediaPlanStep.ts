import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
    UpdateDateColumn,
} from 'typeorm';
import { DRAPaidMediaPlan } from './DRAPaidMediaPlan.js';
import { PlanStepStatus, IPlanGate, IPlanRunMeta } from '../types/IPaidMediaPlan.js';

@Entity('dra_paid_media_plan_steps')
export class DRAPaidMediaPlanStep {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'plan_id' })
    plan_id!: number;

    @Column({ type: 'int', name: 'step_number' })
    step_number!: number;

    @Column({ type: 'varchar', length: 64, name: 'step_key' })
    step_key!: string;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'enum', enum: ['pending', 'running', 'waiting_for_input', 'completed', 'failed', 'skipped'], default: 'pending' })
    status!: PlanStepStatus;

    @Column({ type: 'timestamp', name: 'started_at', nullable: true })
    started_at!: Date | null;

    @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
    completed_at!: Date | null;

    @Column({ type: 'int', name: 'duration_ms', nullable: true })
    duration_ms!: number | null;

    @Column({ type: 'int', default: 0 })
    attempts!: number;

    @Column({ type: 'text', nullable: true })
    error!: string | null;

    @Column({ type: 'text', name: 'output_summary', nullable: true })
    output_summary!: string | null;

    @Column({ type: 'jsonb', nullable: true })
    gate!: IPlanGate | null;

    @Column({ type: 'jsonb', name: 'run_meta', nullable: true })
    run_meta!: IPlanRunMeta | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    @ManyToOne(() => DRAPaidMediaPlan, (plan) => plan.steps, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan!: Relation<DRAPaidMediaPlan>;
}
