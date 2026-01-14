import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * RefactorInvitationTokens Migration
 * 
 * Moves invitation token management from dra_project_invitations.invitation_token
 * to the centralized dra_verification_codes table.
 * 
 * Steps:
 * 1. Add verification_code_id column (nullable FK)
 * 2. Migrate existing invitation tokens to verification_codes
 * 3. Drop invitation_token column
 * 
 * Rollback: Restores invitation_token column and migrates data back
 */
export class RefactorInvitationTokens1768246219648 implements MigrationInterface {
    name = 'RefactorInvitationTokens1768246219648'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Add verification_code_id column (nullable for migration)
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            ADD COLUMN "verification_code_id" integer
        `);

        // Step 2: Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            ADD CONSTRAINT "FK_project_invitations_verification_code" 
            FOREIGN KEY ("verification_code_id") 
            REFERENCES "dra_verification_codes"("id") 
            ON DELETE CASCADE
        `);

        // Step 3: Migrate existing pending invitations to verification_codes
        // Only migrate pending invitations that haven't expired
        await queryRunner.query(`
            INSERT INTO "dra_verification_codes" ("code", "expired_at", "users_platform_id")
            SELECT 
                inv.invitation_token,
                inv.expires_at,
                inv.invited_by_user_id
            FROM "dra_project_invitations" inv
            WHERE inv.status = 'pending' 
            AND inv.expires_at > NOW()
            AND inv.invitation_token IS NOT NULL
        `);

        // Step 4: Link invitations to their verification codes
        await queryRunner.query(`
            UPDATE "dra_project_invitations" inv
            SET verification_code_id = vc.id
            FROM "dra_verification_codes" vc
            WHERE inv.invitation_token = vc.code
            AND inv.status = 'pending'
            AND inv.expires_at > NOW()
        `);

        // Step 5: Drop the invitation_token column and its unique constraint
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            DROP COLUMN "invitation_token"
        `);

        // Step 6: Make verification_code_id NOT NULL for future records
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            ALTER COLUMN "verification_code_id" SET NOT NULL
        `);

        // Step 7: Add unique constraint on verification_code_id
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            ADD CONSTRAINT "UQ_project_invitations_verification_code" 
            UNIQUE ("verification_code_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Add invitation_token column back
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            ADD COLUMN "invitation_token" varchar(255)
        `);

        // Step 2: Restore invitation tokens from verification_codes
        await queryRunner.query(`
            UPDATE "dra_project_invitations" inv
            SET invitation_token = vc.code
            FROM "dra_verification_codes" vc
            WHERE inv.verification_code_id = vc.id
        `);

        // Step 3: Make invitation_token NOT NULL and UNIQUE
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            ALTER COLUMN "invitation_token" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            ADD CONSTRAINT "UQ_project_invitations_invitation_token" 
            UNIQUE ("invitation_token")
        `);

        // Step 4: Drop unique constraint on verification_code_id
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            DROP CONSTRAINT "UQ_project_invitations_verification_code"
        `);

        // Step 5: Drop foreign key
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            DROP CONSTRAINT "FK_project_invitations_verification_code"
        `);

        // Step 6: Drop verification_code_id column
        await queryRunner.query(`
            ALTER TABLE "dra_project_invitations" 
            DROP COLUMN "verification_code_id"
        `);

        // Step 7: Clean up orphaned verification codes (optional)
        await queryRunner.query(`
            DELETE FROM "dra_verification_codes" vc
            WHERE NOT EXISTS (
                SELECT 1 FROM "dra_project_invitations" inv
                WHERE inv.invitation_token = vc.code
            )
        `);
    }

}
