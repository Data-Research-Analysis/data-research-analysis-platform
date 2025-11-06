import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DBDriver } from "../drivers/DBDriver.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
export class ProjectProcessor {
    private static instance: ProjectProcessor;
    private constructor() {}

    public static getInstance(): ProjectProcessor {
        if (!ProjectProcessor.instance) {
            ProjectProcessor.instance = new ProjectProcessor();
        }
        return ProjectProcessor.instance;
    }

    async addProject(project_name: string, description: string | undefined, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            console.log((await driver.getConcreteDriver()))
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const project = new DRAProject();
            project.name = project_name;
            project.description = description || '';
            project.users_platform = user;
            project.created_at = new Date();
            await manager.save(project);
            return resolve(true);
        });
    }

    async getProjects(tokenDetails: ITokenDetails): Promise<DRAProject[]> {
        return new Promise<DRAProject[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve([]);
            }
            const projects = await manager.find(DRAProject, {where: {users_platform: user}});
            return resolve(projects);
        });
    }

    async deleteProject(projectId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver.getConcreteDriver()).manager;
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve(false);
            }
            const project = await manager.findOne(DRAProject, {where: {id: projectId}});
            if (!project) {
                return resolve(false);
            }
            const dataSources = await manager.find(DRADataSource, {where: {project: project}});
            await manager.remove(dataSources);
            await manager.remove(project);
            return resolve(true);
        });
    }
}