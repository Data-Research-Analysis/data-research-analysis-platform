<template>
  <!-- User bubble -->
  <div
    v-if="msg.role === 'user'"
    class="flex flex-col gap-1 max-w-4/5 self-end"
  >
    <div
      class="px-4 py-3 rounded-xl leading-normal prose prose-sm max-w-none bg-blue-500 text-white prose-invert"
      v-html="rendered"
    ></div>
    <span class="text-xs text-gray-400 px-2 text-right">{{ formattedTime }}</span>
  </div>

  <!-- Assistant bubble -->
  <div
    v-else-if="msg.role === 'assistant'"
    class="flex flex-col gap-1 max-w-4/5 self-start"
  >
    <div
      class="px-4 py-3 rounded-xl leading-normal prose prose-sm max-w-none bg-gray-50 text-gray-800 border border-gray-200"
      v-html="rendered"
    ></div>
    <div class="flex items-center justify-between px-2 gap-3">
      <span class="text-xs text-gray-400">{{ formattedTime }}</span>
      <button
        v-if="canAddToDashboard"
        class="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
        @click="$emit('add-to-dashboard', msg)"
      >
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-3 h-3" />
        Add to Dashboard
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMarkdown } from '@/composables/useMarkdown';

interface Props {
  msg: {
    role: 'user' | 'assistant' | 'system';
    content: string | object;
    timestamp: string;
  };
  canAddToDashboard?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  canAddToDashboard: false,
});

defineEmits<{
  (e: 'add-to-dashboard', msg: Props['msg']): void;
}>();

const { renderMarkdown } = useMarkdown();

const rendered = computed(() =>
  renderMarkdown(
    typeof props.msg.content === 'string'
      ? props.msg.content
      : JSON.stringify(props.msg.content, null, 2)
  )
);

function formatTime(timestamp: string): string {
  if (!import.meta.client) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const formattedTime = computed(() => formatTime(props.msg.timestamp));
</script>
