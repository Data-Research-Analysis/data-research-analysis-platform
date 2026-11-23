<script setup lang="ts">
/**
 * GA4OverviewReport — prebuilt GA4 acquisition overview.
 *
 * Reads the aggregate Data API tables, so it works for every GA4 connection
 * (no BigQuery layer required). Organised as acquisition sections: traffic &
 * channels, campaigns & pages, conversions & revenue, then audience/technology.
 */
import { useGA4Overview } from '@/composables/useGA4Overview'

const props = withDefaults(defineProps<{ projectId: number; preset?: string; maxLookbackDays?: number; section?: string }>(), {
    preset: 'last_90_days',
    maxLookbackDays: 90,
    section: 'traffic',
})
const emit = defineEmits<{
    (e: 'update:preset', preset: string): void
    (e: 'update:section', section: string): void
}>()

const bq = useGA4Overview()

const ALL_PRESETS = [
    { key: 'last_365_days', label: 'Last 365 days', days: 365 },
    { key: 'last_90_days', label: 'Last 90 days', days: 90 },
    { key: 'last_month', label: 'Last month', days: 31 },
    { key: 'this_month', label: 'This month', days: 31 },
    { key: 'last_week', label: 'Last week (Mon-Sun)', days: 7 },
    { key: 'last_week_sun_sat', label: 'Last week (Sun-Sat)', days: 7 },
    { key: 'last_7_days', label: 'Last 7 days', days: 7 },
    { key: 'this_week', label: 'This week', days: 7 },
    { key: 'yesterday', label: 'Yesterday', days: 1 },
    { key: 'today', label: 'Today', days: 1 },
]

// Only show presets within the ingestion window selected at connection time.
const presets = computed(() =>
    ALL_PRESETS.filter(p => p.days <= props.maxLookbackDays),
)

const overview = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Connected GA4 properties for this project. Each property has its own data,
// so the report is always scoped to exactly one selected source.
const dataSources = ref<Array<{ id: number; name: string }>>([])
const selectedDataSourceId = ref<number | null>(null)

const TREND_COLORS = ['#4F46E5', '#0EA5E9', '#F59E0B']

const trendData = computed(() => {
    const t = overview.value?.trend
    if (!t) return null
    return {
        categories: t.categories,
        series: t.series.map((s: any, i: number) => ({
            ...s,
            color: TREND_COLORS[i % TREND_COLORS.length],
        })),
    }
})

const pages = computed(() => overview.value?.pages || [])
const countries = computed(() => overview.value?.countries || [])
const events = computed(() => overview.value?.events || [])
const devices = computed(() => overview.value?.devices || [])

// Bucket 1 datasets
const newUsersByChannel = computed(() => overview.value?.newUsersByChannel || [])
const engagementByFirstSource = computed(() => overview.value?.engagementByFirstSource || [])
const eventConversions = computed(() => (overview.value?.eventConversions || []).filter((r: any) => (r.value || 0) > 0))
const activeUsersByCity = computed(() => overview.value?.activeUsersByCity || [])
const activeUsersByDevice = computed(() => overview.value?.activeUsersByDevice || [])
const activeUsersByDeviceBars = computed(() => activeUsersByDevice.value.map((c: any) => ({ label: c.category, value: c.value })))
const activeUsersByOs = computed(() => overview.value?.activeUsersByOs || [])
const activeUsersByBrowser = computed(() => overview.value?.activeUsersByBrowser || [])
const pageTitleViews = computed(() => overview.value?.pageTitleViews || [])

// Bucket 2 datasets
const ageUsers = computed(() => overview.value?.ageUsers || [])
const genderUsers = computed(() => overview.value?.genderUsers || [])
const languageUsers = computed(() => overview.value?.languageUsers || [])
const newVsReturning = computed(() => overview.value?.newVsReturning || [])
const platformUsers = computed(() => overview.value?.platformUsers || [])
const deviceModelUsers = computed(() => overview.value?.deviceModelUsers || [])
const screenResolutionUsers = computed(() => overview.value?.screenResolutionUsers || [])
const firstUserSourceMedium = computed(() => overview.value?.firstUserSourceMedium || [])
const revenueKpis = computed(() => overview.value?.revenueKpis || null)
const avgEngagementTimePerActiveUser = computed(() => overview.value?.avgEngagementTimePerActiveUser || 0)

