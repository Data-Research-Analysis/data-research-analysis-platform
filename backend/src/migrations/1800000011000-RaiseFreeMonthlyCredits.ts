import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Raise the Free monthly credit allowance from 500 to 600.
 *
 * A full Plan Studio build costs 500 credits and a client deck export costs 50,
 * so a 500-credit allowance could not complete one plan + export cycle. 600
 * covers both with a little headroom for chat and analyses.
 *
 * Seeders only create missing tiers and never update existing rows, so this
 * migration applies the new allowance to databases that were already seeded.
 */
export class RaiseFreeMonthlyCredits1800000011000 implements MigrationInterface {
    name = 'RaiseFreeMonthlyCredits1800000011000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers"
            SET "credits_per_month" = 600
            WHERE UPPER("tier_name") = 'FREE'
              AND "credits_per_month" = 500
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers"
            SET "credits_per_month" = 500
            WHERE UPPER("tier_name") = 'FREE'
              AND "credits_per_month" = 600
        `);
    }
}
