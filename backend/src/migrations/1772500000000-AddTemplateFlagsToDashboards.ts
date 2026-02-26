import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTemplateFlagsToDashboards1772500000000 implements MigrationInterface {
    name = 'AddTemplateFlagsToDashboards1772500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add name column so dashboards and templates can have human-readable titles
        await queryRunner.addColumn('dra_dashboards', new TableColumn({
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Human-readable name for the dashboard or template'
        }));

        // Add is_template column
        await queryRunner.addColumn('dra_dashboards', new TableColumn({
            name: 'is_template',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment: 'When true, this dashboard is a reusable template and not shown in the regular user dashboard list'
        }));

        // Add source_template_id column
        await queryRunner.addColumn('dra_dashboards', new TableColumn({
            name: 'source_template_id',
            type: 'integer',
            isNullable: true,
            comment: 'References the dra_dashboards template this dashboard was cloned from'
        }));

        // Make users_platform_id and project_id nullable to support template rows (templates have no owner or project)
        await queryRunner.query(`ALTER TABLE "dra_dashboards" ALTER COLUMN "users_platform_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" ALTER COLUMN "project_id" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_dashboards', 'source_template_id');
        await queryRunner.dropColumn('dra_dashboards', 'is_template');
        await queryRunner.dropColumn('dra_dashboards', 'name');
        // Restore NOT NULL constraints (only safe if no nulls exist)
        await queryRunner.query(`ALTER TABLE "dra_dashboards" ALTER COLUMN "users_platform_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_dashboards" ALTER COLUMN "project_id" SET NOT NULL`);
    }
}
