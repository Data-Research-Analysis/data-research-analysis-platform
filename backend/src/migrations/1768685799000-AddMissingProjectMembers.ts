import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add missing project member entries for projects without owners.
 * This ensures all projects have at least one member (the creator as owner).
 * Backfills missing entries by using the project's users_platform_id as the owner.
 */
export class AddMissingProjectMembers1768685799000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add missing project member entries for projects without any members
        // The project creator (users_platform_id) becomes the owner
        await queryRunner.query(`
            INSERT INTO dra_project_members (project_id, users_platform_id, role, added_at)
            SELECT 
                p.id,
                p.users_platform_id,
                'owner',
                NOW()
            FROM dra_projects p
            LEFT JOIN dra_project_members pm ON p.id = pm.project_id
            WHERE pm.id IS NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This migration is data-fixing only and should not be reverted
        // No down migration needed as we're just adding missing data
        console.log('No down migration needed - this is a data integrity fix');
    }

}
