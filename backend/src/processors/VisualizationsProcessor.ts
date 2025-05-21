import { QueryTypes, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { DRADataModel } from "../models/DRADataModel";
import { ITokenDetails } from "../types/ITokenDetails";
import _ from "lodash";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";
import { UtilityService } from "../services/UtilityService";
import { DRADataSource } from "../models/DRADataSource";
import { DRAVisualization } from "../models/DRAVisualization";

export class VisualizationsProcessor {
    private static instance: VisualizationsProcessor;
    private constructor() {}

    public static getInstance(): VisualizationsProcessor {
        if (!VisualizationsProcessor.instance) {
            VisualizationsProcessor.instance = new VisualizationsProcessor();
        }
        return VisualizationsProcessor.instance;
    }

    async getVisualizations(tokenDetails: ITokenDetails): Promise<DRAVisualization[]> {
        return new Promise<DRAVisualization[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            // const visualizations = await Visualizations.findAll({where: {user_platform_id: user_id}});//, include: [{model: VisualizationsModels}]});
            // return resolve(visualizations);
            return resolve(null);
        });
    }
}