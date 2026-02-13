import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
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
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import { DataSourceProcessor } from "./DataSourceProcessor.js";

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
     * Escape SQL string values to prevent SQL injection
     * @param value - The value to escape
     * @returns Escaped string or 'null' for null/undefined values
     */
    private escapeSQL(value: any): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        // Escape single quotes by doubling them (SQL standard)
        return String(value).replace(/'/g, "''");
    }

    /**
     * Convert a value to a PostgreSQL boolean literal
     */
    private convertToPostgresBoolean(value: any): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }
        
        const stringValue = String(value).trim().toLowerCase();
        
        // Handle common true values
        if (['true', '1', 'yes', 'y', 'on', 'active', 'enabled'].includes(stringValue)) {
            return 'TRUE';
        }
        
        // Handle common false values
        if (['false', '0', 'no', 'n', 'off', 'inactive', 'disabled'].includes(stringValue)) {
            return 'FALSE';
        }
        
        // If we can't determine the boolean value, default to NULL
        console.warn(`Unable to convert value "${value}" to boolean, using NULL`);
        return 'NULL';
    }

    /**
     * Format a date value for SQL insertion based on column data type
     * @param value - The date value to format (Date object, string, or timestamp)
     * @param columnType - The PostgreSQL date type
     * @param columnName - The column name (for error logging)
     * @returns Formatted SQL date string
     */
    private formatDateForSQL(value: any, columnType: string, columnName: string): string {
        if (value === null || value === undefined) {
            return 'null';
        }

        try {
            let dateObj: Date;

            // Convert value to Date object
            if (value instanceof Date) {
                dateObj = value;
            } else if (typeof value === 'string') {
                // Handle empty or invalid strings
                if (value.trim() === '' || value === '0000-00-00' || value === '0000-00-00 00:00:00') {
                    return 'null';
                }
                
                // Handle JavaScript Date.toString() format
                // e.g., "Sun Nov 23 2025 00:00:00 GMT+0000 (Coordinated Universal Time)"
                if (value.includes('GMT')) {
                    // Parse using Date constructor which handles this format
                    dateObj = new Date(value);
                    if (isNaN(dateObj.getTime())) {
                        // If that fails, try to extract just the date portion
                        const datePart = value.split(' GMT')[0];
                        dateObj = new Date(datePart);
                    }
                } else {
                    dateObj = new Date(value);
                }
            } else if (typeof value === 'number') {
                // Unix timestamp
                dateObj = new Date(value);
            } else {
                console.warn(`Unexpected date value type for column ${columnName}:`, typeof value, value);
                return 'null';
            }

            // Validate Date object
            if (isNaN(dateObj.getTime())) {
                console.error(`Invalid date value for column ${columnName}:`, value);
                return 'null';
            }

            const upperType = columnType.toUpperCase();

            // Format based on column type
            // CRITICAL: Check TIMESTAMP types BEFORE TIME types
            // because 'TIMESTAMP WITHOUT TIME ZONE' contains 'TIME WITHOUT'
            // and would incorrectly match the TIME handler, stripping the date portion
            if (upperType === 'DATE') {
                // DATE: YYYY-MM-DD format
                const formatted = dateObj.toISOString().split('T')[0];
                return `'${formatted}'`;
            } 
            else if (upperType === 'TIMESTAMP WITH TIME ZONE' || upperType === 'TIMESTAMPTZ' || upperType.includes('TIMESTAMPTZ')) {
                // TIMESTAMP WITH TIME ZONE: ISO 8601 format with timezone
                return `'${dateObj.toISOString()}'`;
            } 
            else if (upperType === 'TIMESTAMP' || upperType.startsWith('TIMESTAMP(') || upperType.includes('TIMESTAMP WITHOUT') || upperType.includes('TIMESTAMP ')) {
                // TIMESTAMP: YYYY-MM-DD HH:MM:SS format (no timezone)
                const formatted = dateObj.toISOString()
                    .replace('T', ' ')
                    .split('.')[0];
                return `'${formatted}'`;
            }
            else if (upperType === 'TIME' || upperType.startsWith('TIME(') || upperType.includes('TIME WITHOUT')) {
                // TIME: HH:MM:SS format (must come AFTER TIMESTAMP checks)
                const timeString = dateObj.toISOString().split('T')[1].split('.')[0];
                return `'${timeString}'`;
            }

            // Fallback: use ISO string for timestamp with timezone
            return `'${dateObj.toISOString()}'`;

        } catch (error) {
            console.error(`Failed to format date for column ${columnName}:`, error, 'Value:', value);
            return 'null';
        }
    }

    /**
     * Format a value for SQL insertion based on column data type
     * @param value - The value to format
     * @param columnType - The PostgreSQL column type
     * @param columnName - The column name (for error logging)
     * @returns Formatted SQL value string
     */
    private formatValueForSQL(value: any, columnType: string, columnName: string): string {
        if (value === null || value === undefined) {
            return 'null';
        }

        // Auto-detect Date objects regardless of declared column type
        // External DB drivers may return Date objects for columns not recognized as date types
        if (value instanceof Date) {
            const upperType = columnType.toUpperCase();
            const dateType = (upperType.includes('DATE') || upperType.includes('TIME') || upperType.includes('TIMESTAMP'))
                ? upperType : 'TIMESTAMP';
            return this.formatDateForSQL(value, dateType, columnName);
        }

        const upperType = columnType.toUpperCase();

        // Handle DATE, TIME, and TIMESTAMP types
        if (upperType.includes('DATE') || 
            upperType.includes('TIME') || 
            upperType.includes('TIMESTAMP')) {
            return this.formatDateForSQL(value, upperType, columnName);
        }

        // Handle JSON and JSONB types
        if (upperType === 'JSON' || upperType === 'JSONB') {
            try {
                // Check if value is already stringified as "[object Object]"
                const valueStr = String(value);
                if (valueStr === '[object Object]' || valueStr.startsWith('[object ')) {
                    console.error(`Detected [object Object] for column ${columnName}. Value type: ${typeof value}`);
                    if (typeof value === 'object') {
                        const jsonString = JSON.stringify(value);
                        return `'${this.escapeSQL(jsonString)}'`;
                    }
                    return 'null';
                }

                if (typeof value === 'object') {
                    const jsonString = JSON.stringify(value);
                    return `'${this.escapeSQL(jsonString)}'`;
                } else if (typeof value === 'string') {
                    if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
                        try {
                            JSON.parse(value);
                            return `'${this.escapeSQL(value)}'`;
                        } catch {
                            return `'${this.escapeSQL(JSON.stringify(value))}'`;
                        }
                    } else {
                        return `'${this.escapeSQL(JSON.stringify(value))}'`;
                    }
                } else {
                    return `'${JSON.stringify(value)}'`;
                }
            } catch (error) {
                console.error(`Failed to serialize JSON for column ${columnName}:`, error, 'Value:', value, 'Type:', typeof value);
                return 'null';
            }
        }

        // Auto-detect date-like strings as safety net
        // Catches JavaScript Date.toString() format ("Thu Nov 23 2025 00:00:00 GMT+0000...")
        // that external DB drivers may return as strings instead of Date objects.
        // Without this, such strings get inserted raw into DATE/TIMESTAMP columns,
        // causing PostgreSQL DateTimeParseError (code 22007).
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.includes('GMT') || trimmed.includes('UTC') || trimmed.includes('Coordinated Universal Time')) {
                const dateObj = new Date(trimmed);
                if (!isNaN(dateObj.getTime())) {
                    console.warn(`[formatValueForSQL] Auto-detected date string for column ${columnName} (declared ${columnType}): "${trimmed.substring(0, 60)}"`);
                    return this.formatDateForSQL(trimmed, 'TIMESTAMP', columnName);
                }
            }
        }

        // Handle NUMERIC/INTEGER/REAL/FLOAT types - don't wrap numbers in quotes
        if (upperType.includes('NUMERIC') || upperType.includes('INTEGER') || upperType.includes('INT') ||
            upperType.includes('REAL') || upperType.includes('FLOAT') || upperType.includes('DOUBLE') ||
            upperType.includes('DECIMAL') || upperType.includes('BIGINT') || upperType.includes('SMALLINT')) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                return `${numValue}`;
            }
            return 'null';
        }

        // Handle BOOLEAN type
        if (upperType === 'BOOLEAN' || upperType === 'BOOL') {
            return this.convertToPostgresBoolean(value);
        }

        // Handle all other types with proper escaping
        return `'${this.escapeSQL(value)}'`;
    }

    /**
     * Get the list of data models for a user in a specific project
     * @param projectId - The project ID to filter data models by
     * @param tokenDetails 
     * @returns list of data models for the project
     */
    async getDataModels(projectId: number, tokenDetails: ITokenDetails): Promise<DRADataModel[]> {
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
            const project = await manager.findOne(DRAProject, {
                where: {id: projectId, users_platform: user}
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
                
                if (!projectMember) {
                    // User is neither owner nor member - no access
                    return resolve([]);
                }
            }
            
            // Query data models filtering by project through data_source relationship
            // Include both single-source models (ds.project_id) and cross-source models (dms_ds.project_id)
            const dataModels = await manager
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
                )
                .getMany();
            
            return resolve(dataModels);
        });
    }

    /**
     * Delete a data model
     * @param dataModelId 
     * @param tokenDetails 
     * @returns true if the data model was deleted, false otherwise
     */
    public async deleteDataModel(dataModelId: number, tokenDetails: ITokenDetails): Promise<boolean> {
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
                
                // Store data model name for notification
                const dataModelName = dataModel.name;
                
                // Remove the data model record
                await manager.remove(dataModel);
                console.log(`Successfully deleted data model ${dataModelId}`);
                
                // Send notification
                await this.notificationHelper.notifyDataModelDeleted(user_id, dataModelName);
                
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
            
            // API-integrated sources (MongoDB, Excel, PDF) store data in PostgreSQL
            // Use internal PostgreSQL connection instead of connecting to external DB
            let externalDBConnector: DataSource;
            const apiIntegratedTypes = ['mongodb', 'excel', 'pdf'];
            const isApiIntegrated = apiIntegratedTypes.includes(dataSourceType.toLowerCase());
            
            if (isApiIntegrated) {
                // Use internal PostgreSQL connection where synced data lives
                console.log(`[DataModelProcessor] Using internal PostgreSQL for API-integrated source: ${dataSourceType}`);
                externalDBConnector = internalDbConnector;
            } else {
                // Connect to external database for regular data sources
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
                    selectTableQuery = DataSourceProcessor.getInstance().reconstructSQLFromJSON(queryJSON);
                    
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
                    } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_mongodb' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads')) {
                        // For special schemas (Excel, PDF, MongoDB, GA), always use table_name regardless of aliases
                        // This preserves datasource IDs in table names (e.g., device_15, sheet_123, companies_data_source_7)
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
                    } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_mongodb' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads')) {
                        // For special schemas (Excel, PDF, MongoDB, GA), always use table_name regardless of aliases
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
                        } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_mongodb' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads')) {
                            // For special schemas (Excel, PDF, MongoDB, GA), always use table_name regardless of aliases
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
                        
                        const formattedValue = this.formatValueForSQL(row[rowKey], columnType, columnName);
                        
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
                            const formattedVal = this.formatValueForSQL(row[columnName], 'NUMERIC', columnName);
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
                                
                                const formattedVal = this.formatValueForSQL(row[rowKey], 'NUMERIC', aliasName);
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
                                const formattedVal = this.formatValueForSQL(row[aliasName], exprDataType, aliasName);
                                
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
                await manager.update(DRADataModel, {id: existingDataModel.id}, {schema: 'public', name: dataModelName, sql_query: selectTableQuery, query: JSON.parse(queryJSON)});
                return resolve(true);
            } catch (error) {
                console.log('error', error);
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
    public async getTablesFromDataModels(projectId: number, tokenDetails: ITokenDetails): Promise<any> {
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
                    
                    query = `SELECT * FROM "${dataModelTableName.schema}"."${dataModelTableName.table_name}"`;
                    let rowsData = await dbConnector.query(query);
                    
                    if (tableSchema) {
                        tableSchema.rows = rowsData;
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
                    return relatedDataModels.map(dm => ({
                        data_model_id: dm.data_model_id,
                        table_name: table.table_name,
                        schema: table.table_schema,
                        logical_name: logicalName,
                        is_cross_source: dm.is_cross_source,
                        columns: [],
                        rows: table.rows,
                    }));
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
                    
                    return relatedDataModels.map(dm => ({
                        data_model_id: dm.data_model_id,
                        table_name: table.table_name,
                        schema: table.table_schema,
                        logical_name: logicalName,
                        is_cross_source: true,
                        columns: [],
                        rows: [],
                    }));
                }).flat();
                
                console.log(`[DataModelProcessor] Cross-source models: ${tempTables.length} tables`);
                tempTables.forEach((t: any, idx: number) => {
                    console.log(`  CrossSource [${idx}] DM:${t.data_model_id} ${t.schema}.${t.table_name} (logical: ${t.logical_name})`);
                });
                
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

    public async executeQueryOnDataModel(query: string, tokenDetails: ITokenDetails): Promise<any> {
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
        tokenDetails: ITokenDetails
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
}