<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useAIDataModelerStore } from '~/stores/ai-data-modeler';
import AIMessage from './AIMessage.vue';
import LoadingDots from './LoadingDots.vue';
import AIModelPreview from './AIModelPreview.vue';

const aiDataModelerStore = useAIDataModelerStore();
const userInput = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const showHelpModal = ref(false);

// Suggested starter questions
const suggestions = computed(() => {
    const summary = aiDataModelerStore.schemaSummary;
    if (!summary) return [];
    
    return [
        `Analyze ${summary.tableCount} tables for trends`,
        'Show me sales by region',
        'Compare customer segments',
        'Track revenue over time'
    ];
});

// Dynamic example prompts for empty state
const examplePrompts = computed(() => {
    const summary = aiDataModelerStore.schemaSummary;
    if (!summary) {
        return [
            'What tables and columns do I have?',
            'Show me relationships between tables',
            'What kind of models can I create?'
        ];
    }
    
    return [
        `Describe my ${summary.tableCount} tables in detail`,
        'Can I join these tables together?',
        'Create a sales analysis model',
        'What insights can I get from this data?'
    ];
});

// Model detection - check if a model exists in the store
// (backend now sends clean text, so we can't parse message content)
const lastMessageHasModel = computed(() => {
    // Check if there's a model draft and it's recent (updated with last message)
    return !!aiDataModelerStore.modelDraft;
});

function messageContainsDataModel(content: string): boolean {
    // Legacy detection - kept for backward compatibility but not used
    return content.includes('"action": "BUILD_DATA_MODEL"');
}

// Model application state
const isApplyingModel = ref(false);
const buttonState = ref<'normal' | 'loading' | 'success'>('normal');
const showModelPreview = ref(false);

async function handleApplyModel() {
    if (!aiDataModelerStore.modelDraft) return;
    
    try {
        buttonState.value = 'loading';
        isApplyingModel.value = true;
        
        // Trigger the model application
        aiDataModelerStore.applyModelToBuilder();
        
        // Wait briefly for watcher to trigger
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Show success
        buttonState.value = 'success';
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Close drawer after success
        aiDataModelerStore.closeDrawer(false);
    } catch (error) {
        console.error('Error applying model:', error);
        buttonState.value = 'normal';
    } finally {
        isApplyingModel.value = false;
        setTimeout(() => {
            buttonState.value = 'normal';
        }, 1000);
    }
}

// Auto-scroll to bottom when new messages arrive
watch(() => aiDataModelerStore.messages.length, async () => {
    await nextTick();
    scrollToBottom();
});

function scrollToBottom() {
    if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
}

async function sendMessage() {
    if (!userInput.value.trim() || aiDataModelerStore.isLoading) return;
    
    const message = userInput.value.trim();
    userInput.value = '';
    
    // Send message in chat mode (not template mode)
    await aiDataModelerStore.sendMessage(message);
    scrollToBottom();
}

function useSuggestion(suggestion: string) {
    userInput.value = suggestion;
}

onMounted(() => {
    scrollToBottom();
});
</script>

