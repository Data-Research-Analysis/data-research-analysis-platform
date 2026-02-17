import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Relation
} from 'typeorm';
import { DRAProject } from './DRAProject.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAAIInsightMessage } from './DRAAIInsightMessage.js';

@Entity('dra_ai_insight_reports')
export class DRAAIInsightReport {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'int', name: 'project_id' })
    project_id!: number;

    @Column({ type: 'int', name: 'user_id' })
    user_id!: number;

    @Column({ type: 'jsonb', name: 'data_source_ids' })
    data_source_ids!: number[];

    @Column({ type: 'jsonb', nullable: true, name: 'insights_summary' })
    insights_summary!: Record<string, any> | null;

    @Column({
        type: 'enum',
        enum: ['draft', 'saved', 'archived'],
        default: 'draft',
    })
    status!: 'draft' | 'saved' | 'archived';

    @Column({ type: 'timestamp', name: 'started_at', default: () => 'CURRENT_TIMESTAMP' })
    started_at!: Date;

    @Column({ type: 'timestamp', name: 'saved_at', nullable: true })
    saved_at!: Date | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updated_at!: Date;

    // Relations
    @ManyToOne(() => DRAProject, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
    project!: Relation<DRAProject>;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
    user!: Relation<DRAUsersPlatform>;

    @OneToMany(() => DRAAIInsightMessage, (message) => message.report)
    messages!: Relation<DRAAIInsightMessage>[];
}
