import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAttributionWeightDataDrivenColumn1774200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'dra_attribution_touchpoints',
            new TableColumn({
                name: 'attribution_weight_data_driven',
                type: 'decimal',
                precision: 5,
                scale: 4,
                isNullable: true,
                comment: 'Weight for data-driven (Shapley Value) model (0-1)',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_attribution_touchpoints', 'attribution_weight_data_driven');
    }
}
