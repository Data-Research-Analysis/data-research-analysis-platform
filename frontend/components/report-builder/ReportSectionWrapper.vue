<script setup lang="ts">
/**
 * ReportSectionWrapper — Drag & drop wrapper for report builder sections.
 *
 * Wraps each report section with a drag handle, action buttons (move up/down,
 * duplicate, delete), and visual drag state indicators. Emits events for
 * all interactions so the parent can delegate to the composable.
 */

interface Props {
  /** Section unique key */
  sectionKey: string
  /** Current index in the sections array */
  index: number
  /** Total number of sections */
  totalSections: number
  /** Item type label for display */
  typeLabel: string
  /** Item type icon */
  typeIcon: string
  /** Whether this section is selected for editing */
  selected: boolean
  /** Whether drag is active on this section */
  isDragging: boolean
  /** Whether a dragged item is over this section */
  isDragOver: boolean
  /** Whether the section is visible */
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'remove'): void
  (e: 'duplicate'): void
  (e: 'toggle-visibility'): void
  (e: 'move-up'): void
  (e: 'move-down'): void
  (e: 'drag-start', event: DragEvent): void
  (e: 'drag-over', event: DragEvent): void
  (e: 'drag-leave', event: DragEvent): void
  (e: 'drop', event: DragEvent): void
  (e: 'drag-end'): void
}>()

const showActions = ref(false)

function handleDragStart(event: DragEvent) {
  emit('drag-start', event)
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  emit('drag-over', event)
}

function handleDragLeave(event: DragEvent) {
  emit('drag-leave', event)
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  emit('drop', event)
}

function handleDragEnd() {
  emit('drag-end')
}
</script>

<template>
  <div
    class="group relative rounded-xl border-2 transition-all duration-200"
    :class="[
      isDragging ? 'opacity-50 border-dashed border-blue-400 bg-blue-50/50 scale-[0.98]' : '',
      isDragOver && !isDragging ? 'border-blue-400 bg-blue-50/30 shadow-lg shadow-blue-100' : '',
      selected ? 'border-primary-blue-300 bg-blue-50/20 shadow-sm' : 'border-gray-200 bg-white',
      !visible ? 'opacity-40' : '',
      !isDragging && !isDragOver ? 'hover:border-gray-300 hover:shadow-sm' : '',
    ]"
    draggable="true"
    @mouseenter="showActions = true"
    @mouseleave="showActions = false"
    @click="emit('select')"
    @dragstart="handleDragStart"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @dragend="handleDragEnd"
  >
    <!-- Top bar: drag handle + type label + actions -->
    <div
      class="flex items-center gap-2 px-4 py-2.5 border-b transition-colors"
      :class="selected ? 'border-primary-blue-300/30 bg-blue-50/40' : 'border-gray-100 bg-gray-50/50'"
    >
      <!-- Drag handle -->
      <div
        class="flex items-center justify-center w-6 h-6 rounded cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
        title="Drag to reorder"
      >
        <font-awesome-icon :icon="['fas', 'grip-vertical']" class="text-sm" />
      </div>

      <!-- Type icon + label -->
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <font-awesome-icon :icon="['fas', typeIcon]" class="text-xs text-gray-400" />
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
          {{ typeLabel }}
        </span>
        <span v-if="!visible" class="text-xs text-gray-400 italic">(hidden)</span>
      </div>

      <!-- Action buttons -->
      <div
        class="flex items-center gap-0.5 transition-opacity"
        :class="showActions || selected ? 'opacity-100' : 'opacity-0'"
      >
        <button
          v-if="index > 0"
          class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          title="Move up"
          @click.stop="emit('move-up')"
        >
          <font-awesome-icon :icon="['fas', 'chevron-up']" class="text-xs" />
        </button>
        <button
          v-if="index < totalSections - 1"
          class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          title="Move down"
          @click.stop="emit('move-down')"
        >
          <font-awesome-icon :icon="['fas', 'chevron-down']" class="text-xs" />
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          :title="visible ? 'Hide section' : 'Show section'"
          @click.stop="emit('toggle-visibility')"
        >
          <font-awesome-icon :icon="['fas', visible ? 'eye' : 'eye-slash']" class="text-xs" />
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          title="Duplicate section"
          @click.stop="emit('duplicate')"
        >
          <font-awesome-icon :icon="['fas', 'copy']" class="text-xs" />
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          title="Remove section"
          @click.stop="emit('remove')"
        >
          <font-awesome-icon :icon="['fas', 'trash']" class="text-xs" />
        </button>
      </div>
    </div>

    <!-- Content slot -->
    <div class="p-5" :class="{ 'pointer-events-none': isDragging }">
      <slot />
    </div>
  </div>
</template>