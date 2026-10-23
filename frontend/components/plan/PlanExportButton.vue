<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';

const props = defineProps<{
    planId: number;
}>();

const store = usePaidMediaPlansStore();

const exporting = ref(false);

async function exportPack() {
    exporting.value = true;
    try {
        await store.exportPlan(props.planId);
    } finally {
        exporting.value = false;
    }
}
</script>

<template>
    <button
        type="button"
        class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
        :disabled="exporting"
        @click="exportPack"
    >
        <font-awesome-icon :icon="['fas', exporting ? 'circle-notch' : 'file-zipper']" class="mr-1" :class="{ 'animate-spin': exporting }" />
        {{ exporting ? 'Exporting...' : 'Download plan pack' }}
    </button>
</template>
