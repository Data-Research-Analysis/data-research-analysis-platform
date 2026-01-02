<template>
  <div class="scheduled-backup-control p-6">
    <h2 class="text-2xl font-bold mb-6">Scheduled Database Backups</h2>
    
    <!-- Status Card -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold text-gray-900">Scheduler Status</h3>
        <span 
          :class="statusBadgeClass"
          class="px-3 py-1 rounded-full text-sm font-medium"
        >
          {{ status?.is_running ? 'Running' : 'Stopped' }}
        </span>
      </div>

      <div class="space-y-3 mb-4">
        <div class="flex justify-between items-center">
          <span class="text-gray-600">Schedule:</span>
          <div class="flex items-center gap-2">
            <select 
              v-model="selectedSchedule"
              @change="handleScheduleChange"
              :disabled="loading"
              class="bg-gray-100 text-gray-900 px-3 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
            >
              <option value="0 * * * *">Every Hour</option>
              <option value="0 */2 * * *">Every 2 Hours</option>
              <option value="0 */6 * * *">Every 6 Hours</option>
              <option value="0 */12 * * *">Every 12 Hours</option>
              <option value="0 0 * * *">Daily at Midnight</option>
              <option value="0 2 * * *">Daily at 2 AM</option>
              <option value="0 6 * * *">Daily at 6 AM</option>
              <option value="0 12 * * *">Daily at Noon</option>
              <option value="0 0 * * 0">Weekly (Sunday)</option>
              <option value="0 0 1 * *">Monthly (1st day)</option>
            </select>
            <code class="bg-gray-50 text-gray-700 px-2 py-1 rounded text-sm border border-gray-200">{{ status?.current_schedule }}</code>
          </div>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-600">Retention Days:</span>
          <div class="flex items-center gap-2">
            <select 
              v-model="selectedRetentionDays"
              @change="handleRetentionChange"
              :disabled="loading"
              class="bg-gray-100 text-gray-900 px-3 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
            >
              <option :value="7">7 days</option>
              <option :value="14">14 days</option>
              <option :value="30">30 days</option>
              <option :value="60">60 days</option>
              <option :value="90">90 days</option>
              <option :value="180">180 days</option>
              <option :value="365">365 days</option>
            </select>
            <span class="text-sm text-gray-600">Keep backups for {{ config?.retention_days || 30 }} days</span>
          </div>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Next Run:</span>
          <span class="text-gray-900">{{ formatDateTime(status?.next_run) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Last Run:</span>
          <span class="text-gray-900">{{ formatDateTime(status?.last_run) }}</span>
        </div>
      </div>

      <div class="flex gap-3">
        <button
          v-if="!status?.is_running"
          @click="handleStart"
          :disabled="loading"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 cursor-pointer"
        >
          Start Scheduler
        </button>
        <button
          v-else
          @click="handleStop"
          :disabled="loading"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 cursor-pointer"
        >
          Stop Scheduler
        </button>
        <button
          @click="handleTriggerNow"
          :disabled="loading || !status?.scheduler_enabled"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 cursor-pointer"
        >
          Trigger Backup Now
        </button>
      </div>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-gray-600 text-sm">Total Runs</div>
        <div class="text-2xl font-bold text-gray-900">{{ stats?.total_runs || 0 }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-gray-600 text-sm">Successful</div>
        <div class="text-2xl font-bold text-green-600">{{ stats?.successful_runs || 0 }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-gray-600 text-sm">Failed</div>
        <div class="text-2xl font-bold text-red-600">{{ stats?.failed_runs || 0 }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-gray-600 text-sm">Avg Duration</div>
        <div class="text-2xl font-bold text-gray-900">{{ stats?.avg_duration_seconds || 0 }}s</div>
      </div>
    </div>

    <!-- Backup Runs Table -->
    <div class="bg-white rounded-lg shadow">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-xl font-semibold text-gray-900">Backup Run History</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Run ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started At</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="run in runs" :key="run.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#{{ run.id }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="triggerTypeBadge(run.trigger_type)" class="px-2 py-1 rounded text-xs font-medium">
                  {{ run.trigger_type }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="statusBadge(run.status)" class="px-2 py-1 rounded text-xs font-medium">
                  {{ run.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatDateTime(run.started_at) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatBytes(run.backup_size_bytes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useScheduledBackupsStore } from '~/stores/scheduled-backups';
import { storeToRefs } from 'pinia';

const store = useScheduledBackupsStore();
const { schedulerStatus: status, schedulerConfig: config, backupStats: stats, backupRuns: runs, loading } = storeToRefs(store);

const selectedSchedule = ref('0 0 * * *');
const selectedRetentionDays = ref(30);

onMounted(async () => {
  store.initializeFromLocalStorage();
  await Promise.all([
    store.fetchSchedulerStatus(),
    store.fetchSchedulerConfig(),
    store.fetchBackupStats(),
    store.fetchBackupRuns(1)
  ]);
  
  // Set dropdown to current schedule
  if (status.value?.current_schedule) {
    selectedSchedule.value = status.value.current_schedule;
  }
  
  // Set retention days to current config
  if (config.value?.retention_days) {
    selectedRetentionDays.value = config.value.retention_days;
  }
});

// Watch for status changes to update dropdown
watch(() => status.value?.current_schedule, (newSchedule) => {
  if (newSchedule) {
    selectedSchedule.value = newSchedule;
  }
});

// Watch for config changes to update retention dropdown
watch(() => config.value?.retention_days, (newRetentionDays) => {
  if (newRetentionDays) {
    selectedRetentionDays.value = newRetentionDays;
  }
});

const statusBadgeClass = computed(() => {
  return status.value?.is_running
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800';
});

function triggerTypeBadge(type: string) {
  return type === 'scheduled'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-purple-100 text-purple-800';
}

function statusBadge(status: string) {
  const badges: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    processing: 'bg-yellow-100 text-yellow-800',
    queued: 'bg-gray-100 text-gray-800'
  };
  return badges[status] || 'bg-gray-100 text-gray-800';
}

function formatDateTime(date: string | null | undefined) {
  if (!date || date === 'null' || date === 'undefined') return 'N/A';
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleString();
  } catch (err) {
    return 'N/A';
  }
}

function formatBytes(bytes: number | null) {
  if (!bytes) return 'N/A';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

async function handleStart() {
  try {
    await store.startScheduler();
  } catch (err) {
    console.error('Failed to start scheduler:', err);
  }
}

async function handleStop() {
  try {
    await store.stopScheduler();
  } catch (err) {
    console.error('Failed to stop scheduler:', err);
  }
}

async function handleTriggerNow() {
  try {
    await store.triggerManualBackup();
  } catch (err) {
    console.error('Failed to trigger manual backup:', err);
  }
}

async function handleScheduleChange() {
  try {
    if (selectedSchedule.value && selectedSchedule.value !== status.value?.current_schedule) {
      await store.updateSchedule(selectedSchedule.value);
    }
  } catch (err) {
    console.error('Failed to update schedule:', err);
  }
}

async function handleRetentionChange() {
  try {
    if (selectedRetentionDays.value && selectedRetentionDays.value !== config.value?.retention_days) {
      await store.updateConfig({ retention_days: selectedRetentionDays.value });
    }
  } catch (err) {
    console.error('Failed to update retention days:', err);
  }
}
</script>
