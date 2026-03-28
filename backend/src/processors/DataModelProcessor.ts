import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { SocketIODriver } from "../drivers/SocketIODriver.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { UtilityService } from "../services/UtilityService.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DataSource, Brackets } from "typeorm";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRAProjectMember } from "../models/DRAProjectMember.js";
import { DRADataModelSource } from "../models/DRADataModelSource.js";
import { DRADataModelLineage } from "../models/DRADataModelLineage.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import type { IDataModelHealthReport } from '../types/IDataModelHealth.js';
import { DataSourceSQLHelpers } from './helpers/DataSourceSQLHelpers.js';
import { DataModelLayerService } from '../services/DataModelLayerService.js';
import { EDataLayer, ILayerValidationResult } from '../types/IDataLayer.js';

export class DataModelProcessor {
    private static instance: DataModelProcessor;
    private notificationHelper = NotificationHelperService.getInstance();
    private constructor() {}

    public static getInstance(): DataModelProcessor {
        if (!DataModelProcessor.instance) {
            DataModelProcessor.instance = new DataModelProcessor();
        }
        return DataModelProcessor.instance;
    }





    /**
     * Get the list of data models for a user in a specific project
     * @param projectId - The project ID to filter data models by
     * @param tokenDetails 
     * @returns list of data models for the project
     */
    async getDataModels(projectId: number, tokenDetails: ITokenDetails, organizationId: number | null = null): Promise<DRADataModel[]> {
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
            
            // Verify project exists - check if user is owner or member (RBAC)
            const projectWhere: any = {id: projectId, users_platform: user};
            if (organizationId !== null) {
                projectWhere.organization_id = organizationId;
            }
            const project = await manager.findOne(DRAProject, {
                where: projectWhere
            });
            
            // If user is not the owner, check if they are a project member
            if (!project) {
                const projectMember = await manager.findOne(DRAProjectMember, {
                    where: {
                        user: {id: user_id},
                        project: {id: projectId}
                    },
                    relations: {project: true}
                });
                
                // Also check organization context for member access
                if (!projectMember || (organizationId !== null && projectMember.project?.organization_id !== organizationId)) {
                    // User is neither owner nor member, or project not in specified organization - no access
                    return resolve([]);
                }
            }
            
            // Query data models filtering by project through data_source relationship
            // Include both single-source models (ds.project_id) and cross-source models (dms_ds.project_id)
            let queryBuilder = manager
                .createQueryBuilder(DRADataModel, 'dm')
                .leftJoinAndSelect('dm.data_source', 'ds')
                .leftJoinAndSelect('ds.project', 'ds_project')  // Load project for single-source models
                .leftJoinAndSelect('dm.users_platform', 'up')
                .leftJoinAndSelect('dm.data_model_sources', 'dms')
                .leftJoinAndSelect('dms.data_source', 'dms_ds')
                .leftJoinAndSelect('dms_ds.project', 'dms_ds_project')  // Load project for cross-source models
                .where(
                    new Brackets((qb) => {
                        // Single-source models: data_source.project_id matches
                        qb.where('ds.project_id = :projectId', { projectId })
                          // Cross-source models: any linked data source belongs to this project
                          .orWhere('dms_ds.project_id = :projectId', { projectId });
                    })
                );
            
            // Add organization filter if specified - check through project relationship
            if (organizationId !== null) {
                queryBuilder = queryBuilder.andWhere(
                    new Brackets((qb) => {
                        // For single-source models, check ds.project.organization_id
                        qb.where('ds_project.organization_id = :orgId', { orgId: organizationId })
                          // For cross-source models, check dms_ds.project.organization_id
                          .orWhere('dms_ds_project.organization_id = :orgId', { orgId: organizationId });
                    })
                );
            }
            
            const dataModels = await queryBuilder.getMany();
            
            return resolve(dataModels);
        });
    }

    /**
     * Delete a data model
     * @param dataModelId 
     * @param tokenDetails 
     * @returns true if the data model was deleted, false otherwise
     */
    public async deleteDataModel(dataModelId: number, tokenDetails: ITokenDetails, organizationId?: number, workspaceId?: number): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
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
                
                // First try to find data model owned by user
                let dataModel = await manager.findOne(DRADataModel, {where: {id: dataModelId, users_platform: user}});
                
                // If not owned by user, check if user is a member of the data model's project
                if (!dataModel) {
                    dataModel = await manager.findOne(DRADataModel, {
                        where: {id: dataModelId},
                        relations: {data_source: {project: true}}
                    });
                    
                    if (dataModel?.data_source?.project) {
                        const membership = await manager.findOne(DRAProjectMember, {
                            where: {
                                user: {id: user_id},
                                project: {id: dataModel.data_source.project.id}
                            }
                        });
                        
                        if (!membership) {
                            return resolve(false);
                        }
                    } else {
                        // Data model not associated with a project, user can't access it
                        return resolve(false);
                    }
                }
                
                // Verify organization/workspace ownership (if provided)
                if (organizationId && dataModel.organization_id !== organizationId) {
                    console.error(`[DataModelProcessor] Data model ${dataModelId} belongs to different organization (expected ${organizationId}, got ${dataModel.organization_id})`);
                    return resolve(false);
                }
                if (workspaceId && dataModel.workspace_id !== workspaceId) {
                    console.error(`[DataModelProcessor] Data model ${dataModelId} belongs to different workspace (expected ${workspaceId}, got ${dataModel.workspace_id})`);
                    return resolve(false);
                }
                
                // AUTO-POPULATE: If somehow null (legacy data), set from context
                if (!dataModel.organization_id && organizationId) {
                    console.warn(`[DataModelProcessor] Auto-populating NULL organization_id for data model ${dataModelId}`);
                    dataModel.organization_id = organizationId;
                }
                if (!dataModel.workspace_id && workspaceId) {
                    console.warn(`[DataModelProcessor] Auto-populating NULL workspace_id for data model ${dataModelId}`);
                    dataModel.workspace_id = workspaceId;
                }
                
                // Clean up dashboard references before deleting
                const dashboards = await manager.find(DRADashboard, {
                    where: {users_platform: user}
                });
                
                for (const dashboard of dashboards) {
                    let modified = false;
                    const updatedCharts = dashboard.data.charts.filter(chart => {
                        // Check if chart columns reference the deleted data model
                        const usesDeletedModel = chart.columns?.some(col => 
                            col.tableName === dataModel.name && 
                            col.schema === dataModel.schema
                        );
                        if (usesDeletedModel) {
                            modified = true;
                            console.log(`Removing chart ${chart.chart_id} from dashboard ${dashboard.id} (references deleted model)`);
                            return false; // Remove this chart
                        }
                        return true; // Keep this chart
                    });
                    
                    // If charts were removed, update the dashboard
                    if (modified) {
                        dashboard.data.charts = updatedCharts;
                        await manager.save(dashboard);
                        console.log(`Updated dashboard ${dashboard.id} to remove charts using deleted model`);
                    }
                }
                
                // Drop the physical table
                const dbConnector = await driver.getConcreteDriver();
                await dbConnector.query(`DROP TABLE IF EXISTS ${dataModel.schema}.${dataModel.name}`);
                
                // Store data model name and project ID for notification and events
                const dataModelName = dataModel.name;
                const projectId = dataModel.data_source?.project?.id;
                
                // Remove the data model record
                await manager.remove(dataModel);
                console.log(`Successfully deleted data model ${dataModelId}`);
                
                // Send notification
                await this.notificationHelper.notifyDataModelDeleted(user_id, dataModelName);
                
                // Emit Socket.IO event for cache invalidation
                try {
                    await SocketIODriver.getInstance().emitEvent('dataModel:deleted', {
                        dataModelId: dataModelId,
                        projectId: projectId,
                        timestamp: new Date()
                    });
                } catch (socketError) {
                    console.warn('[DataModelProcessor] Failed to emit Socket.IO event:', socketError);
                }
                
                return resolve(true);
            } catch (error) {
                console.error(`Fatal error deleting data model ${dataModelId}:`, error);
                return resolve(false);
            }
        });
    }

    /**
     * Copy/clone a data model with all its configuration
     * Creates a complete duplicate with a new unique name and ID
     * @param dataModelId - ID of data model to copy
     * @param tokenDetails - User authentication details
     * @returns New data model object if successful, null otherwise
     */
    public async copyDataModel(dataModelId: number, tokenDetails: ITokenDetails): Promise<DRADataModel | null> {
        return new Promise<DRADataModel | null>(async (resolve) => {
            try {
                const { user_id } = tokenDetails;
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) {
                    return resolve(null);
                }
                const dbConnector = await driver.getConcreteDriver();
                const manager = dbConnector.manager;
                if (!manager) {
                    return resolve(null);
                }
                
                // Verify user exists
                const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
                if (!user) {
                    return resolve(null);
                }
                
                // Fetch original data model with all relations
                let originalModel = await manager.findOne(DRADataModel, {
                    where: {id: dataModelId},
                    relations: ['data_source', 'data_source.project', 'data_model_sources', 'data_model_sources.data_source']
                });
                
                if (!originalModel) {
                    console.error(`Data model ${dataModelId} not found`);
                    return resolve(null);
                }
                
                // Verify user has READ permission on original model
                // Check if user owns the model or is a project member
                const isOwner = originalModel.users_platform?.id === user_id;
                let hasAccess = isOwner;
                
                if (!hasAccess && originalModel.data_source?.project) {
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: {id: user_id},
                            project: {id: originalModel.data_source.project.id}
                        }
                    });
                    hasAccess = !!membership;
                }
                
                if (!hasAccess) {
                    console.error(`User ${user_id} does not have permission to copy data model ${dataModelId}`);
                    return resolve(null);
                }
                
                // Generate new name with (Copy) suffix
                let baseName = originalModel.name.replace(/_dra_[a-zA-Z0-9_]+$/g, '');
                let copyName = baseName;
                let copyCount = 0;
                
                // Find existing copies to increment suffix
                const existingModels = await manager.find(DRADataModel, {
                    where: {
                        users_platform: user
                    }
                });
                
                const existingNames = existingModels.map(m => m.name.replace(/_dra_[a-zA-Z0-9_]+$/g, ''));
                
                // Check for "Copy", "Copy 2", etc. (without parentheses to avoid PostgreSQL table name issues)
                while (true) {
                    const testName = copyCount === 0 ? `${baseName} Copy` : `${baseName} Copy ${copyCount + 1}`;
                    if (!existingNames.includes(testName)) {
                        copyName = testName;
                        break;
                    }
                    copyCount++;
                }
                
                // Apply unique UUID suffix
                const uniqueName = UtilityService.getInstance().uniquiseName(copyName);
                
                // Create new data model record
                const newModel = new DRADataModel();
                newModel.name = uniqueName;
                newModel.schema = originalModel.schema;
                newModel.sql_query = originalModel.sql_query;
                newModel.query = originalModel.query;
                newModel.is_cross_source = originalModel.is_cross_source;
                newModel.execution_metadata = originalModel.execution_metadata || {};
                newModel.auto_refresh_enabled = originalModel.auto_refresh_enabled;
                newModel.users_platform = user;
                newModel.data_source = originalModel.data_source;
                
                // REQUIRED: Inherit organization_id and workspace_id from parent data_source (Phase 2)
                newModel.organization_id = originalModel.data_source.organization_id;
                newModel.workspace_id = originalModel.data_source.workspace_id;
                
                // Reset refresh-related fields
                newModel.last_refreshed_at = undefined;
                newModel.refresh_status = 'IDLE';
                newModel.refresh_error = undefined;
                newModel.row_count = undefined;
                newModel.last_refresh_duration_ms = undefined;
                
                // Save new model
                const savedModel = await manager.save(newModel);
                
                // Copy cross-source references if applicable
                if (originalModel.is_cross_source && originalModel.data_model_sources && originalModel.data_model_sources.length > 0) {
                    for (const source of originalModel.data_model_sources) {
                        const newSource = new DRADataModelSource();
                        newSource.data_model = savedModel;
                        newSource.data_source = source.data_source;
                        // REQUIRED: Inherit organization_id and workspace_id from parent data model (Phase 2)
                        newSource.organization_id = savedModel.organization_id;
                        newSource.workspace_id = savedModel.workspace_id;
                        newSource.users_platform_id = savedModel.users_platform.id;
                        await manager.save(newSource);
                    }
                }
                
                // Copy physical table structure and data
                try {
                    const originalTableName = `${originalModel.schema}.${originalModel.name}`;
                    const newTableName = `${newModel.schema}.${newModel.name}`;
                    
                    // Create table structure (including indexes, constraints, etc.)
                    await dbConnector.query(`CREATE TABLE ${newTableName} (LIKE ${originalTableName} INCLUDING ALL)`);
                    
                    // Copy data
                    await dbConnector.query(`INSERT INTO ${newTableName} SELECT * FROM ${originalTableName}`);
                    
                    console.log(`Successfully copied table from ${originalTableName} to ${newTableName}`);
                } catch (tableError) {
                    console.error('Error copying physical table:', tableError);
                    // Rollback: delete the model record if table copy failed
                    await manager.remove(savedModel);
                    throw new Error('Failed to copy physical table structure and data');
                }
                
                // Reload with relations for return
                const completeModel = await manager.findOne(DRADataModel, {
                    where: {id: savedModel.id},
                    relations: ['data_source', 'data_source.project', 'data_model_sources', 'data_model_sources.data_source', 'users_platform']
                });
                
                // Send notification
                const dataSourceName = originalModel.data_source?.name || 'Unknown Source';
                await this.notificationHelper.notifyDataModelCreated(user_id, savedModel.id, copyName, dataSourceName);
                
                console.log(`Successfully copied data model ${dataModelId} to ${savedModel.id}`);
                return resolve(completeModel);
                
            } catch (error) {
                console.error('Error copying data model:', error);
                return resolve(null);
            }
        });
    }

    /**
     * Refresh data model by re-executing stored query against external data source
     * Drops existing table and recreates with latest data
     * @param dataModelId - ID of data model to refresh
     * @param tokenDetails - User authentication details
     * @returns true if refresh successful, false otherwise
     */
    public async refreshDataModel(dataModelId: number, tokenDetails: ITokenDetails): Promise<boolean> {
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
            
            // Retrieve existing data model with relations
            // First try to find data model owned by user
            let existingDataModel = await manager.findOne(DRADataModel, {
                where: {id: dataModelId, users_platform: user},
                relations: ['data_source']
            });
            
            // If not owned by user, check if user is a member of the data model's project
            if (!existingDataModel) {
                existingDataModel = await manager.findOne(DRADataModel, {
                    where: {id: dataModelId},
                    relations: {data_source: {project: true}}
                });
                
                if (existingDataModel?.data_source?.project) {
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: {id: user_id},
                            project: {id: existingDataModel.data_source.project.id}
                        }
                    });
                    
                    if (!membership) {
                        console.error(`Data model ${dataModelId} found but user ${user_id} is not a project member`);
                        return resolve(false);
                    }
                    
                    // Reload with data_source relation for subsequent use
                    existingDataModel = await manager.findOne(DRADataModel, {
                        where: {id: dataModelId},
                        relations: ['data_source']
                    });
                } else {
                    console.error(`Data model ${dataModelId} not found or not associated with a project`);
                    return resolve(false);
                }
            }
            
            if (!existingDataModel) {
                console.error(`Data model ${dataModelId} not found or user ${user_id} does not have permission`);
                return resolve(false);
            }
            
            // Extract stored query parameters
            const dataSourceId = existingDataModel.data_source.id;
            const storedQuery = existingDataModel.sql_query;
            const storedQueryJSON = JSON.stringify(existingDataModel.query);
            const currentName = existingDataModel.name;
            
            // Extract base name without the UUID suffix (dra_name_uuid -> name)
            let baseDataModelName = currentName;
            baseDataModelName = baseDataModelName.replace(/_dra_.*/g, '');
            
            // Reuse existing updateDataModelOnQuery logic to refresh the data
            const refreshResult = await this.updateDataModelOnQuery(
                dataSourceId,
                dataModelId,
                storedQuery,
                storedQueryJSON,
                baseDataModelName,
                tokenDetails
            );           
            return resolve(refreshResult);
        });
    }

    /**
     * Detect circular dependencies in data model composition (Issue #361 - Issue #9)
     * Performs BFS traversal to check if any parent model's lineage path leads back to the child.
     * This prevents infinite recursion and ensures data model composition graph is a DAG (Directed Acyclic Graph).
     * 
     * @param childDataModelId - The ID of the child data model being created/updated
     * @param parentDataModelIds - Array of parent data model IDs that the child depends on
     * @param manager - TypeORM entity manager
     * @returns true if circular dependency detected, false otherwise (non-blocking)
     */
    private async detectCircularDependency(
        childDataModelId: number,
        parentDataModelIds: number[],
        manager: any
    ): Promise<boolean> {
        if (parentDataModelIds.length === 0) {
            return false;
        }

        try {
            // BFS to traverse lineage graph and detect cycles
            const visited = new Set<number>();
            const queue: number[] = [...parentDataModelIds];

            while (queue.length > 0) {
                const currentModelId = queue.shift()!;

                // If we've reached the child model, we have a cycle
                if (currentModelId === childDataModelId) {
                    console.warn(
                        `[DataModelProcessor] ⚠️ CIRCULAR DEPENDENCY DETECTED: ` +
                        `Data model ${childDataModelId} cannot depend on parents ${parentDataModelIds.join(', ')} ` +
                        `because one of them already depends on ${childDataModelId}`
                    );
                    return true;
                }

                // Skip already visited nodes to prevent infinite loops
                if (visited.has(currentModelId)) {
                    continue;
                }

                visited.add(currentModelId);

                // Fetch this model's parents (traverse one level up)
                const lineages = await manager.find(DRADataModelLineage, {
                    where: { child_data_model_id: currentModelId },
                });

                // Add all parents to queue for further traversal
                for (const lineage of lineages) {
                    queue.push(lineage.parent_data_model_id);
                }
            }

            return false; // No cycle detected
        } catch (error) {
            console.error('[DataModelProcessor] Error detecting circular dependency:', error);
            return false; // Non-blocking - allow operation to continue
        }
    }

    /**
     * Detect and store data model lineage (Issue #361 - Data Model Composition)
     * Identifies when a data model is built from other data models by parsing the query JSON
     * and tracking parent-child relationships.
     * 
     * @param queryJSON - The serialized query JSON
     * @param childDataModelId - The ID of the child data model being created/updated
     * @param manager - The TypeORM EntityManager for database operations
     */
    public async detectDataModelLineage(
        queryJSON: string,
        childDataModelId: number,
        manager: any
    ): Promise<void> {
        try {
            const parsedQuery = JSON.parse(queryJSON);
            const dataModelTableNames = new Set<string>();

            // Extract all unique data model table names from columns
            if (parsedQuery.columns && Array.isArray(parsedQuery.columns)) {
                for (const column of parsedQuery.columns) {
                    const tableName = column.table_name;
                    const schema = column.schema;
                    
                    // Data model tables: schema='public' and name matches 'data_model_*_UUID'
                    if (schema === 'public' && tableName && tableName.startsWith('data_model_')) {
                        dataModelTableNames.add(tableName);
                    }
                }
            }

            if (dataModelTableNames.size === 0) {
                // No data model dependencies, ensure uses_data_models is false
                await manager.update(DRADataModel, { id: childDataModelId }, { uses_data_models: false });
                return;
            }

            // Fetch parent data models
            const parentModels = await manager
                .getRepository(DRADataModel)
                .createQueryBuilder('dm')
                .where('dm.name IN (:...names)', { names: Array.from(dataModelTableNames) })
                .getMany();

            // Delete existing lineage (for refresh scenarios)
            await manager.delete(DRADataModelLineage, { child_data_model_id: childDataModelId });

            // Issue #361 #9: Check for circular dependencies before inserting lineage
            const parentIds = parentModels.map(p => p.id);
            const hasCircularDependency = await this.detectCircularDependency(childDataModelId, parentIds, manager);
            
            if (hasCircularDependency) {
                console.error(
                    `[DataModelProcessor] Circular dependency prevented for data model ${childDataModelId}. ` +
                    `Skipping lineage insertion. Parent models: ${parentIds.join(', ')}`
                );
                // Mark as NOT using data models to prevent stale state
                await manager.update(DRADataModel, { id: childDataModelId }, { uses_data_models: false });
                return;
            }

            // Insert lineage records
            const lineageRecords = parentModels.map(parent => ({
                child_data_model_id: childDataModelId,
                parent_data_model_id: parent.id,
                parent_data_model_name: parent.name,
                parent_last_refreshed_at: parent.last_refreshed_at || null,
            }));

            if (lineageRecords.length > 0) {
                await manager.insert(DRADataModelLineage, lineageRecords);
                console.log(`[DataModelProcessor] Stored lineage for data model ${childDataModelId}: ${lineageRecords.length} parent(s)`);
            }

            // Update uses_data_models flag
            const usesDataModels = lineageRecords.length > 0;
            await manager.update(DRADataModel, { id: childDataModelId }, { uses_data_models: usesDataModels });
        } catch (error) {
            console.error('[DataModelProcessor] Error detecting data model lineage:', error);
            // Don't throw - lineage tracking is non-critical, shouldn't break model creation
        }
    }

    /**
     * Validate layer requirements and optionally get recommendations (Issue #361)
     * 
     * @param layer - The assigned data layer (or null for recommendation only)
     * @param queryJSON - The query JSON string
     * @param validate - Whether to validate layer requirements (throws on error)
     * @returns Validation result with issues and optional layer recommendation
     */
    public async validateDataModelLayer(
        layer: EDataLayer | null,
        queryJSON: string,
        validate: boolean = true
    ): Promise<{ 
        validation: ILayerValidationResult | null;
        recommendation: { layer: EDataLayer; reasoning: string; confidence: string } | null;
    }> {
        const layerService = DataModelLayerService.getInstance();
        const parsedQuery = JSON.parse(queryJSON);

        let validation: ILayerValidationResult | null = null;
        let recommendation: { layer: EDataLayer; reasoning: string; confidence: string } | null = null;

        // If layer is specified, validate it
        if (layer && validate) {
            validation = layerService.validateLayerRequirements(layer, parsedQuery);

            // Log validation results
            if (validation.valid) {
                console.log(`[DataModelProcessor] Layer validation passed for ${layer}`);
            } else {
                const errorIssues = validation.issues.filter(i => i.severity === 'error');
                console.error(`[DataModelProcessor] Layer validation failed for ${layer}:`, errorIssues.map(i => i.message).join(', '));
                
                // Throw validation error if configured to validate
                if (errorIssues.length > 0) {
                    throw new Error(`Data layer validation failed: ${errorIssues.map(i => i.message).join('; ')}`);
                }
            }
        }

        // Always provide recommendation (useful for UX)
        recommendation = layerService.recommendLayer(parsedQuery);
        console.log(`[DataModelProcessor] Layer recommendation: ${recommendation.layer} (${recommendation.confidence} confidence) - ${recommendation.reasoning}`);

        return { validation, recommendation };
    }

    /**
     * Validate layer flow for data model composition (Issue #361)
     * Ensures layer progression follows best practices (Raw → Clean → Business)
     * 
     * @param currentLayer - The layer of the current model
     * @param childDataModelId - The ID of the child data model
     * @param manager - TypeORM entity manager
     * @returns Flow validation result with warnings
     */
    public async validateLayerFlow(
        currentLayer: EDataLayer | null,
        childDataModelId: number,
        manager: any
    ): Promise<{ isStandardFlow: boolean; warnings: string[] }> {
        if (!currentLayer) {
            return { isStandardFlow: true, warnings: [] };
        }

        // Get source data models for this child model
        const sourceModels = await manager
            .createQueryBuilder(DRADataModel, 'sourceModel')
            .innerJoin(DRADataModelLineage, 'lineage', 'lineage.parent_data_model_id = sourceModel.id')
            .where('lineage.child_data_model_id = :childId', { childId: childDataModelId })
            .select(['sourceModel.id', 'sourceModel.name', 'sourceModel.data_layer'])
            .getMany();

        const layerService = DataModelLayerService.getInstance();
        const flowValidation = layerService.validateLayerFlow(currentLayer, sourceModels);

        if (flowValidation.warnings.length > 0) {
            console.warn(`[DataModelProcessor] Layer flow warnings for data model ${childDataModelId}:`, flowValidation.warnings);
        } else {
            console.log(`[DataModelProcessor] Layer flow validation passed for data model ${childDataModelId}`);
        }

        return flowValidation;
    }

    /**
     * Get layer composition recommendations (Issue #361: Phase 5)
     * Analyzes source data models and suggests appropriate layer for composed model
     * 
     * @param sourceDataModelIds - Array of source data model IDs to be composed
     * @param userId - User ID for access control
     * @returns Recommendation with suggested layer, reasoning, and flow warnings
     */
    public async getCompositionLayerRecommendation(
        sourceDataModelIds: number[],
        userId: number
    ): Promise<{
        suggestedLayer: EDataLayer;
        reasoning: string;
        sourceModels: Array<{
            id: number;
            name: string;
            layer: EDataLayer | null;
        }>;
        flowWarnings: string[];
    }> {
        const { AppDataSource } = await import('../datasources/PostgresDS.js');
        const manager = AppDataSource.manager;

        // Fetch source models with their layers
        const sourceModels = await manager
            .createQueryBuilder(DRADataModel, 'dm')
            .where('dm.id IN (:...ids)', { ids: sourceDataModelIds })
            .select(['dm.id', 'dm.name', 'dm.data_layer'])
            .getMany();

        if (sourceModels.length === 0) {
            throw new Error('No source models found');
        }

        // Determine suggested layer based on source model layers
        let suggestedLayer: EDataLayer;
        let reasoning: string;

        const sourceLayers = sourceModels
            .map(m => m.data_layer)
            .filter((layer): layer is EDataLayer => layer !== null);

        if (sourceLayers.length === 0) {
            // All sources unclassified - suggest Clean Data (reasonable default for composition)
            suggestedLayer = EDataLayer.CLEAN_DATA;
            reasoning = 'Sources are unclassified. Clean Data (Silver) is recommended for composed models that combine multiple sources.';
        } else {
            // Find the highest layer among sources using layer progression
            const layerOrder: Record<EDataLayer, number> = {
                [EDataLayer.RAW_DATA]: 1,
                [EDataLayer.CLEAN_DATA]: 2,
                [EDataLayer.BUSINESS_READY]: 3,
            };

            const maxSourceLayerLevel = Math.max(...sourceLayers.map(l => layerOrder[l]));
            const maxSourceLayer = Object.entries(layerOrder).find(([, level]) => level === maxSourceLayerLevel)?.[0] as EDataLayer;

            // Suggest next layer up (composition should progress forward)
            if (maxSourceLayer === EDataLayer.BUSINESS_READY) {
                suggestedLayer = EDataLayer.BUSINESS_READY;
                reasoning = 'Sources include Business Ready (Gold) models. Composed model should also be Business Ready to maintain analytics-ready status.';
            } else if (maxSourceLayer === EDataLayer.CLEAN_DATA) {
                suggestedLayer = EDataLayer.BUSINESS_READY;
                reasoning = 'Sources include Clean Data (Silver) models. Composing them with joins/aggregations creates Business Ready (Gold) data.';
            } else {
                // Raw Data sources
                suggestedLayer = EDataLayer.CLEAN_DATA;
                reasoning = 'Sources include Raw Data (Bronze) models. Composition with transformations creates Clean Data (Silver).';
            }
        }

        // Check for flow warnings using the suggested layer
        const layerService = DataModelLayerService.getInstance();
        const flowValidation = layerService.validateLayerFlow(suggestedLayer, sourceModels);

        console.log(`[DataModelProcessor] Composition recommendation: ${suggestedLayer} - ${reasoning}`);
        if (flowValidation.warnings.length > 0) {
            console.warn(`[DataModelProcessor] Flow warnings:`, flowValidation.warnings);
        }

        return {
            suggestedLayer,
            reasoning,
            sourceModels: sourceModels.map(m => ({
                id: m.id,
                name: m.name,
                layer: m.data_layer,
            })),
            flowWarnings: flowValidation.warnings,
        };
    }

    /**
     * Get all unclassified data models in a project with AI layer recommendations (Issue #361: Phase 4)
     * Used by the migration wizard to help users classify existing models
     * 
     * @param projectId - The project ID to filter models
     * @param userId - The user ID requesting recommendations (for access control)
     * @param organizationId - Optional organization context
     * @returns Array of models with their AI recommendations
     */
    public async getLayerMigrationCandidates(
        projectId: number,
        userId: number,
        organizationId: number | null = null
    ): Promise<Array<{
        id: number;
        name: string;
        model_type: string | null;
        row_count: number | null;
        health_status: string | null;
        created_at: Date;
        recommendation: {
            layer: EDataLayer;
            confidence: string;
            reasoning: string;
        };
    }>> {
        const { AppDataSource } = await import('../datasources/PostgresDS.js');
        const manager = AppDataSource.manager;

        // Get all data models for this project (reuses access control from getDataModels)
        const tokenDetails: ITokenDetails = { user_id: userId } as ITokenDetails;
        const dataModels = await this.getDataModels(projectId, tokenDetails, organizationId);

        // Filter to only unclassified models (data_layer is NULL)
        const unclassifiedModels = dataModels.filter(dm => dm.data_layer === null);

        if (unclassifiedModels.length === 0) {
            return [];
        }

        console.log(`[DataModelProcessor] Found ${unclassifiedModels.length} unclassified models in project ${projectId}`);

        // Generate recommendations for each model
        const layerService = DataModelLayerService.getInstance();
        const candidates: Array<any> = [];

        for (const model of unclassifiedModels) {
            try {
                const parsedQuery = typeof model.query === 'string' 
                    ? JSON.parse(model.query) 
                    : model.query;

                const recommendation = layerService.recommendLayer(parsedQuery);

                candidates.push({
                    id: model.id,
                    name: model.name,
                    model_type: model.model_type,
                    row_count: model.row_count,
                    health_status: model.health_status,
                    created_at: model.created_at,
                    recommendation: {
                        layer: recommendation.layer,
                        confidence: recommendation.confidence,
                        reasoning: recommendation.reasoning,
                    },
                });
            } catch (error) {
                console.error(`[DataModelProcessor] Failed to generate recommendation for model ${model.id}:`, error);
                // Skip models with invalid queries
            }
        }

        console.log(`[DataModelProcessor] Generated ${candidates.length} recommendations`);
        return candidates;
    }

    /**
     * Bulk assign layers to multiple data models (Issue #361: Phase 4)
     * Used by the migration wizard to apply layer classifications in bulk
     * 
     * @param assignments - Array of { dataModelId, layer } assignments
     * @param userId - The user ID performing the assignment (for access control)
     * @returns Summary of successful and failed assignments
     */
    public async bulkAssignLayers(
        assignments: Array<{ dataModelId: number; layer: EDataLayer }>,
        userId: number
    ): Promise<{
        success: number;
        failed: number;
        errors: Array<{ dataModelId: number; error: string }>;
    }> {
        const { AppDataSource } = await import('../datasources/PostgresDS.js');
        const manager = AppDataSource.manager;

        let successCount = 0;
        let failedCount = 0;
        const errors: Array<{ dataModelId: number; error: string }> = [];

        console.log(`[DataModelProcessor] Starting bulk layer assignment: ${assignments.length} models`);

        for (const assignment of assignments) {
            try {
                // Fetch the data model with access control check
                const dataModel = await manager.findOne(DRADataModel, {
                    where: { id: assignment.dataModelId },
                    relations: ['data_source', 'data_source.project', 'users_platform'],
                });

                if (!dataModel) {
                    throw new Error('Data model not found');
                }

                // Verify user has access (either owner or project member)
                const hasAccess = 
                    dataModel.users_platform?.id === userId ||
                    (await this.hasProjectAccess(dataModel, userId, manager));

                if (!hasAccess) {
                    throw new Error('Access denied');
                }

                // Validate the layer assignment (non-blocking - warnings only)
                const layerService = DataModelLayerService.getInstance();
                const parsedQuery = typeof dataModel.query === 'string' 
                    ? JSON.parse(dataModel.query) 
                    : dataModel.query;

                const validation = layerService.validateLayerRequirements(assignment.layer, parsedQuery);

                // Log validation warnings but don't block assignment
                if (!validation.valid) {
                    const warnings = validation.issues.filter(i => i.severity === 'warning');
                    if (warnings.length > 0) {
                        console.warn(
                            `[DataModelProcessor] Layer assignment for model ${assignment.dataModelId} has warnings:`,
                            warnings.map(w => w.message).join('; ')
                        );
                    }
                }

                // Update the data model with new layer
                await manager.update(DRADataModel, 
                    { id: assignment.dataModelId },
                    { 
                        data_layer: assignment.layer,
                        layer_config: null, // Reset custom config on bulk assignment
                    }
                );

                // Recompute health status with new layer
                const { DataModelHealthService } = await import('../services/DataModelHealthService.js');
                await DataModelHealthService.getInstance().recomputeAndPersist(assignment.dataModelId);

                successCount++;
                console.log(`[DataModelProcessor] Assigned layer ${assignment.layer} to model ${assignment.dataModelId}`);

            } catch (error: any) {
                failedCount++;
                errors.push({
                    dataModelId: assignment.dataModelId,
                    error: error.message || 'Unknown error',
                });
                console.error(`[DataModelProcessor] Failed to assign layer to model ${assignment.dataModelId}:`, error);
            }
        }

        console.log(`[DataModelProcessor] Bulk assignment complete: ${successCount} succeeded, ${failedCount} failed`);

        return {
            success: successCount,
            failed: failedCount,
            errors,
        };
    }

    /**
     * Helper: Check if user has access to a data model via project membership
     */
    private async hasProjectAccess(
        dataModel: DRADataModel,
        userId: number,
        manager: any
    ): Promise<boolean> {
        // Get project ID from the data model's data source
        const projectId = dataModel.data_source?.project?.id;
        if (!projectId) {
            return false;
        }

        // Check if user is a project member
        const projectMember = await manager.findOne(DRAProjectMember, {
            where: {
                user: { id: userId },
                project: { id: projectId },
            },
        });

        return !!projectMember;
    }

    /**
     * Update dependent data models when a parent model's table name changes
     * This handles the cascade update of SQL queries and lineage when a data model is rebuilt with a new name
     * 
     * @param parentModelId - The ID of the parent data model that was rebuilt
     * @param oldTableName - The old table name (with old UUID)
     * @param newTableName - The new table name (with new UUID)
     * @param manager - TypeORM entity manager
     */
    private async updateDependentDataModels(
        parentModelId: number,
        oldTableName: string,
        newTableName: string,
        manager: any
    ): Promise<void> {
        try {
            // Find all child data models that reference this parent
            const childLineages = await manager.find(DRADataModelLineage, {
                where: { parent_data_model_id: parentModelId },
            });

            if (childLineages.length === 0) {
                console.log(`[DataModelProcessor] No dependent models found for ${oldTableName}`);
                return;
            }

            console.log(`[DataModelProcessor] Found ${childLineages.length} dependent model(s) to update`);

            for (const lineage of childLineages) {
                const childModel = await manager.findOne(DRADataModel, {
                    where: { id: lineage.child_data_model_id },
                });

                if (!childModel) {
                    console.warn(`[DataModelProcessor] Child model ${lineage.child_data_model_id} not found, skipping`);
                    continue;
                }

                // Update SQL query - replace all occurrences of old table name with new table name
                let updatedSqlQuery = childModel.sql_query;
                let updatedQueryJSON = JSON.stringify(childModel.query);

                // Replace in SQL query (handle quoted and unquoted table references)
                const quotedOldName = `"${oldTableName}"`;
                const quotedNewName = `"${newTableName}"`;
                updatedSqlQuery = updatedSqlQuery
                    .replace(new RegExp(quotedOldName, 'g'), quotedNewName)
                    .replace(new RegExp(`\\b${oldTableName}\\b`, 'g'), newTableName);

                // Replace in query JSON (columns and table references)
                updatedQueryJSON = updatedQueryJSON
                    .replace(new RegExp(oldTableName, 'g'), newTableName);

                // Parse and update the query object
                const updatedQuery = JSON.parse(updatedQueryJSON);

                // Update the child data model with new references
                await manager.update(DRADataModel, 
                    { id: childModel.id },
                    {
                        sql_query: updatedSqlQuery,
                        query: updatedQuery,
                    }
                );

                // Update lineage record with new parent table name
                await manager.update(DRADataModelLineage,
                    { id: lineage.id },
                    { parent_data_model_name: newTableName }
                );

                console.log(`[DataModelProcessor] ✅ Updated dependent model: "${childModel.name}" (ID: ${childModel.id})`);
                console.log(`[DataModelProcessor]    Replaced "${oldTableName}" → "${newTableName}"`);
            }

            console.log(`[DataModelProcessor] Successfully updated ${childLineages.length} dependent model(s)`);

        } catch (error: any) {
            console.error('[DataModelProcessor] Error updating dependent data models:', error.message);
            // Don't throw - this is a non-critical operation, shouldn't break the parent model rebuild
        }
    }

    /**
     * Check if a data model is stale (Issue #361 - Data Model Composition)
     * A data model is stale if any of its parent data models have been refreshed
     * since the child was last refreshed.
     * 
     * @param dataModelId - The ID of the data model to check
     * @param tokenDetails - User authentication details
     * @returns Object containing staleness status and list of stale parent models
     */
    async checkDataModelStaleness(
        dataModelId: number,
        tokenDetails: ITokenDetails
    ): Promise<{
        isStale: boolean;
        staleParents: Array<{ id: number; name: string; lastRefreshed: Date }>;
    }> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            return { isStale: false, staleParents: [] };
        }
        const manager = (await driver.getConcreteDriver()).manager;
        if (!manager) {
            return { isStale: false, staleParents: [] };
        }

        const dataModel = await manager.findOne(DRADataModel, {
            where: { id: dataModelId },
        });

        if (!dataModel || !dataModel.uses_data_models) {
            return { isStale: false, staleParents: [] };
        }

        const lineages = await manager.find(DRADataModelLineage, {
            where: { child_data_model_id: dataModelId },
        });

        if (lineages.length === 0) {
            return { isStale: false, staleParents: [] };
        }

        // Fetch all parent data models
        const parentIds = lineages.map(l => l.parent_data_model_id);
        const parentModels = await manager
            .getRepository(DRADataModel)
            .createQueryBuilder('dm')
            .whereInIds(parentIds)
            .getMany();

        const staleParents = [];
        for (const lineage of lineages) {
            const parent = parentModels.find(p => p.id === lineage.parent_data_model_id);
            if (!parent) continue;

            const parentLastRefresh = parent.last_refreshed_at || parent.created_at;
            const childLastRefresh = dataModel.last_refreshed_at || dataModel.created_at;

            if (parentLastRefresh > childLastRefresh) {
                staleParents.push({
                    id: parent.id,
                    name: parent.name,
                    lastRefreshed: parentLastRefresh
                });
            }
        }

        return {
            isStale: staleParents.length > 0,
            staleParents
        };
    }

    /**
     * Get all data models in a project formatted as source tables (Issue #361 - Data Model Composition)
     * Returns data models in the same format as source tables, so they can be displayed
     * in the data model builder sidebar and used as sources for new data models.
     * 
     * @param projectId - The project ID to fetch data models from
     * @param tokenDetails - User authentication details
     * @returns Array of data models formatted as IDataModelTable objects
     */
    async getDataModelsAsSourceTables(
        projectId: number,
        tokenDetails: ITokenDetails
    ): Promise<any[]> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            return [];
        }
        const manager = (await driver.getConcreteDriver()).manager;
        if (!manager) {
            return [];
        }

        // Fetch all data models in the project
        const dataModels = await this.getDataModels(projectId, tokenDetails);
        
        const modelTables: any[] = [];

        for (const model of dataModels) {
            try {
                // Get columns from the physical data model table
                const columns = await manager.query(
                    `SELECT column_name, data_type, character_maximum_length
                     FROM information_schema.columns
                     WHERE table_schema = $1 AND table_name = $2
                     ORDER BY ordinal_position`,
                    [model.schema, model.name]
                );

                // Extract display name from physical table name
                // Format: data_model_<readable_name>_<uuid>
                const displayName = model.name
                    .replace(/^data_model_/, '')
                    .replace(/_[a-f0-9-]+$/, '')
                    .replace(/_/g, ' ')
                    .split(' ')
                    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                modelTables.push({
                    table_name: model.name,
                    logical_name: `[Data Model] ${displayName}`,
                    schema: model.schema,
                    table_type: 'data_model',
                    columns: columns.map((col: any) => ({
                        column_name: col.column_name,
                        data_type: col.data_type,
                        character_maximum_length: col.character_maximum_length || null,
                        table_name: model.name,
                        schema: model.schema,
                        alias_name: '',
                        data_model_id: model.id  // Add this for identification
                    })),
                    data_model_id: model.id,
                    is_cross_source: model.is_cross_source || false,
                    last_refreshed_at: model.last_refreshed_at,
                    row_count: model.row_count || 0,
                    health_status: model.health_status,
                    model_type: model.model_type,
                    source_row_count: model.source_row_count
                });
            } catch (error) {
                console.error(`[DataModelProcessor] Error fetching columns for data model ${model.id}:`, error);
                // Skip this model and continue with others
                continue;
            }
        }

        return modelTables;
    }

    /**
     * Update the data model on query
     * @param dataSourceId 
     * @param dataModelId 
     * @param query 
     * @param queryJSON 
     * @param dataModelName 
     * @param tokenDetails 
     * @returns true if the data model was updated, false otherwise
     */
    public async updateDataModelOnQuery(dataSourceId: number, dataModelId: number, query: string, queryJSON: string, dataModelName: string, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            const internalDbConnector = await driver.getConcreteDriver();
            if (!internalDbConnector) {
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

            // CROSS-SOURCE DETECTION: Parse query to identify involved data sources
            let isCrossSource = false;
            let involvedDataSourceIds = new Set<number>();
            try {
                const sourceTable = JSON.parse(queryJSON);
                if (sourceTable.columns && Array.isArray(sourceTable.columns)) {
                    sourceTable.columns.forEach((column: any) => {
                        if (column.data_source_id) {
                            involvedDataSourceIds.add(column.data_source_id);
                        }
                    });
                }
                isCrossSource = involvedDataSourceIds.size > 1;
                console.log(`[DataModelProcessor] Cross-source detection: ${isCrossSource ? 'YES' : 'NO'}, sources: ${Array.from(involvedDataSourceIds).join(', ')}`);
            } catch (error) {
                console.error('[DataModelProcessor] Error parsing queryJSON for cross-source detection:', error);
            }

            // First try to find data source owned by user
            let dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}, relations: ['data_models']});
            
            // If not owned by user, check if user is a member of the data source's project
            if (!dataSource) {
                dataSource = await manager.findOne(DRADataSource, {
                    where: {id: dataSourceId},
                    relations: {project: true, data_models: true}
                });
                
                if (dataSource?.project) {
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: {id: user_id},
                            project: {id: dataSource.project.id}
                        }
                    });
                    
                    if (!membership) {
                        return resolve(false);
                    }
                } else {
                    // Data source not associated with a project, user can't access it
                    return resolve(false);
                }
            }
            const connection = dataSource.connection_details;
            // Skip API-based data sources (like Google Analytics) - they don't support data models
            if ('oauth_access_token' in connection) {
                return resolve(false);
            }
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(false);
            }
            
            // API-integrated sources (Excel, PDF) and synced MongoDB store data in PostgreSQL
            // Use internal PostgreSQL connection instead of connecting to external DB
            let externalDBConnector: DataSource;
            const fileBasedTypes = ['excel', 'pdf', 'csv'];
            const isFileBased = fileBasedTypes.includes(dataSourceType.toLowerCase());
            const isSyncedMongoDB = dataSource.data_type === EDataSourceType.MONGODB && 
                                    dataSource.sync_status === 'completed' && 
                                    dataSource.last_sync_at;
            
            if (isFileBased || isSyncedMongoDB) {
                // Use internal PostgreSQL connection where synced/imported data lives
                console.log(`[DataModelProcessor] Using internal PostgreSQL for ${isSyncedMongoDB ? 'synced MongoDB' : 'file-based'} source: ${dataSourceType}`);
                externalDBConnector = internalDbConnector;
            } else {
                // Connect to external database for regular data sources (or non-synced MongoDB)
                const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
                if (!externalDriver) {
                    return resolve(false);
                }
                try {
                    externalDBConnector = await externalDriver.connectExternalDB(connection);
                    if (!externalDBConnector) {
                        return resolve(false);
                    }
                } catch (error) {
                    console.log('Error connecting to external DB', error);
                    return resolve(false);
                }
            }
            const existingDataModel = dataSource.data_models.find(model => model.id === dataModelId);
            if (!existingDataModel) {
                return resolve(false);
            }
            await internalDbConnector.query(`DROP TABLE IF EXISTS ${existingDataModel.schema}.${existingDataModel.name}`);
            try {
                dataModelName = UtilityService.getInstance().uniquiseName(dataModelName);
                
                // CRITICAL FIX: Always reconstruct SQL from JSON for data model updates
                // The frontend buildSQLQuery() generates different column aliases than what the
                // INSERT code expects. For single-table queries, frontend uses "tableName_col"
                // but INSERT code looks up rows by "schema_tableName_col". Reconstructing from
                // JSON ensures aliases match the INSERT row key format, preventing null data.
                // This also ensures proper GROUP BY inclusion from group_by_columns array.
                let selectTableQuery: string;
                try {
                    selectTableQuery = DataSourceSQLHelpers.reconstructSQLFromJSON(queryJSON);
                    
                    // Preserve LIMIT/OFFSET from original query if not in reconstructed SQL
                    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
                    const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
                    if (limitMatch && !selectTableQuery.toUpperCase().includes('LIMIT')) {
                        selectTableQuery += ` LIMIT ${limitMatch[1]}`;
                    }
                    if (offsetMatch && !selectTableQuery.toUpperCase().includes('OFFSET')) {
                        selectTableQuery += ` OFFSET ${offsetMatch[1]}`;
                    }
                    
                    console.log('[DataModelProcessor] Reconstructed SQL for data model update:', selectTableQuery);
                } catch (reconstructError) {
                    console.error('[DataModelProcessor] SQL reconstruction failed, falling back to frontend SQL:', reconstructError);
                    selectTableQuery = `${query}`;
                }
                
                // PRE-FLIGHT CHECK: Count rows before materializing to enforce threshold
                // Dimensional tables bypass this check entirely
                console.log('[DataModelProcessor] Running pre-flight row count check...');
                const { DataModelHealthService } = await import('../services/DataModelHealthService.js');
                const healthService = DataModelHealthService.getInstance();
                const { maxOutputRows } = await healthService.loadThresholds();
                
                if (existingDataModel.model_type !== 'dimension') {
                    const countQuery = `SELECT COUNT(*) as row_count FROM (${selectTableQuery}) AS count_check`;
                    const countResult = await externalDBConnector.query(countQuery);
                    const rowCount = parseInt(countResult[0]?.row_count || countResult[0]?.count || '0', 10);
                    
                    console.log(`[DataModelProcessor] Pre-flight row count: ${rowCount}, Threshold: ${maxOutputRows}`);
                    
                    if (rowCount > maxOutputRows) {
                        console.warn(`[DataModelProcessor] Blocking data model update: ${rowCount} rows exceeds threshold ${maxOutputRows}`);
                        const { DataModelOversizedException } = await import('../types/errors/DataModelOversizedException.js');
                        throw new DataModelOversizedException({
                            modelId: dataModelId,
                            modelName: dataModelName,
                            rowCount: rowCount,
                            sourceRowCount: rowCount,
                            healthStatus: 'blocked',
                            healthIssues: [{
                                code: 'FULL_TABLE_SCAN_LARGE_SOURCE',
                                severity: 'error',
                                title: 'Output row count exceeds the platform limit',
                                description: `Output row count (${rowCount.toLocaleString()}) exceeds platform limit (${maxOutputRows.toLocaleString()})`,
                                recommendation: 'Add aggregation or filtering to reduce row count',
                            }],
                            threshold: maxOutputRows,
                        });
                    }
                } else {
                    console.log('[DataModelProcessor] Dimensional table detected - skipping row count validation');
                }
                
                const rowsFromDataSource = await externalDBConnector.query(selectTableQuery);
                //Create the table first then insert the data.
                let createTableQuery = `CREATE TABLE ${dataModelName} `;
                const sourceTable = JSON.parse(queryJSON);
                
                // CRITICAL FIX: Filter columns for table creation but preserve full array in saved query JSON
                // Only create table columns for: selected columns OR hidden referenced columns
                const columnsForTableCreation = sourceTable.columns.filter((col: any) => {
                    // Include if selected for display
                    if (col.is_selected_column) return true;
                    
                    // Include if tracked as hidden reference (aggregate, GROUP BY, WHERE, HAVING, ORDER BY, etc.)
                    const isTracked = sourceTable.hidden_referenced_columns?.some(
                        (tracked: any) => tracked.schema === col.schema &&
                                   tracked.table_name === col.table_name &&
                                   tracked.column_name === col.column_name
                    );
                    return isTracked;
                });
                
                console.log(`[DataModelProcessor] Column preservation: Total=${sourceTable.columns.length}, ForTable=${columnsForTableCreation.length}`);
                
                let columns = '';
                let insertQueryColumns = '';
                columnsForTableCreation.forEach((column: any, index: number) => {
                    const columnSize = column?.character_maximum_length ? `(${column?.character_maximum_length})` : '';
                    // Check if column.data_type already contains size information (e.g., "varchar(1024)")
                    // If it does, don't append columnSize again to avoid "VARCHAR(1024)(1024)"
                    const dataTypeAlreadyHasSize = column.data_type && /\(\s*\d+(?:,\d+)?\s*\)/.test(column.data_type);
                    const columnType = dataTypeAlreadyHasSize ? column.data_type : `${column.data_type}${columnSize}`;

                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(dataSourceType, columnType);
                    let dataTypeString = '';
                    if (dataType.size) {
                        dataTypeString = `${dataType.type}(${dataType.size})`;
                    } else {
                        dataTypeString = `${dataType.type}`;
                    }
                    
                    // Override data type if transform function is applied
                    if (column.transform_function) {
                        const transformFunc = column.transform_function.toUpperCase();
                        if (transformFunc === 'DATE') {
                            dataTypeString = 'DATE';
                        } else if (transformFunc === 'YEAR' || transformFunc === 'MONTH' || transformFunc === 'DAY') {
                            dataTypeString = 'INTEGER';
                        } else if (transformFunc === 'UPPER' || transformFunc === 'LOWER' || transformFunc === 'TRIM') {
                            dataTypeString = 'TEXT';
                        } else if (transformFunc === 'ROUND') {
                            dataTypeString = 'NUMERIC';
                        }
                    }
                    
                    // Determine column name - use alias if provided, otherwise construct from schema_table_column
                    let columnName;
                    if (column.alias_name && column.alias_name !== '') {
                        columnName = column.alias_name;
                    } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_mongodb' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_meta_ads' || column.schema === 'dra_linkedin_ads' || column.schema === 'dra_hubspot' || column.schema === 'dra_klaviyo')) {
                        // For special schemas (Excel, PDF, MongoDB, GA, GAM, Google Ads, Meta Ads, LinkedIn Ads, HubSpot, Klaviyo), always use table_name regardless of aliases
                        // This preserves datasource IDs in table names (e.g., device_15, sheet_123, campaigns_42)
                        columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                    } else {
                        columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                    }
                    
                    if (index < columnsForTableCreation.length - 1) {
                        columns += `${columnName} ${dataTypeString}, `;
                        insertQueryColumns += `${columnName},`;
                    } else {
                        columns += `${columnName} ${dataTypeString} `;
                        insertQueryColumns += `${columnName}`;
                    }
                });
                // Handle calculated columns
                if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                    columns += ', ';
                    insertQueryColumns += ', ';
                    sourceTable.calculated_columns.forEach((column: any, index: number) => {
                        if (index < sourceTable.calculated_columns.length - 1) {
                            columns += `${column.column_name} NUMERIC, `;
                            insertQueryColumns += `${column.column_name}, `;
                        } else {
                            columns += `${column.column_name} NUMERIC`;
                            insertQueryColumns += `${column.column_name}`;
                        }
                    });
                }
                
                // Handle GROUP BY aggregate function columns
                if (sourceTable.query_options?.group_by?.aggregate_functions && sourceTable.query_options.group_by.aggregate_functions.length > 0) {
                    const aggregateFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
                    const validAggFuncs = sourceTable.query_options.group_by.aggregate_functions.filter(
                        (aggFunc: any) => aggFunc.aggregate_function !== '' && aggFunc.column !== ''
                    );
                    
                    if (validAggFuncs.length > 0) {
                        // Only add comma if there's content before (regular columns always exist, or calculated columns were added)
                        columns += ', ';
                        insertQueryColumns += ', ';
                        
                        validAggFuncs.forEach((aggFunc: any, index: number) => {
                            // Determine column alias name
                            let aliasName = aggFunc.column_alias_name;
                            if (!aliasName || aliasName === '') {
                                const columnParts = aggFunc.column.split('.');
                                const columnName = columnParts[columnParts.length - 1];
                                aliasName = `${aggregateFunctions[aggFunc.aggregate_function]}_${columnName}`.toLowerCase();
                            }
                            
                            // Add column to CREATE TABLE statement
                            if (index < validAggFuncs.length - 1) {
                                columns += `${aliasName} NUMERIC, `;
                                insertQueryColumns += `${aliasName}, `;
                            } else {
                                columns += `${aliasName} NUMERIC`;
                                insertQueryColumns += `${aliasName}`;
                            }
                        });
                    }
                }
                
                // Handle GROUP BY aggregate expressions (complex expressions like quantity * price, CASE statements)
                if (sourceTable.query_options?.group_by?.aggregate_expressions && 
                    sourceTable.query_options.group_by.aggregate_expressions.length > 0) {
                    const validExpressions = sourceTable.query_options.group_by.aggregate_expressions.filter(
                        (expr: any) => expr.column_alias_name && expr.column_alias_name !== ''
                    );
                    
                    if (validExpressions.length > 0) {
                        columns += ', ';
                        insertQueryColumns += ', ';
                        
                        validExpressions.forEach((expr: any, index: number) => {
                            const aliasName = expr.column_alias_name;
                            
                            // CRITICAL: Use column_data_type if provided (inferred from expression), otherwise default to NUMERIC
                            let dataTypeString = 'NUMERIC';
                            if (expr.column_data_type && expr.column_data_type !== '') {
                                // Map frontend data types to PostgreSQL types
                                const exprType = expr.column_data_type.toLowerCase();
                                if (exprType === 'text' || exprType.includes('char') || exprType.includes('varchar')) {
                                    dataTypeString = 'TEXT';
                                } else if (exprType === 'numeric' || exprType === 'decimal' || exprType.includes('int')) {
                                    dataTypeString = 'NUMERIC';
                                } else if (exprType === 'boolean') {
                                    dataTypeString = 'BOOLEAN';
                                } else if (exprType.includes('timestamp') || exprType.includes('date')) {
                                    dataTypeString = exprType.toUpperCase();
                                } else {
                                    dataTypeString = expr.column_data_type.toUpperCase();
                                }
                                console.log(`[DataModelProcessor] Using inferred data type for aggregate expression ${aliasName}: ${dataTypeString} (from ${expr.column_data_type})`);
                            }
                            
                            if (index < validExpressions.length - 1) {
                                columns += `${aliasName} ${dataTypeString}, `;
                                insertQueryColumns += `${aliasName}, `;
                            } else {
                                columns += `${aliasName} ${dataTypeString}`;
                                insertQueryColumns += `${aliasName}`;
                            }
                        });
                    }
                }
                
                createTableQuery += `(${columns})`;
                await internalDbConnector.query(createTableQuery);
                insertQueryColumns = `(${insertQueryColumns})`;
                
                // Track column data types for proper value formatting
                const columnDataTypes = new Map<string, string>();
                columnsForTableCreation.forEach((column: any) => {
                    // Use same column name construction logic as INSERT loop to ensure key match
                    let columnName;
                    if (column.alias_name && column.alias_name !== '') {
                        columnName = column.alias_name;
                    } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_mongodb' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_meta_ads' || column.schema === 'dra_linkedin_ads' || column.schema === 'dra_hubspot' || column.schema === 'dra_klaviyo')) {
                        // For special schemas (Excel, PDF, MongoDB, GA, GAM, Google Ads, Meta Ads, LinkedIn Ads, HubSpot, Klaviyo), always use table_name regardless of aliases
                        columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                    } else {
                        columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                    }
                    const columnSize = column?.character_maximum_length ? `(${column?.character_maximum_length})` : '';
                    // Check if column.data_type already contains size information (e.g., "varchar(1024)")
                    // If it does, don't append columnSize again to avoid "VARCHAR(1024)(1024)"
                    const dataTypeAlreadyHasSize = column.data_type && /\(\s*\d+(?:,\d+)?\s*\)/.test(column.data_type);
                    const columnType = dataTypeAlreadyHasSize ? column.data_type : `${column.data_type}${columnSize}`;
                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(dataSourceType, columnType);
                    let dataTypeString = '';
                    if (dataType.size) {
                        dataTypeString = `${dataType.type}(${dataType.size})`;
                    } else {
                        dataTypeString = `${dataType.type}`;
                    }
                    
                    // Override data type if transform function is applied
                    if (column.transform_function) {
                        const transformFunc = column.transform_function.toUpperCase();
                        if (transformFunc === 'DATE') {
                            dataTypeString = 'DATE';
                        } else if (transformFunc === 'YEAR' || transformFunc === 'MONTH' || transformFunc === 'DAY') {
                            dataTypeString = 'INTEGER';
                        } else if (transformFunc === 'UPPER' || transformFunc === 'LOWER' || transformFunc === 'TRIM') {
                            dataTypeString = 'TEXT';
                        } else if (transformFunc === 'ROUND') {
                            dataTypeString = 'NUMERIC';
                        }
                    }
                    
                    columnDataTypes.set(columnName, dataTypeString);
                });
                
                // Add aggregate expressions to columnDataTypes map
                if (sourceTable.query_options?.group_by?.aggregate_expressions) {
                    sourceTable.query_options.group_by.aggregate_expressions.forEach((expr: any) => {
                        if (expr.column_alias_name && expr.column_alias_name !== '') {
                            // Use column_data_type if provided, otherwise default to NUMERIC
                            const dataType = expr.column_data_type || 'NUMERIC';
                            columnDataTypes.set(expr.column_alias_name, dataType.toUpperCase());
                            console.log(`[DataModelProcessor] Set data type for aggregate expression ${expr.column_alias_name}: ${dataType}`);
                        }
                    });
                }
                
                let failedInserts = 0;
                for (let index = 0; index < rowsFromDataSource.length; index++) {
                    const row = rowsFromDataSource[index];
                    let insertQuery = `INSERT INTO ${dataModelName} `;
                    let values = '';
                    columnsForTableCreation.forEach((column: any, columnIndex: number) => {
                        // Determine row key - use alias if provided for data lookup
                        let rowKey;
                        let columnName;
                        if (column.alias_name && column.alias_name !== '') {
                            rowKey = column.alias_name;
                            columnName = column.alias_name;
                        } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_mongodb' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_meta_ads' || column.schema === 'dra_linkedin_ads' || column.schema === 'dra_hubspot' || column.schema === 'dra_klaviyo')) {
                            // For special schemas (Excel, PDF, MongoDB, GA, GAM, Google Ads, Meta Ads, LinkedIn Ads, HubSpot, Klaviyo), always use table_name regardless of aliases
                            // This preserves datasource IDs in table names and ensures frontend-backend consistency
                            columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                            rowKey = columnName;
                        } else {
                            columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                            // When alias is empty, frontend generates alias as schema_table_column
                            rowKey = `${column.schema}_${column.table_name}_${column.column_name}`;
                        }
                        
                        // Get the column data type and format the value accordingly
                        const columnType = columnDataTypes.get(columnName) || 'TEXT';
                        
                        // Log JSON/JSONB/DATE columns for debugging (first row only)
                        if ((columnType.toUpperCase().includes('JSON') || 
                             columnType.toUpperCase().includes('DATE') || 
                             columnType.toUpperCase().includes('TIME') || 
                             columnType.toUpperCase().includes('TIMESTAMP')) && 
                            index === 0) {
                            console.log(`Column ${columnName} (${columnType}):`, typeof row[rowKey], row[rowKey]);
                        }
                        
                        const formattedValue = DataSourceSQLHelpers.formatValueForSQL(row[rowKey], columnType, columnName);
                        
                        if (columnIndex < columnsForTableCreation.length - 1) {
                            values += `${formattedValue},`;
                        } else {
                            values += formattedValue;
                        }
                    });
                    // Handle calculated column values - use formatValueForSQL for proper type handling
                    if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                        values += ',';
                        sourceTable.calculated_columns.forEach((column: any, columnIndex: number) => {
                            const columnName = column.column_name;
                            const formattedVal = DataSourceSQLHelpers.formatValueForSQL(row[columnName], 'NUMERIC', columnName);
                            if (columnIndex < sourceTable.calculated_columns.length - 1) {
                                values += `${formattedVal},`;
                            } else {
                                values += `${formattedVal}`;
                            }
                        });
                    }
                    
                    // Handle aggregate function values - use formatValueForSQL for proper type handling
                    if (sourceTable.query_options?.group_by?.aggregate_functions && sourceTable.query_options.group_by.aggregate_functions.length > 0) {
                        const aggregateFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
                        const validAggFuncs = sourceTable.query_options.group_by.aggregate_functions.filter(
                            (aggFunc: any) => aggFunc.aggregate_function !== '' && aggFunc.column !== ''
                        );
                        
                        if (validAggFuncs.length > 0) {
                            values += ',';
                            validAggFuncs.forEach((aggFunc: any, columnIndex: number) => {
                                let aliasName = aggFunc.column_alias_name;
                                let rowKey = aliasName; // Key to lookup in row data
                                
                                if (!aliasName || aliasName === '') {
                                    // When no alias is provided, PostgreSQL uses lowercase function name as column name
                                    const funcName = aggregateFunctions[aggFunc.aggregate_function].toLowerCase();
                                    rowKey = funcName; // PostgreSQL default: 'sum', 'avg', 'count', 'min', 'max'
                                    
                                    // Generate alias for table column name
                                    const columnParts = aggFunc.column.split('.');
                                    const columnName = columnParts[columnParts.length - 1];
                                    aliasName = `${funcName}_${columnName}`.toLowerCase();
                                }
                                
                                const formattedVal = DataSourceSQLHelpers.formatValueForSQL(row[rowKey], 'NUMERIC', aliasName);
                                if (columnIndex < validAggFuncs.length - 1) {
                                    values += `${formattedVal},`;
                                } else {
                                    values += `${formattedVal}`;
                                }
                            });
                        }
                    }
                    
                    // Handle aggregate expression values - use formatValueForSQL with inferred data type
                    if (sourceTable.query_options?.group_by?.aggregate_expressions && 
                        sourceTable.query_options.group_by.aggregate_expressions.length > 0) {
                        const validExpressions = sourceTable.query_options.group_by.aggregate_expressions.filter(
                            (expr: any) => expr.column_alias_name && expr.column_alias_name !== ''
                        );
                        
                        if (validExpressions.length > 0) {
                            values += ',';
                            validExpressions.forEach((expr: any, index: number) => {
                                const aliasName = expr.column_alias_name;
                                const exprDataType = columnDataTypes.get(aliasName) || 'NUMERIC';
                                const formattedVal = DataSourceSQLHelpers.formatValueForSQL(row[aliasName], exprDataType, aliasName);
                                
                                if (index < validExpressions.length - 1) {
                                    values += `${formattedVal},`;
                                } else {
                                    values += `${formattedVal}`;
                                }
                            });
                        }
                    }
                    
                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                    try {
                        await internalDbConnector.query(insertQuery);
                    } catch (insertError: any) {
                        failedInserts++;
                        if (failedInserts <= 3) {
                            console.error(`[DataModelProcessor] INSERT failed for row ${index}:`, insertError?.message || insertError);
                            console.error(`[DataModelProcessor] Failed query:`, insertQuery.substring(0, 500));
                        }
                    }
                }
                const successfulInserts = rowsFromDataSource.length - failedInserts;
                console.log(`[DataModelProcessor] Inserted ${successfulInserts}/${rowsFromDataSource.length} rows into ${dataModelName} (${failedInserts} failed)`);

                // ── Issue #4: compute and persist health status on every save ──────
                let healthStatus: string = 'unknown';
                let healthIssues: Record<string, any>[] = [];
                let sourceRowCount: number | null = null;
                try {
                    const { DataModelHealthService } = await import('../services/DataModelHealthService.js');
                    const { EPlatformSettingKey } = await import('../models/DRAPlatformSettings.js');
                    const { PlatformSettingsProcessor } = await import('./PlatformSettingsProcessor.js');

                    const settingsProc = PlatformSettingsProcessor.getInstance();
                    const [maxRows, largeThreshold] = await Promise.all([
                        settingsProc.getSetting<number>(EPlatformSettingKey.MAX_DATA_MODEL_ROWS),
                        settingsProc.getSetting<number>(EPlatformSettingKey.LARGE_SOURCE_TABLE_THRESHOLD),
                    ]);
                    const maxOutputRows = maxRows ?? 50000;
                    const largeSourceThreshold = largeThreshold ?? 100000;

                    const healthSvc = DataModelHealthService.getInstance();
                    const queryParsed = JSON.parse(queryJSON);
                    const sourceMeta = await healthSvc.resolveSourceTableMeta(queryParsed);
                    sourceRowCount = sourceMeta.reduce((s, t) => s + (t.rowCount ?? 0), 0);

                    const report = healthSvc.analyse(
                        queryParsed,
                        (existingDataModel.model_type ?? null) as any,
                        sourceMeta,
                        maxOutputRows,
                        largeSourceThreshold,
                        existingDataModel.data_layer as EDataLayer | null,
                    );

                    healthStatus = report.status;
                    healthIssues = report.issues;

                    // Authoritative output-row-count override: if the actual result set
                    // exceeds the threshold, force blocked even if structure looked fine.
                    // Dimensional tables bypass this check.
                    if (existingDataModel.model_type !== 'dimension' && maxOutputRows > 0 && rowsFromDataSource.length > maxOutputRows) {
                        healthStatus = 'blocked';
                        const overrideIssue = {
                            code: 'ROW_COUNT_EXCEEDS_THRESHOLD',
                            severity: 'error',
                            title: 'Output row count exceeds the platform limit',
                            description: `This model produced ${rowsFromDataSource.length.toLocaleString()} rows, which exceeds the configured limit of ${maxOutputRows.toLocaleString()}.`,
                            recommendation: `Add aggregation or tighter WHERE filters to reduce the output. Alternatively an admin can raise the 'max_data_model_rows' platform setting.`,
                        };
                        // Avoid duplicating if structural analysis already produced a block
                        if (!healthIssues.some((i: any) => i.code === 'ROW_COUNT_EXCEEDS_THRESHOLD')) {
                            healthIssues = [...healthIssues, overrideIssue];
                        }
                    }
                } catch (healthError) {
                    console.warn('[DataModelProcessor] Health analysis failed — model saved with health_status=unknown:', healthError);
                }

                // Detect data model lineage (Issue #361 - Data Model Composition)
                await this.detectDataModelLineage(queryJSON, existingDataModel.id, manager);

                // CRITICAL: Update dependent data models if table name changed
                const oldTableName = existingDataModel.name;
                const newTableName = dataModelName;
                if (oldTableName !== newTableName) {
                    console.log(`[DataModelProcessor] Table name changed from "${oldTableName}" to "${newTableName}", updating dependent models...`);
                    await this.updateDependentDataModels(existingDataModel.id, oldTableName, newTableName, manager);
                }

                // Issue #361: Validate layer if assigned (optional, non-blocking) and get recommendation
                let layerRecommendation: any = null;
                if (existingDataModel.data_layer) {
                    try {
                        const { validation, recommendation } = await this.validateDataModelLayer(
                            existingDataModel.data_layer as EDataLayer,
                            queryJSON,
                            false // validate=false for non-blocking validation on query updates
                        );

                        layerRecommendation = recommendation;

                        // Log warnings if layer doesn't match query structure
                        if (validation && !validation.valid) {
                            const warnings = validation.issues.filter(i => i.severity === 'warning');
                            if (warnings.length > 0) {
                                console.warn(`[DataModelProcessor] Layer warnings for ${existingDataModel.data_layer}:`, warnings.map(i => i.message));
                            }
                        }

                        // Validate layer flow if model uses other data models
                        if (existingDataModel.uses_data_models) {
                            const flowValidation = await this.validateLayerFlow(
                                existingDataModel.data_layer as EDataLayer,
                                existingDataModel.id,
                                manager
                            );

                            // Store flow warnings in health_issues for visibility
                            if (!flowValidation.isStandardFlow && flowValidation.warnings.length > 0) {
                                healthIssues = [
                                    ...healthIssues,
                                    ...flowValidation.warnings.map(w => ({
                                        code: 'NON_STANDARD_LAYER_FLOW',
                                        severity: 'warning' as const,
                                        title: 'Non-standard layer flow detected',
                                        description: w,
                                        recommendation: 'Consider restructuring your data model composition to follow the standard Raw → Clean → Business pattern'
                                    }))
                                ];
                            }
                        }
                    } catch (layerError) {
                        console.warn('[DataModelProcessor] Layer validation error (non-critical):', layerError);
                    }
                } else {
                    // No layer assigned - just get recommendation
                    try {
                        const { recommendation } = await this.validateDataModelLayer(null, queryJSON, false);
                        layerRecommendation = recommendation;
                        console.log(`[DataModelProcessor] Layer recommendation for unlayered model: ${recommendation?.layer}`);
                    } catch (recError) {
                        console.warn('[DataModelProcessor] Layer recommendation error:', recError);
                    }
                }

                await manager.update(DRADataModel, {id: existingDataModel.id}, {
                    schema: 'public',
                    name: dataModelName,
                    sql_query: selectTableQuery,
                    query: JSON.parse(queryJSON),
                    row_count: rowsFromDataSource.length,
                    last_refreshed_at: new Date(),
                    health_status: healthStatus as any,
                    health_issues: healthIssues,
                    source_row_count: sourceRowCount,
                });
                
                // Emit Socket.IO event for cache invalidation
                try {
                    await SocketIODriver.getInstance().emitEvent('dataModel:refreshed', {
                        dataModelId: existingDataModel.id,
                        projectId: dataSource?.project?.id,
                        timestamp: new Date()
                    });
                } catch (socketError) {
                    console.warn('[DataModelProcessor] Failed to emit Socket.IO event:', socketError);
                }
                
                return resolve(true);
            } catch (error: any) {
                console.log('error', error);
                
                // CRITICAL: If this is a DataModelOversizedException, reject with it so the route can return HTTP 422
                if (error?.name === 'DataModelOversizedException') {
                    return reject(error);
                }
                
                return resolve(false);
            }
        });
    }

    /**
     * Get the list of tables from data models that have been created in the project database
     * @param projectId 
     * @param tokenDetails 
     * @returns list of tables from data models that have been created in the project database
     */
    public async getTablesFromDataModels(projectId: number, tokenDetails: ITokenDetails, includeRows: boolean = false): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
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
            
            // Try to find owned project first
            let project: DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}, relations: ['data_sources', 'data_sources.data_models', 'data_sources.project', 'users_platform']});
            
            // If not owned, check if user is a project member
            if (!project) {
                const membership = await manager.findOne(DRAProjectMember, {
                    where: {user: {id: user_id}, project: {id: projectId}},
                    relations: ['project', 'project.data_sources', 'project.data_sources.data_models']
                });
                
                if (membership?.project) {
                    project = membership.project;
                }
            }
            
            if (!project) {
                return resolve([]);
            }
            
            // Get ALL data models for the project (including cross-source models)
            // Use query builder to handle both single-source AND cross-source models
            const allDataModels = await manager
                .createQueryBuilder(DRADataModel, 'dm')
                .leftJoinAndSelect('dm.data_source', 'ds')
                .leftJoinAndSelect('ds.project', 'ds_project')
                .leftJoinAndSelect('dm.data_model_sources', 'dms')
                .leftJoinAndSelect('dms.data_source', 'dms_ds')
                .leftJoinAndSelect('dms_ds.project', 'dms_ds_project')
                .where(
                    new Brackets((qb) => {
                        // Single-source models: data_source.project_id matches
                        qb.where('ds.project_id = :projectId', { projectId })
                          // Cross-source models: any linked data source belongs to this project
                          .orWhere('dms_ds.project_id = :projectId', { projectId });
                    })
                )
                .getMany();
            
            console.log(`[DataModelProcessor] Found ${allDataModels.length} total data models for project ${projectId}`);
            allDataModels.forEach((dm, idx) => {
                console.log(`  DataModel [${idx}] ID:${dm.id}, Name:${dm.name}, Schema:${dm.schema}, DataSource:${dm.data_source?.id || 'NULL (cross-source)'}, IsCrossSource:${dm.is_cross_source || false}`);
            });
            
            const dataSources: DRADataSource[] = project.data_sources;
            let tables:any[] = [];
            
            // Separate single-source and cross-source models
            const singleSourceModels = allDataModels.filter(dm => dm.data_source !== null && dm.data_source !== undefined);
            const crossSourceModels = allDataModels.filter(dm => dm.is_cross_source === true || dm.data_source === null);
            
            console.log(`[DataModelProcessor] Processing ${singleSourceModels.length} single-source and ${crossSourceModels.length} cross-source models`);
            
            // Process each data source to get the table schemas for single-source models
            for (let i=0; i<dataSources.length; i++) {
                const dataSource = dataSources[i];
                
                // Get all single-source data models for this data source
                const dataModelsForSource = singleSourceModels.filter(dm => dm.data_source?.id === dataSource.id);
                
                if (dataModelsForSource.length === 0) {
                    continue;
                }
                
                const dataModelsTableNames = dataModelsForSource.map((dataModel) => {
                    return {
                        data_model_id: dataModel.id,
                        schema: dataModel.schema,
                        table_name: dataModel.name,
                        is_cross_source: false
                    }
                })
                if (dataModelsTableNames?.length === 0) {
                    continue;
                }
                let query = `SELECT tb.table_catalog, tb.table_schema, tb.table_name, co.column_name, co.data_type, co.character_maximum_length
                    FROM information_schema.tables AS tb
                    JOIN information_schema.columns AS co
                    ON tb.table_name = co.table_name
                    AND tb.table_type = 'BASE TABLE'`;
                if (dataModelsTableNames?.length) {
                    query += ` AND tb.table_name IN (${dataModelsTableNames.map((model) => `'${model.table_name}'`).join(',')})`;
                    query += ` AND tb.table_schema IN (${dataModelsTableNames.map((model) => `'${model.schema}'`).join(',')})`;
                }
                let tablesSchema = await dbConnector.query(query);
                
                // Query logical table names from metadata
                const logicalNamesQuery = `
                    SELECT physical_table_name, schema_name, logical_table_name
                    FROM dra_table_metadata
                    WHERE data_source_id = $1
                `;
                const logicalNames = await manager.query(logicalNamesQuery, [dataSource.id]);
                const logicalNameMap = new Map(
                    logicalNames.map((row: any) => [`${row.schema_name}.${row.physical_table_name}`, row.logical_table_name])
                );
                
                for (let i=0; i < dataModelsTableNames.length; i++) {
                    const dataModelTableName = dataModelsTableNames[i];
                    
                    // Check if table physically exists before querying
                    const tableSchema = tablesSchema.find((table: any) => {
                        return table.table_name === dataModelTableName.table_name && table.table_schema === dataModelTableName.schema;
                    });
                    
                    if (!tableSchema) {
                        console.warn(`[DataModelProcessor] Table ${dataModelTableName.schema}.${dataModelTableName.table_name} does not exist in database, skipping data model ID ${dataModelTableName.data_model_id}`);
                        continue;
                    }
                    
                    if (includeRows) {
                        // DEPRECATED: Old behavior for backwards compatibility
                        console.warn(`[DataModelProcessor] includeRows=true is deprecated. Use /data-model/:id/data endpoint instead.`);
                        const dataQuery = `SELECT * FROM "${dataModelTableName.schema}"."${dataModelTableName.table_name}"`;
                        const rowsData = await dbConnector.query(dataQuery);
                        if (tableSchema) {
                            tableSchema.rows = rowsData;
                            tableSchema.row_count = rowsData.length;
                        }
                    } else {
                        // New behavior: Get row count instead of all rows for performance
                        const countQuery = `SELECT COUNT(*) as row_count FROM "${dataModelTableName.schema}"."${dataModelTableName.table_name}"`;
                        const countResult = await dbConnector.query(countQuery);
                        
                        if (tableSchema) {
                            tableSchema.row_count = parseInt(countResult[0]?.row_count || '0', 10);
                            tableSchema.rows = [];  // Empty array for backwards compatibility
                        }
                    }
                }
                
                // Get unique tables (tablesSchema has one row per column, we need unique tables)
                const uniqueTables = _.uniqBy(tablesSchema, (row: any) => `${row.table_schema}.${row.table_name}`);
                
                let tempTables = uniqueTables.map((table: any) => {
                    const tableKey = `${table.table_schema}.${table.table_name}`;
                    const logicalName = logicalNameMap.get(tableKey) || table.table_name;
                    
                    // Find all data models that use this physical table
                    const relatedDataModels = dataModelsTableNames.filter(dm => 
                        dm.schema === table.table_schema && dm.table_name === table.table_name
                    );
                    
                    // Create a separate entry for each data model
                    return relatedDataModels.map(dm => {
                        const dataModelEntity = allDataModels.find(m => m.id === dm.data_model_id);
                        return {
                            data_model_id: dm.data_model_id,
                            table_name: table.table_name,
                            schema: table.table_schema,
                            logical_name: logicalName,
                            is_cross_source: dm.is_cross_source,
                            columns: [],
                            rows: table.rows || [],
                            row_count: table.row_count || 0,
                            health_status: dataModelEntity?.health_status ?? 'unknown',
                            model_type: dataModelEntity?.model_type ?? null,
                            source_row_count: dataModelEntity?.source_row_count ?? null,
                        };
                    });
                }).flat();
                
                // Deduplicate by data_model_id to preserve different data models with same physical table
                console.log(`[DataModelProcessor] Before deduplication for data source ${dataSource.id}: ${tempTables.length} tables`);
                tempTables.forEach((t: any, idx: number) => {
                    console.log(`  [${idx}] DM:${t.data_model_id} ${t.schema}.${t.table_name} (logical: ${t.logical_name}) CrossSource:${t.is_cross_source}`);
                });
                tempTables = _.uniqBy(tempTables, 'data_model_id');
                console.log(`[DataModelProcessor] After deduplication: ${tempTables.length} tables`);
                tempTables.forEach((t: any, idx: number) => {
                    console.log(`  [${idx}] DM:${t.data_model_id} ${t.schema}.${t.table_name} (logical: ${t.logical_name}) CrossSource:${t.is_cross_source}`);
                });
                tempTables.forEach((table: any) => {
                    tablesSchema.forEach((result: any) => {
                        if (table.table_name === result.table_name) {
                            table.columns.push({
                                column_name: result.column_name,
                                data_type: result.data_type,
                                character_maximum_length: result.character_maximum_length,
                                table_name: table.table_name,
                                schema: table.schema,
                                alias_name: '',
                                is_selected_column: true,
                            });
                        }
                    });
                });
                tables.push(tempTables);
            }
            
            // Process cross-source models (these don't belong to a specific data source)
            if (crossSourceModels.length > 0) {
                console.log(`[DataModelProcessor] Processing ${crossSourceModels.length} cross-source models`);
                
                const crossSourceTableNames = crossSourceModels.map((dataModel) => {
                    return {
                        data_model_id: dataModel.id,
                        schema: dataModel.schema,
                        table_name: dataModel.name,
                        is_cross_source: true
                    }
                });
                
                // Query information_schema for cross-source model tables
                let query = `SELECT tb.table_catalog, tb.table_schema, tb.table_name, co.column_name, co.data_type, co.character_maximum_length
                    FROM information_schema.tables AS tb
                    JOIN information_schema.columns AS co
                    ON tb.table_name = co.table_name
                    AND tb.table_type = 'BASE TABLE'`;
                if (crossSourceTableNames.length) {
                    query += ` AND tb.table_name IN (${crossSourceTableNames.map((model) => `'${model.table_name}'`).join(',')})`;
                    query += ` AND tb.table_schema IN (${crossSourceTableNames.map((model) => `'${model.schema}'`).join(',')})`;
                }
                
                let tablesSchema = await dbConnector.query(query);
                
                // Query logical table names from metadata
                const logicalNameMap = new Map<string, string>();
                const tableKeys = crossSourceTableNames.map(t => `('${t.schema}', '${t.table_name}')`).join(',');
                if (tableKeys) {
                    const logicalNameQuery = `
                        SELECT schema_name, physical_table_name, logical_table_name
                        FROM dra_table_metadata
                        WHERE (schema_name, physical_table_name) IN (${tableKeys})
                    `;
                    const logicalNameResults = await dbConnector.query(logicalNameQuery);
                    logicalNameResults.forEach((row: any) => {
                        const key = `${row.schema_name}.${row.physical_table_name}`;
                        logicalNameMap.set(key, row.logical_table_name);
                    });
                }
                
                // Get unique tables
                const uniqueTables = _.uniqBy(tablesSchema, (row: any) => `${row.table_schema}.${row.table_name}`);
                
                let tempTables = uniqueTables.map((table: any) => {
                    const tableKey = `${table.table_schema}.${table.table_name}`;
                    const logicalName = logicalNameMap.get(tableKey) || table.table_name;
                    
                    const relatedDataModels = crossSourceTableNames.filter(dm => 
                        dm.schema === table.table_schema && dm.table_name === table.table_name
                    );
                    
                    return relatedDataModels.map(dm => {
                        const dataModelEntity = allDataModels.find(m => m.id === dm.data_model_id);
                        return {
                            data_model_id: dm.data_model_id,
                            table_name: table.table_name,
                            schema: table.table_schema,
                            logical_name: logicalName,
                            is_cross_source: true,
                            columns: [],
                            rows: [],
                            row_count: 0,  // Will be populated below
                            health_status: dataModelEntity?.health_status ?? 'unknown',
                            model_type: dataModelEntity?.model_type ?? null,
                            source_row_count: dataModelEntity?.source_row_count ?? null,
                        };
                    });
                }).flat();
                
                console.log(`[DataModelProcessor] Cross-source models: ${tempTables.length} tables`);
                tempTables.forEach((t: any, idx: number) => {
                    console.log(`  CrossSource [${idx}] DM:${t.data_model_id} ${t.schema}.${t.table_name} (logical: ${t.logical_name})`);
                });
                
                // Get row counts or full data for cross-source models
                for (const table of tempTables) {
                    try {
                        if (includeRows) {
                            // DEPRECATED: Old behavior for backwards compatibility
                            const dataQuery = `SELECT * FROM "${table.schema}"."${table.table_name}"`;
                            const rowsData = await dbConnector.query(dataQuery);
                            table.rows = rowsData;
                            table.row_count = rowsData.length;
                        } else {
                            // New behavior: Get row count only
                            const countQuery = `SELECT COUNT(*) as row_count FROM "${table.schema}"."${table.table_name}"`;
                            const countResult = await dbConnector.query(countQuery);
                            table.row_count = parseInt(countResult[0]?.row_count || '0', 10);
                        }
                    } catch (error) {
                        console.error(`[DataModelProcessor] Error getting data for ${table.schema}.${table.table_name}:`, error);
                        table.row_count = 0;
                        table.rows = [];
                    }
                }
                
                // Add columns to cross-source tables
                tempTables.forEach((table: any) => {
                    tablesSchema.forEach((result: any) => {
                        if (table.table_name === result.table_name) {
                            table.columns.push({
                                column_name: result.column_name,
                                data_type: result.data_type,
                                character_maximum_length: result.character_maximum_length,
                                table_name: table.table_name,
                                schema: table.schema,
                                alias_name: '',
                                is_selected_column: true,
                            });
                        }
                    });
                });
                
                tables.push(tempTables);
            }
            
            const finalResult = tables.flat();
            console.log(`[DataModelProcessor] Final result: ${finalResult.length} tables total`);
            finalResult.forEach((t: any, idx: number) => {
                console.log(`  Final [${idx}] DM:${t.data_model_id} ${t.schema}.${t.table_name} (logical: ${t.logical_name}) CrossSource:${t.is_cross_source}`);
            });
            return resolve(finalResult);
        });
    }

    /**
     * Get paginated data from a data model table
     * @param options - Pagination and filtering options
     * @returns Promise with rows and total count
     */
    public async getDataModelData(options: {
        dataModelId: number;
        page: number;
        limit: number;
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
        filters?: Record<string, any>;
        search?: string;
        tokenDetails: ITokenDetails;
    }): Promise<{ rows: any[]; total: number }> {
        const { dataModelId, page, limit, sortBy, sortOrder, filters, search, tokenDetails } = options;
        
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }
        const dbConnector = await driver.getConcreteDriver();
        if (!dbConnector) {
            throw new Error('Database connector not available');
        }
        const manager = dbConnector.manager;
        
        // Get data model
        const dataModel = await manager.findOne(DRADataModel, { where: { id: dataModelId } });
        if (!dataModel) {
            throw new Error('Data model not found');
        }
        
        const { schema, name: tableName } = dataModel;
        const offset = (page - 1) * limit;
        
        // Build query
        let query = `SELECT * FROM "${schema}"."${tableName}"`;
        const queryParams: any[] = [];
        let paramIndex = 1;
        const conditions: string[] = [];
        
        // Apply global search (searches all text columns)
        if (search && search.trim()) {
            const searchColumns = await this.getSearchableColumns(dbConnector, schema, tableName);
            if (searchColumns.length > 0) {
                const searchConditions = searchColumns.map(col => 
                    `"${col}"::text ILIKE $${paramIndex}`
                );
                conditions.push(`(${searchConditions.join(' OR ')})`);
                queryParams.push(`%${search.trim()}%`);
                paramIndex++;
            }
        }
        
        // Apply filters with advanced operators
        if (filters && Object.keys(filters).length > 0) {
            for (const [col, filterDef] of Object.entries(filters)) {
                // Filter can be simple value (equals) or object with operator
                if (typeof filterDef === 'object' && filterDef !== null && 'operator' in filterDef) {
                    const { operator, value } = filterDef;
                    
                    switch (operator) {
                        case 'equals':
                            conditions.push(`"${col}" = $${paramIndex}`);
                            queryParams.push(value);
                            paramIndex++;
                            break;
                        case 'contains':
                            conditions.push(`"${col}"::text ILIKE $${paramIndex}`);
                            queryParams.push(`%${value}%`);
                            paramIndex++;
                            break;
                        case 'startsWith':
                            conditions.push(`"${col}"::text ILIKE $${paramIndex}`);
                            queryParams.push(`${value}%`);
                            paramIndex++;
                            break;
                        case 'endsWith':
                            conditions.push(`"${col}"::text ILIKE $${paramIndex}`);
                            queryParams.push(`%${value}`);
                            paramIndex++;
                            break;
                        case 'gt':
                            conditions.push(`"${col}" > $${paramIndex}`);
                            queryParams.push(value);
                            paramIndex++;
                            break;
                        case 'gte':
                            conditions.push(`"${col}" >= $${paramIndex}`);
                            queryParams.push(value);
                            paramIndex++;
                            break;
                        case 'lt':
                            conditions.push(`"${col}" < $${paramIndex}`);
                            queryParams.push(value);
                            paramIndex++;
                            break;
                        case 'lte':
                            conditions.push(`"${col}" <= $${paramIndex}`);
                            queryParams.push(value);
                            paramIndex++;
                            break;
                        case 'between':
                            if (Array.isArray(value) && value.length === 2) {
                                conditions.push(`"${col}" BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
                                queryParams.push(value[0], value[1]);
                                paramIndex += 2;
                            }
                            break;
                        case 'in':
                            if (Array.isArray(value) && value.length > 0) {
                                const placeholders = value.map((_, idx) => `$${paramIndex + idx}`).join(', ');
                                conditions.push(`"${col}" IN (${placeholders})`);
                                queryParams.push(...value);
                                paramIndex += value.length;
                            }
                            break;
                        case 'isNull':
                            conditions.push(`"${col}" IS NULL`);
                            break;
                        case 'isNotNull':
                            conditions.push(`"${col}" IS NOT NULL`);
                            break;
                        default:
                            // Default to equals
                            conditions.push(`"${col}" = $${paramIndex}`);
                            queryParams.push(value);
                            paramIndex++;
                    }
                } else {
                    // Simple value = equals operator
                    conditions.push(`"${col}" = $${paramIndex}`);
                    queryParams.push(filterDef);
                    paramIndex++;
                }
            }
        }
        
        // Add WHERE clause if conditions exist
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        // Apply sorting
        if (sortBy) {
            query += ` ORDER BY "${sortBy}" ${sortOrder || 'ASC'}`;
        }
        
        // Apply pagination
        query += ` LIMIT ${limit} OFFSET ${offset}`;
        
        // Get total count (with same filters and search)
        let countQuery = `SELECT COUNT(*) as total FROM "${schema}"."${tableName}"`;
        if (conditions.length > 0) {
            countQuery += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        // Execute queries
        const countResult = await dbConnector.query(countQuery, queryParams);
        const total = parseInt(countResult[0]?.total || '0', 10);
        
        const rows = await dbConnector.query(query, queryParams);
        
        console.log(`[DataModelProcessor] getDataModelData - DM:${dataModelId}, Page:${page}, Limit:${limit}, Total:${total}, Returned:${rows.length}, Search:${search || 'none'}, Filters:${Object.keys(filters || {}).length}`);
        
        return { rows, total };
    }
    
    private async getSearchableColumns(dbConnector: any, schema: string, tableName: string): Promise<string[]> {
        const result = await dbConnector.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = $1 
              AND table_name = $2 
              AND data_type IN ('character varying', 'text', 'character')
            ORDER BY ordinal_position
        `, [schema, tableName]);
        
        return result.map((row: any) => row.column_name);
    }

    public async executeQueryOnDataModel(query: string, tokenDetails: ITokenDetails, dataModelId?: number): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
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

            // ── Pre-flight health / size check ────────────────────────────────
            // Dimensional tables bypass this check entirely
            if (dataModelId) {
                const { DataModelOversizedException } = await import('../types/errors/DataModelOversizedException.js');
                const { EPlatformSettingKey } = await import('../models/DRAPlatformSettings.js');
                const { PlatformSettingsProcessor } = await import('./PlatformSettingsProcessor.js');

                const dataModel = await manager.findOne(DRADataModel, { where: { id: dataModelId } });
                if (dataModel && dataModel.model_type !== 'dimension') {
                    const threshold = (await PlatformSettingsProcessor.getInstance().getSetting<number>(EPlatformSettingKey.MAX_DATA_MODEL_ROWS)) ?? 50000;
                    if (
                        threshold > 0 &&
                        (dataModel.health_status === 'blocked' ||
                        (dataModel.row_count != null && dataModel.row_count > threshold))
                    ) {
                        return reject(new DataModelOversizedException({
                            modelId: dataModel.id,
                            modelName: dataModel.name,
                            rowCount: dataModel.row_count ?? null,
                            sourceRowCount: dataModel.source_row_count ?? null,
                            healthStatus: dataModel.health_status as any,
                            healthIssues: (dataModel.health_issues ?? []) as any,
                            threshold,
                        }));
                    }
                }
            }
            // ── End pre-flight ────────────────────────────────────────────────

            try {
                const results = await dbConnector.query(query);
                return resolve(results);
            } catch (error) {
                return resolve(null);
            }
        });
    }

    /**
     * Update data model settings
     * @param dataModelId - The data model ID to update
     * @param updates - Object containing fields to update
     * @param tokenDetails - User authentication details
     * @returns True if successful, false otherwise
     */
    public async updateDataModelSettings(
        dataModelId: number,
        updates: Partial<DRADataModel>,
        tokenDetails: ITokenDetails,
        organizationId?: number,
        workspaceId?: number
    ): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(false);
            }
            
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve(false);
            }
            
            const manager = dbConnector.manager;
            if (!manager) {
                return resolve(false);
            }
            
            try {
                // Verify user exists
                const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
                if (!user) {
                    return resolve(false);
                }
                
                // Find the data model
                const dataModel = await manager.findOne(DRADataModel, { where: { id: dataModelId } });
                if (!dataModel) {
                    console.error(`[DataModelProcessor] Data model ${dataModelId} not found`);
                    return resolve(false);
                }
                
                // Verify organization/workspace ownership (if provided)
                if (organizationId && dataModel.organization_id !== organizationId) {
                    console.error(`[DataModelProcessor] Data model ${dataModelId} belongs to different organization (expected ${organizationId}, got ${dataModel.organization_id})`);
                    return resolve(false);
                }
                if (workspaceId && dataModel.workspace_id !== workspaceId) {
                    console.error(`[DataModelProcessor] Data model ${dataModelId} belongs to different workspace (expected ${workspaceId}, got ${dataModel.workspace_id})`);
                    return resolve(false);
                }
                
                // AUTO-POPULATE: If somehow null (legacy data), set from context
                if (!dataModel.organization_id && organizationId) {
                    console.warn(`[DataModelProcessor] Auto-populating NULL organization_id for data model ${dataModelId}`);
                    dataModel.organization_id = organizationId;
                }
                if (!dataModel.workspace_id && workspaceId) {
                    console.warn(`[DataModelProcessor] Auto-populating NULL workspace_id for data model ${dataModelId}`);
                    dataModel.workspace_id = workspaceId;
                }

                // Issue #361: Validate layer if being updated
                if (updates.data_layer) {
                    console.log(`[DataModelProcessor] Validating layer update to ${updates.data_layer} for data model ${dataModelId}`);
                    
                    try {
                        const { validation, recommendation } = await this.validateDataModelLayer(
                            updates.data_layer as EDataLayer,
                            JSON.stringify(dataModel.query),
                            true // validate=true, will throw on validation errors
                        );

                        // Also validate layer flow if model uses other data models
                        if (dataModel.uses_data_models) {
                            const flowValidation = await this.validateLayerFlow(
                                updates.data_layer as EDataLayer,
                                dataModelId,
                                manager
                            );
                            
                            // Store flow warnings in layer_config if any
                            if (!flowValidation.isStandardFlow && flowValidation.warnings.length > 0) {
                                updates.layer_config = {
                                    ...updates.layer_config,
                                    flow_warnings: flowValidation.warnings
                                };
                            }
                        }

                        console.log(`[DataModelProcessor] Layer validation passed. Recommendation: ${recommendation?.layer} (${recommendation?.confidence})`);
                    } catch (layerError: any) {
                        console.error(`[DataModelProcessor] Layer validation failed:`, layerError.message);
                        // Reject the update if validation fails
                        return resolve(false);
                    }
                }
                
                // Update fields
                Object.assign(dataModel, updates);
                await manager.save(dataModel);
                
                console.log(`[DataModelProcessor] Updated data model ${dataModelId} settings:`, updates);
                
                // Notification removed - notifyDataModelUpdated method not yet implemented
                // TODO: Implement notifyDataModelUpdated in NotificationHelperService
                
                return resolve(true);
            } catch (error) {
                console.error('[DataModelProcessor] Error updating data model settings:', error);
                return resolve(false);
            }
        });
    }

    /**
     * Get refresh status and queue stats for a data model.
     */
    public async getDataModelRefreshStatus(dataModelId: number): Promise<{ dataModel: any; queueStats: any }> {
        const { RefreshQueueService } = await import('../services/RefreshQueueService.js');
        const { AppDataSource } = await import('../datasources/PostgresDS.js');
        const dataModel = await AppDataSource.manager
            .getRepository('DRADataModel')
            .createQueryBuilder('model')
            .where('model.id = :id', { id: dataModelId })
            .select(['model.id','model.name','model.refresh_status','model.last_refreshed_at',
                     'model.row_count','model.last_refresh_duration_ms','model.refresh_error','model.auto_refresh_enabled'])
            .getOne();
        const queueStats = RefreshQueueService.getInstance().getQueueStats();
        return { dataModel, queueStats };
    }

    /**
     * Queue a manual refresh job for a data model.
     */
    public async triggerDataModelRefresh(dataModelId: number, userId: number): Promise<string> {
        const { RefreshQueueService } = await import('../services/RefreshQueueService.js');
        return RefreshQueueService.getInstance().addJob(dataModelId, {
            triggeredBy: 'user',
            triggerUserId: userId,
            reason: 'Manual refresh triggered by user',
        });
    }

    /**
     * Queue cascade refresh for all data models dependent on a data source.
     */
    public async triggerCascadeRefresh(dataSourceId: number, userId: number): Promise<{ modelIds: number[]; jobIds: string[] }> {
        const { DataModelRefreshService } = await import('../services/DataModelRefreshService.js');
        const { RefreshQueueService } = await import('../services/RefreshQueueService.js');
        const modelIds = await DataModelRefreshService.getInstance().findDependentModels(dataSourceId);
        if (modelIds.length === 0) return { modelIds: [], jobIds: [] };
        const jobIds = await RefreshQueueService.getInstance().queueRefreshForModels(modelIds, {
            triggeredBy: 'user',
            triggerUserId: userId,
            triggerSourceId: dataSourceId,
            reason: `Manual cascade refresh for data source ${dataSourceId}`,
        });
        return { modelIds, jobIds };
    }

    /**
     * Get refresh history for a data model (last 20 records).
     */
    public async getDataModelRefreshHistory(dataModelId: number): Promise<any[]> {
        const { AppDataSource } = await import('../datasources/PostgresDS.js');
        const { DRADataModelRefreshHistory } = await import('../models/DRADataModelRefreshHistory.js');
        return AppDataSource.manager
            .getRepository(DRADataModelRefreshHistory)
            .createQueryBuilder('history')
            .where('history.data_model_id = :dataModelId', { dataModelId })
            .orderBy('history.started_at', 'DESC')
            .limit(20)
            .getMany();
    }

    /**
     * Return the persisted health snapshot alongside a fresh live re-analysis.
     * Used by `GET /data-model/:id/health`.
     * Returns null when the data model does not exist.
     */
    public async getModelHealth(
        dataModelId: number,
        tokenDetails: ITokenDetails,
    ): Promise<{
        persisted: {
            health_status: string;
            health_issues: any[];
            row_count: number | null;
            source_row_count: number | null;
            model_type: string | null;
        };
        live: {
            health_status: string;
            health_issues: any[];
            source_row_count: number | null;
        };
        stale: boolean;
    } | null> {
        const { AppDataSource } = await import('../datasources/PostgresDS.js');
        const { DataModelHealthService } = await import('../services/DataModelHealthService.js');

        const manager = AppDataSource.manager;
        const dataModel = await manager.findOne(DRADataModel, { where: { id: dataModelId } });
        if (!dataModel) {
            return null;
        }

        const persisted = {
            health_status: dataModel.health_status,
            health_issues: dataModel.health_issues,
            row_count: dataModel.row_count ?? null,
            source_row_count: dataModel.source_row_count ?? null,
            model_type: dataModel.model_type ?? null,
        };

        const svc = DataModelHealthService.getInstance();
        const { maxOutputRows, largeSourceThreshold } = await svc.loadThresholds();
        const sourceMeta = await svc.resolveSourceTableMeta(dataModel.query);
        const liveReport = svc.analyse(
            dataModel.query,
            (dataModel.model_type ?? null) as any,
            sourceMeta,
            maxOutputRows,
            largeSourceThreshold,
            dataModel.data_layer as EDataLayer | null,
        );

        const live = {
            health_status: liveReport.status,
            health_issues: liveReport.issues,
            source_row_count: liveReport.totalSourceRows,
        };

        return { persisted, live, stale: live.health_status !== persisted.health_status };
    }

    /**
     * Update `model_type` and re-run + persist health analysis.
     * Used by `PATCH /data-model/:id/model-type`.
     * Returns null when the data model does not exist.
     */
    public async setModelType(
        dataModelId: number,
        modelType: 'dimension' | 'fact' | 'aggregated' | null,
        tokenDetails: ITokenDetails,
    ): Promise<IDataModelHealthReport | null> {
        const { AppDataSource } = await import('../datasources/PostgresDS.js');
        const { DataModelHealthService } = await import('../services/DataModelHealthService.js');

        const manager = AppDataSource.manager;
        const dataModel = await manager.findOne(DRADataModel, { where: { id: dataModelId } });
        if (!dataModel) {
            return null;
        }

        // Persist the new model_type first so recomputeAndPersist picks it up
        await manager.update(DRADataModel, dataModelId, { model_type: modelType as any });

        return DataModelHealthService.getInstance().recomputeAndPersist(dataModelId);
    }

    /**
     * Issue #10 — AI-assisted model optimization suggestions.
     * Sends the model's health issues and SQL query to Gemini and returns up to
     * 3 structured fix suggestions. Each revisedSQL is validated to start with
     * SELECT before being returned to prevent prompt-injection attacks producing
     * harmful SQL.
     */
    public async suggestModelOptimization(
        dataModelId: number,
    ): Promise<{ analysis: string; suggestions: Array<{ description: string; revisedSQL: string }> }> {
        const { AppDataSource } = await import('../datasources/PostgresDS.js');
        const { getGeminiService } = await import('../services/GeminiService.js');

        const manager = AppDataSource.manager;
        const dataModel = await manager.findOne(DRADataModel, { where: { id: dataModelId } });
        if (!dataModel) {
            throw new Error('Data model not found');
        }

        const healthIssues: any[] = Array.isArray(dataModel.health_issues) ? dataModel.health_issues : [];
        const issuesSummary = healthIssues.length
            ? healthIssues.map((issue: any) => `- ${issue.title}: ${issue.description}. Recommendation: ${issue.recommendation}`).join('\n')
            : '- No specific health issues recorded.';

        const prompt = `You are a senior SQL and data engineering expert. A user has a data model with health problems blocking it from being used in dashboards.

## Data Model Details
- Name: ${dataModel.name}
- Row Count: ${dataModel.row_count ?? 'Unknown'}
- Source Row Count: ${dataModel.source_row_count ?? 'Unknown'}
- Health Status: ${dataModel.health_status}
- Current SQL:
\`\`\`sql
${dataModel.sql_query}
\`\`\`

## Detected Health Issues
${issuesSummary}

## Task
Return a JSON object with the following structure. Provide exactly 1–3 suggestions. Each revisedSQL MUST be a valid SELECT statement that fixes the health issues. Be concise and practical.

\`\`\`json
{
  "analysis": "<one to two sentences describing why this model is blocked and what needs to change>",
  "suggestions": [
    {
      "description": "<plain English description of this fix>",
      "revisedSQL": "<the full revised SELECT statement>"
    }
  ]
}
\`\`\`

Return ONLY the JSON object with no extra text, markdown fences, or explanation.`;

        const geminiService = getGeminiService();
        const conversationId = `opt_${dataModelId}_${Date.now()}`;
        await geminiService.initializeConversation(conversationId, '');
        const raw = await geminiService.sendMessage(conversationId, prompt);

        // Strip markdown code fences if Gemini wraps the output
        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let parsed: { analysis: string; suggestions: Array<{ description: string; revisedSQL: string }> };
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            throw new Error('AI returned an invalid response. Please try again.');
        }

        if (!parsed.analysis || !Array.isArray(parsed.suggestions)) {
            throw new Error('AI response was incomplete. Please try again.');
        }

        // Security: validate each revisedSQL starts with SELECT (case-insensitive)
        // to prevent prompt-injection attacks from producing harmful SQL
        parsed.suggestions = parsed.suggestions
            .filter((s) => typeof s.description === 'string' && typeof s.revisedSQL === 'string')
            .filter((s) => s.revisedSQL.trim().toUpperCase().startsWith('SELECT'))
            .slice(0, 3);

        if (parsed.suggestions.length === 0) {
            throw new Error('AI could not produce valid SELECT suggestions. Please try again.');
        }

        return parsed;
    }
}
