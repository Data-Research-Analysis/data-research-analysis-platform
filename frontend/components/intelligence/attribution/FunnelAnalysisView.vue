<script setup lang="ts">
/**
 * FunnelAnalysisView — Visualization view for a single funnel.
 *
 * Shows:
 *   - Funnel chart (step-by-step drop-off)
 *   - Per-step metrics table
 *   - Channel breakdown per step
 *   - Time-between-stages analysis
 */
import { useFunnelStore } from '@/stores/funnel'
import { useFunnelAnalysis } from '@/composables/useFunnelAnalysis'

interface Props {
    projectId: number
    funnelId: number
    /** ISO date string — start of reporting period */
    startDate?: string | null
    /** ISO date string — end of reporting period */
    endDate?: string | null
}

interface Emits {
    (e: 'back'): void
    (e: 'edit', funnelId: number): void
    (e: 'delete', funnelId: number): void
}

const props = withDefaults(defineProps<Props>(), {
    startDate: null,
    endDate: null,
})

const emit = defineEmits<Emits>()
const funnelStore = useFunnelStore()

const funnel = computed(() => funnelStore.getFunnelById(props.funnelId))
const showDeleteConfirm = ref(false)

const {
    stages,
    channelFunnels,
    timePerStage,
    isLoading,
    hasData,
    maxCount,
    completionRate,
    formatNumber: fmtNum,
    formatPercent: fmtPct,
    fetch: fetchAnalysis,
} = useFunnelAnalysis({
    funnelId: computed(() => props.funnelId),
    startDate: computed(() => props.startDate),
    endDate: computed(() => props.endDate),
    immediate: false,
})

onMounted(async () => {
    await funnelStore.fetchFunnels(props.projectId)
    if (props.startDate && props.endDate) {
        fetchAnalysis()
    }
})

function funnelBarWidth(count: number): string {
    if (maxCount.value === 0) return '0%'
    return `${(count / maxCount.value) * 100}%`
}

function stageColor(order: number): string {
    const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500']
    return colors[(order - 1) % colors.length]
}

function stageTextColor(order: number): string {
    const colors = ['text-blue-600', 'text-indigo-600', 'text-purple-600', 'text-amber-600', 'text-emerald-600', 'text-rose-600', 'text-cyan-600']
    return colors[(order - 1) % colors.length]
}

function stageBgLight(order: number): string {
    const colors = ['bg-blue-50', 'bg-indigo-50', 'bg-purple-50', 'bg-amber-50', 'bg-emerald-50', 'bg-rose-50', 'bg-cyan-50']
    return colors[(order - 1) % colors.length]
}

async function handleDelete() {
    await funnelStore.deleteFunnel(props.funnelId)
    emit('back')
}

