<script setup lang="ts">
import type { IPlanMessage } from '@/stores/paid_media_plans';
import { useMarkdown } from '~/composables/useMarkdown';

const props = defineProps<{
    message: IPlanMessage;
}>();

const { renderMarkdown } = useMarkdown();

const isAssistant = computed(() => props.message.role === 'assistant');
const isUser = computed(() => props.message.role === 'user');
const isTool = computed(() => props.message.role === 'tool');

const rendered = computed(() => {
    if (!isAssistant.value) return '';
    return renderMarkdown(props.message.content || '');
});
</script>

<template>
    <div class="flex gap-2 px-4 py-2" :class="isUser ? 'flex-row-reverse' : ''">
        <div class="max-w-[85%] min-w-0">
            <div v-if="isUser" class="bg-primary-blue-100 text-white rounded-2xl rounded-tr-sm px-4 py-2 whitespace-pre-wrap break-words">
                {{ message.content }}
            </div>
            <div v-else-if="isAssistant" class="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2 break-words overflow-hidden">
                <div class="prose prose-sm max-w-none [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:max-w-full" v-html="rendered" />
            </div>
            <div v-else class="bg-transparent border border-dashed border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-500">
                <span class="font-medium">{{ message.metadata?.tool_name ?? 'tool' }}</span>
                <span v-if="message.content" class="ml-1 truncate max-w-[60ch] inline-block align-bottom">{{ message.content }}</span>
            </div>
        </div>
    </div>
</template>
