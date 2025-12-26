import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatedAtAndMultitenantSupport1766677086791 implements MigrationInterface {
    name = 'AddCreatedAtAndMultitenantSupport1766677086791'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add created_at column to dra_data_models table
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            ADD COLUMN "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
        `);

        // 2. Add index on created_at for performance
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_models_created_at" 
            ON "dra_data_models" ("created_at")
        `);

        // 3. Add users_platform_id column to dra_data_model_sources table
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            ADD COLUMN "users_platform_id" INTEGER
        `);

        // 4. Backfill users_platform_id from related dra_data_models
        await queryRunner.query(`
            UPDATE "dra_data_model_sources" 
            SET "users_platform_id" = (
                SELECT "users_platform_id" 
                FROM "dra_data_models" 
                WHERE "dra_data_models"."id" = "dra_data_model_sources"."data_model_id"
            )
        `);

        // 5. Make users_platform_id NOT NULL after backfill
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            ALTER COLUMN "users_platform_id" SET NOT NULL
        `);

        // 6. Add foreign key constraint for users_platform_id
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            ADD CONSTRAINT "FK_dra_data_model_sources_users_platform" 
            FOREIGN KEY ("users_platform_id") 
            REFERENCES "dra_users_platform"("id") 
            ON DELETE CASCADE
        `);

        // 7. Add index on users_platform_id for query performance
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_model_sources_users_platform" 
            ON "dra_data_model_sources" ("users_platform_id")
        `);

        // 8. Drop old unique constraint
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            DROP CONSTRAINT IF EXISTS "UQ_data_model_source"
        `);

        // 9. Add new unique constraint including users_platform_id for proper tenant isolation
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            ADD CONSTRAINT "UQ_data_model_source_tenant" 
            UNIQUE ("data_model_id", "data_source_id", "users_platform_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse migration (rollback)

        // 1. Drop new unique constraint
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            DROP CONSTRAINT IF EXISTS "UQ_data_model_source_tenant"
        `);

        // 2. Restore old unique constraint
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            ADD CONSTRAINT "UQ_data_model_source" 
            UNIQUE ("data_model_id", "data_source_id")
        `);

        // 3. Drop index on users_platform_id
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_dra_data_model_sources_users_platform"
        `);

        // 4. Drop foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            DROP CONSTRAINT IF EXISTS "FK_dra_data_model_sources_users_platform"
        `);

        // 5. Drop users_platform_id column
        await queryRunner.query(`
            ALTER TABLE "dra_data_model_sources" 
            DROP COLUMN "users_platform_id"
        `);

        // 6. Drop index on created_at
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_dra_data_models_created_at"
        `);

        // 7. Drop created_at column from dra_data_models
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
            DROP COLUMN "created_at"
        `);
    }
}
