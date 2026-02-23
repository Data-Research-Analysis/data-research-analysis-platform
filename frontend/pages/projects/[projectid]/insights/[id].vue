<template>
  <div class="report-detail-container">
    <div v-if="state.loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading report...</p>
    </div>

    <div v-else-if="state.error" class="error-state">
      <font-awesome-icon :icon="['fas', 'circle-info']" class="w-16 h-16" />
      <h3>Error Loading Report</h3>
      <p>{{ state.error }}</p>
      <button class="btn-primary" @click="router.push(`/projects/${projectId}/insights`)">
        Back to Insights
      </button>
    </div>

    <div v-else-if="state.report" class="report-content">
      <!-- Header -->
      <div class="report-header">
        <button class="btn-back" @click="router.push(`/projects/${projectId}/insights`)">
          <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-5 h-5" />
          Back to Reports
        </button>

        <div class="header-actions">
          <button
            class="btn-delete"
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
      <div class="report-title-section">
        <h1>{{ state.report.title }}</h1>
        <div class="report-meta">
          <span class="meta-item">
            <font-awesome-icon :icon="['fas', 'calendar']" class="w-4 h-4" />
            Created {{ formatDate(state.report.created_at) }}
          </span>
          <span class="meta-item">
            <font-awesome-icon :icon="['fas', 'user']" class="w-4 h-4" />
            {{ state.report.data_source_ids.length }} data source{{ state.report.data_source_ids.length !== 1 ? 's' : '' }}
          </span>
          <span class="meta-item">
            <font-awesome-icon :icon="['fas', 'clock']" class="w-4 h-4" />
            {{ countInsights(state.report.insights_summary) }} insights
          </span>
        </div>
      </div>

      <!-- Insights Display -->
      <div class="insights-section">
        <h2>Insights Summary</h2>

        <!-- Sampling Disclaimer -->
        <div v-if="state.report?.insights_summary?.sampling_info" class="sampling-disclaimer">
          <font-awesome-icon :icon="['fas', 'circle-info']" class="w-5 h-5" />
          <p>
            <strong>Data Sample Analysis:</strong> This analysis is based on a sample of 
            <strong>{{ state.report.insights_summary.sampling_info.total_rows_sampled.toLocaleString() }}</strong> rows 
            from <strong>{{ state.report.insights_summary.sampling_info.tables_sampled }}</strong> table{{ state.report.insights_summary.sampling_info.tables_sampled !== 1 ? 's' : '' }}
            (max {{ state.report.insights_summary.sampling_info.max_rows_per_table }} rows per table).
          </p>
        </div>

        <!-- Trends -->
        <div v-if="state.report.insights_summary.trends?.length > 0" class="insight-category">
          <div class="category-header">
            <font-awesome-icon :icon="['fas', 'arrow-trend-up']" class="w-6 h-6" />
            <h3>Trends</h3>
          </div>
          <div class="insights-list">
            <div
              v-for="(insight, idx) in state.report.insights_summary.trends"
              :key="idx"
              class="insight-card"
            >
              <div class="insight-content">
                <p class="insight-text">{{ insight.insight }}</p>
                <span class="confidence-badge" :class="'confidence-' + insight.confidence">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Anomalies -->
        <div v-if="state.report.insights_summary.anomalies?.length > 0" class="insight-category">
          <div class="category-header">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="w-6 h-6" />
            <h3>Anomalies</h3>
          </div>
          <div class="insights-list">
            <div
              v-for="(insight, idx) in state.report.insights_summary.anomalies"
              :key="idx"
              class="insight-card anomaly"
            >
              <div class="insight-content">
                <p class="insight-text">{{ insight.insight }}</p>
                <span class="confidence-badge" :class="'confidence-' + insight.confidence">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Correlations -->
        <div v-if="state.report.insights_summary.correlations?.length > 0" class="insight-category">
          <div class="category-header">
            <font-awesome-icon :icon="['fas', 'share-nodes']" class="w-6 h-6" />
            <h3>Correlations</h3>
          </div>
          <div class="insights-list">
            <div
              v-for="(insight, idx) in state.report.insights_summary.correlations"
              :key="idx"
              class="insight-card"
            >
              <div class="insight-content">
                <p class="insight-text">{{ insight.insight }}</p>
                <span class="confidence-badge" :class="'confidence-' + insight.confidence">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Distributions -->
        <div v-if="state.report.insights_summary.distributions?.length > 0" class="insight-category">
          <div class="category-header">
            <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-6 h-6" />
            <h3>Distributions</h3>
          </div>
          <div class="insights-list">
            <div
              v-for="(insight, idx) in state.report.insights_summary.distributions"
              :key="idx"
              class="insight-card"
            >
              <div class="insight-content">
                <p class="insight-text">{{ insight.insight }}</p>
                <span class="confidence-badge" :class="'confidence-' + insight.confidence">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div v-if="state.report.insights_summary.recommendations?.length > 0" class="insight-category">
          <div class="category-header">
            <font-awesome-icon :icon="['fas', 'layer-group']" class="w-6 h-6" />
            <h3>Recommendations</h3>
          </div>
          <div class="insights-list">
            <div
              v-for="(insight, idx) in state.report.insights_summary.recommendations"
              :key="idx"
              class="insight-card recommendation"
            >
              <div class="insight-content">
                <p class="insight-text">{{ insight.insight }}</p>
                <span class="confidence-badge" :class="'confidence-' + insight.confidence">
                  {{ insight.confidence }} confidence
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Conversation History -->
      <div v-if="state.messages.length > 0" class="conversation-section">
        <h2>Conversation History</h2>
        <div class="messages-list">
          <div
            v-for="(msg, idx) in state.messages"
            :key="idx"
            class="message-item"
            :class="'role-' + msg.role"
          >
            <div class="message-header">
              <span class="message-role">{{ msg.role === 'user' ? 'You' : 'AI Assistant' }}</span>
              <span class="message-time">{{ formatTime(msg.created_at) }}</span>
            </div>
            <div class="message-content prose prose-sm max-w-none" v-html="renderMarkdown(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2))"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
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

