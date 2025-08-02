<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import _ from 'lodash';
const projectsStore = useProjectsStore();
const dataModelsStore = useDataModelsStore();
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const state = reactive({
    data_model_tables: [],
    sql_queries: [],
    chart_mode: 'table',//table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, map
    response_from_data_models_columns: [],
    response_from_data_models_rows: [],
    show_dialog: false,
    pie_chart_data: [],
    selected_div: null,
    selected_chart: null,
    offsetX: 0,
    offsetY: 0,
    is_dragging: false,
    is_resizing: false,
    is_mouse_down: false,
    active_handle: '',
    initial_width: 0,
    initial_height: 0,
    initial_width_draggable: 0,
    initial_height_draggable: 0,
    start_resize_x: 0,
    start_resize_y: 0,
    dashboard: {
        charts: [],
    },
    previous_deltax: 0,
    previous_deltay: 0,
    scaleWidth: 1,
    scaleHeight: 1,
 });
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dataModelTables = computed(() => {
    return dataModelsStore.getDataModelTables();
});
async function changeDataModel(event, chartId) {
    const chart = state.dashboard.charts.find((chart) => {
        return chart.chart_id === chartId;
    });
    chart.columns = chart.columns.filter((column) => {
        if (chart.columns.filter((c) => c.column_name === column.column_name && c.table_name === column.table_name).length > 1) {
            return false;
        } else {
            return true;
        }
    });    
    await executeQueryOnDataModels(chartId);
}
async function updateDataModel(action, data) {
    if (action === 'add') {
        const dataModel = state.data_model_tables.find((dataModelTable) => dataModelTable.model_name === data.table_name);
        if (dataModel){
            const column = dataModel.columns.find((column) => column.column_name === data.column_name);
            if (column) {
                if (!state.selected_chart.columns.find((c) => c.column_name === column.column_name && c.table_name === column.table_name)) {
                    state.selected_chart.columns.push({...column});
                }
            }
        }
    } else if (action === 'remove') {
        state.selected_chart.columns = state.selected_chart.columns.filter((column) => {
            return !(column.table_name === data.table_name && column.column_name === data.column_name);
        })
    }
    if (state.selected_chart && state.selected_chart.columns.length) {
        await executeQueryOnDataModels(state.selected_chart.chart_id);
    }
}
function addChartToDashboard(chartType) {
    //table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, stacked_area, map
    state.selected_chart = null;
    state.selected_div = null;
    state.is_dragging = false;
    state.is_resizing = false;
    if (state.dashboard.charts.length > 4) {
        $swal.fire({
            icon: 'error',
            title: 'Error!',
            text: 'You can only add a maximum of 5 charts to the dashboard.',
        });
        return;
    }
    state.dashboard.charts.forEach((chart) => {
        chart.config.drag_enabled = false;
        chart.config.resize_enabled = false;
        chart.config.add_columns_enabled = false;
    });
    state.chart_mode = chartType;
    state.dashboard.charts.push({
        x_axis_label: 'X Axis',
        y_axis_label: 'Y Axis',
        chart_type: chartType,
        chart_id: state.dashboard.charts.length + 1,
        columns: [],
        table_name: '',
        data: [],
        text_editor: {
            content: '',
        },
        config: {
            drag_enabled: false,
            resize_enabled: false,
            add_columns_enabled: false,
        },
        dimensions: {
            width: '200px',
            height: '200px',
            widthDraggable: '200px',
            heightDraggable: '200px',
        },
        location: {
            top: '0px',
            left: '0px',
        },
    });
}
function deleteChartFromDashboard(chartId) {
    state.dashboard.charts = state.dashboard.charts.filter((chart) => chart.chart_id !== chartId);
    state.selected_chart = null;
}
function buildSQLQuery(chart) {
    let sqlQuery = '';
    let fromJoinClause = [];
    let dataTables = chart.columns.map((column) => `${column.schema}.${column.table_name}`);
    dataTables = _.uniq(dataTables);
    fromJoinClause.push(`FROM ${dataTables[0]}`);
    sqlQuery = `SELECT ${chart.columns.map((column) => {
        return `${column.column_name}`;
    }).join(', ')}`;
    sqlQuery += ` ${fromJoinClause.join(' ')}`;    
    return sqlQuery;
}
async function executeQueryOnDataModels(chartId) {
    state.response_from_data_models_columns = [];
    state.response_from_data_models_rows = [];
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId)
    if (chart) {
        //remove existing sql query
        chart.data = [];
        state.sql_queries = state.sql_queries.filter((query) => query.chart_id !== chartId);
        state.sql_queries.push({
            chart_id: chartId,
            sql_query: buildSQLQuery(chart)
        });
        console.log('executeQueryOnDataModels state.sql_queries', state.sql_queries);
        for (let i=0; i< state.sql_queries.length; i++) {
            const sqlQuery = state.sql_queries[i].sql_query;
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
                    query: sqlQuery
                })
            });
            const data = await response.json();
            console.log('executeQueryOnDataModels data', data);   
            state.response_from_data_models_rows = data;
            const labelValues = [];
            const numericValues = [];
            state.response_from_data_models_rows.forEach((row) =>{
                const columns_data_types = chart.columns.filter((column) => Object.keys(row).includes(column.column_name)).map((column) => { return { column_name: column.column_name, data_type: column.data_type }});
                columns_data_types.forEach((column) => {
                    if (column.data_type.includes('character varying') ||
                        column.data_type.includes('varchar') ||
                        column.data_type.includes('character') ||
                        column.data_type.includes('char') ||
                        column.data_type.includes('bpchar') ||
                        column.data_type.includes('text') ||
                        column.data_type.includes('USER-DEFINED')

                    ) {
                        labelValues.push(row[column.column_name]); 
                    } else if (
                            column.data_type === 'smallint' ||
                            column.data_type === 'bigint'  ||
                            column.data_type === 'integer' ||
                            column.data_type === 'numeric' ||
                            column.data_type === 'decimal' || 
                            column.data_type === 'real' ||
                            column.data_types === 'double precision' ||
                            column.data_types === 'small serial' ||
                            column.data_types === 'serial' ||
                            column.data_types === 'bigserial'
                        ) {
                        numericValues.push(parseInt(row[column.column_name]));
                    }
                });
            });
            console.log('executeQueryOnDataModels labelValues', labelValues, 'numericValues', numericValues);
            labelValues.forEach((label, index) => {
                console.log('executeQueryOnDataModels labelValues', label, 'value', numericValues[index]);
                chart.data.push({
                     label: label,
                     value: numericValues[index],
                 });
            });
        }
    }
    console.log('executeQueryOnDataModels state.dashboard.charts', state.dashboard.charts);
}
async function saveDashboard() {
    const token = getAuthToken();
    let url = `${baseUrl()}/dashboard/add`;
    for (let i=0; i <state.dashboard.charts.length; i++) {
        const chart = state.dashboard.charts[i];
        chart.config.drag_enabled = false;
        chart.config.resize_enabled = false;
        chart.config.add_columns_enabled = false;
    }
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
        body: JSON.stringify({
            project_id: project.value.id,
            data: state.dashboard,
        })
    });
    if (response.status === 200) {
        $swal.fire({
            icon: 'success',
            title: `Success! `,
            text: 'The dashboard has been sucessfully saved.',
        });
        router.push(`/projects/${route.params.projectid}/dashboards`);
    } else {
        $swal.fire({
            icon: 'error',
            title: `Error! `,
            text: 'Unfortunately, we encountered an error! Please refresh the page and try again.',
        });
    }
}
function updateContent(content, chartId) {
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    if (chart) {
        chart.text_editor.content = content;
    }
}
function toggleDragging(event, chartId) {
    //disable all charts
    state.is_dragging = false;
    state.is_resizing = false;
    state.dashboard.charts.forEach((chart) => {
        if (chart.chart_id !== chartId) {
            chart.config.drag_enabled = false;
            chart.config.resize_enabled = false;
            chart.config.add_columns_enabled = false;
        }
    });
    //enable target chart
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    if (chart) {
        chart.config.drag_enabled = !chart.config.drag_enabled;
        chart.config.resize_enabled = false;
        chart.config.add_columns_enabled = false;
        if (chart.config.drag_enabled) {
            state.selected_chart = chart;
        } else {
            state.selected_chart = null;
            state.selected_div = null;
        }
    }
}
function toggleResizing(chartId) {
    //disable all charts
    state.is_dragging = false;
    state.is_resizing = false;
    state.dashboard.charts.forEach((chart) => {
        if (chart.chart_id !== chartId) {
            chart.config.drag_enabled = false;
            chart.config.resize_enabled = false;
            chart.config.add_columns_enabled = false;
        }
    });
    //enable target chart
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    if (chart) {
        chart.config.resize_enabled = !chart.config.resize_enabled;
        chart.config.drag_enabled = false;
        chart.config.add_columns_enabled = false;
        if (chart.config.resize_enabled) {
            state.selected_chart = chart;
        } else {
            state.selected_chart = null;
            state.selected_div = null;
        }
    }
}
function toggleAddColumns(chartId) {
    //enable target chart
    state.is_dragging = false;
    state.is_resizing = false;
    state.dashboard.charts.forEach((chart) => {
        if (chart.chart_id !== chartId) {
            chart.config.drag_enabled = false;
            chart.config.resize_enabled = false;
            chart.config.add_columns_enabled = false;
        }
    });
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    if (chart) {
        chart.config.add_columns_enabled = !chart.config.add_columns_enabled;
        chart.config.drag_enabled = false;
        chart.config.resize_enabled = false;
        if (chart.config.add_columns_enabled) {
            state.selected_chart = chart;
        } else {
            state.selected_chart = null;
            state.selected_div = null;
        }
    }
}
function initializeResizeParams(event) {
    state.is_resizing = true;
    state.is_dragging = false;
    state.start_resize_x = event.clientX;
    state.start_resize_y = event.clientY;
    state.selected_div = event.target.parentNode.parentNode;
    const draggableDiv = document.getElementById(`draggable-${state.selected_chart.chart_id}`);
    state.initial_width = state.selected_div.offsetWidth;
    state.initial_height = state.selected_div.offsetHeight;
    state.initial_width_draggable = draggableDiv.offsetWidth;
    state.initial_height_draggable = draggableDiv.offsetHeight;
}
function draggableDivMouseDown(event, chartId) {
    stopDragAndResize();
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    if (chart) {
        if (chart.config.drag_enabled) {
            const div = event.target;
            state.is_dragging = true;
            state.is_resizing = false;
            state.selected_div = div.parentNode.parentNode;
            // state.selected_div.style.cursor = 'move';
            state.offsetX = event.clientX - div.getBoundingClientRect().left;
            state.offsetY = event.clientY - div.getBoundingClientRect().top;
            document.addEventListener('mousemove', onDrag);
        }
    }
}
function stopDragAndResize() {
    stopDrag();
    stopResize();
}
function topLeftCornerMouseMove(event) {
    initializeResizeParams(event);
    state.active_handle = 'TL';
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const containerRect = draggableDivContainer.getBoundingClientRect();
    const boxRect = state.selected_div.getBoundingClientRect();
    const fixedBottom = containerRect.bottom - boxRect.bottom;
    const fixedRight = containerRect.width - (boxRect.left - containerRect.left + boxRect.width);
    state.selected_div.style.bottom = `${fixedBottom}px`;
    state.selected_div.style.right = `${fixedRight}px`;
    state.selected_div.style.left = 'auto';
    state.selected_div.style.top = 'auto';
    state.selected_div.style.cursor = 'nw-resize';
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}
function topRightCornerMouseMove(event) {
    initializeResizeParams(event);
    state.active_handle = 'TR';
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const containerRect = draggableDivContainer.getBoundingClientRect();
    const boxRect = state.selected_div.getBoundingClientRect();
    const fixedBottom = containerRect.bottom - boxRect.bottom;
    const fixedLeft = boxRect.left - containerRect.left;
    state.selected_div.style.bottom = `${fixedBottom}px`;
    state.selected_div.style.left = `${fixedLeft}px`;
    state.selected_div.style.right = 'auto';
    state.selected_div.style.top = 'auto';
    state.selected_div.style.cursor = 'nesw-resize';
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}
function bottomLeftCornerMouseMove(event) {
    initializeResizeParams(event);
    state.active_handle = 'BL';
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const containerRect = draggableDivContainer.getBoundingClientRect();
    const boxRect = state.selected_div.getBoundingClientRect();
    const fixedTop = boxRect.top - containerRect.top;
    const fixedRight = containerRect.width - (boxRect.left - containerRect.left + boxRect.width);
    state.selected_div.style.top = `${fixedTop}px`;
    state.selected_div.style.right = `${fixedRight}px`;
    state.selected_div.style.left = 'auto';
    state.selected_div.style.bottom = 'auto';
    state.selected_div.style.cursor = 'nesw-resize';
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}
function bottomRightCornerMouseMove(event) {
    initializeResizeParams(event);
    state.active_handle = 'BR';
    let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
    const containerRect = draggableDivContainer.getBoundingClientRect();
    const boxRect = state.selected_div.getBoundingClientRect();
    const fixedTop = boxRect.top - containerRect.top;
    const fixedLeft = boxRect.left - containerRect.left;
    state.selected_div.style.top = `${fixedTop}px`;
    state.selected_div.style.left = `${fixedLeft}px`;
    state.selected_div.style.right = 'auto';
    state.selected_div.style.bottom = 'auto';
    state.selected_div.style.cursor = 'nwse-resize';
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);

}
function onDrag(event) {
    if (state.is_dragging && state.selected_chart?.config?.drag_enabled && state.selected_div) {
        let draggableDivContainer = document.getElementsByClassName('draggable-div-container')[0];
        let newX = event.clientX - draggableDivContainer.getBoundingClientRect().left - state.offsetX;
        let newY = event.clientY - draggableDivContainer.getBoundingClientRect().top - state.offsetY;       
        const windowWidth = draggableDivContainer.clientWidth;
        const windowHeight = draggableDivContainer.clientHeight;
        const draggableWidth = state.selected_div.clientWidth;
        const draggableHeight = state.selected_div.clientHeight;
        if (newX < 0) {
            newX = 0
        } else if (newX + draggableWidth > windowWidth) {
            newX = windowWidth - draggableWidth;
        }
        if (newY < 0) {
            newY = 0
        } else if (newY + draggableHeight > windowHeight) {
            newY = windowHeight - draggableHeight - 50;
        }
        state.selected_div.style.left = `${newX}px`;
        state.selected_div.style.top = `${newY}px`;

        state.selected_chart.location = {
            left: `${newX}px`,
            top: `${newY}px`,
        };
    }
}
function stopDrag() {
    state.is_dragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}
