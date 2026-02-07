<template>
    <div class="container mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h1 class="text-3xl font-bold text-gray-800">Marketing Attribution Dashboard</h1>
                    <p class="text-gray-600 mt-2">{{ selectedProject?.name || 'Loading...' }}</p>
                </div>
                <button
                    @click="showGenerateReport = true"
                    class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
                >
                    <span>📊</span>
                    <span>Generate Report</span>
                </button>
            </div>

            <!-- Date Range Selector -->
            <div class="flex items-center gap-4 bg-white rounded-lg shadow p-4">
                <label class="text-sm font-medium text-gray-700">Date Range:</label>
                <input
                    v-model="dateRange.start"
                    type="date"
                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span class="text-gray-500">to</span>
                <input
                    v-model="dateRange.end"
                    type="date"
                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <select
                    v-model="selectedModel"
                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="linear">Linear Attribution</option>
                    <option value="first_touch">First Touch</option>
                    <option value="last_touch">Last Touch</option>
                    <option value="time_decay">Time Decay</option>
                    <option value="u_shaped">U-Shaped</option>
                </select>
                <button
                    @click="loadData"
                    :disabled="loading"
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-200"
                >
                    {{ loading ? 'Loading...' : 'Apply' }}
                </button>
            </div>
        </div>

        <!-- Tab Navigation -->
        <div class="bg-white rounded-lg shadow mb-8">
            <div class="border-b border-gray-200">
                <nav class="flex space-x-8 px-6" aria-label="Tabs">
                    <button
                        v-for="tab in tabs"
                        :key="tab.id"
                        @click="activeTab = tab.id"
                        :class="[
                            activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200'
                        ]"
                    >
                        {{ tab.label }}
                    </button>
                </nav>
            </div>

            <!-- Tab Content -->
            <div class="p-6">
                <!-- Overview Tab -->
                <div v-show="activeTab === 'overview'">
                    <channel-performance-overview
                        v-if="channelPerformance.length > 0"
                        :performance="channelPerformance"
                        :loading="attributionStore.loading.channelPerformance"
                    />
                    <div v-else class="text-center py-12 text-gray-500">
                        No channel performance data available for the selected date range
                    </div>
                </div>

                <!-- ROI Tab -->
                <div v-show="activeTab === 'roi'">
                    <channel-roi-metrics
                        v-if="roiMetrics.length > 0"
                        :metrics="roiMetrics"
                        :loading="attributionStore.loading.roi"
                    />
                    <div v-else class="text-center py-12 text-gray-500">
                        No ROI data available. Add channel spend data to calculate ROI.
                    </div>
                </div>

                <!-- Conversion Paths Tab -->
                <div v-show="activeTab === 'paths'">
                    <conversion-paths-visualization
                        v-if="conversionPaths.length > 0"
                        :paths="conversionPaths"
                    />
                    <div v-else class="text-center py-12 text-gray-500">
                        No conversion paths tracked yet
                    </div>
                </div>

                <!-- Funnels Tab -->
                <div v-show="activeTab === 'funnels'">
                    <div class="mb-6 flex justify-end">
                        <button
                            @click="showCreateFunnel = true"
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
                        >
                            <span>➕</span>
                            <span>Create Funnel</span>
                        </button>
                    </div>
                    <funnel-list
                        v-if="funnels.length > 0"
                        :funnels="funnels"
                        @select="viewFunnelDetails"
                    />
                    <div v-else class="text-center py-12 text-gray-500">
                        No funnels created yet. Create your first conversion funnel to analyze customer journeys.
                    </div>
                </div>

                <!-- Customer Journeys Tab -->
                <div v-show="activeTab === 'journeys'">
                    <customer-journey-explorer
                        :journeys="customerJourneys"
                        :loading="attributionStore.loading.journeys"
                        @load-more="loadMoreJourneys"
                    />
                </div>

                <!-- Reports Tab -->
                <div v-show="activeTab === 'reports'">
                    <attribution-reports-list
                        :reports="reports"
                        :loading="attributionStore.loading.reports"
                        @view="viewReport"
                        @delete="deleteReport"
                        @generate="showGenerateReport = true"
                    />
                </div>
            </div>
        </div>

        <!-- Generate Report Modal -->
        <div v-if="showGenerateReport" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click="showGenerateReport = false">
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" @click.stop>
                <h3 class="text-2xl font-bold text-gray-800 mb-4">Generate Attribution Report</h3>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Report Name</label>
                        <input
                            v-model="reportForm.name"
                            type="text"
                            placeholder="Q1 2026 Attribution Analysis"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Attribution Model</label>
                        <select
                            v-model="reportForm.model"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="linear">Linear Attribution</option>
                            <option value="first_touch">First Touch</option>
                            <option value="last_touch">Last Touch</option>
                            <option value="time_decay">Time Decay</option>
                            <option value="u_shaped">U-Shaped (40-20-40)</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                            <input
                                v-model="reportForm.startDate"
                                type="date"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                            <input
                                v-model="reportForm.endDate"
                                type="date"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div v-if="generateError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-sm text-red-600">{{ generateError }}</p>
                </div>

                <div class="flex justify-end gap-3 mt-6">
                    <button
                        @click="showGenerateReport = false"
                        :disabled="isGenerating"
                        class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        @click="generateReport"
                        :disabled="isGenerating || !isReportFormValid"
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-200 flex items-center gap-2"
                    >
                        <span v-if="isGenerating" class="animate-spin">⚙️</span>
                        <span>{{ isGenerating ? 'Generating...' : 'Generate Report' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Create Funnel Modal -->
        <div v-if="showCreateFunnel" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click="showCreateFunnel = false">
            <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" @click.stop>
                <h3 class="text-2xl font-bold text-gray-800 mb-4">Create Conversion Funnel</h3>
                
                <div class="space-y-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Funnel Name</label>
                        <input
                            v-model="funnelForm.name"
                            type="text"
                            placeholder="E-commerce Purchase Funnel"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Funnel Steps</label>
                        <div class="space-y-3">
                            <div
                                v-for="(step, index) in funnelForm.steps"
                                :key="index"
                                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                                <span class="text-lg font-bold text-gray-500">{{ index + 1 }}</span>
                                <input
                                    v-model="step.stepName"
                                    type="text"
                                    placeholder="Step name"
                                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <select
                                    v-model="step.eventType"
                                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="pageview">Page View</option>
                                    <option value="interaction">Interaction</option>
                                    <option value="conversion">Conversion</option>
                                </select>
                                <button
                                    v-if="funnelForm.steps.length > 2"
                                    @click="removeFunnelStep(index)"
                                    class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <button
                            @click="addFunnelStep"
                            class="mt-3 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200 w-full"
                        >
                            + Add Step
                        </button>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                            <input
                                v-model="funnelForm.startDate"
                                type="date"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                            <input
                                v-model="funnelForm.endDate"
                                type="date"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3">
                    <button
                        @click="showCreateFunnel = false"
                        :disabled="isCreatingFunnel"
                        class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        @click="createFunnel"
                        :disabled="isCreatingFunnel || !isFunnelFormValid"
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-200 flex items-center gap-2"
                    >
                        <span v-if="isCreatingFunnel" class="animate-spin">⚙️</span>
                        <span>{{ isCreatingFunnel ? 'Creating...' : 'Create Funnel' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useProjectsStore } from '~/stores/projects';
import { useAttributionStore } from '~/stores/attribution';
import type { AttributionModel } from '~/stores/attribution';

definePageMeta({
    middleware: ['auth']
});

const projectsStore = useProjectsStore();
const attributionStore = useAttributionStore();

const selectedProject = computed(() => projectsStore.getSelectedProject());
const reports = computed(() => attributionStore.reports);
const channelPerformance = computed(() => attributionStore.channelPerformance);
const roiMetrics = computed(() => attributionStore.roiMetrics);
const funnels = computed(() => attributionStore.funnels);
const customerJourneys = computed(() => attributionStore.customerJourneys);
const conversionPaths = computed(() => attributionStore.conversionPaths);

// UI State
const activeTab = ref('overview');
const loading = ref(false);
const showGenerateReport = ref(false);
const showCreateFunnel = ref(false);
const isGenerating = ref(false);
const isCreatingFunnel = ref(false);
const generateError = ref('');

// Date Range
const dateRange = ref({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
});

const selectedModel = ref<AttributionModel>('linear');

// Tabs
const tabs = [
    { id: 'overview', label: 'Channel Performance' },
    { id: 'roi', label: 'ROI Analysis' },
    { id: 'paths', label: 'Conversion Paths' },
    { id: 'funnels', label: 'Funnels' },
    { id: 'journeys', label: 'Customer Journeys' },
    { id: 'reports', label: 'Reports' }
];

// Report Form
const reportForm = ref({
    name: '',
    model: 'linear' as AttributionModel,
    startDate: dateRange.value.start,
    endDate: dateRange.value.end
});

const isReportFormValid = computed(() => {
    return reportForm.value.name.trim() !== '' &&
           reportForm.value.startDate !== '' &&
           reportForm.value.endDate !== '';
});

// Funnel Form
const funnelForm = ref({
    name: '',
    steps: [
        { stepNumber: 1, stepName: '', eventType: 'pageview' },
        { stepNumber: 2, stepName: '', eventType: 'interaction' },
        { stepNumber: 3, stepName: '', eventType: 'conversion' }
    ],
    startDate: dateRange.value.start,
    endDate: dateRange.value.end
});

const isFunnelFormValid = computed(() => {
    return funnelForm.value.name.trim() !== '' &&
           funnelForm.value.steps.every(s => s.stepName.trim() !== '') &&
           funnelForm.value.startDate !== '' &&
           funnelForm.value.endDate !== '';
});

function addFunnelStep() {
    funnelForm.value.steps.push({
        stepNumber: funnelForm.value.steps.length + 1,
        stepName: '',
        eventType: 'interaction'
    });
}

function removeFunnelStep(index: number) {
    funnelForm.value.steps.splice(index, 1);
    // Renumber steps
    funnelForm.value.steps.forEach((step, i) => {
        step.stepNumber = i + 1;
    });
}

async function loadData() {
    if (!selectedProject.value) return;
    
    loading.value = true;
    try {
        const projectId = selectedProject.value.id;
        
        // Load all data in parallel
        await Promise.all([
            attributionStore.retrieveChannelPerformance(
                projectId,
                selectedModel.value,
                dateRange.value.start,
                dateRange.value.end
            ),
            attributionStore.retrieveConversionPaths(
                projectId,
                selectedModel.value,
                dateRange.value.start,
                dateRange.value.end,
                10
            ),
            attributionStore.retrieveReports(projectId),
            attributionStore.retrieveChannels(projectId)
        ]);
    } catch (error) {
        console.error('Error loading attribution data:', error);
    } finally {
        loading.value = false;
    }
}

async function generateReport() {
    if (!selectedProject.value || !isReportFormValid.value) return;
    
    isGenerating.value = true;
    generateError.value = '';
    
    try {
        const result = await attributionStore.generateReport(
            selectedProject.value.id,
            reportForm.value.name,
            reportForm.value.model,
            reportForm.value.startDate,
            reportForm.value.endDate
        );
        
        if (result.success) {
            showGenerateReport.value = false;
            // Reset form
            reportForm.value.name = '';
            // Switch to reports tab
            activeTab.value = 'reports';
        } else {
            generateError.value = result.error || 'Failed to generate report';
        }
    } catch (error) {
        generateError.value = error instanceof Error ? error.message : 'Unknown error';
    } finally {
        isGenerating.value = false;
    }
}

async function createFunnel() {
    if (!selectedProject.value || !isFunnelFormValid.value) return;
    
    isCreatingFunnel.value = true;
    
    try {
        const result = await attributionStore.analyzeFunnel(
            selectedProject.value.id,
            funnelForm.value.name,
            funnelForm.value.steps,
            funnelForm.value.startDate,
            funnelForm.value.endDate
        );
        
        if (result.success) {
            showCreateFunnel.value = false;
            // Reset form
            funnelForm.value.name = '';
            funnelForm.value.steps = [
                { stepNumber: 1, stepName: '', eventType: 'pageview' },
                { stepNumber: 2, stepName: '', eventType: 'interaction' },
                { stepNumber: 3, stepName: '', eventType: 'conversion' }
            ];
        }
    } catch (error) {
        console.error('Error creating funnel:', error);
    } finally {
        isCreatingFunnel.value = false;
    }
}

async function loadMoreJourneys() {
    if (!selectedProject.value) return;
    
    await attributionStore.retrieveJourneyMap(
        selectedProject.value.id,
        dateRange.value.start,
        dateRange.value.end,
        undefined,
        100
    );
}

function viewReport(report: any) {
    attributionStore.setSelectedReport(report);
    // Navigate to report detail page if needed
}

async function deleteReport(reportId: number) {
    if (confirm('Are you sure you want to delete this report?')) {
        await attributionStore.deleteReport(reportId);
    }
}

function viewFunnelDetails(funnel: any) {
    attributionStore.setSelectedFunnel(funnel);
    // Could navigate to funnel detail page or show modal
}

onMounted(() => {
    if (selectedProject.value) {
        loadData();
    }
});
</script>
