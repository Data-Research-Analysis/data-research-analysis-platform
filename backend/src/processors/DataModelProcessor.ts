import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { UtilityService } from "../services/UtilityService.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DataSource } from "typeorm";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAProject } from "../models/DRAProject.js";

export class DataModelProcessor {
    private static instance: DataModelProcessor;
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
                dateObj = new Date(value);
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
            if (upperType === 'DATE') {
                // DATE: YYYY-MM-DD format
                const formatted = dateObj.toISOString().split('T')[0];
                return `'${formatted}'`;
            } 
            else if (upperType === 'TIME' || upperType.startsWith('TIME(') || upperType.includes('TIME WITHOUT')) {
                // TIME: HH:MM:SS format
                const timeString = dateObj.toISOString().split('T')[1].split('.')[0];
                return `'${timeString}'`;
            } 
            else if (upperType === 'TIMESTAMP WITH TIME ZONE' || upperType === 'TIMESTAMPTZ') {
                // TIMESTAMP WITH TIME ZONE: ISO 8601 format with timezone
                return `'${dateObj.toISOString()}'`;
            } 
            else if (upperType === 'TIMESTAMP' || upperType.startsWith('TIMESTAMP(') || upperType.includes('TIMESTAMP WITHOUT')) {
                // TIMESTAMP: YYYY-MM-DD HH:MM:SS format (no timezone)
                const formatted = dateObj.toISOString()
                    .replace('T', ' ')
                    .split('.')[0];
                return `'${formatted}'`;
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

        // Handle all other types with proper escaping
        return `'${this.escapeSQL(value)}'`;
    }

