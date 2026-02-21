import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Backfill Migration: Populate metadata for existing MongoDB tables
 * 
 * This migration creates metadata entries for MongoDB tables that were created
 * before the MongoDBImportService metadata creation was implemented.
 * It scans existing MongoDB tables in dra_mongodb schema and generates appropriate metadata.
 */
export class BackfillMongoDBTableMetadata1771006573000 implements MigrationInterface {
    name = 'BackfillMongoDBTableMetadata1771006573000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Starting backfill of MongoDB table metadata...');

        await this.backfillMongoDBTables(queryRunner);

        console.log('✅ MongoDB metadata backfill completed successfully!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove all backfilled metadata (optional - for rollback)
        await queryRunner.query(`
            DELETE FROM dra_table_metadata 
            WHERE table_type = 'mongodb'
        `);
        console.log('✅ MongoDB metadata backfill rolled back');
    }

    /**
     * Backfill MongoDB tables
     * Pattern: {collectionName}_{dataSourceId}
     */
    private async backfillMongoDBTables(queryRunner: QueryRunner): Promise<void> {
        console.log('  🍃 Backfilling MongoDB tables...');

        // Get all MongoDB tables from dra_mongodb schema
        const mongoTables = await queryRunner.query(`
            SELECT 
                tb.table_name,
                ds.id as data_source_id,
                ds.users_platform_id
            FROM information_schema.tables tb
            JOIN dra_data_sources ds ON ds.data_type = 'mongodb'
            WHERE tb.table_schema = 'dra_mongodb'
              AND tb.table_type = 'BASE TABLE'
              AND NOT EXISTS (
                  SELECT 1 FROM dra_table_metadata 
                  WHERE physical_table_name = tb.table_name 
                    AND schema_name = 'dra_mongodb'
              )
        `);

        if (mongoTables.length === 0) {
            console.log('  ℹ️  No MongoDB tables need backfilling');
            return;
        }

        for (const table of mongoTables) {
            try {
                // Extract collection name from table name
                // Format: {collectionName}_{dataSourceId}
                // We need to remove the trailing _dataSourceId to get the original collection name
                const tableName = table.table_name;
                const dataSourceId = table.data_source_id;
                
                // Check if table ends with _dataSourceId pattern
                const suffix = `_${dataSourceId}`;
                let collectionName = tableName;
                
                if (tableName.endsWith(suffix)) {
                    collectionName = tableName.substring(0, tableName.length - suffix.length);
                }

                // Convert underscores to spaces for logical name (more readable)
                const logicalName = collectionName.replace(/_/g, ' ');

                // Check if metadata already exists
                const existing = await queryRunner.query(`
                    SELECT id FROM dra_table_metadata 
                    WHERE schema_name = $1 AND physical_table_name = $2
                `, ['dra_mongodb', tableName]);

                if (existing.length === 0) {
                    // Insert only if doesn't exist
                    await queryRunner.query(`
                        INSERT INTO dra_table_metadata (
                            data_source_id,
                            users_platform_id,
                            schema_name,
                            physical_table_name,
                            logical_table_name,
                            original_sheet_name,
                            table_type
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        table.data_source_id,
                        table.users_platform_id,
                        'dra_mongodb',
                        tableName,
                        logicalName,
                        collectionName,
                        'mongodb'
                    ]);

                    console.log(`    ✓ ${tableName} → ${logicalName}`);
                } else {
                    console.log(`    ℹ️  ${tableName} → ${logicalName} (already exists)`);
                }
            } catch (error) {
                console.error(`    ✗ Failed to backfill ${table.table_name}:`, error);
            }
        }

        console.log(`  ✅ Backfilled ${mongoTables.length} MongoDB tables`);
    }
}
