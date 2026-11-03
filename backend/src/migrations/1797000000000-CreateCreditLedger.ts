import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Credit-based pricing ledger (implementation plan §4).
 *
 * Adds the workspace-level credit wallet, the immutable credit transaction
 * ledger, the credit pack catalog, per-action credit pricing, and the
 * credits_consumed trace column on ai_call_logs.
 */
export class CreateCreditLedger1797000000000 implements MigrationInterface {
    name = 'CreateCreditLedger1797000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ---- Workspace credit wallet (one row per org) ----
        await queryRunner.query(`
            CREATE TABLE "dra_credit_wallets" (
                "id" SERIAL PRIMARY KEY,
                "org_id" integer NOT NULL UNIQUE,
                "balance_credits" numeric(14,2) NOT NULL DEFAULT 0,
                "rollover_balance" numeric(14,2) NOT NULL DEFAULT 0,
                "monthly_grant_amount" numeric(14,2) NOT NULL DEFAULT 500,
                "monthly_credits_granted_at" timestamp,
                "auto_recharge_threshold" numeric(14,2),
                "auto_recharge_pack_id" integer,
                "currency" character varying(3) NOT NULL DEFAULT 'USD',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_credit_wallets_org" ON "dra_credit_wallets" ("org_id")`);

        // ---- Immutable credit transaction ledger ----
        await queryRunner.query(`
            CREATE TABLE "dra_credit_transactions" (
                "id" SERIAL PRIMARY KEY,
                "org_id" integer NOT NULL,
                "type" character varying(20) NOT NULL,
                "amount" numeric(14,2) NOT NULL,
                "source" character varying(30) NOT NULL,
                "action_key" character varying(64),
                "action_ref_id" character varying(128),
                "reservation_id" character varying(64),
                "status" character varying(20) NOT NULL DEFAULT 'settled',
                "paddle_transaction_id" character varying(100),
                "description" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_credit_tx_org_created" ON "dra_credit_transactions" ("org_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_credit_tx_action" ON "dra_credit_transactions" ("action_key", "action_ref_id")`);
        await queryRunner.query(`CREATE INDEX "idx_credit_tx_reservation" ON "dra_credit_transactions" ("reservation_id")`);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "idx_credit_tx_paddle" ON "dra_credit_transactions" ("paddle_transaction_id") WHERE "paddle_transaction_id" IS NOT NULL`
        );

        // ---- Credit pack catalog ----
        await queryRunner.query(`
            CREATE TABLE "dra_credit_packs" (
                "id" SERIAL PRIMARY KEY,
                "name" character varying(100) NOT NULL,
                "credits" numeric(14,2) NOT NULL,
                "price_usd" numeric(10,2) NOT NULL,
                "paddle_price_id" character varying(100),
                "is_active" boolean NOT NULL DEFAULT true,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            INSERT INTO "dra_credit_packs" ("name", "credits", "price_usd", "paddle_price_id", "sort_order") VALUES
                ('1,000 credits', 1000, 9.00, NULL, 1),
                ('5,000 credits', 5000, 40.00, NULL, 2),
                ('10,000 credits', 10000, 70.00, NULL, 3)
            ON CONFLICT DO NOTHING
        `);

        // ---- Per-action credit pricing ----
        await queryRunner.query(`
            CREATE TABLE "dra_action_prices" (
                "id" SERIAL PRIMARY KEY,
                "action_key" character varying(64) NOT NULL UNIQUE,
                "display_name" character varying(100) NOT NULL,
                "credits" numeric(12,2) NOT NULL DEFAULT 0,
                "charge_mode" character varying(20) NOT NULL DEFAULT 'per_action',
                "band_type" character varying(20) NOT NULL DEFAULT 'fixed',
                "band_multipliers" jsonb,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            INSERT INTO "dra_action_prices"
                ("action_key", "display_name", "credits", "charge_mode", "band_type", "band_multipliers") VALUES
                ('plan_build', 'Paid media plan build', 500, 'per_action', 'fixed', NULL),
                ('plan_chat', 'Plan chat Q&A', 2, 'per_call', 'fixed', NULL),
                ('plan_deck_export', 'Client presentation deck (PPTX) export', 50, 'per_action', 'fixed', NULL),
                ('plan_pack_export', 'Plan XLSX / ZIP pack export', 15, 'per_action', 'fixed', NULL),
                ('data_model_generate', 'One-click AI model generation', 20, 'per_action', 'fixed', NULL),
                ('join_inference', 'AI join suggestions', 5, 'per_call', 'fixed', NULL),
                ('data_modeler_chat', 'Conversational modeler chat', 2, 'per_call', 'fixed', NULL),
                ('data_model_chat', 'Model chat', 2, 'per_call', 'fixed', NULL),
                ('data_model_analysis', 'AI model analysis', 15, 'per_action', 'row_band', '[1,2,3]'::jsonb),
                ('data_quality', 'Data quality + AI remediation', 15, 'per_action', 'fixed', NULL),
                ('ai_analysis', 'Ready-made AI analysis', 10, 'per_action', 'fixed', NULL),
                ('budget_optimization', 'Budget optimizer run', 10, 'per_action', 'fixed', NULL),
                ('attribution', 'Attribution model run', 25, 'per_action', 'event_band', '[1,2,3]'::jsonb),
                ('ai_insights_generate', 'Generate AI insights', 5, 'per_action', 'fixed', NULL),
                ('ai_insights_chat', 'Insights follow-up chat', 1, 'per_call', 'fixed', NULL),
                ('ai_insights_report_chat', 'Report follow-up chat', 1, 'per_call', 'fixed', NULL),
                ('report_widget', 'AI report generation', 15, 'per_action', 'row_band', '[1,2,3]'::jsonb),
                ('report_pdf_export', 'Report PDF export', 5, 'per_action', 'fixed', NULL),
                ('dashboard_widget_spec', 'AI-insight dashboard widget regenerate', 5, 'per_action', 'fixed', NULL),
                ('dashboard_auto_generate', 'Auto-generated dashboard', 30, 'per_action', 'fixed', NULL),
                ('search_grounding', 'Web search grounding', 1, 'per_call', 'fixed', NULL)
            ON CONFLICT DO NOTHING
        `);

        // ---- Trace consumption on the AI call log ----
        await queryRunner.query(`ALTER TABLE "ai_call_logs" ADD COLUMN "credits_consumed" numeric(12,4) NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ai_call_logs" DROP COLUMN IF EXISTS "credits_consumed"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_action_prices"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_credit_packs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_credit_transactions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_credit_wallets"`);
    }
}
