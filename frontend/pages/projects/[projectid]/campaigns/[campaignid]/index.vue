<script setup lang="ts">
import { useCampaignsStore } from '@/stores/campaigns';
import { useDataSourceStore } from '@/stores/data_sources';
import { useAttributionStore } from '@/stores/attribution';
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_STATUSES } from '~/types/ICampaign';
import type { ICampaign, ICampaignChannel, IOfflineDataEntry, IOfflineCampaignSummary, IAddChannelPayload, IDigitalChannelMetrics, IAvailablePlatformCampaign } from '~/types/ICampaign';
import type { AttributionModel, IConversionFunnel } from '@/stores/attribution';

const OFFLINE_CHANNEL_TYPES: { value: string; label: string }[] = [
    { value: 'events', label: 'Events' },
    { value: 'print', label: 'Print' },
    { value: 'out_of_home', label: 'Out of Home' },
    { value: 'direct_mail', label: 'Direct Mail' },
    { value: 'tv', label: 'TV' },
    { value: 'radio', label: 'Radio' },
    { value: 'pr', label: 'PR' },
    { value: 'sponsorship', label: 'Sponsorship' },
    { value: 'other', label: 'Other' },
];

const DIGITAL_CHANNEL_TYPES: { value: string; label: string }[] = [
    { value: 'google_ads', label: 'Google Ads' },
    { value: 'meta_ads', label: 'Meta Ads' },
    { value: 'linkedin_ads', label: 'LinkedIn Ads' },
    { value: 'tiktok_ads', label: 'TikTok Ads' },
    { value: 'google_analytics', label: 'Google Analytics' },
    { value: 'google_ad_manager', label: 'Google Ad Manager' },
];

definePageMeta({ layout: 'project' });

const route = useRoute();
const router = useRouter();
const campaignStore = useCampaignsStore();
const dataSourceStore = useDataSourceStore();
const attributionStore = useAttributionStore();

const projectId = computed(() => parseInt(String(route.params.projectid)));
const campaignId = computed(() => parseInt(String(route.params.campaignid)));

type TabId = 'summary' | 'digital' | 'offline' | 'attribution' | 'ai_analysis';

const tabs: { id: TabId; label: string; icon: string[] }[] = [
    { id: 'summary', label: 'Summary', icon: ['fas', 'chart-pie'] },
    { id: 'digital', label: 'Digital', icon: ['fas', 'globe'] },
    { id: 'offline', label: 'Offline', icon: ['fas', 'store'] },
    { id: 'attribution', label: 'Attribution', icon: ['fas', 'diagram-project'] },
    { id: 'ai_analysis', label: 'AI Analysis', icon: ['fas', 'robot'] },
];

const activeTab = ref<TabId>('summary');
const loading = ref(false);
const statusUpdating = ref(false);
const statusDropdownOpen = ref(false);
const campaign = ref<ICampaign | null>(null);

// Channel management state
const showAddChannelPanel = ref(false);
const newChannelType = ref('');
const newChannelName = ref('');
const newChannelDataSourceId = ref<number | null>(null);
const addChannelSaving = ref(false);
const addChannelError = ref('');
const deleteConfirmChannelId = ref<number | null>(null);
const channelRemoving = ref<number | null>(null);

// Digital spend (computed from channel metrics)
const digitalSpend = computed(() => digitalMetrics.value.reduce((s, m) => s + (m.spend ?? 0), 0));

// Digital tab state
const digitalMetrics = ref<IDigitalChannelMetrics[]>([]);
const digitalMetricsLoading = ref(false);
const digitalDateStart = ref('');
const digitalDateEnd = ref('');
// Per-channel campaign-linking flow
const linkingChannelId = ref<number | null>(null);
const availableCampaigns = ref<IAvailablePlatformCampaign[]>([]);
const availableCampaignsLoading = ref(false);
const availableCampaignsChannelInfo = ref<string | undefined>(undefined);
const selectedLinkCampaignId = ref('');
const linkSaving = ref(false);

// Offline tab state
const offlineSummary = ref<IOfflineCampaignSummary | null>(null);
const offlineEntries = ref<Record<number, IOfflineDataEntry[]>>({});
const offlineEntriesLoading = ref<Record<number, boolean>>({});
const showEntryModal = ref(false);
const entryModalChannelId = ref<number | null>(null);
const entryModalChannelName = ref('');
const entryModalEditEntry = ref<IOfflineDataEntry | null>(null);
const deleteConfirmEntryId = ref<number | null>(null);

function getObjectiveLabel(value: string): string {
    return CAMPAIGN_OBJECTIVES.find((o) => o.value === value)?.label ?? value;
}

function statusClasses(status: string): string {
    const map: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-700',
        active: 'bg-green-100 text-green-700',
        paused: 'bg-yellow-100 text-yellow-700',
        completed: 'bg-blue-100 text-blue-700',
        archived: 'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-700';
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(val: number | null | undefined): string {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(val));
}

function formatCPL(spend: number, leads: number): string {
    if (leads === 0) return '—';
    return formatCurrency(spend / leads);
}

function formatNumber(val: number | null | undefined): string {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-US').format(Number(val));
}

function channelTypeLabel(type: string): string {
    const map: Record<string, string> = {
        events: 'Events', print: 'Print', out_of_home: 'Out of Home',
        direct_mail: 'Direct Mail', tv: 'TV', radio: 'Radio',
        pr: 'PR', sponsorship: 'Sponsorship', other: 'Other',
    };
    return map[type] ?? type;
}

const offlineChannels = computed((): ICampaignChannel[] => {
    return (campaign.value?.channels ?? []).filter((ch) => ch.is_offline);
});

const digitalChannels = computed((): ICampaignChannel[] => {
    return (campaign.value?.channels ?? []).filter((ch) => !ch.is_offline);
});

const newChannelIsDigital = computed(() =>
    DIGITAL_CHANNEL_TYPES.some((t) => t.value === newChannelType.value),
);

const filteredDataSourcesForChannel = computed(() => {
    if (!newChannelType.value) return [];
    return dataSourceStore.getDataSources().filter((ds) => ds.data_type === newChannelType.value);
});

// ─── Attribution tab state ────────────────────────────────────────────────────
const attributionStartDate = ref('');
const attributionEndDate = ref('');
const attributionModel = ref<AttributionModel>('linear');
const attributionLoaded = ref(false);
const selectedFunnel = ref<IConversionFunnel | null>(null);
const showCreateFunnel = ref(false);
const isCreatingFunnel = ref(false);
const funnelForm = ref({
    name: '',
    steps: [
        { stepNumber: 1, stepName: '', eventType: 'pageview' },
        { stepNumber: 2, stepName: '', eventType: 'interaction' },
        { stepNumber: 3, stepName: '', eventType: 'conversion' },
    ],
});
const isFunnelFormValid = computed(() =>
    funnelForm.value.name.trim() !== '' && funnelForm.value.steps.every((s) => s.stepName.trim() !== '')
);
type AttributionSubTab = 'channel' | 'funnel' | 'journey' | 'roi' | 'model-comparison';
const attributionSubTab = ref<AttributionSubTab>('roi');

