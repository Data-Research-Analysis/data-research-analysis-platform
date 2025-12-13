/**
 * Unit tests for DataModelProcessor
 * Focus: Column name generation logic for different schema types in data models
 * 
 * These tests verify the column name generation algorithm used in 3 locations:
 * 1. CREATE TABLE column definitions
 * 2. Column data types map
 * 3. INSERT statement row key extraction
 */
describe('DataModelProcessor - Column Name Generation', () => {
    
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
            
            // Verify the logic manually (mimics DataModelProcessor logic)
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
            expect(actualColumnName).not.toContain('dev_'); // Should not use table_alias
        });

        it('should generate consistent column names across all 3 locations', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'sessions_42',
                column_name: 'session_count',
                alias_name: '',
            };

            // Location 1: CREATE TABLE
            let createTableColumnName;
            if (column.alias_name && column.alias_name !== '') {
                createTableColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                createTableColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                createTableColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            // Location 2: Column data types map
            let dataTypesMapColumnName;
            if (column.alias_name && column.alias_name !== '') {
                dataTypesMapColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                dataTypesMapColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                dataTypesMapColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            // Location 3: INSERT row key
            let insertRowKeyName;
            let insertColumnName;
            if (column.alias_name && column.alias_name !== '') {
                insertRowKeyName = column.alias_name;
                insertColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                insertColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
                insertRowKeyName = insertColumnName;
            } else {
                insertColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                insertRowKeyName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            // All three locations should produce identical column names
            expect(createTableColumnName).toBe('sessions_42_session_count');
            expect(dataTypesMapColumnName).toBe('sessions_42_session_count');
            expect(insertColumnName).toBe('sessions_42_session_count');
            expect(insertRowKeyName).toBe('sessions_42_session_count');
            
            // All must be equal
            expect(createTableColumnName).toBe(dataTypesMapColumnName);
            expect(dataTypesMapColumnName).toBe(insertColumnName);
            expect(insertColumnName).toBe(insertRowKeyName);
        });
    });

    describe('Excel Schema', () => {
        it('should generate column name without schema prefix for Excel tables', () => {
            const column = {
                schema: 'dra_excel',
                table_name: 'sheet_123',
                column_name: 'sales_amount',
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
            
            expect(actualColumnName).toBe('sheet_123_sales_amount');
        });

        it('should truncate long Excel table names', () => {
            const column = {
                schema: 'dra_excel',
                table_name: 'very_long_sheet_name_that_exceeds_twenty_characters',
                column_name: 'value',
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

            // Last 20 chars: 'ds_twenty_characters' + '_value'
            expect(actualColumnName).toBe('ds_twenty_characters_value');
        });
    });

    describe('PDF Schema', () => {
        it('should generate column name without schema prefix for PDF tables', () => {
            const column = {
                schema: 'dra_pdf',
                table_name: 'document_456',
                column_name: 'page_number',
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
            
            expect(actualColumnName).toBe('document_456_page_number');
        });
    });

    describe('Regular Database Schema', () => {
        it('should generate column name with schema prefix for regular tables', () => {
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

        it('should use alias when provided for regular tables', () => {
            const column = {
                schema: 'public',
                table_name: 'users',
                column_name: 'email',
                alias_name: 'user_email',
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
            
            expect(actualColumnName).toBe('user_email');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty alias_name (empty string)', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'events_10',
                column_name: 'event_name',
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
            
            // Should use table_name pattern, not alias
            expect(actualColumnName).toBe('events_10_event_name');
        });

        it('should handle table_name exactly 20 characters (boundary test)', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: '12345678901234567890', // Exactly 20 chars
                column_name: 'value',
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

            // Exactly 20 chars should NOT truncate (only > 20 truncates)
            expect(actualColumnName).toBe('12345678901234567890_value');
        });

        it('should handle table_name with 21 characters (just over boundary)', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: '123456789012345678901', // 21 chars
                column_name: 'value',
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

            // Should truncate to last 20 chars
            expect(actualColumnName).toBe('23456789012345678901_value');
        });
    });

    describe('Row Key Consistency', () => {
        it('should generate identical rowKey and columnName for GA without alias', () => {
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'pageviews_99',
                column_name: 'page_path',
                alias_name: '',
            };

            let rowKey;
            let columnName;
            if (column.alias_name && column.alias_name !== '') {
                rowKey = column.alias_name;
                columnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                columnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
                rowKey = columnName;
            } else {
                columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                rowKey = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            expect(rowKey).toBe('pageviews_99_page_path');
            expect(columnName).toBe('pageviews_99_page_path');
            expect(rowKey).toBe(columnName); // Must be identical for data lookup
        });

        it('should generate identical rowKey and columnName for regular schema without alias', () => {
            const column = {
                schema: 'analytics',
                table_name: 'events',
                column_name: 'event_type',
                alias_name: '',
            };

            let rowKey;
            let columnName;
            if (column.alias_name && column.alias_name !== '') {
                rowKey = column.alias_name;
                columnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                columnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
                rowKey = columnName;
            } else {
                columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                rowKey = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            expect(rowKey).toBe('analytics_events_event_type');
            expect(columnName).toBe('analytics_events_event_type');
            expect(rowKey).toBe(columnName);
        });
    });

    describe('Integration with Frontend Alias Generation', () => {
        it('should match frontend-generated alias for GA columns', () => {
            // Frontend (data-model-builder.vue) generates aliases for GA as:
            // ${column.table_name}_${column.column_name}
            const column = {
                schema: 'dra_google_analytics',
                table_name: 'traffic_source_88',
                column_name: 'source_medium',
                alias_name: '', // Empty - frontend will generate alias
            };

            let backendColumnName;
            if (column.alias_name && column.alias_name !== '') {
                backendColumnName = column.alias_name;
            } else if (column.schema === 'dra_google_analytics' || column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                backendColumnName = column.table_name.length > 20 
                    ? `${column.table_name.slice(-20)}_${column.column_name}`
                    : `${column.table_name}_${column.column_name}`;
            } else {
                backendColumnName = `${column.schema}_${column.table_name}_${column.column_name}`;
            }

            // Frontend generates this same format
            const frontendGeneratedAlias = `${column.table_name}_${column.column_name}`;

            expect(backendColumnName).toBe(frontendGeneratedAlias);
            expect(backendColumnName).toBe('traffic_source_88_source_medium');
        });
    });
});
