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
watch(() => state.visualizations_data_model.query_options, async (value) => {
    // await executeQueryOnExternalDataSource();
}, { deep: true })
// watch (
//     state,
//     async (value, oldValue) => {
//         console.log('watch state', value, oldValue);
//     },
// );
function selectChartType(chartType) {
    //table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, stacked_area, map
    state.chart_mode = chartType;
    console.log('chart mode', state.chart_mode);
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
function buildSQLQuery() {
    let sqlQuery = '';
    let fromJoinClause = [];
    let dataTables = state.visualizations_data_model.columns.map((column) => `${column.schema}.${column.table_name}`);
  
    let fromJoinClauses = [];
    const tableCombinations = [];
    dataTables = _.uniq(dataTables);
    if (dataTables.length === 1) {
        fromJoinClause.push(`FROM ${dataTables[0]}`);
        sqlQuery = `SELECT ${state.visualizations_data_model.columns.map((column) => {
            return `${column.column_name}`;
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

        sqlQuery = `SELECT ${state.visualizations_data_model.columns.map((column) => {
            const aliasName = column?.alias_name !== '' ? column.alias_name : `${column.schema}_${column.table_name}_${column.column_name}`;
            return `${column.schema}.${column.table_name}.${column.column_name} AS ${aliasName}`;
        }).join(', ')}`;
    }

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
                    <div @click="saveVisualization" class="flex flex-row items-center mr-2 mt-5 p-2 text-md text-white font-bold cursor-pointer select-none bg-primary-blue-100 hover:bg-primary-blue-400">
                        <h3 class="ml-2 mr-2">Save Visualization</h3>
                    </div>
                </div>
                <div class="flex flex-col min-h-100 overflow-x-auto ml-10 mr-2 mb-10 border border-primary-blue-100 border-solid bg-gray-200">
                    <div class="w-full border border-gray-400 border-dashed h-10 flex flex-row justify-center items-center text-center font-bold text-gray-500">
                        Drag columns from the side bar given in the left into the dark gray area below to build your visualization.
                    </div>

                    <table class="table-fixed table-striped">
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
                                        <!-- <div class="flex flex-row items-center w-50 text-left text-white font-bold text-md p-2 bg-primary-blue-100 border-r-1 border-gray-200"> -->
                                            <span class="cursor-pointer">
                                                {{ element.column_name}}
                                            </span>
                                            <font-awesome icon="fas fa-trash" class="text-md text-red-600 hover:text-red-400 cursor-pointer ml-1" @click="removeColumn(element)" />
                                        <!-- </div> -->
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
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 w-1/6 mt-17 mb-10">
                <div @click="selectChartType('table')" v-tippy="{ content: 'Render Data in Table', placement: 'top' }">
                    <img src="/assets/images/table_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Table Chart" />
                </div>
                <div @click="selectChartType('pie')" v-tippy="{ content: 'Render Data in a Pie Chart', placement: 'top' }">
                    <img src="/assets/images/pie_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Pie Chart" />
                </div>
                <div @click="selectChartType('vertical_bar')" v-tippy="{ content: 'Render Data in a Vertical Bar Chart', placement: 'top' }">
                    <img src="/assets/images/vertical_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Vertical Bar Chart" />
                </div>
                <div @click="selectChartType('horizontal_bar')" v-tippy="{ content: 'Render Data in a Horizontal Bar Chart', placement: 'top' }">
                    <img src="/assets/images/horizontal_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Horizontal Bar Chart" />
                </div>
                <div @click="selectChartType('vertical_bar_line')" v-tippy="{ content: 'Render Data in a Vertical Bar Line Chart', placement: 'top' }">
                    <img src="/assets/images/vertical_bar_chart_line.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Vertical Bar Line Chart" />
                </div>
                <div @click="selectChartType('stacked_bar')" v-tippy="{ content: 'Render Data in a Stacked Bar Chart', placement: 'top' }">
                    <img src="/assets/images/stacked_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Stacked Bar Chart" />
                </div>
                <div @click="selectChartType('multiline')" v-tippy="{ content: 'Render Data in a Multiline Chart', placement: 'top' }">
                    <img src="/assets/images/multi_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Multiline Chart" />
                </div>
                <div @click="selectChartType('heatmap')" v-tippy="{ content: 'Render Data in a Heatmap Chart', placement: 'top' }">
                    <img src="/assets/images/heatmap_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Heatmap Chart" />
                </div>
                <div @click="selectChartType('bubble')" v-tippy="{ content: 'Render Data in a Bubble Chart', placement: 'top' }">
                    <img src="/assets/images/bubble_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Bubble Chart" />
                </div>
                <div @click="selectChartType('stacked_area')" v-tippy="{ content: 'Render Data in a Stacked Area Chart', placement: 'top' }">
                    <img src="/assets/images/stacked_area_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Stacked Area Chart" />
                </div>
                <div @click="selectChartType('map')" v-tippy="{ content: 'Render Data in a Map', placement: 'top' }">
                    <img src="/assets/images/map_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Map Chart" />
                </div>
            </div>
        </div>
    </div>

</template>