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

// Parse data quality JSON responses and extract display_message
const parseDataQualityResponse = (content: string): { type: 'json' | 'markdown', displayMessage: string, rawJson?: any } => {
    // Try to parse JSON from code blocks
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/;
    const match = content.match(jsonBlockRegex);
    
    if (match) {
        try {
            const jsonData = JSON.parse(match[1]);
            // Check if it's a data quality response
            if (jsonData.display_message) {
                return {
                    type: 'json',
                    displayMessage: jsonData.display_message,
                    rawJson: jsonData
                };
            }
        } catch (e) {
            // Not valid JSON or not a data quality response
        }
    }
    
    return { type: 'markdown', displayMessage: content };
};

// Render markdown for assistant messages
const renderedContent = computed(() => {
    if (isUser.value) {
        return props.message.content;
    }
    
    try {
        // Check if this is a data quality JSON response
        const parsed = parseDataQualityResponse(props.message.content);
        
        if (parsed.type === 'json' && parsed.displayMessage) {
            // Render the display_message as markdown
            return marked.parse(parsed.displayMessage, {
                breaks: true,
                gfm: true
            });
        }
        
        // Regular markdown rendering
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
        :class="[
            'flex mb-4 opacity-0 translate-y-2.5 transition-all duration-300 ease',
            isVisible && 'opacity-100 translate-y-0',
            isUser ? 'justify-end' : 'justify-start'
        ]"
    >
        <div :class="[
            'max-w-[80%] flex flex-col gap-1',
        ]">
            <!-- User Message (plain text) -->
            <div 
                v-if="isUser"
                class="p-3 px-4 rounded-lg break-words bg-blue-100 text-blue-900"
            >
                {{ message.content }}
            </div>
            
            <!-- Assistant Message (markdown rendered) -->
            <div 
                v-else
                class="p-3 px-4 rounded-lg break-words bg-gray-100 text-gray-900 markdown-content
                    [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:font-semibold [&_h1]:leading-tight
                    [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:leading-tight
                    [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:leading-tight
                    [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-semibold [&_h4]:leading-tight
                    [&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:font-semibold [&_h5]:leading-tight
                    [&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:font-semibold [&_h6]:leading-tight
                    [&_h1]:text-2xl [&_h1]:border-b [&_h1]:border-gray-200 [&_h1]:pb-2
                    [&_h2]:text-xl [&_h2]:border-b [&_h2]:border-gray-200 [&_h2]:pb-2
                    [&_h3]:text-lg
                    [&_p]:mb-3 [&_p]:leading-relaxed
                    [&_ul]:mb-3 [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:pl-6
                    [&_li]:mb-1 [&_li]:leading-relaxed
                    [&_code]:bg-gray-200 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-red-600
                    [&_pre]:bg-gray-800 [&_pre]:text-gray-50 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-3
                    [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_pre_code]:text-sm
                    [&_blockquote]:border-l-4 [&_blockquote]:border-gray-400 [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:text-gray-500 [&_blockquote]:italic
                    [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_table]:text-sm
                    [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_td]:text-left
                    [&_th]:bg-gray-200 [&_th]:font-semibold
                    [&_tr:nth-child(even)]:bg-gray-50
                    [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-700
                    [&_hr]:border-t [&_hr]:border-gray-200 [&_hr]:my-4
                    [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                v-html="renderedContent"
            ></div>
            
            <!-- Timestamp -->
            <div :class="[
                'text-xs text-gray-400 px-1',
                isUser ? 'text-right' : 'text-left'
            ]">
                {{ formattedTimestamp }}
            </div>
        </div>
    </div>
</template>
