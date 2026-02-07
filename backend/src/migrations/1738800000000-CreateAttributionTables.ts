import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAttributionTables1738800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Attribution Channels Table
        await queryRunner.createTable(
            new Table({
                name: 'dra_attribution_channels',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment'
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'category',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                        comment: 'organic, paid, social, email, direct, referral, etc.'
                    },
                    {
                        name: 'source',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                        comment: 'Google, Facebook, Email Campaign Name, etc.'
                    },
                    {
                        name: 'medium',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                        comment: 'cpc, organic, social, email, etc.'
                    },
                    {
                        name: 'campaign',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'project_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ]
            }),
            true
        );

        // 2. Attribution Events Table
        await queryRunner.createTable(
            new Table({
                name: 'dra_attribution_events',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment'
                    },
                    {
                        name: 'project_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'user_identifier',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                        comment: 'User ID, email, or anonymous ID'
                    },
                    {
                        name: 'session_id',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'event_type',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                        comment: 'page_view, conversion, click, form_submit, etc.'
                    },
                    {
                        name: 'event_name',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'event_value',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: true,
                        comment: 'Revenue or conversion value'
                    },
                    {
                        name: 'channel_id',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'utm_source',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'utm_medium',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'utm_campaign',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'utm_term',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'utm_content',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'referrer',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'landing_page',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'page_url',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'metadata',
                        type: 'jsonb',
                        isNullable: true,
                        comment: 'Additional event properties'
                    },
                    {
                        name: 'event_timestamp',
                        type: 'timestamp',
                        isNullable: false
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ]
            }),
            true
        );

        // 3. Attribution Touchpoints Table
        await queryRunner.createTable(
            new Table({
                name: 'dra_attribution_touchpoints',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment'
                    },
                    {
                        name: 'project_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'user_identifier',
                        type: 'varchar',
                        length: '255',
                        isNullable: false
                    },
                    {
                        name: 'conversion_event_id',
                        type: 'int',
                        isNullable: false,
                        comment: 'Links to the conversion event in attribution_events'
                    },
                    {
                        name: 'touchpoint_event_id',
                        type: 'int',
                        isNullable: false,
                        comment: 'Links to the touchpoint event in attribution_events'
                    },
                    {
                        name: 'channel_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'touchpoint_position',
                        type: 'int',
                        isNullable: false,
                        comment: 'Position in customer journey (1 = first touch)'
                    },
                    {
                        name: 'time_to_conversion_hours',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: 'attribution_weight_first_touch',
                        type: 'decimal',
                        precision: 5,
                        scale: 4,
                        isNullable: true,
                        comment: 'Weight for first-touch model (0-1)'
                    },
                    {
                        name: 'attribution_weight_last_touch',
                        type: 'decimal',
                        precision: 5,
                        scale: 4,
                        isNullable: true,
                        comment: 'Weight for last-touch model (0-1)'
                    },
                    {
                        name: 'attribution_weight_linear',
                        type: 'decimal',
                        precision: 5,
                        scale: 4,
                        isNullable: true,
                        comment: 'Weight for linear model (0-1)'
                    },
                    {
                        name: 'attribution_weight_time_decay',
                        type: 'decimal',
                        precision: 5,
                        scale: 4,
                        isNullable: true,
                        comment: 'Weight for time-decay model (0-1)'
                    },
                    {
                        name: 'attribution_weight_u_shaped',
                        type: 'decimal',
                        precision: 5,
                        scale: 4,
                        isNullable: true,
                        comment: 'Weight for U-shaped model (0-1)'
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ]
            }),
            true
        );

        // 4. Attribution Reports Table
        await queryRunner.createTable(
            new Table({
                name: 'dra_attribution_reports',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment'
                    },
                    {
                        name: 'project_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'report_type',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                        comment: 'channel_performance, funnel_analysis, journey_map, roi_report'
                    },
                    {
                        name: 'attribution_model',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                        comment: 'first_touch, last_touch, linear, time_decay, u_shaped'
                    },
                    {
                        name: 'date_range_start',
                        type: 'timestamp',
                        isNullable: false
                    },
                    {
                        name: 'date_range_end',
                        type: 'timestamp',
                        isNullable: false
                    },
                    {
                        name: 'total_conversions',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'total_revenue',
                        type: 'decimal',
                        precision: 15,
                        scale: 2,
                        default: 0
                    },
                    {
                        name: 'channel_breakdown',
                        type: 'jsonb',
                        isNullable: true,
                        comment: 'Revenue/conversions per channel'
                    },
                    {
                        name: 'top_paths',
                        type: 'jsonb',
                        isNullable: true,
                        comment: 'Most common conversion paths'
                    },
                    {
                        name: 'avg_time_to_conversion_hours',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: 'avg_touchpoints_per_conversion',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: 'generated_by_user_id',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ]
            }),
            true
        );

        // 5. Conversion Funnels Table
        await queryRunner.createTable(
            new Table({
                name: 'dra_conversion_funnels',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment'
                    },
                    {
                        name: 'project_id',
                        type: 'int',
                        isNullable: false
                    },
                    {
                        name: 'funnel_name',
                        type: 'varchar',
                        length: '255',
                        isNullable: false
                    },
                    {
                        name: 'funnel_steps',
                        type: 'jsonb',
                        isNullable: false,
                        comment: 'Array of step definitions with event types'
                    },
                    {
                        name: 'total_entered',
                        type: 'int',
                        default: 0,
                        comment: 'Users who started the funnel'
                    },
                    {
                        name: 'total_completed',
                        type: 'int',
                        default: 0,
                        comment: 'Users who completed all steps'
                    },
                    {
                        name: 'conversion_rate',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        isNullable: true,
                        comment: 'Percentage (0-100)'
                    },
                    {
                        name: 'step_completion_rates',
                        type: 'jsonb',
                        isNullable: true,
                        comment: 'Completion rate for each step'
                    },
                    {
                        name: 'drop_off_analysis',
                        type: 'jsonb',
                        isNullable: true,
                        comment: 'Where users drop off most'
                    },
                    {
                        name: 'avg_time_to_complete_minutes',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: true
                    },
                    {
                        name: 'created_by_user_id',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ]
            }),
            true
        );

        // Foreign Keys
        await queryRunner.createForeignKey(
            'dra_attribution_channels',
            new TableForeignKey({
                name: 'FK_attribution_channels_project',
                columnNames: ['project_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_projects',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_attribution_events',
            new TableForeignKey({
                name: 'FK_attribution_events_project',
                columnNames: ['project_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_projects',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_attribution_events',
            new TableForeignKey({
                name: 'FK_attribution_events_channel',
                columnNames: ['channel_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_attribution_channels',
                onDelete: 'SET NULL'
            })
        );

        await queryRunner.createForeignKey(
            'dra_attribution_touchpoints',
            new TableForeignKey({
                name: 'FK_attribution_touchpoints_project',
                columnNames: ['project_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_projects',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_attribution_touchpoints',
            new TableForeignKey({
                name: 'FK_attribution_touchpoints_conversion_event',
                columnNames: ['conversion_event_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_attribution_events',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_attribution_touchpoints',
            new TableForeignKey({
                name: 'FK_attribution_touchpoints_touchpoint_event',
                columnNames: ['touchpoint_event_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_attribution_events',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_attribution_touchpoints',
            new TableForeignKey({
                name: 'FK_attribution_touchpoints_channel',
                columnNames: ['channel_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_attribution_channels',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_attribution_reports',
            new TableForeignKey({
                name: 'FK_attribution_reports_project',
                columnNames: ['project_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_projects',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_attribution_reports',
            new TableForeignKey({
                name: 'FK_attribution_reports_user',
                columnNames: ['generated_by_user_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_users_platform',
                onDelete: 'SET NULL'
            })
        );

        await queryRunner.createForeignKey(
            'dra_conversion_funnels',
            new TableForeignKey({
                name: 'FK_conversion_funnels_project',
                columnNames: ['project_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_projects',
                onDelete: 'CASCADE'
            })
        );

        await queryRunner.createForeignKey(
            'dra_conversion_funnels',
            new TableForeignKey({
                name: 'FK_conversion_funnels_user',
                columnNames: ['created_by_user_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'dra_users_platform',
                onDelete: 'SET NULL'
            })
        );

        // Indexes for performance
        await queryRunner.createIndex(
            'dra_attribution_events',
            new TableIndex({
                name: 'IDX_attribution_events_user_timestamp',
                columnNames: ['user_identifier', 'event_timestamp']
            })
        );

        await queryRunner.createIndex(
            'dra_attribution_events',
            new TableIndex({
                name: 'IDX_attribution_events_session',
                columnNames: ['session_id']
            })
        );

        await queryRunner.createIndex(
            'dra_attribution_events',
            new TableIndex({
                name: 'IDX_attribution_events_type',
                columnNames: ['event_type']
            })
        );

        await queryRunner.createIndex(
            'dra_attribution_events',
            new TableIndex({
                name: 'IDX_attribution_events_utm',
                columnNames: ['utm_source', 'utm_medium', 'utm_campaign']
            })
        );

        await queryRunner.createIndex(
            'dra_attribution_touchpoints',
            new TableIndex({
                name: 'IDX_attribution_touchpoints_user',
                columnNames: ['user_identifier']
            })
        );

        await queryRunner.createIndex(
            'dra_attribution_touchpoints',
            new TableIndex({
                name: 'IDX_attribution_touchpoints_conversion',
                columnNames: ['conversion_event_id']
            })
        );

        await queryRunner.createIndex(
            'dra_attribution_channels',
            new TableIndex({
                name: 'IDX_attribution_channels_category',
                columnNames: ['category']
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys first
        await queryRunner.dropForeignKey('dra_conversion_funnels', 'FK_conversion_funnels_user');
        await queryRunner.dropForeignKey('dra_conversion_funnels', 'FK_conversion_funnels_project');
        await queryRunner.dropForeignKey('dra_attribution_reports', 'FK_attribution_reports_user');
        await queryRunner.dropForeignKey('dra_attribution_reports', 'FK_attribution_reports_project');
        await queryRunner.dropForeignKey('dra_attribution_touchpoints', 'FK_attribution_touchpoints_channel');
        await queryRunner.dropForeignKey('dra_attribution_touchpoints', 'FK_attribution_touchpoints_touchpoint_event');
        await queryRunner.dropForeignKey('dra_attribution_touchpoints', 'FK_attribution_touchpoints_conversion_event');
        await queryRunner.dropForeignKey('dra_attribution_touchpoints', 'FK_attribution_touchpoints_project');
        await queryRunner.dropForeignKey('dra_attribution_events', 'FK_attribution_events_channel');
        await queryRunner.dropForeignKey('dra_attribution_events', 'FK_attribution_events_project');
        await queryRunner.dropForeignKey('dra_attribution_channels', 'FK_attribution_channels_project');

        // Drop indexes
        await queryRunner.dropIndex('dra_attribution_channels', 'IDX_attribution_channels_category');
        await queryRunner.dropIndex('dra_attribution_touchpoints', 'IDX_attribution_touchpoints_conversion');
        await queryRunner.dropIndex('dra_attribution_touchpoints', 'IDX_attribution_touchpoints_user');
        await queryRunner.dropIndex('dra_attribution_events', 'IDX_attribution_events_utm');
        await queryRunner.dropIndex('dra_attribution_events', 'IDX_attribution_events_type');
        await queryRunner.dropIndex('dra_attribution_events', 'IDX_attribution_events_session');
        await queryRunner.dropIndex('dra_attribution_events', 'IDX_attribution_events_user_timestamp');

        // Drop tables
        await queryRunner.dropTable('dra_conversion_funnels');
        await queryRunner.dropTable('dra_attribution_reports');
        await queryRunner.dropTable('dra_attribution_touchpoints');
        await queryRunner.dropTable('dra_attribution_events');
        await queryRunner.dropTable('dra_attribution_channels');
    }
}
