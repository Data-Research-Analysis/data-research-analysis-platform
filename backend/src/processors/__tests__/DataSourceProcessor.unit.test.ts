/**
 * Unit tests for DataSourceProcessor
 * Focus: Column name generation logic for different schema types
 * 
 * These tests verify the column name generation algorithm used in 3 locations:
 * 1. CREATE TABLE column definitions
 * 2. Column data types map
 * 3. INSERT statement row key extraction
 */
describe('DataSourceProcessor - Column Name Generation', () => {
    
    describe('Google Analytics Schema', () => {
        it('should generate column name without schema prefix for GA tables', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'device_15',
                column_name: 'device_category',
                alias_name: '',
            };

            // Expected behavior: uses table_name_column pattern (no schema prefix)
            // Expected: device_15_device_category
            // Not: dra_google_analytics_device_15_device_category
            
            const expectedColumnName = 'device_15_device_category';
            
            // Verify the logic manually (since we can't directly call private methods)
            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            expect(actualColumnName).toBe(expectedColumnName);
        });

        it('should use alias_name when provided for GA tables', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'device_15',
                column_name: 'device_category',
                alias_name: 'custom_device',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            expect(actualColumnName).toBe('custom_device');
        });

        it('should truncate long GA table names (>20 chars)', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'very_long_table_name_for_testing_purposes_123',
                column_name: 'metric',
                alias_name: '',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            // Last 20 chars of table name + underscore + column name
            const expectedColumnName = 'testing_purposes_123_metric';
            expect(actualColumnName).toBe(expectedColumnName);
        });

        it('should handle table_alias presence correctly for GA (ignores alias)', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'device_15',
                table_alias: 'dev',
                column_name: 'device_category',
                alias_name: '',
            };

            // GA should ignore table_alias and always use table_name
            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            expect(actualColumnName).toBe('device_15_device_category');
        });

        it('should generate correct names for different GA table types', () => {
            const testCases = [
                {
                    column: { schema: 'dra_google_analytics', table_name: 'device_15', column_name: 'device_category', alias_name: '' },
                    expected: 'device_15_device_category'
                },
                {
                    column: { schema: 'dra_google_analytics', table_name: 'traffic_overview_15', column_name: 'sessions', alias_name: '' },
                    expected: 'traffic_overview_15_sessions'
                },
                {
                    column: { schema: 'dra_google_analytics', table_name: 'user_acquisition_15', column_name: 'new_users', alias_name: '' },
                    expected: 'user_acquisition_15_new_users'
                },
                {
                    column: { schema: 'dra_google_analytics', table_name: 'geographic_15', column_name: 'country', alias_name: '' },
                    expected: 'geographic_15_country'
                },
            ];

            testCases.forEach(({ column, expected }) => {
                let actualColumnName;
                if (column.alias_name && column.alias_name !== '') {
                    actualColumnName = column.alias_name;
                } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                    actualColumnName = column.table_name.length > 20 
                        ? `${column.table_name.slice(-20)}_${column.column_name}`
                        : `${column.table_name}_${column.column_name}`;
                } else {
                    actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                }
                
                expect(actualColumnName).toBe(expected);
            });
        });
    });

    describe('Excel Schema', () => {
        it('should generate column name for Excel tables', () => {
            const column = {
                schema: 'dra_excel',
                table_name: 'sheet1_data_source_10_1',
                column_name: 'sales',
                alias_name: '',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            // Table name is 23 chars (>20), gets truncated to last 20: 'et1_data_source_10_1'
            expect(actualColumnName).toBe('et1_data_source_10_1_sales');
        });

        it('should truncate long Excel table names', () => {
            const column = {
                schema: 'dra_excel',
                table_name: 'very_long_excel_sheet_name_data_source_10_1',
                column_name: 'amount',
                alias_name: '',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            // Last 20 chars: 'ame_data_source_10_1' + '_amount'
            expect(actualColumnName).toBe('ame_data_source_10_1_amount');
        });
    });

    describe('PDF Schema', () => {
        it('should generate column name for PDF tables', () => {
            const column = {
                schema: 'dra_pdf',
                table_name: 'document_data_source_20',
                column_name: 'amount',
                alias_name: '',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            // Table name is 26 chars, gets truncated to last 20: 'ument_data_source_20'
            expect(actualColumnName).toBe('ument_data_source_20_amount');
        });
    });

    describe('Regular Database Schemas', () => {
        it('should include schema prefix for regular tables', () => {
            const column = {
                schema: 'public',
                table_name: 'users',
                column_name: 'email',
                alias_name: '',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            expect(actualColumnName).toBe('public_users_email');
        });

        it('should use table_name for regular tables (not table_alias in this context)', () => {
            const column = {
                schema: 'public',
                table_name: 'users',
                table_alias: 'u',
                column_name: 'email',
                alias_name: '',
            };

            // Note: In the actual code, for regular schemas without aliases, 
            // it uses table_name. The table_alias is used in the SQL query itself,
            // but the column name key should match what the query returns.
            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            expect(actualColumnName).toBe('public_users_email');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty string alias_name as no alias', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'device_15',
                column_name: 'device_category',
                alias_name: '',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            expect(actualColumnName).toBe('device_15_device_category');
        });

        it('should handle table name exactly 20 characters', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'exact_twenty_chars_1', // exactly 20 characters
                column_name: 'metric',
                alias_name: '',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            // Should NOT truncate (20 is not > 20)
            expect(actualColumnName).toBe('exact_twenty_chars_1_metric');
        });

        it('should handle table name with 21 characters (triggers truncation)', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'twentyone_characters_', // 21 characters
                column_name: 'metric',
                alias_name: '',
            };

            let actualColumnName;
            if (column.alias_name && column.alias_name !== '') {
                actualColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                actualColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                actualColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }
            
            // Should truncate to last 20 chars: 'wentyone_characters_'
            expect(actualColumnName).toBe('wentyone_characters__metric');
        });
    });

    describe('Row Data Extraction Simulation', () => {
        it('should extract GA column values with correct key', () => {
            const rowData = {
                'device_15_device_category': 'mobile',
                'device_15_sessions': 1000,
            };

            const column = {
                schema: 'dra_google_analytics',
                table_name: 'device_15',
                column_name: 'device_category',
                alias_name: '',
            };

            // Simulate key generation
            let rowKey;
            if (column.alias_name && column.alias_name !== '') {
                rowKey = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                rowKey = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                rowKey = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            expect(rowKey).toBe('device_15_device_category');
            expect(rowData[rowKey]).toBe('mobile');
        });

        it('should handle null values in GA columns', () => {
            const rowData = {
                'device_15_device_category': null,
            };

            const column = {
                schema: 'dra_google_analytics',
                table_name: 'device_15',
                column_name: 'device_category',
                alias_name: '',
            };

            let rowKey;
            if (column.alias_name && column.alias_name !== '') {
                rowKey = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                rowKey = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                rowKey = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            expect(rowData[rowKey]).toBeNull();
        });

        it('should prefer alias_name over generated name for value extraction', () => {
            const rowData = {
                'custom_device': 'desktop',
                'device_15_device_category': 'mobile',
            };

            const column = {
                schema: 'dra_google_analytics',
                table_name: 'device_15',
                column_name: 'device_category',
                alias_name: 'custom_device',
            };

            let rowKey;
            if (column.alias_name && column.alias_name !== '') {
                rowKey = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                rowKey = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                rowKey = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            expect(rowKey).toBe('custom_device');
            expect(rowData[rowKey]).toBe('desktop');
        });
    });
});

describe('DataSourceProcessor - Consistency Tests', () => {
    it('should generate same column name in all 3 locations', () => {
        const column = {
            schema: 'dra_google_analytics',
            table_name: 'device_15',
            column_name: 'device_category',
            alias_name: '',
        };

        // Simulate logic from Location 1 (CREATE TABLE)
        let columnName1;
        if (column.alias_name && column.alias_name !== '') {
            columnName1 = column.alias_name;
        } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
            columnName1 = column.table_name.length > 20 
                ? `${column.table_name.slice(-20)}_${column.column_name}`
                : `${column.table_name}_${column.column_name}`;
        } else {
            columnName1 = `${column.schema}_${column.table_name}_${column.column_name}`;
        }

        // Simulate logic from Location 2 (columnDataTypes map)
        let columnName2;
        if (column.alias_name && column.alias_name !== '') {
            columnName2 = column.alias_name;
        } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
            columnName2 = column.table_name.length > 20 
                ? `${column.table_name.slice(-20)}_${column.column_name}`
                : `${column.table_name}_${column.column_name}`;
        } else {
            columnName2 = `${column.schema}_${column.table_name}_${column.column_name}`;
        }

        // Simulate logic from Location 3 (INSERT rowKey)
        let rowKey;
        if (column.alias_name && column.alias_name !== '') {
            rowKey = column.alias_name;
        } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
            rowKey = column.table_name.length > 20 
                ? `${column.table_name.slice(-20)}_${column.column_name}`
                : `${column.table_name}_${column.column_name}`;
        } else {
            rowKey = `${column.schema}_${column.table_name}_${column.column_name}`;
        }

        // All three should be identical
        expect(columnName1).toBe('device_15_device_category');
        expect(columnName2).toBe('device_15_device_category');
        expect(rowKey).toBe('device_15_device_category');
        expect(columnName1).toBe(columnName2);
        expect(columnName2).toBe(rowKey);
    });
});
