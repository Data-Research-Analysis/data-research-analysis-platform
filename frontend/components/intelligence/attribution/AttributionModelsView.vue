<script setup lang="ts">
import { useFunnelStore } from '@/stores/funnel'
import { useAttributionModels, ATTRIBUTION_MODEL_LABELS, ATTRIBUTION_MODEL_DESCRIPTIONS } from '@/composables/useAttributionModels'
import type { AttributionModel, IFunnelAttributionData, IAttributionSummaryData, IModelComparison } from '@/composables/useAttributionModels'

interface Props {
    projectId: number
    startDate?: string | null
    endDate?: string | null
}

interface Emits {
    (e: 'back'): void
    (e: 'view-funnel', funnelId: number): void
}

const props = withDefaults(defineProps<Props>(), {
    startDate: null,
    endDate: null,
})

const emit = defineEmits<Emits>()
const funnelStore = useFunnelStore()
const { isLoading, error, fetchFunnelAttribution, fetchAttributionSummary } = useAttributionModels()

const selectedModel = ref<AttributionModel>('first_touch')
const attributionData = ref<IFunnelAttributionData | null>(null)
const summaryData = ref<IAttributionSummaryData | null>(null)
const activeView = ref<'single' | 'comparison'>('single')
const selectedFunnelId = ref<number | null>(null)
const dataSource = ref<'client_tracking' | 'ad_platforms'>('client_tracking')

const funnelOptions = computed(() => funnelStore.funnels)

onMounted(async () => {
    await funnelStore.fetchFunnels(props.projectId)
    if (funnelOptions.value.length > 0) {
        selectedFunnelId.value = funnelOptions.value[0].id
    }
    if (props.startDate && props.endDate) {
        await loadData()
    }
})

async function loadData() {
    if (!props.startDate || !props.endDate) return

    const source = dataSource.value === 'ad_platforms' ? 'ad_platforms' : undefined

    if (activeView.value === 'single' && selectedFunnelId.value) {
        attributionData.value = await fetchFunnelAttribution(
            selectedFunnelId.value,
            selectedModel.value,
            props.startDate,
            props.endDate,
            source,
        )
    } else if (activeView.value === 'comparison') {
        summaryData.value = await fetchAttributionSummary(
            props.projectId,
            props.startDate,
            props.endDate,
            selectedFunnelId.value ?? undefined,
            source,
        )
    }
}

watch(dataSource, () => loadData())

watch(selectedModel, () => {
    if (activeView.value === 'single') loadData()
})

watch(selectedFunnelId, () => {
    loadData()
})

watch(activeView, () => {
    loadData()
})

function maxRevenue(channels: Array<{ revenue: number }>): number {
    if (!channels.length) return 0
    return Math.max(...channels.map(c => c.revenue))
}

function barWidth(revenue: number, maxRev: number): string {
    if (maxRev === 0) return '0%'
    return `${(revenue / maxRev) * 100}%`
}

function modelColor(index: number): string {
    const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
    return colors[index % colors.length]
}

const allModels: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped', 'data_driven']

function getChannelNames(models: IModelComparison[]): string[] {
    const names = new Set<string>()
    for (const m of models) {
        for (const c of m.channels) {
            names.add(c.channelName)
        }
    }
    return Array.from(names)
}

function getChannelRevenue(models: IModelComparison[], channelName: string, modelLabel: string): number {
    const modelData = models.find(m => m.label === modelLabel)
    if (!modelData) return 0
    const ch = modelData.channels.find(c => c.channelName === channelName)
    return ch?.revenue ?? 0
}
</script>

