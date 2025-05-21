<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import _ from 'lodash';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const route = useRoute();
const state = reactive({
    data_model_tables: [{
        id: 1,
        schema: 'public',
        model_name: 'model1',
        show_model: false,
        columns: [
            {
                id: 1,
                schema: 'public',
                table_name: 'table1',
                column_name: 'column1',
                data_type: 'string',
            },
            {
                id: 2,
                schema: 'public',
                table_name: 'table1',
                column_name: 'column2',
                data_type: 'string',
            },
            {
                id: 3,
                schema: 'public',
                table_name: 'table1',
                column_name: 'column3',
                data_type: 'string',
            }
        ]
    },
    {
        id: 2,
        schema: 'public',
        model_name: 'model2',
        show_model: false,
        columns: [
            {
                id: 1,
                schema: 'public',
                table_name: 'table1',
                column_name: 'column1',
                data_type: 'string',
            },
            {
                id: 2,
                schema: 'public',
                table_name: 'table1',
                column_name: 'column2',
                data_type: 'string',
            },
            {
                id: 3,
                schema: 'public',
                table_name: 'table1',
                column_name: 'column3',
                data_type: 'string',
            }
        ]
    }],
    visualizations_data_model: [],
    headers: [],
    chart_mode: 'table',//table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, map
 });
 const project = computed(() => {
    return projectsStore.getSelectedProject();
});
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
function changeModel(event) {
    console.log('changeModel event', event);
    // state.headers.push(event.added.element.column_name);
    
    console.log('state.headers', state.headers);
    state.headers = _.uniqBy(state.headers, 'column_name');
    console.log('state.headers after', state.headers);
}
onMounted(async () => {
    state.headers = [];
    console.log('project', project.value);
    const dataSources = dataSourceStore.getDataSources();
    const dataModels = dataModelsStore.getDataModels();
    const dataModelTables = dataModelsStore.getDataModelTables();
    console.log('dataSources', dataSources);
    console.log('dataModels', dataModels);
    console.log('dataModelTables', dataModelTables);
    state.data_model_tables = []
    dataModelTables.forEach((dataModelTable) => {
        state.data_model_tables.push({
            schema: dataModelTable.schema,
            model_name: dataModelTable.table_name,
            cleaned_model_name: dataModelTable.table_name.replace(/_dra.[\w\d]+/g, ''),
            show_model: false,
            columns: dataModelTable.columns,
        })
    })
    console.log('state.data_model_tables', state.data_model_tables);
});
</script>
<template>
    <div class="flex flex-row">
        <sidebar class="w-1/6" :data-models="state.data_model_tables" />
        <div class="flex flex-col w-4/6 ml-2 mr-2">
            <tabs :project-id="project.id"/>
            <div class="flex flex-col min-h-100 ml-10 mr-2 mb-10 border border-primary-blue-100 border-solid">
                <table class="w-full min-h-100 table bg-gray-100">
                    <thead>
                        <tr class="bg-gray-200">
                            <draggable
                                :list="state.headers"
                                group="data_model_columns"
                                itemKey="column_name"
                                class="bg-gray-200 h-100 w-full"
                                @change="changeModel"
                            >
                                <template #item="{ element }">
                                    <th class="text-left text-gray-500 font-bold text-sm p-2 border-b border-gray-200">
                                        {{ element.column_name}}
                                    </th>
                                </template>
                            </draggable>
                        </tr>                    
                    </thead>
                </table>
                
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2 w-1/6 mt-17 mb-10">
            <div @click="selectChartType('table')">
                <img src="/assets/images/table_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Table Chart" />
            </div>
            <div @click="selectChartType('pie')">
                <img src="/assets/images/pie_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Pie Chart" />
            </div>
            <div @click="selectChartType('vertical_bar')">
                <img src="/assets/images/vertical_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Vertical Bar Chart" />
            </div>
            <div @click="selectChartType('horizontal_bar')">
                <img src="/assets/images/horizontal_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Horizontal Bar Chart" />
            </div>
            <div @click="selectChartType('vertical_bar_line')">
                <img src="/assets/images/vertical_bar_chart_line.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Vertical Bar Line Chart" />
            </div>
            <div @click="selectChartType('stacked_bar')">
                <img src="/assets/images/stacked_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Stacked Bar Chart" />
            </div>
            <div @click="selectChartType('multiline')">
                <img src="/assets/images/multi_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Multiline Chart" />
            </div>
            <div @click="selectChartType('heatmap')">
                <img src="/assets/images/heatmap_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Heatmap Chart" />
            </div>
            <div @click="selectChartType('bubble')">
                <img src="/assets/images/bubble_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Bubble Chart" />
            </div>
            <div @click="selectChartType('stacked_area')">
                <img src="/assets/images/stacked_area_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Stacked Area Chart" />
            </div>
            <div @click="selectChartType('map')">
                <img src="/assets/images/map_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-100" alt="Map Chart" />
            </div>
        </div>
    </div>

</template>