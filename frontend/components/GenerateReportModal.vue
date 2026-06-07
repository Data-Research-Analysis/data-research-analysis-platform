<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="handleClose"></div>

      <!-- Modal -->
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <!-- Header -->
        <div class="px-6 pt-6 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Generate Report</h3>
              <p class="text-sm text-gray-500">
                {{ generatingStep ? generatingStep : mode === 'template' ? 'Choose a template for your report' : 'Auto-create a report from this data model' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="px-6 py-5 space-y-5">
          <!-- Generating state -->
          <div v-if="isGenerating" class="py-8">
            <div class="flex flex-col items-center gap-4">
              <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
              <div class="text-center">
                <p class="text-sm font-medium text-gray-900">Generating your report…</p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ generatingStep || 'Setting up report structure' }}
                </p>
              </div>
              <!-- Progress steps -->
              <div class="w-full max-w-xs space-y-2 mt-2">
                <div v-for="step in progressSteps" :key="step.label" class="flex items-center gap-2">
                  <div
                    class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    :class="step.done ? 'bg-green-100' : step.active ? 'bg-indigo-100' : 'bg-gray-100'"
                  >
                    <svg v-if="step.done" class="h-3 w-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                    <div v-else-if="step.active" class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <div v-else class="w-2 h-2 rounded-full bg-gray-300"></div>
                  </div>
                  <span class="text-xs" :class="step.done ? 'text-green-700' : step.active ? 'text-indigo-700 font-medium' : 'text-gray-400'">
                    {{ step.label }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Success state -->
          <div v-else-if="generatedReport" class="py-4">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-900">Report Created Successfully!</p>
                <p class="text-xs text-gray-500">Your report is ready to view and edit</p>
              </div>
            </div>

            <!-- Template info if used -->
            <div v-if="generatedReport.templateName" class="bg-indigo-50 rounded-lg p-3 mb-4 flex items-center gap-2">
              <span class="text-sm">📋</span>
              <span class="text-xs font-medium text-indigo-700">Generated from template: {{ generatedReport.templateName }}</span>
            </div>

            <!-- Sections added -->
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
              <p class="text-xs font-semibold text-gray-700 mb-2">Sections Added:</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="section in generatedReport.sectionsAdded"
                  :key="section"
                  class="px-2 py-1 text-xs font-medium rounded-md bg-indigo-100 text-indigo-700"
                >
                  {{ formatSectionName(section) }}
                </span>
              </div>
            </div>

            <!-- Warnings if any -->
            <div v-if="generatedReport.warnings?.length" class="bg-yellow-50 rounded-lg p-4 mb-4">
              <p class="text-xs font-semibold text-yellow-800 mb-2">Warnings:</p>
              <ul class="space-y-1">
                <li v-for="(warning, idx) in generatedReport.warnings" :key="idx" class="text-xs text-yellow-700 flex items-start gap-1">
                  <span class="text-yellow-500 mt-0.5">⚠</span>
                  {{ warning }}
                </li>
              </ul>
            </div>

            <!-- AI insight status -->
            <div class="flex items-center gap-2 text-xs text-gray-500">
              <span>{{ generatedReport.aiInsightsGenerated ? '✅' : '⏭️' }}</span>
              <span>{{ generatedReport.aiInsightsGenerated ? 'AI insights included' : 'AI insights skipped (use report builder to add)' }}</span>
            </div>
          </div>

          <!-- Error state -->
          <div v-else-if="error" class="py-4">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg class="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-900">Generation Failed</p>
                <p class="text-sm text-gray-600 mt-1">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Mode selection & options (initial state) -->
          <template v-else>
            <!-- Mode toggle -->
            <div class="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                @click="mode = 'quick'"
                class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
                :class="mode === 'quick' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              >
                ⚡ Quick Generate
              </button>
              <button
                @click="mode = 'template'; loadTemplates()"
                class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-l border-gray-200"
                :class="mode === 'template' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              >
                📋 Choose Template
              </button>
            </div>

            <!-- Quick Generate options -->
            <div v-if="mode === 'quick'" class="space-y-4">
              <!-- Skip AI option -->
              <div class="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  id="skip-ai"
                  type="checkbox"
                  v-model="skipAiAnalysis"
                  class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <label for="skip-ai" class="cursor-pointer">
                  <span class="text-sm font-medium text-gray-900">Skip AI Analysis</span>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Generate the report structure without running AI analysis. You can add insights later in the report builder.
                  </p>
                </label>
              </div>

              <!-- What will be generated -->
              <div class="bg-blue-50 rounded-lg p-4">
                <p class="text-xs font-semibold text-blue-800 mb-2">The report will include:</p>
                <ul class="space-y-1.5">
                  <li class="flex items-center gap-2 text-xs text-blue-700">
                    <span>📊</span> KPI cards from auto-detected metric columns
                  </li>
                  <li class="flex items-center gap-2 text-xs text-blue-700">
                    <span>🤖</span> AI-powered insights & recommendations
                  </li>
                  <li class="flex items-center gap-2 text-xs text-blue-700">
                    <span>📋</span> Comparison table (if dimension columns detected)
                  </li>
                  <li class="flex items-center gap-2 text-xs text-blue-700">
                    <span>📝</span> Executive summary placeholder
                  </li>
                </ul>
              </div>
            </div>

            <!-- Template selection -->
            <div v-else-if="mode === 'template'">
              <!-- Skip AI option for templates too -->
              <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-4">
                <input
                  id="skip-ai-template"
                  type="checkbox"
                  v-model="skipAiAnalysis"
                  class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <label for="skip-ai-template" class="cursor-pointer">
                  <span class="text-sm font-medium text-gray-900">Skip AI Analysis</span>
                  <p class="text-xs text-gray-500 mt-0.5">Skip AI insights to generate the report faster.</p>
                </label>
              </div>

              <TemplateSelector
                :templates="templateList"
                :loading="templatesLoading"
                :error="templatesError"
                @select="handleTemplateSelect"
                @retry="loadTemplates"
              />
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <template v-if="generatedReport">
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
            <button
              @click="handleViewReport"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              View & Edit Report →
            </button>
          </template>
          <template v-else-if="error">
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              @click="handleRetry"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Retry
            </button>
          </template>
          <template v-else>
            <button
              @click="handleClose"
              :disabled="isGenerating"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              v-if="mode === 'quick'"
              @click="handleGenerate"
              :disabled="isGenerating"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Report
            </button>
            <button
              v-else-if="mode === 'template'"
              @click="handleGenerateFromTemplate"
              :disabled="isGenerating || !selectedTemplate"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {{ selectedTemplate ? `Generate from "${selectedTemplate.name}"` : 'Select a Template' }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useReportGenerator } from '@/composables/useReportGenerator';
import { useReportTemplates } from '@/composables/useReportTemplates';
import type { IReportTemplate } from '@/composables/useReportTemplates';

const props = defineProps<{
  visible: boolean;
  dataModelId: number;
  projectId: number;
  dataModelName?: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'report-generated': [report: any];
}>();

const { loading: isGenerating, error: generateError, result: generatedReport, generateReport, reset: resetGenerator } = useReportGenerator();
const {
  templates: templateList,
  loading: templatesLoading,
  error: templatesError,
  generating: templateGenerating,
  result: templateResult,
  fetchTemplates,
  generateFromTemplate,
  reset: resetTemplates,
} = useReportTemplates();

const skipAiAnalysis = ref(false);
const generatingStep = ref('');
const mode = ref<'quick' | 'template'>('quick');
const selectedTemplate = ref<IReportTemplate | null>(null);
const templatesLoaded = ref(false);

// Combined error from either flow
const error = computed(() => generateError.value || templatesError.value);
const isBusy = computed(() => isGenerating.value || templateGenerating.value);

const progressSteps = computed(() => [
  { label: mode.value === 'template' && selectedTemplate.value ? `Apply "${selectedTemplate.value.name}" template` : 'Create report', done: true, active: false },
  { label: 'Add KPI cards', done: false, active: true },
  { label: 'Generate AI insights', done: false, active: false },
  { label: 'Build comparison tables', done: false, active: false },
  { label: 'Add executive summary', done: false, active: false },
]);

watch(() => props.visible, (val) => {
  if (!val) {
    resetGenerator();
    resetTemplates();
    skipAiAnalysis.value = false;
    generatingStep.value = '';
    mode.value = 'quick';
    selectedTemplate.value = null;
    templatesLoaded.value = false;
  }
});

async function loadTemplates() {
  if (templatesLoaded.value) return;
  await fetchTemplates(props.dataModelId, props.projectId);
  templatesLoaded.value = true;
}

function handleTemplateSelect(template: IReportTemplate) {
  selectedTemplate.value = template;
}

async function handleGenerate() {
  generatingStep.value = 'Creating report structure…';

  const result = await generateReport(props.dataModelId, props.projectId, {
    skipAiAnalysis: skipAiAnalysis.value,
  });

  if (result) {
    emit('report-generated', result);
  }
}

async function handleGenerateFromTemplate() {
  if (!selectedTemplate.value) return;

  generatingStep.value = `Applying "${selectedTemplate.value.name}" template…`;

  const result = await generateFromTemplate(
    props.dataModelId,
    props.projectId,
    selectedTemplate.value.id,
    {
      skipAiAnalysis: skipAiAnalysis.value,
    },
  );

  if (result) {
    emit('report-generated', result);
  }
}

function handleViewReport() {
  const reportId = generatedReport.value?.report?.id || templateResult.value?.report?.id;
  if (reportId) {
    navigateTo(`/projects/${props.projectId}/reports/${reportId}/edit`);
  }
  handleClose();
}

function handleRetry() {
  resetGenerator();
  resetTemplates();
  selectedTemplate.value = null;
}

function handleClose() {
  emit('update:visible', false);
}

function formatSectionName(section: string): string {
  const map: Record<string, string> = {
    kpi_cards: 'KPI Cards',
    ai_insights: 'AI Insights',
    ai_insights_placeholder: 'AI Insights (Placeholder)',
    ai_insights_empty: 'AI Insights (Empty)',
    ai_insights_error: 'AI Insights (Error)',
    comparison_table: 'Comparison Table',
    trend_note: 'Trend Note',
    executive_summary: 'Executive Summary',
  };
  return map[section] || section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
</script>