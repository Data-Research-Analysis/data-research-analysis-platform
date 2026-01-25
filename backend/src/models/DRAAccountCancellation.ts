import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

/**
 * Tracks account cancellation requests and manages the data deletion lifecycle
 */
@Entity('dra_account_cancellations')
@Index(['status'])
@Index(['deletion_scheduled_at'])
export class DRAAccountCancellation {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'integer' })
    @Index()
    users_platform_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    users_platform!: Relation<DRAUsersPlatform>;

    @Column({ type: 'text', nullable: true })
    cancellation_reason!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    cancellation_reason_category!: string | null;

    @CreateDateColumn()
    requested_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    effective_at!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    deletion_scheduled_at!: Date | null;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status!: ECancellationStatus;

    @Column({ type: 'boolean', default: false })
    data_exported!: boolean;

    @Column({ type: 'timestamp', nullable: true })
    data_export_timestamp!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    data_deleted_at!: Date | null;

    @ManyToOne(() => DRAUsersPlatform, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'deleted_by_admin_id' })
    deleted_by_admin!: Relation<DRAUsersPlatform> | null;

    @Column({ type: 'timestamp', nullable: true })
    reactivated_at!: Date | null;

    @Column({ type: 'boolean', default: false })
    notification_7_days_sent!: boolean;

    @Column({ type: 'boolean', default: false })
    notification_1_day_sent!: boolean;

    @Column({ type: 'boolean', default: false })
    notification_deletion_sent!: boolean;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}

/**
 * Cancellation status enum
 */
export enum ECancellationStatus {
    PENDING = 'pending',           // Cancellation requested, waiting for effective date
    ACTIVE = 'active',             // Cancellation effective, in retention period
    DATA_DELETED = 'data_deleted', // Data has been permanently deleted
    REACTIVATED = 'reactivated'    // User reactivated before deletion
}

/**
 * Cancellation reason categories for analytics
 */
export enum ECancellationReasonCategory {
    TOO_EXPENSIVE = 'too_expensive',
    MISSING_FEATURES = 'missing_features',
    SWITCHING_SERVICE = 'switching_service',
    TOO_COMPLEX = 'too_complex',
    POOR_PERFORMANCE = 'poor_performance',
    TECHNICAL_ISSUES = 'technical_issues',
    NO_LONGER_NEEDED = 'no_longer_needed',
    OTHER = 'other'
}
