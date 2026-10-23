<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';
import { useMarkdown } from '~/composables/useMarkdown';
import AiChatInput from '@/components/ai-chat-input.vue';

const store = usePaidMediaPlansStore();
const { renderMarkdown } = useMarkdown();

const composerText = ref('');
const isSending = ref(false);

const streamingRendered = computed(() => renderMarkdown(store.streamingText));

async function onSend(text: string) {
    if (!store.currentPlan || isSending.value) return;
    isSending.value = true;
    try {
        await store.sendMessage(store.currentPlan.id, text, true);
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

watch(() => [store.messages.length, store.streamingText], () => scrollToBottom());
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
            <div v-if="store.messages.length === 0 && !store.waitingStep" class="px-4 py-8 text-center text-sm text-gray-500">
                The plan builds step by step here. Ask anything, or use the buttons on each step.
            </div>
            <PlanChatMessage v-for="message in store.messages" :key="message.id" :message="message" />
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
