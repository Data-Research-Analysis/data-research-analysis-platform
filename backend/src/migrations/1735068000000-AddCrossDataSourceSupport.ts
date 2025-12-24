import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCrossDataSourceSupport1735068000000 implements MigrationInterface {
    name = 'AddCrossDataSourceSupport1735068000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create junction table for data model sources (many-to-many relationship)
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

        // 2. Create indexes for junction table
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_model_sources_data_model" 
            ON "dra_data_model_sources" ("data_model_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_model_sources_data_source" 
            ON "dra_data_model_sources" ("data_source_id")
        `);

        // 3. Backfill existing data models into junction table
        await queryRunner.query(`
            INSERT INTO "dra_data_model_sources" ("data_model_id", "data_source_id")
            SELECT "id", "data_source_id" 
            FROM "dra_data_models" 
            WHERE "data_source_id" IS NOT NULL
        `);

        // 4. Add new columns to dra_data_models table
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            ADD COLUMN "is_cross_source" BOOLEAN DEFAULT FALSE
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            ADD COLUMN "execution_metadata" JSONB DEFAULT '{}'::jsonb
        `);

        // 5. Make data_source_id nullable (for backward compatibility with cross-source models)
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            ALTER COLUMN "data_source_id" DROP NOT NULL
        `);

        // 6. Create cross-source join catalog table
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

        // 7. Create indexes for join catalog
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse migration (rollback)
        
        // 1. Drop join catalog indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_join_catalog_usage_count"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_join_catalog_right_source_table"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_join_catalog_left_source_table"`);

        // 2. Drop join catalog table
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_cross_source_join_catalog"`);

        // 3. Restore data_source_id to NOT NULL (ensure all models have a source first)
        await queryRunner.query(`
            UPDATE "dra_data_models" 
            SET "data_source_id" = (
                SELECT "data_source_id" 
                FROM "dra_data_model_sources" 
                WHERE "dra_data_model_sources"."data_model_id" = "dra_data_models"."id" 
                LIMIT 1
            )
            WHERE "data_source_id" IS NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            ALTER COLUMN "data_source_id" SET NOT NULL
        `);

        // 4. Remove new columns from dra_data_models
        await queryRunner.query(`ALTER TABLE "dra_data_models" DROP COLUMN IF EXISTS "execution_metadata"`);
        await queryRunner.query(`ALTER TABLE "dra_data_models" DROP COLUMN IF EXISTS "is_cross_source"`);

        // 5. Drop junction table indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_data_model_sources_data_source"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_data_model_sources_data_model"`);

        // 6. Drop junction table
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_data_model_sources"`);
    }
}
