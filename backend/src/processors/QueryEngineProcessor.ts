import _ from "lodash";
import { DBDriver } from "../drivers/DBDriver.js";
import { DRADataSource } from "../models/DRADataSource.js";
import { DRAProjectMember } from "../models/DRAProjectMember.js";
import { DRADataModel } from "../models/DRADataModel.js";
import { DRADataModelSource } from "../models/DRADataModelSource.js";
import { DataSource } from "typeorm";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { UtilityService } from "../services/UtilityService.js";
import { SchemaCollectorService } from "../services/SchemaCollectorService.js";
import { DataSourceSQLHelpers } from './helpers/DataSourceSQLHelpers.js';

export class QueryEngineProcessor {
    private static instance: QueryEngineProcessor;
    private constructor() { }

    public static getInstance(): QueryEngineProcessor {
        if (!QueryEngineProcessor.instance) {
            QueryEngineProcessor.instance = new QueryEngineProcessor();
        }
        return QueryEngineProcessor.instance;
    }

    private async executeMongoDBQuery(dataSourceId: number, queryJSON: string, tokenDetails: ITokenDetails): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve({ success: false, error: 'Internal driver error' });
            }
            const manager = (await driver.getConcreteDriver()).manager;

            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve({ success: false, error: 'User not found' });
            }

            // Find data source
            let dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId },
                relations: { project: true, users_platform: true }
            });

            if (!dataSource) {
                return resolve({ success: false, error: 'Data source not found' });
            }

            // Verify access (ownership or project membership)
            if (dataSource.users_platform?.id !== user.id) {
                const membership = await manager.findOne(DRAProjectMember, {
                    where: {
                        user: { id: user_id },
                        project: { id: dataSource.project.id }
                    }
                });
                if (!membership) {
                    return resolve({ success: false, error: 'Access denied' });
                }
            }

            // Validate query JSON structure
            const { MongoDBValidator } = await import('../utilities/MongoDBValidator.js');
            const validation = MongoDBValidator.validateQueryJSON(queryJSON);
            
            if (!validation.valid) {
                return resolve({ 
                    success: false, 
                    error: validation.error || 'Invalid query',
                    data: [],
                    rowCount: 0
                });
            }

            const { collection: collectionName, pipeline } = validation;

            // Check if data is imported to PostgreSQL (new approach)
            if (dataSource.sync_status === 'completed' && dataSource.last_sync_at) {
                console.log(`[DataSourceProcessor] Querying MongoDB data from PostgreSQL for collection: ${collectionName}`);
                try {
                    const results = await this.executeMongoDBQueryFromPostgreSQL(
                        collectionName!,
                        pipeline!,
                        dataSourceId
                    );
                    
                    return resolve({
                        success: true,
                        data: results,
                        rowCount: results.length
                    });
                } catch (error: any) {
                    console.error('[DataSourceProcessor] PostgreSQL query failed, falling back to MongoDB:', error);
                    // Fall through to direct MongoDB query
                }
            }

            // Fall back to direct MongoDB query (legacy approach or if PostgreSQL query fails)
            console.log(`[DataSourceProcessor] Querying MongoDB directly for collection: ${collectionName}`);

            // Connect to MongoDB
            const connection = dataSource.connection_details;
            
            // If connection_string exists in the database column, add it to connection object
            if (dataSource.connection_string) {
                connection.connection_string = dataSource.connection_string;
            }
            
            const mongoDriver = await DBDriver.getInstance().getDriver(EDataSourceType.MONGODB);
            let dbConnector: DataSource;
            try {
                dbConnector = await mongoDriver.connectExternalDB(connection);
            } catch (error) {
                return resolve({ success: false, error: 'Failed to connect to MongoDB' });
            }

            try {
                // Execute aggregation - type-safe check for optional method
                if (!mongoDriver.executeAggregation || typeof mongoDriver.executeAggregation !== 'function') {
                    return resolve({ success: false, error: 'MongoDB driver does not support aggregation' });
                }
                
                const results = await mongoDriver.executeAggregation(collectionName!, pipeline!);

                return resolve({
                    success: true,
                    data: results,
                    rowCount: results.length
                });

            } catch (error: any) {
                console.error('MongoDB query execution error:', error);
                return resolve({ 
                    success: false, 
                    error: error.message || 'Query execution failed',
                    data: [],
                    rowCount: 0
                });
            } finally {
                await mongoDriver.close();
            }
        });
    }

    /**
     * Execute MongoDB query against PostgreSQL (for imported data)
     * @private
     */
    private async executeMongoDBQueryFromPostgreSQL(
        collectionName: string,
        pipeline: any[],
        dataSourceId: number
    ): Promise<any[]> {
        const { MongoDBQueryTranslator } = await import('../services/MongoDBQueryTranslator.js');
        
        // Sanitize collection name to table name base
        const sanitizedBase = collectionName
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&')
            .substring(0, 63);
        
        // Generate unique table name with data source ID (matches MongoDBImportService pattern)
        const tableName = `${sanitizedBase}_data_source_${dataSourceId}`;
        
        // Translate MongoDB aggregation pipeline to SQL
        const translator = new MongoDBQueryTranslator();
        const sql = translator.translatePipeline(tableName, pipeline);
        
        console.log(`[DataSourceProcessor] Translated SQL: ${sql}`);

        // Execute SQL query against PostgreSQL
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const pgDataSource = await driver.getConcreteDriver();
        const results = await pgDataSource.query(sql);

        return results;
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
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }

            // First try to find data source owned by user
            let dataSource: DRADataSource | null = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId, users_platform: user },
                relations: { project: true }
            });

            // If not owned, check if user is a member of the project that owns this data source
            if (!dataSource) {
                dataSource = await manager.findOne(DRADataSource, {
                    where: { id: dataSourceId },
                    relations: { project: true }
                });

                if (dataSource && dataSource.project) {
                    // Check if user is a member of this project
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: { id: user_id },
                            project: { id: dataSource.project.id }
                        }
                    });

                    if (!membership) {
                        return resolve(null);
                    }
                } else {
                    return resolve(null);
                }
            }

            if (!dataSource) {
                return resolve(null);
            }

            if (dataSource.data_type === EDataSourceType.MONGODB) {
                // MongoDB data is synced to PostgreSQL in dra_mongodb schema
                // Query PostgreSQL directly instead of connecting to MongoDB
                const connection = dataSource.connection_details;
                const schemaCollector = new SchemaCollectorService();
                
                // Get internal PostgreSQL connection (where MongoDB data is synced)
                const pgDriver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                if (!pgDriver) {
                    console.error('[DataSourceProcessor] Cannot get PostgreSQL driver for MongoDB data');
                    return resolve(null);
                }
                
                const pgManager = (await pgDriver.getConcreteDriver()).manager;
                if (!pgManager) {
                    console.error('[DataSourceProcessor] Cannot get PostgreSQL manager for MongoDB data');
                    return resolve(null);
                }
                
                const pgConnection = pgManager.connection;
                const schemaName = 'dra_mongodb';
                
                try {
                    console.log(`[DataSourceProcessor] Querying PostgreSQL schema '${schemaName}' for MongoDB data source ${dataSourceId}`);
                    
                    // Collect schema from PostgreSQL where MongoDB data is stored
                    const tables = await schemaCollector.collectSchema(pgConnection, schemaName);
                    
                    // Filter tables to only include those for this data source
                    // MongoDB tables are named: {collection}_data_source_{id}
                    const dataSourceSuffix = `_data_source_${dataSourceId}`;
                    const filteredTables = tables.filter((table: any) => 
                        table.tableName.endsWith(dataSourceSuffix)
                    );
                    
                    // Transform to match frontend expected format (table_name with underscore)
                    // KEEP the physical table name with suffix (just like dra_excel does)
                    const cleanedTables = filteredTables.map((table: any) => {
                        const physicalTableName = table.tableName;
                        const logicalName = table.tableName.replace(dataSourceSuffix, '');
                        return {
                            table_name: physicalTableName,  // Keep full physical name for queries
                            logical_name: logicalName,      // Display name without suffix
                            original_sheet_name: null,
                            table_type: null,
                            schema: schemaName,
                            columns: table.columns.map((col: any) => ({
                                column_name: col.column_name,
                                data_type: col.data_type,
                                character_maximum_length: col.character_maximum_length,
                                table_name: physicalTableName,  // Use physical name
                                schema: schemaName,
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
                            })),
                            references: table.foreignKeys.map((fk: any) => ({
                                local_table_schema: fk.table_schema,
                                local_table_name: fk.table_name,  // Keep physical name
                                local_column_name: fk.column_name,
                                foreign_table_schema: fk.foreign_table_schema,
                                foreign_table_name: fk.foreign_table_name,  // Keep physical name
                                foreign_column_name: fk.foreign_column_name,
                            }))
                        };
                    });
                    
                    console.log(`[DataSourceProcessor] Found ${cleanedTables.length} tables for MongoDB data source ${dataSourceId}`);
                    return resolve(cleanedTables);
                    
                } catch (error) {
                    console.error('[DataSourceProcessor] Error getting MongoDB tables from PostgreSQL:', error);
                    return resolve(null);
                }
            } else if (dataSource.data_type === EDataSourceType.POSTGRESQL || dataSource.data_type === EDataSourceType.MYSQL || dataSource.data_type === EDataSourceType.MARIADB || dataSource.data_type === EDataSourceType.EXCEL || dataSource.data_type === EDataSourceType.PDF || dataSource.data_type === EDataSourceType.GOOGLE_ANALYTICS || dataSource.data_type === EDataSourceType.GOOGLE_AD_MANAGER || dataSource.data_type === EDataSourceType.GOOGLE_ADS || dataSource.data_type === EDataSourceType.META_ADS) {
                const connection = dataSource.connection_details;
                console.log('[DEBUG - DataSourceProcessor] Connecting to data source ID:', dataSource.id);
                console.log('[DEBUG - DataSourceProcessor] Data source type:', dataSource.data_type);

                // API-integrated sources store their data in internal PostgreSQL under dedicated schemas
                const isApiIntegratedSource = (
                    dataSource.data_type === EDataSourceType.GOOGLE_ANALYTICS ||
                    dataSource.data_type === EDataSourceType.GOOGLE_AD_MANAGER ||
                    dataSource.data_type === EDataSourceType.GOOGLE_ADS ||
                    dataSource.data_type === EDataSourceType.META_ADS
                );

                // Determine schema name based on data source type
                // For API-based sources (Google Analytics, Ads, Ad Manager, Meta Ads), connection_details doesn't have 'schema'
                // We need to derive it from the data_type instead
                let schemaName: string;
                if (dataSource.data_type === EDataSourceType.GOOGLE_ANALYTICS) {
                    schemaName = 'dra_google_analytics';
                } else if (dataSource.data_type === EDataSourceType.GOOGLE_AD_MANAGER) {
                    schemaName = 'dra_google_ad_manager';
                } else if (dataSource.data_type === EDataSourceType.GOOGLE_ADS) {
                    schemaName = 'dra_google_ads';
                } else if (dataSource.data_type === EDataSourceType.META_ADS) {
                    schemaName = 'dra_meta_ads';
                } else if (dataSource.data_type === EDataSourceType.EXCEL) {
                    schemaName = 'dra_excel';
                } else if (dataSource.data_type === EDataSourceType.PDF) {
                    schemaName = 'dra_pdf';
                } else {
                    // For PostgreSQL, MySQL, MariaDB - use schema from connection_details
                    schemaName = connection.schema;
                }

                console.log('[DEBUG - DataSourceProcessor] Using schema name:', schemaName);

                // Skip API-based data sources that haven't been synced yet
                if ('oauth_access_token' in connection) {
                    // For OAuth sources, we only return tables if they've been synced to PostgreSQL
                    // We'll fetch metadata to see if tables exist
                    console.log('[DEBUG - DataSourceProcessor] OAuth source detected, checking for synced tables');
                }

                const dataSourceType = isApiIntegratedSource
                    ? EDataSourceType.POSTGRESQL  // API sources are synced to PostgreSQL
                    : UtilityService.getInstance().getDataSourceType(connection.data_source_type);

                if (!dataSourceType) {
                    return resolve(null);
                }
                const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
                if (!externalDriver) {
                    return resolve(null);
                }
                let dbConnector: DataSource;
                try {
                    // For OAuth sources, connect to our internal PostgreSQL where data is synced
                    if ('oauth_access_token' in connection) {
                        dbConnector = await driver.getConcreteDriver();
                    } else {
                        dbConnector = await externalDriver.connectExternalDB(connection);
                    }
                    if (!dbConnector) {
                        return resolve(false);
                    }
                } catch (error) {
                    console.log('Error connecting to external DB', error);
                    return resolve(false);
                }

                // Fetch table metadata first to get physical table names
                let tableMetadata: any[] = [];
                try {
                    const metadataQuery = `
                        SELECT 
                            physical_table_name,
                            logical_table_name,
                            original_sheet_name,
                            file_id,
                            table_type
                        FROM dra_table_metadata
                        WHERE data_source_id = $1 AND schema_name = $2
                    `;
                    tableMetadata = await manager.query(metadataQuery, [dataSource.id, schemaName]);
                    console.log(`[DEBUG] Found ${tableMetadata.length} metadata records for schema ${schemaName}`);
                } catch (error) {
                    console.error('[DEBUG] Error fetching table metadata:', error);
                }

                // Build the base query
                let query = await externalDriver.getTablesColumnDetails(schemaName);

                // If we have metadata, use physical_table_names; otherwise fall back to old pattern
                if (tableMetadata.length > 0) {
                    const physicalTableNames = tableMetadata.map(m => m.physical_table_name);
                    const tableNamesList = physicalTableNames.map(name => `'${name}'`).join(',');
                    query += ` AND tb.table_name IN (${tableNamesList})`;
                    console.log(`[DEBUG] Using metadata-based filter for ${physicalTableNames.length} tables`);
                } else {
                    // Fallback to old naming pattern for tables without metadata
                    console.log(`[DEBUG] No metadata found, using legacy naming pattern`);
                    if (schemaName === 'dra_excel') {
                        query += ` AND tb.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                    } else if (schemaName === 'dra_pdf') {
                        query += ` AND tb.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                    } else if (schemaName === 'dra_google_analytics') {
                        query += ` AND tb.table_name LIKE '%_${dataSource.id}'`;
                    } else if (schemaName === 'dra_google_ad_manager') {
                        query += ` AND tb.table_name LIKE '%_${dataSource.id}'`;
                    } else if (schemaName === 'dra_google_ads') {
                        query += ` AND tb.table_name LIKE '%_${dataSource.id}'`;
                    } else if (schemaName === 'dra_meta_ads') {
                        query += ` AND tb.table_name LIKE '%_${dataSource.id}'`;
                    } else {
                        // For PostgreSQL, MySQL, MariaDB - no additional filter needed
                        // The schema filter in getTablesColumnDetails() is sufficient
                        // These connect to external databases where all tables in the schema belong to this connection
                        console.log(`[DEBUG] External database source: using schema filter only`);
                    }
                }

                let tablesSchema = await dbConnector.query(query);

                // Create metadata lookup map
                const metadataMap = new Map();
                tableMetadata.forEach((meta: any) => {
                    metadataMap.set(meta.physical_table_name, meta);
                });

                let tables = tablesSchema.map((table: any) => {
                    const physicalTableName = table?.table_name || table?.TABLE_NAME;
                    const metadata = metadataMap.get(physicalTableName);

                    return {
                        table_name: physicalTableName,
                        logical_name: metadata?.logical_table_name || physicalTableName,
                        original_sheet_name: metadata?.original_sheet_name || null,
                        table_type: metadata?.table_type || null,
                        schema: table.table_schema || table?.TABLE_SCHEMA,
                        columns: [],
                        references: [],
                    }
                });
                tables = _.uniqBy(tables, 'table_name');

                console.log('[DEBUG - DataSourceProcessor] Tables before column population:', tables.length);

                tables.forEach((table: any) => {
                    const columnsBefore = table.columns.length;
                    tablesSchema.forEach((result: any) => {
                        const resultTableName = result?.table_name || result?.TABLE_NAME;
                        const resultSchema = result?.table_schema || result?.TABLE_SCHEMA;

                        // Match on both table name AND schema to prevent cross-schema pollution
                        if (table?.table_name === resultTableName && table?.schema === resultSchema) {
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

                    // Defensive filter: Remove any columns that don't match the table's schema
                    const beforeFilter = table.columns.length;
                    table.columns = table.columns.filter((col: any) => col.schema === table.schema);
                    const afterFilter = table.columns.length;

                    if (beforeFilter !== afterFilter) {
                        console.warn(`[DEBUG - DataSourceProcessor] ⚠️ SCHEMA MISMATCH: Filtered ${beforeFilter - afterFilter} columns with wrong schema from ${table.table_name}`);
                    }

                    console.log(`[DEBUG - DataSourceProcessor] Table ${table.table_name}: Added ${table.columns.length - columnsBefore} columns (total: ${table.columns.length})`);

                    // Check for duplicate columns
                    const columnNames = table.columns.map((c: any) => c.column_name);
                    const duplicates = columnNames.filter((name: string, index: number) => columnNames.indexOf(name) !== index);
                    if (duplicates.length > 0) {
                        console.error(`[DEBUG - DataSourceProcessor] DUPLICATES FOUND in ${table.table_name}:`, [...new Set(duplicates)]);
                    }
                });
                query = await externalDriver.getTablesRelationships(schemaName);
                if (schemaName === 'dra_excel') {
                    query += ` AND tc.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                } else if (schemaName === 'dra_pdf') {
                    query += ` AND tc.table_name LIKE '%_data_source_${dataSource.id}_%'`;
                }
                tablesSchema = await dbConnector.query(query);

                console.log('[DEBUG - DataSourceProcessor] Foreign key relationships found:', tablesSchema.length);

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

                // CRITICAL FIX: Deduplicate columns in each table
                console.log('[DEBUG - DataSourceProcessor] Deduplicating columns...');
                tables.forEach((table: any) => {
                    const beforeCount = table.columns.length;
                    table.columns = _.uniqBy(table.columns, (col: any) =>
                        `${col.schema}.${col.table_name}.${col.column_name}`
                    );
                    const afterCount = table.columns.length;

                    if (beforeCount !== afterCount) {
                        console.log(`[DEBUG - DataSourceProcessor] ✓ Removed ${beforeCount - afterCount} duplicate columns from ${table.table_name}`);
                    }
                });

                // Final diagnostic before returning
                console.log('[DEBUG - DataSourceProcessor] Final table summary:');
                tables.forEach((table: any) => {
                    console.log(`  - ${table.table_name}: ${table.columns.length} columns, ${table.references.length} foreign keys`);
                });

                return resolve(tables);
            }
        });
    }

    public async executeQueryOnExternalDataSource(
        dataSourceId: number,
        query: string,
        tokenDetails: ITokenDetails,
        queryJSON?: string,
        isCrossSource?: boolean,
        projectId?: number
    ): Promise<any> {
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
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }


            // Handle cross-source queries
            if (isCrossSource && projectId) {
                console.log('[DataSourceProcessor] Executing cross-source query for project:', projectId);
                try {
                    // Check if this is a JOIN query or simple single-table query
                    const hasJoins = queryJSON && JSON.parse(queryJSON).join_conditions &&
                        JSON.parse(queryJSON).join_conditions.length > 0;

                    if (hasJoins) {
                        // For queries with JOINs, we need to execute on synced PostgreSQL data
                        console.log('[DataSourceProcessor] Cross-source query has JOINs, using synced data approach');

                        // Get the internal PostgreSQL connector
                        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                        if (!driver) {
                            return resolve(null);
                        }
                        const manager = (await driver.getConcreteDriver()).manager;
                        if (!manager) {
                            return resolve(null);
                        }

                        // Resolve table names and transform query
                        const tableMap = await this.resolveTableNamesForCrossSource(projectId, queryJSON, manager);

                        if (tableMap.size === 0) {
                            console.warn('[DataSourceProcessor] Tables not synced to PostgreSQL. Checking if all tables from same data source...');

                            // Parse queryJSON to get all unique data_source_ids from columns
                            const parsedQuery = JSON.parse(queryJSON);
                            const uniqueDataSourceIds = new Set<number>();

                            if (parsedQuery.columns && Array.isArray(parsedQuery.columns)) {
                                parsedQuery.columns.forEach((col: any) => {
                                    if (col.data_source_id) {
                                        uniqueDataSourceIds.add(col.data_source_id);
                                    }
                                });
                            }

                            console.log(`[DataSourceProcessor] Found ${uniqueDataSourceIds.size} unique data source(s) in query`);

                            if (uniqueDataSourceIds.size === 1) {
                                // All tables from same source - execute directly on that data source
                                const dataSourceId = Array.from(uniqueDataSourceIds)[0];
                                console.log(`[DataSourceProcessor] All tables from same data source (${dataSourceId}), executing directly on external database`);

                                const results = await this.executeQueryOnExternalDataSource(
                                    dataSourceId,
                                    query,
                                    tokenDetails,
                                    queryJSON,
                                    false, // Not cross-source anymore - executing on single source
                                    undefined
                                );
                                return resolve(results);
                            } else if (uniqueDataSourceIds.size > 1) {
                                // True cross-source query - tables not synced, cannot execute
                                console.error('[DataSourceProcessor] True cross-source query with JOIN requires tables to be synced to PostgreSQL');
                                console.error(`[DataSourceProcessor] Data sources involved: ${Array.from(uniqueDataSourceIds).join(', ')}`);
                                return resolve([]);
                            } else {
                                // No data_source_id found in columns
                                console.error('[DataSourceProcessor] Could not determine data source IDs from query columns');
                                return resolve([]);
                            }
                        }

                        const transformedQuery = this.transformQueryForCrossSource(query, tableMap);
                        console.log('[DataSourceProcessor] Executing transformed cross-source JOIN query:', transformedQuery);

                        const internalDbConnector = await driver.getConcreteDriver();
                        const results = await internalDbConnector.query(transformedQuery);
                        return resolve(results);
                    } else {
                        // For simple queries (no JOINs), execute on the first table's data source
                        // This is for preview purposes (LIMIT 5)
                        if (queryJSON) {
                            const parsedQuery = JSON.parse(queryJSON);
                            if (parsedQuery.columns && parsedQuery.columns.length > 0) {
                                // Get the first column's data source ID
                                const firstDataSourceId = parsedQuery.columns[0].data_source_id;
                                if (firstDataSourceId) {
                                    console.log('[DataSourceProcessor] Executing simple sample query on data source:', firstDataSourceId);
                                    // Execute on the specific data source and return results
                                    const results = await this.executeQueryOnExternalDataSource(
                                        firstDataSourceId,
                                        query,
                                        tokenDetails,
                                        queryJSON,
                                        false, // Not cross-source anymore
                                        undefined
                                    );
                                    return resolve(results);
                                }
                            }
                        }
                    }

                    // If we can't determine a data source, return empty
                    console.warn('[DataSourceProcessor] Could not determine data source for cross-source query');
                    return resolve([]);
                } catch (error) {
                    console.error('[DataSourceProcessor] Error executing cross-source query:', error);
                    return resolve(null);
                }
            }


            // Handle single-source queries (original logic)
            // First try to find data source owned by user
            let dataSource: DRADataSource | null = await manager.findOne(DRADataSource, { where: { id: dataSourceId, users_platform: user } });

            // If not owned by user, check if user is a member of the data source's project
            if (!dataSource) {
                dataSource = await manager.findOne(DRADataSource, {
                    where: { id: dataSourceId },
                    relations: { project: true }
                });

                if (dataSource?.project) {
                    const membership = await manager.findOne(DRAProjectMember, {
                        where: {
                            user: { id: user_id },
                            project: { id: dataSource.project.id }
                        }
                    });

                    if (!membership) {
                        return resolve(null);
                    }
                } else {
                    // Data source not associated with a project, user can't access it
                    return resolve(null);
                }
            }

            // Handle MongoDB queries
            if (dataSource.data_type === EDataSourceType.MONGODB) {
                // Check if MongoDB data is synced to PostgreSQL
                // If synced, treat as PostgreSQL query on dra_mongodb schema tables
                // If not synced, execute as native MongoDB aggregation pipeline
                if (dataSource.sync_status === 'completed' && dataSource.last_sync_at) {
                    console.log(`[DataSourceProcessor] MongoDB data source ${dataSource.id} is synced to PostgreSQL, executing SQL query on internal database`);
                    
                    try {
                        // Get internal PostgreSQL driver
                        const internalDriver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                        if (!internalDriver) {
                            return resolve({ success: false, error: 'Internal PostgreSQL driver not available', data: [], rowCount: 0 });
                        }
                        const internalDbConnector = await internalDriver.getConcreteDriver();
                        if (!internalDbConnector) {
                            return resolve({ success: false, error: 'Internal PostgreSQL connection not available', data: [], rowCount: 0 });
                        }

                        // Reconstruct SQL from JSON if provided
                        let finalQuery = query;
                        if (queryJSON) {
                            finalQuery = DataSourceSQLHelpers.reconstructSQLFromJSON(queryJSON);

                            // Extract LIMIT/OFFSET from original query if not in JSON
                            const limitMatch = query.match(/LIMIT\s+(\d+)/i);
                            const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
                            if (limitMatch && !finalQuery.includes('LIMIT')) {
                                const limit = limitMatch[1];
                                const offset = offsetMatch ? offsetMatch[1] : '0';
                                finalQuery += ` LIMIT ${limit} OFFSET ${offset}`;
                            }
                        }

                        console.log('[DataSourceProcessor] Executing SQL query on synced MongoDB data:', finalQuery);
                        const results = await internalDbConnector.query(finalQuery);
                        console.log('[DataSourceProcessor] Query results count:', results?.length || 0);
                        return resolve(results);
                    } catch (error) {
                        console.error('[DataSourceProcessor] Error executing query on synced MongoDB data:', error);
                        console.error('[DataSourceProcessor] Failed query was:', query);
                        return reject(error);
                    }
                } else {
                    // Not synced - execute as native MongoDB query with aggregation pipeline
                    console.log(`[DataSourceProcessor] MongoDB data source ${dataSource.id} not synced, executing as native MongoDB query`);
                    const jsonToUse = queryJSON || query;
                    return resolve(await this.executeMongoDBQuery(dataSource.id, jsonToUse, tokenDetails));
                }
            }

            const connection = dataSource.connection_details;
            // Skip API-based data sources
            if ('oauth_access_token' in connection) {
                return resolve(null);
            }
            const dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
            if (!dataSourceType) {
                return resolve(null);
            }
            const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
            if (!externalDriver) {
                return resolve(null);
            }
            let dbConnector: DataSource;
            try {
                dbConnector = await externalDriver.connectExternalDB(connection);
                if (!dbConnector) {
                    return resolve(false);
                }
            } catch (error) {
                console.log('Error connecting to external DB', error);
                return resolve(false);
            }
            try {
                // If JSON query is provided, reconstruct SQL from it (ensures JOINs are included)
                // The reconstructed SQL already includes LIMIT/OFFSET from query_options
                let finalQuery = query;
                if (queryJSON) {                    
                    finalQuery = DataSourceSQLHelpers.reconstructSQLFromJSON(queryJSON);

                    // Extract LIMIT/OFFSET from original query if not in JSON
                    // This handles cases where LIMIT is added as SQL string (e.g., 'LIMIT 5 OFFSET 0')
                    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
                    const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
                    if (limitMatch && !finalQuery.includes('LIMIT')) {
                        const limit = limitMatch[1];
                        const offset = offsetMatch ? offsetMatch[1] : '0';
                        finalQuery += ` LIMIT ${limit} OFFSET ${offset}`;
                    }
                }

                console.log('[DataSourceProcessor] Executing query on external datasource:', finalQuery);
                const results = await dbConnector.query(finalQuery);
                console.log('[DataSourceProcessor] Query results count:', results?.length || 0);
                return resolve(results);
            } catch (error) {
                console.error('[DataSourceProcessor] Error executing query:', error);
                console.error('[DataSourceProcessor] Failed query was:', query);
                return reject(error);
            }
        });
    }

    /**
     * Resolves original external table names to their synced PostgreSQL equivalents
     * For cross-source queries, this maps original schema.table references (e.g., mysql_dra_db.orders)
     * to their synced PostgreSQL equivalents (e.g., dra_mysql_22.orders_abc123_22)
     * 
     * @param projectId - The project ID
     * @param queryJSON - The query JSON containing table references with data_source_id
     * @param manager - TypeORM EntityManager
     * @returns Map of original table references to synced table info
     */
    private async resolveTableNamesForCrossSource(
        projectId: number,
        queryJSON: string,
        manager: any
    ): Promise<Map<string, { schema: string; table_name: string; data_source_id: number }>> {
        const tableMap = new Map<string, { schema: string; table_name: string; data_source_id: number }>();

        try {
            const parsedQuery = JSON.parse(queryJSON);

            // Extract unique table references from columns
            const tableRefs = new Map<string, { schema: string; table: string; data_source_id: number }>();
            const uniqueDataSourceIds = new Set<number>();

            if (parsedQuery.columns && Array.isArray(parsedQuery.columns)) {
                parsedQuery.columns.forEach((col: any) => {
                    if (col.schema && col.table_name && col.data_source_id) {
                        const key = `${col.schema}.${col.table_name}`;
                        if (!tableRefs.has(key)) {
                            tableRefs.set(key, {
                                schema: col.schema,
                                table: col.table_name,
                                data_source_id: col.data_source_id
                            });
                        }
                        uniqueDataSourceIds.add(col.data_source_id);
                    }
                });
            }

            const isSameSource = uniqueDataSourceIds.size === 1;
            console.log(`[DataSourceProcessor] Resolving ${tableRefs.size} unique table references for cross-source query`);
            console.log(`[DataSourceProcessor] Query involves ${uniqueDataSourceIds.size} data source(s): ${Array.from(uniqueDataSourceIds).join(', ')}`);

            // For each unique table reference, find its synced PostgreSQL equivalent
            for (const [originalRef, ref] of tableRefs) {
                console.log(`[DataSourceProcessor] Looking up synced table for: ${originalRef} (data_source_id: ${ref.data_source_id})`);

                // First, try to find in dra_table_metadata using physical_table_name or logical_table_name
                let metadata = await manager.query(`
                    SELECT 
                        physical_table_name,
                        schema_name,
                        data_source_id,
                        logical_table_name
                    FROM dra_table_metadata
                    WHERE data_source_id = $1
                    AND (physical_table_name = $2 OR logical_table_name = $2)
                    LIMIT 1
                `, [ref.data_source_id, ref.table]);

                // If not found by physical_table_name or logical_table_name, try matching by schema pattern
                // This handles cases where the table is from the original MySQL/PostgreSQL database
                if (!metadata || metadata.length === 0) {
                    // For external databases (MySQL, MariaDB, PostgreSQL), the tables are NOT synced
                    // They exist in their original schemas. We need to use foreign data wrapper approach
                    // OR we need to check if data has been synced to a DRA schema

                    // Check if this is a synced table by looking at the data source
                    const dataSource = await manager.query(`
                        SELECT id, data_type, connection_details
                        FROM dra_data_source
                        WHERE id = $1
                    `, [ref.data_source_id]);

                    if (dataSource && dataSource.length > 0) {
                        const dsType = dataSource[0].data_type;

                        // For API-based data sources (Google Analytics, Excel, CSV, PDF), tables are already in PostgreSQL
                        // They use their original schema.table names directly
                        if (dsType === 'google_analytics' || dsType === 'google_ads' || dsType === 'google_ads_manager' ||
                            dsType === 'excel' || dsType === 'csv' || dsType === 'pdf') {
                            console.log(`[DataSourceProcessor] API/File data source (${dsType}) - table already in PostgreSQL: ${originalRef}`);
                            tableMap.set(originalRef, {
                                schema: ref.schema,
                                table_name: ref.table,
                                data_source_id: ref.data_source_id
                            });
                            continue;
                        }

                        // For MySQL, MariaDB, PostgreSQL data sources that are external
                        // The query should use the original schema.table names
                        // But we need to qualify them with the synced schema if they've been imported
                        if (dsType === 'mysql' || dsType === 'mariadb' || dsType === 'postgresql') {
                            // Look for any table in metadata for this data source
                            const anyTable = await manager.query(`
                                SELECT 
                                    physical_table_name,
                                    schema_name,
                                    data_source_id
                                FROM dra_table_metadata
                                WHERE data_source_id = $1
                                LIMIT 1
                            `, [ref.data_source_id]);

                            if (anyTable && anyTable.length > 0) {
                                // Data IS synced - find the specific table
                                // Try matching by physical_table_name pattern (which may include original table name)
                                const tablePattern = await manager.query(`
                                    SELECT 
                                        physical_table_name,
                                        schema_name,
                                        data_source_id,
                                        logical_table_name
                                    FROM dra_table_metadata
                                    WHERE data_source_id = $1
                                    AND (
                                        physical_table_name = $2
                                        OR logical_table_name = $2
                                        OR physical_table_name LIKE $3
                                        OR physical_table_name LIKE $4
                                    )
                                    LIMIT 1
                                `, [ref.data_source_id, ref.table, `${ref.table}_%`, `%_${ref.table}_%`]);

                                if (tablePattern && tablePattern.length > 0) {
                                    metadata = tablePattern;
                                    console.log(`[DataSourceProcessor] Found synced table by pattern: ${tablePattern[0].schema_name}.${tablePattern[0].physical_table_name}`);
                                }
                            } else {
                                // Data is NOT synced - use original schema.table
                                console.log(`[DataSourceProcessor] Table not synced, using original reference: ${originalRef}`);
                                tableMap.set(originalRef, {
                                    schema: ref.schema,
                                    table_name: ref.table,
                                    data_source_id: ref.data_source_id
                                });
                                continue;
                            }
                        }
                    }
                }

                if (metadata && metadata.length > 0) {
                    const syncedInfo = {
                        schema: metadata[0].schema_name,
                        table_name: metadata[0].physical_table_name,
                        data_source_id: metadata[0].data_source_id
                    };

                    tableMap.set(originalRef, syncedInfo);
                    console.log(`[DataSourceProcessor] ✓ Mapped ${originalRef} → ${syncedInfo.schema}.${syncedInfo.table_name}`);
                } else {
                    // Fallback: Only use original names if ALL tables are from same data source
                    // For true cross-source queries (multiple sources), we need proper synced tables
                    if (isSameSource) {
                        console.warn(`[DataSourceProcessor] ⚠️ Could not find synced table for: ${originalRef} (data_source_id: ${ref.data_source_id})`);
                        console.log(`[DataSourceProcessor] Same-source query detected - using original table reference as fallback`);
                        tableMap.set(originalRef, {
                            schema: ref.schema,
                            table_name: ref.table,
                            data_source_id: ref.data_source_id
                        });
                    } else {
                        // True cross-source - don't add fallback, let it fail properly
                        console.error(`[DataSourceProcessor] ⚠️ Could not find synced table for: ${originalRef} (data_source_id: ${ref.data_source_id})`);
                        console.error(`[DataSourceProcessor] True cross-source query requires all tables to be synced to PostgreSQL`);
                    }
                }
            }

            console.log(`[DataSourceProcessor] Successfully resolved ${tableMap.size} table mappings`);
            return tableMap;

        } catch (error) {
            console.error('[DataSourceProcessor] Error resolving cross-source table names:', error);
            return tableMap;
        }
    }

    /**
     * Transforms cross-source SQL query to use synced PostgreSQL table names
     * Replaces original external table references with their synced equivalents
     * 
     * @param originalQuery - Original SQL with external table names (e.g., mysql_dra_db.orders)
     * @param tableMap - Map of original references to synced table info
     * @returns Transformed SQL query with synced table names
     */
    private transformQueryForCrossSource(
        originalQuery: string,
        tableMap: Map<string, { schema: string; table_name: string }>
    ): string {
        let transformedQuery = originalQuery;

        console.log('[DataSourceProcessor] Transforming query with synced table names...');

        // Sort table references by length (longest first) to avoid partial replacements
        const sortedRefs = Array.from(tableMap.entries()).sort((a, b) => b[0].length - a[0].length);

        for (const [originalRef, syncedInfo] of sortedRefs) {
            const replacement = `${syncedInfo.schema}.${syncedInfo.table_name}`;

            // Create regex that matches the table reference as a whole word
            // This handles: schema.table, schema.table.column, FROM schema.table, JOIN schema.table
            const escapedRef = originalRef.replace(/\./g, '\\.');
            const regex = new RegExp(`\\b${escapedRef}\\b`, 'g');

            const beforeCount = (transformedQuery.match(regex) || []).length;
            transformedQuery = transformedQuery.replace(regex, replacement);
            const afterCount = (transformedQuery.match(new RegExp(`\\b${replacement.replace(/\./g, '\\.')}\\b`, 'g')) || []).length;

            if (beforeCount > 0) {
                console.log(`[DataSourceProcessor] Replaced ${beforeCount} occurrences: ${originalRef} → ${replacement}`);
            }
        }

        return transformedQuery;
    }

    public async buildDataModelOnQuery(dataSourceId: number | null, query: string, queryJSON: string, dataModelName: string, tokenDetails: ITokenDetails, isCrossSource?: boolean, projectId?: number, dataModelId?: number): Promise<number | null> {
        return new Promise<number | null>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve(null);
            }
            const internalDbConnector = await driver.getConcreteDriver();
            if (!internalDbConnector) {
                return resolve(null);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve(null);
            }
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: user_id } });
            if (!user) {
                return resolve(null);
            }

            let dataSource: DRADataSource | null = null;
            let externalDBConnector: DataSource;
            let dataSourceType: any = null;

            // Handle cross-source vs single-source
            if (isCrossSource && projectId) {
                console.log('[DataSourceProcessor] Building cross-source data model for project:', projectId);

                // Parse queryJSON to check data sources
                const parsedQuery = JSON.parse(queryJSON);
                const uniqueDataSourceIds = new Set<number>();

                if (parsedQuery.columns && Array.isArray(parsedQuery.columns)) {
                    parsedQuery.columns.forEach((col: any) => {
                        if (col.data_source_id) {
                            uniqueDataSourceIds.add(col.data_source_id);
                        }
                    });
                }

                console.log(`[DataSourceProcessor] Found ${uniqueDataSourceIds.size} unique data source(s) in data model`);

                // If all tables from same source, use that source directly (no transformation needed)
                if (uniqueDataSourceIds.size === 1) {
                    const singleDataSourceId = Array.from(uniqueDataSourceIds)[0];
                    console.log(`[DataSourceProcessor] All tables from same data source (${singleDataSourceId}), using direct connection`);

                    // Fetch the data source
                    const singleDataSource = await manager.findOne(DRADataSource, {
                        where: { id: singleDataSourceId },
                        relations: { project: true, users_platform: true }
                    });

                    if (!singleDataSource) {
                        console.error('[DataSourceProcessor] Could not find data source:', singleDataSourceId);
                        return resolve(null);
                    }

                    // Check if user has access
                    if (singleDataSource.users_platform?.id !== user_id) {
                        const membership = await manager.findOne(DRAProjectMember, {
                            where: {
                                user: { id: user_id },
                                project: { id: singleDataSource.project?.id }
                            }
                        });

                        if (!membership) {
                            console.error('[DataSourceProcessor] User does not have access to data source:', singleDataSourceId);
                            return resolve(null);
                        }
                    }

                    const connection = singleDataSource.connection_details;

                    // Check if it's Excel/CSV/PDF or synced MongoDB (already in PostgreSQL)
                    if (connection.data_source_type === 'excel' || connection.data_source_type === 'csv' || connection.data_source_type === 'pdf') {
                        console.log('[DataSourceProcessor] Excel/CSV/PDF data source - using internal PostgreSQL');
                        externalDBConnector = internalDbConnector;
                        dataSourceType = EDataSourceType.POSTGRESQL;
                    } else if (singleDataSource.data_type === EDataSourceType.MONGODB && singleDataSource.sync_status === 'completed' && singleDataSource.last_sync_at) {
                        console.log('[DataSourceProcessor] Synced MongoDB data source - using internal PostgreSQL');
                        externalDBConnector = internalDbConnector;
                        dataSourceType = EDataSourceType.POSTGRESQL;
                    } else if ('oauth_access_token' in connection) {
                        console.error('[DataSourceProcessor] API-based data sources not supported for data models');
                        return resolve(null);
                    } else {
                        // External database (MySQL, MariaDB, PostgreSQL) - connect directly
                        dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                        if (!dataSourceType) {
                            return resolve(null);
                        }

                        const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
                        if (!externalDriver) {
                            return resolve(null);
                        }

                        externalDBConnector = await externalDriver.connectExternalDB(connection);
                        if (!externalDBConnector) {
                            return resolve(null);
                        }
                    }
                } else if (uniqueDataSourceIds.size > 1) {
                    // True cross-source - need to resolve synced table names
                    console.log('[DataSourceProcessor] True cross-source model - attempting to resolve synced tables');

                    const tableMap = await this.resolveTableNamesForCrossSource(projectId, queryJSON, manager);

                    if (tableMap.size === 0) {
                        console.error('[DataSourceProcessor] Could not resolve cross-source table names. Tables must be synced to PostgreSQL for cross-source JOINs.');
                        return resolve(null);
                    }

                    // Transform the query to use synced table names
                    const transformedQuery = this.transformQueryForCrossSource(query, tableMap);

                    if (transformedQuery === query) {
                        console.warn('[DataSourceProcessor] Query was not transformed. This may indicate table mapping failed.');
                    }

                    // Update the query with the transformed version
                    query = transformedQuery;

                    console.log('[DataSourceProcessor] Cross-source query transformation complete');
                    console.log('[DataSourceProcessor] Transformed query:', query);

                    // Execute on internal PostgreSQL connector with synced tables
                    externalDBConnector = internalDbConnector;
                    dataSourceType = EDataSourceType.POSTGRESQL;
                } else {
                    console.error('[DataSourceProcessor] No data source IDs found in query columns');
                    return resolve(null);
                }
            } else if (dataSourceId) {
                // Single-source: fetch data source and connect
                dataSource = await manager.findOne(DRADataSource, {
                    where: { id: dataSourceId, users_platform: user }
                });
                if (!dataSource) {
                    return resolve(null);
                }

                const connection = dataSource.connection_details;
                
                // Check if it's synced MongoDB (already in PostgreSQL)
                if (dataSource.data_type === EDataSourceType.MONGODB && dataSource.sync_status === 'completed' && dataSource.last_sync_at) {
                    console.log('[DataSourceProcessor] Synced MongoDB data source - using internal PostgreSQL');
                    externalDBConnector = internalDbConnector;
                    dataSourceType = EDataSourceType.POSTGRESQL;
                } else if ('oauth_access_token' in connection) {
                    // Skip API-based data sources
                    return resolve(null);
                } else {
                    // External database (MySQL, MariaDB, PostgreSQL) - connect directly
                    dataSourceType = UtilityService.getInstance().getDataSourceType(connection.data_source_type);
                    if (!dataSourceType) {
                        return resolve(null);
                    }

                    const externalDriver = await DBDriver.getInstance().getDriver(dataSourceType as any);
                    if (!externalDriver) {
                        return resolve(null);
                    }

                    externalDBConnector = await externalDriver.connectExternalDB(connection);
                    if (!externalDBConnector) {
                        return resolve(null);
                    }
                }
            } else {
                return resolve(null);
            }
            try {
                // Validate SQL aggregate correctness before executing query
                const validation = DataSourceSQLHelpers.validateGroupByRequirements(queryJSON);
                if (!validation.valid) {
                    console.error('[DataSourceProcessor] SQL validation failed:', validation.error);
                    throw new Error(validation.error);
                }

                dataModelName = UtilityService.getInstance().uniquiseName(dataModelName);
                
                // CRITICAL FIX: Always reconstruct SQL from JSON for data model building
                // The frontend buildSQLQuery() generates different column aliases than what the
                // INSERT code expects. For single-table queries, frontend uses "tableName_col"
                // but INSERT code looks up rows by "schema_tableName_col". Reconstructing from
                // JSON ensures aliases match the INSERT row key format, preventing null data.
                // This is consistent with executeQueryOnExternalDataSource() which also reconstructs.
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
                    
                    console.log('[DataSourceProcessor] Reconstructed SQL for data model build:', selectTableQuery);
                } catch (reconstructError) {
                    console.error('[DataSourceProcessor] SQL reconstruction failed, falling back to frontend SQL:', reconstructError);
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
                
                console.log(`[DataSourceProcessor] Column preservation: Total=${sourceTable.columns.length}, ForTable=${columnsForTableCreation.length}`);
                
                let columns = '';
                let insertQueryColumns = '';
                columnsForTableCreation.forEach((column: any, index: number) => {
                    let columnSize = '';

                    // Only apply character_maximum_length to string types, and cap NUMERIC precision at 1000
                    if (column?.character_maximum_length) {
                        const maxLength = column.character_maximum_length;
                        const columnDataType = column.data_type?.toUpperCase() || '';

                        // For NUMERIC/DECIMAL types, cap precision at 1000 (PostgreSQL limit)
                        if (columnDataType.includes('NUMERIC') || columnDataType.includes('DECIMAL')) {
                            columnSize = maxLength > 1000 ? '' : `(${maxLength})`;
                        }
                        // For string types, use the length as-is
                        else if (columnDataType.includes('CHAR') || columnDataType.includes('TEXT') || columnDataType.includes('VARCHAR')) {
                            columnSize = `(${maxLength})`;
                        }
                        // For other types, don't apply size
                    }

                    // Check if column.data_type already contains size information (e.g., "varchar(1024)")
                    // If it does, don't append columnSize again to avoid "VARCHAR(1024)(1024)"
                    const dataTypeAlreadyHasSize = column.data_type && /\(\s*\d+(?:,\d+)?\s*\)/.test(column.data_type);
                    const columnType = dataTypeAlreadyHasSize ? column.data_type : `${column.data_type}${columnSize}`;


                    // For cross-source models, use the column's data_source_type; for single-source, use the global dataSourceType
                    const columnDataSourceType = isCrossSource && column.data_source_type
                        ? UtilityService.getInstance().getDataSourceType(column.data_source_type)
                        : dataSourceType;

                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(columnDataSourceType, columnType);
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
                    } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_mongodb' || column.schema === 'dra_meta_ads')) {
                        // For special schemas (Excel, PDF, GA, GAM, Google Ads, MongoDB, Meta Ads), always use table_name regardless of aliases
                        // This preserves datasource IDs in table names (e.g., device_15, sheet_123, revenue_12345_7)
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
                                console.log(`[DataSourceProcessor] Using inferred data type for aggregate expression ${aliasName}: ${dataTypeString} (from ${expr.column_data_type})`);
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
                    } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_mongodb' || column.schema === 'dra_meta_ads')) {
                        // For special schemas (Excel, PDF, GA, GAM, Google Ads, MongoDB, Meta Ads), always use table_name regardless of aliases
                        columnName = `${column.table_name}`.length > 20 ? `${column.table_name}`.slice(-20) + `_${column.column_name}` : `${column.table_name}` + `_${column.column_name}`;
                    } else {
                        columnName = `${column.schema}_${column.table_name}_${column.column_name}`;
                    }
                    const columnSize = column?.character_maximum_length ? `(${column?.character_maximum_length})` : '';
                    const columnType = `${column.data_type}${columnSize}`;

                    // For cross-source models, use the column's data_source_type; for single-source, use the global dataSourceType
                    const columnDataSourceType = isCrossSource && column.data_source_type
                        ? UtilityService.getInstance().getDataSourceType(column.data_source_type)
                        : dataSourceType;

                    const dataType = UtilityService.getInstance().convertDataTypeToPostgresDataType(columnDataSourceType, columnType);
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
                            console.log(`[DataSourceProcessor] Set data type for aggregate expression ${expr.column_alias_name}: ${dataType}`);
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
                        } else if (column && (column.schema === 'dra_excel' || column.schema === 'dra_pdf' || column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' || column.schema === 'dra_google_ads' || column.schema === 'dra_mongodb' || column.schema === 'dra_meta_ads')) {
                            // For special schemas (Excel, PDF, GA, GAM, Google Ads, MongoDB, Meta Ads), always use table_name regardless of aliases
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
                            console.error(`[DataSourceProcessor] INSERT failed for row ${index}:`, insertError?.message || insertError);
                            console.error(`[DataSourceProcessor] Failed query:`, insertQuery.substring(0, 500));
                        }
                    }
                }
                const successfulInserts = rowsFromDataSource.length - failedInserts;
                console.log(`[DataSourceProcessor] Inserted ${successfulInserts}/${rowsFromDataSource.length} rows into ${dataModelName} (${failedInserts} failed)`);
                const dataModel = new DRADataModel();
                dataModel.schema = 'public';
                dataModel.name = dataModelName;
                dataModel.sql_query = selectTableQuery;
                dataModel.query = JSON.parse(queryJSON);

                // Set data_source for single-source, null for cross-source
                if (isCrossSource) {
                    dataModel.data_source = null;
                    dataModel.is_cross_source = true;
                } else {
                    dataModel.data_source = dataSource;
                    dataModel.is_cross_source = false;
                }

                dataModel.users_platform = user;
                const savedDataModel = await manager.save(dataModel);

                // For cross-source models, populate the DRADataModelSource junction table
                if (isCrossSource && projectId) {
                    // Extract unique data source IDs from the query JSON
                    const parsedQuery = JSON.parse(queryJSON);
                    const dataSourceIds = new Set<number>();

                    if (parsedQuery.columns) {
                        parsedQuery.columns.forEach((col: any) => {
                            if (col.data_source_id) {
                                dataSourceIds.add(col.data_source_id);
                            }
                        });
                    }

                    // Create junction table entries for each data source
                    for (const dsId of dataSourceIds) {
                        const junction = new DRADataModelSource();
                        junction.data_model_id = savedDataModel.id;
                        junction.data_source_id = dsId;
                        junction.users_platform_id = user.id;
                        await manager.save(junction);
                    }

                    console.log(`[DataSourceProcessor] Created ${dataSourceIds.size} data model source links`);
                }

                return resolve(savedDataModel.id);
            } catch (error) {
                console.error('[DataSourceProcessor] Error building data model:', error);
                return reject(error);
            }
        });
    }

}
