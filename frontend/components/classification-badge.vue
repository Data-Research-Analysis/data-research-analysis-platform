<script setup lang="ts">
import { computed } from 'vue';
import {
    getClassification,
    CLASSIFICATION_COLOR_CLASSES,
} from '@/utils/dataSourceClassifications';

const props = defineProps<{
    classification?: string | null;
}>();

const meta = computed(() => getClassification(props.classification));

const colors = computed(() => {
    if (!meta.value) {
        return CLASSIFICATION_COLOR_CLASSES['gray'];
    }
    return CLASSIFICATION_COLOR_CLASSES[meta.value.color] ?? CLASSIFICATION_COLOR_CLASSES['gray'];
});
</script>

<template>
    <span
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
        :class="[colors.bg, colors.text, colors.border]"
    >
        <font-awesome-icon
            v-if="meta"
            :icon="meta.icon"
            class="text-[10px]"
        />
        <font-awesome-icon
            v-else
            :icon="['fas', 'circle-question']"
            class="text-[10px]"
        />
        <span>{{ meta ? meta.label : 'Unclassified' }}</span>
    </span>
</template>
