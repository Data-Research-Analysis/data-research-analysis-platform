<script setup lang="ts">
definePageMeta({ layout: 'default' });
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();
const { showLoader, hideLoader } = useGlobalLoader();

const queueData = ref<any>(null);
const autoRefresh = ref(true);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const load = async () => {
    showLoader('Loading queue status...');
    try {
        const token = getAuthToken();
        const res = await $fetch(`${config.public.apiBase}/admin/email-funnels/queue-status`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        }) as any;
        if (res.success) queueData.value = res.data;
    } catch (err) {
        console.error('[admin/email-funnels/queue] load error:', err);
    } finally {
        hideLoader();
    }
};

onMounted(() => {
    load();
    refreshTimer = setInterval(() => {
        if (autoRefresh.value) load();
    }, 10000);
});

onUnmounted(() => {
    if (refreshTimer) clearInterval(refreshTimer);
});

const formatTime = (ts: number | null): string => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDate = (ts: number | null): string => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="max-w-6xl mx-auto px-4 py-8">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Email Queue</h1>
                        <p class="text-sm text-gray-500 mt-1">BullMQ email queue monitoring and job status.</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input type="checkbox" v-model="autoRefresh" class="rounded border-gray-300" />
                            Auto-refresh (10s)
                        </label>
                        <button @click="load" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer">
                            <font-awesome-icon :icon="['fas', 'rotate']" class="mr-1" /> Refresh
                        </button>
                    </div>
                </div>

                <div v-if="!queueData" class="bg-white shadow rounded-lg p-12 text-center text-gray-400">
                    <p>Could not load queue status. Is Redis running?</p>
                </div>

                <div v-else class="space-y-6">
                    <!-- Summary cards -->
                    <div class="grid grid-cols-5 gap-4">
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-amber-600">{{ queueData.jobCounts.waiting }}</p>
                            <p class="text-xs text-gray-500 mt-1">Waiting</p>
                        </div>
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-blue-600">{{ queueData.jobCounts.active }}</p>
                            <p class="text-xs text-gray-500 mt-1">Active</p>
                        </div>
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-green-600">{{ queueData.jobCounts.completed }}</p>
                            <p class="text-xs text-gray-500 mt-1">Completed</p>
                        </div>
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-red-600">{{ queueData.jobCounts.failed }}</p>
                            <p class="text-xs text-gray-500 mt-1">Failed</p>
                        </div>
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-purple-600">{{ queueData.jobCounts.delayed }}</p>
                            <p class="text-xs text-gray-500 mt-1">Delayed</p>
                        </div>
                    </div>

                    <!-- Daily limit -->
                    <div class="bg-white shadow rounded-lg p-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-2">Daily Rate Limit</h3>
                        <div class="flex items-center gap-4">
                            <div class="flex-1 bg-gray-200 rounded-full h-3">
                                <div class="bg-primary-blue-100 h-3 rounded-full" :style="{ width: Math.min(100, (queueData.dailySent / queueData.dailyLimit) * 100) + '%' }"></div>
                            </div>
                            <span class="text-sm font-medium text-gray-700">{{ queueData.dailySent }} / {{ queueData.dailyLimit }}</span>
                        </div>
                    </div>

                    <!-- Waiting jobs -->
                    <div v-if="queueData.total > 0" class="bg-white shadow rounded-lg overflow-hidden">
                        <div class="px-4 py-3 border-b border-gray-200 bg-amber-50">
                            <h3 class="text-sm font-semibold text-amber-800">{{ queueData.total }} job(s) waiting/active in queue</h3>
                        </div>
                    </div>

                    <!-- Recent failed jobs -->
                    <div v-if="queueData.failedJobs?.length" class="bg-white shadow rounded-lg overflow-hidden">
                        <div class="px-4 py-3 border-b border-gray-200 bg-red-50">
                            <h3 class="text-sm font-semibold text-red-800">Recent Failed Jobs</h3>
                        </div>
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Failed At</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">
                                <tr v-for="j in queueData.failedJobs" :key="j.id" class="hover:bg-gray-50">
                                    <td class="px-4 py-2 text-sm font-mono text-gray-600">{{ j.id }}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900">{{ j.data?.to || '?' }}</td>
                                    <td class="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{{ j.data?.subject || '?' }}</td>
                                    <td class="px-4 py-2 text-sm text-gray-500">{{ formatDate(j.timestamp) }}</td>
                                    <td class="px-4 py-2 text-sm text-red-600 max-w-md truncate" :title="j.failedReason">{{ j.failedReason || 'Unknown' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Recent completed jobs -->
                    <div v-if="queueData.completedJobs?.length" class="bg-white shadow rounded-lg overflow-hidden">
                        <div class="px-4 py-3 border-b border-gray-200 bg-green-50">
                            <h3 class="text-sm font-semibold text-green-800">Recently Completed Jobs</h3>
                        </div>
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">
                                <tr v-for="j in queueData.completedJobs" :key="j.id" class="hover:bg-gray-50">
                                    <td class="px-4 py-2 text-sm font-mono text-gray-600">{{ j.id }}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900">{{ j.data?.to || '?' }}</td>
                                    <td class="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{{ j.data?.subject || '?' }}</td>
                                    <td class="px-4 py-2 text-sm text-gray-500">{{ formatDate(j.finishedOn) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>