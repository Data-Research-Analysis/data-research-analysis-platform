<template>
  <div class="p-8 max-w-7xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">AI Insights</h1>
      <p class="text-lg text-gray-600">Instantly discover insights from your data without building models</p>
    </div>

    <!-- Saved Reports List -->
    <div v-if="!state.showAnalysisView">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-semibold text-gray-800">Saved Reports</h2>
        <ClientOnly>
          <button
            class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            @click="startNewAnalysis"
            :disabled="!canCreate"
          >
            <font-awesome-icon :icon="['fas', 'plus']" class="w-5 h-5" />
            New Analysis
          </button>
          <template #fallback>
            <button
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled
            >
              <font-awesome-icon :icon="['fas', 'plus']" class="w-5 h-5" />
              New Analysis
            </button>
          </template>
        </ClientOnly>
      </div>

      <div v-if="state.loadingReports" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        <p class="mt-4">Loading reports...</p>
      </div>

      <div v-else-if="insightsStore.reports.length === 0" class="flex flex-col items-center justify-center py-16 px-8 text-center">
        <font-awesome-icon :icon="['fas', 'box']" class="w-16 h-16 text-gray-300 mb-4" />
        <h3 class="text-xl font-semibold text-gray-800 mb-2">No insights yet</h3>
        <p class="text-gray-600 mb-6">Create your first analysis to discover insights from your data</p>
        <ClientOnly>
          <button
            class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            @click="startNewAnalysis"
            :disabled="!canCreate"
          >
            Create First Analysis
          </button>
          <template #fallback>
            <button
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled
            >
              Create First Analysis
            </button>
          </template>
        </ClientOnly>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="report in insightsStore.reports"
          :key="report.id"
          class="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 relative"
          @click="viewReport(report.id)"
        >
          <div class="mb-4">
            <h3 class="text-lg font-semibold text-gray-800 mb-1">{{ report.title }}</h3>
            <span class="text-sm text-gray-400">{{ formatDate(report.created_at) }}</span>
          </div>
          <div class="flex gap-4 text-sm text-gray-600">
            <span>
              {{ report.data_source_ids.length }} data source{{ report.data_source_ids.length !== 1 ? 's' : '' }}
            </span>
            <span>
              {{ countInsights(report.insights_summary) }} insights
            </span>
          </div>
          <button
            class="absolute top-4 right-4 p-2 bg-transparent border-none text-red-600 cursor-pointer rounded-md transition-all hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            @click.stop="confirmDeleteReport(report.id)"
            :disabled="!canDelete"
          >
            <font-awesome-icon :icon="['fas', 'trash']" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Analysis View -->
    <div v-else>
      <div class="flex justify-between items-center mb-8">
        <button class="inline-flex items-center gap-2 px-4 py-2 bg-transparent text-gray-700 rounded-lg transition-all hover:bg-gray-50 cursor-pointer" @click="backToReports">
          <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-5 h-5" />
          Back to Reports
        </button>

        <div class="flex gap-4">
          <button
            v-if="insightsStore.currentInsights"
            class="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium transition-all hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            @click="startNewAnalysis"
            :disabled="insightsStore.isGenerating"
          >
            New Analysis
          </button>
          <button
            v-if="insightsStore.currentInsights && !state.savedCurrentReport"
            class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            @click="saveCurrentReport"
            :disabled="insightsStore.isGenerating || !canCreate"
          >
            Save Report
          </button>
        </div>
      </div>

      <!-- Data Source Selector -->
      <div class="bg-white rounded-xl p-8 mb-8" v-if="!insightsStore.currentInsights && !insightsStore.isGenerating">
        <h3 class="text-xl font-semibold text-gray-800 mb-2">Select Data Sources</h3>
        <p class="text-gray-600 mb-6">Choose one or more data sources to analyze</p>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div
            v-for="ds in availableDataSources"
            :key="ds.id"
            class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg cursor-pointer transition-all hover:border-gray-300 hover:bg-gray-50"
            :class="{ 'border-blue-500 bg-blue-50': state.selectedDataSourceIds.includes(ds.id) }"
            @click="toggleDataSource(ds.id)"
          >
            <div class="checkbox-wrapper">
              <input
                type="checkbox"
                :checked="state.selectedDataSourceIds.includes(ds.id)"
                @click.stop
              />
            </div>
            <div class="flex flex-col gap-1">
              <span class="font-medium text-gray-800">{{ ds.name }}</span>
              <span class="text-sm text-gray-600 capitalize">{{ ds.data_type }}</span>
            </div>
          </div>
        </div>

        <div class="flex justify-center">
          <button
            class="inline-flex items-center gap-2 px-8 py-4 text-lg bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            @click="generateInsights"
            :disabled="state.selectedDataSourceIds.length === 0 || insightsStore.isGenerating"
          >
            <font-awesome-icon :icon="['fas', 'circle-down']" class="w-5 h-5" />
            Generate Insights
          </button>
        </div>
      </div>

      <!-- Progress Overlay -->
      <overlay-dialog v-if="insightsStore.isGenerating && insightsStore.generationProgress" @close="cancelAnalysis">
        <template #overlay>
          <div class="text-center">
            <div class="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
            <h3 class="text-2xl font-semibold text-gray-800 mb-4">{{ insightsStore.generationProgress.message }}</h3>
            <div class="w-full bg-gray-100 rounded-full overflow-hidden mb-4">
              <div
                class="h-3 bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-300 rounded-full"
                :style="{ width: (insightsStore.generationProgress.progress || 0) + '%' }"
              ></div>
            </div>
            <p class="text-gray-600 mb-2">
              {{ insightsStore.generationProgress.phase }}
              <span v-if="insightsStore.generationProgress.currentSource">
                - {{ insightsStore.generationProgress.currentSource }}
              </span>
            </p>
            <p class="text-sm text-gray-500 mb-6">Progress: {{ insightsStore.generationProgress.progress || 0 }}%</p>
            <button 
              class="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium transition-all hover:bg-gray-300 cursor-pointer" 
              @click="cancelAnalysis"
            >
              Cancel
            </button>
          </div>
        </template>
      </overlay-dialog>

      <!-- Insights Display -->
      <div v-if="insightsStore.currentInsights" class="bg-white rounded-xl p-8">
        <h2 class="text-3xl font-semibold text-gray-800 mb-8">Analysis Results</h2>

        <!-- Sampling Disclaimer -->
        <div v-if="insightsStore.samplingInfo" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="flex items-start gap-3">
            <font-awesome-icon :icon="['fas', 'circle-info']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="text-sm text-blue-900">
                <strong>Data Sample Analysis:</strong> This analysis is based on a sample of 
                <strong>{{ insightsStore.samplingInfo.total_rows_sampled.toLocaleString() }}</strong> rows 
                from <strong>{{ insightsStore.samplingInfo.tables_sampled }}</strong> table{{ insightsStore.samplingInfo.tables_sampled !== 1 ? 's' : '' }}
                (max {{ insightsStore.samplingInfo.max_rows_per_table }} rows per table).
              </p>
            </div>
          </div>
        </div>

        <!-- Trends -->
        <div v-if="insightsStore.currentInsights.trends?.length > 0" class="mb-10">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'arrow-trend-up']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-800">Trends</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in insightsStore.currentInsights.trends"
              :key="idx"
              class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                  'bg-green-200 text-green-900': insight.confidence === 'high',
                  'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                  'bg-gray-200 text-gray-800': insight.confidence === 'low'
                }">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Anomalies -->
        <div v-if="insightsStore.currentInsights.anomalies?.length > 0" class="mb-10">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-800">Anomalies</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in insightsStore.currentInsights.anomalies"
              :key="idx"
              class="bg-red-50 border-l-4 border-red-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                  'bg-green-200 text-green-900': insight.confidence === 'high',
                  'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                  'bg-gray-200 text-gray-800': insight.confidence === 'low'
                }">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Correlations -->
        <div v-if="insightsStore.currentInsights.correlations?.length > 0" class="mb-10">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'share-nodes']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-800">Correlations</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in insightsStore.currentInsights.correlations"
              :key="idx"
              class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                  'bg-green-200 text-green-900': insight.confidence === 'high',
                  'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                  'bg-gray-200 text-gray-800': insight.confidence === 'low'
                }">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Distributions -->
        <div v-if="insightsStore.currentInsights.distributions?.length > 0" class="mb-10">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-800">Distributions</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in insightsStore.currentInsights.distributions"
              :key="idx"
              class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                  'bg-green-200 text-green-900': insight.confidence === 'high',
                  'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                  'bg-gray-200 text-gray-800': insight.confidence === 'low'
                }">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div v-if="insightsStore.currentInsights.recommendations?.length > 0" class="mb-10">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'layer-group']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-800">Recommendations</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in insightsStore.currentInsights.recommendations"
              :key="idx"
              class="bg-green-50 border-l-4 border-green-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                  'bg-green-200 text-green-900': insight.confidence === 'high',
                  'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                  'bg-gray-200 text-gray-800': insight.confidence === 'low'
                }">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Follow-up Chat -->
        <div class="mt-12 pt-8 border-t-2 border-gray-200">
          <h3 class="text-xl font-semibold text-gray-800 mb-4">Ask Follow-up Questions</h3>
          <div class="max-h-96 overflow-y-auto mb-4 flex flex-col gap-3">
            <div
              v-for="(msg, idx) in insightsStore.messages.filter(m => m.role !== 'system')"
              :key="idx"
              class="flex flex-col gap-1 max-w-4/5"
              :class="{ 'self-end': msg.role === 'user', 'self-start': msg.role === 'assistant' }"
            >
              <div 
                class="px-4 py-3 rounded-xl leading-normal prose prose-sm max-w-none" 
                :class="{
                  'bg-blue-500 text-white prose-invert': msg.role === 'user',
                  'bg-gray-50 text-gray-800 border border-gray-200': msg.role === 'assistant'
                }"
                v-html="renderMarkdown(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2))"
              ></div>
              <span class="text-xs text-gray-400 px-2">{{ formatTime(msg.timestamp) }}</span>
            </div>
            
            <!-- Typing Indicator -->
            <div v-if="insightsStore.isGenerating" class="flex flex-col gap-1 max-w-4/5 self-start">
              <div class="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-2">
                <div class="flex gap-1">
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
                <span class="text-sm text-gray-500">AI is thinking...</span>
              </div>
            </div>
          </div>
          <div class="flex gap-4">
            <input
              v-model="state.followUpMessage"
              type="text"
              placeholder="Ask a question about these insights..."
              @keyup.enter="sendFollowUp"
              :disabled="insightsStore.isGenerating"
              class="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500"
            />
            <button
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              @click="sendFollowUp"
              :disabled="!state.followUpMessage.trim() || insightsStore.isGenerating"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

