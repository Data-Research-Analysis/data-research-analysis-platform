<script setup lang="ts">
import type { IJourneySankeyConfig } from '~/types/dashboard-widgets';

interface Props {
    chartId: string | number;
    projectId?: number;
    marketingConfig?: IJourneySankeyConfig;
    width?: number;
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    width: 600,
    height: 400,
});

const config = computed<IJourneySankeyConfig>(() => ({
    max_paths: 5,
    min_conversions: 1,
    ...(props.marketingConfig ?? {}),
}));

interface SankeyData {
    nodes: string[];
    links: { source: number; target: number; value: number }[];
}

const sankeyData = ref<SankeyData | null>(null);
const isLoading = ref(true);

const { data: widgetData, isLoading: widgetLoading } = useWidgetData<SankeyData>(
    'journey_sankey',
    computed(() => props.projectId ?? 0),
    config,
);

watch(widgetLoading, (v) => (isLoading.value = v), { immediate: true });
watch(widgetData, (d) => { if (d) sankeyData.value = d; }, { immediate: true });

// Derive topological columns from nodes/links
const sourceSet = computed(() => new Set((sankeyData.value?.links ?? []).map((l) => l.source)));
const targetSet = computed(() => new Set((sankeyData.value?.links ?? []).map((l) => l.target)));

const firstTouchIndexes = computed(() =>
    [...sourceSet.value].filter((i) => !targetSet.value.has(i)),
);
const lastTouchIndexes = computed(() =>
    [...targetSet.value].filter((i) => !sourceSet.value.has(i)),
);
const midTouchIndexes = computed(() =>
    [...sourceSet.value].filter((i) => targetSet.value.has(i)),
);

const nodes = computed(() => sankeyData.value?.nodes ?? []);

const firstTouchChannels = computed(() => firstTouchIndexes.value.map((i) => nodes.value[i]).filter(Boolean));
const midTouchChannels = computed(() => midTouchIndexes.value.map((i) => nodes.value[i]).filter(Boolean));
const lastTouchChannels = computed(() => lastTouchIndexes.value.map((i) => nodes.value[i]).filter(Boolean));

const maxConversions = computed(() => {
    if (!sankeyData.value?.links.length) return 1;
    return Math.max(1, ...sankeyData.value.links.map((l) => l.value));
});

// Build fake ConversionPath rows (top N by sum of link values into each last-touch node)
interface ConversionPath {
    id: string;
    first_touch: string;
    mid_touch: string;
    last_touch: string;
    conversions: number;
}

const paths = computed<ConversionPath[]>(() => {
    if (!sankeyData.value) return [];
    const { nodes: n, links } = sankeyData.value;
    const result: ConversionPath[] = [];

    for (const lastIdx of lastTouchIndexes.value) {
        const inLinks = links.filter((l) => l.target === lastIdx);
        for (const inLink of inLinks) {
            const midIdx = inLink.source;
            const outLinks = links.filter((l) => l.target === midIdx);
            if (outLinks.length === 0) {
                // Direct first→last (2-step journey)
                result.push({
                    id: `${midIdx}-${lastIdx}`,
                    first_touch: n[midIdx] ?? '',
                    mid_touch: '—',
                    last_touch: n[lastIdx] ?? '',
                    conversions: inLink.value,
                });
            } else {
                for (const firstLink of outLinks) {
                    result.push({
                        id: `${firstLink.source}-${midIdx}-${lastIdx}`,
                        first_touch: n[firstLink.source] ?? '',
                        mid_touch: n[midIdx] ?? '',
                        last_touch: n[lastIdx] ?? '',
                        conversions: Math.min(firstLink.value, inLink.value),
                    });
                }
            }
        }
    }

    return result
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, config.value.max_paths);
});

function pathHeight(conversions: number): number {
    return Math.max(12, (conversions / maxConversions.value) * 60);
}

