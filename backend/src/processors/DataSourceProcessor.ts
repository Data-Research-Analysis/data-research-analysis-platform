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
                                    references: [],
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
                                            schema: table.schema,
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

                            const [results2, metadata2] = await dbConnector.query(
                                `SELECT
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
                                    AND tc.table_schema='${connection.schema}';`
                            );
                            results2.forEach((result: any) => {
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