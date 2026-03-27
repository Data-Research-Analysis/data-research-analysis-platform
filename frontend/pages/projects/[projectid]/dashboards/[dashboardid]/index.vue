<script setup>
definePageMeta({ layout: 'project' });

import { useOrganizationContext } from '@/composables/useOrganizationContext';
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import _ from 'lodash';

const projectsStore = useProjectsStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const { $swal } = useNuxtApp();
const router = useRouter();
const route = useRoute();

// Get project permissions
const projectId = computed(() => parseInt(String(route.params.projectid)));
const permissions = useProjectPermissions(projectId.value);

// Computed property for read-only mode
const isReadOnly = computed(() => !permissions.canUpdate.value);
const state = reactive({
    data_model_tables: [],
    chart_mode: 'table',//table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, treemap, funnel_steps, map
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
    sidebar_status: true,
    validation_status: null,
    show_validation_alert: false,
    exportPreparation: null,
    oversized_model_modal: {
        show: false,
        modelId: null,
        modelName: '',
        rowCount: null,
        sourceRowCount: null,
        threshold: null,
        healthStatus: '',
        healthIssues: [],
        message: '',
        bypass_active: false, // admin-only per-session bypass flag
        ai_loading: false,
        ai_analysis: null,
        ai_suggestions: [],
    },
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

// =========================================================================
// AI Insights widget state
// =========================================================================
// Per-chart date range pickers (keyed by chart_id)
const aiWidgetDates = reactive({});

// Per-chart loading/error/data state
const aiWidgetState = reactive({});

function initAIWidget(chart) {
    const chartId = chart.chart_id;
    if (!aiWidgetDates[chartId]) {
        // Seed from persisted preference on the chart object; fall back to last 30 days.
        const savedStart = chart.ai_chart_spec?.startDate;
        const savedEnd   = chart.ai_chart_spec?.endDate;
        const today = new Date();
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        aiWidgetDates[chartId] = {
            startDate: savedStart ?? monthAgo.toISOString().split('T')[0],
            endDate:   savedEnd   ?? today.toISOString().split('T')[0],
        };
    }
    if (!aiWidgetState[chartId]) {
        aiWidgetState[chartId] = { loading: false, loaded: false, error: null, data: null };
    }
}

/**
 * Transform raw AI widget rows into the data shape each chart component expects.
 * Uses ai_chart_spec.x_axis / y_axis to identify columns.
 */
function getAIWidgetChartData(chart) {
    const ws = aiWidgetState[chart.chart_id];
    if (!ws?.data?.rows?.length) return null;
    const { columns, rows } = ws.data;
    const spec = chart.ai_chart_spec ?? {};
    const chartType = spec.chart_type ?? 'table';
    const xCol = spec.x_axis ?? columns[0];
    const yCol = spec.y_axis ?? columns[1] ?? columns[0];
    if (chartType === 'table') {
        return { columns, rows };
    }
    if (['pie', 'donut', 'bar', 'area'].includes(chartType)) {
        return rows.map(row => ({
            label: String(row[xCol] ?? ''),
            value: parseFloat(row[yCol]) || 0,
        }));
    }
    if (chartType === 'line') {
        const cats = rows.map(row => String(row[xCol] ?? ''));
        const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
        const yCols = yCol ? [yCol] : columns.filter(c => c !== xCol);
        return {
            categories: cats,
            series: yCols.map((col, i) => ({
                name: col.replace(/_/g, ' '),
                data: rows.map(row => parseFloat(row[col]) || 0),
                color: colors[i % colors.length],
            })),
        };
    }
    if (chartType === 'kpi') {
        return { value: rows[0]?.[yCol] ?? rows[0]?.[columns[0]], label: spec.title ?? '' };
    }
    return { columns, rows };
}

async function loadAIWidgetData(chart) {
    const chartId = chart.chart_id;
    initAIWidget(chart);
    const { startDate, endDate } = aiWidgetDates[chartId];

    // Persist chosen dates on the chart spec so updateDashboard() saves them.
    if (chart.ai_chart_spec) {
        chart.ai_chart_spec.startDate = startDate;
        chart.ai_chart_spec.endDate   = endDate;
    }
    aiWidgetState[chartId] = { loading: true, loaded: false, error: null, data: null };

    try {
        const token = getAuthToken();
        const config = useRuntimeConfig();
        const dashboardId = dashboard.value?.id;
        const resp = await $fetch(
            `${config.public.apiBase}/dashboard/widgets/data?dashboardId=${dashboardId}&chartId=${chartId}&startDate=${startDate}&endDate=${endDate}`,
            { headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' } }
        );

        if (resp?.success && Array.isArray(resp.data)) {
            const rows = resp.data;
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            aiWidgetState[chartId] = {
                loading: false,
                loaded: true,
                error: null,
                data: { columns, rows },
            };
        } else {
            throw new Error(resp?.error ?? 'No data returned');
        }
    } catch (err) {
        aiWidgetState[chartId] = {
            loading: false,
            loaded: true,
            error: err?.data?.error ?? err?.message ?? 'Failed to load widget data',
            data: null,
        };
    }
}

async function openRegenerateModal(chart) {
    const { value: insightText } = await $swal.fire({
        title: 'Regenerate Widget',
        input: 'textarea',
        inputLabel: 'Describe what you want to visualise',
        inputPlaceholder: 'e.g. Show monthly revenue trend for last 6 months',
        inputValue: chart.ai_chart_spec?.description ?? '',
        showCancelButton: true,
        confirmButtonText: 'Regenerate',
        inputValidator: (v) => { if (!v?.trim()) return 'Please enter a description'; },
    });
    if (!insightText) return;

    const chartId = chart.chart_id;
    if (!aiWidgetState[chartId]) {
        aiWidgetState[chartId] = { loading: true, loaded: false, error: null, data: null };
    } else {
        aiWidgetState[chartId].loading = true;
    }

    try {
        const token = getAuthToken();
        const config = useRuntimeConfig();
        await $fetch(`${config.public.apiBase}/dashboard/widgets/regenerate`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
            body: {
                dashboardId: dashboard.value?.id,
                chartId,
                projectId: projectId.value,
                insightText: insightText.trim(),
            },
        });
        // Update local chart spec
        const localChart = state.dashboard.charts.find((c) => c.chart_id === chartId);
        if (localChart) {
            aiWidgetState[chartId].loading = false;
            await loadAIWidgetData(localChart);
        }
    } catch (err) {
        aiWidgetState[chartId].loading = false;
        aiWidgetState[chartId].error = err?.data?.error ?? err?.message ?? 'Regeneration failed';
    }
}

// Chart type placeholder images
const chartPlaceholders = {
    table: '/assets/images/chart-placeholders/table.png',
    text_block: '/assets/images/chart-placeholders/text_block.png',
    pie: '/assets/images/chart-placeholders/pie.png',
    donut: '/assets/images/chart-placeholders/donut.png',
    vertical_bar: '/assets/images/chart-placeholders/vertical_bar.png',
    horizontal_bar: '/assets/images/chart-placeholders/horizontal_bar.png',
    vertical_bar_line: '/assets/images/chart-placeholders/vertical_bar_line.png',
    stacked_bar: '/assets/images/chart-placeholders/stacked_bar.png',
    multiline: '/assets/images/chart-placeholders/multiline.png',
    treemap: '/assets/images/chart-placeholders/treemap.png',
    bubble: '/assets/images/chart-placeholders/bubble.png',
    // Marketing-native widget types (Phase 2 KPI Widget Library)
    kpi_scorecard: '/assets/images/chart-placeholders/table.png',
    budget_gauge: '/assets/images/chart-placeholders/donut.png',
    channel_comparison_table: '/assets/images/chart-placeholders/table.png',
    funnel_steps: '/assets/images/chart-placeholders/funnel_steps.jpg',
    journey_sankey: '/assets/images/chart-placeholders/multiline.png',
    roi_waterfall: '/assets/images/chart-placeholders/horizontal_bar.png',
    campaign_timeline: '/assets/images/chart-placeholders/vertical_bar.png',
    anomaly_alert_card: '/assets/images/chart-placeholders/table.png',
};

// Chart type labels
const chartTypeLabels = {
    table: 'Table',
    text_block: 'Text Block',
    pie: 'Pie Chart',
    donut: 'Donut Chart',
    vertical_bar: 'Bar Chart',
    horizontal_bar: 'Horizontal Bar Chart',
    vertical_bar_line: 'Combo Chart',
    stacked_bar: 'Stacked Bar Chart',
    multiline: 'Line Chart',
    treemap: 'Treemap',
    bubble: 'Bubble Chart',
    kpi_scorecard: 'KPI Scorecard',
    budget_gauge: 'Budget Gauge',
    channel_comparison_table: 'Channel Comparison',
    funnel_steps: 'Funnel Steps',
    journey_sankey: 'Journey Sankey',
    roi_waterfall: 'ROI Waterfall',
    campaign_timeline: 'Campaign Timeline',
    anomaly_alert_card: 'Anomaly Alert',
};

// Marketing widget types that don't use the data-model column mechanism
const MARKETING_WIDGET_TYPES = [
    'kpi_scorecard', 'budget_gauge', 'channel_comparison_table',
    'journey_sankey', 'roi_waterfall',
    'campaign_timeline', 'anomaly_alert_card',
];

function isMarketingWidget(chart) {
    return MARKETING_WIDGET_TYPES.includes(chart.chart_type);
}

function getDefaultMarketingConfig(chartType) {
    const defaults = {
        kpi_scorecard: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
        budget_gauge: { campaign_id: '', show_daily_pace: true, thresholds: { warning: 80, danger: 95 } },
        channel_comparison_table: { columns: ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpl', 'roas'], sort_by: 'spend' },
        journey_sankey: { max_paths: 5, min_conversions: 1 },
        roi_waterfall: { include_offline: false, group_by: 'channel' },
        campaign_timeline: { show_budget_pacing: true, show_only_active: false, time_window: '30_days' },
        anomaly_alert_card: { metric: 'spend', threshold_pct: 20, comparison_window: '4_week_avg', alert_direction: 'both' },
    };
    return defaults[chartType] ?? {};
}

// Check if chart is empty (no columns configured)
// Marketing widgets are never considered empty — they manage their own data
function isChartEmpty(chart) {
    if (isMarketingWidget(chart)) return false;
    return !chart.columns || chart.columns.length === 0;
}

// Get human-readable chart type label
function getChartTypeLabel(chartType) {
    return chartTypeLabels[chartType] || 'Chart';
}

watch(
    dashboardsStore.selectedDashboard,
    (value, oldValue) => {
        const dashboard = dashboardsStore.getSelectedDashboard();
        const charts = dashboard?.data?.charts || [];
        
        state.dashboard.charts = charts.map((chart) => {
            return {
                ...chart,
                text_editor: chart.text_editor || { content: '' },
                dimensions: chart.dimensions || {
                    width: '400px',
                    height: '300px',
                    widthDraggable: '400px',
                    heightDraggable: '300px',
                },
                location: chart.location || {
                    top: '0px',
                    left: '0px',
                },
                config: {
                    drag_enabled: false,
                    resize_enabled: false,
                    add_columns_enabled: false,
                },
            };
        }) || [];

        if (import.meta.client) {
            // Auto-load data for ai_insights charts so data is present on every
            // page load without the user having to click "Load Data" manually.
            state.dashboard.charts.forEach((chart) => {
                if (chart.source_type === 'ai_insights') {
                    loadAIWidgetData(chart);
                }
            });

            nextTick(() => {
                state.dashboard.charts.forEach((chart) => {
                    const draggableDiv = document.getElementById(`draggable-${chart.chart_id}`);
                    if (draggableDiv && chart.dimensions) {
                        draggableDiv.style.width = chart.dimensions.widthDraggable;
                        draggableDiv.style.minHeight = chart.dimensions.heightDraggable;
                    }

                    if (chart.chart_type === 'table') {
                        autoResizeTableContainer(chart.chart_id);
                    }
                });
            });
        }
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

function addChartToDashboard(chartType) {
    if (isReadOnly.value) {
        $swal.fire({
            icon: 'warning',
            title: 'View Only Mode',
            text: 'You do not have permission to add charts to this dashboard.',
        });
        return;
    }
    
    //table, pie, vertical_bar, horizontal_bar, vertical_bar_line, stacked_bar, multiline, heatmap, bubble, stacked_area, treemap, funnel_steps, map
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
    // Default marketing_config for marketing widget types
    const defaultMarketingConfig = MARKETING_WIDGET_TYPES.includes(chartType) ? getDefaultMarketingConfig(chartType) : undefined;

    state.dashboard.charts.push({
        x_axis_label: 'X Axis',
        y_axis_label: 'Y Axis',
        chart_type: chartType,
        chart_id: state.dashboard.charts.length + 1,
        columns: [],
        table_name: '',
        data: [],
        stack_keys: [],
        line_data: [],
        text_editor: {
            content: '',
        },
        marketing_config: defaultMarketingConfig,
        config: {
            drag_enabled: false,
            resize_enabled: false,
            add_columns_enabled: false,
        },
        dimensions: {
            width: MARKETING_WIDGET_TYPES.includes(chartType) ? '350px' : '200px',
            height: MARKETING_WIDGET_TYPES.includes(chartType) ? '300px' : '200px',
            widthDraggable: MARKETING_WIDGET_TYPES.includes(chartType) ? '350px' : '200px',
            heightDraggable: MARKETING_WIDGET_TYPES.includes(chartType) ? '300px' : '200px',
        },
        location: {
            top: '0px',
            left: '0px',
        },
    });

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

function deleteChartFromDashboard(chartId) {
    if (isReadOnly.value) {
        $swal.fire({
            icon: 'warning',
            title: 'View Only Mode',
            text: 'You do not have permission to delete charts from this dashboard.',
        });
        return;
    }
    
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

/**
 * Get logical table name for a physical table
 * @param {string} tableName - Physical table name
 * @returns {string} Logical name or cleaned physical name
 */
function getLogicalTableName(tableName) {
    const dataModel = state.data_model_tables.find(dm => dm.model_name === tableName);
    if (dataModel?.logical_name) {
        return dataModel.logical_name;
    }
    // Fallback: return cleaned physical name
    return dataModel?.cleaned_model_name || tableName.replace(/_dra.[\w\d]+/g, '');
}

/**
 * Clean column name by removing table prefix
 * @param {string} columnName - Physical column name (e.g., "ds64_51d5769b_id")
 * @param {string} tableName - Physical table name (e.g., "ds64_51d5769b")
 * @returns {string} Clean column name (e.g., "id")
 */
function getCleanColumnName(columnName, tableName) {
    if (!columnName) return columnName;
    
    // Remove table prefix pattern (e.g., "ds64_51d5769b_" from "ds64_51d5769b_id")
    // The pattern is: ds<digits>_<hash>_
    const tablePrefix = tableName + '_';
    if (columnName.startsWith(tablePrefix)) {
        return columnName.substring(tablePrefix.length);
    }
    
    // If no exact match, try to find and remove any datasource prefix pattern
    const prefixPattern = /^ds\d+_[a-f0-9]+_/;
    if (prefixPattern.test(columnName)) {
        return columnName.replace(prefixPattern, '');
    }
    
    // Return as-is if no prefix found
    return columnName;
}

async function executeQueryOnDataModels(chartId) {
    state.response_from_data_models_columns = [];
    state.response_from_data_models_rows = [];
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId)
    if (chart) {
        chart.config.add_columns_enabled = false;
        chart.data = [];
        chart.line_data = [];
        chart.stack_keys = [];
        chart.sql_query = buildSQLQuery(chart);
        const sqlQuery = chart.sql_query;
        const token = getAuthToken();
        const url = `${baseUrl()}/data-model/execute-query-on-data-model`;

        // Resolve data_model_id for the pre-flight block check (use first column's table)
        const firstTableName = chart.columns?.[0]?.table_name;
        const dataModelEntry = firstTableName
            ? state.data_model_tables.find(dm => dm.model_name === firstTableName)
            : null;
        const dataModelId = dataModelEntry?.data_model_id ?? undefined;

        // Skip the pre-flight block if the per-session bypass is active
        const bypassActive = state.oversized_model_modal.bypass_active;

        let data;
        try {
            data = await $fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {
                    query: sqlQuery,
                    project_id: parseInt(route.params.projectid),
                    ...(dataModelId && !bypassActive ? { data_model_id: dataModelId } : {}),
                }
            });
        } catch (err) {
            const errData = err?.data ?? err?.response?._data;
            if (errData?.error === 'DATA_MODEL_OVERSIZED') {
                state.oversized_model_modal = {
                    show: true,
                    modelId: errData.modelId,
                    modelName: errData.modelName,
                    rowCount: errData.rowCount,
                    sourceRowCount: errData.sourceRowCount,
                    threshold: errData.threshold,
                    healthStatus: errData.healthStatus,
                    healthIssues: errData.healthIssues ?? [],
                    message: errData.message,
                    bypass_active: false,
                };
            }
            return;
        }
        // Ensure data is an array before assigning
        state.response_from_data_models_rows = Array.isArray(data) ? data : [];
        state.response_from_data_models_columns = chart.columns.map((column) => column.column_name);
        const labelValues = [];
        const numericValues = [];
        const numericLineValues = [];
        let stackedValues = [];
        state.selected_chart.result_from_query = state.response_from_data_models_rows;
        if (['pie', 'donut', 'vertical_bar', 'horizontal_bar', 'bubble', 'funnel_steps'].includes(chart.chart_type)) {
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
            // Process table data with logical table names and clean column names
            const uniqueTables = _.uniq(chart.columns.map(c => c.table_name));
            
            // Create column display names and mapping
            const columnMapping = {}; // Maps display name to original column name
            const columns = chart.columns
                .map((column) => {
                    const cleanColumnName = getCleanColumnName(column.column_name, column.table_name);
                    let displayName;
                    if (uniqueTables.length > 1) {
                        // Multiple tables - show logical table prefix
                        const logicalTableName = getLogicalTableName(column.table_name);
                        displayName = `${logicalTableName}.${cleanColumnName}`;
                    } else {
                        // Single table - no prefix needed, just clean column name
                        displayName = cleanColumnName;
                    }
                    columnMapping[displayName] = column.column_name; // Map display name to original DB column name
                    return displayName;
                })
                .filter(col => col && col.trim() !== ''); // Filter out empty columns
            
            // Remap row data keys to use display names
            const rows = state.response_from_data_models_rows
                .filter(row => row && typeof row === 'object' && Object.keys(row).length > 0)
                .map(row => {
                    const remappedRow = {};
                    columns.forEach(displayName => {
                        const originalName = columnMapping[displayName];
                        remappedRow[displayName] = row[originalName];
                    });
                    return remappedRow;
                });
            
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
        chart.config.add_columns_enabled = true;
    }
}
async function updateDashboard() {
    if (isReadOnly.value) {
        $swal.fire({
            icon: 'warning',
            title: 'View Only Mode',
            text: 'You do not have permission to update this dashboard.',
        });
        return;
    }
    
    // PHASE 2 REQUIREMENT: Validate workspace selection before allowing dashboard update
    const { requireWorkspace } = useOrganizationContext();
    const validation = requireWorkspace();
    if (!validation.valid) {
        await $swal.fire({
            title: 'Workspace Required',
            text: validation.error || 'Please select a workspace before updating a dashboard.',
            icon: 'warning',
            confirmButtonColor: '#3C8DBC',
        });
        return;
    }
    
    const token = getAuthToken();
    let url = `${baseUrl()}/dashboard/update/${dashboard.value.id}`;
    try {
        await $fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                project_id: project.value.id,
                data: state.dashboard,
            }
        });
        $swal.fire({
            icon: 'success',
            title: `Success! `,
            text: 'The dashboard has been sucessfully updated.',
        });
    } catch (error) {
        $swal.fire({
            icon: 'error',
            title: `Error! `,
            text: 'Unfortunately, we encountered an error! Please refresh the page and try again.',
        });
    }
}
async function dismissValidationAlert() {
    try {
        const token = getAuthToken();
        await $fetch(
            `${baseUrl()}/dashboard/clear-validation/${dashboard.value.id}`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            }
        );
        
        state.show_validation_alert = false;
        state.validation_status = null;
    } catch (error) {
        console.error('Failed to dismiss alert:', error);
    }
}

function updateContent(content, chartId) {
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    if (chart) {
        if (!chart.text_editor) {
            chart.text_editor = {};
        }
        chart.text_editor.content = content;
    }
}

function toggleDragging(event, chartId) {
    if (isReadOnly.value) {
        $swal.fire({
            icon: 'warning',
            title: 'View Only Mode',
            text: 'You do not have permission to modify charts from this dashboard.',
        });
        return;
    }
    
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
    if (isReadOnly.value) {
        $swal.fire({
            icon: 'warning',
            title: 'View Only Mode',
            text: 'You do not have permission to modify charts from this dashboard.',
        });
        return;
    }
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
    if (isReadOnly.value) {
        $swal.fire({
            icon: 'warning',
            title: 'View Only Mode',
            text: 'You do not have permission to modify charts from this dashboard.',
        });
        return;
    }
    
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
    const draggableInnerDiv = document.getElementById(`draggable-div-inner-container-${state.selected_chart.chart_id}`);
    const chartDiv =
        document.getElementById(`chart-${state.selected_chart.chart_id}`) ??
        document.getElementById(`ai-chart-${state.selected_chart.chart_id}`);
    if (state.is_mouse_down && state.is_resizing && state.selected_div && draggableDiv) {
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
        
        //add a 100px margin to both the heights
        //do not allow the height of the div to be less than the height of the chart
        const chartRefHeight = chartDiv ? chartDiv.offsetHeight : 200;
        newHeight = Math.max(chartRefHeight, newHeight) + 50;
        newHeightDraggable = Math.max(chartRefHeight, newHeightDraggable) + 50;

        state.selected_div.style.width = `${newWidth}px`;
        state.selected_div.style.minHeight = `${newHeight}px`;
        draggableDiv.style.width = `${newWidthDraggable}px`;//set the width of the draggable
        draggableDiv.style.minHeight = `${newHeightDraggable}px`;//set the height of the draggable
        draggableInnerDiv.style.width = `${newWidthDraggable}px`;

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
async function updateDataModel(action, data) {
    if (isReadOnly.value) {
        $swal.fire({
            icon: 'warning',
            title: 'View Only Mode',
            text: 'You do not have permission to modify columns in this dashboard.',
        });
        return;
    }
    
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
        
        // Auto-resize table containers when columns change
        if (state.selected_chart.chart_type === 'table') {
            autoResizeTableContainer(state.selected_chart.chart_id);
        }
    }
}
async function openTableDialog(chartId) {
    if (isReadOnly.value) {
        $swal.fire({
            icon: 'warning',
            title: 'View Only Mode',
            text: 'You do not have permission to modify charts from this dashboard.',
        });
        return;
    }
    state.show_table_dialog = true;
    state.selected_chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId);
    const chart = state.dashboard.charts.find((chart) => chart.chart_id === chartId)
    const sqlQuery = buildSQLQuery(chart);
    // Use logical table names and clean column names for table dialog
    const uniqueTables = _.uniq(state.selected_chart.columns.map(c => c.table_name));
    
    // Create column display names and mapping
    const columnMapping = {}; // Maps display name to original column name
    state.response_from_data_models_columns = state.selected_chart.columns.map((column) => {
        const cleanColumnName = getCleanColumnName(column.column_name, column.table_name);
        let displayName;
        if (uniqueTables.length > 1) {
            // Multiple tables - show logical table prefix
            const logicalTableName = getLogicalTableName(column.table_name);
            displayName = `${logicalTableName}.${cleanColumnName}`;
        } else {
            // Single table - no prefix needed, just clean column name
            displayName = cleanColumnName;
        }
        columnMapping[displayName] = column.column_name; // Map display name to original DB column name
        return displayName;
    });
    
    const token = getAuthToken();
    const url = `${baseUrl()}/data-model/execute-query-on-data-model`;
    // Resolve data_model_id for the block check
    const firstTableName = state.selected_chart.columns?.[0]?.table_name;
    const dataModelEntry = firstTableName
        ? state.data_model_tables.find(dm => dm.model_name === firstTableName)
        : null;
    const dataModelId = dataModelEntry?.data_model_id ?? undefined;
    const bypassActive = state.oversized_model_modal.bypass_active;

    let data;
    try {
        data = await $fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                query: sqlQuery,
                project_id: parseInt(route.params.projectid),
                ...(dataModelId && !bypassActive ? { data_model_id: dataModelId } : {}),
            }
        });
    } catch (err) {
        const errData = err?.data ?? err?.response?._data;
        if (errData?.error === 'DATA_MODEL_OVERSIZED') {
            state.show_table_dialog = false;
            state.oversized_model_modal = {
                show: true,
                modelId: errData.modelId,
                modelName: errData.modelName,
                rowCount: errData.rowCount,
                sourceRowCount: errData.sourceRowCount,
                threshold: errData.threshold,
                healthStatus: errData.healthStatus,
                healthIssues: errData.healthIssues ?? [],
                message: errData.message,
                bypass_active: false,
            };
        }
        return;
    }
    
    // Remap row data keys to use display names
    const rawRows = Array.isArray(data) ? data : [];
    state.response_from_data_models_rows = rawRows.map(row => {
        const remappedRow = {};
        state.response_from_data_models_columns.forEach(displayName => {
            const originalName = columnMapping[displayName];
            remappedRow[displayName] = row[originalName];
        });
        return remappedRow;
    });
}
function closeTableDialog() {
    state.show_table_dialog = false
}

