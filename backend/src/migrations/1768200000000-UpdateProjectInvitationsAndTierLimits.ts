import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProjectInvitationsAndTierLimits1768200000000 implements MigrationInterface {
    name = 'UpdateProjectInvitationsAndTierLimits1768200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Ensure 'accepted_at' column exists (was in original migration)
        const hasAcceptedAtColumn = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='dra_project_invitations' 
            AND column_name='accepted_at'
        `);
        
        if (hasAcceptedAtColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "dra_project_invitations" 
                ADD COLUMN "accepted_at" TIMESTAMP
            `);
        }

        // 2. Drop the old 'accepted' boolean column if it exists
        const hasAcceptedColumn = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='dra_project_invitations' 
            AND column_name='accepted'
        `);
        
        if (hasAcceptedColumn.length > 0) {
            await queryRunner.query(`ALTER TABLE "dra_project_invitations" DROP COLUMN "accepted"`);
        }

        // 3. Add 'status' column if it doesn't exist
        const hasStatusColumn = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='dra_project_invitations' 
            AND column_name='status'
        `);
        
        if (hasStatusColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "dra_project_invitations" 
                ADD COLUMN "status" character varying(20) NOT NULL DEFAULT 'pending'
            `);
        }

        // 4. Add unique constraint on (project_id, invited_email, status)
        // First, check if old constraint exists and drop it
        const existingConstraints = await queryRunner.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name='dra_project_invitations' 
            AND constraint_type='UNIQUE'
        `);

        for (const constraint of existingConstraints) {
            if (constraint.constraint_name && 
                constraint.constraint_name !== 'UQ_15d26ea3c1270f06c14df540762') { // Keep token constraint
                await queryRunner.query(`
                    ALTER TABLE "dra_project_invitations" 
                    DROP CONSTRAINT "${constraint.constraint_name}"
                `);
            }
        }

        // Add new unique constraint
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_project_email_status" 
            ON "dra_project_invitations" ("project_id", "invited_email", "status")
            WHERE "status" = 'pending'
        `);

        // 5. Add max_members_per_project to subscription_tiers if it doesn't exist
        const hasMembersColumn = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='dra_subscription_tiers' 
            AND column_name='max_members_per_project'
        `);
        
        if (hasMembersColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "dra_subscription_tiers" 
                ADD COLUMN "max_members_per_project" integer
            `);
        }

        // 6. Set tier limits for max_members_per_project
        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "max_members_per_project" = 3 WHERE "tier_name" = 'free'`);
        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "max_members_per_project" = 10 WHERE "tier_name" = 'pro'`);
        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "max_members_per_project" = 50 WHERE "tier_name" = 'team'`);
        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "max_members_per_project" = NULL WHERE "tier_name" IN ('business', 'enterprise')`);

        // 7. Create index on status and expires_at for efficient queries
        await queryRunner.query(`
            CREATE INDEX "IDX_invitations_status_expires" 
            ON "dra_project_invitations" ("status", "expires_at")
        `);

        // 8. Create index on invited_email for user lookup
        await queryRunner.query(`
            CREATE INDEX "IDX_invitations_email" 
            ON "dra_project_invitations" ("invited_email")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invitations_email"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invitations_status_expires"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_project_email_status"`);

        // Remove max_members_per_project column
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "max_members_per_project"`);

        // Revert status column to accepted boolean
        await queryRunner.query(`ALTER TABLE "dra_project_invitations" DROP COLUMN IF EXISTS "status"`);
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            ADD COLUMN "accepted" boolean NOT NULL DEFAULT false
        `);
    }
}
