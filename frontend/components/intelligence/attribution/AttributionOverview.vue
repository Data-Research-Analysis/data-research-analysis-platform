<script setup lang="ts">
/**
 * AttributionOverview — Landing page for the Attribution tab in Intelligence Hub.
 *
 * Shows a list of user-defined funnels with key metrics and actions.
 * Entrance point to create new funnels, view analysis, and access the UTM guide.
 */
import { useFunnelStore } from '@/stores/funnel'

interface Props {
    projectId: number
    /** ISO date string — start of reporting period */
    startDate?: string | null
    /** ISO date string — end of reporting period */
    endDate?: string | null
}

const props = withDefaults(defineProps<Props>(), {
    startDate: null,
    endDate: null,
})

interface Emits {
    (e: 'create-funnel'): void
    (e: 'view-funnel', funnelId: number): void
}

const emit = defineEmits<Emits>()

const funnelStore = useFunnelStore()
const showUtmGuide = ref(false)

const isLoading = computed(() => funnelStore.isLoading)
const funnels = computed(() => funnelStore.funnels)

onMounted(async () => {
    await funnelStore.fetchFunnels(props.projectId)
})

function handleCreateFunnel() {
    emit('create-funnel')
}

function handleViewFunnel(id: number) {
    emit('view-funnel', id)
}

function formatDate(dateStr: string): string {
    if (!import.meta.client) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPercent(value: number | null): string {
    if (value === null || value === undefined) return '—'
    return `${value.toFixed(1)}%`
}

function formatNumber(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toLocaleString()
}
</script>

<template>
    <div class="attribution-overview space-y-6 animate-fade-in">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <h2 class="text-lg font-bold text-gray-900">Funnel Attribution</h2>
                <p class="text-sm text-gray-400 mt-0.5">
                    Define marketing funnels, match them to UTM parameters, and analyze performance
                </p>
            </div>
            <div class="flex items-center gap-2">
                <button
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    @click="showUtmGuide = true"
                >
                    <font-awesome-icon :icon="['fas', 'book']" class="w-3.5 h-3.5" />
                    UTM Setup Guide
                </button>
                <button
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                    @click="handleCreateFunnel"
                >
                    <font-awesome-icon :icon="['fas', 'plus']" class="w-3.5 h-3.5" />
                    Create Funnel
                </button>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center py-16">
            <div class="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="funnels.length === 0" class="flex flex-col items-center justify-center py-16 px-8 text-center bg-white border border-gray-200 rounded-xl">
            <font-awesome-icon :icon="['fas', 'diagram-project']" class="w-16 h-16 text-gray-300 mb-4" />
            <h3 class="text-xl font-semibold text-gray-800 mb-2">No funnels yet</h3>
            <p class="text-gray-600 mb-6 max-w-md">
                Create your first funnel to track how users move through your marketing stages. 
                Match each funnel stage to UTM parameters from your Google Ads and Meta Ads campaigns.
            </p>
            <div class="flex gap-3">
                <button
                    class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors cursor-pointer"
                    @click="handleCreateFunnel"
                >
                    <font-awesome-icon :icon="['fas', 'plus']" class="w-5 h-5" />
                    Create Your First Funnel
                </button>
                <button
                    class="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors cursor-pointer"
                    @click="showUtmGuide = true"
                >
                    <font-awesome-icon :icon="['fas', 'book']" class="w-5 h-5" />
                    View UTM Guide
                </button>
            </div>
        </div>

        <!-- Funnel Cards -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div
                v-for="funnel in funnels"
                :key="funnel.id"
                class="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden"
                @click="handleViewFunnel(funnel.id)"
            >
                <div class="flex items-start justify-between gap-2 mb-3">
                    <h3 class="text-sm sm:text-base font-semibold text-gray-800 truncate min-w-0">{{ funnel.name }}</h3>
                    <span class="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                        {{ funnel.steps?.length || 0 }} steps
                    </span>
                </div>

                <!-- Funnel Preview -->
                <div v-if="funnel.steps?.length" class="mb-3">
                    <div class="flex items-center gap-1 flex-wrap">
                        <div
                            v-for="(step, idx) in funnel.steps.slice(0, 4)"
                            :key="idx"
                            class="flex items-center gap-1"
                        >
                            <div class="w-2 h-2 rounded-full shrink-0" :class="{
                                'bg-blue-400': idx === 0,
                                'bg-indigo-400': idx === 1,
                                'bg-purple-400': idx === 2,
                                'bg-amber-400': idx === 3,
                            }"></div>
                            <span class="text-xs text-gray-600 truncate max-w-16 sm:max-w-20">{{ step.name }}</span>
                            <font-awesome-icon v-if="idx < funnel.steps.length - 1 && idx < 3" :icon="['fas', 'chevron-right']" class="w-2.5 h-2.5 text-gray-300 shrink-0" />
                        </div>
                        <span v-if="funnel.steps.length > 4" class="text-xs text-gray-400 ml-1 shrink-0">+{{ funnel.steps.length - 4 }}</span>
                    </div>
                </div>

                <!-- Metrics -->
                <div v-if="funnel.last_analyzed_at" class="flex items-center gap-3 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100 min-w-0">
                    <span class="truncate">{{ formatDate(funnel.last_analyzed_at) }}</span>
                    <span v-if="funnel.conversion_rate !== null" class="font-medium shrink-0" :class="funnel.conversion_rate >= 10 ? 'text-emerald-600' : 'text-gray-500'">
                        {{ formatPercent(funnel.conversion_rate) }} conversion
                    </span>
                </div>
                <div v-else class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 min-w-0">
                    <font-awesome-icon :icon="['fas', 'circle-info']" class="w-3 h-3 text-gray-400 shrink-0" />
                    <span class="text-xs text-gray-400 truncate">Not yet analyzed</span>
                </div>
            </div>
        </div>

        <!-- UTM Parameter Guide Modal -->
        <UTMParameterGuide :show="showUtmGuide" @close="showUtmGuide = false" />
    </div>
</template>
