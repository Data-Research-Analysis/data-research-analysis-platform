<script setup lang="ts">
interface Props {
    modelValue?: boolean;
    label?: string;
    disabled?: boolean;
    error?: string | boolean;
    value?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    disabled: false,
    error: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    'change': [event: Event];
}>();

function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    emit('update:modelValue', target.checked);
    emit('change', event);
}
</script>

<template>
    <div class="flex items-center">
        <input
            :checked="modelValue"
            @change="handleChange"
            type="checkbox"
            :value="value"
            :disabled="disabled"
            class="h-4 w-4 text-primary-blue-100 focus:ring-2 focus:ring-primary-blue-100 
                   border-gray-300 rounded transition-all cursor-pointer
                   disabled:cursor-not-allowed disabled:opacity-50"
            :class="[
                error && 'border-red-500'
            ]"
        />
        <label
            v-if="label"
            class="ml-2 text-sm text-gray-700 cursor-pointer select-none"
            :class="{ 'opacity-50 cursor-not-allowed': disabled }"
            @click="!disabled && emit('update:modelValue', !modelValue)"
        >
            {{ label }}
        </label>
        
        <!-- Error message -->
        <p v-if="error && typeof error === 'string'" class="mt-1 text-sm text-red-500 ml-6">
            {{ error }}
        </p>
    </div>
</template>
