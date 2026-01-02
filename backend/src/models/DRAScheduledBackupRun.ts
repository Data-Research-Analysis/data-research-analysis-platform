import { 
    Column, 
    Entity, 
    JoinColumn, 
    ManyToOne, 
    PrimaryGeneratedColumn, 
    CreateDateColumn, 
    UpdateDateColumn,
    Relation 
} from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { EBackupTriggerType } from '../types/EBackupTriggerType.js';
import { EBackupRunStatus } from '../types/EBackupRunStatus.js';

/**
 * TypeORM Entity for Scheduled Backup Runs
 * Tracks the history of all database backup operations (scheduled and manual)
 */
@Entity('dra_scheduled_backup_runs')
export class DRAScheduledBackupRun {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ 
        type: 'varchar', 
        length: 255,
        nullable: true 
    })
    backup_id!: string | null;

    @Column({
        type: 'enum',
        enum: EBackupTriggerType,
        default: EBackupTriggerType.SCHEDULED
    })
    trigger_type!: EBackupTriggerType;

    @Column({
        type: 'enum',
        enum: EBackupRunStatus,
        default: EBackupRunStatus.QUEUED
    })
    status!: EBackupRunStatus;

    @Column({ 
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP'
    })
    started_at!: Date;

    @Column({ 
        type: 'timestamp',
        nullable: true
    })
    completed_at!: Date | null;

    @Column({ 
        type: 'text',
        nullable: true
    })
    error_message!: string | null;

    @Column({ 
        type: 'bigint',
        nullable: true
    })
    backup_size_bytes!: number | null;

    @Column({ 
        type: 'varchar',
        length: 512,
        nullable: true
    })
    backup_filepath!: string | null;

    @Column({ type: 'int' })
    triggered_by_user_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'triggered_by_user_id' })
    triggered_by_user!: Relation<DRAUsersPlatform>;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
