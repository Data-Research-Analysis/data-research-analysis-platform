<template>
  <transition name="modal-fade">
    <div v-if="isVisible" class="modal-overlay" @click.self="handleOverlayClick">
      <div class="modal-container">
        <div class="modal-header">
          <h2>MongoDB Sync Progress</h2>
          <button 
            v-if="canClose" 
            class="close-button" 
            @click="closeModal"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div class="modal-body">
          <!-- Overall Progress -->
          <div class="progress-section">
            <div class="status-badge" :class="statusClass">
              {{ statusText }}
            </div>
            
            <div class="progress-stats">
              <div class="stat">
                <span class="stat-label">Collections:</span>
                <span class="stat-value">
                  {{ progress?.processedCollections || 0 }} / {{ progress?.totalCollections || 0 }}
                </span>
              </div>
              <div class="stat">
                <span class="stat-label">Records:</span>
                <span class="stat-value">
                  {{ formatNumber(progress?.processedRecords || 0) }} / {{ formatNumber(progress?.totalRecords || 0) }}
                </span>
              </div>
              <div v-if="progress?.failedRecords && progress.failedRecords > 0" class="stat error">
                <span class="stat-label">Failed:</span>
                <span class="stat-value">{{ formatNumber(progress.failedRecords) }}</span>
              </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="progress-bar-container">
              <div class="progress-bar">
                <div 
                  class="progress-bar-fill" 
                  :style="{ width: `${progress?.percentage || 0}%` }"
                  :class="progressBarClass"
                ></div>
              </div>
              <div class="progress-percentage">{{ progress?.percentage || 0 }}%</div>
            </div>
            
            <!-- ETA -->
            <div v-if="estimatedTimeText" class="eta-text">
              Estimated time remaining: {{ estimatedTimeText }}
            </div>
            
            <!-- Current Collection -->
            <div v-if="progress?.currentCollection" class="current-collection">
              Currently processing: <strong>{{ progress.currentCollection }}</strong>
            </div>
          </div>
          
          <!-- Collections List -->
          <div v-if="progress?.collections && progress.collections.length > 0" class="collections-section">
            <h3>Collections</h3>
            <div class="collections-list">
              <div 
                v-for="collection in progress.collections" 
                :key="collection.name"
                class="collection-item"
                :class="getCollectionStatusClass(collection.status)"
              >
                <div class="collection-name">
                  <span class="collection-status-icon">{{ getStatusIcon(collection.status) }}</span>
                  {{ collection.name }}
                </div>
                <div class="collection-stats">
                  <span v-if="collection.recordCount > 0">
                    {{ formatNumber(collection.processedCount) }} / {{ formatNumber(collection.recordCount) }}
                  </span>
                  <span v-else class="text-muted">Pending</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Error Message -->
          <div v-if="progress?.errorMessage" class="error-section">
            <h3>Error</h3>
            <p class="error-message">{{ progress.errorMessage }}</p>
          </div>
        </div>
        
        <div class="modal-footer">
          <button 
            v-if="canClose" 
            class="btn btn-primary" 
            @click="closeModal"
          >
            {{ progress?.status === 'completed' ? 'Done' : 'Close' }}
          </button>
          <span v-else class="footer-note">
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
    case 'initializing': return 'status-initializing';
    case 'in_progress': return 'status-progress';
    case 'completed': return 'status-completed';
    case 'failed': return 'status-failed';
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
    case 'completed': return 'progress-completed';
    case 'failed': return 'progress-failed';
    default: return 'progress-active';
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
  return `collection-status-${status}`;
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

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #111827;
}

.close-button {
  background: none;
  border: none;
  font-size: 32px;
  color: #6b7280;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background-color 0.2s, color 0.2s;
}

.close-button:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.progress-section {
  margin-bottom: 32px;
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.status-initializing {
  background-color: #dbeafe;
  color: #1e40af;
}

.status-progress {
  background-color: #dbeafe;
  color: #1e40af;
}

.status-completed {
  background-color: #d1fae5;
  color: #065f46;
}

.status-failed {
  background-color: #fee2e2;
  color: #991b1b;
}

.progress-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.stat.error .stat-value {
  color: #dc2626;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 24px;
  background-color: #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  transition: width 0.3s ease-in-out;
  border-radius: 12px;
}

.progress-active {
  background: linear-gradient(90deg, #3b82f6, #2563eb);
}

.progress-completed {
  background: linear-gradient(90deg, #10b981, #059669);
}

.progress-failed {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.progress-percentage {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  min-width: 48px;
  text-align: right;
}

.eta-text {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
}

.current-collection {
  font-size: 14px;
  color: #374151;
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 8px;
  border-left: 3px solid #3b82f6;
}

.current-collection strong {
  color: #111827;
}

.collections-section {
  margin-bottom: 24px;
}

.collections-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 12px;
}

.collections-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
}

.collection-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: background-color 0.2s;
}

.collection-status-pending {
  background-color: #f9fafb;
}

.collection-status-in_progress {
  background-color: #eff6ff;
  border-color: #3b82f6;
}

.collection-status-completed {
  background-color: #f0fdf4;
  border-color: #10b981;
}

.collection-status-failed {
  background-color: #fef2f2;
  border-color: #ef4444;
}

.collection-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.collection-status-icon {
  font-size: 16px;
}

.collection-stats {
  font-size: 13px;
  color: #6b7280;
}

.text-muted {
  font-style: italic;
}

.error-section {
  margin-top: 24px;
  padding: 16px;
  background-color: #fef2f2;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

.error-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #991b1b;
  margin-bottom: 8px;
}

.error-message {
  font-size: 14px;
  color: #7f1d1d;
  margin: 0;
  word-break: break-word;
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background-color: #2563eb;
}

.footer-note {
  font-size: 14px;
  color: #6b7280;
  font-style: italic;
}

/* Transition animations */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.9);
}
</style>
