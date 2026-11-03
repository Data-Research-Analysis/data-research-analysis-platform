import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Permanent storage for data-model chat conversations (data_model_chat, 2
 * credits per call). Previously the conversation lived only in an in-memory
 * Map with a 1-hour timeout, so it vanished on timeout or server restart and
 * the user had to re-pay for every message. Sessions are now persisted here
 * and lazily loaded on restart.
 */
export class CreateDataModelChatSessions1800000005000 implements MigrationInterface {
    name = 'CreateDataModelChatSessions1800000005000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_ai_data_model_chat_sessions" (
                "id" serial PRIMARY KEY,
                "conversation_id" varchar(255) NOT NULL,
                "data_model_id" integer NOT NULL,
                "user_id" integer NOT NULL,
                "project_id" integer NOT NULL,
                "messages" jsonb NOT NULL DEFAULT '[]',
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "last_activity_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_data_model_chat_conversation" UNIQUE ("conversation_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_data_model_chat_data_model"
            ON "dra_ai_data_model_chat_sessions" ("data_model_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_data_model_chat_user"
            ON "dra_ai_data_model_chat_sessions" ("user_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_ai_data_model_chat_sessions"`);
    }
}
