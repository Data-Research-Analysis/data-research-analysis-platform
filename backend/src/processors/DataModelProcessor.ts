import { QueryTypes, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { DataModels } from "../models/DataModels";
import { ITokenDetails } from "../types/ITokenDetails";
import _ from "lodash";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";
import { UtilityService } from "../services/UtilityService";
import { DataSources } from "../models/DataSources";

export class DataModelProcessor {
    private static instance: DataModelProcessor;
    private constructor() {}

    public static getInstance(): DataModelProcessor {
        if (!DataModelProcessor.instance) {
            DataModelProcessor.instance = new DataModelProcessor();
        }
        return DataModelProcessor.instance;
    }

    async getDataModels(tokenDetails: ITokenDetails): Promise<DataModels[]> {
        return new Promise<DataModels[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const dataModels = await DataModels.findAll({where: {user_platform_id: user_id}});
            return resolve(dataModels);
        });
    }

    public async deleteDataModel(dataModelId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const dataModel = await DataModels.findOne({where: {id: dataModelId, user_platform_id: user_id}});
            if (dataModel) {
                //delete all of the data models contained in the project TODO
                const driver = await DBDriver.getInstance().getDriver();
                const response: boolean = await driver.initialize();
                if (response) {
                    try {
                        const concreteDriver = await driver.getConcreteDriver();
                        await concreteDriver.query(`DROP TABLE ${dataModel.schema}.${dataModel.name}`, {type: QueryTypes.RAW});
                        await DataModels.destroy({where: {id: dataModelId, user_platform_id: user_id}});
                    } catch (error) {
                        console.error('Error dropping table:', error);
                    }
                    return resolve(true);
                }
                return resolve(false);
            }
            return resolve(false);
        });
    }

    public async updateDataModelOnQuery(dataSourceId: number, dataModelId: number, query: string, queryJSON: string, dataModelName: string, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const driver = await DBDriver.getInstance().getDriver();
            if (driver) {
                const dataSource = await DataSources.findOne({where: {id: dataSourceId, user_platform_id: tokenDetails.user_id}});
                if (dataSource) {
                    const connection: IDBConnectionDetails = dataSource.connection_details;
                    const response: boolean = await driver.initialize();
                    if (response) {
                        const externalDriver = await DBDriver.getInstance().getDriver();
                        const dbConnector: Sequelize =  await externalDriver.connectExternalDB(connection);
                        if (dbConnector) {
                            try {
                                const existingDataModel = await DataModels.findOne({where: {id: dataModelId, user_platform_id: tokenDetails.user_id}});
                                if (existingDataModel) {
                                    // Drop the existing user data model table if it exists
                                    const concreteDriver = await driver.getConcreteDriver();
                                    await concreteDriver.query(`DROP TABLE ${existingDataModel.schema}.${existingDataModel.name}`, {type: QueryTypes.RAW});
                                }
                                dataModelName = UtilityService.getInstance().uniquiseName(dataModelName);
                                //create the new user data model table
                                const createTableQuery = `CREATE TABLE ${dataModelName} AS ${query}`;
                                await dbConnector.query(createTableQuery, { type: QueryTypes.SELECT });
                                await DataModels.update({
                                    name: dataModelName,
                                    sql_query: query,
                                    query: queryJSON,
                                    user_platform_id: tokenDetails.user_id,
                                }, {
                                    where: {
                                        id: dataModelId,
                                        data_source_id: dataSourceId,
                                        user_platform_id: tokenDetails.user_id
                                    }
                                });
                                return resolve(true);
                            } catch (error) {
                                console.log('error', error);
                                return resolve(null);
                            }
                        }
                        return resolve(null);
                    }
                }
            }
        });
    }
}