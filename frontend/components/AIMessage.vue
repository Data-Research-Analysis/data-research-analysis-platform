<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { marked } from 'marked';
import type { IMessage } from '~/types/IAIDataModeler';

const props = defineProps<{
    message: IMessage;
}>();

const isVisible = ref(false);

// Determine if this is a user message
const isUser = computed(() => props.message.role === 'user');

// Format timestamp to relative time
const formattedTimestamp = computed(() => {
    const now = new Date();
    const messageTime = new Date(props.message.timestamp);
    const diffInSeconds = Math.floor((now.getTime() - messageTime.getTime()) / 1000);
    
    if (diffInSeconds < 10) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
});

// Render markdown for assistant messages
const renderedContent = computed(() => {
    if (isUser.value) {
        return props.message.content;
    }
    
    try {
        return marked.parse(props.message.content, {
            breaks: true,
            gfm: true
        });
    } catch (error) {
        console.error('Error parsing markdown:', error);
        return props.message.content;
    }
});

// Trigger slide-in animation on mount
onMounted(() => {
    setTimeout(() => {
        isVisible.value = true;
    }, 10);
});
</script>

<template>
    <div 
        class="message-wrapper"
        :class="[
            isUser ? 'message-user' : 'message-assistant',
            isVisible ? 'message-visible' : 'message-hidden'
        ]"
    >
        <div class="message-content-wrapper" :class="isUser ? 'user-content' : 'assistant-content'">
            <!-- User Message (plain text) -->
            <div 
                v-if="isUser"
                class="message-content message-user-content"
            >
                {{ message.content }}
            </div>
            
            <!-- Assistant Message (markdown rendered) -->
            <div 
                v-else
                class="message-content message-assistant-content markdown-content"
                v-html="renderedContent"
            ></div>
            
            <!-- Timestamp -->
            <div class="message-timestamp" :class="isUser ? 'user-timestamp' : 'assistant-timestamp'">
                {{ formattedTimestamp }}
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Message wrapper and positioning */
.message-wrapper {
    display: flex;
    margin-bottom: 1rem;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.message-visible {
    opacity: 1;
    transform: translateY(0);
}

.message-user {
    justify-content: flex-end;
}

.message-assistant {
    justify-content: flex-start;
}

/* Content wrapper */
.message-content-wrapper {
    max-width: 80%;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

/* Message content bubble */
.message-content {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

.message-user-content {
    background-color: #dbeafe;
    color: #1e40af;
}

.message-assistant-content {
    background-color: #f3f4f6;
    color: #111827;
}

/* Timestamp */
.message-timestamp {
    font-size: 0.75rem;
    color: #9ca3af;
    padding: 0 0.25rem;
}

.user-timestamp {
    text-align: right;
}

.assistant-timestamp {
    text-align: left;
}

/* Markdown content styling */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    line-height: 1.25;
}

.markdown-content :deep(h1) {
    font-size: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.5rem;
}

.markdown-content :deep(h2) {
    font-size: 1.25rem;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.5rem;
}

.markdown-content :deep(h3) {
    font-size: 1.125rem;
}

.markdown-content :deep(p) {
    margin-bottom: 0.75rem;
    line-height: 1.6;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
}

.markdown-content :deep(li) {
    margin-bottom: 0.25rem;
    line-height: 1.6;
}

.markdown-content :deep(code) {
    background-color: #e5e7eb;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-family: 'Courier New', Courier, monospace;
    color: #dc2626;
}

.markdown-content :deep(pre) {
    background-color: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 0.75rem;
}

.markdown-content :deep(pre code) {
    background-color: transparent;
    padding: 0;
    color: inherit;
    font-size: 0.875rem;
}

.markdown-content :deep(blockquote) {
    border-left: 4px solid #9ca3af;
    padding-left: 1rem;
    margin: 0.75rem 0;
    color: #6b7280;
    font-style: italic;
}

.markdown-content :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
    border: 1px solid #d1d5db;
    padding: 0.5rem;
    text-align: left;
}

.markdown-content :deep(th) {
    background-color: #e5e7eb;
    font-weight: 600;
}

.markdown-content :deep(tr:nth-child(even)) {
    background-color: #f9fafb;
}

.markdown-content :deep(a) {
    color: #2563eb;
    text-decoration: underline;
}

.markdown-content :deep(a:hover) {
    color: #1d4ed8;
}

.markdown-content :deep(hr) {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 1rem 0;
}

.markdown-content :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 0.75rem 0;
}

/* First and last element margin adjustments */
.markdown-content :deep(> *:first-child) {
    margin-top: 0;
}

.markdown-content :deep(> *:last-child) {
    margin-bottom: 0;
}
</style>
