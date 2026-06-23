import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFunnelDefinitionsTable1772200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Funnel Definitions
        await queryRunner.createTable(
            new Table({
                name: 'dra_funnel_definitions',
                columns: [
                    { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'project_id', type: 'int', isNullable: false },
                    { name: 'name', type: 'varchar', length: '255', isNullable: false },
                    { name: 'steps', type: 'jsonb', isNullable: false, comment: 'Array of step definitions with name, order, match_type, and conditions' },
                    { name: 'last_analyzed_at', type: 'timestamp', isNullable: true },
                    { name: 'conversion_rate', type: 'decimal', precision: 5, scale: 2, isNullable: true, comment: 'Overall funnel conversion rate (0-100)' },
                    { name: 'created_by_user_id', type: 'int', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
            }),
            true,
        );

        // 2. Funnel Analysis Results cache
        await queryRunner.createTable(
            new Table({
                name: 'dra_funnel_analysis_results',
                columns: [
                    { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'funnel_id', type: 'int', isNullable: false },
                    { name: 'project_id', type: 'int', isNullable: false },
                    { name: 'stage_name', type: 'varchar', length: '255', isNullable: false },
                    { name: 'stage_order', type: 'int', isNullable: false },
                    { name: 'user_count', type: 'int', default: 0, comment: 'Number of unique users at this stage' },
                    { name: 'event_count', type: 'int', default: 0, comment: 'Number of matching events at this stage' },
                    { name: 'conversion_to_next', type: 'decimal', precision: 5, scale: 2, isNullable: true, comment: 'Percentage of users who moved to next stage' },
                    { name: 'drop_off_percent', type: 'decimal', precision: 5, scale: 2, isNullable: true, comment: 'Percentage of users who dropped off at this stage' },
                    { name: 'channel_data', type: 'jsonb', isNullable: true, comment: 'Per-channel breakdown at this stage' },
                    { name: 'utm_distribution', type: 'jsonb', isNullable: true, comment: 'UTM parameter distribution for matched events' },
                    { name: 'date_start', type: 'date', isNullable: false },
                    { name: 'date_end', type: 'date', isNullable: false },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
            }),
            true,
        );

        // Indexes
        await queryRunner.createIndex('dra_funnel_definitions', new TableIndex({
            name: 'idx_funnel_definitions_project',
            columnNames: ['project_id'],
        }));

        await queryRunner.createIndex('dra_funnel_analysis_results', new TableIndex({
            name: 'idx_funnel_analysis_funnel',
            columnNames: ['funnel_id'],
        }));

        await queryRunner.createIndex('dra_funnel_analysis_results', new TableIndex({
            name: 'idx_funnel_analysis_dates',
            columnNames: ['funnel_id', 'date_start', 'date_end'],
        }));

        // Index on attribution_events for UTM-based funnel matching
        await queryRunner.createIndex('dra_attribution_events', new TableIndex({
            name: 'idx_attribution_events_utm',
            columnNames: ['project_id', 'utm_source', 'utm_medium', 'utm_campaign'],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dra_funnel_analysis_results');
        await queryRunner.dropTable('dra_funnel_definitions');
        await queryRunner.dropIndex('dra_attribution_events', 'idx_attribution_events_utm');
    }
}
