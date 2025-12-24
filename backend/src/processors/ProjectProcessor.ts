import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DBDriver } from "../drivers/DBDriver.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";
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
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }

        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
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
            try {
                const { user_id } = tokenDetails;
                let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const manager = (await driver.getConcreteDriver()).manager;
                const dbConnector = await driver.getConcreteDriver();
                
                const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
                if (!user) {
                    return resolve(false);
                }

                const project = await manager.findOne(DRAProject, {where: {id: projectId}, relations: ['data_sources', 'data_sources.data_models']});
                if (!project) {
                    return resolve(false);
                }
                // Get all data sources for this project and also get the data model
                const dataSources = project.data_sources;
                // For each data source, delete all related entities
                for (const dataSource of dataSources) {
                    const dataModels = dataSource.data_models;
                    for (const dataModel of dataModels) {
                        await dbConnector.query(`DROP TABLE IF EXISTS ${dataModel.schema}.${dataModel.name}`);
                    }
                    if ('schema' in dataSource.connection_details && dataSource.connection_details.schema === 'dra_excel') {
                        try {
                            const tables = await dbConnector.query(
                                `SELECT table_name FROM information_schema.tables 
                                 WHERE table_schema = 'dra_excel' 
                                 AND table_name LIKE '%_data_source_${dataSource.id}_%'`
                            );
                            for (const table of tables) {
                                await dbConnector.query(
                                    `DROP TABLE IF EXISTS dra_excel.${table.table_name}`
                                );
                            }
                        } catch (error) {
                            console.error(`Error deleting Excel tables:`, error);
                        }
                    }
                    if ('schema' in dataSource.connection_details && dataSource.connection_details.schema === 'dra_pdf') {
                        try {
                            const tables = await dbConnector.query(
                                `SELECT table_name FROM information_schema.tables 
                                 WHERE table_schema = 'dra_pdf' 
                                 AND table_name LIKE '%_data_source_${dataSource.id}%'`
                            );                            
                            for (const table of tables) {
                                await dbConnector.query(
                                    `DROP TABLE IF EXISTS dra_pdf.${table.table_name}`
                                );
                            }
                        } catch (error) {
                            console.error(`Error deleting PDF tables:`, error);
                        }
                    }
                }                
                // Finally, remove the project
                await manager.remove(project);
                return resolve(true);
            } catch (error) {
                console.error(`Fatal error deleting project ${projectId}:`, error);
                return resolve(false);
            }
        });
    }
}