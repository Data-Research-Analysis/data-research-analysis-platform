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
import { PlanMessageRole } from '../types/IPaidMediaPlan.js';

@Entity('dra_paid_media_plan_messages')
export class DRAPaidMediaPlanMessage {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'plan_id' })
    plan_id!: number;

    @Column({ type: 'int', name: 'step_id', nullable: true })
    step_id!: number | null;

    @Column({ type: 'enum', enum: ['user', 'assistant', 'system', 'tool'] })
    role!: PlanMessageRole;

    @Column({ type: 'text' })
    content!: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata!: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @ManyToOne(() => DRAPaidMediaPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan!: Relation<DRAPaidMediaPlan>;

    @ManyToOne(() => DRAPaidMediaPlanStep, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'step_id', referencedColumnName: 'id' })
    step!: Relation<DRAPaidMediaPlanStep> | null;
}
