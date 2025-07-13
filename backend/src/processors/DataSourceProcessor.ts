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
            console.log('Connecting to external DB', connection);
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return reject(null);
            }
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return reject(null);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
            if (!externalDriver) {
                return reject(null);
            }
            let dbConnector: DataSource;
            try {
                dbConnector =  await externalDriver.connectExternalDB(connection);
                if (!dbConnector) {
                    return reject(null);
                }
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return reject(null);
            }
            return reject(null);
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
            //TODO: delete all of the data models contained in the data source
            //TODO: delete all of the visualizations contained in all of the related data models
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
                return resolve(false);
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
            const dataModels = await manager.find(DRADataModel, {where: {data_source: dataSource}});
            if (!dataModels) {
                return resolve(false);
            }
            console.log('dataModels', dataModels);
            const dataModelTables = dataModels.map((dataModel: DRADataModel) => {
                return `'${dataModel.name}'`;
            });
            console.log('dataModelTables', dataModelTables);
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
            let query = `SELECT tb.table_catalog, tb.table_schema, tb.table_name, co.column_name, co.data_type, co.character_maximum_length
					FROM information_schema.tables AS tb
					JOIN information_schema.columns AS co
					ON tb.table_name = co.table_name
					WHERE tb.table_schema = '${connection.schema}'
					AND tb.table_type = 'BASE TABLE'`;
            if (dataModelTables?.length) {
                query += ` AND tb.table_name NOT IN (${dataModelTables.join(',')})`;
            }
            let tablesSchema = await dbConnector.query(query);
            let tables = tablesSchema.map((table: any) => {
                return {
                    table_name: table.table_name,
                    schema: table.table_schema,
                    columns: [],
                    references: [],
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
            tablesSchema = await dbConnector.query(`SELECT
						tc.table_schema AS local_table_schema, 
						tc.constraint_name, 
						tc.table_name AS local_table_name, 
						kcu.column_name AS local_column_name, 
						ccu.table_schema AS foreign_table_schema,
						ccu.table_name AS foreign_table_name,
						ccu.column_name AS foreign_column_name 
					FROM information_schema.table_constraints AS tc 
					JOIN information_schema.key_column_usage AS kcu
						ON tc.constraint_name = kcu.constraint_name
						AND tc.table_schema = kcu.table_schema
					JOIN information_schema.constraint_column_usage AS ccu
						ON ccu.constraint_name = tc.constraint_name
					WHERE tc.constraint_type = 'FOREIGN KEY'
						AND tc.table_schema='${connection.schema}';
            `);
            tablesSchema.forEach((result: any) => {
                tables.forEach((table: any) => {
                    if (table.table_name === result.local_table_name) {
                        table.columns.forEach((column: any) => {
                            if (column.column_name === result.local_column_name) {
                                column.reference.local_table_schema = result.local_table_schema;
                                column.reference.local_table_name = result.local_table_name;
                                column.reference.local_column_name = result.local_column_name;

                                column.reference.foreign_table_schema = result.foreign_table_schema;
                                column.reference.foreign_table_name = result.foreign_table_name;
                                column.reference.foreign_column_name = result.foreign_column_name;
                                table.references.push(column.reference);
                            }
                        });
                    }
                });
            });
            return resolve(tables);
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
            const dbConnector: DataSource =  await externalDriver.connectExternalDB(connection);
            if (!dbConnector) {
                return resolve(false);
            }
            try {
                dataModelName = UtilityService.getInstance().uniquiseName(dataModelName);
                const createTableQuery = `CREATE TABLE ${dataModelName} AS ${query}`;
                await dbConnector.query(createTableQuery);
                const dataModel = new DRADataModel();
                dataModel.schema = connection.schema;
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
}