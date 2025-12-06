<script setup>
import _ from 'lodash';
import { useAIDataModelerStore } from '~/stores/ai-data-modeler';

const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const aiDataModelerStore = useAIDataModelerStore();
const state = reactive({
    show_dialog: false,
    show_calculated_column_dialog: false,
    show_alias_dialog: false,
    viewMode: 'simple', // 'simple' or 'advanced'
    tables: [],
    table_aliases: [],
    alias_form: {
        table: '',
        alias: ''
    },
    manual_joins: [],
    data_table: {
        table_name: 'data_model_table',
        columns: [],
        query_options: {
            where: [],
            group_by: {},
            order_by: [],
            offset: -1,
            limit: -1,
        },
        calculated_columns: [],
    },
    loading: false,
    query_options: [
        {
            name: 'WHERE',
        },
        {
            name: 'GROUP BY',
        },
        {
            name: 'ORDER BY',
        },
        {
            name: 'OFFSET',
        },
        {
            name: 'LIMIT',
        },
    ],
    equality: ['=', '>', '<', '>=', '<=', '!=', 'IN', 'NOT IN'],
    condition: ['AND', 'OR'],
    order: ['ASC', 'DESC'],
    aggregate_functions: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'],
    add_column_operators: ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE','MODULO'],
    sql_query: '',
    response_from_external_data_source_columns: [],
    response_from_external_data_source_rows: [],
    calculated_column: {},
    alerts: [],
    transform_functions: [
        { name: 'None', value: '', close_parens: 0 },
        { name: 'DATE', value: 'DATE', close_parens: 1 },
        { name: 'YEAR', value: 'EXTRACT(YEAR FROM', close_parens: 2 },
        { name: 'MONTH', value: 'EXTRACT(MONTH FROM', close_parens: 2 },
        { name: 'DAY', value: 'EXTRACT(DAY FROM', close_parens: 2 },
        { name: 'UPPER', value: 'UPPER', close_parens: 1 },
        { name: 'LOWER', value: 'LOWER', close_parens: 1 },
        { name: 'TRIM', value: 'TRIM', close_parens: 1 },
        { name: 'ROUND', value: 'ROUND', close_parens: 1 },
    ],
});
const props = defineProps({
    dataModel: {
        type: Object,
        required: false,
        default: {},
    },
    dataSourceTables: {
        type: Array,
        required: false,
        default: [],
    },
    dataSource: {
        type: Object,
        required: false,
        default: null,
    },
    isEditDataModel: {
        type: Boolean,
        required: false,
        default: false,
    },
});
const showWhereClause = computed(() => {
    return state?.data_table?.query_options?.where?.length > 0;
});
const showOrderByClause = computed(() => {
    return state?.data_table?.query_options?.order_by?.length > 0;
});
const showGroupByClause = computed(() => {
    return state?.data_table?.query_options?.group_by?.name ? true : false;
});
const showDataModelControls = computed(() => {
    return state && state.data_table && state.data_table.columns && state.data_table.columns.length > 0;
})
const saveButtonEnabled = computed(() => {
    return state && state.data_table && state.data_table.columns && state.data_table.columns.filter((column) => column.is_selected_column).length > 0;
})
const safeDataTableColumns = computed(() => {
    return (state?.data_table?.columns && Array.isArray(state.data_table.columns)) ? state.data_table.columns : [];
})
const numericColumns = computed(() => {
    return [...state.data_table.columns.filter((column) => getDataType(column.data_type) === 'NUMBER').map((column) => {
        return {
            schema: column.schema,
            table_name: column.table_name,
            column_name: column.column_name,
            data_type: getDataType(column.data_type),
        }
    })];
})

const allAvailableColumns = computed(() => {
    const columns = [];
    
    // 1. Add base table columns
    state.data_table.columns.forEach(column => {
        const displayName = column.alias_name && column.alias_name.trim() !== '' 
            ? column.alias_name 
            : `${column.schema}.${column.table_name}.${column.column_name}`;
        
        columns.push({
            value: `${column.schema}.${column.table_name}.${column.column_name}`,
            display: displayName,
            type: 'column',
            data_type: column.data_type,
            is_aggregate: false
        });
    });
    
    // 2. Add aggregate functions
    if (state.data_table.query_options?.group_by?.aggregate_functions) {
        state.data_table.query_options.group_by.aggregate_functions.forEach((aggFunc, index) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;
                
                columns.push({
                    value: aliasName,
                    display: `${funcName}(${aggFunc.column})${aggFunc.use_distinct ? ' [DISTINCT]' : ''} AS ${aliasName}`,
                    type: 'aggregate_function',
                    data_type: 'NUMBER',
                    is_aggregate: true,
                    aggregate_index: index
                });
            }
        });
    }
    
    // 3. Add aggregate expressions
    if (state.data_table.query_options?.group_by?.aggregate_expressions) {
        state.data_table.query_options.group_by.aggregate_expressions.forEach((aggExpr, index) => {
            if (aggExpr.expression && aggExpr.aggregate_function !== '') {
                const funcName = state.aggregate_functions[aggExpr.aggregate_function];
                const aliasName = aggExpr.column_alias_name || `expr_${index}`;
                
                columns.push({
                    value: aliasName,
                    display: `${funcName}(${aggExpr.expression})${aggExpr.use_distinct ? ' [DISTINCT]' : ''} AS ${aliasName}`,
                    type: 'aggregate_expression',
                    data_type: 'NUMBER',
                    is_aggregate: true,
                    expression_index: index
                });
            }
        });
    }
    
    return columns;
});

const whereColumns = computed(() => {
    return allAvailableColumns.value.filter(col => !col.is_aggregate);
});

const havingColumns = computed(() => {
    if (showGroupByClause.value) {
        return allAvailableColumns.value.filter(col => col.is_aggregate);
    }
    return [];
});

const orderByColumns = computed(() => {
    return allAvailableColumns.value;
});

const numericColumnsWithAggregates = computed(() => {
    const columns = [];
    
    // 1. Add base numeric columns
    state.data_table.columns
        .filter((column) => getDataType(column.data_type) === 'NUMBER')
        .forEach((column) => {
            const displayName = column.alias_name && column.alias_name.trim() !== '' 
                ? column.alias_name 
                : `${column.schema}.${column.table_name}.${column.column_name}`;
            
            columns.push({
                value: displayName,
                display: `${displayName} (Base Column)`,
                type: 'base_column',
                schema: column.schema,
                table_name: column.table_name,
                column_name: column.column_name,
                data_type: 'NUMBER'
            });
        });
    
    // 2. Add aggregate functions (all aggregates return numeric values)
    if (state.data_table.query_options?.group_by?.aggregate_functions) {
        state.data_table.query_options.group_by.aggregate_functions.forEach((aggFunc, index) => {
            if (aggFunc.column && aggFunc.aggregate_function !== '') {
                const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;
                
                columns.push({
                    value: aliasName,
                    display: `${funcName}(${aggFunc.column})${aggFunc.use_distinct ? ' [DISTINCT]' : ''} → ${aliasName}`,
                    type: 'aggregate_function',
                    data_type: 'NUMBER',
                    aggregate_index: index
                });
            }
        });
    }
    
    // 3. Add aggregate expressions
    if (state.data_table.query_options?.group_by?.aggregate_expressions) {
        state.data_table.query_options.group_by.aggregate_expressions.forEach((aggExpr, index) => {
            if (aggExpr.expression && aggExpr.aggregate_function !== '') {
                const funcName = state.aggregate_functions[aggExpr.aggregate_function];
                const aliasName = aggExpr.column_alias_name || `expr_${index}`;
                
                columns.push({
                    value: aliasName,
                    display: `${funcName}(${aggExpr.expression})${aggExpr.use_distinct ? ' [DISTINCT]' : ''} → ${aliasName}`,
                    type: 'aggregate_expression',
                    data_type: 'NUMBER',
                    expression_index: index
                });
            }
        });
    }
    
    return columns;
});

function openAIDataModeler() {
    if (props.dataSource && props.dataSource.id) {
        // If editing existing data model, pass its ID to load conversation from database
        const dataModelId = props.isEditDataModel && props.dataModel?.id 
            ? props.dataModel.id 
            : undefined;
        
        aiDataModelerStore.openDrawer(props.dataSource.id, dataModelId);
    }
}

function hasAdvancedFields() {
    if (!state.data_table || !state.data_table.query_options) return false;
    
    const queryOptions = state.data_table.query_options;
    
    // Check WHERE clauses
    if (queryOptions.where && queryOptions.where.length > 0) return true;
    
    // Check GROUP BY
    if (queryOptions.group_by) {
        if (queryOptions.group_by.name) return true;
        if (queryOptions.group_by.aggregate_functions?.length > 0) return true;
        if (queryOptions.group_by.aggregate_expressions?.length > 0) return true;
        if (queryOptions.group_by.having_conditions?.length > 0) return true;
    }
    
    // Check ORDER BY
    if (queryOptions.order_by && queryOptions.order_by.length > 0) return true;
    
    // Check OFFSET/LIMIT
    if (queryOptions.offset !== -1) return true;
    if (queryOptions.limit !== -1) return true;
    
    // Check calculated columns
    if (state.data_table.calculated_columns && state.data_table.calculated_columns.length > 0) return true;
    
    // Check column aliases
    if (state.data_table.columns) {
        const hasAliases = state.data_table.columns.some(col => col.alias_name && col.alias_name.trim() !== '');
        if (hasAliases) return true;
        
        // Check column transformations
        const hasTransforms = state.data_table.columns.some(col => col.transform && col.transform !== '');
        if (hasTransforms) return true;
    }
    
    return false;
}

watch(() => state.data_table.query_options, async (value) => {
    await executeQueryOnExternalDataSource();
}, { deep: true });
watch(() => state.data_table.query_options.group_by, async (value) => {
    state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggregate_function) => {
        aggregate_function.column_alias_name = aggregate_function.column_alias_name.replace(/\s/g,'_').toLowerCase();
    });
    await executeQueryOnExternalDataSource();
}, { deep: true });
watch(() => state.data_table.table_name, (value) => {
    //keep the table name to maximum length of 20 characters
    state.data_table.table_name = value.substring(0, 20).replace(/\s/g,'_').toLowerCase();
}, { deep: true });
watch(() => state.data_table.columns, async (value) => {
    //keep the column names to maximum length of 20 characters
    state.data_table.columns.forEach((column) => {
        column.alias_name = column.alias_name.replace(/\s/g,'_').toLowerCase();
    });
    await executeQueryOnExternalDataSource();
}, { deep: true });
watch(() => state.calculated_column.column_name, (value) => {
    //keep the calculated column name to maximum length of 20 characters
    state.calculated_column.column_name = value.substring(0, 20).replace(/\s/g,'_').toLowerCase();
}, { deep: true });
watch(() => state.data_table.calculated_columns, async (value) => {
    // buildCalculatedColumn();
}, { deep: true });

// Watch for manual apply trigger from AI drawer
watch(() => aiDataModelerStore.applyTrigger, (newValue, oldValue) => {
    console.log('[Data Model Builder - applyTrigger watcher] Triggered', {
        newValue,
        oldValue,
        changed: newValue !== oldValue,
        hasModelDraft: !!aiDataModelerStore.modelDraft,
        hasTables: !!aiDataModelerStore.modelDraft?.tables,
        modelDraft: aiDataModelerStore.modelDraft
    });
    
    if (newValue !== oldValue && aiDataModelerStore.modelDraft?.tables) {
        console.log('[Data Model Builder] Manual apply trigger detected, applying AI model');
        applyAIGeneratedModel(aiDataModelerStore.modelDraft.tables);
    } else {
        console.warn('[Data Model Builder] Trigger changed but conditions not met for applying model');
    }
});

