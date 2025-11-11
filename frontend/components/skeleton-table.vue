<template>
  <div class="bg-white rounded-lg shadow-md overflow-hidden">
    <!-- Table header -->
    <div class="bg-gray-50 border-b border-gray-200 p-4">
      <div class="flex gap-4">
        <div class="animate-pulse bg-gray-300 h-5 w-32 rounded" v-for="i in columns" :key="i"></div>
      </div>
    </div>
    
    <!-- Table rows -->
    <div v-for="i in rows" :key="i" class="border-b border-gray-100 p-4">
      <div class="flex gap-4">
        <div class="animate-pulse bg-gray-200 h-4 rounded" 
             :class="j === 0 ? 'w-48' : j === 1 ? 'w-32' : 'w-24'"
             v-for="j in columns" 
             :key="j">
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  rows?: number
  columns?: number
}>()
</script>