<template>
    <div class="attribution-models-view space-y-6 animate-fade-in">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <h2 class="text-lg font-bold text-gray-900">Attribution Models</h2>
                <p class="text-xs text-gray-400 mt-0.5">
                    Compare how different attribution models distribute credit across channels
                </p>
            </div>
        </div>

        <!-- View Toggle & Data Source -->
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div class="flex gap-2 bg-white border border-gray-200 rounded-lg p-1 w-fit">
                <button
                    class="px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer"
                    :class="activeView === 'single' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'"
                    @click="activeView = 'single'"
                >
                    Single Model
                </button>
                <button
                    class="px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer"
                    :class="activeView === 'comparison' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'"
                    @click="activeView = 'comparison'"
                >
                    Multi-Model Comparison
                </button>
            </div>
            <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-500">Data source:</span>
                <button
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer border"
                    :class="dataSource === 'client_tracking' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-800'"
                    @click="dataSource = 'client_tracking'"
                >
                    Client Tracking
                </button>
                <button
                    class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer border"
                    :class="dataSource === 'ad_platforms' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-800'"
                    @click="dataSource = 'ad_platforms'"
                >
                    Ad Platform Sync
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-16">
            <div class="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {{ error }}
        </div>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- SINGLE MODEL VIEW                                     -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <template v-if="activeView === 'single'">
            <!-- Funnel Selector -->
            <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div class="flex items-center gap-2">
                    <label class="text-sm font-medium text-gray-600 whitespace-nowrap">Funnel:</label>
                    <select
                        v-model="selectedFunnelId"
                        class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:border-blue-500"
                    >
                        <option v-for="f in funnelOptions" :key="f.id" :value="f.id">{{ f.name }}</option>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-sm font-medium text-gray-600 whitespace-nowrap">Model:</label>
                    <select
                        v-model="selectedModel"
                        class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:border-blue-500"
                    >
                        <option v-for="m in allModels" :key="m" :value="m">{{ ATTRIBUTION_MODEL_LABELS[m] }}</option>
                    </select>
                </div>
            </div>

            <!-- No funnel -->
            <div v-if="funnelOptions.length === 0" class="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-xl">
                <font-awesome-icon :icon="['fas', 'chart-pie']" class="w-16 h-16 text-gray-300 mb-4" />
                <h3 class="text-xl font-semibold text-gray-800 mb-2">No funnels available</h3>
                <p class="text-gray-600 mb-4 max-w-md">
                    Create a funnel first to see attribution model results.
                </p>
                <button
                    class="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                    @click="emit('back')"
                >
                    Go to Funnel Overview
                </button>
            </div>

            <!-- Attribution Data -->
            <template v-else-if="attributionData">
                <!-- Model Description -->
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                    <strong>{{ ATTRIBUTION_MODEL_LABELS[selectedModel] }}:</strong>
                    {{ ATTRIBUTION_MODEL_DESCRIPTIONS[selectedModel] }}
                </div>

                <!-- Top Metrics -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <p class="text-xs text-gray-500 mb-1">Model</p>
                        <p class="text-lg font-bold text-gray-900">{{ ATTRIBUTION_MODEL_LABELS[selectedModel] }}</p>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <p class="text-xs text-gray-500 mb-1">Total Conversions</p>
                        <p class="text-lg font-bold text-gray-900">{{ attributionData.totalConversions.toLocaleString() }}</p>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-xl p-4">
                        <p class="text-xs text-gray-500 mb-1">Attributed Revenue</p>
                        <p class="text-lg font-bold text-gray-900">${{ Math.round(attributionData.totalRevenue).toLocaleString() }}</p>
                    </div>
                </div>

                <!-- Channel Credit Breakdown Bar Chart -->
                <div class="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 class="text-sm font-semibold text-gray-700 mb-4">Channel Credit Distribution</h3>
                    <div class="space-y-4">
                        <div v-for="ch in attributionData.channelBreakdown" :key="ch.channelId" class="flex items-center gap-4">
                            <div class="w-36 shrink-0 text-right">
                                <p class="text-sm font-medium text-gray-800 truncate" :title="ch.channelName">{{ ch.channelName }}</p>
                            </div>
                            <div class="flex-1">
                                <div class="relative h-8 rounded-lg overflow-hidden bg-gray-100">
                                    <div
                                        class="absolute inset-y-0 left-0 rounded-lg transition-all duration-500 bg-blue-500"
                                        :style="{ width: barWidth(ch.revenue, maxRevenue(attributionData.channelBreakdown)) }"
                                    ></div>
                                    <div class="absolute inset-0 flex items-center px-3">
                                        <span class="text-xs font-medium" :class="ch.revenue / maxRevenue(attributionData.channelBreakdown) > 0.4 ? 'text-white' : 'text-gray-700'">
                                            ${{ Math.round(ch.revenue).toLocaleString() }}
                                        </span>
                                    </div>
                                </div>
                                <div class="flex justify-between text-xs text-gray-400 mt-0.5 px-1">
                                    <span>{{ ch.conversions }} conversions</span>
                                    <span>{{ ch.revenuePercentage }}% of revenue</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Channel Attribution Table -->
                <div class="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 class="text-sm font-semibold text-gray-700 mb-4">Channel Attribution Details</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-gray-200">
                                    <th class="text-left py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Channel</th>
                                    <th class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Conversions</th>
                                    <th class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Attributed Revenue</th>
                                    <th class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Revenue %</th>
                                    <th class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Conv %</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="ch in attributionData.channelBreakdown" :key="ch.channelId" class="border-b border-gray-100 hover:bg-gray-50">
                                    <td class="py-2.5 px-3 font-medium text-gray-800">{{ ch.channelName }}</td>
                                    <td class="py-2.5 px-3 text-right font-mono text-gray-700">{{ ch.conversions.toLocaleString() }}</td>
                                    <td class="py-2.5 px-3 text-right font-mono text-gray-700">${{ Math.round(ch.revenue).toLocaleString() }}</td>
                                    <td class="py-2.5 px-3 text-right font-mono text-gray-700">{{ ch.revenuePercentage }}%</td>
                                    <td class="py-2.5 px-3 text-right font-mono text-gray-700">{{ ch.conversionPercentage }}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>

            <!-- No Data -->
            <div v-else-if="!isLoading && funnelOptions.length > 0" class="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-xl">
                <font-awesome-icon :icon="['fas', 'chart-simple']" class="w-16 h-16 text-gray-300 mb-4" />
                <h3 class="text-xl font-semibold text-gray-800 mb-2">No attribution data</h3>
                <p class="text-gray-600 mb-4 max-w-md">
                    Ensure your date range is set and that there are funnel events with conversions.
                </p>
            </div>
        </template>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- MULTI-MODEL COMPARISON VIEW                           -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <template v-if="activeView === 'comparison'">
            <!-- Funnel Selector -->
            <div class="flex items-center gap-2" v-if="funnelOptions.length > 0">
                <label class="text-sm font-medium text-gray-600 whitespace-nowrap">Funnel:</label>
                <select
                    v-model="selectedFunnelId"
                    class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:border-blue-500"
                >
                    <option v-for="f in funnelOptions" :key="f.id" :value="f.id">{{ f.name }}</option>
                </select>
            </div>

            <div v-if="summaryData?.message" class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                {{ summaryData.message }}
            </div>

            <template v-else-if="summaryData?.models">
                <!-- Summary Explanation -->
                <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
                    <strong>How to read this:</strong> Each column shows what share of credit each channel would receive under that attribution model. Large differences between models reveal channels that are better at <em>first engagement</em> vs <em>closing</em>.
                </div>

                <!-- Model Summary Cards -->
                <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <div
                        v-for="(md, idx) in summaryData.models"
                        :key="md.model"
                        class="bg-white border border-gray-200 rounded-xl p-4"
                    >
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-3 h-3 rounded-full shrink-0" :class="modelColor(idx)"></div>
                            <p class="text-sm font-semibold text-gray-800">{{ md.label }}</p>
                        </div>
                        <p class="text-xs text-gray-400">Top channel:</p>
                        <p class="text-sm font-medium text-gray-700 truncate">{{ md.channels[0]?.channelName || '—' }}</p>
                        <p class="text-xs text-gray-500">
                            ${{ Math.round(md.channels[0]?.revenue || 0).toLocaleString() }}
                            ({{ md.channels[0]?.revenuePercentage }}%)
                        </p>
                    </div>
                </div>

                <!-- Comparison Table -->
                <div class="bg-white border border-gray-200 rounded-xl p-5 overflow-x-auto">
                    <h3 class="text-sm font-semibold text-gray-700 mb-4">Side-by-Side Model Comparison</h3>
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-200">
                                <th class="text-left py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Channel</th>
                                <th
                                    v-for="(md, idx) in summaryData.models"
                                    :key="md.model"
                                    class="text-right py-2.5 px-3 font-medium text-xs uppercase"
                                    :class="modelColor(idx).replace('bg-', 'text-')"
                                >
                                    <div class="flex items-center justify-end gap-1">
                                        <div class="w-2 h-2 rounded-full shrink-0" :class="modelColor(idx)"></div>
                                        {{ md.label }}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="chName in getChannelNames(summaryData.models)"
                                :key="chName"
                                class="border-b border-gray-100 hover:bg-gray-50"
                            >
                                <td class="py-2.5 px-3 font-medium text-gray-800">{{ chName }}</td>
                                <td
                                    v-for="(md, idx) in summaryData.models"
                                    :key="md.model"
                                    class="py-2.5 px-3 text-right font-mono"
                                    :class="getChannelRevenue(summaryData.models, chName, md.label) > 0 ? 'text-gray-800' : 'text-gray-300'"
                                >
                                    ${{ Math.round(getChannelRevenue(summaryData.models, chName, md.label)).toLocaleString() }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Per-Model Detail -->
                <div
                    v-for="(md, idx) in summaryData.models"
                    :key="md.model"
                    class="bg-white border border-gray-200 rounded-xl p-5"
                >
                    <div class="flex items-center gap-2 mb-4">
                        <div class="w-3 h-3 rounded-full shrink-0" :class="modelColor(idx)"></div>
                        <h3 class="text-sm font-semibold text-gray-700">{{ md.label }}</h3>
                        <p class="text-xs text-gray-400 ml-auto">{{ ATTRIBUTION_MODEL_DESCRIPTIONS[md.model] }}</p>
                    </div>
                    <div class="space-y-3">
                        <div v-for="ch in md.channels" :key="ch.channelId" class="flex items-center gap-4">
                            <div class="w-32 shrink-0 text-right">
                                <p class="text-sm font-medium text-gray-800 truncate" :title="ch.channelName">{{ ch.channelName }}</p>
                            </div>
                            <div class="flex-1">
                                <div class="relative h-6 rounded overflow-hidden bg-gray-100">
                                    <div
                                        class="absolute inset-y-0 left-0 rounded transition-all duration-500"
                                        :class="modelColor(idx)"
                                        :style="{ width: barWidth(ch.revenue, maxRevenue(md.channels)) }"
                                    ></div>
                                    <div class="absolute inset-0 flex items-center px-2">
                                        <span class="text-xs font-medium" :class="ch.revenue / maxRevenue(md.channels) > 0.4 ? 'text-white' : 'text-gray-600'">
                                            ${{ Math.round(ch.revenue).toLocaleString() }}
                                        </span>
                                    </div>
                                </div>
                                <div class="flex justify-between text-xs text-gray-400 mt-0.5 px-1">
                                    <span>{{ ch.conversions }} conv</span>
                                    <span>{{ ch.revenuePercentage }}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- No Data -->
            <div v-else-if="!isLoading" class="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-xl">
                <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-16 h-16 text-gray-300 mb-4" />
                <h3 class="text-xl font-semibold text-gray-800 mb-2">No comparison data yet</h3>
                <p class="text-gray-600 mb-4 max-w-md">
                    Create funnels and ensure you have attribution events with conversions to populate the comparison.
                </p>
            </div>
        </template>
    </div>
</template>
