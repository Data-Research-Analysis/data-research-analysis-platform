<script setup lang="ts">
definePageMeta({ layout: 'default' });
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();
const router = useRouter();
const route = useRoute();

const id = computed(() => parseInt(String(route.params.id)));

const activeTab = ref<string>('edit');

// Edit state
interface State {
    loading: boolean;
    submitting: boolean;
    error: string | null;
    slugManuallyEdited: boolean;
    title: string;
    slug: string;
    description: string;
    isGated: boolean;
    isActive: boolean;
    replacePdf: boolean;
    pdfFile: File | null;
    originalFileName: string;
    dragOver: boolean;
}
const state = reactive<State>({
    loading: true,
    submitting: false,
    error: null,
    slugManuallyEdited: false,
    title: '',
    slug: '',
    description: '',
    isGated: true,
    isActive: true,
    replacePdf: false,
    pdfFile: null,
    originalFileName: '',
    dragOver: false,
});

interface AnalyticsState {
    loading: boolean;
    leads: any[];
    totalLeads: number;
    page: number;
    limit: number;
    viewCount: number;
    downloadCount: number;
}
const analytics = reactive<AnalyticsState>({
    loading: false,
    leads: [],
    totalLeads: 0,
    page: 1,
    limit: 50,
    viewCount: 0,
    downloadCount: 0,
});

const pdfInput = ref<HTMLInputElement | null>(null);
const linkCopied = ref<boolean>(false);

const resourceUrl = computed(() => {
    const base = config.public.siteUrl || 'https://www.dataresearchanalysis.com';
    return `${base}/resources/${state.slug}`;
});

const conversionRate = computed(() => {
    if (!analytics.viewCount) return '0%';
    return `${((analytics.totalLeads / analytics.viewCount) * 100).toFixed(1)}%`;
});

const generateSlug = (text: string): string => {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '').trim()
        .replace(/[\s]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
};

watch(() => state.title, (val) => {
    if (!state.slugManuallyEdited) state.slug = generateSlug(val);
});

const onSlugInput = (e: Event): void => {
    state.slugManuallyEdited = true;
    state.slug = generateSlug((e.target as HTMLInputElement).value);
};

const validateAndSetPdf = (file: File | undefined): void => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
        ($swal).fire({ icon: 'error', title: 'Invalid file', text: 'Only PDF files are accepted.', confirmButtonColor: '#1e3a5f' });
        if (pdfInput.value) pdfInput.value.value = '';
        state.pdfFile = null;
        return;
    }
    state.pdfFile = file;
};

const onFileChange = (e: Event): void => validateAndSetPdf((e.target as HTMLInputElement).files?.[0]);

const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    state.dragOver = false;
    validateAndSetPdf(e.dataTransfer?.files[0]);
};

const loadLeadGenerator = async () => {
    state.loading = true;
    try {
        const token = getAuthToken();
        const response = await $fetch(`${config.public.apiBase}/admin/lead-generators/${id.value}`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        }) as any;
        if (response.success) {
            const lg = response.data;
            state.title = lg.title;
            state.slug = lg.slug;
            state.description = lg.description || '';
            state.isGated = lg.is_gated;
            state.isActive = lg.is_active;
            state.originalFileName = lg.original_file_name;
            analytics.viewCount = lg.view_count;
            analytics.downloadCount = lg.download_count;
        }
    } catch (err: any) {
        console.error('[edit lead-generator] load error:', err);
        state.error = 'Failed to load lead generator.';
    } finally {
        state.loading = false;
    }
};

const loadLeads = async (page: number = 1): Promise<void> => {
    analytics.loading = true;
    try {
        const token = getAuthToken();
        const response = await $fetch(`${config.public.apiBase}/admin/lead-generators/${id.value}/leads?page=${page}&limit=${analytics.limit}`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        }) as any;
        if (response.success) {
            analytics.leads = response.leads || [];
            analytics.totalLeads = response.total || 0;
            analytics.page = response.page || 1;
        }
    } catch (err: any) {
        console.error('[edit lead-generator] leads error:', err);
    } finally {
        analytics.loading = false;
    }
};

