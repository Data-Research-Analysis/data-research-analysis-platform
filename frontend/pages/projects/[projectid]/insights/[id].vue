<template>
  <div class="p-8 max-w-[1200px] mx-auto">
    <div v-if="state.loading" class="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div class="border-[3px] border-gray-200 border-t-blue-500 rounded-full w-10 h-10 animate-spin"></div>
      <p>Loading report...</p>
    </div>

    <div v-else-if="state.error" class="flex flex-col items-center justify-center py-16 px-8 text-center">
      <font-awesome-icon :icon="['fas', 'circle-info']" class="w-16 h-16 text-red-600 mb-4" />
      <h3 class="text-xl font-semibold text-gray-700 mb-2">Error Loading Report</h3>
      <p class="text-gray-600 mb-6">{{ state.error }}</p>
      <button 
        class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer border-none bg-blue-500 text-white hover:bg-blue-600"
        @click="router.push(`/projects/${projectId}/intelligence#insights`)"
      >
        Back to Insights
      </button>
    </div>

    <div v-else-if="state.report" class="report-content">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <button 
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer border-none bg-transparent text-gray-700 hover:bg-gray-50"
        @click="router.push(`/projects/${projectId}/intelligence#insights`)"
        >
          <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-5 h-5" />
          Back to Reports
        </button>

        <div class="flex gap-4">
          <button
            class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer border-none bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="confirmDelete"
            :disabled="!canDelete"
            title="Delete Report"
          >
              <font-awesome-icon :icon="['fas', 'trash']" class="w-5 h-5" />
            Delete
          </button>
        </div>
      </div>

      <!-- Title and Metadata -->
      <div class="bg-white rounded-xl p-8 mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-4">{{ state.report.title }}</h1>
        <div class="flex gap-8 flex-wrap">
          <span class="flex items-center gap-2 text-gray-600 text-sm">
            <font-awesome-icon :icon="['fas', 'calendar']" class="w-4 h-4 text-gray-400" />
            Created {{ formatDate(state.report.created_at) }}
          </span>
          <span class="flex items-center gap-2 text-gray-600 text-sm">
            <font-awesome-icon :icon="['fas', 'user']" class="w-4 h-4 text-gray-400" />
            {{ state.report.data_source_ids.length }} data source{{ state.report.data_source_ids.length !== 1 ? 's' : '' }}
          </span>
          <span class="flex items-center gap-2 text-gray-600 text-sm">
            <font-awesome-icon :icon="['fas', 'clock']" class="w-4 h-4 text-gray-400" />
            {{ countInsights(state.report.insights_summary) }} insights
          </span>
        </div>
      </div>

      <!-- Insights Display -->
      <div class="bg-white rounded-xl p-8 mb-8">
        <h2 class="text-2xl font-semibold text-gray-700 mb-8">Insights Summary</h2>

        <!-- Sampling Disclaimer -->
        <div v-if="state.report?.insights_summary?.sampling_info" class="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-4 mb-8 text-blue-900">
          <font-awesome-icon :icon="['fas', 'circle-info']" class="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p class="m-0 leading-relaxed">
            <strong>Data Sample Analysis:</strong> This analysis is based on a sample of 
            <strong>{{ state.report.insights_summary.sampling_info.total_rows_sampled.toLocaleString() }}</strong> rows 
            from <strong>{{ state.report.insights_summary.sampling_info.tables_sampled }}</strong> table{{ state.report.insights_summary.sampling_info.tables_sampled !== 1 ? 's' : '' }}
            (max {{ state.report.insights_summary.sampling_info.max_rows_per_table }} rows per table).
          </p>
        </div>

        <!-- Trends -->
        <div v-if="state.report.insights_summary.trends?.length > 0" class="mb-10 last:mb-0">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'arrow-trend-up']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-700">Trends</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in state.report.insights_summary.trends"
              :key="idx"
              class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-700 leading-relaxed">{{ insight.insight }}</p>
                <span 
                  class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase"
                  :class="{
                    'bg-green-200 text-green-900': insight.confidence === 'high',
                    'bg-yellow-100 text-yellow-900': insight.confidence === 'medium',
                    'bg-gray-200 text-gray-700': insight.confidence === 'low'
                  }"
                >
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Anomalies -->
        <div v-if="state.report.insights_summary.anomalies?.length > 0" class="mb-10 last:mb-0">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-700">Anomalies</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in state.report.insights_summary.anomalies"
              :key="idx"
              class="bg-red-50 border-l-4 border-red-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-700 leading-relaxed">{{ insight.insight }}</p>
                <span 
                  class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase"
                  :class="{
                    'bg-green-200 text-green-900': insight.confidence === 'high',
                    'bg-yellow-100 text-yellow-900': insight.confidence === 'medium',
                    'bg-gray-200 text-gray-700': insight.confidence === 'low'
                  }"
                >
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Correlations -->
        <div v-if="state.report.insights_summary.correlations?.length > 0" class="mb-10 last:mb-0">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'share-nodes']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-700">Correlations</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in state.report.insights_summary.correlations"
              :key="idx"
              class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-700 leading-relaxed">{{ insight.insight }}</p>
                <span 
                  class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase"
                  :class="{
                    'bg-green-200 text-green-900': insight.confidence === 'high',
                    'bg-yellow-100 text-yellow-900': insight.confidence === 'medium',
                    'bg-gray-200 text-gray-700': insight.confidence === 'low'
                  }"
                >
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Distributions -->
        <div v-if="state.report.insights_summary.distributions?.length > 0" class="mb-10 last:mb-0">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-700">Distributions</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in state.report.insights_summary.distributions"
              :key="idx"
              class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-700 leading-relaxed">{{ insight.insight }}</p>
                <span 
                  class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase"
                  :class="{
                    'bg-green-200 text-green-900': insight.confidence === 'high',
                    'bg-yellow-100 text-yellow-900': insight.confidence === 'medium',
                    'bg-gray-200 text-gray-700': insight.confidence === 'low'
                  }"
                >
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div v-if="state.report.insights_summary.recommendations?.length > 0" class="mb-10 last:mb-0">
          <div class="flex items-center gap-3 mb-4">
            <font-awesome-icon :icon="['fas', 'layer-group']" class="w-6 h-6 text-blue-500" />
            <h3 class="text-xl font-semibold text-gray-700">Recommendations</h3>
          </div>
          <div class="flex flex-col gap-4">
            <div
              v-for="(insight, idx) in state.report.insights_summary.recommendations"
              :key="idx"
              class="bg-green-50 border-l-4 border-green-500 rounded-lg p-4"
            >
              <div class="flex justify-between items-start gap-4">
                <p class="flex-1 text-gray-700 leading-relaxed">{{ insight.insight }}</p>
                <span 
                  class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase"
                  :class="{
                    'bg-green-200 text-green-900': insight.confidence === 'high',
                    'bg-yellow-100 text-yellow-900': insight.confidence === 'medium',
                    'bg-gray-200 text-gray-700': insight.confidence === 'low'
                  }"
                >
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Conversation History & Chat -->
      <div class="bg-white rounded-xl p-8">
        <h2 class="text-2xl font-semibold text-gray-700 mb-6">Conversation</h2>

        <div v-if="state.messages.length === 0 && !state.isGenerating" class="text-gray-400 text-sm text-center py-6">
          No conversation yet. Start by asking a question below.
        </div>

        <div v-if="state.messages.length > 0" class="flex flex-col gap-6 mb-6 max-h-[500px] overflow-y-auto">
          <div
            v-for="(msg, idx) in state.messages"
            :key="idx"
            class="pl-4"
            :class="msg.role === 'user' ? 'border-l-[3px] border-blue-500' : 'border-l-[3px] border-green-500'"
          >
            <div class="flex justify-between items-center mb-2">
              <span class="font-semibold text-gray-700 text-sm">{{ msg.role === 'user' ? 'You' : 'AI Assistant' }}</span>
              <span class="text-xs text-gray-400">{{ formatTime(msg.created_at) }}</span>
            </div>
            <div class="text-gray-600 leading-relaxed prose prose-sm max-w-none" v-html="renderMarkdown(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2))"></div>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="state.isGenerating" class="flex items-center gap-3 text-gray-500 text-sm mb-6 pl-4 border-l-[3px] border-green-500">
          <div class="border-[2px] border-gray-200 border-t-green-500 rounded-full w-4 h-4 animate-spin"></div>
          AI Assistant is thinking...
        </div>

        <!-- Chat input -->
        <div class="flex gap-3 items-end">
          <textarea
            v-model="state.followUpMessage"
            @keydown.enter.exact="sendFollowUp"
            placeholder="Ask a follow-up question..."
            class="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            :disabled="state.isGenerating"
            rows="2"
          ></textarea>
          <button
            @click="sendFollowUp"
            :disabled="state.isGenerating || !state.followUpMessage.trim()"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer border-none bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <font-awesome-icon :icon="['fas', 'paper-plane']" class="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ layout: 'project' });
