import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateDRAColumnsTable1740000000000 implements MigrationInterface {
    name = 'CreateDRAColumnsTable1740000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('dra_columns');
        if (tableExists) {
            return;
        }

        await queryRunner.query(`
            CREATE TABLE "dra_columns" (
                "id" SERIAL NOT NULL,
                "data_model_id" integer NOT NULL,
                "name" character varying(255) NOT NULL,
                "physical_name" character varying(255),
                "data_type" character varying(100) NOT NULL,
                "is_nullable" boolean NOT NULL DEFAULT false,
                "is_primary_key" boolean NOT NULL DEFAULT false,
                "ordinal_position" integer,
                "description" text,
                "label" character varying(255),
                "classification" character varying(100),
                "kpi_pattern" character varying(255),
                "data_source_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_columns" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_dra_columns_data_model_id" ON "dra_columns" ("data_model_id")
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_columns"
            ADD CONSTRAINT "FK_dra_columns_data_source"
            FOREIGN KEY ("data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_columns" DROP CONSTRAINT "FK_dra_columns_data_source"`);
        await queryRunner.query(`DROP INDEX "IDX_dra_columns_data_model_id"`);
        await queryRunner.query(`DROP TABLE "dra_columns"`);
    }
}