function onResize(event) {
    const draggableDiv = document.getElementById(`draggable-${state.selected_chart.chart_id}`);
    const chartDiv = document.getElementById(`chart-${state.selected_chart.chart_id}`);
    if (state.is_mouse_down && state.is_resizing && state.selected_div && draggableDiv && chartDiv) {
        const deltaX = event.clientX - state.start_resize_x;
        const deltaY = event.clientY - state.start_resize_y;
       
        let newWidth;
        let newHeight;
        let newWidthDraggable;
        let newHeightDraggable;

        if (state.active_handle === 'TL') {
            newWidth = state.initial_width - deltaX;
            newHeight = state.initial_height - deltaY;
            newWidthDraggable = state.initial_width_draggable - deltaX;
            newHeightDraggable = state.initial_height_draggable - deltaY;
        } else if (state.active_handle === 'TR') {
            newWidth = state.initial_width + deltaX;
            newHeight = state.initial_height - deltaY;
            newWidthDraggable = state.initial_width_draggable + deltaX;
            newHeightDraggable = state.initial_height_draggable - deltaY;
        } else if (state.active_handle === 'BL') {
            newWidth = state.initial_width - deltaX;
            newHeight = state.initial_height + deltaY;
            newWidthDraggable = state.initial_width_draggable - deltaX;
            newHeightDraggable = state.initial_height_draggable + deltaY;
        } else if (state.active_handle === 'BR') {
            newWidth = state.initial_width + deltaX;
            newHeight = state.initial_height + deltaY;
            newWidthDraggable = state.initial_width_draggable + deltaX;
            newHeightDraggable = state.initial_height_draggable + deltaY;
        }
        // Ensure minimum width and height
        // newWidth = Math.max(100, newWidth > 500 ? 500 : newWidth);
        // newHeight = Math.max(100, newHeight > 500 ? 500 : newHeight);
        // newWidthDraggable = Math.max(100, newWidthDraggable > 500 ? 500 : newWidthDraggable);
        // newHeightDraggable = Math.max(100, newHeightDraggable > 500 ? 500 : newHeightDraggable);
        
        //add a 100px margin to both the heights
        //do not allow the height of the div to be less than the height of the chart
        newHeight = Math.max(chartDiv.offsetHeight, newHeight) + 50;
        newHeightDraggable = Math.max(chartDiv.offsetHeight, newHeightDraggable) + 50;

        state.selected_div.style.width = `${newWidth}px`;
        state.selected_div.style.height = `${newHeight}px`;
        draggableDiv.style.width = `${newWidthDraggable}px`;//set the width of the draggable
        draggableDiv.style.height = `${newHeightDraggable}px`;//set the height of the draggable
        
        state.selected_chart.dimensions = {
            width: `${newWidth}px`,
            height: `${newHeight}px`,
            widthDraggable: `${newWidthDraggable}px`,
            heightDraggable: `${newHeightDraggable}px`,
        };
        state.previous_deltax = deltaX;
        state.previous_deltay = deltaY;
    }
}
function stopResize() {
    state.is_resizing = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
}
function mouseDown() {
    state.is_mouse_down = true;
}
function mouseUp() {
    state.is_mouse_down = false;
    stopDragAndResize();
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
    document.addEventListener('mousedown', mouseDown);
    document.addEventListener('mouseup', mouseUp);
});
</script>
<template>
    <div class="flex flex-row">
        <sidebar
            class="w-1/6"
            :data-models="state.data_model_tables"
            :selected-chart="state.selected_chart"
            @add:selectedColumns="(data) => updateDataModel('add', data)"
            @remove:selectedColumns="(data) => updateDataModel('remove', data)"
        />
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
                <div class="flex flex-col min-h-200 max-h-200 h-200 overflow-hidden ml-10 mr-2 mb-10 border border-primary-blue-100 border-solid bg-gray-300">
                    <div class="w-full border border-gray-400 border-dashed h-10 flex flex-row justify-center items-center text-center font-bold text-gray-500 select-none">
                        Drag columns from the side bar given in the left into the blue area below to build your visualization.
                    </div>
                    <div class="w-full h-full bg-gray-300 draggable-div-container relative">
                        <div v-for="(chart, index) in state.dashboard.charts"
                            class="w-50 flex flex-col justify-between cursor-pointer draggable-div absolute top-0 left-0"
                            :id="`draggable-div-${chart.chart_id}`"
                        >
                            <div class="flex flex-row justify-between top-corners">
                                <img
                                    v-if="chart.config.resize_enabled"
                                    :id="`top-left-corner-${chart.chart_id}`"
                                    src="/assets/images/resize-corner.svg"
                                    class="w-[12px] rotate-180 select-none top-left-corner translate-y-2"
                                    :class="{ 'animate-pulse': chart.config.resize_enabled }"
                                    alt="Resize Visualization"
                                    @mousemove="topLeftCornerMouseMove($event, chart.chart_id)"
                                    @mouseup="mouseUp"
                                />
                                <img
                                    v-if="chart.config.resize_enabled"
                                    :id="`top-right-corner-${chart.chart_id}`"
                                    src="/assets/images/resize-corner.svg"
                                    class="w-[12px] rotate-270 select-none top-right-corner translate-y-2"
                                    :class="{ 'animate-pulse': chart.config.resize_enabled }"
                                    alt="Resize Visualization"
                                    @mousemove="topRightCornerMouseMove($event, chart.chart_id)"
                                    @mouseup="mouseUp"
                                />
                            </div>
                            <div class="flex flex-col">
                                <div
                                    class="flex flex-row border border-3 border-gray-600 border-b-0 p-2"
                                    :class="{ 'bg-gray-300 cursor-move': chart.config.drag_enabled, 'bg-gray-200': !chart.config.drag_enabled }"
                                    @mousedown="draggableDivMouseDown($event, chart.chart_id)"
                                    @mouseup="stopDragAndResize"
                                >
                                    <font-awesome 
                                        icon="fas fa-up-down-left-right"
                                        class="text-xl hover:text-gray-400 cursor-pointer"
                                        :class="{
                                            'text-black': chart.config.drag_enabled,
                                            'text-gray-500': !chart.config.drag_enabled,
                                        }"
                                        :v-tippy-content="chart.config.drag_enabled ? 'Disable Dragging' : 'Enable Dragging'"
                                        @click="toggleDragging($event, chart.chart_id)"
                                    />
                                    <font-awesome 
                                        icon="fas fa-up-right-and-down-left-from-center cursor-pointer"
                                        class="text-xl ml-2 hover:text-gray-400"
                                        :class="{
                                            'text-black': chart.config.resize_enabled,
                                            'text-gray-500': !chart.config.resize_enabled,
                                        }"
                                        :v-tippy-content="chart.config.resize_enabled ? 'Disable Resizing' : 'Enable Resizing'"
                                        @click="toggleResizing(chart.chart_id)"
                                    />
                                    <font-awesome
                                        v-if="chart.chart_type !== 'text_block'"
                                        icon="fas fa-plus"
                                        class="text-xl ml-2 hover:text-gray-400 cursor-pointer"
                                        :class="{
                                            'text-black': chart.config.add_columns_enabled,
                                            'text-gray-500': !chart.config.add_columns_enabled,
                                        }"
                                        :v-tippy-content="chart.config.add_columns_enabled ? 'Disable Add Columns' : 'Enable Add Columns'"
                                        @click="toggleAddColumns(chart.chart_id)"
                                    />
                                    <font-awesome 
                                        icon="fas fa-trash"
                                        class="text-xl ml-2 text-gray-400 hover:text-red-500 cursor-pointer"
                                        :v-tippy-content="'Delete Chart'"
                                        @click="deleteChartFromDashboard(chart.chart_id)"
                                    />
                                </div>
                                <draggable
                                    v-if="chart.chart_type !== 'text_block'"
                                    :id="`draggable-${chart.chart_id}`"
                                    v-model="chart.columns"
                                    group="data_model_columns"
                                    itemKey="column_name"
                                    class="flex flex-row w-full h-50 bg-gray-200 border border-3 border-gray-600 border-t-0 draggable-model-columns"
                                    tag="tr"
                                    :disabled="!chart.config.add_columns_enabled"
                                    @change="changeDataModel($event, chart.chart_id)"
                                >
                                    <template #item="{ element, index }">
                                        <div v-if="index === 0" class="text-left font-bold text-white px-4 py-2">
                                            <div v-if="chart && chart.data && chart.data.length" class="flex flex-col justify-center">
                                                <pie-chart
                                                    v-if="chart.chart_type === 'pie'"
                                                    :id="`chart-${chart.chart_id}`"   
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :width="1200"
                                                    :height="1200"
                                                    class="mt-5"
                                                />
                                                <donut-chart
                                                    v-if="chart.chart_type === 'donut'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :width="1200"
                                                    :height="1200"
                                                    class="mt-5"
                                                />
                                                <vertical-bar-chart
                                                    v-if="chart.chart_type === 'vertical_bar'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :x-axis-label="chart.x_axis_label"
                                                    :y-axis-label="chart.y_axis_label"
                                                    class="mt-5"
                                                    @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                    @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                                />
                                                <horizontal-bar-chart
                                                    v-if="chart.chart_type === 'horizontal_bar'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :x-axis-label="chart.x_axis_label"
                                                    :y-axis-label="chart.y_axis_label"
                                                    class="mt-5"
                                                    @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                    @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                                />
                                                <vertical-bar-chart
                                                    v-if="chart.chart_type === 'vertical_bar_line'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :x-axis-label="chart.x_axis_label"
                                                    :y-axis-label="chart.y_axis_label"
                                                    :show-line-chart="true"
                                                    :line-data="chart.data"
                                                    line-color="#FF5733"
                                                    class="mt-5"
                                                    @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                    @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                                />
                                            </div>
                                        </div>
                                    </template>
                                </draggable>
                                <div v-else :id="`draggable-${chart.chart_id}`" class="bg-gray-200 border border-3 border-gray-600 border-t-0">
                                    <text-editor :id="`chart-${chart.chart_id}`" :buttons="['bold', 'italic', 'heading', 'strike', 'underline']" minHeight="10" @update:content="(content) => { updateContent(content, chart.chart_id) }"/>
                                </div>
                            </div>
                            <div class="flex flex-row justify-between bottom-corners">
                                <img 
                                    v-if="chart.config.resize_enabled"
                                    :id="`bottom-left-corner-${chart.chart_id}`"
                                    src="/assets/images/resize-corner.svg"
                                    class="w-[12px] rotate-90 select-none bottom-left-corner -translate-y-2"
                                    :class="{ 'animate-pulse': chart.config.resize_enabled }"
                                    alt="Resize Visualization"
                                    @mousemove="bottomLeftCornerMouseMove($event, chart.chart_id)"
                                    @mouseup="mouseUp"
                                />
                                <img
                                    v-if="chart.config.resize_enabled"
                                    :id="`bottom-right-corner-${chart.chart_id}`"
                                    src="/assets/images/resize-corner.svg"
                                    class="w-[12px] select-none bottom-right-corner -translate-y-2"
                                    :class="{ 'animate-pulse': chart.config.resize_enabled }"
                                    alt="Resize Visualization"
                                    @mousemove="bottomRightCornerMouseMove($event, chart.chart_id)"
                                    @mouseup="mouseUp"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col w-1/6 mt-17 mb-10 mr-2 select-none">
                <div class="" @click="addChartToDashboard('text_block')" v-tippy="{ content: 'Add Text Block To Dashboard', placement: 'top' }">
                     <div class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto mb-2 text-center font-bold text-lg cursor-pointer hover:bg-gray-300" >
                        Text Block
                     </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="addChartToDashboard('table')" v-tippy="{ content: 'Add Table To Dashboard', placement: 'top' }">
                        <img src="/assets/images/table_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Table Chart" />
                    </div>
                    <div @click="addChartToDashboard('pie')" v-tippy="{ content: 'Add Pie Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/pie_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Pie Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="addChartToDashboard('donut')" v-tippy="{ content: 'Add Donut Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/donut_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Donut Chart" />
                    </div>
                    <div @click="addChartToDashboard('vertical_bar')" v-tippy="{ content: 'Add Vertical Bar Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/vertical_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Vertical Bar Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="addChartToDashboard('horizontal_bar')" v-tippy="{ content: 'Add Horizontal Bar Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/horizontal_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Horizontal Bar Chart" />
                    </div>
                    <div @click="addChartToDashboard('vertical_bar_line')" v-tippy="{ content: 'Add Vertical Bar Line Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/vertical_bar_chart_line.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Vertical Bar Line Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="addChartToDashboard('stacked_bar')" v-tippy="{ content: 'Add Stacked Bar Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/stacked_bar_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Stacked Bar Chart" />
                    </div>    
                    <div @click="addChartToDashboard('multiline')" v-tippy="{ content: 'Add Multiline Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/multi_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Multiline Chart" />
                    </div>
                </div>
                <div class="flex flex-row mb-2">
                    <div class="mr-2" @click="addChartToDashboard('heatmap')" v-tippy="{ content: 'Add Heatmap Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/heatmap_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Heatmap Chart" />
                    </div>
                    <div @click="addChartToDashboard('bubble')" v-tippy="{ content: 'Add Bubble Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/bubble_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Bubble Chart" />
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="mr-2" @click="addChartToDashboard('stacked_area')" v-tippy="{ content: 'Add Stacked Area Chart To Dashboard', placement: 'top' }">
                        <img src="/assets/images/stacked_area_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Stacked Area Chart" />
                    </div>
                    <div @click="addChartToDashboard('map')" v-tippy="{ content: 'Add Map To Dashboard', placement: 'top' }">
                        <img src="/assets/images/map_chart.png" class="border-1 border-primary-blue-100 shadow-lg p-5 m-auto cursor-pointer hover:bg-gray-300" alt="Map Chart" />
                    </div>
                </div>
            </div>
        </div>
        <img src="/assets/images/resize-corner.svg" id="corner-image" class="bottom-right-corner-resize w-[15px] select-none hidden" alt="Resize Visualization" />
    </div>
</template>