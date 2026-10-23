import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * AI usage instrumentation: per-call Gemini usage log.
 * See documentation/ai-usage-instrumentation-plan.md (§5).
 */
export class CreateAICallLogs1796000000000 implements MigrationInterface {
    name = 'CreateAICallLogs1796000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "ai_call_logs" (
                "id" SERIAL PRIMARY KEY,
                "org_id" integer,
                "user_id" integer,
                "project_id" integer,
                "feature_key" character varying(64) NOT NULL,
                "action_id" character varying(128),
                "model_id" character varying(64) NOT NULL,
                "input_tokens" integer NOT NULL DEFAULT 0,
                "cached_input_tokens" integer NOT NULL DEFAULT 0,
                "output_tokens" integer NOT NULL DEFAULT 0,
                "thought_tokens" integer NOT NULL DEFAULT 0,
                "total_tokens" integer NOT NULL DEFAULT 0,
                "status" character varying(20) NOT NULL DEFAULT 'success',
                "error_info" text,
                "latency_ms" integer NOT NULL DEFAULT 0,
                "cost_usd" numeric(12,6) NOT NULL DEFAULT 0,
                "cache_enabled" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_ai_call_logs_org_created" ON "ai_call_logs" ("org_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_ai_call_logs_feature_created" ON "ai_call_logs" ("feature_key", "created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_ai_call_logs_action" ON "ai_call_logs" ("action_id") WHERE "action_id" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_ai_call_logs_action"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_ai_call_logs_feature_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_ai_call_logs_org_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ai_call_logs"`);
    }
}
