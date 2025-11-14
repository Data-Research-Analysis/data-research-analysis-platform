import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { DRAProject } from "../models/DRAProject.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADashboard } from "../models/DRADashboard.js";
import { DataSource } from "typeorm";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";
import { IDataSourceReturn } from "../types/IDataSourceReturn.js";
import { IPDFDataSourceReturn } from "../types/IPDFDataSourceReturn.js";
import { IExcelDataSourceReturn } from "../types/IExcelDataSourceReturn.js";
import { FilesService } from "../services/FilesService.js";
import { QueueService } from "../services/QueueService.js";
export class DataSourceProcessor {
    private static instance: DataSourceProcessor;
    private constructor() {}

    public static getInstance(): DataSourceProcessor {
        if (!DataSourceProcessor.instance) {
            DataSourceProcessor.instance = new DataSourceProcessor();
        }
        return DataSourceProcessor.instance;
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

    async getDataSources(tokenDetails: ITokenDetails): Promise<DRADataSource[]> {
        return new Promise<DRADataSource[]>(async (resolve, reject) => {
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
            const dataSources = await manager.find(DRADataSource, {where: {users_platform: user}, relations: ['project']});
            return resolve(dataSources);
        });
    }

    public async connectToDataSource(connection: IDBConnectionDetails): Promise<DataSource> {
        return new Promise<DataSource>(async (resolve, reject) => {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(null);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
            if (!externalDriver) {
                return resolve(null);
            }
            let dbConnector: DataSource;
            try {
                dbConnector =  await externalDriver.connectExternalDB(connection);
                if (!dbConnector) {
                    return resolve(null);
                }
                return resolve(dbConnector);
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return resolve(null);
            }
        });
    }

    public async addDataSource(connection: IDBConnectionDetails, tokenDetails: ITokenDetails, projectId: number): Promise<boolean> {
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
            const project:DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}});
            if (project) {
                const dataSource = new DRADataSource();
                dataSource.name = connection.database;
                dataSource.connection_details = connection;
                dataSource.data_type = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                dataSource.project = project;
                dataSource.users_platform = user;
                await manager.save(dataSource);
                return resolve(true);
            }
            return resolve(false);
        });
    }

    public async updateDataSource(dataSourceId: number, connection: IDBConnectionDetails, tokenDetails: ITokenDetails): Promise<boolean> {
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
            
            // Find existing data source owned by user
            const dataSource = await manager.findOne(DRADataSource, {
                where: {id: dataSourceId, users_platform: user}
            });
            
            if (!dataSource) {
                return resolve(false);
            }
            
            // Test new connection before updating
            try {
                const testConnection = await this.connectToDataSource(connection);
                if (!testConnection) {
                    console.error('Failed to connect with new credentials');
                    return resolve(false);
                }
            } catch (error) {
                console.error('Failed to connect with new credentials:', error);
                return resolve(false);
            }
            
            // Update connection details (will be auto-encrypted by transformer)
            dataSource.connection_details = connection;
            dataSource.name = connection.database;
            dataSource.data_type = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            
            await manager.save(dataSource);
            return resolve(true);
        });
    }

    public async deleteDataSource(dataSourceId: number, tokenDetails: ITokenDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const { user_id } = tokenDetails;
                let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!driver) {
                    return resolve(false);
                }
                const manager = (await driver.getConcreteDriver()).manager;
                const dbConnector = await driver.getConcreteDriver();
                const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
                if (!user) {
                    return resolve(false);
                }
                const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}, relations: ['data_models']});
                if (!dataSource) {
                    return resolve(false);
                }
                                
                // Get all data models for this data source
                const dataModels = dataSource.data_models;
                
                console.log(`Found ${dataModels.length} data models to delete`);
                
                // For each data model, drop physical table and clean dashboard references
                for (const dataModel of dataModels) {
                    try {
                        // Drop the physical data model table
                        await dbConnector.query(
                            `DROP TABLE IF EXISTS ${dataModel.schema}.${dataModel.name}`
                        );
                    } catch (error) {
                        console.error(`Error deleting physical data model ${dataModel.schema}.${dataModel.name}:`, error);
                    }
                }
                // Delete Excel schema tables
                if (dataSource.connection_details?.schema === 'dra_excel') {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_excel' AND table_name LIKE '%_data_source_${dataSource.id}_%'`;
                        const tables = await dbConnector.query(query);
                        console.log(`Found ${tables.length} Excel tables to delete`);
                        
                        for (let i = 0; i < tables.length; i++) {
                            const tableName = tables[i].table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_excel.${tableName}`);
                            console.log(`Dropped Excel table: ${tableName}`);
                        }
                    } catch (error) {
                        console.error(`Error deleting Excel tables:`, error);
                    }
                }
                
                // Delete PDF schema tables
                if (dataSource.connection_details?.schema === 'dra_pdf') {
                    if (!dbConnector) {
                        return resolve(false);
                    }
                    try {
                        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dra_pdf' AND table_name LIKE '%_data_source_${dataSource.id}%'`;
                        const tables = await dbConnector.query(query);
                        console.log(`Found ${tables.length} PDF tables to delete`);
                        
                        for (let i = 0; i < tables.length; i++) {
                            const tableName = tables[i].table_name;
                            await dbConnector.query(`DROP TABLE IF EXISTS dra_pdf.${tableName}`);
                            console.log(`Dropped PDF table: ${tableName}`);
                        }
                    } catch (error) {
                        console.error(`Error deleting PDF tables:`, error);
                    }
                }                
                // Remove the data source record
                await manager.remove(dataSource);
                console.log(`Successfully deleted data source ${dataSourceId}`);
                return resolve(true);
            } catch (error) {
                console.error(`Fatal error deleting data source ${dataSourceId}:`, error);
                return resolve(false);
            }
        });
    }

    public async getTablesFromDataSource(dataSourceId: number, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
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
                return resolve(null);
            }
            const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}});
            if (!dataSource) {
                return resolve(null);
            }

            if (dataSource.data_type === EDataSourceType.MONGODB) {
                //TODO: Leaving here for when MongoDB data source is implemented
            } else if (dataSource.data_type === EDataSourceType.POSTGRESQL || dataSource.data_type === EDataSourceType.MYSQL || dataSource.data_type === EDataSourceType.MARIADB || dataSource.data_type === EDataSourceType.EXCEL || dataSource.data_type === EDataSourceType.PDF) {
                const connection: IDBConnectionDetails = dataSource.connection_details;
                const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                if (!dataSourceType) {
                    return resolve(null);
                }
                const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
                if (!externalDriver) {
                    return resolve(null);
                }
                let dbConnector: DataSource;
                try {
                    dbConnector =  await externalDriver.connectExternalDB(connection);
                    if (!dbConnector) {
                        return resolve(false);
                    }
                } catch (error) {
                    console.log('Error connecting to external DB', error);
                    return resolve(false);
                }
                let query = await externalDriver.getTablesColumnDetails(connection.schema);
                if (connection.schema === 'dra_excel') {
                    query += ` AND tb.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                } else if (connection.schema === 'dra_pdf') {
                    query += ` AND tb.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                }
                let tablesSchema = await dbConnector.query(query);
                let tables = tablesSchema.map((table: any) => {
                    return {
                        table_name: table?.table_name || table?.TABLE_NAME,
                        schema: table.table_schema || table?.TABLE_SCHEMA,
                        columns: [],
                        references: [],
                    }
                });
                tables = _.uniqBy(tables, 'table_name');
                tables.forEach((table: any) => {
                    tablesSchema.forEach((result: any) => {
                        if (table?.table_name === result?.table_name || table?.table_name === result?.TABLE_NAME) {
                            table.columns.push({
                                column_name: result?.column_name || result?.COLUMN_NAME,
                                data_type: result?.data_type || result?.DATA_TYPE,
                                character_maximum_length: result?.character_maximum_length || result?.CHARACTER_MAXIMUM_LENGTH,
                                table_name: table?.table_name || table?.TABLE_NAME,
                                schema: table?.schema || table?.TABLE_SCHEMA,
                                alias_name: '',
                                is_selected_column: true,
                                reference: {
                                    local_table_schema: null,
                                    local_table_name: null,
                                    local_column_name: null,
    
                                    foreign_table_schema: null,
                                    foreign_table_name: null,
                                    foreign_column_name: null,
                                }
                            });
                        }
                    });
                });
                query = await externalDriver.getTablesRelationships(connection.schema);
                if (connection.schema === 'dra_excel') {
                    query += ` AND tc.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                } else if (connection.schema === 'dra_pdf') {
                    query += ` AND tc.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                }
                tablesSchema = await dbConnector.query(query);
                tablesSchema.forEach((result: any) => {
                    tables.forEach((table: any) => {
                        if (table?.table_name === result?.local_table_name || table?.table_name === result?.LOCAL_TABLE_NAME) {
                            table.columns.forEach((column: any) => {
                                if (column?.column_name === result?.local_column_name || column?.column_name === result?.LOCAL_COLUMN_NAME) {
                                    column.reference.local_table_schema = result?.local_table_schema || result?.LOCAL_TABLE_SCHEMA;
                                    column.reference.local_table_name = result?.local_table_name || result?.LOCAL_TABLE_NAME;
                                    column.reference.local_column_name = result?.local_column_name || result?.LOCAL_COLUMN_NAME;
    
                                    column.reference.foreign_table_schema = result?.foreign_table_schema || result?.FOREIGN_TABLE_SCHEMA;
                                    column.reference.foreign_table_name = result?.foreign_table_name || result?.FOREIGN_TABLE_NAME;
                                    column.reference.foreign_column_name = result?.foreign_column_name || result?.FOREIGN_COLUMN_NAME;
                                    table.references.push(column.reference);
                                }
                            });
                        }
                    });
                });
                return resolve(tables);
            }
        });
    }

    public async executeQueryOnExternalDataSource(dataSourceId: number, query: string, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
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
                return resolve(null);
            }
            const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}});
            if (!dataSource) {
                return resolve(null);
            }
            const connection: IDBConnectionDetails = dataSource.connection_details;
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(null);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType);
            if (!externalDriver) {
                return resolve(null);
            }
            let dbConnector: DataSource;
            try {
                dbConnector =  await externalDriver.connectExternalDB(connection);
                if (!dbConnector) {
                    return resolve(false);
                }
            } catch (error) {
                console.log('Error connecting to external DB', error);
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

    public async buildDataModelOnQuery(dataSourceId: number, query: string, queryJSON: string, dataModelName: string, tokenDetails: ITokenDetails): Promise<boolean> {
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
            const dataSource: DRADataSource|null = await manager.findOne(DRADataSource, {where: {id: dataSourceId, users_platform: user}});
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
            const externalDBConnector: DataSource =  await externalDriver.connectExternalDB(connection);
            if (!externalDBConnector) {
                return resolve(false);
            }
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
                    // Handle calculated column values
                    if (sourceTable.calculated_columns && sourceTable.calculated_columns.length > 0) {
                        values += ',';
                        sourceTable.calculated_columns.forEach((column: any, columnIndex: number) => {
                            const columnName = column.column_name;
                            if (columnIndex < sourceTable.calculated_columns.length - 1) {
                                values += `'${row[columnName] || 0}',`;
                            } else {
                                values += `'${row[columnName] || 0}'`;
                            }
                        });
                    }
                    
                    // Handle aggregate function values
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
                                
                                if (columnIndex < validAggFuncs.length - 1) {
                                    values += `'${row[rowKey] || 0}',`;
                                } else {
                                    values += `'${row[rowKey] || 0}'`;
                                }
                            });
                        }
                    }
                    
                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                    internalDbConnector.query(insertQuery);
                });
                const dataModel = new DRADataModel();
                dataModel.schema = 'public';
                dataModel.name = dataModelName;
                dataModel.sql_query = query;
                dataModel.query = JSON.parse(queryJSON);
                dataModel.data_source = dataSource;
                dataModel.users_platform = user;
                await manager.save(dataModel);
                return resolve(true);
            } catch (error) {
                console.log('error', error);
                return resolve(false);
            }
        });
    }

    public async addExcelDataSource(dataSourceName: string, fileId: string, data: string, tokenDetails: ITokenDetails, projectId: number, dataSourceId: number = null, sheetInfo?: any): Promise<IExcelDataSourceReturn> {
        return new Promise<IExcelDataSourceReturn>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const project:DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}});
            if (project) {
                let dataSource = new DRADataSource();
                const sheetsProcessed = [];
                if (!dataSourceId) {
                    //the tables will be saved in the platform's own database but in a dedicated schema
                    const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                    const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                    const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                    const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                    const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                    //The excel files will be saved as tables in the dra_excel schema which will be separate from the public schema.
                    let query = `CREATE SCHEMA IF NOT EXISTS dra_excel`;
                    await dbConnector.query(query);
                    const connection: IDBConnectionDetails = {
                        data_source_type: UtilityService.getInstance().getDataSourceType('postgresql'),
                        host: host,
                        port: port,
                        schema: 'dra_excel',
                        database: database,
                        username: username,
                        password: password,
                    };
                    dataSource.name = dataSourceName;
                    dataSource.connection_details = connection;
                    dataSource.data_type = UtilityService.getInstance().getDataSourceType('postgresql');
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId, project: project, users_platform: user } });
                }
                
                try {
                    const parsedTableStructure = JSON.parse(data);
                    // Get sheet information
                    const sheetName = sheetInfo?.sheet_name || 'Sheet1';
                    const sheetId = sheetInfo?.sheet_id || `sheet_${Date.now()}`;
                    const originalSheetName = sheetInfo?.original_sheet_name || sheetName;
                    const sheetIndex = sheetInfo?.sheet_index || 0;
                
                    // Create table name for this sheet
                    const rawTableName = `excel_${fileId}_data_source_${dataSource.id}_${sheetName.toLowerCase()}`;
                    const tableName = this.sanitizeTableName(rawTableName);
                    
                    let createTableQuery = `CREATE TABLE dra_excel."${tableName}" `;
                    let columns = '';
                    let insertQueryColumns = '';
                    const sanitizedColumns: Array<{
                        original: string, 
                        sanitized: string, 
                        type: string, 
                        title?: string, 
                        key?: string,
                        originalTitle?: string,
                        displayTitle?: string
                    }> = [];
                    
                    if (parsedTableStructure.columns && parsedTableStructure.columns.length > 0) {
                        parsedTableStructure.columns.forEach((column: any, index: number) => {
                            // Use renamed title if available, fall back to original names
                            const displayColumnName = column.title || column.column_name || `column_${index}`;
                            const originalColumnName = column.originalTitle || column.original_title || column.column_name || displayColumnName;
                            const columnKey = column.originalKey || column.original_key || column.key || displayColumnName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
                            
                            // Sanitize the display name for database usage
                            const sanitizedColumnName = this.sanitizeColumnName(displayColumnName);
                            
                            sanitizedColumns.push({
                                original: originalColumnName,
                                sanitized: sanitizedColumnName,
                                type: column.type,
                                title: displayColumnName,
                                key: columnKey,
                                originalTitle: originalColumnName,
                                displayTitle: displayColumnName
                            });
                            
                            const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.EXCEL, column.type);
                            let dataTypeString = '';
                            if (dataType.size) {
                                dataTypeString = `${dataType.type}(${dataType.size})`;
                            } else {
                                dataTypeString = `${dataType.type}`;
                            }
                            
                            if (index < parsedTableStructure.columns.length - 1) {
                                columns += `${sanitizedColumnName} ${dataTypeString},`;
                                insertQueryColumns += `${sanitizedColumnName},`;
                            } else {
                                columns += `${sanitizedColumnName} ${dataTypeString}`;
                                insertQueryColumns += `${sanitizedColumnName}`;
                            }
                        });
                        
                        createTableQuery += `(${columns})`;

                        try {
                            // Create the table
                            await dbConnector.query(createTableQuery);
                            console.log('Successfully created table:', tableName);
    
                            insertQueryColumns = `(${insertQueryColumns})`;

                            // Insert data rows
                            if (parsedTableStructure.rows && parsedTableStructure.rows.length > 0) {                            
                                let successfulInserts = 0;
                                let failedInserts = 0;
                                
                                for (let rowIndex = 0; rowIndex < parsedTableStructure.rows.length; rowIndex++) {
                                    const row = parsedTableStructure.rows[rowIndex];
                                    let insertQuery = `INSERT INTO dra_excel."${tableName}" `;
                                    let values = '';
     
                                    sanitizedColumns.forEach((columnInfo, colIndex) => {
                                        // Try multiple ways to get the value for renamed columns
                                        let value = undefined;
                                        const originalColumn = parsedTableStructure.columns[colIndex];
                                        
                                        // Frontend sends flattened row data, so try direct access first
                                        // Strategy 1: Use current column title (handles renamed columns)
                                        if (originalColumn?.title && row[originalColumn.title] !== undefined) {
                                            value = row[originalColumn.title];
                                        }
                                        // Strategy 2: Use original title if column was renamed
                                        else if (columnInfo.originalTitle && row[columnInfo.originalTitle] !== undefined) {
                                            value = row[columnInfo.originalTitle];
                                        }
                                        // Strategy 3: Use column key 
                                        else if (originalColumn?.key && row[originalColumn.key] !== undefined) {
                                            value = row[originalColumn.key];
                                        }
                                        // Strategy 4: Use original key if available
                                        else if (columnInfo.key && row[columnInfo.key] !== undefined) {
                                            value = row[columnInfo.key];
                                        }
                                        // Strategy 5: Use original column name
                                        else if (row[columnInfo.original] !== undefined) {
                                            value = row[columnInfo.original];
                                        }
                                        // Strategy 4: Try nested data structure (fallback)
                                        else if (row.data) {
                                            if (originalColumn?.title && row.data[originalColumn.title] !== undefined) {
                                                value = row.data[originalColumn.title];
                                            } else if (originalColumn?.key && row.data[originalColumn.key] !== undefined) {
                                                value = row.data[originalColumn.key];
                                            } else if (row.data[columnInfo.original] !== undefined) {
                                                value = row.data[columnInfo.original];
                                            }
                                        }
                                        if (colIndex > 0) {
                                            values += ', ';
                                        }
                                        
                                        // Handle different data types properly with comprehensive escaping
                                        if (value === null || value === undefined || value === '') {
                                            values += 'NULL';
                                        } else if (columnInfo.type === 'boolean') {
                                            const boolValue = this.convertToPostgresBoolean(value);
                                            values += boolValue;
                                        } else if (typeof value === 'string') {
                                            const escapedValue = this.escapeStringValue(value);
                                            values += `'${escapedValue}'`;
                                        } else if (typeof value === 'number') {
                                            // Ensure it's a valid number
                                            if (isNaN(value) || !isFinite(value)) {
                                                values += 'NULL';
                                            } else {
                                                values += `${value}`;
                                            }
                                        } else {
                                            // For other types, convert to string and escape
                                            const stringValue = String(value);
                                            const escapedValue = this.escapeStringValue(stringValue);
                                            values += `'${escapedValue}'`;
                                        }
                                    });
    
                                    insertQuery += `${insertQueryColumns} VALUES(${values})`;
                                    try {
                                        const result = await dbConnector.query(insertQuery);
                                        successfulInserts++;
                                    } catch (error) {
                                        failedInserts++;
                                        console.error(`ERROR inserting row ${rowIndex + 1}:`, error);
                                        console.error('Failed query:', insertQuery);
                                        console.error('Row data:', JSON.stringify(row, null, 2));
                                        console.error('Column mappings:', sanitizedColumns);
                                        throw error;
                                    }
                                }
                                                            
                                // Verify data was actually inserted by counting rows in the table
                                try {
                                    const countQuery = `SELECT COUNT(*) as row_count FROM dra_excel."${tableName}"`;
                                    const countResult = await dbConnector.query(countQuery);
                                    const actualRowCount = countResult[0]?.row_count || 0;
                                    
                                    if (actualRowCount === 0 && parsedTableStructure.rows.length > 0) {
                                        console.error('WARNING: No rows found in database despite successful insertions!');
                                    } else if (actualRowCount !== parsedTableStructure.rows.length) {
                                        console.warn(`Row count mismatch: Expected ${parsedTableStructure.rows.length}, found ${actualRowCount}`);
                                    }
                                } catch (error) {
                                    console.error('Error verifying row count:', error);
                                }
                                console.log(`Successfully inserted all ${parsedTableStructure.rows.length} rows`);
                            } else {
                                console.log('No rows to insert - parsedTableStructure.rows is empty or undefined');
                            }
                            // Log column mapping for renamed columns
                            const renamedColumns = sanitizedColumns.filter(col => 
                                col.originalTitle && col.displayTitle && col.originalTitle !== col.displayTitle
                            );
                            // Track processed sheet
                            sheetsProcessed.push({
                                sheet_id: sheetId,
                                sheet_name: sheetName,
                                table_name: tableName, // Using sanitized table name
                                original_sheet_name: originalSheetName,
                                sheet_index: sheetIndex
                            });
                            console.log(`Successfully processed sheet: ${sheetName} -> table: ${tableName}`);
                        } catch (error) {
                            console.error('Error creating table:', error);
                            console.error('Failed query:', createTableQuery);
                            throw error;
                        }                        
                    }
                    
                    console.log('Excel data source processing completed successfully');
                    return resolve({ 
                        status: 'success', 
                        file_id: fileId, 
                        data_source_id: dataSource.id, 
                        sheets_processed: sheetsProcessed 
                    });
                
                } catch (error) {
                    console.error('Error processing Excel data source:', error);
                    console.error('Sheet info:', sheetInfo);
                    console.error('Data structure:', data?.substring(0, 500) + '...');
                    return resolve({ status: 'error', file_id: fileId });
                }
            }
            return resolve({ status: 'error', file_id: fileId });
        });
    }

    public async addPDFDataSource(dataSourceName: string, fileId: string, data: string, tokenDetails: ITokenDetails, projectId: number, dataSourceId: number = null, sheetInfo?: any): Promise<IPDFDataSourceReturn> {
        return new Promise<IPDFDataSourceReturn>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const dbConnector = await driver.getConcreteDriver();
            if (!dbConnector) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve({ status: 'error', file_id: fileId });
            }
            const project: DRAProject|null = await manager.findOne(DRAProject, {where: {id: projectId, users_platform: user}});
            if (project) {
                let dataSource = new DRADataSource();
                const sheetsProcessed = [];
                if (!dataSourceId) {
                    // Create new data source - tables will be saved in the platform's own database but in a dedicated schema
                    const host = UtilityService.getInstance().getConstants('POSTGRESQL_HOST');
                    const port = UtilityService.getInstance().getConstants('POSTGRESQL_PORT');
                    const database = UtilityService.getInstance().getConstants('POSTGRESQL_DB_NAME');
                    const username = UtilityService.getInstance().getConstants('POSTGRESQL_USERNAME');
                    const password = UtilityService.getInstance().getConstants('POSTGRESQL_PASSWORD');

                    // The PDF files will be saved as tables in the dra_pdf schema which will be separate from the public schema
                    let query = `CREATE SCHEMA IF NOT EXISTS dra_pdf`;
                    await dbConnector.query(query);
                    const connection: IDBConnectionDetails = {
                        data_source_type: UtilityService.getInstance().getDataSourceType('postgresql'),
                        host: host,
                        port: port,
                        schema: 'dra_pdf',
                        database: database,
                        username: username,
                        password: password,
                    };
                    dataSource.name = `${dataSourceName}_${new Date().getTime()}`;
                    dataSource.connection_details = connection;
                    dataSource.data_type = UtilityService.getInstance().getDataSourceType('postgresql');
                    dataSource.project = project;
                    dataSource.users_platform = user;
                    dataSource.created_at = new Date();
                    dataSource = await manager.save(dataSource);
                } else {
                    dataSource = await manager.findOne(DRADataSource, { where: { id: dataSourceId, project: project, users_platform: user } });
                }

                try {
                    // Parse the data - could be a single sheet or multiple sheets
                    const parsedTableStructure = JSON.parse(data);
                    const sheetName = sheetInfo?.sheet_name || 'Sheet1';
                    const sheetId = sheetInfo?.sheet_id || `sheet_${Date.now()}`;                    
                    const sheetIndex = sheetInfo?.sheet_index || 0;

                    // Create table name for this sheet
                    const rawTableName = `pdf_${fileId}_data_source_${dataSource.id}_${sheetName.toLowerCase()}`;
                    const tableName = this.sanitizeTableName(rawTableName);
                    // Create table query
                    let createTableQuery = `CREATE TABLE dra_pdf.${tableName} `;
                    let columns = '';
                    let insertQueryColumns = '';
                    
                    const sanitizedPdfColumns: Array<{
                        original: string, 
                        sanitized: string, 
                        type: string, 
                        title?: string, 
                        key?: string,
                        originalTitle?: string,
                        displayTitle?: string
                    }> = [];
                    
                    if (parsedTableStructure.columns && parsedTableStructure.columns.length > 0) {
                        parsedTableStructure.columns.forEach((column: any, index: number) => {
                            // Handle renamed columns for PDF similar to Excel
                            const displayColumnName = column.title || column.column_name || `column_${index}`;
                            const originalColumnName = column.originalTitle || column.original_title || column.column_name || displayColumnName;
                            const columnKey = column.originalKey || column.original_key || column.key || displayColumnName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
                            
                            // Sanitize the display name for database usage
                            const sanitizedColumnName = this.sanitizeColumnName(displayColumnName);
                            
                            sanitizedPdfColumns.push({
                                original: originalColumnName,
                                sanitized: sanitizedColumnName,
                                type: column.type,
                                title: displayColumnName,
                                key: columnKey,
                                originalTitle: originalColumnName,
                                displayTitle: displayColumnName
                            });
                            
                            const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(EDataSourceType.PDF, column.type);
                            let dataTypeString = '';
                            if (dataType.size) {
                                dataTypeString = `${dataType.type}(${dataType.size})`;
                            } else {
                                dataTypeString = `${dataType.type}`;
                            }
                            if (index < parsedTableStructure.columns.length - 1) {
                                columns += `${sanitizedColumnName} ${dataTypeString}, `;
                            } else {
                                columns += `${sanitizedColumnName} ${dataTypeString} `;
                            }
                            if (index < parsedTableStructure.columns.length - 1) {
                                insertQueryColumns += `${sanitizedColumnName},`;
                            } else {
                                insertQueryColumns += `${sanitizedColumnName}`;
                            }
                        });
                        
                        createTableQuery += `(${columns})`;

                        insertQueryColumns = `(${insertQueryColumns})`;
                        try {
                            // Create the table
                            await dbConnector.query(createTableQuery);
                            // await dbConnector.query(alterTableQuery);
                            console.log('Successfully created table:', tableName);
                            // Insert data rows
                            if (parsedTableStructure.rows && parsedTableStructure.rows.length > 0) {
                                for (const row of parsedTableStructure.rows) {
                                    let insertQuery = `INSERT INTO dra_pdf.${tableName} `;
                                    let values = '';
                                    
                                    sanitizedPdfColumns.forEach((columnInfo, colIndex) => {
                                        // Try multiple ways to get the value for renamed columns (similar to Excel)
                                        let value = undefined;
                                        const originalColumn = parsedTableStructure.columns[colIndex];
                                        
                                        // Strategy 1: Use current column title (handles renamed columns)
                                        if (originalColumn?.title && row[originalColumn.title] !== undefined) {
                                            value = row[originalColumn.title];
                                        }
                                        // Strategy 2: Use original title if column was renamed
                                        else if (columnInfo.originalTitle && row[columnInfo.originalTitle] !== undefined) {
                                            value = row[columnInfo.originalTitle];
                                        }
                                        // Strategy 3: Use column key 
                                        else if (originalColumn?.key && row[originalColumn.key] !== undefined) {
                                            value = row[originalColumn.key];
                                        }
                                        // Strategy 4: Try nested data structure (fallback)
                                        else if (row.data) {
                                            if (originalColumn?.title && row.data[originalColumn.title] !== undefined) {
                                                value = row.data[originalColumn.title];
                                            } else if (columnInfo.originalTitle && row.data[columnInfo.originalTitle] !== undefined) {
                                                value = row.data[columnInfo.originalTitle];
                                            } else if (originalColumn?.key && row.data[originalColumn.key] !== undefined) {
                                                value = row.data[originalColumn.key];
                                            }
                                        }
                                        
                                        if (colIndex > 0) {
                                            values += ', ';
                                        }
                                        
                                        // Handle different data types properly with comprehensive escaping
                                        if (value === null || value === undefined || value === '') {
                                            values += 'NULL';
                                        } else if (columnInfo.type === 'boolean') {
                                            const boolValue = this.convertToPostgresBoolean(value);
                                            values += boolValue;
                                        } else if (typeof value === 'string') {
                                            const escapedValue = this.escapeStringValue(value);
                                            values += `'${escapedValue}'`;
                                        } else if (typeof value === 'number') {
                                            // Ensure it's a valid number
                                            if (isNaN(value) || !isFinite(value)) {
                                                values += 'NULL';
                                            } else {
                                                values += `${value}`;
                                            }
                                        } else {
                                            // For other types, convert to string and escape
                                            const escapedValue = this.escapeStringValue(String(value));
                                            values += `'${escapedValue}'`;
                                        }
                                    });

                                    insertQuery += `${insertQueryColumns} VALUES(${values});`;
                                    await dbConnector.query(insertQuery);
                                }
                            }
                            
                            // Log column mapping for renamed columns (PDF)
                            const renamedPdfColumns = sanitizedPdfColumns.filter(col => 
                                col.originalTitle && col.displayTitle && col.originalTitle !== col.displayTitle
                            );
                            if (renamedPdfColumns.length > 0) {
                                renamedPdfColumns.forEach(col => {
                                    console.log(`  "${col.originalTitle}" -> "${col.displayTitle}" (DB: ${col.sanitized})`);
                                });
                            }
                        } catch (error) {
                            console.error('Error creating table:', tableName, error);
                            throw error;
                        }
                        // Track processed sheet
                        sheetsProcessed.push({
                            sheet_id: sheetId,
                            sheet_name: sheetName,
                            table_name: tableName,
                            sheet_index: sheetIndex
                        });
                    }
                } catch (error) {
                    console.error('Error processing Excel data source:', error);
                    console.error('Sheet info:', sheetInfo);
                    console.error('Data structure:', data?.substring(0, 500) + '...');
                    return resolve({ status: 'error', file_id: fileId });
                }

                // Add the user to the delete files queue, which will get all of the
                //files uploaded by the user and will be deleted
                await QueueService.getInstance().addFilesDeletionJob(user.id);

                // FilesService.getInstance().deleteFileFromDisk()
                
                return resolve({
                    status: 'success', 
                    file_id: fileId, 
                    data_source_id: dataSource.id,
                    sheets_processed: sheetsProcessed.length,
                    sheet_details: sheetsProcessed
                });
            }
            return resolve({ status: 'error', file_id: fileId });
        });
    }

    /**
     * Sanitizes column names to be PostgreSQL-compliant
     */
    private sanitizeColumnName(columnName: string): string {
        // Remove special characters and replace spaces with underscores
        let sanitized = columnName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        
        // Ensure it starts with a letter or underscore
        if (!/^[a-zA-Z_]/.test(sanitized)) {
            sanitized = `col_${sanitized}`;
        }
        
        // Ensure it's not empty
        if (!sanitized) {
            sanitized = `col_${Date.now()}`;
        }
        
        // Check against PostgreSQL reserved keywords
        const reservedKeywords = [
            'user', 'table', 'select', 'insert', 'update', 'delete', 'create', 'drop', 
            'alter', 'index', 'view', 'grant', 'revoke', 'commit', 'rollback', 'transaction',
            'primary', 'foreign', 'key', 'constraint', 'check', 'unique', 'not', 'null',
            'default', 'auto_increment', 'timestamp', 'date', 'time', 'year', 'month',
            'order', 'group', 'having', 'where', 'limit', 'offset', 'union', 'join',
            'inner', 'outer', 'left', 'right', 'cross', 'natural', 'on', 'using'
        ];
        
        if (reservedKeywords.includes(sanitized.toLowerCase())) {
            sanitized = `${sanitized}_col`;
        }
        
        return sanitized;
    }

    /**
     * Sanitizes table names to be PostgreSQL-compliant
     */
    private sanitizeTableName(tableName: string): string {
        return tableName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
    }

    /**
     * Properly escapes string values for PostgreSQL queries
     */
    private escapeStringValue(value: string): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''")
            .replace(/\0/g, '\\0');
    }

    /**
     * Converts various boolean representations to PostgreSQL boolean format
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
}