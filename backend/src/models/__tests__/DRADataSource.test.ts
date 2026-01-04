import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DRADataSource } from '../DRADataSource.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';
import { EncryptionService } from '../../services/EncryptionService.js';
import { IDBConnectionDetails } from '../../types/IDBConnectionDetails.js';

describe('DRADataSource Model', () => {
    describe('Entity Structure', () => {
        it('should create a data source instance with required fields', () => {
            const dataSource = new DRADataSource();
            dataSource.name = 'Test PostgreSQL Connection';
            dataSource.data_type = EDataSourceType.POSTGRESQL;
            
            expect(dataSource.name).toBe('Test PostgreSQL Connection');
            expect(dataSource.data_type).toBe(EDataSourceType.POSTGRESQL);
        });

        it('should support all data source types from enum', () => {
            const dataSource = new DRADataSource();
            
            const allTypes = [
                EDataSourceType.POSTGRESQL,
                EDataSourceType.MYSQL,
                EDataSourceType.MARIADB,
                EDataSourceType.MONGODB,
                EDataSourceType.CSV,
                EDataSourceType.EXCEL,
                EDataSourceType.PDF,
                EDataSourceType.GOOGLE_ANALYTICS,
                EDataSourceType.GOOGLE_AD_MANAGER,
                EDataSourceType.GOOGLE_ADS
            ];

            allTypes.forEach(type => {
                dataSource.data_type = type;
                expect(dataSource.data_type).toBe(type);
            });
        });

        it('should have nullable created_at timestamp', () => {
            const dataSource = new DRADataSource();
            
            expect(dataSource.created_at).toBeUndefined();
            
            dataSource.created_at = new Date();
            expect(dataSource.created_at).toBeInstanceOf(Date);
        });
    });

    describe('Connection Details Encryption', () => {
        let encryptionService: EncryptionService;

        beforeEach(() => {
            encryptionService = EncryptionService.getInstance();
            // Ensure encryption is enabled for tests
            process.env.ENCRYPTION_ENABLED = 'true';
        });

        it('should store connection details', () => {
            const dataSource = new DRADataSource();
            const connectionDetails: IDBConnectionDetails = {
                data_source_type: EDataSourceType.POSTGRESQL,
                host: 'localhost',
                port: 5432,
                schema: 'public',
                database: 'test_db',
                username: 'testuser',
                password: 'testpass'
            };

            dataSource.connection_details = connectionDetails;

            expect(dataSource.connection_details).toBeDefined();
            expect(dataSource.connection_details.host).toBe('localhost');
            expect(dataSource.connection_details.port).toBe(5432);
            expect(dataSource.connection_details.database).toBe('test_db');
        });

        it('should handle MySQL connection details', () => {
            const dataSource = new DRADataSource();
            const connectionDetails: IDBConnectionDetails = {
                data_source_type: EDataSourceType.MYSQL,
                host: 'mysql.example.com',
                port: 3306,
                schema: 'app_schema',
                database: 'app_db',
                username: 'root',
                password: 'mysqlpass'
            };

            dataSource.data_type = EDataSourceType.MYSQL;
            dataSource.connection_details = connectionDetails;

            expect(dataSource.connection_details.port).toBe(3306);
            expect(dataSource.connection_details.data_source_type).toBe(EDataSourceType.MYSQL);
        });

        it('should handle MariaDB connection details', () => {
            const dataSource = new DRADataSource();
            const connectionDetails: IDBConnectionDetails = {
                data_source_type: EDataSourceType.MARIADB,
                host: 'mariadb.example.com',
                port: 3307,
                schema: 'main',
                database: 'production',
                username: 'admin',
                password: 'mariapass'
            };

            dataSource.data_type = EDataSourceType.MARIADB;
            dataSource.connection_details = connectionDetails;

            expect(dataSource.data_type).toBe(EDataSourceType.MARIADB);
            expect(dataSource.connection_details.host).toBe('mariadb.example.com');
        });

        it('should handle MongoDB connection details', () => {
            const dataSource = new DRADataSource();
            const connectionDetails: IDBConnectionDetails = {
                data_source_type: EDataSourceType.MONGODB,
                host: 'mongodb.example.com',
                port: 27017,
                schema: '',
                database: 'mongo_db',
                username: 'mongouser',
                password: 'mongopass'
            };

            dataSource.data_type = EDataSourceType.MONGODB;
            dataSource.connection_details = connectionDetails;

            expect(dataSource.data_type).toBe(EDataSourceType.MONGODB);
            expect(dataSource.connection_details.port).toBe(27017);
        });
    });

    describe('Data Source Types', () => {
        it('should support database types', () => {
            const dataSource = new DRADataSource();
            
            dataSource.data_type = EDataSourceType.POSTGRESQL;
            expect(dataSource.data_type).toBe('postgresql');
            
            dataSource.data_type = EDataSourceType.MYSQL;
            expect(dataSource.data_type).toBe('mysql');
            
            dataSource.data_type = EDataSourceType.MARIADB;
            expect(dataSource.data_type).toBe('mariadb');
        });

        it('should support file types', () => {
            const dataSource = new DRADataSource();
            
            dataSource.data_type = EDataSourceType.CSV;
            expect(dataSource.data_type).toBe('csv');
            
            dataSource.data_type = EDataSourceType.EXCEL;
            expect(dataSource.data_type).toBe('excel');
            
            dataSource.data_type = EDataSourceType.PDF;
            expect(dataSource.data_type).toBe('pdf');
        });

        it('should support Google API types', () => {
            const dataSource = new DRADataSource();
            
            dataSource.data_type = EDataSourceType.GOOGLE_ANALYTICS;
            expect(dataSource.data_type).toBe('google_analytics');
            
            dataSource.data_type = EDataSourceType.GOOGLE_AD_MANAGER;
            expect(dataSource.data_type).toBe('google_ad_manager');
            
            dataSource.data_type = EDataSourceType.GOOGLE_ADS;
            expect(dataSource.data_type).toBe('google_ads');
        });
    });

    describe('Entity Relations', () => {
        it('should have users_platform relation', () => {
            const dataSource = new DRADataSource();
            
            // Relation exists as property
            expect(dataSource).toHaveProperty('users_platform');
        });

        it('should have data_models collection', () => {
            const dataSource = new DRADataSource();
            
            // Relation exists as property
            expect(dataSource).toHaveProperty('data_models');
        });

        it('should have project relation', () => {
            const dataSource = new DRADataSource();
            
            // Relation exists as property
            expect(dataSource).toHaveProperty('project');
        });

        it('should have table_metadata collection', () => {
            const dataSource = new DRADataSource();
            
            // Relation exists as property
            expect(dataSource).toHaveProperty('table_metadata');
        });
    });

    describe('Encryption Service Integration', () => {
        it('should use EncryptionService for connection details', () => {
            const encryptionService = EncryptionService.getInstance();
            
            const testData: IDBConnectionDetails = {
                data_source_type: EDataSourceType.POSTGRESQL,
                host: 'secure.example.com',
                port: 5432,
                schema: 'public',
                database: 'secure_db',
                username: 'secureuser',
                password: 'securepass123!'
            };

            // Test encryption
            const encrypted = encryptionService.encrypt(testData);
            expect(typeof encrypted).toBe('string');
            expect(encrypted).not.toContain('securepass123!'); // Password should be encrypted

            // Test decryption
            const decrypted = encryptionService.decrypt(encrypted);
            expect(decrypted.host).toBe('secure.example.com');
            expect(decrypted.password).toBe('securepass123!');
        });

        it('should verify encrypted data structure', () => {
            const encryptionService = EncryptionService.getInstance();
            
            const testData: IDBConnectionDetails = {
                data_source_type: EDataSourceType.MYSQL,
                host: 'test.com',
                port: 3306,
                schema: 'test',
                database: 'testdb',
                username: 'user',
                password: 'pass'
            };

            const encrypted = encryptionService.encrypt(testData);
            
            // Encrypted string should be detectable
            expect(encryptionService.isEncrypted(encrypted)).toBe(true);
            expect(encryptionService.isEncrypted(testData)).toBe(false);
        });
    });

    describe('Field Validations', () => {
        it('should accept valid name lengths', () => {
            const dataSource = new DRADataSource();
            
            // Test short name
            dataSource.name = 'DB';
            expect(dataSource.name).toBe('DB');
            
            // Test long name (up to 255 chars)
            const longName = 'a'.repeat(255);
            dataSource.name = longName;
            expect(dataSource.name.length).toBe(255);
        });

        it('should store complex connection details with API credentials', () => {
            const dataSource = new DRADataSource();
            const connectionDetails: IDBConnectionDetails = {
                data_source_type: EDataSourceType.GOOGLE_ANALYTICS,
                host: 'analytics.googleapis.com',
                port: 443,
                schema: '',
                database: '',
                username: 'service-account@project.iam.gserviceaccount.com',
                password: '',
                api_connection_details: {
                    oauth_access_token: 'access-token-456',
                    oauth_refresh_token: 'refresh-token-123',
                    token_expiry: new Date('2026-12-31'),
                    api_config: {
                        property_id: 'GA-123456'
                    }
                }
            };

            dataSource.data_type = EDataSourceType.GOOGLE_ANALYTICS;
            dataSource.connection_details = connectionDetails;

            expect(dataSource.connection_details.api_connection_details).toBeDefined();
            expect(dataSource.connection_details.api_connection_details?.oauth_access_token).toBe('access-token-456');
        });
    });
});
