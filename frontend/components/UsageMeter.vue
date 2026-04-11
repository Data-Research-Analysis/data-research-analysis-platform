<template>
    <div class="space-y-2">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <font-awesome-icon :icon="icon" class="text-gray-600" />
                <span class="text-sm font-medium text-gray-700">{{ label }}</span>
                <span v-if="helpText" class="text-xs text-gray-500">({{ helpText }})</span>
            </div>
            <div class="text-sm font-semibold text-gray-900">
                {{ current }} / {{ limitDisplay }}
            </div>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
            <div 
                :class="[
                    'h-2 rounded-full transition-all duration-300',
                    progressColor
                ]"
                :style="{ width: progressWidth }"
            ></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    label: string;
    current: number;
    limit: number | null | undefined;
    icon: string;
    helpText?: string;
}>();

const limitDisplay = computed(() => {
    if (props.limit === null || props.limit === undefined) return 'Unlimited';
    if (props.limit === -1) return 'Unlimited';
    return props.limit.toString();
});

const progressWidth = computed(() => {
    if (props.limit === null || props.limit === undefined || props.limit === -1) {
        return '100%'; // Show full for unlimited
    }
    const percentage = Math.min(100, (props.current / props.limit) * 100);
    return `${percentage}%`;
});

const progressColor = computed(() => {
    if (props.limit === null || props.limit === undefined || props.limit === -1) {
        return 'bg-green-500'; // Green for unlimited
    }
    const percentage = (props.current / props.limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
});
</script>
