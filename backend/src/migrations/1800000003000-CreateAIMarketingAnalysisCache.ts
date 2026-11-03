import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Permanent cache for ready-made AI marketing analyses (ai_analysis, 10
 * credits). Previously cached only in Redis with a 1-hour TTL, so the same
 * analysis re-charged credits after an hour even though the work was already
 * done. Results are keyed by their cache key and served free until the data
 * changes (callers pass force when they want a regeneration).
 */
export class CreateAIMarketingAnalysisCache1800000003000 implements MigrationInterface {
    name = 'CreateAIMarketingAnalysisCache1800000003000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_ai_marketing_analysis_cache" (
                "id" serial PRIMARY KEY,
                "cache_key" varchar(500) NOT NULL,
                "project_id" integer NOT NULL,
                "result" jsonb NOT NULL,
                "computed_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_ai_marketing_analysis_cache_key" UNIQUE ("cache_key")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_ai_marketing_analysis_cache_project"
            ON "dra_ai_marketing_analysis_cache" ("project_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_ai_marketing_analysis_cache"`);
    }
}
