import { DBDriver } from "../drivers/DBDriver.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { IExcelDataSourceReturn } from "../types/IExcelDataSourceReturn.js";
import { FilesService } from "../services/FilesService.js";
import { TableMetadataService } from "../services/TableMetadataService.js";
import { ExcelFileService } from "../services/ExcelFileService.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import { DataSourceSQLHelpers } from './helpers/DataSourceSQLHelpers.js';
import { UtilityService } from '../services/UtilityService.js';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';
import { QueueService } from '../services/QueueService.js';

export class ExcelDataSourceProcessor {
    private static instance: ExcelDataSourceProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
    private constructor() { }

    public static getInstance(): ExcelDataSourceProcessor {
        if (!ExcelDataSourceProcessor.instance) {
            ExcelDataSourceProcessor.instance = new ExcelDataSourceProcessor();
        }
        return ExcelDataSourceProcessor.instance;
    }

    public async addExcelDataSource(dataSourceName: string, fileId: string, data: string, tokenDetails: ITokenDetails, projectId: number, dataSourceId: number = null, sheetInfo?: any, classification?: string | null): Promise<IExcelDataSourceReturn> {
        return new Promise<IExcelDataSourceReturn>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const project: DRAProject | null = await manager.findOne(DRAProject, { where: { id: projectId, users_platform: user } });
            if (project) {
                let dataSource = new DRADataSource();
                const sheetsProcessed = [];
                if (!dataSourceId) {
                    //the tables will be saved in the platform's own database but in a dedicated schema
                    const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                    const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                    const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                    const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                    const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                    //The excel files will be saved as tables in the dra_excel schema which will be separate from the public schema.
                    let query = `CREATE SCHEMA IF NOT EXISTS dra_excel`;
                    await dbConnector.query(query);
                    const connection: IDBConnectionDetails = {
                        data_source_type: UtilityService.getInstance().getDataSourceType('postgresql'),
                        host: host,
                        port: port,
                        schema: 'dra_excel',
                        database: database,
                        username: username,
                        password: password,
                    };
                    dataSource.name = dataSourceName;
                    dataSource.connection_details = connection;
                    dataSource.data_type = EDataSourceType.EXCEL;
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource.classification = classification || null;
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId, project: project, users_platform: user } });
                }

                try {
                    const parsedTableStructure = JSON.parse(data);
                    // Get sheet information
                    const sheetName = sheetInfo?.sheet_name || 'Sheet1';
                    const sheetId = sheetInfo?.sheet_id || `sheet_${Date.now()}`;
                    const originalSheetName = sheetInfo?.original_sheet_name || sheetName;
                    const sheetIndex = sheetInfo?.sheet_index || 0;

                    // CRITICAL: Use hash-based short table name to avoid PostgreSQL 63-char limit
                    // Generate logical name (human-readable, can be any length)
                    const logicalTableName = `${sheetName}`;

                    // Generate short physical name using hash (e.g., ds23_a7b3c9d1)
                    const tableMetadataService = TableMetadataService.getInstance();
                    const physicalTableName = tableMetadataService.generatePhysicalTableName(
                        dataSource.id,
                        logicalTableName,
                        fileId
                    );

                    console.log(`[Excel Upload] Physical table: ${physicalTableName}, Logical: ${logicalTableName}`);

                    let createTableQuery = `CREATE TABLE dra_excel."${physicalTableName}" `;
                    let columns = '';
                    let insertQueryColumns = '';
                    const sanitizedColumns: Array<{
                        original: string,
                        sanitized: string,
                        type: string,
                        title?: string,
                        key?: string,
                        originalTitle?: string,
                        displayTitle?: string
                    }> = [];

                    if (parsedTableStructure.columns && parsedTableStructure.columns.length > 0) {
                        parsedTableStructure.columns.forEach((column: any, index: number) => {
                            // Use renamed title if available, fall back to original names
                            const displayColumnName = column.title || column.column_name || `column_${index}`;
                            const originalColumnName = column.originalTitle || column.original_title || column.column_name || displayColumnName;
                            const columnKey = column.originalKey || column.original_key || column.key || displayColumnName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');

                            // Sanitize the display name for database usage
                            const sanitizedColumnName = DataSourceSQLHelpers.sanitizeColumnName(displayColumnName);

                            sanitizedColumns.push({
                                original: originalColumnName,
                                sanitized: sanitizedColumnName,
                                type: column.type,
                                title: displayColumnName,
                                key: columnKey,
                                originalTitle: originalColumnName,
                                displayTitle: displayColumnName
                            });

                            const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.EXCEL, column.type);
                            let dataTypeString = '';
                            if (dataType.size) {
                                dataTypeString = `${dataType.type}(${dataType.size})`;
                            } else {
                                dataTypeString = `${dataType.type}`;
                            }

                            if (index < parsedTableStructure.columns.length - 1) {
                                columns += `${sanitizedColumnName} ${dataTypeString},`;
                                insertQueryColumns += `${sanitizedColumnName},`;
                            } else {
                                columns += `${sanitizedColumnName} ${dataTypeString}`;
                                insertQueryColumns += `${sanitizedColumnName}`;
                            }
                        });

                        createTableQuery += `(${columns})`;

                        try {
                            // Create the table
                            await dbConnector.query(createTableQuery);
                            console.log('[Excel Upload] Successfully created physical table:', physicalTableName, 'for logical table:', logicalTableName);

                            insertQueryColumns = `(${insertQueryColumns})`;

                            // Insert data rows
                            if (parsedTableStructure.rows && parsedTableStructure.rows.length > 0) {
                                let successfulInserts = 0;
                                let failedInserts = 0;

                                for (let rowIndex = 0; rowIndex < parsedTableStructure.rows.length; rowIndex++) {
                                    const row = parsedTableStructure.rows[rowIndex];
                                    let insertQuery = `INSERT INTO dra_excel."${physicalTableName}" `;
                                    let values = '';

                                    sanitizedColumns.forEach((columnInfo, colIndex) => {
                                        // Try multiple ways to get the value for renamed columns
                                        let value = undefined;
                                        const originalColumn = parsedTableStructure.columns[colIndex];

                                        // Frontend sends flattened row data, so try direct access first
                                        // Strategy 1: Use current column title (handles renamed columns)
                                        if (originalColumn?.title && row[originalColumn.title] !== undefined) {
                                            value = row[originalColumn.title];
                                        }
                                        // Strategy 2: Use original title if column was renamed
                                        else if (columnInfo.originalTitle && row[columnInfo.originalTitle] !== undefined) {
                                            value = row[columnInfo.originalTitle];
                                        }
                                        // Strategy 3: Use column key 
                                        else if (originalColumn?.key && row[originalColumn.key] !== undefined) {
                                            value = row[originalColumn.key];
                                        }
                                        // Strategy 4: Use original key if available
                                        else if (columnInfo.key && row[columnInfo.key] !== undefined) {
                                            value = row[columnInfo.key];
                                        }
                                        // Strategy 5: Use original column name
                                        else if (row[columnInfo.original] !== undefined) {
                                            value = row[columnInfo.original];
                                        }
                                        // Strategy 4: Try nested data structure (fallback)
                                        else if (row.data) {
                                            if (originalColumn?.title && row.data[originalColumn.title] !== undefined) {
                                                value = row.data[originalColumn.title];
                                            } else if (originalColumn?.key && row.data[originalColumn.key] !== undefined) {
                                                value = row.data[originalColumn.key];
                                            } else if (row.data[columnInfo.original] !== undefined) {
                                                value = row.data[columnInfo.original];
                                            }
                                        }
                                        if (colIndex > 0) {
                                            values += ', ';
                                        }

                                        // Handle different data types properly with comprehensive escaping
                                        if (value === null || value === undefined || value === '') {
                                            values += 'NULL';
                                        } else if (columnInfo.type === 'boolean') {
                                            const boolValue = DataSourceSQLHelpers.convertToPostgresBoolean(value);
                                            values += boolValue;
                                        } else if (typeof value === 'string') {
                                            const escapedValue = DataSourceSQLHelpers.escapeStringValue(value);
                                            values += `'${escapedValue}'`;
                                        } else if (typeof value === 'number') {
                                            // Ensure it's a valid number
                                            if (isNaN(value) || !isFinite(value)) {
                                                values += 'NULL';
                                            } else {
                                                values += `${value}`;
                                            }
                                        } else {
                                            // For other types, convert to string and escape
                                            const stringValue = String(value);
                                            const escapedValue = DataSourceSQLHelpers.escapeStringValue(stringValue);
                                            values += `'${escapedValue}'`;
                                        }
                                    });

                                    insertQuery += `${insertQueryColumns} VALUES(${values})`;
                                    try {
                                        const result = await dbConnector.query(insertQuery);
                                        successfulInserts++;
                                    } catch (error) {
                                        failedInserts++;
                                        console.error(`ERROR inserting row ${rowIndex + 1}:`, error);
                                        console.error('Failed query:', insertQuery);
                                        console.error('Row data:', JSON.stringify(row, null, 2));
                                        console.error('Column mappings:', sanitizedColumns);
                                        throw error;
                                    }
                                }

                                // Verify data was actually inserted by counting rows in the table
                                try {
                                    const countQuery = `SELECT COUNT(*) as row_count FROM dra_excel."${physicalTableName}"`;
                                    const countResult = await dbConnector.query(countQuery);
                                    const actualRowCount = countResult[0]?.row_count || 0;

                                    if (actualRowCount === 0 && parsedTableStructure.rows.length > 0) {
                                        console.error('WARNING: No rows found in database despite successful insertions!');
                                    } else if (actualRowCount !== parsedTableStructure.rows.length) {
                                        console.warn(`Row count mismatch: Expected ${parsedTableStructure.rows.length}, found ${actualRowCount}`);
                                    }
                                } catch (error) {
                                    console.error('Error verifying row count:', error);
                                }
                                console.log(`Successfully inserted all ${parsedTableStructure.rows.length} rows`);
                            } else {
                                console.log('No rows to insert - parsedTableStructure.rows is empty or undefined');
                            }
                            // Log column mapping for renamed columns
                            const renamedColumns = sanitizedColumns.filter(col =>
                                col.originalTitle && col.displayTitle && col.originalTitle !== col.displayTitle
                            );
                            // Track processed sheet
                            sheetsProcessed.push({
                                sheet_id: sheetId,
                                sheet_name: sheetName,
                                table_name: physicalTableName, // Physical hash-based table name
                                original_sheet_name: originalSheetName,
                                sheet_index: sheetIndex
                            });
                            console.log(`[Excel Upload] Successfully processed sheet: ${sheetName} -> physical table: ${physicalTableName}`);

                            // Store table metadata for physical-to-logical name mapping
                            await tableMetadataService.storeTableMetadata(manager, {
                                dataSourceId: dataSource.id,
                                usersPlatformId: user.id,
                                schemaName: 'dra_excel',
                                physicalTableName: physicalTableName,
                                logicalTableName: logicalTableName,
                                originalSheetName: originalSheetName,
                                fileId: fileId,
                                tableType: 'excel'
                            });
                            console.log('[Excel Upload] Table metadata stored for:', physicalTableName);
                        } catch (error) {
                            console.error('Error creating table:', error);
                            console.error('Failed query:', createTableQuery);
                            throw error;
                        }
                    }

                    console.log('Excel data source processing completed successfully');
                    return resolve({
                        status: 'success',
                        file_id: fileId,
                        data_source_id: dataSource.id,
                        sheets_processed: sheetsProcessed
                    });

                } catch (error) {
                    console.error('Error processing Excel data source:', error);
                    console.error('Sheet info:', sheetInfo);
                    console.error('Data structure:', data?.substring(0, 500) + '...');
                    return resolve({ status: 'error', file_id: fileId });
                }
            }
            return resolve({ status: 'error', file_id: fileId });
        });
    }

    /**
     * Add Excel data source from uploaded file (server-side processing)
     * This method handles large Excel files by processing them server-side,
     * avoiding the "request entity too large" error from JSON payloads
     * @param dataSourceName - Name for the data source
     * @param fileId - Unique file identifier
     * @param filePath - Path to the uploaded Excel file
     * @param tokenDetails - User authentication details
     * @param projectId - Project ID
     * @param dataSourceId - Existing data source ID (optional, for multi-sheet updates)
     * @returns Promise with upload result
     */
    public async addExcelDataSourceFromFile(
        dataSourceName: string,
        fileId: string,
        filePath: string,
        tokenDetails: ITokenDetails,
        projectId: number,
        dataSourceId: number = null
    ): Promise<IExcelDataSourceReturn & { error?: string }> {
        return new Promise(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ status: 'error', file_id: fileId, error: 'Database driver not available' });
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve({ status: 'error', file_id: fileId, error: 'Database connector not available' });
            }
            const manager = dbConnector.manager;
            if (!manager) {
                return resolve({ status: 'error', file_id: fileId, error: 'Database manager not available' });
            }

            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve({ status: 'error', file_id: fileId, error: 'User not found' });
            }

            const project: DRAProject | null = await manager.findOne(DRAProject, { 
                where: { id: projectId, users_platform: user } 
            });
            if (!project) {
                return resolve({ status: 'error', file_id: fileId, error: 'Project not found' });
            }

            try {
                // Parse the Excel file server-side
                console.log('[Excel File Upload] Parsing file:', filePath);
                const parseResult = await ExcelFileService.getInstance().parseExcelFileFromPath(filePath);
                
                if (!parseResult.sheets || parseResult.sheets.length === 0) {
                    return resolve({ 
                        status: 'error', 
                        file_id: fileId, 
                        error: 'No valid sheets found in Excel file' 
                    });
                }

                let dataSource: DRADataSource;
                const sheetsProcessed = [];

                if (!dataSourceId) {
                    // Create new data source
                    dataSource = new DRADataSource();
                    const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                    const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                    const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                    const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                    const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                    // Create dra_excel schema if it doesn't exist
                    let query = `CREATE SCHEMA IF NOT EXISTS dra_excel`;
                    await dbConnector.query(query);

                    const connection: IDBConnectionDetails = {
                        data_source_type: UtilityService.getInstance().getDataSourceType('postgresql'),
                        host: host,
                        port: port,
                        schema: 'dra_excel',
                        database: database,
                        username: username,
                        password: password,
                    };

                    dataSource.name = dataSourceName;
                    dataSource.connection_details = connection;
                    dataSource.data_type = EDataSourceType.EXCEL;
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { 
                        where: { id: dataSourceId, project: project, users_platform: user } 
                    });
                    if (!dataSource) {
                        return resolve({ 
                            status: 'error', 
                            file_id: fileId, 
                            error: 'Data source not found' 
                        });
                    }
                }

                const tableMetadataService = TableMetadataService.getInstance();

                // Process each sheet
                for (const sheet of parseResult.sheets) {
                    console.log(`[Excel File Upload] Processing sheet: ${sheet.name}`);

                    // Generate physical and logical table names
                    const logicalTableName = sheet.name;
                    const physicalTableName = tableMetadataService.generatePhysicalTableName(
                        dataSource.id,
                        logicalTableName,
                        fileId
                    );

                    console.log(`[Excel File Upload] Physical: ${physicalTableName}, Logical: ${logicalTableName}`);

                    // Build CREATE TABLE query
                    let createTableQuery = `CREATE TABLE dra_excel."${physicalTableName}" `;
                    let columns = '';
                    let insertQueryColumns = '';
                    const sanitizedColumns: Array<{
                        original: string;
                        sanitized: string;
                        type: string;
                        title: string;
                        key: string;
                    }> = [];

                    sheet.columns.forEach((column, index) => {
                        const displayColumnName = column.title || `column_${index}`;
                        const sanitizedColumnName = DataSourceSQLHelpers.sanitizeColumnName(displayColumnName);

                        sanitizedColumns.push({
                            original: column.title,
                            sanitized: sanitizedColumnName,
                            type: column.type,
                            title: displayColumnName,
                            key: column.key
                        });

                        const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(
                            EDataSourceType.EXCEL, 
                            column.type
                        );
                        let dataTypeString = dataType.size 
                            ? `${dataType.type}(${dataType.size})` 
                            : `${dataType.type}`;

                        if (index < sheet.columns.length - 1) {
                            columns += `${sanitizedColumnName} ${dataTypeString},`;
                            insertQueryColumns += `${sanitizedColumnName},`;
                        } else {
                            columns += `${sanitizedColumnName} ${dataTypeString}`;
                            insertQueryColumns += `${sanitizedColumnName}`;
                        }
                    });

                    createTableQuery += `(${columns})`;

                    try {
                        // Create the table
                        await dbConnector.query(createTableQuery);
                        console.log('[Excel File Upload] Created table:', physicalTableName);

                        insertQueryColumns = `(${insertQueryColumns})`;

                        // Insert data rows in batches for better performance
                        if (sheet.rows && sheet.rows.length > 0) {
                            const batchSize = 1000;
                            let successfulInserts = 0;

                            for (let batchStart = 0; batchStart < sheet.rows.length; batchStart += batchSize) {
                                const batchEnd = Math.min(batchStart + batchSize, sheet.rows.length);
                                const batch = sheet.rows.slice(batchStart, batchEnd);

                                for (const row of batch) {
                                    let insertQuery = `INSERT INTO dra_excel."${physicalTableName}" `;
                                    let values = '';

                                    sanitizedColumns.forEach((columnInfo, colIndex) => {
                                        let value = row[columnInfo.original];

                                        if (colIndex > 0) {
                                            values += ', ';
                                        }

                                        // Handle different data types
                                        if (value === null || value === undefined || value === '') {
                                            values += 'NULL';
                                        } else if (typeof value === 'boolean') {
                                            values += value ? 'TRUE' : 'FALSE';
                                        } else if (typeof value === 'number') {
                                            values += value;
                                        } else if (value instanceof Date) {
                                            values += `'${value.toISOString()}'`;
                                        } else {
                                            // Escape string values
                                            const stringValue = String(value).replace(/'/g, "''");
                                            values += `'${stringValue}'`;
                                        }
                                    });

                                    insertQuery += `${insertQueryColumns} VALUES(${values})`;

                                    try {
                                        await dbConnector.query(insertQuery);
                                        successfulInserts++;
                                    } catch (error) {
                                        console.error(`Error inserting row:`, error.message);
                                        throw error;
                                    }
                                }

                                console.log(`[Excel File Upload] Inserted batch ${batchStart}-${batchEnd} (${successfulInserts}/${sheet.rows.length})`);
                            }

                            console.log(`[Excel File Upload] Successfully inserted ${successfulInserts} rows`);
                        }

                        // Store table metadata
                        await tableMetadataService.storeTableMetadata(manager, {
                            dataSourceId: dataSource.id,
                            usersPlatformId: user.id,
                            schemaName: 'dra_excel',
                            physicalTableName: physicalTableName,
                            logicalTableName: logicalTableName,
                            originalSheetName: sheet.metadata.originalSheetName,
                            fileId: fileId,
                            tableType: 'excel'
                        });

                        sheetsProcessed.push({
                            sheet_id: `sheet_${sheet.index}`,
                            sheet_name: sheet.name,
                            table_name: physicalTableName,
                            original_sheet_name: sheet.metadata.originalSheetName,
                            sheet_index: sheet.index
                        });

                        console.log(`[Excel File Upload] Sheet processed: ${sheet.name}`);

                    } catch (error) {
                        console.error('Error creating/populating table:', error);
                        throw error;
                    }
                }

                // Clean up: add to deletion queue
                await QueueService.getInstance().addFilesDeletionJob(user.id);

                console.log('[Excel File Upload] Processing completed successfully');
                return resolve({
                    status: 'success',
                    file_id: fileId,
                    data_source_id: dataSource.id,
                    sheets_processed: sheetsProcessed
                });

            } catch (error) {
                console.error('Error processing Excel file:', error);
                return resolve({ 
                    status: 'error', 
                    file_id: fileId, 
                    error: error.message 
                });
            }
        });
    }

}
