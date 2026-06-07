import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIsAutoCreatedToDataModels1779000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('dra_data_models');
        const hasColumn = table?.findColumnByName('is_auto_created');

        if (!hasColumn) {
            await queryRunner.addColumn(
                'dra_data_models',
                new TableColumn({
                    name: 'is_auto_created',
                    type: 'boolean',
                    default: false,
                    isNullable: false,
                }),
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_data_models', 'is_auto_created');
    }
}
