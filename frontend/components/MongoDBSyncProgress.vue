<template>
  <transition
    enter-active-class="transition-opacity duration-300 ease"
    leave-active-class="transition-opacity duration-300 ease"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="isVisible" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-5" @click.self="handleOverlayClick">
      <div class="bg-white rounded-xl shadow-2xl max-w-[700px] w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 class="m-0 text-2xl font-semibold text-gray-900">MongoDB Sync Progress</h2>
          <button 
            v-if="canClose" 
            class="bg-transparent border-0 text-[32px] text-gray-500 cursor-pointer leading-none p-0 w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-gray-100 hover:text-gray-900" 
            @click="closeModal"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1">
          <!-- Overall Progress -->
          <div class="mb-8">
            <div class="inline-block px-3 py-1.5 rounded-md text-sm font-semibold mb-4" :class="statusClass">
              {{ statusText }}
            </div>
            
            <div class="flex gap-6 mb-4">
              <div class="flex flex-col gap-1">
                <span class="text-xs text-gray-500 font-medium uppercase tracking-wide">Collections:</span>
                <span class="text-xl font-semibold text-gray-900">
                  {{ progress?.processedCollections || 0 }} / {{ progress?.totalCollections || 0 }}
                </span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-gray-500 font-medium uppercase tracking-wide">Records:</span>
                <span class="text-xl font-semibold text-gray-900">
                  {{ formatNumber(progress?.processedRecords || 0) }} / {{ formatNumber(progress?.totalRecords || 0) }}
                </span>
              </div>
              <div v-if="progress?.failedRecords && progress.failedRecords > 0" class="flex flex-col gap-1">
                <span class="text-xs text-gray-500 font-medium uppercase tracking-wide">Failed:</span>
                <span class="text-xl font-semibold text-red-600">{{ formatNumber(progress.failedRecords) }}</span>
              </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="flex items-center gap-3 mb-3">
              <div class="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden relative">
                <div 
                  class="h-full transition-[width] duration-300 ease-in-out rounded-full" 
                  :style="{ width: `${progress?.percentage || 0}%` }"
                  :class="progressBarClass"
                ></div>
              </div>
              <div class="text-lg font-semibold text-gray-900 min-w-[48px] text-right">{{ progress?.percentage || 0 }}%</div>
            </div>
            
            <!-- ETA -->
            <div v-if="estimatedTimeText" class="text-sm text-gray-500 mb-2">
              Estimated time remaining: {{ estimatedTimeText }}
            </div>
            
            <!-- Current Collection -->
            <div v-if="progress?.currentCollection" class="text-sm text-gray-700 p-3 bg-gray-50 rounded-lg border-l-[3px] border-blue-500 [&_strong]:text-gray-900">
              Currently processing: <strong>{{ progress.currentCollection }}</strong>
            </div>
          </div>
          
          <!-- Collections List -->
          <div v-if="progress?.collections && progress.collections.length > 0" class="mb-6">
            <h3 class="text-base font-semibold text-gray-900 mb-3">Collections</h3>
            <div class="flex flex-col gap-2 max-h-[300px] overflow-y-auto p-1">
              <div 
                v-for="collection in progress.collections" 
                :key="collection.name"
                class="flex items-center justify-between p-3 rounded-lg border border-gray-200 transition-colors"
                :class="getCollectionStatusClass(collection.status)"
              >
                <div class="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span class="text-base">{{ getStatusIcon(collection.status) }}</span>
                  {{ collection.name }}
                </div>
                <div class="text-[13px] text-gray-500">
                  <span v-if="collection.recordCount > 0">
                    {{ formatNumber(collection.processedCount) }} / {{ formatNumber(collection.recordCount) }}
                  </span>
                  <span v-else class="italic">Pending</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Error Message -->
          <div v-if="progress?.errorMessage" class="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 class="text-base font-semibold text-red-800 mb-2">Error</h3>
            <p class="text-sm text-red-900 m-0 break-words">{{ progress.errorMessage }}</p>
          </div>
        </div>
        
        <div class="px-6 py-5 border-t border-gray-200 flex justify-end items-center">
          <button 
            v-if="canClose" 
            class="px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all border-0 bg-blue-500 text-white hover:bg-blue-600" 
            @click="closeModal"
          >
            {{ progress?.status === 'completed' ? 'Done' : 'Close' }}
          </button>
          <span v-else class="text-sm text-gray-500 italic">
            Sync in progress... Please wait.
          </span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';

interface CollectionProgress {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  recordCount: number;
  processedCount: number;
}

interface SyncProgress {
  dataSourceId: number;
  userId: number;
  status: 'initializing' | 'in_progress' | 'completed' | 'failed';
  totalCollections: number;
  processedCollections: number;
  currentCollection: string | null;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  percentage: number;
  estimatedTimeRemaining: number | null;
  startTime: Date;
  lastUpdateTime: Date;
  errorMessage?: string;
  collections?: CollectionProgress[];
}

const props = defineProps<{
  isVisible: boolean;
  progress: SyncProgress | null;
  allowClose?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const canClose = computed(() => {
  return props.allowClose !== false && 
         (props.progress?.status === 'completed' || 
          props.progress?.status === 'failed');
});

const statusClass = computed(() => {
  if (!props.progress) return '';
  switch (props.progress.status) {
    case 'initializing': return 'bg-blue-100 text-blue-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'completed': return 'bg-emerald-100 text-emerald-800';
    case 'failed': return 'bg-red-100 text-red-800';
    default: return '';
  }
});

const statusText = computed(() => {
  if (!props.progress) return 'Unknown';
  switch (props.progress.status) {
    case 'initializing': return 'Initializing...';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    default: return 'Unknown';
  }
});

const progressBarClass = computed(() => {
  if (!props.progress) return '';
  switch (props.progress.status) {
    case 'completed': return 'bg-gradient-to-r from-emerald-500 to-emerald-600';
    case 'failed': return 'bg-gradient-to-r from-red-500 to-red-600';
    default: return 'bg-gradient-to-r from-blue-500 to-blue-600';
  }
});

const estimatedTimeText = computed(() => {
  if (!props.progress?.estimatedTimeRemaining) return null;
  
  const milliseconds = props.progress.estimatedTimeRemaining;
  const seconds = Math.floor(milliseconds / 1000);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
});

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'in_progress': return '⚙️';
    case 'completed': return '✓';
    case 'failed': return '✗';
    default: return '○';
  }
}

function getCollectionStatusClass(status: string): string {
  switch (status) {
    case 'pending': return 'bg-gray-50';
    case 'in_progress': return 'bg-blue-50 border-blue-500';
    case 'completed': return 'bg-green-50 border-emerald-500';
    case 'failed': return 'bg-red-50 border-red-500';
    default: return '';
  }
}

function closeModal() {
  if (canClose.value) {
    emit('close');
  }
}

function handleOverlayClick() {
  if (canClose.value) {
    closeModal();
  }
}
</script>
