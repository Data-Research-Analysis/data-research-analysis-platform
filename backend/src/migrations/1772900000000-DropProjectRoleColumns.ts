import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the legacy `role` column and associated enum types from
 * dra_project_members and dra_project_invitations.
 *
 * After this migration the authoritative permission system is
 * dra_project_members.marketing_role ('analyst' | 'manager' | 'cmo').
 * Project ownership continues to be detected via dra_projects.users_platform_id.
 */
export class DropProjectRoleColumns1772900000000 implements MigrationInterface {
    name = 'DropProjectRoleColumns1772900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop role column from project members
        await queryRunner.query(`
            ALTER TABLE dra_project_members
            DROP COLUMN IF EXISTS role
        `);

        // 2. Drop role column from project invitations
        await queryRunner.query(`
            ALTER TABLE dra_project_invitations
            DROP COLUMN IF EXISTS role
        `);

        // 3. Drop the now-unused enum types
        await queryRunner.query(`
            DROP TYPE IF EXISTS "public"."dra_project_members_role_enum" CASCADE
        `);

        await queryRunner.query(`
            DROP TYPE IF EXISTS "public"."dra_project_invitations_role_enum" CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate enum types
        await queryRunner.query(`
            CREATE TYPE "public"."dra_project_members_role_enum"
            AS ENUM('owner', 'admin', 'editor', 'viewer')
        `);

        await queryRunner.query(`
            CREATE TYPE "public"."dra_project_invitations_role_enum"
            AS ENUM('owner', 'admin', 'editor', 'viewer')
        `);

        // Restore columns with a safe default derived from marketing_role
        await queryRunner.query(`
            ALTER TABLE dra_project_members
            ADD COLUMN role "public"."dra_project_members_role_enum" NOT NULL DEFAULT 'editor'
        `);

        await queryRunner.query(`
            ALTER TABLE dra_project_invitations
            ADD COLUMN role "public"."dra_project_invitations_role_enum" NOT NULL DEFAULT 'editor'
        `);

        // Back-fill role from marketing_role for project members
        await queryRunner.query(`
            UPDATE dra_project_members
            SET role = CASE
                WHEN marketing_role = 'analyst' THEN 'admin'::"public"."dra_project_members_role_enum"
                WHEN marketing_role = 'manager' THEN 'editor'::"public"."dra_project_members_role_enum"
                ELSE 'viewer'::"public"."dra_project_members_role_enum"
            END
        `);

        // Back-fill for project invitations
        await queryRunner.query(`
            UPDATE dra_project_invitations
            SET role = CASE
                WHEN marketing_role = 'analyst' THEN 'admin'::"public"."dra_project_invitations_role_enum"
                WHEN marketing_role = 'manager' THEN 'editor'::"public"."dra_project_invitations_role_enum"
                ELSE 'viewer'::"public"."dra_project_invitations_role_enum"
            END
        `);
    }
}
