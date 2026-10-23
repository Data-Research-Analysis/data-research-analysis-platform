import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableAdvancedToolsByDefault1793004000000 implements MigrationInterface {
    name = 'EnableAdvancedToolsByDefault1793004000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Advanced tools are now on by default for every organization. Backfill
        // organizations created while the setting defaulted to off, leaving any
        // explicit opt-out (`show_advanced_tools: false`) untouched.
        await queryRunner.query(
            `UPDATE "dra_organizations"
             SET "settings" = jsonb_set(COALESCE("settings", '{}'::jsonb), '{show_advanced_tools}', 'true'::jsonb)
             WHERE NOT (COALESCE("settings", '{}'::jsonb) ? 'show_advanced_tools')`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "dra_organizations"
             SET "settings" = "settings" - 'show_advanced_tools'
             WHERE "settings"->>'show_advanced_tools' = 'true'`
        );
    }
}
