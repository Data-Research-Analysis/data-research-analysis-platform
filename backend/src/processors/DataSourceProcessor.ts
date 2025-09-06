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
import { IExcelDataSourceReturn } from "../types/IExcelDataSourceReturn.js";
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
            } else if (dataSource.data_type === EDataSourceType.POSTGRESQL || dataSource.data_type === EDataSourceType.MYSQL || dataSource.data_type === EDataSourceType.MARIADB) {
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

    public async addExcelDataSource(fileName: string, dataSourceName: string, fileId: string, data: string, tokenDetails: ITokenDetails, projectId: number, dataSourceId: number = null): Promise<IExcelDataSourceReturn> {
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
                const tableName = `${fileName}_data_source_${dataSource.id}_${new Date().getTime()}`;
                let createTableQuery = `CREATE TABLE dra_excel.${tableName} `;
                let columns = '';
                let insertQueryColumns = '';
                const parsedTableStructure = JSON.parse(data);
                parsedTableStructure.columns.forEach((column: any, index: number) => {
                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.EXCEL, column.type);
                    let dataTypeString = '';
                    if (dataType.size) {
                        dataTypeString = `${dataType.type}(${dataType.size})`;
                    } else {
                        dataTypeString = `${dataType.type}`;
                    }
                    if (index < parsedTableStructure.columns.length - 1) {
                        columns += `${column.column_name} ${dataTypeString}, `;
                    } else {
                        columns += `${column.column_name} ${dataTypeString} `;
                    }
                    if (index < parsedTableStructure.columns.length - 1) {
                        insertQueryColumns += `${column.column_name},`;
                    } else {
                        insertQueryColumns += `${column.column_name}`;
                    }
                });
                createTableQuery += `(${columns})`;
                insertQueryColumns = `(${insertQueryColumns})`;
                await dbConnector.query(createTableQuery);
                parsedTableStructure.rows.forEach(async (row: any, index: number) => {
                    let insertQuery = `INSERT INTO dra_excel.${tableName} `;
                    let values = '';
                    parsedTableStructure.columns.forEach((column: any, colIndex: number) => {
                        const value = row[column.title];
                        if (colIndex > 0) {
                            values += ', ';
                        }
                        if (typeof value === 'string') {
                            values += `'${value.replace(/'/g, "''")}'`;
                        } else {
                            values += `${value}`;
                        }
                    });
                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                    await dbConnector.query(insertQuery);
                });
                return resolve({ status: 'success', file_id: fileId, data_source_id: dataSource.id });
            }
            return resolve({ status: 'error', file_id: fileId });
        });
    }
}