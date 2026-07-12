import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdditionalContentToLeadGeneratorPlacements1776000000001 implements MigrationInterface {
    name = 'AddAdditionalContentToLeadGeneratorPlacements1776000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('dra_lead_generator_page_placements');
        if (tableExists) {
            const colExists = await queryRunner.hasColumn('dra_lead_generator_page_placements', 'additional_content');
            if (!colExists) {
                await queryRunner.query(`
                    ALTER TABLE "dra_lead_generator_page_placements"
                    ADD COLUMN "additional_content" text
                `);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('dra_lead_generator_page_placements');
        if (tableExists) {
            const colExists = await queryRunner.hasColumn('dra_lead_generator_page_placements', 'additional_content');
            if (colExists) {
                await queryRunner.query(`
                    ALTER TABLE "dra_lead_generator_page_placements"
                    DROP COLUMN "additional_content"
                `);
            }
        }
    }
}
