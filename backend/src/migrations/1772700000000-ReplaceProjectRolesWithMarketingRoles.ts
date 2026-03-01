import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills marketing_role on dra_project_members from the legacy role column,
 * then adds a NOT NULL constraint and a CHECK constraint for allowed values.
 *
 * Role mapping:
 *   owner  → analyst
 *   admin  → analyst
 *   editor → manager
 *   viewer → cmo
 *   (any other / NULL) → cmo (safe default)
 *
 * Also ensures the project creator (dra_projects.users_platform_id) has an
 * analyst entry in dra_project_members, in case it was never backfilled.
 */
export class ReplaceProjectRolesWithMarketingRoles1772700000000 implements MigrationInterface {
    name = 'ReplaceProjectRolesWithMarketingRoles1772700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Backfill marketing_role from legacy role values for rows that have no marketing_role yet
        await queryRunner.query(`
            UPDATE dra_project_members
            SET marketing_role = CASE
                WHEN role = 'owner'  THEN 'analyst'
                WHEN role = 'admin'  THEN 'analyst'
                WHEN role = 'editor' THEN 'manager'
                WHEN role = 'viewer' THEN 'cmo'
                ELSE 'cmo'
            END
            WHERE marketing_role IS NULL
        `);

        // 2. Set remaining NULLs (shouldn't exist after step 1, but be safe)
        await queryRunner.query(`
            UPDATE dra_project_members
            SET marketing_role = 'cmo'
            WHERE marketing_role IS NULL
        `);

        // 3. Set a column DEFAULT so future INSERTs without a value get 'cmo'
        await queryRunner.query(`
            ALTER TABLE dra_project_members
            ALTER COLUMN marketing_role SET DEFAULT 'cmo'
        `);

        // 4. Apply NOT NULL constraint
        await queryRunner.query(`
            ALTER TABLE dra_project_members
            ALTER COLUMN marketing_role SET NOT NULL
        `);

        // 5. Add CHECK constraint for the three allowed values
        await queryRunner.query(`
            ALTER TABLE dra_project_members
            ADD CONSTRAINT chk_marketing_role
            CHECK (marketing_role IN ('analyst', 'manager', 'cmo'))
        `);

        // 6. Ensure the project creator has an analyst entry.
        //    Covers projects whose creator was never added to dra_project_members.
        const projectMembersTableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'dra_project_members'
            )
        `);
        if (projectMembersTableExists[0].exists) {
            await queryRunner.query(`
                INSERT INTO dra_project_members
                    (project_id, users_platform_id, role, marketing_role, added_at)
                SELECT
                    p.id,
                    p.users_platform_id,
                    'owner',
                    'analyst',
                    NOW()
                FROM dra_projects p
                WHERE NOT EXISTS (
                    SELECT 1 FROM dra_project_members m
                    WHERE m.project_id = p.id AND m.users_platform_id = p.users_platform_id
                )
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dra_project_members
            DROP CONSTRAINT IF EXISTS chk_marketing_role
        `);

        await queryRunner.query(`
            ALTER TABLE dra_project_members
            ALTER COLUMN marketing_role DROP NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE dra_project_members
            ALTER COLUMN marketing_role DROP DEFAULT
        `);
    }
}
