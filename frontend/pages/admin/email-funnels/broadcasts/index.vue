<script setup lang="ts">
definePageMeta({ layout: 'default' });
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();
const { showLoader, hideLoader } = useGlobalLoader();

const broadcasts = ref<any[]>([]);
const templates = ref<string[]>([]);
const estimate = ref<any>(null);
const loaded = ref<'loading' | 'done'>('loading');

const formatDate = (d: string | null): string => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const load = async () => {
    showLoader('Loading broadcasts...');
    try {
        const token = getAuthToken();
        const [bRes, tRes, eRes] = await Promise.all([
            $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/list`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
            $fetch(`${config.public.apiBase}/admin/email-funnels/templates`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
            $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/estimate`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
        ]);
        if (bRes.success) broadcasts.value = bRes.data || [];
        if (tRes.success) templates.value = tRes.data || [];
        if (eRes.success) estimate.value = eRes.data;
        loaded.value = 'done';
    } catch (err) {
        console.error('[admin/email-funnels/broadcasts] load error:', err);
    } finally {
        hideLoader();
    }
};

// ---- Compose Form ----
const showCompose = ref(false);
const newBroadcast = reactive({
    subject: '',
    template_file: 'broadcast-generic.html',
    content: '',
    audience: 'blog_subscribers',
    scheduled_at: '',
    schedule_later: false,
});

function updateContent(content: string): void {
    newBroadcast.content = content;
}

const previewHtml = ref<string | null>(null);
const showPreview = ref(false);
const previewLoading = ref(false);

const loadPreview = async () => {
    previewLoading.value = true;
    try {
        const token = getAuthToken();
        const res = await $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/preview`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
            body: {
                template_file: newBroadcast.template_file,
                template_data: JSON.stringify({ content: newBroadcast.content }),
                subject: newBroadcast.subject,
            },
        }) as any;
        if (res.success) {
            previewHtml.value = res.data;
            showPreview.value = true;
        }
    } catch (err: any) {
        console.error('Preview error:', err);
        $swal.fire({ icon: 'error', title: 'Preview Error', text: err.data?.error || err.message, confirmButtonColor: '#1e3a5f' });
    } finally {
        previewLoading.value = false;
    }
};

const createBroadcast = async () => {
    const token = getAuthToken();
    const body: any = {
        subject: newBroadcast.subject,
        template_file: newBroadcast.template_file,
        audience: newBroadcast.audience,
        template_data: JSON.stringify({ content: newBroadcast.content }),
    };
    if (newBroadcast.schedule_later && newBroadcast.scheduled_at) {
        body.scheduled_at = new Date(newBroadcast.scheduled_at).toISOString();
    }
    await $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
        body,
    });
    showCompose.value = false;
    newBroadcast.subject = '';
    newBroadcast.template_file = 'broadcast-generic.html';
    newBroadcast.content = '';
    newBroadcast.audience = 'blog_subscribers';
    newBroadcast.scheduled_at = '';
    newBroadcast.schedule_later = false;
    await load();
};

const sendNow = async (b: any) => {
    const result = await $swal.fire({ icon: 'question', title: 'Send Now', text: `Send "${b.subject}" immediately? It will be queued on the next worker cycle.`, showCancelButton: true, confirmButtonText: 'Send Now', confirmButtonColor: '#1e3a5f' });
    if (!result.isConfirmed) return;
    const token = getAuthToken();
    await $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/send-now/${b.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
    });
    await load();
};

const deleteBroadcast = async (b: any) => {
    const result = await $swal.fire({ icon: 'warning', title: 'Delete Broadcast', text: `Delete "${b.subject}"?`, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
    if (!result.isConfirmed) return;
    const token = getAuthToken();
    await $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/delete/${b.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
    });
    await load();
};

const togglePause = async (b: any) => {
    const token = getAuthToken();
    await $fetch(`${config.public.apiBase}/admin/email-funnels/broadcasts/pause/${b.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
    });
    await load();
};

const isScheduled = (b: any) => b.status === 'pending' && !!b.scheduled_at;
const isDue = (b: any) => isScheduled(b) && new Date(b.scheduled_at) <= new Date();

