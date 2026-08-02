<script setup lang="ts">
definePageMeta({ layout: 'default' });
const config = useRuntimeConfig();
const { showLoader, hideLoader } = useGlobalLoader();

const leads = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(50);
const search = ref('');
const sourceFilter = ref('');

const formatDate = (d: string | null): string => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const sourceLabel = (s: string): string => {
    const labels: Record<string, string> = {
        blog_subscribers: 'Blog Subscribers',
        lead_generator_downloads: 'Lead Gen Downloads',
        enterprise_queries: 'Enterprise Queries',
        enterprise_contact_requests: 'Enterprise Contact',
        registered_users: 'Registered Users',
    };
    return labels[s] || s;
};

const sourceColor = (s: string): string => {
    const colors: Record<string, string> = {
        blog_subscribers: 'bg-blue-100 text-blue-700',
        lead_generator_downloads: 'bg-green-100 text-green-700',
        enterprise_queries: 'bg-purple-100 text-purple-700',
        enterprise_contact_requests: 'bg-orange-100 text-orange-700',
        registered_users: 'bg-gray-100 text-gray-700',
    };
    return colors[s] || 'bg-gray-100 text-gray-700';
};

const load = async () => {
    showLoader('Loading leads...');
    try {
        const token = getAuthToken();
        const params: any = { page: page.value, limit: limit.value };
        if (sourceFilter.value) params.source = sourceFilter.value;
        if (search.value) params.search = search.value;
        const qs = new URLSearchParams(params).toString();
        const res = await $fetch(`${config.public.apiBase}/admin/email-funnels/leads?${qs}`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        }) as any;
        if (res.success) {
            leads.value = res.data || [];
            total.value = res.total || 0;
        }
    } catch (err) {
        console.error('[admin/email-funnels/leads] load error:', err);
    } finally {
        hideLoader();
    }
};

const totalPages = computed(() => Math.ceil(total.value / limit.value));

watch([sourceFilter, page], load);
watch(search, () => { page.value = 1; load(); });

onMounted(load);
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="max-w-6xl mx-auto px-4 py-8">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Email Leads</h1>
                        <p class="text-sm text-gray-500 mt-1">Unified list of all collected email addresses across features.</p>
                        <p class="text-xs text-gray-400 mt-1">{{ total }} total leads</p>
                    </div>
                </div>

                <!-- Filters -->
                <div class="bg-white shadow rounded-lg p-4 mb-6 flex items-center gap-4">
                    <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500 mb-1">Search</label>
                        <input v-model="search" type="text" placeholder="Search by email or name..." class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                    </div>
                    <div class="w-64">
                        <label class="block text-xs font-medium text-gray-500 mb-1">Source</label>
                        <select v-model="sourceFilter" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm">
                            <option value="">All Sources</option>
                            <option value="blog_subscribers">Blog Subscribers</option>
                            <option value="lead_generator_downloads">Lead Gen Downloads</option>
                            <option value="enterprise_queries">Enterprise Queries</option>
                            <option value="enterprise_contact_requests">Enterprise Contact</option>
                            <option value="registered_users">Registered Users</option>
                        </select>
                    </div>
                </div>

                <!-- Empty -->
                <div v-if="!leads.length" class="bg-white shadow rounded-lg p-12 text-center text-gray-400">
                    <font-awesome-icon :icon="['fas', 'address-book']" class="text-4xl mb-3" />
                    <p>No leads found.</p>
                </div>

                <!-- Table -->
                <div v-else class="bg-white shadow rounded-lg overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="l in leads" :key="l.email + '-' + l.source" class="hover:bg-gray-50">
                                <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ l.email }}</td>
                                <td class="px-4 py-3 text-sm text-gray-600">{{ l.name || '—' }}</td>
                                <td class="px-4 py-3">
                                    <span :class="sourceColor(l.source)" class="inline-block px-2 py-0.5 text-xs font-medium rounded-full">{{ sourceLabel(l.source) }}</span>
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                                    <span v-if="l.extra?.company">{{ l.extra.company }}<span v-if="l.extra?.job_title"> · {{ l.extra.job_title }}</span></span>
                                    <span v-else-if="l.extra?.country">{{ l.extra.country }}<span v-if="l.extra?.opted_in !== undefined"> · {{ l.extra.opted_in ? 'Opted in' : 'Not opted' }}</span></span>
                                    <span v-else-if="l.extra?.team_size">{{ l.extra.company }} · {{ l.extra.team_size }}</span>
                                    <span v-else-if="l.extra?.user_id">UID: {{ l.extra.user_id }}</span>
                                    <span v-else>—</span>
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(l.created_at) }}</td>
                            </tr>
                        </tbody>
                    </table>

                    <!-- Pagination -->
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