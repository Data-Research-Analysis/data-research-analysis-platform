<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { ITimeSeriesPoint } from '~/types/admin/stats';

useHead({
    title: 'Admin Dashboard | Data Research Analysis',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const config = useRuntimeConfig();

const {
    overviewStats,
    syncHealthData,
    systemHealth,
    isLoading,
    refreshStats,
} = useAdminStats();

// ------ Time-series ------
const signupSeries = ref<ITimeSeriesPoint[]>([]);
const projectSeries = ref<ITimeSeriesPoint[]>([]);
const aiSeries = ref<ITimeSeriesPoint[]>([]);
const cancellationSeries = ref<ITimeSeriesPoint[]>([]);
const dsTypeSeries = ref<{ label: string; value: number }[]>([]);
const isSeriesLoading = ref(false);

const authHeaders = () => {
    const token = getAuthToken();
    if (!token) throw new Error('Authentication required');
    return { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' };
};

const fetchAllSeries = async () => {
    isSeriesLoading.value = true;
    try {
        const [signups, projects, ai, cancellations, dsTypes] = await Promise.all([
            $fetch<any>(`${config.public.apiBase}/admin/stats/timeseries?metric=signups&days=30`, { headers: authHeaders() }),
            $fetch<any>(`${config.public.apiBase}/admin/stats/timeseries?metric=projects&days=30`, { headers: authHeaders() }),
            $fetch<any>(`${config.public.apiBase}/admin/stats/timeseries?metric=ai_messages&days=30`, { headers: authHeaders() }),
            $fetch<any>(`${config.public.apiBase}/admin/stats/timeseries?metric=cancellations&days=30`, { headers: authHeaders() }),
            $fetch<any>(`${config.public.apiBase}/admin/stats/datasource-types`, { headers: authHeaders() }),
        ]);
        if (signups.success) signupSeries.value = signups.data;
        if (projects.success) projectSeries.value = projects.data;
        if (ai.success) aiSeries.value = ai.data;
        if (cancellations.success) cancellationSeries.value = cancellations.data;
        if (dsTypes.success) {
            dsTypeSeries.value = dsTypes.data.map((d: any) => ({ label: d.data_type, value: d.count }));
        }
    } catch (err) {
        console.error('[AdminDashboard] Failed to load time-series:', err);
    } finally {
        isSeriesLoading.value = false;
    }
};

// ------ Cancellation stats from existing endpoint ------
const cancellationStats = ref<any>(null);
const fetchCancellationStats = async () => {
    try {
        const res = await $fetch<any>(`${config.public.apiBase}/admin/account-cancellations/statistics`, {
            headers: authHeaders(),
        });
        if (res.success) cancellationStats.value = res.data;
    } catch {}
};

onMounted(() => {
    if (!import.meta.client) return;
    fetchAllSeries();
    fetchCancellationStats();
});

// ------ Sync health filter ------
const syncFilter = ref<'all' | 'failed' | 'never'>('all');
const filteredSyncData = computed(() => {
    if (!syncHealthData.value) return [];
    if (syncFilter.value === 'all') return syncHealthData.value;
    return syncHealthData.value.filter((r) => r.status === syncFilter.value);
});

// ------ Cancellation reason chart data ------
const cancellationReasonSeries = computed(() => {
    const by = cancellationStats.value?.byReasonCategory;
    if (!by) return [];
    return Object.entries(by).map(([label, value]) => ({ label, value: Number(value) }));
});

// ------ Helpers ------
const formatRelativeTime = (ts: string | null): string => {
    if (!ts || ts === 'null') return 'Never';
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
};

const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
};

const dataTypeLabel: Record<string, string> = {
    postgresql: 'PostgreSQL', mysql: 'MySQL', mariadb: 'MariaDB', mongodb: 'MongoDB',
    csv: 'CSV', excel: 'Excel', pdf: 'PDF',
    google_analytics: 'Google Analytics', google_ad_manager: 'Ad Manager',
    google_ads: 'Google Ads', meta_ads: 'Meta Ads', linkedin_ads: 'LinkedIn Ads',
    hubspot: 'HubSpot', klaviyo: 'Klaviyo',
};

const healthChip = (ok: boolean) =>
    ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600';

// ------ Backup quick-action ------
const triggeringBackup = ref(false);
const backupMessage = ref('');
const triggerBackup = async () => {
    triggeringBackup.value = true;
    backupMessage.value = '';
    try {
        const res = await $fetch<any>(`${config.public.apiBase}/admin/database/backup`, {
            method: 'POST',
            headers: authHeaders(),
        });
        backupMessage.value = res.success ? 'Backup queued successfully.' : 'Failed to queue backup.';
        if (res.success) refreshStats();
    } catch {
        backupMessage.value = 'Error triggering backup.';
    } finally {
        triggeringBackup.value = false;
    }
};
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6 bg-gray-50 min-h-screen">
            <div class="ml-4 mr-4 md:ml-10 md:mr-10 mt-6 mb-16">

                <!-- Page header -->
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                        <p class="text-sm text-gray-500 mt-1">Platform-wide health and statistics</p>
                    </div>
                    <button
                        @click="refreshStats"
                        :disabled="isLoading"
                        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                    >
                        <font-awesome-icon :icon="['fas', 'arrows-rotate']" :class="isLoading ? 'animate-spin' : ''" />
                        Refresh
                    </button>
                </div>

                <!-- Sticky jump nav -->
                <nav class="flex flex-wrap gap-2 mb-6 bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm sticky top-4 z-10">
                    <span class="text-xs font-semibold text-gray-400 mr-2 self-center">Jump to:</span>
                    <a v-for="link in [
                        { id: 'users', label: 'Users' },
                        { id: 'platform', label: 'Platform' },
                        { id: 'sync', label: 'Sync Health' },
                        { id: 'ai', label: 'AI Usage' },
                        { id: 'system', label: 'System' },
                        { id: 'cancellations', label: 'Cancellations' },
                        { id: 'content', label: 'Content' },
                    ]" :key="link.id" :href="`#${link.id}`"
                        class="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                        {{ link.label }}
                    </a>
                </nav>

                <!-- ============================================================
                     SECTION 1 — Global Health Banner
                ============================================================ -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <div v-for="chip in [
                        { label: 'Database', ok: systemHealth?.database ?? null, icon: ['fas', 'database'] },
                        { label: 'Redis', ok: systemHealth?.redis ?? null, icon: ['fas', 'server'] },
                        { label: 'Backup Scheduler', ok: systemHealth?.backupScheduler?.enabled ?? null, icon: ['fas', 'clock'] },
                    ]" :key="chip.label"
                        class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-3"
                    >
                        <div
                            class="flex items-center justify-center h-9 w-9 rounded-full flex-shrink-0"
                            :class="chip.ok === null ? 'bg-gray-100' : chip.ok ? 'bg-green-100' : 'bg-red-100'"
                        >
                            <font-awesome-icon
                                :icon="chip.icon"
                                class="text-sm"
                                :class="chip.ok === null ? 'text-gray-400' : chip.ok ? 'text-green-600' : 'text-red-500'"
                            />
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">{{ chip.label }}</p>
                            <p class="text-sm font-semibold" :class="chip.ok === null ? 'text-gray-400' : chip.ok ? 'text-green-700' : 'text-red-600'">
                                {{ chip.ok === null ? 'Loading…' : chip.ok ? 'Healthy' : 'Down' }}
                            </p>
                        </div>
                    </div>
                    <!-- Email service -->
                    <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-3">
                        <div class="flex items-center justify-center h-9 w-9 rounded-full bg-blue-100 flex-shrink-0">
                            <font-awesome-icon :icon="['fas', 'envelope']" class="text-sm text-blue-600" />
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Email Service</p>
                            <p class="text-sm font-semibold text-blue-700">Configured</p>
                        </div>
                    </div>
                </div>

                <!-- ============================================================
                     SECTION 2 — User Growth & Activity
                ============================================================ -->
                <section id="users" class="mb-10">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'users']" class="text-blue-500" />
                            User Growth &amp; Activity
                        </h2>
                        <NuxtLink to="/admin/users/create" class="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                            <font-awesome-icon :icon="['fas', 'plus']" class="text-xs" />
                            Add User
                        </NuxtLink>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                        <AdminStatCard
                            label="Total Users"
                            :value="overviewStats?.users.total ?? '—'"
                            :icon="['fas', 'users']"
                            icon-bg="bg-blue-500"
                            action-label="Manage users"
                            action-to="/admin/users"
                        />
                        <AdminStatCard
                            label="Verified"
                            :value="overviewStats?.users.verified ?? '—'"
                            :icon="['fas', 'circle-check']"
                            icon-bg="bg-green-500"
                        />
                        <AdminStatCard
                            label="Unverified"
                            :value="overviewStats?.users.unverified ?? '—'"
                            :icon="['fas', 'circle-exclamation']"
                            icon-bg="bg-amber-500"
                        />
                        <AdminStatCard
                            label="Admins"
                            :value="overviewStats?.users.admins ?? '—'"
                            :icon="['fas', 'user-shield']"
                            icon-bg="bg-purple-500"
                        />
                    </div>

                    <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                        <p class="text-sm font-medium text-gray-600 mb-3">Signups (last 30 days)</p>
                        <AdminChart v-if="signupSeries.length" type="line" :data="signupSeries" :height="160" color="#3b82f6" />
                        <div v-else class="h-40 flex items-center justify-center text-sm text-gray-400">No data available</div>
                    </div>
                </section>

                <!-- ============================================================
                     SECTION 3 — Platform Usage
                ============================================================ -->
                <section id="platform" class="mb-10">
                    <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                        <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-indigo-500" />
                        Platform Usage
                    </h2>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                        <AdminStatCard
                            label="Projects"
                            :value="overviewStats?.platform.projects ?? '—'"
                            :icon="['fas', 'folder-open']"
                            icon-bg="bg-indigo-500"
                        />
                        <AdminStatCard
                            label="Data Sources"
                            :value="overviewStats?.platform.dataSources ?? '—'"
                            :icon="['fas', 'database']"
                            icon-bg="bg-cyan-500"
                        />
                        <AdminStatCard
                            label="Dashboards"
                            :value="overviewStats?.platform.dashboards ?? '—'"
                            :icon="['fas', 'table-columns']"
                            icon-bg="bg-violet-500"
                        />
                        <AdminStatCard
                            label="Data Models"
                            :value="overviewStats?.platform.dataModels ?? '—'"
                            :icon="['fas', 'diagram-project']"
                            icon-bg="bg-pink-500"
                        />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <p class="text-sm font-medium text-gray-600 mb-3">Projects created (last 30 days)</p>
                            <AdminChart v-if="projectSeries.length" type="bar" :data="projectSeries" :height="160" color="#6366f1" context="projects created" />
                            <div v-else class="h-40 flex items-center justify-center text-sm text-gray-400">No data available</div>
                        </div>
                        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <p class="text-sm font-medium text-gray-600 mb-3">Data source type breakdown</p>
                            <AdminChart v-if="dsTypeSeries.length" type="donut" :data="dsTypeSeries" :height="160" />
                            <div v-else class="h-40 flex items-center justify-center text-sm text-gray-400">No data available</div>
                        </div>
                    </div>
                </section>

                <!-- ============================================================
                     SECTION 4 — Data Source Sync Health
                ============================================================ -->
                <section id="sync" class="mb-10">
                    <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                        <font-awesome-icon :icon="['fas', 'rotate']" class="text-cyan-500" />
                        Data Source Sync Health
                    </h2>

                    <!-- Summary bar -->
                    <div class="flex flex-wrap gap-3 mb-4">
                        <div class="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'circle-check']" class="text-green-500 text-sm" />
                            <span class="text-sm font-medium text-green-700">
                                {{ (overviewStats?.syncHealth.totalSources ?? 0) - (overviewStats?.syncHealth.failedSources ?? 0) - (overviewStats?.syncHealth.neverSynced ?? 0) }} healthy
                            </span>
                        </div>
                        <div class="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-amber-500 text-sm" />
                            <span class="text-sm font-medium text-amber-700">{{ overviewStats?.syncHealth.failedSources ?? 0 }} stale</span>
                        </div>
                        <div class="bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'clock']" class="text-gray-500 text-sm" />
                            <span class="text-sm font-medium text-gray-700">{{ overviewStats?.syncHealth.neverSynced ?? 0 }} never synced</span>
                        </div>
                    </div>

                    <!-- Filter tabs -->
                    <div class="flex gap-2 mb-3">
                        <button
                            v-for="f in [{ key: 'all', label: 'All' }, { key: 'failed', label: 'Stale (72h+)' }, { key: 'never', label: 'Never Synced' }]"
                            :key="f.key"
                            @click="syncFilter = f.key as any"
                            class="px-3 py-1 text-xs font-medium rounded-full border transition-colors cursor-pointer"
                            :class="syncFilter === f.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                        >
                            {{ f.label }}
                        </button>
                    </div>

                    <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left text-xs font-semibold text-gray-500 px-4 py-3">Name</th>
                                    <th class="text-left text-xs font-semibold text-gray-500 px-4 py-3">Type</th>
                                    <th class="text-left text-xs font-semibold text-gray-500 px-4 py-3">Owner</th>
                                    <th class="text-left text-xs font-semibold text-gray-500 px-4 py-3">Last Sync</th>
                                    <th class="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                <tr v-for="row in filteredSyncData.slice(0, 50)" :key="row.id"
                                    :class="row.status === 'failed' ? 'bg-amber-50' : ''"
                                >
                                    <td class="px-4 py-3 font-medium text-gray-900">{{ row.name }}</td>
                                    <td class="px-4 py-3 text-gray-500">{{ dataTypeLabel[row.data_type] || row.data_type }}</td>
                                    <td class="px-4 py-3 text-gray-500">{{ row.owner_email }}</td>
                                    <td class="px-4 py-3 text-gray-500">{{ formatRelativeTime(row.last_sync) }}</td>
                                    <td class="px-4 py-3">
                                        <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                                            :class="{
                                                'bg-green-100 text-green-700': row.status === 'synced',
                                                'bg-amber-100 text-amber-700': row.status === 'failed',
                                                'bg-gray-100 text-gray-600': row.status === 'never',
                                            }"
                                        >
                                            {{ row.status === 'synced' ? 'Synced' : row.status === 'failed' ? 'Stale' : 'Never' }}
                                        </span>
                                    </td>
                                </tr>
                                <tr v-if="!filteredSyncData.length">
                                    <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">No data sources found.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- ============================================================
                     SECTION 5 — AI Usage Metrics
                ============================================================ -->
                <section id="ai" class="mb-10">
                    <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                        <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-violet-500" />
                        AI Usage Metrics
                    </h2>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                        <AdminStatCard
                            label="Total Conversations"
                            :value="overviewStats?.ai.totalConversations ?? '—'"
                            :icon="['fas', 'comments']"
                            icon-bg="bg-violet-500"
                        />
                        <AdminStatCard
                            label="Total AI Messages"
                            :value="overviewStats?.ai.totalMessages ?? '—'"
                            :icon="['fas', 'message']"
                            icon-bg="bg-purple-500"
                        />
                        <AdminStatCard
                            label="Active Redis Sessions"
                            :value="overviewStats?.ai.activeRedisSessions ?? '—'"
                            :icon="['fas', 'bolt']"
                            icon-bg="bg-amber-500"
                        />
                    </div>

                    <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                        <p class="text-sm font-medium text-gray-600 mb-3">AI messages per day (last 30 days)</p>
                        <AdminChart v-if="aiSeries.length" type="bar" :data="aiSeries" :height="160" color="#8b5cf6" context="messages" />
                        <div v-else class="h-40 flex items-center justify-center text-sm text-gray-400">No data available</div>
                    </div>
                </section>

                <!-- ============================================================
                     SECTION 6 — System Health & Infrastructure
                ============================================================ -->
                <section id="system" class="mb-10">
                    <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                        <font-awesome-icon :icon="['fas', 'server']" class="text-gray-500" />
                        System Health &amp; Infrastructure
                    </h2>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <!-- DB health -->
                        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <div class="flex items-center gap-2 mb-3">
                                <font-awesome-icon :icon="['fas', 'database']" class="text-blue-500" />
                                <span class="text-sm font-semibold text-gray-700">Database</span>
                                <span class="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" :class="healthChip(systemHealth?.database ?? false)">
                                    {{ systemHealth?.database ? 'Connected' : systemHealth === null ? '—' : 'Down' }}
                                </span>
                            </div>
                            <p class="text-xs text-gray-400">PostgreSQL primary datastore</p>
                        </div>

                        <!-- Redis health -->
                        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <div class="flex items-center gap-2 mb-3">
                                <font-awesome-icon :icon="['fas', 'server']" class="text-red-400" />
                                <span class="text-sm font-semibold text-gray-700">Redis</span>
                                <span class="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" :class="healthChip(systemHealth?.redis ?? false)">
                                    {{ systemHealth?.redis ? 'Connected' : systemHealth === null ? '—' : 'Down' }}
                                </span>
                            </div>
                            <p class="text-xs text-gray-400">AI session &amp; queue cache</p>
                        </div>

                        <!-- Backup scheduler -->
                        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <div class="flex items-center gap-2 mb-3">
                                <font-awesome-icon :icon="['fas', 'clock']" class="text-green-500" />
                                <span class="text-sm font-semibold text-gray-700">Backup Scheduler</span>
                                <span class="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                                    :class="systemHealth?.backupScheduler?.enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                                >
                                    {{ systemHealth?.backupScheduler?.enabled ? 'Enabled' : 'Disabled' }}
                                </span>
                            </div>
                            <div class="text-xs text-gray-500 space-y-1">
                                <div>Last run: <span class="font-medium">{{ formatRelativeTime(systemHealth?.backupScheduler?.lastRun ?? null) }}</span></div>
                                <div>Next run: <span class="font-medium">{{ systemHealth?.backupScheduler?.nextRun ? new Date(systemHealth.backupScheduler.nextRun).toLocaleString() : 'N/A' }}</span></div>
                                <div v-if="systemHealth?.backupStats">
                                    Runs: {{ systemHealth.backupStats.successfulRuns }} ok / {{ systemHealth.backupStats.failedRuns }} failed &bull;
                                    Total: {{ formatBytes(systemHealth.backupStats.totalSizeBytes) }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Backup quick actions -->
                    <div class="mt-4 flex flex-wrap gap-3 items-center">
                        <button
                            @click="triggerBackup"
                            :disabled="triggeringBackup"
                            class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 cursor-pointer"
                        >
                            <font-awesome-icon :icon="triggeringBackup ? ['fas', 'spinner'] : ['fas', 'download']" :class="triggeringBackup ? 'animate-spin' : ''" />
                            Trigger Backup Now
                        </button>
                        <NuxtLink to="/admin/database/scheduled-backups" class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                            <font-awesome-icon :icon="['fas', 'calendar-days']" />
                            View Backup History
                        </NuxtLink>
                        <span v-if="backupMessage" class="text-sm" :class="backupMessage.includes('success') ? 'text-green-600' : 'text-red-500'">
                            {{ backupMessage }}
                        </span>
                    </div>
                </section>

                <!-- ============================================================
                     SECTION 7 — Account Cancellations & Churn
                ============================================================ -->
                <section id="cancellations" class="mb-10">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'right-from-bracket']" class="text-red-400" />
                            Account Cancellations &amp; Churn
                        </h2>
                        <NuxtLink to="/admin/account-cancellations" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                            View all &rarr;
                        </NuxtLink>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
                        <AdminStatCard label="Total" :value="cancellationStats?.totalCancellations ?? '—'" :icon="['fas', 'users-slash']" icon-bg="bg-gray-500" />
                        <AdminStatCard label="Pending" :value="cancellationStats?.pendingCancellations ?? '—'" :icon="['fas', 'hourglass-half']" icon-bg="bg-amber-500" />
                        <AdminStatCard label="Active" :value="cancellationStats?.activeCancellations ?? '—'" :icon="['fas', 'circle-xmark']" icon-bg="bg-orange-500" />
                        <AdminStatCard label="Deleted" :value="cancellationStats?.deletedAccounts ?? '—'" :icon="['fas', 'trash']" icon-bg="bg-red-500" />
                        <AdminStatCard label="Reactivated" :value="cancellationStats?.reactivatedAccounts ?? '—'" :icon="['fas', 'rotate-left']" icon-bg="bg-green-500" />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <p class="text-sm font-medium text-gray-600 mb-3">Cancellations per day (last 30 days)</p>
                            <AdminChart v-if="cancellationSeries.length" type="bar" :data="cancellationSeries" :height="160" color="#ef4444" />
                            <div v-else class="h-40 flex items-center justify-center text-sm text-gray-400">No data available</div>
                        </div>
                        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <p class="text-sm font-medium text-gray-600 mb-3">Cancellations by reason</p>
                            <AdminChart v-if="cancellationReasonSeries.length" type="donut" :data="cancellationReasonSeries" :height="160" />
                            <div v-else class="h-40 flex items-center justify-center text-sm text-gray-400">No cancellations yet</div>
                        </div>
                    </div>
                </section>

                <!-- ============================================================
                     SECTION 8 — Content Management
                ============================================================ -->
                <section id="content" class="mb-10">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'newspaper']" class="text-teal-500" />
                            Content Management
                        </h2>
                        <div class="flex gap-3">
                            <NuxtLink to="/admin/articles/create" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                Add Article &rarr;
                            </NuxtLink>
                            <NuxtLink to="/admin/sitemap" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                Add Sitemap URL &rarr;
                            </NuxtLink>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <AdminStatCard
                            label="Total Articles"
                            :value="overviewStats?.content.articles ?? '—'"
                            :icon="['fas', 'newspaper']"
                            icon-bg="bg-teal-500"
                            action-label="Manage"
                            action-to="/admin/articles"
                        />
                        <AdminStatCard
                            label="Published"
                            :value="overviewStats?.content.publishedArticles ?? '—'"
                            :icon="['fas', 'circle-check']"
                            icon-bg="bg-green-500"
                        />
                        <AdminStatCard
                            label="Drafts"
                            :value="overviewStats?.content.draftArticles ?? '—'"
                            :icon="['fas', 'pen']"
                            icon-bg="bg-gray-400"
                        />
                        <AdminStatCard
                            label="Categories"
                            :value="overviewStats?.content.categories ?? '—'"
                            :icon="['fas', 'tag']"
                            icon-bg="bg-sky-500"
                        />
                        <AdminStatCard
                            label="Sitemap URLs"
                            :value="overviewStats?.content.sitemapUrls ?? '—'"
                            :icon="['fas', 'sitemap']"
                            icon-bg="bg-emerald-500"
                            action-label="Manage"
                            action-to="/admin/sitemap"
                        />
                    </div>
                </section>

            </div>
        </div>
    </div>
</template>