import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes 'comparison_table' from the dra_report_items CHECK constraint
 * since the ComparisonTable report item type was removed.
 */
export class RemoveComparisonTableFromItems1778000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dra_report_items
            DROP CONSTRAINT IF EXISTS chk_report_items_item_type;
        `);
        await queryRunner.query(`
            ALTER TABLE dra_report_items
            ADD CONSTRAINT chk_report_items_item_type
            CHECK (item_type IN ('dashboard', 'widget', 'insight', 'kpi_card', 'ai_insight', 'data_table', 'text_block'));
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dra_report_items
            DROP CONSTRAINT IF EXISTS chk_report_items_item_type;
        `);
        await queryRunner.query(`
            ALTER TABLE dra_report_items
            ADD CONSTRAINT chk_report_items_item_type
            CHECK (item_type IN ('dashboard', 'widget', 'insight', 'kpi_card', 'ai_insight', 'data_table', 'chart', 'text_block', 'comparison_table'));
        `);
    }
}
