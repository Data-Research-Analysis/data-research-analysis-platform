<template>
  <div class="space-y-6">
    <!-- Summary Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- Tables Count -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
          <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18M3 6h18M3 18h18" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ tables.length }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Tables</p>
        </div>
      </div>

      <!-- Columns Count -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
          <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ totalColumns }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Columns</p>
        </div>
      </div>

      <!-- Rows Count -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
          <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formattedTotalRows }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Total Rows</p>
        </div>
      </div>

      <!-- Joins Count -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
          <svg class="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ joins.length }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Joins</p>
        </div>
      </div>
    </div>

    <!-- Health & Quality Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Health Status Card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Model Health</h3>
        <div class="flex items-center gap-6">
          <!-- Health Ring -->
          <div class="relative w-24 h-24 flex-shrink-0">
            <svg class="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke-width="8"
                :class="healthRingBgClass" />
              <circle cx="50" cy="50" r="40" fill="none" stroke-width="8"
                :stroke-dasharray="healthRingDashArray"
                stroke-linecap="round"
                :class="healthRingStrokeClass" />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-lg font-bold" :class="healthTextColor">{{ healthPercentage }}%</span>
            </div>
          </div>
          <!-- Health Details -->
          <div class="flex-1 space-y-3">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                :class="healthBadgeClass">
                <span class="w-2 h-2 rounded-full mr-1.5" :class="healthDotClass"></span>
                {{ healthStatusText }}
              </span>
              <span v-if="dataModel.model_type" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 capitalize">
                {{ dataModel.model_type }}
              </span>
              <span v-if="dataModel.data_layer" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 capitalize">
                {{ layerDisplayName }}
              </span>
            </div>
            <!-- Health Issues -->
            <div v-if="dataModel.health_issues && dataModel.health_issues.length > 0" class="space-y-1">
              <div v-for="issue in dataModel.health_issues.slice(0, 3)" :key="issue.code"
                class="flex items-start gap-2 text-sm">
                <span class="mt-0.5">
                  <svg v-if="issue.severity === 'error'" class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else-if="issue.severity === 'warning'" class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </span>
                <span class="text-gray-700 dark:text-gray-300">{{ issue.title }}</span>
              </div>
            </div>
            <!-- Healthy state -->
            <p v-else-if="dataModel.health_status === 'healthy'" class="text-sm text-gray-500 dark:text-gray-400">
              All checks passing. Model is ready for analysis.
            </p>
            <!-- Fix CTA -->
            <button v-if="dataModel.health_status === 'warning' || dataModel.health_status === 'blocked'"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              @click="$emit('navigate', 'builder')">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit SQL
            </button>
          </div>
        </div>
      </div>

      <!-- Data Quality Section -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Data Quality</h3>
          <span v-if="qualityScore" class="text-xs text-gray-500 dark:text-gray-400">AI-analyzed</span>
        </div>
        <div v-if="qualityScore" class="space-y-3">
          <!-- Overall Score -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Score</span>
            <span class="text-lg font-bold" :class="qualityScoreColor(qualityScore.overall_score)">{{ qualityScore.overall_score }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="h-2 rounded-full transition-all duration-500"
              :class="qualityBarColor(qualityScore.overall_score)"
              :style="{ width: qualityScore.overall_score + '%' }"></div>
          </div>
          <!-- Sub-scores -->
          <div class="grid grid-cols-3 gap-3 pt-2">
            <div class="text-center">
              <p class="text-lg font-bold" :class="qualityScoreColor(qualityScore.completeness_score)">{{ qualityScore.completeness_score }}%</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Completeness</p>
            </div>
            <div class="text-center">
              <p class="text-lg font-bold" :class="qualityScoreColor(qualityScore.consistency_score)">{{ qualityScore.consistency_score }}%</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Consistency</p>
            </div>
            <div class="text-center">
              <p class="text-lg font-bold" :class="qualityScoreColor(qualityScore.accuracy_score)">{{ qualityScore.accuracy_score }}%</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
            </div>
          </div>
          <!-- Issues -->
          <div v-if="qualityScore.issues && qualityScore.issues.length > 0" class="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Issues Found</p>
            <ul class="space-y-1">
              <li v-for="(issue, i) in qualityScore.issues.slice(0, 3)" :key="i"
                class="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <span class="text-amber-500 mt-0.5">•</span>
                {{ issue }}
              </li>
            </ul>
          </div>
        </div>
        <div v-else class="flex flex-col items-center justify-center py-6 text-center">
          <svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">Run AI analysis to get data quality scores</p>
          <button
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            :disabled="isAnalyzing"
            @click="$emit('run-analysis')">
            <svg v-if="isAnalyzing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {{ isAnalyzing ? 'Analyzing...' : 'Run AI Analysis' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Table List -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Tables</h3>
        <span class="text-sm text-gray-500 dark:text-gray-400">{{ tables.length }} table{{ tables.length !== 1 ? 's' : '' }}</span>
      </div>
      <div v-if="tables.length > 0" class="divide-y divide-gray-100 dark:divide-gray-700">
        <div v-for="table in tables" :key="table.id"
          class="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
          @click="$emit('navigate', 'explorer')">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ table.logical_name || table.table_name }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ table.table_name }}<span v-if="table.schema"> · {{ table.schema }}</span></p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ formatNumber(table.row_count || (table.rows?.length ?? 0)) }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">rows</p>
            </div>
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
      <div v-else class="px-6 py-12 text-center">
        <svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        <p class="text-sm text-gray-500 dark:text-gray-400">No tables found for this data model.</p>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button
        class="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
        @click="$emit('generate-report')">
        <div class="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div class="text-left">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">Generate Report</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Create an AI-powered report</p>
        </div>
      </button>

      <button
        class="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all group"
        @click="$emit('navigate', 'chat')">
        <div class="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
          <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div class="text-left">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">Ask AI</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Chat about your data</p>
        </div>
      </button>

      <button
        class="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition-all group"
        @click="$emit('navigate', 'builder')">
        <div class="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors">
          <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <div class="text-left">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">Edit SQL</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Modify model query</p>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IDataModel } from '~/types/IDataModel';
