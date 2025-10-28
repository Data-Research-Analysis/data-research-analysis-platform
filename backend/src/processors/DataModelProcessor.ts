import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { UtilityService } from "../services/UtilityService.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DataSource } from "typeorm";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";

export class DataModelProcessor {
    private static instance: DataModelProcessor;
    private constructor() {}

    public static getInstance(): DataModelProcessor {
        if (!DataModelProcessor.instance) {
            DataModelProcessor.instance = new DataModelProcessor();
        }
        return DataModelProcessor.instance;
    }

    /**
     * Get the list of data models for a user
     * @param tokenDetails 
     * @returns list of data models
     */
    async getDataModels(tokenDetails: ITokenDetails): Promise<DRADataModel[]> {
        return new Promise<DRADataModel[]>(async (resolve, reject) => {
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
            const dataModels = await manager.find(DRADataModel, {where: {users_platform: user}, relations: ['data_source', 'users_platform']});
            return resolve(dataModels);
        });
    }

    /**
     * Delete a data model
     * @param dataModelId 
     * @param tokenDetails 
     * @returns true if the data model was deleted, false otherwise
     */
    public async deleteDataModel(dataModelId: number, tokenDetails: ITokenDetails): Promise<boolean> {
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
            const dataModel = await manager.findOne(DRADataModel, {where: {id: dataModelId, users_platform: user}});
            if (!dataModel) {
                return resolve(false);
            }
            //TODO: delete visualizations data
            const dbConnector = await driver.getConcreteDriver();
            await dbConnector.query(`DROP TABLE IF EXISTS ${dataModel.schema}.${dataModel.name}`);
            await manager.remove(dataModel);
            return resolve(true);
        });
    }

    /**
     * Update the data model on query
     * @param dataSourceId 
     * @param dataModelId 
     * @param query 
     * @param queryJSON 
     * @param dataModelName 
     * @param tokenDetails 
     * @returns true if the data model was updated, false otherwise
     */
    public async updateDataModelOnQuery(dataSourceId: number, dataModelId: number, query: string, queryJSON: string, dataModelName: string, tokenDetails: ITokenDetails): Promise<boolean> {
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
            let externalDBConnector: DataSource;
            try {
                externalDBConnector =  await externalDriver.connectExternalDB(connection);
                if (!externalDBConnector) {
                    return resolve(false);
                }
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return resolve(false);
            }
            const existingDataModel = await manager.findOne(DRADataModel, {where: {id: dataModelId, data_source: dataSource, users_platform: user}});
            if (!existingDataModel) {
                return resolve(false);
            }
            await internalDbConnector.query(`DROP TABLE IF EXISTS ${existingDataModel.schema}.${existingDataModel.name}`);
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
                    if (column && column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                        const columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                        if (index < sourceTable.columns.length - 1) {
                            columns += `${columnName} ${dataTypeString}, `;
                        } else {
                            columns += `${columnName} ${dataTypeString} `;
                        }
                        if (index < sourceTable.columns.length - 1) {
                            insertQueryColumns += `${columnName},`;
                        } else {
                            insertQueryColumns += `${columnName}`;
                        }
                    } else {
                        if (index < sourceTable.columns.length - 1) {
                            columns += `${column.schema}_${column.table_name}_${column.column_name} ${dataTypeString}, `;
                        } else {
                            columns += `${column.schema}_${column.table_name}_${column.column_name} ${dataTypeString} `;
                        }
                        if (index < sourceTable.columns.length - 1) {
                            insertQueryColumns += `${column.schema}_${column.table_name}_${column.column_name},`;
                        } else {
                            insertQueryColumns += `${column.schema}_${column.table_name}_${column.column_name}`;
                        }
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
                        let columnName = `${column.table_name}_${column.column_name}`;
                        if (column && column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                            columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                        }
                        if (columnIndex < sourceTable.columns.length - 1) {
                            values += row[columnName] ? `'${row[columnName]}',` : `null,`;
                        } else {
                            values += row[columnName] ? `'${row[columnName]}'` : `null`
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
                await manager.update(DRADataModel, {id: existingDataModel.id}, {schema: 'public', name: dataModelName, sql_query: query, query: JSON.parse(queryJSON)});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    /**
     * Get the list of tables from data models that have been created in the project database
     * @param projectId 
     * @param tokenDetails 
     * @returns list of tables from data models that have been created in the project database
     */
    public async getTablesFromDataModels(projectId: number, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
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
            const project: DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}, relations: ['data_sources', 'data_sources.data_models', 'data_sources.project', 'users_platform']});
            if (!project) {
                return resolve([]);
            }
            const dataSources: DRADataSource[] = project.data_sources;
            let tables:any[] = [];
            for (let i=0; i<dataSources.length; i++) {
                const dataSource = dataSources[i];
                const dataModels = dataSource?.data_models || [];
                if (!dataModels) {
                    continue;
                }
                const dataModelsTableNames = dataModels.map((dataModel) => {
                    return {
                        schema: dataModel.schema,
                        table_name: dataModel.name,
                    }
                })
                if (dataModelsTableNames?.length === 0) {
                    continue;
                }
                let query = `SELECT tb.table_catalog, tb.table_schema, tb.table_name, co.column_name, co.data_type, co.character_maximum_length
                    FROM information_schema.tables AS tb
                    JOIN information_schema.columns AS co
                    ON tb.table_name = co.table_name
                    AND tb.table_type = 'BASE TABLE'`;
                if (dataModelsTableNames?.length) {
                    query += ` AND tb.table_name IN (${dataModelsTableNames.map((model) => `'${model.table_name}'`).join(',')})`;
                    query += ` AND tb.table_schema IN (${dataModelsTableNames.map((model) => `'${model.schema}'`).join(',')})`;
                }
                let tablesSchema = await dbConnector.query(query);
                for (let i=0; i < dataModelsTableNames.length; i++) {
                    const dataModelTableName = dataModelsTableNames[i];
                    query = `SELECT * FROM "${dataModelTableName.schema}"."${dataModelTableName.table_name}"`;
                    let rowsData = await dbConnector.query(query);
                    const tableSchema = tablesSchema.find((table: any) => {
                        return table.table_name === dataModelTableName.table_name && table.table_schema === dataModelTableName.schema;
                    });
                    if (tableSchema) {
                        tableSchema.rows = rowsData;
                    }
                }
                let tempTables = tablesSchema.map((table: any) => {
                    return {
                        table_name: table.table_name,
                        schema: table.table_schema,
                        columns: [],
                        rows: table.rows,
                    }
                });
                tempTables = _.uniqBy(tempTables, 'table_name');
                tempTables.forEach((table: any) => {
                    tablesSchema.forEach((result: any) => {
                        if (table.table_name === result.table_name) {
                            table.columns.push({
                                column_name: result.column_name,
                                data_type: result.data_type,
                                character_maximum_length: result.character_maximum_length,
                                table_name: table.table_name,
                                schema: table.schema,
                                alias_name: '',
                                is_selected_column: true,
                            });
                        }
                    });
                });
                tables.push(tempTables);
            }
            return resolve(tables.flat());
        });
    }

    public async executeQueryOnDataModel(query: string, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
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
}