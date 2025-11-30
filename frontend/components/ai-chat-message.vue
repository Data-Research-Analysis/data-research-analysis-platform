<script setup lang="ts">
import { marked } from 'marked';
import type { IMessage } from '~/types/IAIDataModeler';

const props = defineProps<{
    message: IMessage;
}>();

// Configure marked for safe rendering
marked.setOptions({
    breaks: true,
    gfm: true, // GitHub Flavored Markdown
});

const renderedContent = computed(() => {
    if (props.message.role === 'assistant') {
        return marked.parse(props.message.content);
    }
    return props.message.content;
});

function formatTimestamp(timestamp: Date): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
</script>

<template>
    <div 
        :class="[
            'mb-4 flex flex-col',
            message.role === 'user' ? 'items-end' : 'items-start'
        ]"
    >
        <div 
            :class="[
                'max-w-[85%] px-4 py-3 rounded-xl break-words',
                message.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-sm' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            ]"
        >
            <div 
                v-if="message.role === 'assistant'" 
                class="[&>h1]:mt-4 [&>h1]:mb-2 [&>h1]:font-semibold [&>h1]:text-gray-800 [&>h1]:text-xl [&>h1]:border-b-2 [&>h1]:border-gray-200 [&>h1]:pb-2 [&>h2]:mt-4 [&>h2]:mb-2 [&>h2]:font-semibold [&>h2]:text-gray-800 [&>h2]:text-lg [&>h3]:mt-4 [&>h3]:mb-2 [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:text-base [&>p]:mb-3 [&>p]:leading-relaxed [&>ul]:mb-3 [&>ul]:pl-6 [&>ol]:mb-3 [&>ol]:pl-6 [&>li]:mb-1 [&_code]:bg-gray-200 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[13px] [&>pre]:bg-gray-800 [&>pre]:text-gray-100 [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:mb-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-gray-100 [&>table]:w-full [&>table]:border-collapse [&>table]:mb-3 [&>table]:text-sm [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-gray-200 [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:text-left [&_tr:nth-child(even)]:bg-gray-50 [&_strong]:font-semibold [&_strong]:text-gray-800 [&_em]:italic [&>blockquote]:border-l-4 [&>blockquote]:border-blue-600 [&>blockquote]:pl-4 [&>blockquote]:my-3 [&>blockquote]:text-gray-600 [&>blockquote]:italic"
                v-html="renderedContent"
            />
            <div 
                v-else 
                class="whitespace-pre-wrap"
            >
                {{ message.content }}
            </div>
        </div>
        <div class="text-[11px] text-gray-400 mt-1 px-2">
            {{ formatTimestamp(message.timestamp) }}
        </div>
    </div>
</template>
