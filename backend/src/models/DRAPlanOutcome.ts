import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from 'typeorm';
import { DRAPaidMediaPlan } from './DRAPaidMediaPlan.js';
import { DRACampaign } from './DRACampaign.js';
import { PlanOutcomeSource } from '../types/IPaidMediaPlan.js';

@Entity('dra_plan_outcomes')
@Index('idx_plan_outcomes_plan_id', ['plan_id'])
export class DRAPlanOutcome {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'plan_id' })
    plan_id!: number;

    @Column({ type: 'int', name: 'campaign_id', nullable: true })
    campaign_id!: number | null;

    @Column({ type: 'varchar', length: 64, name: 'channel_type', nullable: true })
    channel_type!: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    market!: string | null;

    @Column({ type: 'date', name: 'period_start', nullable: true })
    period_start!: Date | null;

    @Column({ type: 'date', name: 'period_end', nullable: true })
    period_end!: Date | null;

    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    spend!: number;

    @Column({ type: 'bigint', default: 0 })
    impressions!: number;

    @Column({ type: 'int', default: 0 })
    clicks!: number;

    @Column({ type: 'int', default: 0 })
    conversions!: number;

    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    revenue!: number;

    @Column({ type: 'enum', enum: ['platform_sync', 'manual', 'offline'], default: 'platform_sync' })
    source!: PlanOutcomeSource;

    @Column({ type: 'jsonb', nullable: true })
    raw!: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @ManyToOne(() => DRAPaidMediaPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan!: Relation<DRAPaidMediaPlan>;

    @ManyToOne(() => DRACampaign, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'campaign_id', referencedColumnName: 'id' })
    campaign!: Relation<DRACampaign> | null;
}
