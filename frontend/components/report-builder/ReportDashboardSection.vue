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
  text_block: 'Text Block',
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
      <div class="mb-3">
        <h3 class="text-sm font-bold text-gray-800">{{ (dashboard as any).name || (dashboard as any).title || `Dashboard #${props.dashboardId}` }}</h3>
      </div>

      <div v-if="((dashboard as any).data?.charts || []).length === 0" class="text-sm text-gray-400 italic">
        This dashboard has no charts.
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="chart in ((dashboard as any).data?.charts || [])"
          :key="chart.chart_id"
          class="border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
        >
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {{ chartTypeLabels[chart.chart_type] || chart.chart_type }}
          </div>

          <pie-chart
            v-if="chart.chart_type === 'pie' && chart.data?.length"
            :data="chart.data"
            :width="300"
            :height="240"
          />

          <donut-chart
            v-else-if="chart.chart_type === 'donut' && chart.data?.length"
            :data="chart.data"
            :width="300"
            :height="240"
          />

          <vertical-bar-chart
            v-else-if="chart.chart_type === 'vertical_bar' && chart.data?.length"
            :data="chart.data"
            :x-axis-label="chart.x_axis_label"
            :y-axis-label="chart.y_axis_label"
            :width="300"
            :height="240"
          />

          <horizontal-bar-chart
            v-else-if="chart.chart_type === 'horizontal_bar' && chart.data?.length"
            :data="chart.data"
            :x-axis-label="chart.x_axis_label"
            :y-axis-label="chart.y_axis_label"
            :width="300"
            :height="240"
          />

          <multi-line-chart
            v-else-if="chart.chart_type === 'multiline' && chart.data?.[0]"
            :data="chart.data[0]"
            :width="300"
            :height="240"
            :x-axis-label="chart.x_axis_label"
            :y-axis-label="chart.y_axis_label"
            :show-data-points="false"
            :show-grid="true"
          />

          <stacked-bar-chart
            v-else-if="chart.chart_type === 'stacked_bar' && chart.data?.length"
            :data="chart.data"
            :stack-keys="chart.stack_keys"
            :x-axis-label="chart.x_axis_label"
            :y-axis-label="chart.y_axis_label"
            :width="300"
            :height="240"
          />

          <vertical-bar-chart
            v-else-if="chart.chart_type === 'vertical_bar_line' && chart.data?.length"
            :data="chart.data"
            :x-axis-label="chart.x_axis_label"
            :y-axis-label="chart.y_axis_label"
            :show-line-chart="true"
            :line-data="chart.line_data"
            :width="300"
            :height="240"
          />

          <treemap-chart
            v-else-if="chart.chart_type === 'treemap' && chart.data?.[0]"
            :data="chart.data[0]"
            :width="300"
            :height="240"
          />

          <bubble-chart
            v-else-if="chart.chart_type === 'bubble' && chart.data?.length"
            :data="chart.data"
            :width="300"
            :height="240"
          />

          <div v-else-if="chart.chart_type === 'text_block'" class="text-sm text-gray-600">
            {{ chart.text_editor?.content || '(empty)' }}
          </div>

          <table-chart
            v-else-if="chart.chart_type === 'table' && chart.data?.[0]"
            :data="chart.data[0]"
            :width="280"
            :height="200"
            :show-row-numbers="true"
            :sticky-header="true"
          />

          <div v-else class="flex items-center justify-center h-32 text-xs text-gray-400">
            No data available
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
