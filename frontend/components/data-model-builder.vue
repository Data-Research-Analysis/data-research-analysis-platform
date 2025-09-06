<script setup>
import _ from 'lodash';
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const state = reactive({
    show_dialog: false,
    show_calculated_column_dialog: false,
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
    equality: ['=', '>', '<', '>=', '<=', '!='],
    condition: ['AND', 'OR'],
    order: ['ASC', 'DESC'],
    aggregate_functions: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'],
    add_column_operators: ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE','MODULO'],
    sql_query: '',
    response_from_external_data_source_columns: [],
    response_from_external_data_source_rows: [],
    calculated_column: {},
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
    const column = state.data_table.columns.find((column) => `${column.schema}.${column.table_name}.${column.column_name}` === event.target.value);
    if (column) {
        const whereColumn = state.data_table.query_options.where.find((where_column) => where_column.column === event.target.value)
        if (whereColumn) {
            whereColumn.column_data_type = column.data_type;
        }
    }
}
function havingColumnChanged(event) {
    const column = state.data_table.columns.find((column) => `${column.schema}.${column.table_name}.${column.column_name}` === event.target.value);
    if (column) {
        const havingColumn = state.data_table.query_options.group_by.having_conditions.find((having_column) => having_column.column === event.target.value)
        if (havingColumn) {
            havingColumn.column_data_type = column.data_type;
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
            }];
        } else {
            state.data_table.query_options.group_by.aggregate_functions.push({
                column: '',
                column_alias_name: '',
                aggregate_function: '',// aggregate_functions: 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX'
            });
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
    let expression = "";
    for (let i=0; i<state.calculated_column.columns.length; i++) {
        const column = state.calculated_column.columns[i];
        const operator = column.operator;
        const type = column.type;
        if (i === 0) {
            //the first operator will always be null, so we skip it
            expression += `${column.column_name}`;
        } else {
            let value = type === 'column' ? column.column_name : column.numeric_value;
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
            const aliasName = column?.alias_name !== '' ? column.alias_name : `${column.schema}_${column.table_name}_${column.column_name}`;
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

        /**
         * Reordering the fromJoinClauses so that any table that is seen as a foreign table seen earlier on in the list 
         * is then seen as local table, then to add this particular table join object to the begining of the array
         * so that the ordering of the tables being joined are correctly joined and their ON statements are correctly
         * ordered as well.
         */
        let modified_tables = [];
        for (let i=0; i<fromJoinClauses.length;i++) {
            for (let j=0;j<fromJoinClauses.length;j++) {
                if (fromJoinClauses[i].foreign_table_name === fromJoinClauses[j].local_table_name) {
                    modified_tables.push(fromJoinClauses[j]);
                }
            }
        }
        for (let i=0; i<fromJoinClauses.length;i++) {
            if (!modified_tables.find((table) => table.local_table_name === fromJoinClauses[i].local_table_name && table.foreign_table_name === fromJoinClauses[i].foreign_table_name)) {
                modified_tables.push(fromJoinClauses[i]);
            }
        }
        fromJoinClauses = modified_tables;
        fromJoinClauses.forEach((clause, index) => {
            if (index === 0) {
                fromJoinClause.push(`FROM ${clause.local_table_schema}.${clause.local_table_name}`)
                fromJoinClause.push(`JOIN ${clause.foreign_table_schema}.${clause.foreign_table_name}`)
                fromJoinClause.push(`ON ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)
            } else {
                if (!fromJoinClause.includes(`FROM ${clause.local_table_schema}.${clause.local_table_name}`) && !fromJoinClause.includes(`JOIN ${clause.local_table_schema}.${clause.local_table_name}`)) {
                    fromJoinClause.push(`JOIN ${clause.local_table_schema}.${clause.local_table_name}`)
                } else if (!fromJoinClause.includes(`FROM ${clause.foreign_table_schema}.${clause.foreign_table_name}`) && !fromJoinClause.includes(`JOIN ${clause.foreign_table_schema}.${clause.foreign_table_name}`)) {
                    fromJoinClause.push(`JOIN ${clause.foreign_table_schema}.${clause.foreign_table_name}`)
                }
                if (index > 0 && fromJoinClause[fromJoinClause.length - 1].includes(`ON ${clause.local_table_schema}.${clause.local_table_name}`)) {
                    if (!fromJoinClause.includes(`ON ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)) {
                        fromJoinClause.push(`AND ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)
                    }
                } else {
                    if (!fromJoinClause.includes(`ON ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)) {
                        fromJoinClause.push(`ON ${clause.local_table_schema}.${clause.local_table_name}.${clause.local_column_name} = ${clause.foreign_table_schema}.${clause.foreign_table_name}.${clause.foreign_column_name}`)
                    }
                }
            }
        });

        sqlQuery = `SELECT ${state.data_table.columns.filter((column) => column.is_selected_column).map((column) => {
            const aliasName = column?.alias_name !== '' ? column.alias_name : `${column.schema}_${column.table_name}_${column.column_name}`;
            return `${column.schema}.${column.table_name}.${column.column_name} AS ${aliasName}`;
        }).join(', ')}`;
    }
    if (state?.data_table?.calculated_columns?.length) {
        state.data_table.calculated_columns.forEach((column) => {
            sqlQuery += `, ${column.expression} AS ${column.column_name}`;
        })
    }
    state?.data_table?.query_options?.group_by?.aggregate_functions?.forEach((aggregate_function) => {
        if (aggregate_function.aggregate_function !== '' && aggregate_function.column !== '') {
            const aliasName = aggregate_function?.column_alias_name !== '' ? ` AS ${aggregate_function.column_alias_name}` : '';
            sqlQuery += `, ${state.aggregate_functions[aggregate_function.aggregate_function]}(${aggregate_function.column})${aliasName}`;
        }
    });

    sqlQuery += ` ${fromJoinClause.join(' ')}`;

    //determining whether to save the value with single quotes or not depending on the data type of the column
    state.data_table.query_options.where.forEach((clause) => {
        let value = getColumValue(clause.value, clause.column_data_type);
        if (clause.column !=='' && clause.equality !== '' && clause.value !== '') {
            if (clause.condition === '') {
                //first WHERE clause
                sqlQuery += ` WHERE ${clause.column} ${state.equality[clause.equality]} ${value}`;
            } else {
                sqlQuery += ` ${state.condition[clause.condition]} ${clause.column} ${state.equality[clause.equality]} ${value}`;
            }
        }
    });
    if (showGroupByClause.value) {
        sqlQuery += ` GROUP BY ${state.data_table.columns.filter((column) => column.is_selected_column).map((column) => `${column.schema}.${column.table_name}.${column.column_name}`).join(', ')}`;
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
            if (index === 0) {
                //first where clause
                sqlQuery += ` ORDER BY ${clause.column} ${state.order[clause.order]}`;
            } else {
                sqlQuery += `, ${clause.column} ${state.order[clause.order]}`;
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
            query_json: JSON.stringify(state.data_table),
            data_model_name: state.data_table.table_name,
            data_model_id: props.isEditDataModel ? props.dataModel.id : null,
        })
    });
    if (response.status === 200) {
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
        const columns = Object.keys(data[0]);
        state.response_from_external_data_source_columns = columns;
        state.response_from_external_data_source_rows = data;
    }
}
onMounted(async () => {
    if (props.dataModel && props.dataModel.query) {
        state.data_table = props.dataModel.query;
    }
    state.tables = props.dataSourceTables
})
</script>
<template>
   <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 border border-primary-blue-100 border-solid p-10 shadow-md">
        <div class="font-bold text-2xl mb-5">
            Create A Data Model from the Connected Data Source
        </div>
        <div class="text-md mb-10">
            You can create a new data model from the tables given below by dragging into the empty block shown in the data model section to the right.
        </div>
        <div v-if="state.response_from_external_data_source_columns && state.response_from_external_data_source_columns.length" class="flex flex-col">
            <h3 class="font-bold text-left mb-5">Response From External Data Source</h3>
            <table class="w-full border border-primary-blue-100 border-solid">
                <thead>
                    <tr>
                        <th v-for="column in state.response_from_external_data_source_columns" class="bg-blue-100 border border-primary-blue-100 border-solid p-2 text-center font-bold">
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
        </div>
        <div class="flex flex-row m-10">
            <div class="w-1/2 flex flex-col pr-5 mr-5 border-r-2 border-primary-blue-100">
                <h2 class="font-bold text-center mb-5">Tables</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:Grid-cols-3 md:gap-2">
                    <div v-for="table in state.tables" class="flex flex-col border border-primary-blue-100 border-solid p-1">
                        <h4 class="bg-gray-300 text-center font-bold p-1 mb-2 overflow-clip text-ellipsis" 
                            v-tippy="{ content: `${table.schema}.${table.table_name}`, placement: 'bottom' }"
                        >
                            {{ table.schema }}.{{ table.table_name }}
                        </h4>
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
                                        <div class="ml-2">
                                            Table: {{ element.table_name }}<br />
                                            <strong>Column: {{ element.column_name }}</strong><br />
                                            Column Data Type: {{ element.data_type }}
                                        </div>
                                        <div class="flex flex-col w-1/2 mr-2">
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
                                                        <option v-for="column in state.data_table.columns" :key="`${column.schema}.${column.table_name}.${column.column_name}`" :value="`${column.schema}.${column.table_name}.${column.column_name}`">{{ `${column.schema}.${column.table_name}.${column.column_name}` }}</option>
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
                                                        <div class="flex flex-col w-1/3 mr-2">
                                                            <h5 class="font-bold mb-2">Column Alias Name</h5>
                                                            <input type="text" class="w-full border border-primary-blue-100 border-solid p-2" placeholder="Enter Column Alias Name" v-model="clause.column_alias_name" />
                                                        </div>
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

                                            <h4 v-if="state.data_table.query_options.group_by.having_conditions.length" class="font-bold mt-2 mb-2">Having</h4>
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
                                                            <h5 class="font-bold mb-2">Column</h5>
                                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column" @change="havingColumnChanged">
                                                                <option v-for="column in state.data_table.columns" :key="`${column.schema}.${column.table_name}.${column.column_name}`" :value="`${column.schema}.${column.table_name}.${column.column_name}`">{{ `${column.schema}.${column.table_name}.${column.column_name}` }}</option>
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
                                                        <option v-for="column in state.data_table.columns" :key="`${column.schema}.${column.table_name}.${column.column_name}`" :value="`${column.schema}.${column.table_name}.${column.column_name}`">{{ `${column.schema}.${column.table_name}.${column.column_name}` }}</option>
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
                    <h5 class="font-bold mb-2 mt-2">Operations<font-awesome icon="fas fa-circle-info" class="text-lg text-black cursor-pointer ml-1" :v-tippy-content="'You can only select columns from the data model and not any other table.'"/></h5>
                    <div v-for="(column, index) in state.calculated_column.columns">
                        <div v-if="index > 0" class="flex flex-col w-full mr-2">
                            <h5 class="font-bold mb-2">Operator</h5>
                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="column.operator">
                                <option v-for="(operator, index) in state.add_column_operators" :key="index" :value="operator">{{ operator }}</option>
                            </select>
                        </div>
                        <div v-if="column.type === 'column'" class="flex flex-col w-full mr-2">
                            <h5 class="font-bold mb-2">Column</h5>
                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="column.column_name">
                                <option v-for="(column1, index) in numericColumns" :key="index" :value="`${column1.column_name}`">{{ column1.column_name }}</option>
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
    </div>
</template>