    /**
     * Get the list of data models for a user
     * @param tokenDetails 
     * @returns list of data models
     */
    async getDataModels(tokenDetails: ITokenDetails): Promise<DRADataModel[]> {
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
            const dataModels = await manager.find(DRADataModel, {where: {users_platform: user}, relations: ['data_source', 'users_platform']});
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
                const dataModel = await manager.findOne(DRADataModel, {where: {id: dataModelId, users_platform: user}});
                if (!dataModel) {
                    return resolve(false);
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
                // Remove the data model record
                await manager.remove(dataModel);
                console.log(`Successfully deleted data model ${dataModelId}`);
                return resolve(true);
            } catch (error) {
                console.error(`Fatal error deleting data model ${dataModelId}:`, error);
                return resolve(false);
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
            const existingDataModel = await manager.findOne(DRADataModel, {
                where: {id: dataModelId, users_platform: user},
                relations: ['data_source']
            });
            
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
            const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}, relations: ['data_models']});
            if (!dataSource) {
                return resolve(false);
            }
            const connection: IDBConnectionDetails = dataSource.connection_details;
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(false);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
            if (!externalDriver) {
                return resolve(false);
            }
            let externalDBConnector: DataSource;
            try {
                externalDBConnector =  await externalDriver.connectExternalDB(connection);
                if (!externalDBConnector) {
                    return resolve(false);
                }
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return resolve(false);
            }
            const existingDataModel = dataSource.data_models.find(model => model.id === dataModelId);
            if (!existingDataModel) {
                return resolve(false);
            }
            await internalDbConnector.query(`DROP TABLE IF EXISTS ${existingDataModel.schema}.${existingDataModel.name}`);
            try {
                dataModelName = UtilityService.getInstance().uniquiseName(dataModelName);
                const selectTableQuery = `${query}`;
                const rowsFromDataSource = await externalDBConnector.query(selectTableQuery);
                //Create the table first then insert the data.
                let createTableQuery = `CREATE TABLE ${dataModelName} `;
                const sourceTable = JSON.parse(queryJSON);
                let columns = '';
                let insertQueryColumns = '';
                sourceTable.columns.forEach((column: any, index: number) => {
                    const columnSize = column?.character_maximum_length ? `(${column?.character_maximum_length})` : '';
                    const columnType = `${column.data_type}${columnSize}`;

                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(dataSourceType, columnType);
                    let dataTypeString = '';
                    if (dataType.size) {
                        dataTypeString = `${dataType.type}(${dataType.size})`;
                    } else {
                        dataTypeString = `${dataType.type}`;
                    }
                    if (column && column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                        const columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                        if (index < sourceTable.columns.length - 1) {
                            columns += `${columnName} ${dataTypeString}, `;
                        } else {
                            columns += `${columnName} ${dataTypeString} `;
                        }
                        if (index < sourceTable.columns.length - 1) {
                            insertQueryColumns += `${columnName},`;
                        } else {
                            insertQueryColumns += `${columnName}`;
                        }
                    } else {
                        if (index < sourceTable.columns.length - 1) {
                            columns += `${column.schema}_${column.table_name}_${column.column_name} ${dataTypeString}, `;
                        } else {
                            columns += `${column.schema}_${column.table_name}_${column.column_name} ${dataTypeString} `;
                        }
                        if (index < sourceTable.columns.length - 1) {
                            insertQueryColumns += `${column.schema}_${column.table_name}_${column.column_name},`;
                        } else {
                            insertQueryColumns += `${column.schema}_${column.table_name}_${column.column_name}`;
                        }
                    }
                });
                if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                    columns += ', ';
                    insertQueryColumns += ', ';
                }
                sourceTable.calculated_columns.forEach((column: any, index: number) => {
                    if (index < sourceTable.calculated_columns.length - 1) {
                        columns += `${column.column_name} NUMERIC, `;
                        insertQueryColumns += `${column.column_name}, `;
                    } else {
                        columns += `${column.column_name} NUMERIC`;
                        insertQueryColumns += `${column.column_name}`;
                    }
                });
                createTableQuery += `(${columns})`;
                await internalDbConnector.query(createTableQuery);
                insertQueryColumns = `(${insertQueryColumns})`;
                
                // Track column data types for proper value formatting
                const columnDataTypes = new Map<string, string>();
                sourceTable.columns.forEach((column: any) => {
                    let columnName = `${column.table_name}_${column.column_name}`;
                    if (column && column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                        columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                    }
                    const columnSize = column?.character_maximum_length ? `(${column?.character_maximum_length})` : '';
                    const columnType = `${column.data_type}${columnSize}`;
                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(dataSourceType, columnType);
                    let dataTypeString = '';
                    if (dataType.size) {
                        dataTypeString = `${dataType.type}(${dataType.size})`;
                    } else {
                        dataTypeString = `${dataType.type}`;
                    }
                    columnDataTypes.set(columnName, dataTypeString);
                });
                
                rowsFromDataSource.forEach((row: any, index: number) => {
                    let insertQuery = `INSERT INTO ${dataModelName} `;
                    let values = '';
                    sourceTable.columns.forEach((column: any, columnIndex: number) => {
                        let columnName = `${column.table_name}_${column.column_name}`;
                        if (column && column.schema === 'dra_excel' || column.schema === 'dra_pdf') {
                            columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                        }
                        
                        // Get the column data type and format the value accordingly
                        const columnType = columnDataTypes.get(columnName) || 'TEXT';
                        
                        // Log JSON/JSONB/DATE columns for debugging (first row only)
                        if ((columnType.toUpperCase().includes('JSON') || 
                             columnType.toUpperCase().includes('DATE') || 
                             columnType.toUpperCase().includes('TIME') || 
                             columnType.toUpperCase().includes('TIMESTAMP')) && 
                            index === 0) {
                            console.log(`Column ${columnName} (${columnType}):`, typeof row[columnName], row[columnName]);
                        }
                        
                        const formattedValue = this.formatValueForSQL(row[columnName], columnType, columnName);
                        
                        if (columnIndex < sourceTable.columns.length - 1) {
                            values += `${formattedValue},`;
                        } else {
                            values += formattedValue;
                        }
                    });
                    if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                        values += ',';
                    }
                    sourceTable.calculated_columns.forEach((column: any, columnIndex: number) => {
                        const columnName = column.column_name;
                        if (columnIndex < sourceTable.calculated_columns.length - 1) {
                            values += `'${row[columnName] || 0}',`;
                        } else {
                            values += `'${row[columnName] || 0}'`;
                        }
                    });
                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                    internalDbConnector.query(insertQuery);
                });
                await manager.update(DRADataModel, {id: existingDataModel.id}, {schema: 'public', name: dataModelName, sql_query: query, query: JSON.parse(queryJSON)});
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
            const project: DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}, relations: ['data_sources', 'data_sources.data_models', 'data_sources.project', 'users_platform']});
            if (!project) {
                return resolve([]);
            }
            const dataSources: DRADataSource[] = project.data_sources;
            let tables:any[] = [];
            for (let i=0; i<dataSources.length; i++) {
                const dataSource = dataSources[i];
                const dataModels = dataSource?.data_models || [];
                if (!dataModels) {
                    continue;
                }
                const dataModelsTableNames = dataModels.map((dataModel) => {
                    return {
                        schema: dataModel.schema,
                        table_name: dataModel.name,
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
                for (let i=0; i < dataModelsTableNames.length; i++) {
                    const dataModelTableName = dataModelsTableNames[i];
                    query = `SELECT * FROM "${dataModelTableName.schema}"."${dataModelTableName.table_name}"`;
                    let rowsData = await dbConnector.query(query);
                    const tableSchema = tablesSchema.find((table: any) => {
                        return table.table_name === dataModelTableName.table_name && table.table_schema === dataModelTableName.schema;
                    });
                    if (tableSchema) {
                        tableSchema.rows = rowsData;
                    }
                }
                let tempTables = tablesSchema.map((table: any) => {
                    return {
                        table_name: table.table_name,
                        schema: table.table_schema,
                        columns: [],
                        rows: table.rows,
                    }
                });
                tempTables = _.uniqBy(tempTables, 'table_name');
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
            return resolve(tables.flat());
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
}