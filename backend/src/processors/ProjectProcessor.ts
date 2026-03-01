import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DBDriver } from "../drivers/DBDriver.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";
import { DRAProjectMember } from "../models/DRAProjectMember.js";
import { EProjectRole } from "../types/EProjectRole.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
export class ProjectProcessor {
    private static instance: ProjectProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
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
            
            // Use transaction to ensure both project and member entry are created
            let savedProjectId: number;
            await manager.transaction(async (transactionManager) => {
                const project = new DRAProject();
                project.name = project_name;
                project.description = description || '';
                project.users_platform = user;
                project.created_at = new Date();
                const savedProject = await transactionManager.save(project);
                savedProjectId = savedProject.id;
                
                // Create project member entry with owner role and Analyst marketing role
                const projectMember = new DRAProjectMember();
                projectMember.project = savedProject;
                projectMember.user = user;
                projectMember.role = EProjectRole.OWNER;
                projectMember.marketing_role = 'analyst';
                projectMember.added_at = new Date();
                await transactionManager.save(projectMember);
            });
            
            // Send notification
            await this.notificationHelper.notifyProjectCreated(user_id, savedProjectId!, project_name);
            
            return resolve(true);
        });
    }

    async getProjects(tokenDetails: ITokenDetails): Promise<any[]> {
        return new Promise<any[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            
            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver) {
                return resolve([]);
            }
            
            const manager = concreteDriver.manager;
            if (!manager) {
                return resolve([]);
            }
            
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve([]);
            }
            
            // Load owned projects
            const ownedProjects = await manager.find(DRAProject, {
                where: {users_platform: user},
                relations: {
                    users_platform: true,
                    data_sources: {
                        data_models: true
                    },
                    dashboards: true,
                    members: {
                        user: true
                    }
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    created_at: true,
                    users_platform: {
                        id: true
                    },
                    data_sources: {
                        id: true,
                        data_models: {
                            id: true
                        }
                    },
                    dashboards: {
                        id: true
                    },
                    members: {
                        id: true,
                        role: true,
                        marketing_role: true,
                        added_at: true,
                        user: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true
                        }
                    }
                }
            });
            
            // Load projects where user is a member (but not owner - those are loaded above)
            const memberProjects = await manager.find(DRAProjectMember, {
                where: {
                    user: {id: user_id}
                },
                relations: {
                    project: {
                        users_platform: true,
                        data_sources: {
                            data_models: true
                        },
                        dashboards: true,
                        members: {
                            user: true
                        }
                    }
                }
            });
            
            // Combine and deduplicate
            const allProjectsMap = new Map();
            
            // Add owned projects
            ownedProjects.forEach(project => {
                // Derive my_role from the member record for this user
                const myMember = project.members?.find(m => m.user?.id === user_id);
                allProjectsMap.set(project.id, {
                    ...project,
                    is_owner: true,
                    user_role: 'owner',
                    my_role: myMember?.marketing_role ?? 'analyst',
                });
            });
            
            // Add member projects (skip if already in map as owner)
            memberProjects.forEach(member => {
                if (!allProjectsMap.has(member.project.id)) {
                    allProjectsMap.set(member.project.id, {
                        ...member.project,
                        is_owner: false,
                        user_role: member.role,
                        my_role: member.marketing_role ?? 'cmo',
                    });
                }
            });
            
            // Transform to include counts
            const projectsWithCounts = Array.from(allProjectsMap.values()).map(project => ({
                id: project.id,
                user_platform_id: project.users_platform?.id || user_id,
                name: project.name,
                description: project.description,
                created_at: project.created_at,
                is_owner: project.is_owner,
                user_role: project.user_role,
                my_role: project.my_role ?? null,
                // Add counts
                data_sources_count: project.data_sources?.length || 0,
                data_models_count: project.data_sources?.reduce((sum, ds) => 
                    sum + (ds.data_models?.length || 0), 0) || 0,
                dashboards_count: project.dashboards?.length || 0,
                // Include full DataSources array for backward compatibility
                DataSources: project.data_sources,
                // Include members with user details
                members: project.members || []
            }));
            
            return resolve(projectsWithCounts);
        });
    }

    async deleteProject(projectId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const { user_id } = tokenDetails;
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) {
                    return resolve(false);
                }
                
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    return resolve(false);
                }
                
                const manager = concreteDriver.manager;
                if (!manager) {
                    return resolve(false);
                }
                
                const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
                if (!user) {
                    return resolve(false);
                }

                const project = await manager.findOne(DRAProject, {where: {id: projectId}, relations: ['data_sources', 'data_sources.data_models']});
                if (!project) {
                    return resolve(false);
                }
                
                // Use the already validated concreteDriver for query execution
                const dbConnector = concreteDriver;
                
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
                
                // Store project name for notification before deletion
                const projectName = project.name;
                
                // Get all project members to notify them
                const projectMembers = await manager.find(DRAProjectMember, {
                    where: { project: { id: projectId } },
                    relations: ['user']
                });
                
                // Finally, remove the project
                await manager.remove(project);
                
                // Send notifications to all project members
                for (const member of projectMembers) {
                    await this.notificationHelper.notifyProjectDeleted(member.user.id, projectName);
                }
                
                return resolve(true);
            } catch (error) {
                console.error(`Fatal error deleting project ${projectId}:`, error);
                return resolve(false);
            }
        });
    }
    /**
     * Get all members of a project.
     */
    public async getProjectMembers(projectId: number): Promise<any[]> {
        const { RBACService } = await import('../services/RBACService.js');
        return RBACService.getInstance().getProjectMembers(projectId);
    }

    /**
     * Add a member to a project with a specified role.
     */
    public async addProjectMember(projectId: number, userId: number, role: string, requestingUserId: number): Promise<any> {
        const { RBACService } = await import('../services/RBACService.js');
        return RBACService.getInstance().addMember(projectId, userId, role as any, requestingUserId);
    }

    /**
     * Update a member's role in a project.
     */
    public async updateProjectMemberRole(projectId: number, memberUserId: number, role: string, requestingUserId: number): Promise<boolean> {
        const { RBACService } = await import('../services/RBACService.js');
        return RBACService.getInstance().updateMemberRole(projectId, memberUserId, role as any, requestingUserId);
    }

    /**
     * Remove a member from a project.
     */
    public async removeProjectMember(projectId: number, memberUserId: number, requestingUserId: number): Promise<boolean> {
        const { RBACService } = await import('../services/RBACService.js');
        return RBACService.getInstance().removeMember(projectId, memberUserId, requestingUserId);
    }

    /**
     * Get a user's role in a project.
     */
    public async getUserProjectRole(userId: number, projectId: number): Promise<string | null> {
        const { RBACService } = await import('../services/RBACService.js');
        return RBACService.getInstance().getUserRole(userId, projectId);
    }

    /**
     * Set the marketing_role for a project member.
     *
     * Allowed values: 'cmo' | 'manager' | 'analyst' | null (clears the role).
     * The requesting user must have PROJECT_MANAGE_MEMBERS permission.
     */
    public async setMarketingRole(
        projectId: number,
        userId: number,
        marketingRole: string | null,
        requestingUserId: number,
    ): Promise<void> {
        const { RBACService } = await import('../services/RBACService.js');
        const { Permission } = await import('../constants/permissions.js');

        const canManage = await RBACService.getInstance().hasPermission(
            requestingUserId,
            projectId,
            Permission.PROJECT_MANAGE_MEMBERS,
        );
        if (!canManage) throw new Error('Insufficient permissions to set marketing role');

        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('PostgreSQL driver not available');

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) throw new Error('Failed to get PostgreSQL connection');

        const manager = concreteDriver.manager;

        const member = await manager.findOne(DRAProjectMember, {
            where: { project: { id: projectId }, user: { id: userId } },
        });
        if (!member) throw new Error('Member not found in this project');

        member.marketing_role = marketingRole;
        await manager.save(member);
    }

    /**
     * Get a user's full membership record for a project (includes marketing_role).
     *
     * Returns null if the user is not a member of the project.
     */
    public async getMyMembership(projectId: number, userId: number): Promise<{ role: string; marketing_role: string | null } | null> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('PostgreSQL driver not available');

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) throw new Error('Failed to get PostgreSQL connection');

        const manager = concreteDriver.manager;

        const member = await manager.findOne(DRAProjectMember, {
            where: {
                project: { id: projectId },
                user: { id: userId },
            },
        });

        if (!member) return null;

        return {
            role: member.role,
            marketing_role: member.marketing_role ?? null,
        };
    }
}
