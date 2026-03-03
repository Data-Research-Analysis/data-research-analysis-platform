import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sets DEFAULT 'editor' on the legacy role columns in dra_project_members
 * and dra_project_invitations. The role column is kept for backward-compat
 * with the authorize() middleware but is no longer supplied by callers —
 * marketing_role is the authoritative permission field.
 */
export class SetDefaultRoleEditor1772800000000 implements MigrationInterface {
    name = 'SetDefaultRoleEditor1772800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dra_project_members
            ALTER COLUMN role SET DEFAULT 'editor'
        `);

        await queryRunner.query(`
            ALTER TABLE dra_project_invitations
            ALTER COLUMN role SET DEFAULT 'editor'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dra_project_members
            ALTER COLUMN role DROP DEFAULT
        `);

        await queryRunner.query(`
            ALTER TABLE dra_project_invitations
            ALTER COLUMN role DROP DEFAULT
        `);
    }
}
