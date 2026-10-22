import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Backfill missing workspace memberships for organization owners.
 *
 * The users->organizations migration (migrate-users-to-organizations.ts)
 * created organizations and their default workspaces but did not insert the
 * owner's row into dra_workspace_members. Affected orgs then failed the
 * workspaceContext membership check ("You do not have access to workspace ID N")
 * even for the owner.
 *
 * This backfill adds the active org owner as an admin member of every active
 * workspace in their organization where such a membership is missing.
 * Idempotent: guarded by NOT EXISTS / ON CONFLICT DO NOTHING.
 */
export class BackfillWorkspaceOwnerMemberships1796002000000 implements MigrationInterface {
    name = 'BackfillWorkspaceOwnerMemberships1796002000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "dra_workspace_members"
                ("workspace_id", "users_platform_id", "role", "is_active", "joined_at", "added_by_user_id")
            SELECT
                w."id",
                om."users_platform_id",
                'admin',
                true,
                NOW(),
                NULL
            FROM "dra_workspaces" w
            JOIN "dra_organization_members" om
                ON om."organization_id" = w."organization_id"
                AND om."role" = 'owner'
                AND om."is_active" = true
            WHERE w."is_active" = true
                AND NOT EXISTS (
                    SELECT 1 FROM "dra_workspace_members" wm
                    WHERE wm."workspace_id" = w."id"
                        AND wm."users_platform_id" = om."users_platform_id"
                )
            ON CONFLICT ("workspace_id", "users_platform_id") DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Data backfill — cannot cleanly revert; rows added here are identical
        // in shape to legitimately created owner memberships.
    }
}
