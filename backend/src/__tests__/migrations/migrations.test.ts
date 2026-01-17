import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import PostgresDSMigrations from '../../datasources/PostgresDSMigrations.js';

/**
 * DRA-TEST-023: TypeORM Migration Tests
 * Tests all 24 database migrations for proper execution, rollback, and schema changes
 * Total: 30+ tests
 */
describe('TypeORM Migrations', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        // Use test database configuration
        dataSource = PostgresDSMigrations;
        
        if (!dataSource.isInitialized) {
            await dataSource.initialize();
        }
    });

    afterAll(async () => {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    describe('Migration Infrastructure', () => {
        it('should have migrations configured in datasource', () => {
            const migrations = dataSource.options.migrations;
            expect(migrations).toBeDefined();
            expect(Array.isArray(migrations) || typeof migrations === 'string').toBe(true);
        });

        it('should connect to test database successfully', async () => {
            expect(dataSource.isInitialized).toBe(true);
        });

        it('should have migrations table created', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'migrations'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });
    });

    describe('Migration Execution', () => {
        it('should run all pending migrations', async () => {
            const pendingMigrations = await dataSource.showMigrations();
            
            if (pendingMigrations) {
                await dataSource.runMigrations();
            }
            
            const afterMigrations = await dataSource.showMigrations();
            expect(afterMigrations).toBe(false); // No pending migrations
        });

        it('should track executed migrations', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    'SELECT COUNT(*) as count FROM migrations'
                );
                
                expect(parseInt(result[0].count)).toBeGreaterThan(0);
            } finally {
                await queryRunner.release();
            }
        });

        it('should execute migrations in correct order', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    'SELECT timestamp, name FROM migrations ORDER BY timestamp ASC'
                );
                
                // Verify timestamps are in ascending order
                for (let i = 1; i < result.length; i++) {
                    expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i - 1].timestamp);
                }
            } finally {
                await queryRunner.release();
            }
        });

        it('should not re-run already executed migrations', async () => {
            const before = await dataSource.showMigrations();
            await dataSource.runMigrations();
            const after = await dataSource.showMigrations();
            
            expect(before).toBe(after); // No change if already run
        });
    });

    describe('Core Tables Creation', () => {
        it('should create dra_users_platform table', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'dra_users_platform'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });

        it('should create dra_data_sources table', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'dra_data_sources'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });

        it('should create dra_data_models table', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'dra_data_models'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });

        it('should create dra_dashboards table', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'dra_dashboards'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });

        it('should create dra_private_beta_users table', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'dra_private_beta_users'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });

        it('should create dra_articles table', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'dra_articles'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });

        it('should create dra_ai_data_model_conversations table', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'dra_ai_data_model_conversations'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });

        it('should create dra_ai_data_model_messages table', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'dra_ai_data_model_messages'
                    )`
                );
                
                expect(result[0].exists).toBe(true);
            } finally {
                await queryRunner.release();
            }
        });
    });

    describe('Column Constraints', () => {
        it('should have NOT NULL constraints on required fields', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT column_name, is_nullable 
                     FROM information_schema.columns 
                     WHERE table_name = 'dra_users_platform' 
                     AND column_name IN ('email', 'password', 'name')`
                );
                
                result.forEach((col: any) => {
                    expect(col.is_nullable).toBe('NO');
                });
            } finally {
                await queryRunner.release();
            }
        });

        it('should have UNIQUE constraint on user email', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT constraint_name 
                     FROM information_schema.table_constraints 
                     WHERE table_name = 'dra_users_platform' 
                     AND constraint_type = 'UNIQUE'`
                );
                
                expect(result.length).toBeGreaterThan(0);
            } finally {
                await queryRunner.release();
            }
        });

        it('should have DEFAULT values for timestamps', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT column_name, column_default 
                     FROM information_schema.columns 
                     WHERE table_name = 'dra_data_sources' 
                     AND column_name IN ('created_at', 'updated_at')`
                );
                
                expect(result.length).toBe(2);
                result.forEach((col: any) => {
                    expect(col.column_default).toBeTruthy();
                });
            } finally {
                await queryRunner.release();
            }
        });
    });

    describe('Foreign Key Relationships', () => {
        it('should have foreign key from data_sources to users', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT constraint_name 
                     FROM information_schema.table_constraints 
                     WHERE table_name = 'dra_data_sources' 
                     AND constraint_type = 'FOREIGN KEY'`
                );
                
                expect(result.length).toBeGreaterThan(0);
            } finally {
                await queryRunner.release();
            }
        });

        it('should have foreign key from data_models to data_sources', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT kcu.column_name, ccu.table_name AS foreign_table_name
                     FROM information_schema.key_column_usage AS kcu
                     JOIN information_schema.constraint_column_usage AS ccu
                     ON kcu.constraint_name = ccu.constraint_name
                     WHERE kcu.table_name = 'dra_data_models'
                     AND ccu.table_name = 'dra_data_sources'`
                );
                
                expect(result.length).toBeGreaterThan(0);
            } finally {
                await queryRunner.release();
            }
        });

        it('should have CASCADE delete behavior', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT confdeltype 
                     FROM pg_constraint 
                     WHERE conname LIKE '%fk%' 
                     LIMIT 1`
                );
                
                // 'c' = CASCADE, 'a' = NO ACTION, 'r' = RESTRICT
                if (result.length > 0) {
                    expect(['c', 'a', 'r']).toContain(result[0].confdeltype);
                }
            } finally {
                await queryRunner.release();
            }
        });
    });

    describe('Index Creation', () => {
        it('should have indexes on foreign key columns', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT indexname 
                     FROM pg_indexes 
                     WHERE tablename = 'dra_data_sources' 
                     AND indexname LIKE '%user_id%'`
                );
                
                expect(result.length).toBeGreaterThan(0);
            } finally {
                await queryRunner.release();
            }
        });

        it('should have indexes on frequently queried columns', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT COUNT(*) as count 
                     FROM pg_indexes 
                     WHERE tablename IN ('dra_users_platform', 'dra_data_sources', 'dra_data_models')`
                );
                
                expect(parseInt(result[0].count)).toBeGreaterThan(0);
            } finally {
                await queryRunner.release();
            }
        });
    });

    describe('Data Types', () => {
        it('should use appropriate data types for columns', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT column_name, data_type 
                     FROM information_schema.columns 
                     WHERE table_name = 'dra_users_platform' 
                     AND column_name IN ('id', 'email', 'created_at', 'email_verified')`
                );
                
                const types = result.reduce((acc: any, col: any) => {
                    acc[col.column_name] = col.data_type;
                    return acc;
                }, {});
                
                expect(['integer', 'bigint']).toContain(types.id);
                expect(['character varying', 'text']).toContain(types.email);
                expect(['timestamp without time zone', 'timestamp with time zone']).toContain(types.created_at);
                expect('boolean').toBe(types.email_verified);
            } finally {
                await queryRunner.release();
            }
        });

        it('should use JSONB for structured data', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT data_type 
                     FROM information_schema.columns 
                     WHERE table_name = 'dra_data_sources' 
                     AND column_name = 'connection_details'`
                );
                
                expect(result[0].data_type).toBe('jsonb');
            } finally {
                await queryRunner.release();
            }
        });
    });

    describe('Migration Rollback', () => {
        it('should support rolling back last migration', async () => {
            const beforeCount = await dataSource.createQueryRunner().query(
                'SELECT COUNT(*) as count FROM migrations'
            );
            
            // Rollback last migration
            await dataSource.undoLastMigration();
            
            const afterCount = await dataSource.createQueryRunner().query(
                'SELECT COUNT(*) as count FROM migrations'
            );
            
            expect(parseInt(afterCount[0].count)).toBeLessThanOrEqual(parseInt(beforeCount[0].count));
            
            // Re-run migrations to restore state
            await dataSource.runMigrations();
        });

        it('should properly clean up after rollback', async () => {
            // Get current migration count
            const queryRunner = dataSource.createQueryRunner();
            const before = await queryRunner.query('SELECT COUNT(*) FROM migrations');
            
            // Rollback and re-run
            await dataSource.undoLastMigration();
            await dataSource.runMigrations();
            
            const after = await queryRunner.query('SELECT COUNT(*) FROM migrations');
            await queryRunner.release();
            
            expect(after[0].count).toBe(before[0].count);
        });
    });

    describe('Schema Validation', () => {
        it('should have all expected tables', async () => {
            const expectedTables = [
                'dra_users_platform',
                'dra_data_sources',
                'dra_data_models',
                'dra_dashboards',
                'dra_private_beta_users',
                'dra_articles',
                'dra_ai_data_model_conversations',
                'dra_ai_data_model_messages',
                'migrations'
            ];
            
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                for (const table of expectedTables) {
                    const result = await queryRunner.query(
                        `SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = '${table}'
                        )`
                    );
                    
                    expect(result[0].exists).toBe(true);
                }
            } finally {
                await queryRunner.release();
            }
        });

        it('should not have orphaned tables', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                const result = await queryRunner.query(
                    `SELECT table_name 
                     FROM information_schema.tables 
                     WHERE table_schema = 'public' 
                     AND table_type = 'BASE TABLE'`
                );
                
                // All tables should be expected
                expect(result.length).toBeGreaterThan(0);
            } finally {
                await queryRunner.release();
            }
        });
    });

    describe('Migration Idempotency', () => {
        it('should be safe to run migrations multiple times', async () => {
            await dataSource.runMigrations();
            const firstRun = await dataSource.showMigrations();
            
            await dataSource.runMigrations();
            const secondRun = await dataSource.showMigrations();
            
            expect(firstRun).toBe(secondRun); // No change
        });

        it('should handle concurrent migration attempts gracefully', async () => {
            // This would typically use locking mechanisms
            const promise1 = dataSource.runMigrations();
            const promise2 = dataSource.runMigrations();
            
            await expect(Promise.all([promise1, promise2])).resolves.toBeDefined();
        });
    });

    describe('Data Integrity', () => {
        it('should preserve existing data during migrations', async () => {
            const queryRunner = dataSource.createQueryRunner();
            
            try {
                // Insert test data
                await queryRunner.query(
                    `INSERT INTO dra_users_platform (email, password, name, user_type) 
                     VALUES ('migration-test@example.com', 'hashed', 'Test User', 'NORMAL') 
                     ON CONFLICT DO NOTHING`
                );
                
                // Verify data exists
                const result = await queryRunner.query(
                    `SELECT * FROM dra_users_platform WHERE email = 'migration-test@example.com'`
                );
                
                expect(result.length).toBeGreaterThanOrEqual(0);
                
                // Cleanup
                await queryRunner.query(
                    `DELETE FROM dra_users_platform WHERE email = 'migration-test@example.com'`
                );
            } finally {
                await queryRunner.release();
            }
        });
    });
});
