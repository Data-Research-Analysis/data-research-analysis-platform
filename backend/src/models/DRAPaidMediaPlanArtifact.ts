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
import { DRAPaidMediaPlanStep } from './DRAPaidMediaPlanStep.js';
import { PlanArtifactKind, PlanArtifactSource } from '../types/IPaidMediaPlan.js';

@Entity('dra_paid_media_plan_artifacts')
export class DRAPaidMediaPlanArtifact {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'plan_id' })
    plan_id!: number;

    @Column({ type: 'int', name: 'step_id', nullable: true })
    step_id!: number | null;

    @Column({ type: 'varchar', length: 64, name: 'artifact_key' })
    artifact_key!: string;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'enum', enum: ['markdown', 'json', 'csv', 'xlsx', 'pptx', 'html', 'image'] })
    kind!: PlanArtifactKind;

    @Column({ type: 'varchar', length: 128, name: 'mime_type' })
    mime_type!: string;

    @Column({ type: 'text', nullable: true })
    content!: string | null;

    @Column({ type: 'varchar', length: 1024, name: 'storage_key', nullable: true })
    storage_key!: string | null;

    @Column({ type: 'int', name: 'byte_size', default: 0 })
    byte_size!: number;

    @Column({ type: 'int', default: 1 })
    version!: number;

    @Column({ type: 'boolean', name: 'is_current', default: true })
    is_current!: boolean;

    @Column({ type: 'enum', enum: ['ai', 'user_edited', 'uploaded'], default: 'ai' })
    source!: PlanArtifactSource;

    @Column({ type: 'jsonb', nullable: true })
    metadata!: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    @ManyToOne(() => DRAPaidMediaPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan!: Relation<DRAPaidMediaPlan>;

    @ManyToOne(() => DRAPaidMediaPlanStep, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'step_id', referencedColumnName: 'id' })
    step!: Relation<DRAPaidMediaPlanStep> | null;
}
