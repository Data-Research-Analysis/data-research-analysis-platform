import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from 'typeorm';
import { DRAPaidMediaPlan } from './DRAPaidMediaPlan.js';
import { DRAPaidMediaPlanStep } from './DRAPaidMediaPlanStep.js';
import { PlanEventSeverity } from '../types/IPaidMediaPlan.js';

@Entity('dra_paid_media_plan_events')
export class DRAPaidMediaPlanEvent {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'plan_id' })
    plan_id!: number;

    @Column({ type: 'int', name: 'step_id', nullable: true })
    step_id!: number | null;

    @Column({ type: 'varchar', length: 64, name: 'event_type' })
    event_type!: string;

    @Column({ type: 'enum', enum: ['info', 'warn', 'error'], default: 'info' })
    severity!: PlanEventSeverity;

    @Column({ type: 'text' })
    message!: string;

    @Column({ type: 'jsonb', nullable: true })
    data!: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @ManyToOne(() => DRAPaidMediaPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan!: Relation<DRAPaidMediaPlan>;

    @ManyToOne(() => DRAPaidMediaPlanStep, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'step_id', referencedColumnName: 'id' })
    step!: Relation<DRAPaidMediaPlanStep> | null;
}
