<script setup lang="ts">
definePageMeta({ layout: 'default' });
const route = useRoute();
const config = useRuntimeConfig();
const { showLoader, hideLoader } = useGlobalLoader();

const broadcastId = computed(() => parseInt(route.params.id as string));

const stats = ref<any>(null);
const logs = ref<any[]>([]);
const previewHtml = ref<string | null>(null);
const previewLogId = ref<number | null>(null);
const previewLoading = ref(false);

const formatDate = (d: string | null): string => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const load = async () => {
    showLoader('Loading broadcast stats...');
    try {
        const token = getAuthToken();
        const [sRes, lRes] = await Promise.all([
            $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/${broadcastId.value}/stats`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
            $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/${broadcastId.value}/logs`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
        ]);
        if (sRes.success) stats.value = sRes.data;
        if (lRes.success) logs.value = lRes.data || [];
    } catch (err) {
        console.error('[admin/email-funnels/broadcasts/id] load error:', err);
    } finally {
        hideLoader();
    }
};

const loadPreview = async (logId: number) => {
    previewLoading.value = true;
    previewLogId.value = logId;
    previewHtml.value = null;
    try {
        const token = getAuthToken();
        const res = await $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/${broadcastId.value}/logs/${logId}/preview`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        }) as any;
        if (res.success) previewHtml.value = res.data;
    } catch (err) {
        console.error('[admin/email-funnels/broadcasts/id] preview error:', err);
    } finally {
        previewLoading.value = false;
    }
};

const statusIcon = (log: any): string => {
    if (log.error) return 'text-red-500';
    if (log.clicked_at) return 'text-green-600';
    if (log.opened_at) return 'text-blue-500';
    return 'text-gray-300';
};

const statusLabel = (log: any): string => {
    if (log.error) return 'Failed';
    if (log.clicked_at) return 'Clicked';
    if (log.opened_at) return 'Opened';
    return 'Sent';
};

onMounted(load);
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="max-w-6xl mx-auto px-4 py-8">
                <template v-if="stats">
                    <!-- Header -->
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <div class="flex items-center gap-3 mb-1">
                                <NuxtLink to="/admin/email-funnels/broadcasts" class="text-sm text-primary-blue-100 hover:text-primary-blue-80 transition-colors">&larr; Back to Broadcasts</NuxtLink>
                            </div>
                            <h1 class="text-2xl font-bold text-gray-900">{{ stats.broadcast.subject }}</h1>
                            <p class="text-sm text-gray-500 mt-1">
                                Audience: {{ stats.broadcast.audience.replace(/_/g, ' ') }} &middot;
                                Template: {{ stats.broadcast.template_file }} &middot;
                                Status: {{ stats.broadcast.status }}
                            </p>
                            <p v-if="stats.broadcast.created_at" class="text-xs text-gray-400 mt-1">Created: {{ formatDate(stats.broadcast.created_at) }}</p>
                        </div>
                    </div>

                    <!-- Summary Cards -->
                    <div class="grid grid-cols-5 gap-4 mb-6">
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-gray-900">{{ stats.sent }}</p>
                            <p class="text-xs text-gray-500 mt-1">Sent</p>
                        </div>
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-blue-600">{{ stats.opened }}</p>
                            <p class="text-xs text-gray-500 mt-1">Opened</p>
                        </div>
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-green-600">{{ stats.clicked }}</p>
                            <p class="text-xs text-gray-500 mt-1">Clicked</p>
                        </div>
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-red-600">{{ stats.failed }}</p>
                            <p class="text-xs text-gray-500 mt-1">Failed</p>
                        </div>
                        <div class="bg-white shadow rounded-lg p-4 text-center">
                            <p class="text-2xl font-bold text-purple-600">{{ stats.openRate }}% / {{ stats.clickRate }}%</p>
                            <p class="text-xs text-gray-500 mt-1">Open / Click Rate</p>
                        </div>
                    </div>

                    <!-- Split view: logs table + preview -->
                    <div class="grid grid-cols-3 gap-6">
                        <!-- Logs Table -->
                        <div class="col-span-2 bg-white shadow rounded-lg overflow-hidden">
                            <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
                                <h2 class="text-sm font-semibold text-gray-700">Recipient Logs ({{ logs.length }})</h2>
                            </div>
                            <div v-if="!logs.length" class="p-8 text-center text-gray-400 text-sm">No logs yet.</div>
                            <table v-else class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Opened</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Clicked</th>
                                        <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Preview</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200">
                                    <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50">
                                        <td class="px-3 py-2 text-sm text-gray-900">{{ log.recipient_email }}</td>
                                        <td class="px-3 py-2 text-sm text-gray-600">{{ log.recipient_name || '—' }}</td>
                                        <td class="px-3 py-2">
                                            <span :class="statusIcon(log)" class="text-sm">
                                                <font-awesome-icon :icon="['fas', log.error ? 'circle-exclamation' : log.clicked_at ? 'check-double' : log.opened_at ? 'eye' : 'check']" class="mr-1" />
                                                {{ statusLabel(log) }}
                                            </span>
                                        </td>
                                        <td class="px-3 py-2 text-sm text-gray-500">{{ formatDate(log.sent_at) }}</td>
                                        <td class="px-3 py-2 text-sm text-gray-500">{{ log.opened_at ? formatDate(log.opened_at) : '—' }}</td>
                                        <td class="px-3 py-2 text-sm text-gray-500">{{ log.clicked_at ? formatDate(log.clicked_at) : '—' }}</td>
                                        <td class="px-3 py-2 text-right">
                                            <button @click="loadPreview(log.id)" class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 cursor-pointer">
                                                <font-awesome-icon :icon="['fas', 'eye']" class="text-xs" />
                                                <span>View</span>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Preview Panel -->
                        <div class="col-span-1">
                            <div class="sticky top-4">
                                <div class="bg-white shadow rounded-lg overflow-hidden">
                                    <div class="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                                        <h2 class="text-sm font-semibold text-gray-700">Email Preview</h2>
                                        <span v-if="previewLogId" class="text-xs text-gray-400">Log #{{ previewLogId }}</span>
                                    </div>
                                    <div v-if="!previewHtml && !previewLoading" class="p-8 text-center text-gray-400 text-sm">
                                        <font-awesome-icon :icon="['fas', 'envelope']" class="text-3xl mb-2" />
                                        <p>Click "View" on a recipient row to see the rendered email they received.</p>
                                    </div>
                                    <div v-if="previewLoading" class="p-8 text-center text-gray-400">
                                        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl" />
                                    </div>
                                    <div v-if="previewHtml" class="p-0">
                                        <iframe :srcdoc="previewHtml" class="w-full border-0" style="min-height: 600px;" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>