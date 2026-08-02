import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmailBroadcasts1786000000000 implements MigrationInterface {
    name = 'CreateEmailBroadcasts1786000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "dra_email_broadcasts" (
                "id" SERIAL NOT NULL,
                "subject" character varying(255) NOT NULL,
                "template_file" character varying(255) NOT NULL,
                "template_data" text NOT NULL DEFAULT '{}',
                "audience" character varying(50) NOT NULL DEFAULT 'blog_subscribers',
                "scheduled_at" TIMESTAMPTZ,
                "status" character varying(20) NOT NULL DEFAULT 'pending',
                "paused" boolean NOT NULL DEFAULT false,
                "sent_count" integer NOT NULL DEFAULT 0,
                "total_count" integer NOT NULL DEFAULT 0,
                "sent_at" TIMESTAMPTZ,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_dra_email_broadcasts" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "dra_email_broadcasts"`);
    }
}
