import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTableMetadata1766685468170 implements MigrationInterface {
    name = 'CreateTableMetadata1766685468170'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create table metadata table for mapping physical to logical table names
        await queryRunner.query(`
            CREATE TABLE "dra_table_metadata" (
                "id" SERIAL PRIMARY KEY,
                "data_source_id" INTEGER NOT NULL,
                "schema_name" VARCHAR(63) NOT NULL,
                "physical_table_name" VARCHAR(63) NOT NULL,
                "logical_table_name" TEXT NOT NULL,
                "original_sheet_name" TEXT,
                "file_id" TEXT,
                "table_type" VARCHAR(50),
                "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT "UQ_table_metadata_physical" UNIQUE ("schema_name", "physical_table_name"),
                CONSTRAINT "FK_table_metadata_data_source" 
                    FOREIGN KEY ("data_source_id") 
                    REFERENCES "dra_data_sources"("id") 
                    ON DELETE CASCADE
            )
        `);

        // Add indexes for performance
        await queryRunner.query(`
            CREATE INDEX "IDX_table_metadata_data_source" 
            ON "dra_table_metadata" ("data_source_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_table_metadata_schema_physical" 
            ON "dra_table_metadata" ("schema_name", "physical_table_name")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_table_metadata_logical_name" 
            ON "dra_table_metadata" ("logical_table_name")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_table_metadata_logical_name"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_table_metadata_schema_physical"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_table_metadata_data_source"`);
        
        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_table_metadata"`);
    }
}
