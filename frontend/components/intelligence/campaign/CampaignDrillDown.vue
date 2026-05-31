<script setup lang="ts">
/**
 * CampaignDrillDown — Full drill-down view for a single campaign.
 *
 * Composes CampaignKPICards, CampaignTrendChart, DimensionBreakdown,
 * and AI analysis sections. Uses useCampaignAnalysis to fetch data
 * from the backend via projectId (preferred) or dataModelId (legacy).
 */
import { useCampaignAnalysis } from '@/composables/useCampaignAnalysis';

interface Props {
    campaignId: string;
    campaignName: string;
    channel: string;
    projectId?: number | null;
    dataModelId?: number | null;
    startDate: string;
    endDate: string;
}

const props = withDefaults(defineProps<Props>(), {
    projectId: null,
    dataModelId: null,
});

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const campaignIdRef = computed(() => props.campaignId);
const projectIdRef = computed(() => props.projectId);
const dataModelIdRef = computed(() => props.dataModelId);
const startDateRef = computed(() => props.startDate);
const endDateRef = computed(() => props.endDate);

const { data, isLoading, error, fetchAnalysis } = useCampaignAnalysis({
    campaignId: campaignIdRef,
    projectId: projectIdRef,
    dataModelId: dataModelIdRef,
    startDate: startDateRef,
    endDate: endDateRef,
});

// Fetch on mount
onMounted(() => {
    fetchAnalysis();
});

const showAIAnalysis = ref(false);

const channelIcons: Record<string, string> = {
    google_ads: 'google',
    meta_ads: 'facebook',
    linkedin_ads: 'linkedin',
    tiktok_ads: 'music',
    klaviyo: 'envelope',
    google_ad_manager: 'rectangle-ad',
    hubspot: 'hubspot',
};
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <button
                    class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    @click="emit('close')"
                >
                    <font-awesome-icon :icon="['fas', 'arrow-left']" class="text-gray-500" />
                </button>
                <div>
                    <div class="flex items-center gap-2">
                        <font-awesome-icon
                            :icon="['fas', channelIcons[channel] || 'chart-bar']"
                            class="text-indigo-500"
                        />
                        <h2 class="text-lg font-bold text-gray-900">{{ campaignName }}</h2>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">
                        {{ channel.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }} · {{ startDate }} → {{ endDate }}
                    </p>
                </div>
            </div>
            <button
                class="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                @click="emit('close')"
            >
                Back to Campaigns
            </button>
        </div>

        <!-- Error state -->
        <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
            <div class="flex items-center gap-2">
                <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-red-500" />
                <span class="text-sm text-red-700">{{ error }}</span>
            </div>
        </div>

        <!-- KPI Summary Cards -->
        <CampaignKPICards
            :kpis="data?.kpis || []"
            :is-loading="isLoading"
        />

        <!-- Daily Trend Chart -->
        <CampaignTrendChart
            :daily-trend="data?.dailyTrend || []"
            :is-loading="isLoading"
        />

        <!-- AI Analysis Toggle -->
        <div v-if="data?.aiAnalysis" class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-5">
            <button
                class="flex items-center gap-2 text-sm font-semibold text-indigo-700 mb-3"
                @click="showAIAnalysis = !showAIAnalysis"
            >
                <font-awesome-icon :icon="['fas', 'robot']" />
                AI Analysis
                <font-awesome-icon
                    :icon="['fas', showAIAnalysis ? 'chevron-up' : 'chevron-down']"
                    class="text-xs"
                />
            </button>
            <div v-if="showAIAnalysis" class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {{ data.aiAnalysis }}
            </div>
            <!-- Recommendations -->
            <div v-if="showAIAnalysis && data?.recommendations?.length" class="mt-4 pt-3 border-t border-indigo-100">
                <h4 class="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Recommendations</h4>
                <ul class="space-y-1.5">
                    <li
                        v-for="(rec, i) in data.recommendations"
                        :key="i"
                        class="flex items-start gap-2 text-sm text-gray-700"
                    >
                        <font-awesome-icon :icon="['fas', 'lightbulb']" class="text-amber-500 mt-0.5 flex-shrink-0" />
                        {{ rec }}
                    </li>
                </ul>
            </div>
        </div>

        <!-- Dimension Breakdowns -->
        <div v-if="data?.dimensionBreakdowns?.length" class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-800">Dimension Breakdowns</h3>
            <DimensionBreakdown
                v-for="dim in data.dimensionBreakdowns"
                :key="dim.dimension"
                :dimension="dim"
            />
        </div>
    </div>
</template>