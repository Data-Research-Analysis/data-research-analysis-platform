import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, CreateDateColumn } from 'typeorm';
import { DRADataModel } from './DRADataModel.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataSource } from './DRADataSource.js';

@Entity('dra_data_model_refresh_history')
export class DRADataModelRefreshHistory {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: 'varchar', length: 20, name: 'status' })
    status!: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

    @Column({ type: 'timestamp', name: 'started_at', default: () => 'NOW()' })
    started_at!: Date

    @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
    completed_at?: Date

    @Column({ type: 'int', nullable: true, name: 'duration_ms' })
    duration_ms?: number

    @Column({ type: 'int', nullable: true, name: 'rows_before' })
    rows_before?: number

    @Column({ type: 'int', nullable: true, name: 'rows_after' })
    rows_after?: number

    @Column({ type: 'int', nullable: true, name: 'rows_changed' })
    rows_changed?: number

    @Column({ type: 'varchar', length: 50, name: 'triggered_by' })
    triggered_by!: 'user' | 'cascade' | 'schedule' | 'api'

    @Column({ type: 'text', nullable: true })
    reason?: string

    @Column({ type: 'text', nullable: true, name: 'error_message' })
    error_message?: string

    @Column({ type: 'text', nullable: true, name: 'error_stack' })
    error_stack?: string

    @Column({ type: 'text', nullable: true, name: 'query_executed' })
    query_executed?: string

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date

    // Relations
    @ManyToOne(() => DRADataModel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_model_id', referencedColumnName: 'id' })
    data_model!: Relation<DRADataModel>

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'trigger_user_id', referencedColumnName: 'id' })
    trigger_user?: Relation<DRAUsersPlatform>

    @ManyToOne(() => DRADataSource, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'trigger_source_id', referencedColumnName: 'id' })
    trigger_source?: Relation<DRADataSource>
}
