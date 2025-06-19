import { DBDriver } from "../drivers/DBDriver";
import { DRADataModel } from "../models/DRADataModel";
import { ITokenDetails } from "../types/ITokenDetails";
import _ from "lodash";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";
import { UtilityService } from "../services/UtilityService";
import { DRADataSource } from "../models/DRADataSource";
import { DRADashboard } from "../models/DRADashboard";
import { IDashboard } from "../types/IDashboard";
import { EDataSourceType } from "../types/EDataSourceType";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";
import { DRAProject } from "../models/DRAProject";

export class DashboardProcessor {
    private static instance: DashboardProcessor;
    private constructor() {}

    public static getInstance(): DashboardProcessor {
        if (!DashboardProcessor.instance) {
            DashboardProcessor.instance = new DashboardProcessor();
        }
        return DashboardProcessor.instance;
    }

    async addDashboard(projectId: number, data: IDashboard, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
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
            const project = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: {id: user_id}}});
            if (!project) {
                return resolve(false);
            }

            try {
                const dashboard = new DRADashboard();
                dashboard.project = project;
                dashboard.users_platform = user;
                dashboard.data = data;
                await manager.save(dashboard);
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return reject(error);
            }
        });
    }

    async getDashboards(tokenDetails: ITokenDetails): Promise<DRADashboard[]> {
        return new Promise<DRADashboard[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            // const visualizations = await Visualizations.findAll({where: {user_platform_id: user_id}});//, include: [{model: VisualizationsModels}]});
            // return resolve(visualizations);
            return resolve(null);
        });
    }
}