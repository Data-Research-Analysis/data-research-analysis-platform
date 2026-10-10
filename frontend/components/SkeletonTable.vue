<template>
  <div class="skeleton-table w-full">
    <div v-for="n in rows" :key="n" class="skeleton-row flex gap-2 mb-2">
      <div v-for="c in columns" :key="c" class="flex-1 h-10 rounded animate-shimmer bg-[linear-gradient(90deg,#e0e0e0_25%,#f0f0f0_50%,#e0e0e0_75%)] bg-[length:200%_100%]" />
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
