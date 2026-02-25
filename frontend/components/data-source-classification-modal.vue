<script setup lang="ts">
import { ref, computed } from 'vue';
import { DATA_SOURCE_CLASSIFICATIONS, CLASSIFICATION_COLOR_CLASSES } from '@/utils/dataSourceClassifications';

const props = defineProps<{
    modelValue: boolean;
    /** Label shown on the confirm button (default: "Save Connection") */
    confirmLabel?: string;
    /** Whether the confirm action is loading */
    loading?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'confirm', classification: string): void;
    (e: 'cancel'): void;
}>();

const selected = ref<string | null>(null);

const canConfirm = computed(() => !!selected.value && !props.loading);

function selectClassification(value: string) {
    selected.value = value;
}

function confirm() {
    if (!selected.value) return;
    emit('confirm', selected.value);
}

function cancel() {
    selected.value = null;
    emit('update:modelValue', false);
    emit('cancel');
}

function colorClasses(color: string, isSelected: boolean) {
    const c = CLASSIFICATION_COLOR_CLASSES[color] ?? CLASSIFICATION_COLOR_CLASSES['gray'];
    if (isSelected) {
        return `${c.bg} ${c.border} border-2`;
    }
    return 'bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50';
}
</script>

<template>
    <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
    >
        <!-- Backdrop -->
        <div
            class="absolute inset-0 bg-black bg-opacity-40"
            @click="cancel"
        />

        <!-- Modal panel -->
        <div class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-8">
            <!-- Header -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-2">
                    What type of data does this source contain?
                </h2>
                <p class="text-sm text-gray-500">
                    This helps organise your data in the right section and improves AI suggestions.
                </p>
            </div>

            <!-- Classification grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                <button
                    v-for="option in DATA_SOURCE_CLASSIFICATIONS"
                    :key="option.value"
                    type="button"
                    class="relative flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-blue-100"
                    :class="colorClasses(option.color, selected === option.value)"
                    @click="selectClassification(option.value)"
                >
                    <!-- Checkmark badge when selected -->
                    <span
                        v-if="selected === option.value"
                        class="absolute top-2 right-2 w-5 h-5 bg-primary-blue-100 rounded-full flex items-center justify-center"
                    >
                        <font-awesome-icon :icon="['fas', 'check']" class="text-white text-[9px]" />
                    </span>

                    <font-awesome-icon
                        :icon="option.icon"
                        class="text-2xl"
                        :class="(CLASSIFICATION_COLOR_CLASSES[option.color] ?? CLASSIFICATION_COLOR_CLASSES['gray']).text"
                    />
                    <span class="text-sm font-semibold text-gray-800 leading-tight">
                        {{ option.label }}
                    </span>
                    <span class="text-xs text-gray-500 leading-snug">
                        {{ option.description }}
                    </span>
                </button>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between">
                <button
                    type="button"
                    class="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    @click="cancel"
                >
                    Cancel
                </button>

                <button
                    type="button"
                    class="px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors flex items-center gap-2"
                    :class="canConfirm
                        ? 'bg-primary-blue-100 hover:bg-primary-blue-300 cursor-pointer'
                        : 'bg-gray-300 cursor-not-allowed'"
                    :disabled="!canConfirm"
                    @click="confirm"
                >
                    <font-awesome-icon
                        v-if="loading"
                        :icon="['fas', 'spinner']"
                        class="animate-spin"
                    />
                    {{ confirmLabel ?? 'Save Connection' }}
                    <font-awesome-icon
                        v-if="!loading"
                        :icon="['fas', 'arrow-right']"
                    />
                </button>
            </div>
        </div>
    </div>
</template>
