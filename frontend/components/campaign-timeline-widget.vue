<template>
  <div 
    class="bg-white rounded-lg shadow-md p-6"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <div class="flex items-center gap-3 mb-4">
      <font-awesome-icon :icon="['fas', 'clock']" class="w-6 h-6 text-blue-500" />
      <h3 class="text-lg font-semibold text-gray-900">Campaign Timeline</h3>
    </div>
    
    <div v-if="!campaigns || campaigns.length === 0" class="flex items-center justify-center h-full">
      <p class="text-gray-500 text-sm">No campaigns to display</p>
    </div>
    
    <div v-else class="space-y-3 overflow-y-auto" :style="{ maxHeight: `${height - 100}px` }">
      <div 
        v-for="campaign in campaigns" 
        :key="campaign.id"
        class="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded"
      >
        <p class="font-medium text-gray-900 text-sm">{{ campaign.name }}</p>
        <p class="text-xs text-gray-600 mt-1">
          {{ formatDate(campaign.start_date) }} - {{ formatDate(campaign.end_date) }}
        </p>
        <div class="flex items-center gap-2 mt-2">
          <span 
            class="inline-block px-2 py-1 rounded text-xs font-semibold"
            :class="{
              'bg-green-200 text-green-900': campaign.status === 'active',
              'bg-gray-200 text-gray-700': campaign.status === 'completed',
              'bg-yellow-200 text-yellow-900': campaign.status === 'scheduled'
            }"
          >
            {{ campaign.status }}
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
  height: 400,
});

// Placeholder data - will be fetched from API in full implementation
const campaigns = ref<any[]>([]);

function formatDate(dateString: string) {
  if (!dateString || !import.meta.client) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// TODO: Implement actual campaign data fetching
onMounted(() => {
  console.log('Campaign Timeline Widget mounted', { chartId: props.chartId, projectId: props.projectId });
  
  // Placeholder: Fetch campaigns from API
  // const campaignsStore = useCampaignsStore();
  // campaigns.value = campaignsStore.campaigns.filter(c => c.project_id === props.projectId);
});
</script>
