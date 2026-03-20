<script setup lang="ts">
interface Props {
    modelValue?: string | number;
    name: string;
    value: string | number;
    label?: string;
    disabled?: boolean;
    error?: string | boolean;
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    error: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string | number];
    'change': [event: Event];
}>();

function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    emit('update:modelValue', props.value);
    emit('change', event);
}
</script>

<template>
    <div class="flex items-center">
        <input
            :checked="modelValue === value"
            @change="handleChange"
            type="radio"
            :name="name"
            :value="value"
            :disabled="disabled"
            class="h-4 w-4 text-primary-blue-100 focus:ring-2 focus:ring-primary-blue-100 
                   border-gray-300 transition-all cursor-pointer
                   disabled:cursor-not-allowed disabled:opacity-50"
            :class="[
                error && 'border-red-500'
            ]"
        />
        <label
            v-if="label"
            class="ml-2 text-sm text-gray-700 cursor-pointer select-none"
            :class="{ 'opacity-50 cursor-not-allowed': disabled }"
            @click="!disabled && emit('update:modelValue', value)"
        >
            {{ label }}
        </label>
    </div>
</template>
