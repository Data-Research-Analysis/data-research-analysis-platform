import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Backfill Migration: Populate metadata for existing tables
 * 
 * This migration creates metadata entries for tables that were created
 * before the hash-based naming system was implemented. It scans existing
 * Excel, PDF, and Google service tables and generates appropriate metadata.
 */
export class BackfillTableMetadata1766686000000 implements MigrationInterface {
    name = 'BackfillTableMetadata1766686000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Starting backfill of table metadata for existing tables...');

        // 1. Backfill Excel tables
        await this.backfillExcelTables(queryRunner);

        // 2. Backfill PDF tables
        await this.backfillPDFTables(queryRunner);

        // 3. Backfill Google Analytics tables
        await this.backfillGoogleAnalyticsTables(queryRunner);

        // 4. Backfill Google Ad Manager tables
        await this.backfillGoogleAdManagerTables(queryRunner);

        // 5. Backfill Google Ads tables
        await this.backfillGoogleAdsTables(queryRunner);

        console.log('✅ Backfill completed successfully!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove all backfilled metadata (optional - for rollback)
        await queryRunner.query(`
            DELETE FROM dra_table_metadata 
            WHERE table_type IN ('excel', 'pdf', 'google_analytics', 'google_ad_manager', 'google_ads')
        `);
        console.log('✅ Backfill rolled back');
    }

    /**
     * Backfill Excel tables
     * Pattern: excel_{fileId}_data_source_{dataSourceId}_{sheetName}
     */
    private async backfillExcelTables(queryRunner: QueryRunner): Promise<void> {
        console.log('  📊 Backfilling Excel tables...');

        const excelTables = await queryRunner.query(`
            SELECT 
                tb.table_name,
                ds.id as data_source_id,
                ds.users_platform_id
            FROM information_schema.tables tb
            JOIN dra_data_sources ds ON ds.data_type = 'excel'
            WHERE tb.table_schema = 'dra_excel'
              AND tb.table_name LIKE 'excel_%data_source_%'
              AND NOT EXISTS (
                  SELECT 1 FROM dra_table_metadata 
                  WHERE physical_table_name = tb.table_name 
                    AND schema_name = 'dra_excel'
              )
        `);

        for (const table of excelTables) {
            try {
                // Extract sheet name from table name
                // Format: excel_{fileId}_data_source_{dataSourceId}_{sheetName}
                const parts = table.table_name.split('_data_source_');
                const sheetPart = parts[1]?.split('_').slice(1).join('_') || 'Unknown';
                const logicalName = sheetPart.replace(/_/g, ' ');

                await queryRunner.query(`
                    INSERT INTO dra_table_metadata (
                        data_source_id,
                        users_platform_id,
                        schema_name,
                        physical_table_name,
                        logical_table_name,
                        original_sheet_name,
                        file_id,
                        table_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (schema_name, physical_table_name) DO NOTHING
                `, [
                    table.data_source_id,
                    table.users_platform_id,
                    'dra_excel',
                    table.table_name,
                    logicalName,
                    logicalName,
                    parts[0].replace('excel_', ''),
                    'excel'
                ]);

                console.log(`    ✓ ${table.table_name} → ${logicalName}`);
            } catch (error) {
                console.error(`    ✗ Failed to backfill ${table.table_name}:`, error);
            }
        }

        console.log(`  ✅ Backfilled ${excelTables.length} Excel tables`);
    }

    /**
     * Backfill PDF tables
     * Pattern: pdf_{fileId}_data_source_{dataSourceId}_{sheetName}
     */
    private async backfillPDFTables(queryRunner: QueryRunner): Promise<void> {
        console.log('  📄 Backfilling PDF tables...');

        const pdfTables = await queryRunner.query(`
            SELECT 
                tb.table_name,
                ds.id as data_source_id,
                ds.users_platform_id
            FROM information_schema.tables tb
            JOIN dra_data_sources ds ON ds.data_type = 'pdf'
            WHERE tb.table_schema = 'dra_pdf'
              AND tb.table_name LIKE 'pdf_%data_source_%'
              AND NOT EXISTS (
                  SELECT 1 FROM dra_table_metadata 
                  WHERE physical_table_name = tb.table_name 
                    AND schema_name = 'dra_pdf'
              )
        `);

        for (const table of pdfTables) {
            try {
                const parts = table.table_name.split('_data_source_');
                const sheetPart = parts[1]?.split('_').slice(1).join('_') || 'Unknown';
                const logicalName = sheetPart.replace(/_/g, ' ');

                await queryRunner.query(`
                    INSERT INTO dra_table_metadata (
                        data_source_id,
                        users_platform_id,
                        schema_name,
                        physical_table_name,
                        logical_table_name,
                        original_sheet_name,
                        file_id,
                        table_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (schema_name, physical_table_name) DO NOTHING
                `, [
                    table.data_source_id,
                    table.users_platform_id,
                    'dra_pdf',
                    table.table_name,
                    logicalName,
                    logicalName,
                    parts[0].replace('pdf_', ''),
                    'pdf'
                ]);

                console.log(`    ✓ ${table.table_name} → ${logicalName}`);
            } catch (error) {
                console.error(`    ✗ Failed to backfill ${table.table_name}:`, error);
            }
        }

        console.log(`  ✅ Backfilled ${pdfTables.length} PDF tables`);
    }

    /**
     * Backfill Google Analytics tables
     * Pattern: {report_type}_{dataSourceId}
     */
    private async backfillGoogleAnalyticsTables(queryRunner: QueryRunner): Promise<void> {
        console.log('  📈 Backfilling Google Analytics tables...');

        // Check if google_analytics enum value exists
        const enumValueExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'dra_data_sources_data_type_enum'
                AND e.enumlabel = 'google_analytics'
            );
        `);

        if (!enumValueExists[0].exists) {
            console.log('  ⚠️  google_analytics enum value does not exist yet, skipping');
            return;
        }

        const gaTables = await queryRunner.query(`
            SELECT 
                tb.table_name,
                ds.id as data_source_id,
                ds.users_platform_id,
                ds.connection_details->'api_connection_details'->'api_config'->>'property_id' as property_id
            FROM information_schema.tables tb
            CROSS JOIN dra_data_sources ds
            WHERE tb.table_schema = 'dra_google_analytics'
              AND ds.data_type = 'google_analytics'
              AND tb.table_name ~ '_[0-9]+$'
              AND NOT EXISTS (
                  SELECT 1 FROM dra_table_metadata 
                  WHERE physical_table_name = tb.table_name 
                    AND schema_name = 'dra_google_analytics'
              )
        `);

        const reportTypes = {
            'traffic_overview': 'Traffic Overview',
            'page_performance': 'Page Performance',
            'user_acquisition': 'User Acquisition',
            'geographic': 'Geographic',
            'device': 'Device',
            'events': 'Events'
        };

        for (const table of gaTables) {
            try {
                // Extract report type from table name
                const tableName = table.table_name;
                const reportType = Object.keys(reportTypes).find(type => 
                    tableName.startsWith(type + '_')
                );

                if (reportType) {
                    const logicalName = reportTypes[reportType];

                    await queryRunner.query(`
                        INSERT INTO dra_table_metadata (
                            data_source_id,
                            users_platform_id,
                            schema_name,
                            physical_table_name,
                            logical_table_name,
                            original_sheet_name,
                            file_id,
                            table_type
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (schema_name, physical_table_name) DO NOTHING
                    `, [
                        table.data_source_id,
                        table.users_platform_id,
                        'dra_google_analytics',
                        tableName,
                        logicalName,
                        logicalName,
                        table.property_id || 'unknown',
                        'google_analytics'
                    ]);

                    console.log(`    ✓ ${tableName} → ${logicalName}`);
                }
            } catch (error) {
                console.error(`    ✗ Failed to backfill ${table.table_name}:`, error);
            }
        }

        console.log(`  ✅ Backfilled ${gaTables.length} Google Analytics tables`);
    }

    /**
     * Backfill Google Ad Manager tables
     */
    private async backfillGoogleAdManagerTables(queryRunner: QueryRunner): Promise<void> {
        console.log('  📊 Backfilling Google Ad Manager tables...');

        // Check if google_ad_manager enum value exists
        const enumValueExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'dra_data_sources_data_type_enum'
                AND e.enumlabel = 'google_ad_manager'
            );
        `);

        if (!enumValueExists[0].exists) {
            console.log('  ⚠️  google_ad_manager enum value does not exist yet, skipping');
            return;
        }

        const gamTables = await queryRunner.query(`
            SELECT 
                tb.table_name,
                ds.id as data_source_id,
                ds.users_platform_id,
                ds.connection_details->'api_connection_details'->'api_config'->>'network_code' as network_code
            FROM information_schema.tables tb
            CROSS JOIN dra_data_sources ds
            WHERE tb.table_schema = 'dra_google_ad_manager'
              AND ds.data_type = 'google_ad_manager'
              AND tb.table_name ~ '_[0-9]+$'
              AND NOT EXISTS (
                  SELECT 1 FROM dra_table_metadata 
                  WHERE physical_table_name = tb.table_name 
                    AND schema_name = 'dra_google_ad_manager'
              )
        `);

        const reportTypes = {
            'revenue': 'Revenue',
            'geography': 'Geography',
            'device': 'Device',
            'ad_unit': 'Ad Unit',
            'advertiser': 'Advertiser',
            'time_series': 'Time Series'
        };

        for (const table of gamTables) {
            try {
                const tableName = table.table_name;
                const reportType = Object.keys(reportTypes).find(type => 
                    tableName.startsWith(type + '_')
                );

                if (reportType) {
                    const logicalName = reportTypes[reportType];

                    await queryRunner.query(`
                        INSERT INTO dra_table_metadata (
                            data_source_id,
                            users_platform_id,
                            schema_name,
                            physical_table_name,
                            logical_table_name,
                            original_sheet_name,
                            file_id,
                            table_type
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (schema_name, physical_table_name) DO NOTHING
                    `, [
                        table.data_source_id,
                        table.users_platform_id,
                        'dra_google_ad_manager',
                        tableName,
                        logicalName,
                        logicalName,
                        table.network_code || 'unknown',
                        'google_ad_manager'
                    ]);

                    console.log(`    ✓ ${tableName} → ${logicalName}`);
                }
            } catch (error) {
                console.error(`    ✗ Failed to backfill ${table.table_name}:`, error);
            }
        }

        console.log(`  ✅ Backfilled ${gamTables.length} Google Ad Manager tables`);
    }

    /**
     * Backfill Google Ads tables
     */
    private async backfillGoogleAdsTables(queryRunner: QueryRunner): Promise<void> {
        console.log('  📢 Backfilling Google Ads tables...');

        // Check if google_ads enum value exists
        const enumValueExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'dra_data_sources_data_type_enum'
                AND e.enumlabel = 'google_ads'
            );
        `);

        if (!enumValueExists[0].exists) {
            console.log('  ⚠️  google_ads enum value does not exist yet, skipping');
            return;
        }

        const adsTables = await queryRunner.query(`
            SELECT 
                tb.table_name,
                ds.id as data_source_id,
                ds.users_platform_id,
                ds.connection_details->'api_connection_details'->'api_config'->>'customer_id' as customer_id
            FROM information_schema.tables tb
            CROSS JOIN dra_data_sources ds
            WHERE tb.table_schema = 'dra_google_ads'
              AND ds.data_type = 'google_ads'
              AND tb.table_name ~ '_[0-9]+$'
              AND NOT EXISTS (
                  SELECT 1 FROM dra_table_metadata 
                  WHERE physical_table_name = tb.table_name 
                    AND schema_name = 'dra_google_ads'
              )
        `);

        const reportTypes = {
            'campaigns': 'Campaigns',
            'keywords': 'Keywords',
            'geographic': 'Geographic',
            'device': 'Device'
        };

        for (const table of adsTables) {
            try {
                const tableName = table.table_name;
                const reportType = Object.keys(reportTypes).find(type => 
                    tableName.startsWith(type + '_')
                );

                if (reportType) {
                    const logicalName = reportTypes[reportType];

                    await queryRunner.query(`
                        INSERT INTO dra_table_metadata (
                            data_source_id,
                            users_platform_id,
                            schema_name,
                            physical_table_name,
                            logical_table_name,
                            original_sheet_name,
                            file_id,
                            table_type
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (schema_name, physical_table_name) DO NOTHING
                    `, [
                        table.data_source_id,
                        table.users_platform_id,
                        'dra_google_ads',
                        tableName,
                        logicalName,
                        logicalName,
                        table.customer_id || 'unknown',
                        'google_ads'
                    ]);

                    console.log(`    ✓ ${tableName} → ${logicalName}`);
                }
            } catch (error) {
                console.error(`    ✗ Failed to backfill ${table.table_name}:`, error);
            }
        }

        console.log(`  ✅ Backfilled ${adsTables.length} Google Ads tables`);
    }
}
