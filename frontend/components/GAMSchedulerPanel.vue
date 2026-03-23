<template>
  <div class="bg-white rounded-lg p-6 shadow-md">
    <div class="flex justify-between items-center mb-6">
      <h3 class="m-0 text-2xl font-semibold text-gray-800">Scheduled Syncs</h3>
      <button 
        @click="refreshJobs" 
        class="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white border-none rounded-md cursor-pointer text-sm font-medium transition-all duration-200 hover:bg-blue-600 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
        :disabled="isLoading"
      >
        <span v-if="!isLoading">🔄</span>
        <span v-else class="animate-spin">⏳</span>
        Refresh
      </button>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-600 mb-5">
      <span class="text-lg">⚠️</span>
      {{ error }}
      <button @click="error = null" class="ml-auto bg-transparent border-none text-2xl text-red-600 cursor-pointer p-0 leading-none">×</button>
    </div>

    <!-- Statistics -->
    <div v-if="stats" class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6 max-md:grid-cols-2">
      <div class="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-lg p-5 text-white text-center">
        <div class="text-4xl font-bold mb-2">{{ stats.totalJobs }}</div>
        <div class="text-sm opacity-90">Total Jobs</div>
      </div>
      <div class="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-lg p-5 text-white text-center">
        <div class="text-4xl font-bold mb-2">{{ stats.enabledJobs }}</div>
        <div class="text-sm opacity-90">Active</div>
      </div>
      <div class="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-lg p-5 text-white text-center">
        <div class="text-4xl font-bold mb-2">{{ stats.disabledJobs }}</div>
        <div class="text-sm opacity-90">Paused</div>
      </div>
      <div class="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-lg p-5 text-white text-center">
        <div class="text-4xl font-bold mb-2">{{ stats.totalRuns }}</div>
        <div class="text-sm opacity-90">Total Runs</div>
      </div>
    </div>

    <!-- Next Scheduled Job -->
    <div v-if="nextScheduledJob" class="flex items-center gap-3 px-4 py-4 bg-gradient-to-br from-[#f093fb] to-[#f5576c] rounded-lg text-white mb-6 text-base">
      <span class="text-2xl">⏰</span>
      <span>
        Next sync: <strong>{{ nextScheduledJob.dataSourceName || `Data Source #${nextScheduledJob.dataSourceId}` }}</strong>
        {{ formatNextRun(nextScheduledJob.nextRun) }}
      </span>
    </div>

    <!-- Scheduled Jobs List -->
    <div class="flex flex-col gap-4">
      <div v-if="scheduledJobs.length === 0 && !isLoading" class="text-center py-12 px-6 text-gray-600">
        <p class="my-2">No scheduled syncs configured</p>
        <p class="text-sm text-gray-400 my-2">Configure sync schedules in the data source advanced settings</p>
      </div>

      <div 
        v-for="job in scheduledJobs" 
        :key="job.dataSourceId" 
        class="border-2 border-gray-200 rounded-lg p-5 transition-all duration-300 hover:border-gray-300 hover:shadow-md"
        :class="{ 'opacity-70 bg-gray-50': !job.enabled }"
      >
        <div class="flex justify-between items-center mb-4 max-md:flex-col max-md:items-start max-md:gap-3">
          <div class="flex items-center gap-3">
            <span class="text-2xl">
              {{ job.enabled ? '🟢' : '⏸️' }}
            </span>
            <h4 class="m-0 text-lg font-semibold text-gray-700">{{ job.dataSourceName || `Data Source #${job.dataSourceId}` }}</h4>
          </div>
          <div class="flex gap-2 max-md:w-full max-md:flex-wrap">
            <button 
              v-if="job.enabled" 
              @click="handlePauseJob(job.dataSourceId)" 
              class="px-3 py-1.5 border border-gray-300 rounded bg-white cursor-pointer text-[13px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-50 hover:border-yellow-500 max-md:flex-1 max-md:min-w-[calc(50%-4px)]"
              :disabled="isLoading"
              title="Pause scheduled sync"
            >
              ⏸️ Pause
            </button>
            <button 
              v-else 
              @click="handleResumeJob(job.dataSourceId)" 
              class="px-3 py-1.5 border border-gray-300 rounded bg-white cursor-pointer text-[13px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-50 hover:border-green-500 max-md:flex-1 max-md:min-w-[calc(50%-4px)]"
              :disabled="isLoading"
              title="Resume scheduled sync"
            >
              ▶️ Resume
            </button>
            <button 
              @click="handleTriggerJob(job.dataSourceId)" 
              class="px-3 py-1.5 border border-gray-300 rounded bg-white cursor-pointer text-[13px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 hover:border-blue-500 max-md:flex-1 max-md:min-w-[calc(50%-4px)]"
              :disabled="isLoading"
              title="Run sync now"
            >
              ⚡ Run Now
            </button>
            <button 
              @click="handleCancelJob(job.dataSourceId)" 
              class="px-3 py-1.5 border border-gray-300 rounded bg-white cursor-pointer text-[13px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-50 hover:border-red-500 max-md:flex-1 max-md:min-w-[calc(50%-4px)]"
              :disabled="isLoading"
              title="Cancel scheduled sync"
            >
              ❌ Cancel
            </button>
          </div>
        </div>

        <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-4 max-md:grid-cols-1">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-gray-600 font-medium">Schedule:</span>
            <span class="text-sm text-gray-700 font-semibold">{{ getFrequencyDisplay(job.schedule) }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-gray-600 font-medium">Last Run:</span>
            <span class="text-sm text-gray-700 font-semibold">{{ formatLastRun(job.lastRun) }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-gray-600 font-medium">Next Run:</span>
            <span 
              class="text-sm text-gray-700 font-semibold"
              :class="{ 'text-green-600': job.enabled }"
            >
              {{ job.enabled ? formatNextRun(job.nextRun) : 'Paused' }}
            </span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-gray-600 font-medium">Run Count:</span>
            <span class="text-sm text-gray-700 font-semibold">{{ job.runCount }} times</span>
          </div>
        </div>

        <div class="pt-3 border-t border-gray-200">
          <code class="inline-block px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 font-mono">{{ job.schedule }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useGAMScheduler } from '~/composables/useGAMScheduler';

const {
  scheduledJobs,
  stats,
  isLoading,
  error,
  nextScheduledJob,
  fetchScheduledJobs,
  fetchStats,
  pauseJob,
  resumeJob,
  triggerJob,
  cancelJob,
  getFrequencyDisplay,
  formatNextRun,
  formatLastRun
} = useGAMScheduler();

// Load data on mount
onMounted(async () => {
  await refreshJobs();
});

// Refresh all job data
const refreshJobs = async () => {
  await Promise.all([
    fetchScheduledJobs(),
    fetchStats()
  ]);
};

// Handle pause job
const handlePauseJob = async (dataSourceId: number) => {
  if (confirm('Are you sure you want to pause this scheduled sync?')) {
    const success = await pauseJob(dataSourceId);
    if (success) {
      await refreshJobs();
    }
  }
};

// Handle resume job
const handleResumeJob = async (dataSourceId: number) => {
  const success = await resumeJob(dataSourceId);
  if (success) {
    await refreshJobs();
  }
};

// Handle trigger job
const handleTriggerJob = async (dataSourceId: number) => {
  if (confirm('Run this sync immediately?')) {
    const success = await triggerJob(dataSourceId);
    if (success) {
      await refreshJobs();
    }
  }
};

// Handle cancel job
const handleCancelJob = async (dataSourceId: number) => {
  if (confirm('Are you sure you want to cancel this scheduled sync? You can reschedule it later in the data source settings.')) {
    const success = await cancelJob(dataSourceId);
    if (success) {
      await refreshJobs();
    }
  }
};
</script>
