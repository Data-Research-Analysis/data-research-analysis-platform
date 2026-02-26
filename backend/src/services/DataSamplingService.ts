import { DataSource } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { SchemaCollectorService } from './SchemaCollectorService.js';
import { SchemaFormatterUtility } from '../utilities/SchemaFormatter.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { ITokenDetails } from '../types/ITokenDetails.js';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';

interface ColumnStatistics {
    column_name: string;
    data_type: string;
    row_count: number;
    distinct_count: number;
    null_count: number;
    null_percentage: number;
    min_value?: string | number | null;
    max_value?: string | number | null;
    avg_value?: number | null;
    stddev_value?: number | null;
    min_length?: number | null;
    max_length?: number | null;
    avg_length?: number | null;
    top_values?: Array<{ value: string; count: number }>;
    date_range_days?: number | null;
}

interface TableSample {
    schema: string;
    table_name: string;
    row_count: number;
    sample_rows: any[];
    column_statistics: ColumnStatistics[];
}

interface DataSourceContext {
    data_source_id: number;
    data_source_name: string;
    data_source_type: EDataSourceType;
    schemas: Array<{
        schema_name: string;
        tables: TableSample[];
    }>;
    total_tables: number;
    total_rows_estimated: number;
    connection_status: 'success' | 'failed';
    error_message?: string;
}

interface InsightContext {
    project_id: number;
    data_sources: DataSourceContext[];
    total_sources: number;
    total_tables: number;
    total_rows_estimated: number;
    context_size_bytes: number;
    sampling_info: {
        max_rows_per_table: number;
        total_rows_sampled: number;
        tables_sampled: number;
    };
}

export class DataSamplingService {
    private static instance: DataSamplingService;
    
    // Sampling limits
    private readonly MAX_TABLES_PER_SOURCE = 50;
    private readonly MAX_ROWS_PER_TABLE = 100;
    private readonly MAX_CONTEXT_SIZE_BYTES = 500 * 1024; // 500KB
    private readonly SAMPLING_TIMEOUT_MS = 30 * 1000; // 30 seconds
    private readonly TOP_VALUES_LIMIT = 10;

    private constructor() {}

    public static getInstance(): DataSamplingService {
        if (!DataSamplingService.instance) {
            DataSamplingService.instance = new DataSamplingService();
        }
        return DataSamplingService.instance;
    }

    /**
     * Sample a table and return limited rows
     * @param driver - Database driver instance
     * @param schemaName - Schema name
     * @param tableName - Table name
     * @param maxRows - Maximum rows to sample
     * @param dataSourceType - Type of data source
     * @returns Sample rows array
     */
    public async sampleTable(
        driver: any,
        schemaName: string,
        tableName: string,
        maxRows: number,
        dataSourceType: EDataSourceType
    ): Promise<any[]> {
        try {
            const concreteDriver = await driver.getConcreteDriver();
            let query = '';

            if (dataSourceType === EDataSourceType.POSTGRESQL) {
                // Use TABLESAMPLE for efficiency on large tables (PostgreSQL 9.5+)
                query = `
                    SELECT * FROM "${schemaName}"."${tableName}"
                    TABLESAMPLE SYSTEM (10) -- Sample ~10% of pages
                    LIMIT $1
                `;
                const result = await concreteDriver.query(query, [maxRows]);
                return result || [];
            } else if (dataSourceType === EDataSourceType.MYSQL || dataSourceType === EDataSourceType.MARIADB) {
                // MySQL/MariaDB don't have TABLESAMPLE, use ORDER BY RAND() with LIMIT
                query = `
                    SELECT * FROM \`${schemaName}\`.\`${tableName}\`
                    ORDER BY RAND()
                    LIMIT ?
                `;
                const result = await concreteDriver.query(query, [maxRows]);
                return result || [];
            } else if (dataSourceType === EDataSourceType.MONGODB) {
                // MongoDB collections synced to PostgreSQL
                query = `
                    SELECT * FROM "dra_mongodb_sync"."${tableName}"
                    ORDER BY RANDOM()
                    LIMIT $1
                `;
                const result = await concreteDriver.query(query, [maxRows]);
                return result || [];
            } else if (dataSourceType === EDataSourceType.EXCEL || 
                       dataSourceType === EDataSourceType.PDF ||
                       dataSourceType === EDataSourceType.CSV) {
                // Excel/PDF/CSV data stored in PostgreSQL via import
                query = `
                    SELECT * FROM "${schemaName}"."${tableName}"
                    ORDER BY RANDOM()
                    LIMIT $1
                `;
                const result = await concreteDriver.query(query, [maxRows]);
                return result || [];
            } else if (dataSourceType === EDataSourceType.GOOGLE_ANALYTICS ||
                       dataSourceType === EDataSourceType.GOOGLE_ADS ||
                       dataSourceType === EDataSourceType.GOOGLE_AD_MANAGER ||
                       dataSourceType === EDataSourceType.META_ADS ||
                       dataSourceType === EDataSourceType.LINKEDIN_ADS ||
                       dataSourceType === EDataSourceType.HUBSPOT ||
                       dataSourceType === EDataSourceType.KLAVIYO) {
                // API-integrated data stored in internal PostgreSQL
                query = `
                    SELECT * FROM "${schemaName}"."${tableName}"
                    ORDER BY RANDOM()
                    LIMIT $1
                `;
                const result = await concreteDriver.query(query, [maxRows]);
                return result || [];
            }

            return [];
        } catch (error: any) {
            console.error(`Error sampling table ${schemaName}.${tableName}:`, error.message);
            return [];
        }
    }

