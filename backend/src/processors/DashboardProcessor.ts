import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { SocketIODriver } from "../drivers/SocketIODriver.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { IDashboardChart, IDashboardDataStructure } from "../types/IDashboard.js";
import { IWidgetSpec } from "../types/IWidgetSpec.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAProjectMember } from "../models/DRAProjectMember.js";
import bcrypt  from 'bcryptjs';
import { UtilityService } from "../services/UtilityService.js";
import { DRADashboardExportMetaData } from "../models/DRADashboardExportMetaData.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import { AppDataSource } from "../datasources/PostgresDS.js";

export class DashboardProcessor {
    private static instance: DashboardProcessor;
    private notificationHelper: NotificationHelperService;
    
    private constructor() {
        this.notificationHelper = NotificationHelperService.getInstance();
    }

    public static getInstance(): DashboardProcessor {
        if (!DashboardProcessor.instance) {
            DashboardProcessor.instance = new DashboardProcessor();
        }
        return DashboardProcessor.instance;
    }

    async getDashboards(tokenDetails: ITokenDetails, organizationId: number | null = null): Promise<DRADashboard[]> {
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
            
            // 1. Get owned dashboards (non-template only)
            const ownedDashboards = await manager.find(DRADashboard, {
                where: {users_platform: user, is_template: false}, 
                relations: {
                    project: true,
                    users_platform: true,
                    export_meta_data: true
                }
            });
            
            // 2. Get dashboards from projects where user is a member (non-template only)
            const memberProjects = await manager.find(DRAProjectMember, {
                where: {user: {id: user_id}},
                relations: {
                    project: {
                        dashboards: {
                            project: true,
                            users_platform: true,
                            export_meta_data: true
                        }
                    }
                }
            });
            
            const memberDashboards = memberProjects.flatMap(m => (m.project?.dashboards || []).filter(d => !d.is_template));
            
            // 3. Combine and deduplicate
            const allDashboardsMap = new Map();
            
            ownedDashboards.forEach(d => {
                // Filter by organization_id if specified (check through project)
                if (organizationId !== null && d.project?.organization_id !== organizationId) {
                    return; // Skip dashboards not in the specified organization
                }
                allDashboardsMap.set(d.id, d);
            });
            
            memberDashboards.forEach(d => {
                // Filter by organization_id if specified (check through project)
                if (organizationId !== null && d.project?.organization_id !== organizationId) {
                    return; // Skip dashboards not in the specified organization
                }
                if (!allDashboardsMap.has(d.id)) {
                    allDashboardsMap.set(d.id, d);
                }
            });
            
            const dashboards = Array.from(allDashboardsMap.values());
            
            return resolve(dashboards);
        });
    }

    async addDashboard(projectId: number, data: IDashboardDataStructure, tokenDetails: ITokenDetails): Promise<boolean> {
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
                const savedDashboard = await manager.save(dashboard);
                
                // Send notification
                await this.notificationHelper.notifyDashboardCreated(user_id, savedDashboard.id, `Dashboard #${savedDashboard.id}`);
                
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(error);
            }
        });
    }
    async updateDashboard(dashboardId: number, projectId: number, data: IDashboardDataStructure, tokenDetails: ITokenDetails): Promise<boolean> {
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
            
            // First try to find dashboard owned by user
            let dashboard = await manager.findOne(DRADashboard, {where: {id: dashboardId, users_platform: user}});
            
            // If not owned by user, check if user is a member of the dashboard's project
            if (!dashboard) {
                dashboard = await manager.findOne(DRADashboard, {
                    where: {id: dashboardId},
                    relations: {project: true}
                });
                
                if (dashboard?.project) {
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: {id: user_id},
                            project: {id: dashboard.project.id}
                        }
                    });
                    
                    if (!membership) {
                        return resolve(false);
                    }
                } else {
                    return resolve(false);
                }
            }
            
            try {
                // TypeScript workaround for TypeORM deep partial type
                await manager.update(DRADashboard, {id: dashboardId}, {data: data as any});
                
                // Notification removed - notifyDashboardUpdated method not yet implemented
                // TODO: Implement notifyDashboardUpdated in NotificationHelperService
                
                // Emit Socket.IO event for cache invalidation
                try {
                    await SocketIODriver.getInstance().emitEvent('dashboard:updated', {
                        dashboardId: dashboardId,
                        projectId: projectId,
                        timestamp: new Date()
                    });
                } catch (socketError) {
                    console.warn('[DashboardProcessor] Failed to emit Socket.IO event:', socketError);
                }
                
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
            
            // First try to find dashboard owned by user
            let dashboard = await manager.findOne(DRADashboard, {where: {id: dashboardId, users_platform: user}});
            
            // If not owned by user, check if user is a member of the dashboard's project
            if (!dashboard) {
                dashboard = await manager.findOne(DRADashboard, {
                    where: {id: dashboardId},
                    relations: {project: true}
                });
                
                if (dashboard?.project) {
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: {id: user_id},
                            project: {id: dashboard.project.id}
                        }
                    });
                    
                    if (!membership) {
                        return resolve(false);
                    }
                } else {
                    return resolve(false);
                }
            }

            // Store dashboard info for notification and events
            const dashboardName = `Dashboard #${dashboard.id}`;
            const projectId = dashboard.project?.id;
            
            await manager.remove(dashboard);
            
            // Notification removed - notifyDashboardDeleted method not yet implemented
            // TODO: Implement notifyDashboardDeleted in NotificationHelperService
            
            // Emit Socket.IO event for cache invalidation
            try {
                await SocketIODriver.getInstance().emitEvent('dashboard:deleted', {
                    dashboardId: dashboardId,
                    projectId: projectId,
                    timestamp: new Date()
                });
            } catch (socketError) {
                console.warn('[DashboardProcessor] Failed to emit Socket.IO event:', socketError);
            }
            
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
            
            // First try to find dashboard owned by user
            let dashboard = await manager.findOne(DRADashboard, {where: {id: dashboardId, users_platform: user}});
            
            // If not owned by user, check if user is a member of the dashboard's project
            if (!dashboard) {
                dashboard = await manager.findOne(DRADashboard, {
                    where: {id: dashboardId},
                    relations: {project: true}
                });
                
                if (dashboard?.project) {
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: {id: user_id},
                            project: {id: dashboard.project.id}
                        }
                    });
                    
                    if (!membership) {
                        return resolve(null);
                    }
                } else {
                    return resolve(null);
                }
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
            const exportMetaDataExisting = await manager.findOne(DRADashboardExportMetaData, {
                where: {key: dashboardKey}, 
                relations: ['dashboard', 'dashboard.project']
            });
            if (exportMetaDataExisting && exportMetaDataExisting.expiry_at > new Date()) {
                return resolve(exportMetaDataExisting);
            }
            return resolve(null);
        });
    }

    /**
     * Execute a dynamic chart query for a dashboard widget.
     */
    public async executeChartQuery(dataModelId: number, query: string, queryParams?: any): Promise<any> {
        const { DashboardQueryService } = await import('../services/DashboardQueryService.js');
        return DashboardQueryService.getInstance().executeChartQuery(dataModelId, query, queryParams);
    }

    /**
     * Returns all dashboard templates (is_template = true).
     * Templates are visible to all authenticated users.
     */
    public async getTemplates(): Promise<DRADashboard[]> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return [];
        const manager = (await driver.getConcreteDriver()).manager;
        if (!manager) return [];
        return manager.find(DRADashboard, { where: { is_template: true } });
    }

    /**
     * Clone a dashboard template into a specific project for a user.
     * @param templateId - ID of the template dashboard (is_template must be true)
     * @param projectId  - Target project ID
     * @param userId     - Owner of the new cloned dashboard
     * @param newName    - Optional override for the cloned dashboard name
     */
    public async cloneDashboard(
        templateId: number,
        projectId: number,
        userId: number,
        newName?: string,
    ): Promise<DRADashboard | null> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return null;
        const manager = (await driver.getConcreteDriver()).manager;
        if (!manager) return null;

        const template = await manager.findOne(DRADashboard, { where: { id: templateId, is_template: true } });
        if (!template) return null;

        const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
        if (!user) return null;

        const project = await manager.findOne(DRAProject, { where: { id: projectId } });
        if (!project) return null;

        const newDashboard = manager.create(DRADashboard, {
            name: newName ?? (template.name ? `${template.name} (Copy)` : null),
            project,
            users_platform: user,
            data: JSON.parse(JSON.stringify(template.data)), // deep clone widget config
            is_template: false,
            source_template_id: templateId,
        });

        const saved = await manager.save(newDashboard);

        // Send notification
        await this.notificationHelper.notifyDashboardCreated(
            userId,
            saved.id,
            saved.name ?? `Dashboard #${saved.id}`,
        );

        return saved;
    }

    // =========================================================================
    // AI Insights widget helpers
    // =========================================================================

    /**
     * Return an existing dashboard by ID, or create a new one if dashboardId is
     * absent (or not found).  When creating, a name is required.
     */
    async resolveOrCreateDashboard(
        projectId: number,
        userId: number,
        dashboardId?: number,
        dashboardName?: string
    ): Promise<number> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;

        if (dashboardId) {
            const existing = await manager.findOne(DRADashboard, { where: { id: dashboardId } });
            if (existing) return existing.id;
        }

        // Create a new dashboard
        const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
        const project = await manager.findOne(DRAProject, { where: { id: projectId } });
        if (!user || !project) throw new Error('User or project not found');

        const name = dashboardName ?? `AI Insights Dashboard – ${new Date().toLocaleDateString()}`;
        const dashboard = manager.create(DRADashboard, {
            name,
            project,
            users_platform: user,
            data: { charts: [] },
            is_template: false,
        });
        const saved = await manager.save(dashboard);
        return saved.id;
    }

    /**
     * Append an AI-generated widget to a dashboard's JSONB charts array.
     * Returns the newly assigned chart_id.
     */
    async createAIWidget(
        params: {
            dashboardId: number;
            userId: number;
            spec: IWidgetSpec;
        }
    ): Promise<{ chartId: number }> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;

        const dashboard = await manager.findOne(DRADashboard, { where: { id: params.dashboardId } });
        if (!dashboard) throw new Error(`Dashboard ${params.dashboardId} not found`);

        const data: IDashboardDataStructure = (dashboard.data as IDashboardDataStructure) ?? { charts: [] };
        const charts: IDashboardChart[] = data.charts ?? [];

        // Generate a unique chart_id
        const maxId = charts.reduce((m, c) => Math.max(m, c.chart_id ?? 0), 0);
        const chartId = maxId + 1;

        const newChart: IDashboardChart = {
            chart_id: chartId,
            chart_type: params.spec.chart_type,
            columns: [],
            data: [],
            dimensions: { width: 6, height: 4 } as any,
            location: { x: 0, y: 0 } as any,
            x_axis_label: params.spec.x_axis ?? undefined,
            y_axis_label: params.spec.y_axis ?? undefined,
            source_type: 'ai_insights',
            ai_sql: params.spec.sql,
            ai_chart_spec: params.spec,
            created_by: params.userId,
        };

        charts.push(newChart);
        data.charts = charts;
        dashboard.data = data as any;
        await manager.save(dashboard);

        return { chartId };
    }

    /**
     * Find a single chart object in a dashboard's JSONB array by chart_id.
     */
    async getAIChart(
        dashboardId: number,
        chartId: number
    ): Promise<IDashboardChart | null> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;

        const dashboard = await manager.findOne(DRADashboard, { where: { id: dashboardId } });
        if (!dashboard) return null;

        const charts: IDashboardChart[] = (dashboard.data as any)?.charts ?? [];
        return charts.find(c => c.chart_id === chartId) ?? null;
    }

    /**
     * Execute the stored ai_sql for a widget, binding startDate ($1) and endDate ($2).
     * Returns the raw query rows to be formatted by the caller.
     */
    async getWidgetData(
        dashboardId: number,
        chartId: number,
        startDate: string,
        endDate: string
    ): Promise<any[]> {
        const chart = await this.getAIChart(dashboardId, chartId);
        if (!chart) throw new Error(`Chart ${chartId} not found in dashboard ${dashboardId}`);
        if (chart.source_type !== 'ai_insights' || !chart.ai_sql) {
            throw new Error('Widget does not have an AI SQL query');
        }

        const rows = await AppDataSource.manager.query(chart.ai_sql, [startDate, endDate]);
        return rows;
    }

    /**
     * Replace the SQL (and optionally the full spec) of an existing AI widget.
     * Only the chart owner (created_by) may call this.
     */
    async updateAIWidgetSQL(
        dashboardId: number,
        chartId: number,
        userId: number,
        spec: IWidgetSpec
    ): Promise<void> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;

        const dashboard = await manager.findOne(DRADashboard, { where: { id: dashboardId } });
        if (!dashboard) throw new Error(`Dashboard ${dashboardId} not found`);

        const charts: IDashboardChart[] = (dashboard.data as any)?.charts ?? [];
        const idx = charts.findIndex(c => c.chart_id === chartId);
        if (idx === -1) throw new Error(`Chart ${chartId} not found`);

        const chart = charts[idx];
        if (chart.created_by !== undefined && chart.created_by !== userId) {
            throw new Error('You do not have permission to update this widget');
        }

        charts[idx] = { ...chart, ai_sql: spec.sql, ai_chart_spec: spec, chart_type: spec.chart_type };
        (dashboard.data as any).charts = charts;
        await manager.save(dashboard);
    }
}