// Acquisition datasets
const channelPerformance = computed(() => overview.value?.channelPerformance || [])
const channelTrend = computed(() => overview.value?.channelTrend || null)
const revenueByChannelTrend = computed(() => overview.value?.revenueByChannelTrend || null)
const paidOrganicSplit = computed(() => overview.value?.paidOrganicSplit || [])
const campaignPerformance = computed(() => overview.value?.campaignPerformance || [])
const landingPagePerformance = computed(() => overview.value?.landingPagePerformance || [])
const sourceMediumPerformance = computed(() => overview.value?.sourceMediumPerformance || [])
const newUsersByChannelTrend = computed(() => overview.value?.newUsersByChannelTrend || null)
const eventValueByEvent = computed(() => overview.value?.eventValueByEvent || [])
const keyEventsByCountry = computed(() => overview.value?.keyEventsByCountry || [])
const keyEventsByDevice = computed(() => overview.value?.keyEventsByDevice || [])
const organicSearchPerformance = computed(() => overview.value?.organicSearchPerformance || [])
const organicSearchTrend = computed(() => {
    const t = overview.value?.organicSearchTrend
    if (!t || !t.categories?.length) return null
    return {
        categories: t.categories,
        series: t.series.map((s: any, i: number) => ({
            ...s,
            color: TREND_COLORS[i % TREND_COLORS.length],
        })),
    }
})

// Revenue/ecommerce datasets already computed by the backend but previously
// never rendered.
const revenueByCategory = computed(() => overview.value?.revenueByCategory || [])
const itemsByName = computed(() => overview.value?.itemsByName || [])
const quantityByProductId = computed(() => overview.value?.quantityByProductId || [])

// Horizontal bar chart expects { label, value } (pages/devices only).
const pagesBars = computed(() => pages.value.map((c: any) => ({ label: c.category, value: c.value })))
const devicesBars = computed(() => devices.value.map((c: any) => ({ label: c.category, value: c.value })))

const kpis = computed(() => overview.value?.kpis || null)

// Acquisition sub-tabs. These split the page into focused views so a
// performance marketer is not scrolling through every table at once.
const ACQUISITION_SECTIONS = [
    { id: 'traffic', label: 'Traffic & channels', icon: 'chart-line' },
    { id: 'campaigns', label: 'Campaigns & pages', icon: 'bullhorn' },
    { id: 'conversions', label: 'Conversions & revenue', icon: 'cart-shopping' },
    { id: 'audience', label: 'Audience & technology', icon: 'users' },
] as const
type AcquisitionSectionId = typeof ACQUISITION_SECTIONS[number]['id']
const localSection = ref<AcquisitionSectionId>((props.section as AcquisitionSectionId) || 'traffic')

watch(() => props.section, (value) => {
    if (value) localSection.value = value as AcquisitionSectionId
})

function selectSection(id: AcquisitionSectionId) {
    if (localSection.value === id) return
    localSection.value = id
    emit('update:section', id)
}

/**
 * Convert a { categories, series } trend into the stacked-bar chart shape:
 * [{ label, values: [{ key, value }] }] + stackKeys. When `percent` is set the
 * values become each series' share of that day's total.
 */
function toStacked(trend: any, percent = false): { data: any[]; stackKeys: string[] } | null {
    if (!trend?.categories?.length || !trend?.series?.length) return null
    const stackKeys = trend.series.map((s: any) => s.name)
    const data = trend.categories.map((label: string, i: number) => {
        const raw = trend.series.map((s: any) => Number(s.data[i]) || 0)
        const total = raw.reduce((a: number, b: number) => a + b, 0)
        return {
            label,
            values: trend.series.map((s: any, j: number) => ({
                key: s.name,
                value: percent && total > 0 ? Math.round((raw[j] / total) * 1000) / 10 : raw[j],
            })),
        }
    })
    return { data, stackKeys }
}

const channelTrendChart = computed(() => toStacked(channelTrend.value))
const channelMixChart = computed(() => toStacked(channelTrend.value, true))
const revenueChannelChart = computed(() => toStacked(revenueByChannelTrend.value))
const newUsersChannelChart = computed(() => toStacked(newUsersByChannelTrend.value))

const paidOrganicChart = computed(() =>
    paidOrganicSplit.value.map((r: any) => ({ label: r.category, value: r.value })),
)

// Bar chart: session key event rate (%) per channel group.
const channelEfficiencyBars = computed(() =>
    channelPerformance.value.map((r: any) => ({
        label: r.channel,
        value: Number(r.sessionKeyEventRate) || 0,
    })),
)

// Totals for the channel performance table, kept internally consistent by
// summing the rows rather than using the deduplicated headline KPI.
const channelTotals = computed(() => {
    const rows = channelPerformance.value
    const sum = (fn: (r: any) => number) => rows.reduce((s: number, r: any) => s + (Number(fn(r)) || 0), 0)
    const sessions = sum(r => r.sessions)
    const engaged = sum(r => r.engagedSessions)
    const keyEvents = sum(r => r.keyEvents)
    const eventCount = sum(r => r.eventCount)
    const revenue = sum(r => r.totalRevenue)
    const weightedTime = sum(r => (Number(r.avgEngagementTimePerSession) || 0) * (Number(r.sessions) || 0))
    return {
        sessions,
        engaged,
        keyEvents,
        eventCount,
        revenue,
        engagementRate: sessions > 0 ? (engaged / sessions) * 100 : 0,
        avgTime: sessions > 0 ? weightedTime / sessions : 0,
        keyEventRate: sessions > 0 ? (keyEvents / sessions) * 100 : 0,
        eventsPerSession: sessions > 0 ? eventCount / sessions : 0,
        revenuePerSession: sessions > 0 ? revenue / sessions : 0,
    }
})

function fmtNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return Number(n || 0).toLocaleString()
}

function fmtDuration(seconds: number): string {
    const s = Math.round(Number(seconds) || 0)
    const m = Math.floor(s / 60)
    const r = s % 60
    return m > 0 ? `${m}m ${r}s` : `${r}s`
}

function fmtMoney(n: number): string {
    const v = Number(n) || 0
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
    return `$${v.toFixed(2)}`
}

const fmtPct = (n: number) => `${Number(n).toFixed(1)}%`
const fmtCtr = (n: number) => `${Number(n).toFixed(2)}%`

async function fetchOverview() {
    loading.value = true
    error.value = null
    try {
        const res = await bq.getOverview(
            props.projectId,
            props.preset,
            undefined,
            undefined,
            selectedDataSourceId.value,
        )
        overview.value = res
        dataSources.value = (res?.dataSources || []) as Array<{ id: number; name: string }>
        if (selectedDataSourceId.value == null && res?.dataSourceId != null) {
            selectedDataSourceId.value = res.dataSourceId
        }
    } catch (e) {
        error.value = 'Failed to load the GA4 overview'
        overview.value = null
    } finally {
        loading.value = false
    }
}

function onPresetChange(event: Event) {
    emit('update:preset', (event.target as HTMLSelectElement).value)
}

function onDataSourceChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value
    selectedDataSourceId.value = value ? Number(value) : null
    fetchOverview()
}

watch(() => props.preset, () => fetchOverview())

onMounted(fetchOverview)
</script>

