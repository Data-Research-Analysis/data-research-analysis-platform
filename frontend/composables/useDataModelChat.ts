import { ref, computed } from 'vue';
import { getAuthToken } from './AuthToken';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  supportingData?: any;
}

/**
 * AI-004: Composable for "Ask AI" natural language queries about a data model.
 * Provides multi-turn conversation with full data model context.
 */
export function useDataModelChat(dataModelId: Ref<number | null>) {
  const baseUrl = () => useRuntimeConfig().public.apiBase;

  const conversationId = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isInitialized = ref(false);

  /**
   * Start a new chat session with the data model context.
   * Must be called before asking questions.
   */
  async function startSession(): Promise<void> {
    if (!dataModelId.value) {
      error.value = 'No data model selected.';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const response = await $fetch<{ success: boolean; conversation_id: string; message: string }>(
        `${baseUrl()}/data-model/${dataModelId.value}/chat/start`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      conversationId.value = response.conversation_id;
      messages.value = [];
      isInitialized.value = true;
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to start chat session.';
      error.value = msg;
      console.error('[useDataModelChat] startSession error:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Send a question to the AI and receive an answer.
   */
  async function askQuestion(question: string): Promise<void> {
    if (!question.trim()) return;

    if (!conversationId.value || !isInitialized.value) {
      await startSession();
      if (!conversationId.value) return;
    }

    // Add user message optimistically
    const userMessage: ChatMessage = {
      role: 'user',
      content: question.trim(),
      timestamp: new Date().toISOString(),
    };
    messages.value.push(userMessage);

    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const response = await $fetch<{
        success: boolean;
        answer: string;
        supporting_data?: any;
      }>(
        `${baseUrl()}/data-model/${dataModelId.value}/chat/ask`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: {
            question: question.trim(),
            conversation_id: conversationId.value,
          },
        }
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        supportingData: response.supporting_data,
      };
      messages.value.push(assistantMessage);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to get AI response.';
      error.value = msg;

      // Remove the optimistically added user message on error
      const idx = messages.value.lastIndexOf(userMessage);
      if (idx >= 0) messages.value.splice(idx, 1);

      console.error('[useDataModelChat] askQuestion error:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Clear the conversation and start fresh.
   */
  async function clearConversation(): Promise<void> {
    conversationId.value = null;
    messages.value = [];
    isInitialized.value = false;
    error.value = null;
    // Start a fresh session if we have a data model
    if (dataModelId.value) {
      await startSession();
    }
  }

  const hasMessages = computed(() => messages.value.length > 0);
  const messageCount = computed(() => messages.value.length);

  return {
    messages,
    isLoading,
    error,
    isInitialized,
    conversationId,
    hasMessages,
    messageCount,
    startSession,
    askQuestion,
    clearConversation,
  };
}