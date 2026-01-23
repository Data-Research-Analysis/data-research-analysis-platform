<template>
  <div class="relative flex items-start px-5 py-4 border-b border-gray-200 animate-pulse">
    <!-- Icon Skeleton -->
    <div class="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-full mr-3"></div>

    <!-- Content Skeleton -->
    <div class="flex-1 min-w-0 space-y-3">
      <!-- Title -->
      <div class="h-4 bg-gray-200 rounded w-3/4"></div>
      
      <!-- Message lines -->
      <div class="space-y-2">
        <div class="h-3 bg-gray-200 rounded w-full"></div>
        <div class="h-3 bg-gray-200 rounded w-5/6"></div>
      </div>
      
      <!-- Time -->
      <div class="h-3 bg-gray-200 rounded w-24"></div>
    </div>

    <!-- Delete button skeleton -->
    <div class="flex-shrink-0 w-6 h-6 bg-gray-200 rounded ml-2"></div>
  </div>
</template>

<script setup lang="ts">
// No props or logic needed - pure skeleton UI
</script>
