<script setup lang="ts">
interface Props {
    label?: string;
    required?: boolean;
    hint?: string;
    error?: string;
}

const props = withDefaults(defineProps<Props>(), {
    required: false,
});
</script>

<template>
    <div class="mb-4">
        <label v-if="label" class="block text-sm font-medium text-gray-700 mb-2">
            {{ label }}
            <span v-if="required" class="text-red-500">*</span>
        </label>
        
        <slot />
        
        <p v-if="hint && !error" class="mt-1 text-sm text-gray-500">{{ hint }}</p>
        <p v-if="error" class="mt-1 text-sm text-red-500">{{ error }}</p>
    </div>
</template>
