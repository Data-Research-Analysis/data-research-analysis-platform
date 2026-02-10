import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Relation } from 'typeorm';
import { DRADataSource } from './DRADataSource.js';

/**
 * Entity for tracking MongoDB sync operations
 * Records sync history for each collection import operation
 */
@Entity('dra_mongodb_sync_history')
export class DRAMongoDBSyncHistory {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'integer' })
    data_source_id!: number;

    @ManyToOne(() => DRADataSource, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_source_id' })
    dataSource!: Relation<DRADataSource>;

    @Column({ type: 'varchar', length: 100 })
    collection_name!: string;

    @Column({ type: 'varchar', length: 100 })
    table_name!: string; // PostgreSQL table name in dra_mongodb schema

    @Column({ type: 'varchar', length: 50 })
    sync_type!: string; // 'full' | 'incremental'

    @Column({ type: 'varchar', length: 50 })
    status!: string; // 'in_progress' | 'completed' | 'failed'

    @Column({ type: 'integer', default: 0 })
    records_synced!: number;

    @Column({ type: 'integer', default: 0 })
    records_failed!: number;

    @CreateDateColumn()
    started_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    completed_at!: Date | null;

    @Column({ type: 'text', nullable: true })
    error_message!: string | null;

    @Column({ type: 'jsonb', nullable: true })
    sync_metadata!: Record<string, any> | null; // Last sync timestamps, filters, etc.
}
