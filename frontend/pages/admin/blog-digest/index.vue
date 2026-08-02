<script setup lang="ts">
definePageMeta({ layout: 'default' });
const config = useRuntimeConfig();
const { $swal } = useNuxtApp();
const { showLoader, hideLoader } = useGlobalLoader();

const articles = ref<any[]>([]);
const history = ref<any[]>([]);
const selectedIds = ref<Set<number>>(new Set());
const loading = ref(true);
const sending = ref(false);
const activeTab = ref<'compose' | 'history'>('compose');

const formatDate = (d: string | null): string => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const toggleArticle = (id: number) => {
    if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id);
    } else {
        selectedIds.value.add(id);
    }
};

const load = async () => {
    loading.value = true;
    try {
        const token = getAuthToken();
        const [aRes, hRes] = await Promise.all([
            $fetch(`${config.public.apiBase}/admin/blog-digest/articles`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
            $fetch(`${config.public.apiBase}/admin/blog-digest/history`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
        ]);
        if (aRes.success) articles.value = aRes.data || [];
        if (hRes.success) history.value = hRes.data || [];
    } catch (err) {
        console.error('[admin/blog-digest] load error:', err);
    } finally {
        loading.value = false;
    }
};

const sendDigest = async () => {
    if (!selectedIds.value.size) {
        $swal.fire({ icon: 'warning', title: 'No articles selected', text: 'Select at least one article to include in the digest.', confirmButtonColor: '#1e3a5f' });
        return;
    }
    const result = await $swal.fire({
        icon: 'question',
        title: 'Send Blog Digest?',
        html: `This will email <strong>${selectedIds.value.size} article(s)</strong> to all blog subscribers. Continue?`,
        showCancelButton: true,
        confirmButtonText: 'Send Digest',
        confirmButtonColor: '#1e3a5f',
        cancelButtonColor: '#6b7280',
    });
    if (!result.isConfirmed) return;

    sending.value = true;
    showLoader('Sending blog digest...');
    try {
        const token = getAuthToken();
        const ids = Array.from(selectedIds.value);
        const res = await $fetch(`${config.public.apiBase}/admin/blog-digest/send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
            body: { article_ids: ids },
        }) as any;
        if (res.success) {
            $swal.fire({ icon: 'success', title: 'Digest Sent', text: `Sent to ${res.data.sent} subscribers.`, confirmButtonColor: '#1e3a5f' });
            selectedIds.value = new Set();
            await load();
        }
    } catch (err: any) {
        $swal.fire({ icon: 'error', title: 'Error', text: err?.data?.error || 'Failed to send digest.', confirmButtonColor: '#1e3a5f' });
    } finally {
        sending.value = false;
        hideLoader();
    }
};

onMounted(load);
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
    <div class="max-w-6xl mx-auto px-4 py-8">
        <div class="mb-6">
            <h1 class="text-2xl font-bold text-gray-900">Blog Digest</h1>
            <p class="text-sm text-gray-500 mt-1">Select published articles and send a weekly digest to all blog subscribers.</p>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <button @click="activeTab = 'compose'" :class="activeTab === 'compose' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'" class="px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer">Compose Digest</button>
            <button @click="activeTab = 'history'" :class="activeTab === 'history' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'" class="px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer">History ({{ history.length }})</button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
        </div>

        <!-- Compose Tab -->
        <template v-else-if="activeTab === 'compose'">
            <div class="bg-white shadow rounded-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h3 class="text-base font-semibold text-gray-900">Eligible Articles ({{ articles.length }})</h3>
                        <p class="text-xs text-gray-400 mt-0.5">Articles not yet included in any digest</p>
                    </div>
                    <button
                        @click="sendDigest"
                        :disabled="sending || !selectedIds.size"
                        class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium cursor-pointer"
                    >
                        <font-awesome-icon v-if="sending" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                        <font-awesome-icon v-else :icon="['fas', 'paper-plane']" class="mr-2" />
                        {{ sending ? 'Sending...' : `Send Digest (${selectedIds.size})` }}
                    </button>
                </div>

                <div v-if="!articles.length" class="py-12 text-center text-gray-400">
                    <font-awesome-icon :icon="['fas', 'newspaper']" class="text-4xl mb-3" />
                    <p>No eligible articles. All published articles have been sent in previous digests.</p>
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
                                    <input type="checkbox" :checked="selectedIds.size === articles.length" @change="articles.forEach(a => toggleArticle(a.id))" class="rounded border-gray-300 cursor-pointer" />
                                </th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="a in articles" :key="a.id" class="hover:bg-gray-50">
                                <td class="px-4 py-3">
                                    <input type="checkbox" :checked="selectedIds.has(a.id)" @change="toggleArticle(a.id)" class="rounded border-gray-300 cursor-pointer" />
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{{ a.title }}</td>
                                <td class="px-4 py-3 text-sm font-mono text-gray-500">{{ a.slug }}</td>
                                <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(a.created_at) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- History Tab -->
        <template v-else>
            <div class="bg-white shadow rounded-lg overflow-hidden">
                <div v-if="!history.length" class="py-12 text-center text-gray-400">
                    <font-awesome-icon :icon="['fas', 'clock-rotate-left']" class="text-4xl mb-3" />
                    <p>No digests sent yet.</p>
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Articles Included</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="d in history" :key="d.id" class="hover:bg-gray-50">
                                <td class="px-4 py-3 text-sm text-gray-900">{{ formatDate(d.sent_at) }}</td>
                                <td class="px-4 py-3 text-sm text-gray-700">
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                        <font-awesome-icon :icon="['fas', 'envelope']" class="text-[10px]" />
                                        {{ d.sent_count }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-700">
                                    <div class="flex flex-col gap-1">
                                        <div v-for="art in d.articles" :key="art.id" class="text-sm">
                                            <NuxtLink :to="`/articles/${art.slug}`" target="_blank" class="text-primary-blue-100 hover:text-primary-blue-80 underline">{{ art.title }}</NuxtLink>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
        </div>
    </div>
    </div>
</template>
