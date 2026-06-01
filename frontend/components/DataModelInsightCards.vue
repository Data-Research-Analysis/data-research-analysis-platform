<template>
  <div class="data-model-insights space-y-6">
    <!-- Analyze Button & Status Bar -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          @click="handleAnalyze"
          :disabled="isAnalyzing"
          class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg v-if="isAnalyzing" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {{ isAnalyzing ? 'Analyzing...' : 'Analyze with AI' }}
        </button>
        <span v-if="insights?.metadata?.cache_hit" class="text-xs text-gray-500 italic">
          Showing cached results
        </span>
        <span v-if="insights?.metadata?.analysis_timestamp" class="text-xs text-gray-500">
          Last analyzed: {{ formatTimestamp(insights.metadata.analysis_timestamp) }}
        </span>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <svg class="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800">Analysis Failed</p>
          <p class="text-sm text-red-700 mt-1">{{ error }}</p>
          <button
            @click="handleAnalyze"
            class="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isAnalyzing && !hasInsights" class="space-y-6">
      <div v-for="i in 3" :key="i" class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="animate-pulse">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-8 bg-gray-200 rounded-lg"></div>
            <div class="h-4 bg-gray-200 rounded w-32"></div>
          </div>
          <div class="space-y-3">
            <div class="h-3 bg-gray-200 rounded w-full"></div>
            <div class="h-3 bg-gray-200 rounded w-5/6"></div>
            <div class="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State (no analysis yet) -->
    <div v-if="!isAnalyzing && !hasInsights && !error" class="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <svg class="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">No Insights Yet</h3>
      <p class="text-sm text-gray-500 mb-4 max-w-md mx-auto">
        Click "Analyze with AI" to generate intelligent insights about your data model, including patterns, anomalies, and marketing recommendations.
      </p>
      <button
        @click="handleAnalyze"
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Analyze with AI
      </button>
    </div>

    <!-- Insights Content -->
    <template v-if="hasInsights">
      <!-- Summary Section -->
      <section class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
            <svg class="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-700">Analysis Summary</h3>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="text-center p-3 bg-blue-50 rounded-lg">
            <p class="text-2xl font-bold text-blue-600">{{ keyInsights.length }}</p>
            <p class="text-xs text-gray-500 mt-1">Key Insights</p>
          </div>
          <div class="text-center p-3 bg-purple-50 rounded-lg">
            <p class="text-2xl font-bold text-purple-600">{{ patterns.length }}</p>
            <p class="text-xs text-gray-500 mt-1">Patterns Found</p>
          </div>
          <div class="text-center p-3 rounded-lg" :class="anomalies.length > 0 ? 'bg-yellow-50' : 'bg-green-50'">
            <p class="text-2xl font-bold" :class="anomalies.length > 0 ? 'text-yellow-600' : 'text-green-600'">{{ anomalies.length }}</p>
            <p class="text-xs text-gray-500 mt-1">Anomalies</p>
          </div>
          <div class="text-center p-3 bg-indigo-50 rounded-lg">
            <p class="text-2xl font-bold text-indigo-600">{{ recommendations.length }}</p>
            <p class="text-xs text-gray-500 mt-1">Recommendations</p>
          </div>
        </div>
      </section>

      <!-- Key Insights Section -->
      <section v-if="keyInsights.length > 0" class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-700">Key Insights</h3>
          <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
            {{ keyInsights.length }}
          </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="(insight, idx) in keyInsights"
            :key="idx"
            class="p-4 rounded-lg border transition-colors hover:shadow-sm"
            :class="getInsightBorderColor(insight.severity)"
          >
            <div class="flex items-start gap-3">
              <span class="text-lg flex-shrink-0">{{ getInsightIcon(insight) }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900">{{ insight.title }}</p>
                <p class="text-sm text-gray-600 mt-1">{{ insight.description }}</p>
                <span
                  v-if="insight.metric"
                  class="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600"
                >
                  {{ insight.metric }}
                </span>
              </div>
              <span
                class="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full"
                :class="getSeverityBadge(insight.severity)"
              >
                {{ insight.severity }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Patterns & Trends Section -->
      <section v-if="patterns.length > 0" class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <svg class="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-700">Patterns & Trends</h3>
          <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
            {{ patterns.length }}
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="(trend, idx) in patterns"
            :key="idx"
            class="p-4 bg-purple-50 rounded-lg border border-purple-100"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <p class="text-sm font-semibold text-gray-900">{{ trend.pattern }}</p>
                <p class="text-sm text-gray-600 mt-1">{{ trend.marketing_implication }}</p>
                <div class="flex flex-wrap gap-1 mt-2">
                  <span
                    v-for="col in trend.columns_involved"
                    :key="col"
                    class="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700"
                  >
                    {{ col }}
                  </span>
                </div>
              </div>
              <div class="flex-shrink-0 ml-4 text-right">
                <p class="text-xs text-gray-500">Confidence</p>
                <p class="text-sm font-semibold" :class="getConfidenceColor(trend.confidence)">
                  {{ Math.round(trend.confidence * 100) }}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Anomalies Section -->
      <section v-if="anomalies.length > 0" class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
            <svg class="h-4 w-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-700">Anomalies Detected</h3>
          <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
            {{ anomalies.length }}
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="(anomaly, idx) in anomalies"
            :key="idx"
            class="p-4 rounded-lg border"
            :class="getAnomalyBorderColor(anomaly.severity)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-lg">{{ getSeverityEmoji(anomaly.severity) }}</span>
                  <p class="text-sm font-semibold text-gray-900">{{ anomaly.anomaly }}</p>
                </div>
                <div class="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span class="text-gray-500">Column:</span>
                    <span class="ml-1 font-medium text-gray-700">{{ anomaly.affected_column }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Expected:</span>
                    <span class="ml-1 font-medium text-gray-700">{{ anomaly.expected_range }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Actual:</span>
                    <span class="ml-1 font-medium text-red-600">{{ anomaly.actual_value }}</span>
                  </div>
                </div>
              </div>
              <span
                class="flex-shrink-0 ml-3 px-2 py-0.5 text-xs font-medium rounded-full"
                :class="getAnomalySeverityBadge(anomaly.severity)"
              >
                {{ anomaly.severity }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Anomalies Empty State -->
      <section v-else-if="hasInsights && anomalies.length === 0" class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
            <svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-700">Anomalies</h3>
        </div>
        <p class="text-sm text-gray-500 ml-11">No anomalies detected — all metrics are within expected ranges.</p>
      </section>

      <!-- Recommendations Section -->
      <section v-if="recommendations.length > 0" class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <svg class="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-700">Recommendations</h3>
          <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
            {{ recommendations.length }}
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="(rec, idx) in recommendations"
            :key="idx"
            class="p-4 bg-indigo-50 rounded-lg border border-indigo-100"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                :class="getPriorityColor(rec.priority)"
              >
                {{ idx + 1 }}
              </span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-gray-900">{{ rec.recommendation }}</p>
                <p class="text-xs text-gray-600 mt-1">
                  <span class="font-medium">Expected Impact:</span> {{ rec.expected_impact }}
                </p>
                <div class="flex flex-wrap gap-1 mt-2">
                  <span
                    v-for="metric in rec.related_metrics"
                    :key="metric"
                    class="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-700"
                  >
                    {{ metric }}
                  </span>
                </div>
              </div>
              <span
                class="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full"
                :class="getPriorityBadge(rec.priority)"
              >
                {{ rec.priority }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Data Quality Score Section -->
      <section v-if="qualityScore" class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
            <svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-700">Data Quality Score</h3>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="text-center">
            <div class="relative inline-block">
              <svg class="h-20 w-20" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  stroke-width="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  :stroke="getScoreColor(qualityScore.overall_score)"
                  stroke-width="3"
                  :stroke-dasharray="`${qualityScore.overall_score}, 100`"
                  stroke-linecap="round"
                />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">
                {{ qualityScore.overall_score }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-1">Overall</p>
          </div>
          <div class="text-center">
            <div class="relative inline-block">
              <svg class="h-20 w-20" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" stroke-width="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" :stroke="getScoreColor(qualityScore.completeness_score)" stroke-width="3" :stroke-dasharray="`${qualityScore.completeness_score}, 100`" stroke-linecap="round" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">{{ qualityScore.completeness_score }}</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">Completeness</p>
          </div>
          <div class="text-center">
            <div class="relative inline-block">
              <svg class="h-20 w-20" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" stroke-width="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" :stroke="getScoreColor(qualityScore.consistency_score)" stroke-width="3" :stroke-dasharray="`${qualityScore.consistency_score}, 100`" stroke-linecap="round" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">{{ qualityScore.consistency_score }}</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">Consistency</p>
          </div>
          <div class="text-center">
            <div class="relative inline-block">
              <svg class="h-20 w-20" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" stroke-width="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" :stroke="getScoreColor(qualityScore.accuracy_score)" stroke-width="3" :stroke-dasharray="`${qualityScore.accuracy_score}, 100`" stroke-linecap="round" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">{{ qualityScore.accuracy_score }}</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">Accuracy</p>
          </div>
        </div>
        <!-- Quality Issues -->
        <div v-if="qualityScore.issues?.length > 0" class="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
          <p class="text-xs font-semibold text-yellow-800 mb-2">Quality Issues:</p>
          <ul class="space-y-1">
            <li v-for="(issue, idx) in qualityScore.issues" :key="idx" class="text-xs text-yellow-700 flex items-start gap-1">
              <span class="text-yellow-500 mt-0.5">•</span>
              {{ issue }}
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DataModelAIInsights } from '@/composables/useDataModelAnalysis';

const props = defineProps<{
  dataModelId: number;
  isAnalyzing: boolean;
  hasInsights: boolean;
  insights: DataModelAIInsights | null;
  error: string | null;
  keyInsights: DataModelAIInsights['key_insights'];
  patterns: DataModelAIInsights['patterns_and_trends'];
  anomalies: DataModelAIInsights['anomalies_detected'];
  recommendations: DataModelAIInsights['marketing_recommendations'];
  qualityScore: DataModelAIInsights['data_quality_score'] | null;
}>();

const emit = defineEmits<{
  'analyze': [];
}>();

function handleAnalyze() {
  emit('analyze');
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function getInsightIcon(insight: { icon?: string; severity: string }): string {
  if (insight.icon) return insight.icon;
  switch (insight.severity) {
    case 'success': return '✅';
    case 'warning': return '⚠️';
    case 'danger': return '🔴';
    default: return '💡';
  }
}

function getInsightBorderColor(severity: string): string {
  switch (severity) {
    case 'success': return 'border-green-200 bg-green-50';
    case 'warning': return 'border-yellow-200 bg-yellow-50';
    case 'danger': return 'border-red-200 bg-red-50';
    default: return 'border-blue-200 bg-blue-50';
  }
}

function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'success': return 'bg-green-100 text-green-700';
    case 'warning': return 'bg-yellow-100 text-yellow-700';
    case 'danger': return 'bg-red-100 text-red-700';
    default: return 'bg-blue-100 text-blue-700';
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

function getAnomalyBorderColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-red-300 bg-red-50';
    case 'high': return 'border-red-200 bg-red-50';
    case 'medium': return 'border-yellow-200 bg-yellow-50';
    default: return 'border-blue-200 bg-blue-50';
  }
}

function getAnomalySeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-200 text-red-800';
    case 'high': return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-blue-100 text-blue-700';
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    default: return '🔵';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-red-500';
    case 'medium': return 'bg-yellow-500';
    default: return 'bg-blue-500';
  }
}

function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-blue-100 text-blue-700';
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}
</script>