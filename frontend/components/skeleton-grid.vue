<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <skeleton-card v-for="i in count" :key="i" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  count?: number
}>()
</script>
