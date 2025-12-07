<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { useAIDataModelerStore } from '~/stores/ai-data-modeler';
import { usePresetGenerator } from '~/composables/usePresetGenerator';

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

// Track if user has actively requested model generation
const userRequestedGeneration = ref(false);

// Computed property for last message data model detection
const lastMessageHasDataModel = computed(() => {
    if (aiDataModelerStore.messages.length === 0) return false;
    const lastMessage = aiDataModelerStore.messages[aiDataModelerStore.messages.length - 1];
    // Only check if user has actively requested generation
    if (!userRequestedGeneration.value) return false;
    return messageContainsDataModel(lastMessage.content);
});

// Computed property for showing error state
const showModelError = computed(() => {
    // Only show error if user explicitly requested generation
    const result = userRequestedGeneration.value && lastMessageHasDataModel.value && !hasValidModel.value;
    console.log('[AI Drawer] showModelError:', result, { userRequestedGeneration: userRequestedGeneration.value, lastMessageHasDataModel: lastMessageHasDataModel.value, hasValidModel: hasValidModel.value });
    return result;
});

// Computed property for showing success state
const showModelSuccess = computed(() => {
    const result = lastMessageHasDataModel.value && hasValidModel.value;
    console.log('[AI Drawer] showModelSuccess:', result, { lastMessageHasDataModel: lastMessageHasDataModel.value, hasValidModel: hasValidModel.value, modelDraft: aiDataModelerStore.modelDraft });
    return result;
});

const isApplyingModel = ref(false);
const showModelPreview = ref(false);
const buttonState = ref<'normal' | 'loading' | 'success'>('normal');

// User preferences - Load preview preference from localStorage
function loadPreferences() {
    try {
        const savedPreviewPreference = localStorage.getItem('ai-modeler-preview-expanded');
        if (savedPreviewPreference !== null) {
            showModelPreview.value = savedPreviewPreference === 'true';
        }
    } catch (error) {
        console.error('[AI Drawer] Error loading preferences:', error);
    }
}

// Save preview preference to localStorage
function savePreference(key: string, value: boolean) {
    try {
        localStorage.setItem(key, value.toString());
    } catch (error) {
        console.error('[AI Drawer] Error saving preference:', error);
    }
}

// Keyboard navigation
let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

// Watch for drawer opening/closing to reset state
watch(() => aiDataModelerStore.isDrawerOpen, (isOpen) => {
    if (isOpen) {
        // Reset flag when drawer opens - user hasn't requested generation yet
        userRequestedGeneration.value = false;
        console.log('[AI Drawer] Drawer opened, reset userRequestedGeneration flag');
    }
});

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

// Save preview preference when changed
watch(showModelPreview, (newValue) => {
    savePreference('ai-modeler-preview-expanded', newValue);
});

// AUTO-APPLY DISABLED: User must manually click "Apply" button
// Previously auto-applied models on generation, causing infinite loops
// Now models only apply when user explicitly clicks the Apply button

function handlePresetModel(prompt: string) {
    userRequestedGeneration.value = true;
    aiDataModelerStore.sendMessage(prompt);
}

function handleGenerateAnotherRecommendation() {
    // Generic prompt that lets AI be creative
    const prompt = `Based on my database schema, please recommend and generate a data model that would provide valuable insights. Analyze the available tables and columns, then suggest a data model that combines relevant data in a meaningful way. Be creative and consider different analytical perspectives I might not have thought of. Include appropriate columns, joins, and any useful aggregations or filters.`;
    
    console.log('[AI Drawer] Generating another AI recommendation');
    userRequestedGeneration.value = true;
    aiDataModelerStore.sendMessage(prompt);
}

