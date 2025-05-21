import { Model, QueryTypes, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { DRADataModel } from "../models/DRADataModel";
import { ITokenDetails } from "../types/ITokenDetails";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";
import { UtilityService } from "../services/UtilityService";
import { DRADataSource } from "../models/DRADataSource";
import { DataSource } from "typeorm";
import { EDataSourceType } from "../types/EDataSourceType";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";
import { DRAVisualization } from "../models/DRAVisualization";
import _ from "lodash";
import { DRAProject } from "../models/DRAProject";

export class DataModelProcessor {
    private static instance: DataModelProcessor;
    private constructor() {}

    public static getInstance(): DataModelProcessor {
        if (!DataModelProcessor.instance) {
            DataModelProcessor.instance = new DataModelProcessor();
        }
        return DataModelProcessor.instance;
    }

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

    public async updateDataModelOnQuery(dataSourceId: number, dataModelId: number, query: string, queryJSON: string, dataModelName: string, tokenDetails: ITokenDetails): Promise<any> {
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
                return resolve(false);
            }
            const dataSource: DRADataSource = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}});
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
            const dbConnector: DataSource =  await externalDriver.connectExternalDB(connection);
            if (!dbConnector) {
                return resolve(null);
            }
            const existingDataModel = await manager.findOne(DRADataModel, {where: {id: dataModelId, data_source: dataSource, users_platform: user}});
            if (!existingDataModel) {
                return resolve(null);
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
                return resolve(null);
            }
        });
    }

    public async getTablesFromDataModels(projectId: number, tokenDetails: ITokenDetails): Promise<any> {
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
                return resolve(false);
            }
            const project: DRAProject = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}, relations: ['data_sources']});
            if (!project) {
                return resolve(null);
            }
            const dataSources: DRADataSource[] = project.data_sources;
            console.log('dataSources', dataSources);
            let tables = [];
            for (let i=0; i<dataSources.length; i++) {
                const dataSource = dataSources[i];
                const connection: IDBConnectionDetails = dataSource.connection_details;
                const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                if (!dataSourceType) {
                    return resolve(null);
                }
                const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
                if (!externalDriver) {
                    return resolve(null);
                }
                const dataModels = await manager.find(DRADataModel, {where: {data_source: dataSource, users_platform: user}});
                if (!dataModels) {
                    return resolve(false);
                }
                console.log('dataModels', dataModels);
                const dataModelsTableNames = dataModels.map((dataModel) => {
                    return {
                        schema: `'${dataModel.schema}'`,
                        table_name: `'${dataModel.name}'`,
                    }
                })
                console.log('dataModelsTableNames', dataModelsTableNames);
                // const schema = dataModels.schema;
                // const tableName = dataModel.name;
    
                const dbConnector: DataSource =  await externalDriver.connectExternalDB(connection);
                if (!dbConnector) {
                    return resolve(null);
                }
                let query = `SELECT tb.table_catalog, tb.table_schema, tb.table_name, co.column_name, co.data_type, co.character_maximum_length
                    FROM information_schema.tables AS tb
                    JOIN information_schema.columns AS co
                    ON tb.table_name = co.table_name
                    AND tb.table_type = 'BASE TABLE'`;
                    if (dataModelsTableNames?.length) {
                        query += ` AND tb.table_name IN (${dataModelsTableNames.map((model) => model.table_name).join(',')})`;
                        query += ` AND tb.table_schema IN (${dataModelsTableNames.map((model) => model.schema).join(',')})`;
                    }
                
                let tablesSchema = await dbConnector.query(query);
                console.log('tablesSchema', tablesSchema);
                tables = tablesSchema.map((table: any) => {
                    return {
                        table_name: table.table_name,
                        schema: table.table_schema,
                        columns: [],
                    }
                });
                tables = _.uniqBy(tables, 'table_name');
                console.log('tables', tables);
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
            console.log('tables', tables);
            return resolve(tables);
        });
    }
}