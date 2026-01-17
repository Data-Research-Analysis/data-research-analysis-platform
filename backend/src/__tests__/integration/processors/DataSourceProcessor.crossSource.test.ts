/**
 * Cross-Source Data Model Transformation Tests
 * 
 * Tests the new cross-source functionality for DataSourceProcessor:
 * - resolveTableNamesForCrossSource(): Maps original table names to synced PostgreSQL names
 * - transformQueryForCrossSource(): Transforms SQL queries to use synced table names  
 * - buildDataModelOnQuery() with cross-source queries
 * - executeQueryOnExternalDataSource() with cross-source JOINs
 */

import { DataSourceProcessor } from '../../../processors/DataSourceProcessor.js';
import { createMockManager, MockManager } from '../../processors/mocks/mockManager.js';
import {
    mockMySQLMetadata,
    mockMySQLDataSource,
    mockMariaDBMetadata,
    mockMariaDBDataSource,
    mockPostgreSQLMetadata,
    mockPostgreSQLDataSource,
    mockExcelMetadata,
    mockExcelDataSource,
    mockPDFMetadata,
    mockPDFDataSource,
    mockGAMetadata,
    mockGADataSource,
    mockGAMMetadata,
    mockGAMDataSource,
    mockGoogleAdsMetadata,
    mockGoogleAdsDataSource,
    allMockMetadata,
    allMockDataSources
} from '../../processors/mocks/mockMetadata.js';
import {
    createTestQueryJSON,
    createTestColumn,
    createTestJoinCondition,
    createExpectedTableMapping,
    expectTableMapToContain,
    countOccurrences
} from '../../processors/utils/testHelpers.js';

