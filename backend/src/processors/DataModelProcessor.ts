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
}