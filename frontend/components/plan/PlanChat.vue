<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';
import { useMarkdown } from '~/composables/useMarkdown';
import { useApiErrorHandler } from '@/composables/useApiErrorHandler';
import AiChatInput from '@/components/ai-chat-input.vue';

const store = usePaidMediaPlansStore();
const { renderMarkdown } = useMarkdown();
const { handle402Error } = useApiErrorHandler();

const composerText = ref('');
const isSending = ref(false);

const streamingRendered = computed(() => renderMarkdown(store.streamingText));

// The build loop records a placeholder message for every tool call (empty
// assistant bubble) and a raw JSON row for every tool response. They are
// internal bookkeeping, not conversation — hide them so the chat shows only
// real user turns and assistant answers.
const visibleMessages = computed(() =>
    store.messages.filter((message) => {
        if (message.role === 'user') {
            // Hide the internal "Run step N ..." prompts the build loop records
            // as user turns — they are automation, not conversation.
            const trigger = (message.metadata as Record<string, any> | null)?.trigger;
            return trigger !== 'auto';
        }
        if (message.role === 'tool') return false;
        if (message.role === 'assistant' && !(message.content ?? '').trim()) return false;
        return true;
    })
);

async function onSend(text: string) {
    if (!store.currentPlan || isSending.value) return;
    isSending.value = true;
    try {
        await store.sendMessage(store.currentPlan.id, text, true);
    } catch (error: any) {
        if (error?.status === 402) {
            await handle402Error(error?.data ?? error);
        }
    } finally {
        isSending.value = false;
    }
}

function answerGateWith(gateId: string, answer: string) {
    if (!store.currentPlan) return;
    store.answerGate(store.currentPlan.id, gateId, answer);
}

async function scrollToBottom() {
    await nextTick();
    const el = document.getElementById('plan-chat-scroll');
    if (el) el.scrollTop = el.scrollHeight;
}

watch(() => [store.messages.length, store.isThinking, store.streamingText], () => scrollToBottom());
onMounted(() => scrollToBottom());
</script>

<template>
    <div class="flex flex-col h-full">
        <div id="plan-chat-scroll" class="flex-1 overflow-y-auto divide-y divide-gray-100">
            <PlanGatePrompt
                v-if="store.waitingStep?.gate"
                :gate="store.waitingStep.gate"
                class="px-4 py-3"
                @answer="answerGateWith"
            />
            <div v-if="visibleMessages.length === 0 && !store.waitingStep" class="px-4 py-8 text-center text-sm text-gray-500">
                The plan is built. Ask about any step or deliverable, or request a change.
            </div>
            <PlanChatMessage v-for="message in visibleMessages" :key="message.id" :message="message" />
            <div v-if="store.chatError" class="px-4 py-2">
                <div class="flex items-start justify-between gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    <span class="break-words min-w-0">{{ store.chatError }}</span>
                    <button type="button" class="shrink-0 p-0.5 rounded hover:bg-red-100 cursor-pointer" @click="store.clearChatError()">
                        <font-awesome-icon :icon="['fas', 'xmark']" />
                    </button>
                </div>
            </div>
            <div v-if="store.isThinking" class="px-4 py-2">
                <div class="flex items-start gap-2">
                    <div class="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-sm px-4 py-2 text-sm flex items-center gap-2">
                        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin" />
                        Thinking
                    </div>
                </div>
            </div>
            <div v-if="store.streamingText" class="px-4 py-2">
                <div class="flex items-start gap-2">
                    <div class="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2 prose prose-sm max-w-none break-words overflow-hidden [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:max-w-full" v-html="streamingRendered" />
                </div>
            </div>
        </div>
        <div class="p-2 border-t border-gray-100">
            <AiChatInput placeholder="Ask about your plan, or type a change..." :disabled="isSending" resizable :max-height="400" @send="onSend" />
        </div>
    </div>
</template>
