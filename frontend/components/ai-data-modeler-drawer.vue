<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { useAIDataModelerStore } from '~/stores/ai-data-modeler';
import { usePresetGenerator } from '~/composables/usePresetGenerator';
import AiChatMessage from './ai-chat-message.vue';
import AiChatInput from './ai-chat-input.vue';

const aiDataModelerStore = useAIDataModelerStore();

// Computed property for valid model check - directly access store
const hasValidModel = computed(() => {
    const modelDraft = aiDataModelerStore.modelDraft;
    const hasTables = !!modelDraft?.tables;
    const isArray = Array.isArray(modelDraft?.tables);
    const hasLength = modelDraft?.tables && modelDraft.tables.length > 0;
    const result = !!(hasTables && isArray && hasLength);
    
    console.log('modelDraft', modelDraft);
    console.log('hasTables', modelDraft?.tables);
    console.log('isArray', isArray);
    console.log('hasLength', hasLength);
    

    console.log('[AI Drawer - hasValidModel COMPUTED]', {
        modelDraft: modelDraft ? 'exists' : 'null',
        hasTables,
        isArray,
        hasLength,
        result,
        tablesLength: modelDraft?.tables?.length
    });
    
    return result;
});

// Computed property for last message data model detection
const lastMessageHasDataModel = computed(() => {
    if (aiDataModelerStore.messages.length === 0) return false;
    const lastMessage = aiDataModelerStore.messages[aiDataModelerStore.messages.length - 1];
    return messageContainsDataModel(lastMessage.content);
});

// Computed property for showing error state
const showModelError = computed(() => {
    console.log('lastMessageHasDataModel.value', lastMessageHasDataModel.value)
    return lastMessageHasDataModel.value && !hasValidModel.value;
});

// Computed property for showing success state
const showModelSuccess = computed(() => {
    return lastMessageHasDataModel.value && hasValidModel.value;
});

const messagesContainer = ref<HTMLDivElement | null>(null);
const showChat = ref(false);
const isApplyingModel = ref(false);
const showModelPreview = ref(false);
const buttonState = ref<'normal' | 'loading' | 'success'>('normal');

// User preferences
const autoApplyModels = ref(false);
const showPreferencesMenu = ref(false);

// Load preferences from localStorage
function loadPreferences() {
    try {
        const savedPreviewPreference = localStorage.getItem('ai-modeler-preview-expanded');
        if (savedPreviewPreference !== null) {
            showModelPreview.value = savedPreviewPreference === 'true';
        }
        
        const savedAutoApply = localStorage.getItem('ai-modeler-auto-apply');
        if (savedAutoApply !== null) {
            autoApplyModels.value = savedAutoApply === 'true';
        }
    } catch (error) {
        console.error('[AI Drawer] Error loading preferences:', error);
    }
}

// Save preference to localStorage
function savePreference(key: string, value: boolean) {
    try {
        localStorage.setItem(key, value.toString());
    } catch (error) {
        console.error('[AI Drawer] Error saving preference:', error);
    }
}

// Toggle preferences
function toggleAutoApply() {
    autoApplyModels.value = !autoApplyModels.value;
    savePreference('ai-modeler-auto-apply', autoApplyModels.value);
}

// Keyboard navigation
let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

onMounted(() => {
    loadPreferences();
    
    // Add keyboard shortcuts for history navigation
    keyboardHandler = (e: KeyboardEvent) => {
        // Only handle shortcuts when drawer is open
        if (!aiDataModelerStore.isDrawerOpen) return;
        
        // Alt + Left Arrow: Previous model
        if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            if (aiDataModelerStore.canGoBack()) {
                aiDataModelerStore.goToPreviousModel();
            }
        }
        
        // Alt + Right Arrow: Next model
        if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            if (aiDataModelerStore.canGoForward()) {
                aiDataModelerStore.goToNextModel();
            }
        }
        
        // Escape: Close drawer
        if (e.key === 'Escape') {
            e.preventDefault();
            handleClose();
        }
    };
    
    window.addEventListener('keydown', keyboardHandler);
});

onUnmounted(() => {
    if (keyboardHandler) {
        window.removeEventListener('keydown', keyboardHandler);
    }
});

