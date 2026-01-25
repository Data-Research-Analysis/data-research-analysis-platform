import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Platform-wide settings that can be configured by administrators
 * Supports various data types and categorization
 */
@Entity('dra_platform_settings')
@Index(['setting_key'], { unique: true })
@Index(['category'])
export class DRAPlatformSettings {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 100, unique: true })
    setting_key!: string;

    @Column({ type: 'text' })
    setting_value!: string;

    @Column({ type: 'varchar', length: 50, default: 'string' })
    setting_type!: 'string' | 'number' | 'boolean' | 'json';

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 50, default: 'general' })
    category!: string;

    @Column({ type: 'boolean', default: true })
    is_editable!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}

/**
 * Enum for setting types
 */
export enum ESettingType {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    JSON = 'json'
}

/**
 * Enum for setting categories
 */
export enum ESettingCategory {
    GENERAL = 'general',
    SECURITY = 'security',
    RETENTION = 'retention',
    NOTIFICATIONS = 'notifications',
    BILLING = 'billing',
    FEATURES = 'features'
}

/**
 * Pre-defined setting keys for consistency
 */
export enum EPlatformSettingKey {
    DATA_RETENTION_DAYS = 'data_retention_days',
    AUTO_DELETE_ENABLED = 'auto_delete_enabled',
    SEND_CANCELLATION_EMAIL = 'send_cancellation_email',
    SEND_REMINDER_EMAILS = 'send_reminder_emails',
    ALLOW_REACTIVATION = 'allow_reactivation',
    NOTIFICATION_7_DAYS_ENABLED = 'notification_7_days_enabled',
    NOTIFICATION_1_DAY_ENABLED = 'notification_1_day_enabled',
    ALLOW_ACCOUNT_REACTIVATION = 'allow_account_reactivation',
    MAX_EXPORT_SIZE_MB = 'max_export_size_mb',
    MAINTENANCE_MODE = 'maintenance_mode',
    REGISTRATION_ENABLED = 'registration_enabled'
}
