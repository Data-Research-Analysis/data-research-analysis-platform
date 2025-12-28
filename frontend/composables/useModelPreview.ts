/**
 * Composable for model preview functionality
 * Shared by ai-data-modeler-drawer.vue and AIDataModelerChat.vue
 */

export function useModelPreview(modelDraft: any) {
    /**
     * Get list of tables in the model
     */
    function getTablesList(): string {
        if (!modelDraft?.tables?.[0]) return 'None';
        const table = modelDraft.tables[0];
        return table.table_name || 'Unknown';
    }

    /**
     * Get count of columns in the model
     */
    function getColumnCount(): number {
        if (!modelDraft?.tables?.[0]?.columns) return 0;
        return modelDraft.tables[0].columns.length;
    }

    /**
     * Get formatted column names with aliases
     */
    function getColumnNames(): string[] {
        if (!modelDraft?.tables?.[0]?.columns) return [];
        const columns = modelDraft.tables[0].columns;
        
        return columns.map((col: any) => {
            if (col.alias_name && col.alias_name.trim() !== '') {
                return `${col.column_name} AS ${col.alias_name}`;
            }
            return col.column_name;
        });
    }

    /**
     * Check if model has WHERE clause
     */
    function hasWhereClause(): boolean {
        const queryOptions = modelDraft?.tables?.[0]?.query_options;
        return !!(queryOptions?.where && queryOptions.where.length > 0);
    }

    /**
     * Check if model has GROUP BY clause
     */
    function hasGroupBy(): boolean {
        const queryOptions = modelDraft?.tables?.[0]?.query_options;
        return !!(queryOptions?.group_by?.aggregate_functions && queryOptions.group_by.aggregate_functions.length > 0);
    }

    /**
     * Check if model has ORDER BY clause
     */
    function hasOrderBy(): boolean {
        const queryOptions = modelDraft?.tables?.[0]?.query_options;
        return !!(queryOptions?.order_by && queryOptions.order_by.length > 0);
    }

    /**
     * Get formatted WHERE conditions
     */
    function getWhereConditions(): string[] {
        const where = modelDraft?.tables?.[0]?.query_options?.where;
        if (!where || where.length === 0) return [];
        return where.map((w: any) => `${w.column} ${w.operator} ${w.value}`);
    }

    /**
     * Get formatted GROUP BY columns with aggregate functions
     */
    function getGroupByColumns(): string[] {
        const groupBy = modelDraft?.tables?.[0]?.query_options?.group_by;
        if (!groupBy?.aggregate_functions || groupBy.aggregate_functions.length === 0) return [];
        
        const aggregateFunctionNames = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
        
        return groupBy.aggregate_functions.map((agg: any) => {
            const funcName = aggregateFunctionNames[agg.aggregate_function] || 'UNKNOWN';
            const distinct = agg.use_distinct ? 'DISTINCT ' : '';
            return `${funcName}(${distinct}${agg.column}) AS ${agg.column_alias_name}`;
        });
    }

    /**
     * Get formatted ORDER BY columns
     */
    function getOrderByColumns(): string[] {
        const orderBy = modelDraft?.tables?.[0]?.query_options?.order_by;
        if (!orderBy || orderBy.length === 0) return [];
        
        const orderDirections = ['ASC', 'DESC'];
        
        return orderBy.map((o: any) => {
            const direction = orderDirections[o.order] || 'ASC';
            return `${o.column} ${direction}`;
        });
    }

    return {
        getTablesList,
        getColumnCount,
        getColumnNames,
        hasWhereClause,
        hasGroupBy,
        hasOrderBy,
        getWhereConditions,
        getGroupByColumns,
        getOrderByColumns
    };
}
