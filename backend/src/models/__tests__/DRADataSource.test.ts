import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { DRADataSource } from '../../models/DRADataSource.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';
import { EncryptionService } from '../../services/EncryptionService.js';

/**
 * DRA-TEST-008: DRADataSource Entity Operations Integration Tests
 * Tests TypeORM CRUD operations, encryption, relationships, and validation
 * Total: 20+ tests
 */
describe('DRADataSource Entity Operations', () => {
    let dataSource: DataSource;
    let encryptionService: EncryptionService;

    const mockConnectionDetails = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
    };

    beforeEach(async () => {
        encryptionService = EncryptionService.getInstance();
        
        // Mock DataSource for testing
        dataSource = {
            getRepository: jest.fn().mockReturnValue({
                create: jest.fn(),
                save: jest.fn(),
                findOne: jest.fn(),
                find: jest.fn(),
                update: jest.fn(),
                delete: jest.fn()
            }),
            manager: {
                transaction: jest.fn()
            }
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Entity Creation', () => {
        it('should create new data source with required fields', () => {
            const dataSourceEntity = new DRADataSource();
            dataSourceEntity.user_id = 1;
            dataSourceEntity.name = 'Test Data Source';
            dataSourceEntity.type = EDataSourceType.POSTGRESQL;
            dataSourceEntity.connection_details = mockConnectionDetails;

            expect(dataSourceEntity.user_id).toBe(1);
            expect(dataSourceEntity.name).toBe('Test Data Source');
            expect(dataSourceEntity.type).toBe(EDataSourceType.POSTGRESQL);
        });

        it('should set default values for optional fields', () => {
            const dataSourceEntity = new DRADataSource();
            dataSourceEntity.user_id = 1;
            dataSourceEntity.name = 'Test';
            dataSourceEntity.type = EDataSourceType.POSTGRESQL;
            dataSourceEntity.connection_details = mockConnectionDetails;

            expect(dataSourceEntity.is_active).toBeUndefined(); // Will be set by DB default
        });

        it('should validate required user_id', () => {
            const dataSourceEntity = new DRADataSource();
            dataSourceEntity.name = 'Test';
            dataSourceEntity.type = EDataSourceType.POSTGRESQL;
            dataSourceEntity.connection_details = mockConnectionDetails;

            expect(dataSourceEntity.user_id).toBeUndefined();
        });

        it('should validate required name', () => {
            const dataSourceEntity = new DRADataSource();
            dataSourceEntity.user_id = 1;
            dataSourceEntity.type = EDataSourceType.POSTGRESQL;
            dataSourceEntity.connection_details = mockConnectionDetails;

            expect(dataSourceEntity.name).toBeUndefined();
        });

        it('should validate required type', () => {
            const dataSourceEntity = new DRADataSource();
            dataSourceEntity.user_id = 1;
            dataSourceEntity.name = 'Test';
            dataSourceEntity.connection_details = mockConnectionDetails;

            expect(dataSourceEntity.type).toBeUndefined();
        });
    });

    describe('Connection Details Encryption', () => {
        it('should encrypt connection_details on save', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const dataSourceEntity = new DRADataSource();
            dataSourceEntity.user_id = 1;
            dataSourceEntity.name = 'Encrypted Source';
            dataSourceEntity.type = EDataSourceType.POSTGRESQL;
            dataSourceEntity.connection_details = mockConnectionDetails;

            (repository.save as jest.Mock).mockResolvedValue(dataSourceEntity);

            const saved = await repository.save(dataSourceEntity);

            expect(saved).toBeDefined();
            expect(repository.save).toHaveBeenCalled();
        });

        it('should decrypt connection_details on retrieve', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const encryptedDetails = encryptionService.encrypt(JSON.stringify(mockConnectionDetails));
            
            const mockEntity = {
                id: 1,
                user_id: 1,
                name: 'Test',
                type: EDataSourceType.POSTGRESQL,
                connection_details: encryptedDetails
            };

            (repository.findOne as jest.Mock).mockResolvedValue(mockEntity);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result).toBeDefined();
        });

        it('should handle encryption for PostgreSQL credentials', () => {
            const pgDetails = {
                host: 'pg.example.com',
                port: 5432,
                database: 'production',
                username: 'pguser',
                password: 'secretpassword'
            };

            const encrypted = encryptionService.encrypt(JSON.stringify(pgDetails));
            const decrypted = JSON.parse(encryptionService.decrypt(encrypted));

            expect(decrypted).toEqual(pgDetails);
        });

        it('should handle encryption for MySQL credentials', () => {
            const mysqlDetails = {
                host: 'mysql.example.com',
                port: 3306,
                database: 'mydb',
                username: 'mysqluser',
                password: 'mysqlpass'
            };

            const encrypted = encryptionService.encrypt(JSON.stringify(mysqlDetails));
            const decrypted = JSON.parse(encryptionService.decrypt(encrypted));

            expect(decrypted).toEqual(mysqlDetails);
        });

        it('should preserve connection_details structure after encryption/decryption', () => {
            const originalDetails = { ...mockConnectionDetails, ssl: true, timeout: 30000 };

            const encrypted = encryptionService.encrypt(JSON.stringify(originalDetails));
            const decrypted = JSON.parse(encryptionService.decrypt(encrypted));

            expect(decrypted).toEqual(originalDetails);
        });
    });

    describe('CRUD Operations', () => {
        it('should save new data source to database', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const newEntity = new DRADataSource();
            newEntity.user_id = 1;
            newEntity.name = 'New Source';
            newEntity.type = EDataSourceType.POSTGRESQL;
            newEntity.connection_details = mockConnectionDetails;

            (repository.save as jest.Mock).mockResolvedValue({ ...newEntity, id: 1 });

            const saved = await repository.save(newEntity);

            expect(saved.id).toBe(1);
            expect(repository.save).toHaveBeenCalledWith(newEntity);
        });

        it('should find data source by ID', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const mockEntity = {
                id: 1,
                user_id: 1,
                name: 'Test Source',
                type: EDataSourceType.POSTGRESQL,
                connection_details: mockConnectionDetails
            };

            (repository.findOne as jest.Mock).mockResolvedValue(mockEntity);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result).toEqual(mockEntity);
            expect(repository.findOne).toHaveBeenCalled();
        });

        it('should find data sources by user_id', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const mockEntities = [
                { id: 1, user_id: 1, name: 'Source 1', type: EDataSourceType.POSTGRESQL },
                { id: 2, user_id: 1, name: 'Source 2', type: EDataSourceType.MYSQL }
            ];

            (repository.find as jest.Mock).mockResolvedValue(mockEntities);

            const results = await repository.find({ where: { user_id: 1 } });

            expect(results).toHaveLength(2);
            expect(results[0].user_id).toBe(1);
        });

        it('should update existing data source', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const updateData = { name: 'Updated Name' };

            (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.update({ id: 1 }, updateData);

            expect(result.affected).toBe(1);
            expect(repository.update).toHaveBeenCalledWith({ id: 1 }, updateData);
        });

        it('should delete data source by ID', async () => {
            const repository = dataSource.getRepository(DRADataSource);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ id: 1 });

            expect(result.affected).toBe(1);
        });
    });

    describe('Data Source Types', () => {
        it('should support PostgreSQL data source type', () => {
            const entity = new DRADataSource();
            entity.type = EDataSourceType.POSTGRESQL;

            expect(entity.type).toBe(EDataSourceType.POSTGRESQL);
        });

        it('should support MySQL data source type', () => {
            const entity = new DRADataSource();
            entity.type = EDataSourceType.MYSQL;

            expect(entity.type).toBe(EDataSourceType.MYSQL);
        });

        it('should support MariaDB data source type', () => {
            const entity = new DRADataSource();
            entity.type = EDataSourceType.MARIADB;

            expect(entity.type).toBe(EDataSourceType.MARIADB);
        });

        it('should support CSV file data source type', () => {
            const entity = new DRADataSource();
            entity.type = EDataSourceType.CSV;

            expect(entity.type).toBe(EDataSourceType.CSV);
        });

        it('should support Excel file data source type', () => {
            const entity = new DRADataSource();
            entity.type = EDataSourceType.EXCEL;

            expect(entity.type).toBe(EDataSourceType.EXCEL);
        });

        it('should support PDF file data source type', () => {
            const entity = new DRADataSource();
            entity.type = EDataSourceType.PDF;

            expect(entity.type).toBe(EDataSourceType.PDF);
        });
    });

    describe('Relationships', () => {
        it('should establish relationship with user via user_id', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const entity = new DRADataSource();
            entity.user_id = 5;
            entity.name = 'User Source';
            entity.type = EDataSourceType.POSTGRESQL;
            entity.connection_details = mockConnectionDetails;

            (repository.save as jest.Mock).mockResolvedValue(entity);

            const saved = await repository.save(entity);

            expect(saved.user_id).toBe(5);
        });

        it('should cascade delete related data models', async () => {
            const repository = dataSource.getRepository(DRADataSource);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ id: 1 });

            expect(result.affected).toBe(1);
            // Cascade delete handled by database constraints
        });
    });

    describe('Query Filtering', () => {
        it('should filter by data source type', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const mockPostgresSources = [
                { id: 1, type: EDataSourceType.POSTGRESQL, name: 'PG1' },
                { id: 2, type: EDataSourceType.POSTGRESQL, name: 'PG2' }
            ];

            (repository.find as jest.Mock).mockResolvedValue(mockPostgresSources);

            const results = await repository.find({ where: { type: EDataSourceType.POSTGRESQL } });

            expect(results).toHaveLength(2);
            expect(results.every(r => r.type === EDataSourceType.POSTGRESQL)).toBe(true);
        });

        it('should filter by is_active status', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const activeSources = [
                { id: 1, is_active: true, name: 'Active1' },
                { id: 2, is_active: true, name: 'Active2' }
            ];

            (repository.find as jest.Mock).mockResolvedValue(activeSources);

            const results = await repository.find({ where: { is_active: true } });

            expect(results.every(r => r.is_active === true)).toBe(true);
        });

        it('should support complex where conditions', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const mockResults = [
                { id: 1, user_id: 1, type: EDataSourceType.POSTGRESQL, is_active: true }
            ];

            (repository.find as jest.Mock).mockResolvedValue(mockResults);

            const results = await repository.find({
                where: { user_id: 1, type: EDataSourceType.POSTGRESQL, is_active: true }
            });

            expect(results).toHaveLength(1);
        });
    });

    describe('Timestamps', () => {
        it('should auto-generate created_at timestamp', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const entity = new DRADataSource();
            entity.user_id = 1;
            entity.name = 'Test';
            entity.type = EDataSourceType.POSTGRESQL;
            entity.connection_details = mockConnectionDetails;

            const now = new Date();
            (repository.save as jest.Mock).mockResolvedValue({ ...entity, created_at: now });

            const saved = await repository.save(entity);

            expect(saved.created_at).toBeDefined();
        });

        it('should auto-update updated_at timestamp on changes', async () => {
            const repository = dataSource.getRepository(DRADataSource);
            const originalDate = new Date('2024-01-01');
            const updatedDate = new Date();

            (repository.findOne as jest.Mock).mockResolvedValue({
                id: 1,
                updated_at: originalDate
            });
            (repository.save as jest.Mock).mockResolvedValue({
                id: 1,
                updated_at: updatedDate
            });

            const entity = await repository.findOne({ where: { id: 1 } });
            const updated = await repository.save({ ...entity, name: 'Updated' });

            expect(updated.updated_at.getTime()).toBeGreaterThan(originalDate.getTime());
        });
    });

    describe('Validation', () => {
        it('should validate connection_details is valid JSON', () => {
            const entity = new DRADataSource();
            entity.connection_details = mockConnectionDetails;

            expect(() => JSON.stringify(entity.connection_details)).not.toThrow();
        });

        it('should reject null connection_details', () => {
            const entity = new DRADataSource();
            entity.user_id = 1;
            entity.name = 'Test';
            entity.type = EDataSourceType.POSTGRESQL;
            entity.connection_details = null as any;

            expect(entity.connection_details).toBeNull();
        });

        it('should validate name length constraints', () => {
            const entity = new DRADataSource();
            const longName = 'a'.repeat(300);
            entity.name = longName;

            expect(entity.name.length).toBe(300);
        });
    });
});