definePageMeta({ layout: 'marketing-project' });
import { useInsightsStore } from '@/stores/insights';
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import { useMarkdown } from '@/composables/useMarkdown';

const insightsStore = useInsightsStore();
const dataSourceStore = useDataSourceStore();
const projectsStore = useProjectsStore();
const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp();
const { renderMarkdown } = useMarkdown();

// Get project ID from route
const projectId = parseInt(String(route.params.projectid));

// Get project permissions (middleware loads projects, permissions are reactive)
const permissions = useProjectPermissions(projectId);
const canCreate = computed(() => permissions.canCreate.value);
const canDelete = computed(() => permissions.canDelete.value);

const state = reactive({
  showAnalysisView: false,
  loadingReports: false,
  selectedDataSourceIds: [],
  followUpMessage: '',
  savedCurrentReport: false
});

const availableDataSources = computed(() => {
  const allDataSources = dataSourceStore.getDataSources();
  return allDataSources.filter((ds) => {
    const dsProjectId = ds.project_id || ds.project?.id;
    return dsProjectId === projectId;
  });
});

function toggleDataSource(id) {
  const index = state.selectedDataSourceIds.indexOf(id);
  if (index === -1) {
    state.selectedDataSourceIds.push(id);
  } else {
    state.selectedDataSourceIds.splice(index, 1);
  }
  insightsStore.setSelectedDataSources(state.selectedDataSourceIds);
}

