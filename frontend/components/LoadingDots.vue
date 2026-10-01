<script setup lang="ts">
const props = withDefaults(defineProps<{
    size?: 'xs' | 'sm' | 'md' | 'lg';
    color?: string;
}>(), {
    size: 'sm',
    color: '#9ca3af'
});

const sizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
};
</script>

<template>
    <div class="flex items-center gap-1">
        <div 
            class="rounded-full animate-dot-bounce"
            :class="sizeClasses[size]"
            :style="{ backgroundColor: color }"
        ></div>
        <div 
            class="rounded-full animate-dot-bounce [animation-delay:100ms]"
            :class="sizeClasses[size]"
            :style="{ backgroundColor: color }"
        ></div>
        <div 
            class="rounded-full animate-dot-bounce [animation-delay:200ms]"
            :class="sizeClasses[size]"
            :style="{ backgroundColor: color }"
        ></div>
    </div>
</template>
