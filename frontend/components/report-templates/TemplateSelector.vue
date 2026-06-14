<template>
  <div class="template-selector">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="flex flex-col items-center gap-3">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p class="text-sm text-gray-500">Loading templates…</p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="py-4">
      <div class="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
        <svg class="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p class="text-sm font-medium text-red-800">Failed to load templates</p>
          <p class="text-xs text-red-600 mt-1">{{ error }}</p>
          <button @click="$emit('retry')" class="mt-2 text-xs font-medium text-red-700 underline hover:text-red-900">
            Try again
          </button>
        </div>
      </div>
    </div>

    <!-- Template list -->
    <div v-else class="space-y-3">
      <!-- Category filter tabs -->
      <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          v-for="cat in categories"
          :key="cat.id"
          @click="activeCategory = cat.id"
          class="px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors"
          :class="activeCategory === cat.id
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        >
          {{ cat.label }}
          <span v-if="cat.count !== undefined" class="ml-1 opacity-60">({{ cat.count }})</span>
        </button>
      </div>

      <!-- Template cards -->
      <div class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="relative group rounded-lg border-2 transition-all cursor-pointer"
          :class="[
            selectedTemplateId === template.id
              ? 'border-indigo-500 bg-indigo-50 shadow-sm'
              : template.compatible
                ? 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                : 'border-gray-100 bg-gray-50 opacity-60',
          ]"
          @click="handleSelectTemplate(template)"
        >
          <div class="p-4">
            <div class="flex items-start gap-3">
              <!-- Icon -->
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                :class="getCategoryColor(template.category).bg"
              >
                {{ getTemplateIcon(template) }}
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-semibold text-gray-900 truncate">{{ template.name }}</h4>
                  <span
                    class="px-2 py-0.5 text-[10px] font-medium rounded-full"
                    :class="getCategoryColor(template.category).badge"
                  >
                    {{ formatCategory(template.category) }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1 line-clamp-2">{{ template.description }}</p>

                <!-- Compatibility status -->
                <div v-if="!template.compatible" class="flex items-center gap-1.5 mt-2">
                  <svg class="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span class="text-xs text-amber-700">{{ template.compatibilityReason || 'Not compatible with current data model' }}</span>
                </div>

                <!-- Section preview (expandable) -->
                <div v-if="selectedTemplateId === template.id && template.compatible" class="mt-3">
                  <p class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Report Sections</p>
                  <div class="space-y-1.5">
                    <div
                      v-for="(section, idx) in template.sections"
                      :key="section.id"
                      class="flex items-center gap-2"
                    >
                      <span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {{ idx + 1 }}
                      </span>
                      <span class="text-xs text-gray-700">{{ section.title }}</span>
                      <span class="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {{ getSectionTypeLabel(section.type) }}
                      </span>
                      <span v-if="section.condition" class="text-[10px] text-amber-500" title="Conditional section">
                        *
                      </span>
                    </div>
                  </div>
                  <p class="text-[10px] text-gray-400 mt-2">* Conditional — only included if data model meets requirements</p>
                </div>
              </div>

              <!-- Selection indicator -->
              <div v-if="selectedTemplateId === template.id && template.compatible" class="flex-shrink-0">
                <div class="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                  <svg class="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!filteredTemplates.length" class="py-8 text-center">
        <p class="text-sm text-gray-500">No templates available in this category.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { IReportTemplate } from '@/composables/useReportTemplates';

const props = defineProps<{
  templates: IReportTemplate[];
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  'select': [template: IReportTemplate];
  'retry': [];
}>();

const activeCategory = ref<string>('all');
const selectedTemplateId = ref<string | null>(null);

const categories = computed(() => {
  const cats = [
    { id: 'all', label: 'All Templates', count: props.templates.length },
    { id: 'compatible', label: 'Compatible', count: props.templates.filter(t => t.compatible).length },
    { id: 'executive', label: 'Executive' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'data_quality', label: 'Data Quality' },
    { id: 'comparison', label: 'Comparison' },
    { id: 'general', label: 'General' },
  ];
  return cats;
});

const filteredTemplates = computed(() => {
  if (activeCategory.value === 'all') return props.templates;
  if (activeCategory.value === 'compatible') return props.templates.filter(t => t.compatible);
  return props.templates.filter(t => t.category === activeCategory.value);
});

function handleSelectTemplate(template: IReportTemplate) {
  if (!template.compatible) return;
  
  if (selectedTemplateId.value === template.id) {
    // Deselect
    selectedTemplateId.value = null;
  } else {
    selectedTemplateId.value = template.id;
  }
  emit('select', template);
}

function getTemplateIcon(template: IReportTemplate): string {
  const iconMap: Record<string, string> = {
    'chart-bar': '📊',
    'megaphone': '📢',
    'shield-check': '🛡️',
    'arrows-left-right': '↔️',
    'squares-2x2': '🗂️',
  };
  return iconMap[template.icon] || '📄';
}

function getCategoryColor(category: string): { bg: string; text: string; badge: string } {
  const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
    executive: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
    marketing: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    data_quality: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
    comparison: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    general: { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' },
  };
  return colorMap[category] || colorMap.general;
}

function getSectionTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    kpi_row: 'KPI',
    ai_insights: 'AI',
    trend_note: 'Trend',
    text_block: 'Text',
  };
  return labelMap[type] || type;
}

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
</script>