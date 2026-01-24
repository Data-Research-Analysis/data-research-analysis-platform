import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewNotificationTypes1737742000000 implements MigrationInterface {
    name = 'AddNewNotificationTypes1737742000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new enum values to dra_notifications_type_enum
        await queryRunner.query(`
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'project_created';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'project_updated';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'project_deleted';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'project_shared';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'invitation_expired';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'invitation_cancelled';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_created';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_updated';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_deleted';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_connection_failed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_connection_restored';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_sync_started';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_sync_complete';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_sync_failed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_scheduled_sync_complete';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_scheduled_sync_failed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_source_sync_large_dataset';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'sync_schedule_enabled';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'sync_schedule_changed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'sync_schedule_disabled';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'oauth_token_expiring';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'oauth_token_expired';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_model_created';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_model_updated';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_model_deleted';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'data_model_query_failed';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'ai_conversation_started';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'ai_model_ready';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'ai_conversation_saved';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'ai_processing_error';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_created';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_updated';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_deleted';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_shared';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_comment';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_export_started';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_export_complete';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_export_failed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'dashboard_export_ready';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'account_created';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'account_update';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'email_verified';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'password_changed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'password_reset_requested';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'security_alert';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'tier_limit_reached';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'payment_received';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'payment_failed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'invoice_generated';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'scheduled_backup_complete';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'scheduled_backup_failed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'restore_started';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'restore_completed';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'restore_failed';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'user_created_by_admin';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'user_updated_by_admin';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'user_deleted_by_admin';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'user_role_changed';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'system_update';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'maintenance_scheduled';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'service_degradation';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'service_restored';
            
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'article_published';
            ALTER TYPE "public"."dra_notifications_type_enum" ADD VALUE IF NOT EXISTS 'article_updated';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: PostgreSQL doesn't support removing enum values directly
        // To rollback, you would need to:
        // 1. Create a new enum type without the new values
        // 2. Alter the column to use the new type
        // 3. Drop the old enum type
        // 4. Rename the new enum type
        
        console.log('Rollback of enum values not supported in PostgreSQL. Manual intervention required.');
    }
}