function formatDate(dateStr: string): string {
    if (!import.meta.client) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
    <div class="funnel-analysis-view space-y-6 animate-fade-in">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <button
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    @click="emit('back')"
                >
                    <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-3.5 h-3.5" />
                    Back
                </button>
                <div>
                    <h2 class="text-lg font-bold text-gray-900">{{ funnel?.name || 'Funnel Analysis' }}</h2>
                    <p v-if="funnel?.last_analyzed_at" class="text-xs text-gray-400 mt-0.5">
                        Last analyzed: {{ formatDate(funnel.last_analyzed_at) }}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                    @click="emit('edit', props.funnelId)"
                >
                    <font-awesome-icon :icon="['fas', 'pen']" class="w-3.5 h-3.5" />
                    Edit
                </button>
                <button
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                    @click="showDeleteConfirm = true"
                >
                    <font-awesome-icon :icon="['fas', 'trash']" class="w-3.5 h-3.5" />
                    Delete
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-16">
            <div class="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>

        <!-- No Data -->
        <div v-else-if="!hasData && !isLoading" class="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-xl">
            <font-awesome-icon :icon="['fas', 'chart-simple']" class="w-16 h-16 text-gray-300 mb-4" />
            <h3 class="text-xl font-semibold text-gray-800 mb-2">No analysis data yet</h3>
            <p class="text-gray-600 mb-4 max-w-md">
                Select a date range and ensure your Google Ads and Meta Ads campaigns have UTM parameters configured.
            </p>
            <p class="text-xs text-gray-400">Try the <strong>UTM Setup Guide</strong> from the Attribution overview page</p>
        </div>

        <!-- Analysis Content -->
        <div v-else class="space-y-6">
            <!-- Top Metrics Bar -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <p class="text-xs text-gray-500 mb-1">Total Entered</p>
                    <p class="text-2xl font-bold text-gray-900">{{ fmtNum(stages[0]?.count || 0) }}</p>
                </div>
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <p class="text-xs text-gray-500 mb-1">Total Completed</p>
                    <p class="text-2xl font-bold text-gray-900">{{ fmtNum(stages[stages.length - 1]?.count || 0) }}</p>
                </div>
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <p class="text-xs text-gray-500 mb-1">Conversion Rate</p>
                    <p class="text-2xl font-bold" :class="completionRate !== null && completionRate >= 10 ? 'text-emerald-600' : 'text-gray-900'">
                        {{ completionRate !== null ? completionRate + '%' : '—' }}
                    </p>
                </div>
                <div class="bg-white border border-gray-200 rounded-xl p-4">
                    <p class="text-xs text-gray-500 mb-1">Stages</p>
                    <p class="text-2xl font-bold text-gray-900">{{ stages.length }}</p>
                </div>
            </div>

            <!-- Funnel Visualization -->
            <div class="bg-white border border-gray-200 rounded-xl p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Funnel Drop-Off</h3>
                <div class="flex flex-col gap-4">
                    <div v-for="(stage, idx) in stages" :key="stage.id" class="flex items-center gap-4">
                        <div class="w-32 shrink-0 text-right">
                            <p class="text-sm font-medium text-gray-800">{{ stage.name }}</p>
                            <p class="text-xs text-gray-400">{{ fmtNum(stage.count) }}</p>
                        </div>
                        <div class="flex-1 flex flex-col gap-0.5">
                            <div class="relative h-9 rounded-lg overflow-hidden" :class="stageBgLight(stage.order)">
                                <div
                                    class="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                                    :class="stageColor(stage.order)"
                                    :style="{ width: funnelBarWidth(stage.count) }"
                                ></div>
                                <div class="absolute inset-0 flex items-center px-3">
                                    <span class="text-xs font-medium" :class="stage.count / maxCount > 0.4 ? 'text-white' : stageTextColor(stage.order)">
                                        {{ fmtNum(stage.count) }}
                                    </span>
                                </div>
                            </div>
                            <div v-if="idx < stages.length - 1" class="flex items-center gap-2 text-xs text-gray-400">
                                <span>{{ fmtPct(stage.conversionRateToNext ?? 0) }} to next</span>
                                <span class="text-red-400">
                                    {{ fmtPct(stage.dropOffPercent ?? 0) }} drop-off
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step Metrics Table -->
            <div class="bg-white border border-gray-200 rounded-xl p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Step-by-Step Metrics</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-200">
                                <th class="text-left py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Step</th>
                                <th class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Entered</th>
                                <th class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Conversion to Next</th>
                                <th class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Drop-Off</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(stage, idx) in stages" :key="stage.id" class="border-b border-gray-100 hover:bg-gray-50">
                                <td class="py-2.5 px-3">
                                    <div class="flex items-center gap-2">
                                        <div class="w-2 h-2 rounded-full shrink-0" :class="stageColor(stage.order)"></div>
                                        <span class="font-medium text-gray-800">{{ stage.name }}</span>
                                    </div>
                                </td>
                                <td class="py-2.5 px-3 text-right font-mono text-gray-700">{{ fmtNum(stage.count) }}</td>
                                <td class="py-2.5 px-3 text-right font-mono" :class="stage.conversionRateToNext !== null && stage.conversionRateToNext >= 50 ? 'text-emerald-600' : 'text-gray-700'">
                                    {{ stage.conversionRateToNext !== null ? fmtPct(stage.conversionRateToNext) : '—' }}
                                </td>
                                <td class="py-2.5 px-3 text-right font-mono" :class="stage.dropOffPercent !== null && stage.dropOffPercent > 50 ? 'text-red-600' : 'text-gray-700'">
                                    {{ stage.dropOffPercent !== null ? fmtPct(stage.dropOffPercent) : '—' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Channel Breakdown -->
            <div v-if="channelFunnels.length > 0" class="bg-white border border-gray-200 rounded-xl p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Channel Breakdown</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-200">
                                <th class="text-left py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Channel</th>
                                <th class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">Completion Rate</th>
                                <th v-for="stage in stages" :key="stage.id" class="text-right py-2.5 px-3 font-medium text-gray-500 text-xs uppercase">
                                    {{ stage.name }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="ch in channelFunnels" :key="ch.channel" class="border-b border-gray-100 hover:bg-gray-50">
                                <td class="py-2.5 px-3 font-medium text-gray-800">{{ ch.channel }}</td>
                                <td class="py-2.5 px-3 text-right font-mono" :class="ch.completionRate >= 10 ? 'text-emerald-600' : 'text-gray-700'">
                                    {{ fmtPct(ch.completionRate) }}
                                </td>
                                <td v-for="stage in ch.stages" :key="stage.id" class="py-2.5 px-3 text-right font-mono text-gray-700">
                                    {{ fmtNum(stage.count) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Time Per Stage -->
            <div v-if="timePerStage.length > 0" class="bg-white border border-gray-200 rounded-xl p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Average Time Between Stages</h3>
                <div class="flex flex-wrap gap-3">
                    <div
                        v-for="tps in timePerStage"
                        :key="tps.fromStage"
                        class="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                        <span class="text-sm text-gray-600">{{ tps.fromStage }}</span>
                        <font-awesome-icon :icon="['fas', 'arrow-right']" class="w-3 h-3 text-gray-400" />
                        <span class="text-sm text-gray-600">{{ tps.toStage }}</span>
                        <span class="text-sm font-semibold text-gray-800 ml-2">{{ tps.averageDays }} days</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <overlay-dialog v-if="showDeleteConfirm" @close="showDeleteConfirm = false">
            <template #overlay>
                <div class="max-w-md mx-auto bg-white rounded-xl p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-3">Delete Funnel?</h3>
                    <p class="text-sm text-gray-600 mb-6">
                        This will permanently delete "{{ funnel?.name }}" and all its analysis data. This action cannot be undone.
                    </p>
                    <div class="flex justify-end gap-3">
                        <button
                            class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                            @click="showDeleteConfirm = false"
                        >
                            Cancel
                        </button>
                        <button
                            class="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                            @click="handleDelete"
                        >
                            Delete Funnel
                        </button>
                    </div>
                </div>
            </template>
        </overlay-dialog>
    </div>
</template>
