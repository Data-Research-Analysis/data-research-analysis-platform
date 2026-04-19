<template>
  <div 
    class="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <div class="flex items-center gap-3 mb-4">
      <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="w-6 h-6 text-red-500" />
      <h3 class="text-lg font-semibold text-gray-900">Anomaly Alert</h3>
    </div>
    
    <div v-if="!anomalyData" class="flex items-center justify-center h-full">
      <p class="text-gray-500 text-sm">No anomalies detected</p>
    </div>
    
    <div v-else class="space-y-4">
      <div class="bg-red-50 rounded-lg p-4">
        <p class="text-sm font-medium text-red-900 mb-2">{{ anomalyData.title }}</p>
        <p class="text-xs text-red-700">{{ anomalyData.description }}</p>
      </div>
      
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-gray-600 text-xs mb-1">Detected</p>
          <p class="font-semibold text-gray-900">{{ anomalyData.detectedAt }}</p>
        </div>
        <div>
          <p class="text-gray-600 text-xs mb-1">Severity</p>
          <span 
            class="inline-block px-2 py-1 rounded text-xs font-semibold"
            :class="{
              'bg-red-200 text-red-900': anomalyData.severity === 'high',
              'bg-yellow-200 text-yellow-900': anomalyData.severity === 'medium',
              'bg-blue-200 text-blue-900': anomalyData.severity === 'low'
            }"
          >
            {{ anomalyData.severity }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

interface Props {
  chartId: string
  projectId: number
  marketingConfig?: any
  width?: number
  height?: number
}
const props = withDefaults(defineProps<Props>(), {
  marketingConfig: () => ({}),
  width: 400,
  height: 300,
});

// Placeholder data - will be fetched from API in full implementation
const anomalyData = ref(null);

// TODO: Implement actual anomaly detection API integration
onMounted(() => {
  // Placeholder for anomaly detection logic
  console.log('Anomaly Alert Card Widget mounted', { chartId: props.chartId, projectId: props.projectId });
});
</script>
