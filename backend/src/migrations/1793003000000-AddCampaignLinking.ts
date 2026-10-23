import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCampaignLinking1793003000000 implements MigrationInterface {
    name = 'AddCampaignLinking1793003000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Link a plan-created campaign (dra_campaigns) to its live counterpart
        // in the synced ad-platform data. external_campaign_id is the platform's
        // own campaign id; linked_data_source_id points at the data source
        // (account) that the live campaign was synced from.
        await queryRunner.query(`ALTER TABLE "dra_campaigns" ADD COLUMN "external_campaign_id" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "dra_campaigns" ADD COLUMN "linked_data_source_id" integer`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dra_campaigns_external_campaign_id" ON "dra_campaigns" ("external_campaign_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_campaigns_external_campaign_id"`);
        await queryRunner.query(`ALTER TABLE "dra_campaigns" DROP COLUMN IF EXISTS "linked_data_source_id"`);
        await queryRunner.query(`ALTER TABLE "dra_campaigns" DROP COLUMN IF EXISTS "external_campaign_id"`);
    }
}
