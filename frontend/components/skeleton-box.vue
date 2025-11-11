<template>
  <div 
    class="animate-pulse bg-gray-200 rounded"
    :style="{ width, height }"
  ></div>
</template>

<script setup lang="ts">
defineProps<{
  width?: string
  height?: string
}>()
</script>