const attributionSubTabs: { id: AttributionSubTab; label: string; icon: string[] }[] = [
    { id: 'roi', label: 'ROI', icon: ['fas', 'dollar-sign'] },
    { id: 'channel', label: 'Channels', icon: ['fas', 'chart-bar'] },
    { id: 'funnel', label: 'Funnel', icon: ['fas', 'filter'] },
    { id: 'journey', label: 'Journeys', icon: ['fas', 'route'] },
    { id: 'model-comparison', label: 'Model Comparison', icon: ['fas', 'diagram-project'] },
];

async function loadAttributionData() {
    if (!campaign.value) return;
    // Use campaign date range as defaults
    attributionStartDate.value = (campaign.value.start_date ?? '').slice(0, 10) ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    attributionEndDate.value = (campaign.value.end_date ?? '').slice(0, 10) ||
        new Date().toISOString().split('T')[0];

    await Promise.allSettled([
        attributionStore.retrieveChannelPerformance(projectId.value, attributionModel.value, attributionStartDate.value, attributionEndDate.value, campaignId.value),
        attributionStore.retrieveROIMetrics(projectId.value, attributionModel.value, attributionStartDate.value, attributionEndDate.value, undefined, campaignId.value),
        attributionStore.retrieveJourneyMap(projectId.value, attributionStartDate.value, attributionEndDate.value, undefined, 20, campaignId.value),
        attributionStore.compareModels(projectId.value, attributionStartDate.value, attributionEndDate.value, campaignId.value),
    ]);
    attributionLoaded.value = true;
}

async function createCampaignFunnel() {
    if (!isFunnelFormValid.value) return;
    isCreatingFunnel.value = true;
    try {
        const result = await attributionStore.analyzeFunnel(
            projectId.value,
            funnelForm.value.name,
            funnelForm.value.steps,
            attributionStartDate.value,
            attributionEndDate.value,
            campaignId.value
        );
        if (result.success && result.data) {
            selectedFunnel.value = result.data;
            showCreateFunnel.value = false;
        }
    } finally {
        isCreatingFunnel.value = false;
    }
}

function addFunnelStep() {
    funnelForm.value.steps.push({ stepNumber: funnelForm.value.steps.length + 1, stepName: '', eventType: 'interaction' });
}

function removeFunnelStep(idx: number) {
    funnelForm.value.steps.splice(idx, 1);
    funnelForm.value.steps.forEach((s, i) => { s.stepNumber = i + 1; });
}

function exportAttributionPDF() {
    if (import.meta.client) {
        window.print();
    }
}

onMounted(async () => {
    loading.value = true;
    try {
        const c = await campaignStore.retrieveCampaignById(campaignId.value);
        campaign.value = c;
        // Init date range defaults
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 30);
        digitalDateStart.value = start.toISOString().split('T')[0];
        digitalDateEnd.value = today.toISOString().split('T')[0];
        await Promise.all([
            loadOfflineSummary(),
            loadDigitalMetrics(),
        ]);
    } finally {
        loading.value = false;
    }
});

async function loadDigitalMetrics() {
    if (digitalMetricsLoading.value) return;
    digitalMetricsLoading.value = true;
    try {
        digitalMetrics.value = await campaignStore.getDigitalChannelMetrics(
            campaignId.value,
            digitalDateStart.value || undefined,
            digitalDateEnd.value || undefined,
        );
    } catch {
        // Non-critical
    } finally {
        digitalMetricsLoading.value = false;
    }
}

async function openLinkPanel(channel: ICampaignChannel) {
    if (linkingChannelId.value === channel.id) {
        linkingChannelId.value = null;
        return;
    }
    linkingChannelId.value = channel.id;
    selectedLinkCampaignId.value = channel.platform_campaign_id ?? '';
    if (!channel.data_source_id) return;
    availableCampaignsLoading.value = true;
    availableCampaigns.value = [];
    availableCampaignsChannelInfo.value = undefined;
    try {
        const result = await campaignStore.getAvailablePlatformCampaigns(channel.data_source_id, channel.channel_type);
        availableCampaigns.value = result.campaigns;
        availableCampaignsChannelInfo.value = result.channelInfo;
    } catch {
        availableCampaigns.value = [];
    } finally {
        availableCampaignsLoading.value = false;
    }
}

async function saveLinkCampaign(channel: ICampaignChannel) {
    if (!selectedLinkCampaignId.value) return;
    const campaign_ = availableCampaigns.value.find((c) => c.id === selectedLinkCampaignId.value);
    if (!campaign_) return;
    linkSaving.value = true;
    try {
        const updated = await campaignStore.updateChannel(campaignId.value, channel.id, {
            platform_campaign_id: campaign_.id,
            platform_campaign_name: campaign_.name,
        });
        if (updated && campaign.value?.channels) {
            const idx = campaign.value.channels.findIndex((c) => c.id === channel.id);
            if (idx !== -1) campaign.value.channels[idx] = updated;
        }
        linkingChannelId.value = null;
        await loadDigitalMetrics();
    } finally {
        linkSaving.value = false;
    }
}

async function unlinkCampaign(channel: ICampaignChannel) {
    linkSaving.value = true;
    try {
        const updated = await campaignStore.updateChannel(campaignId.value, channel.id, {
            platform_campaign_id: null,
            platform_campaign_name: null,
        });
        if (updated && campaign.value?.channels) {
            const idx = campaign.value.channels.findIndex((c) => c.id === channel.id);
            if (idx !== -1) campaign.value.channels[idx] = updated;
        }
        linkingChannelId.value = null;
        await loadDigitalMetrics();
    } finally {
        linkSaving.value = false;
    }
}

watch(campaignStore.campaigns, () => {
    const c = campaignStore.campaigns.find((x) => x.id === campaignId.value) ?? null;
    if (c) campaign.value = c;
});

watch(activeTab, async (tab) => {
    if (tab === 'offline' || tab === 'summary') {
        await loadOfflineSummary();
    }
    if (tab === 'offline') {
        await loadAllOfflineEntries();
    }
    if (tab === 'digital' || tab === 'summary') {
        await loadDigitalMetrics();
    }
    if (tab === 'attribution' && !attributionLoaded.value) {
        await loadAttributionData();
    }
});

async function loadOfflineSummary() {
    if (!campaign.value) return;
    try {
        offlineSummary.value = await campaignStore.retrieveOfflineSummary(campaignId.value);
    } catch {
        // non-critical
    }
}

async function loadAllOfflineEntries() {
    const channels = offlineChannels.value;
    for (const ch of channels) {
        if (!offlineEntries.value[ch.id]) {
            await loadEntriesForChannel(ch.id);
        }
    }
}

async function loadEntriesForChannel(channelId: number) {
    offlineEntriesLoading.value[channelId] = true;
    try {
        offlineEntries.value[channelId] = await campaignStore.retrieveOfflineEntriesForChannel(channelId);
    } finally {
        offlineEntriesLoading.value[channelId] = false;
    }
}

