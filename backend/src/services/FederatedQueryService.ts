import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';
import { UtilityService } from './UtilityService.js';
import { DataSource } from 'typeorm';

/**
 * Interface for query table reference
 */
export interface IQueryTable {
    schema: string;
    tableName: string;
    alias?: string;
    dataSourceId: number;
    dataSourceType: EDataSourceType;
}

/**
 * Interface for column reference in query
 */
export interface IQueryColumn {
    schema: string;
    tableName: string;
    columnName: string;
    aliasName?: string;
    dataSourceId: number;
    transform?: string; // SQL transform function
}

/**
 * Interface for join condition
 */
export interface IJoinCondition {
    leftTable: string;
    leftColumn: string;
    rightTable: string;
    rightColumn: string;
    joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    operator: string; // '=', '>', '<', etc.
}

/**
 * Interface for WHERE clause condition
 */
export interface IWhereCondition {
    column: string;
    operator: string;
    value: any;
    logicalOperator?: 'AND' | 'OR';
}

/**
 * Interface for parsed query components
 */
export interface IParsedQuery {
    tables: IQueryTable[];
    columns: IQueryColumn[];
    joins: IJoinCondition[];
    where: IWhereCondition[];
    groupBy?: string[];
    orderBy?: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
    limit?: number;
    offset?: number;
}

/**
 * Interface for subquery targeting a specific data source
 */
export interface ISubQuery {
    dataSourceId: number;
    dataSourceType: EDataSourceType;
    tables: IQueryTable[];
    columns: IQueryColumn[];
    joins: IJoinCondition[]; // Only joins within this data source
    where: IWhereCondition[]; // Only WHERE conditions for this source
    sql: string; // Generated SQL for this subquery
}

/**
 * Interface for subquery execution result
 */
export interface ISubQueryResult {
    dataSourceId: number;
    tempTableName: string; // Name of temporary table in PostgreSQL
    rowCount: number;
    columns: string[];
    executionTimeMs: number;
}

/**
 * Interface for final federated query result
 */
export interface IFederatedQueryResult {
    success: boolean;
    rowCount: number;
    executionTimeMs: number;
    subQueries: ISubQueryResult[];
    error?: string;
}

/**
 * FederatedQueryService - Executes cross-source queries
 * 
 * Responsibilities:
 * - Parse cross-source queries into components
 * - Partition queries by data source
 * - Execute subqueries in parallel
 * - Stage results in temporary PostgreSQL tables
 * - Execute final join in PostgreSQL
 * - Clean up temporary tables
 * 
 * Architecture:
 * 1. Parse original query -> identify which tables belong to which sources
 * 2. Partition -> create per-source subqueries
 * 3. Execute in parallel -> query each source independently
 * 4. Stage results -> load into PostgreSQL temp tables
 * 5. Join -> execute final join across temp tables
 * 6. Cleanup -> drop temp tables
 */
export class FederatedQueryService {
    private static instance: FederatedQueryService;

    private constructor() {}

    public static getInstance(): FederatedQueryService {
        if (!FederatedQueryService.instance) {
            FederatedQueryService.instance = new FederatedQueryService();
        }
        return FederatedQueryService.instance;
    }

