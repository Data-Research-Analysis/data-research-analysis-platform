import { DBDriver } from "../drivers/DBDriver.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { IPDFDataSourceReturn } from "../types/IPDFDataSourceReturn.js";
import { FilesService } from "../services/FilesService.js";
import { TableMetadataService } from "../services/TableMetadataService.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import { DataSourceSQLHelpers } from './helpers/DataSourceSQLHelpers.js';
import { UtilityService } from '../services/UtilityService.js';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';
import { QueueService } from '../services/QueueService.js';

export class PDFDataSourceProcessor {
    private static instance: PDFDataSourceProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
    private constructor() { }

    public static getInstance(): PDFDataSourceProcessor {
        if (!PDFDataSourceProcessor.instance) {
            PDFDataSourceProcessor.instance = new PDFDataSourceProcessor();
        }
        return PDFDataSourceProcessor.instance;
    }

    public async addPDFDataSource(dataSourceName: string, fileId: string, data: string, tokenDetails: ITokenDetails, projectId: number, dataSourceId: number = null, sheetInfo?: any): Promise<IPDFDataSourceReturn> {
        return new Promise<IPDFDataSourceReturn>(async (resolve, reject) => {
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
                    // Create new data source - tables will be saved in the platform's own database but in a dedicated schema
                    const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                    const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                    const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                    const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                    const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                    // The PDF files will be saved as tables in the dra_pdf schema which will be separate from the public schema
                    let query = `CREATE SCHEMA IF NOT EXISTS dra_pdf`;
                    await dbConnector.query(query);
                    const connection: IDBConnectionDetails = {
                        data_source_type: UtilityService.getInstance().getDataSourceType('postgresql'),
                        host: host,
                        port: port,
                        schema: 'dra_pdf',
                        database: database,
                        username: username,
                        password: password,
                    };
                    dataSource.name = `${dataSourceName}_${new Date().getTime()}`;
                    dataSource.connection_details = connection;
                    dataSource.data_type = EDataSourceType.PDF;
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId, project: project, users_platform: user } });
                }

                try {
                    // Parse the data - could be a single sheet or multiple sheets
                    const parsedTableStructure = JSON.parse(data);
                    const sheetName = sheetInfo?.sheet_name || 'Sheet1';
                    const sheetId = sheetInfo?.sheet_id || `sheet_${Date.now()}`;
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

                    console.log(`[PDF Upload] Physical table: ${physicalTableName}, Logical: ${logicalTableName}`);

                    let createTableQuery = `CREATE TABLE dra_pdf.${physicalTableName} `;
                    let columns = '';
                    let insertQueryColumns = '';

                    const sanitizedPdfColumns: Array<{
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
                            // Handle renamed columns for PDF similar to Excel
                            const displayColumnName = column.title || column.column_name || `column_${index}`;
                            const originalColumnName = column.originalTitle || column.original_title || column.column_name || displayColumnName;
                            const columnKey = column.originalKey || column.original_key || column.key || displayColumnName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');

                            // Sanitize the display name for database usage
                            const sanitizedColumnName = DataSourceSQLHelpers.sanitizeColumnName(displayColumnName);

                            sanitizedPdfColumns.push({
                                original: originalColumnName,
                                sanitized: sanitizedColumnName,
                                type: column.type,
                                title: displayColumnName,
                                key: columnKey,
                                originalTitle: originalColumnName,
                                displayTitle: displayColumnName
                            });

                            const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.PDF, column.type);
                            let dataTypeString = '';
                            if (dataType.size) {
                                dataTypeString = `${dataType.type}(${dataType.size})`;
                            } else {
                                dataTypeString = `${dataType.type}`;
                            }
                            if (index < parsedTableStructure.columns.length - 1) {
                                columns += `${sanitizedColumnName} ${dataTypeString}, `;
                            } else {
                                columns += `${sanitizedColumnName} ${dataTypeString} `;
                            }
                            if (index < parsedTableStructure.columns.length - 1) {
                                insertQueryColumns += `${sanitizedColumnName},`;
                            } else {
                                insertQueryColumns += `${sanitizedColumnName}`;
                            }
                        });

                        createTableQuery += `(${columns})`;

                        insertQueryColumns = `(${insertQueryColumns})`;
                        try {
                            // Create the table
                            await dbConnector.query(createTableQuery);
                            // await dbConnector.query(alterTableQuery);
                            console.log('[PDF Upload] Successfully created physical table:', physicalTableName, 'for logical table:', logicalTableName);
                            // Insert data rows
                            if (parsedTableStructure.rows && parsedTableStructure.rows.length > 0) {
                                for (const row of parsedTableStructure.rows) {
                                    let insertQuery = `INSERT INTO dra_pdf.${physicalTableName} `;
                                    let values = '';

                                    sanitizedPdfColumns.forEach((columnInfo, colIndex) => {
                                        // Try multiple ways to get the value for renamed columns (similar to Excel)
                                        let value = undefined;
                                        const originalColumn = parsedTableStructure.columns[colIndex];

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
                                        // Strategy 4: Try nested data structure (fallback)
                                        else if (row.data) {
                                            if (originalColumn?.title && row.data[originalColumn.title] !== undefined) {
                                                value = row.data[originalColumn.title];
                                            } else if (columnInfo.originalTitle && row.data[columnInfo.originalTitle] !== undefined) {
                                                value = row.data[columnInfo.originalTitle];
                                            } else if (originalColumn?.key && row.data[originalColumn.key] !== undefined) {
                                                value = row.data[originalColumn.key];
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
                                            const escapedValue = DataSourceSQLHelpers.escapeStringValue(String(value));
                                            values += `'${escapedValue}'`;
                                        }
                                    });

                                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                                    await dbConnector.query(insertQuery);
                                }
                            }

                            // Log column mapping for renamed columns (PDF)
                            const renamedPdfColumns = sanitizedPdfColumns.filter(col =>
                                col.originalTitle && col.displayTitle && col.originalTitle !== col.displayTitle
                            );
                            if (renamedPdfColumns.length > 0) {
                                renamedPdfColumns.forEach(col => {
                                    console.log(`  "${col.originalTitle}" -> "${col.displayTitle}" (DB: ${col.sanitized})`);
                                });
                            }
                        } catch (error) {
                            console.error('Error creating table:', physicalTableName, error);
                            throw error;
                        }
                        // Track processed sheet
                        sheetsProcessed.push({
                            sheet_id: sheetId,
                            sheet_name: sheetName,
                            table_name: physicalTableName, // Physical hash-based table name
                            sheet_index: sheetIndex
                        });

                        // Store table metadata for physical-to-logical name mapping
                        await tableMetadataService.storeTableMetadata(manager, {
                            dataSourceId: dataSource.id,
                            usersPlatformId: user.id,
                            schemaName: 'dra_pdf',
                            physicalTableName: physicalTableName,
                            logicalTableName: logicalTableName,
                            originalSheetName: sheetName,
                            fileId: fileId,
                            tableType: 'pdf'
                        });
                        console.log('[PDF Upload] Table metadata stored for:', physicalTableName);
                    }
                } catch (error) {
                    console.error('Error processing Excel data source:', error);
                    console.error('Sheet info:', sheetInfo);
                    console.error('Data structure:', data?.substring(0, 500) + '...');
                    return resolve({ status: 'error', file_id: fileId });
                }

                // Add the user to the delete files queue, which will get all of the
                //files uploaded by the user and will be deleted
                await QueueService.getInstance().addFilesDeletionJob(user.id);

                // FilesService.getInstance().deleteFileFromDisk()

                return resolve({
                    status: 'success',
                    file_id: fileId,
                    data_source_id: dataSource.id,
                    sheets_processed: sheetsProcessed.length,
                    sheet_details: sheetsProcessed
                });
            }
            return resolve({ status: 'error', file_id: fileId });
        });
    }

}
