<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useVisualizationsStore } from '@/stores/visualizations';
import _ from 'lodash';
import { label } from 'happy-dom/lib/PropertySymbol.js';
import { toDisplayString } from 'vue';
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
    isChangingDimensions: false,
    initialWidth: 0,
    initialHeight: 0,
    initialX: 0,
    initialY: 0,
    previousX: 0,
    previousY: 0,
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
function selectChartType(chartType) {
    //table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, stacked_area, map
    state.chart_mode = chartType;
    const draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const div = document.createElement('div');
    div.classList.add('w-50');
    div.classList.add('h-50');
    div.classList.add('bg-blue-300');
    div.classList.add('cursor-pointer');
    div.classList.add('draggable-div');
    div.classList.add('absolute');
    div.classList.add('top-0');
    div.classList.add('left-0');
    
    const deleteSpan = document.createElement('div');
    deleteSpan.innerHTML = `Delete ${chartType} ${draggableDivContainer.childNodes.length}`;
    deleteSpan.style.userSelect = 'none';
    deleteSpan.addEventListener('click', (event) => {
        event.target.parentNode.removeEventListener('mousedown', () => {});
        draggableDivContainer.removeChild(event.target.parentNode);
    });
    div.appendChild(deleteSpan);
    draggableDivContainer.appendChild(div);
    div.addEventListener('mousedown', (event) => {
        // console.log('mousedown on div', event);
        if (event.target.tagName === 'DIV') {
            state.selectedDiv = event.target;
            state.offsetX = event.clientX - div.getBoundingClientRect().left;
            state.offsetY = event.clientY - div.getBoundingClientRect().top;
            state.initialX = state.offsetX;
            state.initialY = state.offsetY;
            console.log('state.offsetX', state.offsetX)
            console.log('state.offsetY', state.offsetY)
            state.selectedDiv.style.border = 'dashed 1px #000000';
            if (state.offsetX > div.getBoundingClientRect().width - 50 && state.offsetY > div.getBoundingClientRect().height - 50) {
                state.isChangingDimensions = true;
                div.style.cursor = 'nw-resize';
                state.isDragging = false;
            } else if (state.offsetX > 0 && state.offsetX < 10 && state.offsetY > div.getBoundingClientRect().height - 50) {
                state.isChangingDimensions = true;
                div.style.cursor = 'sw-resize';
                state.isDragging = false;
            } else {
                state.isChangingDimensions = false;
                div.style.cursor = 'move';
                state.isDragging = true;
            }
        }
    });

    div.addEventListener('mouseup', (event) => {
        div.style.cursor = 'pointer';
    });

    // div.addEventListener('mouseleave', (event) => {
    //     div.style.cursor = 'nw-resize';
    // });
    // div.addEventListener('mousemove', (event) => {
    //     // console.log('mousemove on div', event);
    //     state.offsetX = event.clientX - div.getBoundingClientRect().left;
    //     state.offsetY = event.clientY - div.getBoundingClientRect().top;
    //     // console.log('mousemove on div state.offset', state.offsetX, 'state.offsetY', state.offsetY);
    //     // console.log('width', div.getBoundingClientRect().width);
    //     // console.log('height', div.getBoundingClientRect().height);
    //     console.log(state.offsetX > div.getBoundingClientRect().width - 20 || state.offsetY > div.getBoundingClientRect().height - 20);
    //     if (state.offsetX > div.getBoundingClientRect().width - 20 || state.offsetY > div.getBoundingClientRect().height - 20) {
    //         state.isChangingDimensions = false;
    //         div.style.cursor = 'nw-resize';
    //     } else {
    //         state.isChangingDimensions = false;
    //         div.style.cursor = 'move';
    //     }
    // });
}
async function changeDataModel(event) {
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
    console.log('removeColumn column', column);
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
async function saveVisualization() {
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

    document.getElementsByClassName('draggable-div').forEach((div) => {
        div.addEventListener('mousedown', (event) => {
            // console.log('mousedown on div', event);
            if (event.target.tagName === 'DIV') {
                state.selectedDiv = event.target;
                state.offsetX = event.clientX - div.getBoundingClientRect().left;
                state.offsetY = event.clientY - div.getBoundingClientRect().top;
                state.initialX = state.offsetX;
                state.initialY = state.offsetY;
                state.selectedDiv.style.border = 'dashed 1px #000000';
                if (state.offsetX > div.getBoundingClientRect().width - 50 && state.offsetY > div.getBoundingClientRect().height - 50) {
                    state.isChangingDimensions = true;
                    div.style.cursor = 'nw-resize';
                    state.isDragging = false;
                } else {
                    state.isChangingDimensions = false;
                    div.style.cursor = 'move';
                    state.isDragging = true;
                }
            }
        });

        div.addEventListener('mouseup', (event) => {
            div.style.cursor = 'pointer';
            state.isChangingDimensions = false;
            state.isDragging = false;
        });
    });
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    draggableDivContainer.addEventListener('mouseenter', (event) => {
        state.xDiff = event.clientX
        state.yDiff = event.clientY
        // console.log('mouseenter state.xDiff', state.xDiff, 'state.yDiff', state.yDiff)
    })
    draggableDivContainer.addEventListener('mousemove', (event) => {
        let newX = event.clientX - draggableDivContainer.getBoundingClientRect().left - state.offsetX;
        let newY = event.clientY - draggableDivContainer.getBoundingClientRect().top - state.offsetY;
        if (state.isDragging && state.selectedDiv && state.selectedDiv.tagName === 'DIV') {
            // console.log('mousemove on container', event);
            // console.log('dragging', `${event.clientX}px`)
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
        } else {
            if (state.isChangingDimensions && state.selectedDiv && state.selectedDiv.tagName === 'DIV') {
                console.log('selectedDiv', state.selectedDiv.tagName)
                if (newX >= state.previousX && newY >= state.previousY) {
                    const newWidth = parseInt(state.selectedDiv.offsetWidth) + 1;
                    const newHeight = parseInt(state.selectedDiv.offsetHeight) + 1;
                    state.selectedDiv.style.width = `${newWidth}px`;
                    state.selectedDiv.style.height = `${newHeight}px`;
                } else {
                    const newWidth = parseInt(state.selectedDiv.offsetWidth) - 1;
                    const newHeight = parseInt(state.selectedDiv.offsetHeight) - 1;
                    state.selectedDiv.style.width = `${newWidth}px`;
                    state.selectedDiv.style.height = `${newHeight}px`;
                }
            }
        }

        state.previousX = newX;
        state.previousY = newY;

        // document.getElementsByClassName('draggable-div').forEach((div) => {
        //     const width = div.getBoundingClientRect().width;
        //     const height = event.clientY - div.getBoundingClientRect().height;
        //     const left = div.getBoundingClientRect().left;
        //     const top = event.clientY - div.getBoundingClientRect().top;
        //     console.log('dragable-div width', width, 'height', height, 'left', left, 'top', top);
        //     console.log('dragable-div width + left', width + left);
        // });
    })

     document.getElementsByClassName('draggable-div-container')[0].addEventListener('mouseup', (event) => {
        if (state.selectedDiv) {
            state.selectedDiv.style.border = 'none';
            state.selectedDiv = null
        }
        state.isDragging = false;
        state.isChangingDimensions = false;
    })
});
</script>
<template>
    <div class="flex flex-row">
        <sidebar class="w-1/6" :data-models="state.clkl" />
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
                        Drag columns from the side bar given in the left into the blue area below to build your visualization.
                    </div>
                    <div class="w-full h-full bg-gray-300 draggable-div-container relative">
                        <div class="w-50 h-50 flex flex-col justify-between bg-blue-300 cursor-pointer draggable-div absolute top-0 left-0" style="border: none; cursor: pointer;">
                            <div class="flex flex-row justify-between">
                                <img src="/assets/images/resize-corner.svg" class="w-[12px] rotate-180 select-none" alt="Resize Visualization" />
                                <img src="/assets/images/resize-corner.svg" class="w-[12px] rotate-270 select-none" alt="Resize Visualization" />
                            </div>
                            <div class="flex flex-col">
                                <div style="user-select: none;">Delete pie 0</div>
                            </div>
                            <div class="flex flex-row justify-between">
                                <img src="/assets/images/resize-corner.svg" class="w-[12px] rotate-90 select-none" alt="Resize Visualization" />
                                <img src="/assets/images/resize-corner.svg" class="w-[12px] select-none" alt="Resize Visualization" />
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
    </div>
</template>