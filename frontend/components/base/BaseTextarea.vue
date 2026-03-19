<script setup lang="ts">
interface Props {
    modelValue?: string;
    placeholder?: string;
    error?: string | boolean;
    success?: boolean;
    disabled?: boolean;
    required?: boolean;
    maxlength?: number;
    rows?: number;
    autofocus?: boolean;
    readonly?: boolean;
    inputClass?: string;
    showCounter?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    rows: 4,
    disabled: false,
    required: false,
    error: false,
    success: false,
    autofocus: false,
    readonly: false,
    showCounter: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    'blur': [event: FocusEvent];
    'focus': [event: FocusEvent];
    'input': [event: Event];
}>();

const characterCount = computed(() => {
    return typeof props.modelValue === 'string' ? props.modelValue.length : 0;
});

function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    emit('update:modelValue', target.value);
    emit('input', event);
}
</script>

<template>
    <div class="relative">
        <textarea
            :value="modelValue"
            @input="handleInput"
            @blur="emit('blur', $event)"
            @focus="emit('focus', $event)"
            :placeholder="placeholder"
            :disabled="disabled"
            :required="required"
            :maxlength="maxlength"
            :rows="rows"
            :autofocus="autofocus"
            :readonly="readonly"
            class="w-full p-3 border border-gray-300 rounded-lg shadow-sm 
                   focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent 
                   transition-all duration-200
                   disabled:bg-gray-100 disabled:cursor-not-allowed
                   readonly:bg-gray-50 resize-y"
            :class="[
                error && 'border-red-500 bg-red-50',
                success && 'border-green-500 bg-green-50',
                inputClass
            ]"
        ></textarea>
        
        <!-- Character counter -->
        <div v-if="showCounter && maxlength" class="flex justify-end mt-1">
            <span class="text-xs text-gray-500">
                {{ characterCount }} / {{ maxlength }}
            </span>
        </div>
        
        <!-- Error message -->
        <p v-if="error && typeof error === 'string'" class="mt-1 text-sm text-red-500">
            {{ error }}
        </p>
    </div>
</template>
