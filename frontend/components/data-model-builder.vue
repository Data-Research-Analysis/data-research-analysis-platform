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
    viewMode: 'simple', // 'simple' or 'advanced'
    tables: [],
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
        aiDataModelerStore.openDrawer(props.dataSource.id);
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
         //Remove the foreign key column. Do not allow to columns that are foreign keys in the referenced table
        if (event?.added?.element?.reference?.foreign_table_schema && event?.added?.element?.reference?.local_table_name === column?.table_name && event?.added?.element?.reference?.local_column_name === column?.column_name) {
            $swal.fire({
                icon: 'error',
                title: `Error!`,
                text: `The column can not be added to the data model.`,
            });
            return false
        }
        //remove duplicate columns
        if (state.data_table.columns.filter((c) => c.column_name === column.column_name && c.table_name === column.table_name).length > 1) {
            return false;
        } else {
            return true;
        }
    });
    await executeQueryOnExternalDataSource();    
}
async function deleteColumn(columnName) {
    state.data_table.columns = state.data_table.columns.filter((column) => {
        column.alias_name = "";
        return column.column_name !== columnName;
    });
    if (state.data_table.columns.length === 0) {
        state.data_table.query_options.where = [];
        state.data_table.query_options.group_by = [];
        state.data_table.query_options.order_by = [];
        state.data_table.query_options.offset = -1;
        state.data_table.query_options.limit = -1;
    }
    await executeQueryOnExternalDataSource();
}
function isColumnInDataModel(columnName, tableName) {
    return state.data_table.columns.filter((column) => column.column_name === columnName && column.table_name === tableName).length > 0;
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
    let dataTables = state.data_table.columns.map((column) => `${column.schema}.${column.table_name}`);
  
    let fromJoinClauses = [];
    const tableCombinations = [];
    dataTables = _.uniq(dataTables);
    if (dataTables.length === 1) {
        fromJoinClause.push(`FROM ${dataTables[0]}`);
        sqlQuery = `SELECT ${state.data_table.columns.filter((column) => column.is_selected_column).map((column) => {
            const tableName = column.table_name.length > 20 ? column.table_name.slice(-20) : column.table_name;
            const aliasName = column?.alias_name !== '' ? column.alias_name : `${tableName}_${column.column_name}`;
            return `${column.schema}.${column.table_name}.${column.column_name} AS ${aliasName}`;
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
        relationshipReferences.forEach((references) => {
            references.forEach((reference) => {
                const tableCombinationString = `${reference.local_table_schema}.${reference.local_table_name}-${reference.foreign_table_schema}.${reference.foreign_table_name}`;
                if (tableCombinations.includes(tableCombinationString)) {
                    fromJoinClauses.push(reference);
                }
            });
        });

        // Detect orphaned tables (tables with no relationships to other selected tables)
        const tablesInJoins = new Set();
        fromJoinClauses.forEach(clause => {
            tablesInJoins.add(`${clause.local_table_schema}.${clause.local_table_name}`);
            tablesInJoins.add(`${clause.foreign_table_schema}.${clause.foreign_table_name}`);
        });

        const orphanedTables = dataTables.filter(table => !tablesInJoins.has(table));
        if (orphanedTables.length > 0) {
            const orphanedAlert = {
                type: 'error',
                message: `Cannot create data model: The following tables have no foreign key relationships to other selected tables: ${orphanedTables.join(', ')}. Please remove columns from unrelated tables or select tables with defined relationships.`
            };
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
        fromJoinClauses.forEach((clause, index) => {
            if (index === 0) {
                fromJoinClause.push(`FROM ${clause.local_table_schema}.${clause.local_table_name}`)
                fromJoinClause.push(`JOIN ${clause.foreign_table_schema}.${clause.foreign_table_name}`)
                fromJoinClause.push(`ON ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)
            } else {
                // More precise table existence check - both tables must be added independently
                const localTableRef = `${clause.local_table_schema}.${clause.local_table_name}`;
                const foreignTableRef = `${clause.foreign_table_schema}.${clause.foreign_table_name}`;

                const localTableExists = fromJoinClause.some(entry => 
                    entry.includes(`FROM ${localTableRef}`) || entry.includes(`JOIN ${localTableRef}`)
                );
                const foreignTableExists = fromJoinClause.some(entry => 
                    entry.includes(`FROM ${foreignTableRef}`) || entry.includes(`JOIN ${foreignTableRef}`)
                );

                // Determine which table to JOIN (the one that doesn't exist yet)
                // The ON clause will reference both tables
                let needsNewJoin = false;
                
                if (!localTableExists && !foreignTableExists) {
                    // Neither table exists - add the foreign table (it will be the new join target)
                    fromJoinClause.push(`JOIN ${foreignTableRef}`);
                    needsNewJoin = true;
                } else if (!localTableExists) {
                    // Only local table missing - add it
                    fromJoinClause.push(`JOIN ${localTableRef}`);
                    needsNewJoin = true;
                } else if (!foreignTableExists) {
                    // Only foreign table missing - add it
                    fromJoinClause.push(`JOIN ${foreignTableRef}`);
                    needsNewJoin = true;
                }
                
                // Add the ON/AND condition
                const joinCondition = `${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`;
                
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

        sqlQuery = `SELECT ${state.data_table.columns.filter((column) => column.is_selected_column).map((column) => {
            const aliasName = column?.alias_name !== '' ? column.alias_name : `${column.schema}_${column.table_name}_${column.column_name}`;
            let columnRef = `${column.schema}.${column.table_name}.${column.column_name}`;
            
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
        sqlQuery += ` GROUP BY ${state.data_table.columns.filter((column) => column.is_selected_column).map((column) => {
            let columnRef = `${column.schema}.${column.table_name}.${column.column_name}`;
            
            if (column.transform_function) {
                const closeParens = ')'.repeat(column.transform_close_parens || 1);
                columnRef = `${column.transform_function}(${columnRef}${closeParens}`;
            }
            
            return columnRef;
        }).join(', ')}`;
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
    if (response.status === 200) {
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
    const data = await response.json();
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
async function toggleColumnInDataModel(column, tableName) {
    if (isColumnInDataModel(column.column_name, tableName)) {
        // Remove
        state.data_table.columns = state.data_table.columns.filter((c) => {
            return !(c.column_name === column.column_name && c.table_name === tableName);
        });
        if (state.data_table.columns.length === 0) {
            state.data_table.query_options.where = [];
            state.data_table.query_options.group_by = [];
            state.data_table.query_options.order_by = [];
            state.data_table.query_options.offset = -1;
            state.data_table.query_options.limit = -1;
        }
        await executeQueryOnExternalDataSource();
    } else {
        // Add
        const newColumn = _.cloneDeep(column);
        newColumn.table_name = tableName;
        newColumn.is_selected_column = true;
        newColumn.alias_name = "";
        newColumn.transform_function = '';
        newColumn.transform_close_parens = 0;
        
        state.data_table.columns.push(newColumn);
        await executeQueryOnExternalDataSource();
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
    state.tables = props.dataSourceTables
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
                class="flex items-center gap-2 px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 font-medium shadow-md cursor-pointer"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
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
            
            <div class="w-full h-1 bg-blue-300 mt-5 mb-5"></div>
            
            <!-- View Mode Toggle -->
            <div class="flex justify-end mb-4">
                <div class="inline-flex rounded-md shadow-sm" role="group">
                    <button 
                        type="button"
                        @click="state.viewMode = 'simple'"
                        :class="[
                            'cursor-pointer px-4 py-2 text-sm font-medium rounded-l-lg border transition-all duration-200',
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
                            'cursor-pointer px-4 py-2 text-sm font-medium rounded-r-lg border transition-all duration-200',
                            state.viewMode === 'advanced' 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        ]"
                    >
                        Advanced View
                    </button>
                </div>
            </div>
        </div>
        <div class="flex flex-row m-10">
            <div class="w-1/2 flex flex-col pr-5 mr-5 border-r-2 border-primary-blue-100">
                <h2 class="font-bold text-center mb-5">Tables</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:Grid-cols-3 md:gap-2">
                    <div v-for="table in state.tables" class="flex flex-col border border-primary-blue-100 border-solid p-1">
                        <h4 class="bg-gray-300 text-center font-bold p-1 mb-2 overflow-clip text-ellipsis wrap-anywhere">
                            {{ table.table_name}}
                        </h4>
                        <div class="bg-gray-300 p-1 m-2 p-2 wrap-anywhere">
                            Table Schema: {{ table.schema }} <br />
                            Table Name: {{ table.table_name }}
                        </div>
                        <draggable
                            :list="table.columns"
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
                                        'bg-red-100 border-t-1 border-b-1 border-red-300': isColumnInDataModel(element.column_name, table.table_name),
                                        'hover:bg-green-100': !isColumnInDataModel(element.column_name, table.table_name),
                                        'bg-red-200': element.reference.foreign_table_schema,

                                    }"
                                >
                                    <div class="flex flex-row">
                                        <div class="w-2/3 ml-2 wrap-anywhere">
                                            Column: <strong>{{ element.column_name }}</strong><br />
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
                                            <div v-if="!element.reference.foreign_table_schema" class="flex flex-col justify-center mr-2">
                                                <input type="checkbox" class="cursor-pointer scale-200" 
                                                    :checked="isColumnInDataModel(element.column_name, table.table_name)" 
                                                    @change="toggleColumnInDataModel(element, table.table_name)"
                                                    v-tippy="{ content: isColumnInDataModel(element.column_name, table.table_name) ? 'Uncheck to remove from data model' : 'Check to add to data model', placement: 'top' }"
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
                            :list="state.data_table.columns"
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
    </div>
</template>