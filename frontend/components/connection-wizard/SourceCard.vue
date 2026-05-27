<template>
    <div
        class="relative flex flex-col items-center p-5 px-4 border-2 border-gray-200 rounded-xl bg-white cursor-pointer transition-all duration-200 text-center select-none hover:not-[.opacity-55]:border-indigo-500 hover:not-[.opacity-55]:shadow-[0_4px_12px_rgba(99,102,241,0.15)] hover:not-[.opacity-55]:-translate-y-0.5"
        :class="{
            'border-indigo-500 bg-indigo-50 shadow-[0_0_0_1px_#6366f1]': selected,
            'opacity-55 cursor-not-allowed': source.comingSoon,
        }"
        role="button"
        tabindex="0"
        :aria-pressed="selected"
        :aria-label="`Select ${source.name}`"
        @click="handleClick"
        @keydown.enter="handleClick"
        @keydown.space.prevent="handleClick"
    >
        <!-- Popular Badge -->
        <span v-if="source.popular" class="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-semibold text-white bg-gradient-to-br from-amber-400 to-orange-500 rounded-full uppercase tracking-wide">
            <i class="fas fa-star"></i> Popular
        </span>

        <!-- Selected Checkmark -->
        <span v-if="selected" class="absolute top-2 left-2 text-xl text-indigo-500">
            <i class="fas fa-check-circle"></i>
        </span>

        <!-- Source Icon / Image -->
        <div class="w-12 h-12 flex items-center justify-center mb-3">
            <img
                v-if="source.image"
                :src="source.image"
                :alt="source.name"
                class="max-w-full max-h-full object-contain"
            />
            <i v-else :class="source.icon" class="text-3xl text-gray-500"></i>
        </div>

        <!-- Source Info -->
        <div class="flex-1">
            <h4 class="mb-1 text-sm font-semibold text-gray-900">{{ source.name }}</h4>
            <p class="m-0 text-xs text-gray-500 leading-snug">{{ source.description }}</p>
        </div>

        <!-- Coming Soon Overlay -->
        <div v-if="source.comingSoon" class="absolute bottom-0 left-0 right-0 px-1 py-1.5 text-center text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-b-[10px] uppercase tracking-wider">
            Coming Soon
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ConnectionSource } from '~/constants/connectionSources';

interface Props {
    source: ConnectionSource;
    selected: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'toggle', sourceId: string): void;
}>();

function handleClick() {
    if (props.source.comingSoon) return;
    emit('toggle', props.source.id);
}
</script>