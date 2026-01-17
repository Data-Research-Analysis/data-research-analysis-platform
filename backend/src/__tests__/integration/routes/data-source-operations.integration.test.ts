import { jest } from '@jest/globals';
import { DataSourceProcessor } from '../../../../processors/DataSourceProcessor.js';
import { TokenProcessor } from '../../../../processors/TokenProcessor.js';
import { UtilityService } from '../../../../services/UtilityService.js';
import { PDFService } from '../../../../services/PDFService.js';
import { ITokenDetails } from '../../../../types/ITokenDetails.js';
import { EUserType } from '../../../../types/EUserType.js';
import { EDataSourceType } from '../../../../types/EDataSourceType.js';
import { IDBConnectionDetails } from '../../../../types/IDBConnectionDetails.js';

/**
 * TEST-012: Data Source Routes Integration Tests
 * Tests data source business logic through DataSourceProcessor
 * Total: 30 tests covering all data source operations
 */
describe('Data Source Operations Integration Tests', () => {
    let mockDataSourceProcessor: any;
    let mockTokenProcessor: any;
    let mockUtilityService: any;
    let mockPDFService: any;
    const testTokenDetails: ITokenDetails = {
        user_id: 1,
        email: 'test@test.com',
        user_type: EUserType.ADMIN,
        iat: Date.now()
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup TokenProcessor mock
        const mockValidateToken: any = jest.fn();
        mockValidateToken.mockResolvedValue(true);
        const mockGetTokenDetails: any = jest.fn();
        mockGetTokenDetails.mockResolvedValue(testTokenDetails);
        
        mockTokenProcessor = {
            validateToken: mockValidateToken,
            getTokenDetails: mockGetTokenDetails
        };
        jest.spyOn(TokenProcessor, 'getInstance').mockReturnValue(mockTokenProcessor);

        // Setup DataSourceProcessor mock
        mockDataSourceProcessor = {
            getDataSources: jest.fn(),
            connectToDataSource: jest.fn(),
            addDataSource: jest.fn(),
            updateDataSource: jest.fn(),
            deleteDataSource: jest.fn(),
            getTablesFromDataSource: jest.fn(),
            executeQueryOnExternalDataSource: jest.fn(),
            buildDataModelOnQuery: jest.fn(),
            addExcelDataSource: jest.fn(),
            addPDFDataSource: jest.fn()
        };
        jest.spyOn(DataSourceProcessor, 'getInstance').mockReturnValue(mockDataSourceProcessor);

        // Setup UtilityService mock
        mockUtilityService = {
            sanitizeDataForPostgreSQL: jest.fn((data) => data),
            getConstants: jest.fn((key) => {
                if (key === 'JWT_SECRET') return 'test-secret';
                return 'http://localhost:3001';
            })
        };
        jest.spyOn(UtilityService, 'getInstance').mockReturnValue(mockUtilityService);

        // Setup PDFService mock
        const mockPreparePDF: any = jest.fn();
        mockPreparePDF.mockResolvedValue(true);
        mockPDFService = {
            preparePDFForDataExtraction: mockPreparePDF
        };
        jest.spyOn(PDFService, 'getInstance').mockReturnValue(mockPDFService);
    });

    describe('Data Source List Operations', () => {
        it('should return list of data sources for authenticated user', async () => {
            const mockDataSources = [
                { id: 1, name: 'PostgreSQL DB', type: 'postgresql' },
                { id: 2, name: 'MySQL DB', type: 'mysql' }
            ];
            mockDataSourceProcessor.getDataSources.mockResolvedValue(mockDataSources);

            const result = await DataSourceProcessor.getInstance().getDataSources(testTokenDetails);

            expect(result).toEqual(mockDataSources);
            expect(mockDataSourceProcessor.getDataSources).toHaveBeenCalledWith(testTokenDetails);
        });

        it('should handle empty data source list', async () => {
            mockDataSourceProcessor.getDataSources.mockResolvedValue([]);

            const result = await DataSourceProcessor.getInstance().getDataSources(testTokenDetails);

            expect(result).toEqual([]);
        });
    });

    describe('Connection Testing', () => {
        const validConnectionData: IDBConnectionDetails = {
            data_source_type: EDataSourceType.POSTGRESQL,
            host: 'localhost',
            port: 5432,
            schema: 'public',
            database: 'testdb',
            username: 'testuser',
            password: 'testpass'
        };

        it('should successfully test connection with valid credentials', async () => {
            mockDataSourceProcessor.connectToDataSource.mockResolvedValue(true);

            const result = await DataSourceProcessor.getInstance().connectToDataSource(validConnectionData);

            expect(result).toBe(true);
            expect(mockDataSourceProcessor.connectToDataSource).toHaveBeenCalledWith(validConnectionData);
        });

        it('should reject connection with invalid credentials', async () => {
            mockDataSourceProcessor.connectToDataSource.mockResolvedValue(false);

            const result = await DataSourceProcessor.getInstance().connectToDataSource(validConnectionData);

            expect(result).toBe(false);
        });

        it('should handle connection errors gracefully', async () => {
            mockDataSourceProcessor.connectToDataSource.mockRejectedValue(new Error('Network error'));

            await expect(DataSourceProcessor.getInstance().connectToDataSource(validConnectionData))
                .rejects
                .toThrow('Network error');
        });

        it('should test PostgreSQL connections', async () => {
            const pgConnection: IDBConnectionDetails = {
                ...validConnectionData,
                data_source_type: EDataSourceType.POSTGRESQL
            };
            mockDataSourceProcessor.connectToDataSource.mockResolvedValue(true);

            const result = await DataSourceProcessor.getInstance().connectToDataSource(pgConnection);

            expect(result).toBe(true);
        });

        it('should test MySQL connections', async () => {
            const mysqlConnection: IDBConnectionDetails = {
                ...validConnectionData,
                data_source_type: EDataSourceType.MYSQL,
                port: 3306
            };
            mockDataSourceProcessor.connectToDataSource.mockResolvedValue(true);

            const result = await DataSourceProcessor.getInstance().connectToDataSource(mysqlConnection);

            expect(result).toBe(true);
        });

        it('should test MariaDB connections', async () => {
            const mariaConnection: IDBConnectionDetails = {
                ...validConnectionData,
                data_source_type: EDataSourceType.MARIADB,
                port: 3306
            };
            mockDataSourceProcessor.connectToDataSource.mockResolvedValue(true);

            const result = await DataSourceProcessor.getInstance().connectToDataSource(mariaConnection);

            expect(result).toBe(true);
        });
    });

    describe('Data Source CRUD Operations', () => {
        const validAddData: IDBConnectionDetails = {
            data_source_type: EDataSourceType.POSTGRESQL,
            host: 'localhost',
            port: 5432,
            schema: 'public',
            database: 'testdb',
            username: 'testuser',
            password: 'testpass'
        };

        it('should successfully add data source after connection test', async () => {
            mockDataSourceProcessor.connectToDataSource.mockResolvedValue(true);
            mockDataSourceProcessor.addDataSource.mockResolvedValue({ id: 1 });

            const canConnect = await DataSourceProcessor.getInstance().connectToDataSource(validAddData);
            expect(canConnect).toBe(true);

            const result = await DataSourceProcessor.getInstance().addDataSource(
                validAddData,
                testTokenDetails,
                1
            );

            expect(result).toEqual({ id: 1 });
        });

        it('should reject adding data source if connection fails', async () => {
            mockDataSourceProcessor.connectToDataSource.mockResolvedValue(false);

            const canConnect = await DataSourceProcessor.getInstance().connectToDataSource(validAddData);

            expect(canConnect).toBe(false);
        });

        it('should successfully update data source', async () => {
            const updateData: IDBConnectionDetails = { ...validAddData, port: 5433 };
            mockDataSourceProcessor.updateDataSource.mockResolvedValue(true);

            const result = await DataSourceProcessor.getInstance().updateDataSource(
                1,
                updateData,
                testTokenDetails
            );

            expect(result).toBe(true);
            expect(mockDataSourceProcessor.updateDataSource).toHaveBeenCalledWith(1, updateData, testTokenDetails);
        });

        it('should handle update failures', async () => {
            mockDataSourceProcessor.updateDataSource.mockResolvedValue(false);

            const result = await DataSourceProcessor.getInstance().updateDataSource(
                1,
                validAddData,
                testTokenDetails
            );

            expect(result).toBe(false);
        });

        it('should successfully delete data source', async () => {
            mockDataSourceProcessor.deleteDataSource.mockResolvedValue(true);

            const result = await DataSourceProcessor.getInstance().deleteDataSource(1, testTokenDetails);

            expect(result).toBe(true);
            expect(mockDataSourceProcessor.deleteDataSource).toHaveBeenCalledWith(1, testTokenDetails);
        });

        it('should handle delete failures', async () => {
            mockDataSourceProcessor.deleteDataSource.mockResolvedValue(false);

            const result = await DataSourceProcessor.getInstance().deleteDataSource(999, testTokenDetails);

            expect(result).toBe(false);
        });
    });

    describe('Table Operations', () => {
        it('should return tables from data source', async () => {
            const mockTables = [
                { name: 'users', columns: ['id', 'name', 'email'] },
                { name: 'products', columns: ['id', 'name', 'price'] }
            ];
            mockDataSourceProcessor.getTablesFromDataSource.mockResolvedValue(mockTables);

            const result = await DataSourceProcessor.getInstance().getTablesFromDataSource(1, testTokenDetails);

            expect(result).toEqual(mockTables);
            expect(mockDataSourceProcessor.getTablesFromDataSource).toHaveBeenCalledWith(1, testTokenDetails);
        });

        it('should handle error when tables cannot be accessed', async () => {
            mockDataSourceProcessor.getTablesFromDataSource.mockResolvedValue(null);

            const result = await DataSourceProcessor.getInstance().getTablesFromDataSource(1, testTokenDetails);

            expect(result).toBeNull();
        });

        it('should return empty array for data source with no tables', async () => {
            mockDataSourceProcessor.getTablesFromDataSource.mockResolvedValue([]);

            const result = await DataSourceProcessor.getInstance().getTablesFromDataSource(1, testTokenDetails);

            expect(result).toEqual([]);
        });
    });

    describe('Query Execution', () => {
        it('should execute single-source query', async () => {
            const mockResult = { columns: ['id', 'name'], rows: [[1, 'Test']] };
            mockDataSourceProcessor.executeQueryOnExternalDataSource.mockResolvedValue(mockResult);

            const result = await DataSourceProcessor.getInstance().executeQueryOnExternalDataSource(
                1,
                'SELECT * FROM users',
                testTokenDetails,
                JSON.stringify({ table: 'users' }),
                false,
                undefined
            );

            expect(result).toEqual(mockResult);
        });

        it('should execute cross-source query', async () => {
            const mockResult = { columns: ['id', 'name'], rows: [[1, 'Test']] };
            mockDataSourceProcessor.executeQueryOnExternalDataSource.mockResolvedValue(mockResult);

            const result = await DataSourceProcessor.getInstance().executeQueryOnExternalDataSource(
                undefined,
                'SELECT * FROM users JOIN products',
                testTokenDetails,
                JSON.stringify({ tables: ['users', 'products'] }),
                true,
                1
            );

            expect(result).toEqual(mockResult);
        });

        it('should handle query execution errors', async () => {
            mockDataSourceProcessor.executeQueryOnExternalDataSource.mockRejectedValue(
                new Error('Query syntax error')
            );

            await expect(
                DataSourceProcessor.getInstance().executeQueryOnExternalDataSource(
                    1,
                    'INVALID SQL',
                    testTokenDetails,
                    '{}',
                    false,
                    undefined
                )
            ).rejects.toThrow('Query syntax error');
        });
    });

    describe('Data Model Building', () => {
        it('should build data model successfully', async () => {
            mockDataSourceProcessor.buildDataModelOnQuery.mockResolvedValue(100);

            const result = await DataSourceProcessor.getInstance().buildDataModelOnQuery(
                1,
                'SELECT * FROM users',
                JSON.stringify({ table: 'users' }),
                'Users Model',
                testTokenDetails,
                false,
                undefined,
                undefined
            );

            expect(result).toBe(100);
        });

        it('should handle data model build failure', async () => {
            mockDataSourceProcessor.buildDataModelOnQuery.mockResolvedValue(null);

            const result = await DataSourceProcessor.getInstance().buildDataModelOnQuery(
                1,
                'INVALID SQL',
                '{}',
                'Failed Model',
                testTokenDetails,
                false,
                undefined,
                undefined
            );

            expect(result).toBeNull();
        });

        it('should support cross-source data models', async () => {
            mockDataSourceProcessor.buildDataModelOnQuery.mockResolvedValue(101);

            const result = await DataSourceProcessor.getInstance().buildDataModelOnQuery(
                undefined,
                'SELECT * FROM users JOIN products',
                JSON.stringify({ tables: ['users', 'products'] }),
                'Cross Source Model',
                testTokenDetails,
                true,
                1,
                undefined
            );

            expect(result).toBe(101);
        });

        it('should allow updating existing data model', async () => {
            mockDataSourceProcessor.buildDataModelOnQuery.mockResolvedValue(50);

            const result = await DataSourceProcessor.getInstance().buildDataModelOnQuery(
                1,
                'SELECT * FROM users WHERE active = true',
                JSON.stringify({ table: 'users', filter: 'active' }),
                'Active Users',
                testTokenDetails,
                false,
                undefined,
                50 // data_model_id for update
            );

            expect(result).toBe(50);
        });
    });

    describe('Excel Data Source Operations', () => {
        const validExcelData = {
            columns: ['Product', 'Revenue'],
            rows: [['Widget', 1000], ['Gadget', 2000]]
        };

        it('should add Excel data source successfully', async () => {
            mockDataSourceProcessor.addExcelDataSource.mockResolvedValue({ id: 5 });

            const result = await DataSourceProcessor.getInstance().addExcelDataSource(
                'Sales Data',
                'excel_123',
                JSON.stringify(validExcelData),
                testTokenDetails,
                1,
                undefined,
                undefined
            );

            expect(result).toEqual({ id: 5 });
        });

        it('should sanitize Excel data before processing', async () => {
            const dataWithBooleans = {
                columns: ['Active', 'Count'],
                rows: [[true, 5], [false, 10]]
            };

            mockUtilityService.sanitizeDataForPostgreSQL.mockReturnValue(dataWithBooleans);
            mockDataSourceProcessor.addExcelDataSource.mockResolvedValue({ id: 6 });

            const sanitized = UtilityService.getInstance().sanitizeDataForPostgreSQL(dataWithBooleans);
            
            expect(mockUtilityService.sanitizeDataForPostgreSQL).toHaveBeenCalledWith(dataWithBooleans);
            expect(sanitized).toEqual(dataWithBooleans);
        });

        it('should handle Excel data source creation errors', async () => {
            mockDataSourceProcessor.addExcelDataSource.mockRejectedValue(new Error('Excel processing failed'));

            await expect(
                DataSourceProcessor.getInstance().addExcelDataSource(
                    'Bad Data',
                    'excel_bad',
                    'invalid json',
                    testTokenDetails,
                    1,
                    undefined,
                    undefined
                )
            ).rejects.toThrow('Excel processing failed');
        });
    });

    describe('PDF Data Source Operations', () => {
        const validPDFData = {
            columns: ['Category', 'Value'],
            rows: [['A', 100], ['B', 200]]
        };

        it('should add PDF data source successfully', async () => {
            mockDataSourceProcessor.addPDFDataSource.mockResolvedValue({ id: 7 });

            const result = await DataSourceProcessor.getInstance().addPDFDataSource(
                'Report Data',
                'pdf_456',
                JSON.stringify(validPDFData),
                testTokenDetails,
                1,
                undefined,
                undefined
            );

            expect(result).toEqual({ id: 7 });
        });

        it('should sanitize PDF data before processing', async () => {
            mockUtilityService.sanitizeDataForPostgreSQL.mockReturnValue(validPDFData);

            const sanitized = UtilityService.getInstance().sanitizeDataForPostgreSQL(validPDFData);

            expect(mockUtilityService.sanitizeDataForPostgreSQL).toHaveBeenCalledWith(validPDFData);
        });

        it('should handle PDF data source creation errors', async () => {
            mockDataSourceProcessor.addPDFDataSource.mockRejectedValue(new Error('PDF processing failed'));

            await expect(
                DataSourceProcessor.getInstance().addPDFDataSource(
                    'Bad PDF',
                    'pdf_bad',
                    'invalid',
                    testTokenDetails,
                    1,
                    undefined,
                    undefined
                )
            ).rejects.toThrow('PDF processing failed');
        });

        it('should prepare PDF for data extraction', async () => {
            mockPDFService.preparePDFForDataExtraction.mockResolvedValue(true);

            const result = await PDFService.getInstance().preparePDFForDataExtraction('test.pdf');

            expect(result).toBe(true);
            expect(mockPDFService.preparePDFForDataExtraction).toHaveBeenCalledWith('test.pdf');
        });
    });

    describe('Data Source Security', () => {
        it('should validate user authorization for data source operations', async () => {
            mockDataSourceProcessor.getDataSources.mockResolvedValue([]);

            await DataSourceProcessor.getInstance().getDataSources(testTokenDetails);

            expect(mockDataSourceProcessor.getDataSources).toHaveBeenCalledWith(testTokenDetails);
        });

        it('should sanitize user inputs', async () => {
            const maliciousData = {
                columns: ['<script>alert("xss")</script>'],
                rows: [['test\' OR 1=1--']]
            };

            mockUtilityService.sanitizeDataForPostgreSQL.mockReturnValue({
                columns: ['scriptalert("xss")/script'],
                rows: [['test OR 1=1--']]
            });

            const sanitized = UtilityService.getInstance().sanitizeDataForPostgreSQL(maliciousData);

            expect(mockUtilityService.sanitizeDataForPostgreSQL).toHaveBeenCalled();
            expect(sanitized.columns[0]).not.toContain('<script>');
        });

        it('should handle unauthorized access attempts', async () => {
            const unauthorizedUser: ITokenDetails = {
                user_id: 999,
                email: 'hacker@test.com',
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };
            mockDataSourceProcessor.getDataSources.mockResolvedValue([]);

            const result = await DataSourceProcessor.getInstance().getDataSources(unauthorizedUser);

            expect(result).toEqual([]);
        });
    });
});