function closeOversizedModal() {
    state.oversized_model_modal.show = false;
}

function formatLargeNumber(n) {
    if (n == null) return 'Unknown';
    return Number(n).toLocaleString();
}

function bypassOversizedModelForSession(chartId) {
    state.oversized_model_modal.bypass_active = true;
    state.oversized_model_modal.show = false;
    // Retry the query with bypass flag active
    if (chartId) {
        executeQueryOnDataModels(chartId);
    } else if (state.selected_chart?.chart_id) {
        executeQueryOnDataModels(state.selected_chart.chart_id);
    }
}

async function askAIToSuggestFix() {
    const modelId = state.oversized_model_modal.modelId;
    if (!modelId) return;
    state.oversized_model_modal.ai_loading = true;
    state.oversized_model_modal.ai_analysis = null;
    state.oversized_model_modal.ai_suggestions = [];
    try {
        const token = getAuthToken();
        const result = await $fetch(`${baseUrl()}/data-model/${modelId}/suggest-optimization`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        state.oversized_model_modal.ai_analysis = result?.analysis ?? null;
        state.oversized_model_modal.ai_suggestions = result?.suggestions ?? [];
    } catch (err) {
        console.error('[Dashboard] AI suggestion failed:', err);
        state.oversized_model_modal.ai_analysis = 'AI could not generate suggestions at this time. Please try again.';
    } finally {
        state.oversized_model_modal.ai_loading = false;
    }
}

function applyAISuggestion(suggestion) {
    const modelId = state.oversized_model_modal.modelId;
    if (!modelId) return;
    dataModelsStore.setPendingSQLSuggestion({
        dataModelId: modelId,
        sql: suggestion.revisedSQL,
        description: suggestion.description,
    });
    closeOversizedModal();
    router.push(`/projects/${route.params.projectid}/data-models/${modelId}/edit`);
}

// Helper functions for column name extraction
function getChartColumnName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 2) return 'Value';
    return chart.columns[1].column_name || 'Value';
}

