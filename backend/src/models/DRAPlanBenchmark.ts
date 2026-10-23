import {
    Column,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { PlanBenchmarkMetric, PlanBenchmarkSource } from '../types/IPaidMediaPlan.js';

@Entity('dra_plan_benchmarks')
@Index('uq_plan_benchmarks_scope', ['industry', 'market', 'platform', 'metric', 'source'], { unique: true })
export class DRAPlanBenchmark {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 128 })
    industry!: string;

    @Column({ type: 'varchar', length: 64 })
    market!: string;

    @Column({ type: 'varchar', length: 64 })
    platform!: string;

    @Column({ type: 'enum', enum: ['cpc', 'cpm', 'ctr', 'cvr', 'cpl', 'roas', 'cpa'] })
    metric!: PlanBenchmarkMetric;

    @Column({ type: 'numeric', precision: 14, scale: 4 })
    value!: number;

    @Column({ type: 'int', name: 'sample_size', default: 0 })
    sample_size!: number;

    @Column({ type: 'enum', enum: ['learned', 'external', 'user'], default: 'learned' })
    source!: PlanBenchmarkSource;

    @Column({ type: 'numeric', precision: 6, scale: 4, default: 0 })
    confidence!: number;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;
}