const CHANNEL_COLOURS: Record<string, string> = {
    'Google Ads': '#4285f4',
    'Meta Ads': '#1877f2',
    'LinkedIn Ads': '#0a66c2',
    'Organic Search': '#34a853',
    'Email': '#ea4335',
    'Direct': '#fbbc04',
    'Referral': '#9c27b0',
    Other: '#6b7280',
};

function channelColor(channel: string): string {
    return CHANNEL_COLOURS[channel] ?? '#6b7280';
}

// Unique channel labels per column are now derived from topology above
</script>

<template>
    <div class="flex flex-col p-4 bg-white rounded-xl border border-gray-200 w-full h-full overflow-hidden">
        <div class="flex items-center gap-2 mb-3">
            <font-awesome-icon :icon="['fas', 'diagram-project']" class="text-primary-blue-100" />
            <h3 class="text-sm font-bold text-gray-700">Conversion Journey</h3>
            <span class="ml-auto text-xs text-gray-400">Top {{ config.max_paths }} paths</span>
        </div>

        <!-- Loading skeleton -->
        <div v-if="isLoading" class="flex gap-4 justify-around animate-pulse flex-1">
            <div v-for="col in 3" :key="col" class="flex flex-col gap-3 flex-1">
                <div v-for="i in 3" :key="i" class="h-10 bg-gray-100 rounded"></div>
            </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="paths.length === 0" class="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
            <font-awesome-icon :icon="['fas', 'diagram-project']" class="text-4xl text-gray-200" />
            <p class="text-sm font-medium">No conversion path data available</p>
            <p class="text-xs text-center">Attribution paths will display here once conversion data is connected</p>
        </div>

        <!-- 3-column sankey layout -->
        <div v-else class="flex gap-2 flex-1 overflow-hidden">
            <!-- Column 1: First touch -->
            <div class="flex flex-col gap-2 flex-1 justify-around">
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wide text-center mb-1">First Touch</div>
                <div
                    v-for="channel in firstTouchChannels"
                    :key="channel"
                    class="rounded-lg flex items-center justify-center text-xs font-semibold text-white px-2 py-1 text-center truncate"
                    :style="{ backgroundColor: channelColor(channel), minHeight: '32px' }"
                >
                    {{ channel }}
                </div>
            </div>

            <!-- Connector arrows -->
            <div class="flex items-center">
                <font-awesome-icon :icon="['fas', 'angles-right']" class="text-gray-300 text-xl" />
            </div>

            <!-- Column 2: Mid touch -->
            <div class="flex flex-col gap-2 flex-1 justify-around">
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wide text-center mb-1">Mid Touch</div>
                <div
                    v-for="channel in midTouchChannels"
                    :key="channel"
                    class="rounded-lg flex items-center justify-center text-xs font-semibold text-white px-2 py-1 text-center truncate"
                    :style="{ backgroundColor: channelColor(channel), minHeight: '32px' }"
                >
                    {{ channel }}
                </div>
            </div>

            <!-- Connector arrows -->
            <div class="flex items-center">
                <font-awesome-icon :icon="['fas', 'angles-right']" class="text-gray-300 text-xl" />
            </div>

            <!-- Column 3: Last touch + conversion -->
            <div class="flex flex-col gap-2 flex-1 justify-around">
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wide text-center mb-1">Last Touch</div>
                <div
                    v-for="channel in lastTouchChannels"
                    :key="channel"
                    class="rounded-lg flex items-center justify-center text-xs font-semibold text-white px-2 py-1 text-center truncate"
                    :style="{ backgroundColor: channelColor(channel), minHeight: '32px' }"
                >
                    {{ channel }}
                </div>
            </div>

            <!-- Conversion counts -->
            <div class="flex flex-col gap-2 justify-around pl-2">
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wide text-center mb-1">Conv.</div>
                <div
                    v-for="path in paths.slice(0, config.max_paths)"
                    :key="path.id"
                    class="flex items-center justify-center text-xs font-bold text-green-600 bg-green-50 rounded-full w-8"
                    :style="{ height: `${pathHeight(path.conversions)}px` }"
                >
                    {{ path.conversions }}
                </div>
            </div>
        </div>
    </div>
</template>