<template>
    <div class="space-y-6">
        <!-- Controls -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-gray-500">Prebuilt overview from your Google Analytics (GA4) aggregate data.</p>
            <div class="flex items-center gap-2">
                <div v-if="dataSources.length > 1" class="flex items-center gap-1.5">
                    <label class="text-xs text-gray-500" for="ga4-overview-source">Property</label>
                    <select
                        id="ga4-overview-source"
                        class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 cursor-pointer max-w-[18rem]"
                        :value="selectedDataSourceId != null ? String(selectedDataSourceId) : ''"
                        @change="onDataSourceChange"
                    >
                        <option v-for="s in dataSources" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
                    </select>
                </div>
                <select
                    class="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 cursor-pointer"
                    :value="preset"
                    @change="onPresetChange"
                >
                    <option v-for="p in presets" :key="p.key" :value="p.key">{{ p.label }}</option>
                </select>
            </div>
        </div>

        <div v-if="loading" class="text-sm text-gray-500 py-6">Loading…</div>
        <div v-else-if="error" class="text-sm text-red-600 py-6">{{ error }}</div>
        <template v-else-if="kpis">
            <!-- KPI cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Sessions</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtNum(kpis.sessions) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Active Users</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtNum(kpis.users) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">New Users</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtNum(kpis.newUsers) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Page Views</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtNum(kpis.pageViews) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Avg. Session Duration</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtDuration(kpis.averageSessionDuration) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Engagement Rate</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ Number(kpis.engagementRate).toFixed(1) }}%</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Bounce Rate</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ Number(kpis.bounceRate).toFixed(1) }}%</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Key Events</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtNum(kpis.conversions) }}</p>
                </div>
            </div>

            <!-- Revenue & engagement KPIs -->
            <div v-if="revenueKpis" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Total Revenue</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtMoney(revenueKpis.totalRevenue) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Item Revenue</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtMoney(revenueKpis.itemRevenue) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">ARPU</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtMoney(revenueKpis.arpu) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">ARPPU</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtMoney(revenueKpis.arppu) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Ecommerce Purchases</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtNum(revenueKpis.ecommercePurchases) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Purchaser Rate</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtPct(revenueKpis.purchaserRate) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Avg. Engagement Time / Active User</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtDuration(avgEngagementTimePerActiveUser) }}</p>
                </div>
                <div class="rounded-lg bg-white border border-gray-200 p-4">
                    <p class="text-xs text-gray-500">Purchase Revenue</p>
                    <p class="text-xl font-bold text-gray-900 mt-1">{{ fmtMoney(revenueKpis.purchaseRevenue) }}</p>
                </div>
            </div>

            <!-- Acquisition sub-tabs -->
            <div class="flex gap-1 overflow-x-auto border-b border-gray-200 [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none]">
                <button
                    v-for="tab in ACQUISITION_SECTIONS"
                    :key="tab.id"
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer"
                    :class="localSection === tab.id
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800'"
                    @click="selectSection(tab.id)"
                >
                    <font-awesome-icon :icon="['fas', tab.icon]" class="w-3.5 h-3.5" />
                    {{ tab.label }}
                </button>
            </div>

            <!-- ═══════════════ TRAFFIC & CHANNELS ═══════════════ -->
            <section v-if="localSection === 'traffic'" class="space-y-4">
                <div>
                    <h2 class="text-base font-semibold text-gray-900">Traffic &amp; channels</h2>
                    <p class="text-xs text-gray-500">Where sessions come from, how they engage, and what they are worth.</p>
                </div>

                <!-- Sessions / users / new users trend -->
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 class="text-sm font-semibold text-gray-700 mb-2">Sessions, users &amp; new users over time</h3>
                    <ClientOnly>
                        <MultiLineChart
                            v-if="trendData"
                            chart-id="ga4-overview-trend"
                            :data="trendData"
                            x-axis-label="Date"
                            y-axis-label="Count"
                            :width="1200"
                            :height="420"
                            :show-data-points="true"
                            :enable-tooltips="true"
                            :editable-axis-labels="false"
                            :x-axis-rotation="-45"
                            legend-position="top"
                        />
                        <template #fallback>
                            <div class="flex items-center justify-center h-48">
                                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl text-gray-300" />
                            </div>
                        </template>
                    </ClientOnly>
                </div>

                <!-- Requested report: Sessions by session primary channel group -->
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 class="text-sm font-semibold text-gray-700 mb-1">
                        Sessions by session primary channel group (Default Channel Group)
                    </h3>
                    <p class="text-xs text-gray-500 mb-3">
                        Volume, engagement, events, key events and revenue per channel group. Event metrics populate
                        after the next GA4 sync.
                    </p>
                    <div v-if="channelPerformance.length" class="overflow-x-auto">
                        <table class="min-w-full text-sm">
                            <thead>
                                <tr class="text-left text-xs text-gray-500 border-b">
                                    <th class="py-2 pr-3 text-right">#</th>
                                    <th class="py-2 pr-4">Channel group</th>
                                    <th class="py-2 px-3 text-right">Sessions</th>
                                    <th class="py-2 px-3 text-right">Engaged sessions</th>
                                    <th class="py-2 px-3 text-right">Engagement rate</th>
                                    <th class="py-2 px-3 text-right">Avg engagement time</th>
                                    <th class="py-2 px-3 text-right">Online session events</th>
                                    <th class="py-2 px-3 text-right">Event count</th>
                                    <th class="py-2 px-3 text-right">Key events</th>
                                    <th class="py-2 px-3 text-right">Session key event rate</th>
                                    <th class="py-2 px-3 text-right">Total revenue</th>
                                    <th class="py-2 pl-3 text-right">Revenue / session</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(r, i) in channelPerformance" :key="r.channel" class="border-b last:border-0">
                                    <td class="py-2 pr-3 text-right text-gray-400">{{ i + 1 }}</td>
                                    <td class="py-2 pr-4 text-gray-800 font-medium">{{ r.channel }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.sessions) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.engagedSessions) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtPct(r.engagementRate) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtDuration(r.avgEngagementTimePerSession) }}</td>
                                    <td class="py-2 px-3 text-right">{{ Number(r.eventsPerSession).toFixed(2) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.eventCount) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.keyEvents) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtPct(r.sessionKeyEventRate) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtMoney(r.totalRevenue) }}</td>
                                    <td class="py-2 pl-3 text-right">{{ fmtMoney(r.revenuePerSession) }}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr class="border-t-2 border-gray-200 font-semibold text-gray-900">
                                    <td class="py-2 pr-3"></td>
                                    <td class="py-2 pr-4">Total</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(channelTotals.sessions) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(channelTotals.engaged) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtPct(channelTotals.engagementRate) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtDuration(channelTotals.avgTime) }}</td>
                                    <td class="py-2 px-3 text-right">{{ Number(channelTotals.eventsPerSession).toFixed(2) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(channelTotals.eventCount) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(channelTotals.keyEvents) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtPct(channelTotals.keyEventRate) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtMoney(channelTotals.revenue) }}</td>
                                    <td class="py-2 pl-3 text-right">{{ fmtMoney(channelTotals.revenuePerSession) }}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <p v-else class="text-sm text-gray-400 py-6 text-center">No channel data</p>
                </div>

                <!-- Channel volume + mix over time -->
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">Sessions by channel group over time</h3>
                        <ClientOnly>
                            <StackedBarChart
                                v-if="channelTrendChart"
                            chart-id="ga4-channel-trend"
                            :data="channelTrendChart.data"
                            :stack-keys="channelTrendChart.stackKeys"
                            :width="600"
                            :height="420"
                            x-axis-label="Date"
                            y-axis-label="Sessions"
                            :editable-axis-labels="false"
                            :x-axis-label-dy="50"
                                :x-axis-rotation="-45"
                                column-name="Sessions"
                                category-name="Date"
                            />
                            <p v-else class="text-sm text-gray-400 py-6 text-center">No channel trend data</p>
                        </ClientOnly>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">Channel mix over time (% of sessions)</h3>
                        <ClientOnly>
                            <StackedBarChart
                                v-if="channelMixChart"
                            chart-id="ga4-channel-mix"
                            :data="channelMixChart.data"
                            :stack-keys="channelMixChart.stackKeys"
                            :width="600"
                            :height="420"
                            x-axis-label="Date"
                            y-axis-label="% of sessions"
                            :editable-axis-labels="false"
                            :x-axis-label-dy="50"
                                :x-axis-rotation="-45"
                                column-name="Share"
                                category-name="Date"
                            />
                            <p v-else class="text-sm text-gray-400 py-6 text-center">No channel mix data</p>
                        </ClientOnly>
                    </div>
                </div>

                <!-- Revenue by channel + paid/organic split -->
                <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div class="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">Revenue by channel group over time</h3>
                        <ClientOnly>
                            <StackedBarChart
                                v-if="revenueChannelChart"
                            chart-id="ga4-revenue-channel-trend"
                            :data="revenueChannelChart.data"
                            :stack-keys="revenueChannelChart.stackKeys"
                            :width="800"
                            :height="420"
                            x-axis-label="Date"
                            y-axis-label="Revenue"
                            :editable-axis-labels="false"
                            :x-axis-label-dy="50"
                                :x-axis-rotation="-45"
                                column-name="Revenue"
                                category-name="Date"
                            />
                            <p v-else class="text-sm text-gray-400 py-6 text-center">No revenue data</p>
                        </ClientOnly>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">Paid vs organic sessions</h3>
                        <ClientOnly>
                            <HorizontalBarChart
                                v-if="paidOrganicChart.length"
                                chart-id="ga4-paid-organic"
                                :data="paidOrganicChart"
                                :width="400"
                                :height="420"
                                category-name="Source"
                                column-name="Sessions"
                                x-axis-label="Sessions"
                                y-axis-label="Source"
                                :editable-axis-labels="false"
                            />
                            <p v-else class="text-sm text-gray-400 py-6 text-center">No channel data</p>
                        </ClientOnly>
                    </div>
                </div>

                <!-- New users by channel over time -->
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 class="text-sm font-semibold text-gray-700 mb-2">New users by channel group over time</h3>
                    <ClientOnly>
                        <StackedBarChart
                            v-if="newUsersChannelChart"
                            chart-id="ga4-new-users-channel-trend"
                            :data="newUsersChannelChart.data"
                            :stack-keys="newUsersChannelChart.stackKeys"
                            :width="1200"
                            :height="420"
                            x-axis-label="Date"
                            y-axis-label="New users"
                            :editable-axis-labels="false"
                            :x-axis-label-dy="50"
                                :x-axis-rotation="-45"
                            column-name="New users"
                            category-name="Date"
                        />
                        <p v-else class="text-sm text-gray-400 py-6 text-center">No new-user trend data</p>
                    </ClientOnly>
                </div>
            </section>

            <!-- ═══════════════ CAMPAIGNS & PAGES ═══════════════ -->
            <section v-else-if="localSection === 'campaigns'" class="space-y-4">
                <div>
                    <h2 class="text-base font-semibold text-gray-900">Campaigns &amp; pages</h2>
                    <p class="text-xs text-gray-500">Which campaigns and landing pages actually convert.</p>
                </div>

                <!-- Campaign performance -->
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 class="text-sm font-semibold text-gray-700 mb-3">Campaign performance</h3>
                    <div v-if="campaignPerformance.length" class="overflow-x-auto">
                        <table class="min-w-full text-sm">
                            <thead>
                                <tr class="text-left text-xs text-gray-500 border-b">
                                    <th class="py-2 pr-4">Campaign</th>
                                    <th class="py-2 px-3">Source / Medium</th>
                                    <th class="py-2 px-3 text-right">Sessions</th>
                                    <th class="py-2 px-3 text-right">Engaged sessions</th>
                                    <th class="py-2 px-3 text-right">Engagement rate</th>
                                    <th class="py-2 px-3 text-right">Key events</th>
                                    <th class="py-2 px-3 text-right">Session key event rate</th>
                                    <th class="py-2 px-3 text-right">Total revenue</th>
                                    <th class="py-2 pl-3 text-right">Revenue / session</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="r in campaignPerformance" :key="r.name + r.secondary" class="border-b last:border-0">
                                    <td class="py-2 pr-4 text-gray-800 font-medium truncate max-w-xs">{{ r.name }}</td>
                                    <td class="py-2 px-3 text-gray-600 truncate max-w-xs">{{ r.secondary }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.sessions) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.engagedSessions) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtPct(r.engagementRate) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.keyEvents) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtPct(r.sessionKeyEventRate) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtMoney(r.totalRevenue || 0) }}</td>
                                    <td class="py-2 pl-3 text-right">{{ fmtMoney(r.revenuePerSession || 0) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p v-else class="text-sm text-gray-400 py-6 text-center">No campaign data — GA4 campaigns carry a campaign name only when tagged (e.g. utm_campaign).</p>
                </div>

                <!-- Landing page + source/medium performance -->
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-3">Landing page performance</h3>
                        <div v-if="landingPagePerformance.length" class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead>
                                    <tr class="text-left text-xs text-gray-500 border-b">
                                        <th class="py-2 pr-4">Landing page</th>
                                        <th class="py-2 px-3 text-right">Sessions</th>
                                        <th class="py-2 px-3 text-right">Engaged</th>
                                        <th class="py-2 px-3 text-right">Eng. rate</th>
                                        <th class="py-2 px-3 text-right">Key events</th>
                                        <th class="py-2 pl-3 text-right">Key event rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="r in landingPagePerformance" :key="r.name" class="border-b last:border-0">
                                        <td class="py-2 pr-4 text-gray-800 truncate max-w-[16rem]">{{ r.name }}</td>
                                        <td class="py-2 px-3 text-right">{{ fmtNum(r.sessions) }}</td>
                                        <td class="py-2 px-3 text-right">{{ fmtNum(r.engagedSessions) }}</td>
                                        <td class="py-2 px-3 text-right">{{ fmtPct(r.engagementRate) }}</td>
                                        <td class="py-2 px-3 text-right">{{ fmtNum(r.keyEvents) }}</td>
                                        <td class="py-2 pl-3 text-right">{{ fmtPct(r.sessionKeyEventRate) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p v-else class="text-sm text-gray-400 py-6 text-center">No landing page data</p>
                    </div>

                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-3">Source / medium performance</h3>
                        <div v-if="sourceMediumPerformance.length" class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead>
                                    <tr class="text-left text-xs text-gray-500 border-b">
                                        <th class="py-2 pr-4">Source / Medium</th>
                                        <th class="py-2 px-3 text-right">Sessions</th>
                                        <th class="py-2 px-3 text-right">Engaged</th>
                                        <th class="py-2 px-3 text-right">Eng. rate</th>
                                        <th class="py-2 px-3 text-right">Key events</th>
                                        <th class="py-2 pl-3 text-right">Key event rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="r in sourceMediumPerformance" :key="r.name" class="border-b last:border-0">
                                        <td class="py-2 pr-4 text-gray-800 truncate max-w-[16rem]">{{ r.name }}</td>
                                        <td class="py-2 px-3 text-right">{{ fmtNum(r.sessions) }}</td>
                                        <td class="py-2 px-3 text-right">{{ fmtNum(r.engagedSessions) }}</td>
                                        <td class="py-2 px-3 text-right">{{ fmtPct(r.engagementRate) }}</td>
                                        <td class="py-2 px-3 text-right">{{ fmtNum(r.keyEvents) }}</td>
                                        <td class="py-2 pl-3 text-right">{{ fmtPct(r.sessionKeyEventRate) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p v-else class="text-sm text-gray-400 py-6 text-center">No source/medium data</p>
                    </div>
                </div>

                <!-- Channel efficiency -->
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 class="text-sm font-semibold text-gray-700 mb-1">Channel efficiency</h3>
                    <p class="text-xs text-gray-500 mb-2">Session key event rate (%) by channel group — how efficiently each channel converts sessions.</p>
                    <ClientOnly>
                        <HorizontalBarChart
                            v-if="channelEfficiencyBars.length"
                            chart-id="ga4-channel-efficiency"
                            :data="channelEfficiencyBars"
                            :height="360"
                            category-name="Channel"
                            column-name="Session key event rate"
                            x-axis-label="Session key event rate (%)"
                            y-axis-label="Channel"
                            :editable-axis-labels="false"
                        />
                        <p v-else class="text-sm text-gray-400 py-6 text-center">No channel data</p>
                    </ClientOnly>
                </div>

                <!-- First user source / medium -->
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 class="text-sm font-semibold text-gray-700 mb-2">First user source / medium</h3>
                    <div v-if="firstUserSourceMedium.length" class="overflow-x-auto">
                        <table class="min-w-full text-sm">
                            <thead>
                                <tr class="text-left text-xs text-gray-500 border-b">
                                    <th class="py-2 pr-4">Source / Medium</th>
                                    <th class="py-2 pr-4 text-right">Users</th>
                                    <th class="py-2 pr-4 text-right">New Users</th>
                                    <th class="py-2 pr-4 text-right">Sessions</th>
                                    <th class="py-2 text-right">Key Events</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="r in firstUserSourceMedium" :key="r.category" class="border-b last:border-0">
                                    <td class="py-2 pr-4 text-gray-800 truncate max-w-xs">{{ r.category }}</td>
                                    <td class="py-2 pr-4 text-right">{{ fmtNum(r.users) }}</td>
                                    <td class="py-2 pr-4 text-right">{{ fmtNum(r.newUsers) }}</td>
                                    <td class="py-2 pr-4 text-right">{{ fmtNum(r.sessions) }}</td>
                                    <td class="py-2 text-right">{{ fmtNum(r.conversions) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p v-else class="text-sm text-gray-400 py-6 text-center">No source/medium data</p>
                </div>
            </section>

            <!-- ═══════════════ CONVERSIONS & REVENUE ═══════════════ -->
            <section v-else-if="localSection === 'conversions'" class="space-y-4">
                <div>
                    <h2 class="text-base font-semibold text-gray-900">Conversions &amp; revenue</h2>
                    <p class="text-xs text-gray-500">What converts and what it earns.</p>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <CategoryTable title="Key events (conversions) by event name" :rows="eventConversions" value-label="Key events" empty-text="No events marked as key events in GA4 Admin" />
                    <CategoryTable title="Event value by event" :rows="eventValueByEvent" value-label="Event value" :format-value="fmtMoney" empty-text="No event value recorded" />
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <CategoryTable title="Revenue by item category" :rows="revenueByCategory" value-label="Item revenue" :format-value="fmtMoney" />
                    <CategoryTable title="Top products by revenue" :rows="itemsByName" value-label="Items purchased" />
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <CategoryTable title="Units sold by product" :rows="quantityByProductId" value-label="Units" />
                    <CategoryTable title="Engagement rate by first-user source" :rows="engagementByFirstSource" value-label="Rate %" :format-value="fmtPct" />
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <CategoryTable title="Key events by country" :rows="keyEventsByCountry" value-label="Key events" />
                    <CategoryTable title="Key events by device" :rows="keyEventsByDevice" value-label="Key events" />
                </div>

                <!-- Organic search clicks & impressions over time -->
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 class="text-sm font-semibold text-gray-700 mb-2">Organic search clicks &amp; impressions over time</h3>
                    <ClientOnly>
                        <MultiLineChart
                            v-if="organicSearchTrend"
                            chart-id="ga4-organic-search-trend"
                            :data="organicSearchTrend"
                            x-axis-label="Date"
                            y-axis-label="Count"
                            :width="1200"
                            :height="280"
                            :show-data-points="true"
                            :enable-tooltips="true"
                            :editable-axis-labels="false"
                            :x-axis-rotation="-45"
                            legend-position="top"
                        />
                        <p v-else class="text-sm text-gray-400 py-6 text-center">No Search Console trend data</p>
                    </ClientOnly>
                </div>

                <!-- Organic search performance -->
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 class="text-sm font-semibold text-gray-700 mb-3">Organic search performance</h3>
                    <div v-if="organicSearchPerformance.length" class="overflow-x-auto">
                        <table class="min-w-full text-sm">
                            <thead>
                                <tr class="text-left text-xs text-gray-500 border-b">
                                    <th class="py-2 pr-4">Landing page</th>
                                    <th class="py-2 px-3 text-right">Clicks</th>
                                    <th class="py-2 px-3 text-right">Impressions</th>
                                    <th class="py-2 px-3 text-right">CTR</th>
                                    <th class="py-2 pl-3 text-right">Avg position</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="r in organicSearchPerformance" :key="r.landingPage" class="border-b last:border-0">
                                    <td class="py-2 pr-4 text-gray-800 truncate max-w-xs">{{ r.landingPage }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.clicks) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtNum(r.impressions) }}</td>
                                    <td class="py-2 px-3 text-right">{{ fmtCtr(r.ctr) }}</td>
                                    <td class="py-2 pl-3 text-right">{{ Number(r.averagePosition || 0).toFixed(1) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p v-else class="text-sm text-gray-400 py-6 text-center">No Search Console data</p>
                </div>
            </section>

            <!-- ═══════════════ AUDIENCE & TECHNOLOGY ═══════════════ -->
            <section v-else-if="localSection === 'audience'" class="space-y-4">
                <div>
                    <h2 class="text-base font-semibold text-gray-900">Audience &amp; technology</h2>
                    <p class="text-xs text-gray-500">Who the traffic is and what they use.</p>
                </div>

                <div class="columns-1 lg:columns-2 gap-4">
                    <div class="break-inside-avoid mb-4">
                        <div class="bg-white border border-gray-200 rounded-xl p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-2">Top pages</h3>
                            <ClientOnly>
                                <HorizontalBarChart
                                    v-if="pagesBars.length"
                                    chart-id="ga4-overview-pages"
                                    :data="pagesBars"
                                    :height="260"
                                    category-name="Page"
                                    column-name="Page views"
                                    x-axis-label="Page views"
                                    y-axis-label="Page"
                                    :editable-axis-labels="false"
                                />
                                <p v-else class="text-sm text-gray-400 py-6 text-center">No page data</p>
                            </ClientOnly>
                        </div>
                    </div>
                    <div class="break-inside-avoid mb-4">
                        <div class="bg-white border border-gray-200 rounded-xl p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-2">Top countries</h3>
                            <div v-if="countries.length" class="space-y-4">
                                <ClientOnly>
                                    <CountryMapChart :chart-id="'ga4-countries'" :data="countries" :width="600" :height="320" />
                                    <template #fallback>
                                        <div class="h-64 bg-gray-50 rounded-lg animate-pulse"></div>
                                    </template>
                                </ClientOnly>
                                <div class="overflow-x-auto">
                                    <table class="min-w-full text-sm">
                                        <thead>
                                            <tr class="text-left text-xs text-gray-500 border-b">
                                                <th class="py-2 pr-4">Country</th>
                                                <th class="py-2 text-right">Sessions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="c in countries" :key="c.category" class="border-b last:border-0">
                                                <td class="py-2 pr-4 text-gray-800 truncate max-w-xs">{{ c.category }}</td>
                                                <td class="py-2 text-right">{{ fmtNum(c.value) }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <p v-else class="text-sm text-gray-400 py-6 text-center">No country data</p>
                        </div>
                    </div>
                    <div class="break-inside-avoid mb-4">
                        <div class="bg-white border border-gray-200 rounded-xl p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-2">Sessions by device</h3>
                            <ClientOnly>
                                <VerticalBarChart
                                    v-if="devicesBars.length"
                                    chart-id="ga4-overview-devices"
                                    :data="devicesBars"
                                    :height="260"
                                    category-name="Device"
                                    column-name="Sessions"
                                    x-axis-label="Device"
                                    y-axis-label="Sessions"
                                    :editable-axis-labels="false"
                                />
                                <p v-else class="text-sm text-gray-400 py-6 text-center">No device data</p>
                            </ClientOnly>
                        </div>
                    </div>
                    <div class="break-inside-avoid mb-4">
                        <div class="bg-white border border-gray-200 rounded-xl p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-2">Top events</h3>
                            <div v-if="events.length" class="overflow-x-auto">
                                <table class="min-w-full text-sm">
                                    <thead>
                                        <tr class="text-left text-xs text-gray-500 border-b">
                                            <th class="py-2 pr-4">Event</th>
                                            <th class="py-2 text-right">Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="e in events" :key="e.category" class="border-b last:border-0">
                                            <td class="py-2 pr-4 text-gray-800 truncate max-w-xs">{{ e.category }}</td>
                                            <td class="py-2 text-right">{{ fmtNum(e.value) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p v-else class="text-sm text-gray-400 py-6 text-center">No event data</p>
                        </div>
                    </div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="New users by first-user channel" :rows="newUsersByChannel" value-label="New users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Views by page title" :rows="pageTitleViews" value-label="Views" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Active users by city" :rows="activeUsersByCity" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4">
                        <div class="bg-white border border-gray-200 rounded-xl p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-2">Active users by device category</h3>
                            <ClientOnly>
                                <VerticalBarChart
                                    v-if="activeUsersByDeviceBars.length"
                                    chart-id="ga4-active-users-device"
                                    :data="activeUsersByDeviceBars"
                                    :height="260"
                                    category-name="Device"
                                    column-name="Users"
                                    x-axis-label="Device"
                                    y-axis-label="Users"
                                    :editable-axis-labels="false"
                                />
                                <p v-else class="text-sm text-gray-400 py-6 text-center">No device data</p>
                            </ClientOnly>
                        </div>
                    </div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Active users by operating system" :rows="activeUsersByOs" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Active users by browser" :rows="activeUsersByBrowser" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Users by age" :rows="ageUsers" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Users by gender" :rows="genderUsers" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Users by language" :rows="languageUsers" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="New vs returning" :rows="newVsReturning" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Users by platform" :rows="platformUsers" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Users by device model" :rows="deviceModelUsers" value-label="Users" /></div>
                    <div class="break-inside-avoid mb-4"><CategoryTable title="Users by screen resolution" :rows="screenResolutionUsers" value-label="Users" /></div>
                </div>
            </section>
        </template>
        <div v-else class="text-sm text-gray-500 py-6">
            No GA4 data yet. Connect Google Analytics 4 and run a sync to see the prebuilt overview.
        </div>

        <!-- Required tooltip host for the D3 chart components -->
        <div class="dashboard-tooltip-container fixed inset-0 pointer-events-none z-[9999]"></div>
    </div>
</template>
