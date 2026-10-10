<script setup lang="ts">
/**
 * CampaignDrillDown — Full drill-down view for a single campaign.
 *
 * Composes CampaignKPICards, CampaignTrendChart, DimensionBreakdown,
 * and AI analysis sections. Uses useCampaignAnalysis to fetch data
 * from the backend via projectId (preferred) or dataModelId (legacy).
 */
import { useCampaignAnalysis } from '@/composables/useCampaignAnalysis';
import type { ICampaignTargetEntity } from '@/composables/useCampaignAnalysis';
import type { ITargetActuals } from '@/composables/useCampaignTargets';
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import { useLoggedInUserStore } from '@/stores/logged_in_user';

interface Props {
    campaignId: string;
    campaignName: string;
    channel: string;
    projectId?: number | null;
    dataModelId?: number | null;
    startDate: string;
    endDate: string;
    sourceTable?: string;
    campaignColumn?: string;
}

const props = withDefaults(defineProps<Props>(), {
    projectId: null,
    dataModelId: null,
    sourceTable: '',
    campaignColumn: '',
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
    sourceTable: computed(() => props.sourceTable),
    campaignColumn: computed(() => props.campaignColumn),
});

// Only render dimension sections that actually returned rows, so
// unavailable dimensions (e.g. keyword/geo for Meta Ads) are hidden.
const availableDimensionBreakdowns = computed(() =>
    (data.value?.dimensionBreakdowns || []).filter(dim => dim.available && dim.rows.length > 0),
);

// ---------------------------------------------------------------------------
// North-star targets
// ---------------------------------------------------------------------------

const loggedInUserStore = useLoggedInUserStore();
const marketingRole = ref<string | null>(null);

const canEditTargets = computed(() => {
    if (marketingRole.value === 'cmo' || marketingRole.value === 'manager') return true;
    const user = loggedInUserStore.getLoggedInUser();
    return (user as any)?.user_type === 'admin';
});

