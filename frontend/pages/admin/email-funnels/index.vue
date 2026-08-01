<script setup lang="ts">
definePageMeta({ layout: 'default' });
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();

const funnels = ref<any[]>([]);
const loading = ref(true);

const formatDate = (d: string | null): string => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const load = async () => {
    loading.value = true;
    try {
        const token = getAuthToken();
        const res = await $fetch(`${config.public.apiBase}/admin/email-funnels`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        }) as any;
        if (res.success) funnels.value = res.data || [];
    } catch (err) {
        console.error('[admin/email-funnels] load error:', err);
    } finally {
        loading.value = false;
    }
};

const toggleActive = async (f: any) => {
    try {
        const token = getAuthToken();
        const res = await $fetch(`${config.public.apiBase}/admin/email-funnels/${f.id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
            body: { is_active: !f.is_active },
        }) as any;
        if (res.success) f.is_active = !f.is_active;
    } catch (err) {
        $swal.fire({ icon: 'error', title: 'Error', text: 'Could not update status.', confirmButtonColor: '#1e3a5f' });
    }
};

const showCreateForm = ref(false);
const newFunnel = reactive({ name: '', slug: '', trigger_type: '', target_user_type: '' });

const createFunnel = async () => {
    const token = getAuthToken();
    await $fetch(`${config.public.apiBase}/admin/email-funnels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
        body: newFunnel,
    });
    showCreateForm.value = false;
    newFunnel.name = ''; newFunnel.slug = ''; newFunnel.trigger_type = ''; newFunnel.target_user_type = '';
    await load();
};

onMounted(load);
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
    <div class="max-w-6xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Email Funnels</h1>
                <p class="text-sm text-gray-500 mt-1">Manage automated email sequences.</p>
            </div>
            <button @click="showCreateForm = true" class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium cursor-pointer">
                <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" /> New Funnel
            </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
        </div>

        <!-- Empty -->
        <div v-else-if="!funnels.length" class="bg-white shadow rounded-lg p-12 text-center text-gray-400">
            <font-awesome-icon :icon="['fas', 'envelopes-bulk']" class="text-4xl mb-3" />
            <p>No email funnels configured yet.</p>
        </div>

        <!-- Table -->
        <div v-else class="bg-white shadow rounded-lg overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="f in funnels" :key="f.id" class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ f.name }}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">{{ f.trigger_type }}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">{{ f.target_user_type }}</td>
                        <td class="px-4 py-3">
                            <button @click="toggleActive(f)" :class="f.is_active ? 'bg-green-500' : 'bg-gray-300'" class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none">
                                <span :class="f.is_active ? 'translate-x-4' : 'translate-x-0'" class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200" />
                            </button>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(f.created_at) }}</td>
                        <td class="px-4 py-3 text-sm text-right">
                            <div class="flex justify-end gap-2">
                                <NuxtLink :to="`/admin/email-funnels/${f.id}`" class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 cursor-pointer no-underline">
                                    <font-awesome-icon :icon="['fas', 'edit']" class="text-xs" />
                                    <span>Edit</span>
                                </NuxtLink>
                                <NuxtLink :to="`/admin/email-funnels/${f.id}/enrollments`" class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 cursor-pointer no-underline">
                                    <font-awesome-icon :icon="['fas', 'users']" class="text-xs" />
                                    <span>Enrollments</span>
                                </NuxtLink>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Create Modal -->
        <div v-if="showCreateForm" class="fixed inset-0 z-50 flex items-center justify-center">
            <div class="absolute inset-0 bg-black/60" @click="showCreateForm = false"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
                <button @click="showCreateForm = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <font-awesome-icon :icon="['fas', 'xmark']" class="text-xl" />
                </button>
                <h3 class="text-lg font-bold text-gray-900 mb-4">Create Email Funnel</h3>
                <form @submit.prevent="createFunnel" class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input v-model="newFunnel.name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" required />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                        <input v-model="newFunnel.slug" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" required />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
                        <select v-model="newFunnel.trigger_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm">
                            <option value="download">Download</option>
                            <option value="blog_subscribe">Blog Subscribe</option>
                            <option value="register">Register</option>
                            <option value="upgrade">Upgrade</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Target User Type</label>
                        <select v-model="newFunnel.target_user_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm">
                            <option value="anonymous">Anonymous</option>
                            <option value="free">Free</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-3 pt-2">
                        <button type="submit" class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium cursor-pointer">Create</button>
                        <button type="button" @click="showCreateForm = false" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
        </div>
    </div>
</template>