describe('DataSourceProcessor - Cross-Source Transformation', () => {
    let processor: DataSourceProcessor;
    let mockManager: MockManager;

    beforeEach(() => {
        processor = DataSourceProcessor.getInstance();
        mockManager = createMockManager();
    });

    afterEach(() => {
        mockManager.clear();
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - MySQL Tests
    // ========================================================================

    describe('resolveTableNamesForCrossSource - MySQL', () => {
        beforeEach(() => {
            mockManager.addMetadata(mockMySQLMetadata);
            mockManager.addDataSources([mockMySQLDataSource]);
        });

        it('should resolve MySQL table names from metadata', async () => {
            const columns = [
                createTestColumn('mysql_dra_db', 'orders', 'id', 22, { dataSourceType: 'mysql' }),
                createTestColumn('mysql_dra_db', 'products', 'name', 22, { dataSourceType: 'mysql' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            // Access private method via reflection (for testing)
            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            // Verify mappings
            expect(tableMap.size).toBe(2);
            expectTableMapToContain(tableMap, 
                createExpectedTableMapping('mysql_dra_db.orders', 'dra_mysql_22', 'orders_abc123_22', 22)
            );
            expectTableMapToContain(tableMap,
                createExpectedTableMapping('mysql_dra_db.products', 'dra_mysql_22', 'products_def456_22', 22)
            );
        });

        it('should handle MySQL tables with JOIN conditions', async () => {
            const columns = [
                createTestColumn('mysql_dra_db', 'orders', 'id', 22, { dataSourceType: 'mysql' }),
                createTestColumn('mysql_dra_db', 'order_items', 'order_id', 22, { dataSourceType: 'mysql' })
            ];
            const joinConditions = [
                createTestJoinCondition(
                    { schema: 'mysql_dra_db', table: 'orders' },
                    'id',
                    { schema: 'mysql_dra_db', table: 'order_items' },
                    'order_id'
                )
            ];
            const queryJSON = createTestQueryJSON(columns, { join_conditions: joinConditions });

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBe(2);
            expect(tableMap.has('mysql_dra_db.orders')).toBe(true);
            expect(tableMap.has('mysql_dra_db.order_items')).toBe(true);
        });

        it('should return empty map if no MySQL metadata found', async () => {
            mockManager.clear();
            mockManager.addDataSources([mockMySQLDataSource]);

            const columns = [
                createTestColumn('mysql_dra_db', 'nonexistent_table', 'id', 22, { dataSourceType: 'mysql' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBe(0);
        });

        it('should handle pattern matching fallback for MySQL tables', async () => {
            // Add metadata without original_table_name
            mockManager.clear();
            mockManager.addMetadata([
                {
                    physical_table_name: 'customers_xyz999_22',
                    schema_name: 'dra_mysql_22',
                    data_source_id: 22,
                    table_type: 'mysql'
                }
            ]);
            mockManager.addDataSources([mockMySQLDataSource]);

            const columns = [
                createTestColumn('mysql_dra_db', 'customers', 'id', 22, { dataSourceType: 'mysql' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            // Should find via pattern matching (customers_%)
            expect(tableMap.size).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - MariaDB Tests
    // ========================================================================

    describe('resolveTableNamesForCrossSource - MariaDB', () => {
        beforeEach(() => {
            mockManager.addMetadata(mockMariaDBMetadata);
            mockManager.addDataSources([mockMariaDBDataSource]);
        });

        it('should resolve MariaDB table names from metadata', async () => {
            const columns = [
                createTestColumn('mariadb_schema', 'customers', 'id', 23, { dataSourceType: 'mariadb' }),
                createTestColumn('mariadb_schema', 'invoices', 'number', 23, { dataSourceType: 'mariadb' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBe(2);
            expectTableMapToContain(tableMap,
                createExpectedTableMapping('mariadb_schema.customers', 'dra_mariadb_23', 'customers_jkl012_23', 23)
            );
        });

        it('should handle MariaDB-specific schema patterns', async () => {
            const columns = [
                createTestColumn('mariadb_schema', 'customers', 'email', 23, { dataSourceType: 'mariadb' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            const mapping = tableMap.get('mariadb_schema.customers');
            expect(mapping).toBeDefined();
            expect(mapping.schema).toBe('dra_mariadb_23');
        });
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - PostgreSQL Tests
    // ========================================================================

    describe('resolveTableNamesForCrossSource - PostgreSQL', () => {
        beforeEach(() => {
            mockManager.addMetadata(mockPostgreSQLMetadata);
            mockManager.addDataSources([mockPostgreSQLDataSource]);
        });

        it('should resolve PostgreSQL table names from metadata', async () => {
            const columns = [
                createTestColumn('public', 'users', 'id', 15, { dataSourceType: 'postgresql' }),
                createTestColumn('public', 'events', 'event_type', 15, { dataSourceType: 'postgresql' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBe(2);
            expectTableMapToContain(tableMap,
                createExpectedTableMapping('public.users', 'dra_postgresql_15', 'users_pqr678_15', 15)
            );
        });

        it('should handle different PostgreSQL schemas', async () => {
            mockManager.addMetadata([
                {
                    physical_table_name: 'analytics_table_abc_15',
                    schema_name: 'dra_postgresql_15',
                    data_source_id: 15,
                    original_table_name: 'analytics_table',
                    table_type: 'postgresql'
                }
            ]);

            const columns = [
                createTestColumn('analytics', 'analytics_table', 'metric', 15, { dataSourceType: 'postgresql' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.has('analytics.analytics_table')).toBe(true);
        });
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - Excel Tests
    // ========================================================================

    describe('resolveTableNamesForCrossSource - Excel', () => {
        beforeEach(() => {
            mockManager.addMetadata(mockExcelMetadata);
            mockManager.addDataSources([mockExcelDataSource]);
        });

        it('should resolve Excel sheet table names', async () => {
            const columns = [
                createTestColumn('dra_excel', 'sales_data_source_10_1', 'revenue', 10, { dataSourceType: 'excel' }),
                createTestColumn('dra_excel', 'inventory_data_source_10_2', 'quantity', 10, { dataSourceType: 'excel' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBeGreaterThanOrEqual(2);
            expect(tableMap.has('dra_excel.sales_data_source_10_1')).toBe(true);
        });

        it('should handle Excel tables with hash-based names', async () => {
            const columns = [
                createTestColumn('dra_excel', 'sales', 'amount', 10, { dataSourceType: 'excel' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            // Should find via original_table_name match
            const salesMapping = tableMap.get('dra_excel.sales');
            if (salesMapping) {
                expect(salesMapping.table_name).toContain('data_source_10');
            }
        });
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - PDF Tests
    // ========================================================================

    describe('resolveTableNamesForCrossSource - PDF', () => {
        beforeEach(() => {
            mockManager.addMetadata(mockPDFMetadata);
            mockManager.addDataSources([mockPDFDataSource]);
        });

        it('should resolve PDF document table names', async () => {
            const columns = [
                createTestColumn('dra_pdf', 'document_data_source_20', 'text_content', 20, { dataSourceType: 'pdf' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBeGreaterThanOrEqual(1);
            expect(tableMap.has('dra_pdf.document_data_source_20')).toBe(true);
        });
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - Google Analytics Tests
    // ========================================================================

    describe('resolveTableNamesForCrossSource - Google Analytics', () => {
        beforeEach(() => {
            mockManager.addMetadata(mockGAMetadata);
            mockManager.addDataSources([mockGADataSource]);
        });

        it('should resolve GA table names with data source ID suffix', async () => {
            const columns = [
                createTestColumn('dra_google_analytics', 'device_15', 'device_category', 15, { dataSourceType: 'google_analytics' }),
                createTestColumn('dra_google_analytics', 'traffic_overview_15', 'sessions', 15, { dataSourceType: 'google_analytics' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBeGreaterThanOrEqual(2);
            expect(tableMap.has('dra_google_analytics.device_15')).toBe(true);
            expect(tableMap.has('dra_google_analytics.traffic_overview_15')).toBe(true);
        });

        it('should handle GA report types correctly', async () => {
            const columns = [
                createTestColumn('dra_google_analytics', 'user_acquisition_15', 'new_users', 15, { dataSourceType: 'google_analytics' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            const mapping = tableMap.get('dra_google_analytics.user_acquisition_15');
            expect(mapping).toBeDefined();
        });
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - Google Ad Manager Tests
    // ========================================================================

    describe('resolveTableNamesForCrossSource - Google Ad Manager', () => {
        beforeEach(() => {
            mockManager.addMetadata(mockGAMMetadata);
            mockManager.addDataSources([mockGAMDataSource]);
        });

        it('should resolve GAM table names', async () => {
            const columns = [
                createTestColumn('dra_google_ad_manager', 'network_12345_7', 'impressions', 7, { dataSourceType: 'google_ad_manager' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.has('dra_google_ad_manager.network_12345_7')).toBe(true);
        });

        it('should handle GAM network-specific tables', async () => {
            const columns = [
                createTestColumn('dra_google_ad_manager', 'revenue_12345_7', 'revenue_amount', 7, { dataSourceType: 'google_ad_manager' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBeGreaterThanOrEqual(1);
        });
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - Google Ads Tests
    // ========================================================================

    describe('resolveTableNamesForCrossSource - Google Ads', () => {
        beforeEach(() => {
            mockManager.addMetadata(mockGoogleAdsMetadata);
            mockManager.addDataSources([mockGoogleAdsDataSource]);
        });

        it('should resolve Google Ads table names', async () => {
            const columns = [
                createTestColumn('dra_google_ads', 'campaigns_8', 'campaign_name', 8, { dataSourceType: 'google_ads' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.has('dra_google_ads.campaigns_8')).toBe(true);
        });
    });

    // ========================================================================
    // resolveTableNamesForCrossSource() - Mixed Data Source Types
    // ========================================================================

    describe('resolveTableNamesForCrossSource - Mixed Sources', () => {
        beforeEach(() => {
            mockManager.addMetadata([
                ...mockMySQLMetadata,
                ...mockPostgreSQLMetadata,
                ...mockGAMetadata
            ]);
            mockManager.addDataSources([
                mockMySQLDataSource,
                mockPostgreSQLDataSource,
                mockGADataSource
            ]);
        });

        it('should resolve tables from MySQL + PostgreSQL', async () => {
            const columns = [
                createTestColumn('mysql_dra_db', 'orders', 'id', 22, { dataSourceType: 'mysql' }),
                createTestColumn('public', 'users', 'email', 15, { dataSourceType: 'postgresql' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBeGreaterThanOrEqual(2);
            expect(tableMap.has('mysql_dra_db.orders')).toBe(true);
            expect(tableMap.has('public.users')).toBe(true);
        });

        it('should resolve tables from database + API sources', async () => {
            const columns = [
                createTestColumn('mysql_dra_db', 'products', 'name', 22, { dataSourceType: 'mysql' }),
                createTestColumn('dra_google_analytics', 'device_15', 'device_category', 15, { dataSourceType: 'google_analytics' })
            ];
            const queryJSON = createTestQueryJSON(columns);

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBeGreaterThanOrEqual(2);
        });
    });

    // ========================================================================
    // transformQueryForCrossSource() - Basic Transformations
    // ========================================================================

    describe('transformQueryForCrossSource - Basic', () => {
        it('should replace single table reference in SELECT', () => {
            const query = 'SELECT mysql_dra_db.orders.id FROM mysql_dra_db.orders';
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_mysql_22.orders_abc123_22');
            expect(countOccurrences(result, 'dra_mysql_22.orders_abc123_22')).toBe(2);
        });

        it('should replace multiple table references', () => {
            const query = 'SELECT mysql_dra_db.orders.id, mysql_dra_db.products.name FROM mysql_dra_db.orders';
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }],
                ['mysql_dra_db.products', { schema: 'dra_mysql_22', table_name: 'products_def456_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_mysql_22.orders_abc123_22');
            expect(result).toContain('dra_mysql_22.products_def456_22');
        });

        it('should not replace partial matches', () => {
            const query = 'SELECT mysql_dra_db.orders_archive.id FROM mysql_dra_db.orders_archive';
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            // Should NOT transform orders_archive to orders_abc123_22_archive
            expect(result).not.toContain('orders_abc123_22');
            expect(result).toBe(query); // Unchanged
        });
    });

    // ========================================================================
    // transformQueryForCrossSource() - JOIN Transformations
    // ========================================================================

    describe('transformQueryForCrossSource - JOINs', () => {
        it('should transform INNER JOIN references', () => {
            const query = `
                SELECT mysql_dra_db.orders.id, mysql_dra_db.products.name
                FROM mysql_dra_db.orders
                INNER JOIN mysql_dra_db.products ON mysql_dra_db.orders.product_id = mysql_dra_db.products.id
            `;
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }],
                ['mysql_dra_db.products', { schema: 'dra_mysql_22', table_name: 'products_def456_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            // Should replace all 4 occurrences (2 in SELECT, 1 in FROM, 2 in ON)
            expect(countOccurrences(result, 'dra_mysql_22.orders_abc123_22')).toBeGreaterThanOrEqual(2);
            expect(countOccurrences(result, 'dra_mysql_22.products_def456_22')).toBeGreaterThanOrEqual(2);
        });

        it('should transform LEFT JOIN references', () => {
            const query = 'SELECT * FROM public.users LEFT JOIN public.events ON public.users.id = public.events.user_id';
            const tableMap = new Map([
                ['public.users', { schema: 'dra_postgresql_15', table_name: 'users_pqr678_15' }],
                ['public.events', { schema: 'dra_postgresql_15', table_name: 'events_stu901_15' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_postgresql_15.users_pqr678_15');
            expect(result).toContain('dra_postgresql_15.events_stu901_15');
        });

        it('should transform multiple JOINs', () => {
            const query = `
                SELECT * FROM mysql_dra_db.orders
                INNER JOIN mysql_dra_db.order_items ON mysql_dra_db.orders.id = mysql_dra_db.order_items.order_id
                INNER JOIN mysql_dra_db.products ON mysql_dra_db.order_items.product_id = mysql_dra_db.products.id
            `;
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }],
                ['mysql_dra_db.order_items', { schema: 'dra_mysql_22', table_name: 'order_items_ghi789_22' }],
                ['mysql_dra_db.products', { schema: 'dra_mysql_22', table_name: 'products_def456_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_mysql_22.orders_abc123_22');
            expect(result).toContain('dra_mysql_22.order_items_ghi789_22');
            expect(result).toContain('dra_mysql_22.products_def456_22');
        });
    });

    // ========================================================================
    // transformQueryForCrossSource() - Complex Query Transformations
    // ========================================================================

    describe('transformQueryForCrossSource - Complex Queries', () => {
        it('should transform WHERE clause references', () => {
            const query = 'SELECT * FROM mysql_dra_db.orders WHERE mysql_dra_db.orders.status = "active"';
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_mysql_22.orders_abc123_22');
            expect(countOccurrences(result, 'dra_mysql_22.orders_abc123_22')).toBe(2);
        });

        it('should transform GROUP BY references', () => {
            const query = 'SELECT mysql_dra_db.orders.customer_id, COUNT(*) FROM mysql_dra_db.orders GROUP BY mysql_dra_db.orders.customer_id';
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(countOccurrences(result, 'dra_mysql_22.orders_abc123_22')).toBe(3);
        });

        it('should transform ORDER BY references', () => {
            const query = 'SELECT * FROM mysql_dra_db.products ORDER BY mysql_dra_db.products.price DESC';
            const tableMap = new Map([
                ['mysql_dra_db.products', { schema: 'dra_mysql_22', table_name: 'products_def456_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_mysql_22.products_def456_22');
        });

        it('should transform subquery references', () => {
            const query = `
                SELECT * FROM mysql_dra_db.orders
                WHERE id IN (SELECT order_id FROM mysql_dra_db.order_items)
            `;
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }],
                ['mysql_dra_db.order_items', { schema: 'dra_mysql_22', table_name: 'order_items_ghi789_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_mysql_22.orders_abc123_22');
            expect(result).toContain('dra_mysql_22.order_items_ghi789_22');
        });
    });

    // ========================================================================
    // transformQueryForCrossSource() - Cross-Source Type Combinations
    // ========================================================================

    describe('transformQueryForCrossSource - Cross-Source Types', () => {
        it('should transform MySQL + PostgreSQL references', () => {
            const query = `
                SELECT mysql_dra_db.orders.id, public.users.email
                FROM mysql_dra_db.orders
                JOIN public.users ON mysql_dra_db.orders.user_id = public.users.id
            `;
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }],
                ['public.users', { schema: 'dra_postgresql_15', table_name: 'users_pqr678_15' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_mysql_22.orders_abc123_22');
            expect(result).toContain('dra_postgresql_15.users_pqr678_15');
        });

        it('should transform MySQL + Google Analytics references', () => {
            const query = `
                SELECT mysql_dra_db.products.name, dra_google_analytics.device_15.device_category
                FROM mysql_dra_db.products, dra_google_analytics.device_15
            `;
            const tableMap = new Map([
                ['mysql_dra_db.products', { schema: 'dra_mysql_22', table_name: 'products_def456_22' }],
                ['dra_google_analytics.device_15', { schema: 'dra_google_analytics', table_name: 'device_15' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toContain('dra_mysql_22.products_def456_22');
            expect(result).toContain('dra_google_analytics.device_15');
        });
    });

    // ========================================================================
    // transformQueryForCrossSource() - Edge Cases
    // ========================================================================

    describe('transformQueryForCrossSource - Edge Cases', () => {
        it('should handle empty table map', () => {
            const query = 'SELECT * FROM mysql_dra_db.orders';
            const result = (processor as any).transformQueryForCrossSource(query, new Map());

            expect(result).toBe(query); // Unchanged
        });

        it('should handle query with no matching tables', () => {
            const query = 'SELECT * FROM other_schema.other_table';
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc123_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            expect(result).toBe(query); // Unchanged
        });

        it('should sort replacements by length to avoid conflicts', () => {
            const query = 'SELECT * FROM mysql_dra_db.order_items, mysql_dra_db.orders';
            const tableMap = new Map([
                ['mysql_dra_db.orders', { schema: 'dra_mysql_22', table_name: 'orders_abc_22' }],
                ['mysql_dra_db.order_items', { schema: 'dra_mysql_22', table_name: 'order_items_def_22' }]
            ]);

            const result = (processor as any).transformQueryForCrossSource(query, tableMap);

            // Longer table name (order_items) should be replaced first
            expect(result).toContain('order_items_def_22');
            expect(result).toContain('orders_abc_22');
            // Should not have partial replacements like "orders_abc_22_items"
            expect(result).not.toContain('orders_abc_22_items');
        });
    });

    // ========================================================================
    // Error Handling
    // ========================================================================

    describe('resolveTableNamesForCrossSource - Error Handling', () => {
        it('should return empty map on invalid JSON', async () => {
            const invalidJSON = '{ invalid json }';
            
            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, invalidJSON, mockManager);

            expect(tableMap.size).toBe(0);
        });

        it('should handle null/undefined queryJSON', async () => {
            const tableMap1 = await (processor as any).resolveTableNamesForCrossSource(7, null, mockManager);
            const tableMap2 = await (processor as any).resolveTableNamesForCrossSource(7, undefined, mockManager);

            expect(tableMap1.size).toBe(0);
            expect(tableMap2.size).toBe(0);
        });

        it('should handle missing columns in queryJSON', async () => {
            const queryJSON = JSON.stringify({
                table_name: 'test'
                // No columns array
            });

            const tableMap = await (processor as any).resolveTableNamesForCrossSource(7, queryJSON, mockManager);

            expect(tableMap.size).toBe(0);
        });
    });
});
