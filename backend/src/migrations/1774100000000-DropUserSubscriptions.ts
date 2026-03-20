import { MigrationInterface, QueryRunner } from "typeorm";

export class DropUserSubscriptions1774100000000 implements MigrationInterface {
    name = 'DropUserSubscriptions1774100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints first
        await queryRunner.query(`ALTER TABLE IF EXISTS "dra_user_subscriptions" DROP CONSTRAINT IF EXISTS "FK_838681c9270475adfbfde7c5ed8"`);
        await queryRunner.query(`ALTER TABLE IF EXISTS "dra_user_subscriptions" DROP CONSTRAINT IF EXISTS "FK_e7231b5b00172cab57a7a7a80c3"`);
        // Drop the table - all users are now on organization-level subscriptions
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_user_subscriptions"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate the table if rolling back
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "dra_user_subscriptions" ("id" SERIAL NOT NULL, "started_at" TIMESTAMP NOT NULL DEFAULT now(), "ends_at" TIMESTAMP, "is_active" boolean NOT NULL DEFAULT true, "stripe_subscription_id" character varying(100), "cancelled_at" TIMESTAMP, "users_platform_id" integer, "subscription_tier_id" integer, CONSTRAINT "PK_ef5a530d64a7054d7eb48f5cb78" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "dra_user_subscriptions" ADD CONSTRAINT "FK_e7231b5b00172cab57a7a7a80c3" FOREIGN KEY ("users_platform_id") REFERENCES "dra_users_platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dra_user_subscriptions" ADD CONSTRAINT "FK_838681c9270475adfbfde7c5ed8" FOREIGN KEY ("subscription_tier_id") REFERENCES "dra_subscription_tiers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
}