function openAddEntryModal(channel: ICampaignChannel) {
    entryModalChannelId.value = channel.id;
    entryModalChannelName.value = channel.channel_name ?? channelTypeLabel(channel.channel_type);
    entryModalEditEntry.value = null;
    showEntryModal.value = true;
}

function openEditEntryModal(channel: ICampaignChannel, entry: IOfflineDataEntry) {
    entryModalChannelId.value = channel.id;
    entryModalChannelName.value = channel.channel_name ?? channelTypeLabel(channel.channel_type);
    entryModalEditEntry.value = entry;
    showEntryModal.value = true;
}

async function onEntrySaved(entry: IOfflineDataEntry) {
    showEntryModal.value = false;
    const channelId = entry.campaign_channel_id;
    await loadEntriesForChannel(channelId);
    await loadOfflineSummary();
}

async function confirmDeleteEntry(entryId: number, channelId: number) {
    deleteConfirmEntryId.value = null;
    await campaignStore.deleteOfflineEntry(entryId);
    await loadEntriesForChannel(channelId);
    await loadOfflineSummary();
}

function channelEntryTotal(channelId: number): { spend: number; impressions: number; leads: number; pipeline: number } {
    const entries = offlineEntries.value[channelId] ?? [];
    return {
        spend: entries.reduce((s, e) => s + Number(e.actual_spend), 0),
        impressions: entries.reduce((s, e) => s + (Number(e.impressions_estimated) || 0), 0),
        leads: entries.reduce((s, e) => s + (Number(e.leads_generated) || 0), 0),
        pipeline: entries.reduce((s, e) => s + (Number(e.pipeline_value) || 0), 0),
    };
}

// -----------------------------------------------------------------------
// Channel management
// -----------------------------------------------------------------------

const isOfflineType = (type: string) =>
    OFFLINE_CHANNEL_TYPES.some((t) => t.value === type);

function allChannelTypeLabel(type: string): string {
    return (
        OFFLINE_CHANNEL_TYPES.find((t) => t.value === type)?.label ??
        DIGITAL_CHANNEL_TYPES.find((t) => t.value === type)?.label ??
        type
    );
}

async function submitAddChannel() {
    addChannelError.value = '';
    if (!newChannelType.value) {
        addChannelError.value = 'Please select a channel type';
        return;
    }
    addChannelSaving.value = true;
    try {
        const payload: IAddChannelPayload = {
            channel_type: newChannelType.value,
            channel_name: newChannelName.value.trim() || null,
            is_offline: isOfflineType(newChannelType.value),
            data_source_id: newChannelDataSourceId.value ?? null,
        };
        await campaignStore.addChannel(campaignId.value, payload);
        // Refresh campaign to get updated channels list
        const c = await campaignStore.retrieveCampaignById(campaignId.value);
        campaign.value = c;
        newChannelType.value = '';
        newChannelName.value = '';
        newChannelDataSourceId.value = null;
        showAddChannelPanel.value = false;
        await loadOfflineSummary();
    } catch (e: any) {
        addChannelError.value = e?.data?.error ?? e?.message ?? 'Failed to add channel';
    } finally {
        addChannelSaving.value = false;
    }
}

async function confirmRemoveChannel(channelId: number) {
    deleteConfirmChannelId.value = null;
    channelRemoving.value = channelId;
    try {
        await campaignStore.removeChannel(channelId);
        const c = await campaignStore.retrieveCampaignById(campaignId.value);
        campaign.value = c;
        // Clear any cached entries for removed channel
        delete offlineEntries.value[channelId];
        await loadOfflineSummary();
    } finally {
        channelRemoving.value = null;
    }
}

