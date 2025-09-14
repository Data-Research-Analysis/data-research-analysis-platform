<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import _ from 'lodash';
const projectsStore = useProjectsStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const { $swal } = useNuxtApp();
const router = useRouter();
const state = reactive({
    data_model_tables: [],
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
    show_table_dialog: false,
 });
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dashboard = computed(() => {
    return dashboardsStore.getSelectedDashboard();
});
const dataModelTables = computed(() => {
    return dataModelsStore.getDataModelTables();
});
const charts = computed(() => {
    return state.dashboard.charts;
});
watch(
    dashboardsStore,
    (value, oldValue) => {
        state.dashboard.charts = dashboardsStore.getSelectedDashboard()?.data?.charts.map((chart) => {
            return {
                ...chart,
                config: {
                    drag_enabled: false,
                    resize_enabled: false,
                    add_columns_enabled: false,
                },
            };
        }) || [];
    },
)
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
    
    // Auto-resize table containers when columns change
    if (chart && chart.chart_type === 'table') {
        autoResizeTableContainer(chartId);
    }
}
function autoResizeTableContainer(chartId) {
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    if (!chart || chart.chart_type !== 'table') return;
    
    nextTick(() => {
        // Calculate required width based on columns
        const columnCount = chart.columns?.length || 0;
        const minColumnWidth = 120; // From component prop
        const rowNumberWidth = 60; // Row numbers width
        const padding = 80; // Container padding and borders
        const scrollbarWidth = 20; // Account for scrollbar
        
        const requiredWidth = (columnCount * minColumnWidth) + rowNumberWidth + padding + scrollbarWidth;
        const currentWidth = parseInt(chart.dimensions.widthDraggable.replace('px', ''));
        
        // Only resize if current width is too small
        if (requiredWidth > currentWidth) {
            const draggableDiv = document.getElementById(`draggable-div-${chartId}`);
            const newWidth = Math.min(requiredWidth, 1000); // Cap at reasonable max width
            
            if (draggableDiv) {
                draggableDiv.style.width = `${newWidth}px`;
                
                // Update chart dimensions
                chart.dimensions.width = `${newWidth}px`;
                chart.dimensions.widthDraggable = `${newWidth}px`;
            }
        }
    });
}

