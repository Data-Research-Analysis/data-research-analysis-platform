<script setup lang="ts">
interface Props {
    modelValue?: string;
    type?: 'date' | 'datetime-local' | 'time';
    min?: string;
    max?: string;
    error?: string | boolean;
    success?: boolean;
    disabled?: boolean;
    required?: boolean;
    inputClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
    type: 'date',
    modelValue: '',
    disabled: false,
    required: false,
    error: false,
    success: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    'change': [event: Event];
}>();

function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    emit('update:modelValue', target.value);
    emit('change', event);
}
</script>

<template>
    <div class="relative">
        <input
            :value="modelValue"
            @change="handleChange"
            :type="type"
            :min="min"
            :max="max"
            :disabled="disabled"
            :required="required"
            class="w-full p-3 border border-gray-300 rounded-lg shadow-sm 
                   focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent 
                   transition-all duration-200
                   disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
            :class="[
                error && 'border-red-500 bg-red-50',
                success && 'border-green-500 bg-green-50',
                inputClass
            ]"
        />
        
        <!-- Error message -->
        <p v-if="error && typeof error === 'string'" class="mt-1 text-sm text-red-500">
            {{ error }}
        </p>
    </div>
</template>
