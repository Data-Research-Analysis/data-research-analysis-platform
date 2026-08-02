import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmailBroadcastLog1787000000000 implements MigrationInterface {
    name = 'CreateEmailBroadcastLog1787000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "dra_email_broadcast_log" (
                "id" SERIAL NOT NULL,
                "broadcast_id" integer NOT NULL,
                "recipient_email" character varying(255) NOT NULL,
                "recipient_name" character varying(255),
                "subject" text,
                "sent_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "opened_at" TIMESTAMPTZ,
                "clicked_at" TIMESTAMPTZ,
                "error" text,
                CONSTRAINT "PK_dra_email_broadcast_log" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_broadcast_log_broadcast_id" ON "dra_email_broadcast_log" ("broadcast_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "idx_broadcast_log_broadcast_id"`);
        await queryRunner.query(`DROP TABLE "dra_email_broadcast_log"`);
    }
}
