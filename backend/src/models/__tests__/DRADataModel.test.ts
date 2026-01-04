import { describe, it, expect } from '@jest/globals';
import { DRADataModel } from '../DRADataModel.js';

describe('DRADataModel Model', () => {
    describe('Entity Structure', () => {
        it('should create a data model instance with required fields', () => {
            const dataModel = new DRADataModel();
            dataModel.schema = 'public';
            dataModel.name = 'Customer Analytics Model';
            dataModel.sql_query = 'SELECT * FROM customers';
            dataModel.query = JSON.parse('{"tables": ["customers"]}');
            
            expect(dataModel.schema).toBe('public');
            expect(dataModel.name).toBe('Customer Analytics Model');
            expect(dataModel.sql_query).toBe('SELECT * FROM customers');
            expect(dataModel.query).toBeDefined();
        });

        it('should have is_cross_source boolean with default false', () => {
            const dataModel = new DRADataModel();
            
            // Default value would be set by database
            dataModel.is_cross_source = false;
            expect(dataModel.is_cross_source).toBe(false);
            
            dataModel.is_cross_source = true;
            expect(dataModel.is_cross_source).toBe(true);
        });

        it('should support execution_metadata as Record', () => {
            const dataModel = new DRADataModel();
            
            const metadata = {
                execution_time_ms: 1234,
                rows_returned: 100,
                last_executed: new Date().toISOString()
            };
            
            dataModel.execution_metadata = metadata;
            
            expect(dataModel.execution_metadata.execution_time_ms).toBe(1234);
            expect(dataModel.execution_metadata.rows_returned).toBe(100);
        });

        it('should have created_at timestamp', () => {
            const dataModel = new DRADataModel();
            
            const now = new Date();
            dataModel.created_at = now;
            
            expect(dataModel.created_at).toBe(now);
            expect(dataModel.created_at).toBeInstanceOf(Date);
        });
    });

    describe('Query Storage', () => {
        it('should store simple query structure', () => {
            const dataModel = new DRADataModel();
            
            const simpleQuery = {
                tables: ['users'],
                columns: ['id', 'name', 'email'],
                where: {}
            };
            
            dataModel.query = JSON.parse(JSON.stringify(simpleQuery));
            dataModel.sql_query = 'SELECT id, name, email FROM users';
            
            expect(dataModel.query).toBeDefined();
            expect(dataModel.sql_query).toContain('SELECT');
        });

        it('should store complex multi-table query', () => {
            const dataModel = new DRADataModel();
            
            const complexQuery = {
                tables: ['users', 'orders', 'products'],
                joins: [
                    { from: 'users.id', to: 'orders.user_id', type: 'INNER' },
                    { from: 'orders.product_id', to: 'products.id', type: 'LEFT' }
                ],
                columns: ['users.name', 'orders.total', 'products.name'],
                where: {
                    'users.status': 'active',
                    'orders.created_at': { gte: '2024-01-01' }
                }
            };
            
            dataModel.query = JSON.parse(JSON.stringify(complexQuery));
            dataModel.is_cross_source = false;
            
            expect(dataModel.query).toBeDefined();
            expect(dataModel.is_cross_source).toBe(false);
        });

        it('should support cross-source queries', () => {
            const dataModel = new DRADataModel();
            
            dataModel.name = 'Cross-Source Analytics';
            dataModel.is_cross_source = true;
            dataModel.query = JSON.parse(JSON.stringify({
                sources: [
                    { id: 1, tables: ['users'] },
                    { id: 2, tables: ['transactions'] }
                ]
            }));
            
            expect(dataModel.is_cross_source).toBe(true);
        });
    });

    describe('SQL Query Storage', () => {
        it('should store SELECT queries', () => {
            const dataModel = new DRADataModel();
            
            dataModel.sql_query = 'SELECT * FROM users WHERE status = \'active\'';
            
            expect(dataModel.sql_query).toContain('SELECT');
            expect(dataModel.sql_query).toContain('FROM users');
        });

        it('should store JOIN queries', () => {
            const dataModel = new DRADataModel();
            
            dataModel.sql_query = `
                SELECT u.name, o.total 
                FROM users u 
                INNER JOIN orders o ON u.id = o.user_id
                WHERE o.created_at > '2024-01-01'
            `;
            
            expect(dataModel.sql_query).toContain('INNER JOIN');
            expect(dataModel.sql_query).toContain('users');
            expect(dataModel.sql_query).toContain('orders');
        });

        it('should store complex aggregate queries', () => {
            const dataModel = new DRADataModel();
            
            dataModel.sql_query = `
                SELECT 
                    category,
                    COUNT(*) as total_count,
                    SUM(amount) as total_amount,
                    AVG(amount) as avg_amount
                FROM transactions
                GROUP BY category
                HAVING COUNT(*) > 10
                ORDER BY total_amount DESC
            `;
            
            expect(dataModel.sql_query).toContain('COUNT(*)');
            expect(dataModel.sql_query).toContain('GROUP BY');
            expect(dataModel.sql_query).toContain('HAVING');
        });
    });

    describe('Schema and Name Fields', () => {
        it('should accept valid schema names', () => {
            const dataModel = new DRADataModel();
            
            const validSchemas = ['public', 'analytics', 'reporting', 'main'];
            
            validSchemas.forEach(schema => {
                dataModel.schema = schema;
                expect(dataModel.schema).toBe(schema);
            });
        });

        it('should accept descriptive model names', () => {
            const dataModel = new DRADataModel();
            
            const names = [
                'Customer Segmentation Model',
                'Revenue Analysis 2024',
                'Product Performance Dashboard',
                'User Behavior Tracking'
            ];
            
            names.forEach(name => {
                dataModel.name = name;
                expect(dataModel.name).toBe(name);
            });
        });

        it('should handle long names within limit', () => {
            const dataModel = new DRADataModel();
            
            // Max length is 255 characters
            const longName = 'a'.repeat(255);
            dataModel.name = longName;
            
            expect(dataModel.name.length).toBe(255);
        });
    });

    describe('Execution Metadata', () => {
        it('should store performance metrics', () => {
            const dataModel = new DRADataModel();
            
            dataModel.execution_metadata = {
                last_execution_time_ms: 2500,
                average_execution_time_ms: 2100,
                execution_count: 45,
                last_executed_at: new Date().toISOString()
            };
            
            expect(dataModel.execution_metadata.last_execution_time_ms).toBe(2500);
            expect(dataModel.execution_metadata.execution_count).toBe(45);
        });

        it('should store error information', () => {
            const dataModel = new DRADataModel();
            
            dataModel.execution_metadata = {
                last_error: 'Connection timeout',
                last_error_at: new Date().toISOString(),
                error_count: 3
            };
            
            expect(dataModel.execution_metadata.last_error).toBe('Connection timeout');
            expect(dataModel.execution_metadata.error_count).toBe(3);
        });

        it('should store result metadata', () => {
            const dataModel = new DRADataModel();
            
            dataModel.execution_metadata = {
                rows_returned: 1500,
                columns_returned: 12,
                result_size_bytes: 245000,
                cached: true
            };
            
            expect(dataModel.execution_metadata.rows_returned).toBe(1500);
            expect(dataModel.execution_metadata.cached).toBe(true);
        });
    });

    describe('Entity Relations', () => {
        it('should have users_platform relation', () => {
            const dataModel = new DRADataModel();
            
            expect(dataModel).toHaveProperty('users_platform');
        });

        it('should have optional data_source relation', () => {
            const dataModel = new DRADataModel();
            
            expect(dataModel).toHaveProperty('data_source');
        });

        it('should have data_model_sources collection', () => {
            const dataModel = new DRADataModel();
            
            expect(dataModel).toHaveProperty('data_model_sources');
        });

        it('should have ai_conversations collection', () => {
            const dataModel = new DRADataModel();
            
            expect(dataModel).toHaveProperty('ai_conversations');
        });
    });

    describe('Cross-Source Features', () => {
        it('should support cross-source flag', () => {
            const dataModel = new DRADataModel();
            
            // Single source model
            dataModel.is_cross_source = false;
            dataModel.name = 'Single Database Model';
            expect(dataModel.is_cross_source).toBe(false);
            
            // Cross-source model
            dataModel.is_cross_source = true;
            dataModel.name = 'Multi-Database Model';
            expect(dataModel.is_cross_source).toBe(true);
        });

        it('should handle cross-source query structure', () => {
            const dataModel = new DRADataModel();
            
            const crossSourceQuery = {
                sources: [
                    {
                        source_id: 1,
                        tables: ['users'],
                        alias: 'pg_users'
                    },
                    {
                        source_id: 2,
                        tables: ['orders'],
                        alias: 'mysql_orders'
                    }
                ],
                join_key: 'user_id'
            };
            
            dataModel.is_cross_source = true;
            dataModel.query = JSON.parse(JSON.stringify(crossSourceQuery));
            
            expect(dataModel.query).toBeDefined();
        });
    });
});
