import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DataSource } from "typeorm";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";
import { IDataSourceReturn } from "../types/IDataSourceReturn.js";
import { IPDFDataSourceReturn } from "../types/IPDFDataSourceReturn.js";
import { IExcelDataSourceReturn } from "../types/IExcelDataSourceReturn.js";
import { FilesService } from "../services/FilesService.js";
import { QueueService } from "../services/QueueService.js";
export class DataSourceProcessor {
    private static instance: DataSourceProcessor;
    private constructor() {}

    public static getInstance(): DataSourceProcessor {
        if (!DataSourceProcessor.instance) {
            DataSourceProcessor.instance = new DataSourceProcessor();
        }
        return DataSourceProcessor.instance;
    }

    async getDataSources(tokenDetails: ITokenDetails): Promise<DRADataSource[]> {
        return new Promise<DRADataSource[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve([]);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve([]);
            }
            const dataSources = await manager.find(DRADataSource, {where: {users_platform: user}, relations: ['project']});
            return resolve(dataSources);
        });
    }

    public async connectToDataSource(connection: IDBConnectionDetails): Promise<DataSource> {
        return new Promise<DataSource>(async (resolve, reject) => {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(null);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
            if (!externalDriver) {
                return resolve(null);
            }
            let dbConnector: DataSource;
            try {
                dbConnector =  await externalDriver.connectExternalDB(connection);
                if (!dbConnector) {
                    return resolve(null);
                }
                return resolve(dbConnector);
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return resolve(null);
            }
        });
    }

    public async addDataSource(connection: IDBConnectionDetails, tokenDetails: ITokenDetails, projectId: number): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const project:DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}});
            if (project) {
                const dataSource = new DRADataSource();
                dataSource.name = connection.database;
                dataSource.connection_details = connection;
                dataSource.data_type = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                dataSource.project = project;
                dataSource.users_platform = user;
                await manager.save(dataSource);
                return resolve(true);
            }
            return resolve(false);
        });
    }

    public async deleteDataSource(dataSourceId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}});
            if (!dataSource) {
                return resolve(false);
            }
            if (dataSource.connection_details.schema === 'dra_excel') {
                //delete the tables that were created for the excel data source
                const dbConnector = await driver.getConcreteDriver();
                if (!dbConnector) {
                    return resolve(false);
                }
                //get the list of tables in the dra_excel schema that were created for this data source
                let query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_excel' AND table_name LIKE '%_data_source_${dataSource.id}_%'`;
                const tables = await dbConnector.query(query);
                for (let i = 0; i < tables.length; i++) {
                    const tableName = tables[i].table_name;
                    query = `DROP TABLE IF EXISTS dra_excel.${tableName}`;
                    await dbConnector.query(query);
                }
            } else if (dataSource.connection_details.schema === 'dra_pdf') {
                //delete the tables that were created for the PDF data source
                const dbConnector = await driver.getConcreteDriver();
                if (!dbConnector) {
                    return resolve(false);
                }
                //get the list of tables in the dra_pdf schema that were created for this data source
                let query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_pdf' AND table_name LIKE '%_data_source_${dataSource.id}%'`;
                const tables = await dbConnector.query(query);
                for (let i = 0; i < tables.length; i++) {
                    const tableName = tables[i].table_name;
                    query = `DROP TABLE IF EXISTS dra_pdf.${tableName}`;
                    await dbConnector.query(query);
                }
            }
            //TODO: delete all of the dashboards contained in all of the related data models
            const dataModel = await manager.findOne(DRADataModel, {where: {data_source: dataSource, users_platform: user}});
            if (dataModel) {
                await manager.remove(dataModel);
            }
            await manager.remove(dataSource);
            return resolve(true);
        });
    }

    public async deleteDataSourcesForProject(projectId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const project = await manager.findOne(DRAProject, {where: {id: projectId}});
            if (!project) {
                return resolve(false);
            }
            const dataSource = await manager.find(DRADataSource, {where: {project: project, users_platform: user}});
            if (!dataSource) {
                return resolve(false);
            }
            const dataModels = await manager.find(DRADataModel, {where: {data_source: dataSource}});
            if (!dataModels) {
                return resolve(false);
            }
            manager.remove(dataModels);
            manager.remove(dataSource);
            return resolve(true);
        });
    }

    public async getTablesFromDataSource(dataSourceId: number, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(null);
            }
            const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}});
            if (!dataSource) {
                return resolve(null);
            }

            if (dataSource.data_type === EDataSourceType.MONGODB) {
                //TODO: Leaving here for when MongoDB data source is implemented
            } else if (dataSource.data_type === EDataSourceType.POSTGRESQL || dataSource.data_type === EDataSourceType.MYSQL || dataSource.data_type === EDataSourceType.MARIADB || dataSource.data_type === EDataSourceType.EXCEL || dataSource.data_type === EDataSourceType.PDF) {
                const connection: IDBConnectionDetails = dataSource.connection_details;
                const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                if (!dataSourceType) {
                    return resolve(null);
                }
                const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
                if (!externalDriver) {
                    return resolve(null);
                }
                let dbConnector: DataSource;
                try {
                    dbConnector =  await externalDriver.connectExternalDB(connection);
                    if (!dbConnector) {
                        return resolve(false);
                    }
                } catch (error) {
                    console.log('Error connecting to external DB', error);
                    return resolve(false);
                }
                let query = await externalDriver.getTablesColumnDetails(connection.schema);
                let tablesSchema = await dbConnector.query(query);
                let tables = tablesSchema.map((table: any) => {
                    return {
                        table_name: table?.table_name || table?.TABLE_NAME,
                        schema: table.table_schema || table?.TABLE_SCHEMA,
                        columns: [],
                        references: [],
                    }
                });
                tables = _.uniqBy(tables, 'table_name');
                tables.forEach((table: any) => {
                    tablesSchema.forEach((result: any) => {
                        if (table?.table_name === result?.table_name || table?.table_name === result?.TABLE_NAME) {
                            table.columns.push({
                                column_name: result?.column_name || result?.COLUMN_NAME,
                                data_type: result?.data_type || result?.DATA_TYPE,
                                character_maximum_length: result?.character_maximum_length || result?.CHARACTER_MAXIMUM_LENGTH,
                                table_name: table?.table_name || table?.TABLE_NAME,
                                schema: table?.schema || table?.TABLE_SCHEMA,
                                alias_name: '',
                                is_selected_column: true,
                                reference: {
                                    local_table_schema: null,
                                    local_table_name: null,
                                    local_column_name: null,
    
                                    foreign_table_schema: null,
                                    foreign_table_name: null,
                                    foreign_column_name: null,
                                }
                            });
                        }
                    });
                });
                query = await externalDriver.getTablesRelationships(connection.schema);
                tablesSchema = await dbConnector.query(query);
                tablesSchema.forEach((result: any) => {
                    tables.forEach((table: any) => {
                        if (table?.table_name === result?.local_table_name || table?.table_name === result?.LOCAL_TABLE_NAME) {
                            table.columns.forEach((column: any) => {
                                if (column?.column_name === result?.local_column_name || column?.column_name === result?.LOCAL_COLUMN_NAME) {
                                    column.reference.local_table_schema = result?.local_table_schema || result?.LOCAL_TABLE_SCHEMA;
                                    column.reference.local_table_name = result?.local_table_name || result?.LOCAL_TABLE_NAME;
                                    column.reference.local_column_name = result?.local_column_name || result?.LOCAL_COLUMN_NAME;
    
                                    column.reference.foreign_table_schema = result?.foreign_table_schema || result?.FOREIGN_TABLE_SCHEMA;
                                    column.reference.foreign_table_name = result?.foreign_table_name || result?.FOREIGN_TABLE_NAME;
                                    column.reference.foreign_column_name = result?.foreign_column_name || result?.FOREIGN_COLUMN_NAME;
                                    table.references.push(column.reference);
                                }
                            });
                        }
                    });
                });
                return resolve(tables);
            }
        });
    }

    public async executeQueryOnExternalDataSource(dataSourceId: number, query: string, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(null);
            }
            const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}});
            if (!dataSource) {
                return resolve(null);
            }
            const connection: IDBConnectionDetails = dataSource.connection_details;
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(null);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
            if (!externalDriver) {
                return resolve(null);
            }
            let dbConnector: DataSource;
            try {
                dbConnector =  await externalDriver.connectExternalDB(connection);
                if (!dbConnector) {
                    return resolve(false);
                }
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return resolve(false);
            }
            try {
                const results = await dbConnector.query(query);
                return resolve(results);
            } catch (error) {
                return resolve(null);
            }
        });
    }

    public async buildDataModelOnQuery(dataSourceId: number, query: string, queryJSON: string, dataModelName: string, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const internalDbConnector = await driver.getConcreteDriver();
            if (!internalDbConnector) {
                return resolve(false);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(false);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}});
            if (!dataSource) {
                return resolve(false);
            }
            const connection: IDBConnectionDetails = dataSource.connection_details;
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(false);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
            if (!externalDriver) {
                return resolve(false);
            }
            const externalDBConnector: DataSource =  await externalDriver.connectExternalDB(connection);
            if (!externalDBConnector) {
                return resolve(false);
            }
            try {
                dataModelName = UtilityService.getInstance().uniquiseName(dataModelName);
                const selectTableQuery = `${query}`;
                const rowsFromDataSource = await externalDBConnector.query(selectTableQuery);
                //Create the table first then insert the data.
                let createTableQuery = `CREATE TABLE ${dataModelName} `;
                const sourceTable = JSON.parse(queryJSON);
                let columns = '';
                let insertQueryColumns = '';
                sourceTable.columns.forEach((column: any, index: number) => {
                    const columnSize = column?.character_maximum_length ? `(${column?.character_maximum_length})` : '';
                    const columnType = `${column.data_type}${columnSize}`;

                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(dataSourceType, columnType);
                    let dataTypeString = '';
                    if (dataType.size) {
                        dataTypeString = `${dataType.type}(${dataType.size})`;
                    } else {
                        dataTypeString = `${dataType.type}`;
                    }
                    if (index < sourceTable.columns.length - 1) {
                        columns += `${column.column_name} ${dataTypeString}, `;
                    } else {
                        columns += `${column.column_name} ${dataTypeString} `;
                    }
                    if (index < sourceTable.columns.length - 1) {
                        insertQueryColumns += `${column.column_name},`;
                    } else {
                        insertQueryColumns += `${column.column_name}`;
                    }
                });
                if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                    columns += ', ';
                    insertQueryColumns += ', ';
                }
                sourceTable.calculated_columns.forEach((column: any, index: number) => {
                    if (index < sourceTable.calculated_columns.length - 1) {
                        columns += `${column.column_name} NUMERIC, `;
                        insertQueryColumns += `${column.column_name}, `;
                    } else {
                        columns += `${column.column_name} NUMERIC`;
                        insertQueryColumns += `${column.column_name}`;
                    }
                });
                createTableQuery += `(${columns})`;
                await internalDbConnector.query(createTableQuery);
                insertQueryColumns = `(${insertQueryColumns})`;
                rowsFromDataSource.forEach((row: any, index: number) => {
                    let insertQuery = `INSERT INTO ${dataModelName} `;
                    let values = '';
                    sourceTable.columns.forEach((column: any, columnIndex: number) => {
                        const columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                        if (columnIndex < sourceTable.columns.length - 1) {
                            values += `'${row[columnName] || ''}',`;
                        } else {
                            values += `'${row[columnName] || ''}'`;
                        }
                    });
                    if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                        values += ',';
                    }
                    sourceTable.calculated_columns.forEach((column: any, columnIndex: number) => {
                        const columnName = column.column_name;
                        if (columnIndex < sourceTable.calculated_columns.length - 1) {
                            values += `'${row[columnName] || 0}',`;
                        } else {
                            values += `'${row[columnName] || 0}'`;
                        }
                    });
                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                    internalDbConnector.query(insertQuery);
                });
                const dataModel = new DRADataModel();
                dataModel.schema = 'public';
                dataModel.name = dataModelName;
                dataModel.sql_query = query;
                dataModel.query = JSON.parse(queryJSON);
                dataModel.data_source = dataSource;
                dataModel.users_platform = user;
                await manager.save(dataModel);
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    public async addExcelDataSource(fileName: string, dataSourceName: string, fileId: string, data: string, tokenDetails: ITokenDetails, projectId: number, dataSourceId: number = null, sheetInfo?: any): Promise<IExcelDataSourceReturn> {
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
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const project:DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}});
            if (project) {
                let dataSource = new DRADataSource();
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
                    dataSource.data_type = UtilityService.getInstance().getDataSourceType('postgresql');
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId, project: project, users_platform: user } });
                }
                
                const sheetsProcessed = [];
                
                try {
                    const parsedTableStructure = JSON.parse(data);
                    // Get sheet information
                    const sheetName = sheetInfo?.sheet_name || 'Sheet1';
                    const sheetId = sheetInfo?.sheet_id || `sheet_${Date.now()}`;
                    const originalSheetName = sheetInfo?.original_sheet_name || sheetName;
                    const sheetIndex = sheetInfo?.sheet_index || 0;
                
                    // Create table name for this sheet
                    const rawTableName = `excel_${fileId}_${sheetIndex}_data_source_${dataSource.id}`;
                    const tableName = this.sanitizeTableName(rawTableName);
                    
                    let createTableQuery = `CREATE TABLE dra_excel."${tableName}" `;
                    let columns = '';
                    let insertQueryColumns = '';
                    const sanitizedColumns: Array<{original: string, sanitized: string, type: string, title?: string, key?: string}> = [];
                    
                    if (parsedTableStructure.columns && parsedTableStructure.columns.length > 0) {
                        parsedTableStructure.columns.forEach((column: any, index: number) => {
                            const originalColumnName = column.column_name || column.title || `column_${index}`;
                            const sanitizedColumnName = this.sanitizeColumnName(originalColumnName);
                            sanitizedColumns.push({
                                original: originalColumnName,
                                sanitized: sanitizedColumnName,
                                type: column.type,
                                title: column.title,
                                key: column.key
                            });
                            
                            const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.EXCEL, column.type);
                            let dataTypeString = '';
                            if (dataType.size) {
                                dataTypeString = `${dataType.type}(${dataType.size})`;
                            } else {
                                dataTypeString = `${dataType.type}`;
                            }
                            
                            if (index < parsedTableStructure.columns.length - 1) {
                                columns += `${sanitizedColumnName} ${dataTypeString}, `;
                                insertQueryColumns += `${sanitizedColumnName},`;
                            } else {
                                columns += `${sanitizedColumnName} ${dataTypeString} `;
                                insertQueryColumns += `${sanitizedColumnName}`;
                            }
                        });
                        
                        createTableQuery += `(${columns})`;
                        insertQueryColumns = `(${insertQueryColumns})`;
                        
                        // Create the table
                        try {
                            await dbConnector.query(createTableQuery);
                            console.log('Successfully created table:', tableName);
                        } catch (error) {
                            console.error('Error creating table:', error);
                            console.error('Failed query:', createTableQuery);
                            throw error;
                        }
                        
                        // Insert data rows
                        if (parsedTableStructure.rows && parsedTableStructure.rows.length > 0) {                            
                            let successfulInserts = 0;
                            let failedInserts = 0;
                            
                            for (let rowIndex = 0; rowIndex < parsedTableStructure.rows.length; rowIndex++) {
                                const row = parsedTableStructure.rows[rowIndex];
                                let insertQuery = `INSERT INTO dra_excel."${tableName}" `;
                                let values = '';
 
                                sanitizedColumns.forEach((columnInfo, colIndex) => {
                                    // Try multiple ways to get the value
                                    let value = undefined;
                                    const originalColumn = parsedTableStructure.columns[colIndex];
                                    
                                    // Frontend sends flattened row data, so try direct access first
                                    // Strategy 1: Use column title (most common)
                                    if (originalColumn?.title && row[originalColumn.title] !== undefined) {
                                        value = row[originalColumn.title];
                                    }
                                    // Strategy 2: Use column key 
                                    else if (originalColumn?.key && row[originalColumn.key] !== undefined) {
                                        value = row[originalColumn.key];
                                    }
                                    // Strategy 3: Use original/sanitized column name
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
                                        const boolValue = this.convertToPostgresBoolean(value);
                                        values += boolValue;
                                    } else if (typeof value === 'string') {
                                        const escapedValue = this.escapeStringValue(value);
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
                                        const escapedValue = this.escapeStringValue(stringValue);
                                        values += `'${escapedValue}'`;
                                    }
                                });
                                
                                insertQuery += `${insertQueryColumns} VALUES(${values})`;
                                try {
                                    const result = await dbConnector.query(insertQuery);
                                    successfulInserts++;
                                    
                                    // Log result for first few rows
                                    if (rowIndex < 3) {
                                        console.log(`Insert result for row ${rowIndex}:`, result);
                                    }
                                    
                                    if (rowIndex % 100 === 0) {
                                        console.log(`Inserted ${rowIndex + 1}/${parsedTableStructure.rows.length} rows`);
                                    }
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
                                const countQuery = `SELECT COUNT(*) as row_count FROM dra_excel."${tableName}"`;
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
                        
                        // Track processed sheet
                        sheetsProcessed.push({
                            sheet_id: sheetId,
                            sheet_name: sheetName,
                            table_name: tableName, // Using sanitized table name
                            original_sheet_name: originalSheetName,
                            sheet_index: sheetIndex
                        });
                        
                        console.log(`Successfully processed sheet: ${sheetName} -> table: ${tableName}`);
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

    public async addPDFDataSource(
        dataSourceName: string, 
        fileId: string, 
        data: string, 
        tokenDetails: ITokenDetails, 
        projectId: number, 
        dataSourceId: number = null, 
        sheetInfo?: any
    ): Promise<IPDFDataSourceReturn> {
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
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const project: DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}});
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
                    dataSource.data_type = UtilityService.getInstance().getDataSourceType('postgresql');
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId, project: project, users_platform: user } });
                }

                // Parse the data - could be a single sheet or multiple sheets
                const parsedData = JSON.parse(data);
                
                // Handle single sheet format vs multi-sheet format
                const sheets = parsedData.columns && parsedData.rows ? [parsedData] : parsedData.sheets || [];
                
                // Process each sheet
                for (let i = 0; i < sheets.length; i++) {
                    const sheetData = sheets[i];
                    const sheetNumber = i + 1;
                    const pageName = `page_${sheetNumber}`;
                    const pageNumber = sheetInfo?.page_number || sheetNumber;
                    
                    // Create table name for this sheet
                    const tableName = `pdf_${fileId}_${pageNumber}_data_source_${dataSource.id}`;
                    console.log('Creating table:', tableName);
                    // Create table query
                    let createTableQuery = `CREATE TABLE dra_pdf.${tableName} `;
                    let columns = '';
                    let insertQueryColumns = '';
                    
                    if (sheetData.columns && sheetData.columns.length > 0) {
                        sheetData.columns.forEach((column: any, index: number) => {
                            const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.PDF, column.type);
                            let dataTypeString = '';
                            if (dataType.size) {
                                dataTypeString = `${dataType.type}(${dataType.size})`;
                            } else {
                                dataTypeString = `${dataType.type}`;
                            }
                            if (index < sheetData.columns.length - 1) {
                                columns += `${column.column_name} ${dataTypeString}, `;
                            } else {
                                columns += `${column.column_name} ${dataTypeString} `;
                            }
                            if (index < sheetData.columns.length - 1) {
                                insertQueryColumns += `${column.column_name},`;
                            } else {
                                insertQueryColumns += `${column.column_name}`;
                            }
                        });
                        
                        createTableQuery += `(${columns})`;
                        insertQueryColumns = `(${insertQueryColumns})`;
                        
                        // Create the table
                        await dbConnector.query(createTableQuery);
                        
                        // Insert data rows
                        if (sheetData.rows && sheetData.rows.length > 0) {
                            for (const row of sheetData.rows) {
                                let insertQuery = `INSERT INTO dra_pdf.${tableName} `;
                                let values = '';
                                
                                sheetData.columns.forEach((column: any, colIndex: number) => {
                                    const value = row.data ? row.data[column.title] : row[column.title];
                                    if (colIndex > 0) {
                                        values += ', ';
                                    }
                                    
                                    // Handle different data types properly
                                    if (value === null || value === undefined) {
                                        values += 'NULL';
                                    } else if (column.type === 'boolean') {
                                        // Convert boolean values to PostgreSQL format
                                        const boolValue = this.convertToPostgresBoolean(value);
                                        values += boolValue;
                                    } else if (typeof value === 'string') {
                                        values += `'${value.replace(/'/g, "''")}'`;
                                    } else if (typeof value === 'number') {
                                        values += `${value}`;
                                    } else {
                                        // For other types, convert to string and escape
                                        values += `'${String(value).replace(/'/g, "''")}'`;
                                    }
                                });
                                
                                insertQuery += `${insertQueryColumns} VALUES(${values});`;
                                await dbConnector.query(insertQuery);
                            }
                        }
                        
                        // Track processed sheet
                        sheetsProcessed.push({
                            sheet_id: sheetInfo?.sheet_id || `sheet_${sheetNumber}`,
                            sheet_name: pageName,
                            table_name: tableName,
                            page_number: pageNumber
                        });
                    }
                }

                //Add the user to the delete files queue, which will get all of the
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

    /**
     * Sanitizes column names to be PostgreSQL-compliant
     */
    private sanitizeColumnName(columnName: string): string {
        // Remove special characters and replace spaces with underscores
        let sanitized = columnName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        
        // Ensure it starts with a letter or underscore
        if (!/^[a-zA-Z_]/.test(sanitized)) {
            sanitized = `col_${sanitized}`;
        }
        
        // Ensure it's not empty
        if (!sanitized) {
            sanitized = `col_${Date.now()}`;
        }
        
        // Check against PostgreSQL reserved keywords
        const reservedKeywords = [
            'user', 'table', 'select', 'insert', 'update', 'delete', 'create', 'drop', 
            'alter', 'index', 'view', 'grant', 'revoke', 'commit', 'rollback', 'transaction',
            'primary', 'foreign', 'key', 'constraint', 'check', 'unique', 'not', 'null',
            'default', 'auto_increment', 'timestamp', 'date', 'time', 'year', 'month',
            'order', 'group', 'having', 'where', 'limit', 'offset', 'union', 'join',
            'inner', 'outer', 'left', 'right', 'cross', 'natural', 'on', 'using'
        ];
        
        if (reservedKeywords.includes(sanitized.toLowerCase())) {
            sanitized = `${sanitized}_col`;
        }
        
        return sanitized;
    }

    /**
     * Sanitizes table names to be PostgreSQL-compliant
     */
    private sanitizeTableName(tableName: string): string {
        return tableName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
    }

    /**
     * Properly escapes string values for PostgreSQL queries
     */
    private escapeStringValue(value: string): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''")
            .replace(/\0/g, '\\0');
    }

    /**
     * Converts various boolean representations to PostgreSQL boolean format
     */
    private convertToPostgresBoolean(value: any): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }
        
        const stringValue = String(value).trim().toLowerCase();
        
        // Handle common true values
        if (['true', '1', 'yes', 'y', 'on', 'active', 'enabled'].includes(stringValue)) {
            return 'TRUE';
        }
        
        // Handle common false values
        if (['false', '0', 'no', 'n', 'off', 'inactive', 'disabled'].includes(stringValue)) {
            return 'FALSE';
        }
        
        // If we can't determine the boolean value, default to NULL
        console.warn(`Unable to convert value "${value}" to boolean, using NULL`);
        return 'NULL';
    }
}