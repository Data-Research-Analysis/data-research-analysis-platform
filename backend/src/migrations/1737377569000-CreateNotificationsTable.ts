import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationsTable1737377569000 implements MigrationInterface {
    name = 'CreateNotificationsTable1737377569000'

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

        // Create notification type enum
        await queryRunner.query(`
            CREATE TYPE "public"."dra_notifications_type_enum" AS ENUM(
                'project_invitation',
                'project_member_added',
                'project_member_removed',
                'project_role_changed',
                'invitation_accepted',
                'invitation_declined',
                'subscription_assigned',
                'subscription_upgraded',
                'subscription_downgraded',
                'subscription_expiring',
                'subscription_expired',
                'backup_completed',
                'backup_failed'
            )
        `);

        // Create dra_notifications table
        await queryRunner.query(`
            CREATE TABLE "dra_notifications" (
                "id" SERIAL NOT NULL,
                "users_platform_id" integer NOT NULL,
                "type" "public"."dra_notifications_type_enum" NOT NULL,
                "title" character varying(255) NOT NULL,
                "message" text NOT NULL,
                "link" character varying(512),
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "is_read" boolean NOT NULL DEFAULT false,
                "read_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "expires_at" TIMESTAMP,
                CONSTRAINT "PK_dra_notifications" PRIMARY KEY ("id")
            )
        `);

        // Create foreign key to dra_users_platform
        await queryRunner.query(`
            ALTER TABLE "dra_notifications" 
            ADD CONSTRAINT "FK_dra_notifications_users_platform" 
            FOREIGN KEY ("users_platform_id") 
            REFERENCES "dra_users_platform"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);

        // Create indexes for performance
        await queryRunner.query(`
            CREATE INDEX "idx_notifications_user" 
            ON "dra_notifications" ("users_platform_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_notifications_user_read" 
            ON "dra_notifications" ("users_platform_id", "is_read")
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_notifications_created" 
            ON "dra_notifications" ("created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_notifications_type" 
            ON "dra_notifications" ("type")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "public"."idx_notifications_type"`);
        await queryRunner.query(`DROP INDEX "public"."idx_notifications_created"`);
        await queryRunner.query(`DROP INDEX "public"."idx_notifications_user_read"`);
        await queryRunner.query(`DROP INDEX "public"."idx_notifications_user"`);

        // Drop foreign key
        await queryRunner.query(`
            ALTER TABLE "dra_notifications" 
            DROP CONSTRAINT "FK_dra_notifications_users_platform"
        `);

        // Drop table
        await queryRunner.query(`DROP TABLE "dra_notifications"`);

        // Drop enum type
        await queryRunner.query(`DROP TYPE "public"."dra_notifications_type_enum"`);
    }
}
