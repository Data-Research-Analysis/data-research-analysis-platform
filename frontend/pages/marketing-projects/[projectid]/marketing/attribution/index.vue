<script setup lang="ts">
import { useAttributionStore } from '@/stores/attribution';
import { useCampaignsStore } from '@/stores/campaigns';
import { useDataSourceStore } from '@/stores/data_sources';
import type { AttributionModel, IConversionFunnel } from '@/stores/attribution';

definePageMeta({ layout: 'marketing-project' });

const route = useRoute();
const router = useRouter();
const attributionStore = useAttributionStore();
const campaignsStore = useCampaignsStore();
const dataSourcesStore = useDataSourceStore();

const projectId = computed(() => parseInt(String(route.params.projectid)));
const campaignId = computed(() => {
    const qc = route.query.campaignId;
    return qc ? parseInt(String(qc)) : undefined;
});

// ─── Campaign context ─────────────────────────────────────────────────────────
const campaign = computed(() => {
    if (!campaignId.value) return null;
    return campaignsStore.campaigns.find((c) => c.id === campaignId.value) ?? null;
});

function formatDate(d: string | null | undefined): string {
    if (!d) return '';
    return d.slice(0, 10);
}

// ─── Date range ──────────────────────────────────────────────────────────────
const defaultStart = computed(() => {
    if (campaign.value?.start_date) return formatDate(campaign.value.start_date);
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
});
const defaultEnd = computed(() => {
    if (campaign.value?.end_date) return formatDate(campaign.value.end_date);
    return new Date().toISOString().split('T')[0];
});

const startDate = ref(defaultStart.value);
const endDate = ref(defaultEnd.value);
const selectedModel = ref<AttributionModel>('linear');

// ─── Tabs ────────────────────────────────────────────────────────────────────
type TabId = 'channel' | 'funnel' | 'journey' | 'roi' | 'model-comparison' | 'reports';

const tabs: { id: TabId; label: string; icon: string[] }[] = [
    { id: 'channel', label: 'Channel Performance', icon: ['fas', 'chart-bar'] },
    { id: 'funnel', label: 'Funnel', icon: ['fas', 'filter'] },
    { id: 'journey', label: 'Journey Map', icon: ['fas', 'route'] },
    { id: 'roi', label: 'ROI', icon: ['fas', 'dollar-sign'] },
    { id: 'model-comparison', label: 'Model Comparison', icon: ['fas', 'diagram-project'] },
    { id: 'reports', label: 'Reports', icon: ['fas', 'file-lines'] },
];

const activeTab = ref<TabId>('channel');

// ─── Loading ─────────────────────────────────────────────────────────────────
const globalLoading = ref(false);

// ─── Store state (reactive refs) ─────────────────────────────────────────────
const channelPerformance = computed(() => attributionStore.channelPerformance);
const roiMetrics = computed(() => attributionStore.roiMetrics);
const funnels = computed(() => attributionStore.funnels);
const customerJourneys = computed(() => attributionStore.customerJourneys);
const reports = computed(() => attributionStore.reports);
const modelComparison = computed(() => attributionStore.modelComparison);
const ga4Sessions = computed(() => attributionStore.ga4Sessions);

// ─── GA4 data source detection ────────────────────────────────────────────────
const hasGA4DataSource = computed(() =>
    dataSourcesStore.getDataSources().some(
        (ds) => ds.data_type === 'google_analytics' && ds.project_id === projectId.value
    )
);

// ─── Selected funnel for FunnelChart ─────────────────────────────────────────
const selectedFunnel = ref<IConversionFunnel | null>(null);

function selectFunnel(f: IConversionFunnel) {
    selectedFunnel.value = f;
    attributionStore.setSelectedFunnel(f);
}

// ─── Fetch all ───────────────────────────────────────────────────────────────
async function fetchAll() {
    const pid = projectId.value;
    const cid = campaignId.value;
    await Promise.allSettled([
        attributionStore.retrieveChannelPerformance(pid, selectedModel.value, startDate.value, endDate.value, cid),
        attributionStore.retrieveROIMetrics(pid, selectedModel.value, startDate.value, endDate.value, undefined, cid),
        attributionStore.retrieveJourneyMap(pid, startDate.value, endDate.value, undefined, 50, cid),
        attributionStore.compareModels(pid, startDate.value, endDate.value, cid),
        attributionStore.retrieveReports(pid),
        attributionStore.retrieveChannels(pid),
        ...(hasGA4DataSource.value
            ? [attributionStore.retrieveGA4Sessions(pid, startDate.value, endDate.value)]
            : []),
    ]);
}

