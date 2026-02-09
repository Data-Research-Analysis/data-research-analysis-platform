<script setup>
import { onBeforeUnmount } from 'vue';
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import _ from 'lodash';

definePageMeta({
  layout: false, // Disable default layout for public dashboard
});

const projectsStore = useProjectsStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const { $swal, $htmlToImageToPng } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const dashboardKey = String(route.params.dashboardkey);

// Fetch dashboard with SSR support
const { dashboardData, pending, error } = await usePublicDashboard(dashboardKey);

// Computed dashboard from SSR data or store
const dashboard = computed(() => {
  if (dashboardData.value?.dashboard) {
    return dashboardData.value.dashboard;
  }
  return dashboardsStore.getSelectedDashboard();
});

const project = computed(() => {
  if (dashboardData.value?.project) {
    return dashboardData.value.project;
  }
  return projectsStore.getSelectedProject();
});

// Sync with store on client for backward compatibility
watchEffect(() => {
  if (import.meta.client && dashboardData.value?.dashboard) {
    dashboardsStore.setSelectedDashboard(dashboardData.value.dashboard);
    if (dashboardData.value.project) {
      projectsStore.setSelectedProject(dashboardData.value.project);
    }
  }
});

// Set up dynamic meta tags based on dashboard data
useHead(() => ({
    title: dashboard.value?.name 
        ? `${dashboard.value.name} - Data Dashboard | Data Research Analysis`
        : 'Public Dashboard | Data Research Analysis',
    meta: [
        { 
            name: 'description', 
            content: dashboard.value?.description 
                || `Interactive data dashboard for ${project.value?.name || 'data analysis'}. Explore visualizations and insights powered by Data Research Analysis.` 
        },
        { name: 'robots', content: 'index, follow' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: `https://dataresearchanalysis.com/public-dashboard/${route.params.dashboardkey}` },
        { 
            property: 'og:title', 
            content: dashboard.value?.name 
                ? `${dashboard.value.name} - Data Dashboard`
                : 'Public Data Dashboard' 
        },
        { 
            property: 'og:description', 
            content: dashboard.value?.description 
                || `Interactive data dashboard with real-time visualizations and analytics.` 
        },
        { property: 'og:image', content: 'https://dataresearchanalysis.com/images/dashboard-preview.png' },
        
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: `https://dataresearchanalysis.com/public-dashboard/${route.params.dashboardkey}` },
        { 
            name: 'twitter:title', 
            content: dashboard.value?.name 
                ? `${dashboard.value.name} - Data Dashboard`
                : 'Public Data Dashboard' 
        },
        { 
            name: 'twitter:description', 
            content: dashboard.value?.description 
                || `Interactive data dashboard with real-time visualizations.` 
        },
        { name: 'twitter:image', content: 'https://dataresearchanalysis.com/images/dashboard-preview.png' },
    ],
    link: [
        { rel: 'canonical', href: `https://dataresearchanalysis.com/public-dashboard/${route.params.dashboardkey}` }
    ]
}));

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

// project and dashboard computeds are defined above for SEO
const dataModelTables = computed(() => {
    return dataModelsStore.getDataModelTables();
});
const charts = computed(() => {
    return state.dashboard.charts;
});
watch(
    dashboardsStore.selectedDashboard,
    (value, oldValue) => {
        const dashboard = dashboardsStore.getSelectedDashboard();
        const charts = dashboard?.data?.charts || [];
        
        state.dashboard.charts = charts.map((chart) => {
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
    { immediate: true }
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
        // Only access DOM on client side for SSR compatibility
        if (!import.meta.client) return;
        
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
    
    // Only access DOM on client side for SSR compatibility
    if (!import.meta.client) return;
    
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

// Helper to get column name for charts
function getChartColumnName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'Value';
    }
    // For pie/donut/bar charts, use the second column (value column) name if available
    if (['pie', 'donut', 'vertical_bar', 'horizontal_bar', 'stacked_bar'].includes(chart.chart_type) && chart.columns.length >= 2) {
        return chart.columns[1].column_name || 'Value';
    }
    // Otherwise use first column
    return chart.columns[0]?.column_name || 'Value';
}

// Helper to get category name for charts
function getChartCategoryName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'Category';
    }
    // First column is typically the category/label
    return chart.columns[0]?.column_name || 'Category';
}

