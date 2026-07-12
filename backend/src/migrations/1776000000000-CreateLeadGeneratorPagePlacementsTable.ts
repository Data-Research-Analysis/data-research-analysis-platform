import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLeadGeneratorPagePlacementsTable1776000000000 implements MigrationInterface {
    name = 'CreateLeadGeneratorPagePlacementsTable1776000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_lead_generator_page_placements" (
                "id" SERIAL NOT NULL,
                "lead_generator_id" integer NOT NULL,
                "page_url" character varying(500) NOT NULL,
                "frequency" integer NOT NULL DEFAULT 3,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_lg_page_placements" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "dra_lead_generator_page_placements"
                ADD CONSTRAINT "FK_dra_lg_page_placements_generator"
                FOREIGN KEY ("lead_generator_id")
                REFERENCES "dra_lead_generators"("id")
                ON DELETE CASCADE
                ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_lead_generator_page_placements"`);
    }
}
