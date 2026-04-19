<script setup>
definePageMeta({ layout: 'default' });
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();

const state = reactive({
    leadGenerators: [],
    loading: true,
    error: null,
});

const formatDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const loadLeadGenerators = async () => {
    state.loading = true;
    state.error = null;
    try {
        const token = getAuthToken();
        const response = await $fetch(`${config.public.apiBase}/admin/lead-generators/list`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        });
        if (response.success) {
            state.leadGenerators = response.data || [];
        }
    } catch (err) {
        console.error('[lead-generators/list] error:', err);
        state.error = 'Failed to load lead generators.';
    } finally {
        state.loading = false;
    }
};

const toggleActive = async (lg) => {
    try {
        const token = getAuthToken();
        const response = await $fetch(`${config.public.apiBase}/admin/lead-generators/${lg.id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            },
            body: { isActive: !lg.is_active },
        });
        if (response.success) {
            lg.is_active = !lg.is_active;
        }
    } catch (err) {
        console.error('[toggleActive] error:', err);
        ($swal).fire({ icon: 'error', title: 'Error', text: 'Could not update status.', confirmButtonColor: '#1e3a5f' });
    }
};

const deleteLeadGenerator = async (lg) => {
    const result = await ($swal).fire({
        icon: 'warning',
        title: 'Delete Lead Generator',
        html: `<p>Are you sure you want to delete <strong>${lg.title}</strong>?</p><p class="text-sm text-gray-500 mt-2">This will permanently delete the PDF file and all captured leads.</p>`,
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
    });

    if (!result.isConfirmed) return;

    try {
        const token = getAuthToken();
        await $fetch(`${config.public.apiBase}/admin/lead-generators/${lg.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        });
        state.leadGenerators = state.leadGenerators.filter((item) => item.id !== lg.id);
        ($swal).fire({ icon: 'success', title: 'Deleted', text: 'Lead generator deleted.', confirmButtonColor: '#1e3a5f' });
    } catch (err) {
        console.error('[deleteLeadGenerator] error:', err);
        ($swal).fire({ icon: 'error', title: 'Error', text: 'Could not delete lead generator.', confirmButtonColor: '#1e3a5f' });
    }
};

onMounted(loadLeadGenerators);
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6 bg-gray-50 min-h-screen">
            <div class="ml-4 mr-4 md:ml-10 md:mr-10 mt-6 mb-16">

                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Lead Generators</h1>
                        <p class="text-sm text-gray-500 mt-1">Manage PDF lead magnets and track performance</p>
                    </div>
                    <NuxtLink
                        to="/admin/lead-generators/create"
                        class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium"
                    >
                        <font-awesome-icon :icon="['fas', 'plus']" />
                        Add Lead Generator
                    </NuxtLink>
                </div>

                <!-- Loading -->
                <div v-if="state.loading" class="flex justify-center items-center py-16">
                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-primary-blue-100" />
                </div>

                <!-- Error -->
                <div v-else-if="state.error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <p class="text-red-700">{{ state.error }}</p>
                    <button @click="loadLeadGenerators" class="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm cursor-pointer">
                        Retry
                    </button>
                </div>

                <!-- Empty -->
                <div v-else-if="state.leadGenerators.length === 0" class="bg-white shadow rounded-lg p-12 text-center">
                    <font-awesome-icon :icon="['fas', 'file-pdf']" class="text-gray-300 text-5xl mb-4" />
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No lead generators yet</h3>
                    <p class="text-gray-500 mb-4">Upload your first PDF lead magnet to get started.</p>
                    <NuxtLink to="/admin/lead-generators/create" class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium">
                        Add Lead Generator
                    </NuxtLink>
                </div>

                <!-- Table -->
                <div v-else class="bg-white shadow rounded-lg overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloads</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="lg in state.leadGenerators" :key="lg.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate">{{ lg.title }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-500 font-mono">{{ lg.slug }}</td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span v-if="lg.is_gated" class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                            Gated
                                        </span>
                                        <span v-else class="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Open
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ lg.view_count.toLocaleString() }}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ lg.download_count.toLocaleString() }}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ ((lg.lead_count) || 0).toLocaleString() }}</td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <button
                                            @click="toggleActive(lg)"
                                            :class="lg.is_active ? 'bg-green-500' : 'bg-gray-300'"
                                            class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none"
                                            :aria-label="lg.is_active ? 'Deactivate' : 'Activate'"
                                        >
                                            <span
                                                :class="lg.is_active ? 'translate-x-4' : 'translate-x-0'"
                                                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                                            />
                                        </button>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(lg.created_at) }}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <div class="flex items-center gap-3">
                                            <NuxtLink
                                                :to="`/admin/lead-generators/${lg.id}`"
                                                class="text-primary-blue-100 hover:text-primary-blue-80 font-medium transition-colors"
                                            >
                                                Edit
                                            </NuxtLink>
                                            <button
                                                @click="deleteLeadGenerator(lg)"
                                                class="text-red-600 hover:text-red-800 font-medium transition-colors cursor-pointer"
                                            >
                                                Delete
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
    </div>
</template>