function getChartCategoryName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 1) return 'Category';
    return chart.columns[0].column_name || 'Category';
}

function getChartStackName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 3) return 'Stack';
    return chart.columns[2].column_name || 'Stack';
}

function getChartXColumnName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 1) return 'X';
    return chart.columns[0].column_name || 'X';
}

function getChartYColumnName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 2) return 'Y';
    return chart.columns[1].column_name || 'Y';
}

function getChartSeriesName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 2) return 'Series';
    return chart.columns[1].column_name || 'Series';
}

function getChartSizeColumnName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 3) return 'Size';
    return chart.columns[2].column_name || 'Size';
}

function getChartLabelColumnName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 1) return 'Label';
    return chart.columns[0].column_name || 'Label';
}

function getChartValueName(chart) {
    if (!chart || !chart.columns || chart.columns.length < 2) return 'Value';
    return chart.columns[1].column_name || 'Value';
}

// Export preparation and cleanup functions
function prepareForExport() {
    if (!import.meta.client) return null;
    
    const dashboardContainer = document.querySelector('.flex.flex-col.min-h-200.max-h-200.h-200.overflow-hidden.overflow-x-auto');
    
    if (!dashboardContainer) return null;
    
    const originalStyles = {
        height: dashboardContainer.style.height || '',
        maxHeight: dashboardContainer.style.maxHeight || '',
        minHeight: dashboardContainer.style.minHeight || '',
        overflow: dashboardContainer.style.overflow || '',
        overflowX: dashboardContainer.style.overflowX || '',
        overflowY: dashboardContainer.style.overflowY || ''
    };
    
    const scrollHeight = dashboardContainer.scrollHeight;
    
    dashboardContainer.style.height = 'auto';
    dashboardContainer.style.maxHeight = 'none';
    dashboardContainer.style.minHeight = `${Math.max(scrollHeight, 400)}px`;
    dashboardContainer.style.overflow = 'visible';
    dashboardContainer.style.overflowX = 'visible';
    dashboardContainer.style.overflowY = 'visible';
    
    return { 
        dashboardContainer, 
        originalStyles
    };
}

