import { describe, it, expect } from '@jest/globals';
import { SchemaFormatterUtility } from '../SchemaFormatter.js';
import { TestDataFactory } from '../../../__tests__/mocks/MockManager.js';

/**
 * Unit tests for SchemaFormatter utility
 * Tests markdown formatting and schema summarization
 */
describe('SchemaFormatterUtility', () => {
    describe('formatSchemaToMarkdown', () => {
        it('should format single table to markdown', () => {
            const tables = [{
                schema: 'public',
                tableName: 'users',
                columns: [
                    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null },
                    { column_name: 'email', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 }
                ],
                primaryKeys: ['id'],
                foreignKeys: []
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables);

            expect(markdown).toContain('users');
            expect(markdown).toContain('id');
            expect(markdown).toContain('email');
            expect(markdown).toContain('INTEGER');
            expect(markdown).toContain('VARCHAR');
        });

        it('should format multiple tables', () => {
            const schema = TestDataFactory.createSchemaContext(3);
            
            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(schema.tables);

            expect(markdown).toContain('table_0');
            expect(markdown).toContain('table_1');
            expect(markdown).toContain('table_2');
        });

        it('should include data types', () => {
            const tables = [{
                schema: 'public',
                tableName: 'products',
                columns: [
                    { column_name: 'price', data_type: 'decimal', is_nullable: 'YES', column_default: null, character_maximum_length: null },
                    { column_name: 'created_at', data_type: 'timestamp', is_nullable: 'YES', column_default: null, character_maximum_length: null }
                ],
                primaryKeys: [],
                foreignKeys: []
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables);

            expect(markdown).toContain('DECIMAL');
            expect(markdown).toContain('TIMESTAMP');
        });

        it('should handle relationships', () => {
            const tables = [{
                schema: 'public',
                tableName: 'orders',
                columns: [
                    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null },
                    { column_name: 'user_id', data_type: 'integer', is_nullable: 'YES', column_default: null, character_maximum_length: null }
                ],
                primaryKeys: ['id'],
                foreignKeys: [
                    {
                        constraint_name: 'fk_orders_user_id',
                        table_name: 'orders',
                        column_name: 'user_id',
                        foreign_table_name: 'users',
                        foreign_column_name: 'id'
                    }
                ]
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables);

            expect(markdown).toContain('users');
            expect(markdown).toContain('user_id');
        });

        it('should handle tables without relationships', () => {
            const tables = [{
                schema: 'public',
                tableName: 'logs',
                columns: [
                    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null }
                ],
                primaryKeys: ['id'],
                foreignKeys: []
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables);

            expect(markdown).toContain('logs');
            expect(markdown).not.toContain('relationships');
        });

        it('should handle empty schema', () => {
            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown([]);

            expect(markdown).toBeDefined();
            expect(typeof markdown).toBe('string');
        });

        it('should handle Google Analytics schema', () => {
            const schema = TestDataFactory.createGoogleAnalyticsSchema();
            
            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(schema.tables);

            expect(markdown).toContain('dra_google_analytics');
            expect(markdown).toContain('sessions_42');
        });

        it('should handle special characters in table names', () => {
            const tables = [{
                schema: 'public',
                tableName: 'table_with_underscore',
                columns: [
                    { column_name: 'column-with-dash', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 }
                ],
                primaryKeys: [],
                foreignKeys: []
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables);

            expect(markdown).toContain('table_with_underscore');
            expect(markdown).toContain('column-with-dash');
        });
    });

    describe('getSchemaSummary', () => {
        it('should generate correct table count', () => {
            const schema = TestDataFactory.createSchemaContext(5);
            
            const summary = SchemaFormatterUtility.getSchemaSummary(schema.tables);

            expect(summary.tableCount).toBe(5);
        });

        it('should generate correct column count', () => {
            const tables = [{
                schema: 'public',
                tableName: 'test',
                columns: [
                    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null },
                    { column_name: 'name', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 },
                    { column_name: 'email', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 }
                ],
                primaryKeys: ['id'],
                foreignKeys: []
            }];

            const summary = SchemaFormatterUtility.getSchemaSummary(tables);

            expect(summary.totalColumns).toBe(3);
        });

        it('should count columns across multiple tables', () => {
            const tables = [
                {
                    schema: 'public',
                    tableName: 'table1',
                    columns: [
                        { column_name: 'col1', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null },
                        { column_name: 'col2', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 }
                    ],
                    primaryKeys: ['col1'],
                    foreignKeys: []
                },
                {
                    schema: 'public',
                    tableName: 'table2',
                    columns: [
                        { column_name: 'col1', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null }
                    ],
                    primaryKeys: ['col1'],
                    foreignKeys: []
                }
            ];

            const summary = SchemaFormatterUtility.getSchemaSummary(tables);

            expect(summary.tableCount).toBe(2);
            expect(summary.totalColumns).toBe(3);
        });

        it('should handle empty schema', () => {
            const summary = SchemaFormatterUtility.getSchemaSummary([]);

            expect(summary.tableCount).toBe(0);
            expect(summary.totalColumns).toBe(0);
        });

        it('should count foreign keys', () => {
            const tables = [
                {
                    schema: 'public',
                    tableName: 'users',
                    columns: [{ column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null }],
                    primaryKeys: ['id'],
                    foreignKeys: []
                },
                {
                    schema: 'public',
                    tableName: 'orders',
                    columns: [
                        { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null },
                        { column_name: 'user_id', data_type: 'integer', is_nullable: 'YES', column_default: null, character_maximum_length: null }
                    ],
                    primaryKeys: ['id'],
                    foreignKeys: [
                        {
                            constraint_name: 'fk_orders_user_id',
                            table_name: 'orders',
                            column_name: 'user_id',
                            foreign_table_name: 'users',
                            foreign_column_name: 'id'
                        }
                    ]
                }
            ];

            const summary = SchemaFormatterUtility.getSchemaSummary(tables);

            expect(summary.tableCount).toBe(2);
            expect(summary.totalForeignKeys).toBe(1);
        });

        it('should calculate average columns per table', () => {
            const schema = TestDataFactory.createSchemaContext(5);
            
            const summary = SchemaFormatterUtility.getSchemaSummary(schema.tables);

            expect(summary.tableCount).toBe(5);
            expect(summary.avgColumnsPerTable).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very large schemas', () => {
            const largeSchema = TestDataFactory.createSchemaContext(100);
            
            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(largeSchema.tables);
            const summary = SchemaFormatterUtility.getSchemaSummary(largeSchema.tables);

            expect(markdown).toBeDefined();
            expect(summary.tableCount).toBe(100);
        });

        it('should handle tables with many columns', () => {
            const tables = [{
                schema: 'public',
                tableName: 'wide_table',
                columns: Array(50).fill(null).map((_, i) => ({
                    column_name: `col_${i}`,
                    data_type: 'varchar',
                    is_nullable: 'YES',
                    column_default: null,
                    character_maximum_length: 255
                })),
                primaryKeys: [],
                foreignKeys: []
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(tables);
            const summary = SchemaFormatterUtility.getSchemaSummary(tables);

            expect(markdown).toBeDefined();
            expect(summary.totalColumns).toBe(50);
        });

        it('should handle missing metadata', () => {
            const incomplete = [{
                schema: 'public',
                tableName: 'incomplete',
                columns: [],
                primaryKeys: [],
                foreignKeys: []
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(incomplete as any);

            expect(markdown).toBeDefined();
        });

        it('should handle null values gracefully', () => {
            const withNulls = [{
                schema: null,
                tableName: 'test',
                columns: [
                    { column_name: 'id', data_type: null, is_nullable: 'NO', column_default: null, character_maximum_length: null }
                ],
                primaryKeys: ['id'],
                foreignKeys: []
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(withNulls as any);

            expect(markdown).toBeDefined();
        });

        it('should handle Unicode table names', () => {
            const unicode = [{
                schema: 'public',
                tableName: 'table_名前',
                columns: [
                    { column_name: 'コラム', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 }
                ],
                primaryKeys: [],
                foreignKeys: []
            }];

            const markdown = SchemaFormatterUtility.formatSchemaToMarkdown(unicode);

            expect(markdown).toContain('table_名前');
            expect(markdown).toContain('コラム');
        });
    });
});