// Helper to get stack name for stacked charts
function getChartStackName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'Series';
    }
    // For stacked bars, return generic series name
    // Could be enhanced to extract from column metadata if available
    return 'Series';
}

// Helper to get X column name for charts
function getChartXColumnName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'X Axis';
    }
    // For multiline and bubble: first column is typically X
    if (['multiline', 'bubble'].includes(chart.chart_type)) {
        return chart.columns[0]?.column_name || 'X Axis';
    }
    return 'X Axis';
}

// Helper to get Y column name for charts
function getChartYColumnName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'Y Axis';
    }
    // For multiline and bubble: second column is typically Y
    if (['multiline', 'bubble'].includes(chart.chart_type) && chart.columns.length >= 2) {
        return chart.columns[1]?.column_name || 'Y Axis';
    }
    return 'Y Axis';
}

// Helper to get series name for multiline charts
function getChartSeriesName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'Series';
    }
    // For multiline: series might come from third column or be derived
    if (chart.chart_type === 'multiline') {
        if (chart.columns.length >= 3) {
            return chart.columns[2]?.column_name || 'Series';
        }
    }
    return 'Series';
}

// Helper to get size column name for bubble charts
function getChartSizeColumnName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'Size';
    }
    // For bubble: third column is typically size
    if (chart.chart_type === 'bubble' && chart.columns.length >= 3) {
        return chart.columns[2]?.column_name || 'Size';
    }
    return 'Size';
}

// Helper to get label column name for bubble charts
function getChartLabelColumnName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'Label';
    }
    // For bubble: label is typically first column
    if (chart.chart_type === 'bubble') {
        return chart.columns[0]?.column_name || 'Label';
    }
    return 'Label';
}

