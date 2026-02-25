<script setup lang="ts">
import type { ICustomerJourney, IJourneyTouchpoint } from '@/stores/attribution';

const props = defineProps<{
    journeys: ICustomerJourney[];
    loading?: boolean;
    totalJourneys?: number;
}>();

const PAGE_SIZE = 10;
const page = ref(1);

const visibleJourneys = computed(() => {
    const start = (page.value - 1) * PAGE_SIZE;
    return props.journeys.slice(start, start + PAGE_SIZE);
});

const totalPages = computed(() => Math.ceil(props.journeys.length / PAGE_SIZE));

function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
}

function channelColor(channelName: string): string {
    const palette = [
        'bg-blue-100 text-blue-700 border-blue-200',
        'bg-purple-100 text-purple-700 border-purple-200',
        'bg-green-100 text-green-700 border-green-200',
        'bg-orange-100 text-orange-700 border-orange-200',
        'bg-pink-100 text-pink-700 border-pink-200',
        'bg-teal-100 text-teal-700 border-teal-200',
        'bg-yellow-100 text-yellow-700 border-yellow-200',
        'bg-red-100 text-red-700 border-red-200',
    ];
    let hash = 0;
    for (let i = 0; i < channelName.length; i++) hash = channelName.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

function dotClass(tp: IJourneyTouchpoint): string {
    return channelColor(tp.channelName);
}

const activeTooltip = ref<string | null>(null);

function tooltipKey(journeyIdx: number, tpIdx: number): string {
    return `${journeyIdx}-${tpIdx}`;
}
</script>

<template>
    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-6 animate-pulse">
        <div v-for="i in 3" :key="i" class="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div class="h-4 bg-gray-200 rounded w-1/4"></div>
            <div class="flex gap-3 overflow-hidden">
                <div v-for="j in 6" :key="j" class="h-8 w-16 bg-gray-100 rounded-full flex-shrink-0"></div>
            </div>
        </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="journeys.length === 0" class="py-16 text-center text-gray-400">
        <font-awesome-icon :icon="['fas', 'route']" class="text-4xl mb-3 text-gray-300" />
        <p class="text-sm font-medium text-gray-500">No customer journeys recorded</p>
        <p class="text-xs mt-1">Track attribution events to map customer journeys to conversions.</p>
    </div>

    <div v-else class="space-y-4">
        <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-gray-500">
                Showing <span class="font-medium text-gray-700">{{ visibleJourneys.length }}</span>
                of <span class="font-medium text-gray-700">{{ totalJourneys ?? journeys.length }}</span> journeys
            </p>
        </div>

        <!-- Journey rows -->
        <div
            v-for="(journey, jIdx) in visibleJourneys"
            :key="journey.userIdentifier + jIdx"
            class="bg-white rounded-xl border border-gray-200 p-4"
        >
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <font-awesome-icon :icon="['fas', 'user']" class="text-gray-400 text-xs" />
                    <span class="text-xs font-mono text-gray-600">{{ journey.userIdentifier }}</span>
                </div>
                <div class="flex items-center gap-3 text-xs text-gray-400">
                    <span>{{ journey.totalTouchpoints }} touchpoints</span>
                    <span v-if="journey.totalRevenue > 0" class="text-green-600 font-semibold">
                        ${{ journey.totalRevenue.toLocaleString() }}
                    </span>
                    <span>{{ journey.journeyDurationHours.toFixed(1) }}h</span>
                </div>
            </div>

            <!-- Horizontal timeline -->
            <div class="overflow-x-auto pb-2">
                <div class="flex items-center gap-0 min-w-max">
                    <template v-for="(tp, tpIdx) in journey.touchpoints" :key="tp.eventId">
                        <!-- Connector line before each touchpoint (except first) -->
                        <div v-if="tpIdx > 0" class="w-6 h-px bg-gray-300 flex-shrink-0"></div>

                        <!-- Touchpoint dot + label -->
                        <div class="relative flex-shrink-0">
                            <button
                                type="button"
                                class="flex flex-col items-center gap-1 group cursor-pointer"
                                @mouseenter="activeTooltip = tooltipKey(jIdx, tpIdx)"
                                @mouseleave="activeTooltip = null"
                                @focus="activeTooltip = tooltipKey(jIdx, tpIdx)"
                                @blur="activeTooltip = null"
                            >
                                <div
                                    class="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-110"
                                    :class="dotClass(tp)"
                                >
                                    {{ tp.touchpointNumber }}
                                </div>
                                <span class="text-xs text-gray-500 max-w-16 truncate text-center leading-tight">
                                    {{ tp.channelName }}
                                </span>
                            </button>

                            <!-- Tooltip -->
                            <div
                                v-if="activeTooltip === tooltipKey(jIdx, tpIdx)"
                                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 w-48 shadow-lg pointer-events-none"
                            >
                                <p class="font-semibold">{{ tp.channelName }}</p>
                                <p class="text-gray-300 mt-0.5">{{ tp.eventType }}</p>
                                <p class="text-gray-400 mt-1 text-xs">{{ formatTimestamp(tp.timestamp) }}</p>
                                <p v-if="tp.eventValue" class="text-green-400 mt-0.5 font-medium">${{ tp.eventValue.toLocaleString() }}</p>
                                <p v-if="tp.pageUrl" class="text-gray-400 mt-0.5 truncate text-xs">{{ tp.pageUrl }}</p>
                                <!-- Tooltip arrow -->
                                <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                        </div>
                    </template>

                    <!-- Conversion star -->
                    <template v-if="journey.conversions.length > 0">
                        <div class="w-6 h-px bg-green-400 flex-shrink-0"></div>
                        <div class="flex-shrink-0 flex flex-col items-center gap-1">
                            <div class="w-9 h-9 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center">
                                <font-awesome-icon :icon="['fas', 'star']" class="text-green-500 text-sm" />
                            </div>
                            <span class="text-xs text-green-600 font-semibold">Converted</span>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-2">
            <button
                type="button"
                class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                :disabled="page === 1"
                @click="page--"
            >
                <font-awesome-icon :icon="['fas', 'arrow-left']" class="text-xs mr-1" />
                Previous
            </button>
            <span class="text-sm text-gray-500">Page {{ page }} of {{ totalPages }}</span>
            <button
                type="button"
                class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                :disabled="page === totalPages"
                @click="page++"
            >
                Next
                <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-xs ml-1" />
            </button>
        </div>
    </div>
</template>