const submitEdit = async () => {
    if (!state.title.trim() || !state.slug.trim()) {
        ($swal).fire({ icon: 'warning', title: 'Required', text: 'Title and slug are required.', confirmButtonColor: '#1e3a5f' });
        return;
    }
    if (state.replacePdf && !state.pdfFile) {
        ($swal).fire({ icon: 'warning', title: 'Required', text: 'Please select a replacement PDF.', confirmButtonColor: '#1e3a5f' });
        return;
    }

    state.submitting = true;
    try {
        const token = getAuthToken();
        const formData = new FormData();
        formData.append('title', state.title.trim());
        formData.append('slug', state.slug.trim());
        formData.append('description', state.description.trim());
        formData.append('isGated', String(state.isGated));
        formData.append('isActive', String(state.isActive));
        if (state.replacePdf && state.pdfFile) {
            formData.append('pdf', state.pdfFile);
        }

        const response = await $fetch(`${config.public.apiBase}/admin/lead-generators/${id.value}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            body: formData,
        }) as any;

        if (response.success) {
            await ($swal).fire({ icon: 'success', title: 'Updated!', text: 'Lead generator updated.', confirmButtonColor: '#1e3a5f' });
            state.replacePdf = false;
            state.pdfFile = null;
            if (pdfInput.value) pdfInput.value.value = '';
        }
    } catch (err: any) {
        console.error('[edit lead-generator] update error:', err);
        const msg = err?.data?.error || 'Failed to update lead generator.';
        ($swal).fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#1e3a5f' });
    } finally {
        state.submitting = false;
    }
};

const copyResourceUrl = async () => {
    if (!import.meta.client) return;
    try {
        await navigator.clipboard.writeText(resourceUrl.value);
        linkCopied.value = true;
        setTimeout(() => { linkCopied.value = false; }, 2000);
    } catch {
        // Fallback
        const el = document.createElement('textarea');
        el.value = resourceUrl.value;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        linkCopied.value = true;
        setTimeout(() => { linkCopied.value = false; }, 2000);
    }
};

const exportCsv = () => {
    if (!analytics.leads.length) return;
    const headers = ['ID', 'Full Name', 'Email', 'Company', 'Phone', 'Job Title', 'IP Address', 'Created At'];
    const rows = analytics.leads.map((l) => [
        l.id, l.full_name || '', l.email, l.company || '', l.phone || '', l.job_title || '', l.ip_address || '',
        new Date(l.created_at).toISOString(),
    ]);
    const csvContent = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads-${state.slug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const formatDate = (d: any) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const switchTab = (tab: any) => {
    activeTab.value = tab;
    if (tab === 'analytics' && !(analytics.leads || []).length) {
        loadLeads(1);
    }
};

const totalPages = computed(() => Math.ceil(analytics.totalLeads / analytics.limit));

onMounted(() => {
    loadLeadGenerator();
});
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6 bg-gray-50 min-h-screen">
            <div class="ml-4 mr-4 md:ml-10 md:mr-10 mt-6 mb-16">

                <!-- Header -->
                <div class="flex items-center gap-4 mb-6">
                    <NuxtLink to="/admin/lead-generators" class="text-gray-500 hover:text-gray-700 transition-colors">
                        <font-awesome-icon :icon="['fas', 'arrow-left']" />
                    </NuxtLink>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Edit Lead Generator</h1>
                        <p v-if="state.slug" class="text-sm text-gray-500 mt-0.5 font-mono">{{ resourceUrl }}</p>
                    </div>
                </div>

                <!-- Loading -->
                <div v-if="state.loading" class="flex justify-center items-center py-16">
                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-primary-blue-100" />
                </div>

                <template v-else>
                    <!-- Tabs -->
                    <div class="flex border-b border-gray-200 mb-6">
                        <button
                            @click="switchTab('edit')"
                            :class="activeTab === 'edit' ? 'border-primary-blue-100 text-primary-blue-100' : 'border-transparent text-gray-500 hover:text-gray-700'"
                            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                        >
                            <font-awesome-icon :icon="['fas', 'pen']" class="mr-2" />
                            Edit
                        </button>
                        <button
                            @click="switchTab('analytics')"
                            :class="activeTab === 'analytics' ? 'border-primary-blue-100 text-primary-blue-100' : 'border-transparent text-gray-500 hover:text-gray-700'"
                            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                        >
                            <font-awesome-icon :icon="['fas', 'chart-bar']" class="mr-2" />
                            Analytics &amp; Leads
                        </button>
                    </div>

                    <!-- Edit Tab -->
                    <div v-if="activeTab === 'edit'" class="bg-white shadow rounded-lg p-8 max-w-2xl">
                        <form @submit.prevent="submitEdit" novalidate>

                            <div class="mb-5">
                                <label for="title" class="block text-sm font-medium text-gray-700 mb-1">Title <span class="text-red-500">*</span></label>
                                <input id="title" v-model="state.title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" required />
                            </div>

                            <div class="mb-5">
                                <label for="slug" class="block text-sm font-medium text-gray-700 mb-1">Slug <span class="text-red-500">*</span></label>
                                <div class="flex gap-2">
                                    <input id="slug" :value="state.slug" @input="onSlugInput" type="text" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm font-mono" required />
                                    <button type="button" @click="copyResourceUrl" class="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm cursor-pointer whitespace-nowrap">
                                        <font-awesome-icon :icon="linkCopied ? ['fas', 'check'] : ['fas', 'copy']" class="mr-1" />
                                        {{ linkCopied ? 'Copied!' : 'Copy URL' }}
                                    </button>
                                </div>
                                <p class="text-xs text-gray-400 mt-1">
                                    URL: <span class="text-primary-blue-100 font-mono">{{ resourceUrl }}</span>
                                </p>
                            </div>

                            <div class="mb-5">
                                <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea id="description" v-model="state.description" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm resize-vertical" />
                            </div>

                            <!-- Gated toggle -->
                            <div class="mb-5 flex items-start gap-3">
                                <button type="button" @click="state.isGated = !state.isGated" :class="state.isGated ? 'bg-primary-blue-100' : 'bg-gray-300'" class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 mt-0.5">
                                    <span :class="state.isGated ? 'translate-x-5' : 'translate-x-0'" class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200" />
                                </button>
                                <div>
                                    <p class="text-sm font-medium text-gray-700">Gated PDF</p>
                                    <p class="text-xs text-gray-500 mt-0.5">Require contact details before download.</p>
                                </div>
                            </div>

                            <!-- Active toggle -->
                            <div class="mb-5 flex items-start gap-3">
                                <button type="button" @click="state.isActive = !state.isActive" :class="state.isActive ? 'bg-green-500' : 'bg-gray-300'" class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 mt-0.5">
                                    <span :class="state.isActive ? 'translate-x-5' : 'translate-x-0'" class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200" />
                                </button>
                                <div>
                                    <p class="text-sm font-medium text-gray-700">Published</p>
                                    <p class="text-xs text-gray-500 mt-0.5">When disabled, the resource page returns 404.</p>
                                </div>
                            </div>

                            <!-- Current PDF -->
                            <div class="mb-5">
                                <p class="text-sm font-medium text-gray-700 mb-1">Current PDF</p>
                                <div class="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                                    <font-awesome-icon :icon="['fas', 'file-pdf']" class="text-red-500" />
                                    {{ state.originalFileName }}
                                </div>
                            </div>

                            <!-- Replace PDF toggle -->
                            <div class="mb-5 flex items-start gap-3">
                                <button type="button" @click="state.replacePdf = !state.replacePdf; state.pdfFile = null" :class="state.replacePdf ? 'bg-primary-blue-100' : 'bg-gray-300'" class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 mt-0.5">
                                    <span :class="state.replacePdf ? 'translate-x-5' : 'translate-x-0'" class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200" />
                                </button>
                                <p class="text-sm font-medium text-gray-700 mt-0.5">Replace PDF file</p>
                            </div>

                            <div v-if="state.replacePdf" class="mb-7">
                                <div
                                    :class="state.dragOver ? 'border-primary-blue-100 bg-blue-50' : 'border-gray-300 hover:border-primary-blue-100'"
                                    class="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
                                    @dragover.prevent="state.dragOver = true"
                                    @dragenter.prevent="state.dragOver = true"
                                    @dragleave.prevent="state.dragOver = false"
                                    @drop="onDrop"
                                >
                                    <input ref="pdfInput" type="file" accept=".pdf,application/pdf" @change="onFileChange" class="hidden" id="pdf-replace" />
                                    <label for="pdf-replace" class="cursor-pointer">
                                        <font-awesome-icon :icon="['fas', 'file-pdf']" :class="state.pdfFile ? 'text-red-500' : 'text-gray-300'" class="text-4xl mb-2" />
                                        <p v-if="!state.pdfFile" class="text-sm text-gray-500">Click to browse or drag and drop replacement PDF</p>
                                        <p v-else class="text-sm font-medium text-gray-900">{{ state.pdfFile.name }}</p>
                                        <p class="text-xs text-gray-400 mt-1">PDF only, max 50MB</p>
                                    </label>
                                </div>
                            </div>

                            <div class="flex items-center gap-3">
                                <button type="submit" :disabled="state.submitting" class="px-6 py-2.5 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium cursor-pointer">
                                    <font-awesome-icon v-if="state.submitting" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                    {{ state.submitting ? 'Saving...' : 'Save Changes' }}
                                </button>
                                <NuxtLink to="/admin/lead-generators" class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                    Cancel
                                </NuxtLink>
                            </div>

                        </form>
                    </div>

                    <!-- Analytics & Leads Tab -->
                    <div v-if="activeTab === 'analytics'">

                        <!-- Stats cards -->
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div class="bg-white shadow rounded-lg p-5 text-center">
                                <p class="text-2xl font-bold text-gray-900">{{ analytics.viewCount.toLocaleString() }}</p>
                                <p class="text-sm text-gray-500 mt-1">Total Views</p>
                            </div>
                            <div class="bg-white shadow rounded-lg p-5 text-center">
                                <p class="text-2xl font-bold text-gray-900">{{ analytics.downloadCount.toLocaleString() }}</p>
                                <p class="text-sm text-gray-500 mt-1">Total Downloads</p>
                            </div>
                            <div class="bg-white shadow rounded-lg p-5 text-center">
                                <p class="text-2xl font-bold text-gray-900">{{ analytics.totalLeads.toLocaleString() }}</p>
                                <p class="text-sm text-gray-500 mt-1">Leads Captured</p>
                            </div>
                            <div class="bg-white shadow rounded-lg p-5 text-center">
                                <p class="text-2xl font-bold text-gray-900">{{ conversionRate }}</p>
                                <p class="text-sm text-gray-500 mt-1">Conversion Rate</p>
                            </div>
                        </div>

                        <!-- Leads table -->
                        <div class="bg-white shadow rounded-lg overflow-hidden">
                            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h3 class="text-base font-semibold text-gray-900">Captured Leads</h3>
                                <button v-if="analytics.leads.length" @click="exportCsv" class="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                                    <font-awesome-icon :icon="['fas', 'download']" />
                                    Export CSV
                                </button>
                            </div>

                            <div v-if="analytics.loading" class="flex justify-center py-12">
                                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
                            </div>
                            <div v-else-if="!analytics.leads.length" class="py-12 text-center text-gray-400">
                                <font-awesome-icon :icon="['fas', 'users']" class="text-4xl mb-3" />
                                <p>No leads captured yet.</p>
                            </div>
                            <div v-else class="overflow-x-auto">
                                <table class="min-w-full divide-y divide-gray-200">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Title</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Captured</th>
                                        </tr>
                                    </thead>
                                    <tbody class="bg-white divide-y divide-gray-200">
                                        <tr v-for="lead in analytics.leads" :key="lead.id" class="hover:bg-gray-50">
                                            <td class="px-4 py-3 text-sm text-gray-900">{{ lead.full_name || '-' }}</td>
                                            <td class="px-4 py-3 text-sm text-gray-700">{{ lead.email }}</td>
                                            <td class="px-4 py-3 text-sm text-gray-500">{{ lead.company || '-' }}</td>
                                            <td class="px-4 py-3 text-sm text-gray-500">{{ lead.job_title || '-' }}</td>
                                            <td class="px-4 py-3 text-sm text-gray-500">{{ lead.phone || '-' }}</td>
                                            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(lead.created_at) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Pagination -->
                            <div v-if="totalPages > 1" class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                                <p class="text-sm text-gray-500">Page {{ analytics.page }} of {{ totalPages }} ({{ analytics.totalLeads }} total)</p>
                                <div class="flex gap-2">
                                    <button @click="loadLeads(analytics.page - 1)" :disabled="analytics.page <= 1" class="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer">
                                        Previous
                                    </button>
                                    <button @click="loadLeads(analytics.page + 1)" :disabled="analytics.page >= totalPages" class="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer">
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </template>

            </div>
        </div>
    </div>
</template>
