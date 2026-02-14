import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAIJoinSuggestionsTable1771100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable uuid-ossp extension if not already enabled
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.createTable(
            new Table({
                name: 'dra_ai_join_suggestions',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'data_source_id',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'schema_name',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'schema_hash',
                        type: 'varchar',
                        length: '64',
                        isNullable: false,
                        comment: 'MD5 hash of schema structure for invalidation detection',
                    },
                    {
                        name: 'left_table',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'left_column',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'right_table',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'right_column',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'suggested_join_type',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                    },
                    {
                        name: 'confidence_score',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        isNullable: false,
                    },
                    {
                        name: 'reasoning',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'is_junction_table',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'metadata',
                        type: 'jsonb',
                        isNullable: true,
                        comment: 'Additional metadata like cardinality, indexes, etc.',
                    },
                    {
                        name: 'created_by_user_id',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
                indices: [
                    {
                        name: 'IDX_AI_JOIN_DATA_SOURCE',
                        columnNames: ['data_source_id'],
                    },
                    {
                        name: 'IDX_AI_JOIN_SCHEMA_HASH',
                        columnNames: ['data_source_id', 'schema_hash'],
                    },
                    {
                        name: 'IDX_AI_JOIN_TABLES',
                        columnNames: ['data_source_id', 'left_table', 'right_table'],
                    },
                    {
                        name: 'IDX_AI_JOIN_CONFIDENCE',
                        columnNames: ['confidence_score'],
                    },
                ],
            }),
            true
        );

        // Foreign key to dra_data_sources with CASCADE delete
        await queryRunner.createForeignKey(
            'dra_ai_join_suggestions',
            new TableForeignKey({
                name: 'FK_AI_JOIN_DATA_SOURCE',
                columnNames: ['data_source_id'],
                referencedTableName: 'dra_data_sources',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            })
        );

        // Foreign key to dra_users_platform with CASCADE delete
        await queryRunner.createForeignKey(
            'dra_ai_join_suggestions',
            new TableForeignKey({
                name: 'FK_AI_JOIN_USER',
                columnNames: ['created_by_user_id'],
                referencedTableName: 'dra_users_platform',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey('dra_ai_join_suggestions', 'FK_AI_JOIN_USER');
        await queryRunner.dropForeignKey('dra_ai_join_suggestions', 'FK_AI_JOIN_DATA_SOURCE');
        await queryRunner.dropTable('dra_ai_join_suggestions', true);
    }
}
