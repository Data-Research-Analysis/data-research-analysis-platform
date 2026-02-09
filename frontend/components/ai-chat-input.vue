<script setup lang="ts">
import { ref, nextTick } from 'vue';

interface Props {
    disabled?: boolean;
    placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    placeholder: 'Ask about your data model...'
});

const emit = defineEmits<{
    send: [message: string];
}>();

const localMessage = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function adjustHeight() {
    nextTick(() => {
        const textarea = textareaRef.value;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, 150); // Max height of 150px
            textarea.style.height = `${newHeight}px`;
        }
    });
}

function handleSend() {
    if (!props.disabled && localMessage.value.trim()) {
        emit('send', localMessage.value.trim());
        localMessage.value = '';
        
        // Reset textarea height
        nextTick(() => {
            if (textareaRef.value) {
                textareaRef.value.style.height = 'auto';
            }
        });
    }
}

function handleKeydown(event: KeyboardEvent) {
    // Only handle Enter key
    if (event.key !== 'Enter') {
        return;
    }
    
    // If Shift is pressed with Enter, allow new line (don't prevent default)
    if (event.shiftKey) {
        // Let the default behavior happen (insert new line)
        // Adjust height after the newline is added
        nextTick(() => adjustHeight());
        return;
    }
    
    // Send on Enter without Shift
    event.preventDefault();
    handleSend();
}
</script>
<template>
    <div class="border-t border-gray-200 bg-white p-4">
        <div class="flex gap-3 items-end">
            <textarea
                ref="textareaRef"
                v-model="localMessage"
                :placeholder="placeholder"
                :disabled="disabled"
                class="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm leading-6 font-sans outline-none transition-colors duration-200 min-h-[40px] max-h-[150px] overflow-y-auto focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 placeholder:text-gray-400"
                rows="1"
                @keydown="handleKeydown"
                @input="adjustHeight"
            />
            <button
                :disabled="disabled || !localMessage.trim()"
                class="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center transition-colors duration-200 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                @click="handleSend"
            >
                <svg 
                    v-if="!disabled"
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke-width="2" 
                    stroke="currentColor" 
                    class="w-5 h-5"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                <svg 
                    v-else
                    class="w-5 h-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </button>
        </div>
        <div class="text-xs text-gray-500 mt-2">
            Press <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd> to send, 
            <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Shift+Enter</kbd> for new line
        </div>
    </div>
</template>