function restoreOriginalStyles(preparation) {
    if (!preparation || !preparation.dashboardContainer || !preparation.originalStyles) return;
    
    const { dashboardContainer, originalStyles } = preparation;
    
    dashboardContainer.style.height = originalStyles.height;
    dashboardContainer.style.maxHeight = originalStyles.maxHeight;
    dashboardContainer.style.minHeight = originalStyles.minHeight;
    dashboardContainer.style.overflow = originalStyles.overflow;
    dashboardContainer.style.overflowX = originalStyles.overflowX;
    dashboardContainer.style.overflowY = originalStyles.overflowY;
}

function cleanupExportStyles() {
    if (state.exportPreparation) {
        restoreOriginalStyles(state.exportPreparation);
        state.exportPreparation = null;
    }
}

function cleanupAllTooltips() {
    if (!import.meta.client) return;
    
    // Remove all chart tooltips by class
    const d3 = useNuxtApp().$d3;
    if (d3) {
        d3.selectAll('.pie-chart-tooltip').remove();
        d3.selectAll('.donut-chart-tooltip').remove();
        d3.selectAll('.vertical-bar-tooltip').remove();
        d3.selectAll('.horizontal-bar-tooltip').remove();
        d3.selectAll('.stacked-bar-tooltip').remove();
        d3.selectAll('.multiline-tooltip').remove();
        d3.selectAll('.treemap-tooltip').remove();
        d3.selectAll('.bubble-tooltip').remove();
    }
}

function exportDashboardAsImage() {
    if (!import.meta.client) return;
    
    const dashboardElement = document.querySelector('.data-research-analysis');
    if (!dashboardElement) return;
    
    const preparation = prepareForExport();
    state.exportPreparation = preparation;
    
    if (!preparation) {
        console.error('Failed to prepare containers for export');
        return;
    }
    
    setTimeout(() => {
        try {
            const captureWidth = dashboardElement.scrollWidth;
            const captureHeight = dashboardElement.scrollHeight;
            
            $htmlToImageToPng(dashboardElement, {
                width: captureWidth,
                height: captureHeight,
                backgroundColor: '#ffffff',
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0
            }).then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `${dashboard.value.name || 'dashboard'}.png`;
                link.href = dataUrl;
                link.click();
            }).catch((error) => {
                console.error('Export failed:', error);
                $swal.fire({
                    icon: 'error',
                    title: 'Export Failed',
                    text: 'Failed to export dashboard as image. Please try again.',
                });
            }).finally(() => {
                cleanupExportStyles();
            });
        } catch (error) {
            cleanupExportStyles();
            console.error('Export preparation failed:', error);
        }
    }, 100);
}
async function exportAsWebPage(closeMenu) {
    
    // Close the menu first
    if (closeMenu && typeof closeMenu === 'function') {
        closeMenu();
    }
    
    try {
        const token = getAuthToken();
        if (!dashboard.value?.id) {
            $swal.fire({
                icon: 'error',
                title: `Error! `,
                text: 'Dashboard ID is missing. Please refresh the page and try again.',
            });
            return;
        }
        
        let url = `${baseUrl()}/dashboard/generate-public-export-link/${dashboard.value.id}`;
        
        const data = await $fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        await dashboardsStore.retrieveDashboards();
        
        // Construct the public dashboard URL directly without using router
        const publicDashboardUrl = `${window.location.origin}/public-dashboard/${data.key}`;
        window.open(publicDashboardUrl, '_blank');
    } catch (error) {
        console.error('Error in exportAsWebPage:', error);
        $swal.fire({
            icon: 'error',
            title: `Error! `,
            text: 'An unexpected error occurred. Please try again.',
        });
    }
}
function toggleSidebars(value) {
    state.sidebar_status = value;
}
onMounted(async () => {
    state.data_model_tables = []
    dataModelTables?.value?.forEach((dataModelTable) => {
        state.data_model_tables.push({
            schema: dataModelTable.schema,
            model_name: dataModelTable.table_name,
            cleaned_model_name: dataModelTable.logical_name || dataModelTable.table_name.replace(/_dra.[\w\d]+/g, ''),
            logical_name: dataModelTable.logical_name,
            show_model: false,
            columns: dataModelTable.columns,
            health_status: dataModelTable.health_status ?? 'unknown',
            model_type: dataModelTable.model_type ?? null,
            source_row_count: dataModelTable.source_row_count ?? null,
            row_count: dataModelTable.row_count ?? 0,
            data_model_id: dataModelTable.data_model_id,
        })
    })
    // Only add event listeners on client side for SSR compatibility
    if (import.meta.client) {
        document.addEventListener('mousedown', mouseDown);
        document.addEventListener('mouseup', mouseUp);
    }
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

    // Auto-load data for each ai_insights chart on mount so data is present
    // immediately after every page refresh without manual "Load Data" clicks.
    (state.dashboard.charts ?? []).forEach((chart) => {
        if (chart.source_type === 'ai_insights') {
            loadAIWidgetData(chart);
        }
    });
});

onBeforeUnmount(() => {
    // Cleanup export styles before component unmounts
    cleanupExportStyles();
    
    // Cleanup all chart tooltips
    cleanupAllTooltips();
    
    // Remove event listeners
    if (import.meta.client) {
        document.removeEventListener('mousedown', mouseDown);
        document.removeEventListener('mouseup', mouseUp);
    }
});