function getColumValue(value, dataType) {
    if (getDataType(dataType) === 'NUMBER' || getDataType(dataType) === 'BOOLEAN') {
        return `${value}`;
    } else if (getDataType(dataType) === 'TEXT') {
        return `'${value}'`;
    } else {
        return `'${value}'`;
    }
}
function whereColumnChanged(event) {
    const selectedValue = event.target.value;
    const whereColumn = state.data_table.query_options.where.find((where_column) => where_column.column === selectedValue);
    
    if (whereColumn) {
        const columnInfo = allAvailableColumns.value.find(col => col.value === selectedValue);
        if (columnInfo) {
            whereColumn.column_data_type = columnInfo.data_type;
        }
    }
}
function havingColumnChanged(event) {
    const selectedValue = event.target.value;
    const havingColumn = state.data_table.query_options.group_by.having_conditions.find((having_column) => having_column.column === selectedValue);
    
    if (havingColumn) {
        const columnInfo = allAvailableColumns.value.find(col => col.value === selectedValue);
        if (columnInfo) {
            havingColumn.column_data_type = columnInfo.data_type;
        }
    }
}
function aggregateFunctionChanged(event) {
    const aggregateFunction = state.data_table.query_options.group_by.aggregate_functions.find((aggregate_function) => aggregate_function.aggregate_function === parseInt(event.target.value))
    if (aggregateFunction && aggregateFunction.column !== "") {
        const column = state.data_table.columns.find((column) => `${column.schema}.${column.table_name}.${column.column_name}` === aggregateFunction.column);
        if (column) {
            if (getDataType(column.data_type) !== 'NUMBER') {
                if (state.aggregate_functions[aggregateFunction.aggregate_function] === 'SUM' || state.aggregate_functions[aggregateFunction.aggregate_function] === 'AVG') {
                    $swal.fire({
                        icon: 'error',
                        title: `Error!`,
                        text: `The aggregate function ${state.aggregate_functions[aggregateFunction.aggregate_function]} is not supported for the column ${column.column_name} due to its data type.`,
                    });
                    return;
                }
            }
        }
    }
}
function aggregateFunctionColumnChanged(event) {
    const aggregateFunction = state.data_table.query_options.group_by.aggregate_functions.find((aggregate_function) => aggregate_function.column === event.target.value)
    if (aggregateFunction && aggregateFunction.aggregate_function !== "") {
        const column = state.data_table.columns.find((column) => `${column.schema}.${column.table_name}.${column.column_name}` === aggregateFunction.column);
        if (column) {
            if (getDataType(column.data_type) !== 'NUMBER') {
                if (state.aggregate_functions[aggregateFunction.aggregate_function] === 'SUM' || state.aggregate_functions[aggregateFunction.aggregate_function] === 'AVG') {
                    $swal.fire({
                        icon: 'error',
                        title: `Error!`,
                        text: `The aggregate function ${state.aggregate_functions[aggregateFunction.aggregate_function]} is not supported for the column ${column.column_name} due to its data type.`,
                    });
                    return;
                }
            }
        }
    }
}
function openDialog() {
    state.show_dialog = true;
}
function closeDialog() {
    state.show_dialog = false;
}
function openCalculatedColumnDialog() {
    state.show_calculated_column_dialog = true;
    state.calculated_column = {
        column_name: '',
        columns: [
            {
                column_name: '',
                operator: null, //the first operator will always be null
                type: 'column',
                numeric_value: 0,
            },
        ],
        column_data_type: 'Number', // The calculated field will only have a number data type. The actual data type will be determined by the expression used and the data types of the columns used in the expression.
    };
}
function closeCalculatedColumnDialog() {
    state.show_calculated_column_dialog = false;
}
async function changeDataModel(event) {
    state.data_table.columns = state.data_table.columns.filter((column) => {
        // Allow foreign key columns (needed for reflexive relationships)
        if (event?.added?.element?.reference?.foreign_table_schema && event?.added?.element?.reference?.local_table_name === column?.table_name && event?.added?.element?.reference?.local_column_name === column?.column_name) {
            console.log('[changeDataModel] Foreign key column added - may be used for reflexive relationship', event.added.element);
            // Don't block it - user might be creating reflexive relationship
        }
        //remove duplicate columns (check both table_name and table_alias)
        const matchingColumns = state.data_table.columns.filter((c) => {
            const sameColumn = c.column_name === column.column_name;
            const sameTable = c.table_name === column.table_name;
            const sameAlias = (c.table_alias || null) === (column.table_alias || null);
            return sameColumn && sameTable && sameAlias;
        });
        
        if (matchingColumns.length > 1) {
            return false;
        } else {
            return true;
        }
    });
    await executeQueryOnExternalDataSource();    
}
/**
 * Helper function to build fully-qualified column reference
 * @param {Object} column - Column object with schema, table_name, and column_name
 * @returns {String} Fully-qualified column reference (e.g., "test_schema.users.user_id")
 */
function buildColumnReference(column) {
    if (!column || !column.schema || !column.table_name || !column.column_name) {
        console.warn('[buildColumnReference] Invalid column object:', column);
        return '';
    }
    return `${column.schema}.${column.table_name}.${column.column_name}`;
}

/**
 * Open dialog to create table alias for self-referencing relationships
 */
function openAliasDialog() {
    state.alias_form = {
        table: '',
        alias: ''
    };
    state.show_alias_dialog = true;
}

/**
 * Close alias creation dialog
 */
function closeAliasDialog() {
    state.show_alias_dialog = false;
}

/**
 * Create a new table alias for self-referencing relationships
 */
function createTableAlias() {
    const { table, alias } = state.alias_form;
    
    // Validation
    if (!table || !alias) {
        $swal.fire({
            icon: 'error',
            title: 'Missing Information',
            text: 'Please select a table and provide an alias name'
        });
        return;
    }
    
    // Check for duplicate alias names
    if (state.table_aliases.some(a => a.alias === alias)) {
        $swal.fire({
            icon: 'error',
            title: 'Duplicate Alias',
            text: `The alias "${alias}" is already in use. Please choose a different name.`
        });
        return;
    }
    
    // Check if alias matches any existing table name (confusing)
    if (state.tables.some(t => t.table_name === alias)) {
        $swal.fire({
            icon: 'warning',
            title: 'Confusing Alias Name',
            text: `The alias "${alias}" matches an existing table name. Consider using a more distinctive name.`,
            showCancelButton: true,
            confirmButtonText: 'Use Anyway',
            cancelButtonText: 'Choose Different Name'
        }).then((result) => {
            if (result.isConfirmed) {
                performCreateAlias(table, alias);
            }
        });
        return;
    }
    
    performCreateAlias(table, alias);
}

/**
 * Internal function to perform alias creation
 */
function performCreateAlias(table, alias) {
    const [schema, tableName] = table.split('.');
    
    // Add to aliases
    state.table_aliases.push({
        schema,
        original_table: tableName,
        alias
    });
    
    console.log(`[createTableAlias] Created alias "${alias}" for ${schema}.${tableName}`);
    
    $swal.fire({
        icon: 'success',
        title: 'Alias Created',
        text: `You can now add columns from "${alias}" (${tableName})`,
        timer: 2000,
        showConfirmButton: false
    });
    
    closeAliasDialog();
}

/**
 * Remove a table alias
 */
function removeTableAlias(index) {
    const alias = state.table_aliases[index];
    
    // Check if any columns are using this alias
    const columnsUsingAlias = state.data_table.columns.filter(
        col => col.table_alias === alias.alias
    );
    
    if (columnsUsingAlias.length > 0) {
        $swal.fire({
            icon: 'warning',
            title: 'Cannot Remove Alias',
            html: `The alias "<strong>${alias.alias}</strong>" is being used by <strong>${columnsUsingAlias.length}</strong> column(s). Remove those columns first.<br><br>Columns using this alias:<ul class="list-disc pl-5 mt-2">${columnsUsingAlias.map(col => `<li>${col.column_name}</li>`).join('')}</ul>`
        });
        return;
    }
    
    state.table_aliases.splice(index, 1);
    console.log(`[removeTableAlias] Removed alias "${alias.alias}"`);
    
    $swal.fire({
        icon: 'success',
        title: 'Alias Removed',
        timer: 1500,
        showConfirmButton: false
    });
}

/**
 * Get combined list of regular tables and aliased tables for display
 */