async function setStatus(status: string) {
    statusDropdownOpen.value = false;
    if (!campaign.value || campaign.value.status === status) return;
    statusUpdating.value = true;
    try {
        await campaignStore.updateCampaignStatus(campaignId.value, status);
        if (campaign.value) campaign.value.status = status;
    } finally {
        statusUpdating.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Loading state -->
        <div v-if="loading" class="p-6">
            <div class="animate-pulse space-y-4">
                <div class="h-8 bg-gray-200 rounded w-1/3"></div>
                <div class="h-4 bg-gray-100 rounded w-1/4"></div>
                <div class="h-10 bg-gray-200 rounded w-full mt-4"></div>
            </div>
        </div>

        <!-- Campaign not found -->
        <div v-else-if="!campaign" class="flex flex-col items-center justify-center py-24 text-center">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-4xl text-yellow-400 mb-3" />
            <h2 class="text-lg font-semibold text-gray-700 mb-2">Campaign not found</h2>
            <NuxtLink :to="`/projects/${projectId}/campaigns`" class="text-sm text-primary-blue-100 hover:underline">
                Back to Campaigns
            </NuxtLink>
        </div>

        <template v-else>
            <!-- Campaign header -->
            <div class="bg-white border-b border-gray-200 px-6 py-5">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <!-- Breadcrumb -->
                        <div class="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                            <NuxtLink :to="`/projects/${projectId}/campaigns`" class="hover:text-primary-blue-100">
                                Campaigns
                            </NuxtLink>
                            <font-awesome-icon :icon="['fas', 'chevron-right']" class="text-xs" />
                            <span class="text-gray-600 truncate">{{ campaign.name }}</span>
                        </div>
                        <h1 class="text-xl font-bold text-gray-900 truncate">{{ campaign.name }}</h1>
                        <p v-if="campaign.description" class="text-sm text-gray-500 mt-0.5">{{ campaign.description }}</p>
                    </div>
                    <!-- Status toggle dropdown -->
                    <div class="relative">
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                            :class="statusClasses(campaign.status)"
                            @click="statusDropdownOpen = !statusDropdownOpen"
                        >
                            <font-awesome-icon v-if="statusUpdating" :icon="['fas', 'spinner']" class="animate-spin" />
                            {{ CAMPAIGN_STATUSES.find((s) => s.value === campaign!.status)?.label ?? campaign.status }}
                            <font-awesome-icon :icon="['fas', 'chevron-down']" class="text-xs" />
                        </button>
                        <div
                            v-if="statusDropdownOpen"
                            class="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1"
                        >
                            <button
                                v-for="s in CAMPAIGN_STATUSES"
                                :key="s.value"
                                type="button"
                                class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                                :class="campaign.status === s.value ? 'font-medium text-primary-blue-100' : 'text-gray-700'"
                                @click="setStatus(s.value)"
                            >
                                {{ s.label }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sub-tab navigation -->
            <div class="bg-white border-b border-gray-200 px-6">
                <nav class="flex gap-1" aria-label="Campaign tabs">
                    <button
                        v-for="tab in tabs"
                        :key="tab.id"
                        type="button"
                        class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                        :class="
                            activeTab === tab.id
                                ? 'border-primary-blue-100 text-primary-blue-100'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        "
                        @click="activeTab = tab.id"
                    >
                        <font-awesome-icon :icon="tab.icon" class="text-xs" />
                        {{ tab.label }}
                    </button>
                </nav>
            </div>

            <!-- Tab content -->
            <div class="p-6">

                <!-- ======================== SUMMARY TAB ===================== -->
                <div v-if="activeTab === 'summary'" class="space-y-6">
                    <!-- Metadata cards -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <!-- Budget -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Budget</p>
                            <p class="text-xl font-bold text-gray-900">{{ formatCurrency(campaign.budget_total) }}</p>
                        </div>
                        <!-- Dates -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Start Date</p>
                            <p class="text-base font-semibold text-gray-900">{{ formatDate(campaign.start_date) }}</p>
                        </div>
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">End Date</p>
                            <p class="text-base font-semibold text-gray-900">{{ formatDate(campaign.end_date) }}</p>
                        </div>
                        <!-- Objective -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Objective</p>
                            <p class="text-base font-semibold text-gray-900">{{ getObjectiveLabel(campaign.objective) }}</p>
                        </div>
                    </div>

                    <!-- Targets row -->
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Target Leads</p>
                            <p class="text-lg font-bold text-gray-900">{{ campaign.target_leads ?? '—' }}</p>
                        </div>
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Target CPL</p>
                            <p class="text-lg font-bold text-gray-900">{{ formatCurrency(campaign.target_cpl) }}</p>
                        </div>
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Target ROAS</p>
                            <p class="text-lg font-bold text-gray-900">
                                {{ campaign.target_roas !== null && campaign.target_roas !== undefined ? `${campaign.target_roas}x` : '—' }}
                            </p>
                        </div>
                    </div>

                    <!-- KPI placeholder cards -->
                    <div>
                        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Performance KPIs</h2>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Spend</p>
                                <p class="text-xl font-bold text-gray-300">—</p>
                                <p class="text-xs text-gray-300 mt-1">Available in Issue 06</p>
                            </div>
                            <div class="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Leads</p>
                                <p class="text-xl font-bold text-gray-300">—</p>
                                <p class="text-xs text-gray-300 mt-1">Available in Issue 06</p>
                            </div>
                            <div class="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">CPL</p>
                                <p class="text-xl font-bold text-gray-300">—</p>
                                <p class="text-xs text-gray-300 mt-1">Available in Issue 06</p>
                            </div>
                            <div class="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">ROAS</p>
                                <p class="text-xl font-bold text-gray-300">—</p>
                                <p class="text-xs text-gray-300 mt-1">Available in Issue 06</p>
                            </div>
                        </div>
                    </div>

                    <!-- Offline KPI cards -->
                    <div v-if="offlineSummary">
                        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Offline Performance</h2>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div class="bg-white rounded-xl border border-gray-200 p-4">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Offline Spend</p>
                                <p class="text-xl font-bold text-gray-900">{{ formatCurrency(offlineSummary.total_spend) }}</p>
                            </div>
                            <div class="bg-white rounded-xl border border-gray-200 p-4">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Offline Leads</p>
                                <p class="text-xl font-bold text-gray-900">{{ formatNumber(offlineSummary.total_leads) }}</p>
                            </div>
                            <div class="bg-white rounded-xl border border-gray-200 p-4">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Offline CPL</p>
                                <p class="text-xl font-bold text-gray-900">
                                    {{ offlineSummary.offline_cpl !== null ? formatCurrency(offlineSummary.offline_cpl) : '—' }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Budget vs Spend chart -->
                    <BudgetComparisonChart
                        :budget-total="campaign.budget_total"
                        :digital-spend="digitalSpend"
                        :offline-spend="offlineSummary?.total_spend ?? 0"
                    />

                    <!-- Digital channel spend breakdown -->
                    <div v-if="digitalMetrics.length > 0" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div class="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'globe']" class="text-blue-400 text-sm" />
                            <h2 class="text-sm font-semibold text-gray-700">Digital Channel Breakdown</h2>
                        </div>
                        <div class="divide-y divide-gray-100">
                            <div
                                v-for="m in digitalMetrics"
                                :key="m.channelId"
                                class="flex items-center justify-between px-5 py-3 text-sm"
                            >
                                <div class="flex items-center gap-2 min-w-0">
                                    <span class="text-gray-700 font-medium truncate">
                                        {{ allChannelTypeLabel(m.channelType) }}
                                    </span>
                                    <span v-if="m.platformCampaignName" class="text-xs text-green-600 bg-green-50 rounded-full px-2 py-0.5 truncate max-w-[150px]" :title="m.platformCampaignName">
                                        {{ m.platformCampaignName }}
                                    </span>
                                </div>
                                <div class="flex items-center gap-4 shrink-0 ml-4 text-xs text-gray-500">
                                    <span><span class="font-semibold text-gray-800">{{ formatCurrency(m.spend) }}</span> spend</span>
                                    <span v-if="m.clicks"><span class="font-semibold text-gray-800">{{ formatNumber(m.clicks) }}</span> clicks</span>
                                    <span v-if="m.conversions"><span class="font-semibold text-gray-800">{{ formatNumber(m.conversions) }}</span> conv.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Channels panel -->
                    <div class="bg-white rounded-xl border border-gray-200">
                        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                            <h2 class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <font-awesome-icon :icon="['fas', 'layer-group']" class="text-gray-400" />
                                Channels
                                <span class="text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                                    {{ campaign.channels?.length ?? 0 }}
                                </span>
                            </h2>
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-blue-100 text-white text-xs font-medium rounded-lg hover:bg-primary-blue-200 transition-colors cursor-pointer"
                                @click="showAddChannelPanel = !showAddChannelPanel; addChannelError = ''"
                            >
                                <font-awesome-icon :icon="['fas', 'plus']" />
                                Add Channel
                            </button>
                        </div>

                        <!-- Inline add channel form -->
                        <div v-if="showAddChannelPanel" class="px-5 py-4 bg-blue-50 border-b border-blue-100">
                            <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">New Channel</p>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">
                                        Channel Type <span class="text-red-500">*</span>
                                    </label>
                                    <select
                                        v-model="newChannelType"
                                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
                                        @change="newChannelDataSourceId = null"
                                    >
                                        <option value="" disabled>Select type…</option>
                                        <optgroup label="Offline Channels">
                                            <option v-for="t in OFFLINE_CHANNEL_TYPES" :key="t.value" :value="t.value">
                                                {{ t.label }}
                                            </option>
                                        </optgroup>
                                        <optgroup label="Digital Channels">
                                            <option v-for="t in DIGITAL_CHANNEL_TYPES" :key="t.value" :value="t.value">
                                                {{ t.label }}
                                            </option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">Display Name (optional)</label>
                                    <input
                                        v-model="newChannelName"
                                        type="text"
                                        placeholder="e.g. TV Q1, Spring Fair…"
                                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
                                    />
                                </div>
                                <!-- Data source selector for digital channels -->
                                <div v-if="newChannelIsDigital" class="sm:col-span-2">
                                    <label class="block text-xs font-medium text-gray-600 mb-1">Linked Data Source (optional)</label>
                                    <select
                                        v-model="newChannelDataSourceId"
                                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
                                    >
                                        <option :value="null">— None (link later) —</option>
                                        <option
                                            v-for="ds in filteredDataSourcesForChannel"
                                            :key="ds.id"
                                            :value="ds.id"
                                        >
                                            {{ ds.name }}
                                        </option>
                                    </select>
                                    <p v-if="filteredDataSourcesForChannel.length === 0" class="mt-1 text-xs text-gray-400">
                                        No connected {{ newChannelType.replace('_', ' ') }} data sources found.
                                        <NuxtLink :to="`/projects/${projectId}/data-sources`" class="text-primary-blue-100 hover:underline">Connect one first.</NuxtLink>
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 mt-3">
                                <button
                                    type="button"
                                    :disabled="addChannelSaving"
                                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-blue-100 text-white text-sm font-medium rounded-lg hover:bg-primary-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    @click="submitAddChannel"
                                >
                                    <font-awesome-icon v-if="addChannelSaving" :icon="['fas', 'spinner']" class="animate-spin" />
                                    {{ addChannelSaving ? 'Saving…' : 'Save' }}
                                </button>
                                <button
                                    type="button"
                                    class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                                    @click="showAddChannelPanel = false; addChannelError = ''"
                                >
                                    Cancel
                                </button>
                            </div>
                            <p v-if="addChannelError" class="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
                                {{ addChannelError }}
                            </p>
                        </div>

                        <!-- Channels list -->
                        <div v-if="!campaign.channels || campaign.channels.length === 0" class="px-5 py-8 text-center text-sm text-gray-400">
                            No channels yet — click "Add Channel" to attach data sources to this campaign.
                        </div>
                        <ul v-else class="divide-y divide-gray-100">
                            <li
                                v-for="ch in campaign.channels"
                                :key="ch.id"
                                class="flex items-center justify-between px-5 py-3"
                            >
                                <div class="flex items-center gap-2 min-w-0">
                                    <span
                                        class="text-xs font-medium px-2 py-0.5 rounded-full"
                                        :class="ch.is_offline ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'"
                                    >
                                        {{ ch.is_offline ? 'Offline' : 'Digital' }}
                                    </span>
                                    <span class="text-sm text-gray-800 truncate">
                                        {{ ch.channel_name ?? allChannelTypeLabel(ch.channel_type) }}
                                    </span>
                                    <span v-if="ch.channel_name" class="text-xs text-gray-400">
                                        ({{ allChannelTypeLabel(ch.channel_type) }})
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 shrink-0 ml-4">
                                    <font-awesome-icon
                                        v-if="channelRemoving === ch.id"
                                        :icon="['fas', 'spinner']"
                                        class="animate-spin text-gray-400 text-xs"
                                    />
                                    <template v-else-if="deleteConfirmChannelId === ch.id">
                                        <button
                                            type="button"
                                            class="text-xs text-red-600 font-medium hover:text-red-800 transition-colors cursor-pointer"
                                            @click="confirmRemoveChannel(ch.id)"
                                        >
                                            Confirm remove
                                        </button>
                                        <button
                                            type="button"
                                            class="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                            @click="deleteConfirmChannelId = null"
                                        >
                                            Cancel
                                        </button>
                                    </template>
                                    <button
                                        v-else
                                        type="button"
                                        class="text-gray-300 hover:text-red-500 transition-colors text-xs cursor-pointer"
                                        title="Remove channel"
                                        @click="deleteConfirmChannelId = ch.id"
                                    >
                                        <font-awesome-icon :icon="['fas', 'trash']" />
                                    </button>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- ======================== DIGITAL TAB ==================== -->
                <div v-else-if="activeTab === 'digital'" class="space-y-5">
                    <!-- Date range controls -->
                    <div class="flex flex-wrap items-center gap-3">
                        <div class="flex items-center gap-2 text-xs text-gray-500">
                            <label class="font-medium">From</label>
                            <input
                                v-model="digitalDateStart"
                                type="date"
                                class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
                                @change="loadDigitalMetrics"
                            />
                            <label class="font-medium">To</label>
                            <input
                                v-model="digitalDateEnd"
                                type="date"
                                class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
                                @change="loadDigitalMetrics"
                            />
                        </div>
                        <button
                            type="button"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-blue-100 border border-primary-blue-100 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                            :disabled="digitalMetricsLoading"
                            @click="loadDigitalMetrics"
                        >
                            <font-awesome-icon :icon="['fas', digitalMetricsLoading ? 'spinner' : 'arrows-rotate']" :class="{ 'animate-spin': digitalMetricsLoading }" />
                            Refresh
                        </button>
                    </div>

                    <!-- No digital channels empty state -->
                    <div v-if="digitalChannels.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
                        <font-awesome-icon :icon="['fas', 'globe']" class="text-5xl text-gray-300 mb-4" />
                        <h2 class="text-lg font-semibold text-gray-700 mb-2">No Digital Channels</h2>
                        <p class="text-sm text-gray-400 max-w-sm mb-4">
                            Add digital channels (Google Ads, Meta Ads, etc.) from the Summary tab to start tracking performance.
                        </p>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-100 text-white text-sm font-medium rounded-lg hover:bg-primary-blue-200 transition-colors"
                            @click="activeTab = 'summary'"
                        >
                            <font-awesome-icon :icon="['fas', 'arrow-left']" />
                            Go to Summary to add channels
                        </button>
                    </div>

                    <!-- Per-channel cards -->
                    <template v-else>
                        <div
                            v-for="channel in digitalChannels"
                            :key="channel.id"
                            class="bg-white rounded-xl border border-gray-200 overflow-hidden"
                        >
                            <!-- Channel header -->
                            <div class="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
                                <div class="flex items-center gap-3 min-w-0">
                                    <font-awesome-icon :icon="['fas', 'globe']" class="text-blue-400 text-sm shrink-0" />
                                    <div class="min-w-0">
                                        <p class="text-sm font-semibold text-gray-800 truncate">
                                            {{ channel.channel_name ?? allChannelTypeLabel(channel.channel_type) }}
                                        </p>
                                        <p v-if="channel.channel_name" class="text-xs text-gray-400">
                                            {{ allChannelTypeLabel(channel.channel_type) }}
                                        </p>
                                    </div>
                                    <!-- Linked campaign badge -->
                                    <span v-if="channel.platform_campaign_name" class="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 font-medium truncate max-w-[200px]" :title="channel.platform_campaign_name">
                                        <font-awesome-icon :icon="['fas', 'link']" class="mr-1" />
                                        {{ channel.platform_campaign_name }}
                                    </span>
                                    <span v-else class="text-xs bg-gray-100 text-gray-500 rounded-full px-2.5 py-0.5">
                                        Account-level
                                    </span>
                                </div>
                                <!-- Link / Unlink actions -->
                                <div class="flex items-center gap-2 shrink-0 ml-4">
                                    <button
                                        v-if="channel.platform_campaign_name"
                                        type="button"
                                        class="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                                        title="Unlink campaign"
                                        :disabled="linkSaving"
                                        @click="unlinkCampaign(channel)"
                                    >
                                        <font-awesome-icon :icon="['fas', 'link-slash']" />
                                    </button>
                                    <button
                                        v-if="channel.data_source_id && channel.channel_type !== 'tiktok_ads' && channel.channel_type !== 'google_analytics'"
                                        type="button"
                                        class="inline-flex items-center gap-1 text-xs text-primary-blue-100 hover:underline cursor-pointer"
                                        @click="openLinkPanel(channel)"
                                    >
                                        <font-awesome-icon :icon="['fas', linkingChannelId === channel.id ? 'chevron-up' : 'link']" class="text-xs" />
                                        {{ linkingChannelId === channel.id ? 'Close' : (channel.platform_campaign_id ? 'Change' : 'Link Campaign') }}
                                    </button>
                                </div>
                            </div>

                            <!-- TikTok informational callout -->
                            <div v-if="channel.channel_type === 'tiktok_ads'" class="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
                                <font-awesome-icon :icon="['fas', 'circle-info']" class="text-amber-400 mt-0.5 shrink-0" />
                                <div>
                                    <p class="text-sm font-medium text-amber-800">TikTok Ads — Not Yet Integrated</p>
                                    <p class="text-xs text-amber-700 mt-0.5">Automatic data sync for TikTok Ads is not yet available. Metrics below require manual offline data entry.</p>
                                </div>
                            </div>

                            <!-- Google Analytics informational callout -->
                            <div v-else-if="channel.channel_type === 'google_analytics'" class="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-start gap-3">
                                <font-awesome-icon :icon="['fas', 'circle-info']" class="text-blue-400 mt-0.5 shrink-0" />
                                <div>
                                    <p class="text-sm font-medium text-blue-800">Google Analytics — Session &amp; Goal Data</p>
                                    <p class="text-xs text-blue-700 mt-0.5">Google Analytics does not expose campaign spend or CPL. Session and conversion data is shown where available.</p>
                                </div>
                            </div>

                            <!-- Link campaign panel -->
                            <div v-if="linkingChannelId === channel.id" class="px-5 py-4 bg-indigo-50 border-b border-indigo-100">
                                <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Select a Campaign to Link</p>
                                <div v-if="availableCampaignsLoading" class="text-sm text-gray-500 flex items-center gap-2 py-2">
                                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin" />
                                    Loading campaigns…
                                </div>
                                <div v-else-if="availableCampaignsChannelInfo === 'not_integrated'" class="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                                    This channel type is not yet integrated for campaign-level filtering.
                                </div>
                                <div v-else-if="availableCampaignsChannelInfo === 'no_campaign_entities'" class="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                                    No campaign entities available for this source type.
                                </div>
                                <div v-else-if="!channel.data_source_id" class="text-sm text-gray-500">
                                    No data source linked to this channel. Edit the channel to connect a data source first.
                                </div>
                                <template v-else>
                                    <div v-if="availableCampaigns.length === 0" class="text-sm text-gray-500 py-2">
                                        No campaigns found in the connected data source.
                                    </div>
                                    <div v-else class="flex items-center gap-3">
                                        <select
                                            v-model="selectedLinkCampaignId"
                                            class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
                                        >
                                            <option value="" disabled>Select a campaign…</option>
                                            <option v-for="c in availableCampaigns" :key="c.id" :value="c.id">
                                                {{ c.name }}{{ c.status ? ` (${c.status})` : '' }}
                                            </option>
                                        </select>
                                        <button
                                            type="button"
                                            :disabled="!selectedLinkCampaignId || linkSaving"
                                            class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-blue-100 text-white text-sm font-medium rounded-lg hover:bg-primary-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                            @click="saveLinkCampaign(channel)"
                                        >
                                            <font-awesome-icon v-if="linkSaving" :icon="['fas', 'spinner']" class="animate-spin" />
                                            {{ linkSaving ? 'Saving…' : 'Link' }}
                                        </button>
                                    </div>
                                </template>
                            </div>

                            <!-- Metrics row -->
                            <div class="px-5 py-4">
                                <div v-if="digitalMetricsLoading" class="text-center text-sm text-gray-400 py-4">
                                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                    Loading metrics…
                                </div>
                                <template v-else>
                                    <!-- Find metrics for this channel -->
                                    <template v-if="digitalMetrics.find((m) => m.channelId === channel.id)">
                                        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                                            <div
                                                v-for="(metric, mKey) in (() => {
                                                    const m = digitalMetrics.find((m) => m.channelId === channel.id)!;
                                                    return [
                                                        { label: 'Spend', value: formatCurrency(m.spend) },
                                                        { label: 'Impressions', value: formatNumber(m.impressions) },
                                                        { label: 'Clicks', value: formatNumber(m.clicks) },
                                                        { label: 'CTR', value: m.ctr !== null ? (m.ctr * 100).toFixed(2) + '%' : '—' },
                                                        { label: 'CPC', value: formatCurrency(m.cpc) },
                                                        { label: 'Conversions', value: formatNumber(m.conversions) },
                                                        { label: 'CPL', value: formatCurrency(m.cpl) },
                                                    ];
                                                })()"
                                                :key="mKey"
                                                class="bg-gray-50 rounded-lg p-3 text-center"
                                            >
                                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">{{ metric.label }}</p>
                                                <p class="text-sm font-bold text-gray-800">{{ metric.value }}</p>
                                            </div>
                                        </div>
                                    </template>
                                    <div v-else class="text-center text-sm text-gray-400 py-4">
                                        No metrics data for this period.
                                        <span v-if="!channel.data_source_id" class="block text-xs mt-1">Link a data source to this channel to see metrics.</span>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- ======================== OFFLINE TAB ==================== -->
                <div v-else-if="activeTab === 'offline'" class="space-y-6">
                    <!-- Empty state: no offline channels -->
                    <div v-if="offlineChannels.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
                        <font-awesome-icon :icon="['fas', 'store']" class="text-5xl text-gray-300 mb-4" />
                        <h2 class="text-lg font-semibold text-gray-700 mb-2">No Offline Channels</h2>
                        <p class="text-sm text-gray-400 max-w-sm mb-4">
                            Add offline channels (TV, Events, Print, etc.) in the campaign settings to start tracking spend and leads.
                        </p>
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-100 text-white text-sm font-medium rounded-lg hover:bg-primary-blue-200 transition-colors"
                            @click="activeTab = 'summary'"
                        >
                            <font-awesome-icon :icon="['fas', 'arrow-left']" />
                            Go to Summary to add channels
                        </button>
                    </div>

                    <!-- Per-channel sections -->
                    <template v-else>
                        <div
                            v-for="channel in offlineChannels"
                            :key="channel.id"
                            class="bg-white rounded-xl border border-gray-200 overflow-hidden"
                        >
                            <!-- Channel header -->
                            <div class="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
                                <div class="flex items-center gap-2">
                                    <font-awesome-icon :icon="['fas', 'store']" class="text-orange-400 text-sm" />
                                    <span class="text-sm font-semibold text-gray-800">
                                        {{ channel.channel_name ?? channelTypeLabel(channel.channel_type) }}
                                    </span>
                                    <span class="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                                        {{ channelTypeLabel(channel.channel_type) }}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-blue-100 text-white text-xs font-medium rounded-lg hover:bg-primary-blue-200 transition-colors cursor-pointer"
                                    @click="openAddEntryModal(channel)"
                                >
                                    <font-awesome-icon :icon="['fas', 'plus']" />
                                    Add Entry
                                </button>
                            </div>

                            <!-- Loading -->
                            <div v-if="offlineEntriesLoading[channel.id]" class="px-5 py-8 text-center text-sm text-gray-400">
                                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                Loading entries...
                            </div>

                            <!-- Empty entries -->
                            <div
                                v-else-if="!offlineEntries[channel.id] || offlineEntries[channel.id].length === 0"
                                class="px-5 py-8 text-center text-sm text-gray-400"
                            >
                                No entries yet — click "Add Entry" to record spend and leads for this channel.
                            </div>

                            <!-- Entries table -->
                            <template v-else>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <thead>
                                            <tr class="border-b border-gray-100">
                                                <th class="text-left text-xs font-medium text-gray-400 px-5 py-2.5 uppercase tracking-wide">Date</th>
                                                <th class="text-right text-xs font-medium text-gray-400 px-5 py-2.5 uppercase tracking-wide">Spend</th>
                                                <th class="text-right text-xs font-medium text-gray-400 px-5 py-2.5 uppercase tracking-wide">Impressions</th>
                                                <th class="text-right text-xs font-medium text-gray-400 px-5 py-2.5 uppercase tracking-wide">Leads</th>
                                                <th class="text-right text-xs font-medium text-gray-400 px-5 py-2.5 uppercase tracking-wide">CPL</th>
                                                <th class="text-right text-xs font-medium text-gray-400 px-5 py-2.5 uppercase tracking-wide">Pipeline</th>
                                                <th class="px-5 py-2.5"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr
                                                v-for="entry in offlineEntries[channel.id]"
                                                :key="entry.id"
                                                class="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                            >
                                                <td class="px-5 py-3 text-gray-700">{{ entry.entry_date.slice(0, 10) }}</td>
                                                <td class="px-5 py-3 text-right text-gray-900 font-medium">{{ formatCurrency(entry.actual_spend) }}</td>
                                                <td class="px-5 py-3 text-right text-gray-600">{{ formatNumber(entry.impressions_estimated) }}</td>
                                                <td class="px-5 py-3 text-right text-gray-600">{{ formatNumber(entry.leads_generated) }}</td>
                                                <td class="px-5 py-3 text-right text-gray-600">
                                                    {{ formatCPL(Number(entry.actual_spend), Number(entry.leads_generated) || 0) }}
                                                </td>
                                                <td class="px-5 py-3 text-right text-gray-600">{{ formatCurrency(entry.pipeline_value) }}</td>
                                                <td class="px-5 py-3 text-right">
                                                    <div class="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            class="text-gray-400 hover:text-primary-blue-100 transition-colors text-xs cursor-pointer"
                                                            :title="'Edit entry'"
                                                            @click="openEditEntryModal(channel, entry)"
                                                        >
                                                            <font-awesome-icon :icon="['fas', 'pen']" />
                                                        </button>
                                                        <button
                                                            v-if="deleteConfirmEntryId !== entry.id"
                                                            type="button"
                                                            class="text-gray-400 hover:text-red-500 transition-colors text-xs"
                                                            :title="'Delete entry'"
                                                            @click="deleteConfirmEntryId = entry.id"
                                                        >
                                                            <font-awesome-icon :icon="['fas', 'trash']" />
                                                        </button>
                                                        <template v-else>
                                                            <button
                                                                type="button"
                                                                class="text-xs text-red-600 font-medium hover:text-red-800 transition-colors"
                                                                @click="confirmDeleteEntry(entry.id, channel.id)"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                type="button"
                                                                class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                                                @click="deleteConfirmEntryId = null"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </template>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                        <!-- Totals row -->
                                        <tfoot>
                                            <tr class="bg-gray-50 border-t border-gray-200">
                                                <td class="px-5 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</td>
                                                <td class="px-5 py-2.5 text-right text-sm font-bold text-gray-900">
                                                    {{ formatCurrency(channelEntryTotal(channel.id).spend) }}
                                                </td>
                                                <td class="px-5 py-2.5 text-right text-sm font-semibold text-gray-700">
                                                    {{ formatNumber(channelEntryTotal(channel.id).impressions) }}
                                                </td>
                                                <td class="px-5 py-2.5 text-right text-sm font-semibold text-gray-700">
                                                    {{ formatNumber(channelEntryTotal(channel.id).leads) }}
                                                </td>
                                                <td class="px-5 py-2.5 text-right text-sm font-semibold text-gray-700">
                                                    {{ formatCPL(channelEntryTotal(channel.id).spend, channelEntryTotal(channel.id).leads) }}
                                                </td>
                                                <td class="px-5 py-2.5 text-right text-sm font-semibold text-gray-700">
                                                    {{ formatCurrency(channelEntryTotal(channel.id).pipeline) }}
                                                </td>
                                                <td class="px-5 py-2.5"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </template>
                        </div>
                    </template>

                    <!-- Entry modal -->
                    <OfflineDataEntryModal
                        v-if="showEntryModal && entryModalChannelId !== null"
                        :channel-id="entryModalChannelId"
                        :channel-name="entryModalChannelName"
                        :campaign-start-date="campaign?.start_date ?? null"
                        :campaign-end-date="campaign?.end_date ?? null"
                        :edit-entry="entryModalEditEntry"
                        @saved="onEntrySaved"
                        @close="showEntryModal = false"
                    />
                </div>

                <!-- ======================== ATTRIBUTION TAB ================ -->
                <div v-else-if="activeTab === 'attribution'" class="space-y-4">
                    <!-- Toolbar -->
                    <div class="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Date range</span>
                            <input v-model="attributionStartDate" type="date" class="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100" @change="loadAttributionData" />
                            <span class="text-gray-400 text-sm">→</span>
                            <input v-model="attributionEndDate" type="date" class="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100" @change="loadAttributionData" />
                            <div class="w-px h-5 bg-gray-200"></div>
                            <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Model</span>
                            <select v-model="attributionModel" class="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100" @change="loadAttributionData">
                                <option value="linear">Linear</option>
                                <option value="first_touch">First Touch</option>
                                <option value="last_touch">Last Touch</option>
                                <option value="time_decay">Time Decay</option>
                                <option value="u_shaped">U-Shaped</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-2">
                            <font-awesome-icon
                                v-if="attributionStore.loading.roi || attributionStore.loading.channelPerformance"
                                :icon="['fas', 'spinner']"
                                class="animate-spin text-primary-blue-100 text-sm"
                            />
                            <button type="button" class="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer" @click="exportAttributionPDF">
                                <font-awesome-icon :icon="['fas', 'file-pdf']" class="text-xs" />
                                PDF
                            </button>
                            <NuxtLink
                                :to="`/projects/${projectId}/marketing/attribution?campaignId=${campaignId}`"
                                class="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-blue-100 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="text-xs" />
                                Full View
                            </NuxtLink>
                        </div>
                    </div>

                    <!-- Campaign filter badge -->
                    <div v-if="campaign" class="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-sm text-blue-700">
                        <font-awesome-icon :icon="['fas', 'bullhorn']" class="text-xs" />
                        Scoped to: <span class="font-semibold ml-1">{{ campaign.name }}</span>
                        <span v-if="campaign.start_date && campaign.end_date" class="text-blue-500 ml-1">
                            ({{ (campaign.start_date ?? '').slice(0, 10) }} → {{ (campaign.end_date ?? '').slice(0, 10) }})
                        </span>
                    </div>

                    <!-- Sub-tab navigation -->
                    <div class="bg-white rounded-xl border border-gray-200">
                        <div class="border-b border-gray-100 px-4">
                            <nav class="flex gap-1">
                                <button
                                    v-for="subTab in attributionSubTabs"
                                    :key="subTab.id"
                                    type="button"
                                    class="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
                                    :class="
                                        attributionSubTab === subTab.id
                                            ? 'border-primary-blue-100 text-primary-blue-100'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    "
                                    @click="attributionSubTab = subTab.id"
                                >
                                    <font-awesome-icon :icon="subTab.icon" class="text-xs" />
                                    {{ subTab.label }}
                                </button>
                            </nav>
                        </div>

                        <div class="p-4">
                            <!-- ROI -->
                            <ROIDashboard
                                v-if="attributionSubTab === 'roi'"
                                :metrics="attributionStore.roiMetrics"
                                :loading="attributionStore.loading.roi"
                            />

                            <!-- Channel Performance -->
                            <channel-performance-overview
                                v-else-if="attributionSubTab === 'channel' && attributionStore.channelPerformance.length > 0"
                                :performance="attributionStore.channelPerformance"
                                :loading="attributionStore.loading.channelPerformance"
                            />
                            <div v-else-if="attributionSubTab === 'channel'" class="py-10 text-center text-gray-400">
                                <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-3xl mb-2 text-gray-300" />
                                <p class="text-sm text-gray-500">No channel performance data for this campaign.</p>
                            </div>

                            <!-- Funnel -->
                            <div v-else-if="attributionSubTab === 'funnel'" class="space-y-4">
                                <div class="flex justify-end">
                                    <button
                                        type="button"
                                        class="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-blue-100 text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                                        @click="showCreateFunnel = true"
                                    >
                                        <font-awesome-icon :icon="['fas', 'plus']" class="text-xs" />
                                        New Funnel
                                    </button>
                                </div>
                                <FunnelChart
                                    v-if="selectedFunnel"
                                    :funnel="selectedFunnel"
                                    :loading="attributionStore.loading.funnels"
                                    v-bind="$attrs as any"
                                />
                                <funnel-list
                                    v-if="attributionStore.funnels.length > 0"
                                    :funnels="attributionStore.funnels"
                                    @select="(f) => { selectedFunnel = f; attributionStore.setSelectedFunnel(f); }"
                                />
                                <div v-else-if="!attributionStore.loading.funnels && !selectedFunnel" class="py-10 text-center text-gray-400">
                                    <font-awesome-icon :icon="['fas', 'filter']" class="text-3xl mb-2 text-gray-300" />
                                    <p class="text-sm text-gray-500">Create a funnel to analyse campaign conversion steps.</p>
                                </div>
                            </div>

                            <!-- Journey Map -->
                            <JourneyMap
                                v-else-if="attributionSubTab === 'journey'"
                                :journeys="attributionStore.customerJourneys"
                                :loading="attributionStore.loading.journeys"
                                :total-journeys="attributionStore.customerJourneys.length"
                            />

                            <!-- Model Comparison -->
                            <ModelComparison
                                v-else-if="attributionSubTab === 'model-comparison'"
                                :data="attributionStore.modelComparison"
                                :active-model="attributionModel"
                                :loading="attributionStore.loading.modelComparison"
                            />
                        </div>
                    </div>

                    <!-- Create Funnel Modal -->
                    <div v-if="showCreateFunnel" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showCreateFunnel = false">
                        <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                            <div class="flex items-center justify-between mb-5">
                                <h3 class="text-lg font-bold text-gray-800">Create Conversion Funnel</h3>
                                <button type="button" class="text-gray-400 hover:text-gray-600 cursor-pointer" @click="showCreateFunnel = false">
                                    <font-awesome-icon :icon="['fas', 'xmark']" />
                                </button>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Funnel Name</label>
                                    <input v-model="funnelForm.name" type="text" placeholder="Campaign Purchase Funnel" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100" />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Funnel Steps</label>
                                    <div class="space-y-2">
                                        <div v-for="(step, idx) in funnelForm.steps" :key="idx" class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                                            <span class="w-5 text-center text-xs font-bold text-gray-500">{{ idx + 1 }}</span>
                                            <input v-model="step.stepName" type="text" placeholder="Step name" class="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-primary-blue-100" />
                                            <select v-model="step.eventType" class="px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-primary-blue-100">
                                                <option value="pageview">Page View</option>
                                                <option value="interaction">Interaction</option>
                                                <option value="conversion">Conversion</option>
                                            </select>
                                            <button v-if="funnelForm.steps.length > 2" type="button" class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer" @click="removeFunnelStep(idx)">
                                                <font-awesome-icon :icon="['fas', 'trash']" class="text-xs" />
                                            </button>
                                        </div>
                                    </div>
                                    <button type="button" class="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-primary-blue-100 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer" @click="addFunnelStep">
                                        <font-awesome-icon :icon="['fas', 'plus']" class="text-xs" />
                                        Add Step
                                    </button>
                                </div>
                            </div>
                            <div class="flex justify-end gap-3 mt-6">
                                <button type="button" class="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer" @click="showCreateFunnel = false">Cancel</button>
                                <button
                                    type="button"
                                    class="px-4 py-2 text-sm bg-primary-blue-100 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                                    :disabled="isCreatingFunnel || !isFunnelFormValid"
                                    @click="createCampaignFunnel"
                                >
                                    <font-awesome-icon v-if="isCreatingFunnel" :icon="['fas', 'spinner']" class="animate-spin" />
                                    {{ isCreatingFunnel ? 'Creating…' : 'Analyse Funnel' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ======================== AI ANALYSIS TAB ================ -->
                <div v-else-if="activeTab === 'ai_analysis'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'robot']" class="text-5xl text-gray-300 mb-4" />
                    <h2 class="text-xl font-semibold text-gray-700 mb-2">AI Analysis</h2>
                    <p class="text-sm text-gray-400 max-w-sm">AI-powered insights. Coming in a future update. (Issue 12)</p>
                </div>

            </div>
        </template>

        <!-- Close dropdown on outside click -->
        <div
            v-if="statusDropdownOpen"
            class="fixed inset-0 z-0"
            @click="statusDropdownOpen = false"
        ></div>
    </div>
</template>