// ─── Date range watcher ──────────────────────────────────────────────────────
watch([startDate, endDate, selectedModel], async () => {
    await fetchAll();
});

// ─── Generate report modal ────────────────────────────────────────────────────
const showGenerateReport = ref(false);
const reportForm = ref({
    name: '',
    model: 'linear' as AttributionModel,
    startDate: '',
    endDate: '',
});
const isGenerating = ref(false);
const generateError = ref('');

const isReportFormValid = computed(() =>
    reportForm.value.name.trim() !== '' &&
    reportForm.value.startDate !== '' &&
    reportForm.value.endDate !== ''
);

function openGenerateReport() {
    reportForm.value.startDate = startDate.value;
    reportForm.value.endDate = endDate.value;
    reportForm.value.model = selectedModel.value;
    reportForm.value.name = '';
    generateError.value = '';
    showGenerateReport.value = true;
}

async function generateReport() {
    if (!isReportFormValid.value) return;
    isGenerating.value = true;
    generateError.value = '';
    try {
        const result = await attributionStore.generateReport(
            projectId.value,
            reportForm.value.name,
            reportForm.value.model,
            reportForm.value.startDate,
            reportForm.value.endDate
        );
        if (result.success) {
            showGenerateReport.value = false;
            activeTab.value = 'reports';
        } else {
            generateError.value = result.error ?? 'Failed to generate report';
        }
    } finally {
        isGenerating.value = false;
    }
}

// ─── Create funnel modal ──────────────────────────────────────────────────────
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
    funnelForm.value.name.trim() !== '' &&
    funnelForm.value.steps.every((s) => s.stepName.trim() !== '')
);

function addFunnelStep() {
    funnelForm.value.steps.push({ stepNumber: funnelForm.value.steps.length + 1, stepName: '', eventType: 'interaction' });
}

function removeFunnelStep(idx: number) {
    funnelForm.value.steps.splice(idx, 1);
    funnelForm.value.steps.forEach((s, i) => { s.stepNumber = i + 1; });
}

async function createFunnel() {
    if (!isFunnelFormValid.value) return;
    isCreatingFunnel.value = true;
    try {
        const result = await attributionStore.analyzeFunnel(
            projectId.value,
            funnelForm.value.name,
            funnelForm.value.steps,
            startDate.value,
            endDate.value,
            campaignId.value
        );
        if (result.success && result.data) {
            selectedFunnel.value = result.data;
            showCreateFunnel.value = false;
            funnelForm.value = { name: '', steps: [
                { stepNumber: 1, stepName: '', eventType: 'pageview' },
                { stepNumber: 2, stepName: '', eventType: 'interaction' },
                { stepNumber: 3, stepName: '', eventType: 'conversion' },
            ]};
        }
    } finally {
        isCreatingFunnel.value = false;
    }
}

