import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsersPlatformToTableMetadata1766685973373 implements MigrationInterface {
    name = 'AddUsersPlatformToTableMetadata1766685973373'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add users_platform_id column to dra_table_metadata
        await queryRunner.query(`
            ALTER TABLE "dra_table_metadata" 
            ADD COLUMN "users_platform_id" INTEGER
        `);

        // Backfill users_platform_id from related data_source
        await queryRunner.query(`
            UPDATE "dra_table_metadata" 
            SET "users_platform_id" = (
                SELECT "users_platform_id" 
                FROM "dra_data_sources" 
                WHERE "dra_data_sources"."id" = "dra_table_metadata"."data_source_id"
            )
        `);

        // Make users_platform_id NOT NULL after backfill
        await queryRunner.query(`
            ALTER TABLE "dra_table_metadata" 
            ALTER COLUMN "users_platform_id" SET NOT NULL
        `);

        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "dra_table_metadata" 
            ADD CONSTRAINT "FK_table_metadata_users_platform" 
            FOREIGN KEY ("users_platform_id") 
            REFERENCES "dra_users_platform"("id") 
            ON DELETE CASCADE
        `);

        // Add index for performance
        await queryRunner.query(`
            CREATE INDEX "IDX_table_metadata_users_platform" 
            ON "dra_table_metadata" ("users_platform_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_table_metadata_users_platform"`);
        
        // Drop foreign key
        await queryRunner.query(`
            ALTER TABLE "dra_table_metadata" 
            DROP CONSTRAINT IF EXISTS "FK_table_metadata_users_platform"
        `);
        
        // Drop column
        await queryRunner.query(`
            ALTER TABLE "dra_table_metadata" 
            DROP COLUMN "users_platform_id"
        `);
    }
}
