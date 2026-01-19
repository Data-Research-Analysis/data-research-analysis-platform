<template>
  <div class="bg-white border border-gray-200 rounded-lg p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">Refresh Status</h3>
      <button
        v-if="!isRefreshing"
        @click="handleRefresh"
        :disabled="loading"
        class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        <font-awesome :icon="loading ? 'fas fa-spinner' : 'fas fa-sync-alt'" :class="loading ? 'animate-spin' : ''" />
        {{ loading ? 'Refreshing...' : 'Refresh Now' }}
      </button>
      <div v-else class="flex items-center gap-2 text-indigo-600">
        <font-awesome icon="fas fa-spinner" class="animate-spin" />
        <span class="text-sm font-medium">Refreshing...</span>
      </div>
    </div>

    <!-- Status Info -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
        <div class="flex items-center gap-2">
          <RefreshStatusBadge :status="currentStatus" />
        </div>
      </div>
      
      <div>
        <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last Refreshed</label>
        <p class="text-sm font-medium text-gray-900">
          {{ formatLastRefreshed(lastRefreshedAt) }}
        </p>
      </div>
      
      <div>
        <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Row Count</label>
        <p class="text-sm font-medium text-gray-900">
          {{ formatNumber(rowCount) }}
        </p>
      </div>
      
      <div>
        <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last Duration</label>
        <p class="text-sm font-medium text-gray-900">
          {{ formatDuration(lastDuration) }}
        </p>
      </div>
    </div>

    <!-- Progress Bar (shown during refresh) -->
    <div v-if="isRefreshing && refreshProgress > 0" class="mt-4">
      <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
        <span>Progress</span>
        <span>{{ refreshProgress }}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          class="bg-indigo-600 h-full transition-all duration-300 ease-out"
          :style="{ width: `${refreshProgress}%` }">
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="refreshError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
      <div class="flex items-start gap-2">
        <font-awesome icon="fas fa-exclamation-circle" class="text-red-600 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm font-medium text-red-900">Refresh Failed</p>
          <p class="text-xs text-red-700 mt-1">{{ refreshError }}</p>
        </div>
      </div>
    </div>

    <!-- Auto-refresh Toggle -->
    <div class="mt-4 pt-4 border-t border-gray-200">
      <label class="flex items-center gap-3 cursor-pointer">
        <input 
          type="checkbox"
          :checked="autoRefreshEnabled"
          @change="handleToggleAutoRefresh"
          class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
        <div>
          <span class="text-sm font-medium text-gray-900">Auto-refresh enabled</span>
          <p class="text-xs text-gray-500">Automatically refresh when data sources sync</p>
        </div>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useDataModelsStore } from '~/stores/data_models';

const props = defineProps<{
  dataModelId: number;
  lastRefreshedAt?: string;
  rowCount?: number;
  lastDuration?: number;
  refreshStatus?: string;
  refreshError?: string;
  autoRefreshEnabled?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  toggleAutoRefresh: [enabled: boolean];
}>();

const dataModelsStore = useDataModelsStore();
const loading = ref(false);

// Computed values
const currentStatus = computed(() => {
  const status = dataModelsStore.getRefreshStatus(props.dataModelId);
  return status?.status || props.refreshStatus || 'idle';
});

const isRefreshing = computed(() => {
  return currentStatus.value === 'refreshing' || currentStatus.value === 'queued';
});

const refreshProgress = computed(() => {
  const status = dataModelsStore.getRefreshStatus(props.dataModelId);
  return status?.progress || 0;
});

async function handleRefresh() {
  loading.value = true;
  try {
    await dataModelsStore.refreshDataModel(props.dataModelId);
    emit('refresh');
  } catch (error: any) {
    console.error('Failed to trigger refresh:', error);
    if (import.meta.client) {
      const Swal = (await import('sweetalert2')).default;
      Swal.fire({
        icon: 'error',
        title: 'Refresh Failed',
        text: error.message || 'Failed to trigger refresh',
        confirmButtonColor: '#4F46E5'
      });
    }
  } finally {
    loading.value = false;
  }
}

function handleToggleAutoRefresh(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('toggleAutoRefresh', target.checked);
}

function formatLastRefreshed(date?: string): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return 'N/A';
  return new Intl.NumberFormat().format(num);
}

function formatDuration(ms?: number): string {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
</script>