const state = reactive({
  loading: true,
  error: null,
  report: null,
  messages: []
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
      router.push(`/projects/${projectId}/insights`);
    } else {
      $swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: deleteResult.error || 'Failed to delete report'
      });
    }
  }
}

function formatDate(dateString) {
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

// Load report on mount (client-only)
onMounted(() => {
  if (import.meta.client) {
    loadReport();
  }
});
</script>

<style scoped>
.report-detail-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.spinner {
  border: 3px solid #e2e8f0;
  border-top-color: #4299e1;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state svg {
  color: #e53e3e;
  margin-bottom: 1rem;
}

.error-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.error-state p {
  color: #718096;
  margin-bottom: 1.5rem;
}

.btn-primary,
.btn-back,
.btn-delete {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background-color: #4299e1;
  color: white;
}

.btn-primary:hover {
  background-color: #3182ce;
}

.btn-back {
  background-color: transparent;
  color: #4a5568;
  padding: 0.5rem 1rem;
}

.btn-back:hover {
  background-color: #f7fafc;
}

.btn-delete {
  background-color: #e53e3e;
  color: white;
}

.btn-delete:hover:not(:disabled) {
  background-color: #c53030;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.report-title-section {
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  margin-bottom: 2rem;
}

.report-title-section h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}

.report-meta {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #718096;
  font-size: 0.875rem;
}

.meta-item svg {
  color: #a0aec0;
}

.insights-section {
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  margin-bottom: 2rem;
}

.insights-section > h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 2rem;
}

.sampling-disclaimer {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background-color: #ebf8ff;
  border: 1px solid #bee3f8;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 2rem;
  color: #2c5282;
}

.sampling-disclaimer svg {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.sampling-disclaimer p {
  margin: 0;
  line-height: 1.5;
}

.insight-category {
  margin-bottom: 2.5rem;
}

.insight-category:last-child {
  margin-bottom: 0;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.category-header svg {
  color: #4299e1;
}

.category-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insight-card {
  background: #f7fafc;
  border-left: 4px solid #4299e1;
  border-radius: 0.5rem;
  padding: 1rem;
}

.insight-card.anomaly {
  border-left-color: #f56565;
  background: #fff5f5;
}

.insight-card.recommendation {
  border-left-color: #48bb78;
  background: #f0fff4;
}

.insight-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.insight-text {
  flex: 1;
  color: #2d3748;
  line-height: 1.6;
}

.confidence-badge {
  flex-shrink: 0;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.confidence-high {
  background: #c6f6d5;
  color: #22543d;
}

.confidence-medium {
  background: #feebc8;
  color: #7c2d12;
}

.confidence-low {
  background: #e2e8f0;
  color: #2d3748;
}

.conversation-section {
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
}

.conversation-section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 1.5rem;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.message-item {
  border-left: 3px solid #e2e8f0;
  padding-left: 1rem;
}

.message-item.role-user {
  border-left-color: #4299e1;
}

.message-item.role-assistant {
  border-left-color: #48bb78;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.message-role {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.875rem;
}

.message-time {
  font-size: 0.75rem;
  color: #a0aec0;
}

.message-content {
  color: #4a5568;
  line-height: 1.6;
}
</style>