// ─── Delete report ────────────────────────────────────────────────────────────
async function deleteReport(reportId: number) {
    if (import.meta.client && confirm('Delete this attribution report?')) {
        await attributionStore.deleteReport(reportId);
    }
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportPDF() {
    if (import.meta.client) {
        window.print();
    }
}

// ─── Remove campaign filter ───────────────────────────────────────────────────
function removeCampaignFilter() {
    router.replace({ query: { ...route.query, campaignId: undefined } });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
    globalLoading.value = true;
    try {
        if (!dataSourcesStore.getDataSources().length) {
            await dataSourcesStore.retrieveDataSources();
        }
        if (campaignId.value) {
            await campaignsStore.retrieveCampaignById(campaignId.value);
        }
        await fetchAll();
    } finally {
        globalLoading.value = false;
    }
});
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <!-- ── Page header ────────────────────────────────────────────────── -->
        <div class="bg-white border-b border-gray-200 px-6 py-5 print:hidden">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-gray-900">Marketing Attribution</h1>
                    <p class="text-sm text-gray-500 mt-0.5">Track, visualise, and compare attribution across channels</p>
                </div>
                <div class="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        class="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                        @click="exportPDF"
                    >
                        <font-awesome-icon :icon="['fas', 'file-pdf']" />
                        Export PDF
                    </button>
                    <button
                        type="button"
                        class="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-blue-100 text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                        @click="openGenerateReport"
                    >
                        <font-awesome-icon :icon="['fas', 'chart-line']" />
                        Generate Report
                    </button>
                </div>
            </div>

            <!-- Campaign filter badge -->
            <div v-if="campaignId && campaign" class="mt-3 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-sm text-blue-700">
                <font-awesome-icon :icon="['fas', 'bullhorn']" class="text-xs" />
                Showing data for: <span class="font-semibold ml-1">{{ campaign.name }}</span>
                <span v-if="campaign.start_date && campaign.end_date" class="text-blue-500 ml-1">
                    ({{ formatDate(campaign.start_date) }} → {{ formatDate(campaign.end_date) }})
                </span>
                <button
                    type="button"
                    class="ml-1 text-blue-400 hover:text-blue-700 transition-colors cursor-pointer"
                    title="Remove campaign filter"
                    @click="removeCampaignFilter"
                >
                    <font-awesome-icon :icon="['fas', 'xmark']" class="text-xs" />
                </button>
            </div>
        </div>

        <!-- ── Filters toolbar ────────────────────────────────────────────── -->
        <div class="bg-white border-b border-gray-200 px-6 py-3 print:hidden">
            <div class="flex flex-wrap items-center gap-3">
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Date range</label>
                <input
                    v-model="startDate"
                    type="date"
                    class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-primary-blue-100"
                />
                <span class="text-gray-400 text-sm">→</span>
                <input
                    v-model="endDate"
                    type="date"
                    class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-primary-blue-100"
                />
                <div class="w-px h-5 bg-gray-200"></div>
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Model</label>
                <select
                    v-model="selectedModel"
                    class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-primary-blue-100"
                >
                    <option value="linear">Linear</option>
                    <option value="first_touch">First Touch</option>
                    <option value="last_touch">Last Touch</option>
                    <option value="time_decay">Time Decay</option>
                    <option value="u_shaped">U-Shaped</option>
                </select>
                <font-awesome-icon
                    v-if="globalLoading || attributionStore.loading.channelPerformance || attributionStore.loading.roi"
                    :icon="['fas', 'spinner']"
                    class="animate-spin text-primary-blue-100 text-sm"
                />
            </div>
        </div>

        <!-- ── Tab navigation ─────────────────────────────────────────────── -->
        <div class="bg-white border-b border-gray-200 px-6 print:hidden">
            <nav class="flex gap-1" aria-label="Attribution tabs">
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    type="button"
                    class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
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

        <!-- ── Tab content ────────────────────────────────────────────────── -->
        <div class="p-6 print:p-0 space-y-6">

            <!-- Channel Performance -->
            <div v-show="activeTab === 'channel'">
                <channel-performance-overview
                    v-if="channelPerformance.length > 0"
                    :performance="channelPerformance"
                    :loading="attributionStore.loading.channelPerformance"
                />
                <div v-else-if="!attributionStore.loading.channelPerformance" class="flex flex-col items-center justify-center py-16 text-gray-400">
                    <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-4xl mb-3 text-gray-300" />
                    <p class="text-sm font-medium text-gray-500">No channel performance data</p>
                    <p class="text-xs mt-1">Track attribution events to see channel performance here.</p>
                </div>
                <div v-else class="flex items-center justify-center py-12">
                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl text-primary-blue-100" />
                </div>
            </div>

            <!-- Funnel -->
            <div v-show="activeTab === 'funnel'">
                <div class="flex items-center justify-between mb-4 print:hidden">
                    <h2 class="text-base font-semibold text-gray-800">Conversion Funnels</h2>
                    <button
                        type="button"
                        class="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-blue-100 text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                        @click="showCreateFunnel = true"
                    >
                        <font-awesome-icon :icon="['fas', 'plus']" class="text-xs" />
                        New Funnel
                    </button>
                </div>

                <!-- Selected funnel visualisation -->
                <div v-if="selectedFunnel" class="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                    <FunnelChart
                        :funnel="selectedFunnel"
                        :loading="attributionStore.loading.funnels"
                        :ga4-sessions="hasGA4DataSource ? ga4Sessions : null"
                    />
                </div>

                <!-- List of saved funnels -->
                <funnel-list
                    v-if="funnels.length > 0"
                    :funnels="funnels"
                    @select="selectFunnel"
                />
                <div v-else-if="!attributionStore.loading.funnels && !selectedFunnel" class="flex flex-col items-center justify-center py-16 text-gray-400">
                    <font-awesome-icon :icon="['fas', 'filter']" class="text-4xl mb-3 text-gray-300" />
                    <p class="text-sm font-medium text-gray-500">No funnels created yet</p>
                    <p class="text-xs mt-1">Create your first funnel to analyse conversion drop-off.</p>
                </div>
            </div>

            <!-- Journey Map -->
            <div v-show="activeTab === 'journey'">
                <JourneyMap
                    :journeys="customerJourneys"
                    :loading="attributionStore.loading.journeys"
                    :total-journeys="customerJourneys.length"
                />
            </div>

            <!-- ROI Dashboard -->
            <div v-show="activeTab === 'roi'">
                <ROIDashboard
                    :metrics="roiMetrics"
                    :loading="attributionStore.loading.roi"
                />
            </div>

            <!-- Model Comparison -->
            <div v-show="activeTab === 'model-comparison'">
                <ModelComparison
                    :data="modelComparison"
                    :active-model="selectedModel"
                    :loading="attributionStore.loading.modelComparison"
                />
            </div>

            <!-- Reports -->
            <div v-show="activeTab === 'reports'">
                <attribution-reports-list
                    :reports="reports"
                    :loading="attributionStore.loading.reports"
                    @view="(r) => attributionStore.setSelectedReport(r)"
                    @delete="deleteReport"
                    @generate="openGenerateReport"
                />
            </div>
        </div>

        <!-- ══ Generate Report Modal ═════════════════════════════════════════ -->
        <div v-if="showGenerateReport" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showGenerateReport = false">
            <div class="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-lg font-bold text-gray-800">Generate Attribution Report</h3>
                    <button type="button" class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" @click="showGenerateReport = false">
                        <font-awesome-icon :icon="['fas', 'xmark']" />
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Report Name</label>
                        <input
                            v-model="reportForm.name"
                            type="text"
                            placeholder="Q1 2026 Attribution Analysis"
                            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-primary-blue-100"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Attribution Model</label>
                        <select
                            v-model="reportForm.model"
                            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-primary-blue-100"
                        >
                            <option value="linear">Linear Attribution</option>
                            <option value="first_touch">First Touch</option>
                            <option value="last_touch">Last Touch</option>
                            <option value="time_decay">Time Decay</option>
                            <option value="u_shaped">U-Shaped (40-20-40)</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                            <input v-model="reportForm.startDate" type="date" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-primary-blue-100" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                            <input v-model="reportForm.endDate" type="date" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-primary-blue-100" />
                        </div>
                    </div>
                </div>
                <div v-if="generateError" class="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ generateError }}</div>
                <div class="flex justify-end gap-3 mt-6">
                    <button type="button" class="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer" @click="showGenerateReport = false">Cancel</button>
                    <button
                        type="button"
                        class="px-4 py-2 text-sm bg-primary-blue-100 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                        :disabled="isGenerating || !isReportFormValid"
                        @click="generateReport"
                    >
                        <font-awesome-icon v-if="isGenerating" :icon="['fas', 'spinner']" class="animate-spin" />
                        {{ isGenerating ? 'Generating…' : 'Generate' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- ══ Create Funnel Modal ═══════════════════════════════════════════ -->
        <div v-if="showCreateFunnel" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showCreateFunnel = false">
            <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-5">
                    <h3 class="text-lg font-bold text-gray-800">Create Conversion Funnel</h3>
                    <button type="button" class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" @click="showCreateFunnel = false">
                        <font-awesome-icon :icon="['fas', 'xmark']" />
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Funnel Name</label>
                        <input
                            v-model="funnelForm.name"
                            type="text"
                            placeholder="E-commerce Purchase Funnel"
                            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-primary-blue-100"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Funnel Steps</label>
                        <div class="space-y-2">
                            <div
                                v-for="(step, idx) in funnelForm.steps"
                                :key="idx"
                                class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                            >
                                <span class="w-5 text-center text-xs font-bold text-gray-500">{{ idx + 1 }}</span>
                                <input
                                    v-model="step.stepName"
                                    type="text"
                                    placeholder="Step name"
                                    class="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-primary-blue-100"
                                />
                                <select
                                    v-model="step.eventType"
                                    class="px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-primary-blue-100"
                                >
                                    <option value="pageview">Page View</option>
                                    <option value="interaction">Interaction</option>
                                    <option value="conversion">Conversion</option>
                                </select>
                                <button
                                    v-if="funnelForm.steps.length > 2"
                                    type="button"
                                    class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                    @click="removeFunnelStep(idx)"
                                >
                                    <font-awesome-icon :icon="['fas', 'trash']" class="text-xs" />
                                </button>
                            </div>
                        </div>
                        <button
                            type="button"
                            class="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-primary-blue-100 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                            @click="addFunnelStep"
                        >
                            <font-awesome-icon :icon="['fas', 'plus']" class="text-xs" />
                            Add Step
                        </button>
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    <button type="button" class="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer" @click="showCreateFunnel = false">Cancel</button>
                    <button
                        type="button"
                        class="px-4 py-2 text-sm bg-primary-blue-100 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                        :disabled="isCreatingFunnel || !isFunnelFormValid"
                        @click="createFunnel"
                    >
                        <font-awesome-icon v-if="isCreatingFunnel" :icon="['fas', 'spinner']" class="animate-spin" />
                        {{ isCreatingFunnel ? 'Creating…' : 'Analyse Funnel' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
