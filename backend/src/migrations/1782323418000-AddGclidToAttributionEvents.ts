import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddGclidToAttributionEvents1782323418000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'dra_attribution_events',
            new TableColumn({
                name: 'gclid',
                type: 'varchar',
                length: '255',
                isNullable: true,
                comment: 'Google Click ID for Google Ads click tracking',
            }),
        );

        await queryRunner.createIndex(
            'dra_attribution_events',
            new TableIndex({
                name: 'IDX_attribution_events_gclid',
                columnNames: ['gclid'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('dra_attribution_events', 'IDX_attribution_events_gclid');
        await queryRunner.dropColumn('dra_attribution_events', 'gclid');
    }
}
