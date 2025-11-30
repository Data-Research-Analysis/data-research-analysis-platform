<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useAIDataModelerStore } from '~/stores/ai-data-modeler';
import AiChatMessage from './ai-chat-message.vue';
import AiChatInput from './ai-chat-input.vue';

const aiDataModelerStore = useAIDataModelerStore();
const messagesContainer = ref<HTMLDivElement | null>(null);

// Auto-scroll to bottom when new messages arrive
watch(
    () => aiDataModelerStore.messages.length,
    () => {
        nextTick(() => {
            if (messagesContainer.value) {
                messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
            }
        });
    }
);

function handleSendMessage(message: string) {
    aiDataModelerStore.sendMessage(message);
}

function handleClose() {
    if (!aiDataModelerStore.isLoading && !aiDataModelerStore.isInitializing) {
        aiDataModelerStore.closeDrawer(false);
    }
}

function handleRetry() {
    if (aiDataModelerStore.currentDataSourceId) {
        aiDataModelerStore.initializeConversation(aiDataModelerStore.currentDataSourceId);
    }
}
</script>
<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition-opacity duration-300"
            leave-active-class="transition-opacity duration-300"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
        >
            <div 
                v-if="aiDataModelerStore.isDrawerOpen" 
                class="fixed inset-0 bg-black/50 z-[9999] flex justify-end"
                @click="handleClose"
            >
                <Transition
                    enter-active-class="transition-transform duration-300"
                    leave-active-class="transition-transform duration-300"
                    enter-from-class="translate-x-full"
                    leave-to-class="translate-x-full"
                >
                    <div 
                        v-if="aiDataModelerStore.isDrawerOpen"
                        class="w-[700px] max-w-[90vw] h-screen bg-white flex flex-col shadow-2xl"
                        @click.stop
                    >
                        <!-- Header -->
                        <div class="flex-shrink-0 px-6 py-5 border-b border-gray-200 flex justify-between items-start bg-gray-50">
                            <div class="flex-1">
                                <h2 class="text-xl font-semibold text-gray-800 mb-1">AI Data Modeler</h2>
                                <div v-if="aiDataModelerStore.schemaSummary" class="text-[13px] text-gray-500">
                                    {{ aiDataModelerStore.schemaSummary.tableCount }} tables · 
                                    {{ aiDataModelerStore.schemaSummary.totalColumns }} columns
                                </div>
                            </div>
                            <button 
                                class="flex-shrink-0 w-8 h-8 border-0 bg-transparent cursor-pointer text-gray-500 rounded-md flex items-center justify-center transition-all duration-200 hover:bg-gray-200 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                @click="handleClose"
                                :disabled="aiDataModelerStore.isLoading"
                            >
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke-width="2" 
                                    stroke="currentColor" 
                                    class="w-5 h-5"
                                >
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <!-- Loading State during initialization -->
                        <div v-if="aiDataModelerStore.isInitializing" class="flex-1 flex flex-col items-center justify-center py-12 px-6">
                            <div class="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p class="mt-4 text-gray-500 text-sm">Analyzing your database schema...</p>
                        </div>

                        <!-- Error State -->
                        <div v-else-if="aiDataModelerStore.error" class="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
                            <div class="w-12 h-12 text-red-600 mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-full h-full">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <p class="text-gray-500 text-sm mb-6 max-w-[400px]">{{ aiDataModelerStore.error }}</p>
                            <button 
                                class="px-5 py-2.5 bg-blue-600 text-white border-0 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-200 hover:bg-blue-700"
                                @click="handleRetry"
                            >
                                Try Again
                            </button>
                        </div>

                        <!-- Main Content -->
                        <template v-else>
                            <!-- Messages Container -->
                            <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 bg-white">
                                <div v-if="aiDataModelerStore.messages.length === 0" class="flex flex-col items-center justify-center h-full text-center text-gray-400">
                                    <div class="w-16 h-16 mb-4 text-gray-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                                        </svg>
                                    </div>
                                    <p class="max-w-[300px] text-sm leading-relaxed">Start a conversation to get AI-powered data modeling suggestions</p>
                                </div>

                                <AiChatMessage
                                    v-for="message in aiDataModelerStore.messages"
                                    :key="message.id"
                                    :message="message"
                                />
                            </div>

                            <!-- Input Area -->
                            <AiChatInput
                                :disabled="aiDataModelerStore.isLoading"
                                @send="handleSendMessage"
                            />
                        </template>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
