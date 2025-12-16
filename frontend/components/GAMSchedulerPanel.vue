<template>
  <div class="scheduler-panel">
    <div class="scheduler-header">
      <h3>Scheduled Syncs</h3>
      <button @click="refreshJobs" class="refresh-btn" :disabled="isLoading">
        <span v-if="!isLoading">🔄</span>
        <span v-else class="spinner">⏳</span>
        Refresh
      </button>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="error-banner">
      <span class="error-icon">⚠️</span>
      {{ error }}
      <button @click="error = null" class="close-btn">×</button>
    </div>

    <!-- Statistics -->
    <div v-if="stats" class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalJobs }}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.enabledJobs }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.disabledJobs }}</div>
        <div class="stat-label">Paused</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalRuns }}</div>
        <div class="stat-label">Total Runs</div>
      </div>
    </div>

    <!-- Next Scheduled Job -->
    <div v-if="nextScheduledJob" class="next-job-banner">
      <span class="next-job-icon">⏰</span>
      <span class="next-job-text">
        Next sync: <strong>{{ nextScheduledJob.dataSourceName || `Data Source #${nextScheduledJob.dataSourceId}` }}</strong>
        {{ formatNextRun(nextScheduledJob.nextRun) }}
      </span>
    </div>

    <!-- Scheduled Jobs List -->
    <div class="jobs-list">
      <div v-if="scheduledJobs.length === 0 && !isLoading" class="no-jobs">
        <p>No scheduled syncs configured</p>
        <p class="hint">Configure sync schedules in the data source advanced settings</p>
      </div>

      <div v-for="job in scheduledJobs" :key="job.dataSourceId" class="job-card" :class="{ disabled: !job.enabled }">
        <div class="job-header">
          <div class="job-title">
            <span class="job-icon" :class="{ active: job.enabled }">
              {{ job.enabled ? '🟢' : '⏸️' }}
            </span>
            <h4>{{ job.dataSourceName || `Data Source #${job.dataSourceId}` }}</h4>
          </div>
          <div class="job-actions">
            <button 
              v-if="job.enabled" 
              @click="handlePauseJob(job.dataSourceId)" 
              class="action-btn pause-btn"
              :disabled="isLoading"
              title="Pause scheduled sync"
            >
              ⏸️ Pause
            </button>
            <button 
              v-else 
              @click="handleResumeJob(job.dataSourceId)" 
              class="action-btn resume-btn"
              :disabled="isLoading"
              title="Resume scheduled sync"
            >
              ▶️ Resume
            </button>
            <button 
              @click="handleTriggerJob(job.dataSourceId)" 
              class="action-btn trigger-btn"
              :disabled="isLoading"
              title="Run sync now"
            >
              ⚡ Run Now
            </button>
            <button 
              @click="handleCancelJob(job.dataSourceId)" 
              class="action-btn cancel-btn"
              :disabled="isLoading"
              title="Cancel scheduled sync"
            >
              ❌ Cancel
            </button>
          </div>
        </div>

        <div class="job-details">
          <div class="job-detail-item">
            <span class="detail-label">Schedule:</span>
            <span class="detail-value">{{ getFrequencyDisplay(job.schedule) }}</span>
          </div>
          <div class="job-detail-item">
            <span class="detail-label">Last Run:</span>
            <span class="detail-value">{{ formatLastRun(job.lastRun) }}</span>
          </div>
          <div class="job-detail-item">
            <span class="detail-label">Next Run:</span>
            <span class="detail-value" :class="{ upcoming: job.enabled }">
              {{ job.enabled ? formatNextRun(job.nextRun) : 'Paused' }}
            </span>
          </div>
          <div class="job-detail-item">
            <span class="detail-label">Run Count:</span>
            <span class="detail-value">{{ job.runCount }} times</span>
          </div>
        </div>

        <div class="job-footer">
          <code class="cron-expression">{{ job.schedule }}</code>
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

<style scoped>
.scheduler-panel {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.scheduler-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.scheduler-header h3 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #1a202c;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #3182ce;
  transform: translateY(-1px);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff5f5;
  border: 1px solid #feb2b2;
  border-radius: 6px;
  color: #c53030;
  margin-bottom: 20px;
}

.error-icon {
  font-size: 18px;
}

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 24px;
  color: #c53030;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

/* Statistics Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  padding: 20px;
  color: white;
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

/* Next Job Banner */
.next-job-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 8px;
  color: white;
  margin-bottom: 24px;
  font-size: 16px;
}

.next-job-icon {
  font-size: 24px;
}

/* Jobs List */
.jobs-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.no-jobs {
  text-align: center;
  padding: 48px 24px;
  color: #718096;
}

.no-jobs p {
  margin: 8px 0;
}

.no-jobs .hint {
  font-size: 14px;
  color: #a0aec0;
}

/* Job Card */
.job-card {
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
}

.job-card:hover {
  border-color: #cbd5e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.job-card.disabled {
  opacity: 0.7;
  background: #f7fafc;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.job-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.job-icon {
  font-size: 24px;
}

.job-title h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
}

.job-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pause-btn:hover:not(:disabled) {
  background: #fef5e7;
  border-color: #f39c12;
}

.resume-btn:hover:not(:disabled) {
  background: #e8f5e9;
  border-color: #4caf50;
}

.trigger-btn:hover:not(:disabled) {
  background: #e3f2fd;
  border-color: #2196f3;
}

.cancel-btn:hover:not(:disabled) {
  background: #ffebee;
  border-color: #f44336;
}

/* Job Details */
.job-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.job-detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
}

.detail-value {
  font-size: 14px;
  color: #2d3748;
  font-weight: 600;
}

.detail-value.upcoming {
  color: #38a169;
}

/* Job Footer */
.job-footer {
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.cron-expression {
  display: inline-block;
  padding: 4px 8px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
  color: #4a5568;
  font-family: 'Courier New', monospace;
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .job-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .job-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .action-btn {
    flex: 1;
    min-width: calc(50% - 4px);
  }

  .job-details {
    grid-template-columns: 1fr;
  }
}
</style>
