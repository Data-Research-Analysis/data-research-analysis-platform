import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLeadGeneratorTables1775900000000 implements MigrationInterface {
    name = 'CreateLeadGeneratorTables1775900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_lead_generators" (
                "id" SERIAL NOT NULL,
                "title" character varying(255) NOT NULL,
                "slug" character varying(255) NOT NULL,
                "description" text,
                "file_name" character varying(500) NOT NULL,
                "original_file_name" character varying(500) NOT NULL,
                "is_gated" boolean NOT NULL DEFAULT true,
                "is_active" boolean NOT NULL DEFAULT true,
                "view_count" integer NOT NULL DEFAULT 0,
                "download_count" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_lead_generators" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_dra_lead_generators_slug"
            ON "dra_lead_generators" ("slug")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_lead_generator_leads" (
                "id" SERIAL NOT NULL,
                "lead_generator_id" integer NOT NULL,
                "full_name" character varying(255),
                "email" character varying(255) NOT NULL,
                "company" character varying(255),
                "phone" character varying(50),
                "job_title" character varying(255),
                "ip_address" character varying(45),
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_lead_generator_leads" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "dra_lead_generator_leads"
                ADD CONSTRAINT "FK_dra_lead_generator_leads_generator"
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
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_lead_generator_leads"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_dra_lead_generators_slug"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_lead_generators"`);
    }
}
