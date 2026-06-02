<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

/**
 * TextBlock — Report Item Component (RPT-004)
 *
 * An editable markdown text block with live preview.
 * Supports headings, bold, italic, bullet lists, and links.
 * Features edit/preview toggle and auto-save on blur.
 */

interface Props {
  /** Initial markdown content */
  modelValue?: string
  /** Placeholder text when content is empty */
  placeholder?: string
  /** Whether the block is editable (false = preview only) */
  editable?: boolean
  /** Minimum height in pixels */
  minHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Start writing… Use markdown for formatting (# Heading, **bold**, *italic*, - list, [text](url))',
  editable: true,
  minHeight: 80,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': [value: string]
}>()

// ── State ──────────────────────────────────────────────
const isEditing = ref(false)
const content = ref(props.modelValue)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isSaving = ref(false)

// Sync content when modelValue changes externally
watch(() => props.modelValue, (newVal) => {
  if (newVal !== content.value) {
    content.value = newVal
  }
})

// ── Markdown Rendering ─────────────────────────────────
/**
 * Lightweight markdown → HTML renderer.
 * Supports: headings (#, ##, ###), bold (**), italic (*),
 * bullet lists (- or *), links [text](url), and line breaks.
 */
function renderMarkdown(md: string): string {
  if (!md) return ''

  let html = md

  // Escape HTML entities (prevent XSS)
  html = html
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')

  // Headings (must be processed line by line)
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-800 mt-4 mb-2">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-gray-800 mt-4 mb-2">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-4 mb-2">$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Links [text](url)
  html = html.replace(
    /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>'
  )

  // Unordered lists: consecutive lines starting with - or *
  html = html.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-2 space-y-1">$1</ul>')

  // Paragraphs: double newlines
  html = html.replace(/\n\n/g, '</p><p class="mb-3">')

  // Single newlines → <br>
  html = html.replace(/\n/g, '<br>')

  // Wrap in paragraph
  if (html && !html.startsWith('<h') && !html.startsWith('<ul')) {
    html = `<p class="mb-3">${html}</p>`
  }

  return html
}

const renderedHtml = computed(() => renderMarkdown(content.value))
const isEmpty = computed(() => !content.value.trim())

// ── Edit / Preview Toggle ──────────────────────────────
function enterEditMode() {
  if (!props.editable) return
  isEditing.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function exitEditMode() {
  isEditing.value = false
  emit('update:modelValue', content.value)
  emit('save', content.value)
}

// ── Auto-save on blur ──────────────────────────────────
function handleBlur() {
  // Only auto-save if content changed
  if (content.value !== props.modelValue) {
    emit('update:modelValue', content.value)
    emit('save', content.value)
  }
  // Switch to preview mode on blur
  isEditing.value = false
}

// ── Keyboard shortcut ──────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + Enter to save and exit edit mode
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    exitEditMode()
  }
  // Escape to cancel editing
  if (e.key === 'Escape') {
    e.preventDefault()
    content.value = props.modelValue
    isEditing.value = false
  }
}

// ── Textarea auto-resize ───────────────────────────────
function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.max(props.minHeight, el.scrollHeight)}px`
}

watch(content, () => {
  nextTick(autoResize)
})
</script>

<template>
  <div class="report-text-block group relative rounded-lg border border-gray-200 bg-white">
    <!-- Toolbar (edit mode) -->
    <div
      v-if="isEditing"
      class="flex items-center justify-between border-b border-gray-100 px-4 py-2 bg-gray-50 rounded-t-lg"
    >
      <div class="flex items-center gap-1">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Markdown Editor</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
          @click="isEditing = false; content = props.modelValue"
        >
          Cancel
        </button>
        <button
          class="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          @click="exitEditMode"
        >
          Done
        </button>
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-if="isEditing" class="p-4">
      <textarea
        ref="textareaRef"
        v-model="content"
        :placeholder="placeholder"
        :style="{ minHeight: `${minHeight}px` }"
        class="w-full resize-none rounded border-0 bg-transparent p-0 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 leading-relaxed font-mono"
        @blur="handleBlur"
        @keydown="handleKeydown"
        @input="autoResize"
      />
      <div class="mt-2 flex items-center gap-3 text-xs text-gray-400">
        <span>Supports: <code class="bg-gray-100 px-1 rounded"># heading</code> <code class="bg-gray-100 px-1 rounded">**bold**</code> <code class="bg-gray-100 px-1 rounded">*italic*</code> <code class="bg-gray-100 px-1 rounded">- list</code> <code class="bg-gray-100 px-1 rounded">[link](url)</code></span>
        <span class="ml-auto">Ctrl+Enter to save · Esc to cancel</span>
      </div>
    </div>

    <!-- Preview Mode -->
    <div
      v-else
      class="p-4 prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed cursor-text"
      :class="{ 'min-h-[80px]': !isEmpty, 'min-h-[80px] flex items-center justify-center': isEmpty }"
      @click="enterEditMode"
    >
      <!-- Empty state -->
      <div
        v-if="isEmpty"
        class="text-gray-400 text-sm italic select-none"
      >
        {{ editable ? 'Click to add text...' : 'No content' }}
      </div>
      <!-- Rendered content -->
      <div
        v-else
        v-html="renderedHtml"
      />
    </div>

    <!-- Edit indicator (hover, only in preview + editable) -->
    <div
      v-if="!isEditing && editable"
      class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <button
        class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white/80 hover:bg-white border border-gray-200 rounded shadow-sm backdrop-blur-sm transition-colors"
        @click.stop="enterEditMode"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Edit
      </button>
    </div>
  </div>
</template>