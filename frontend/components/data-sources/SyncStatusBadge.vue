<script setup lang="ts">
interface Props {
    status: 'idle' | 'syncing' | 'up-to-date' | 'stale' | 'very-stale' | 'never' | 'completed' | 'failed' | 'pending' | 'running' | 'n/a';
    size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
    size: 'md'
});

const statusConfig = computed(() => {
    const configs = {
        'idle': { text: 'Idle', color: 'gray', icon: 'fas fa-circle' },
        'syncing': { text: 'Syncing...', color: 'blue', icon: 'fas fa-spinner fa-spin' },
        'running': { text: 'Running...', color: 'blue', icon: 'fas fa-spinner fa-spin' },
        'up-to-date': { text: 'Up to date', color: 'green', icon: 'fas fa-check-circle' },
        'completed': { text: 'Completed', color: 'green', icon: 'fas fa-check-circle' },
        'stale': { text: 'Needs sync', color: 'yellow', icon: 'fas fa-exclamation-circle' },
        'very-stale': { text: 'Outdated', color: 'red', icon: 'fas fa-exclamation-triangle' },
        'never': { text: 'Never synced', color: 'yellow', icon: 'fas fa-clock' },
        'pending': { text: 'Pending', color: 'yellow', icon: 'fas fa-clock' },
        'failed': { text: 'Failed', color: 'red', icon: 'fas fa-times-circle' },
        'n/a': { text: 'Not applicable', color: 'gray', icon: 'fas fa-minus-circle' }
    };
    return configs[props.status] || configs['idle'];
});

const sizeClasses = computed(() => {
    const sizes = {
        'sm': 'px-2 py-0.5 text-xs',
        'md': 'px-2.5 py-1 text-xs',
        'lg': 'px-3 py-1.5 text-sm'
    };
    return sizes[props.size];
});

const colorClasses = computed(() => {
    const colors: Record<string, string> = {
        'green': 'bg-green-100 text-green-700',
        'yellow': 'bg-yellow-100 text-yellow-700',
        'red': 'bg-red-100 text-red-700',
        'blue': 'bg-blue-100 text-blue-700',
        'gray': 'bg-gray-100 text-gray-700'
    };
    return colors[statusConfig.value.color] || colors['gray'];
});
</script>

<template>
    <span 
        class="inline-flex items-center gap-1 rounded font-medium"
        :class="[sizeClasses, colorClasses]">
        <font-awesome :icon="statusConfig.icon" class="text-[10px]" />
        {{ statusConfig.text }}
    </span>
</template>