    /**
     * Parse query JSON into structured components
     */
    public parseQuery(queryJSON: any): IParsedQuery {
        const tables: IQueryTable[] = [];
        const columns: IQueryColumn[] = [];
        const joins: IJoinCondition[] = [];
        const where: IWhereCondition[] = [];

        // Extract tables from columns
        const tableMap = new Map<string, IQueryTable>();

        if (queryJSON.columns && Array.isArray(queryJSON.columns)) {
            for (const col of queryJSON.columns) {
                // Track unique tables
                const tableKey = `${col.schema}.${col.table_name}`;
                if (!tableMap.has(tableKey)) {
                    tableMap.set(tableKey, {
                        schema: col.schema,
                        tableName: col.table_name,
                        alias: col.table_alias,
                        dataSourceId: col.data_source_id,
                        dataSourceType: col.data_source_type
                    });
                }

                // Add column
                columns.push({
                    schema: col.schema,
                    tableName: col.table_name,
                    columnName: col.column_name,
                    aliasName: col.alias_name || '',
                    dataSourceId: col.data_source_id,
                    transform: col.transform || ''
                });
            }
        }

        tables.push(...tableMap.values());

        // Extract joins
        if (queryJSON.join_conditions && Array.isArray(queryJSON.join_conditions)) {
            for (const join of queryJSON.join_conditions) {
                joins.push({
                    leftTable: `${join.left_table_schema}.${join.left_table_name}`,
                    leftColumn: join.left_column_name,
                    rightTable: `${join.right_table_schema}.${join.right_table_name}`,
                    rightColumn: join.right_column_name,
                    joinType: join.join_type || 'INNER',
                    operator: join.operator || '='
                });
            }
        }

        // Extract WHERE conditions
        if (queryJSON.query_options?.where && Array.isArray(queryJSON.query_options.where)) {
            for (const condition of queryJSON.query_options.where) {
                where.push({
                    column: condition.column,
                    operator: condition.equality,
                    value: condition.value,
                    logicalOperator: condition.condition || 'AND'
                });
            }
        }

        return {
            tables,
            columns,
            joins,
            where,
            groupBy: queryJSON.query_options?.group_by?.name ? [queryJSON.query_options.group_by.name] : undefined,
            orderBy: queryJSON.query_options?.order_by?.map((ob: any) => ({
                column: ob.column,
                direction: ob.order
            })),
            limit: queryJSON.query_options?.limit !== -1 ? queryJSON.query_options.limit : undefined,
            offset: queryJSON.query_options?.offset !== -1 ? queryJSON.query_options.offset : undefined
        };
    }

    /**
     * Partition parsed query into per-source subqueries
     */
    public partitionQuery(parsedQuery: IParsedQuery): ISubQuery[] {
        const subQueries: ISubQuery[] = [];
        const sourceGroups = new Map<number, IQueryTable[]>();

        // Group tables by data source
        for (const table of parsedQuery.tables) {
            if (!sourceGroups.has(table.dataSourceId)) {
                sourceGroups.set(table.dataSourceId, []);
            }
            sourceGroups.get(table.dataSourceId)!.push(table);
        }

        // Create subquery for each data source
        for (const [dataSourceId, tables] of sourceGroups.entries()) {
            const sourceColumns = parsedQuery.columns.filter(col => col.dataSourceId === dataSourceId);
            const sourceJoins = parsedQuery.joins.filter(join => {
                // Only include joins where both tables are from same source
                const leftTable = parsedQuery.tables.find(t => `${t.schema}.${t.tableName}` === join.leftTable);
                const rightTable = parsedQuery.tables.find(t => `${t.schema}.${t.tableName}` === join.rightTable);
                return leftTable?.dataSourceId === dataSourceId && rightTable?.dataSourceId === dataSourceId;
            });

            // WHERE conditions that apply to this source's columns
            const sourceWhere = parsedQuery.where.filter(w => {
                const columnParts = w.column.split('.');
                if (columnParts.length >= 2) {
                    const schema = columnParts[0];
                    const tableName = columnParts[1];
                    return tables.some(t => t.schema === schema && t.tableName === tableName);
                }
                return false;
            });

            subQueries.push({
                dataSourceId,
                dataSourceType: tables[0].dataSourceType,
                tables,
                columns: sourceColumns,
                joins: sourceJoins,
                where: sourceWhere,
                sql: '' // Will be generated in buildSubQuerySQL
            });
        }

        return subQueries;
    }

    /**
     * Build SQL for a subquery (source-specific)
     */
    private buildSubQuerySQL(subQuery: ISubQuery): string {
        let sql = 'SELECT ';

        // Columns
        const columnParts = subQuery.columns.map(col => {
            const fullCol = `"${col.schema}"."${col.tableName}"."${col.columnName}"`;
            const alias = col.aliasName || `${col.schema}_${col.tableName}_${col.columnName}`;
            return `${fullCol} AS "${alias}"`;
        });

        sql += columnParts.join(', ');

        // FROM clause
        const mainTable = subQuery.tables[0];
        sql += ` FROM "${mainTable.schema}"."${mainTable.tableName}"`;
        if (mainTable.alias) {
            sql += ` AS "${mainTable.alias}"`;
        }

        // JOINs
        for (const join of subQuery.joins) {
            sql += ` ${join.joinType} JOIN ${join.rightTable}`;
            sql += ` ON ${join.leftTable}.${join.leftColumn} ${join.operator} ${join.rightTable}.${join.rightColumn}`;
        }

        // WHERE
        if (subQuery.where.length > 0) {
            sql += ' WHERE ';
            const whereParts = subQuery.where.map((w, idx) => {
                const prefix = idx > 0 ? ` ${w.logicalOperator || 'AND'} ` : '';
                const value = typeof w.value === 'string' ? `'${w.value}'` : w.value;
                return `${prefix}${w.column} ${w.operator} ${value}`;
            });
            sql += whereParts.join('');
        }

        return sql;
    }

