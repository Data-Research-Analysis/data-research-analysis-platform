<script setup lang="ts">
definePageMeta({ layout: 'default' });
const config = useRuntimeConfig();
const { showLoader, hideLoader } = useGlobalLoader();

const unsubscribes = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(50);

const formatDate = (d: string | null): string => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const totalPages = computed(() => Math.ceil(total.value / limit.value));

const load = async () => {
    showLoader('Loading unsubscribes...');
    try {
        const token = getAuthToken();
        const qs = new URLSearchParams({ page: String(page.value), limit: String(limit.value) }).toString();
        const res = await $fetch(`${config.public.apiBase}/admin/email-funnels/unsubscribes?${qs}`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        }) as any;
        if (res.success) {
            unsubscribes.value = res.data || [];
            total.value = res.total || 0;
        }
    } catch (err) {
        console.error('[admin/email-funnels/unsubscribes] load error:', err);
    } finally {
        hideLoader();
    }
};

watch(page, load);
onMounted(load);
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="max-w-6xl mx-auto px-4 py-8">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Unsubscribes</h1>
                        <p class="text-sm text-gray-500 mt-1">Users who have unsubscribed from email funnels.</p>
                        <p class="text-xs text-gray-400 mt-1">{{ total }} total unsubscribes</p>
                    </div>
                </div>

                <div v-if="!unsubscribes.length" class="bg-white shadow rounded-lg p-12 text-center text-gray-400">
                    <font-awesome-icon :icon="['fas', 'ban']" class="text-4xl mb-3" />
                    <p>No unsubscribes recorded yet.</p>
                </div>

                <div v-else class="bg-white shadow rounded-lg overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Funnel</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unsubscribed At</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            <tr v-for="u in unsubscribes" :key="u.id" class="hover:bg-gray-50">
                                <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ u.email }}</td>
                                <td class="px-4 py-3 text-sm text-gray-600">{{ u.funnel_id ? `Funnel #${u.funnel_id}` : 'All' }}</td>
                                <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(u.unsubscribed_at) }}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div v-if="totalPages > 1" class="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                        <p class="text-sm text-gray-500">Page {{ page }} of {{ totalPages }} ({{ total }} total)</p>
                        <div class="flex gap-2">
                            <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1" class="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Previous</button>
                            <button @click="page = Math.min(totalPages, page + 1)" :disabled="page >= totalPages" class="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>