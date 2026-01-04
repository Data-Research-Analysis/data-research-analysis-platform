import { UtilityService } from '../UtilityService.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';

describe('UtilityService', () => {
    let utilityService: UtilityService;

    beforeEach(() => {
        utilityService = UtilityService.getInstance();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple getInstance() calls', () => {
            const instance1 = UtilityService.getInstance();
            const instance2 = UtilityService.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should maintain state across getInstance() calls', () => {
            const instance1 = UtilityService.getInstance();
            const instance2 = UtilityService.getInstance();
            // Both instances should be the exact same object
            expect(instance1).toStrictEqual(instance2);
        });
    });

    describe('Data Source Type Conversion', () => {
        it('should convert "postgresql" to EDataSourceType.POSTGRESQL', () => {
            const result = utilityService.getDataSourceType('postgresql');
            expect(result).toBe(EDataSourceType.POSTGRESQL);
        });

        it('should convert "mysql" to EDataSourceType.MYSQL', () => {
            const result = utilityService.getDataSourceType('mysql');
            expect(result).toBe(EDataSourceType.MYSQL);
        });

        it('should convert "mariadb" to EDataSourceType.MARIADB', () => {
            const result = utilityService.getDataSourceType('mariadb');
            expect(result).toBe(EDataSourceType.MARIADB);
        });

        it('should convert "mongodb" to EDataSourceType.MONGODB', () => {
            const result = utilityService.getDataSourceType('mongodb');
            expect(result).toBe(EDataSourceType.MONGODB);
        });

        it('should convert "csv" to EDataSourceType.CSV', () => {
            const result = utilityService.getDataSourceType('csv');
            expect(result).toBe(EDataSourceType.CSV);
        });

        it('should convert "excel" to EDataSourceType.EXCEL', () => {
            const result = utilityService.getDataSourceType('excel');
            expect(result).toBe(EDataSourceType.EXCEL);
        });

        it('should convert "pdf" to EDataSourceType.PDF', () => {
            const result = utilityService.getDataSourceType('pdf');
            expect(result).toBe(EDataSourceType.PDF);
        });

        it('should default to POSTGRESQL for unknown data source type', () => {
            const result = utilityService.getDataSourceType('unknown_type');
            expect(result).toBe(EDataSourceType.POSTGRESQL);
        });

        it('should handle empty string and default to POSTGRESQL', () => {
            const result = utilityService.getDataSourceType('');
            expect(result).toBe(EDataSourceType.POSTGRESQL);
        });
    });

    describe('uniquiseName()', () => {
        it('should generate unique name with UUID', () => {
            const name = 'test_table';
            const result = utilityService.uniquiseName(name);
            expect(result).toContain('test_table');
            expect(result).toContain('_dra_');
            expect(result).toMatch(/^[a-z_]+_dra_[a-f0-9_]+$/);
        });

        it('should replace spaces with underscores', () => {
            const name = 'test table name';
            const result = utilityService.uniquiseName(name);
            expect(result).toContain('test_table_name');
            expect(result).not.toContain(' ');
        });

        it('should convert to lowercase', () => {
            const name = 'TestTableName';
            const result = utilityService.uniquiseName(name);
            expect(result).toMatch(/^[a-z_]+_dra_[a-f0-9_]+$/);
            expect(result).not.toMatch(/[A-Z]/);
        });

        it('should handle special characters by replacing with underscores', () => {
            const name = 'test@table#name';
            const result = utilityService.uniquiseName(name);
            // After toLowerCase and space replacement, special chars remain
            expect(result).toContain('_dra_');
        });

        it('should generate different UUIDs for same name', () => {
            const name = 'test_table';
            const result1 = utilityService.uniquiseName(name);
            const result2 = utilityService.uniquiseName(name);
            expect(result1).not.toBe(result2);
        });

        it('should replace hyphens in UUID with underscores', () => {
            const name = 'test';
            const result = utilityService.uniquiseName(name);
            expect(result).not.toContain('-');
            expect(result).toMatch(/_dra_[a-f0-9_]+$/);
        });
    });

    describe('getConstants() - Environment Variables', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterAll(() => {
            process.env = originalEnv;
        });

        it('should return NODE_ENV with default value', () => {
            delete process.env.NODE_ENV;
            const result = utilityService.getConstants('NODE_ENV');
            expect(result).toBe('development');
        });

        it('should return custom NODE_ENV when set', () => {
            process.env.NODE_ENV = 'production';
            const result = utilityService.getConstants('NODE_ENV');
            expect(result).toBe('production');
        });

        it('should return PUBLIC_BACKEND_URL with default', () => {
            delete process.env.PUBLIC_BACKEND_URL;
            const result = utilityService.getConstants('PUBLIC_BACKEND_URL');
            expect(result).toBe('http://localhost:3002');
        });

        it('should return PORT with default', () => {
            delete process.env.PORT;
            const result = utilityService.getConstants('PORT');
            expect(result).toBe(3002);
        });

        it('should return empty string for RECAPTCHA_SECRET default', () => {
            delete process.env.RECAPTCHA_SECRET;
            const result = utilityService.getConstants('RECAPTCHA_SECRET');
            expect(result).toBe('');
        });

        it('should return empty string for JWT_SECRET default', () => {
            delete process.env.JWT_SECRET;
            const result = utilityService.getConstants('JWT_SECRET');
            expect(result).toBe('');
        });

        it('should return PASSWORD_SALT with default value', () => {
            delete process.env.PASSWORD_SALT;
            const result = utilityService.getConstants('PASSWORD_SALT');
            expect(result).toBe(10);
        });

        it('should return POSTGRESQL_HOST with empty default', () => {
            delete process.env.POSTGRESQL_HOST;
            const result = utilityService.getConstants('POSTGRESQL_HOST');
            expect(result).toBe('');
        });

        it('should return REDIS_HOST with default', () => {
            delete process.env.REDIS_HOST;
            const result = utilityService.getConstants('REDIS_HOST');
            expect(result).toBe('localhost');
        });

        it('should return REDIS_PORT with default', () => {
            delete process.env.REDIS_PORT;
            const result = utilityService.getConstants('REDIS_PORT');
            expect(result).toBe('6379');
        });

        it('should return custom environment variable value', () => {
            process.env.POSTGRESQL_HOST = 'custom-host.com';
            const result = utilityService.getConstants('POSTGRESQL_HOST');
            expect(result).toBe('custom-host.com');
        });

        it('should return SOCKETIO_SERVER_URL with default', () => {
            delete process.env.SOCKETIO_SERVER_URL;
            const result = utilityService.getConstants('SOCKETIO_SERVER_URL');
            expect(result).toBe('http://localhost');
        });

        it('should return NUM_WORKERS with default', () => {
            delete process.env.NUM_WORKERS;
            const result = utilityService.getConstants('NUM_WORKERS');
            expect(result).toBe(3);
        });
    });

    describe('convertDataTypeToPostgresDataType() - MySQL/MariaDB', () => {
        it('should convert MySQL TINYINT to PostgreSQL SMALLINT', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'TINYINT');
            expect(result.type).toBe('SMALLINT');
        });

        it('should convert MySQL INT to PostgreSQL INTEGER', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'INT');
            expect(result.type).toBe('INTEGER');
        });

        it('should convert MySQL BIGINT to PostgreSQL BIGINT', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'BIGINT');
            expect(result.type).toBe('BIGINT');
        });

        it('should convert MySQL VARCHAR with size', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'VARCHAR(255)');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(255);
        });

        it('should convert MySQL TEXT to PostgreSQL TEXT', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'TEXT');
            expect(result.type).toBe('TEXT');
        });

        it('should convert MySQL DATETIME to PostgreSQL TIMESTAMP', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'DATETIME');
            expect(result.type).toBe('TIMESTAMP');
        });

        it('should convert MySQL TIMESTAMP to PostgreSQL TIMESTAMP WITH TIME ZONE', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'TIMESTAMP');
            expect(result.type).toBe('TIMESTAMP WITH TIME ZONE');
        });

        it('should convert MySQL DECIMAL with precision and scale', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'DECIMAL(10,2)');
            expect(result.type).toBe('DECIMAL');
            expect(result.size).toBe('10,2');
        });

        it('should convert MySQL BLOB to PostgreSQL BYTEA', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'BLOB');
            expect(result.type).toBe('BYTEA');
        });

        it('should convert MySQL ENUM to PostgreSQL VARCHAR', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', "ENUM('small','medium','large')");
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBeGreaterThan(0);
        });

        it('should handle MariaDB types (MariaDB-compatible)', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mariadb', 'INT');
            expect(result.type).toBe('INTEGER');
        });

        it('should convert MySQL UNSIGNED BIGINT to NUMERIC', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'BIGINT UNSIGNED');
            expect(result.type).toBe('NUMERIC');
            expect(result.size).toBe('20,0');
        });

        it('should convert MySQL DOUBLE to DOUBLE PRECISION', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'DOUBLE');
            expect(result.type).toBe('DOUBLE PRECISION');
        });

        it('should convert MySQL YEAR to SMALLINT', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'YEAR');
            expect(result.type).toBe('SMALLINT');
        });

        it('should convert MySQL BOOLEAN to PostgreSQL BOOLEAN', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('mysql', 'BOOLEAN');
            expect(result.type).toBe('BOOLEAN');
        });
    });

    describe('convertDataTypeToPostgresDataType() - Excel', () => {
        it('should convert Excel TEXT to VARCHAR(1024)', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('excel', 'TEXT');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(1024);
        });

        it('should convert Excel EMAIL to VARCHAR(512)', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('excel', 'EMAIL');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(512);
        });

        it('should convert Excel URL to VARCHAR(512)', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('excel', 'URL');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(512);
        });

        it('should convert Excel BOOLEAN to PostgreSQL BOOLEAN', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('excel', 'BOOLEAN');
            expect(result.type).toBe('BOOLEAN');
        });

        it('should convert Excel NUMBER to DECIMAL', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('excel', 'NUMBER');
            expect(result.type).toBe('DECIMAL');
        });

        it('should convert Excel DATE to PostgreSQL DATE', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('excel', 'DATE');
            expect(result.type).toBe('DATE');
        });

        it('should handle lowercase Excel types', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('excel', 'text');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(1024);
        });
    });

    describe('convertDataTypeToPostgresDataType() - PDF', () => {
        it('should convert PDF TEXT to VARCHAR(2048)', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('pdf', 'TEXT');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(2048);
        });

        it('should convert PDF EMAIL to VARCHAR(512)', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('pdf', 'EMAIL');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(512);
        });

        it('should convert PDF URL to VARCHAR(1024)', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('pdf', 'URL');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(1024);
        });

        it('should convert PDF BOOLEAN to PostgreSQL BOOLEAN', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('pdf', 'BOOLEAN');
            expect(result.type).toBe('BOOLEAN');
        });

        it('should convert PDF NUMBER to DECIMAL', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('pdf', 'NUMBER');
            expect(result.type).toBe('DECIMAL');
        });

        it('should convert PDF DATE to PostgreSQL DATE', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('pdf', 'DATE');
            expect(result.type).toBe('DATE');
        });

        it('should default unknown PDF types to VARCHAR(1024)', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('pdf', 'UNKNOWN_TYPE');
            expect(result.type).toBe('VARCHAR');
            expect(result.size).toBe(1024);
        });
    });

    describe('convertDataTypeToPostgresDataType() - PostgreSQL', () => {
        it('should preserve PostgreSQL types unchanged', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('postgresql', 'INTEGER');
            expect(result.type).toBe('INTEGER');
        });

        it('should convert USER-DEFINED to TEXT', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('postgresql', 'USER-DEFINED');
            expect(result.type).toBe('TEXT');
        });

        it('should preserve JSON type', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('postgresql', 'JSON');
            expect(result.type).toBe('JSON');
        });

        it('should preserve JSONB type', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('postgresql', 'JSONB');
            expect(result.type).toBe('JSONB');
        });

        it('should handle lowercase user-defined type', () => {
            const result = utilityService.convertDataTypeToPostgresDataType('postgresql', 'user-defined');
            expect(result.type).toBe('TEXT');
        });
    });

    describe('sanitizeDataForPostgreSQL() - Boolean Values', () => {
        it('should sanitize boolean columns in row data', () => {
            const data = {
                columns: [
                    { title: 'is_active', key: 'is_active', type: 'boolean' }
                ],
                rows: [
                    { is_active: 'true' },
                    { is_active: 'false' }
                ]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].is_active).toBe('true');
            expect(result.rows[1].is_active).toBe('false');
        });

        it('should convert "1" to "true" for boolean columns', () => {
            const data = {
                columns: [{ title: 'active', key: 'active', type: 'boolean' }],
                rows: [{ active: '1' }]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].active).toBe('true');
        });

        it('should convert "0" to "false" for boolean columns', () => {
            const data = {
                columns: [{ title: 'active', key: 'active', type: 'boolean' }],
                rows: [{ active: '0' }]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].active).toBe('false');
        });

        it('should convert "yes" to "true" for boolean columns', () => {
            const data = {
                columns: [{ title: 'enabled', key: 'enabled', type: 'boolean' }],
                rows: [{ enabled: 'yes' }]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].enabled).toBe('true');
        });

        it('should convert "no" to "false" for boolean columns', () => {
            const data = {
                columns: [{ title: 'enabled', key: 'enabled', type: 'boolean' }],
                rows: [{ enabled: 'no' }]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].enabled).toBe('false');
        });

        it('should convert "active" to "true" for boolean columns', () => {
            const data = {
                columns: [{ title: 'status', key: 'status', type: 'boolean' }],
                rows: [{ status: 'active' }]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].status).toBe('true');
        });

        it('should handle ambiguous boolean values by setting to null', () => {
            const data = {
                columns: [{ title: 'flag', key: 'flag', type: 'boolean' }],
                rows: [{ flag: 'maybe' }]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].flag).toBeNull();
        });

        it('should handle case-insensitive boolean values', () => {
            const data = {
                columns: [{ title: 'flag', key: 'flag', type: 'boolean' }],
                rows: [
                    { flag: 'TRUE' },
                    { flag: 'False' },
                    { flag: 'YES' }
                ]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].flag).toBe('true');
            expect(result.rows[1].flag).toBe('false');
            expect(result.rows[2].flag).toBe('true');
        });

        it('should handle nested data structure', () => {
            const data = {
                columns: [{ title: 'active', key: 'active', type: 'boolean' }],
                rows: [{ data: { active: 'true' } }]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].data.active).toBe('true');
        });

        it('should preserve null and undefined boolean values', () => {
            const data = {
                columns: [{ title: 'flag', key: 'flag', type: 'boolean' }],
                rows: [
                    { flag: null },
                    { flag: undefined }
                ]
            };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].flag).toBeNull();
            expect(result.rows[1].flag).toBeUndefined();
        });

        it('should handle empty data', () => {
            const result = utilityService.sanitizeDataForPostgreSQL(null);
            expect(result).toBeNull();
        });

        it('should handle data without columns', () => {
            const data = { rows: [{ test: 'value' }] };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.rows[0].test).toBe('value');
        });

        it('should handle data without rows', () => {
            const data = { columns: [{ title: 'test', type: 'text' }] };
            const result = utilityService.sanitizeDataForPostgreSQL(data);
            expect(result.columns).toHaveLength(1);
        });
    });

    describe('sanitizeRowData()', () => {
        it('should sanitize individual row data based on column types', () => {
            const rowData = { is_active: '1', name: 'Test' };
            const columns = [
                { title: 'is_active', type: 'boolean' },
                { title: 'name', type: 'text' }
            ];
            const result = utilityService.sanitizeRowData(rowData, columns);
            expect(result.is_active).toBe('true');
            expect(result.name).toBe('Test');
        });

        it('should handle null rowData', () => {
            const result = utilityService.sanitizeRowData(null, []);
            expect(result).toBeNull();
        });

        it('should handle null columns', () => {
            const rowData = { test: 'value' };
            const result = utilityService.sanitizeRowData(rowData, null);
            expect(result.test).toBe('value');
        });

        it('should work with column.key when title is not present', () => {
            const rowData = { status: 'enabled' };
            const columns = [{ key: 'status', type: 'boolean' }];
            const result = utilityService.sanitizeRowData(rowData, columns);
            expect(result.status).toBe('true');
        });
    });
});
