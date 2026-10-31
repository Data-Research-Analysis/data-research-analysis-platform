<script setup lang="ts">
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();

interface JobRuntime {
    enabled: boolean;
    status: string;
    nextRunAt: string | null;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastFailedAt: string | null;
    lastManualRunAt: string | null;
    lastManualResult: string | null;
}

interface Job {
    key: string;
    name: string;
    description: string;
    cron: string;
    schedule: string;
    runnable: boolean;
    runtime: JobRuntime;
}

const jobs = ref<Job[]>([]);
const loading = ref(false);
const runningKey = ref<string | null>(null);

function authHeaders() {
    const token = getAuthToken();
    return {
        Authorization: `Bearer ${token}`,
        'Authorization-Type': 'auth',
        'Content-Type': 'application/json',
    };
}

function statusInfo(job: Job): { label: string; cls: string } {
    const status = job.runtime?.status;
    switch (status) {
        case 'running':
            return { label: 'Running', cls: 'bg-blue-100 text-blue-800' };
        case 'idle':
        case 'scheduled':
            return { label: 'Scheduled', cls: 'bg-green-100 text-green-800' };
        case 'disabled':
            return { label: 'Disabled', cls: 'bg-gray-200 text-gray-600' };
        case 'stopped':
            return { label: 'Stopped', cls: 'bg-amber-100 text-amber-800' };
        case 'destroyed':
            return { label: 'Destroyed', cls: 'bg-red-100 text-red-700' };
        case 'not-scheduled':
            return { label: 'Not scheduled', cls: 'bg-gray-100 text-gray-500' };
        default:
            return { label: 'Unknown', cls: 'bg-gray-100 text-gray-500' };
    }
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString();
}

function lastRun(job: Job): string | null {
    const r = job.runtime;
    const manual = r?.lastManualRunAt;
    const finished = r?.lastFinishedAt;
    if (manual && (!finished || new Date(manual) > new Date(finished))) return manual;
    return finished;
}

function lastRunResult(job: Job): string | null {
    return job.runtime?.lastManualResult ?? null;
}

async function loadJobs() {
    loading.value = true;
    try {
        const res = await $fetch<any>(`${config.public.apiBase}/admin/jobs`, {
            headers: authHeaders(),
        });
        jobs.value = res.data ?? [];
    } catch (err: any) {
        await $swal.fire({
            title: 'Failed to load jobs',
            text: err?.data?.error || err?.message || 'Unexpected error',
            icon: 'error',
            confirmButtonColor: '#3C8DBC',
        });
    } finally {
        loading.value = false;
    }
}

async function runJob(job: Job) {
    const { value: confirmed } = await $swal.fire({
        title: `Run "${job.name}"?`,
        text: 'This triggers the job immediately. All jobs are safe to run repeatedly.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3C8DBC',
        confirmButtonText: 'Run now',
    });
    if (!confirmed) return;
    runningKey.value = job.key;
    try {
        const res = await $fetch<any>(`${config.public.apiBase}/admin/jobs/run/${job.key}`, {
            method: 'POST',
            headers: authHeaders(),
        });
        await $swal.fire({
            title: 'Job completed',
            text: res.message || 'Job completed successfully',
            icon: 'success',
            confirmButtonColor: '#3C8DBC',
        });
        await loadJobs();
    } catch (err: any) {
        await $swal.fire({
            title: 'Job failed',
            text: err?.data?.error || err?.message,
            icon: 'error',
            confirmButtonColor: '#3C8DBC',
        });
    } finally {
        runningKey.value = null;
    }
}

onMounted(() => {
    if (import.meta.client) loadJobs();
});
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div>
                        <div class="font-bold text-2xl">Scheduled Jobs</div>
                        <p class="text-sm text-gray-600 mt-1">
                            Cron jobs running in the backend. Use <span class="font-semibold">Run now</span> to trigger a job immediately for verification.
                        </p>
                    </div>
                    <button
                        @click="loadJobs"
                        class="text-sm px-4 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                    >
                        Refresh
                    </button>
                </div>

                <div v-if="loading" class="text-center py-10">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue-100"></div>
                    <p class="mt-2 text-gray-600">Loading jobs…</p>
                </div>

                <div v-else class="bg-white shadow-md rounded-lg ring-1 ring-gray-200 ring-inset overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next run</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last run</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="job in jobs" :key="job.key" class="hover:bg-gray-50">
                                <td class="px-4 py-3">
                                    <div class="text-sm font-semibold text-gray-900">{{ job.name }}</div>
                                    <div class="text-xs text-gray-500 mt-1">{{ job.description }}</div>
                                    <div class="text-xs text-gray-400 mt-1 font-mono">{{ job.cron }}</div>
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                                        {{ job.schedule }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <span :class="['px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap', statusInfo(job).cls]">
                                        {{ statusInfo(job).label }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {{ formatDateTime(job.runtime?.nextRunAt) }}
                                </td>
                                <td class="px-4 py-3">
                                    <div class="text-sm text-gray-600">{{ formatDateTime(lastRun(job)) }}</div>
                                    <div v-if="lastRunResult(job)" class="text-xs text-gray-400 mt-0.5">{{ lastRunResult(job) }}</div>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        v-if="job.runnable"
                                        @click="runJob(job)"
                                        :disabled="runningKey !== null"
                                        class="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-50 cursor-pointer"
                                    >
                                        <font-awesome-icon v-if="runningKey === job.key" :icon="['fas', 'spinner']" class="animate-spin mr-1" />
                                        {{ runningKey === job.key ? 'Running…' : 'Run now' }}
                                    </button>
                                    <span v-else class="text-xs text-gray-400">Cron only</span>
                                </td>
                            </tr>
                            <tr v-if="jobs.length === 0">
                                <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">No jobs found.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>
