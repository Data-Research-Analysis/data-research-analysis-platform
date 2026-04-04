import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fix for PR #367 Copilot Code Review Issues
 * 
 * This migration addresses two schema issues identified in code review:
 * 
 * 1. Enum Type Naming: Renames 'data_layer_enum' to 'dra_data_models_data_layer_enum'
 *    to align with TypeORM's naming convention (prevents migration diff noise)
 * 
 * 2. Nullable Column: Removes NOT NULL constraint and DEFAULT value from data_layer
 *    to allow NULL to represent "unclassified" models that need admin review
 * 
 * Context: The migration wizard and admin tools filter for data_layer === NULL
 * to identify models needing classification. With the previous NOT NULL constraint,
 * these tools would always return 0 candidates.
 */
export class FixDataModelLayerSchema1774600000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔧 Starting migration: FixDataModelLayerSchema');

        // Step 1: Remove NOT NULL constraint and DEFAULT value
        // This allows NULL to represent unclassified models
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ALTER COLUMN "data_layer" DROP NOT NULL,
            ALTER COLUMN "data_layer" DROP DEFAULT
        `);
        console.log('✅ Removed NOT NULL constraint and DEFAULT from data_layer');

        // Step 2: Set existing models to NULL for admin classification
        // Models with 'raw_data' default should be reviewed by admins
        await queryRunner.query(`
            UPDATE "dra_data_models"
            SET "data_layer" = NULL
            WHERE "data_layer" = 'raw_data'
        `);
        console.log('✅ Reset existing models to NULL for admin review');

        // Step 3: Rename enum type to match TypeORM convention
        // This prevents future migration generation issues
        await queryRunner.query(`
            ALTER TYPE "data_layer_enum" 
            RENAME TO "dra_data_models_data_layer_enum"
        `);
        console.log('✅ Renamed enum type to dra_data_models_data_layer_enum');

        console.log('🎉 Migration FixDataModelLayerSchema complete');
        console.log('📊 All models now NULL (unclassified) and ready for admin classification');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('⏪ Rolling back migration: FixDataModelLayerSchema');

        // Reverse Step 3: Rename enum back
        await queryRunner.query(`
            ALTER TYPE "dra_data_models_data_layer_enum" 
            RENAME TO "data_layer_enum"
        `);
        console.log('✅ Renamed enum type back to data_layer_enum');

        // Reverse Step 2: Set NULL back to default value
        await queryRunner.query(`
            UPDATE "dra_data_models"
            SET "data_layer" = 'raw_data'
            WHERE "data_layer" IS NULL
        `);
        console.log('✅ Set NULL models back to raw_data');

        // Reverse Step 1: Restore NOT NULL constraint and DEFAULT
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ALTER COLUMN "data_layer" SET DEFAULT 'raw_data',
            ALTER COLUMN "data_layer" SET NOT NULL
        `);
        console.log('✅ Restored NOT NULL constraint and DEFAULT to data_layer');

        console.log('✅ Rollback of FixDataModelLayerSchema complete');
    }
}
