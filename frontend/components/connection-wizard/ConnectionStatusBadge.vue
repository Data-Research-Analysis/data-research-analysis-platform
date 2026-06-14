<template>
    <span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200" :class="badgeClass">
        <i v-if="status === 'loading'" class="fas fa-spinner fa-spin text-[0.625rem]"></i>
        <i v-else-if="status === 'connected'" class="fas fa-check-circle text-[0.625rem]"></i>
        <i v-else-if="status === 'error'" class="fas fa-exclamation-circle text-[0.625rem]"></i>
        <i v-else class="fas fa-circle text-[0.625rem] opacity-40"></i>
        <span>{{ label }}</span>
    </span>
</template>

<script setup lang="ts">
import type { AuthStatus } from './SourceAuthCard.vue';

const props = defineProps<{
    status: AuthStatus;
}>();

const label = computed(() => {
    switch (props.status) {
        case 'connected': return 'Connected';
        case 'loading': return 'Connecting…';
        case 'error': return 'Error';
        case 'idle':
        default: return 'Not Connected';
    }
});

const badgeClass = computed(() => {
    switch (props.status) {
        case 'connected': return 'bg-emerald-50 text-emerald-600';
        case 'loading': return 'bg-blue-50 text-blue-500';
        case 'error': return 'bg-red-50 text-red-600';
        case 'idle':
        default: return 'bg-gray-100 text-gray-500';
    }
});
</script>