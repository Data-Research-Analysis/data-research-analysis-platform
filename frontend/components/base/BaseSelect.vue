<script setup lang="ts">
interface SelectOption {
    value: string | number;
    label: string;
    disabled?: boolean;
}

interface Props {
    modelValue?: string | number;
    options: SelectOption[];
    placeholder?: string;
    error?: string | boolean;
    success?: boolean;
    disabled?: boolean;
    required?: boolean;
    inputClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    disabled: false,
    required: false,
    error: false,
    success: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string | number];
    'change': [event: Event];
}>();

function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    emit('update:modelValue', target.value);
    emit('change', event);
}
</script>

<template>
    <div class="relative">
        <select
            :value="modelValue"
            @change="handleChange"
            :disabled="disabled"
            :required="required"
            class="w-full p-3 border border-gray-300 rounded-lg shadow-sm 
                   focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent 
                   transition-all duration-200
                   disabled:bg-gray-100 disabled:cursor-not-allowed
                   appearance-none bg-white cursor-pointer"
            :class="[
                error && 'border-red-500 bg-red-50',
                success && 'border-green-500 bg-green-50',
                inputClass
            ]"
        >
            <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
            <option
                v-for="option in options"
                :key="option.value"
                :value="option.value"
                :disabled="option.disabled"
            >
                {{ option.label }}
            </option>
        </select>
        
        <!-- Dropdown arrow icon -->
        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <font-awesome-icon :icon="['fas', 'chevron-down']" class="text-gray-400 text-sm" />
        </div>
        
        <!-- Error message -->
        <p v-if="error && typeof error === 'string'" class="mt-1 text-sm text-red-500">
            {{ error }}
        </p>
    </div>
</template>