// Dynamic preset models based on schema
const presetModels = computed(() => {
    const generator = usePresetGenerator(aiDataModelerStore.schemaDetails);
    return generator.generatePresets();
});

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

// Save preview preference when changed
watch(showModelPreview, (newValue) => {
    savePreference('ai-modeler-preview-expanded', newValue);
});

// Watch for new models and auto-apply if enabled
watch(
    () => aiDataModelerStore.modelDraft,
    (newModel) => {
        if (autoApplyModels.value && newModel && hasValidModel.value) {
            console.log('[AI Drawer] Auto-apply enabled, applying model automatically');
            // Delay slightly to ensure model is fully set
            setTimeout(() => {
                handleApplyModel();
            }, 300);
        }
    },
    { deep: true }
);

function handleSendMessage(message: string) {
    aiDataModelerStore.sendMessage(message);
}

function handlePresetModel(prompt: string) {
    showChat.value = true;
    aiDataModelerStore.sendMessage(prompt);
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

function messageContainsDataModel(content: string): boolean {
    const hasBuildAction = content.includes('"action": "BUILD_DATA_MODEL"');
    const hasJsonBlock = content.includes('```json') && content.includes('table_name');
    const result = hasBuildAction || hasJsonBlock;
    
    console.log('[AI Drawer - messageContainsDataModel]', {
        hasBuildAction,
        hasJsonBlock,
        result,
        contentPreview: content.substring(0, 200)
    });
    
    return result;
}

async function handleApplyModel() {
    console.log('[AI Drawer - handleApplyModel] START', {
        hasValidModel: hasValidModel.value,
        modelDraft: aiDataModelerStore.modelDraft,
        autoApply: autoApplyModels.value
    });
    
    try {
        // Validate model exists before applying
        if (!hasValidModel.value) {
            console.error('[AI Drawer] No valid model to apply');
            alert('No valid AI-generated model to apply. Please continue the conversation.');
            return;
        }
        
        buttonState.value = 'loading';
        isApplyingModel.value = true;
        const isAutoApplying = autoApplyModels.value;
        console.log(`[AI Drawer] Applying model to builder (auto: ${isAutoApplying})`);
        console.log('[AI Drawer] Current applyTrigger value:', aiDataModelerStore.applyTrigger);
        
        // Trigger the manual application
        aiDataModelerStore.applyModelToBuilder();
        console.log('[AI Drawer] After applyModelToBuilder, new trigger value:', aiDataModelerStore.applyTrigger);
        
        // Give a brief moment for the watcher to trigger
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Show success state
        buttonState.value = 'success';
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Close the drawer after success animation
        aiDataModelerStore.closeDrawer(false);
    } catch (error) {
        console.error('[AI Drawer] Error applying model:', error);
        buttonState.value = 'normal';
    } finally {
        isApplyingModel.value = false;
        // Reset button state after a delay
        setTimeout(() => {
            buttonState.value = 'normal';
        }, 1000);
    }
}

// Helper functions for preview
function getTablesList(): string {
    if (!aiDataModelerStore.modelDraft?.tables?.[0]) return 'None';
    const table = aiDataModelerStore.modelDraft.tables[0];
    return table.table_name || 'Unknown';
}

function getColumnCount(): number {
    if (!aiDataModelerStore.modelDraft?.tables?.[0]?.columns) return 0;
    return aiDataModelerStore.modelDraft.tables[0].columns.length;
}

function hasWhereClause(): boolean {
    const queryOptions = aiDataModelerStore.modelDraft?.tables?.[0]?.query_options;
    return !!(queryOptions?.where && queryOptions.where.length > 0);
}

function hasGroupBy(): boolean {
    const queryOptions = aiDataModelerStore.modelDraft?.tables?.[0]?.query_options;
    return !!(queryOptions?.group_by?.aggregate_functions && queryOptions.group_by.aggregate_functions.length > 0);
}

function hasOrderBy(): boolean {
    const queryOptions = aiDataModelerStore.modelDraft?.tables?.[0]?.query_options;
    return !!(queryOptions?.order_by && queryOptions.order_by.length > 0);
}

function getWhereConditions(): string[] {
    const where = aiDataModelerStore.modelDraft?.tables?.[0]?.query_options?.where;
    if (!where || where.length === 0) return [];
    return where.map((w: any) => `${w.column} ${w.operator} ${w.value}`);
}

function getGroupByColumns(): string[] {
    const groupBy = aiDataModelerStore.modelDraft?.tables?.[0]?.query_options?.group_by;
    if (!groupBy?.aggregate_functions || groupBy.aggregate_functions.length === 0) return [];
    
    const aggregateFunctionNames = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
    
    return groupBy.aggregate_functions.map((agg: any) => {
        const funcName = aggregateFunctionNames[agg.aggregate_function] || 'UNKNOWN';
        const distinct = agg.use_distinct ? 'DISTINCT ' : '';
        return `${funcName}(${distinct}${agg.column}) AS ${agg.column_alias_name}`;
    });
}

function getOrderByColumns(): string[] {
    const orderBy = aiDataModelerStore.modelDraft?.tables?.[0]?.query_options?.order_by;
    if (!orderBy || orderBy.length === 0) return [];
    
    const orderDirections = ['ASC', 'DESC'];
    
    return orderBy.map((o: any) => {
        const direction = orderDirections[o.order] || 'ASC';
        return `${o.column} ${direction}`;
    });
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
                            <div class="flex items-center gap-2">
                                <!-- Preferences button -->
                                <div class="relative">
                                    <button 
                                        class="flex-shrink-0 w-8 h-8 border-0 bg-transparent cursor-pointer text-gray-500 rounded-md flex items-center justify-center transition-all duration-200 hover:bg-gray-200 hover:text-gray-800"
                                        @click="showPreferencesMenu = !showPreferencesMenu"
                                        title="Preferences"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                                        </svg>
                                    </button>
                                    
                                    <!-- Preferences dropdown -->
                                    <Transition
                                        enter-active-class="transition-all duration-200"
                                        leave-active-class="transition-all duration-200"
                                        enter-from-class="opacity-0 scale-95"
                                        leave-to-class="opacity-0 scale-95"
                                    >
                                        <div v-if="showPreferencesMenu" 
                                             class="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-10 py-2"
                                             @click.stop>
                                            <div class="px-4 py-2 border-b border-gray-100">
                                                <div class="font-semibold text-sm text-gray-700">Preferences</div>
                                            </div>
                                            
                                            <div class="px-4 py-3 hover:bg-gray-50 cursor-pointer" @click="toggleAutoApply">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex-1">
                                                        <div class="text-sm font-medium text-gray-700">Auto-apply Models</div>
                                                        <div class="text-xs text-gray-500 mt-0.5">Apply models automatically without confirmation</div>
                                                    </div>
                                                    <div class="flex-shrink-0 ml-3">
                                                        <div class="relative inline-block w-10 h-5">
                                                            <input type="checkbox" :checked="autoApplyModels" class="sr-only" />
                                                            <div class="block w-10 h-5 rounded-full transition-colors"
                                                                 :class="autoApplyModels ? 'bg-blue-600' : 'bg-gray-300'"></div>
                                                            <div class="dot absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform"
                                                                 :class="autoApplyModels ? 'transform translate-x-5' : ''"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div class="px-4 py-2 border-t border-gray-100">
                                                <button 
                                                    @click="showPreferencesMenu = false"
                                                    class="w-full text-xs text-gray-600 hover:text-gray-800 text-center py-1"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </div>
                                    </Transition>
                                </div>
                                
                                <!-- Close button -->
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
                            <!-- Quick Start Options (shown when chat not expanded) -->
                            <div v-if="!showChat" class="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
                                <div class="max-w-[600px] mx-auto">
                                    <!-- Primary: Auto-Generate -->
                                    <div class="mb-8">
                                        <h3 class="text-lg font-semibold text-gray-800 mb-3 text-center">Let AI analyze your data</h3>
                                        <p class="text-sm text-gray-600 text-center mb-4">AI will automatically create the best data model for analytics</p>
                                        <div class="text-center text-sm text-gray-500 italic mb-4">
                                            (Auto-analysis already in progress...)
                                        </div>
                                    </div>

                                    <!-- Divider -->
                                    <div class="relative my-6">
                                        <div class="absolute inset-0 flex items-center">
                                            <div class="w-full border-t border-gray-300"></div>
                                        </div>
                                        <div class="relative flex justify-center text-sm">
                                            <span class="px-4 bg-white text-gray-500">Or choose what you want to analyze</span>
                                        </div>
                                    </div>

                                    <!-- Pre-set Model Types -->
                                    <div class="grid grid-cols-1 gap-3 mb-6">
                                        <button
                                            v-for="model in presetModels"
                                            :key="model.title"
                                            @click="handlePresetModel(model.prompt)"
                                            :disabled="aiDataModelerStore.isLoading"
                                            class="flex items-start gap-4 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed relative"
                                        >
                                            <!-- Confidence indicator for high-confidence matches -->
                                            <div 
                                                v-if="model.confidence >= 70"
                                                class="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full"
                                                :title="`${model.confidence}% match confidence`"
                                            ></div>
                                            <div class="text-3xl flex-shrink-0">{{ model.icon }}</div>
                                            <div class="flex-1">
                                                <div class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                                                    <span>{{ model.title }}</span>
                                                    <span 
                                                        v-if="model.relevantTables && model.relevantTables.length > 0"
                                                        class="text-[10px] text-blue-600 font-normal"
                                                        :title="`Uses: ${model.relevantTables.join(', ')}`"
                                                    >
                                                        {{ model.relevantTables.length }} tables
                                                    </span>
                                                </div>
                                                <div class="text-sm text-gray-600">{{ model.description }}</div>
                                            </div>
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>

                                    <!-- Tertiary: Full Chat -->
                                    <div class="text-center">
                                        <button
                                            @click="showChat = true"
                                            class="text-sm text-blue-600 hover:text-blue-700 underline cursor-pointer"
                                        >
                                            Need something custom? Chat with AI →
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Messages Container (shown when chat is active) -->
                            <div v-else ref="messagesContainer" class="flex-1 overflow-y-auto p-6 bg-white">
                                <!-- Back to preset models button -->
                                <div class="mb-4 pb-4 border-b border-gray-200">
                                    <button
                                        @click="showChat = false"
                                        class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Back to Preset Models</span>
                                    </button>
                                </div>
                                
                                <AiChatMessage
                                    v-for="message in aiDataModelerStore.messages"
                                    :key="message.id"
                                    :message="message"
                                />

                                <!-- Error State: Model Marker but Invalid Model -->
                                <div v-if="showModelError" 
                                     class="mt-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                                    <div class="flex items-center gap-2 text-yellow-700 font-medium mb-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Model Parse Error</span>
                                    </div>
                                    <p class="text-sm text-gray-700 mb-2">
                                        AI generated a response but the model structure could not be parsed. This might be a temporary issue.
                                    </p>
                                    <p class="text-xs text-gray-600">
                                        Try asking the AI to regenerate the model or be more specific about what you need.
                                    </p>
                                </div>
                                
                                <!-- Data Model Indicator -->
                                <div v-if="showModelSuccess" 
                                     class="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                                    <div class="flex items-center justify-between gap-2 text-blue-700 font-medium mb-2">
                                        <div class="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                            </svg>
                                            <span>Data Model Ready</span>
                                        </div>
                                        <button
                                            @click="showModelPreview = !showModelPreview"
                                            class="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        >
                                            <span>{{ showModelPreview ? 'Hide' : 'Show' }} Preview</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showModelPreview }" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    
                                    <!-- Auto-apply info message -->
                                    <div v-if="autoApplyModels" class="mb-3 p-2 bg-blue-100 border border-blue-200 rounded text-xs text-blue-800 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Auto-apply is enabled. This model will be applied automatically.</span>
                                    </div>
                                    
                                    <p v-if="!autoApplyModels" class="text-sm text-gray-700 mb-3">
                                        AI has generated a data model configuration. Review it above and click the button below to apply it to the builder.
                                    </p>                                    
                                    <!-- Model History Navigation -->
                                    <div v-if="aiDataModelerStore.modelHistory.length > 1" class="mb-3 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                        <div class="flex items-center justify-between gap-2">
                                            <div class="text-xs text-gray-600 flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                                                </svg>
                                                <span>Model {{ aiDataModelerStore.currentHistoryIndex + 1 }} of {{ aiDataModelerStore.modelHistory.length }}</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <button
                                                    @click="aiDataModelerStore.goToPreviousModel()"
                                                    :disabled="!aiDataModelerStore.canGoBack()"
                                                    class="p-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                    title="Previous model (Alt + ←)"
                                                    aria-label="Previous model"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                                                    </svg>
                                                </button>
                                                <button
                                                    @click="aiDataModelerStore.goToNextModel()"
                                                    :disabled="!aiDataModelerStore.canGoForward()"
                                                    class="p-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                    title="Next model (Alt + →)"
                                                    aria-label="Next model"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                            <span>💡 Use</span>
                                            <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-[9px] font-mono">Alt+←</kbd>
                                            <span>/</span>
                                            <kbd class="px-1 py-0.5 bg-white border border-gray-300 rounded text-[9px] font-mono">Alt+→</kbd>
                                            <span>to navigate</span>
                                        </div>
                                    </div>
                                    
                                    <!-- Collapsible Preview Section -->
                                    <Transition
                                        enter-active-class="transition-all duration-200"
                                        leave-active-class="transition-all duration-200"
                                        enter-from-class="max-h-0 opacity-0"
                                        leave-to-class="max-h-0 opacity-0"
                                    >
                                        <div v-if="showModelPreview" class="mb-3 p-3 bg-white rounded-lg border border-blue-100 text-xs">
                                            <div class="grid grid-cols-2 gap-3">
                                                <div>
                                                    <div class="font-semibold text-gray-700 mb-1">Table</div>
                                                    <div class="text-gray-600">{{ getTablesList() }}</div>
                                                </div>
                                                <div>
                                                    <div class="font-semibold text-gray-700 mb-1">Columns</div>
                                                    <div class="text-gray-600">{{ getColumnCount() }} selected</div>
                                                </div>
                                            </div>
                                            
                                            <div v-if="hasWhereClause() || hasGroupBy() || hasOrderBy()" class="mt-3 pt-3 border-t border-blue-100">
                                                <div class="font-semibold text-gray-700 mb-2">Query Options</div>
                                                <div class="space-y-1">
                                                    <div v-if="hasWhereClause()" class="flex gap-2">
                                                        <span class="text-gray-500 font-medium">WHERE:</span>
                                                        <span class="text-gray-600">{{ getWhereConditions().join(', ') }}</span>
                                                    </div>
                                                    <div v-if="hasGroupBy()" class="flex gap-2">
                                                        <span class="text-gray-500 font-medium">GROUP BY:</span>
                                                        <span class="text-gray-600">{{ getGroupByColumns().join(', ') }}</span>
                                                    </div>
                                                    <div v-if="hasOrderBy()" class="flex gap-2">
                                                        <span class="text-gray-500 font-medium">ORDER BY:</span>
                                                        <span class="text-gray-600">{{ getOrderByColumns().join(', ') }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Transition>                                    
                                    <button
                                        v-if="!autoApplyModels"
                                        @click="handleApplyModel"
                                        :disabled="isApplyingModel"
                                        class="w-full px-4 py-2.5 border-0 rounded-lg text-sm font-medium cursor-pointer transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        :class="{
                                            'bg-blue-600 text-white hover:bg-blue-700': buttonState === 'normal',
                                            'bg-blue-600 text-white opacity-70': buttonState === 'loading',
                                            'bg-green-600 text-white': buttonState === 'success'
                                        }"
                                    >
                                        <!-- Loading spinner -->
                                        <svg v-if="buttonState === 'loading'" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <!-- Success checkmark -->
                                        <svg v-else-if="buttonState === 'success'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                        </svg>
                                        <!-- Normal icon -->
                                        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
                                        </svg>
                                        <!-- Button text -->
                                        <span v-if="buttonState === 'loading'">Applying...</span>
                                        <span v-else-if="buttonState === 'success'">Applied Successfully!</span>
                                        <span v-else>Apply to Builder</span>
                                    </button>
                                </div>
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