const statusLabel = (b: any) => {
    if (b.status === 'sent') return { text: 'Sent', class: 'text-green-600' };
    if (b.status === 'in_progress') return { text: 'In Progress', class: 'text-amber-600' };
    if (b.paused) return { text: 'Paused', class: 'text-gray-400' };
    if (isDue(b)) return { text: 'Pending (due)', class: 'text-amber-600' };
    if (isScheduled(b)) return { text: 'Scheduled', class: 'text-blue-600' };
    return { text: 'Pending', class: 'text-gray-500' };
};

onMounted(load);
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="max-w-6xl mx-auto px-4 py-8">
                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Email Broadcasts</h1>
                        <p class="text-sm text-gray-500 mt-1">Create, preview, and send one-off email broadcasts.</p>
                        <p v-if="estimate" class="text-xs text-gray-400 mt-1">
                            Daily limit: {{ estimate.daily_remaining }} / {{ estimate.daily_limit }} remaining
                        </p>
                    </div>
                    <div class="flex items-center gap-3">
                        <NuxtLink to="/admin/email-funnels" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">Funnels</NuxtLink>
                        <button @click="showCompose = true" class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium cursor-pointer">
                            <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" /> Compose Broadcast
                        </button>
                    </div>
                </div>

                <!-- Empty -->
                <div v-if="loaded === 'done' && !broadcasts.length && !showCompose" class="bg-white shadow rounded-lg p-12 text-center text-gray-400">
                    <font-awesome-icon :icon="['fas', 'bullhorn']" class="text-4xl mb-3" />
                    <p>No broadcasts created yet. Click "Compose Broadcast" to send your first one.</p>
                </div>

                <!-- Compose Form (full page, shown when showCompose is true) -->
                <div v-if="showCompose" class="bg-white shadow rounded-lg p-6 mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-lg font-bold text-gray-900">Compose Broadcast</h2>
                        <button @click="showCompose = false" class="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">
                            <font-awesome-icon :icon="['fas', 'xmark']" />
                        </button>
                    </div>

                    <form @submit.prevent="createBroadcast" class="space-y-4">
                        <div class="grid grid-cols-3 gap-4">
                            <!-- Left column: form fields -->
                            <div class="col-span-2 space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                    <input v-model="newBroadcast.subject" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" required placeholder="Enter email subject..." />
                                </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Template</label>
                                        <select v-model="newBroadcast.template_file" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm font-mono" required>
                                            <option value="broadcast-generic.html">broadcast-generic.html (recommended)</option>
                                            <option v-for="t in templates.filter(x => x !== 'broadcast-generic.html')" :key="t" :value="t">{{ t }}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                                        <select v-model="newBroadcast.audience" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm">
                                            <option value="blog_subscribers">Blog Subscribers</option>
                                            <option value="registered_users">Registered Users</option>
                                            <option value="lead_generator_downloads">Lead Generator Downloads</option>
                                            <option value="enterprise_queries">Enterprise Queries (opted in)</option>
                                            <option value="enterprise_contact_requests">Enterprise Contact Requests</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Email Content</label>
                                    <text-editor
                                        :buttons="['bold', 'italic', 'heading', 'strike', 'underline', 'link', 'code', 'image', 'ordered-list', 'bullet-list', 'undo', 'redo', 'block-quote']"
                                        minHeight="400"
                                        inputFormat="markdown"
                                        @update:content="(content: string) => { updateContent(content); }"
                                    />
                                    <p class="text-xs text-gray-400 mt-1">Compose your email content. The template wraps it with header, footer, and unsubscribe link.</p>
                                </div>
                                <div class="flex items-center gap-6 pt-2">
                                    <label class="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                                        <input type="checkbox" v-model="newBroadcast.schedule_later" class="rounded border-gray-300" />
                                        Schedule for later
                                    </label>
                                    <div v-if="newBroadcast.schedule_later" class="flex items-center gap-2">
                                        <label class="text-sm font-medium text-gray-700">Send At</label>
                                        <input v-model="newBroadcast.scheduled_at" type="datetime-local" class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                                    </div>
                                </div>
                                <div class="flex items-center gap-3 pt-4 border-t border-gray-200">
                                    <button type="submit" class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium cursor-pointer">
                                        <font-awesome-icon :icon="['fas', 'paper-plane']" class="mr-1" />
                                        {{ newBroadcast.schedule_later ? 'Schedule Broadcast' : 'Create Broadcast' }}
                                    </button>
                                    <button type="button" @click="loadPreview" :disabled="previewLoading" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50">
                                        <font-awesome-icon :icon="['fas', 'eye']" class="mr-1" />
                                        {{ previewLoading ? 'Rendering...' : 'Preview' }}
                                    </button>
                                    <button type="button" @click="showCompose = false" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer">Cancel</button>
                                </div>
                            </div>

                            <!-- Right column: preview panel -->
                            <div class="col-span-1">
                                <div class="sticky top-4">
                                    <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <font-awesome-icon :icon="['fas', 'eye']" class="text-gray-400" />
                                        Preview
                                    </h3>
                                    <div v-if="!showPreview" class="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
                                        <font-awesome-icon :icon="['fas', 'envelope']" class="text-3xl mb-2" />
                                        <p>Click "Preview" to see a rendered version of your email.</p>
                                    </div>
                                    <div v-if="previewLoading" class="border rounded-lg p-8 text-center text-gray-400">
                                        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl" />
                                    </div>
                                    <div v-if="showPreview && previewHtml" class="border rounded-lg overflow-hidden bg-white">
                                        <div class="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                                            <span class="text-xs font-medium text-gray-600">Rendered Preview</span>
                                            <button @click="showPreview = false" class="text-gray-400 hover:text-gray-600 cursor-pointer text-sm">
                                                <font-awesome-icon :icon="['fas', 'xmark']" />
                                            </button>
                                        </div>
                                        <div class="p-0">
                                            <iframe :srcdoc="previewHtml" class="w-full border-0" style="min-height: 600px;" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Broadcasts List -->
                <div v-if="broadcasts.length" class="bg-white shadow rounded-lg overflow-hidden">
                    <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <h2 class="text-sm font-semibold text-gray-700">Broadcast History</h2>
                    </div>
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Audience</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent / Total</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="b in broadcasts" :key="b.id" class="hover:bg-gray-50">
                                <td class="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">
                                    {{ b.subject }}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">{{ b.audience.replace(/_/g, ' ') }}</td>
                                <td class="px-4 py-3">
                                    <span :class="statusLabel(b).class" class="text-sm font-medium">{{ statusLabel(b).text }}</span>
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-600">{{ b.sent_count }} / {{ b.total_count || '?' }}</td>
                                <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(b.created_at) }}</td>
                                <td class="px-4 py-3 text-sm text-right whitespace-nowrap">
                                    <div class="flex justify-center gap-2">
                                        <NuxtLink :to="`/admin/email-funnels/broadcasts/${b.id}`" class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 cursor-pointer no-underline">
                                            <font-awesome-icon :icon="['fas', 'chart-simple']" class="text-xs" />
                                            <span>Stats</span>
                                        </NuxtLink>
                                        <button v-if="b.status === 'pending'" @click="sendNow(b)" class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-900 cursor-pointer">
                                            <font-awesome-icon :icon="['fas', 'paper-plane']" class="text-xs" />
                                            <span>Send Now</span>
                                        </button>
                                        <button v-if="b.status !== 'sent'" @click="togglePause(b)" :class="b.paused ? 'bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-900' : 'bg-amber-100 hover:bg-amber-200 text-amber-700 hover:text-amber-900'" class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer">
                                            <font-awesome-icon :icon="['fas', b.paused ? 'play' : 'pause']" class="text-xs" />
                                            <span>{{ b.paused ? 'Resume' : 'Pause' }}</span>
                                        </button>
                                        <button v-if="b.status === 'pending'" @click="deleteBroadcast(b)" class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-900 cursor-pointer">
                                            <font-awesome-icon :icon="['fas', 'trash']" class="text-xs" />
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>