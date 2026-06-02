<script setup lang="ts">
/**
 * ItemTypePicker — Modal for selecting a report item type to add.
 *
 * Displays available item types grouped by category (data, visual, content)
 * with icons, labels, and descriptions. Emits the selected type.
 */

import type { ReportItemTypeMeta } from '~/composables/useReportBuilder'

interface Props {
  /** Available item types */
  itemTypes: ReportItemTypeMeta[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', type: string): void
  (e: 'close'): void
}>()

const categories = computed(() => {
  const groups: Record<string, ReportItemTypeMeta[]> = {
    data: [],
    visual: [],
    content: [],
  }
  for (const item of props.itemTypes) {
    if (groups[item.category]) {
      groups[item.category].push(item)
    }
  }
  return [
    { key: 'data', label: 'Data & Metrics', items: groups.data },
    { key: 'visual', label: 'Visual', items: groups.visual },
    { key: 'content', label: 'Content', items: groups.content },
  ].filter(c => c.items.length > 0)
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/30 backdrop-blur-sm"
      @click="emit('close')"
    />

    <!-- Modal -->
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h3 class="text-lg font-bold text-gray-900">Add Report Section</h3>
          <p class="text-sm text-gray-500 mt-0.5">Choose the type of content to add</p>
        </div>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          @click="emit('close')"
        >
          <font-awesome-icon :icon="['fas', 'times']" />
        </button>
      </div>

      <!-- Categories -->
      <div class="px-6 py-4 max-h-[60vh] overflow-y-auto">
        <div v-for="category in categories" :key="category.key" class="mb-5 last:mb-0">
          <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {{ category.label }}
          </h4>
          <div class="grid grid-cols-1 gap-2">
            <button
              v-for="item in category.items"
              :key="item.type"
              class="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-primary-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer text-left group"
              @click="emit('select', item.type)"
            >
              <div class="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-primary-blue-300/10 flex items-center justify-center shrink-0 transition-colors">
                <font-awesome-icon
                  :icon="['fas', item.icon]"
                  class="text-gray-500 group-hover:text-primary-blue-300 transition-colors"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 group-hover:text-primary-blue-300 transition-colors">
                  {{ item.label }}
                </p>
                <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {{ item.description }}
                </p>
              </div>
              <font-awesome-icon
                :icon="['fas', 'plus-circle']"
                class="text-gray-300 group-hover:text-primary-blue-300 mt-1 shrink-0 transition-colors"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>