import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { IDashboard } from "../types/IDashboard.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";
import bcrypt  from 'bcryptjs';
import { UtilityService } from "../services/UtilityService.js";
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";

export class DashboardProcessor {
    private static instance: DashboardProcessor;
    private constructor() {}

    public static getInstance(): DashboardProcessor {
        if (!DashboardProcessor.instance) {
            DashboardProcessor.instance = new DashboardProcessor();
        }
        return DashboardProcessor.instance;
    }

    async getDashboards(tokenDetails: ITokenDetails): Promise<DRADashboard[]> {
        return new Promise<DRADashboard[]>(async (resolve, reject) => {
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
            const dataModels = await manager.find(DRADashboard, {where: {users_platform: user}, relations: ['project', 'users_platform', 'export_meta_data']});
            return resolve(dataModels);
        });
    }

    async addDashboard(projectId: number, data: IDashboard, tokenDetails: ITokenDetails): Promise<boolean> {
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
                return resolve(error);
            }
        });
    }
    async updateDashboard(dashboardId: number, projectId: number, data: IDashboard, tokenDetails: ITokenDetails): Promise<boolean> {
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
            const project = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: {id: user_id}}});
            if (!project) {
                return resolve(false);
            }
            const dashboard = await manager.findOne(DRADashboard, {where: {id: dashboardId, users_platform: user}});
            if (!dashboard) {
                return resolve(false);
            }
            try {
                // const dashboard = new DRADashboard();
                // dashboard.project = project;
                // dashboard.users_platform = user;
                // dashboard.data = data;
                // await manager.save(dashboard);

                await manager.update(DRADashboard, {id: dashboardId}, {data: data});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(error);
            }
        });
    }

    /**
     * Delete a dashboard
     * @param dashboardId 
     * @param tokenDetails 
     * @returns true if the dashboard was deleted, false otherwise
     */
    public async deleteDashboard(dashboardId: number, tokenDetails: ITokenDetails): Promise<boolean> {
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
            const dashboard = await manager.findOne(DRADashboard, {where: {id: dashboardId, users_platform: user}});
            if (!dashboard) {
                return resolve(false);
            }

            await manager.remove(dashboard);
            return resolve(true);
        });
    }

    public async generatePublicExportLink(dashboardId: number, tokenDetails: ITokenDetails): Promise<string | null> {
        return new Promise<string | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
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
            const dashboard = await manager.findOne(DRADashboard, {where: {id: dashboardId, users_platform: user}});
            if (!dashboard) {
                return resolve(null);
            }
            const exportMetaDataExisting = await manager.findOne(DRADashboardExportMetaData, {where: {dashboard: {id: dashboardId, users_platform: user}}});
            if (exportMetaDataExisting && exportMetaDataExisting.expiry_at > new Date()) {
                return resolve(exportMetaDataExisting.key);
            }
            const salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
            const key = encodeURIComponent(await bcrypt.hash(`${dashboardId}`, salt));
            const exportMetaData = new DRADashboardExportMetaData();
            exportMetaData.dashboard = dashboard;
            exportMetaData.users_platform = user;
            exportMetaData.key = key;
            exportMetaData.created_at = new Date();
            exportMetaData.expiry_at = new Date(new Date().getTime() + (48 * 60 * 60 * 1000)); // 48 hours from now
            await manager.save(exportMetaData);
            return resolve(key);
        });
    }
    public async getPublicDashboard(dashboardKey: string): Promise<DRADashboardExportMetaData | null> {
        return new Promise<DRADashboardExportMetaData | null>(async (resolve, reject) => {
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const exportMetaDataExisting = await manager.findOne(DRADashboardExportMetaData, {where: {key: dashboardKey}, relations: ['dashboard']});
            if (exportMetaDataExisting && exportMetaDataExisting.expiry_at > new Date()) {
                return resolve(exportMetaDataExisting);
            }
            return resolve(null);
        });
    }
}