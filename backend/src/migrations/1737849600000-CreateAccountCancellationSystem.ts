import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

/**
 * Migration: CreateAccountCancellationSystem
 * Creates tables for account cancellation management and platform settings
 * 
 * Tables created:
 * 1. dra_platform_settings - Stores configurable platform-wide settings (retention period, etc.)
 * 2. dra_account_cancellations - Tracks cancelled accounts and their deletion status
 */
export class CreateAccountCancellationSystem1737849600000 implements MigrationInterface {
    name = 'CreateAccountCancellationSystem1737849600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if dra_users_platform table exists
        const usersPlatformExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'dra_users_platform'
            );
        `);

        if (!usersPlatformExists[0].exists) {
            console.log('⚠️  Table dra_users_platform does not exist yet, skipping this migration');
            console.log('   This migration will be applied after CreateTables migration runs');
            return;
        }

        // Create dra_platform_settings table
        await queryRunner.createTable(
            new Table({
                name: "dra_platform_settings",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment"
                    },
                    {
                        name: "setting_key",
                        type: "varchar",
                        length: "100",
                        isUnique: true,
                        isNullable: false,
                        comment: "Unique identifier for the setting (e.g., 'data_retention_days')"
                    },
                    {
                        name: "setting_value",
                        type: "text",
                        isNullable: false,
                        comment: "Setting value stored as text (supports JSON for complex values)"
                    },
                    {
                        name: "setting_type",
                        type: "varchar",
                        length: "50",
                        isNullable: false,
                        default: "'string'",
                        comment: "Data type: string, number, boolean, json"
                    },
                    {
                        name: "description",
                        type: "text",
                        isNullable: true,
                        comment: "Human-readable description of what this setting controls"
                    },
                    {
                        name: "category",
                        type: "varchar",
                        length: "50",
                        isNullable: false,
                        default: "'general'",
                        comment: "Setting category: general, security, retention, notifications, etc."
                    },
                    {
                        name: "is_editable",
                        type: "boolean",
                        default: true,
                        comment: "Whether admins can edit this setting through the UI"
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()",
                        isNullable: false
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()",
                        isNullable: false
                    }
                ]
            }),
            true
        );

        // Create dra_account_cancellations table
        await queryRunner.createTable(
            new Table({
                name: "dra_account_cancellations",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment"
                    },
                    {
                        name: "users_platform_id",
                        type: "int",
                        isNullable: false,
                        comment: "Foreign key to dra_users_platform"
                    },
                    {
                        name: "cancellation_reason",
                        type: "text",
                        isNullable: true,
                        comment: "User-provided reason for cancellation"
                    },
                    {
                        name: "cancellation_reason_category",
                        type: "varchar",
                        length: "100",
                        isNullable: true,
                        comment: "Predefined category: too_expensive, missing_features, switching_service, etc."
                    },
                    {
                        name: "requested_at",
                        type: "timestamp",
                        default: "now()",
                        isNullable: false,
                        comment: "When the user requested cancellation"
                    },
                    {
                        name: "effective_at",
                        type: "timestamp",
                        isNullable: true,
                        comment: "When the cancellation becomes effective (end of billing period)"
                    },
                    {
                        name: "deletion_scheduled_at",
                        type: "timestamp",
                        isNullable: true,
                        comment: "Calculated date when data should be deleted (effective_at + retention_period)"
                    },
                    {
                        name: "status",
                        type: "varchar",
                        length: "50",
                        default: "'pending'",
                        isNullable: false,
                        comment: "Status: pending, active, data_deleted, reactivated"
                    },
                    {
                        name: "data_exported",
                        type: "boolean",
                        default: false,
                        comment: "Whether user has exported their data"
                    },
                    {
                        name: "data_export_timestamp",
                        type: "timestamp",
                        isNullable: true,
                        comment: "When the user last exported their data"
                    },
                    {
                        name: "data_deleted_at",
                        type: "timestamp",
                        isNullable: true,
                        comment: "When the data was actually deleted"
                    },
                    {
                        name: "deleted_by_admin_id",
                        type: "int",
                        isNullable: true,
                        comment: "If manually deleted by admin, reference to admin user"
                    },
                    {
                        name: "reactivated_at",
                        type: "timestamp",
                        isNullable: true,
                        comment: "If user reactivated, timestamp of reactivation"
                    },
                    {
                        name: "notification_7_days_sent",
                        type: "boolean",
                        default: false,
                        comment: "Whether 7-day reminder notification was sent"
                    },
                    {
                        name: "notification_1_day_sent",
                        type: "boolean",
                        default: false,
                        comment: "Whether 1-day reminder notification was sent"
                    },
                    {
                        name: "notification_deletion_sent",
                        type: "boolean",
                        default: false,
                        comment: "Whether deletion confirmation notification was sent"
                    },
                    {
                        name: "notes",
                        type: "text",
                        isNullable: true,
                        comment: "Admin notes or additional context"
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()",
                        isNullable: false
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()",
                        isNullable: false
                    }
                ]
            }),
            true
        );

        // Add foreign key constraint for users_platform_id
        await queryRunner.createForeignKey(
            "dra_account_cancellations",
            new TableForeignKey({
                columnNames: ["users_platform_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "dra_users_platform",
                onDelete: "CASCADE",
                name: "fk_account_cancellations_user"
            })
        );

        // Add foreign key constraint for deleted_by_admin_id
        await queryRunner.createForeignKey(
            "dra_account_cancellations",
            new TableForeignKey({
                columnNames: ["deleted_by_admin_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "dra_users_platform",
                onDelete: "SET NULL",
                name: "fk_account_cancellations_admin"
            })
        );

        // Create indexes for performance
        await queryRunner.query(`
            CREATE INDEX idx_account_cancellations_status ON dra_account_cancellations(status);
        `);
        
        await queryRunner.query(`
            CREATE INDEX idx_account_cancellations_deletion_scheduled ON dra_account_cancellations(deletion_scheduled_at);
        `);

        await queryRunner.query(`
            CREATE INDEX idx_account_cancellations_user_id ON dra_account_cancellations(users_platform_id);
        `);

        await queryRunner.query(`
            CREATE INDEX idx_platform_settings_key ON dra_platform_settings(setting_key);
        `);

        await queryRunner.query(`
            CREATE INDEX idx_platform_settings_category ON dra_platform_settings(category);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys first
        await queryRunner.dropForeignKey("dra_account_cancellations", "fk_account_cancellations_admin");
        await queryRunner.dropForeignKey("dra_account_cancellations", "fk_account_cancellations_user");

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS idx_platform_settings_category;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_platform_settings_key;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_account_cancellations_user_id;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_account_cancellations_deletion_scheduled;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_account_cancellations_status;`);

        // Drop tables
        await queryRunner.dropTable("dra_account_cancellations");
        await queryRunner.dropTable("dra_platform_settings");
    }
}
