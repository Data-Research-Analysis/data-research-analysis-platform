<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useVisualizationsStore } from '@/stores/visualizations';
import _ from 'lodash';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const visualizationsStore = useVisualizationsStore();
const { $swal } = useNuxtApp();
const route = useRoute();
const state = reactive({
    data_model_tables: [],
    tables: [],
    visualizations_data_model: {
        table_name: '',
        columns: [],
        query_options: {
            where: [],
            group_by: [],
            order_by: [],
            offset: -1,
            limit: -1,
        }
    },
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
    sql_query: '',
    headers: [],
    chart_mode: 'table',//table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, map
    response_from_data_models_columns: [],
    response_from_data_models_rows: [],
    show_dialog: false,
 });
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dataSources = computed(() => {
    return dataSourceStore.getDataSources();
})
const dataModels = computed(() => {
    return dataModelsStore.getDataModels();
})
const dataModelTables = computed(() => {
    return dataModelsStore.getDataModelTables();
})
const showWhereClause = computed(() => {
    return state?.visualizations_data_model?.query_options?.where?.length > 0;
});
const showOrderByClause = computed(() => {
    return state?.visualizations_data_model?.query_options?.order_by?.length > 0;
});
const showGroupByClause = computed(() => {
    return state?.visualizations_data_model?.query_options?.group_by?.name ? true : false;
});
const showDataModelControls = computed(() => {
    return state && state.visualizations_data_model && state.visualizations_data_model.columns && state.visualizations_data_model.columns.length > 0;
})
const showQueryDialogButton = computed(() => {
    return showWhereClause.value || showOrderByClause.value || showGroupByClause.value
})
watch(() => state.visualizations_data_model.query_options, async (value) => {
    await executeQueryOnDataModels();
}, { deep: true })
// watch (
//     state,
//     async (value, oldValue) => {
//         console.log('watch state', value, oldValue);
//     },
// );
function getColumValue(value, dataType) {
    if (getDataType(dataType) === 'NUMBER' || getDataType(dataType) === 'BOOLEAN') {
        return `${value}`;
    } else if (getDataType(dataType) === 'TEXT') {
        return `'${value}'`;
    } else {
        return `'${value}'`;
    }
}
function selectChartType(chartType) {
    //table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, stacked_area, map
    state.chart_mode = chartType;
    console.log('chart mode', state.chart_mode);
}
function openDialog() {
    state.show_dialog = true;
}
function closeDialog() {
    state.show_dialog = false;
}
async function changeDataModel(event) {
    console.log('changeDataModel event', event);
    // state.headers.push(event.added.element.column_name);
    console.log('state.headers', state.headers);
    state.headers = _.uniqBy(state.headers, 'column_name');
    console.log('state.headers after', state.headers);
    state.visualizations_data_model.columns = state.visualizations_data_model.columns.filter((column) => {
        if (state.visualizations_data_model.columns.filter((c) => c.column_name === column.column_name && c.table_name === column.table_name).length > 1) {
            return false;
        } else {
            return true;
        }
    });
    visualizationsStore.setColumnsAdded(state.visualizations_data_model.columns);
    console.log('state.visualizations_data_model.columns', state.visualizations_data_model.columns);
    console.log('state.visualizations_data_model', state.visualizations_data_model);
    await executeQueryOnDataModels();
}
async function removeColumn(column) {
    console.log('removeColumn column', column);
    const index = state.visualizations_data_model.columns.findIndex((header) => header.column_name === column.column_name);
    if (index !== -1) {
        state.visualizations_data_model.columns.splice(index, 1);
    }
    await executeQueryOnDataModels();

}
function addQueryOption(queryOption) {
    if (queryOption === 'WHERE') {
        state.visualizations_data_model.query_options.where.push({
            name: queryOption,
            column: '',
            column_data_type: '',
            equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
            value: '',
            condition: '',// condition: 'AND', 'OR'
        });
    } else if (queryOption === 'GROUP BY') {
        if (!state?.visualizations_data_model?.query_options?.group_by?.name) {
            state.visualizations_data_model.query_options.group_by.name = queryOption;
        }
        if (!state?.visualizations_data_model?.query_options?.group_by?.aggregate_functions) {
            state.visualizations_data_model.query_options.group_by.aggregate_functions = [{
                column: '',
                aggregate_function: '',// aggregate_functions: 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX'
            }];
        } else {
            state.visualizations_data_model.query_options.group_by.aggregate_functions.push({
                column: '',
                aggregate_function: '',// aggregate_functions: 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX'
            });
        }

        if (!state?.visualizations_data_model?.query_options?.group_by?.having_conditions) {
            state.visualizations_data_model.query_options.group_by.having_conditions = [{
                    column: '',
                    column_data_type: '',
                    equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
                    value: '',
                    condition: '',// condition: 'AND', 'OR'
            }]
        }
    } else if (queryOption === 'HAVING') {
        state.visualizations_data_model.query_options.group_by.having_conditions.push({
                column: '',
                column_data_type: '',
                equality: '',// equality: '=', '>', '<', '>=', '<=', '!='
                value: '',
                condition: '',// condition: 'AND', 'OR'
        })
    } else if (queryOption === 'ORDER BY') {
        state.visualizations_data_model.query_options.order_by.push({
            name: queryOption,
            column: '',
            order: '',// order: 'ASC', 'DESC' 
        });
    } else if (queryOption === 'OFFSET') {
        state.visualizations_data_model.query_options.offset = 0;
    } else if (queryOption === 'LIMIT') {
        state.visualizations_data_model.query_options.limit = 0;
    }
    state.show_dialog = false;
}
function removeQueryOption(queryOption, index) {
    if (queryOption === 'WHERE') {
        state.visualizations_data_model.query_options.where.splice(index, 1);
    } else if (queryOption === 'GROUP BY') {
        if (state.visualizations_data_model.query_options.group_by.aggregate_functions.length > 1) {
            state.visualizations_data_model.query_options.group_by.aggregate_functions.splice(index, 1);
        } else {
            state.visualizations_data_model.query_options.group_by = {};
        }
    } else if (queryOption === 'ORDER BY') {
        state.visualizations_data_model.query_options.order_by.splice(index, 1);
    } else if (queryOption === 'HAVING') {
        state.visualizations_data_model.query_options.group_by.having_conditions.splice(index, 1);
    } else if (queryOption === 'OFFSET') {
        state.visualizations_data_model.query_options.offset = -1;
    } else if (queryOption === 'LIMIT') {
        state.visualizations_data_model.query_options.limit = -1;
    }
}
function buildSQLQuery() {
    let sqlQuery = '';
    let fromJoinClause = [];
    let dataTables = state.visualizations_data_model.columns.map((column) => `${column.schema}.${column.table_name}`);
    dataTables = _.uniq(dataTables);
    fromJoinClause.push(`FROM ${dataTables[0]}`);
    sqlQuery = `SELECT ${state.visualizations_data_model.columns.map((column) => {
        return `${column.column_name}`;
    }).join(', ')}`;
    
    state?.visualizations_data_model?.query_options?.group_by?.aggregate_functions?.forEach((aggregate_function) => {
        if (aggregate_function.aggregate_function !== '' && aggregate_function.column !== '') {
            sqlQuery += `, ${state.aggregate_functions[aggregate_function.aggregate_function]}(${aggregate_function.column})`;
        }
    });

    sqlQuery += ` ${fromJoinClause.join(' ')}`;

    //determining whether to save the value with single quotes or not depending on the data type of the column
    state.visualizations_data_model.query_options.where.forEach((clause) => {
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
        sqlQuery += ` GROUP BY ${state.visualizations_data_model.columns.map((column) => `${column.schema}.${column.table_name}.${column.column_name}`).join(', ')}`;
        state?.visualizations_data_model?.query_options?.group_by?.having_conditions?.forEach((clause) => {
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
    state.visualizations_data_model.query_options.order_by.forEach((clause, index) => {
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
async function executeQueryOnDataModels() {
    state.response_from_data_models_columns = [];
    state.response_from_data_models_rows = [];
    state.sql_query = buildSQLQuery();
    const token = getAuthToken();
    console.log('executeQueryOnDataModels', state.sql_query);
    const url = `${baseUrl()}/data-model/execute-query-on-data-model`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
        body: JSON.stringify({
            query: state.sql_query
        })
    });
    const data = await response.json();
    console.log('executeQueryOnDataModels data', data);
    state.response_from_data_models_rows = data;
}
async function saveVisualization() {
    let offsetStr = 'OFFSET 0';
    let limitStr = 'LIMIT 5';
    let sqlQuery = buildSQLQuery();

    if (state.visualizations_data_model.query_options.offset > -1) {
        offsetStr = `OFFSET ${state.visualizations_data_model.query_options.offset}`;
    } else {
        offsetStr = 'OFFSET 0';
    }
    if (state.visualizations_data_model.query_options.limit > -1) {
        limitStr = `LIMIT ${state.visualizations_data_model.query_options.limit}`;
    } else {
        limitStr = 'LIMIT 1000';
    }
    sqlQuery += ` ${offsetStr} ${limitStr}`;
    state.sql_query = sqlQuery;
    $swal.fire({
        icon: 'success',
        title: `Generated SQL Query!`,
        text: sqlQuery,
    });
    const { value: confirmDelete } = await $swal.fire({
        icon: "success",
        title: "SQL Query Generated!",
        html: `Your SQL query has been generated and is a follows:<br /><br /> <span style='font-weight: bold;'>${sqlQuery}</span><br /><br /> Do you want to proceed with this SQL query to build your visualization?`,
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, build my visualization now!",
    });
    if (!confirmDelete) {
        return;
    }
    //build the data model
    // const token = getAuthToken();
    // let url = `${baseUrl()}/data-source/build-data-model-on-query`;
    // if (props.isEditDataModel) {
    //     url = `${baseUrl()}/data-model/update-data-model-on-query`;
    // }
    // const response = await fetch(url, {
    //     method: "POST",
    //     headers: {
    //         "Content-Type": "application/json",
    //         "Authorization": `Bearer ${token}`,
    //         "Authorization-Type": "auth",
    //     },
    //     body: JSON.stringify({
    //         data_source_id: route.params.datasourceid,
    //         query: state.sql_query,
    //         query_json: JSON.stringify(state.visualizations_data_model),
    //         data_model_name: state.visualizations_data_model.table_name,
    //         data_model_id: props.isEditDataModel ? props.dataModel.id : null,
    //     })
    // });
    // if (response.status === 200) {
    //     router.push(`/projects/${route.params.projectid}/data-sources/${route.params.datasourceid}/data-models`);
    // } else {
    //     $swal.fire({
    //         icon: 'error',
    //         title: `Error! `,
    //         text: 'Unfortunately, we encountered an error! Please refresh the page and try again.',
    //     });
    // }
}

onMounted(async () => {
    state.headers = [];
    console.log('project', project.value);
    console.log('dataSources', dataSources.value);
    console.log('dataModels', dataModels.value);
    console.log('dataModelTables', dataModelTables.value);
    state.data_model_tables = []
    dataModelTables?.value?.forEach((dataModelTable) => {
        state.data_model_tables.push({
            schema: dataModelTable.schema,
            model_name: dataModelTable.table_name,
            cleaned_model_name: dataModelTable.table_name.replace(/_dra.[\w\d]+/g, ''),
            show_model: false,
            columns: dataModelTable.columns,
        })
    })
    console.log('state.data_model_tables', state.data_model_tables);
    console.log('route', route)
    console.log('dataModelTables?.length', dataModelTables?.value?.length)
});
</script>
<template>
    <div class="flex flex-row">
        <sidebar class="w-1/6" :data-models="state.data_model_tables" />
        <div class="flex flex-row w-5/6">
            <div class="flex flex-col w-5/6 ml-2 mr-2">
                <div class="flex flex-row justify-between">
                    <tabs :project-id="project.id"/>
                    <div class="flex flex-row">
                        <div @click="saveVisualization" class="flex flex-row items-center mr-2 mt-5 p-2 text-md text-white font-bold border border-white border-solid cursor-pointer select-none bg-primary-blue-100 hover:bg-primary-blue-400">
                            <h3 class="ml-2 mr-2">Save Visualization</h3>
                        </div>
                    </div>
                </div>   
                <div class="flex flex-col min-h-200 overflow-x-auto ml-10 mr-2 mb-10 border border-primary-blue-100 border-solid bg-gray-200">
                    <div class="w-full border border-gray-400 border-dashed h-10 flex flex-row justify-center items-center text-center font-bold text-gray-500">
                        Drag columns from the side bar given in the left into the area below to build your visualization.
                    </div>
                    <table v-if="state.chart_mode === 'table'" class="table-fixed table-striped">
                        <thead>
                            <draggable
                                v-model="state.visualizations_data_model.columns"
                                group="data_model_columns"
                                itemKey="column_name"
                                class="h-10 bg-primary-blue-100"
                                tag="tr"
                                @change="changeDataModel"
                            >
                                <template #item="{ element }">
                                    <th class="text-left text-sm font-bold text-white px-4 py-2 border-r-1 border-gray-200">
                                        <span class="cursor-pointer">
                                            {{ element.column_name}}
                                        </span>
                                        <font-awesome icon="fas fa-trash" class="text-md text-red-600 hover:text-red-400 cursor-pointer ml-1" @click="removeColumn(element)" />
                                    </th>
                                </template>
                            </draggable>
                        </thead>
                        <tbody>
                            <tr v-for="(row, index) in state.response_from_data_models_rows" :key="index" class="text-left text-sm font-bold text-gray-500 px-4 py-2" :class="{ 'bg-gray-100': index % 2 === 0, 'bg-white': index % 2 !== 0  }">
                                <td v-for="(column, index) in state.visualizations_data_model.columns" :key="index" class="text-left text-sm font-bold text-gray-500 px-4 py-2 border-r-1 border-gray-200">
                                    {{ row[column.column_name] }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-else-if="state.chart_mode === 'pie'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'donut'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'vertical_bar'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'horizontal_bar'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'vertical_bar_line'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'stacked_bar'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'multiline'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'heatmap'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'stacked_area'">
                        
                    </div>
                    <div v-else-if="state.chart_mode === 'map'">
                        
                    </div>
                    <div class="w-full flex flex-col p-5 mt-20">
                        <div class="flex flex-row">
                            <div v-if="showWhereClause" class="w-full flex flex-col mt-5 border border-gray-400 border-dashed p-2">
                                <h3 class="font-bold mb-2">Where</h3>
                                <div class="flex flex-col bg-gray-100 p-5">
                                    <div v-for="(clause, index) in state.visualizations_data_model.query_options.where" class="flex flex-row justify-between">
                                        <div v-if="index > 0" class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Condition</h5>
                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.condition">
                                                <option v-for="(condition, index) in state.condition" :key="index" :value="index">{{ condition }}</option>
                                            </select>
                                        </div>
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Column</h5>
                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column"  @change="whereColumnChanged">
                                                <option v-for="column in state.visualizations_data_model.columns" :key="`${column.schema}.${column.table_name}.${column.column_name}`" :value="`${column.schema}.${column.table_name}.${column.column_name}`">{{ `${column.schema}.${column.table_name}.${column.column_name}` }}</option>
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
                                        <div class="items-center self-center text-2xl text-red-500 hover:text-red-200 cursor-pointer mt-5 select-none" @click="removeQueryOption('WHERE', index)">
                                            <font-awesome icon="fas fa-minus"/>
                                        </div>
                                        <div v-if="index === state.visualizations_data_model.query_options.where.length - 1" class="items-center self-center text-2xl text-blue-500 hover:text-blue-200 cursor-pointer mt-5 select-none" @click="addQueryOption('WHERE')">
                                            <font-awesome icon="fas fa-plus"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="showGroupByClause" class="w-full flex flex-col mt-5 border border-gray-400 border-dashed p-2">
                                <h3 class="font-bold mb-2">Group By</h3>
                                <div class="flex flex-col bg-gray-100 p-5">
                                    <div v-for="(clause, index) in state.visualizations_data_model.query_options.group_by.aggregate_functions" class="flex flex-row justify-between">
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Aggregate Function</h5>
                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.aggregate_function" @change="aggregateFunctionChanged">
                                                <option v-for="(aggregate_function, index) in state.aggregate_functions" :key="index" :value="index">{{ aggregate_function }}</option>
                                            </select>
                                        </div>
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Column</h5>
                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column" @change="aggregateFunctionColumnChanged">
                                                <option v-for="column in state.visualizations_data_model.columns" :key="`${column.schema}.${column.table_name}.${column.column_name}`" :value="`${column.schema}.${column.table_name}.${column.column_name}`">{{ `${column.schema}.${column.table_name}.${column.column_name}` }}</option>
                                            </select>
                                        </div>
                                        <div class="items-center self-center text-2xl text-red-500 hover:text-red-200 cursor-pointer mt-5 select-none" @click="removeQueryOption('GROUP BY', index)">
                                            <font-awesome icon="fas fa-minus"/>
                                        </div>
                                        <div v-if="index === state.visualizations_data_model.query_options.group_by.aggregate_functions.length - 1" class="items-center self-center text-2xl text-blue-500 hover:text-blue-200 cursor-pointer mt-5 select-none" @click="addQueryOption('GROUP BY')">
                                            <font-awesome icon="fas fa-plus"/>
                                        </div>
                                    </div>
    
                                    <h4 v-if="state.visualizations_data_model.query_options.group_by.having_conditions.length" class="font-bold mt-2 mb-2">Having</h4>
                                    <div v-for="(clause, index) in state.visualizations_data_model.query_options.group_by.having_conditions" class="flex flex-row justify-between">
                                        <div v-if="index > 0" class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Condition</h5>
                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.condition">
                                                <option v-for="(condition, index) in state.condition" :key="index" :value="index">{{ condition }}</option>
                                            </select>
                                        </div>
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Column</h5>
                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column" @change="havingColumnChanged">
                                                <option v-for="column in state.visualizations_data_model.columns" :key="`${column.schema}.${column.table_name}.${column.column_name}`" :value="`${column.schema}.${column.table_name}.${column.column_name}`">{{ `${column.schema}.${column.table_name}.${column.column_name}` }}</option>
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
                                        <div class="items-center self-center text-2xl text-red-500 hover:text-red-200 cursor-pointer mt-5 select-none" @click="removeQueryOption('HAVING', index)">
                                            <font-awesome icon="fas fa-minus"/>
                                        </div>
                                        <div v-if="index === state.visualizations_data_model.query_options.group_by.having_conditions.length - 1" class="items-center self-center text-2xl text-blue-500 hover:text-blue-200 cursor-pointer mt-5 select-none" @click="addQueryOption('HAVING')">
                                            <font-awesome icon="fas fa-plus"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-row">
                            <div v-if="showOrderByClause" class="w-full flex flex-col mt-5 border border-gray-400 border-dashed p-2">
                                <h3 class="font-bold mb-2">Order By</h3>
                                <div class="flex flex-col bg-gray-100 p-5">
                                    <div v-for="(clause, index) in state.visualizations_data_model.query_options.order_by" class="flex flex-row justify-between">
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Column</h5>
                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.column">
                                                <option v-for="column in state.visualizations_data_model.columns" :key="`${column.schema}.${column.table_name}.${column.column_name}`" :value="`${column.schema}.${column.table_name}.${column.column_name}`">{{ `${column.schema}.${column.table_name}.${column.column_name}` }}</option>
                                            </select>
                                        </div>
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Order</h5>
                                            <select class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="clause.order">
                                                <option v-for="(order, index) in state.order" :key="index" :value="index">{{ order }}</option>
                                            </select>
                                        </div>
                                        <div class="items-center self-center text-2xl text-red-500 hover:text-red-200 cursor-pointer mt-5 select-none" @click="removeQueryOption('ORDER BY', index)">
                                            <font-awesome icon="fas fa-minus"/>
                                        </div>
                                        <div v-if="index === state.visualizations_data_model.query_options.order_by.length - 1" class="items-center self-center text-2xl text-blue-500 hover:text-blue-200 cursor-pointer mt-5 select-none" @click="addQueryOption('ORDER BY')">
                                            <font-awesome icon="fas fa-plus"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="state.visualizations_data_model.query_options.offset > -1" class="w-full flex flex-col mt-5 border border-gray-400 border-dashed p-2">
                                <h3 class="font-bold">Offset</h3>
                                <div class="flex flex-col bg-gray-100 p-5">
                                    <div class="flex flex-row justify-between">
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Value</h5>
                                            <div class="flex flex-row justify-between">
                                                <input type="number" class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="state.visualizations_data_model.query_options.offset" min="0" />
                                                <div class="items-center self-center text-2xl text-red-500 hover:text-red-200 cursor-pointer ml-2 select-none" @click="removeQueryOption('OFFSET', 0)">
                                                    <font-awesome icon="fas fa-minus"/>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-row">
                            <div v-if="state.visualizations_data_model.query_options.limit > -1" class="w-full flex flex-col mt-5 border border-gray-400 border-dashed p-2">
                                <h3 class="font-bold">Limit</h3>
                                <div class="flex flex-col bg-gray-100 p-5">
                                    <div class="flex flex-row justify-between">
                                        <div class="flex flex-col w-full mr-2">
                                            <h5 class="font-bold mb-2">Value</h5>
                                            <div class="flex flex-row justify-between">
                                                <input type="number" class="w-full border border-primary-blue-100 border-solid p-2 cursor-pointer" v-model="state.visualizations_data_model.query_options.limit" min="0" />
                                                <div class="items-center self-center text-2xl text-red-500 hover:text-red-200 cursor-pointer ml-2 select-none" @click="removeQueryOption('LIMIT', 0)">
                                                    <font-awesome icon="fas fa-minus"/>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-if="showDataModelControls" class="w-full border border-gray-400 border-dashed h-15 flex items-center justify-center cursor-pointer mt-5 hover:bg-gray-100 font-bold" @click="openDialog">
                            + Add Query Clause (for example: where, group by, order by)
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col w-1/6 mt-17 mb-10">
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('table')" v-tippy="{ content: 'Render Data in Table', placement: 'top' }">
                        <img src="/assets/images/table_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Table Chart" />
                    </div>
                    <div @click="selectChartType('pie')" v-tippy="{ content: 'Render Data in a Pie Chart', placement: 'top' }">
                        <img src="/assets/images/pie_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Pie Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('donut')" v-tippy="{ content: 'Render Data in a Donut Chart', placement: 'top' }">
                        <img src="/assets/images/donut_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Donut Chart" />
                    </div>
                    <div @click="selectChartType('vertical_bar')" v-tippy="{ content: 'Render Data in a Vertical Bar Chart', placement: 'top' }">
                        <img src="/assets/images/vertical_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Vertical Bar Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('horizontal_bar')" v-tippy="{ content: 'Render Data in a Horizontal Bar Chart', placement: 'top' }">
                        <img src="/assets/images/horizontal_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Horizontal Bar Chart" />
                    </div>
                    <div @click="selectChartType('vertical_bar_line')" v-tippy="{ content: 'Render Data in a Vertical Bar Line Chart', placement: 'top' }">
                        <img src="/assets/images/vertical_bar_chart_line.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Vertical Bar Line Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('stacked_bar')" v-tippy="{ content: 'Render Data in a Stacked Bar Chart', placement: 'top' }">
                        <img src="/assets/images/stacked_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Stacked Bar Chart" />
                    </div>    
                    <div @click="selectChartType('multiline')" v-tippy="{ content: 'Render Data in a Multiline Chart', placement: 'top' }">
                        <img src="/assets/images/multi_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Multiline Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('heatmap')" v-tippy="{ content: 'Render Data in a Heatmap Chart', placement: 'top' }">
                        <img src="/assets/images/heatmap_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Heatmap Chart" />
                    </div>
                    <div @click="selectChartType('bubble')" v-tippy="{ content: 'Render Data in a Bubble Chart', placement: 'top' }">
                        <img src="/assets/images/bubble_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Bubble Chart" />
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="mr-2" @click="selectChartType('stacked_area')" v-tippy="{ content: 'Render Data in a Stacked Area Chart', placement: 'top' }">
                        <img src="/assets/images/stacked_area_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Stacked Area Chart" />
                    </div>
                    <div @click="selectChartType('map')" v-tippy="{ content: 'Render Data in a Map', placement: 'top' }">
                        <img src="/assets/images/map_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Map Chart" />
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
    </div>
</template>