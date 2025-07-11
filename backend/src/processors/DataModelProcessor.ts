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
            const existingDataModel = await manager.findOne(DRADataModel, {where: {id: dataModelId, data_source: dataSource, users_platform: user}});
            if (!existingDataModel) {
                return resolve(false);
            }
            await dbConnector.query(`DROP TABLE IF EXISTS ${existingDataModel.schema}.${existingDataModel.name}`);
            try {
                dataModelName = UtilityService.getInstance().uniquiseName(dataModelName);
                const createTableQuery = `CREATE TABLE ${dataModelName} AS ${query}`;
                await dbConnector.query(createTableQuery);
                await manager.update(DRADataModel, {id: existingDataModel.id}, {schema: connection.schema, name: dataModelName, sql_query: query, query: JSON.parse(queryJSON)});
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
            const project: DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}, relations: ['data_sources']});
            if (!project) {
                return resolve([]);
            }
            const dataSources: DRADataSource[] = project.data_sources;
            let tables:any[] = [];
            for (let i=0; i<dataSources.length; i++) {
                const dataSource = dataSources[i];
                const dataModels = await manager.find(DRADataModel, {where: {data_source: dataSource, users_platform: user}});
                if (!dataModels) {
                    return resolve([]);
                }
                const dataModelsTableNames = dataModels.map((dataModel) => {
                    return {
                        schema: dataModel.schema,
                        table_name: dataModel.name,
                    }
                })
                if (dataModelsTableNames?.length === 0) {
                    return resolve([]);
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
                tables = tablesSchema.map((table: any) => {
                    return {
                        table_name: table.table_name,
                        schema: table.table_schema,
                        columns: [],
                        rows: table.rows,
                    }
                });
                tables = _.uniqBy(tables, 'table_name');
                tables.forEach((table: any) => {
                    tablesSchema.forEach((result: any) => {
                        if (table.table_name === result.table_name) {
                            table.columns.push({
                                column_name: result.column_name,
                                data_type: result.data_type,
                                character_maximum_length: result.character_maximum_length,
                                table_name: table.table_name,
                                schema: table.schema,
                                alias_name: '',
                            });
                        }
                    });
                });
            }
            return resolve(tables);
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
            let results = await dbConnector.query(query);
            console.log('results', results);
            try {
                const results = await dbConnector.query(query);
                return resolve(results);
            } catch (error) {
                return resolve(null);
            }

        });
    }
}