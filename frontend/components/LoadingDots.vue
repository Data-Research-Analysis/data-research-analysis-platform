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
    <div class="loading-dots">
        <div 
            class="dot"
            :class="sizeClasses[size]"
            :style="{ backgroundColor: color }"
        ></div>
        <div 
            class="dot"
            :class="sizeClasses[size]"
            :style="{ backgroundColor: color, animationDelay: '0.1s' }"
        ></div>
        <div 
            class="dot"
            :class="sizeClasses[size]"
            :style="{ backgroundColor: color, animationDelay: '0.2s' }"
        ></div>
    </div>
</template>

<style scoped>
.loading-dots {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.dot {
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
}

@keyframes bounce {
    0%, 80%, 100% {
        transform: scale(0);
    }
    40% {
        transform: scale(1);
    }
}
</style>
