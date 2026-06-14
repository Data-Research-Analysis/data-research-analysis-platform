import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateDataModelSummariesTable1777000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasTable = await queryRunner.hasTable('data_model_summaries');
        if (!hasTable) {
            await queryRunner.createTable(
                new Table({
                    name: 'data_model_summaries',
                    columns: [
                        { name: 'id', type: 'serial', isPrimary: true },
                        { name: 'data_model_id', type: 'int', isNullable: false },
                        { name: 'row_count', type: 'int', isNullable: false, default: '0' },
                        { name: 'column_count', type: 'int', isNullable: false, default: '0' },
                        { name: 'summary_data', type: 'jsonb', isNullable: false },
                        { name: 'computed_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                        { name: 'query_execution_ms', type: 'int', isNullable: true },
                        { name: 'error_message', type: 'text', isNullable: true },
                        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
                    ]
                }),
                true
            );

            await queryRunner.createIndex(
                'data_model_summaries',
                new TableIndex({
                    name: 'idx_data_model_summaries_model_id',
                    columnNames: ['data_model_id']
                })
            );

            await queryRunner.createIndex(
                'data_model_summaries',
                new TableIndex({
                    name: 'idx_data_model_summaries_computed_at',
                    columnNames: ['computed_at']
                })
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('data_model_summaries', true);
    }
}