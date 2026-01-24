import { ref, computed, type Ref } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';
import type { IScheduledJob, ISchedulerStats } from '~/types/google-ad-manager/scheduler';

/**
 * Composable for managing Google Ad Manager sync schedules
 */
export const useGAMScheduler = () => {
  const config = useRuntimeConfig();
  const baseURL = config.public.apiBaseUrl;

  // State
  const scheduledJobs: Ref<IScheduledJob[]> = ref([]);
  const currentJob: Ref<IScheduledJob | null> = ref(null);
  const stats: Ref<ISchedulerStats | null> = ref(null);
  const isLoading: Ref<boolean> = ref(false);
  const error: Ref<string | null> = ref(null);

  // Computed
  const enabledJobs = computed(() => 
    scheduledJobs.value.filter(job => job.enabled)
  );

  const disabledJobs = computed(() => 
    scheduledJobs.value.filter(job => !job.enabled)
  );

  const nextScheduledJob = computed(() => {
    const enabled = scheduledJobs.value.filter(job => job.enabled && job.nextRun);
    if (enabled.length === 0) return null;

    return enabled.reduce((earliest, job) => {
      if (!earliest.nextRun || !job.nextRun) return earliest;
      return new Date(job.nextRun) < new Date(earliest.nextRun) ? job : earliest;
    });
  });

  /**
   * Fetch all scheduled jobs
   */
  const fetchScheduledJobs = async (): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const data = await $fetch(`${baseURL}/scheduler/jobs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        scheduledJobs.value = data.data || [];
        return true;
      } else {
        error.value = data.message || 'Failed to fetch scheduled jobs';
        return false;
      }
    } catch (err: any) {
      console.error('Error fetching scheduled jobs:', err);
      error.value = err.message || 'Failed to fetch scheduled jobs';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Fetch specific job by data source ID
   */
  const fetchJob = async (dataSourceId: number): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const data = await $fetch(`${baseURL}/scheduler/jobs/${dataSourceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        currentJob.value = data.data;
        return true;
      } else {
        error.value = data.message || 'Failed to fetch job';
        currentJob.value = null;
        return false;
      }
    } catch (err: any) {
      console.error('Error fetching job:', err);
      error.value = err.message || 'Failed to fetch job';
      currentJob.value = null;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Schedule a new job or update existing schedule
   */
  const scheduleJob = async (dataSourceId: number): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const data = await $fetch(`${baseURL}/scheduler/jobs/${dataSourceId}/schedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        await fetchScheduledJobs(); // Refresh list
        return true;
      } else {
        error.value = data.message || 'Failed to schedule job';
        return false;
      }
    } catch (err: any) {
      console.error('Error scheduling job:', err);
      error.value = err.message || 'Failed to schedule job';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Pause a scheduled job
   */
  const pauseJob = async (dataSourceId: number): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const data = await $fetch(`${baseURL}/scheduler/jobs/${dataSourceId}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        await fetchScheduledJobs(); // Refresh list
        return true;
      } else {
        error.value = data.message || 'Failed to pause job';
        return false;
      }
    } catch (err: any) {
      console.error('Error pausing job:', err);
      error.value = err.message || 'Failed to pause job';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Resume a paused job
   */
  const resumeJob = async (dataSourceId: number): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const data = await $fetch(`${baseURL}/scheduler/jobs/${dataSourceId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        await fetchScheduledJobs(); // Refresh list
        return true;
      } else {
        error.value = data.message || 'Failed to resume job';
        return false;
      }
    } catch (err: any) {
      console.error('Error resuming job:', err);
      error.value = err.message || 'Failed to resume job';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Manually trigger a job immediately
   */
  const triggerJob = async (dataSourceId: number): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const data = await $fetch(`${baseURL}/scheduler/jobs/${dataSourceId}/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        await fetchScheduledJobs(); // Refresh list
        return true;
      } else {
        error.value = data.message || 'Failed to trigger job';
        return false;
      }
    } catch (err: any) {
      console.error('Error triggering job:', err);
      error.value = err.message || 'Failed to trigger job';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Cancel a scheduled job
   */
  const cancelJob = async (dataSourceId: number): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const data = await $fetch(`${baseURL}/scheduler/jobs/${dataSourceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        await fetchScheduledJobs(); // Refresh list
        return true;
      } else {
        error.value = data.message || 'Failed to cancel job';
        return false;
      }
    } catch (err: any) {
      console.error('Error cancelling job:', err);
      error.value = err.message || 'Failed to cancel job';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Fetch scheduler statistics
   */
  const fetchStats = async (): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      const data = await $fetch(`${baseURL}/scheduler/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        stats.value = data.data;
        return true;
      } else {
        error.value = data.message || 'Failed to fetch scheduler stats';
        return false;
      }
    } catch (err: any) {
      console.error('Error fetching scheduler stats:', err);
      error.value = err.message || 'Failed to fetch scheduler stats';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Get human-readable frequency from cron expression
   */
  const getFrequencyDisplay = (cronExpression: string): string => {
    if (!cronExpression) return 'Not scheduled';

    // Common patterns
    const patterns: Record<string, string> = {
      '0 * * * *': 'Hourly',
      '0 0 * * *': 'Daily at midnight',
      '0 0 * * 0': 'Weekly on Sunday',
      '0 0 1 * *': 'Monthly on the 1st'
    };

    if (patterns[cronExpression]) {
      return patterns[cronExpression];
    }

    // Parse custom cron
    const parts = cronExpression.split(' ');
    if (parts.length === 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      if (minute !== '*' && hour === '*') {
        return `Every hour at ${minute} minutes`;
      }
      if (hour !== '*' && dayOfMonth === '*' && dayOfWeek === '*') {
        return `Daily at ${hour}:${minute.padStart(2, '0')}`;
      }
      if (dayOfWeek !== '*') {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Weekly on ${days[parseInt(dayOfWeek)]} at ${hour}:${minute.padStart(2, '0')}`;
      }
      if (dayOfMonth !== '*') {
        return `Monthly on day ${dayOfMonth} at ${hour}:${minute.padStart(2, '0')}`;
      }
    }

    return cronExpression;
  };

  /**
   * Format next run time
   */
  const formatNextRun = (nextRun: string | null): string => {
    if (!nextRun) return 'Not scheduled';

    const date = new Date(nextRun);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs < 0) return 'Overdue';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else {
      return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }
  };

  /**
   * Format last run time
   */
  const formatLastRun = (lastRun: string | null): string => {
    if (!lastRun) return 'Never run';

    const date = new Date(lastRun);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  };

  return {
    // State
    scheduledJobs,
    currentJob,
    stats,
    isLoading,
    error,

    // Computed
    enabledJobs,
    disabledJobs,
    nextScheduledJob,

    // Methods
    fetchScheduledJobs,
    fetchJob,
    scheduleJob,
    pauseJob,
    resumeJob,
    triggerJob,
    cancelJob,
    fetchStats,

    // Utilities
    getFrequencyDisplay,
    formatNextRun,
    formatLastRun
  };
};
