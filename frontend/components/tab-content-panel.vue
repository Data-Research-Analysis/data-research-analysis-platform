<script setup lang="ts">
    const props = defineProps({
        corners: {
            type: Array,
            default: () => ['top-left', 'top-right', 'bottom-left', 'bottom-right']
        }
    });
</script>
<template>
    <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mb-10 border border-primary-blue-100 border-solid p-10 shadow-md"
        :class="{
            'rounded-tl-lg': corners.includes('top-left'),
            'rounded-tr-lg': corners.includes('top-right'),
            'rounded-bl-lg': corners.includes('bottom-left'),
            'rounded-br-lg': corners.includes('bottom-right')
        }">
        <slot></slot>
    </div>
</template>
