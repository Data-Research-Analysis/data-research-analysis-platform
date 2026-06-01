<template>
  <div
    class="ai-insight-card rounded-lg border p-3 transition-all hover:shadow-sm"
    :class="[severityClasses.bg, severityClasses.border]"
  >
    <div class="flex items-start gap-2.5">
      <!-- Severity icon -->
      <span class="text-base flex-shrink-0 mt-0.5" aria-hidden="true">
        {{ severityEmoji }}
      </span>

      <div class="flex-1 min-w-0">
        <!-- Title -->
        <p class="text-sm font-semibold text-gray-900 leading-snug">
          {{ item.title }}
        </p>

        <!-- Description -->
        <p
          v-if="item.description"
          class="text-xs text-gray-600 mt-1 leading-relaxed"
        >
          {{ item.description }}
        </p>

        <!-- Metadata row -->
        <div class="flex flex-wrap items-center gap-2 mt-2">
          <!-- Metric badge -->
          <span
            v-if="item.metric"
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600"
          >
            {{ item.metric }}
          </span>

          <!-- Tags -->
          <span
            v-for="tag in item.tags"
            :key="tag"
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500"
          >
            {{ tag }}
          </span>

          <!-- Priority badge (recommendations) -->
          <span
            v-if="item.priority"
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
            :class="priorityBadgeClass"
          >
            {{ item.priority }}
          </span>

          <!-- Confidence (patterns) -->
          <span
            v-if="item.confidence !== null && item.confidence !== undefined"
            class="inline-flex items-center gap-0.5 text-[10px] text-gray-500"
          >
            <span class="font-medium" :class="confidenceColorClass">
              {{ Math.round(item.confidence * 100) }}%
            </span>
            confidence
          </span>
        </div>
      </div>

      <!-- Severity badge (right side) -->
      <span
        class="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold"
        :class="severityClasses.badge"
      >
        {{ item.severity }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  type AIInsightItem,
  type InsightSeverity,
  getInsightSeverityClasses,
  getInsightSeverityEmoji,
} from '@/composables/useReportAIInsight'

const props = defineProps<{
  item: AIInsightItem
}>()

const severityClasses = computed(() => getInsightSeverityClasses(props.item.severity))

const severityEmoji = computed(() => {
  if (props.item.icon) return props.item.icon
  return getInsightSeverityEmoji(props.item.severity)
})

const priorityBadgeClass = computed(() => {
  switch (props.item.priority) {
    case 'high': return 'bg-red-100 text-red-700'
    case 'medium': return 'bg-yellow-100 text-yellow-700'
    case 'low': return 'bg-blue-100 text-blue-700'
    default: return 'bg-gray-100 text-gray-600'
  }
})

const confidenceColorClass = computed(() => {
  const c = props.item.confidence ?? 0
  if (c >= 0.8) return 'text-green-600'
  if (c >= 0.5) return 'text-yellow-600'
  return 'text-red-600'
})
</script>