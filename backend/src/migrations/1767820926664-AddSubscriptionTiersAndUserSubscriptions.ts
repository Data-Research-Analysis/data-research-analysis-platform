import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubscriptionTiersAndUserSubscriptions1767820926664 implements MigrationInterface {
    name = 'AddSubscriptionTiersAndUserSubscriptions1767820926664'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_sitemap_entries" DROP CONSTRAINT "FK_dra_sitemap_entries_users_platform"`);
        await queryRunner.query(`CREATE TABLE "dra_user_subscriptions" ("id" SERIAL NOT NULL, "started_at" TIMESTAMP NOT NULL DEFAULT now(), "ends_at" TIMESTAMP, "is_active" boolean NOT NULL DEFAULT true, "stripe_subscription_id" character varying(100), "cancelled_at" TIMESTAMP, "users_platform_id" integer, "subscription_tier_id" integer, CONSTRAINT "PK_ef5a530d64a7054d7eb48f5cb78" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."dra_subscription_tiers_tier_name_enum" AS ENUM('free', 'pro', 'team', 'business', 'enterprise')`);
        await queryRunner.query(`CREATE TABLE "dra_subscription_tiers" ("id" SERIAL NOT NULL, "tier_name" "public"."dra_subscription_tiers_tier_name_enum" NOT NULL, "max_rows_per_data_model" bigint NOT NULL, "max_projects" integer, "max_data_sources_per_project" integer, "max_dashboards" integer, "ai_generations_per_month" integer, "price_per_month_usd" numeric(10,2) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6d6d064db91782920969e7c6803" UNIQUE ("tier_name"), CONSTRAINT "PK_e88d52e110da139279cb13a9154" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "dra_user_subscriptions" ADD CONSTRAINT "FK_e7231b5b00172cab57a7a7a80c3" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_user_subscriptions" ADD CONSTRAINT "FK_838681c9270475adfbfde7c5ed8" FOREIGN KEY ("subscription_tier_id") REFERENCES "dra_subscription_tiers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_user_subscriptions" DROP CONSTRAINT "FK_838681c9270475adfbfde7c5ed8"`);
        await queryRunner.query(`ALTER TABLE "dra_user_subscriptions" DROP CONSTRAINT "FK_e7231b5b00172cab57a7a7a80c3"`);
        await queryRunner.query(`DROP TABLE "dra_subscription_tiers"`);
        await queryRunner.query(`DROP TYPE "public"."dra_subscription_tiers_tier_name_enum"`);
        await queryRunner.query(`DROP TABLE "dra_user_subscriptions"`);
        await queryRunner.query(`ALTER TABLE "dra_sitemap_entries" ADD CONSTRAINT "FK_dra_sitemap_entries_users_platform" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
