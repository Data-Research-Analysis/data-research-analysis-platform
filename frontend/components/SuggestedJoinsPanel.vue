<script setup lang="ts">
import { ref, computed } from 'vue';

// Props
const props = defineProps<{
    suggestions: any[];
    loading?: boolean;
    appliedSuggestions?: Set<string>;
    dismissedSuggestions?: Set<string>;
    tables?: any[]; // Array of table metadata with logical_name
}>();

// Emits
const emit = defineEmits<{
    (e: 'apply', suggestion: any): void;
    (e: 'dismiss', suggestionId: string): void;
}>();

// State
const isPanelOpen = ref(true);
const expandedSections = ref<Set<string>>(new Set(['high'])); // Default expand high confidence

// Computed properties
const visibleSuggestions = computed(() => {
    return props.suggestions.filter(s => !props.dismissedSuggestions?.has(s.id));
});

const highConfidenceSuggestions = computed(() => {
    return visibleSuggestions.value.filter(s => 
        s.confidence === 'high' || (s.confidence_score * 100) >= 70
    );
});

const mediumConfidenceSuggestions = computed(() => {
    return visibleSuggestions.value.filter(s => 
        s.confidence === 'medium' || ((s.confidence_score * 100) >= 40 && (s.confidence_score * 100) < 70)
    );
});

const lowConfidenceSuggestions = computed(() => {
    return visibleSuggestions.value.filter(s => 
        s.confidence === 'low' || (s.confidence_score * 100) < 40
    );
});

const totalSuggestions = computed(() => visibleSuggestions.value.length);

// Methods
function togglePanel() {
    isPanelOpen.value = !isPanelOpen.value;
}

function toggleSection(section: string) {
    if (expandedSections.value.has(section)) {
        expandedSections.value.delete(section);
    } else {
        expandedSections.value.add(section);
    }
}

function isSectionExpanded(section: string): boolean {
    return expandedSections.value.has(section);
}

function isApplied(suggestionId: string): boolean {
    return props.appliedSuggestions?.has(suggestionId) || false;
}

function handleApply(suggestion: any) {
    emit('apply', suggestion);
}

function handleDismiss(suggestionId: string) {
    emit('dismiss', suggestionId);
}

function getConfidenceColor(confidence: string): string {
    switch (confidence) {
        case 'high':
            return 'bg-green-500';
        case 'medium':
            return 'bg-yellow-500';
        case 'low':
            return 'bg-orange-500';
        default:
            return 'bg-gray-500';
    }
}

function getConfidenceIcon(confidence: string): string {
    switch (confidence) {
        case 'high':
            return '🟢';
        case 'medium':
            return '🟡';
        case 'low':
            return '🔴';
        default:
            return '⚪';
    }
}

// Get logical table name for display (use display name from suggestion or fallback)
function getTableLogicalName(schema: string, tableName: string, displayName?: string): string {
    // First priority: use the display name from the suggestion
    if (displayName) {
        return displayName;
    }
    
    // Second priority: look up in tables prop
    if (props.tables) {
        const table = props.tables.find(t => 
            t.schema === schema && 
            (t.table_name === tableName || t.physical_table_name === tableName)
        );
        
        if (table?.logical_name) {
            return table.logical_name;
        }
    }
    
    // Fallback: use physical name
    return tableName;
}

// Format table.column display with logical names
function formatColumnDisplay(schema: string, table: string, column: string, tableDisplayName?: string): string {
    const logicalTableName = getTableLogicalName(schema, table, tableDisplayName);
    return `${logicalTableName}.${column}`;
}
</script>