    /**
     * Execute a subquery on its target data source
     */
    private async executeSubQuery(
        subQuery: ISubQuery,
        connectionDetails: IDBConnectionDetails
    ): Promise<any[]> {
        const startTime = Date.now();

        try {
            const driver = await DBDriver.getInstance().getDriver(subQuery.dataSourceType);
            if (!driver) {
                throw new Error(`Driver not available for ${subQuery.dataSourceType}`);
            }

            const dbConnector = await driver.connectExternalDB(connectionDetails);
            const sql = this.buildSubQuerySQL(subQuery);

            console.log(`[FederatedQuery] Executing subquery on source ${subQuery.dataSourceId}:`, sql);

            const results = await dbConnector.query(sql);
            const executionTime = Date.now() - startTime;

            console.log(`[FederatedQuery] Subquery completed in ${executionTime}ms, rows: ${results.length}`);

            return results;
        } catch (error) {
            console.error(`[FederatedQuery] Error executing subquery on source ${subQuery.dataSourceId}:`, error);
            throw error;
        }
    }

    /**
     * Stage subquery results in PostgreSQL temporary table
     */
    private async stageResultsInPostgres(
        results: any[],
        columns: IQueryColumn[],
        tempTableName: string,
        pgConnector: DataSource
    ): Promise<void> {
        if (results.length === 0) {
            console.log(`[FederatedQuery] No results to stage for ${tempTableName}`);
            return;
        }

        // Create temp table
        let createSQL = `CREATE TEMP TABLE ${tempTableName} (`;
        const colDefs = columns.map(col => {
            const colName = col.aliasName || `${col.schema}_${col.tableName}_${col.columnName}`;
            return `"${colName}" TEXT`; // Use TEXT for flexibility
        });
        createSQL += colDefs.join(', ') + ')';

        await pgConnector.query(createSQL);

        // Insert data
        for (const row of results) {
            const values = columns.map(col => {
                const colName = col.aliasName || `${col.schema}_${col.tableName}_${col.columnName}`;
                const value = row[colName];
                return value !== null && value !== undefined ? `'${String(value).replace(/'/g, "''")}'` : 'NULL';
            });

            const insertSQL = `INSERT INTO ${tempTableName} VALUES (${values.join(', ')})`;
            await pgConnector.query(insertSQL);
        }

        console.log(`[FederatedQuery] Staged ${results.length} rows in ${tempTableName}`);
    }

    /**
     * Execute cross-source federated query (main entry point)
     * This is a skeleton - full implementation to be completed in next commits
     */
    public async executeFederatedQuery(
        queryJSON: any,
        dataSourceConnections: Map<number, IDBConnectionDetails>
    ): Promise<IFederatedQueryResult> {
        const startTime = Date.now();

        try {
            // 1. Parse query
            const parsedQuery = this.parseQuery(queryJSON);
            console.log(`[FederatedQuery] Parsed query with ${parsedQuery.tables.length} tables from ${dataSourceConnections.size} sources`);

            // 2. Partition query
            const subQueries = this.partitionQuery(parsedQuery);
            console.log(`[FederatedQuery] Created ${subQueries.length} subqueries`);

            // 3. Execute subqueries in parallel (placeholder - to be implemented)
            // TODO: Actual parallel execution in next iteration

            // 4. Stage results and JOIN (placeholder - to be implemented)
            // TODO: Implement staging and final join

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                rowCount: 0,
                executionTimeMs: executionTime,
                subQueries: []
            };
        } catch (error) {
            console.error('[FederatedQuery] Error executing federated query:', error);
            return {
                success: false,
                rowCount: 0,
                executionTimeMs: Date.now() - startTime,
                subQueries: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
