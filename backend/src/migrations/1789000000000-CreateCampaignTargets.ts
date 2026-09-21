import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateCampaignTargets
 *
 * Creates `dra_campaign_targets`, the store for CMO/manager-defined north-star
 * metrics and targets per channel campaign and per ad set / ad group.
 *
 * Targets are user-authored (not synced from the ad platforms) and are scoped
 * to a project + data source so the same campaign/ad set identifiers from
 * different ad accounts cannot collide. `entity_level` is either 'campaign' or
 * 'ad_set'; ad-set rows also carry the parent `campaign_id`.
 *
 * A partial-unique index (with COALESCE for nullable columns) enforces one
 * target row per (project, data source, level, campaign, entity) so writes can
 * upsert safely.
 */
export class CreateCampaignTargets1789000000000 implements MigrationInterface {
    name = 'CreateCampaignTargets1789000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_campaign_targets" (
                "id" SERIAL NOT NULL,
                "project_id" integer NOT NULL,
                "data_source_id" integer,
                "channel" character varying(50),
                "entity_level" character varying(20) NOT NULL,
                "campaign_id" character varying(255),
                "entity_id" character varying(255) NOT NULL,
                "entity_name" character varying(500),
                "buying_model" character varying(100),
                "audience_size" bigint,
                "target_ctr" numeric(10,4),
                "target_clicks" bigint,
                "target_impressions" bigint,
                "target_roas" numeric(12,4),
                "target_leads" bigint,
                "target_conversions" bigint,
                "target_revenue" numeric(14,2),
                "target_cpc" numeric(12,4),
                "target_cpm" numeric(12,4),
                "target_cpa" numeric(12,4),
                "target_cpl" numeric(12,4),
                "target_frequency" numeric(10,4),
                "initial_investment" numeric(14,2),
                "daily_budget" numeric(14,2),
                "lifetime_budget" numeric(14,2),
                "currency" character varying(10),
                "flight_start_date" date,
                "flight_end_date" date,
                "notes" text,
                "created_by" integer,
                "updated_by" integer,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dra_campaign_targets" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_dra_campaign_targets_scope"
            ON "dra_campaign_targets" (
                "project_id",
                COALESCE("data_source_id", 0),
                "entity_level",
                COALESCE("campaign_id", ''),
                "entity_id"
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_dra_campaign_targets_project"
            ON "dra_campaign_targets" ("project_id", "data_source_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_campaign_targets"`);
    }
}
