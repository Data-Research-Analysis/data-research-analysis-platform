<script setup lang="ts">
import type { IPlanGate } from '@/stores/paid_media_plans';
import { useMarkdown } from '~/composables/useMarkdown';

const props = defineProps<{
    gate: IPlanGate;
}>();

const emit = defineEmits<{
    answer: [gateId: string, answer: string];
}>();

const { renderMarkdown } = useMarkdown();

const renderedQuestion = computed(() => renderMarkdown(props.gate.question));

const freeText = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const MAX_HEIGHT = 160;

const options = computed(() => {
    const raw = props.gate.options ?? [];
    return raw.map((option: any) => {
        if (typeof option === 'string') return { label: option, value: option };
        const label = String(option?.label ?? option?.value ?? '').trim();
        return { label, value: String(option?.value ?? label).trim() };
    }).filter((option) => option.label.length > 0);
});

function adjustHeight() {
    nextTick(() => {
        const el = textareaRef.value;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    });
}

function submit() {
    const answer = freeText.value.trim();
    if (!answer) return;
    emit('answer', props.gate.id, answer);
    freeText.value = '';
    nextTick(() => {
        if (textareaRef.value) textareaRef.value.style.height = 'auto';
    });
}

function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.isComposing) return;
    if (event.shiftKey) {
        nextTick(() => adjustHeight());
        return;
    }
    event.preventDefault();
    submit();
}

watch(() => props.gate.id, () => {
    freeText.value = '';
    nextTick(() => {
        if (textareaRef.value) textareaRef.value.style.height = 'auto';
    });
});
</script>

<template>
    <div class="bg-amber-50 border border-amber-200 rounded-2xl">
        <div class="flex items-start gap-3 px-4 py-3">
            <font-awesome-icon :icon="['fas', 'circle-exclamation']" class="text-amber-500 mt-0.5" />
            <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-amber-800">Action needed</p>
                <div class="prose prose-sm max-w-none text-amber-900 mt-0.5" v-html="renderedQuestion" />
                <div v-if="options.length" class="flex flex-wrap gap-2 mt-3">
                    <button
                        v-for="option in options"
                        :key="option.value"
                        type="button"
                        class="px-3 py-1.5 rounded-lg text-sm bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer"
                        @click="emit('answer', gate.id, option.value)"
                    >
                        {{ option.label }}
                    </button>
                </div>
                <div class="flex items-end gap-2 mt-3">
                    <textarea
                        ref="textareaRef"
                        v-model="freeText"
                        rows="2"
                        class="flex-1 px-3 py-1.5 text-sm rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none overflow-y-auto"
                        :placeholder="options.length ? 'Or answer in your own words' : 'Answer...'"
                        @keydown="handleKeydown"
                        @input="adjustHeight"
                    />
                    <button
                        v-if="freeText.trim()"
                        type="button"
                        class="px-3 py-1.5 rounded-lg text-sm bg-amber-500 text-white hover:bg-amber-600 cursor-pointer"
                        @click="submit"
                    >
                        Answer
                    </button>
                </div>
                <p class="text-xs text-amber-700 mt-1.5">
                    Press <kbd class="px-1 py-0.5 bg-white border border-amber-300 rounded text-xs font-mono">Enter</kbd> to send,
                    <kbd class="px-1 py-0.5 bg-white border border-amber-300 rounded text-xs font-mono">Shift+Enter</kbd> for a new line
                </p>
            </div>
        </div>
    </div>
</template>
