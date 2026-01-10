import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ISchedulerStatus } from '~/types/scheduled-backups/ISchedulerStatus';
import type { ISchedulerConfig } from '~/types/scheduled-backups/ISchedulerConfig';
import type { IBackupRun } from '~/types/scheduled-backups/IBackupRun';
import type { IBackupStats } from '~/types/scheduled-backups/IBackupStats';
import type { IPaginationData } from '~/types/scheduled-backups/IPaginationData';

export const useScheduledBackupsStore = defineStore('scheduled-backups', () => {
    const schedulerStatus = ref<ISchedulerStatus | null>(null);
    const schedulerConfig = ref<ISchedulerConfig | null>(null);
    const backupRuns = ref<IBackupRun[]>([]);
    const backupStats = ref<IBackupStats | null>(null);
    const pagination = ref<IPaginationData>({
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0
    });
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Computed
    const successRate = computed(() => {
        if (!backupStats.value || backupStats.value.total_runs === 0) return 0;
        return Math.round((backupStats.value.successful_runs / backupStats.value.total_runs) * 100);
    });

    // Actions
    async function fetchSchedulerStatus() {
        try {
            loading.value = true;
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/scheduled-backups/status`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch scheduler status: ${response.statusText}`);
            }

            const data = await response.json();
            schedulerStatus.value = data;

            if (import.meta.client) {
                localStorage.setItem('scheduler_status', JSON.stringify(data));
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch scheduler status';
            console.error('Error fetching scheduler status:', err);
        } finally {
            loading.value = false;
        }
    }

    async function startScheduler() {
        try {
            loading.value = true;
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/scheduled-backups/start`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to start scheduler: ${response.statusText}`);
            }

            await fetchSchedulerStatus();
        } catch (err: any) {
            error.value = err.message || 'Failed to start scheduler';
            console.error('Error starting scheduler:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function stopScheduler() {
        try {
            loading.value = true;
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/scheduled-backups/stop`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to stop scheduler: ${response.statusText}`);
            }

            await fetchSchedulerStatus();
        } catch (err: any) {
            error.value = err.message || 'Failed to stop scheduler';
            console.error('Error stopping scheduler:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function updateSchedule(schedule: string) {
        try {
            loading.value = true;
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/scheduled-backups/schedule`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: JSON.stringify({ schedule })
            });

            if (!response.ok) {
                throw new Error(`Failed to update schedule: ${response.statusText}`);
            }

            await fetchSchedulerStatus();
        } catch (err: any) {
            error.value = err.message || 'Failed to update schedule';
            console.error('Error updating schedule:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function triggerManualBackup() {
        try {
            loading.value = true;
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/scheduled-backups/trigger-now`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to trigger manual backup: ${response.statusText}`);
            }

            const result = await response.json();

            // Refresh runs list after triggering
            await fetchBackupRuns(pagination.value.page);
            return result;
        } catch (err: any) {
            error.value = err.message || 'Failed to trigger manual backup';
            console.error('Error triggering manual backup:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function fetchBackupRuns(page = 1, filters: any = {}) {
        try {
            loading.value = true;
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.value.limit.toString(),
                ...Object.fromEntries(
                    Object.entries(filters).map(([k, v]) => [k, String(v)])
                )
            });

            const url = `${baseUrl()}/admin/scheduled-backups/runs?${params}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch backup runs: ${response.statusText}`);
            }

            const data = await response.json();

            backupRuns.value = data.runs;
            pagination.value = data.pagination;

            if (import.meta.client) {
                localStorage.setItem('backup_runs', JSON.stringify(data.runs));
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch backup runs';
            console.error('Error fetching backup runs:', err);
        } finally {
            loading.value = false;
        }
    }

    async function fetchBackupStats() {
        try {
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/scheduled-backups/stats`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch backup stats: ${response.statusText}`);
            }

            const data = await response.json();
            backupStats.value = data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch backup stats';
            console.error('Error fetching backup stats:', err);
        }
    }

    async function fetchSchedulerConfig() {
        try {
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/scheduled-backups/config`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch scheduler config: ${response.statusText}`);
            }

            const data = await response.json();
            schedulerConfig.value = data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch scheduler config';
            console.error('Error fetching scheduler config:', err);
        }
    }

    async function updateConfig(config: Partial<ISchedulerConfig>) {
        try {
            loading.value = true;
            error.value = null;

            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/scheduled-backups/config`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                throw new Error(`Failed to update config: ${response.statusText}`);
            }

            await fetchSchedulerConfig();
            await fetchSchedulerStatus();
        } catch (err: any) {
            error.value = err.message || 'Failed to update config';
            console.error('Error updating config:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    // Initialize from localStorage on client
    function initializeFromLocalStorage() {
        if (import.meta.client) {
            try {
                const storedStatus = localStorage.getItem('scheduler_status');
                if (storedStatus && storedStatus !== 'undefined' && storedStatus !== 'null') {
                    schedulerStatus.value = JSON.parse(storedStatus);
                }
            } catch (err) {
                console.warn('Failed to parse scheduler_status from localStorage:', err);
                localStorage.removeItem('scheduler_status');
            }

            try {
                const storedRuns = localStorage.getItem('backup_runs');
                if (storedRuns && storedRuns !== 'undefined' && storedRuns !== 'null') {
                    backupRuns.value = JSON.parse(storedRuns);
                }
            } catch (err) {
                console.warn('Failed to parse backup_runs from localStorage:', err);
                localStorage.removeItem('backup_runs');
            }
        }
    }

    return {
        // State
        schedulerStatus,
        schedulerConfig,
        backupRuns,
        backupStats,
        pagination,
        loading,
        error,
        // Computed
        successRate,
        // Actions
        fetchSchedulerStatus,
        startScheduler,
        stopScheduler,
        updateSchedule,
        triggerManualBackup,
        fetchBackupRuns,
        fetchBackupStats,
        fetchSchedulerConfig,
        updateConfig,
        initializeFromLocalStorage,
    };
});