async function generateInsights() {
  if (state.selectedDataSourceIds.length === 0) {
    if (import.meta.client) {
      $swal.fire({
        icon: 'warning',
        title: 'No Data Sources Selected',
        text: 'Please select at least one data source to analyze'
      });
    }
    return;
  }

  // Initialize session
  const initResult = await insightsStore.initializeSession(projectId, state.selectedDataSourceIds);
  if (!initResult.success) {
    if (import.meta.client) {
      $swal.fire({
        icon: 'error',
        title: 'Initialization Failed',
        text: initResult.error || 'Failed to initialize analysis session'
      });
    }
    return;
  }

  // Generate insights
  const generateResult = await insightsStore.generateInsights(projectId);
  if (!generateResult.success) {
    if (import.meta.client) {
      $swal.fire({
        icon: 'error',
        title: 'Generation Failed',
        text: generateResult.error || 'Failed to generate insights'
      });
    }
  }
}

async function sendFollowUp() {
  if (!state.followUpMessage.trim()) return;

  const message = state.followUpMessage;
  state.followUpMessage = '';

  const result = await insightsStore.askFollowUp(projectId, message);
  if (!result.success && import.meta.client) {
    $swal.fire({
      icon: 'error',
      title: 'Unable to Process Question',
      text: result.error || 'Could not send your message. Please try again.'
    });
  }
}