// Helper to get value name for treemap charts
function getChartValueName(chartId) {
    const chart = charts.value.find(c => c.chart_id === chartId);
    if (!chart || !chart.columns || chart.columns.length === 0) {
        return 'Value';
    }
    // For treemap: last column is typically the value
    if (chart.chart_type === 'treemap') {
        return chart.columns[chart.columns.length - 1]?.column_name || 'Value';
    }
    return 'Value';
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
        const data = await $fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                query: sqlQuery,
                project_id: project.value?.id
            }
        });
        // Ensure data is an array before assigning
        state.response_from_data_models_rows = Array.isArray(data) ? data : [];
        state.response_from_data_models_columns = chart.columns.map((column) => column.column_name);
        const labelValues = [];
        const numericValues = [];
        const numericLineValues = [];
        state.selected_chart.result_from_query = state.response_from_data_models_rows;
        if (['pie', 'donut', 'vertical_bar', 'horizontal_bar', 'bubble'].includes(chart.chart_type)) {
            state.response_from_data_models_rows.forEach((row) =>{
                const columns_data_types = chart.columns.filter((column, index) => index < 2 && Object.keys(row).includes(column.column_name)).map((column) => { return { column_name: column.column_name, data_type: column.data_type }});
                columns_data_types.forEach((column, index) => {
                    if (index === 0) {
                        // First column: categorical (label)
                        if (column.data_type.includes('character varying') ||
                            column.data_type.includes('varchar') ||
                            column.data_type.includes('character') ||
                            column.data_type.includes('char') ||
                            column.data_type.includes('bpchar') ||
                            column.data_type.includes('text') ||
                            column.data_type.includes('USER-DEFINED') ||
                            column.data_type === 'boolean'
                        ) {
                            labelValues.push(row[column.column_name]); 
                        }
                    } else if (index === 1) {
                        // Second column: numerical (value)
                        if (column.data_type === 'smallint' ||
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
                            numericValues.push(parseInt(row[column.column_name]));
                        } else if (column.data_type === 'boolean') {
                            // Boolean as numerical: true=1, false=0
                            numericValues.push(row[column.column_name] ? 1 : 0);
                        }
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
                    if (index === 0) {
                        // First column: categorical (label)
                        if (column.data_type.includes('character varying') ||
                            column.data_type.includes('varchar') ||
                            column.data_type.includes('character') ||
                            column.data_type.includes('char') ||
                            column.data_type.includes('bpchar') ||
                            column.data_type.includes('text') ||
                            column.data_type.includes('USER-DEFINED') ||
                            column.data_type === 'boolean'
                        ) {
                            labelValues.push(row[column.column_name]); 
                        }
                    } else if (index === 1) {
                        // Second column: numerical (bar value)
                        if (column.data_type === 'smallint' ||
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
                            numericValues.push(parseInt(row[column.column_name]));
                        } else if (column.data_type === 'boolean') {
                            numericValues.push(row[column.column_name] ? 1 : 0);
                        }
                    } else if (index === 2) {
                        // Third column: numerical (line value)
                        if (column.data_type === 'smallint' ||
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
                            numericLineValues.push(parseInt(row[column.column_name]));
                        } else if (column.data_type === 'boolean') {
                            numericLineValues.push(row[column.column_name] ? 1 : 0);
                        }
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
                    } else if (column.data_type === 'boolean') {
                        // Boolean can be label if first, otherwise numeric value
                        if (labelValue === '') {
                            labelValue = row[column.column_name];
                        } else {
                            const stackData = {};
                            const stackKey = column.column_name.replace(/\_/g, ' ');
                            if (!chart.stack_keys.includes(stackKey)) {
                                chart.stack_keys.push(stackKey);
                            }
                            stackData.key = stackKey;
                            stackData.value = row[column.column_name] ? 1 : 0;
                            stackedValues.push(stackData);
                        }
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
                    column.data_type.includes('USER-DEFINED') ||
                    column.data_type === 'boolean'
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

// Pre-export preparation function to handle overflow containers
function prepareForExport() {
    // Only access DOM on client side for SSR compatibility
    if (!import.meta.client) return null;
    
    const dashboardContainer = document.querySelector('.data-research-analysis');
    const exportBranding = document.querySelector('.export-branding');
    
    if (!dashboardContainer) return null;
    
    // Save original styles for dashboard container
    const originalStyles = {
        overflow: dashboardContainer.style.overflow || '',
        overflowX: dashboardContainer.style.overflowX || '',
        overflowY: dashboardContainer.style.overflowY || ''
    };
    
    // Make overflow visible for export
    dashboardContainer.style.overflow = 'visible';
    dashboardContainer.style.overflowX = 'visible';
    dashboardContainer.style.overflowY = 'visible';
    
    // Show export branding
    if (exportBranding) {
        exportBranding.classList.remove('hidden');
    }
    
    return { 
        dashboardContainer, 
        exportBranding,
        originalStyles
    };
}

// Post-export restoration function
function restoreOriginalStyles(preparation) {
    if (!preparation || !preparation.dashboardContainer || !preparation.originalStyles) return;
    
    const { dashboardContainer, exportBranding, originalStyles } = preparation;
    
    // Restore dashboard container styles
    dashboardContainer.style.overflow = originalStyles.overflow;
    dashboardContainer.style.overflowX = originalStyles.overflowX;
    dashboardContainer.style.overflowY = originalStyles.overflowY;
    
    // Hide export branding again
    if (exportBranding) {
        exportBranding.classList.add('hidden');
    }
}

function exportDashboardAsImage() {
    // Only export on client side for SSR compatibility
    if (!import.meta.client) return;
    
    const dashboardElement = document.querySelector('.data-research-analysis');
    if (!dashboardElement) return;
    
    // Prepare containers for export
    const preparation = prepareForExport();
    
    if (!preparation) {
        console.error('Failed to prepare containers for export');
        return;
    }
    
    // Wait for layout to settle after style changes
    setTimeout(() => {
        try {
            // Capture current dimensions
            const captureWidth = dashboardElement.scrollWidth;
            const captureHeight = dashboardElement.scrollHeight;
            
            $htmlToImageToPng(dashboardElement, {
                width: captureWidth,
                height: captureHeight,
                backgroundColor: '#ffffff',
                skipFonts: true, // Skip font embedding to avoid CORS issues with Google Fonts
                scrollX: 0,
                scrollY: 0,
                filter: (node) => {
                    // Filter out any problematic external resources
                    if (node.tagName === 'LINK' && node.rel === 'stylesheet') {
                        const href = node.href || '';
                        if (href.includes('fonts.googleapis.com')) {
                            return false;
                        }
                    }
                    return true;
                }
            }).then((dataUrl) => {
                // Download the image
                const link = document.createElement('a');
                link.download = `${dashboard.value.name || 'dashboard'}.png`;
                link.href = dataUrl;
                link.click();
            }).catch((error) => {
                console.error('Export failed:', error);
                
                // Show error message to user
                if (typeof $swal !== 'undefined') {
                    $swal.fire({
                        icon: 'error',
                        title: 'Export Failed',
                        text: 'Failed to export dashboard as image. Please try again.',
                    });
                }
            }).finally(() => {
                // Always restore original styles, even on error
                restoreOriginalStyles(preparation);
            });
        } catch (error) {
            // Restore styles on any synchronous error
            restoreOriginalStyles(preparation);
            console.error('Export preparation failed:', error);
        }
    }, 100); // Reduced timeout since we're no longer changing widths
}

function calculateRequiredHeight() {
    if (!charts.value || charts.value.length === 0) return 600;
    
    // Find the lowest chart bottom edge
    const maxBottom = Math.max(...charts.value.map(chart => {
        const top = parseInt(chart.location.top || '0');
        const height = parseInt(chart.dimensions.height || '0');
        return top + height;
    }));
    
    // Add padding and ensure minimum
    return Math.max(maxBottom + 50, 600);
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
    <!-- Loading State -->
    <div v-if="pending" class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-1">Loading Dashboard</h3>
            <p class="text-sm text-gray-600">Please wait...</p>
        </div>
    </div>

    <!-- Main Dashboard -->
    <div v-else class="flex flex-col min-h-screen bg-gray-50">
        <!-- Professional Header -->
        <header class="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
            <div class="max-w-[1800px] mx-auto px-6 py-4">
                <div class="flex items-center justify-between">
                    <!-- Left: Dashboard Info -->
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-1">
                            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                <font-awesome icon="fas fa-chart-line" class="text-white text-lg" />
                            </div>
                            <div>
                                <h1 class="text-2xl font-bold text-gray-900">
                                    {{ dashboard?.name || 'Public Dashboard' }}
                                </h1>
                                <p v-if="dashboard?.description" class="text-sm text-gray-600 mt-0.5">
                                    {{ dashboard.description }}
                                </p>
                            </div>
                        </div>
                        
                        <!-- Metadata badges -->
                        <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span v-if="project?.name" class="flex items-center gap-1">
                                <font-awesome icon="fas fa-folder" />
                                {{ project.name }}
                            </span>
                            <span class="flex items-center gap-1">
                                <font-awesome icon="fas fa-chart-bar" />
                                {{ charts.length }} {{ charts.length === 1 ? 'Chart' : 'Charts' }}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Right: Export Button -->
                    <button 
                        @click="exportDashboardAsImage()"
                        class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium cursor-pointer">
                        <font-awesome icon="fas fa-download" />
                        <span>Export Dashboard</span>
                    </button>
                </div>
            </div>
        </header>

        <!-- Dashboard Content -->
        <main class="flex-1 max-w-[1800px] mx-auto w-full px-6 py-6">
            <!-- Empty State -->
            <div v-if="!charts || charts.length === 0" 
                 class="min-h-[400px] flex items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="text-center">
                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <font-awesome icon="fas fa-chart-bar" class="text-4xl text-gray-300" />
                    </div>
                    <h3 class="text-xl font-semibold text-gray-700 mb-2">No Visualizations Yet</h3>
                    <p class="text-sm text-gray-500">This dashboard doesn't contain any charts.</p>
                </div>
            </div>

            <!-- Dashboard Canvas -->
            <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden data-research-analysis">
                <!-- Positioning Container -->
                <div class="w-full relative bg-gradient-to-br from-gray-50 to-white overflow-x-auto"
                     :style="`min-height: ${calculateRequiredHeight()}px; padding: 20px;`">
                    
                    <!-- Optional grid background for reference -->
                    <div class="absolute inset-0 pointer-events-none opacity-5"
                         style="background-image: repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 20px),
                                                 repeating-linear-gradient(90deg, #000 0px, #000 1px, transparent 1px, transparent 20px);
                                background-size: 20px 20px;">
                    </div>
                    
                    <!-- Tooltip container for all charts -->
                    <div class="dashboard-tooltip-container fixed inset-0 pointer-events-none" style="z-index: 9999;"></div>
                    
                    <!-- Charts Container -->
                    <div class="w-full h-full draggable-div-container relative">
                        <div v-for="(chart, index) in charts"
                            class="absolute top-0 left-0 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-200"
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
                                                    :column-name="getChartColumnName(chart.chart_id)"
                                                    :enable-tooltips="true"
                                                    class="mt-5"
                                                />
                                                <donut-chart
                                                    v-if="chart.chart_type === 'donut'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :width="1200"
                                                    :height="1200"
                                                    :column-name="getChartColumnName(chart.chart_id)"
                                                    :enable-tooltips="true"
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
                                                    :x-axis-rotation="-45"
                                                    :column-name="getChartColumnName(chart.chart_id)"
                                                    :category-name="getChartCategoryName(chart.chart_id)"
                                                    :enable-tooltips="true"
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
                                                    :column-name="getChartColumnName(chart.chart_id)"
                                                    :category-name="getChartCategoryName(chart.chart_id)"
                                                    :enable-tooltips="true"
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
                                                    :x-axis-rotation="-45"
                                                    line-color="#FF5733"
                                                    :column-name="getChartColumnName(chart.chart_id)"
                                                    :category-name="getChartCategoryName(chart.chart_id)"
                                                    :enable-tooltips="true"
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
                                                    :x-axis-rotation="-45"
                                                    :editable-axis-labels="false"
                                                    :max-legend-width="350"
                                                    :column-name="getChartColumnName(chart.chart_id)"
                                                    :category-name="getChartCategoryName(chart.chart_id)"
                                                    :stack-name="getChartStackName(chart.chart_id)"
                                                    :enable-tooltips="true"
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
                                                    :editable-axis-labels="false"
                                                    :x-axis-rotation="-45"
                                                    :x-column-name="getChartXColumnName(chart.chart_id)"
                                                    :y-column-name="getChartYColumnName(chart.chart_id)"
                                                    :series-name="getChartSeriesName(chart.chart_id)"
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
                                                    :category-name="getChartCategoryName(chart.chart_id)"
                                                    :value-name="getChartValueName(chart.chart_id)"
                                                    class="mt-2"
                                                />
                                                <bubble-chart
                                                    v-if="chart.chart_type === 'bubble'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :width="parseInt(chart.dimensions.widthDraggable.replace('px', '')) - 40"
                                                    :height="parseInt(chart.dimensions.heightDraggable.replace('px', '')) - 80"
                                                    :x-column-name="getChartXColumnName(chart.chart_id)"
                                                    :y-column-name="getChartYColumnName(chart.chart_id)"
                                                    :size-column-name="getChartSizeColumnName(chart.chart_id)"
                                                    :label-column-name="getChartLabelColumnName(chart.chart_id)"
                                                    :enable-tooltips="true"
                                                    class="mt-2"
                                                />
                                            </div>
                                        </div>
                                    </template>
                                </draggable>
                                <div v-else :id="`draggable-${chart.chart_id}`">
                                    <div 
                                        :id="`chart-${chart.chart_id}`" 
                                        class="prose max-w-none p-4 bg-white"
                                        v-html="chart.text_editor.content"
                                        :style="'min-height: 200px;'"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Export Branding (appears in exported image only) -->
                    <div class="export-branding hidden absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
                        <div class="text-xs text-gray-500">
                            <div class="font-medium">Powered by Data Research Analysis</div>
                            <div class="text-blue-600 font-semibold mt-0.5">www.dataresearchanalysis.com</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- Professional Footer -->
        <footer class="bg-white border-t border-gray-200 mt-auto">
            <div class="max-w-[1800px] mx-auto px-6 py-4">
                <div class="flex items-center justify-center text-sm">
                    <!-- Branding -->
                    <NuxtLink 
                        to="/" 
                        class="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
                        <span class="font-medium">Powered by</span>
                        <span class="font-bold text-blue-600">Data Research Analysis</span>
                    </NuxtLink>
                </div>
            </div>
        </footer>
    </div>
</template>