import type { IDataModelTable } from '~/types/IDataModelTable';
import type { DataQualityScore } from '@/composables/useDataModelAnalysis';

const props = defineProps<{
  dataModel: IDataModel;
  dataModelTables: IDataModelTable[];
  joins: any[];
  qualityScore: DataQualityScore | null;
  isAnalyzing: boolean;
}>();

defineEmits<{
  (e: 'navigate', tab: string): void;
  (e: 'generate-report'): void;
  (e: 'run-analysis'): void;
}>();

// ── Computed ──────────────────────────────────────────────────────────

const tables = computed(() => props.dataModelTables || []);

const totalColumns = computed(() => {
  let count = 0;
  for (const table of tables.value) {
    count += table.columns?.length ?? 0;
  }
  return count;
});

const totalRows = computed(() => {
  let count = 0;
  for (const table of tables.value) {
    count += table.row_count ?? table.rows?.length ?? 0;
  }
  return count;
});

const formattedTotalRows = computed(() => formatNumber(totalRows.value));

const healthPercentage = computed(() => {
  const status = props.dataModel.health_status;
  if (status === 'healthy') return 100;
  if (status === 'warning') return 60;
  if (status === 'blocked') return 20;
  return 0; // unknown
});

const healthRingDashArray = computed(() => {
  const circumference = 2 * Math.PI * 40; // r=40
  const filled = (healthPercentage.value / 100) * circumference;
  return `${filled} ${circumference - filled}`;
});

const healthRingBgClass = computed(() => 'stroke-gray-200 dark:stroke-gray-700');
const healthRingStrokeClass = computed(() => {
  const status = props.dataModel.health_status;
  if (status === 'healthy') return 'stroke-green-500';
  if (status === 'warning') return 'stroke-amber-500';
  if (status === 'blocked') return 'stroke-red-500';
  return 'stroke-gray-400 dark:stroke-gray-500';
});

const healthTextColor = computed(() => {
  const status = props.dataModel.health_status;
  if (status === 'healthy') return 'text-green-600 dark:text-green-400';
  if (status === 'warning') return 'text-amber-600 dark:text-amber-400';
  if (status === 'blocked') return 'text-red-600 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
});

const healthStatusText = computed(() => {
  const status = props.dataModel.health_status;
  if (status === 'healthy') return 'Healthy';
  if (status === 'warning') return 'Warning';
  if (status === 'blocked') return 'Blocked';
  return 'Unknown';
});

const healthBadgeClass = computed(() => {
  const status = props.dataModel.health_status;
  if (status === 'healthy') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (status === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (status === 'blocked') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
});

const healthDotClass = computed(() => {
  const status = props.dataModel.health_status;
  if (status === 'healthy') return 'bg-green-500';
  if (status === 'warning') return 'bg-amber-500';
  if (status === 'blocked') return 'bg-red-500';
  return 'bg-gray-400';
});

const layerDisplayName = computed(() => {
  const layer = props.dataModel.data_layer;
  if (layer === 'raw_data') return 'Raw Data';
  if (layer === 'clean_data') return 'Clean Data';
  if (layer === 'business_ready') return 'Business Ready';
  return layer || '';
});

// ── Helpers ──────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function qualityScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function qualityBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}
</script>