import { useInsightsStore } from '@/stores/insights';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import { useMarkdown } from '@/composables/useMarkdown';

const insightsStore = useInsightsStore();
const { renderMarkdown } = useMarkdown();
const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp();

// Get project ID and report ID from route
const projectId = parseInt(String(route.params.projectid));
const reportId = parseInt(String(route.params.id));

// Get project permissions
const permissions = useProjectPermissions(projectId);
const canDelete = computed(() => permissions.canDelete.value);

interface State {
    loading: boolean;
    error: any;
    report: any;
    messages: any[];
    followUpMessage: string;
    isGenerating: boolean;
}
const state = reactive<State>({
  loading: true,
  error: null,
  report: null,
  messages: [],
  followUpMessage: '',
  isGenerating: false
});

async function loadReport() {
  state.loading = true;
  state.error = null;

  const result = await insightsStore.loadReport(reportId);
  
  if (result.success) {
    state.report = result.report;
    state.messages = result.messages;
  } else {
    state.error = result.error || 'Failed to load report';
  }

  state.loading = false;
}

async function sendFollowUp() {
  if (!state.followUpMessage.trim() || state.isGenerating) return;

  const message = state.followUpMessage;
  state.followUpMessage = '';
  state.isGenerating = true;

  state.messages.push({
    role: 'user',
    content: message,
    created_at: new Date().toISOString()
  });

  const result = await insightsStore.chatOnReport(projectId, reportId, message);

  if (result.success) {
    state.messages.push({
      role: 'assistant',
      content: result.message,
      created_at: new Date().toISOString()
    });
  } else {
    if (import.meta.client) {
      $swal.fire({
        icon: 'error',
        title: 'Unable to Process Question',
        text: result.error || 'Could not send your message. Please try again.'
      });
    }
  }

  state.isGenerating = false;
}

async function confirmDelete() {
  if (!import.meta.client) return;

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
      await $swal.fire({
        icon: 'success',
        title: 'Report Deleted',
        timer: 2000,
        showConfirmButton: false
      });
      router.push(`/projects/${projectId}/intelligence#insights`);
    } else {
      $swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: deleteResult.error || 'Failed to delete report'
      });
    }
  }
}

function formatDate(dateString: string) {
  if (!import.meta.client) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(timestamp: string) {
  if (!import.meta.client) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function countInsights(summary: any) {
  if (!summary) return 0;
  let count = 0;
  if (summary.trends) count += summary.trends.length;
  if (summary.anomalies) count += summary.anomalies.length;
  if (summary.correlations) count += summary.correlations.length;
  if (summary.distributions) count += summary.distributions.length;
  if (summary.recommendations) count += summary.recommendations.length;
  return count;
}

// Load report on mount (client-only)
onMounted(() => {
  if (import.meta.client) {
    loadReport();
  }
});
</script>