async function saveCurrentReport() {
  if (import.meta.client) {
    const { value: title } = await $swal.fire({
      title: 'Save Report',
      input: 'text',
      inputLabel: 'Report Title',
      inputPlaceholder: 'Enter a descriptive title',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'Title is required';
        }
      }
    });

    if (title) {
      const result = await insightsStore.saveReport(projectId, title);
      if (result.success) {
        state.savedCurrentReport = true;
        $swal.fire({
          icon: 'success',
          title: 'Report Saved',
          text: 'Your insights report has been saved successfully'
        });
      } else {
        $swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: result.error || 'Failed to save report'
        });
      }
    }
  }
}

function startNewAnalysis() {
  insightsStore.clearSession();
  state.showAnalysisView = true;
  state.savedCurrentReport = false;
  state.selectedDataSourceIds = [];
}

function backToReports() {
  state.showAnalysisView = false;
  loadReports();
}

async function loadReports() {
  state.loadingReports = true;
  await insightsStore.loadReports(projectId);
  state.loadingReports = false;
}

function viewReport(reportId) {
  router.push(`/projects/${projectId}/insights/${reportId}`);
}

async function confirmDeleteReport(reportId) {
  if (import.meta.client) {
    const result = await $swal.fire({
      title: 'Delete Report?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      const deleteResult = await insightsStore.deleteReport(reportId);
      if (deleteResult.success) {
        $swal.fire({
          icon: 'success',
          title: 'Report Deleted',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        $swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: deleteResult.error || 'Failed to delete report'
        });
      }
    }
  }
}

function cancelAnalysis() {
  insightsStore.cancelSession(projectId);
}

function formatDate(dateString) {
  if (!import.meta.client) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(timestamp) {
  if (!import.meta.client) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function countInsights(summary) {
  if (!summary) return 0;
  let count = 0;
  if (summary.trends) count += summary.trends.length;
  if (summary.anomalies) count += summary.anomalies.length;
  if (summary.correlations) count += summary.correlations.length;
  if (summary.distributions) count += summary.distributions.length;
  if (summary.recommendations) count += summary.recommendations.length;
  return count;
}

// Load reports on mount (client-only)
onMounted(() => {
  if (import.meta.client) {
    insightsStore.initializeSocketListeners();
    // Load reports for this specific project
    insightsStore.loadReports(projectId);
  }
});
</script>