async function loadMarketingRole() {
    if (!props.projectId) return;
    try {
        const res = await useAppFetch<{ success: boolean; data: { role: string; marketing_role: string | null } }>(
            `${baseUrl()}/project/${props.projectId}/members/me`,
            {
                headers: {
                    Authorization: `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                },
            },
        );
        marketingRole.value = res?.data?.marketing_role ?? null;
    } catch {
        marketingRole.value = null;
    }
}

/** Scope that saved targets live under (project + data source + channel). */
const targetScope = computed(() => data.value?.targetScope
    || { projectId: props.projectId ?? null, dataSourceId: null, channel: null });

/** Flattened ad set/ad group targets from the analysis response. */
const targetList = computed(() => data.value?.targets?.adSets || []);

/** Entities that can have targets: each ad set/ad group of this campaign. */
const targetEntities = computed<ICampaignTargetEntity[]>(() => {
    const campaignId = props.campaignId;
    const list: ICampaignTargetEntity[] = [];
    const seen = new Set<string>();

    for (const as of data.value?.settings?.adSets || []) {
        const id = String(as.id);
        if (seen.has(id)) continue;
        seen.add(id);
        if (as.name) seen.add(as.name);
        list.push({ level: 'ad_set', id, name: as.name || id, campaignId });
    }

    const adGroupDim = data.value?.dimensionBreakdowns.find(d => d.dimension === 'ad_group');
    for (const row of adGroupDim?.rows || []) {
        const id = row.label;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        list.push({ level: 'ad_set', id, name: id, campaignId });
    }

    return list;
});

/** Per ad-set/ad-group actuals keyed by the ad_group dimension label. */
const entityActuals = computed<Record<string, ITargetActuals>>(() => {
    const out: Record<string, ITargetActuals> = {};
    const dim = data.value?.dimensionBreakdowns.find(d => d.dimension === 'ad_group');
    for (const row of dim?.rows || []) {
        out[row.label] = {
            spend: row.spend,
            impressions: row.impressions,
            clicks: row.clicks,
            conversions: row.conversions,
            leads: row.conversions,
            revenue: row.revenue,
            ctr: row.ctr,
            cpc: row.cpc,
            cpm: row.impressions ? (row.spend / row.impressions) * 1000 : null,
            cpa: row.cpa,
            cpl: row.conversions ? row.spend / row.conversions : null,
            roas: row.roas,
        };
    }
    return out;
});

/** Inclusive length of the reporting window, used to prorate daily budgets. */
const reportingDays = computed(() => {
    const start = new Date(props.startDate);
    const end = new Date(props.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
});

// Fetch on mount
onMounted(() => {
    fetchAnalysis();
    loadMarketingRole();
});

/**
 * Drill-down tabs. Both tabs stay mounted (v-show), so the typical stats AND
 * the ready-made AI analysis both load their data on page open and are
 * instantly available when the user switches tabs. Stats is the default.
 */
const activeSectionTab = ref<'stats' | 'ai-analysis'>('stats');

// ---------------------------------------------------------------------------
// Channel resolution — the campaign list/table often has no channel column,
// so the channel can arrive as 'Unknown'. Infer it from the synced source
// table name (dra_meta_ads_*, dra_google_ads_*, ...) when that happens.
// ---------------------------------------------------------------------------

const KNOWN_CHANNELS = [
    'google_ads', 'meta_ads', 'linkedin_ads', 'google_analytics',
    'google_ad_manager', 'hubspot', 'klaviyo', 'tiktok_ads',
];

function inferChannelFromSourceTable(sourceTable?: string): string | null {
    if (!sourceTable) return null;
    const t = String(sourceTable).toLowerCase();
    return KNOWN_CHANNELS.find(k => t.includes(k)) ?? null;
}

const displayChannel = computed(() => {
    const raw = (props.channel || '').trim();
    const lower = raw.toLowerCase();
    const clean = raw && lower !== 'unknown' && lower !== 'unknown channel' && lower !== 'n/a' && lower !== 'null'
        ? raw
        : '';
    return clean || inferChannelFromSourceTable(props.sourceTable) || 'Unknown';
});

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
                <div>
                    <div class="flex items-center gap-2">
                        <font-awesome-icon
                            :icon="['fas', channelIcons[displayChannel] || 'chart-bar']"
                            class="text-indigo-500"
                        />
                        <h2 class="text-lg font-bold text-gray-900">{{ campaignName }}</h2>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">
                        {{ displayChannel.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }} · {{ startDate }} → {{ endDate }}
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

        <!-- Tab bar: typical stats (default) vs ready-made AI analysis -->
        <div class="flex items-center gap-2 border-b border-gray-200 pb-3 print:hidden" role="tablist" aria-label="Campaign views">
            <button
                type="button"
                role="tab"
                :aria-selected="activeSectionTab === 'stats'"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                :class="activeSectionTab === 'stats' ? 'bg-primary-blue-100 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
                @click="activeSectionTab = 'stats'"
            >
                <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-3.5 h-3.5" />
                Stats
            </button>
            <button
                type="button"
                role="tab"
                :aria-selected="activeSectionTab === 'ai-analysis'"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                :class="activeSectionTab === 'ai-analysis' ? 'bg-primary-blue-100 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
                @click="activeSectionTab = 'ai-analysis'"
            >
                <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="w-3.5 h-3.5" />
                AI Analysis
            </button>
        </div>

        <!-- ── Tab 1: typical stats (always mounted, hidden via v-show) ── -->

        <!-- Error state -->
        <div v-if="error" v-show="activeSectionTab === 'stats'" class="bg-red-50 border border-red-200 rounded-xl p-4">
            <div class="flex items-center gap-2">
                <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-red-500" />
                <span class="text-sm text-red-700">{{ error }}</span>
            </div>
        </div>

        <!-- KPI Summary Cards -->
        <CampaignKPICards
            v-show="activeSectionTab === 'stats'"
            :kpis="data?.kpis || []"
            :is-loading="isLoading"
        />

        <!-- Campaign & Ad Set Settings -->
        <CampaignSettingsPanel
            v-if="data?.settings"
            v-show="activeSectionTab === 'stats'"
            :settings="data.settings"
        />

        <!-- North-Star Targets (CMO/manager defined, per ad set/ad group) -->
        <CampaignTargetsPanel
            v-if="data && targetScope.projectId"
            v-show="activeSectionTab === 'stats'"
            :scope="targetScope"
            :entities="targetEntities"
            :targets="targetList"
            :entity-actuals="entityActuals"
            :can-edit="canEditTargets"
            :days="reportingDays"
        />

        <!-- Daily Trend Chart -->
        <CampaignTrendChart
            v-show="activeSectionTab === 'stats'"
            :daily-trend="data?.dailyTrend || []"
            :is-loading="isLoading"
        />

        <!-- Dimension Breakdowns -->
        <div
            v-if="availableDimensionBreakdowns.length"
            v-show="activeSectionTab === 'stats'"
            class="space-y-4"
        >
            <h3 class="text-sm font-semibold text-gray-800">Dimension Breakdowns</h3>
            <DimensionBreakdown
                v-for="dim in availableDimensionBreakdowns"
                :key="dim.dimension"
                :dimension="dim"
            />
        </div>

        <!-- ── Tab 2: ready-made AI marketing analysis (always mounted) ── -->
        <AICampaignAnalysis
            v-if="props.projectId"
            v-show="activeSectionTab === 'ai-analysis'"
            :project-id="props.projectId"
            :campaign-id="props.campaignId"
            :campaign-name="props.campaignName"
            :channel="displayChannel"
            :start-date="props.startDate"
            :end-date="props.endDate"
            :source-table="props.sourceTable"
            :campaign-column="props.campaignColumn"
        />
    </div>
</template>