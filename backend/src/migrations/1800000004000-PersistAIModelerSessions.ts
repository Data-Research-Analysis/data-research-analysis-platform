import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Persists AI data-modeler session state (conversation id, schema context,
 * model draft) on the existing dra_ai_data_model_conversations row so a
 * modeling conversation survives the 24-hour Redis TTL. Messages were already
 * permanent; without the schema context and draft the user had to redo (and
 * re-pay for) the whole modeling conversation after the Redis keys expired.
 */
export class PersistAIModelerSessions1800000004000 implements MigrationInterface {
    name = 'PersistAIModelerSessions1800000004000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "dra_ai_data_model_conversations" ADD COLUMN IF NOT EXISTS "conversation_id" varchar(255)`
        );
        await queryRunner.query(
            `ALTER TABLE "dra_ai_data_model_conversations" ADD COLUMN IF NOT EXISTS "schema_context" jsonb`
        );
        await queryRunner.query(
            `ALTER TABLE "dra_ai_data_model_conversations" ADD COLUMN IF NOT EXISTS "model_draft" jsonb`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_ai_data_model_conversations" DROP COLUMN IF EXISTS "conversation_id"`);
        await queryRunner.query(`ALTER TABLE "dra_ai_data_model_conversations" DROP COLUMN IF EXISTS "schema_context"`);
        await queryRunner.query(`ALTER TABLE "dra_ai_data_model_conversations" DROP COLUMN IF EXISTS "model_draft"`);
    }
}
