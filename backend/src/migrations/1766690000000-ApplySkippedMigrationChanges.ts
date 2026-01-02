import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * This migration applies the changes from migrations that were skipped
 * due to missing dependencies when they first ran:
 * - AddGoogleAnalyticsDataSource (google_analytics enum value)
 * - AddGoogleAdManagerAndGoogleAds (google_ads enum value) 
 * - AddCrossDataSourceSupport (tables and columns)
 * - AddCreatedAtAndMultitenantSupport (junction table modifications)
 */
export class ApplySkippedMigrationChanges1766690000000 implements MigrationInterface {
    name = 'ApplySkippedMigrationChanges1766690000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Applying changes from previously skipped migrations...');

        // 1. Add google_analytics enum value if it doesn't exist
        const gaEnumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'dra_data_sources_data_type_enum'
                AND e.enumlabel = 'google_analytics'
            );
        `);

        if (!gaEnumExists[0].exists) {
            console.log('  ✓ Adding google_analytics enum value...');
            await queryRunner.query(`
                ALTER TYPE "dra_data_sources_data_type_enum" 
                ADD VALUE 'google_analytics'
            `);
        } else {
            console.log('  ⚠️  google_analytics enum value already exists, skipping');
        }

        // 2. Add google_ads enum value if it doesn't exist
        const adsEnumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'dra_data_sources_data_type_enum'
                AND e.enumlabel = 'google_ads'
            );
        `);

        if (!adsEnumExists[0].exists) {
            console.log('  ✓ Adding google_ads enum value...');
            await queryRunner.query(`
                ALTER TYPE "dra_data_sources_data_type_enum" 
                ADD VALUE 'google_ads'
            `);
        } else {
            console.log('  ⚠️  google_ads enum value already exists, skipping');
        }

        // 3. Create dra_data_model_sources table if it doesn't exist
        const dataModelSourcesExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'dra_data_model_sources'
            );
        `);

        if (!dataModelSourcesExists[0].exists) {
            console.log('  ✓ Creating dra_data_model_sources table...');
            await queryRunner.query(`
                CREATE TABLE "dra_data_model_sources" (
                    "id" SERIAL PRIMARY KEY,
                    "data_model_id" INTEGER NOT NULL,
                    "data_source_id" INTEGER NOT NULL,
                    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                    CONSTRAINT "FK_dra_data_model_sources_data_model" 
                        FOREIGN KEY ("data_model_id") REFERENCES "dra_data_models"("id") ON DELETE CASCADE,
                    CONSTRAINT "FK_dra_data_model_sources_data_source" 
                        FOREIGN KEY ("data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE CASCADE,
                    CONSTRAINT "UQ_data_model_source" UNIQUE ("data_model_id", "data_source_id")
                )
            `);

            await queryRunner.query(`
                CREATE INDEX "IDX_dra_data_model_sources_data_model" 
                ON "dra_data_model_sources" ("data_model_id")
            `);

            await queryRunner.query(`
                CREATE INDEX "IDX_dra_data_model_sources_data_source" 
                ON "dra_data_model_sources" ("data_source_id")
            `);

            // Backfill existing data models
            await queryRunner.query(`
                INSERT INTO "dra_data_model_sources" ("data_model_id", "data_source_id")
                SELECT "id", "data_source_id" 
                FROM "dra_data_models" 
                WHERE "data_source_id" IS NOT NULL
            `);
        } else {
            console.log('  ⚠️  dra_data_model_sources table already exists, skipping');
        }

        // 4. Add is_cross_source column to dra_data_models if it doesn't exist
        const isCrossSourceExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'dra_data_models'
                AND column_name = 'is_cross_source'
            );
        `);

        if (!isCrossSourceExists[0].exists) {
            console.log('  ✓ Adding is_cross_source column to dra_data_models...');
            await queryRunner.query(`
                ALTER TABLE "dra_data_models" 
                ADD COLUMN "is_cross_source" BOOLEAN DEFAULT FALSE
            `);
        } else {
            console.log('  ⚠️  is_cross_source column already exists, skipping');
        }

        // 5. Add execution_metadata column to dra_data_models if it doesn't exist
        const executionMetadataExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'dra_data_models'
                AND column_name = 'execution_metadata'
            );
        `);

        if (!executionMetadataExists[0].exists) {
            console.log('  ✓ Adding execution_metadata column to dra_data_models...');
            await queryRunner.query(`
                ALTER TABLE "dra_data_models" 
                ADD COLUMN "execution_metadata" JSONB DEFAULT '{}'::jsonb
            `);
        } else {
            console.log('  ⚠️  execution_metadata column already exists, skipping');
        }

        // 6. Make data_source_id nullable if not already
        const dataSourceIdNullable = await queryRunner.query(`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'dra_data_models'
            AND column_name = 'data_source_id'
        `);

        if (dataSourceIdNullable[0]?.is_nullable === 'NO') {
            console.log('  ✓ Making data_source_id nullable in dra_data_models...');
            await queryRunner.query(`
                ALTER TABLE "dra_data_models" 
                ALTER COLUMN "data_source_id" DROP NOT NULL
            `);
        } else {
            console.log('  ⚠️  data_source_id already nullable, skipping');
        }

        // 7. Create dra_cross_source_join_catalog table if it doesn't exist
        const joinCatalogExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'dra_cross_source_join_catalog'
            );
        `);

        if (!joinCatalogExists[0].exists) {
            console.log('  ✓ Creating dra_cross_source_join_catalog table...');
            await queryRunner.query(`
                CREATE TABLE "dra_cross_source_join_catalog" (
                    "id" SERIAL PRIMARY KEY,
                    "left_data_source_id" INTEGER,
                    "left_table_name" VARCHAR(255),
                    "left_column_name" VARCHAR(255),
                    "right_data_source_id" INTEGER,
                    "right_table_name" VARCHAR(255),
                    "right_column_name" VARCHAR(255),
                    "join_type" VARCHAR(20) DEFAULT 'INNER',
                    "usage_count" INTEGER DEFAULT 0,
                    "created_by_user_id" INTEGER,
                    "created_at" TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT "FK_join_catalog_left_source" 
                        FOREIGN KEY ("left_data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE CASCADE,
                    CONSTRAINT "FK_join_catalog_right_source" 
                        FOREIGN KEY ("right_data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE CASCADE,
                    CONSTRAINT "FK_join_catalog_user" 
                        FOREIGN KEY ("created_by_user_id") REFERENCES "dra_users_platform"("id") ON DELETE SET NULL
                )
            `);

            await queryRunner.query(`
                CREATE INDEX "IDX_join_catalog_left_source_table" 
                ON "dra_cross_source_join_catalog" ("left_data_source_id", "left_table_name")
            `);

            await queryRunner.query(`
                CREATE INDEX "IDX_join_catalog_right_source_table" 
                ON "dra_cross_source_join_catalog" ("right_data_source_id", "right_table_name")
            `);

            await queryRunner.query(`
                CREATE INDEX "IDX_join_catalog_usage_count" 
                ON "dra_cross_source_join_catalog" ("usage_count" DESC)
            `);
        } else {
            console.log('  ⚠️  dra_cross_source_join_catalog table already exists, skipping');
        }

        // 8. Add users_platform_id column to dra_data_model_sources if it doesn't exist
        const usersPlatformIdExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'dra_data_model_sources'
                AND column_name = 'users_platform_id'
            );
        `);

        if (!usersPlatformIdExists[0].exists) {
            console.log('  ✓ Adding users_platform_id column to dra_data_model_sources...');
            await queryRunner.query(`
                ALTER TABLE "dra_data_model_sources" 
                ADD COLUMN "users_platform_id" INTEGER
            `);

            // Backfill users_platform_id from related dra_data_models
            await queryRunner.query(`
                UPDATE "dra_data_model_sources" 
                SET "users_platform_id" = (
                    SELECT "users_platform_id" 
                    FROM "dra_data_models" 
                    WHERE "dra_data_models"."id" = "dra_data_model_sources"."data_model_id"
                )
            `);

            // Make users_platform_id NOT NULL after backfill
            await queryRunner.query(`
                ALTER TABLE "dra_data_model_sources" 
                ALTER COLUMN "users_platform_id" SET NOT NULL
            `);

            // Add foreign key constraint
            await queryRunner.query(`
                ALTER TABLE "dra_data_model_sources" 
                ADD CONSTRAINT "FK_dra_data_model_sources_users_platform" 
                FOREIGN KEY ("users_platform_id") 
                REFERENCES "dra_users_platform"("id") 
                ON DELETE CASCADE
            `);

            // Add index
            await queryRunner.query(`
                CREATE INDEX "IDX_dra_data_model_sources_users_platform" 
                ON "dra_data_model_sources" ("users_platform_id")
            `);

            // Add updated_at column
            await queryRunner.query(`
                ALTER TABLE "dra_data_model_sources" 
                ADD COLUMN "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
            `);

            // Add index on created_at
            await queryRunner.query(`
                ALTER TABLE "dra_data_model_sources" 
                ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
            `);

            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS "IDX_dra_data_model_sources_created_at" 
                ON "dra_data_model_sources" ("created_at")
            `);
        } else {
            console.log('  ⚠️  users_platform_id column already exists in dra_data_model_sources, skipping');
        }

        console.log('✅ All skipped migration changes have been applied!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback in reverse order
        console.log('Rolling back skipped migration changes...');

        // Remove users_platform_id additions
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_data_model_sources_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_data_model_sources_users_platform"`);
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            DROP CONSTRAINT IF EXISTS "FK_dra_data_model_sources_users_platform"
        `);
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            DROP COLUMN IF EXISTS "updated_at"
        `);
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            DROP COLUMN IF EXISTS "users_platform_id"
        `);

        // Drop join catalog table
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_join_catalog_usage_count"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_join_catalog_right_source_table"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_join_catalog_left_source_table"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_cross_source_join_catalog"`);

        // Remove columns from dra_data_models
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            DROP COLUMN IF EXISTS "execution_metadata"
        `);
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            DROP COLUMN IF EXISTS "is_cross_source"
        `);

        // Drop data model sources table
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_data_model_sources_data_source"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_data_model_sources_data_model"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_data_model_sources"`);

        // Note: Cannot remove enum values in PostgreSQL without recreating the type
        console.log('⚠️  Enum values google_analytics and google_ads cannot be removed without recreating the enum type');
    }
}
