import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * TICKET RPT-001: Report Item Types — Database Schema & API
 *
 * Extends the dra_report_items table to support 6 different item types:
 *   dashboard (existing), kpi_card, ai_insight, data_table, text_block
 *
 * Adds a `payload` JSONB column for type-specific data storage.
 */
export class ExtendReportItemsForBuilder1778000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Expand item_type enum to support all 7 types
        // We use a CHECK constraint since the column is varchar
        await queryRunner.changeColumn(
            'dra_report_items',
            'item_type',
            new TableColumn({
                name: 'item_type',
                type: 'varchar',
                length: "30",
                isNullable: false,
            }),
        );

        // Add CHECK constraint for valid item types
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_report_items_item_type'
                ) THEN
                    ALTER TABLE dra_report_items
                    ADD CONSTRAINT chk_report_items_item_type
                    CHECK (item_type IN ('dashboard', 'widget', 'insight', 'kpi_card', 'ai_insight', 'data_table', 'chart', 'text_block', 'comparison_table'));
                END IF;
            END$$;
        `);

        // 2. Add payload JSONB column for type-specific configuration/data
        const hasPayload = await queryRunner.hasColumn('dra_report_items', 'payload');
        if (!hasPayload) {
            await queryRunner.addColumn(
                'dra_report_items',
                new TableColumn({
                    name: 'payload',
                    type: 'jsonb',
                    isNullable: true,
                    default: "'{}'::jsonb",
                }),
            );
        }

        // 3. Add data_model_id for types that reference a data model
        const hasDataModelId = await queryRunner.hasColumn('dra_report_items', 'data_model_id');
        if (!hasDataModelId) {
            await queryRunner.addColumn(
                'dra_report_items',
                new TableColumn({
                    name: 'data_model_id',
                    type: 'int',
                    isNullable: true,
                }),
            );
        }

        // 4. Add index on item_type for faster filtering
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_report_items_item_type
            ON dra_report_items (item_type);
        `);

        // 5. Add index on data_model_id for types that reference data models
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_report_items_data_model_id
            ON dra_report_items (data_model_id);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_report_items_data_model_id`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_report_items_item_type`);

        const hasDataModelId = await queryRunner.hasColumn('dra_report_items', 'data_model_id');
        if (hasDataModelId) {
            await queryRunner.dropColumn('dra_report_items', 'data_model_id');
        }

        const hasPayload = await queryRunner.hasColumn('dra_report_items', 'payload');
        if (hasPayload) {
            await queryRunner.dropColumn('dra_report_items', 'payload');
        }

        // Revert item_type back to original size
        await queryRunner.changeColumn(
            'dra_report_items',
            'item_type',
            new TableColumn({
                name: 'item_type',
                type: 'varchar',
                length: "20",
                isNullable: false,
            }),
        );

        await queryRunner.query(`
            ALTER TABLE dra_report_items DROP CONSTRAINT IF EXISTS chk_report_items_item_type;
        `);
    }
}