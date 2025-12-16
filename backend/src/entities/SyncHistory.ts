import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DRADataSource } from '../models/DRADataSource.js';

export enum SyncStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    PARTIAL = 'PARTIAL',
}

export enum SyncType {
    FULL = 'FULL',
    INCREMENTAL = 'INCREMENTAL',
    MANUAL = 'MANUAL',
    SCHEDULED = 'SCHEDULED',
}

@Entity('sync_history')
export class SyncHistory {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'integer', name: 'data_source_id' })
    dataSourceId!: number;

    @ManyToOne(() => DRADataSource, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'data_source_id' })
    dataSource!: DRADataSource;

    @Column({
        type: 'varchar',
        length: 50,
        name: 'sync_type',
    })
    syncType!: SyncType;

    @Column({
        type: 'varchar',
        length: 20,
    })
    status!: SyncStatus;

    @Column({
        type: 'timestamp',
        name: 'started_at',
        default: () => 'CURRENT_TIMESTAMP',
    })
    startedAt!: Date;

    @Column({
        type: 'timestamp',
        name: 'completed_at',
        nullable: true,
    })
    completedAt?: Date;

    @Column({
        type: 'integer',
        name: 'duration_ms',
        nullable: true,
    })
    durationMs?: number;

    @Column({
        type: 'integer',
        name: 'records_synced',
        default: 0,
    })
    recordsSynced!: number;

    @Column({
        type: 'integer',
        name: 'records_failed',
        default: 0,
    })
    recordsFailed!: number;

    @Column({
        type: 'text',
        name: 'error_message',
        nullable: true,
    })
    errorMessage?: string;

    @Column({
        type: 'jsonb',
        nullable: true,
    })
    metadata?: Record<string, any>;

    @CreateDateColumn({
        type: 'timestamp',
        name: 'created_at',
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt!: Date;
}
