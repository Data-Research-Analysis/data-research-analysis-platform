<script setup lang="ts">
/**
 * GA4OverviewReport — prebuilt GA4 overview: KPI cards + chart-ready series.
 *
 * Reads the aggregate Data API tables, so it works for every GA4 connection
 * (no BigQuery layer required).
 */
import { useGA4Overview } from '@/composables/useGA4Overview'

const props = withDefaults(defineProps<{ projectId: number; preset?: string; maxLookbackDays?: number }>(), {
    preset: 'last_90_days',
    maxLookbackDays: 90,
})
const emit = defineEmits<{ (e: 'update:preset', preset: string): void }>()

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
const sources = computed(() => overview.value?.sources || [])
const events = computed(() => overview.value?.events || [])
const channels = computed(() => overview.value?.channels || [])
const channelsBars = computed(() => channels.value.map((c: any) => ({ label: c.category, value: c.value })))
const devices = computed(() => overview.value?.devices || [])

// Bucket 1 datasets
const newUsersByChannel = computed(() => overview.value?.newUsersByChannel || [])
const keyEventsByChannel = computed(() => (overview.value?.keyEventsByChannel || []).filter((r: any) => (r.value || 0) > 0))
const engagementByFirstSource = computed(() => overview.value?.engagementByFirstSource || [])
const sessionKeyEventRate = computed(() => overview.value?.sessionKeyEventRate || [])
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
const landingPages = computed(() => overview.value?.landingPages || [])
const searchQueries = computed(() => overview.value?.searchQueries || [])
const searchImpressions = computed(() => overview.value?.searchImpressions || [])
const revenueKpis = computed(() => overview.value?.revenueKpis || null)
const avgEngagementTimePerActiveUser = computed(() => overview.value?.avgEngagementTimePerActiveUser || 0)

// Horizontal bar chart expects { label, value } (pages only).
const pagesBars = computed(() => pages.value.map((c: any) => ({ label: c.category, value: c.value })))
const devicesBars = computed(() => devices.value.map((c: any) => ({ label: c.category, value: c.value })))

const kpis = computed(() => overview.value?.kpis || null)

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
    <div class="space-y-4">
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

            <!-- Trend -->
            <div class="bg-white border border-gray-200 rounded-xl p-4">
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Sessions, users & new users over time</h3>
                <ClientOnly>
                    <MultiLineChart
                        v-if="trendData"
                        chart-id="ga4-overview-trend"
                        :data="trendData"
                        x-axis-label="Date"
                        y-axis-label="Count"
                        :width="1200"
                        :height="300"
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

            <!-- Card grid — one masonry flow so each card keeps its own height
                 and shorter cards are followed by the next card, filling gaps -->
            <div class="columns-1 lg:columns-2 gap-4">
                <div class="break-inside-avoid mb-4">
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">Sessions by channel</h3>
                        <ClientOnly>
                            <HorizontalBarChart
                                v-if="channelsBars.length"
                                chart-id="ga4-overview-channels"
                                :data="channelsBars"
                                :height="260"
                                category-name="Channel"
                                column-name="Sessions"
                                x-axis-label="Sessions"
                                y-axis-label="Channel"
                                :editable-axis-labels="false"
                            />
                            <p v-else class="text-sm text-gray-400 py-6 text-center">No channel data</p>
                        </ClientOnly>
                    </div>
                </div>
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
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">Top source / medium</h3>
                        <div v-if="sources.length" class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead>
                                    <tr class="text-left text-xs text-gray-500 border-b">
                                        <th class="py-2 pr-4">Source / Medium</th>
                                        <th class="py-2 text-right">Sessions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="s in sources" :key="s.category" class="border-b last:border-0">
                                        <td class="py-2 pr-4 text-gray-800 truncate max-w-xs">{{ s.category }}</td>
                                        <td class="py-2 text-right">{{ fmtNum(s.value) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p v-else class="text-sm text-gray-400 py-6 text-center">No source data</p>
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
                <div class="break-inside-avoid mb-4"><CategoryTable title="Key events by channel" :rows="keyEventsByChannel" value-label="Key events" /></div>
                <div class="break-inside-avoid mb-4"><CategoryTable title="Engagement rate by first-user source" :rows="engagementByFirstSource" value-label="Rate %" :format-value="fmtPct" /></div>
                <div class="break-inside-avoid mb-4"><CategoryTable title="Session key event rate by source/medium" :rows="sessionKeyEventRate" value-label="Rate %" :format-value="fmtPct" /></div>
                <div class="break-inside-avoid mb-4"><CategoryTable title="Key events (conversions) by event name" :rows="eventConversions" value-label="Key events" empty-text="No events marked as key events in GA4 Admin" /></div>
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
                <div class="break-inside-avoid mb-4"><CategoryTable title="Landing pages" :rows="landingPages" value-label="Sessions" /></div>
                <div class="break-inside-avoid mb-4"><CategoryTable title="Organic search clicks by landing page" :rows="searchQueries" value-label="Clicks" /></div>
                <div class="break-inside-avoid mb-4"><CategoryTable title="Organic search impressions by landing page" :rows="searchImpressions" value-label="Impressions" /></div>
            </div>

            <!-- First user source / medium (multi-column) -->
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
        </template>
        <div v-else class="text-sm text-gray-500 py-6">
            No GA4 data yet. Connect Google Analytics 4 and run a sync to see the prebuilt overview.
        </div>

        <!-- Required tooltip host for the D3 chart components -->
        <div class="dashboard-tooltip-container fixed inset-0 pointer-events-none z-[9999]"></div>
    </div>
</template>
