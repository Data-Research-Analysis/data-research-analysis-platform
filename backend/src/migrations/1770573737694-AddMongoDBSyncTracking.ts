import { MigrationInterface, QueryRunner, TableColumn, Table } from "typeorm";

/**
 * Migration to add MongoDB sync tracking infrastructure
 * 
 * This migration:
 * 1. Creates the dra_mongodb schema in PostgreSQL
 * 2. Adds sync tracking columns to dra_data_sources table
 * 3. Creates dra_mongodb_sync_history table for tracking sync operations
 */
export class AddMongoDBSyncTracking1770573737694 implements MigrationInterface {
    name = 'AddMongoDBSyncTracking1770573737694'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Starting MongoDB sync tracking migration...');

        // 1. Create dra_mongodb schema
        console.log('📁 Creating dra_mongodb schema...');
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS dra_mongodb`);
        console.log('✅ Schema dra_mongodb created');

        // 2. Add sync tracking columns to dra_data_sources
        console.log('📊 Adding sync tracking columns to dra_data_sources...');
        
        const table = await queryRunner.getTable('dra_data_sources');
        
        // Check and add sync_status column
        if (table && !table.findColumnByName('sync_status')) {
            await queryRunner.addColumn('dra_data_sources', new TableColumn({
                name: 'sync_status',
                type: 'varchar',
                length: '50',
                isNullable: true,
                comment: 'Sync status: pending, in_progress, completed, failed'
            }));
            console.log('  ✅ Added sync_status column');
        }

        // Check and add last_sync_at column
        if (table && !table.findColumnByName('last_sync_at')) {
            await queryRunner.addColumn('dra_data_sources', new TableColumn({
                name: 'last_sync_at',
                type: 'timestamp',
                isNullable: true,
                comment: 'Timestamp of last successful sync'
            }));
            console.log('  ✅ Added last_sync_at column');
        }

        // Check and add sync_error_message column
        if (table && !table.findColumnByName('sync_error_message')) {
            await queryRunner.addColumn('dra_data_sources', new TableColumn({
                name: 'sync_error_message',
                type: 'text',
                isNullable: true,
                comment: 'Error message from last sync attempt'
            }));
            console.log('  ✅ Added sync_error_message column');
        }

        // Check and add total_records_synced column
        if (table && !table.findColumnByName('total_records_synced')) {
            await queryRunner.addColumn('dra_data_sources', new TableColumn({
                name: 'total_records_synced',
                type: 'integer',
                default: 0,
                isNullable: false,
                comment: 'Total number of records synced'
            }));
            console.log('  ✅ Added total_records_synced column');
        }

        // Check and add sync_config column
        if (table && !table.findColumnByName('sync_config')) {
            await queryRunner.addColumn('dra_data_sources', new TableColumn({
                name: 'sync_config',
                type: 'jsonb',
                isNullable: true,
                comment: 'Sync configuration: schedule, batch size, incremental settings'
            }));
            console.log('  ✅ Added sync_config column');
        }

        // 3. Create dra_mongodb_sync_history table
        console.log('📝 Creating dra_mongodb_sync_history table...');
        
        const syncHistoryTableExists = await queryRunner.hasTable('dra_mongodb_sync_history');
        
        if (!syncHistoryTableExists) {
            await queryRunner.createTable(
                new Table({
                    name: 'dra_mongodb_sync_history',
                    columns: [
                        {
                            name: 'id',
                            type: 'serial',
                            isPrimary: true
                        },
                        {
                            name: 'data_source_id',
                            type: 'integer',
                            isNullable: false
                        },
                        {
                            name: 'collection_name',
                            type: 'varchar',
                            length: '100',
                            isNullable: false
                        },
                        {
                            name: 'table_name',
                            type: 'varchar',
                            length: '100',
                            isNullable: false,
                            comment: 'PostgreSQL table name in dra_mongodb schema'
                        },
                        {
                            name: 'sync_type',
                            type: 'varchar',
                            length: '50',
                            isNullable: false,
                            comment: 'full or incremental'
                        },
                        {
                            name: 'status',
                            type: 'varchar',
                            length: '50',
                            isNullable: false,
                            comment: 'in_progress, completed, failed'
                        },
                        {
                            name: 'records_synced',
                            type: 'integer',
                            default: 0,
                            isNullable: false
                        },
                        {
                            name: 'records_failed',
                            type: 'integer',
                            default: 0,
                            isNullable: false
                        },
                        {
                            name: 'started_at',
                            type: 'timestamp',
                            default: 'now()',
                            isNullable: false
                        },
                        {
                            name: 'completed_at',
                            type: 'timestamp',
                            isNullable: true
                        },
                        {
                            name: 'error_message',
                            type: 'text',
                            isNullable: true
                        },
                        {
                            name: 'sync_metadata',
                            type: 'jsonb',
                            isNullable: true,
                            comment: 'Additional sync metadata: timestamps, filters, etc.'
                        }
                    ],
                    foreignKeys: [
                        {
                            name: 'fk_sync_history_data_source',
                            columnNames: ['data_source_id'],
                            referencedTableName: 'dra_data_sources',
                            referencedColumnNames: ['id'],
                            onDelete: 'CASCADE'
                        }
                    ],
                    indices: [
                        {
                            name: 'idx_sync_history_data_source',
                            columnNames: ['data_source_id']
                        },
                        {
                            name: 'idx_sync_history_status',
                            columnNames: ['status']
                        },
                        {
                            name: 'idx_sync_history_started_at',
                            columnNames: ['started_at']
                        }
                    ]
                }),
                true
            );
            console.log('✅ Table dra_mongodb_sync_history created');
        } else {
            console.log('⚠️  Table dra_mongodb_sync_history already exists');
        }

        console.log('✅ MongoDB sync tracking migration completed successfully');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Reverting MongoDB sync tracking migration...');

        // Drop sync history table
        const syncHistoryTableExists = await queryRunner.hasTable('dra_mongodb_sync_history');
        if (syncHistoryTableExists) {
            await queryRunner.dropTable('dra_mongodb_sync_history', true);
            console.log('✅ Dropped dra_mongodb_sync_history table');
        }

        // Remove columns from dra_data_sources
        const table = await queryRunner.getTable('dra_data_sources');
        
        if (table && table.findColumnByName('sync_config')) {
            await queryRunner.dropColumn('dra_data_sources', 'sync_config');
            console.log('✅ Removed sync_config column');
        }
        
        if (table && table.findColumnByName('total_records_synced')) {
            await queryRunner.dropColumn('dra_data_sources', 'total_records_synced');
            console.log('✅ Removed total_records_synced column');
        }
        
        if (table && table.findColumnByName('sync_error_message')) {
            await queryRunner.dropColumn('dra_data_sources', 'sync_error_message');
            console.log('✅ Removed sync_error_message column');
        }
        
        if (table && table.findColumnByName('last_sync_at')) {
            await queryRunner.dropColumn('dra_data_sources', 'last_sync_at');
            console.log('✅ Removed last_sync_at column');
        }
        
        if (table && table.findColumnByName('sync_status')) {
            await queryRunner.dropColumn('dra_data_sources', 'sync_status');
            console.log('✅ Removed sync_status column');
        }

        // Drop dra_mongodb schema (only if empty)
        await queryRunner.query(`DROP SCHEMA IF EXISTS dra_mongodb CASCADE`);
        console.log('✅ Dropped dra_mongodb schema');

        console.log('✅ MongoDB sync tracking migration reverted successfully');
    }
}
