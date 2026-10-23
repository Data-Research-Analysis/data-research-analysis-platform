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
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAOrganization } from './DRAOrganization.js';
import { DRAWorkspace } from './DRAWorkspace.js';
import { DRAProject } from './DRAProject.js';
import { DRAPaidMediaPlan } from './DRAPaidMediaPlan.js';

@Entity('dra_product_events')
@Index('idx_product_events_event_name_created_at', ['event_name', 'created_at'])
@Index('idx_product_events_plan_id', ['plan_id'])
@Index('idx_product_events_project_id', ['project_id'])
export class DRAProductEvent {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'user_id', nullable: true })
    user_id!: number | null;

    @Column({ type: 'int', name: 'organization_id', nullable: true })
    organization_id!: number | null;

    @Column({ type: 'int', name: 'workspace_id', nullable: true })
    workspace_id!: number | null;

    @Column({ type: 'int', name: 'project_id', nullable: true })
    project_id!: number | null;

    @Column({ type: 'int', name: 'plan_id', nullable: true })
    plan_id!: number | null;

    @Column({ type: 'varchar', length: 128, name: 'event_name' })
    event_name!: string;

    @Column({ type: 'jsonb', nullable: true })
    properties!: Record<string, any> | null;

    @Column({ type: 'varchar', length: 64, name: 'session_id', nullable: true })
    session_id!: string | null;

    @Column({ type: 'enum', enum: ['backend', 'frontend'], default: 'frontend' })
    source!: 'backend' | 'frontend';

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
    user!: Relation<DRAUsersPlatform> | null;

    @ManyToOne(() => DRAOrganization, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'organization_id', referencedColumnName: 'id' })
    organization!: Relation<DRAOrganization> | null;

    @ManyToOne(() => DRAWorkspace, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'workspace_id', referencedColumnName: 'id' })
    workspace!: Relation<DRAWorkspace> | null;

    @ManyToOne(() => DRAProject, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
    project!: Relation<DRAProject> | null;

    @ManyToOne(() => DRAPaidMediaPlan, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan!: Relation<DRAPaidMediaPlan> | null;
}
