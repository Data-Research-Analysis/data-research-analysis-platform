import { QueryTypes, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { DRADataModel } from "../models/DRADataModel";
import { ITokenDetails } from "../types/ITokenDetails";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";
import { UtilityService } from "../services/UtilityService";
import { DRADataSource } from "../models/DRADataSource";
import { DataSource } from "typeorm";
import { EDataSourceType } from "../types/EDataSourceType";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";
import _ from "lodash";

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
}