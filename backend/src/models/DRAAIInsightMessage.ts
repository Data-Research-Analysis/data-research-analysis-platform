import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Relation
} from 'typeorm';
import { DRAAIInsightReport } from './DRAAIInsightReport.js';

@Entity('dra_ai_insight_messages')
export class DRAAIInsightMessage {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'report_id' })
    report_id!: number;

    @Column({
        type: 'enum',
        enum: ['user', 'assistant', 'system'],
    })
    role!: 'user' | 'assistant' | 'system';

    @Column({ type: 'text' })
    content!: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata!: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    // Relations
    @ManyToOne(() => DRAAIInsightReport, (report) => report.messages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'report_id', referencedColumnName: 'id' })
    report!: Relation<DRAAIInsightReport>;
}