<template>
    <div class="flex flex-col h-full bg-white">
        <!-- Header with Info Icon -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <h3 class="font-semibold text-gray-800">Chat with AI</h3>
            <button 
                @click="showHelpModal = true"
                class="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                title="How to use this chat"
            >
                <font-awesome icon="fas fa-circle-info" class="w-5 h-5" />
            </button>
        </div>
        
        <!-- Messages Area (Scrollable) -->
        <div 
            ref="messagesContainer"
            class="flex-1 overflow-y-auto p-6 space-y-4">
            
            <!-- Empty State Welcome -->
            <div v-if="aiDataModelerStore.messages.length === 0" class="flex items-center justify-center h-full">
                <div class="max-w-2xl text-center px-4">
                    <div class="text-6xl mb-4">🤖</div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-2">AI Data Modeler</h2>
                    <p class="text-gray-600 mb-6">
                        I can help you explore your data and build analytical models
                    </p>
                    
                    <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-5 text-left">
                        <div class="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                            <font-awesome icon="fas fa-lightbulb" class="w-5 h-5" />
                            <span>Try asking:</span>
                        </div>
                        <div class="space-y-2">
                            <button 
                                v-for="example in examplePrompts"
                                :key="example"
                                @click="useSuggestion(example)"
                                class="w-full text-left px-4 py-3 bg-white hover:bg-blue-100 rounded-lg border border-blue-200 text-blue-700 text-sm cursor-pointer transition-all hover:shadow-sm"
                            >
                                💬 {{ example }}
                            </button>
                        </div>
                    </div>
                    
                    <p class="text-xs text-gray-500 mt-4">
                        Ask questions, request suggestions, or tell me to build specific models
                    </p>
                </div>
            </div>
            
            <!-- Messages -->
            <AIMessage
                v-for="msg in aiDataModelerStore.messages" 
                :key="msg.id"
                :message="msg"
            />

            <!-- Loading indicator -->
            <div v-if="aiDataModelerStore.isLoading" class="flex justify-start">
                <div class="bg-gray-100 rounded-lg p-3">
                    <LoadingDots size="sm" color="#9ca3af" />
                </div>
            </div>
        </div>

        <!-- Model Preview (appears after AI generates a model) -->
        <div v-if="lastMessageHasModel && aiDataModelerStore.modelDraft" class="px-6 pb-4">
            <AIModelPreview
                :modelDraft="aiDataModelerStore.modelDraft"
                :compact="true"
                v-model:isApplying="isApplyingModel"
                v-model:buttonState="buttonState"
                v-model:showPreview="showModelPreview"
                @apply="handleApplyModel"
            />
        </div>

        <!-- Input Area (Fixed) -->
        <div class="border-t border-gray-200 p-4 bg-white">
            <div class="flex gap-2 mb-2">
                <input
                    v-model="userInput"
                    @keyup.enter="sendMessage"
                    placeholder="Describe the data model you need..."
                    class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    :disabled="aiDataModelerStore.isLoading"
                />
                <button
                    @click="sendMessage"
                    :disabled="!userInput.trim() || aiDataModelerStore.isLoading"
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    Send
                </button>
            </div>
            
            <!-- Suggestions -->
            <div v-if="suggestions.length > 0" class="flex flex-wrap gap-2">
                <button 
                    v-for="suggestion in suggestions"
                    :key="suggestion"
                    @click="useSuggestion(suggestion)"
                    class="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors cursor-pointer">
                    {{ suggestion }}
                </button>
            </div>
        </div>
        
        <!-- Help Modal -->
        <overlay-dialog v-if="showHelpModal" @close="showHelpModal = false" :enable-scrolling="true" :y-offset="80">
            <template #overlay>
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-2xl font-bold text-gray-800">How to Use AI Data Modeler</h2>
                </div>
                
                <div class="space-y-5 text-sm overflow-y-auto max-h-[60vh]">
                    <section class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                        <h3 class="font-semibold text-blue-700 mb-2 flex items-center gap-2 text-base">
                            <font-awesome icon="fas fa-comments" class="w-5 h-5" />
                            💬 Ask Questions
                        </h3>
                        <p class="text-gray-700 mb-2">Get information about your data and schema:</p>
                        <ul class="list-none space-y-1.5 text-gray-600">
                            <li class="flex gap-2"><span class="text-blue-500">•</span> <span>"What tables do I have?"</span></li>
                            <li class="flex gap-2"><span class="text-blue-500">•</span> <span>"Can I join users and orders tables?"</span></li>
                            <li class="flex gap-2"><span class="text-blue-500">•</span> <span>"What kind of analysis can I do with this data?"</span></li>
                            <li class="flex gap-2"><span class="text-blue-500">•</span> <span>"Explain the relationships between my tables"</span></li>
                        </ul>
                    </section>
                    
                    <section class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                        <h3 class="font-semibold text-green-700 mb-2 flex items-center gap-2 text-base">
                            <font-awesome icon="fas fa-bullseye" class="w-5 h-5" />
                            🎯 Request Models
                        </h3>
                        <p class="text-gray-700 mb-2">Tell me what you want to analyze and I'll build it:</p>
                        <ul class="list-none space-y-1.5 text-gray-600">
                            <li class="flex gap-2"><span class="text-green-500">•</span> <span>"Create a sales by region model"</span></li>
                            <li class="flex gap-2"><span class="text-green-500">•</span> <span>"Build a customer lifetime value analysis"</span></li>
                            <li class="flex gap-2"><span class="text-green-500">•</span> <span>"Show me product performance over time"</span></li>
                            <li class="flex gap-2"><span class="text-green-500">•</span> <span>"Analyze user engagement by category"</span></li>
                        </ul>
                    </section>
                    
                    <section class="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                        <h3 class="font-semibold text-purple-700 mb-2 flex items-center gap-2 text-base">
                            <font-awesome icon="fas fa-sparkles" class="w-5 h-5" />
                            ✨ Get Suggestions
                        </h3>
                        <p class="text-gray-700 mb-2">Not sure what to build? Ask for ideas:</p>
                        <ul class="list-none space-y-1.5 text-gray-600">
                            <li class="flex gap-2"><span class="text-purple-500">•</span> <span>"What models should I create?"</span></li>
                            <li class="flex gap-2"><span class="text-purple-500">•</span> <span>"Suggest analyses for my data"</span></li>
                            <li class="flex gap-2"><span class="text-purple-500">•</span> <span>"What insights can I discover?"</span></li>
                        </ul>
                    </section>
                    
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4 mt-4">
                        <div class="flex gap-3">
                            <div class="flex-shrink-0">
                                <font-awesome icon="fas fa-lightbulb" class="w-6 h-6 text-yellow-500" />
                            </div>
                            <div>
                                <p class="text-sm text-gray-800 font-medium mb-1">💡 Pro Tip</p>
                                <p class="text-xs text-gray-700">
                                    When I generate a model, click <strong class="text-blue-700">"Apply to Builder"</strong> to customize it further with our visual data model builder. You can add filters, modify columns, and fine-tune your analysis!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </overlay-dialog>
    </div>
</template>
