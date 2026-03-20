import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Remove organization slug column
 * 
 * The slug field was originally intended for URL routing (e.g., /org/{slug})
 * but this functionality was never implemented. All navigation uses organization ID instead.
 * 
 * This migration:
 * - Drops the slug column from dra_organizations
 * - Drops the idx_dra_organizations_slug index
 * 
 * Date: 2026-03-19
 */
export class RemoveOrganizationSlug1774100000000 implements MigrationInterface {
    name = 'RemoveOrganizationSlug1774100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the slug index first
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_dra_organizations_slug"`);
        
        // Drop the slug column
        await queryRunner.query(`ALTER TABLE "dra_organizations" DROP COLUMN IF EXISTS "slug"`);
        
        console.log('✅ Removed organization slug column and index');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add the slug column (nullable for rollback safety)
        await queryRunner.query(`ALTER TABLE "dra_organizations" ADD COLUMN "slug" VARCHAR(100)`);
        
        // Re-create the index
        await queryRunner.query(`CREATE INDEX "idx_dra_organizations_slug" ON "dra_organizations"("slug")`);
        
        console.log('⚠️  Rolled back: Re-added organization slug column (nullable)');
        console.log('⚠️  Note: Existing organizations will have NULL slug values');
    }
}
