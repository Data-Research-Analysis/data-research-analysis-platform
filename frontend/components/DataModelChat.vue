<template>
  <div class="flex flex-col h-full border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b bg-gray-50 dark:bg-gray-900 rounded-t-lg">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">Ask AI About This Data</h3>
      </div>
      <button
        v-if="hasMessages"
        class="text-xs text-gray-500 hover:text-red-500 transition-colors"
        @click="handleClear"
        title="Clear conversation"
      >
        Clear
      </button>
    </div>

    <!-- Messages Area -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-[200px] max-h-[500px]">
      <!-- Empty State -->
      <div v-if="!hasMessages && !isLoading" class="flex flex-col items-center justify-center h-full text-center py-8">
        <svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
        <p class="text-sm text-gray-400 dark:text-gray-500 mb-1">Ask a question about your data</p>
        <div class="flex flex-wrap gap-2 mt-3 max-w-xs justify-center">
          <button
            v-for="suggestion in suggestedQuestions"
            :key="suggestion"
            class="text-xs px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            @click="handleSuggestion(suggestion)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <!-- Messages -->
      <template v-for="(msg, idx) in messages" :key="idx">
        <!-- User Message -->
        <div v-if="msg.role === 'user'" class="flex justify-end">
          <div class="max-w-[80%] bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2.5">
            <p class="text-sm whitespace-pre-wrap">{{ msg.content }}</p>
          </div>
        </div>

        <!-- Assistant Message -->
        <div v-else class="flex justify-start">
          <div class="max-w-[85%] bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
            <div class="flex items-center gap-1.5 mb-1.5">
              <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">AI</span>
            </div>
            <div class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed" v-html="formatAnswer(msg.content)"></div>

            <!-- Supporting Data Table -->
            <div v-if="msg.supportingData?.rows?.length" class="mt-3 border-t dark:border-gray-600 pt-2">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Supporting Data:</p>
              <div class="overflow-x-auto">
                <table class="text-xs w-full">
                  <thead>
                    <tr class="border-b dark:border-gray-600">
                      <th
                        v-for="col in msg.supportingData.columns"
                        :key="col"
                        class="text-left py-1 px-2 font-medium text-gray-500 dark:text-gray-400"
                      >
                        {{ col }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, ridx) in msg.supportingData.rows.slice(0, 10)" :key="ridx" class="border-b dark:border-gray-700">
                      <td v-for="col in msg.supportingData.columns" :key="col" class="py-1 px-2 text-gray-700 dark:text-gray-300">
                        {{ formatCell(row[col]) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="msg.supportingData.rows.length > 10" class="text-xs text-gray-400 mt-1">
                  Showing 10 of {{ msg.supportingData.rows.length }} rows
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="flex justify-start">
        <div class="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
          <div class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span class="text-sm text-gray-500 dark:text-gray-400">Thinking...</span>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error && !isLoading" class="flex justify-center">
        <div class="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-2 text-sm">
          {{ error }}
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="border-t px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
      <form @submit.prevent="handleSubmit" class="flex gap-2">
        <input
          v-model="inputValue"
          type="text"
          placeholder="Ask a question about your data model..."
          class="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400"
          :disabled="isLoading"
          @keydown.enter.prevent="handleSubmit"
        />
        <button
          type="submit"
          :disabled="!inputValue.trim() || isLoading"
          class="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import { useDataModelChat } from '~/composables/useDataModelChat';

const props = defineProps<{
  dataModelId: number | null;
}>();

const dataModelIdRef = computed(() => props.dataModelId);
const {
  messages,
  isLoading,
  error,
  isInitialized,
  hasMessages,
  messageCount,
  startSession,
  askQuestion,
  clearConversation,
} = useDataModelChat(dataModelIdRef);

const inputValue = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

const suggestedQuestions = [
  'What are the key metrics?',
  'Show me a summary',
  'Any data quality issues?',
  'What trends can you find?',
];

// Auto-scroll to bottom when new messages arrive
watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  }
);

// Auto-start session when component mounts if we have a data model
onMounted(async () => {
  if (props.dataModelId) {
    await startSession();
  }
});

// Re-init if dataModelId changes
watch(
  () => props.dataModelId,
  async (newId) => {
    if (newId && !isInitialized.value) {
      await startSession();
    }
  }
);

async function handleSubmit() {
  const q = inputValue.value.trim();
  if (!q || isLoading.value) return;
  inputValue.value = '';
  await askQuestion(q);
}

function handleSuggestion(question: string) {
  inputValue.value = question;
  handleSubmit();
}

async function handleClear() {
  inputValue.value = '';
  await clearConversation();
}

function formatAnswer(text: string): string {
  // Simple markdown-like formatting: **bold**, bullet points
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-•]\s+/gm, '• ')
    .replace(/\n/g, '<br>');
}

function formatCell(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return String(value);
}
</script>