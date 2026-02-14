import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cleanup Migration: Remove orphaned table metadata entries
 * 
 * This migration removes any dra_table_metadata entries that reference
 * data sources that no longer exist. This can happen if:
 * 1. Data sources were deleted before CASCADE constraints were properly set up
 * 2. Manual database operations were performed
 * 3. Previous bugs in the deletion logic
 * 
 * This ensures data integrity and prevents orphaned metadata from accumulating.
 */
export class CleanupOrphanedTableMetadata1771009325000 implements MigrationInterface {
    name = 'CleanupOrphanedTableMetadata1771009325000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Cleaning up orphaned table metadata entries...');

        // Find and delete orphaned metadata entries (where data source no longer exists)
        const orphanedCount = await queryRunner.query(`
            DELETE FROM dra_table_metadata
            WHERE data_source_id NOT IN (
                SELECT id FROM dra_data_sources
            )
        `);

        console.log(`✅ Cleaned up ${orphanedCount[1]} orphaned table metadata entries`);

        // Verify CASCADE constraints are in place
        const constraints = await queryRunner.query(`
            SELECT conname, confdeltype 
            FROM pg_constraint 
            WHERE conrelid = 'dra_table_metadata'::regclass 
                AND contype = 'f' 
                AND confdeltype = 'c'
        `);

        console.log(`✅ Verified ${constraints.length} CASCADE constraints on dra_table_metadata`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No rollback needed - cleanup operations are idempotent
        console.log('ℹ️  No rollback needed for orphaned metadata cleanup');
    }
}