onUnmounted(() => {
    // Final cleanup to ensure styles are restored
    cleanupExportStyles();
    
    // Final tooltip cleanup
    cleanupAllTooltips();
});
</script>
<template>
    <div>
        <div v-if="project && dashboard" class="flex flex-row">
            <div class="transition-all duration-300" :class="{ 'w-1/6': state.sidebar_status, 'w-0': !state.sidebar_status }">
                <sidebar
                    :data-models="state.data_model_tables"
                    :selected-chart="state.selected_chart"
                    @add:selectedColumns="(data) => updateDataModel('add', data)"
                    @remove:selectedColumns="(data) => updateDataModel('remove', data)"
                    @toggleSidebar="toggleSidebars"
                    @update:marketingConfig="({ chart_id, config }) => {
                        const chart = state.dashboard.charts.find(c => c.chart_id === chart_id);
                        if (chart) chart.marketing_config = config;
                    }"
                />
            </div>
            <div class="flex flex-row w-full">
            <div class="flex flex-col ml-2 mr-2 w-full">
                <div class="flex flex-row justify-between">
                    <!-- Read-only indicator for viewers -->
                    <div v-if="isReadOnly" class="flex items-center mt-7 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg">
                        <font-awesome icon="fas fa-eye" class="text-gray-600 mr-2" />
                        <span class="text-sm font-medium text-gray-700">View Only Mode</span>
                    </div>
                    
                    <div v-if="!isReadOnly" class="flex flex-row ml-auto">
                        <div @click="updateDashboard" class="flex flex-row items-center h-12 mt-7 text-md text-white font-bold border-r-1 border-white border-solid cursor-pointer select-none bg-primary-blue-100 hover:bg-primary-blue-400 rounded-tl-lg">
                            <h3 class="ml-2 mr-2">Update Dashboard</h3>
                        </div>
                        <div @click="exportAsWebPage" class="flex flex-row items-center h-12 mr-2 mt-7 text-md text-white font-bold cursor-pointer select-none bg-primary-blue-100 hover:bg-primary-blue-400 rounded-tr-lg">
                            <h3 class="ml-2 mr-2">Export Dashboard</h3>
                        </div>
                    </div>
                </div>

                <!-- Validation Alert Banner -->
                <div v-if="state.show_validation_alert && state.validation_status?.needs_validation"
                    class="flex flex-col p-4 mb-4 bg-orange-50 border-l-4 border-orange-500 rounded"
                    :class="{'ml-10': state.sidebar_status}"
                >
                    <div class="flex flex-row justify-between items-start">
                        <div class="flex flex-row items-start flex-1">
                            <font-awesome 
                                icon="fas fa-exclamation-triangle"
                                class="text-2xl text-orange-500 mt-1 mr-3"
                            />
                            <div class="flex flex-col flex-1">
                                <h3 class="text-lg font-bold text-orange-800 mb-2">Dashboard Needs Update</h3>
                                <p class="text-sm text-orange-700 mb-3">
                                    One or more data models used in this dashboard have been refreshed with schema changes. 
                                    Some charts may have missing columns or data type mismatches.
                                </p>
                                
                                <!-- Validation Issues -->
                                <div v-if="state.validation_status?.validation_details" class="mb-3">
                                    <div v-for="issue in state.validation_status.validation_details" :key="issue.chart_id" class="mb-2">
                                        <p class="text-sm font-semibold text-orange-800">
                                            Chart "{{ issue.chart_type }}" (ID: {{ issue.chart_id }})
                                        </p>
                                        <ul class="ml-4 text-sm text-orange-700">
                                            <li v-for="col in issue.missing_columns" :key="col" class="list-disc">
                                                Missing column: <span class="font-mono bg-orange-100 px-1 rounded">{{ col }}</span>
                                            </li>
                                            <li v-for="change in issue.type_changes" :key="change.column" class="list-disc">
                                                Column <span class="font-mono bg-orange-100 px-1 rounded">{{ change.column }}</span> 
                                                type changed: {{ change.old_type }} → {{ change.new_type }}
                                            </li>
                                        </ul>
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div class="flex flex-row gap-3">
                                    <button
                                        @click="updateDashboard"
                                        class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded text-sm"
                                    >
                                        Update Dashboard Now
                                    </button>
                                    <button
                                        @click="dismissValidationAlert"
                                        class="px-4 py-2 bg-white hover:bg-gray-100 text-orange-700 font-semibold rounded border border-orange-500 text-sm"
                                    >
                                        Dismiss Alert
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Close Button -->
                        <button
                            @click="state.show_validation_alert = false"
                            class="ml-4 text-orange-500 hover:text-orange-700"
                        >
                            <font-awesome icon="fas fa-times" class="text-xl" />
                        </button>
                    </div>
                </div>

                <div class="flex flex-col min-h-200 max-h-200 h-200 overflow-hidden overflow-x-auto mr-2 mb-10 border border-primary-blue-100 border-solid bg-white rounded-tl-lg rounded-br-lg rounded-bl-lg"
                    :class="{'ml-10': state.sidebar_status}"
                    style="background-image: repeating-linear-gradient(0deg, #e5e7eb 0px, #e5e7eb 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #e5e7eb 0px, #e5e7eb 1px, transparent 1px, transparent 20px); background-size: 20px 20px;"
                >
                    <!-- Tooltip container for all charts - positioned above dashboard content -->
                    <div class="dashboard-tooltip-container fixed inset-0 pointer-events-none" style="z-index: 9999;"></div>
                    
                    <div class="w-full h-full draggable-div-container relative rounded-lg">
                        <div v-for="(chart, index) in charts"
                            class="w-50 flex flex-col justify-between cursor-pointer draggable-div absolute top-0 left-0"
                            :id="`draggable-div-${chart.chart_id}`"
                            :style="`width: ${chart.dimensions.width}; height: ${chart.dimensions.height}; top: ${chart.location.top}; left: ${chart.location.left};`"
                        >
                            <div class="flex flex-col bg-white rounded-lg shadow-md">
                                <div
                                    :id="`draggable-div-inner-container-${chart.chart_id}`"
                                    class="flex flex-row bg-gradient-to-b from-gray-50 to-white border border-gray-200 border-b-0 p-2 rounded-t-lg"
                                    :class="{ 'cursor-move': chart.config.drag_enabled }"
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
                                        v-if="chart.chart_type !== 'text_block' && !isMarketingWidget(chart)"
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
                                        class="text-xl ml-2 text-gray-500 hover:text-red-500 cursor-pointer"
                                        :v-tippy-content="'Delete Chart'"
                                        @click="deleteChartFromDashboard(chart.chart_id)"
                                    />
                                    <font-awesome 
                                        v-if="!isMarketingWidget(chart)"
                                        icon="fas fa-table"
                                        class="text-xl ml-2 text-gray-500 hover:text-gray-400 cursor-pointer"
                                        :v-tippy-content="'View Data In Table'"
                                        @click="openTableDialog(chart.chart_id)"
                                    />
                                </div>
                                
                                <!-- Empty chart placeholder - shows when no columns configured (not applicable for marketing or AI widgets) -->
                                <div v-if="isChartEmpty(chart) && chart.chart_type !== 'text_block' && !isMarketingWidget(chart) && chart.source_type !== 'ai_insights'" 
                                     class="min-h-[300px] flex flex-col items-center justify-center bg-gray-50 border border-gray-200 border-t-0 rounded-b-lg"
                                >
                                    <img 
                                        :src="chartPlaceholders[chart.chart_type]" 
                                        :alt="`${chart.chart_type} preview`"
                                        class="max-w-[200px] max-h-[200px] opacity-30 select-none pointer-events-none"
                                    />
                                    <p class="mt-4 text-gray-500 text-base font-semibold">
                                        {{ getChartTypeLabel(chart.chart_type) }}
                                    </p>
                                    <p class="text-gray-400 text-sm mt-1">
                                        Click "Add Columns" to configure
                                    </p>
                                </div>
                                
                                <!-- Column dropzone and chart rendering - shows when columns exist (not used by marketing or AI widgets) -->
                                <draggable
                                    v-if="!isChartEmpty(chart) && chart.chart_type !== 'text_block' && !isMarketingWidget(chart) && chart.source_type !== 'ai_insights'"
                                    :id="`draggable-${chart.chart_id}`"
                                    v-model="chart.columns"
                                    group="data_model_columns"
                                    itemKey="column_name"
                                    class="min-h-[300px] flex flex-row w-full h-50 bg-white border border-gray-200 border-t-0 rounded-b-lg draggable-model-columns"
                                    tag="div"
                                    :disabled="!chart.config.add_columns_enabled"
                                    @change="changeDataModel($event, chart.chart_id)"
                                >
                                    <template #item="{ element, index }">
                                        <div v-if="index === 0" class="text-left font-bold text-white px-4 py-2 border-r-1 border-gray-200">
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
                                                    :column-name="getChartColumnName(chart)"
                                                    :category-column="getChartCategoryName(chart)"
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
                                                    :column-name="getChartColumnName(chart)"
                                                    :category-column="getChartCategoryName(chart)"
                                                    :enable-tooltips="true"
                                                />
                                                <vertical-bar-chart
                                                    v-if="chart.chart_type === 'vertical_bar'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :x-axis-label="chart.x_axis_label"
                                                    :y-axis-label="chart.y_axis_label"
                                                    :x-axis-rotation="-45"
                                                    :column-name="getChartColumnName(chart)"
                                                    :category-name="getChartCategoryName(chart)"
                                                    :category-column="getChartCategoryName(chart)"
                                                    :enable-tooltips="true"
                                                    @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                    @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                                    class="mt-5"
                                                />
                                                <horizontal-bar-chart
                                                    v-if="chart.chart_type === 'horizontal_bar'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :x-axis-label="chart.x_axis_label"
                                                    :y-axis-label="chart.y_axis_label"
                                                    :column-name="getChartColumnName(chart)"
                                                    :category-name="getChartCategoryName(chart)"
                                                    :category-column="getChartCategoryName(chart)"
                                                    :enable-tooltips="true"
                                                    @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                    @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                                    class="mt-5"
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
                                                    :x-axis-rotation="-45"
                                                    line-color="#FF5733"
                                                    :enable-tooltips="true"
                                                    @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                    @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                                    class="mt-5"
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
                                                    :column-name="getChartColumnName(chart)"
                                                    :category-name="getChartCategoryName(chart)"
                                                    :stack-name="getChartStackName(chart)"
                                                    :max-legend-width="350"
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
                                                    :x-axis-rotation="-45"
                                                    :x-column-name="getChartXColumnName(chart)"
                                                    :y-column-name="getChartYColumnName(chart)"
                                                    :series-name="getChartSeriesName(chart)"
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
                                                    :category-name="getChartCategoryName(chart)"
                                                    :value-name="getChartValueName(chart)"
                                                    :category-column="getChartCategoryName(chart)"
                                                    class="mt-2"
                                                />
                                                <bubble-chart
                                                    v-if="chart.chart_type === 'bubble'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :width="parseInt(chart.dimensions.widthDraggable.replace('px', '')) - 40"
                                                    :height="parseInt(chart.dimensions.heightDraggable.replace('px', '')) - 80"
                                                    :x-column-name="getChartXColumnName(chart)"
                                                    :y-column-name="getChartYColumnName(chart)"
                                                    :size-column-name="getChartSizeColumnName(chart)"
                                                    :label-column-name="getChartLabelColumnName(chart)"
                                                    :enable-tooltips="true"
                                                    class="mt-2"
                                                />
                                                <funnel-chart
                                                    v-if="chart.chart_type === 'funnel_steps'"
                                                    :id="`chart-${chart.chart_id}`"
                                                    :chart-id="`${chart.chart_id}`"
                                                    :data="chart.data"
                                                    :width="parseInt(chart.dimensions.widthDraggable.replace('px', '')) - 40"
                                                    :height="parseInt(chart.dimensions.heightDraggable.replace('px', '')) - 80"
                                                    :x-axis-label="chart.x_axis_label"
                                                    :y-axis-label="chart.y_axis_label"
                                                    :column-name="getChartColumnName(chart)"
                                                    :category-column="getChartCategoryName(chart)"
                                                    :enable-tooltips="true"
                                                    @update:yAxisLabel="(label) => { chart.y_axis_label = label }"
                                                    @update:xAxisLabel="(label) => { chart.x_axis_label = label }"
                                                    class="mt-2"
                                                />
                                            </div>
                                        </div>
                                    </template>
                                </draggable>
                                <!-- Text block editor - only for text_block chart type -->
                                <div 
                                    v-if="chart.chart_type === 'text_block'" 
                                    :id="`draggable-${chart.chart_id}`" 
                                    class="bg-gray-200 border border-2 border-gray-400 border-t-0"
                                    :style="`width: ${chart.dimensions.widthDraggable}; height: ${chart.dimensions.heightDraggable};`"
                                >
                                    <text-editor 
                                        :id="`chart-${chart.chart_id}`" 
                                        :buttons="['bold', 'italic', 'heading', 'strike', 'underline']" 
                                        :minHeight="String(parseInt(chart.dimensions.heightDraggable.replace('px', '')) - 20)" 
                                        :content="chart.text_editor.content"
                                        inputFormat="wysiwyg" 
                                        @update:content="(content) => { updateContent(content, chart.chart_id); }" 
                                    />
                                </div>

                                <!-- Marketing widget renderers — Phase 2 KPI Widget Library -->
                                <!-- These widgets manage their own data and do not use the columns/draggable mechanism -->
                                <div
                                    v-if="isMarketingWidget(chart)"
                                    :id="`draggable-${chart.chart_id}`"
                                    class="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-hidden"
                                    :style="`width: ${chart.dimensions.widthDraggable}; height: ${chart.dimensions.heightDraggable};`"
                                >
                                    <kpi-scorecard-widget
                                        v-if="chart.chart_type === 'kpi_scorecard'"
                                        :chart-id="chart.chart_id"
                                        :project-id="projectId"
                                        :marketing-config="chart.marketing_config"
                                        :width="parseInt(chart.dimensions.widthDraggable.replace('px',''))"
                                        :height="parseInt(chart.dimensions.heightDraggable.replace('px',''))"
                                    />
                                    <budget-gauge-widget
                                        v-else-if="chart.chart_type === 'budget_gauge'"
                                        :chart-id="chart.chart_id"
                                        :project-id="projectId"
                                        :marketing-config="chart.marketing_config"
                                        :width="parseInt(chart.dimensions.widthDraggable.replace('px',''))"
                                        :height="parseInt(chart.dimensions.heightDraggable.replace('px',''))"
                                    />
                                    <channel-comparison-table-widget
                                        v-else-if="chart.chart_type === 'channel_comparison_table'"
                                        :chart-id="chart.chart_id"
                                        :project-id="projectId"
                                        :marketing-config="chart.marketing_config"
                                        :width="parseInt(chart.dimensions.widthDraggable.replace('px',''))"
                                        :height="parseInt(chart.dimensions.heightDraggable.replace('px',''))"
                                    />
                                    <journey-sankey-widget
                                        v-else-if="chart.chart_type === 'journey_sankey'"
                                        :chart-id="chart.chart_id"
                                        :project-id="projectId"
                                        :marketing-config="chart.marketing_config"
                                        :width="parseInt(chart.dimensions.widthDraggable.replace('px',''))"
                                        :height="parseInt(chart.dimensions.heightDraggable.replace('px',''))"
                                    />
                                    <roi-waterfall-widget
                                        v-else-if="chart.chart_type === 'roi_waterfall'"
                                        :chart-id="chart.chart_id"
                                        :project-id="projectId"
                                        :marketing-config="chart.marketing_config"
                                        :width="parseInt(chart.dimensions.widthDraggable.replace('px',''))"
                                        :height="parseInt(chart.dimensions.heightDraggable.replace('px',''))"
                                    />
                                    <campaign-timeline-widget
                                        v-else-if="chart.chart_type === 'campaign_timeline'"
                                        :chart-id="chart.chart_id"
                                        :project-id="projectId"
                                        :marketing-config="chart.marketing_config"
                                        :width="parseInt(chart.dimensions.widthDraggable.replace('px',''))"
                                        :height="parseInt(chart.dimensions.heightDraggable.replace('px',''))"
                                    />
                                    <anomaly-alert-card-widget
                                        v-else-if="chart.chart_type === 'anomaly_alert_card'"
                                        :chart-id="chart.chart_id"
                                        :project-id="projectId"
                                        :marketing-config="chart.marketing_config"
                                        :width="parseInt(chart.dimensions.widthDraggable.replace('px',''))"
                                        :height="parseInt(chart.dimensions.heightDraggable.replace('px',''))"
                                    />
                                </div>

                                <!-- AI Insights widget — source_type === 'ai_insights' -->
                                <!-- Wrapped in ClientOnly: aiWidgetDates is only initialised in onMounted -->
                                <!-- Data is fetched on demand via GET /dashboard/widgets/data -->
                                <ClientOnly v-if="chart.source_type === 'ai_insights'">
                                <div
                                    :id="`draggable-${chart.chart_id}`"
                                    class="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-auto p-4 flex flex-col gap-3"
                                    :style="`min-height: 240px; width: ${chart.dimensions.widthDraggable}; height: ${chart.dimensions.heightDraggable};`"
                                >
                                    <!-- Widget title & description -->
                                    <div class="flex flex-col gap-0.5">
                                        <p class="text-sm font-semibold text-gray-800">
                                            {{ chart.ai_chart_spec?.title ?? 'AI Widget' }}
                                        </p>
                                        <p v-if="chart.ai_chart_spec?.description" class="text-xs text-gray-500">
                                            {{ chart.ai_chart_spec.description }}
                                        </p>
                                        <span class="inline-block mt-1 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full w-fit">
                                            AI Insights
                                        </span>
                                    </div>

                                    <!-- Date range pickers -->
                                    <div class="flex items-center gap-2 text-xs text-gray-600">
                                        <label class="font-medium">From</label>
                                        <input
                                            type="date"
                                            :value="aiWidgetDates[chart.chart_id]?.startDate"
                                            @change="(e) => { if (aiWidgetDates[chart.chart_id]) { aiWidgetDates[chart.chart_id].startDate = e.target.value; if (chart.ai_chart_spec) chart.ai_chart_spec.startDate = e.target.value; } }"
                                            class="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                                        />
                                        <label class="font-medium">To</label>
                                        <input
                                            type="date"
                                            :value="aiWidgetDates[chart.chart_id]?.endDate"
                                            @change="(e) => { if (aiWidgetDates[chart.chart_id]) { aiWidgetDates[chart.chart_id].endDate = e.target.value; if (chart.ai_chart_spec) chart.ai_chart_spec.endDate = e.target.value; } }"
                                            class="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
                                        />
                                        <button
                                            class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50"
                                            :disabled="aiWidgetState[chart.chart_id]?.loading"
                                            @click="loadAIWidgetData(chart)"
                                        >
                                            <font-awesome-icon
                                                :icon="aiWidgetState[chart.chart_id]?.loading ? ['fas', 'spinner'] : ['fas', 'chart-bar']"
                                                :class="{ 'animate-spin': aiWidgetState[chart.chart_id]?.loading }"
                                            />
                                            {{ aiWidgetState[chart.chart_id]?.loading ? 'Loading…' : 'Load Data' }}
                                        </button>
                                    </div>

                                    <!-- Error state -->
                                    <div
                                        v-if="aiWidgetState[chart.chart_id]?.error"
                                        class="flex flex-col gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                                    >
                                        <p class="text-xs text-red-700">
                                            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-1" />
                                            {{ aiWidgetState[chart.chart_id].error }}
                                        </p>
                                        <button
                                            class="self-start text-xs font-medium text-red-600 underline hover:text-red-800 cursor-pointer"
                                            @click="openRegenerateModal(chart)"
                                        >
                                            Regenerate with AI
                                        </button>
                                    </div>

                                    <!-- Chart — type driven by ai_chart_spec.chart_type -->
                                    <template v-if="aiWidgetState[chart.chart_id]?.data?.rows?.length && getAIWidgetChartData(chart)">
                                        <!-- table (default) -->
                                        <table-chart
                                            v-if="!chart.ai_chart_spec?.chart_type || chart.ai_chart_spec.chart_type === 'table'"
                                            :id="`ai-chart-${chart.chart_id}`"
                                            :chart-id="`${chart.chart_id}`"
                                            :data="getAIWidgetChartData(chart)"
                                            :width="parseInt((chart.dimensions.widthDraggable ?? '600px').replace('px','')) - 40"
                                            :height="160"
                                            :enable-scroll-bars="true"
                                            :show-row-numbers="true"
                                            :sticky-header="true"
                                            :use-container-sizing="true"
                                            class="mt-1"
                                        />
                                        <!-- pie -->
                                        <pie-chart
                                            v-else-if="chart.ai_chart_spec.chart_type === 'pie'"
                                            :id="`ai-chart-${chart.chart_id}`"
                                            :chart-id="`${chart.chart_id}`"
                                            :data="getAIWidgetChartData(chart)"
                                            :width="parseInt((chart.dimensions.widthDraggable ?? '600px').replace('px','')) - 40"
                                            :height="parseInt((chart.dimensions.heightDraggable ?? '300px').replace('px','')) - 120"
                                            :column-name="chart.ai_chart_spec?.y_axis ?? ''"
                                            :enable-tooltips="true"
                                            class="mt-1"
                                        />
                                        <!-- donut -->
                                        <donut-chart
                                            v-else-if="chart.ai_chart_spec.chart_type === 'donut'"
                                            :id="`ai-chart-${chart.chart_id}`"
                                            :chart-id="`${chart.chart_id}`"
                                            :data="getAIWidgetChartData(chart)"
                                            :width="parseInt((chart.dimensions.widthDraggable ?? '600px').replace('px','')) - 40"
                                            :height="parseInt((chart.dimensions.heightDraggable ?? '300px').replace('px','')) - 120"
                                            :column-name="chart.ai_chart_spec?.y_axis ?? ''"
                                            :enable-tooltips="true"
                                            class="mt-1"
                                        />
                                        <!-- bar / area (area falls back to vertical bar) -->
                                        <vertical-bar-chart
                                            v-else-if="chart.ai_chart_spec.chart_type === 'bar' || chart.ai_chart_spec.chart_type === 'area'"
                                            :id="`ai-chart-${chart.chart_id}`"
                                            :chart-id="`${chart.chart_id}`"
                                            :data="getAIWidgetChartData(chart)"
                                            :x-axis-label="chart.ai_chart_spec?.x_axis ?? ''"
                                            :y-axis-label="chart.ai_chart_spec?.y_axis ?? ''"
                                            :column-name="chart.ai_chart_spec?.y_axis ?? ''"
                                            :category-name="chart.ai_chart_spec?.x_axis ?? ''"
                                            :x-axis-rotation="-45"
                                            :editable-axis-labels="false"
                                            :enable-tooltips="true"
                                            class="mt-1"
                                        />
                                        <!-- line -->
                                        <multi-line-chart
                                            v-else-if="chart.ai_chart_spec.chart_type === 'line'"
                                            :id="`ai-chart-${chart.chart_id}`"
                                            :chart-id="`${chart.chart_id}`"
                                            :data="getAIWidgetChartData(chart)"
                                            :width="parseInt((chart.dimensions.widthDraggable ?? '600px').replace('px','')) - 40"
                                            :height="parseInt((chart.dimensions.heightDraggable ?? '300px').replace('px','')) - 120"
                                            :x-axis-label="chart.ai_chart_spec?.x_axis ?? ''"
                                            :y-axis-label="chart.ai_chart_spec?.y_axis ?? ''"
                                            :show-data-points="true"
                                            :enable-tooltips="true"
                                            :show-grid="true"
                                            :editable-axis-labels="false"
                                            :x-axis-rotation="-45"
                                            legend-position="top"
                                            class="mt-1"
                                        />
                                        <!-- kpi -->
                                        <div
                                            v-else-if="chart.ai_chart_spec.chart_type === 'kpi'"
                                            :id="`ai-chart-${chart.chart_id}`"
                                            class="flex flex-col items-center justify-center py-6 gap-1"
                                        >
                                            <p class="text-4xl font-bold text-gray-800">{{ getAIWidgetChartData(chart)?.value }}</p>
                                            <p class="text-xs text-gray-500">{{ chart.ai_chart_spec?.description }}</p>
                                        </div>
                                    </template>

                                    <!-- Empty state (after load, no rows) -->
                                    <p
                                        v-if="aiWidgetState[chart.chart_id]?.loaded && !aiWidgetState[chart.chart_id]?.data?.rows?.length && !aiWidgetState[chart.chart_id]?.error"
                                        class="text-xs text-gray-400 italic"
                                    >
                                        No data returned for the selected date range.
                                    </p>
                                </div>
                                </ClientOnly>
                            </div>
                            <div class="flex flex-row justify-end bottom-corners">
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
            <div v-if="state.sidebar_status" class="flex flex-col w-1/6 mt-17 mb-10 mr-2 select-none overflow-y-auto">
                <!-- Text Block -->
                <button
                    @click="addChartToDashboard('text_block')"
                    class="flex flex-col items-center p-3 mb-3 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                >
                    <img src="/assets/images/chart-placeholders/text_block.png" alt="Text Block" class="w-16 h-16 mb-2" />
                    <span class="text-sm font-medium text-gray-700">Text Block</span>
                </button>

                <!-- Tables & Data Section -->
                <div class="mb-2 text-xs font-bold text-gray-500 uppercase tracking-wide">Tables & Data</div>
                <button
                    @click="addChartToDashboard('table')"
                    class="flex flex-col items-center p-3 mb-3 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                >
                    <img src="/assets/images/chart-placeholders/table.png" alt="Table" class="w-16 h-16 mb-2" />
                    <span class="text-sm font-medium text-gray-700">Table</span>
                </button>

                <!-- Basic Charts Section -->
                <div class="mb-2 text-xs font-bold text-gray-500 uppercase tracking-wide">Basic Charts</div>
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <button
                        @click="addChartToDashboard('pie')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/pie.png" alt="Pie Chart" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Pie</span>
                    </button>
                    <button
                        @click="addChartToDashboard('donut')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/donut.png" alt="Donut Chart" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Donut</span>
                    </button>
                    <button
                        @click="addChartToDashboard('vertical_bar')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/vertical_bar.png" alt="Bar Chart" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Bar</span>
                    </button>
                    <button
                        @click="addChartToDashboard('horizontal_bar')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/horizontal_bar.png" alt="Horizontal Bar" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">H-Bar</span>
                    </button>
                </div>

                <!-- Advanced Charts Section -->
                <div class="mb-2 text-xs font-bold text-gray-500 uppercase tracking-wide">Advanced Charts</div>
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <button
                        @click="addChartToDashboard('vertical_bar_line')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/vertical_bar_line.png" alt="Combo Chart" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Combo</span>
                    </button>
                    <button
                        @click="addChartToDashboard('stacked_bar')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/stacked_bar.png" alt="Stacked Bar" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Stacked</span>
                    </button>
                    <button
                        @click="addChartToDashboard('multiline')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/multiline.png" alt="Line Chart" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Line</span>
                    </button>
                    <button
                        @click="addChartToDashboard('treemap')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/treemap.png" alt="Treemap" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Treemap</span>
                    </button>
                    <button
                        @click="addChartToDashboard('bubble')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/bubble.png" alt="Bubble Chart" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Bubble</span>
                    </button>
                    <button
                        @click="addChartToDashboard('funnel_steps')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                    >
                        <img src="/assets/images/chart-placeholders/funnel_steps.jpg" alt="Funnel Chart" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700">Funnel</span>
                    </button>
                </div>

                <!-- Marketing Widgets Section -->
                <div class="mb-2 text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <font-awesome-icon :icon="['fas', 'bullseye']" class="text-primary-blue-100" />
                    Marketing Widgets
                </div>
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <button
                        @click="addChartToDashboard('kpi_scorecard')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                        title="KPI Scorecard — single metric with trend delta"
                    >
                        <img src="/assets/images/chart-placeholders/table.png" alt="KPI Scorecard" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700 text-center">KPI Scorecard</span>
                    </button>
                    <button
                        @click="addChartToDashboard('budget_gauge')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                        title="Budget Gauge — circular spend vs budget indicator"
                    >
                        <img src="/assets/images/chart-placeholders/donut.png" alt="Budget Gauge" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700 text-center">Budget Gauge</span>
                    </button>
                    <button
                        @click="addChartToDashboard('channel_comparison_table')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                        title="Channel Comparison — multi-channel normalised performance table"
                    >
                        <img src="/assets/images/chart-placeholders/table.png" alt="Channel Comparison" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700 text-center">Channels</span>
                    </button>
                    <button
                        @click="addChartToDashboard('journey_sankey')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                        title="Journey Sankey — multi-touch attribution path flows"
                    >
                        <img src="/assets/images/chart-placeholders/multiline.png" alt="Journey Sankey" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700 text-center">Journey</span>
                    </button>
                    <button
                        @click="addChartToDashboard('roi_waterfall')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                        title="ROI Waterfall — spend vs revenue by channel"
                    >
                        <img src="/assets/images/chart-placeholders/horizontal_bar.png" alt="ROI Waterfall" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700 text-center">ROI Waterfall</span>
                    </button>
                    <button
                        @click="addChartToDashboard('campaign_timeline')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                        title="Campaign Timeline — Gantt-style campaign view with budget pacing"
                    >
                        <img src="/assets/images/chart-placeholders/stacked_bar.png" alt="Campaign Timeline" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700 text-center">Timeline</span>
                    </button>
                    <button
                        @click="addChartToDashboard('anomaly_alert_card')"
                        class="flex flex-col items-center p-2 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-400 cursor-pointer"
                        title="Anomaly Alert — metric deviation alerts vs historical average"
                    >
                        <img src="/assets/images/chart-placeholders/multiline.png" alt="Anomaly Alert" class="w-12 h-12 mb-1" />
                        <span class="text-xs font-medium text-gray-700 text-center">Anomaly Alert</span>
                    </button>
                </div>
            </div>
        </div>
        <img src="/assets/images/resize-corner.svg" id="corner-image" class="bottom-right-corner-resize w-[15px] select-none hidden" alt="Resize Visualization" />
        </div>
        
        <!-- Loading state when project or dashboard not loaded -->
        <div v-else class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
                <p class="text-gray-600">Loading dashboard...</p>
            </div>
        </div>
        
        <overlay-dialog v-if="state.show_table_dialog" :enable-scrolling="false" @close="closeTableDialog">
            <template #overlay>
                <div class="flex flex-col w-full max-w-7xl h-full max-h-[85vh] p-5 overflow-hidden">
                    <h2 class="mb-4 text-xl font-bold text-gray-800">Data Model Table Data</h2>
                    <div class="overflow-x-auto overflow-y-auto max-h-[65vh] border border-primary-blue-100 border-solid rounded-lg shadow-inner bg-white">
                        <div class="inline-block min-w-full">
                            <table class="w-auto min-w-full border-collapse bg-white text-sm divide-y divide-gray-200">
                                <thead class="bg-blue-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th v-for="column in state.response_from_data_models_columns" 
                                            class="border border-primary-blue-100 p-3 text-center font-bold whitespace-nowrap min-w-[150px] max-w-[250px] bg-blue-100">
                                            {{ column }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    <tr v-for="row in state.response_from_data_models_rows" 
                                        class="hover:bg-gray-50 even:bg-gray-25 transition-colors duration-150">
                                        <td v-for="column in state.response_from_data_models_columns" 
                                            class="border border-primary-blue-100 p-3 text-center whitespace-nowrap min-w-[150px] max-w-[250px] overflow-hidden text-ellipsis"
                                            :title="row[column]">
                                            {{ row[column] }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </template>
        </overlay-dialog>

        <!-- Oversized Data Model Blocking Modal — Point B -->
        <div v-if="state.oversized_model_modal.show" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 flex flex-col overflow-hidden">
                <!-- Header -->
                <div class="flex flex-row items-center px-6 py-5 bg-red-600">
                    <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-white text-2xl mr-3" />
                    <div class="flex flex-col flex-1 min-w-0">
                        <h2 class="text-white text-lg font-bold truncate">Data Model Too Large</h2>
                        <p class="text-red-200 text-sm truncate">{{ state.oversized_model_modal.modelName }}</p>
                    </div>
                    <button @click="closeOversizedModal" class="text-white hover:text-red-200 transition-colors ml-4">
                        <font-awesome-icon :icon="['fas', 'xmark']" class="text-xl" />
                    </button>
                </div>

                <!-- Body -->
                <div class="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-96">
                    <!-- Row / threshold summary -->
                    <div class="flex flex-row items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div class="flex flex-col items-center flex-1">
                            <span class="text-2xl font-bold text-red-700">{{ formatLargeNumber(state.oversized_model_modal.rowCount) }}</span>
                            <span class="text-xs text-red-600 mt-1">Rows in model</span>
                        </div>
                        <div class="text-gray-400 font-bold text-lg">vs</div>
                        <div class="flex flex-col items-center flex-1">
                            <span class="text-2xl font-bold text-gray-700">{{ formatLargeNumber(state.oversized_model_modal.threshold) }}</span>
                            <span class="text-xs text-gray-500 mt-1">Chart limit</span>
                        </div>
                        <div v-if="state.oversized_model_modal.sourceRowCount" class="flex flex-col items-center flex-1">
                            <span class="text-2xl font-bold text-gray-700">{{ formatLargeNumber(state.oversized_model_modal.sourceRowCount) }}</span>
                            <span class="text-xs text-gray-500 mt-1">Source rows</span>
                        </div>
                    </div>

                    <!-- Health issues list -->
                    <div v-if="state.oversized_model_modal.healthIssues?.length" class="flex flex-col gap-2">
                        <h3 class="text-sm font-semibold text-gray-700">Issues detected</h3>
                        <div
                            v-for="issue in state.oversized_model_modal.healthIssues"
                            :key="issue.code"
                            class="flex flex-row items-start px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg gap-3"
                        >
                            <font-awesome-icon :icon="['fas', 'circle-info']" class="text-amber-500 text-sm mt-0.5 flex-shrink-0" />
                            <div class="flex flex-col flex-1 min-w-0">
                                <span class="text-sm font-medium text-amber-900">{{ issue.title }}</span>
                                <span v-if="issue.description" class="text-xs text-amber-700 mt-0.5">{{ issue.description }}</span>
                                <span v-if="issue.recommendation" class="text-xs text-gray-500 mt-1 italic">{{ issue.recommendation }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- AI Analysis + Suggestions -->
                    <div v-if="state.oversized_model_modal.ai_loading" class="flex flex-row items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <font-awesome-icon :icon="['fas', 'spinner']" class="text-purple-500 text-lg animate-spin flex-shrink-0" />
                        <span class="text-sm text-purple-700">AI is analysing your model and generating fix suggestions…</span>
                    </div>
                    <div v-if="state.oversized_model_modal.ai_analysis && !state.oversized_model_modal.ai_loading" class="flex flex-col gap-3">
                        <div class="flex flex-row items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <font-awesome-icon :icon="['fas', 'robot']" class="text-purple-500 flex-shrink-0 mt-0.5" />
                            <p class="text-sm text-purple-800">{{ state.oversized_model_modal.ai_analysis }}</p>
                        </div>
                        <div v-for="(suggestion, idx) in state.oversized_model_modal.ai_suggestions" :key="idx" class="flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                            <div class="flex flex-row items-start justify-between gap-2">
                                <div class="flex flex-row items-center gap-2">
                                    <span class="text-xs font-bold text-white bg-purple-600 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{{ idx + 1 }}</span>
                                    <span class="text-sm font-medium text-gray-800">{{ suggestion.description }}</span>
                                </div>
                                <button
                                    class="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
                                    @click="applyAISuggestion(suggestion)"
                                >
                                    <font-awesome-icon :icon="['fas', 'check']" class="mr-1 text-xs" />
                                    Apply
                                </button>
                            </div>
                            <pre class="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono">{{ suggestion.revisedSQL }}</pre>
                        </div>
                    </div>
                </div>

                <!-- Footer actions -->
                <div class="flex flex-row items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200 gap-3 flex-wrap">
                    <div class="flex flex-row gap-3 flex-wrap">
                        <NuxtLink
                            v-if="state.oversized_model_modal.modelId"
                            :to="`/projects/${route.params.projectid}/data-models/${state.oversized_model_modal.modelId}/edit`"
                            class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                            @click="closeOversizedModal"
                        >
                            <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="mr-2 text-xs" />
                            Fix this model
                        </NuxtLink>
                        <button
                            class="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
                            :disabled="state.oversized_model_modal.ai_loading"
                            @click="askAIToSuggestFix"
                        >
                            <font-awesome-icon v-if="state.oversized_model_modal.ai_loading" :icon="['fas', 'spinner']" class="mr-2 text-xs animate-spin" />
                            <font-awesome-icon v-else :icon="['fas', 'robot']" class="mr-2 text-xs" />
                            Ask AI to suggest a fix
                        </button>
                    </div>
                    <div class="flex flex-row gap-3 flex-wrap">
                        <!-- Admin-only bypass -->
                        <button
                            v-if="permissions.isAdmin.value"
                            class="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                            @click="bypassOversizedModelForSession(state.selected_chart.chart_id)"
                        >
                            <font-awesome-icon :icon="['fas', 'shield-halved']" class="mr-2 text-xs" />
                            Bypass for this session
                        </button>
                        <button
                            class="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                            @click="closeOversizedModal"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
