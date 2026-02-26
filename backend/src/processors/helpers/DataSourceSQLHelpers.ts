/**
 * DataSourceSQLHelpers
 * Shared static SQL utility methods used across DataSourceProcessor,
 * DataModelProcessor, and domain-specific processors.
 */
export class DataSourceSQLHelpers {
    private constructor() { } // Non-instantiable

    /**
     * Escape SQL string values to prevent SQL injection
     */
    public static escapeSQL(value: any): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        return String(value).replace(/'/g, "''");
    }

    /**
     * Format a date value for SQL insertion based on column data type
     */
    public static formatDateForSQL(value: any, columnType: string, columnName: string): string {
        if (value === null || value === undefined) {
            return 'null';
        }

        try {
            let dateObj: Date;

            if (value instanceof Date) {
                dateObj = value;
            } else if (typeof value === 'string') {
                if (value.trim() === '' || value === '0000-00-00' || value === '0000-00-00 00:00:00') {
                    return 'null';
                }
                if (value.includes('GMT')) {
                    dateObj = new Date(value);
                    if (isNaN(dateObj.getTime())) {
                        const datePart = value.split(' GMT')[0];
                        dateObj = new Date(datePart);
                    }
                } else {
                    dateObj = new Date(value);
                }
            } else if (typeof value === 'number') {
                dateObj = new Date(value);
            } else {
                console.warn(`Unexpected date value type for column ${columnName}:`, typeof value, value);
                return 'null';
            }

            if (isNaN(dateObj.getTime())) {
                console.error(`Invalid date value for column ${columnName}:`, value);
                return 'null';
            }

            const upperType = columnType.toUpperCase();

            if (upperType === 'DATE') {
                const formatted = dateObj.toISOString().split('T')[0];
                return `'${formatted}'`;
            } else if (upperType === 'TIMESTAMP WITH TIME ZONE' || upperType === 'TIMESTAMPTZ' || upperType.includes('TIMESTAMPTZ')) {
                return `'${dateObj.toISOString()}'`;
            } else if (upperType === 'TIMESTAMP' || upperType.startsWith('TIMESTAMP(') || upperType.includes('TIMESTAMP WITHOUT') || upperType.includes('TIMESTAMP ')) {
                const formatted = dateObj.toISOString().replace('T', ' ').split('.')[0];
                return `'${formatted}'`;
            } else if (upperType === 'TIME' || upperType.startsWith('TIME(') || upperType.includes('TIME WITHOUT')) {
                const timeString = dateObj.toISOString().split('T')[1].split('.')[0];
                return `'${timeString}'`;
            }

            return `'${dateObj.toISOString()}'`;
        } catch (error) {
            console.error(`Failed to format date for column ${columnName}:`, error, 'Value:', value);
            return 'null';
        }
    }