function getTablesWithAliases() {
    const result = [];
    
    // Add regular tables
    state.tables.forEach(table => {
        result.push({
            schema: table.schema,
            table_name: table.table_name,
            display_name: table.table_name,
            columns: table.columns,
            references: table.references || [],
            isAlias: false,
            original_table: table.table_name,
            table_alias: null
        });
    });
    
    // Add aliased versions
    state.table_aliases.forEach(alias => {
        const originalTable = state.tables.find(
            t => t.table_name === alias.original_table && t.schema === alias.schema
        );
        
        if (originalTable) {
            // Clone columns and mark with alias
            const aliasedColumns = originalTable.columns.map(col => ({
                ...col,
                table_alias: alias.alias,
                display_column_name: `${alias.alias}.${col.column_name}`
            }));
            
            result.push({
                schema: alias.schema,
                table_name: alias.original_table,
                table_alias: alias.alias,
                display_name: `${alias.alias}`,
                columns: aliasedColumns,
                references: originalTable.references || [],
                isAlias: true,
                original_table: alias.original_table
            });
        }
    });
    
    return result;
}
async function deleteColumn(columnName) {
    // Find the column being deleted to get its full reference
    const columnToDelete = state.data_table.columns.find(col => col.column_name === columnName);
    
    if (!columnToDelete) {
        console.warn(`[deleteColumn] Column ${columnName} not found in data model`);
        return;
    }
    
    // Build fully-qualified column reference for cleanup
    const fullColumnRef = buildColumnReference(columnToDelete);
    
    console.log(`[deleteColumn] Removing column: ${fullColumnRef}`);
    
    // 1. Remove from columns array
    state.data_table.columns = state.data_table.columns.filter((column) => {
        column.alias_name = "";
        return column.column_name !== columnName;
    });
    
    // If no columns left, reset everything
    if (state.data_table.columns.length === 0) {
        console.log('[deleteColumn] No columns remaining, resetting all query options');
        state.data_table.query_options.where = [];
        state.data_table.query_options.group_by = {};
        state.data_table.query_options.order_by = [];
        state.data_table.query_options.offset = -1;
        state.data_table.query_options.limit = -1;
        await executeQueryOnExternalDataSource();
        return;
    }
    
    // 2. Clean up GROUP BY columns (AI-generated string array)
    if (state.data_table.query_options?.group_by?.group_by_columns?.length > 0) {
        const beforeLength = state.data_table.query_options.group_by.group_by_columns.length;
        state.data_table.query_options.group_by.group_by_columns = 
            state.data_table.query_options.group_by.group_by_columns.filter(col => {
                // Remove exact matches and columns wrapped in transform functions
                return !col.includes(fullColumnRef);
            });
        
        const removedCount = beforeLength - state.data_table.query_options.group_by.group_by_columns.length;
        if (removedCount > 0) {
            console.log(`[deleteColumn] Removed ${removedCount} reference(s) from group_by_columns`);
        }
    }
    
    // 3. Clean up aggregate functions
    if (state.data_table.query_options?.group_by?.aggregate_functions?.length > 0) {
        const beforeLength = state.data_table.query_options.group_by.aggregate_functions.length;
        state.data_table.query_options.group_by.aggregate_functions = 
            state.data_table.query_options.group_by.aggregate_functions.filter(aggFunc => {
                return aggFunc.column !== fullColumnRef;
            });
        
        const removedCount = beforeLength - state.data_table.query_options.group_by.aggregate_functions.length;
        if (removedCount > 0) {
            console.log(`[deleteColumn] Removed ${removedCount} aggregate function(s)`);
        }
        
        // If no aggregate functions remain, reset GROUP BY
        if (state.data_table.query_options.group_by.aggregate_functions.length === 0) {
            console.log('[deleteColumn] No aggregate functions remain, resetting GROUP BY');
            state.data_table.query_options.group_by = {};
        }
    }
    
    // 4. Clean up aggregate expressions
    if (state.data_table.query_options?.group_by?.aggregate_expressions?.length > 0) {
        const beforeLength = state.data_table.query_options.group_by.aggregate_expressions.length;
        state.data_table.query_options.group_by.aggregate_expressions = 
            state.data_table.query_options.group_by.aggregate_expressions.filter(aggExpr => {
                return !aggExpr.expression.includes(fullColumnRef);
            });
        
        const removedCount = beforeLength - state.data_table.query_options.group_by.aggregate_expressions.length;
        if (removedCount > 0) {
            console.log(`[deleteColumn] Removed ${removedCount} aggregate expression(s)`);
        }
    }
    
    // 5. Clean up WHERE clauses
    if (state.data_table.query_options?.where?.length > 0) {
        const beforeLength = state.data_table.query_options.where.length;
        state.data_table.query_options.where = 
            state.data_table.query_options.where.filter(whereClause => {
                return whereClause.column !== fullColumnRef;
            });
        
        const removedCount = beforeLength - state.data_table.query_options.where.length;
        if (removedCount > 0) {
            console.log(`[deleteColumn] Removed ${removedCount} WHERE clause(s)`);
        }
    }
    
    // 6. Clean up ORDER BY clauses
    if (state.data_table.query_options?.order_by?.length > 0) {
        const beforeLength = state.data_table.query_options.order_by.length;
        state.data_table.query_options.order_by = 
            state.data_table.query_options.order_by.filter(orderClause => {
                return orderClause.column !== fullColumnRef;
            });
        
        const removedCount = beforeLength - state.data_table.query_options.order_by.length;
        if (removedCount > 0) {
            console.log(`[deleteColumn] Removed ${removedCount} ORDER BY clause(s)`);
        }
    }
    
    // 7. Clean up HAVING conditions
    if (state.data_table.query_options?.group_by?.having_conditions?.length > 0) {
        const beforeLength = state.data_table.query_options.group_by.having_conditions.length;
        state.data_table.query_options.group_by.having_conditions = 
            state.data_table.query_options.group_by.having_conditions.filter(havingClause => {
                return havingClause.column !== fullColumnRef;
            });
        
        const removedCount = beforeLength - state.data_table.query_options.group_by.having_conditions.length;
        if (removedCount > 0) {
            console.log(`[deleteColumn] Removed ${removedCount} HAVING condition(s)`);
        }
    }
    
    // Execute query with cleaned-up model
    await executeQueryOnExternalDataSource();
}
function isColumnInDataModel(columnName, tableIdentifier, tableAlias = null) {
    return state.data_table.columns.some((column) => {
        const colIdentifier = column.table_alias || column.table_name;
        const checkIdentifier = tableAlias || tableIdentifier;
        return column.column_name === columnName && colIdentifier === checkIdentifier;
    });
}
function addQueryOption(queryOption) {
    if (queryOption === 'WHERE') {
        state.data_table.query_options.where.push({
            name: queryOption,
            column: '',
            column_data_type: '',
            equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
            value: '',
            condition: '',// condition: 'AND', 'OR'
        });
    } else if (queryOption === 'GROUP BY') {
        if (!state?.data_table?.query_options?.group_by?.name) {
            state.data_table.query_options.group_by.name = queryOption;
        }
        if (!state?.data_table?.query_options?.group_by?.aggregate_functions) {
            state.data_table.query_options.group_by.aggregate_functions = [{
                column: '',
                column_alias_name: '',
                aggregate_function: '',// aggregate_functions: 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX'
                use_distinct: false,
            }];
        } else {
            state.data_table.query_options.group_by.aggregate_functions.push({
                column: '',
                column_alias_name: '',
                aggregate_function: '',// aggregate_functions: 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX'
                use_distinct: false,
            });
        }

        if (!state?.data_table?.query_options?.group_by?.aggregate_expressions) {
            state.data_table.query_options.group_by.aggregate_expressions = [];
        }

        if (!state?.data_table?.query_options?.group_by?.having_conditions) {
            state.data_table.query_options.group_by.having_conditions = [{
                    column: '',
                    column_data_type: '',
                    equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
                    value: '',
                    condition: '',// condition: 'AND', 'OR'
            }]
        }
    } else if (queryOption === 'HAVING') {
        state.data_table.query_options.group_by.having_conditions.push({
                column: '',
                column_data_type: '',
                equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
                value: '',
                condition: '',// condition: 'AND', 'OR'
        })
    } else if (queryOption === 'ORDER BY') {
        state.data_table.query_options.order_by.push({
            name: queryOption,
            column: '',
            order: '',// order: 'ASC', 'DESC' 
        });
    } else if (queryOption === 'OFFSET') {
        state.data_table.query_options.offset = 0;
    } else if (queryOption === 'LIMIT') {
        state.data_table.query_options.limit = 0;
    }
    state.show_dialog = false;
}
function addAggregateExpression() {
    if (!state?.data_table?.query_options?.group_by?.aggregate_expressions) {
        state.data_table.query_options.group_by.aggregate_expressions = [];
    }
    
    state.data_table.query_options.group_by.aggregate_expressions.push({
        expression: '',
        aggregate_function: '',
        column_alias_name: '',
        use_distinct: false,
    });
}
function removeAggregateExpression(index) {
    state.data_table.query_options.group_by.aggregate_expressions.splice(index, 1);
}
function onTransformChange(element, event) {
    const selectedFunc = state.transform_functions.find(f => f.value === event.target.value);
    element.transform_close_parens = selectedFunc?.close_parens || 0;
}
function getValuePlaceholder(equalityIndex) {
    const operator = state.equality[equalityIndex];
    if (operator === 'IN' || operator === 'NOT IN') {
        return "'value1','value2','value3'";
    }
    return 'Enter value';
}
function removeQueryOption(queryOption, index) {
    if (queryOption === 'WHERE') {
        state.data_table.query_options.where.splice(index, 1);
    } else if (queryOption === 'GROUP BY') {
        if (state.data_table.query_options.group_by.aggregate_functions.length > 1) {
            state.data_table.query_options.group_by.aggregate_functions.splice(index, 1);
        } else {
            state.data_table.query_options.group_by = {};
        }
    } else if (queryOption === 'ORDER BY') {
        state.data_table.query_options.order_by.splice(index, 1);
    } else if (queryOption === 'HAVING') {
        state.data_table.query_options.group_by.having_conditions.splice(index, 1);
    } else if (queryOption === 'OFFSET') {
        state.data_table.query_options.offset = -1;
    } else if (queryOption === 'LIMIT') {
        state.data_table.query_options.limit = -1;
    }
}
function addCalculatedColumnOperation(type) {
    state.calculated_column.columns.push({
        column_name: '',
        operator: null, //the first operator will always be null
        type: type,
        numeric_value: 0,
    });
}
function deleteCalculatedColumnOperation(index) {
    if (state.calculated_column.columns.length > 1) {
        state.calculated_column.columns.splice(index, 1);
    } else {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `You must have at least one calculated column operation.`,
        });
    }
}
async function addCalculatedColumn() {
    if (state.calculated_column.column_name === '') {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please enter a name for the calculated column.`,
        });
        return;
    }
    if (state.calculated_column.columns.length === 0 || state.calculated_column.columns.filter((column) => column.column_name === '' && column.type === 'column').length > 0) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please select at least one column to the calculated column.`,
        });
        return;
    }
    if (state.calculated_column.columns.length === 0 || state.calculated_column.columns.filter((column, index) => index > 0 && column.operator === null).length > 0) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Please select at least one operator to the calculated column.`,
        });
        return;
    }
    
    // Validate aggregate usage
    const usesAggregates = state.calculated_column.columns.some(col => {
        const colInfo = numericColumnsWithAggregates.value.find(c => c.value === col.column_name);
        return colInfo && (colInfo.type === 'aggregate_function' || colInfo.type === 'aggregate_expression');
    });
    
    if (usesAggregates && !showGroupByClause.value) {
        $swal.fire({
            icon: 'error',
            title: `Error!`,
            text: `Cannot use aggregate columns in calculations without GROUP BY. Please add GROUP BY first.`,
        });
        return;
    }
    let expression = "";
    for (let i=0; i<state.calculated_column.columns.length; i++) {
        const column = state.calculated_column.columns[i];
        const operator = column.operator;
        const type = column.type;
        
        // Get the proper column reference (fully qualified for base columns, alias for aggregates)
        let columnRef = column.column_name;
        if (type === 'column') {
            const colInfo = numericColumnsWithAggregates.value.find(c => c.value === column.column_name);
            if (colInfo && colInfo.type === 'base_column') {
                // Use fully qualified name for base columns
                columnRef = `${colInfo.schema}.${colInfo.table_name}.${colInfo.column_name}`;
            }
            // For aggregates, use the alias (column.column_name is already the alias)
        }
        
        if (i === 0) {
            //the first operator will always be null, so we skip it
            expression += `${columnRef}`;
        } else {
            let value = type === 'column' ? columnRef : column.numeric_value;
            if (operator === 'ADD') {
                expression += ` + ${value}`;
            } else if (operator === 'SUBTRACT') {
                expression += ` - ${value}`;
            } else if (operator === 'MULTIPLY') {
                expression += ` * ${value}`;
            } else if (operator === 'DIVIDE') {
                expression += ` / ${value}`;
            } else if (operator === 'MODULO') {
                expression += ` % ${value}`;
            }
        }
    }
    state.data_table.calculated_columns.push({
        column_name: state.calculated_column.column_name,
        expression: `ROUND(${expression}, 2)`,
        column_data_type: state.calculated_column.column_data_type,
    });
    state.show_calculated_column_dialog = false;
    await executeQueryOnExternalDataSource();
}
async function deleteCalculatedColumn(index) {
    state.data_table.calculated_columns.splice(index, 1);
    await executeQueryOnExternalDataSource();
}
function buildSQLQuery() {
    let sqlQuery = '';
    let fromJoinClause = [];
    
    // Build table references including aliases
    // Format: "schema.table_name::alias" if aliased, "schema.table_name" if not
    let dataTables = state.data_table.columns.map((column) => {
        const tableRef = column.table_alias 
            ? `${column.schema}.${column.table_name}::${column.table_alias}`
            : `${column.schema}.${column.table_name}`;
        return tableRef;
    });
    
    console.log('[Data Model Builder - buildSQLQuery] Initial dataTables from columns:', dataTables);
    console.log('[Data Model Builder - buildSQLQuery] Total columns:', state.data_table.columns.length);
    console.log('[Data Model Builder - buildSQLQuery] Columns with aliases:', JSON.stringify(state.data_table.columns.map(c => ({
        table: c.table_name,
        alias: c.table_alias,
        column: c.column_name
    })), null, 2));
  
    let fromJoinClauses = [];
    const tableCombinations = [];
    dataTables = _.uniq(dataTables);
    console.log('[Data Model Builder - buildSQLQuery] Unique dataTables (with aliases):', dataTables);
    console.error('[DEBUG] dataTables.length:', dataTables.length, 'Tables:', dataTables);
    if (dataTables.length === 1) {
        // Single table (possibly aliased)
        const tableRef = dataTables[0];
        const hasAlias = tableRef.includes('::');
        
        if (hasAlias) {
            const [schemaTable, alias] = tableRef.split('::');
            fromJoinClause.push(`FROM ${schemaTable} AS ${alias}`);
        } else {
            fromJoinClause.push(`FROM ${tableRef}`);
        }
        
        sqlQuery = `SELECT ${state.data_table.columns.filter((column) => column.is_selected_column).map((column) => {
            const tableName = column.table_name.length > 20 ? column.table_name.slice(-20) : column.table_name;
            const tableRef = column.table_alias || tableName;
            const aliasName = column?.alias_name !== '' ? column.alias_name : `${tableRef}_${column.column_name}`;
            const columnRef = column.table_alias 
                ? `${column.schema}.${column.table_alias}.${column.column_name}`
                : `${column.schema}.${column.table_name}.${column.column_name}`;
            return `${columnRef} AS ${aliasName}`;
        }).join(', ')}`;
    } else {
        for (let i = 0; i < dataTables.length; i++) {
            for (let j = 0; j < dataTables.length; j++) {
                if (dataTables[i] !== dataTables[j]) {
                    tableCombinations.push(`${dataTables[i]}-${dataTables[j]}`);
                }
            }
        }
        const relationshipReferences = state.tables.filter((table) => {
            return table.references.length > 0
        }).map((table) => table.references);
        console.log('[Data Model Builder - buildSQLQuery] state.tables:', state.tables.length);
        console.log('[Data Model Builder - buildSQLQuery] state.tables sample:', state.tables.slice(0, 3));
        console.log('[Data Model Builder - buildSQLQuery] relationshipReferences:', relationshipReferences);
        console.log('[Data Model Builder - buildSQLQuery] tableCombinations:', tableCombinations);
        relationshipReferences.forEach((references) => {
            references.forEach((reference) => {
                const tableCombinationString = `${reference.local_table_schema}.${reference.local_table_name}-${reference.foreign_table_schema}.${reference.foreign_table_name}`;
                if (tableCombinations.includes(tableCombinationString)) {
                    fromJoinClauses.push(reference);
                }
            });
        });
        console.log('[Data Model Builder - buildSQLQuery] fromJoinClauses after relationship matching:', fromJoinClauses);

        // If no relationships found from metadata, try to infer them from column names
        if (fromJoinClauses.length === 0 && dataTables.length > 1) {
            console.log('[Data Model Builder - buildSQLQuery] No FK relationships found, attempting to infer from column names');
            
            // Try to find common columns between tables that might be foreign keys
            for (let i = 0; i < dataTables.length; i++) {
                for (let j = i + 1; j < dataTables.length; j++) {
                    const table1 = dataTables[i];
                    const table2 = dataTables[j];
                    
                    // Get columns for each table
                    const table1Columns = state.data_table.columns
                        .filter(col => `${col.schema}.${col.table_name}` === table1)
                        .map(col => col.column_name);
                    const table2Columns = state.data_table.columns
                        .filter(col => `${col.schema}.${col.table_name}` === table2)
                        .map(col => col.column_name);
                    
                    // Find common column names (likely foreign keys)
                    const commonColumns = table1Columns.filter(col => table2Columns.includes(col));
                    
                    if (commonColumns.length > 0) {
                        // Use the first common column as join key
                        const joinColumn = commonColumns[0];
                        const [schema1, tableName1] = table1.split('.');
                        const [schema2, tableName2] = table2.split('.');
                        
                        fromJoinClauses.push({
                            local_table_schema: schema1,
                            local_table_name: tableName1,
                            local_column_name: joinColumn,
                            foreign_table_schema: schema2,
                            foreign_table_name: tableName2,
                            foreign_column_name: joinColumn
                        });
                        
                        console.log(`[Data Model Builder - buildSQLQuery] Inferred relationship: ${table1}.${joinColumn} = ${table2}.${joinColumn}`);
                    }
                }
            }
        }

        // Detect orphaned tables (tables with no relationships to other selected tables)
        const tablesInJoins = new Set();
        fromJoinClauses.forEach(clause => {
            tablesInJoins.add(`${clause.local_table_schema}.${clause.local_table_name}`);
            tablesInJoins.add(`${clause.foreign_table_schema}.${clause.foreign_table_name}`);
        });

        const orphanedTables = dataTables.filter(table => !tablesInJoins.has(table));
        console.log('[Data Model Builder - buildSQLQuery] Orphaned tables:', orphanedTables);
        if (orphanedTables.length > 0) {
            const orphanedAlert = {
                type: 'error',
                message: `Cannot create data model: The following tables have no foreign key relationships to other selected tables: ${orphanedTables.join(', ')}. Please remove columns from unrelated tables or select tables with defined relationships.`
            };
            console.error('[Data Model Builder - buildSQLQuery] ORPHANED TABLE ERROR:', orphanedAlert.message);
            if (!state.alerts.find(a => a.type === 'error' && a.message.includes('no foreign key relationships'))) {
                state.alerts.push(orphanedAlert);
            }
        } else {
            // Remove orphaned table error if it exists and no longer applies
            state.alerts = state.alerts.filter(a => !(a.type === 'error' && a.message.includes('no foreign key relationships')));
        }

        /**
         * Reordering the fromJoinClauses using topological sort to ensure proper JOIN order.
         * A table can only be joined if all tables it references are already in the FROM clause.
         */
        const sortedClauses = [];
        const addedTables = new Set();
        const clausesToProcess = [...fromJoinClauses];
        
        // Keep processing until all clauses are added or we detect a circular dependency
        let lastCount = -1;
        while (clausesToProcess.length > 0 && lastCount !== clausesToProcess.length) {
            lastCount = clausesToProcess.length;
            
            for (let i = clausesToProcess.length - 1; i >= 0; i--) {
                const clause = clausesToProcess[i];
                const localTable = `${clause.local_table_schema}.${clause.local_table_name}`;
                const foreignTable = `${clause.foreign_table_schema}.${clause.foreign_table_name}`;
                
                // Check if both tables referenced in this join are available
                // A table is available if: it's in addedTables OR it will be added by this clause
                const localAvailable = addedTables.has(localTable);
                const foreignAvailable = addedTables.has(foreignTable);
                
                // We can add this clause if at least one of the tables is already available
                if (localAvailable || foreignAvailable || addedTables.size === 0) {
                    sortedClauses.push(clause);
                    addedTables.add(localTable);
                    addedTables.add(foreignTable);
                    clausesToProcess.splice(i, 1);
                }
            }
        }
        
        // If there are still unprocessed clauses, add them anyway (circular dependency case)
        sortedClauses.push(...clausesToProcess);
        fromJoinClauses = sortedClauses;
        // Helper function to find alias for a table in selected columns
        const getTableAlias = (schema, tableName) => {
            const col = state.data_table.columns.find(c => 
                c.schema === schema && c.table_name === tableName && c.table_alias
            );
            return col?.table_alias || null;
        };
        
        fromJoinClauses.forEach((clause, index) => {
            // Get aliases if they exist
            const localAlias = clause.local_table_alias || getTableAlias(clause.local_table_schema, clause.local_table_name);
            const foreignAlias = clause.foreign_table_alias || getTableAlias(clause.foreign_table_schema, clause.foreign_table_name);
            
            // Build table references with AS clauses if aliased
            const localTableFull = `${clause.local_table_schema}.${clause.local_table_name}`;
            const foreignTableFull = `${clause.foreign_table_schema}.${clause.foreign_table_name}`;
            
            const localTableSQL = localAlias ? `${localTableFull} AS ${localAlias}` : localTableFull;
            const foreignTableSQL = foreignAlias ? `${foreignTableFull} AS ${foreignAlias}` : foreignTableFull;
            
            // For ON conditions, use alias if it exists, otherwise use table name
            const localRef = localAlias || clause.local_table_name;
            const foreignRef = foreignAlias || clause.foreign_table_name;
            
            if (index === 0) {
                fromJoinClause.push(`FROM ${localTableSQL}`)
                fromJoinClause.push(`JOIN ${foreignTableSQL}`)
                fromJoinClause.push(`ON ${clause.local_table_schema}.${localRef}.${clause.local_column_name} = ${clause.foreign_table_schema}.${foreignRef}.${clause.foreign_column_name}`)
            } else {
                // More precise table existence check - both tables must be added independently
                const localTableRef = localAlias 
                    ? `${localTableFull} AS ${localAlias}`
                    : localTableFull;
                const foreignTableRef = foreignAlias
                    ? `${foreignTableFull} AS ${foreignAlias}`
                    : foreignTableFull;

                // Check if table (with or without alias) already exists
                const localTableExists = fromJoinClause.some(entry => 
                    entry.includes(`FROM ${localTableFull}`) || entry.includes(`JOIN ${localTableFull}`)
                );
                const foreignTableExists = fromJoinClause.some(entry => 
                    entry.includes(`FROM ${foreignTableFull}`) || entry.includes(`JOIN ${foreignTableFull}`)
                );

                // Determine which table to JOIN (the one that doesn't exist yet)
                // The ON clause will reference both tables
                let needsNewJoin = false;
                
                if (!localTableExists && !foreignTableExists) {
                    // Neither table exists - add the foreign table (it will be the new join target)
                    fromJoinClause.push(`JOIN ${foreignTableSQL}`);
                    needsNewJoin = true;
                } else if (!localTableExists) {
                    // Only local table missing - add it
                    fromJoinClause.push(`JOIN ${localTableSQL}`);
                    needsNewJoin = true;
                } else if (!foreignTableExists) {
                    // Only foreign table missing - add it
                    fromJoinClause.push(`JOIN ${foreignTableSQL}`);
                    needsNewJoin = true;
                }
                
                // Add the ON/AND condition using aliases if available
                const joinCondition = `${clause.local_table_schema}.${localRef}.${clause.local_column_name} = ${clause.foreign_table_schema}.${foreignRef}.${clause.foreign_column_name}`;
                
                if (needsNewJoin) {
                    // New table was added, use ON
                    fromJoinClause.push(`ON ${joinCondition}`);
                } else {
                    // Both tables already exist, add as additional condition with AND
                    if (!fromJoinClause.includes(`ON ${joinCondition}`) && !fromJoinClause.includes(`AND ${joinCondition}`)) {
                        fromJoinClause.push(`AND ${joinCondition}`);
                    }
                }
            }
        });
        console.log('[Data Model Builder - buildSQLQuery] Final fromJoinClause array:', fromJoinClause);

        sqlQuery = `SELECT ${state.data_table.columns.filter((column) => column.is_selected_column).map((column) => {
            const tableRef = column.table_alias || column.table_name;
            const aliasName = column?.alias_name !== '' ? column.alias_name : `${column.schema}_${tableRef}_${column.column_name}`;
            
            // Use table alias in column reference if it exists
            let columnRef = column.table_alias
                ? `${column.schema}.${column.table_alias}.${column.column_name}`
                : `${column.schema}.${column.table_name}.${column.column_name}`;
            
            if (column.transform_function) {
                const closeParens = ')'.repeat(column.transform_close_parens || 1);
                columnRef = `${column.transform_function}(${columnRef}${closeParens}`;
            }
            
            return `${columnRef} AS ${aliasName}`;
        }).join(', ')}`;
    }
    state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggregate_function) => {
        if (aggregate_function.aggregate_function !== '' && aggregate_function.column !== '') {
            const distinctKeyword = aggregate_function.use_distinct ? 'DISTINCT ' : '';
            const aggregateFunc = state.aggregate_functions[aggregate_function.aggregate_function];
            
            // Generate default alias if none provided
            let aliasName = aggregate_function.column_alias_name;
            if (!aliasName || aliasName === '') {
                const columnParts = aggregate_function.column.split('.');
                const columnName = columnParts[columnParts.length - 1];
                aliasName = `${aggregateFunc.toLowerCase()}_${columnName}`;
            }
            
            sqlQuery += `, ${aggregateFunc}(${distinctKeyword}${aggregate_function.column}) AS ${aliasName}`;
        }
    });

    state?.data_table?.query_options?.group_by?.aggregate_expressions?.forEach((agg_expr) => {
        if (agg_expr.aggregate_function !== '' && agg_expr.expression !== '') {
            const distinctKeyword = agg_expr.use_distinct ? 'DISTINCT ' : '';
            const aliasName = agg_expr?.column_alias_name !== '' ? ` AS ${agg_expr.column_alias_name}` : '';
            sqlQuery += `, ${state.aggregate_functions[agg_expr.aggregate_function]}(${distinctKeyword}${agg_expr.expression})${aliasName}`;
        }
    });

    // Add calculated columns AFTER aggregates so they can reference aggregate aliases
    if (state?.data_table?.calculated_columns?.length) {
        state.data_table.calculated_columns.forEach((column) => {
            // Replace aggregate aliases with full aggregate expressions for PostgreSQL compatibility
            let finalExpression = column.expression;
            
            // Replace aggregate function aliases
            state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggFunc) => {
                if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                    const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                    const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;
                    const distinctKeyword = aggFunc.use_distinct ? 'DISTINCT ' : '';
                    const fullExpression = `${funcName}(${distinctKeyword}${aggFunc.column})`;
                    
                    // Replace all occurrences of the alias with the full expression
                    const aliasRegex = new RegExp(`\\b${aliasName}\\b`, 'g');
                    finalExpression = finalExpression.replace(aliasRegex, fullExpression);
                }
            });
            
            // Replace aggregate expression aliases
            state?.data_table?.query_options?.group_by?.aggregate_expressions?.forEach((aggExpr) => {
                if (aggExpr.aggregate_function !== '' && aggExpr.expression !== '') {
                    const funcName = state.aggregate_functions[aggExpr.aggregate_function];
                    const aliasName = aggExpr.column_alias_name;
                    if (aliasName) {
                        const distinctKeyword = aggExpr.use_distinct ? 'DISTINCT ' : '';
                        const fullExpression = `${funcName}(${distinctKeyword}${aggExpr.expression})`;
                        
                        // Replace all occurrences of the alias with the full expression
                        const aliasRegex = new RegExp(`\\b${aliasName}\\b`, 'g');
                        finalExpression = finalExpression.replace(aliasRegex, fullExpression);
                    }
                }
            });
            
            sqlQuery += `, ${finalExpression} AS ${column.column_name}`;
        })
    }

    sqlQuery += ` ${fromJoinClause.join(' ')}`;

    //determining whether to save the value with single quotes or not depending on the data type of the column
    state.data_table.query_options.where.forEach((clause) => {
        if (clause.column !=='' && clause.equality !== '' && clause.value !== '') {
            const operator = state.equality[clause.equality];
            let value;
            
            if (operator === 'IN' || operator === 'NOT IN') {
                value = `(${clause.value})`; // User enters: 'val1','val2','val3'
            } else {
                value = getColumValue(clause.value, clause.column_data_type);
            }
            
            if (clause.condition === '') {
                //first WHERE clause
                sqlQuery += ` WHERE ${clause.column} ${operator} ${value}`;
            } else {
                sqlQuery += ` ${state.condition[clause.condition]} ${clause.column} ${operator} ${value}`;
            }
        }
    });
    if (showGroupByClause.value) {
        // Use group_by_columns if available (AI-generated string array), otherwise build from selected columns
        const groupByColumns = state.data_table.query_options?.group_by?.group_by_columns?.length > 0
            ? state.data_table.query_options.group_by.group_by_columns
            : state.data_table.columns.filter((column) => column.is_selected_column).map((column) => {
                let columnRef = `${column.schema}.${column.table_name}.${column.column_name}`;
                
                if (column.transform_function) {
                    const closeParens = ')'.repeat(column.transform_close_parens || 1);
                    columnRef = `${column.transform_function}(${columnRef}${closeParens}`;
                }
                
                return columnRef;
            });
        
        sqlQuery += ` GROUP BY ${groupByColumns.join(', ')}`;
        state?.data_table?.query_options?.group_by?.having_conditions?.forEach((clause) => {
            let value = getColumValue(clause.value, clause.column_data_type);
            if (clause.column !=='' && clause.equality !== '' && clause.value !== '') {
                if (clause.condition === '') {
                    //first HAVING clause
                    sqlQuery += ` HAVING ${clause.column} ${state.equality[clause.equality]} ${value}`;
                } else {
                    sqlQuery += ` ${state.condition[clause.condition]} ${clause.column} ${state.equality[clause.equality]} ${value}`;
                }
            }
        });
    }    
    state.data_table.query_options.order_by.forEach((clause, index) => {
        if (clause.column !== '' && clause.order !== '') {
            let orderByColumn = clause.column;
            
            // Check if this is a base column with a transform function
            const baseColumn = state.data_table.columns.find(col => 
                `${col.schema}.${col.table_name}.${col.column_name}` === clause.column
            );
            
            if (baseColumn && baseColumn.transform_function) {
                // Use the transformed column expression
                const closeParens = ')'.repeat(baseColumn.transform_close_parens || 1);
                orderByColumn = `${baseColumn.transform_function}(${clause.column}${closeParens}`;
            } else {
                // Check if this is an aggregate alias
                const isAggregateAlias = 
                    state.data_table.query_options?.group_by?.aggregate_functions?.some(aggFunc => {
                        if (aggFunc.aggregate_function !== '' && aggFunc.column !== '') {
                            const funcName = state.aggregate_functions[aggFunc.aggregate_function];
                            const aliasName = aggFunc.column_alias_name || `${funcName.toLowerCase()}_${aggFunc.column.split('.').pop()}`;
                            return aliasName === clause.column;
                        }
                        return false;
                    }) ||
                    state.data_table.query_options?.group_by?.aggregate_expressions?.some(aggExpr => {
                        return aggExpr.column_alias_name === clause.column;
                    });
                
                // If it's an aggregate alias, keep it as-is (PostgreSQL allows aliases in ORDER BY)
                // Otherwise, it's a regular column reference
            }
            
            if (index === 0) {
                sqlQuery += ` ORDER BY ${orderByColumn} ${state.order[clause.order]}`;
            } else {
                sqlQuery += `, ${orderByColumn} ${state.order[clause.order]}`;
            } 
        }
    });
    
    console.log('[Data Model Builder - buildSQLQuery] FINAL SQL QUERY:', sqlQuery);
    return sqlQuery;
}
async function saveDataModel() {
    let offsetStr = 'OFFSET 0';
    let limitStr = 'LIMIT 5';
    let sqlQuery = buildSQLQuery();

    if (state.data_table.query_options.offset > -1) {
        offsetStr = `OFFSET ${state.data_table.query_options.offset}`;
    } else {
        offsetStr = 'OFFSET 0';
    }
    if (state.data_table.query_options.limit > -1) {
        limitStr = `LIMIT ${state.data_table.query_options.limit}`;
    } else {
        limitStr = 'LIMIT 1000';
    }
    sqlQuery += ` ${limitStr} ${offsetStr}`;
    state.sql_query = sqlQuery;
    $swal.fire({
        icon: 'success',
        title: `Generated SQL Query!`,
        text: sqlQuery,
    });
    const { value: confirmDelete } = await $swal.fire({
        icon: "success",
        title: "SQL Query Generated!",
        html: `Your SQL query has been generated and is a follows:<br /><br /> <span style='font-weight: bold;'>${sqlQuery}</span><br /><br /> Do you want to proceed with this SQL query to build your data model?`,
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, build my model now!",
    });
    if (!confirmDelete) {
        return;
    }
    //build the data model
    const token = getAuthToken();
    let url = `${baseUrl()}/data-source/build-data-model-on-query`;
    if (props.isEditDataModel) {
        url = `${baseUrl()}/data-model/update-data-model-on-query`;
    }
    
    // Filter to only include selected columns in the query JSON
    const dataTableForSave = {
        ...state.data_table,
        columns: state.data_table.columns.filter(col => col.is_selected_column)
    };
    
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
        body: JSON.stringify({
            data_source_id: route.params.datasourceid,
            query: state.sql_query,
            query_json: JSON.stringify(dataTableForSave),
            data_model_name: state.data_table.table_name,
            data_model_id: props.isEditDataModel ? props.dataModel.id : null,
        })
    });
    
    const responseData = await response.json();
    
    if (response.status === 200) {
        // Save AI conversation if one exists
        if (aiDataModelerStore.conversationId && aiDataModelerStore.messages.length > 0) {
            try {
                const dataModelId = props.isEditDataModel 
                    ? props.dataModel.id 
                    : responseData.data_model_id;
                
                if (dataModelId) {
                    // Ensure currentDataSourceId is set before saving (it should be from initializeConversation)
                    // But set it as fallback in case the drawer was closed
                    if (!aiDataModelerStore.currentDataSourceId) {
                        aiDataModelerStore.currentDataSourceId = Number(route.params.datasourceid);
                    }
                    
                    console.log('Saving AI conversation with:', {
                        dataSourceId: aiDataModelerStore.currentDataSourceId,
                        dataModelId,
                        title: state.data_table.table_name || 'AI Generated Model',
                        messagesCount: aiDataModelerStore.messages.length
                    });
                    
                    const saved = await aiDataModelerStore.saveConversation(
                        dataModelId,
                        state.data_table.table_name || 'AI Generated Model'
                    );
                    
                    if (saved) {
                        console.log('AI conversation saved successfully');
                    } else {
                        console.warn('AI conversation save returned false');
                    }
                }
            } catch (error) {
                // Log error but don't block the data model save success
                console.error('Failed to save AI conversation:', error);
            }
        } else {
            console.log('No AI conversation to save:', {
                hasConversationId: !!aiDataModelerStore.conversationId,
                messagesCount: aiDataModelerStore.messages.length
            });
        }
        
        // enableRefreshDataFlag('clearDataModels');
        router.push(`/projects/${route.params.projectid}/data-sources/${route.params.datasourceid}/data-models`);
    } else {
        $swal.fire({
            icon: 'error',
            title: `Error! `,
            text: 'Unfortunately, we encountered an error! Please refresh the page and try again.',
        });
    }
}
async function executeQueryOnExternalDataSource() {
    state.response_from_external_data_source_columns = [];
    state.response_from_external_data_source_rows = [];
    state.sql_query = buildSQLQuery();
    state.sql_query += ` LIMIT 5 OFFSET 0`;
    console.log('[Data Model Builder - executeQueryOnExternalDataSource] SQL Query being sent:', state.sql_query);
    const token = getAuthToken();
    const url = `${baseUrl()}/data-source/execute-query-on-external-data-source`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
        body: JSON.stringify({
            data_source_id: route.params.datasourceid,
            query: state.sql_query,
        })
    });
    
    // Check if response has content before parsing JSON
    if (!response.ok || response.status === 204) {
        console.warn('[Data Model Builder] Query execution returned no content or error:', response.status);
        return;
    }
    
    const text = await response.text();
    if (!text) {
        console.warn('[Data Model Builder] Query execution returned empty response');
        return;
    }
    
    const data = JSON.parse(text);
    if (data && data.length) {
        // Check for array values in result (indicates potential cartesian product)
        const hasArrayValues = data.some(row => 
            Object.values(row).some(value => Array.isArray(value))
        );
        
        if (hasArrayValues) {
            const errorAlert = {
                type: 'error',
                message: 'The query result contains array values, which may indicate a cartesian product or improper join. Please review your table and column selections.'
            };
            if (!state.alerts.find(a => a.type === 'error' && a.message.includes('array values'))) {
                state.alerts.push(errorAlert);
            }
        } else {
            // Remove array error if it exists and no longer applies
            state.alerts = state.alerts.filter(a => !(a.type === 'error' && a.message.includes('array values')));
        }
        
        const columns = Object.keys(data[0]);
        state.response_from_external_data_source_columns = columns;
        state.response_from_external_data_source_rows = data;
    }
}
async function toggleColumnInDataModel(column, tableName, tableAlias = null) {
    const identifier = tableAlias || tableName;
    
    if (isColumnInDataModel(column.column_name, tableName, tableAlias)) {
        // Remove
        state.data_table.columns = state.data_table.columns.filter((c) => {
            const colIdentifier = c.table_alias || c.table_name;
            return !(c.column_name === column.column_name && colIdentifier === identifier);
        });
        if (state.data_table.columns.length === 0) {
            state.data_table.query_options.where = [];
            state.data_table.query_options.group_by = {};
            state.data_table.query_options.order_by = [];
            state.data_table.query_options.offset = -1;
            state.data_table.query_options.limit = -1;
        }
        await executeQueryOnExternalDataSource();
    } else {
        // Add
        const newColumn = _.cloneDeep(column);
        newColumn.table_name = tableName;
        newColumn.table_alias = tableAlias;
        newColumn.display_name = tableAlias 
            ? `${tableAlias}.${column.column_name}` 
            : `${tableName}.${column.column_name}`;
        newColumn.is_selected_column = true;
        newColumn.alias_name = "";
        newColumn.transform_function = '';
        newColumn.transform_close_parens = 0;
        
        state.data_table.columns.push(newColumn);
        await executeQueryOnExternalDataSource();
    }
}

/**
 * Apply AI-generated data model to the builder
 */
async function applyAIGeneratedModel(model) {
    try {
        console.log('[Data Model Builder] Applying AI-generated model:', model);
        
        // Handle array of models (take first one, or latest)
        let modelToApply = model;
        if (Array.isArray(model)) {
            if (model.length === 0) {
                $swal.fire({
                    title: 'No Model Found',
                    text: 'The AI response does not contain any data models.',
                    icon: 'warning'
                });
                return;
            }
            console.log(`[Data Model Builder] Multiple models detected (${model.length}), using the first one`);
            modelToApply = model[0];
        }
        
        // Validate and transform AI model to match builder structure
        const transformedModel = validateAndTransformAIModel(modelToApply);
        
        if (!transformedModel) {
            // Error already shown in validateAndTransformAIModel
            return;
        }
        
        // Store previous state for potential undo
        const previousModel = JSON.parse(JSON.stringify(state.data_table));
        
        try {
            // Clear existing model first to ensure clean replacement
            console.log('[Data Model Builder] Clearing existing model before applying new one');
            
            // Reset to default empty state
            state.data_table.table_name = '';
            state.data_table.columns = [];
            state.data_table.calculated_columns = [];
            state.data_table.query_options = {
                where: [],
                group_by: {
                    columns: [],
                    aggregate_functions: [],
                    aggregate_expressions: [],
                    having_conditions: [],
                    name: false
                },
                order_by: [],
                offset: -1,
                limit: 1000
            };
            
            // Now apply the new model - use Object.assign to maintain reactivity
            Object.assign(state.data_table, transformedModel);
            
            // Wait for DOM update to complete
            await nextTick();
            
            // Switch to advanced view if model has advanced features
            if (hasAdvancedFields()) {
                state.viewMode = 'advanced';
            }
            
            // Execute query to populate preview
            await executeQueryOnExternalDataSource();
            
            // Success notification
            $swal.fire({
                title: 'Applied!',
                text: 'AI data model has been applied successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
        } catch (queryError) {
            console.error('[Data Model Builder] Error executing query after model application:', queryError);
            
            // Revert to previous state
            state.data_table = previousModel;
            
            $swal.fire({
                title: 'Query Execution Failed',
                text: 'The model was applied but the query could not be executed. Model has been reverted.',
                icon: 'error',
                confirmButtonText: 'Understood'
            });
        }
        
    } catch (error) {
        console.error('[Data Model Builder] Unexpected error applying AI model:', error);
        $swal.fire({
            title: 'Unexpected Error',
            text: `Failed to apply AI-generated model: ${error.message || 'Unknown error'}`,
            icon: 'error'
        });
    }
}

/**
 * Validate and transform AI model to builder format
 */
function validateAndTransformAIModel(aiModel) {
    const errors = [];
    
    try {
        // Validate model structure
        if (!aiModel) {
            errors.push('AI model is empty or undefined');
            throw new Error('Empty model');
        }
        
        // Validate required fields
        if (!aiModel.table_name) {
            errors.push('Missing table_name');
        }
        
        if (!aiModel.columns) {
            errors.push('Missing columns array');
        } else if (!Array.isArray(aiModel.columns)) {
            errors.push('Columns is not an array');
        } else if (aiModel.columns.length === 0) {
            errors.push('No columns specified');
        }
        
        // If critical errors exist, show detailed message
        if (errors.length > 0) {
            console.error('[Data Model Builder] Validation errors:', errors);
            $swal.fire({
                title: 'Invalid AI Model',
                html: `<div class="text-left"><p class="mb-2">The AI-generated model has the following issues:</p><ul class="list-disc pl-5">${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`,
                icon: 'error',
                confirmButtonText: 'Understood'
            });
            return null;
        }
        
        // STEP 1: Detect and transform column format
        // AI-generated models may use fully-qualified column names (schema.table.column)
        // while the builder expects separate fields (schema, table_name, column_name)
        console.log('[Data Model Builder] Raw columns from AI:', JSON.stringify(aiModel.columns, null, 2));
        
        const transformedColumns = aiModel.columns.map((col, index) => {
            // Check if column uses fully-qualified format (schema.table.column)
            if (col.column && typeof col.column === 'string' && !col.column_name) {
                const parts = col.column.split('.');
                
                if (parts.length === 3) {
                    // Parse: schema.table.column
                    console.log(`[Data Model Builder] Transforming column ${index + 1}: ${col.column} → {schema: ${parts[0]}, table: ${parts[1]}, column: ${parts[2]}}`);
                    return {
                        schema: parts[0],
                        table_name: parts[1],
                        column_name: parts[2],
                        data_type: col.data_type || 'text',
                        is_selected_column: col.is_selected_column ?? true,
                        alias_name: col.alias_name || '',
                        transform_function: col.transform_function || '',
                        character_maximum_length: col.character_maximum_length || null,
                        reference: {
                            foreign_table_schema: '',
                            foreign_table_name: '',
                            foreign_column_name: '',
                            local_table_name: '',
                            local_column_name: ''
                        }
                    };
                } else if (parts.length === 2) {
                    // Parse: table.column (assume default schema from model)
                    console.log(`[Data Model Builder] Transforming column ${index + 1}: ${col.column} → {table: ${parts[0]}, column: ${parts[1]}}`);
                    return {
                        schema: aiModel.schema || 'public',
                        table_name: parts[0],
                        column_name: parts[1],
                        data_type: col.data_type || 'text',
                        is_selected_column: col.is_selected_column ?? true,
                        alias_name: col.alias_name || '',
                        transform_function: col.transform_function || '',
                        character_maximum_length: col.character_maximum_length || null,
                        reference: {
                            foreign_table_schema: '',
                            foreign_table_name: '',
                            foreign_column_name: '',
                            local_table_name: '',
                            local_column_name: ''
                        }
                    };
                } else {
                    console.warn(`[Data Model Builder] Column ${index + 1} has invalid format: ${col.column}`);
                    return null;
                }
            }
            
            // Column already in builder format - return as is
            return col;
        }).filter(col => col !== null);
        
        console.log('[Data Model Builder] Transformed columns:', transformedColumns.length);
        
        // Replace original columns with transformed ones
        aiModel.columns = transformedColumns;
        
        // STEP 1.5: Detect and validate reflexive relationships (self-joins)
        const tableUsageCounts = {};
        aiModel.columns.forEach(col => {
            const key = `${col.schema}.${col.table_name}`;
            tableUsageCounts[key] = (tableUsageCounts[key] || 0) + 1;
        });
        
        // Check if any table appears multiple times (potential reflexive relationship)
        const reflexiveTables = Object.entries(tableUsageCounts).filter(([_, count]) => count > 1);
        
        if (reflexiveTables.length > 0) {
            console.log('[Data Model Builder] Detected potential self-referencing tables:', reflexiveTables);
            
            reflexiveTables.forEach(([tableKey, count]) => {
                // Verify all instances have distinct aliases
                const columnsForTable = aiModel.columns.filter(
                    col => `${col.schema}.${col.table_name}` === tableKey
                );
                
                const aliases = columnsForTable.map(col => col.table_alias).filter(Boolean);
                const uniqueAliases = new Set(aliases);
                
                // If table appears multiple times but has fewer unique aliases than instances
                if (uniqueAliases.size > 0 && uniqueAliases.size < 2 && count > 1) {
                    errors.push(
                        `Self-referencing table ${tableKey} requires unique aliases for each usage, ` +
                        `but found insufficient aliases (${uniqueAliases.size} unique aliases, ${count} total usages). ` +
                        `Each instance should have a distinct table_alias like "employees" and "managers".`
                    );
                }
                
                // Auto-create table aliases if AI provided them
                if (uniqueAliases.size >= 2) {
                    console.log(`[Data Model Builder] Self-join detected for ${tableKey} with aliases:`, Array.from(uniqueAliases));
                    
                    // Ensure aliases are registered in state
                    uniqueAliases.forEach(alias => {
                        const [schema, tableName] = tableKey.split('.');
                        
                        // Check if alias already exists
                        const aliasExists = state.table_aliases.some(a => 
                            a.schema === schema && a.original_table === tableName && a.alias === alias
                        );
                        
                        if (!aliasExists) {
                            console.log(`[Data Model Builder] Auto-registering alias "${alias}" for ${tableKey}`);
                            state.table_aliases.push({
                                schema,
                                original_table: tableName,
                                alias
                            });
                        }
                    });
                }
            });
        }
        
        // If errors were found, display them
        if (errors.length > 0) {
            console.error('[Data Model Builder] Validation errors after alias check:', errors);
            $swal.fire({
                title: 'Invalid AI Model',
                html: `<div class="text-left"><p class="mb-2">The AI-generated model has the following issues:</p><ul class="list-disc pl-5">${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`,
                icon: 'error',
                confirmButtonText: 'Understood'
            });
            return null;
        }
        
        // STEP 2: Validate and fix each column
        const validColumns = [];
        const columnErrors = [];
        
        console.log('[DEBUG - AI Model Validation] Available tables in state:', state.tables?.length || 0);
        state.tables?.forEach(t => {
            console.log(`  - ${t.table_name} (${t.schema}): ${t.columns?.length || 0} columns`);
            console.log(`    Columns:`, t.columns?.map(c => c.column_name).join(', '));
        });
        
        for (let i = 0; i < aiModel.columns.length; i++) {
            const col = aiModel.columns[i];
            const colIndex = i + 1;
            
            console.log(`[DEBUG - AI Model Validation] Validating column ${colIndex}:`, {
                schema: col.schema,
                table_name: col.table_name,
                column_name: col.column_name
            });
            
            if (!col.schema) {
                columnErrors.push(`Column ${colIndex} (${col.column_name || col.column || 'unknown'}): Missing schema`);
                continue;
            }
            if (!col.table_name) {
                columnErrors.push(`Column ${colIndex} (${col.column_name || col.column || 'unknown'}): Missing table_name`);
                continue;
            }
            if (!col.column_name) {
                columnErrors.push(`Column ${colIndex} (${col.column || 'unknown'}): Missing column_name`);
                continue;
            }
            
            // Check if this column exists in the available tables
            const availableTables = state.tables || [];
            const sourceTable = availableTables.find(t => 
                t.table_name === col.table_name && t.schema === col.schema
            );
            
            if (!sourceTable) {
                console.warn(`[DEBUG - AI Model Validation] ⚠️ Table not found: ${col.schema}.${col.table_name}`);
                columnErrors.push(`Column ${colIndex}: Table ${col.schema}.${col.table_name} does not exist in data source`);
                continue;
            }
            
            const columnExists = sourceTable.columns?.some(c => c.column_name === col.column_name);
            if (!columnExists) {
                console.warn(`[DEBUG - AI Model Validation] ⚠️ Column not found: ${col.column_name} in table ${sourceTable.table_name}`);
                console.warn(`[DEBUG - AI Model Validation] Available columns in ${sourceTable.table_name}:`, 
                    sourceTable.columns?.map(c => c.column_name).join(', ')
                );
                columnErrors.push(`Column ${colIndex}: ${col.column_name} does not exist in table ${col.table_name}`);
                continue;
            }
            
            // Ensure required fields exist with defaults
            col.is_selected_column = col.is_selected_column ?? true;
            col.alias_name = col.alias_name || '';
            col.transform_function = col.transform_function || '';
            col.character_maximum_length = col.character_maximum_length || null;
            col.data_type = col.data_type || 'text';
            
            // Initialize reference if not present
            if (!col.reference) {
                col.reference = {
                    foreign_table_schema: '',
                    foreign_table_name: '',
                    foreign_column_name: '',
                    local_table_name: '',
                    local_column_name: ''
                };
            }
            
            validColumns.push(col);
        }
        
        // If some columns had errors but we have valid ones, continue with warning
        if (columnErrors.length > 0 && validColumns.length > 0) {
            console.warn('[Data Model Builder] Column validation warnings:', columnErrors);
            $swal.fire({
                title: 'Model Applied with Warnings',
                html: `<div class="text-left"><p class="mb-2">Some columns were skipped due to errors:</p><ul class="list-disc pl-5">${columnErrors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}${columnErrors.length > 5 ? `<li>...and ${columnErrors.length - 5} more</li>` : ''}</ul></div>`,
                icon: 'warning',
                timer: 4000
            });
        } else if (validColumns.length === 0) {
            $swal.fire({
                title: 'No Valid Columns',
                text: 'All columns in the AI model have validation errors. Cannot apply model.',
                icon: 'error'
            });
            return null;
        }
        
        aiModel.columns = validColumns;
        
        // Initialize query_options with validation
        if (!aiModel.query_options) {
            aiModel.query_options = {
                where: [],
                group_by: {},
                order_by: [],
                offset: -1,
                limit: -1
            };
        } else {
            // Validate and sanitize query_options
            aiModel.query_options.where = Array.isArray(aiModel.query_options.where) ? aiModel.query_options.where : [];
            aiModel.query_options.group_by = typeof aiModel.query_options.group_by === 'object' ? aiModel.query_options.group_by : {};
            aiModel.query_options.order_by = Array.isArray(aiModel.query_options.order_by) ? aiModel.query_options.order_by : [];
            aiModel.query_options.offset = typeof aiModel.query_options.offset === 'number' ? aiModel.query_options.offset : -1;
            aiModel.query_options.limit = typeof aiModel.query_options.limit === 'number' ? aiModel.query_options.limit : -1;
            
            // CRITICAL: If group_by has aggregate_functions or aggregate_expressions, set the name flag
            // This flag is required for the UI to show the GROUP BY section
            if (aiModel.query_options.group_by && 
                (aiModel.query_options.group_by.aggregate_functions?.length > 0 || 
                 aiModel.query_options.group_by.aggregate_expressions?.length > 0)) {
                aiModel.query_options.group_by.name = 'GROUP BY';
                console.log('[Data Model Builder] Set group_by.name flag for UI visibility');
            }
        }
        
        // Initialize calculated_columns with validation
        if (!aiModel.calculated_columns) {
            aiModel.calculated_columns = [];
        } else if (!Array.isArray(aiModel.calculated_columns)) {
            console.warn('[Data Model Builder] calculated_columns is not an array, resetting to empty array');
            aiModel.calculated_columns = [];
        }
        
        // Ensure table_name exists
        if (!aiModel.table_name) {
            aiModel.table_name = 'ai_generated_model';
        }
        
        // CRITICAL: Ensure columns array exists (required for draggable component)
        if (!aiModel.columns) {
            console.error('[Data Model Builder] Model has no columns array, creating empty array');
            aiModel.columns = [];
        } else if (!Array.isArray(aiModel.columns)) {
            console.error('[Data Model Builder] Model columns is not an array, converting to array');
            aiModel.columns = Array.isArray(validColumns) ? validColumns : [];
        }
        
        console.log('[Data Model Builder] Model validated successfully:', aiModel);
        return aiModel;
        
    } catch (error) {
        console.error('[Data Model Builder] Critical error validating AI model:', error);
        $swal.fire({
            title: 'Validation Failed',
            text: 'The AI model could not be validated. Please try generating a new model.',
            icon: 'error'
        });
        return null;
    }
}

onMounted(async () => {
    if (props.dataModel && props.dataModel.query) {
        state.data_table = props.dataModel.query;
        
        // Auto-switch to advanced view if data model has advanced fields
        if (hasAdvancedFields()) {
            state.viewMode = 'advanced';
        }
    }
    
    console.log('[DEBUG - Data Model Builder] Raw dataSourceTables received:', props.dataSourceTables.length, 'tables');
    
    // Diagnostic: Check each table for duplicates
    props.dataSourceTables.forEach((table, tIndex) => {
        console.log(`[DEBUG - Data Model Builder] Table ${tIndex}: ${table.table_name} has ${table.columns?.length || 0} columns`);
        
        if (table.columns && Array.isArray(table.columns)) {
            // Check for duplicate column names
            const columnNames = table.columns.map(c => c.column_name);
            const duplicates = columnNames.filter((name, index) => 
                columnNames.indexOf(name) !== index
            );
            
            if (duplicates.length > 0) {
                console.error(`[DEBUG - Data Model Builder] ⚠️ DUPLICATES FOUND in ${table.table_name}:`, [...new Set(duplicates)]);
                console.error(`[DEBUG - Data Model Builder] Full duplicate columns:`, 
                    table.columns.filter(c => duplicates.includes(c.column_name))
                );
            }
            
            // Check for columns that don't match table name
            const mismatchedColumns = table.columns.filter(c => c.table_name !== table.table_name);
            if (mismatchedColumns.length > 0) {
                console.error(`[DEBUG - Data Model Builder] ⚠️ MISMATCHED TABLE NAMES in ${table.table_name}:`, 
                    mismatchedColumns.map(c => `${c.column_name} (says it belongs to ${c.table_name})`)
                );
            }
        }
    });
    
    state.tables = props.dataSourceTables;
    console.log('[DEBUG - Data Model Builder] Tables loaded into state');
})
</script>
<template>
   <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 border border-primary-blue-100 border-solid p-10 shadow-md">
        <div class="flex flex-row justify-between items-center mb-5">
            <div class="font-bold text-2xl">
                Create A Data Model from the Connected Data Source
            </div>
            <button 
                v-if="props.dataSource && props.dataSource.id"
                @click="openAIDataModeler"
                class="flex items-center gap-2 px-4 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 transition-colors duration-200 font-medium shadow-md cursor-pointer"
            >
                <font-awesome icon="fas fa-wand-magic-sparkles" class="w-5 h-5" />
                Build with AI
            </button>
        </div>
        <div class="text-md mb-10">
            You can create a new data model from the tables given below by dragging into the empty block shown in the data model section to the right.
        </div>
        
        <!-- Alerts Section -->
        <div v-if="state.alerts && state.alerts.length > 0" class="flex flex-col mb-5">
            <div v-for="(alert, index) in state.alerts" :key="index" 
                class="flex flex-row items-center p-4 mb-2 rounded border"
                :class="{
                    'bg-yellow-50 border-yellow-400 text-yellow-800': alert.type === 'warning',
                    'bg-red-50 border-red-400 text-red-800': alert.type === 'error'
                }"
            >
                <font-awesome 
                    :icon="alert.type === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-exclamation-circle'"
                    class="mr-3 text-xl"
                    :class="{
                        'text-yellow-600': alert.type === 'warning',
                        'text-red-600': alert.type === 'error'
                    }"
                />
                <span class="flex-1">{{ alert.message }}</span>
                <font-awesome 
                    icon="fas fa-times"
                    class="ml-3 cursor-pointer hover:opacity-70"
                    @click="state.alerts.splice(index, 1)"
                />
            </div>
        </div>
        
        <div v-if="state.response_from_external_data_source_columns && state.response_from_external_data_source_columns.length" class="flex flex-col overflow-auto">
            <h3 class="font-bold text-left mb-5">Response From External Data Source</h3>
            <table class="w-full border border-primary-blue-100 border-solid">
                <thead>
                    <tr>
                        <th v-for="column in state.response_from_external_data_source_columns" class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold ">
                            {{ column }}
                        </th>
                    </tr>
                    <tr v-for="row in state.response_from_external_data_source_rows" class="border border-primary-blue-100 border-solid p-2 text-center font-bold">
                        <td v-for="column in state.response_from_external_data_source_columns" class="border border-primary-blue-100 border-solid p-2 text-center">
                            {{ row[column] }}
                        </td>
                    </tr>
                </thead>
            </table>
        </div>
        
        <div class="w-full h-1 bg-blue-300 mt-5 mb-5"></div>
        
        <!-- View Mode Toggle -->
        <div class="flex justify-end mb-4">
            <div class="inline-flex rounded-md shadow-sm" role="group">
                <button 
                    type="button"
                    @click="state.viewMode = 'simple'"
                    :class="[
                        'cursor-pointer px-4 py-2 text-sm font-medium transition-all duration-200',
                        state.viewMode === 'simple' 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]"
                >
                    Simple View
                </button>
                <button 
                    type="button"
                    @click="state.viewMode = 'advanced'"
                    :class="[
                        'cursor-pointer px-4 py-2 text-sm font-medium transition-all duration-200',
                        state.viewMode === 'advanced' 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    ]"
                >
                    Advanced View
                </button>
            </div>
        </div>
        
        <div class="flex flex-row m-10">
            <div class="w-1/2 flex flex-col pr-5 mr-5 border-r-2 border-primary-blue-100">
                <!-- Table Alias Manager -->
                <div class="mb-6 p-4 border-2 border-blue-200 bg-blue-50">
                    <h3 class="font-bold mb-3 flex items-center text-blue-800">
                        <font-awesome icon="fas fa-layer-group" class="mr-2" />
                        Table Aliases (For Self-Referencing Relationships)
                    </h3>
                    <p class="text-sm text-gray-700 mb-3">
                        Use aliases when you need to join a table to itself (e.g., employees and managers, user friendships).
                    </p>
                    
                    <div v-if="state.table_aliases.length === 0" class="text-gray-600 italic mb-3 text-sm">
                        No table aliases defined. Click "Add Alias" to create one for self-referencing queries.
                    </div>
                    
                    <div v-else class="mb-3 space-y-2">
                        <div v-for="(alias, index) in state.table_aliases" :key="index" 
                             class="flex items-center justify-between bg-white p-3 border border-blue-300">
                            <div class="flex flex-col">
                                <span class="font-medium text-sm">
                                    {{ alias.schema }}.{{ alias.original_table }}
                                    <font-awesome icon="fas fa-arrow-right" class="mx-2 text-blue-600" />
                                    <span class="text-blue-700 font-bold">"{{ alias.alias }}"</span>
                                </span>
                                <span class="text-xs text-gray-600 mt-1">
                                    This alias lets you use {{ alias.original_table }} in multiple roles
                                </span>
                            </div>
                            <button @click="removeTableAlias(index)" 
                                    class="bg-red-500 text-white px-3 py-1 text-sm hover:bg-red-600 transition-colors cursor-pointer">
                                Remove
                            </button>
                        </div>
                    </div>
                    
                    <button @click="openAliasDialog()" 
                            class="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer">
                        <font-awesome icon="fas fa-plus" />
                        Add Table Alias
                    </button>
                </div>
                
                <h2 class="font-bold text-center mb-5">Tables</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:Grid-cols-3 md:gap-2">
                    <div v-for="tableOrAlias in getTablesWithAliases()" :key="`${tableOrAlias.schema}.${tableOrAlias.table_name}.${tableOrAlias.table_alias || 'base'}`" 
                         class="flex flex-col border border-solid p-1"
                         :class="tableOrAlias.isAlias ? 'border-blue-400 bg-blue-50' : 'border-primary-blue-100'">
                        <h4 class="text-center font-bold p-1 mb-2 overflow-clip text-ellipsis wrap-anywhere"
                            :class="tableOrAlias.isAlias ? 'bg-blue-200' : 'bg-gray-300'">
                            {{ tableOrAlias.display_name }}
                            <span v-if="tableOrAlias.isAlias" class="text-xs text-blue-700 block mt-1">
                                (Alias of {{ tableOrAlias.original_table }})
                            </span>
                        </h4>
                        <div class="p-1 m-2 p-2 wrap-anywhere"
                             :class="tableOrAlias.isAlias ? 'bg-blue-100' : 'bg-gray-300'">
                            Table Schema: {{ tableOrAlias.schema }} <br />
                            Table Name: {{ tableOrAlias.table_name }}
                            <span v-if="tableOrAlias.isAlias" class="block mt-1">
                                <br />Alias: <strong class="text-blue-700">{{ tableOrAlias.table_alias }}</strong>
                            </span>
                        </div>
                        <draggable
                            :list="(tableOrAlias && tableOrAlias.columns) ? tableOrAlias.columns : []"
                            :group="{
                                name: 'tables',
                                pull: 'clone',
                                put: false,
                            }"
                            itemKey="name"
                        >
                            <template #item="{ element, index }">
                                <div class="cursor-pointer p-1 ml-2 mr-2"
                                    :class="{
                                        'bg-gray-200': !element.reference.foreign_table_schema ? index % 2 === 0 : false,
                                        'bg-blue-100': tableOrAlias.isAlias && !element.reference.foreign_table_schema && index % 2 === 0,
                                        'bg-red-100 border-t-1 border-b-1 border-red-300': isColumnInDataModel(element.column_name, tableOrAlias.table_name, tableOrAlias.table_alias),
                                        'hover:bg-green-100': !isColumnInDataModel(element.column_name, tableOrAlias.table_name, tableOrAlias.table_alias),
                                        'bg-red-200': element.reference.foreign_table_schema,

                                    }"
                                >
                                    <div class="flex flex-row">
                                        <div class="w-2/3 ml-2 wrap-anywhere">
                                            Column: <strong>{{ element.display_column_name || element.column_name }}</strong><br />
                                            Column Data Type: {{ element.data_type }}<br />
                                            <div v-if="element.reference && element.reference.foreign_table_schema">
                                                <strong>Foreign Key Relationship Reference:</strong><br />
                                                <div class="border border-primary-blue-100 border-solid p-2 m-1">
                                                    Foreign Table Name: <strong>{{ element.reference.foreign_table_schema }}.{{ element.reference.foreign_table_name }}</strong><br />
                                                    Foreign Column Name: <strong>{{ element.reference.foreign_column_name }}</strong><br />
                                                </div>
                                            </div>
                                        </div>
                                        <div class="w-1/3 flex flex-col justify-center">
                                            <div class="flex flex-col justify-center mr-2">
                                                <input type="checkbox" class="cursor-pointer scale-200" 
                                                    :checked="isColumnInDataModel(element.column_name, tableOrAlias.table_name, tableOrAlias.table_alias)" 
                                                    @change="toggleColumnInDataModel(element, tableOrAlias.table_name, tableOrAlias.table_alias)"
                                                    v-tippy="{ content: isColumnInDataModel(element.column_name, tableOrAlias.table_name, tableOrAlias.table_alias) ? 'Uncheck to remove from data model' : 'Check to add to data model', placement: 'top' }"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                </div>
                            </template>
                        </draggable>
                    </div>
                </div>
            </div>
            <div class="w-1/2 flex h-full flex-col">
                <h2 class="font-bold text-center mb-5">Data Model</h2>
                <div class="w-full border border-primary-blue-100 border-solid draggable" id="data-model-container">
                    <div class="flex flex-col p-5">
                        <div class="flex flex-row justify-center bg-gray-300 text-center font-bold p-1 mb-2">
                            <h4 class="w-full font-bold">
                                <input type="text" class="border border-primary-blue-100 border-solid p-2" placeholder="Enter Data Table Name" v-model="state.data_table.table_name" />
                            </h4>
                        </div>
                        <draggable
                            class="min-h-1000 bg-gray-100"
                            :list="safeDataTableColumns"
                            group="tables"
                            @change="changeDataModel"
                            itemKey="name"
                        >
                            <template #header>
                                <div class="w-3/4 border border-gray-400 border-dashed h-10 flex text-center self-center items-center font-bold m-auto p-5 mt-5 mb-5 text-gray-500">
                                    Drag columns from the tables given in the left into this area to build your data model.
                                </div>
                            </template>
                            <template #item="{ element, index }">
                                <div class="cursor-pointer p-1 ml-2 mr-2"
                                    :class="{
                                        'bg-gray-200': index % 2 === 0,
                                    }"
                                >
                                    <div class="flex flex-row justify-around">
                                        <div class="ml-2 wrap-anywhere w-1/6">
                                            Table: {{ element.table_name }}<br />
                                            <strong>Column: {{ element.column_name }}</strong><br />
                                            Column Data Type: {{ element.data_type }}
                                        </div>
                                        <Transition
                                            enter-active-class="transition-all duration-300 ease-out"
                                            leave-active-class="transition-all duration-200 ease-in"
                                            enter-from-class="opacity-0 -translate-x-4"
                                            enter-to-class="opacity-100 translate-x-0"
                                            leave-from-class="opacity-100 translate-x-0"
                                            leave-to-class="opacity-0 translate-x-4"
                                        >
                                            <div v-if="state.viewMode === 'advanced'" class="flex flex-col w-1/5 mr-2">
                                                <h5 class="font-bold mb-2">Transform Function</h5>
                                                <select 
                                                    class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" 
                                                    v-model="element.transform_function"
                                                    @change="onTransformChange(element, $event)"
                                                >
                                                    <option v-for="func in state.transform_functions" :key="func.value" :value="func.value">
                                                        {{ func.name }}
                                                    </option>
                                                </select>
                                            </div>
                                        </Transition>
                                        <div class="flex flex-col w-1/4 mr-2">
                                            <h5 class="font-bold mb-2">Column Alias Name</h5>
                                            <input type="text" class="w-full border border-primary-blue-100 border-solid p-2" placeholder="Enter Column Alias Name" v-model="element.alias_name" />
                                        </div>
                                        <div class="flex flex-col justify-center mr-2">
                                            <input type="checkbox" class="cursor-pointer scale-150" v-model="element.is_selected_column" v-tippy="{ content: element.is_selected_column ? 'Uncheck to prevent the column from being added to the data model' : 'Check to add the column to the data model', placement: 'top' }" />
                                        </div>
                                        <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold" @click="deleteColumn(element.column_name)">
                                            Delete
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <template #footer>
                                <div class="p-5">
                                    <h2 v-if="state.data_table.calculated_columns.length">Calculated Fields</h2>
                                    <div v-for="(calculated_column, index) in state.data_table.calculated_columns" class="flex flex-row justify-between">
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Calculated Column Name</h5>
                                            <input type="text" class="w-full border border-primary-blue-100 border-solid p-2" placeholder="Enter Calculated Column Name" v-model="calculated_column.column_name" disabled/>
                                            <div class="flex flex-col mt-2">
                                                <h5 class="font-bold mb-2">Expression</h5>
                                                <input type="text" class="w-full border border-primary-blue-100 border-solid p-2" placeholder="Enter Expression" v-model="calculated_column.expression" disabled/>
                                            </div>
                                        </div>
                                        <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center mr-2 mt-8 p-5 cursor-pointer text-white font-bold" @click="deleteCalculatedColumn(index)">
                                            Delete
                                        </div>

                                    </div>
                                    <div v-if="showWhereClause" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold mb-2">Where</h3>
                                        <div class="flex flex-col bg-gray-100 p-5">
                                            <div v-for="(clause, index) in state.data_table.query_options.where" class="flex flex-row justify-between">
                                                <div v-if="index > 0" class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Condition</h5>
                                                    <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.condition">
                                                        <option v-for="(condition, index) in state.condition" :key="index" :value="index">{{ condition }}</option>
                                                    </select>
                                                </div>
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Column</h5>
                                                    <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column"  @change="whereColumnChanged">
                                                        <option v-for="col in whereColumns" :key="col.value" :value="col.value">
                                                            {{ col.display }}
                                                        </option>
                                                    </select>
                                                </div>
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Equality</h5>
                                                    <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.equality">
                                                        <option v-for="(equality, index) in state.equality" :key="index" :value="index">{{ equality }}</option>
                                                    </select>
                                                </div>
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Value</h5>
                                                    <input 
                                                        type="text" 
                                                        class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" 
                                                        v-model="clause.value"
                                                        :placeholder="getValuePlaceholder(clause.equality)"
                                                    />
                                                    <span v-if="state.equality[clause.equality] === 'IN' || state.equality[clause.equality] === 'NOT IN'" 
                                                        class="text-xs text-gray-600 mt-1">
                                                        Format: 'value1','value2','value3'
                                                    </span>
                                                </div>
                                                <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold mt-8" @click="removeQueryOption('WHERE', index)">
                                                    Delete
                                                </div>
                                                <div v-if="index === state.data_table.query_options.where.length - 1" class="bg-blue-500 hover:bg-blue-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold mt-8" @click="addQueryOption('WHERE')">
                                                    Add
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="showGroupByClause" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold mb-2">Group By</h3>
                                        <div class="flex flex-col bg-gray-100 p-5">
                                            <div v-for="(clause, index) in state.data_table.query_options.group_by.aggregate_functions">
                                                <div class="flex flex-col">
                                                    <div class="flex flex-row justify-between">
                                                        <div class="flex flex-col w-1/3 mr-2">
                                                            <h5 class="font-bold mb-2">Aggregate Function</h5>
                                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.aggregate_function" @change="aggregateFunctionChanged">
                                                                <option v-for="(aggregate_function, index) in state.aggregate_functions" :key="index" :value="index">{{ aggregate_function }}</option>
                                                            </select>
                                                        </div>
                                                        <div class="flex flex-col w-1/3 mr-2">
                                                            <h5 class="font-bold mb-2">Column</h5>
                                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column" @change="aggregateFunctionColumnChanged">
                                                                <option v-for="column in state.data_table.columns" :key="`${column.schema}.${column.table_name}.${column.column_name}`" :value="`${column.schema}.${column.table_name}.${column.column_name}`">{{ `${column.schema}.${column.table_name}.${column.column_name}` }}</option>
                                                            </select>
                                                        </div>
                                                        <div class="flex flex-col w-1/4 mr-2">
                                                            <h5 class="font-bold mb-2">Column Alias Name</h5>
                                                            <input type="text" class="w-full border border-primary-blue-100 border-solid p-2" placeholder="Enter Column Alias Name" v-model="clause.column_alias_name" />
                                                        </div>
                                                        <Transition
                                                            enter-active-class="transition-all duration-300 ease-out"
                                                            leave-active-class="transition-all duration-200 ease-in"
                                                            enter-from-class="opacity-0 -translate-x-4"
                                                            enter-to-class="opacity-100 translate-x-0"
                                                            leave-from-class="opacity-100 translate-x-0"
                                                            leave-to-class="opacity-0 translate-x-4"
                                                        >
                                                            <div v-if="state.viewMode === 'advanced'" class="flex flex-col w-1/12 mr-2">
                                                                <h5 class="font-bold mb-2">DISTINCT</h5>
                                                                <div class="flex items-center justify-center h-full">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        class="cursor-pointer scale-150" 
                                                                        v-model="clause.use_distinct"
                                                                        v-tippy="{ content: 'Apply DISTINCT to eliminate duplicate values', placement: 'top' }"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </Transition>
                                                    </div>
                                                    <div class="flex flex-row justify-end w-full mt-2">
                                                        <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold" @click="removeQueryOption('GROUP BY', index)">
                                                            Delete
                                                        </div>
                                                        <div v-if="index === state.data_table.query_options.group_by.aggregate_functions.length - 1" class="bg-blue-500 hover:bg-blue-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold" @click="addQueryOption('GROUP BY')">
                                                            Add
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Aggregate Expressions Section -->
                                            <Transition
                                                enter-active-class="transition-all duration-300 ease-out"
                                                leave-active-class="transition-all duration-200 ease-in"
                                                enter-from-class="opacity-0 -translate-x-4"
                                                enter-to-class="opacity-100 translate-x-0"
                                                leave-from-class="opacity-100 translate-x-0"
                                                leave-to-class="opacity-0 translate-x-4"
                                            >
                                                <div v-if="state.viewMode === 'advanced' && state.data_table.query_options.group_by.aggregate_expressions && state.data_table.query_options.group_by.aggregate_expressions.length > 0" class="mt-4">
                                                    <h4 class="font-bold mb-2">Aggregate Expressions</h4>
                                                    <div class="text-sm text-gray-600 mb-2">
                                                        Create aggregates from expressions (e.g., SUM(quantity * price))
                                                    </div>
                                                    
                                                    <div v-for="(expr, index) in state.data_table.query_options.group_by.aggregate_expressions" :key="index" class="bg-gray-50 p-3 mb-2 rounded border border-gray-300">
                                                        <div class="flex flex-row justify-between">
                                                            <div class="flex flex-col w-1/5 mr-2">
                                                                <h5 class="font-bold mb-2">Function</h5>
                                                                <select 
                                                                    class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" 
                                                                    v-model="expr.aggregate_function"
                                                                >
                                                                    <option v-for="(func, i) in state.aggregate_functions" :key="i" :value="i">{{ func }}</option>
                                                                </select>
                                                            </div>
                                                            
                                                            <div class="flex flex-col w-2/5 mr-2">
                                                                <h5 class="font-bold mb-2">Expression</h5>
                                                                <input 
                                                                    type="text" 
                                                                    class="w-full border border-primary-blue-100 border-solid p-2" 
                                                                    v-model="expr.expression"
                                                                    placeholder="e.g., public.order_items.quantity * public.products.price"
                                                                />
                                                                <span class="text-xs text-gray-600 mt-1">
                                                                    Use fully qualified column names: schema.table.column
                                                                </span>
                                                            </div>
                                                            
                                                            <div class="flex flex-col w-1/5 mr-2">
                                                                <h5 class="font-bold mb-2">Alias</h5>
                                                                <input 
                                                                    type="text" 
                                                                    class="w-full border border-primary-blue-100 border-solid p-2" 
                                                                    v-model="expr.column_alias_name"
                                                                    placeholder="e.g., total_revenue"
                                                                />
                                                            </div>
                                                            
                                                            <div class="flex flex-col w-1/12 mr-2">
                                                                <h5 class="font-bold mb-2">DISTINCT</h5>
                                                                <div class="flex items-center justify-center h-full">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        class="cursor-pointer scale-150" 
                                                                        v-model="expr.use_distinct"
                                                                    />
                                                                </div>
                                                            </div>
                                                            
                                                            <div class="flex items-center">
                                                                <div 
                                                                    class="bg-red-500 hover:bg-red-300 h-10 flex items-center p-5 cursor-pointer text-white font-bold rounded"
                                                                    @click="removeAggregateExpression(index)"
                                                                >
                                                                    Delete
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div 
                                                        class="w-full border border-blue-400 border-dashed h-10 flex items-center justify-center cursor-pointer hover:bg-blue-50 font-bold text-blue-600 rounded"
                                                        @click="addAggregateExpression"
                                                    >
                                                        + Add Aggregate Expression
                                                    </div>
                                                </div>
                                            </Transition>

                                            <!-- Show button to add first expression if none exist -->
                                            <Transition
                                                enter-active-class="transition-all duration-300 ease-out"
                                                leave-active-class="transition-all duration-200 ease-in"
                                                enter-from-class="opacity-0 -translate-x-4"
                                                enter-to-class="opacity-100 translate-x-0"
                                                leave-from-class="opacity-100 translate-x-0"
                                                leave-to-class="opacity-0 translate-x-4"
                                            >
                                                <div v-if="state.viewMode === 'advanced' && state.data_table.query_options.group_by.name && (!state.data_table.query_options.group_by.aggregate_expressions || state.data_table.query_options.group_by.aggregate_expressions.length === 0)" class="mt-4">
                                                    <div 
                                                        class="w-full border border-blue-400 border-dashed h-12 flex items-center justify-center cursor-pointer hover:bg-blue-50 font-bold text-blue-600 rounded"
                                                        @click="addAggregateExpression"
                                                    >
                                                        + Add Aggregate Expression (e.g., SUM(quantity * price))
                                                    </div>
                                                </div>
                                            </Transition>

                                            <h4 v-if="state.data_table.query_options.group_by.having_conditions.length" class="font-bold mt-2 mb-2">
                                                Having
                                                <span class="text-sm font-normal text-gray-600 ml-2">(Filter aggregate results)</span>
                                            </h4>
                                            <div v-for="(clause, index) in state.data_table.query_options.group_by.having_conditions">
                                                <div class="flex flex-col">
                                                    <div class="flex flex-row justify-between">
                                                        <div v-if="index > 0" class="flex flex-col w-full mr-2">
                                                            <h5 class="font-bold mb-2">Condition</h5>
                                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.condition">
                                                                <option v-for="(condition, index) in state.condition" :key="index" :value="index">{{ condition }}</option>
                                                            </select>
                                                        </div>
                                                        <div class="flex flex-col w-full mr-2">
                                                            <h5 class="font-bold mb-2">Aggregate Column</h5>
                                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column" @change="havingColumnChanged">
                                                                <optgroup label="Aggregate Columns">
                                                                    <option v-for="col in havingColumns" :key="col.value" :value="col.value">
                                                                        {{ col.display }}
                                                                    </option>
                                                                </optgroup>
                                                                <optgroup v-if="whereColumns.length > 0" label="Base Columns (use WHERE instead)">
                                                                    <option v-for="col in whereColumns" :key="col.value" :value="col.value" disabled>
                                                                        {{ col.display }}
                                                                    </option>
                                                                </optgroup>
                                                            </select>
                                                        </div>
                                                        <div class="flex flex-col w-full mr-2">
                                                            <h5 class="font-bold mb-2">Equality</h5>
                                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.equality">
                                                                <option v-for="(equality, index) in state.equality" :key="index" :value="index">{{ equality }}</option>
                                                            </select>
                                                        </div>
                                                        <div class="flex flex-col w-full mr-2">
                                                            <h5 class="font-bold mb-2">Value</h5>
                                                            <input type="text" class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.value" />
                                                        </div>
                                                    </div>
                                                    <div class="flex flex-row justify-end w-full mt-2">
                                                        <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold" @click="removeQueryOption('HAVING', index)">
                                                            Delete
                                                        </div>
                                                        <div v-if="index === state.data_table.query_options.group_by.having_conditions.length - 1" class="bg-blue-500 hover:bg-blue-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold" @click="addQueryOption('HAVING')">
                                                            Add
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="showOrderByClause" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold mb-2">Order By</h3>
                                        <div class="flex flex-col bg-gray-100 p-5">
                                            <div v-for="(clause, index) in state.data_table.query_options.order_by" class="flex flex-row justify-between">
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Column</h5>
                                                    <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column">
                                                        <optgroup label="Base Columns">
                                                            <option v-for="col in whereColumns" :key="col.value" :value="col.value">
                                                                {{ col.display }}
                                                            </option>
                                                        </optgroup>
                                                        <optgroup v-if="havingColumns.length > 0" label="Aggregate Columns">
                                                            <option v-for="col in havingColumns" :key="col.value" :value="col.value">
                                                                {{ col.display }}
                                                            </option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Order</h5>
                                                    <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.order">
                                                        <option v-for="(order, index) in state.order" :key="index" :value="index">{{ order }}</option>
                                                    </select>
                                                </div>
                                                <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold mt-8" @click="removeQueryOption('ORDER BY', index)">
                                                    Delete
                                                </div>
                                                <div v-if="index === state.data_table.query_options.order_by.length - 1" class="bg-blue-500 hover:bg-blue-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white font-bold mt-8" @click="addQueryOption('ORDER BY')">
                                                    Add
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="state.data_table.query_options.offset > -1" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold">Offset</h3>
                                        <div class="flex flex-col bg-gray-100 p-5">
                                            <div class="flex flex-row justify-between">
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Value</h5>
                                                    <div class="flex flex-row justify-between">
                                                        <input type="number" class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="state.data_table.query_options.offset" min="0" />
                                                        <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center ml-2 mr-2 p-5 cursor-pointer text-white font-bold" @click="removeQueryOption('OFFSET', 0)">
                                                            Delete
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="state.data_table.query_options.limit > -1" class="w-full flex flex-col mt-5">
                                        <h3 class="font-bold">Limit</h3>
                                        <div class="flex flex-col bg-gray-100 p-5">
                                            <div class="flex flex-row justify-between">
                                                <div class="flex flex-col w-full mr-2">
                                                    <h5 class="font-bold mb-2">Value</h5>
                                                    <div class="flex flex-row justify-between">
                                                        <input type="number" class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="state.data_table.query_options.limit" min="0" />
                                                        <div class="bg-red-500 hover:bg-red-300 h-10 flex items-center self-center ml-2 mr-2 p-5 cursor-pointer text-white font-bold" @click="removeQueryOption('LIMIT', 0)">
                                                            Delete
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="showDataModelControls" class="w-full border border-gray-400 border-dashed h-15 flex items-center justify-center mb-5 cursor-pointer mt-5 hover:bg-gray-100 font-bold" @click="openDialog">
                                        + Add Query Clause (for example: where, group by, order by)
                                    </div>
                                    <div v-if="showDataModelControls" class="w-full border border-gray-400 border-dashed h-15 flex items-center justify-center mb-5 cursor-pointer mt-5 hover:bg-gray-100 font-bold" @click="openCalculatedColumnDialog">
                                        + Add Calculated Column/Field
                                    </div>
                                    <template v-if="showDataModelControls && saveButtonEnabled">
                                        <div
                                            v-if="showDataModelControls"
                                            class="w-full justify-center text-center items-center self-center mb-5 p-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md select-none"
                                            @click="saveDataModel"
                                            >
                                            <template v-if="props.isEditDataModel">Update</template><template v-else>Save</template> Data Model
                                        </div>
                                    </template>
                                    <template v-else-if="showDataModelControls">
                                        <div class="w-full justify-center text-center items-center self-center mb-5 p-2 bg-gray-300 text-black cursor-not-allowed font-bold shadow-md select-none">
                                            <template v-if="props.isEditDataModel">Update</template><template v-else>Save</template> Data Model
                                        </div>
                                    </template>
                                </div>
                            </template>
                        </draggable>
                    </div>
                </div>
            </div>
        </div>
        <overlay-dialog v-if="state.show_dialog" @close="closeDialog">
            <template #overlay>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <template v-for="queryOption in state.query_options" :key="queryOption.name">
                        <div class="w-full border border-primary-blue-100 border-solid p-10 font-bold text-center hover:bg-gray-200 shadow-md cursor-pointer select-none" @click="addQueryOption(queryOption.name)">
                            {{ queryOption.name }}
                        </div>
                    </template>
                </div>
            </template>
        </overlay-dialog>
        <overlay-dialog v-if="state.show_calculated_column_dialog" :enable-scrolling="false" @close="closeCalculatedColumnDialog">
            <template #overlay>
                <div class="flex flex-col w-150 border border-primary-blue-100 border-solid p-5">
                    <h5 class="font-bold mb-2">Column Name</h5>
                    <input type="text" class="w-full border border-primary-blue-100 border-solid p-2" v-model="state.calculated_column.column_name" />
                    
                    <!-- Helper text -->
                    <div class="text-sm text-gray-600 bg-blue-50 border border-blue-200 p-3 rounded mt-2 mb-2">
                        <font-awesome icon="fas fa-info-circle" class="mr-2 text-blue-600" />
                        <strong>Tip:</strong> You can use both base columns and aggregate columns in calculations.
                        Example: Calculate tax as <code class="bg-gray-200 px-1 rounded">total_revenue * 0.15</code>
                    </div>
                    
                    <h5 class="font-bold mb-2 mt-2">Operations<font-awesome icon="fas fa-circle-info" class="text-lg text-black cursor-pointer ml-1" :v-tippy-content="'You can select base columns and aggregate columns. Aggregates must be defined first in GROUP BY section.'"/></h5>
                    <div v-for="(column, index) in state.calculated_column.columns">
                        <div v-if="index > 0" class="flex flex-col w-full mr-2">
                            <h5 class="font-bold mb-2">Operator</h5>
                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="column.operator">
                                <option v-for="(operator, index) in state.add_column_operators" :key="index" :value="operator">{{ operator }}</option>
                            </select>
                        </div>
                        <div v-if="column.type === 'column'" class="flex flex-col w-full mr-2">
                            <h5 class="font-bold mb-2">Column / Aggregate</h5>
                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="column.column_name">
                                <optgroup label="Base Columns">
                                    <option 
                                        v-for="(col, index) in numericColumnsWithAggregates.filter(c => c.type === 'base_column')" 
                                        :key="'base_' + index" 
                                        :value="col.value"
                                    >
                                        {{ col.display }}
                                    </option>
                                </optgroup>
                                <optgroup 
                                    v-if="numericColumnsWithAggregates.filter(c => c.type !== 'base_column').length > 0" 
                                    label="Aggregate Columns"
                                >
                                    <option 
                                        v-for="(col, index) in numericColumnsWithAggregates.filter(c => c.type !== 'base_column')" 
                                        :key="'agg_' + index" 
                                        :value="col.value"
                                    >
                                        {{ col.display }}
                                    </option>
                                </optgroup>
                            </select>
                        </div>
                        <div v-else-if="column.type === 'numeric-value'" class="flex flex-col w-full mr-2">
                            <h5 class="font-bold mb-2">Numeric Value</h5>
                            <input class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" type="number" v-model="column.numeric_value" />
                        </div>
                        
                        <div class="flex flex-row">
                            <div v-if="index > 0" class="flex flex-row justify-center w-full bg-red-500 hover:bg-red-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white text-center font-bold mt-8" @click="deleteCalculatedColumnOperation(index)">
                                Delete Column
                            </div>
                            <div v-if="index === state.calculated_column.columns.length - 1" class="flex flex-row justify-center w-full bg-blue-500 hover:bg-blue-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-white text-center font-bold mt-8" @click="addCalculatedColumnOperation('column')">
                                Add Column
                            </div>
                            <div v-if="index === state.calculated_column.columns.length - 1" class="flex flex-row justify-center w-full bg-blue-500 hover:bg-blue-300 h-10 flex items-center self-center mr-2 p-5 cursor-pointer text-sm text-white text-center font-bold mt-8" @click="addCalculatedColumnOperation('numeric-value')">
                                Add Numeric Value
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-row justify-center w-50 h-10 bg-primary-blue-100 hover:bg-primary-blue-300 items-center self-center mt-2 p-5 cursor-pointer text-white text-sm text-center font-bold select-none" @click="addCalculatedColumn">
                        Add Calulated Column
                    </div>
                </div>
            </template>
        </overlay-dialog>
        
        <!-- AI Data Modeler Drawer -->
        <AiDataModelerDrawer />
        
        <!-- Table Alias Creation Dialog -->
        <div v-if="state.show_alias_dialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 w-96 shadow-2xl">
                <h3 class="text-xl font-bold mb-4 text-gray-800 flex items-center">
                    <font-awesome icon="fas fa-layer-group" class="mr-2 text-blue-600" />
                    Create Table Alias
                </h3>
                
                <p class="text-sm text-gray-600 mb-4">
                    Table aliases allow you to use the same table multiple times in different roles (e.g., employees and managers from the same users table).
                </p>
                
                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Select Table:</label>
                    <select v-model="state.alias_form.table" class="w-full border border-gray-300 p-2 cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        <option value="">-- Select Table --</option>
                        <option v-for="table in state.tables" :key="`${table.schema}.${table.table_name}`" 
                                :value="`${table.schema}.${table.table_name}`">
                            {{ table.schema }}.{{ table.table_name }}
                        </option>
                    </select>
                </div>
                
                <div class="mb-4">
                    <label class="block mb-2 font-medium text-gray-700">Alias Name:</label>
                    <input v-model="state.alias_form.alias" 
                           type="text" 
                           placeholder="e.g., employees, managers, requesters"
                           class="w-full border border-gray-300 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                    <p class="text-xs text-gray-500 mt-1">
                        <font-awesome icon="fas fa-lightbulb" class="text-yellow-500 mr-1" />
                        Use a descriptive name that reflects the role this table plays in your query
                    </p>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 p-3 mb-4 text-sm">
                    <strong class="text-blue-800">Example:</strong>
                    <div class="mt-2 text-gray-700">
                        <strong>Table:</strong> users<br />
                        <strong>Alias 1:</strong> "employees" (for employee info)<br />
                        <strong>Alias 2:</strong> "managers" (for manager info)<br />
                        <strong>Join:</strong> employees.manager_id = managers.user_id
                    </div>
                </div>
                
                <div class="flex justify-end gap-2">
                    <button @click="closeAliasDialog()" class="px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button @click="createTableAlias()" class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer">
                        Create Alias
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>