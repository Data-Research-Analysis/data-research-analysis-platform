<script setup lang="ts">
interface Props {
    progress: number; // 0-100
    label?: string;
    showPercentage?: boolean;
    color?: 'blue' | 'green' | 'yellow' | 'red';
}

const props = withDefaults(defineProps<Props>(), {
    showPercentage: true,
    color: 'blue'
});

const colorClasses = computed(() => {
    const colors = {
        'blue': 'bg-blue-600',
        'green': 'bg-green-600',
        'yellow': 'bg-yellow-600',
        'red': 'bg-red-600'
    };
    return colors[props.color];
});

const bgColorClasses = computed(() => {
    const colors = {
        'blue': 'bg-blue-100',
        'green': 'bg-green-100',
        'yellow': 'bg-yellow-100',
        'red': 'bg-red-100'
    };
    return colors[props.color];
});
</script>

<template>
    <div class="w-full">
        <div v-if="label || showPercentage" class="flex items-center justify-between mb-1">
            <span v-if="label" class="text-sm text-gray-600">{{ label }}</span>
            <span v-if="showPercentage" class="text-sm font-medium text-gray-900">{{ Math.round(progress) }}%</span>
        </div>
        <div class="w-full rounded-full h-2" :class="bgColorClasses">
            <div 
                class="h-2 rounded-full transition-all duration-300 ease-out"
                :class="colorClasses"
                :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }">
            </div>
        </div>
    </div>
</template>
