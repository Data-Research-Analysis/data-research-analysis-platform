<script setup>
import { createVNode, render } from 'vue';
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useVisualizationsStore } from '@/stores/visualizations';
import _ from 'lodash';
import pie from '@/components/charts/pie-chart.vue';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const visualizationsStore = useVisualizationsStore();
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const state = reactive({
    data_model_tables: [],
    tables: [],
    visualizations_data_model: {
        table_name: '',
        columns: [],
    },
    sql_query: '',
    chart_mode: 'table',//table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, map
    response_from_data_models_columns: [],
    response_from_data_models_rows: [],
    show_dialog: false,
    pie_chart_data: [],
    selectedDiv: null,
    xDiff: 0,
    yDiff: 0,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    isResizing: false,
    activeHandle: '',
    initialWidth: 0,
    initialHeight: 0,
    initialX: 0,
    initialY: 0,
    previousX: 0,
    previousY: 0,
    startResizeX: 0,
    startResizeY: 0,
    charts: [],
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
const showQueryDialogButton = computed(() => {
    return showWhereClause.value || showOrderByClause.value || showGroupByClause.value
})
const showPieChart = computed(() => {
    return state.visualizations_data_model && state.visualizations_data_model.columns && state.visualizations_data_model.columns.length && state.visualizations_data_model.columns.length === 2 && state.pie_chart_data && state.pie_chart_data.length
})
async function changeDataModel(event) {
    console.log('changeDataModel', state.charts);
    // state.visualizations_data_model.columns = state.visualizations_data_model.columns.filter((column) => {
    //     if (state.visualizations_data_model.columns.filter((c) => c.column_name === column.column_name && c.table_name === column.table_name).length > 1) {
    //         return false;
    //     } else {
    //         return true;
    //     }
    // });
    // visualizationsStore.setColumnsAdded(state.visualizations_data_model.columns);
    // await executeQueryOnDataModels();
}
async function removeColumn(column) {
    const index = state.visualizations_data_model.columns.findIndex((header) => header.column_name === column.column_name);
    if (index !== -1) {
        state.visualizations_data_model.columns.splice(index, 1);
    }
    if (state.visualizations_data_model?.columns?.length) {
        await executeQueryOnDataModels();
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
    
    sqlQuery += ` ${fromJoinClause.join(' ')}`;    
    return sqlQuery;
}
async function executeQueryOnDataModels() {
    state.pie_chart_data = [];
    state.response_from_data_models_columns = [];
    state.response_from_data_models_rows = [];
    state.sql_query = buildSQLQuery();
    const token = getAuthToken();
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
    state.response_from_data_models_rows = data;
    const labelValues = [];
    const numericValues = [];
    state.response_from_data_models_rows.forEach((row) =>{
        const columns_data_types = state.visualizations_data_model.columns.filter((column) => Object.keys(row).includes(column.column_name)).map((column) => { return { column_name: column.column_name, data_type: column.data_type }});
        columns_data_types.forEach((column) => {
            if (column.data_type === 'character varying') {
                labelValues.push(row[column.column_name]); 
            } else if (column.data_type === 'bigint') {
                numericValues.push(parseInt(row[column.column_name]));
            }
        });
    });
    labelValues.forEach((label, index) => {
        state.pie_chart_data.push({
             label: label,
             value: numericValues[index],
         });
    });
    console.log('state.pie_chart_data', state.pie_chart_data);
}
async function saveDashboard() {
    let sqlQuery = buildSQLQuery();
    state.sql_query = sqlQuery;
    // // build the data model
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
function initializeResizeParams(event) {
    state.isResizing = true;
    state.isDragging = false;
    state.startResizeX = event.clientX;
    state.startResizeY = event.clientY;
    state.selectedDiv = event.target.parentNode.parentNode;
    state.initialWidth = state.selectedDiv.offsetWidth;
    state.initialHeight = state.selectedDiv.offsetHeight;
}
function draggableDivMouseDown(event) {
    stopResize();
    const div = event.target;
    state.isDragging = true;
    state.isResizing = false;
    if (div.classList.contains('draggable-model-columns') || div.classList.contains('top-corners') || div.classList.contains('bottom-corners')) {
        state.selectedDiv = div.parentNode.parentNode;
        state.selectedDiv.style.cursor = 'move';
        state.offsetX = event.clientX - div.getBoundingClientRect().left;
        state.offsetY = event.clientY - div.getBoundingClientRect().top;
        state.initialX = state.offsetX;
        state.initialY = state.offsetY;
        document.addEventListener('mousemove', onDrag);
    }
}
function draggableDivMouseMove(event) {
    const div = event.target;
    if (div.classList.contains('draggable-model-columns')) {
        div.parentNode.parentNode.style.cursor = 'move';
    } else if(div.classList.contains('top-corners') || div.classList.contains('bottom-corners')) {
        div.parentNode.style.cursor = 'move';
    } else if (div.classList.contains('draggable-div')) {
        div.style.cursor = 'move';
    }
}
function draggableDivMouseUp(event) {
    if (state.isDragging) {
        stopDrag()
    } else {
        if (state.isResizing) {
            stopResize()
        }
    }
}
function draggableDivMouseLeave(event) {
    const div = event.target;
    if (div.classList.contains('draggable-div')) {
        div.style.cursor = 'pointer';
    }
}
function topLeftCornerMouseDown(event) {
    stopDrag();
    stopResize();
}
function topLeftCornerMouseMove(event) {
    initializeResizeParams(event);
    state.activeHandle = 'TL';
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const containerRect = draggableDivContainer.getBoundingClientRect();
    const boxRect = state.selectedDiv.getBoundingClientRect();
    const fixedBottom = containerRect.bottom - boxRect.bottom;
    const fixedRight = containerRect.width - (boxRect.left - containerRect.left + boxRect.width);
    state.selectedDiv.style.bottom = `${fixedBottom}px`;
    state.selectedDiv.style.right = `${fixedRight}px`;
    state.selectedDiv.style.left = 'auto';
    state.selectedDiv.style.top = 'auto';
    state.selectedDiv.style.cursor = 'nw-resize';
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}
function topLeftCornerMouseUp(event) {
    stopDrag();
    stopResize();
}
function topRightCornerMouseDown(event) {
    stopDrag();
    stopResize();
}
function topRightCornerMouseMove(event) {
    initializeResizeParams(event);
    state.activeHandle = 'TR';
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const containerRect = draggableDivContainer.getBoundingClientRect();
    const boxRect = state.selectedDiv.getBoundingClientRect();
    const fixedBottom = containerRect.bottom - boxRect.bottom;
    const fixedLeft = boxRect.left - containerRect.left;
    state.selectedDiv.style.bottom = `${fixedBottom}px`;
    state.selectedDiv.style.left = `${fixedLeft}px`;
    state.selectedDiv.style.right = 'auto';
    state.selectedDiv.style.top = 'auto';
    state.selectedDiv.style.cursor = 'nesw-resize';
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}
function topRightCornerMouseUp(event) {
    stopDrag();
    stopResize();
}
function bottomLeftCornerMouseDown(event) {
    stopDrag();
    stopResize();
}
function bottomLeftCornerMouseMove(event) {
    initializeResizeParams(event);
    state.activeHandle = 'BL';
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const containerRect = draggableDivContainer.getBoundingClientRect();
    const boxRect = state.selectedDiv.getBoundingClientRect();
    const fixedTop = boxRect.top - containerRect.top;
    const fixedRight = containerRect.width - (boxRect.left - containerRect.left + boxRect.width);
    state.selectedDiv.style.top = `${fixedTop}px`;
    state.selectedDiv.style.right = `${fixedRight}px`;
    state.selectedDiv.style.left = 'auto';
    state.selectedDiv.style.bottom = 'auto';
    state.selectedDiv.style.cursor = 'nesw-resize';
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}
function bottomLeftCornerMouseUp(event) {
    stopDrag();
    stopResize();
}
function bottomRightCornerMouseDown(event) {
    stopDrag();
    stopResize();
}
function bottomRightCornerMouseMove(event) {
    initializeResizeParams(event);
    state.activeHandle = 'BR';
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const containerRect = draggableDivContainer.getBoundingClientRect();
    const boxRect = state.selectedDiv.getBoundingClientRect();
    const fixedTop = boxRect.top - containerRect.top;
    const fixedLeft = boxRect.left - containerRect.left;
    state.selectedDiv.style.top = `${fixedTop}px`;
    state.selectedDiv.style.left = `${fixedLeft}px`;
    state.selectedDiv.style.right = 'auto';
    state.selectedDiv.style.bottom = 'auto';
    state.selectedDiv.style.cursor = 'nwse-resize';
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}
function bottomRightCornerMouseUp(event) {
    stopDrag();
    stopResize();
}
function selectChartType(chartType) {
    //table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, stacked_area, map
    state.chart_mode = chartType;
    state.charts.push({
        chart_type: chartType,
        chart_id: state.charts.length + 1,
        columns: [],
        table_name: '',
        data: [[{label: 'label1', value: 10,},{label: 'label2', value: 30,}]],
    });
}
function onDrag(event) {
    if (state.isDragging && state.selectedDiv) {
        let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
        let newX = event.clientX - draggableDivContainer.getBoundingClientRect().left - state.offsetX;
        let newY = event.clientY - draggableDivContainer.getBoundingClientRect().top - state.offsetY;       
        const windowWidth = draggableDivContainer.clientWidth;
        const windowHeight = draggableDivContainer.clientHeight;
        const draggableWidth = state.selectedDiv.clientWidth;
        const draggableHeight = state.selectedDiv.clientHeight;
        if (newX < 0) {
            newX = 0
        } else if (newX + draggableWidth > windowWidth) {
            newX = windowWidth - draggableWidth;
        }
        if (newY < 0) {
            newY = 0
        } else if (newY + draggableHeight > windowHeight) {
            newY = windowWidth - draggableHeight;
        }
        state.selectedDiv.style.left = `${newX}px`;
        state.selectedDiv.style.top = `${newY}px`;
    }
}
function stopDrag(event) {
    if (state.selectedDiv) {
        state.selectedDiv.style.cursor = 'pointer';
    }
    state.selectedDiv = null;
    state.isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}
function onResize(event) {
    if (state.isResizing && state.selectedDiv) {
        const deltaX = event.clientX - state.startResizeX;
        const deltaY = event.clientY - state.startResizeY;
        let newWidth;
        let newHeight;

        if (state.activeHandle === 'TL') {
            newWidth = state.initialWidth - deltaX;
            newHeight = state.initialHeight - deltaY;

        } else if (state.activeHandle === 'TR') {
            newWidth = state.initialWidth + deltaX;
            newHeight = state.initialHeight - deltaY;

        } else if (state.activeHandle === 'BL') {
            newWidth = state.initialWidth - deltaX;
            newHeight = state.initialHeight + deltaY;

        } else if (state.activeHandle === 'BR') {
            newWidth = state.initialWidth + deltaX;
            newHeight = state.initialHeight + deltaY;
        }
        // Ensure minimum width and height
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(50, newHeight);
        state.selectedDiv.style.width = `${newWidth}px`;
        state.selectedDiv.style.height = `${newHeight}px`;
    }
}
function stopResize(event) {
    if (state.selectedDiv) {
        state.selectedDiv.style.cursor = 'pointer';
    }
    state.selectedDiv = null;
    state.isResizing = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
}
onMounted(async () => {
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
                        <div @click="saveDashboard" class="flex flex-row items-center mr-2 mt-5 p-2 text-md text-white font-bold border border-white border-solid cursor-pointer select-none bg-primary-blue-100 hover:bg-primary-blue-400">
                            <h3 class="ml-2 mr-2">Save Dashboard</h3>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col min-h-200 overflow-x-auto ml-10 mr-2 mb-10 border border-primary-blue-100 border-solid bg-gray-200">
                    <component :is="pie" chart-id="1" :data="[{label: 'label1', value: 10,},{label: 'label2', value: 30,}]" :width="400" :height="400" class="mt-5"/>
                    <div class="w-full border border-gray-400 border-dashed h-10 flex flex-row justify-center items-center text-center font-bold text-gray-500">
                        Drag columns from the side bar given in the left into the blue area below to build your visualization.
                    </div>
                    <div class="w-full h-full bg-gray-300 draggable-div-container relative">
                        <div v-for="(chart, index) in state.charts"
                            class="w-50 h-50 flex flex-col justify-between bg-gray-400 cursor-pointer draggable-div absolute top-0 left-0"
                            @mousedown="draggableDivMouseDown"
                            @mousemove="draggableDivMouseMove"
                            @mouseup="draggableDivMouseUp"
                            @mouseleave="draggableDivMouseLeave"                       
                        >
                            <div class="flex flex-row justify-between bg-gray-400 top-corners">
                                <img
                                    src="/assets/images/resize-corner.svg"
                                    class="w-[12px] rotate-180 select-none top-left-corner"
                                    alt="Resize Visualization"
                                    @mousedown="topLeftCornerMouseDown"
                                    @mousemove="topLeftCornerMouseMove"
                                    @mouseup="topLeftCornerMouseUp"
                                />
                                <img
                                    src="/assets/images/resize-corner.svg"
                                    class="w-[12px] rotate-270 select-none top-right-corner"
                                    alt="Resize Visualization"
                                    @mousedown="topRightCornerMouseDown"
                                    @mousemove="topRightCornerMouseMove"
                                    @mouseup="topRightCornerMouseUp"
                                />
                            </div>
                            <div class="flex flex-col">
                                <draggable
                                    :id="`${chart.chart_id}`"
                                    v-model="chart.columns"
                                    group="data_model_columns"
                                    itemKey="column_name"
                                    class="flex flex-row w-full h-40 bg-gray-400 draggable-model-columns"
                                    tag="tr"
                                    @mousedown="draggableDivMouseDown"
                                    @change="changeDataModel"
                                >
                                    <template #item="{ element, index }">
                                        <div v-if="index === 0" class="text-left font-bold text-white px-4 py-2 border-r-1 border-gray-200">
                                            <div v-if="showPieChart" class="flex flex-col">
                                                <div class="flex flex-col justify-center">
                                                    <pie-chart
                                                        chart-id="1"
                                                        :data="chart.data"
                                                        :width="1200"
                                                        :height="1200"
                                                        class="mt-5"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </draggable>
                            </div>
                            <div class="flex flex-row justify-between bg-gray-400 bottom-corners">
                                <img 
                                    src="/assets/images/resize-corner.svg"
                                    class="w-[12px] rotate-90 select-none bottom-left-corner"
                                    alt="Resize Visualization"
                                    @mousedown="bottomLeftCornerMouseDown"
                                    @mousemove="bottomLeftCornerMouseMove"
                                    @mouseup="bottomLeftCornerMouseUp"
                                />
                                <img
                                    src="/assets/images/resize-corner.svg"
                                    class="w-[12px] select-none bottom-right-corner"
                                    alt="Resize Visualization"
                                    @mousedown="bottomRightCornerMouseDown"
                                    @mousemove="bottomRightCornerMouseMove"
                                    @mouseup="bottomRightCornerMouseUp"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col w-1/6 mt-17 mb-10">
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('table')" v-tippy="{ content: 'Render Data in Table', placement: 'top' }">
                        <img src="/assets/images/table_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Table Chart" />
                    </div>
                    <div @click="selectChartType('pie')" v-tippy="{ content: 'Render Data in a Pie Chart', placement: 'top' }">
                        <img src="/assets/images/pie_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Pie Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('donut')" v-tippy="{ content: 'Render Data in a Donut Chart', placement: 'top' }">
                        <img src="/assets/images/donut_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Donut Chart" />
                    </div>
                    <div @click="selectChartType('vertical_bar')" v-tippy="{ content: 'Render Data in a Vertical Bar Chart', placement: 'top' }">
                        <img src="/assets/images/vertical_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Vertical Bar Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('horizontal_bar')" v-tippy="{ content: 'Render Data in a Horizontal Bar Chart', placement: 'top' }">
                        <img src="/assets/images/horizontal_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Horizontal Bar Chart" />
                    </div>
                    <div @click="selectChartType('vertical_bar_line')" v-tippy="{ content: 'Render Data in a Vertical Bar Line Chart', placement: 'top' }">
                        <img src="/assets/images/vertical_bar_chart_line.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Vertical Bar Line Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('stacked_bar')" v-tippy="{ content: 'Render Data in a Stacked Bar Chart', placement: 'top' }">
                        <img src="/assets/images/stacked_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Stacked Bar Chart" />
                    </div>    
                    <div @click="selectChartType('multiline')" v-tippy="{ content: 'Render Data in a Multiline Chart', placement: 'top' }">
                        <img src="/assets/images/multi_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Multiline Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="selectChartType('heatmap')" v-tippy="{ content: 'Render Data in a Heatmap Chart', placement: 'top' }">
                        <img src="/assets/images/heatmap_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Heatmap Chart" />
                    </div>
                    <div @click="selectChartType('bubble')" v-tippy="{ content: 'Render Data in a Bubble Chart', placement: 'top' }">
                        <img src="/assets/images/bubble_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Bubble Chart" />
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="mr-2" @click="selectChartType('stacked_area')" v-tippy="{ content: 'Render Data in a Stacked Area Chart', placement: 'top' }">
                        <img src="/assets/images/stacked_area_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Stacked Area Chart" />
                    </div>
                    <div @click="selectChartType('map')" v-tippy="{ content: 'Render Data in a Map', placement: 'top' }">
                        <img src="/assets/images/map_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Map Chart" />
                    </div>
                </div>
            </div>
        </div>
        <img src="/assets/images/resize-corner.svg" id="corner-image" class="bottom-right-corner-resize w-[15px] select-none hidden" alt="Resize Visualization" />
    </div>
</template>