function handleClose() {
    if (!aiDataModelerStore.isLoading && !aiDataModelerStore.isInitializing) {
        // Reset flag when closing drawer
        userRequestedGeneration.value = false;
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
        modelDraft: aiDataModelerStore.modelDraft
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
        console.log('[AI Drawer] Applying model to builder');
        console.log('[AI Drawer] Current applyTrigger value:', aiDataModelerStore.applyTrigger);
        console.log('[AI Drawer] Model to apply:', JSON.stringify(aiDataModelerStore.modelDraft, null, 2));
        
        // Trigger the manual application - this should replace existing model
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
    const tableName = table.table_name || 'Unknown';
    console.log('[AI Drawer - getTablesList] Current model table:', tableName, 'Last modified:', aiDataModelerStore.modelDraft.lastModified);
    return tableName;
}

function getColumnCount(): number {
    if (!aiDataModelerStore.modelDraft?.tables?.[0]?.columns) return 0;
    const count = aiDataModelerStore.modelDraft.tables[0].columns.length;
    console.log('[AI Drawer - getColumnCount] Column count:', count);
    return count;
}

function getColumnNames(): string[] {
    if (!aiDataModelerStore.modelDraft?.tables?.[0]?.columns) return [];
    const columns = aiDataModelerStore.modelDraft.tables[0].columns;
    
    // Return column names with alias if available
    return columns.map((col: any) => {
        if (col.alias_name && col.alias_name.trim() !== '') {
            return `${col.column_name} AS ${col.alias_name}`;
        }
        return col.column_name;
    });
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
                                <h2 class="text-xl font-semibold text-gray-800 mb-1">Choose a Data Model Template</h2>
                                <div v-if="aiDataModelerStore.schemaSummary" class="text-[13px] text-gray-500">
                                    {{ aiDataModelerStore.schemaSummary.tableCount }} tables · 
                                    {{ aiDataModelerStore.schemaSummary.totalColumns }} columns available
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
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
                                <font-awesome icon="fas fa-exclamation-triangle" class="w-full h-full" />
                            </div>
                            <p class="text-gray-500 text-sm mb-6 max-w-[400px]">{{ aiDataModelerStore.error }}</p>
                            <button 
                                class="px-5 py-2.5 bg-blue-600 text-white border-0 text-sm font-medium cursor-pointer transition-colors duration-200 hover:bg-blue-700"
                                @click="handleRetry"
                            >
                                Try Again
                            </button>
                        </div>

                        <!-- Main Content -->
                        <div v-else class="flex-1 flex flex-col overflow-hidden">
                            <!-- Preset Model Selection Interface -->
                            <div class="min-h-0 flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
                                <div class="max-w-[600px] mx-auto pb-6">
                                    <!-- Instructions -->
                                    <div class="mb-6">
                                        <h3 class="text-lg font-semibold text-gray-800 mb-2 text-center">Select a Template</h3>
                                        <p class="text-sm text-gray-600 text-center">
                                            Choose the type of analysis you want to perform. AI will generate a ready-to-use data model.
                                        </p>
                                    </div>

                                    <!-- Pre-set Model Types -->
                                    <div class="grid grid-cols-1 gap-3 mb-6">
                                        <button
                                            v-for="model in presetModels"
                                            :key="model.title"
                                            @click="handlePresetModel(model.prompt)"
                                            :disabled="aiDataModelerStore.isLoading"
                                            class="flex items-start gap-4 p-4 bg-white border-2 border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed relative"
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
                                            <font-awesome icon="fas fa-chevron-right" class="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                                        </button>
                                    </div>

                                    <!-- Generate Another Recommendation Button -->
                                    <div class="mb-6">
                                        <button
                                            @click="handleGenerateAnotherRecommendation"
                                            :disabled="aiDataModelerStore.isLoading"
                                            class="w-full flex items-center justify-center gap-3 p-4 bg-primary-blue-100 text-white border-0 hover:bg-primary-blue-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg font-medium cursor-pointer"
                                        >
                                            <font-awesome icon="fas fa-sync-alt" class="w-5 h-5" />
                                            <span>Generate Another AI Recommendation</span>
                                            <span v-if="aiDataModelerStore.isLoading" class="ml-2">
                                                <font-awesome icon="fas fa-spinner" class="fa-spin h-5 w-5" />
                                            </span>
                                        </button>
                                        <p class="text-xs text-gray-500 mt-2 text-center">
                                            AI will analyze your database and suggest a custom data model
                                        </p>
                                    </div>

                                    <!-- Info message -->
                                    <div class="mt-6 p-4 bg-blue-50 border border-blue-100">
                                        <div class="flex items-start gap-3">
                                            <font-awesome icon="fas fa-info-circle" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <div class="text-sm text-blue-800">
                                                <p class="font-medium mb-1">💡 Tip</p>
                                                <p>Select a template above, or click "Generate Another AI Recommendation" to let AI surprise you with a custom data model suggestion. You can generate as many as you want!</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Model Status Display -->
                            <div v-if="showModelError" 
                                class="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300">
                                <div class="flex items-center gap-2 text-yellow-700 font-medium mb-2">
                                    <font-awesome icon="fas fa-exclamation-triangle" class="w-5 h-5" />
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
                                class="mt-6 p-4 bg-blue-50 border-2 border-blue-200">
                                <div class="flex items-center justify-between gap-2 text-blue-700 font-medium mb-2">
                                    <div class="flex items-center gap-2">
                                        <font-awesome icon="fas fa-certificate" class="w-5 h-5" />
                                        <span>Data Model Ready</span>
                                        <span class="text-[10px] text-blue-500 font-normal">
                                            (Model: {{ getTablesList() }})
                                        </span>
                                    </div>
                                    <button
                                        @click="showModelPreview = !showModelPreview"
                                        class="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        <span>{{ showModelPreview ? 'Hide' : 'Show' }} Preview</span>
                                        <font-awesome icon="fas fa-chevron-down" class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showModelPreview }" />
                                    </button>
                                </div>
                                
                                <p class="text-sm text-gray-700 mb-3">
                                    AI has generated a data model configuration. Review it above and click the button below to apply it to the builder.
                                </p>                                    
                                <!-- Model History Navigation -->
                                <div v-if="aiDataModelerStore.modelHistory.length > 1" class="mb-3 p-2 bg-gray-50 border border-gray-200">
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="text-xs text-gray-600 flex items-center gap-2">
                                            <font-awesome icon="fas fa-history" class="w-4 h-4 text-gray-500" />
                                            <span>Model {{ aiDataModelerStore.currentHistoryIndex + 1 }} of {{ aiDataModelerStore.modelHistory.length }}</span>
                                        </div>
                                        <div class="flex items-center gap-1">
                                            <button
                                                @click="aiDataModelerStore.goToPreviousModel()"
                                                :disabled="!aiDataModelerStore.canGoBack()"
                                                class="p-1 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title="Previous model (Alt + ←)"
                                                aria-label="Previous model"
                                            >
                                                <font-awesome icon="fas fa-chevron-left" class="w-4 h-4 text-gray-700" />
                                            </button>
                                            <button
                                                @click="aiDataModelerStore.goToNextModel()"
                                                :disabled="!aiDataModelerStore.canGoForward()"
                                                class="p-1 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title="Next model (Alt + →)"
                                                aria-label="Next model"
                                            >
                                                <font-awesome icon="fas fa-chevron-right" class="w-4 h-4 text-gray-700" />
                                            </button>
                                        </div>
                                    </div>
                                    <div class="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                        <span>Use</span>
                                        <kbd class="px-1 py-0.5 bg-white border border-gray-300 text-[9px] font-mono">Alt+←</kbd>
                                        <span>/</span>
                                        <kbd class="px-1 py-0.5 bg-white border border-gray-300 text-[9px] font-mono">Alt+→</kbd>
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
                                    <div v-if="showModelPreview" class="mb-3 p-3 bg-white border border-blue-100 text-xs">
                                        <div class="grid grid-cols-2 gap-3">
                                            <div>
                                                <div class="font-semibold text-gray-700 mb-1">Table</div>
                                                <div class="text-gray-600 font-mono bg-gray-50 px-2 py-1">{{ getTablesList() }}</div>
                                            </div>
                                            <div>
                                                <div class="font-semibold text-gray-700 mb-1">Column Count</div>
                                                <div class="text-gray-600">{{ getColumnCount() }} selected</div>
                                            </div>
                                            <div class="col-span-2">
                                                <div class="font-semibold text-gray-700 mb-2">Selected Columns</div>
                                                <div v-if="getColumnNames().length > 0" class="flex flex-wrap gap-1.5">
                                                    <span 
                                                        v-for="(columnName, index) in getColumnNames()" 
                                                        :key="index"
                                                        class="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-[11px] font-mono border border-blue-200"
                                                    >
                                                        {{ columnName }}
                                                    </span>
                                                </div>
                                                <div v-else class="text-gray-500 text-xs italic">
                                                    No columns selected
                                                </div>
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
                                    @click="handleApplyModel"
                                    :disabled="isApplyingModel"
                                    class="w-full px-4 py-2.5 border-0 text-sm font-medium cursor-pointer transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    :class="{
                                        'bg-blue-600 text-white hover:bg-blue-700': buttonState === 'normal',
                                        'bg-blue-600 text-white opacity-70': buttonState === 'loading',
                                        'bg-green-600 text-white': buttonState === 'success'
                                    }"
                                >
                                    <!-- Loading spinner -->
                                    <font-awesome v-if="buttonState === 'loading'" icon="fas fa-spinner" class="fa-spin h-4 w-4" />
                                    <!-- Success checkmark -->
                                    <font-awesome v-else-if="buttonState === 'success'" icon="fas fa-check-circle" class="w-5 h-5" />
                                    <!-- Normal icon -->
                                    <font-awesome v-else icon="fas fa-plus" class="w-4 h-4" />
                                    <!-- Button text -->
                                    <span v-if="buttonState === 'loading'">Applying...</span>
                                    <span v-else-if="buttonState === 'success'">Applied Successfully!</span>
                                    <span v-else>Apply to Builder</span>
                                </button>
                            </div>
                         </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