function handleTableResize(chartId, resizeData) {
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    if (!chart || chart.chart_type !== 'table') return;
    
    const draggableDiv = document.getElementById(`draggable-div-${chartId}`);
    
    // Calculate optimal width based on column count and content
    const minWidth = 300; // Minimum container width
    const maxWidth = 1200; // Maximum container width
    const optimalWidth = Math.max(minWidth, Math.min(maxWidth, resizeData.requiredWidth + 40));
    
    if (draggableDiv) {
        // Animate the resize for smooth UX
        draggableDiv.style.transition = 'width 0.3s ease';
        draggableDiv.style.width = `${optimalWidth}px`;
        
        // Update chart dimensions
        chart.dimensions.width = `${optimalWidth}px`;
        chart.dimensions.widthDraggable = `${optimalWidth}px`;
        
        // Remove transition after animation
        setTimeout(() => {
            draggableDiv.style.transition = '';
        }, 300);
    }
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
        chart.data = [];
        chart.line_data = [];
        chart.stack_keys = [];
        chart.sql_query = buildSQLQuery(chart);
        const sqlQuery = chart.sql_query;
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
        state.response_from_data_models_rows = data;
        state.response_from_data_models_columns = chart.columns.map((column) => column.column_name);
        const labelValues = [];
        const numericValues = [];
        const numericLineValues = [];
        state.selected_chart.result_from_query = state.response_from_data_models_rows;
        if (['pie', 'donut', 'vertical_bar', 'horizontal_bar', 'bubble'].includes(chart.chart_type)) {
            state.response_from_data_models_rows.forEach((row) =>{
                const columns_data_types = chart.columns.filter((column, index) => index < 2 && Object.keys(row).includes(column.column_name)).map((column) => { return { column_name: column.column_name, data_type: column.data_type }});
                columns_data_types.forEach((column, index) => {
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
                            index === 1 && (
                                column.data_type === 'smallint' ||
                                column.data_type === 'bigint'  ||
                                column.data_type === 'integer' ||
                                column.data_type === 'numeric' ||
                                column.data_type === 'decimal' || 
                                column.data_type === 'real' ||
                                column.data_type === 'double precision' ||
                                column.data_type === 'small serial' ||
                                column.data_type === 'serial' ||
                                column.data_type === 'bigserial'
                            )
                        ) {
                        numericValues.push(parseInt(row[column.column_name]));
                    } else if (
                            index === 2 && (
                                column.data_type === 'smallint' ||
                                column.data_type === 'bigint'  ||
                                column.data_type === 'integer' ||
                                column.data_type === 'numeric' ||
                                column.data_type === 'decimal' || 
                                column.data_type === 'real' ||
                                column.data_type === 'double precision' ||
                                column.data_type === 'small serial' ||
                                column.data_type === 'serial' ||
                                column.data_type === 'bigserial'
                            )
                        ) {
                        numericLineValues.push(parseInt(row[column.column_name]));
                    }
                });
            });
            labelValues.forEach((label, index) => {
                chart.data.push({
                    label: label,
                    value: numericValues[index],
                });
            });

        } else if (['vertical_bar_line'].includes(chart.chart_type)) {
            state.response_from_data_models_rows.forEach((row) =>{
                const columns_data_types = chart.columns.filter((column, index) => index < 3 && Object.keys(row).includes(column.column_name)).map((column) => { return { column_name: column.column_name, data_type: column.data_type }});
                columns_data_types.forEach((column, index) => {
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
                            index === 1 && (
                                column.data_type === 'smallint' ||
                                column.data_type === 'bigint'  ||
                                column.data_type === 'integer' ||
                                column.data_type === 'numeric' ||
                                column.data_type === 'decimal' || 
                                column.data_type === 'real' ||
                                column.data_type === 'double precision' ||
                                column.data_type === 'small serial' ||
                                column.data_type === 'serial' ||
                                column.data_type === 'bigserial'
                            )
                        ) {
                        numericValues.push(parseInt(row[column.column_name]));
                    } else if (
                            index === 2 && (
                                column.data_type === 'smallint' ||
                                column.data_type === 'bigint'  ||
                                column.data_type === 'integer' ||
                                column.data_type === 'numeric' ||
                                column.data_type === 'decimal' || 
                                column.data_type === 'real' ||
                                column.data_type === 'double precision' ||
                                column.data_type === 'small serial' ||
                                column.data_type === 'serial' ||
                                column.data_type === 'bigserial'
                            )
                        ) {
                        numericLineValues.push(parseInt(row[column.column_name]));
                    }
                });
            });
            labelValues.forEach((label, index) => {
                chart.data.push({
                    label: label,
                    value: numericValues[index],
                });
                chart.line_data.push({
                    label: label,
                    value: numericLineValues[index],
                });
            });
        } else if (['stacked_bar'].includes(chart.chart_type)) {
            state.response_from_data_models_rows.forEach((row) =>{
                stackedValues = [];
                const columns_data_types = chart.columns.filter((column) => Object.keys(row).includes(column.column_name)).map((column) => { return { column_name: column.column_name, data_type: column.data_type }});
                let labelValue = '';
                columns_data_types.forEach((column) => {
                    if (column.data_type.includes('character varying') ||
                        column.data_type.includes('varchar') ||
                        column.data_type.includes('character') ||
                        column.data_type.includes('char') ||
                        column.data_type.includes('bpchar') ||
                        column.data_type.includes('text') ||
                        column.data_type.includes('USER-DEFINED')
                    ) {
                        if (labelValue === '') {
                            labelValue = row[column.column_name];
                        }
                    } else if (
                            column.data_type === 'smallint' ||
                            column.data_type === 'bigint'  ||
                            column.data_type === 'integer' ||
                            column.data_type === 'numeric' ||
                            column.data_type === 'decimal' || 
                            column.data_type === 'real' ||
                            column.data_type === 'double precision' ||
                            column.data_type === 'small serial' ||
                            column.data_type === 'serial' ||
                            column.data_type === 'bigserial'                       
                        ) {
                        const stackData = {};
                        const stackKey = column.column_name.replace(/\_/g, ' ');
                        if (!chart.stack_keys.includes(stackKey)) {
                            chart.stack_keys.push(stackKey);
                        }
                        stackData.key = stackKey;
                        stackData.value = parseFloat(row[column.column_name]);
                        stackedValues.push(stackData);
                    }
                });
                if (labelValue !== '') {
                    chart.data.push({
                        label: labelValue,
                        values: stackedValues
                    });
                }
            });
        } else if (['multiline'].includes(chart.chart_type)) {
            // Multi-line chart data preparation
            const categories = [];
            const seriesMap = new Map();
            const numericColumns = [];
            let categoryColumn = null;

            // Identify category column (first text column) and numeric columns
            chart.columns.forEach((column, index) => {
                if (column.data_type.includes('character varying') ||
                    column.data_type.includes('varchar') ||
                    column.data_type.includes('character') ||
                    column.data_type.includes('char') ||
                    column.data_type.includes('bpchar') ||
                    column.data_type.includes('text') ||
                    column.data_type.includes('USER-DEFINED')
                ) {
                    if (!categoryColumn) {
                        categoryColumn = column;
                    }
                } else if (
                    column.data_type === 'smallint' ||
                    column.data_type === 'bigint' ||
                    column.data_type === 'integer' ||
                    column.data_type === 'numeric' ||
                    column.data_type === 'decimal' ||
                    column.data_type === 'real' ||
                    column.data_type === 'double precision' ||
                    column.data_type === 'small serial' ||
                    column.data_type === 'serial' ||
                    column.data_type === 'bigserial'
                ) {
                    numericColumns.push(column);
                }
            });

            // Process rows to extract categories and series data
            state.response_from_data_models_rows.forEach((row) => {
                if (categoryColumn && row[categoryColumn.column_name] !== undefined) {
                    const categoryValue = row[categoryColumn.column_name];
                    if (!categories.includes(categoryValue)) {
                        categories.push(categoryValue);
                    }

                    // Initialize series data for each numeric column
                    numericColumns.forEach((column) => {
                        const seriesName = column.column_name.replace(/\_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        if (!seriesMap.has(seriesName)) {
                            seriesMap.set(seriesName, []);
                        }
                        
                        const value = parseFloat(row[column.column_name]) || 0;
                        seriesMap.get(seriesName).push(value);
                    });
                }
            });

            // Convert to chart data format
            const series = [];
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FFA07A'];
            let colorIndex = 0;

            seriesMap.forEach((data, seriesName) => {
                series.push({
                    name: seriesName,
                    data: data,
                    color: colors[colorIndex % colors.length]
                });
                colorIndex++;
            });

            chart.data = [{
                categories: categories,
                series: series
            }];
        } else if (chart.chart_type === 'table') {
            // Process table data
            const columns = chart.columns
                .map((column) => column.column_name)
                .filter(col => col && col.trim() !== ''); // Filter out empty columns
            
            const rows = state.response_from_data_models_rows
                .filter(row => row && typeof row === 'object' && Object.keys(row).length > 0); // Filter out invalid rows
            
            chart.data = [{
                columns: columns,
                rows: rows
            }];
            
            // Auto-resize table container after data is loaded
            nextTick(() => {
                autoResizeTableContainer(chart.chart_id);
            });
        } else if (['treemap'].includes(chart.chart_type)) {
            // Treemap requires at least 2 columns: category + value
            // Or 3 columns: category + subcategory + value
            const columns = chart.columns.map(col => col.column_name);
            const validRows = state.response_from_data_models_rows.filter(row => 
                row && typeof row === 'object' && Object.keys(row).length > 0
            );
            
            if (columns.length >= 2 && validRows.length > 0) {
                chart.data = [{
                    name: columns.length >= 3 ? `${columns[0]} by ${columns[1]}` : `${columns[0]} Analysis`,
                    columns: columns,
                    rows: validRows
                }];
            } else {
                // Fallback for insufficient data
                chart.data = [{
                    name: "Insufficient Data", 
                    columns: [], 
                    rows: []
                }];
            }
        }
        chart.stack_keys = _.uniq(chart.stack_keys);
    }
}

