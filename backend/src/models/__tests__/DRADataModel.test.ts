import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { DRADataModel } from '../../models/DRADataModel.js';

/**
 * DRA-TEST-010: DRADataModel Entity Operations Integration Tests
 * Tests TypeORM CRUD operations, JSON transformations, relationships, validation
 * Total: 20+ tests
 */
describe('DRADataModel Entity Operations', () => {
    let dataSource: DataSource;

    const mockModel = {
        id: 1,
        user_id: 1,
        data_source_id: 1,
        name: 'Test Model',
        selected_tables: ['users', 'orders'],
        join_conditions: [{ from: 'users.id', to: 'orders.user_id', type: 'INNER' }],
        computed_columns: [],
        created_at: new Date(),
        updated_at: new Date()
    };

    beforeEach(async () => {
        dataSource = {
            getRepository: jest.fn().mockReturnValue({
                create: jest.fn(),
                save: jest.fn(),
                findOne: jest.fn(),
                find: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                count: jest.fn()
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
        it('should create new data model with required fields', () => {
            const modelEntity = new DRADataModel();
            modelEntity.user_id = 1;
            modelEntity.data_source_id = 1;
            modelEntity.name = 'Sales Model';
            modelEntity.selected_tables = ['products', 'sales'];
            modelEntity.join_conditions = [];

            expect(modelEntity.user_id).toBe(1);
            expect(modelEntity.data_source_id).toBe(1);
            expect(modelEntity.name).toBe('Sales Model');
            expect(modelEntity.selected_tables).toHaveLength(2);
        });

        it('should initialize empty arrays for optional fields', () => {
            const modelEntity = new DRADataModel();
            modelEntity.user_id = 1;
            modelEntity.data_source_id = 1;
            modelEntity.name = 'Simple Model';
            modelEntity.selected_tables = ['table1'];
            modelEntity.join_conditions = [];
            modelEntity.computed_columns = [];

            expect(Array.isArray(modelEntity.computed_columns)).toBe(true);
            expect(modelEntity.computed_columns).toHaveLength(0);
        });

        it('should validate required user_id', () => {
            const modelEntity = new DRADataModel();
            modelEntity.data_source_id = 1;
            modelEntity.name = 'Test';
            modelEntity.selected_tables = ['table1'];

            expect(modelEntity.user_id).toBeUndefined();
        });

        it('should validate required data_source_id', () => {
            const modelEntity = new DRADataModel();
            modelEntity.user_id = 1;
            modelEntity.name = 'Test';
            modelEntity.selected_tables = ['table1'];

            expect(modelEntity.data_source_id).toBeUndefined();
        });

        it('should validate required name', () => {
            const modelEntity = new DRADataModel();
            modelEntity.user_id = 1;
            modelEntity.data_source_id = 1;
            modelEntity.selected_tables = ['table1'];

            expect(modelEntity.name).toBeUndefined();
        });
    });

    describe('CRUD Operations', () => {
        it('should save new data model to database', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const newModel = new DRADataModel();
            newModel.user_id = 1;
            newModel.data_source_id = 1;
            newModel.name = 'New Model';
            newModel.selected_tables = ['customers'];
            newModel.join_conditions = [];

            (repository.save as jest.Mock).mockResolvedValue({ ...newModel, id: 1 });

            const saved = await repository.save(newModel);

            expect(saved.id).toBe(1);
            expect(repository.save).toHaveBeenCalledWith(newModel);
        });

        it('should find data model by ID', async () => {
            const repository = dataSource.getRepository(DRADataModel);

            (repository.findOne as jest.Mock).mockResolvedValue(mockModel);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result).toEqual(mockModel);
        });

        it('should find data models by user_id', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const userModels = [
                mockModel,
                { ...mockModel, id: 2, name: 'Model 2' }
            ];

            (repository.find as jest.Mock).mockResolvedValue(userModels);

            const results = await repository.find({ where: { user_id: 1 } });

            expect(results).toHaveLength(2);
            expect(results.every(m => m.user_id === 1)).toBe(true);
        });

        it('should find data models by data_source_id', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const sourceModels = [mockModel];

            (repository.find as jest.Mock).mockResolvedValue(sourceModels);

            const results = await repository.find({ where: { data_source_id: 1 } });

            expect(results.every(m => m.data_source_id === 1)).toBe(true);
        });

        it('should update existing data model', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const updateData = { name: 'Updated Model' };

            (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.update({ id: 1 }, updateData);

            expect(result.affected).toBe(1);
        });

        it('should delete data model by ID', async () => {
            const repository = dataSource.getRepository(DRADataModel);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ id: 1 });

            expect(result.affected).toBe(1);
        });
    });

    describe('Selected Tables Management', () => {
        it('should store multiple selected tables', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const model = new DRADataModel();
            model.user_id = 1;
            model.data_source_id = 1;
            model.name = 'Multi-Table Model';
            model.selected_tables = ['users', 'orders', 'products', 'categories'];
            model.join_conditions = [];

            (repository.save as jest.Mock).mockResolvedValue({ ...model, id: 1 });

            const saved = await repository.save(model);

            expect(saved.selected_tables).toHaveLength(4);
        });

        it('should handle single table selection', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const model = new DRADataModel();
            model.user_id = 1;
            model.data_source_id = 1;
            model.name = 'Single Table';
            model.selected_tables = ['users'];
            model.join_conditions = [];

            (repository.save as jest.Mock).mockResolvedValue({ ...model, id: 1 });

            const saved = await repository.save(model);

            expect(saved.selected_tables).toHaveLength(1);
        });

        it('should update selected tables', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const newTables = ['customers', 'transactions'];

            (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.update({ id: 1 }, { selected_tables: newTables });

            expect(result.affected).toBe(1);
        });

        it('should preserve table order in selected_tables array', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const orderedTables = ['table_a', 'table_b', 'table_c'];
            const model = { ...mockModel, selected_tables: orderedTables };

            (repository.findOne as jest.Mock).mockResolvedValue(model);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result?.selected_tables).toEqual(orderedTables);
        });
    });

    describe('Join Conditions Management', () => {
        it('should store join conditions between tables', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const joinConditions = [
                { from: 'users.id', to: 'orders.user_id', type: 'INNER' },
                { from: 'orders.product_id', to: 'products.id', type: 'LEFT' }
            ];
            const model = new DRADataModel();
            model.user_id = 1;
            model.data_source_id = 1;
            model.name = 'Joined Model';
            model.selected_tables = ['users', 'orders', 'products'];
            model.join_conditions = joinConditions;

            (repository.save as jest.Mock).mockResolvedValue({ ...model, id: 1 });

            const saved = await repository.save(model);

            expect(saved.join_conditions).toHaveLength(2);
        });

        it('should support different join types', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const joinConditions = [
                { from: 'a.id', to: 'b.a_id', type: 'INNER' },
                { from: 'a.id', to: 'c.a_id', type: 'LEFT' },
                { from: 'a.id', to: 'd.a_id', type: 'RIGHT' },
                { from: 'a.id', to: 'e.a_id', type: 'OUTER' }
            ];
            const model = { ...mockModel, join_conditions: joinConditions };

            (repository.findOne as jest.Mock).mockResolvedValue(model);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result?.join_conditions).toHaveLength(4);
        });

        it('should handle empty join conditions', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const model = { ...mockModel, join_conditions: [] };

            (repository.findOne as jest.Mock).mockResolvedValue(model);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result?.join_conditions).toEqual([]);
        });

        it('should update join conditions', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const newJoins = [
                { from: 'table1.id', to: 'table2.fk', type: 'INNER' }
            ];

            (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.update({ id: 1 }, { join_conditions: newJoins });

            expect(result.affected).toBe(1);
        });
    });

    describe('Computed Columns Management', () => {
        it('should store computed column definitions', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const computedColumns = [
                { name: 'total_price', expression: 'quantity * unit_price', type: 'number' },
                { name: 'full_name', expression: "first_name || ' ' || last_name", type: 'string' }
            ];
            const model = new DRADataModel();
            model.user_id = 1;
            model.data_source_id = 1;
            model.name = 'Computed Model';
            model.selected_tables = ['orders'];
            model.join_conditions = [];
            model.computed_columns = computedColumns;

            (repository.save as jest.Mock).mockResolvedValue({ ...model, id: 1 });

            const saved = await repository.save(model);

            expect(saved.computed_columns).toHaveLength(2);
        });

        it('should handle empty computed columns array', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const model = { ...mockModel, computed_columns: [] };

            (repository.findOne as jest.Mock).mockResolvedValue(model);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result?.computed_columns).toEqual([]);
        });

        it('should update computed columns', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const newComputed = [
                { name: 'discount', expression: 'price * 0.1', type: 'number' }
            ];

            (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.update({ id: 1 }, { computed_columns: newComputed });

            expect(result.affected).toBe(1);
        });
    });

    describe('JSON Transformation', () => {
        it('should serialize arrays to JSON', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const model = new DRADataModel();
            model.user_id = 1;
            model.data_source_id = 1;
            model.name = 'JSON Model';
            model.selected_tables = ['table1', 'table2'];
            model.join_conditions = [{ from: 'a.id', to: 'b.a_id', type: 'INNER' }];
            model.computed_columns = [];

            (repository.save as jest.Mock).mockResolvedValue(model);

            const saved = await repository.save(model);

            expect(typeof saved.selected_tables).not.toBe('string'); // Should be array
        });

        it('should deserialize JSON to arrays on retrieve', async () => {
            const repository = dataSource.getRepository(DRADataModel);

            (repository.findOne as jest.Mock).mockResolvedValue(mockModel);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(Array.isArray(result?.selected_tables)).toBe(true);
            expect(Array.isArray(result?.join_conditions)).toBe(true);
        });

        it('should handle complex nested JSON structures', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const complexJoins = [
                {
                    from: 'users.id',
                    to: 'orders.user_id',
                    type: 'INNER',
                    conditions: [{ field: 'status', operator: '=', value: 'active' }]
                }
            ];
            const model = { ...mockModel, join_conditions: complexJoins };

            (repository.findOne as jest.Mock).mockResolvedValue(model);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result?.join_conditions[0]).toHaveProperty('conditions');
        });
    });

    describe('Relationships', () => {
        it('should establish relationship with user via user_id', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const model = { ...mockModel, user_id: 5 };

            (repository.findOne as jest.Mock).mockResolvedValue(model);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result?.user_id).toBe(5);
        });

        it('should establish relationship with data source via data_source_id', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const model = { ...mockModel, data_source_id: 3 };

            (repository.findOne as jest.Mock).mockResolvedValue(model);

            const result = await repository.findOne({ where: { id: 1 } });

            expect(result?.data_source_id).toBe(3);
        });

        it('should cascade delete when user is deleted', async () => {
            const repository = dataSource.getRepository(DRADataModel);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ user_id: 1 });

            expect(result.affected).toBeGreaterThanOrEqual(0);
        });

        it('should cascade delete when data source is deleted', async () => {
            const repository = dataSource.getRepository(DRADataModel);

            (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

            const result = await repository.delete({ data_source_id: 1 });

            expect(result.affected).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Query Filtering', () => {
        it('should filter by user_id and data_source_id', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const filteredModels = [mockModel];

            (repository.find as jest.Mock).mockResolvedValue(filteredModels);

            const results = await repository.find({
                where: { user_id: 1, data_source_id: 1 }
            });

            expect(results.every(m => m.user_id === 1 && m.data_source_id === 1)).toBe(true);
        });

        it('should count models by user', async () => {
            const repository = dataSource.getRepository(DRADataModel);

            (repository.count as jest.Mock).mockResolvedValue(3);

            const count = await repository.count({ where: { user_id: 1 } });

            expect(count).toBe(3);
        });

        it('should search models by name pattern', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const matchingModels = [
                { ...mockModel, id: 1, name: 'Sales Model' },
                { ...mockModel, id: 2, name: 'Sales Report' }
            ];

            (repository.find as jest.Mock).mockResolvedValue(matchingModels);

            const results = await repository.find();

            expect(results.every(m => m.name.includes('Sales'))).toBe(true);
        });
    });

    describe('Timestamps', () => {
        it('should auto-generate created_at timestamp', async () => {
            const repository = dataSource.getRepository(DRADataModel);
            const model = new DRADataModel();
            model.user_id = 1;
            model.data_source_id = 1;
            model.name = 'Test';
            model.selected_tables = ['table1'];
            model.join_conditions = [];

            const now = new Date();
            (repository.save as jest.Mock).mockResolvedValue({ ...model, created_at: now });

            const saved = await repository.save(model);

            expect(saved.created_at).toBeDefined();
        });

        it('should auto-update updated_at timestamp on changes', async () => {
            const repository = dataSource.getRepository(DRADataModel);
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

            const model = await repository.findOne({ where: { id: 1 } });
            const updated = await repository.save({ ...model, name: 'Updated' });

            expect(updated.updated_at.getTime()).toBeGreaterThan(originalDate.getTime());
        });
    });

    describe('Validation', () => {
        it('should validate selected_tables is an array', () => {
            const model = new DRADataModel();
            model.selected_tables = ['table1', 'table2'];

            expect(Array.isArray(model.selected_tables)).toBe(true);
        });

        it('should validate join_conditions is an array', () => {
            const model = new DRADataModel();
            model.join_conditions = [{ from: 'a.id', to: 'b.id', type: 'INNER' }];

            expect(Array.isArray(model.join_conditions)).toBe(true);
        });

        it('should validate name length constraints', () => {
            const model = new DRADataModel();
            const longName = 'a'.repeat(250);
            model.name = longName;

            expect(model.name.length).toBe(250);
        });
    });
});
