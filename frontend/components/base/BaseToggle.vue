<script setup lang="ts">
interface Props {
    modelValue?: boolean;
    label?: string;
    disabled?: boolean;
    error?: string | boolean;
    labelPosition?: 'left' | 'right';
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    disabled: false,
    error: false,
    labelPosition: 'right',
});

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    'change': [event: Event];
}>();

function toggle() {
    if (!props.disabled) {
        emit('update:modelValue', !props.modelValue);
    }
}
</script>

<template>
    <div class="flex items-center gap-3">
        <!-- Label on left -->
        <span
            v-if="label && labelPosition === 'left'"
            class="text-sm font-medium text-gray-700"
            :class="{ 'opacity-50': disabled }"
        >
            {{ label }}
        </span>
        
        <!-- Toggle switch -->
        <button
            type="button"
            @click="toggle"
            :disabled="disabled"
            role="switch"
            :aria-checked="modelValue"
            class="relative inline-flex items-center cursor-pointer"
            :class="{ 'opacity-50 cursor-not-allowed': disabled }"
        >
            <input
                type="checkbox"
                :checked="modelValue"
                class="sr-only peer"
                :disabled="disabled"
            />
            <div
                class="w-11 h-6 bg-gray-300 rounded-full peer 
                       peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 
                       transition-all duration-200
                       peer-checked:after:translate-x-full peer-checked:after:border-white 
                       after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                       after:bg-white after:border-gray-300 after:border after:rounded-full 
                       after:h-5 after:w-5 after:transition-all"
                :class="[
                    modelValue ? 'bg-primary-blue-100' : 'bg-gray-300',
                    error && 'ring-2 ring-red-500'
                ]"
            ></div>
        </button>
        
        <!-- Label on right -->
        <span
            v-if="label && labelPosition === 'right'"
            class="text-sm font-medium text-gray-700"
            :class="{ 'opacity-50': disabled }"
        >
            {{ label }}
        </span>
        
        <!-- Error message -->
        <p v-if="error && typeof error === 'string'" class="mt-1 text-sm text-red-500">
            {{ error }}
        </p>
    </div>
</template>
