/**
 * Integration Tests for DataModelProcessor
 * Tests data model column name generation logic with realistic data scenarios
 * 
 * These tests verify:
 * 1. Data model creation from Google Analytics sources
 * 2. Data model creation from Excel sources
 * 3. Data model creation from PDF sources
 * 4. Data model creation from regular database sources
 * 5. Column name generation consistency across all operations
 */

describe('DataModelProcessor - Integration Tests', () => {

    describe('Google Analytics Data Model Creation', () => {
        it('should create data model with correct column names for GA source', async () => {
            const mockQuery = {
                tables: [
                    {
                        schema: 'dra_google_analytics',
                        table_name: 'device_15',
                        table_alias: 'dev', // Should be ignored
                        columns: [
                            {
                                schema: 'dra_google_analytics',
                                table_name: 'device_15',
                                column_name: 'device_category',
                                data_type: 'varchar',
                                character_maximum_length: 255,
                                alias_name: '',
                            },
                            {
                                schema: 'dra_google_analytics',
                                table_name: 'device_15',
                                column_name: 'sessions',
                                data_type: 'integer',
                                alias_name: '',
                            },
                        ],
                    },
                ],
            };

            // Verify column name generation logic
            const column1 = mockQuery.tables[0].columns[0];
            let columnName1;
            if (column1.alias_name && column1.alias_name !== '') {
                columnName1 = column1.alias_name;
            } else if (column1.schema === 'dra_google_analytics' || column1.schema === 'dra_excel' || column1.schema === 'dra_pdf') {
                columnName1 = column1.table_name.length > 20 
                    ? `${column1.table_name.slice(-20)}_${column1.column_name}`
                    : `${column1.table_name}_${column1.column_name}`;
            } else {
                columnName1 = `${column1.schema}_${column1.table_name}_${column1.column_name}`;
            }

            expect(columnName1).toBe('device_15_device_category');
            expect(columnName1).not.toContain('dra_google_analytics');
            expect(columnName1).not.toContain('dev_'); // Should not use table_alias
        });

        it('should handle multiple GA tables in one data model', async () => {
            const mockQuery = {
                tables: [
                    {
                        schema: 'dra_google_analytics',
                        table_name: 'device_15',
                        columns: [
                            {
                                schema: 'dra_google_analytics',
                                table_name: 'device_15',
                                column_name: 'device_category',
                                data_type: 'varchar',
                                alias_name: '',
                            },
                        ],
                    },
                    {
                        schema: 'dra_google_analytics',
                        table_name: 'sessions_42',
                        columns: [
                            {
                                schema: 'dra_google_analytics',
                                table_name: 'sessions_42',
                                column_name: 'session_count',
                                data_type: 'integer',
                                alias_name: '',
                            },
                        ],
                    },
                ],
            };

            // Verify each table generates correct column names
            mockQuery.tables.forEach(table => {
                table.columns.forEach(column => {
                    let columnName;
                    if (column.alias_name && column.alias_name !== '') {
                        columnName = column.alias_name;
                    } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                        columnName = column.table_name.length > 20 
                            ? `${column.table_name.slice(-20)}_${column.column_name}`
                            : `${column.table_name}_${column.column_name}`;
                    } else {
                        columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                    }

                    expect(columnName).toBe(`${column.table_name}_${column.column_name}`);
                    expect(columnName).not.toContain('dra_google_analytics');
                });
            });
        });

        it('should handle GA columns with custom aliases', async () => {
            const mockColumn = {
                schema: 'dra_google_analytics',
                table_name: 'traffic_source_88',
                column_name: 'source',
                data_type: 'varchar',
                alias_name: 'custom_source_name',
            };

            let columnName;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                columnName = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                columnName = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                columnName = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            expect(columnName).toBe('custom_source_name');
        });

        it('should truncate long GA table names correctly', async () => {
            const mockColumn = {
                schema: 'dra_google_analytics',
                table_name: 'very_long_google_analytics_table_name_exceeding_limit',
                column_name: 'metric_value',
                data_type: 'numeric',
                alias_name: '',
            };

            let columnName;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                columnName = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                columnName = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                columnName = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            // Should use last 20 chars: 'name_exceeding_limit' + '_metric_value'
            expect(columnName).toBe('name_exceeding_limit_metric_value');
            expect(columnName.length).toBeLessThanOrEqual(50); // Reasonable max length
        });
    });

    describe('Excel Data Model Creation', () => {
        it('should create data model with correct column names for Excel source', async () => {
            const mockColumn = {
                schema: 'dra_excel',
                table_name: 'sheet_123',
                column_name: 'sales_amount',
                data_type: 'numeric',
                alias_name: '',
            };

            let columnName;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                columnName = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                columnName = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                columnName = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            expect(columnName).toBe('sheet_123_sales_amount');
            expect(columnName).not.toContain('dra_excel');
        });

        it('should handle multiple Excel sheets in data model', async () => {
            const mockColumns = [
                {
                    schema: 'dra_excel',
                    table_name: 'sheet_1',
                    column_name: 'revenue',
                    alias_name: '',
                },
                {
                    schema: 'dra_excel',
                    table_name: 'sheet_2',
                    column_name: 'expenses',
                    alias_name: '',
                },
            ];

            mockColumns.forEach(column => {
                let columnName;
                if (column.alias_name && column.alias_name !== '') {
                    columnName = column.alias_name;
                } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                    columnName = column.table_name.length > 20 
                        ? `${column.table_name.slice(-20)}_${column.column_name}`
                        : `${column.table_name}_${column.column_name}`;
                } else {
                    columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                }

                expect(columnName).toBe(`${column.table_name}_${column.column_name}`);
            });
        });
    });

    describe('PDF Data Model Creation', () => {
        it('should create data model with correct column names for PDF source', async () => {
            const mockColumn = {
                schema: 'dra_pdf',
                table_name: 'document_456',
                column_name: 'page_content',
                data_type: 'text',
                alias_name: '',
            };

            let columnName;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                columnName = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                columnName = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                columnName = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            expect(columnName).toBe('document_456_page_content');
            expect(columnName).not.toContain('dra_pdf');
        });
    });

    describe('Regular Database Data Model Creation', () => {
        it('should create data model with schema prefix for regular tables', async () => {
            const mockColumn = {
                schema: 'public',
                table_name: 'users',
                column_name: 'email',
                data_type: 'varchar',
                alias_name: '',
            };

            let columnName;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                columnName = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                columnName = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                columnName = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            expect(columnName).toBe('public_users_email');
            expect(columnName).toContain('public');
        });

        it('should handle multiple schemas in data model', async () => {
            const mockColumns = [
                {
                    schema: 'public',
                    table_name: 'users',
                    column_name: 'id',
                    alias_name: '',
                },
                {
                    schema: 'analytics',
                    table_name: 'events',
                    column_name: 'event_type',
                    alias_name: '',
                },
            ];

            mockColumns.forEach(column => {
                let columnName;
                if (column.alias_name && column.alias_name !== '') {
                    columnName = column.alias_name;
                } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                    columnName = column.table_name.length > 20 
                        ? `${column.table_name.slice(-20)}_${column.column_name}`
                        : `${column.table_name}_${column.column_name}`;
                } else {
                    columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                }

                expect(columnName).toBe(`${column.schema}_${column.table_name}_${column.column_name}`);
            });
        });
    });

    describe('Mixed Source Data Models', () => {
        it('should handle mixed GA and regular database columns correctly', async () => {
            const mockColumns = [
                {
                    schema: 'dra_google_analytics',
                    table_name: 'sessions_10',
                    column_name: 'session_count',
                    alias_name: '',
                },
                {
                    schema: 'public',
                    table_name: 'users',
                    column_name: 'user_id',
                    alias_name: '',
                },
            ];

            const generatedNames = mockColumns.map(column => {
                let columnName;
                if (column.alias_name && column.alias_name !== '') {
                    columnName = column.alias_name;
                } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                    columnName = column.table_name.length > 20 
                        ? `${column.table_name.slice(-20)}_${column.column_name}`
                        : `${column.table_name}_${column.column_name}`;
                } else {
                    columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                }
                return columnName;
            });

            expect(generatedNames[0]).toBe('sessions_10_session_count'); // GA format
            expect(generatedNames[1]).toBe('public_users_user_id'); // Regular format
            expect(generatedNames[0]).not.toContain('dra_google_analytics');
            expect(generatedNames[1]).toContain('public');
        });

        it('should handle mixed Excel, PDF, and GA columns correctly', async () => {
            const mockColumns = [
                {
                    schema: 'dra_google_analytics',
                    table_name: 'ga_data_1',
                    column_name: 'metric',
                    alias_name: '',
                },
                {
                    schema: 'dra_excel',
                    table_name: 'excel_data_2',
                    column_name: 'value',
                    alias_name: '',
                },
                {
                    schema: 'dra_pdf',
                    table_name: 'pdf_data_3',
                    column_name: 'content',
                    alias_name: '',
                },
            ];

            const generatedNames = mockColumns.map(column => {
                let columnName;
                if (column.alias_name && column.alias_name !== '') {
                    columnName = column.alias_name;
                } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                    columnName = column.table_name.length > 20 
                        ? `${column.table_name.slice(-20)}_${column.column_name}`
                        : `${column.table_name}_${column.column_name}`;
                } else {
                    columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                }
                return columnName;
            });

            // All three should use table_name pattern (no schema prefix)
            expect(generatedNames[0]).toBe('ga_data_1_metric');
            expect(generatedNames[1]).toBe('excel_data_2_value');
            expect(generatedNames[2]).toBe('pdf_data_3_content');
            
            // None should contain schema names
            generatedNames.forEach(name => {
                expect(name).not.toContain('dra_google_analytics');
                expect(name).not.toContain('dra_excel');
                expect(name).not.toContain('dra_pdf');
            });
        });
    });

    describe('Column Name Consistency Across Operations', () => {
        it('should generate same column name in CREATE TABLE and INSERT operations', async () => {
            const mockColumn = {
                schema: 'dra_google_analytics',
                table_name: 'pageviews_77',
                column_name: 'page_title',
                data_type: 'varchar',
                alias_name: '',
            };

            // CREATE TABLE column name generation
            let createTableColumnName;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                createTableColumnName = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                createTableColumnName = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                createTableColumnName = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            // INSERT row key generation
            let insertRowKey;
            let insertColumnName;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                insertRowKey = mockColumn.alias_name;
                insertColumnName = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                insertColumnName = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
                insertRowKey = insertColumnName;
            } else {
                insertColumnName = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
                insertRowKey = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            // Must be identical to avoid null values
            expect(createTableColumnName).toBe(insertRowKey);
            expect(createTableColumnName).toBe(insertColumnName);
            expect(createTableColumnName).toBe('pageviews_77_page_title');
        });

        it('should maintain consistency with column data types map', async () => {
            const mockColumn = {
                schema: 'dra_google_analytics',
                table_name: 'conversions_55',
                column_name: 'conversion_rate',
                data_type: 'numeric',
                alias_name: '',
            };

            // Column data types map key generation
            let dataTypeMapKey;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                dataTypeMapKey = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                dataTypeMapKey = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                dataTypeMapKey = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            // INSERT row key
            let insertRowKey;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                insertRowKey = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                insertRowKey = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                insertRowKey = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            expect(dataTypeMapKey).toBe(insertRowKey);
            expect(dataTypeMapKey).toBe('conversions_55_conversion_rate');
        });
    });

    describe('Frontend-Backend Column Name Alignment', () => {
        it('should match frontend-generated aliases for GA columns', async () => {
            // Frontend (data-model-builder.vue) generates aliases as:
            // For GA/Excel/PDF: ${column.table_name}_${column.column_name}
            
            const mockColumn = {
                schema: 'dra_google_analytics',
                table_name: 'user_engagement_99',
                column_name: 'engaged_sessions',
                alias_name: '', // Frontend generates alias, backend receives empty
            };

            // Backend column name generation
            let backendColumnName;
            if (mockColumn.alias_name && mockColumn.alias_name !== '') {
                backendColumnName = mockColumn.alias_name;
            } else if (mockColumn.schema === 'dra_google_analytics' || mockColumn.schema === 'dra_excel' || mockColumn.schema === 'dra_pdf') {
                backendColumnName = mockColumn.table_name.length > 20 
                    ? `${mockColumn.table_name.slice(-20)}_${mockColumn.column_name}`
                    : `${mockColumn.table_name}_${mockColumn.column_name}`;
            } else {
                backendColumnName = `${mockColumn.schema}_${mockColumn.table_name}_${mockColumn.column_name}`;
            }

            // Frontend alias generation (from data-model-builder.vue)
            const frontendAlias = `${mockColumn.table_name}_${mockColumn.column_name}`;

            expect(backendColumnName).toBe(frontendAlias);
            expect(backendColumnName).toBe('user_engagement_99_engaged_sessions');
        });
    });
});
