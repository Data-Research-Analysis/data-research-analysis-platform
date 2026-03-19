<script setup lang="ts">
interface Props {
    modelValue?: string | number;
    type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'search';
    placeholder?: string;
    error?: string | boolean;
    success?: boolean;
    disabled?: boolean;
    required?: boolean;
    maxlength?: number;
    autocomplete?: string;
    autofocus?: boolean;
    readonly?: boolean;
    inputClass?: string;
    showPasswordToggle?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    type: 'text',
    modelValue: '',
    disabled: false,
    required: false,
    error: false,
    success: false,
    autofocus: false,
    readonly: false,
    showPasswordToggle: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string | number];
    'blur': [event: FocusEvent];
    'focus': [event: FocusEvent];
    'input': [event: Event];
}>();

const showPassword = ref(false);
const inputType = computed(() => {
    if (props.type === 'password' && props.showPasswordToggle) {
        return showPassword.value ? 'text' : 'password';
    }
    return props.type;
});

function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    emit('update:modelValue', target.value);
    emit('input', event);
}
</script>

<template>
    <div class="relative">
        <input
            :value="modelValue"
            @input="handleInput"
            @blur="emit('blur', $event)"
            @focus="emit('focus', $event)"
            :type="inputType"
            :placeholder="placeholder"
            :disabled="disabled"
            :required="required"
            :maxlength="maxlength"
            :autocomplete="autocomplete"
            :autofocus="autofocus"
            :readonly="readonly"
            class="w-full p-3 border border-gray-300 rounded-lg shadow-sm 
                   focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent 
                   transition-all duration-200
                   disabled:bg-gray-100 disabled:cursor-not-allowed
                   readonly:bg-gray-50"
            :class="[
                error && 'border-red-500 bg-red-50',
                success && 'border-green-500 bg-green-50',
                inputClass
            ]"
        />
        
        <!-- Password visibility toggle -->
        <button
            v-if="showPasswordToggle && type === 'password'"
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
            :disabled="disabled"
            tabindex="-1"
        >
            <font-awesome-icon 
                :icon="['fas', showPassword ? 'eye-slash' : 'eye']" 
                class="cursor-pointer"
            />
        </button>
        
        <!-- Error message -->
        <p v-if="error && typeof error === 'string'" class="mt-1 text-sm text-red-500">
            {{ error }}
        </p>
    </div>
</template>