onMounted(async () => {
    //clear the selected dashboard
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
    state.dashboard.charts = dashboard.value?.data?.charts.map((chart) => {
        return {
            ...chart,
            config: {
                drag_enabled: false,
                resize_enabled: false,
                add_columns_enabled: false,
            },
        };
    });
});
</script>
<template>
    <div class="flex flex-row">
        <div class="flex flex-col w-full mt-10">
            <div class="flex flex-col min-h-200 max-h-200 h-200 overflow-hidden ml-10 mr-2 mb-10">
                <div class="w-full h-full draggable-div-container relative">
                    <div v-for="(chart, index) in charts"
                        class="w-50 flex flex-col justify-between cursor-pointer draggable-div absolute top-0 left-0"
                        :id="`draggable-div-${chart.chart_id}`"
                        :style="`width: ${chart.dimensions.width}; height: ${chart.dimensions.height}; top: ${chart.location.top}; left: ${chart.location.left};`"
                    >
                        <div class="flex flex-col">
                            <draggable
                                v-if="chart.chart_type !== 'text_block'"
                                :id="`draggable-${chart.chart_id}`"
                                v-model="chart.columns"
                                group="data_model_columns"
                                itemKey="column_name"
                                class="flex flex-row w-full h-50 draggable-model-columns"
                                tag="tr"
                                :disabled="!chart.config.add_columns_enabled"
                                :style="`width: ${chart.dimensions.widthDraggable}; height: ${chart.dimensions.heightDraggable};`"
                                @change="changeDataModel($event, chart.chart_id)"
                            >
                                <template #item="{ element, index }">
                                    <div v-if="index === 0" class="text-left font-bold text-white px-4 py-2">
                                        <div v-if="chart && chart.data && chart.data.length" class="flex flex-col justify-center">
                                            <table-chart 
                                                v-if="chart.chart_type === 'table'"
                                                :id="`chart-${chart.chart_id}`"   
                                                :chart-id="`${chart.chart_id}`"
                                                :data="chart.data[0]"
                                                :width="parseInt(chart.dimensions.widthDraggable.replace('px', '')) - 40"
                                                :height="parseInt(chart.dimensions.heightDraggable.replace('px', '')) - 80"
                                                :enable-scroll-bars="true"
                                                :show-row-numbers="true"
                                                :sticky-header="true"
                                                :max-column-width="'200px'"
                                                :min-column-width="'120px'"
                                                :use-container-sizing="true"
                                                :virtual-scrolling="chart.data[0]?.rows?.length > 100"
                                                :virtual-scroll-item-height="35"
                                                @resize-needed="(data) => handleTableResize(chart.chart_id, data)"
                                                class="mt-2"
                                            />
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
                                                :editable-axis-labels="false"
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
                                                :editable-axis-labels="false"
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
                                                :line-data="chart.line_data"
                                                :editable-axis-labels="false"
                                                line-color="#FF5733"
                                                class="mt-5"
                                                @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                            />
                                            <stacked-bar-chart
                                                v-if="chart.chart_type === 'stacked_bar'"
                                                :id="`chart-${chart.chart_id}`"
                                                :chart-id="`${chart.chart_id}`"
                                                :data="chart.data"
                                                :stack-keys="chart.stack_keys"
                                                :color-scheme="['#1f77b4', '#ff7f0e', '#2ca02c']"
                                                :show-legend="true"
                                                :x-axis-label="chart.x_axis_label"
                                                :y-axis-label="chart.y_axis_label"
                                                :max-legend-width="350"
                                                @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                            />
                                            <multi-line-chart
                                                v-if="chart.chart_type === 'multiline'"
                                                :id="`chart-${chart.chart_id}`"
                                                :chart-id="`${chart.chart_id}`"
                                                :data="chart.data[0]"
                                                :width="chart.config.width"
                                                :height="chart.config.height"
                                                :x-axis-label="chart.x_axis_label"
                                                :y-axis-label="chart.y_axis_label"
                                                :show-data-points="true"
                                                :enable-tooltips="true"
                                                :show-grid="true"
                                                legend-position="top"
                                                :max-legend-width="400"
                                                :legend-line-height="25"
                                                :legend-item-spacing="25"
                                                @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                            />
                                            <treemap-chart
                                                v-if="chart.chart_type === 'treemap'"
                                                :id="`chart-${chart.chart_id}`"
                                                :chart-id="`${chart.chart_id}`"
                                                :data="chart.data[0]"
                                                :width="parseInt(chart.dimensions.widthDraggable.replace('px', '')) - 40"
                                                :height="parseInt(chart.dimensions.heightDraggable.replace('px', '')) - 80"
                                                :color-scheme="'schemeCategory10'"
                                                :show-labels="true"
                                                :show-values="true"
                                                :enable-tooltips="true"
                                                :label-font-size="12"
                                                :value-font-size="10"
                                                :min-tile-size="30"
                                                class="mt-2"
                                            />
                                            <bubble-chart
                                                v-if="chart.chart_type === 'bubble'"
                                                :id="`chart-${chart.chart_id}`"
                                                :chart-id="`${chart.chart_id}`"
                                                :data="chart.data"
                                                :width="parseInt(chart.dimensions.widthDraggable.replace('px', '')) - 40"
                                                :height="parseInt(chart.dimensions.heightDraggable.replace('px', '')) - 80"
                                                class="mt-2"
                                            />
                                        </div>
                                    </div>
                                </template>
                            </draggable>
                            <div v-else :id="`draggable-${chart.chart_id}`" class="bg-gray-200 border border-3 border-gray-600 border-t-0">
                                <text-editor :id="`chart-${chart.chart_id}`" :buttons="['bold', 'italic', 'heading', 'strike', 'underline']" minHeight="10" :content="chart.text_editor.content" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>