<template>
    <div class="suggested-joins-panel bg-white rounded-lg shadow-md border border-gray-200 mb-6">
        <!-- Panel Header -->
        <div 
            class="panel-header flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            @click="togglePanel"
        >
            <div class="flex items-center gap-3">
                <span class="text-xl">🤖</span>
                <h3 class="text-lg font-semibold text-gray-800">
                    AI-Suggested JOIN Relationships
                </h3>
                <span 
                    v-if="totalSuggestions > 0"
                    class="px-2.5 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold rounded-full"
                >
                    {{ totalSuggestions }}
                </span>
                <span 
                    v-if="loading"
                    class="text-sm text-gray-500"
                >
                    <i class="fas fa-spinner fa-spin mr-1"></i>
                    Loading...
                </span>
            </div>
            <button 
                class="text-gray-500 hover:text-gray-700 transition-colors"
                :class="{ 'rotate-180': isPanelOpen }"
            >
                <i class="fas fa-chevron-down"></i>
            </button>
        </div>

        <!-- Panel Content -->
        <div v-show="isPanelOpen" class="panel-content p-4 pt-0">
            <!-- Empty State -->
            <div 
                v-if="!loading && totalSuggestions === 0"
                class="text-center py-8 text-gray-500"
            >
                <i class="fas fa-info-circle text-3xl mb-2"></i>
                <p class="text-sm">No suggested joins found for this data source.</p>
                <p class="text-xs mt-1">Suggestions appear when tables lack foreign key relationships.</p>
            </div>

            <!-- Loading State -->
            <div 
                v-if="loading"
                class="text-center py-8 text-gray-500"
            >
                <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
                <p class="text-sm">Analyzing schema for potential relationships...</p>
            </div>

            <!-- High Confidence Section -->
            <div 
                v-if="highConfidenceSuggestions.length > 0"
                class="confidence-section mb-4"
            >
                <div 
                    class="section-header flex items-center justify-between p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                    @click="toggleSection('high')"
                >
                    <div class="flex items-center gap-2">
                        <span class="text-lg">🟢</span>
                        <h4 class="font-semibold text-green-800">
                            High Confidence
                        </h4>
                        <span class="text-xs text-green-600">
                            ({{ highConfidenceSuggestions.length }} suggestions)
                        </span>
                    </div>
                    <i 
                        class="fas fa-chevron-down text-green-700 transition-transform"
                        :class="{ 'rotate-180': isSectionExpanded('high') }"
                    ></i>
                </div>

                <div v-show="isSectionExpanded('high')" class="section-content mt-2 space-y-2">
                    <div 
                        v-for="suggestion in highConfidenceSuggestions"
                        :key="suggestion.id"
                        class="suggestion-card bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        :class="{ 'bg-green-50 border-green-400': isApplied(suggestion.id) }"
                    >
                        <!-- Join Visualization -->
                        <div class="join-visual flex items-center gap-2 mb-3 flex-wrap">
                            <span class="join-visual-text font-mono text-sm text-gray-700">
                                {{ formatColumnDisplay(suggestion.left_schema, suggestion.left_table, suggestion.left_column, suggestion.left_table_display) }}
                            </span>
                            <i class="fas fa-arrow-right text-green-600"></i>
                            <span class="join-visual-text font-mono text-sm text-gray-700">
                                {{ formatColumnDisplay(suggestion.right_schema, suggestion.right_table, suggestion.right_column, suggestion.right_table_display) }}
                            </span>
                        </div>

                        <!-- Confidence Score -->
                        <div class="confidence-bar mb-2">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-gray-600">Confidence</span>
                                <span class="text-xs font-semibold text-green-700">
                                    {{ Math.round((suggestion.confidence_score || 0) * 100) }}%
                                </span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    class="bg-green-500 h-2 rounded-full transition-all"
                                    :style="{ width: Math.round((suggestion.confidence_score || 0) * 100) + '%' }"
                                ></div>
                            </div>
                        </div>

                        <!-- Reasoning -->
                        <div class="reasoning mb-3">
                            <p class="text-sm text-gray-700">
                                <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>
                                {{ suggestion.reasoning }}
                            </p>
                        </div>

                        <!-- Matched Patterns -->
                        <div 
                            v-if="suggestion.matched_patterns && suggestion.matched_patterns.length > 0"
                            class="patterns mb-3 flex flex-wrap gap-1"
                        >
                            <span 
                                v-for="pattern in suggestion.matched_patterns"
                                :key="pattern"
                                class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full"
                            >
                                {{ pattern }}
                            </span>
                        </div>

                        <!-- Actions -->
                        <div class="actions flex gap-2">
                            <button
                                v-if="!isApplied(suggestion.id)"
                                @click="handleApply(suggestion)"
                                class="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all cursor-pointer"
                            >
                                <i class="fas fa-check mr-1"></i>
                                Apply JOIN
                            </button>
                            <span
                                v-else
                                class="flex-1 px-4 py-2 bg-green-100 text-green-700 text-sm font-semibold rounded-lg text-center"
                            >
                                <i class="fas fa-check-circle mr-1"></i>
                                Applied
                            </span>
                            <button
                                v-if="!isApplied(suggestion.id)"
                                @click="handleDismiss(suggestion.id)"
                                class="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                <i class="fas fa-times mr-1"></i>
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Medium Confidence Section -->
            <div 
                v-if="mediumConfidenceSuggestions.length > 0"
                class="confidence-section mb-4"
            >
                <div 
                    class="section-header flex items-center justify-between p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
                    @click="toggleSection('medium')"
                >
                    <div class="flex items-center gap-2">
                        <span class="text-lg">🟡</span>
                        <h4 class="font-semibold text-yellow-800">
                            Medium Confidence
                        </h4>
                        <span class="text-xs text-yellow-600">
                            ({{ mediumConfidenceSuggestions.length }} suggestions)
                        </span>
                    </div>
                    <i 
                        class="fas fa-chevron-down text-yellow-700 transition-transform"
                        :class="{ 'rotate-180': isSectionExpanded('medium') }"
                    ></i>
                </div>

                <div v-show="isSectionExpanded('medium')" class="section-content mt-2 space-y-2">
                    <div 
                        v-for="suggestion in mediumConfidenceSuggestions"
                        :key="suggestion.id"
                        class="suggestion-card bg-white border border-yellow-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        :class="{ 'bg-yellow-50 border-yellow-400': isApplied(suggestion.id) }"
                    >
                        <!-- Join Visualization -->
                        <div class="join-visual flex items-center gap-2 mb-3 flex-wrap">
                            <span class="join-visual-text font-mono text-sm text-gray-700">
                                {{ formatColumnDisplay(suggestion.left_schema, suggestion.left_table, suggestion.left_column, suggestion.left_table_display) }}
                            </span>
                            <i class="fas fa-arrow-right text-yellow-600"></i>
                            <span class="join-visual-text font-mono text-sm text-gray-700">
                                {{ formatColumnDisplay(suggestion.right_schema, suggestion.right_table, suggestion.right_column, suggestion.right_table_display) }}
                            </span>
                        </div>

                        <!-- Confidence Score -->
                        <div class="confidence-bar mb-2">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-gray-600">Confidence</span>
                                <span class="text-xs font-semibold text-yellow-700">
                                    {{ Math.round((suggestion.confidence_score || 0) * 100) }}%
                                </span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    class="bg-yellow-500 h-2 rounded-full transition-all"
                                    :style="{ width: Math.round((suggestion.confidence_score || 0) * 100) + '%' }"
                                ></div>
                            </div>
                        </div>

                        <!-- Reasoning -->
                        <div class="reasoning mb-3">
                            <p class="text-sm text-gray-700">
                                <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>
                                {{ suggestion.reasoning }}
                            </p>
                        </div>

                        <!-- Matched Patterns -->
                        <div 
                            v-if="suggestion.matched_patterns && suggestion.matched_patterns.length > 0"
                            class="patterns mb-3 flex flex-wrap gap-1"
                        >
                            <span 
                                v-for="pattern in suggestion.matched_patterns"
                                :key="pattern"
                                class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full"
                            >
                                {{ pattern }}
                            </span>
                        </div>

                        <!-- Warning -->
                        <div class="warning mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            Review carefully - verify this relationship makes sense for your data.
                        </div>

                        <!-- Actions -->
                        <div class="actions flex gap-2">
                            <button
                                v-if="!isApplied(suggestion.id)"
                                @click="handleApply(suggestion)"
                                class="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all cursor-pointer"
                            >
                                <i class="fas fa-check mr-1"></i>
                                Apply JOIN
                            </button>
                            <span
                                v-else
                                class="flex-1 px-4 py-2 bg-yellow-100 text-yellow-700 text-sm font-semibold rounded-lg text-center"
                            >
                                <i class="fas fa-check-circle mr-1"></i>
                                Applied
                            </span>
                            <button
                                v-if="!isApplied(suggestion.id)"
                                @click="handleDismiss(suggestion.id)"
                                class="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <i class="fas fa-times mr-1"></i>
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Low Confidence Section -->
            <div 
                v-if="lowConfidenceSuggestions.length > 0"
                class="confidence-section"
            >
                <div 
                    class="section-header flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                    @click="toggleSection('low')"
                >
                    <div class="flex items-center gap-2">
                        <span class="text-lg">🔴</span>
                        <h4 class="font-semibold text-orange-800">
                            Low Confidence
                        </h4>
                        <span class="text-xs text-orange-600">
                            ({{ lowConfidenceSuggestions.length }} suggestions)
                        </span>
                    </div>
                    <i 
                        class="fas fa-chevron-down text-orange-700 transition-transform"
                        :class="{ 'rotate-180': isSectionExpanded('low') }"
                    ></i>
                </div>

                <div v-show="isSectionExpanded('low')" class="section-content mt-2 space-y-2">
                    <div 
                        v-for="suggestion in lowConfidenceSuggestions"
                        :key="suggestion.id"
                        class="suggestion-card bg-white border border-orange-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        :class="{ 'bg-orange-50 border-orange-400': isApplied(suggestion.id) }"
                    >
                        <!-- Join Visualization -->
                        <div class="join-visual flex items-center gap-2 mb-3 flex-wrap">
                            <span class="join-visual-text font-mono text-sm text-gray-700">
                                {{ formatColumnDisplay(suggestion.left_schema, suggestion.left_table, suggestion.left_column, suggestion.left_table_display) }}
                            </span>
                            <i class="fas fa-arrow-right text-orange-600"></i>
                            <span class="join-visual-text font-mono text-sm text-gray-700">
                                {{ formatColumnDisplay(suggestion.right_schema, suggestion.right_table, suggestion.right_column, suggestion.right_table_display) }}
                            </span>
                        </div>

                        <!-- Confidence Score -->
                        <div class="confidence-bar mb-2">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-gray-600">Confidence</span>
                                <span class="text-xs font-semibold text-orange-700">
                                    {{ Math.round((suggestion.confidence_score || 0) * 100) }}%
                                </span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    class="bg-orange-500 h-2 rounded-full transition-all"
                                    :style="{ width: Math.round((suggestion.confidence_score || 0) * 100) + '%' }"
                                ></div>
                            </div>
                        </div>

                        <!-- Reasoning -->
                        <div class="reasoning mb-3">
                            <p class="text-sm text-gray-700">
                                <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>
                                {{ suggestion.reasoning }}
                            </p>
                        </div>

                        <!-- Matched Patterns -->
                        <div 
                            v-if="suggestion.matched_patterns && suggestion.matched_patterns.length > 0"
                            class="patterns mb-3 flex flex-wrap gap-1"
                        >
                            <span 
                                v-for="pattern in suggestion.matched_patterns"
                                :key="pattern"
                                class="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full"
                            >
                                {{ pattern }}
                            </span>
                        </div>

                        <!-- Warning -->
                        <div class="warning mb-3 p-2 bg-orange-50 border border-orange-300 rounded text-xs text-orange-800">
                            <i class="fas fa-exclamation-circle mr-1"></i>
                            <strong>Use with caution:</strong> This suggestion has low confidence. Verify data relationships carefully before applying.
                        </div>

                        <!-- Actions -->
                        <div class="actions flex gap-2">
                            <button
                                v-if="!isApplied(suggestion.id)"
                                @click="handleApply(suggestion)"
                                class="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all cursor-pointer"
                            >
                                <i class="fas fa-check mr-1"></i>
                                Apply JOIN
                            </button>
                            <span
                                v-else
                                class="flex-1 px-4 py-2 bg-orange-100 text-orange-700 text-sm font-semibold rounded-lg text-center"
                            >
                                <i class="fas fa-check-circle mr-1"></i>
                                Applied
                            </span>
                            <button
                                v-if="!isApplied(suggestion.id)"
                                @click="handleDismiss(suggestion.id)"
                                class="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <i class="fas fa-times mr-1"></i>
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.suggested-joins-panel {
    transition: all 0.3s ease;
}

.panel-header button {
    transition: transform 0.3s ease;
}

.section-header i {
    transition: transform 0.3s ease;
}

.rotate-180 {
    transform: rotate(180deg);
}

.suggestion-card {
    transition: all 0.3s ease;
}

.suggestion-card:hover {
    transform: translateY(-2px);
}

.join-visual-text {
    min-width: 0;
    flex: 1 1 0;
    word-break: break-all;
    overflow-wrap: anywhere;
}
</style>
