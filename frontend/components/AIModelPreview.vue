<script setup lang="ts">
import { computed, ref } from 'vue';
import { useModelPreview } from '~/composables/useModelPreview';

const props = withDefaults(defineProps<{
    modelDraft: any;
    compact?: boolean;
}>(), {
    compact: false
});

const emit = defineEmits<{
    apply: [];
}>();

// Use the composable with reactive model draft
const preview = computed(() => useModelPreview(props.modelDraft));

const isApplying = defineModel<boolean>('isApplying', { default: false });
const buttonState = defineModel<'normal' | 'loading' | 'success'>('buttonState', { default: 'normal' });
const showPreview = defineModel<boolean>('showPreview', { default: false });

// Collapse state
const isCollapsed = ref(false);

function handleApply() {
    emit('apply');
}

function toggleCollapse() {
    isCollapsed.value = !isCollapsed.value;
}
</script>

<template>
    <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 text-blue-700 font-medium">
                <font-awesome icon="fas fa-certificate" class="w-5 h-5" />
                <span>Data Model Ready</span>
                <span class="text-[10px] text-blue-500 font-normal">
                    (Model: {{ preview.getTablesList() }})
                </span>
            </div>
            <div class="flex items-center gap-2">
                <button
                    v-if="!compact"
                    @click="showPreview = !showPreview"
                    class="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                    <span>{{ showPreview ? 'Hide' : 'Show' }} Details</span>
                    <font-awesome 
                        icon="fas fa-chevron-down" 
                        :class="showPreview ? 'w-4 h-4 transition-transform rotate-180' : 'w-4 h-4 transition-transform'" 
                    />
                </button>
                <button
                    @click="toggleCollapse"
                    class="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100 cursor-pointer"
                    :title="isCollapsed ? 'Expand' : 'Collapse'"
                >
                    <font-awesome 
                        :icon="isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up'" 
                        class="w-4 h-4" 
                    />
                </button>
            </div>
        </div>
        
        <!-- Collapsible content -->
        <Transition
            enter-active-class="transition-all duration-200"
            leave-active-class="transition-all duration-200"
            enter-from-class="max-h-0 opacity-0 overflow-hidden"
            leave-to-class="max-h-0 opacity-0 overflow-hidden"
        >
            <div v-if="!isCollapsed">
                <p v-if="!compact" class="text-sm text-gray-700 mb-3">
                    AI has generated a data model configuration. Click the button below to apply it to the builder.
                </p>
                <p v-else class="text-sm text-gray-700 mb-3">
                    Click 'Apply to Builder' to use this model.
                </p>
        
        <!-- Collapsible Preview Section -->
        <Transition
            v-if="!compact"
            enter-active-class="transition-all duration-200"
            leave-active-class="transition-all duration-200"
            enter-from-class="max-h-0 opacity-0"
            leave-to-class="max-h-0 opacity-0"
        >
            <div v-if="showPreview" class="mb-3 p-3 bg-white border border-blue-100 text-xs rounded-lg">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <div class="font-semibold text-gray-700 mb-1">Table</div>
                        <div class="text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                            {{ preview.getTablesList() }}
                        </div>
                    </div>
                    <div>
                        <div class="font-semibold text-gray-700 mb-1">Column Count</div>
                        <div class="text-gray-600">{{ preview.getColumnCount() }} selected</div>
                    </div>
                    <div class="col-span-2">
                        <div class="font-semibold text-gray-700 mb-2">Selected Columns</div>
                        <div v-if="preview.getColumnNames().length > 0" class="flex flex-wrap gap-1.5">
                            <span 
                                v-for="(columnName, index) in preview.getColumnNames()" 
                                :key="index"
                                class="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-[11px] font-mono border border-blue-200 rounded"
                            >
                                {{ columnName }}
                            </span>
                        </div>
                        <div v-else class="text-gray-500 text-xs italic">
                            No columns selected
                        </div>
                    </div>
                </div>
                
                <div v-if="preview.hasWhereClause() || preview.hasGroupBy() || preview.hasOrderBy()" class="mt-3 pt-3 border-t border-blue-100">
                    <div class="font-semibold text-gray-700 mb-2">Query Options</div>
                    <div class="space-y-1">
                        <div v-if="preview.hasWhereClause()" class="flex gap-2">
                            <span class="text-gray-500 font-medium">WHERE:</span>
                            <span class="text-gray-600">{{ preview.getWhereConditions().join(', ') }}</span>
                        </div>
                        <div v-if="preview.hasGroupBy()" class="flex gap-2">
                            <span class="text-gray-500 font-medium">GROUP BY:</span>
                            <span class="text-gray-600">{{ preview.getGroupByColumns().join(', ') }}</span>
                        </div>
                        <div v-if="preview.hasOrderBy()" class="flex gap-2">
                            <span class="text-gray-500 font-medium">ORDER BY:</span>
                            <span class="text-gray-600">{{ preview.getOrderByColumns().join(', ') }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
        
        <!-- Apply Button -->
        <button
            @click="handleApply"
            :disabled="isApplying"
            class="w-full px-4 py-2.5 border-0 text-sm font-medium cursor-pointer transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-lg"
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
        </Transition>
    </div>
</template>