    /**
     * Compute statistics for a specific column
     * @param driver - Database driver instance
     * @param schemaName - Schema name
     * @param tableName - Table name
     * @param columnName - Column name
     * @param dataType - Column data type
     * @param dataSourceType - Type of data source
     * @returns Column statistics
     */
    public async computeColumnStatistics(
        driver: any,
        schemaName: string,
        tableName: string,
        columnName: string,
        dataType: string,
        dataSourceType: EDataSourceType
    ): Promise<ColumnStatistics> {
        const concreteDriver = await driver.getConcreteDriver();
        const isPostgres = dataSourceType === EDataSourceType.POSTGRESQL || 
                          dataSourceType === EDataSourceType.MONGODB ||
                          dataSourceType === EDataSourceType.EXCEL ||
                          dataSourceType === EDataSourceType.PDF ||
                          dataSourceType === EDataSourceType.CSV ||
                          dataSourceType === EDataSourceType.GOOGLE_ANALYTICS ||
                          dataSourceType === EDataSourceType.GOOGLE_ADS ||
                          dataSourceType === EDataSourceType.GOOGLE_AD_MANAGER ||
                          dataSourceType === EDataSourceType.META_ADS ||
                          dataSourceType === EDataSourceType.LINKEDIN_ADS ||
                          dataSourceType === EDataSourceType.HUBSPOT ||
                          dataSourceType === EDataSourceType.KLAVIYO;
        
        const isMySQL = dataSourceType === EDataSourceType.MYSQL || dataSourceType === EDataSourceType.MARIADB;

        const normalizedType = dataType.toLowerCase();
        const isNumeric = normalizedType.includes('int') || 
                         normalizedType.includes('numeric') || 
                         normalizedType.includes('decimal') || 
                         normalizedType.includes('float') || 
                         normalizedType.includes('double') ||
                         normalizedType.includes('real');
        
        const isString = normalizedType.includes('char') || 
                        normalizedType.includes('text') || 
                        normalizedType.includes('varchar');
        
        const isDate = normalizedType.includes('date') || 
                      normalizedType.includes('time') || 
                      normalizedType.includes('timestamp');
        
        const isBoolean = normalizedType.includes('bool');

        try {
            if (isPostgres) {
                return await this.computePostgresColumnStats(
                    concreteDriver,
                    schemaName,
                    tableName,
                    columnName,
                    dataType,
                    isNumeric,
                    isString,
                    isDate,
                    isBoolean
                );
            } else if (isMySQL) {
                return await this.computeMySQLColumnStats(
                    concreteDriver,
                    schemaName,
                    tableName,
                    columnName,
                    dataType,
                    isNumeric,
                    isString,
                    isDate,
                    isBoolean
                );
            }

            // Fallback basic stats
            return {
                column_name: columnName,
                data_type: dataType,
                row_count: 0,
                distinct_count: 0,
                null_count: 0,
                null_percentage: 0
            };
        } catch (error: any) {
            console.error(`Error computing stats for ${tableName}.${columnName}:`, error.message);
            return {
                column_name: columnName,
                data_type: dataType,
                row_count: 0,
                distinct_count: 0,
                null_count: 0,
                null_percentage: 0
            };
        }
    }

