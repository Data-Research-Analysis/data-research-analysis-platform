<template>
    <div
        class="border border-gray-200 rounded-xl bg-white transition-[border-color,box-shadow] duration-200 overflow-hidden hover:border-gray-300"
        :class="{
            'border-green-200 hover:border-emerald-300': status === 'connected',
            'border-red-200 hover:border-red-300': status === 'error',
        }"
    >
        <!-- Card Header -->
        <div class="flex items-center justify-between py-4 px-5 cursor-pointer select-none" @click="toggleExpand">
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <img
                    v-if="source.image"
                    :src="source.image"
                    :alt="source.name"
                    class="w-8 h-8 rounded object-contain shrink-0"
                />
                <i v-else :class="source.icon" class="text-[1.5rem] text-gray-500 w-8 text-center shrink-0"></i>
                <div class="flex-1 min-w-0">
                    <h3 class="m-0 text-[0.95rem] font-semibold text-gray-900">{{ source.name }}</h3>
                    <p class="mt-0.5 mb-0 text-[0.8rem] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">{{ source.description }}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
                <ConnectionStatusBadge :status="status" />
                <button
                    class="bg-transparent border-none p-1 cursor-pointer text-gray-400 transition-[transform,color] duration-200 hover:text-gray-500"
                    :class="{ 'rotate-180': expanded }"
                    type="button"
                    @click.stop="toggleExpand"
                >
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        </div>

        <!-- Card Body (expandable) -->
        <div
            class="overflow-hidden transition-all duration-200 ease-in-out"
            :class="expanded ? 'max-h-[800px] opacity-100 pt-0 pb-5 px-5 border-t border-gray-100' : 'max-h-0 opacity-0'"
        >
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ConnectionSource } from '~/constants/connectionSources';

export type AuthStatus = 'idle' | 'loading' | 'connected' | 'error';

const props = defineProps<{
    source: ConnectionSource;
    status: AuthStatus;
    defaultExpanded?: boolean;
}>();

const emit = defineEmits<{
    'update:expanded': [value: boolean];
}>();

const expanded = ref(props.defaultExpanded ?? true);

function toggleExpand() {
    expanded.value = !expanded.value;
    emit('update:expanded', expanded.value);
}
</script>
