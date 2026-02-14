import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { DRADataSource } from './DRADataSource.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

@Entity('dra_ai_join_suggestions')
@Index('IDX_AI_JOIN_DATA_SOURCE', ['data_source_id'])
@Index('IDX_AI_JOIN_SCHEMA_HASH', ['data_source_id', 'schema_hash'])
@Index('IDX_AI_JOIN_TABLES', ['data_source_id', 'left_table', 'right_table'])
@Index('IDX_AI_JOIN_CONFIDENCE', ['confidence_score'])
export class DRAAIJoinSuggestion {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('int')
    data_source_id!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    schema_name?: string;

    @Column({ type: 'varchar', length: 64 })
    schema_hash!: string;

    @Column({ type: 'varchar', length: 255 })
    left_table!: string;

    @Column({ type: 'varchar', length: 255 })
    left_column!: string;

    @Column({ type: 'varchar', length: 255 })
    right_table!: string;

    @Column({ type: 'varchar', length: 255 })
    right_column!: string;

    @Column({ type: 'varchar', length: 50 })
    suggested_join_type!: string;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    confidence_score!: number;

    @Column({ type: 'text', nullable: true })
    reasoning?: string;

    @Column({ type: 'boolean', default: false })
    is_junction_table!: boolean;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, any>;

    @Column('int')
    created_by_user_id!: number;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    // Relations
    @ManyToOne(() => DRADataSource, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_source_id' })
    data_source!: DRADataSource;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'created_by_user_id' })
    created_by_user!: DRAUsersPlatform;
}