    /**
     * Compute column statistics for PostgreSQL
     */
    private async computePostgresColumnStats(
        driver: any,
        schemaName: string,
        tableName: string,
        columnName: string,
        dataType: string,
        isNumeric: boolean,
        isString: boolean,
        isDate: boolean,
        isBoolean: boolean
    ): Promise<ColumnStatistics> {
        const baseStats: ColumnStatistics = {
            column_name: columnName,
            data_type: dataType,
            row_count: 0,
            distinct_count: 0,
            null_count: 0,
            null_percentage: 0
        };

        // Build query based on data type
        let query = '';
        
        if (isNumeric) {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT "${columnName}") as distinct_count,
                    COUNT(*) - COUNT("${columnName}") as null_count,
                    MIN("${columnName}") as min_value,
                    MAX("${columnName}") as max_value,
                    AVG("${columnName}"::numeric) as avg_value,
                    STDDEV("${columnName}"::numeric) as stddev_value
                FROM "${schemaName}"."${tableName}"
            `;
        } else if (isString) {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT "${columnName}") as distinct_count,
                    COUNT(*) - COUNT("${columnName}") as null_count,
                    MIN(LENGTH("${columnName}")) as min_length,
                    MAX(LENGTH("${columnName}")) as max_length,
                    AVG(LENGTH("${columnName}")) as avg_length
                FROM "${schemaName}"."${tableName}"
            `;
        } else if (isDate) {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT "${columnName}") as distinct_count,
                    COUNT(*) - COUNT("${columnName}") as null_count,
                    MIN("${columnName}") as min_value,
                    MAX("${columnName}") as max_value,
                    EXTRACT(DAY FROM (MAX("${columnName}") - MIN("${columnName}")))::integer as date_range_days
                FROM "${schemaName}"."${tableName}"
            `;
        } else if (isBoolean) {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT "${columnName}") as distinct_count,
                    COUNT(*) - COUNT("${columnName}") as null_count
                FROM "${schemaName}"."${tableName}"
            `;
        } else {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT "${columnName}") as distinct_count,
                    COUNT(*) - COUNT("${columnName}") as null_count
                FROM "${schemaName}"."${tableName}"
            `;
        }

        const result = await driver.query(query);
        if (result && result[0]) {
            const stats = result[0];
            baseStats.row_count = parseInt(stats.row_count || '0');
            baseStats.distinct_count = parseInt(stats.distinct_count || '0');
            baseStats.null_count = parseInt(stats.null_count || '0');
            baseStats.null_percentage = baseStats.row_count > 0 
                ? (baseStats.null_count / baseStats.row_count) * 100 
                : 0;

            if (isNumeric) {
                baseStats.min_value = stats.min_value;
                baseStats.max_value = stats.max_value;
                baseStats.avg_value = parseFloat(stats.avg_value || '0');
                baseStats.stddev_value = parseFloat(stats.stddev_value || '0');
            } else if (isString) {
                baseStats.min_length = parseInt(stats.min_length || '0');
                baseStats.max_length = parseInt(stats.max_length || '0');
                baseStats.avg_length = parseFloat(stats.avg_length || '0');

                // Get top values for string columns
                const topValuesQuery = `
                    SELECT "${columnName}" as value, COUNT(*) as count
                    FROM "${schemaName}"."${tableName}"
                    WHERE "${columnName}" IS NOT NULL
                    GROUP BY "${columnName}"
                    ORDER BY count DESC
                    LIMIT ${this.TOP_VALUES_LIMIT}
                `;
                const topValuesResult = await driver.query(topValuesQuery);
                baseStats.top_values = topValuesResult.map((row: any) => ({
                    value: String(row.value),
                    count: parseInt(row.count)
                }));
            } else if (isDate) {
                baseStats.min_value = stats.min_value;
                baseStats.max_value = stats.max_value;
                baseStats.date_range_days = parseInt(stats.date_range_days || '0');
            }
        }

        return baseStats;
    }

    /**
     * Compute column statistics for MySQL/MariaDB
     */
    private async computeMySQLColumnStats(
        driver: any,
        schemaName: string,
        tableName: string,
        columnName: string,
        dataType: string,
        isNumeric: boolean,
        isString: boolean,
        isDate: boolean,
        isBoolean: boolean
    ): Promise<ColumnStatistics> {
        const baseStats: ColumnStatistics = {
            column_name: columnName,
            data_type: dataType,
            row_count: 0,
            distinct_count: 0,
            null_count: 0,
            null_percentage: 0
        };

        let query = '';
        
        if (isNumeric) {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT \`${columnName}\`) as distinct_count,
                    COUNT(*) - COUNT(\`${columnName}\`) as null_count,
                    MIN(\`${columnName}\`) as min_value,
                    MAX(\`${columnName}\`) as max_value,
                    AVG(\`${columnName}\`) as avg_value,
                    STDDEV(\`${columnName}\`) as stddev_value
                FROM \`${schemaName}\`.\`${tableName}\`
            `;
        } else if (isString) {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT \`${columnName}\`) as distinct_count,
                    COUNT(*) - COUNT(\`${columnName}\`) as null_count,
                    MIN(LENGTH(\`${columnName}\`)) as min_length,
                    MAX(LENGTH(\`${columnName}\`)) as max_length,
                    AVG(LENGTH(\`${columnName}\`)) as avg_length
                FROM \`${schemaName}\`.\`${tableName}\`
            `;
        } else if (isDate) {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT \`${columnName}\`) as distinct_count,
                    COUNT(*) - COUNT(\`${columnName}\`) as null_count,
                    MIN(\`${columnName}\`) as min_value,
                    MAX(\`${columnName}\`) as max_value,
                    DATEDIFF(MAX(\`${columnName}\`), MIN(\`${columnName}\`)) as date_range_days
                FROM \`${schemaName}\`.\`${tableName}\`
            `;
        } else {
            query = `
                SELECT
                    COUNT(*) as row_count,
                    COUNT(DISTINCT \`${columnName}\`) as distinct_count,
                    COUNT(*) - COUNT(\`${columnName}\`) as null_count
                FROM \`${schemaName}\`.\`${tableName}\`
            `;
        }

        const result = await driver.query(query);
        if (result && result[0]) {
            const stats = result[0];
            baseStats.row_count = parseInt(stats.row_count || 0);
            baseStats.distinct_count = parseInt(stats.distinct_count || 0);
            baseStats.null_count = parseInt(stats.null_count || 0);
            baseStats.null_percentage = baseStats.row_count > 0 
                ? (baseStats.null_count / baseStats.row_count) * 100 
                : 0;

            if (isNumeric) {
                baseStats.min_value = stats.min_value;
                baseStats.max_value = stats.max_value;
                baseStats.avg_value = parseFloat(stats.avg_value || 0);
                baseStats.stddev_value = parseFloat(stats.stddev_value || 0);
            } else if (isString) {
                baseStats.min_length = parseInt(stats.min_length || 0);
                baseStats.max_length = parseInt(stats.max_length || 0);
                baseStats.avg_length = parseFloat(stats.avg_length || 0);

                // Get top values
                const topValuesQuery = `
                    SELECT \`${columnName}\` as value, COUNT(*) as count
                    FROM \`${schemaName}\`.\`${tableName}\`
                    WHERE \`${columnName}\` IS NOT NULL
                    GROUP BY \`${columnName}\`
                    ORDER BY count DESC
                    LIMIT ${this.TOP_VALUES_LIMIT}
                `;
                const topValuesResult = await driver.query(topValuesQuery);
                baseStats.top_values = topValuesResult.map((row: any) => ({
                    value: String(row.value),
                    count: parseInt(row.count)
                }));
            } else if (isDate) {
                baseStats.min_value = stats.min_value;
                baseStats.max_value = stats.max_value;
                baseStats.date_range_days = parseInt(stats.date_range_days || 0);
            }
        }

        return baseStats;
    }

    /**
     * Sample a data source (all tables with limits)
     * @param dataSourceId - Data source ID
     * @param tokenDetails - User token details
     * @param maxRowsPerTable - Max rows to sample per table
     * @returns Data source context with samples
     */
    public async sampleDataSource(
        dataSourceId: number,
        tokenDetails: ITokenDetails,
        maxRowsPerTable: number = this.MAX_ROWS_PER_TABLE
    ): Promise<DataSourceContext> {
        const context: DataSourceContext = {
            data_source_id: dataSourceId,
            data_source_name: '',
            data_source_type: EDataSourceType.POSTGRESQL,
            schemas: [],
            total_tables: 0,
            total_rows_estimated: 0,
            connection_status: 'failed'
        };

        try {
            // Get data source from database
            const dbDriver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await dbDriver.getConcreteDriver()).manager;
            const dataSource = await manager.findOne(DRADataSource, {
                where: { id: dataSourceId }
            });

            if (!dataSource) {
                context.error_message = 'Data source not found';
                return context;
            }

            context.data_source_name = dataSource.name;
            context.data_source_type = dataSource.data_type;

            // API-integrated sources store their data in internal PostgreSQL under dedicated schemas
            const apiIntegratedSchemas: Record<string, string> = {
                'google_analytics': 'dra_google_analytics',
                'google_ad_manager': 'dra_google_ad_manager',
                'google_ads': 'dra_google_ads',
                'meta_ads': 'dra_meta_ads',
                'linkedin_ads': 'dra_linkedin_ads',
                'hubspot': 'dra_hubspot',
                'klaviyo': 'dra_klaviyo',
                'excel': 'dra_excel',
                'pdf': 'dra_pdf',
                'mongodb': 'dra_mongodb'
            };
            const isApiIntegrated = apiIntegratedSchemas[dataSource.data_type] !== undefined;

            // Connect to external data source (use internal PG driver for API-integrated sources)
            const driver = await DBDriver.getInstance().getDriver(
                isApiIntegrated ? EDataSourceType.POSTGRESQL : dataSource.data_type
            );
            const connectionDetails = dataSource.connection_details as IDBConnectionDetails;
            
            // For MongoDB, use connection_string if available
            if (dataSource.data_type === EDataSourceType.MONGODB && dataSource.connection_string) {
                connectionDetails.connection_string = dataSource.connection_string;
            }

            // Driver is already initialized, no need to connect
            // await driver.connect(connectionDetails);

            // Collect schema
            const schemaCollector = new SchemaCollectorService();
            const schemaName = isApiIntegrated
                ? apiIntegratedSchemas[dataSource.data_type]
                : (connectionDetails.schema || connectionDetails.database || 'public');
            const tableSchemas = await schemaCollector.collectSchema(
                await driver.getConcreteDriver() as DataSource,
                schemaName
            );

            // Limit tables
            const limitedTables = tableSchemas.slice(0, this.MAX_TABLES_PER_SOURCE);
            context.total_tables = limitedTables.length;

            // Sample each table
            const tableSamples: TableSample[] = [];
            
            for (const tableSchema of limitedTables) {
                try {
                    // Sample rows
                    const sampleRows = await this.sampleTable(
                        driver,
                        tableSchema.schema,
                        tableSchema.tableName,
                        maxRowsPerTable,
                        dataSource.data_type
                    );

                    // Compute column statistics
                    const columnStats: ColumnStatistics[] = [];
                    for (const column of tableSchema.columns) {
                        const stats = await this.computeColumnStatistics(
                            driver,
                            tableSchema.schema,
                            tableSchema.tableName,
                            column.column_name,
                            column.data_type,
                            dataSource.data_type
                        );
                        columnStats.push(stats);
                    }

                    // Estimate row count from first column stats
                    const rowCount = columnStats.length > 0 ? columnStats[0].row_count : 0;
                    context.total_rows_estimated += rowCount;

                    tableSamples.push({
                        schema: tableSchema.schema,
                        table_name: tableSchema.tableName,
                        row_count: rowCount,
                        sample_rows: sampleRows,
                        column_statistics: columnStats
                    });
                } catch (error: any) {
                    console.error(`Error sampling table ${tableSchema.tableName}:`, error.message);
                    // Continue with other tables
                }
            }

            context.schemas = [{
                schema_name: schemaName,
                tables: tableSamples
            }];

            context.connection_status = 'success';

            // Driver handles its own connection lifecycle, no need to disconnect
            // await driver.disconnect();

        } catch (error: any) {
            console.error(`Error sampling data source ${dataSourceId}:`, error.message);
            context.error_message = error.message;
            context.connection_status = 'failed';
        }

        return context;
    }

    /**
     * Build insight context from multiple data sources
     * @param projectId - Project ID
     * @param dataSourceIds - Array of data source IDs
     * @param tokenDetails - User token details
     * @param tableNameMapping - Optional mapping of physical table names to logical names (format: "schema.tablename" -> "Logical Name")
     * @returns Combined insight context with markdown-formatted prompt
     */
    public async buildInsightContext(
        projectId: number,
        dataSourceIds: number[],
        tokenDetails: ITokenDetails,
        tableNameMapping: Record<string, string> = {}
    ): Promise<{ context: InsightContext; markdown: string }> {
        const context: InsightContext = {
            project_id: projectId,
            data_sources: [],
            total_sources: dataSourceIds.length,
            total_tables: 0,
            total_rows_estimated: 0,
            context_size_bytes: 0,
            sampling_info: {
                max_rows_per_table: this.MAX_ROWS_PER_TABLE,
                total_rows_sampled: 0,
                tables_sampled: 0
            }
        };

        // Sample each data source with timeout protection
        for (const dataSourceId of dataSourceIds) {
            try {
                const samplingPromise = this.sampleDataSource(dataSourceId, tokenDetails);
                const timeoutPromise = new Promise<DataSourceContext>((_, reject) => {
                    setTimeout(() => reject(new Error('Sampling timeout')), this.SAMPLING_TIMEOUT_MS);
                });

                const dataSourceContext = await Promise.race([samplingPromise, timeoutPromise]);
                
                context.data_sources.push(dataSourceContext);
                context.total_tables += dataSourceContext.total_tables;
                context.total_rows_estimated += dataSourceContext.total_rows_estimated;
                
                // Track sampling info
                for (const schema of dataSourceContext.schemas) {
                    context.sampling_info.tables_sampled += schema.tables.length;
                    for (const table of schema.tables) {
                        context.sampling_info.total_rows_sampled += table.sample_rows.length;
                    }
                }
            } catch (error: any) {
                console.error(`Failed to sample data source ${dataSourceId}:`, error.message);
                // Add failed source to context
                context.data_sources.push({
                    data_source_id: dataSourceId,
                    data_source_name: `Data Source ${dataSourceId}`,
                    data_source_type: EDataSourceType.POSTGRESQL,
                    schemas: [],
                    total_tables: 0,
                    total_rows_estimated: 0,
                    connection_status: 'failed',
                    error_message: error.message
                });
            }
        }

        // Build markdown context
        const markdown = this.buildMarkdownContext(context, tableNameMapping);
        context.context_size_bytes = Buffer.byteLength(markdown, 'utf8');

        // Check size limit
        if (context.context_size_bytes > this.MAX_CONTEXT_SIZE_BYTES) {
            console.warn(`Context size (${context.context_size_bytes} bytes) exceeds limit (${this.MAX_CONTEXT_SIZE_BYTES} bytes)`);
            // Truncate to fit
            const truncatedMarkdown = markdown.substring(
                0,
                markdown.length * (this.MAX_CONTEXT_SIZE_BYTES / context.context_size_bytes)
            );
            return { context, markdown: truncatedMarkdown + '\n\n[Context truncated due to size limits]' };
        }

        return { context, markdown };
    }

    /**
     * Build markdown-formatted context for AI prompt
     * @param context - Insight context
     * @param tableNameMapping - Mapping of physical table names to logical names
     */
    private buildMarkdownContext(context: InsightContext, tableNameMapping: Record<string, string> = {}): string {
        let markdown = `# Project Analysis Context\n`;
        markdown += `## Analysis Scope: ${context.total_sources} data source(s), ${context.total_tables} table(s)\n\n`;
        markdown += `**Total Estimated Rows:** ${context.total_rows_estimated.toLocaleString()}\n`;
        markdown += `**Sampling:** Analyzed ${context.sampling_info.total_rows_sampled.toLocaleString()} rows from ${context.sampling_info.tables_sampled} tables (max ${context.sampling_info.max_rows_per_table} rows per table)\n\n`;
        markdown += `---\n\n`;

        for (let i = 0; i < context.data_sources.length; i++) {
            const ds = context.data_sources[i];
            markdown += `### Data Source ${i + 1}: ${ds.data_source_name}\n`;
            markdown += `**Type:** ${ds.data_source_type} | **Status:** ${ds.connection_status} | **Tables:** ${ds.total_tables} | **Estimated Rows:** ${ds.total_rows_estimated.toLocaleString()}\n\n`;

            if (ds.connection_status === 'failed') {
                markdown += `⚠️ **Connection Failed:** ${ds.error_message}\n\n`;
                markdown += `---\n\n`;
                continue;
            }

            for (const schema of ds.schemas) {
                markdown += `#### Schema: ${schema.schema_name}\n\n`;

                for (const table of schema.tables) {
                    // Use logical name if available, otherwise use physical name
                    const physicalKey = `${table.schema}.${table.table_name}`;
                    const displayName = tableNameMapping[physicalKey] || table.table_name;
                    const nameLabel = tableNameMapping[physicalKey] 
                        ? `${displayName} (${table.table_name})` 
                        : table.table_name;
                    
                    markdown += `##### Table: ${nameLabel} (${table.row_count.toLocaleString()} rows)\n\n`;

                    // Column statistics table
                    markdown += `| Column | Type | Nulls | Distinct | Min | Max | Avg | Notes |\n`;
                    markdown += `|--------|------|-------|----------|-----|-----|-----|-------|\n`;

                    for (const stat of table.column_statistics) {
                        const nullPct = stat.null_percentage.toFixed(1);
                        let notes = '';

                        if (stat.min_value !== undefined && stat.max_value !== undefined) {
                            notes = `Range: ${stat.min_value} - ${stat.max_value}`;
                            if (stat.avg_value !== undefined) {
                                notes += `, Avg: ${stat.avg_value.toFixed(2)}`;
                            }
                        } else if (stat.min_length !== undefined && stat.max_length !== undefined) {
                            notes = `Len: ${stat.min_length}-${stat.max_length}`;
                            if (stat.avg_length !== undefined) {
                                notes += ` (avg ${stat.avg_length.toFixed(1)})`;
                            }
                        } else if (stat.date_range_days !== undefined) {
                            notes = `Span: ${stat.date_range_days} days`;
                        }

                        markdown += `| ${stat.column_name} | ${stat.data_type} | ${nullPct}% | ${stat.distinct_count.toLocaleString()} | ${stat.min_value || '-'} | ${stat.max_value || '-'} | ${stat.avg_value?.toFixed(2) || '-'} | ${notes} |\n`;
                    }

                    markdown += `\n`;

                    // Sample data (limit to 5 rows for context size)
                    if (table.sample_rows.length > 0) {
                        const sampleLimit = Math.min(5, table.sample_rows.length);
                        markdown += `**Sample Data (${sampleLimit} of ${table.sample_rows.length} sampled rows):**\n\n`;

                        const columns = Object.keys(table.sample_rows[0]);
                        markdown += `| ${columns.join(' | ')} |\n`;
                        markdown += `| ${columns.map(() => '---').join(' | ')} |\n`;

                        for (let i = 0; i < sampleLimit; i++) {
                            const row = table.sample_rows[i];
                            const values = columns.map(col => {
                                const val = row[col];
                                if (val === null || val === undefined) return 'NULL';
                                if (typeof val === 'string' && val.length > 50) return val.substring(0, 47) + '...';
                                return String(val);
                            });
                            markdown += `| ${values.join(' | ')} |\n`;
                        }

                        markdown += `\n`;
                    }

                    // Top values for string columns
                    for (const stat of table.column_statistics) {
                        if (stat.top_values && stat.top_values.length > 0) {
                            markdown += `**Top values for "${stat.column_name}":**\n`;
                            for (const tv of stat.top_values.slice(0, 5)) {
                                markdown += `- "${tv.value}" (${tv.count} occurrences)\n`;
                            }
                            markdown += `\n`;
                        }
                    }

                    markdown += `\n`;
                }
            }

            markdown += `---\n\n`;
        }

        // Cross-source observations section
        if (context.total_sources > 1) {
            markdown += `### Cross-Source Analysis Hints\n\n`;
            markdown += `The AI should identify potential join keys, overlapping entities, and cross-system patterns between the ${context.total_sources} data sources.\n\n`;
        }

        return markdown;
    }
}
