<template>
  <div 
    class="animate-pulse bg-gray-200 rounded"
    :class="sizeClass"
  ></div>
</template>

<script setup lang="ts">
const props = defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-3 w-16'
    case 'md': return 'h-4 w-24'
    case 'lg': return 'h-5 w-32'
    case 'xl': return 'h-6 w-48'
    default: return 'h-4 w-24'
  }
})
</script>
