import { QueryTypes } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { DataModels } from "../models/DataModels";
import { ITokenDetails } from "../types/ITokenDetails";
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
                console.log(dataModel.name);
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
    
}