    /**
     * Format a value for SQL insertion based on column data type
     */
    public static formatValueForSQL(value: any, columnType: string, columnName: string): string {
        if (value === null || value === undefined) {
            return 'null';
        }

        if (value instanceof Date) {
            const upperType = columnType.toUpperCase();
            const dateType = (upperType.includes('DATE') || upperType.includes('TIME') || upperType.includes('TIMESTAMP'))
                ? upperType : 'TIMESTAMP';
            return DataSourceSQLHelpers.formatDateForSQL(value, dateType, columnName);
        }

        const upperType = columnType.toUpperCase();

        if (upperType.includes('DATE') || upperType.includes('TIME') || upperType.includes('TIMESTAMP')) {
            return DataSourceSQLHelpers.formatDateForSQL(value, upperType, columnName);
        }

        if (upperType === 'JSON' || upperType === 'JSONB') {
            try {
                const valueStr = String(value);
                if (valueStr === '[object Object]' || valueStr.startsWith('[object ')) {
                    console.error(`Detected [object Object] for column ${columnName}. Value type: ${typeof value}`);
                    if (typeof value === 'object') {
                        const jsonString = JSON.stringify(value);
                        return `'${DataSourceSQLHelpers.escapeSQL(jsonString)}'`;
                    }
                    return 'null';
                }

                if (typeof value === 'object') {
                    const jsonString = JSON.stringify(value);
                    return `'${DataSourceSQLHelpers.escapeSQL(jsonString)}'`;
                } else if (typeof value === 'string') {
                    if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
                        try {
                            JSON.parse(value);
                            return `'${DataSourceSQLHelpers.escapeSQL(value)}'`;
                        } catch {
                            return `'${DataSourceSQLHelpers.escapeSQL(JSON.stringify(value))}'`;
                        }
                    } else {
                        return `'${DataSourceSQLHelpers.escapeSQL(JSON.stringify(value))}'`;
                    }
                } else {
                    return `'${JSON.stringify(value)}'`;
                }
            } catch (error) {
                console.error(`Failed to serialize JSON for column ${columnName}:`, error, 'Value:', value, 'Type:', typeof value);
                return 'null';
            }
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.includes('GMT') || trimmed.includes('UTC') || trimmed.includes('Coordinated Universal Time')) {
                const dateObj = new Date(trimmed);
                if (!isNaN(dateObj.getTime())) {
                    console.warn(`[formatValueForSQL] Auto-detected date string for column ${columnName} (declared ${columnType}): "${trimmed.substring(0, 60)}"`);
                    return DataSourceSQLHelpers.formatDateForSQL(trimmed, 'TIMESTAMP', columnName);
                }
            }
        }

        if (upperType.includes('NUMERIC') || upperType.includes('INTEGER') || upperType.includes('INT') ||
            upperType.includes('REAL') || upperType.includes('FLOAT') || upperType.includes('DOUBLE') ||
            upperType.includes('DECIMAL') || upperType.includes('BIGINT') || upperType.includes('SMALLINT')) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                return `${numValue}`;
            }
            return 'null';
        }

        if (upperType === 'BOOLEAN' || upperType === 'BOOL') {
            return DataSourceSQLHelpers.convertToPostgresBoolean(value);
        }

        return `'${DataSourceSQLHelpers.escapeSQL(value)}'`;
    }

    /**
     * Sanitize column names to be PostgreSQL-compliant
     */
    public static sanitizeColumnName(columnName: string): string {
        let sanitized = columnName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        if (!/^[a-zA-Z_]/.test(sanitized)) {
            sanitized = `col_${sanitized}`;
        }
        if (!sanitized) {
            sanitized = `col_${Date.now()}`;
        }

        const reservedKeywords = [
            'user', 'table', 'select', 'insert', 'update', 'delete', 'create', 'drop',
            'alter', 'index', 'view', 'grant', 'revoke', 'commit', 'rollback', 'transaction',
            'primary', 'foreign', 'key', 'constraint', 'check', 'unique', 'not', 'null',
            'default', 'auto_increment', 'timestamp', 'date', 'time', 'year', 'month',
            'order', 'group', 'having', 'where', 'limit', 'offset', 'union', 'join',
            'inner', 'outer', 'left', 'right', 'cross', 'natural', 'on', 'using',
        ];

        if (reservedKeywords.includes(sanitized.toLowerCase())) {
            sanitized = `${sanitized}_col`;
        }

        return sanitized;
    }

    /**
     * Sanitize table names to be PostgreSQL-compliant
     */
    public static sanitizeTableName(tableName: string): string {
        return tableName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
    }

    /**
     * Escape string values for PostgreSQL queries
     */
    public static escapeStringValue(value: string): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''")
            .replace(/\0/g, '\\0');
    }

    /**
     * Convert various boolean representations to PostgreSQL boolean format
     */
    public static convertToPostgresBoolean(value: any): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }

        const stringValue = String(value).trim().toLowerCase();

        if (['true', '1', 'yes', 'y', 'on', 'active', 'enabled'].includes(stringValue)) {
            return 'TRUE';
        }
        if (['false', '0', 'no', 'n', 'off', 'inactive', 'disabled'].includes(stringValue)) {
            return 'FALSE';
        }

        console.warn(`Unable to convert value "${value}" to boolean, using NULL`);
        return 'NULL';
    }

    /**
     * Validate that GROUP BY requirements are satisfied for a query JSON.
     */
    public static validateGroupByRequirements(queryJSON: string): { valid: boolean; error?: string } {
        try {
            const sourceTable = JSON.parse(queryJSON);
            const aggregateFunctions = sourceTable?.query_options?.group_by?.aggregate_functions || [];
            const aggregateExpressions = sourceTable?.query_options?.group_by?.aggregate_expressions || [];

            const hasAggregation = aggregateFunctions.length > 0 ||
                (aggregateExpressions.length > 0 && typeof aggregateExpressions[0] === 'object');

            if (!hasAggregation) {
                return { valid: true };
            }

            const groupByColumns = sourceTable?.query_options?.group_by?.group_by_columns || [];
            const columns = sourceTable?.columns || [];

            const aggregatedColumns = new Set(
                aggregateFunctions.map((agg: any) => agg.column)
            );

            const nonAggregatedColumns = columns.filter((col: any) => {
                const colRef = `${col.schema}.${col.table_name}.${col.column_name}`;
                return !aggregatedColumns.has(colRef) && col.is_selected_column;
            });

            const missingGroupBy = nonAggregatedColumns.filter((col: any) => {
                const colRef = `${col.schema}.${col.table_name}.${col.column_name}`;
                return !groupByColumns.includes(colRef);
            });

            if (missingGroupBy.length > 0) {
                const missingCols = missingGroupBy.map((col: any) =>
                    `${col.schema}.${col.table_name}.${col.column_name}`
                ).join(', ');
                return {
                    valid: false,
                    error: `SQL aggregate validation error: Non-aggregated columns must appear in GROUP BY clause (group_by_columns array). Missing columns: ${missingCols}. Use actual schema name from data source.`,
                };
            }

            return { valid: true };
        } catch (error: any) {
            console.error('[DataSourceSQLHelpers] Error validating GROUP BY requirements:', error);
            return { valid: false, error: `GROUP BY validation error: ${error.message}` };
        }
    }

    /**
     * Reconstruct SQL query from JSON query structure.
     *
     * CRITICAL FIX (2026-02-13): Now uses group_by_columns array from AI/frontend.
     */
    public static reconstructSQLFromJSON(queryJSON: any): string {
        const query = typeof queryJSON === 'string' ? JSON.parse(queryJSON) : queryJSON;

        let sqlParts: string[] = [];

        const aggregateFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
        const aggregateColumns = new Set<string>();

        query?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                aggregateColumns.add(aggFunc.column);
            }
        });

        const selectColumns: string[] = [];

        if (query.columns && Array.isArray(query.columns)) {
            query.columns.forEach((column: any) => {
                if (column.is_selected_column) {
                    const columnFullPath = `${column.schema}.${column.table_name}.${column.column_name}`;
                    const isAggregateOnly = aggregateColumns.has(columnFullPath);

                    if (!isAggregateOnly) {
                        let aliasName: string;
                        if (column?.alias_name && column.alias_name !== '') {
                            aliasName = column.alias_name;
                        } else if (
                            column.schema === 'dra_excel' || column.schema === 'dra_pdf' ||
                            column.schema === 'dra_google_analytics' || column.schema === 'dra_google_ad_manager' ||
                            column.schema === 'dra_google_ads' || column.schema === 'dra_mongodb' ||
                            column.schema === 'dra_meta_ads'
                        ) {
                            aliasName = `${column.table_name}`.length > 20
                                ? `${column.table_name}`.slice(-20) + `_${column.column_name}`
                                : `${column.table_name}_${column.column_name}`;
                        } else {
                            aliasName = `${column.schema}_${column.table_name}_${column.column_name}`;
                        }

                        let columnRef = column.table_alias
                            ? `${column.schema}.${column.table_alias}.${column.column_name}`
                            : `${column.schema}.${column.table_name}.${column.column_name}`;

                        if (column.transform_function) {
                            const closeParens = ')'.repeat(column.transform_close_parens || 1);
                            columnRef = `${column.transform_function}(${columnRef}${closeParens}`;
                        }

                        selectColumns.push(`${columnRef} AS ${aliasName}`);
                    }
                }
            });
        }

        query?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc: any) => {
            if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                const distinctKeyword = aggFunc.use_distinct ? 'DISTINCT ' : '';
                const aggregateFunc = aggregateFunctions[aggFunc.aggregate_function];

                let aliasName = aggFunc.column_alias_name;
                if (!aliasName || aliasName === '') {
                    const columnParts = aggFunc.column.split('.');
                    const columnName = columnParts[columnParts.length - 1];
                    aliasName = `${aggregateFunc.toLowerCase()}_${columnName}`;
                }

                selectColumns.push(`${aggregateFunc}(${distinctKeyword}${aggFunc.column}) AS ${aliasName}`);
            }
        });

        query?.query_options?.group_by?.aggregate_expressions?.forEach((aggExpr: any) => {
            if (aggExpr.expression && aggExpr.expression.trim() !== '') {
                const aliasName = aggExpr?.column_alias_name && aggExpr.column_alias_name !== '' ? aggExpr.column_alias_name : `agg_expr`;
                const cleanExpression = aggExpr.expression.replace(/\[\[/g, '').replace(/\]\]/g, '').replace(/\[/g, '').replace(/\]/g, '');
                selectColumns.push(`${cleanExpression} AS ${aliasName}`);
            }
        });

        if (query.calculated_columns && Array.isArray(query.calculated_columns)) {
            query.calculated_columns.forEach((calcCol: any) => {
                const expression = calcCol.expression || calcCol.column_expression;
                if (expression && calcCol.column_name) {
                    selectColumns.push(`${expression} AS ${calcCol.column_name}`);
                }
            });
        }

        sqlParts.push(`SELECT ${selectColumns.join(', ')}`);

        if (query.join_conditions && Array.isArray(query.join_conditions) && query.join_conditions.length > 0) {
            const fromJoinClauses: any[] = [];

            query.join_conditions.forEach((join: any) => {
                fromJoinClauses.push({
                    left_table_schema: join.left_table_schema,
                    left_table_name: join.left_table_name,
                    left_table_alias: join.left_table_alias,
                    left_column_name: join.left_column_name,
                    right_table_schema: join.right_table_schema,
                    right_table_name: join.right_table_name,
                    right_table_alias: join.right_table_alias,
                    right_column_name: join.right_column_name,
                    join_type: join.join_type || 'INNER',
                    primary_operator: join.primary_operator || '=',
                    additional_conditions: join.additional_conditions || [],
                });
            });

            const fromJoinClause: string[] = [];
            const addedTables = new Set<string>();

            const getTableAlias = (schema: string, tableName: string) => {
                if (query.columns && Array.isArray(query.columns)) {
                    const col = query.columns.find((c: any) =>
                        c.schema === schema && c.table_name === tableName && c.table_alias
                    );
                    return col?.table_alias || null;
                }
                return null;
            };

            fromJoinClauses.forEach((clause, index) => {
                const leftAlias = clause.left_table_alias || getTableAlias(clause.left_table_schema, clause.left_table_name);
                const rightAlias = clause.right_table_alias || getTableAlias(clause.right_table_schema, clause.right_table_name);

                const leftTableFull = `${clause.left_table_schema}.${clause.left_table_name}`;
                const rightTableFull = `${clause.right_table_schema}.${clause.right_table_name}`;

                const leftTableSQL = leftAlias ? `${leftTableFull} AS ${leftAlias}` : leftTableFull;
                const rightTableSQL = rightAlias ? `${rightTableFull} AS ${rightAlias}` : rightTableFull;

                const leftRef = leftAlias || clause.left_table_name;
                const rightRef = rightAlias || clause.right_table_name;
                const joinType = clause.join_type || 'INNER';

                if (index === 0) {
                    const operator = clause.primary_operator || '=';
                    fromJoinClause.push(`FROM ${leftTableSQL}`);
                    fromJoinClause.push(`${joinType} JOIN ${rightTableSQL}`);
                    fromJoinClause.push(`ON ${clause.left_table_schema}.${leftRef}.${clause.left_column_name} ${operator} ${clause.right_table_schema}.${rightRef}.${clause.right_column_name}`);
                    addedTables.add(leftTableFull);
                    addedTables.add(rightTableFull);

                    if (clause.additional_conditions && clause.additional_conditions.length > 0) {
                        clause.additional_conditions.forEach((addCond: any) => {
                            if (addCond.left_column && addCond.right_column && addCond.operator) {
                                fromJoinClause.push(`${addCond.logic} ${clause.left_table_schema}.${leftRef}.${addCond.left_column} ${addCond.operator} ${clause.right_table_schema}.${rightRef}.${addCond.right_column}`);
                            }
                        });
                    }
                } else {
                    const leftTableExists = addedTables.has(leftTableFull);
                    const rightTableExists = addedTables.has(rightTableFull);
                    const operator = clause.primary_operator || '=';
                    const joinCondition = `${clause.left_table_schema}.${leftRef}.${clause.left_column_name} ${operator} ${clause.right_table_schema}.${rightRef}.${clause.right_column_name}`;

                    if (!leftTableExists && !rightTableExists) {
                        fromJoinClause.push(`${joinType} JOIN ${rightTableSQL}`);
                        fromJoinClause.push(`ON ${joinCondition}`);
                        addedTables.add(rightTableFull);
                    } else if (!leftTableExists) {
                        fromJoinClause.push(`${joinType} JOIN ${leftTableSQL}`);
                        fromJoinClause.push(`ON ${joinCondition}`);
                        addedTables.add(leftTableFull);
                    } else if (!rightTableExists) {
                        fromJoinClause.push(`${joinType} JOIN ${rightTableSQL}`);
                        fromJoinClause.push(`ON ${joinCondition}`);
                        addedTables.add(rightTableFull);
                    }

                    if (clause.additional_conditions && clause.additional_conditions.length > 0) {
                        clause.additional_conditions.forEach((addCond: any) => {
                            if (addCond.left_column && addCond.right_column && addCond.operator) {
                                fromJoinClause.push(`${addCond.logic} ${clause.left_table_schema}.${leftRef}.${addCond.left_column} ${addCond.operator} ${clause.right_table_schema}.${rightRef}.${addCond.right_column}`);
                            }
                        });
                    }
                }
            });

            sqlParts.push(fromJoinClause.join(' '));
        } else if (query.columns && query.columns.length > 0) {
            const firstColumn = query.columns.find((c: any) => c.is_selected_column);
            if (firstColumn) {
                sqlParts.push(`FROM ${firstColumn.schema}.${firstColumn.table_name}`);
            }
        }

        if (query.query_options?.where && Array.isArray(query.query_options.where) && query.query_options.where.length > 0) {
            const whereClauses: string[] = [];
            const equalityOperators = ['=', '>', '<', '>=', '<=', '!=', 'IN', 'NOT IN'];

            query.query_options.where.forEach((whereClause: any) => {
                if (whereClause.column && whereClause.equality !== undefined && whereClause.equality !== '' && whereClause.value !== undefined && whereClause.value !== '') {
                    const operator = equalityOperators[whereClause.equality] || '=';
                    let formattedValue = whereClause.value;
                    const dataType = whereClause.column_data_type?.toLowerCase() || '';

                    if (dataType === 'numeric' || dataType === 'integer' || dataType === 'bigint' ||
                        dataType === 'smallint' || dataType === 'real' || dataType === 'double precision' ||
                        dataType === 'decimal' || dataType === 'float' || dataType === 'money') {
                        formattedValue = whereClause.value;
                    } else if (operator === 'IN' || operator === 'NOT IN') {
                        formattedValue = `(${whereClause.value})`;
                    } else if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
                        formattedValue = '';
                    } else {
                        formattedValue = `'${whereClause.value}'`;
                    }

                    const sqlClause = operator === 'IS NULL' || operator === 'IS NOT NULL'
                        ? `${whereClause.column} ${operator}`
                        : `${whereClause.column} ${operator} ${formattedValue}`;
                    whereClauses.push(sqlClause);
                }
            });
            if (whereClauses.length > 0) {
                sqlParts.push(`WHERE ${whereClauses.join(' AND ')}`);
            }
        }

        const hasGroupByName = !!query.query_options?.group_by?.name;
        const hasGroupByColumns = query.query_options?.group_by?.group_by_columns?.length > 0;
        const hasAggFuncs = query.query_options?.group_by?.aggregate_functions?.some(
            (agg: any) => agg.aggregate_function !== '' && agg.column !== ''
        );
        const hasAggExprs = query.query_options?.group_by?.aggregate_expressions?.some(
            (expr: any) => expr.expression && expr.expression !== ''
        );

        if (hasGroupByName || hasGroupByColumns || hasAggFuncs || hasAggExprs) {
            let groupByColumns: string[] = [];

            if (
                query.query_options?.group_by?.group_by_columns &&
                Array.isArray(query.query_options.group_by.group_by_columns) &&
                query.query_options.group_by.group_by_columns.length > 0
            ) {
                groupByColumns = query.query_options.group_by.group_by_columns.map((colRef: string) => {
                    const parts = colRef.split('.');
                    if (parts.length === 3) {
                        const [schema, tableName, columnName] = parts;
                        const aliasedColumn = query.columns?.find((c: any) =>
                            c.schema === schema && c.table_name === tableName && c.table_alias
                        );
                        if (aliasedColumn?.table_alias) {
                            return `${schema}.${aliasedColumn.table_alias}.${columnName}`;
                        }
                    }
                    return colRef;
                });
            } else {
                query.columns?.forEach((column: any) => {
                    if (column.is_selected_column) {
                        const columnFullPath = `${column.schema}.${column.table_name}.${column.column_name}`;
                        const isAggregateOnly = aggregateColumns.has(columnFullPath);
                        if (!isAggregateOnly) {
                            const tableRef = column.table_alias || column.table_name;
                            groupByColumns.push(`${column.schema}.${tableRef}.${column.column_name}`);
                        }
                    }
                });
            }

            if (groupByColumns.length > 0) {
                sqlParts.push(`GROUP BY ${groupByColumns.join(', ')}`);
            } else if (
                query.query_options?.group_by?.aggregate_functions?.length > 0 ||
                query.query_options?.group_by?.aggregate_expressions?.length > 0
            ) {
                console.warn('[DataSourceSQLHelpers] WARNING: Aggregates present but GROUP BY is empty!');
            }
        }

        if (query.query_options?.group_by?.having_conditions && query.query_options.group_by.having_conditions.length > 0) {
            const havingClauses: string[] = [];
            const equalityOperators = ['=', '>', '<', '>=', '<=', '!=', 'IN', 'NOT IN'];

            query.query_options.group_by.having_conditions.forEach((havingClause: any) => {
                if (havingClause.column && havingClause.equality !== undefined && havingClause.value !== undefined && havingClause.value !== '') {
                    const operator = equalityOperators[havingClause.equality] || '=';
                    let havingColumn = havingClause.column;
                    let formattedValue = havingClause.value;

                    const aggregateFunc = query.query_options?.group_by?.aggregate_functions?.find((aggFunc: any) => {
                        if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                            const funcName = aggregateFunctions[aggFunc.aggregate_function];
                            const columnParts = aggFunc.column.split('.');
                            const columnName = columnParts[columnParts.length - 1];
                            const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${columnName}`;
                            return aliasName === havingClause.column;
                        }
                        return false;
                    });

                    const aggregateExpr = query.query_options?.group_by?.aggregate_expressions?.find((aggExpr: any) => {
                        return aggExpr.column_alias_name === havingClause.column;
                    });

                    if (aggregateFunc) {
                        const funcName = aggregateFunctions[aggregateFunc.aggregate_function];
                        const distinctKeyword = aggregateFunc.use_distinct ? 'DISTINCT ' : '';
                        havingColumn = `${funcName}(${distinctKeyword}${aggregateFunc.column})`;
                    } else if (aggregateExpr) {
                        havingColumn = aggregateExpr.expression.replace(/\[\[/g, '').replace(/\]\]/g, '').replace(/\[/g, '').replace(/\]/g, '');
                    }

                    if (operator === 'IN' || operator === 'NOT IN') {
                        formattedValue = `(${havingClause.value})`;
                    } else {
                        formattedValue = havingClause.value;
                    }

                    havingClauses.push(`${havingColumn} ${operator} ${formattedValue}`);
                }
            });
            if (havingClauses.length > 0) {
                sqlParts.push(`HAVING ${havingClauses.join(' AND ')}`);
            }
        }

        if (query.query_options?.order_by && Array.isArray(query.query_options.order_by) && query.query_options.order_by.length > 0) {
            const orderByClauses: string[] = [];
            query.query_options.order_by.forEach((orderBy: any) => {
                if (orderBy.column && orderBy.direction) {
                    orderByClauses.push(`${orderBy.column} ${orderBy.direction}`);
                }
            });
            if (orderByClauses.length > 0) {
                sqlParts.push(`ORDER BY ${orderByClauses.join(', ')}`);
            }
        }

        if (query.query_options?.limit && query.query_options.limit !== -1) {
            const sanitizedLimit = Math.max(1, parseInt(String(query.query_options.limit), 10));
            sqlParts.push(`LIMIT ${sanitizedLimit}`);
        }
        if (query.query_options?.offset && query.query_options.offset !== -1) {
            sqlParts.push(`OFFSET ${query.query_options.offset}`);
        }

        const finalSQL = sqlParts.join(' ');
        console.log('[DataSourceSQLHelpers] Reconstructed SQL from JSON:', finalSQL);
        return finalSQL;
    }
}
