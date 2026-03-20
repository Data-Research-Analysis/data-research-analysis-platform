<script setup lang="ts">
interface Props {
    modelValue?: number;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    error?: string | boolean;
    success?: boolean;
    disabled?: boolean;
    required?: boolean;
    inputClass?: string;
    showControls?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: 0,
    step: 1,
    disabled: false,
    required: false,
    error: false,
    success: false,
    showControls: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: number];
    'blur': [event: FocusEvent];
    'focus': [event: FocusEvent];
    'input': [event: Event];
}>();

function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value === '' ? 0 : Number(target.value);
    emit('update:modelValue', value);
    emit('input', event);
}

function increment() {
    if (props.disabled) return;
    const newValue = (props.modelValue || 0) + (props.step || 1);
    if (props.max === undefined || newValue <= props.max) {
        emit('update:modelValue', newValue);
    }
}

function decrement() {
    if (props.disabled) return;
    const newValue = (props.modelValue || 0) - (props.step || 1);
    if (props.min === undefined || newValue >= props.min) {
        emit('update:modelValue', newValue);
    }
}
</script>

<template>
    <div class="relative">
        <input
            :value="modelValue"
            @input="handleInput"
            @blur="emit('blur', $event)"
            @focus="emit('focus', $event)"
            type="number"
            :min="min"
            :max="max"
            :step="step"
            :placeholder="placeholder"
            :disabled="disabled"
            :required="required"
            class="w-full p-3 border border-gray-300 rounded-lg shadow-sm 
                   focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent 
                   transition-all duration-200
                   disabled:bg-gray-100 disabled:cursor-not-allowed"
            :class="[
                error && 'border-red-500 bg-red-50',
                success && 'border-green-500 bg-green-50',
                showControls && 'pr-20',
                inputClass
            ]"
        />
        
        <!-- Custom increment/decrement controls -->
        <div v-if="showControls" class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <button
                type="button"
                @click="decrement"
                :disabled="disabled || (min !== undefined && modelValue <= min)"
                class="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <font-awesome-icon :icon="['fas', 'minus']" class="text-xs" />
            </button>
            <button
                type="button"
                @click="increment"
                :disabled="disabled || (max !== undefined && modelValue >= max)"
                class="w-7 h-7 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <font-awesome-icon :icon="['fas', 'plus']" class="text-xs" />
            </button>
        </div>
        
        <!-- Error message -->
        <p v-if="error && typeof error === 'string'" class="mt-1 text-sm text-red-500">
            {{ error }}
        </p>
    </div>
</template>
