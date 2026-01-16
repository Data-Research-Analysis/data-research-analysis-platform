/**
 * Test utilities for DataSourceProcessor tests
 */

/**
 * Create test query JSON structure
 */
export const createTestQueryJSON = (columns: any[], options: {
    join_conditions?: any[];
    calculated_columns?: any[];
    query_options?: any;
} = {}) => {
    return JSON.stringify({
        table_name: 'test_data_model',
        columns,
        query_options: options.query_options || {
            where: [],
            group_by: {},
            order_by: [],
            offset: -1,
            limit: -1
        },
        calculated_columns: options.calculated_columns || [],
        join_conditions: options.join_conditions || [],
        table_aliases: []
    });
};

/**
 * Create a test column structure
 */
export const createTestColumn = (
    schema: string,
    tableName: string,
    columnName: string,
    dataSourceId: number,
    options: {
        dataType?: string;
        aliasName?: string;
        characterMaxLength?: string;
        dataSourceType?: string;
    } = {}
) => {
    return {
        column_name: columnName,
        data_type: options.dataType || 'varchar',
        character_maximum_length: options.characterMaxLength || null,
        table_name: tableName,
        schema: schema,
        alias_name: options.aliasName || '',
        is_selected_column: true,
        reference: {
            local_table_schema: null,
            local_table_name: null,
            local_column_name: null,
            foreign_table_schema: null,
            foreign_table_name: null,
            foreign_column_name: null
        },
        data_source_id: dataSourceId,
        data_source_type: options.dataSourceType || 'mysql',
        table_alias: null,
        display_name: `${tableName}.${columnName}`,
        transform_function: '',
        transform_close_parens: 0
    };
};

/**
 * Create a test JOIN condition
 */
export const createTestJoinCondition = (
    leftTable: { schema: string; table: string },
    leftColumn: string,
    rightTable: { schema: string; table: string },
    rightColumn: string,
    joinType: string = 'INNER'
) => {
    return {
        id: Date.now(),
        left_table_schema: leftTable.schema,
        left_table_name: leftTable.table,
        left_table_alias: null,
        left_column_name: leftColumn,
        right_table_schema: rightTable.schema,
        right_table_name: rightTable.table,
        right_table_alias: null,
        right_column_name: rightColumn,
        join_type: joinType,
        primary_operator: '=',
        join_logic: 'AND',
        is_auto_detected: true,
        additional_conditions: []
    };
};

/**
 * Create expected table map entry
 */
export const createExpectedTableMapping = (
    originalRef: string,
    schema: string,
    tableName: string,
    dataSourceId: number
) => {
    return {
        key: originalRef,
        value: {
            schema,
            table_name: tableName,
            data_source_id: dataSourceId
        }
    };
};

/**
 * Assert table map contains expected mapping
 */
export const expectTableMapToContain = (
    tableMap: Map<string, any>,
    expected: { key: string; value: any }
) => {
    expect(tableMap.has(expected.key)).toBe(true);
    const actual = tableMap.get(expected.key);
    expect(actual).toEqual(expected.value);
};

/**
 * Create mock token details
 */
export const createMockTokenDetails = () => {
    return {
        user_id: 1,
        email: 'test@example.com',
        role: 'user'
    };
};

/**
 * Count occurrences of a string in another string
 */
export const countOccurrences = (str: string, searchStr: string): number => {
    const regex = new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = str.match(regex);
    return matches ? matches.length : 0;
};
