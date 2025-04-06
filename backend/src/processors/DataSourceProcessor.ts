import { DBDriver } from "../drivers/DBDriver";
import { UtilityService } from "../services/UtilityService";
import jwt, { JwtPayload } from "jsonwebtoken";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";
import { Sequelize } from "sequelize";
import { DataSources } from "../models/DataSources";
import { ITokenDetails } from "../types/ITokenDetails";
import { ProjectProcessor } from "./ProjectProcessor";
import { Projects } from "../models/Projects";
import _ from "lodash";
export class DataSourceProcessor {
    private static instance: DataSourceProcessor;
    private constructor() {}

    public static getInstance(): DataSourceProcessor {
        if (!DataSourceProcessor.instance) {
            DataSourceProcessor.instance = new DataSourceProcessor();
        }
        return DataSourceProcessor.instance;
    }

    async getDataSources(tokenDetails: ITokenDetails): Promise<DataSources[]> {
        return new Promise<DataSources[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const dataSources = await DataSources.findAll({where: {user_platform_id: user_id}});
            return resolve(dataSources);
        });
    }

    public async connectToDataSource(connection: IDBConnectionDetails): Promise<Sequelize> {
        return new Promise<Sequelize>(async (resolve, reject) => {
            console.log('Connecting to external DB', connection);
            const driver = await DBDriver.getInstance().getDriver();
            if (driver) {
                const response: boolean = await driver.initialize();
                if (response) {
                    const externalDriver = await DBDriver.getInstance().getDriver();
                    const dbConnector: Sequelize =  await externalDriver.connectExternalDB(connection);
                    if (dbConnector) {
                        return resolve(dbConnector);
                    }
                    return resolve(null);
                }
                return resolve(null);
            }
            return resolve(null);
        });
    }

    public async saveConnection(connection: IDBConnectionDetails, tokenDetails: ITokenDetails, projectId: String): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            console.log('tokenDetails', tokenDetails);
            const { user_id } = tokenDetails;
            const project = await Projects.findOne({where: {id: projectId, user_platform_id: user_id}});
            console.log('project', project);
            console.log('project.id', project.id);
            console.log('typeof user_id', typeof user_id);
            if (project) {
                await DataSources.create({
                    name: 'postgresql',
                    connection_details: connection,
                    data_type: 'postgresql',
                    project_id: project.id,
                    user_platform_id: user_id,
                });
                return resolve(true);
            }
            return resolve(false);
        });
    }

    public async deleteDataSource(dataSourceId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const dataSource = await DataSources.findOne({where: {id: dataSourceId, user_platform_id: user_id}});
            if (dataSource) {
                //delete all of the data models contained in the project TODO
                
                await DataSources.destroy({where: {id: dataSourceId, user_platform_id: user_id}});
                return resolve(true);
            }
            return resolve(false);
        });
    }

    public async deleteDataSourcesForProject(projectId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const dataSource = await DataSources.findAll({where: {project_id: projectId, user_platform_id: user_id}});
            if (dataSource) {
                //delete all of the data models contained in the project TODO


                await DataSources.destroy({where: {project_id: projectId, user_platform_id: user_id}});
                return resolve(true);
            }
            return resolve(false);
        });
    }

    public async getTablesFromDataSource(dataSourceId: number, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            // console.log('Getting tables from external DB', connection);
            const driver = await DBDriver.getInstance().getDriver();
            if (driver) {
                const dataSource = await DataSources.findOne({where: {id: dataSourceId, user_platform_id: tokenDetails.user_id}});
                if (dataSource) {
                    const connection: IDBConnectionDetails = dataSource.connection_details;
                    console.log('connection', connection);
                    const response: boolean = await driver.initialize();
                    if (response) {
                        const externalDriver = await DBDriver.getInstance().getDriver();
                        const dbConnector: Sequelize =  await externalDriver.connectExternalDB(connection);
                        if (dbConnector) {
                            const [results, metadata] = await dbConnector.query(`SELECT tb.table_catalog, tb.table_schema, tb.table_name, co.column_name, co.data_type, co.character_maximum_length
                                FROM information_schema.tables AS tb
                                JOIN information_schema.columns AS co
                                ON tb.table_name = co.table_name
                                WHERE tb.table_schema = '${connection.schema}'
                                AND tb.table_type = 'BASE TABLE';`);
                            let tables = results.map((table: any) => {
                                return {
                                    table_name: table.table_name,
                                    schema: table.table_schema,
                                    columns: [],
                                }
                            });
                            tables = _.uniqBy(tables, 'table_name');

                            tables.forEach((table: any) => {
                                results.forEach((result: any) => {
                                    if (table.table_name === result.table_name) {
                                        table.columns.push({
                                            column_name: result.column_name,
                                            data_type: result.data_type,
                                            character_maximum_length: result.character_maximum_length,
                                            table_name: table.table_name,
                                        });
                                    }
                                });
                            });

                            return resolve(tables);
                        }
                        return resolve(null);
                    }
                    return resolve(null);
                } else {
                    return resolve(null);
                }
            //     const response: any = await driver.initialize();
            //     if (response) {
            //         const externalDriver = await DBDriver.getInstance().getDriver();
            //         const dbConnector: Sequelize =  await externalDriver.connectExternalDB(connection);
            //         if (dbConnector) {
            //             const tables = await dbConnector.getQueryInterface().showAllTables();
            //             return resolve(tables);
            //         }
            //         return resolve(false);
            //     }
            //     return resolve(false);
            }
            return resolve(null);
        });
    }



}