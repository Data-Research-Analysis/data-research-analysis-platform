<script setup lang="ts">
definePageMeta({ layout: 'default' });
const route = useRoute();
const config = useRuntimeConfig();
const id = computed(() => parseInt(route.params.id as string));

const enrollments = ref<any[]>([]);
const funnel = ref<any>(null);
const loading = ref(true);
const total = ref(0);
const page = ref(1);
const limit = 50;

const formatDate = (d: string | null): string => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const load = async () => {
    loading.value = true;
    try {
        const token = getAuthToken();
        const [eRes, fRes] = await Promise.all([
            $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}/enrollments?page=${page.value}&limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
            $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
        ]);
        if (eRes.success) { enrollments.value = eRes.data || []; total.value = eRes.total || 0; }
        if (fRes.success) funnel.value = fRes.data;
    } catch (err) {
        console.error('[admin/email-funnels/enrollments] error:', err);
    } finally {
        loading.value = false;
    }
};

const totalPages = computed(() => Math.ceil(total.value / limit));

watch(page, load);
onMounted(load);
</script>

<template>
    <div class="max-w-6xl mx-auto px-4 py-8">
        <NuxtLink :to="`/admin/email-funnels/${id}`" class="text-sm text-primary-blue-100 hover:text-primary-blue-80 mb-4 inline-block">&larr; Back to Funnel</NuxtLink>
        <h1 class="text-2xl font-bold text-gray-900 mb-6">{{ funnel?.name || 'Loading...' }} — Enrollments</h1>

        <div v-if="loading" class="flex justify-center py-12">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
        </div>

        <div v-else class="bg-white shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <p class="text-sm text-gray-500">{{ total }} total enrollments</p>
            </div>

            <div v-if="!enrollments.length" class="py-12 text-center text-gray-400">
                <font-awesome-icon :icon="['fas', 'users']" class="text-4xl mb-3" />
                <p>No enrollments yet.</p>
            </div>

            <div v-else class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sent</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="e in enrollments" :key="e.id" class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm font-mono text-gray-900">{{ e.lead_email }}</td>
                            <td class="px-4 py-3 text-sm text-gray-700">{{ e.lead_name || '—' }}</td>
                            <td class="px-4 py-3 text-sm text-gray-900">{{ e.current_step }} / {{ e.total_steps }}</td>
                            <td class="px-4 py-3">
                                <span :class="e.is_active ? 'text-green-600' : 'text-gray-400'" class="text-sm">{{ e.is_active ? 'Yes' : 'No' }}</span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(e.started_at) }}</td>
                            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(e.last_sent_at) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Previous</button>
                <span class="text-sm text-gray-500">Page {{ page }} of {{ totalPages }}</span>
                <button @click="page = Math.min(totalPages, page + 1)" :disabled="page >= totalPages" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Next</button>
            </div>
        </div>
    </div>
</template>
