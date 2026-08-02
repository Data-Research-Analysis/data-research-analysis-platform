import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmailFunnelTables1783857138438 implements MigrationInterface {
    name = 'CreateEmailFunnelTables1783857138438'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_email_funnels" (
                "id" SERIAL NOT NULL,
                "name" character varying(255) NOT NULL,
                "slug" character varying(255) NOT NULL,
                "trigger_type" character varying(50) NOT NULL,
                "target_user_type" character varying(50) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_email_funnels" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_dra_email_funnels_slug" UNIQUE ("slug")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_email_funnel_steps" (
                "id" SERIAL NOT NULL,
                "funnel_id" integer NOT NULL,
                "step_order" integer NOT NULL,
                "delay_hours" integer NOT NULL,
                "template_file" character varying(500) NOT NULL,
                "subject_template" character varying(255) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_email_funnel_steps" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_email_funnel_enrollments" (
                "id" SERIAL NOT NULL,
                "funnel_id" integer NOT NULL,
                "lead_email" character varying(255) NOT NULL,
                "lead_name" character varying(255),
                "lead_generator_id" integer,
                "user_id" integer,
                "current_step" integer NOT NULL DEFAULT 0,
                "total_steps" integer NOT NULL,
                "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "completed_at" TIMESTAMPTZ,
                "is_active" boolean NOT NULL DEFAULT true,
                "last_sent_at" TIMESTAMPTZ,
                CONSTRAINT "PK_dra_email_funnel_enrollments" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_email_funnel_sent_log" (
                "id" SERIAL NOT NULL,
                "enrollment_id" integer NOT NULL,
                "step_id" integer NOT NULL,
                "sent_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "opened_at" TIMESTAMPTZ,
                "clicked_at" TIMESTAMPTZ,
                "error" text,
                CONSTRAINT "PK_dra_email_funnel_sent_log" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_email_funnel_unsubscribes" (
                "id" SERIAL NOT NULL,
                "email" character varying(255) NOT NULL,
                "funnel_id" integer,
                "token" character varying(255) NOT NULL,
                "unsubscribed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_email_funnel_unsubscribes" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_blog_subscribers" (
                "id" SERIAL NOT NULL,
                "email" character varying(255) NOT NULL,
                "name" character varying(255),
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_blog_subscribers" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_dra_blog_subscribers_email" UNIQUE ("email")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_lead_generator_related_resources" (
                "id" SERIAL NOT NULL,
                "lead_generator_id" integer NOT NULL,
                "related_type" character varying(50) NOT NULL,
                "related_id" integer NOT NULL,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_lead_generator_related_resources" PRIMARY KEY ("id")
            )
        `);

        // Foreign keys
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "dra_email_funnel_steps"
                ADD CONSTRAINT "FK_email_funnel_steps_funnel"
                FOREIGN KEY ("funnel_id")
                REFERENCES "dra_email_funnels"("id")
                ON DELETE CASCADE;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "dra_email_funnel_enrollments"
                ADD CONSTRAINT "FK_email_funnel_enrollments_funnel"
                FOREIGN KEY ("funnel_id")
                REFERENCES "dra_email_funnels"("id")
                ON DELETE CASCADE;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "dra_lead_generator_related_resources"
                ADD CONSTRAINT "FK_lg_related_resources_generator"
                FOREIGN KEY ("lead_generator_id")
                REFERENCES "dra_lead_generators"("id")
                ON DELETE CASCADE;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_lead_generator_related_resources"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_blog_subscribers"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_email_funnel_unsubscribes"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_email_funnel_sent_log"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_email_funnel_enrollments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_email_funnel_steps"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_email_funnels"`);
    }
}
