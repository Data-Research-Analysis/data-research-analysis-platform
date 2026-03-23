<template>
  <div class="skeleton-table w-full">
    <div v-for="n in rows" :key="n" class="skeleton-row flex gap-2 mb-2">
      <div v-for="c in columns" :key="c" class="skeleton-cell flex-1 h-10 rounded animate-pulse bg-gray-200" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  rows?: number;
  columns?: number;
}

withDefaults(defineProps<Props>(), {
  rows: 10,
  columns: 5
});
</script>

<style scoped>
.skeleton-cell {
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
