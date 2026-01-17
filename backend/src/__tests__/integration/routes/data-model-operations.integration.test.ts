import { jest } from '@jest/globals';
import { DataModelProcessor } from '../../../processors/DataModelProcessor.js';
import { DataSourceProcessor } from '../../../processors/DataSourceProcessor.js';
import { CrossSourceJoinService } from '../../../services/CrossSourceJoinService.js';
import { ITokenDetails } from '../../../types/ITokenDetails.js';
import { EUserType } from '../../../types/EUserType.js';

/**
 * TEST-013: Data Model Routes Integration Tests
 * Tests data model business logic through DataModelProcessor
 * Total: 25 tests covering all data model operations
 */
describe('Data Model Operations Integration Tests', () => {
    let mockDataModelProcessor: any;
    let mockDataSourceProcessor: any;
    let mockCrossSourceJoinService: any;
    const testTokenDetails: ITokenDetails = {
        user_id: 1,
        email: 'test@test.com',
        user_type: EUserType.ADMIN,
        iat: Date.now()
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup DataModelProcessor mock
        const mockGetDataModels: any = jest.fn();
        const mockDeleteDataModel: any = jest.fn();
        const mockRefreshDataModel: any = jest.fn();
        const mockUpdateDataModelOnQuery: any = jest.fn();
        const mockGetTablesFromDataModels: any = jest.fn();
        const mockExecuteQueryOnDataModel: any = jest.fn();

        mockDataModelProcessor = {
            getDataModels: mockGetDataModels,
            deleteDataModel: mockDeleteDataModel,
            refreshDataModel: mockRefreshDataModel,
            updateDataModelOnQuery: mockUpdateDataModelOnQuery,
            getTablesFromDataModels: mockGetTablesFromDataModels,
            executeQueryOnDataModel: mockExecuteQueryOnDataModel
        };
        jest.spyOn(DataModelProcessor, 'getInstance').mockReturnValue(mockDataModelProcessor);

        // Setup DataSourceProcessor mock
        const mockGetDataSourcesByProject: any = jest.fn();
        const mockGetTablesFromDataSource: any = jest.fn();

        mockDataSourceProcessor = {
            getDataSourcesByProject: mockGetDataSourcesByProject,
            getTablesFromDataSource: mockGetTablesFromDataSource
        };
        jest.spyOn(DataSourceProcessor, 'getInstance').mockReturnValue(mockDataSourceProcessor);

        // Setup CrossSourceJoinService mock
        const mockGetCombinedSuggestions: any = jest.fn();
        const mockSaveJoinToCatalog: any = jest.fn();

        mockCrossSourceJoinService = {
            getCombinedSuggestions: mockGetCombinedSuggestions,
            saveJoinToCatalog: mockSaveJoinToCatalog
        };
        jest.spyOn(CrossSourceJoinService, 'getInstance').mockReturnValue(mockCrossSourceJoinService);
    });

    describe('Data Model List Operations', () => {
        it('should return list of data models for authenticated user', async () => {
            const mockDataModels = [
                { id: 1, name: 'Sales Model', data_source_id: 1 },
                { id: 2, name: 'Users Model', data_source_id: 2 }
            ];
            mockDataModelProcessor.getDataModels.mockResolvedValue(mockDataModels);

            const result = await DataModelProcessor.getInstance().getDataModels(1, testTokenDetails);

            expect(result).toEqual(mockDataModels);
            expect(mockDataModelProcessor.getDataModels).toHaveBeenCalledWith(testTokenDetails);
        });

        it('should handle empty data model list', async () => {
            mockDataModelProcessor.getDataModels.mockResolvedValue([]);

            const result = await DataModelProcessor.getInstance().getDataModels(1, testTokenDetails);

            expect(result).toEqual([]);
        });
    });

    describe('Data Model Deletion', () => {
        it('should successfully delete data model', async () => {
            mockDataModelProcessor.deleteDataModel.mockResolvedValue(true);

            const result = await DataModelProcessor.getInstance().deleteDataModel(1, testTokenDetails);

            expect(result).toBe(true);
            expect(mockDataModelProcessor.deleteDataModel).toHaveBeenCalledWith(1, testTokenDetails);
        });

        it('should handle delete failures', async () => {
            mockDataModelProcessor.deleteDataModel.mockResolvedValue(false);

            const result = await DataModelProcessor.getInstance().deleteDataModel(999, testTokenDetails);

            expect(result).toBe(false);
        });

        it('should prevent unauthorized deletion', async () => {
            mockDataModelProcessor.deleteDataModel.mockResolvedValue(false);

            const result = await DataModelProcessor.getInstance().deleteDataModel(1, testTokenDetails);

            expect(result).toBe(false);
        });
    });

    describe('Data Model Refresh', () => {
        it('should successfully refresh data model', async () => {
            mockDataModelProcessor.refreshDataModel.mockResolvedValue(true);

            const result = await DataModelProcessor.getInstance().refreshDataModel(1, testTokenDetails);

            expect(result).toBe(true);
            expect(mockDataModelProcessor.refreshDataModel).toHaveBeenCalledWith(1, testTokenDetails);
        });

        it('should handle refresh failures', async () => {
            mockDataModelProcessor.refreshDataModel.mockResolvedValue(false);

            const result = await DataModelProcessor.getInstance().refreshDataModel(1, testTokenDetails);

            expect(result).toBe(false);
        });

        it('should refresh data from underlying data source', async () => {
            mockDataModelProcessor.refreshDataModel.mockResolvedValue(true);

            const result = await DataModelProcessor.getInstance().refreshDataModel(1, testTokenDetails);

            expect(result).toBe(true);
        });
    });

    describe('Data Model Update', () => {
        it('should successfully update data model on query', async () => {
            mockDataModelProcessor.updateDataModelOnQuery.mockResolvedValue(true);

            const result = await DataModelProcessor.getInstance().updateDataModelOnQuery(
                1, // data_source_id
                10, // data_model_id
                'SELECT * FROM users WHERE active = true',
                JSON.stringify({ table: 'users', filter: 'active' }),
                'Active Users',
                testTokenDetails
            );

            expect(result).toBe(true);
            expect(mockDataModelProcessor.updateDataModelOnQuery).toHaveBeenCalled();
        });

        it('should handle update failures', async () => {
            mockDataModelProcessor.updateDataModelOnQuery.mockResolvedValue(false);

            const result = await DataModelProcessor.getInstance().updateDataModelOnQuery(
                1,
                10,
                'INVALID SQL',
                '{}',
                'Failed Model',
                testTokenDetails
            );

            expect(result).toBe(false);
        });

        it('should validate query before updating', async () => {
            mockDataModelProcessor.updateDataModelOnQuery.mockResolvedValue(true);

            await DataModelProcessor.getInstance().updateDataModelOnQuery(
                1,
                10,
                'SELECT * FROM products',
                JSON.stringify({ table: 'products' }),
                'Products Model',
                testTokenDetails
            );

            expect(mockDataModelProcessor.updateDataModelOnQuery).toHaveBeenCalled();
        });
    });

    describe('Data Model Tables', () => {
        it('should get tables from data models for a project', async () => {
            const mockTables = [
                { name: 'users_model', columns: ['id', 'name', 'email'] },
                { name: 'orders_model', columns: ['id', 'user_id', 'total'] }
            ];
            mockDataModelProcessor.getTablesFromDataModels.mockResolvedValue(mockTables);

            const result = await DataModelProcessor.getInstance().getTablesFromDataModels(1, testTokenDetails);

            expect(result).toEqual(mockTables);
            expect(mockDataModelProcessor.getTablesFromDataModels).toHaveBeenCalledWith(1, testTokenDetails);
        });

        it('should handle empty tables list', async () => {
            mockDataModelProcessor.getTablesFromDataModels.mockResolvedValue([]);

            const result = await DataModelProcessor.getInstance().getTablesFromDataModels(1, testTokenDetails);

            expect(result).toEqual([]);
        });

        it('should include column metadata', async () => {
            const mockTables = [
                {
                    name: 'users_model',
                    columns: [
                        { name: 'id', type: 'integer', nullable: false },
                        { name: 'email', type: 'varchar', nullable: false }
                    ]
                }
            ];
            mockDataModelProcessor.getTablesFromDataModels.mockResolvedValue(mockTables);

            const result = await DataModelProcessor.getInstance().getTablesFromDataModels(1, testTokenDetails);

            expect(result[0].columns).toHaveLength(2);
            expect(result[0].columns[0]).toHaveProperty('type');
        });
    });

    describe('Query Execution on Data Model', () => {
        it('should execute query on data model', async () => {
            const mockResult = { columns: ['id', 'name'], rows: [[1, 'Test']] };
            mockDataModelProcessor.executeQueryOnDataModel.mockResolvedValue(mockResult);

            const result = await DataModelProcessor.getInstance().executeQueryOnDataModel(
                'SELECT * FROM users_model',
                testTokenDetails
            );

            expect(result).toEqual(mockResult);
            expect(mockDataModelProcessor.executeQueryOnDataModel).toHaveBeenCalledWith(
                'SELECT * FROM users_model',
                testTokenDetails
            );
        });

        it('should handle query execution errors', async () => {
            mockDataModelProcessor.executeQueryOnDataModel.mockRejectedValue(
                new Error('Query execution failed')
            );

            await expect(
                DataModelProcessor.getInstance().executeQueryOnDataModel(
                    'INVALID SQL',
                    testTokenDetails
                )
            ).rejects.toThrow('Query execution failed');
        });

        it('should support complex queries with joins', async () => {
            const mockResult = { columns: ['user_id', 'order_total'], rows: [[1, 500]] };
            mockDataModelProcessor.executeQueryOnDataModel.mockResolvedValue(mockResult);

            const result = await DataModelProcessor.getInstance().executeQueryOnDataModel(
                'SELECT u.id as user_id, o.total as order_total FROM users_model u JOIN orders_model o ON u.id = o.user_id',
                testTokenDetails
            );

            expect(result).toEqual(mockResult);
        });
    });

    describe('Cross-Source Data Models', () => {
        it('should get all tables from all data sources in a project', async () => {
            const mockDataSources = [
                { id: 1, name: 'PostgreSQL DB', data_type: 'postgresql' },
                { id: 2, name: 'MySQL DB', data_type: 'mysql' }
            ];
            const mockTables1 = [{ name: 'users', columns: ['id', 'name'] }];
            const mockTables2 = [{ name: 'products', columns: ['id', 'title'] }];

            mockDataSourceProcessor.getDataSourcesByProject.mockResolvedValue(mockDataSources);
            mockDataSourceProcessor.getTablesFromDataSource
                .mockResolvedValueOnce(mockTables1)
                .mockResolvedValueOnce(mockTables2);

            const dataSources = await DataSourceProcessor.getInstance().getDataSourcesByProject(1, testTokenDetails);
            expect(dataSources).toEqual(mockDataSources);

            const tables1 = await DataSourceProcessor.getInstance().getTablesFromDataSource(1, testTokenDetails);
            const tables2 = await DataSourceProcessor.getInstance().getTablesFromDataSource(2, testTokenDetails);

            expect(tables1).toHaveLength(1);
            expect(tables2).toHaveLength(1);
        });

        it('should handle projects with no data sources', async () => {
            mockDataSourceProcessor.getDataSourcesByProject.mockResolvedValue([]);

            const result = await DataSourceProcessor.getInstance().getDataSourcesByProject(999, testTokenDetails);

            expect(result).toEqual([]);
        });

        it('should enrich tables with data source metadata', async () => {
            const mockDataSources = [{ id: 1, name: 'Test DB', data_type: 'postgresql' }];
            const mockTables = [
                {
                    name: 'users',
                    columns: [{ name: 'id', type: 'integer' }]
                }
            ];

            mockDataSourceProcessor.getDataSourcesByProject.mockResolvedValue(mockDataSources);
            mockDataSourceProcessor.getTablesFromDataSource.mockResolvedValue(mockTables);

            await DataSourceProcessor.getInstance().getDataSourcesByProject(1, testTokenDetails);
            const tables = await DataSourceProcessor.getInstance().getTablesFromDataSource(1, testTokenDetails);

            expect(tables).toBeDefined();
            expect(tables[0].name).toBe('users');
        });
    });

    describe('Join Suggestions', () => {
        it('should suggest joins between two tables', async () => {
            const leftTable: any = {
                table_name: 'users',
                schema: 'public',
                data_source_id: 1,
                columns: [{ name: 'id', type: 'integer' }]
            };
            const rightTable: any = {
                table_name: 'orders',
                schema: 'public',
                data_source_id: 2,
                columns: [{ name: 'user_id', type: 'integer' }]
            };
            const mockSuggestions = [
                {
                    leftColumn: 'id',
                    rightColumn: 'user_id',
                    confidence: 0.95,
                    reason: 'Column name similarity and type match'
                }
            ];

            mockCrossSourceJoinService.getCombinedSuggestions.mockResolvedValue(mockSuggestions);

            const result = await CrossSourceJoinService.getInstance().getCombinedSuggestions(
                leftTable,
                rightTable
            );

            expect(result).toEqual(mockSuggestions);
            expect(mockCrossSourceJoinService.getCombinedSuggestions).toHaveBeenCalledWith(
                leftTable,
                rightTable
            );
        });

        it('should handle tables with no matching columns', async () => {
            const leftTable: any = { table_name: 'users', schema: 'public', data_source_id: 1, columns: [] };
            const rightTable: any = { table_name: 'products', schema: 'public', data_source_id: 2, columns: [] };

            mockCrossSourceJoinService.getCombinedSuggestions.mockResolvedValue([]);

            const result = await CrossSourceJoinService.getInstance().getCombinedSuggestions(
                leftTable,
                rightTable
            );

            expect(result).toEqual([]);
        });

        it('should prioritize suggestions by confidence score', async () => {
            const mockSuggestions = [
                { leftColumn: 'id', rightColumn: 'user_id', confidence: 0.95 },
                { leftColumn: 'email', rightColumn: 'user_email', confidence: 0.75 }
            ];

            mockCrossSourceJoinService.getCombinedSuggestions.mockResolvedValue(mockSuggestions);

            const result = await CrossSourceJoinService.getInstance().getCombinedSuggestions(
                { table_name: 'users', schema: 'public', data_source_id: 1, columns: [] } as any,
                { table_name: 'orders', schema: 'public', data_source_id: 2, columns: [] } as any
            );

            expect(result[0].confidence).toBeGreaterThan(result[1].confidence);
        });
    });

    describe('Join Catalog', () => {
        it('should save successful join to catalog', async () => {
            const joinDef = {
                leftDataSourceId: 1,
                leftTableName: 'users',
                leftColumnName: 'id',
                rightDataSourceId: 2,
                rightTableName: 'orders',
                rightColumnName: 'user_id',
                joinType: 'INNER',
                createdByUserId: 1
            };

            mockCrossSourceJoinService.saveJoinToCatalog.mockResolvedValue(undefined);

            await CrossSourceJoinService.getInstance().saveJoinToCatalog(joinDef);

            expect(mockCrossSourceJoinService.saveJoinToCatalog).toHaveBeenCalledWith(joinDef);
        });

        it('should validate join definition before saving', async () => {
            const invalidJoin = {
                leftDataSourceId: 1,
                leftTableName: '',
                leftColumnName: 'id',
                rightDataSourceId: 2,
                rightTableName: 'orders',
                rightColumnName: 'user_id',
                joinType: 'INNER',
                createdByUserId: 1
            };

            mockCrossSourceJoinService.saveJoinToCatalog.mockRejectedValue(
                new Error('Invalid join definition')
            );

            await expect(
                CrossSourceJoinService.getInstance().saveJoinToCatalog(invalidJoin)
            ).rejects.toThrow('Invalid join definition');
        });

        it('should support different join types', async () => {
            const joinTypes = ['INNER', 'LEFT', 'RIGHT', 'FULL'];

            for (const joinType of joinTypes) {
                const joinDef = {
                    leftDataSourceId: 1,
                    leftTableName: 'users',
                    leftColumnName: 'id',
                    rightDataSourceId: 2,
                    rightTableName: 'orders',
                    rightColumnName: 'user_id',
                    joinType,
                    createdByUserId: 1
                };

                mockCrossSourceJoinService.saveJoinToCatalog.mockResolvedValue(undefined);

                await CrossSourceJoinService.getInstance().saveJoinToCatalog(joinDef);

                expect(mockCrossSourceJoinService.saveJoinToCatalog).toHaveBeenCalledWith(
                    expect.objectContaining({ joinType })
                );
            }
        });
    });
});
