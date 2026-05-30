<script setup lang="ts">
/**
 * ConversionPathSankey — Visualises the top N multi-channel conversion
 * paths as horizontal flow bars (simplified Sankey).
 *
 * When the full backend is unavailable, displays an empty state
 * consistent with the rest of the Attribution tab.
 */
import type { IConversionPath } from '@/composables/useAttribution';

interface Props {
    paths: IConversionPath[];
    isLoading?: boolean;
    /** Max number of paths to display. Defaults to 8. */
    maxPaths?: number;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
    maxPaths: 8,
});

const topPaths = computed(() => props.paths.slice(0, props.maxPaths));

const maxFrequency = computed(() => {
    if (topPaths.value.length === 0) return 1;
    return Math.max(...topPaths.value.map(p => p.frequency));
});

/** Color palette for channel badges */
const channelColors: Record<string, string> = {
    'Google Ads': 'bg-red-100 text-red-700 border-red-200',
    'Google Search': 'bg-red-100 text-red-700 border-red-200',
    'Meta Ads': 'bg-blue-100 text-blue-700 border-blue-200',
    'Facebook Ads': 'bg-blue-100 text-blue-700 border-blue-200',
    'Instagram Ads': 'bg-pink-100 text-pink-700 border-pink-200',
    'LinkedIn Ads': 'bg-sky-100 text-sky-700 border-sky-200',
    'Email': 'bg-amber-100 text-amber-700 border-amber-200',
    'Organic Search': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Direct': 'bg-gray-100 text-gray-700 border-gray-200',
    'Referral': 'bg-purple-100 text-purple-700 border-purple-200',
    'Display': 'bg-orange-100 text-orange-700 border-orange-200',
    'YouTube Ads': 'bg-red-100 text-red-700 border-red-200',
    'TikTok Ads': 'bg-gray-900 text-white border-gray-700',
};

function getChannelColor(channel: string): string {
    return channelColors[channel] || 'bg-gray-100 text-gray-600 border-gray-200';
}

function barWidth(frequency: number): string {
    return Math.max((frequency / maxFrequency.value) * 100, 8) + '%';
}
</script>

<template>
    <div class="conversion-path-sankey">
        <!-- Loading skeleton -->
        <div v-if="isLoading" class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-12 bg-gray-100 rounded animate-pulse" />
        </div>

        <!-- Paths -->
        <div v-else-if="paths.length > 0" class="space-y-2">
            <div
                v-for="(pathItem, idx) in topPaths"
                :key="idx"
                class="relative group"
            >
                <!-- Flow bar -->
                <div class="flex items-center gap-2">
                    <!-- Path channel badges with arrows -->
                    <div class="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                        <template v-for="(channel, cIdx) in pathItem.path" :key="cIdx">
                            <span
                                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap"
                                :class="getChannelColor(channel)"
                            >
                                {{ channel }}
                            </span>
                            <font-awesome-icon
                                v-if="cIdx < pathItem.path.length - 1"
                                :icon="['fas', 'arrow-right']"
                                class="text-[10px] text-gray-300 flex-shrink-0"
                            />
                        </template>
                        <!-- Conversion icon -->
                        <font-awesome-icon
                            :icon="['fas', 'flag-checkered']"
                            class="text-[10px] text-emerald-500 flex-shrink-0 ml-1"
                        />
                    </div>

                    <!-- Frequency bar + conversion count -->
                    <div class="flex items-center gap-2 flex-shrink-0 w-48">
                        <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                class="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-500"
                                :style="{ width: barWidth(pathItem.frequency) }"
                            />
                        </div>
                        <span class="text-xs text-gray-500 w-12 text-right tabular-nums">
                            {{ pathItem.frequency }}
                        </span>
                    </div>

                    <!-- Conversion count -->
                    <span class="text-xs font-medium text-gray-700 w-16 text-right tabular-nums flex-shrink-0">
                        {{ pathItem.conversions }} conv.
                    </span>
                </div>
            </div>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center py-10">
            <font-awesome-icon :icon="['fas', 'route']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm text-gray-500">No conversion paths available</p>
            <p class="text-xs text-gray-400 mt-1">
                Conversion path data will appear once multi-touch journey data is available
            </p>
        </div>
    </div>
</template>