<script setup lang="ts">
interface Props {
  dashboardId: number | string | null
}
const props = defineProps<Props>()

const dashboard = ref<any>(null)
const loading = ref(false)
const fetchError = ref<string | null>(null)

async function fetchDashboard(id: number) {
  if (!id) {
    dashboard.value = null
    return
  }
  loading.value = true
  fetchError.value = null
  try {
    const token = getAuthToken()
    const config = useRuntimeConfig()
    const { getOrgHeaders } = useOrganizationContext()
    const data = await $fetch(`${config.public.apiBase}/dashboard/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Authorization-Type': 'auth',
        ...getOrgHeaders(),
      },
    })
    dashboard.value = data || null
  } catch (err: any) {
    fetchError.value = err?.data?.error || err?.message || 'Failed to load dashboard'
    dashboard.value = null
  } finally {
    loading.value = false
  }
}

const validId = computed(() => {
  const id = props.dashboardId
  if (id === null || id === undefined || id === 0 || id === '0') return null
  return Number(id)
})

watch(validId, (id) => {
  fetchDashboard(id ?? 0)
}, { immediate: true })

const chartTypeLabels: Record<string, string> = {
  table: 'Table',
  pie: 'Pie Chart',
  donut: 'Donut Chart',
  vertical_bar: 'Bar Chart',
  horizontal_bar: 'Horizontal Bar',
  multiline: 'Line Chart',
  stacked_bar: 'Stacked Bar',
  vertical_bar_line: 'Combo Chart',
  treemap: 'Treemap',
  bubble: 'Bubble Chart',
  funnel_steps: 'Funnel Chart',
  text_block: 'Text Block',
}

function isChartEmpty(chart: any) {
  return !chart.columns || chart.columns.length === 0
}

function getChartColumnName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 2) return 'Value'
  return chart.columns[1].column_name || 'Value'
}

function getChartCategoryName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 1) return 'Category'
  return chart.columns[0].column_name || 'Category'
}

function getChartStackName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 3) return 'Stack'
  return chart.columns[2].column_name || 'Stack'
}

function getChartXColumnName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 1) return 'X'
  return chart.columns[0].column_name || 'X'
}

function getChartYColumnName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 2) return 'Y'
  return chart.columns[1].column_name || 'Y'
}

function getChartSeriesName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 2) return 'Series'
  return chart.columns[1].column_name || 'Series'
}

function getChartValueName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 2) return 'Value'
  return chart.columns[1].column_name || 'Value'
}

function getChartSizeColumnName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 3) return 'Size'
  return chart.columns[2].column_name || 'Size'
}

function getChartLabelColumnName(chart: any) {
  if (!chart || !chart.columns || chart.columns.length < 1) return 'Label'
  return chart.columns[0].column_name || 'Label'
}
</script>

<template>
  <div class="report-dashboard-section">
    <div v-if="!validId" class="text-sm text-gray-400 italic">
      No dashboard selected. Open the config panel and choose a dashboard.
    </div>

    <div v-else-if="loading" class="flex items-center justify-center py-8">
      <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-xl text-gray-400" />
    </div>

    <div v-else-if="fetchError" class="text-sm text-red-500">
      Failed to load dashboard.
    </div>

    <div v-else-if="!dashboard" class="text-sm text-gray-500 italic">
      Dashboard not found.
    </div>

    <template v-else>
      <div class="mb-4">
        <h3 class="text-base font-bold text-gray-900">{{ dashboard.name || dashboard.title || `Dashboard #${props.dashboardId}` }}</h3>
      </div>

      <div v-if="!dashboard.data?.charts?.length" class="text-sm text-gray-400 italic">
        This dashboard has no charts.
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="chart in (dashboard.data?.charts || [])"
          :key="chart.chart_id"
          class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
        >
          <!-- Chart header -->
          <div class="flex items-center px-4 py-2.5 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
            <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {{ chartTypeLabels[chart.chart_type] || chart.chart_type }}
            </span>
            <span v-if="chart.source_type === 'ai_insights'" class="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
              AI Insights
            </span>
          </div>

          <!-- ai_insights widget -->
          <div
            v-if="chart.source_type === 'ai_insights'"
            class="p-4 bg-white"
            :style="`min-height: 240px;`"
          >
            <div class="flex flex-col gap-0.5 mb-3">
              <p class="text-sm font-semibold text-gray-800">
                {{ chart.ai_chart_spec?.title ?? 'AI Widget' }}
              </p>
              <p v-if="chart.ai_chart_spec?.description" class="text-xs text-gray-500">
                {{ chart.ai_chart_spec.description }}
              </p>
            </div>
            <div class="flex items-center justify-center h-24 text-xs text-gray-400">
              AI widget data loaded on demand
            </div>
          </div>

          <!-- text_block -->
          <div
            v-else-if="chart.chart_type === 'text_block'"
            class="p-4"
          >
            <div v-html="chart.text_editor?.content || ''" class="text-sm text-gray-700"></div>
            <div v-if="!chart.text_editor?.content" class="text-sm text-gray-400 italic">(empty)</div>
          </div>

          <!-- Empty chart placeholder -->
          <div
            v-else-if="isChartEmpty(chart)"
            class="min-h-[200px] flex flex-col items-center justify-center bg-gray-50 p-8"
          >
            <p class="text-gray-500 text-sm font-semibold">
              {{ chartTypeLabels[chart.chart_type] || chart.chart_type }}
            </p>
            <p class="text-gray-400 text-xs mt-1">No columns configured</p>
          </div>

          <!-- Charts with data -->
          <div v-else-if="chart.data?.length" class="p-4 bg-white overflow-auto">
            <table-chart
              v-if="chart.chart_type === 'table'"
              :data="chart.data[0]"
              :enable-scroll-bars="true"
              :show-row-numbers="true"
              :sticky-header="true"
              :max-column-width="'200px'"
              :min-column-width="'120px'"
              :use-container-sizing="true"
            />
            <pie-chart
              v-else-if="chart.chart_type === 'pie'"
              :data="chart.data"
              :column-name="getChartColumnName(chart)"
              :category-column="getChartCategoryName(chart)"
              :enable-tooltips="true"
            />
            <donut-chart
              v-else-if="chart.chart_type === 'donut'"
              :data="chart.data"
              :column-name="getChartColumnName(chart)"
              :category-column="getChartCategoryName(chart)"
              :enable-tooltips="true"
            />
            <vertical-bar-chart
              v-else-if="chart.chart_type === 'vertical_bar'"
              :data="chart.data"
              :x-axis-label="chart.x_axis_label"
              :y-axis-label="chart.y_axis_label"
              :x-axis-rotation="-45"
              :column-name="getChartColumnName(chart)"
              :category-name="getChartCategoryName(chart)"
              :category-column="getChartCategoryName(chart)"
              :enable-tooltips="true"
            />
            <horizontal-bar-chart
              v-else-if="chart.chart_type === 'horizontal_bar'"
              :data="chart.data"
              :x-axis-label="chart.x_axis_label"
              :y-axis-label="chart.y_axis_label"
              :column-name="getChartColumnName(chart)"
              :category-name="getChartCategoryName(chart)"
              :category-column="getChartCategoryName(chart)"
              :enable-tooltips="true"
            />
            <vertical-bar-chart
              v-else-if="chart.chart_type === 'vertical_bar_line'"
              :data="chart.data"
              :x-axis-label="chart.x_axis_label"
              :y-axis-label="chart.y_axis_label"
              :show-line-chart="true"
              :line-data="chart.line_data"
              :x-axis-rotation="-45"
              line-color="#FF5733"
              :enable-tooltips="true"
            />
            <stacked-bar-chart
              v-else-if="chart.chart_type === 'stacked_bar'"
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
            />
            <multi-line-chart
              v-else-if="chart.chart_type === 'multiline'"
              :data="chart.data[0]"
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
            />
            <treemap-chart
              v-else-if="chart.chart_type === 'treemap'"
              :data="chart.data[0]"
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
            />
            <bubble-chart
              v-else-if="chart.chart_type === 'bubble'"
              :data="chart.data"
              :x-column-name="getChartXColumnName(chart)"
              :y-column-name="getChartYColumnName(chart)"
              :size-column-name="getChartSizeColumnName(chart)"
              :label-column-name="getChartLabelColumnName(chart)"
              :enable-tooltips="true"
            />
            <funnel-chart
              v-else-if="chart.chart_type === 'funnel_steps'"
              :data="chart.data"
              :x-axis-label="chart.x_axis_label"
              :y-axis-label="chart.y_axis_label"
              :column-name="getChartColumnName(chart)"
              :category-column="getChartCategoryName(chart)"
              :enable-tooltips="true"
            />
            <div v-else class="flex items-center justify-center h-24 text-xs text-gray-400">
              Chart type not supported
            </div>
          </div>

          <div v-else class="flex items-center justify-center h-24 text-xs text-gray-400 bg-gray-50">
            No data available
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
