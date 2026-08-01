<script setup lang="ts">
definePageMeta({ layout: 'default' });
const route = useRoute();
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();
const id = computed(() => parseInt(route.params.id as string));

const funnel = ref<any>(null);
const steps = ref<any[]>([]);
const loading = ref(true);

const formatDate = (d: string | null): string => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const load = async () => {
    loading.value = true;
    try {
        const token = getAuthToken();
        const [fRes, sRes] = await Promise.all([
            $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
            $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}/steps`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
        ]);
        if (fRes.success) funnel.value = fRes.data;
        if (sRes.success) steps.value = sRes.data || [];
    } catch (err) {
        console.error('[admin/email-funnels/edit] load error:', err);
    } finally {
        loading.value = false;
    }
};

const toggleActive = async () => {
    if (!funnel.value) return;
    try {
        const token = getAuthToken();
        await $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
            body: { is_active: !funnel.value.is_active },
        });
        funnel.value.is_active = !funnel.value.is_active;
    } catch (err) {
        $swal.fire({ icon: 'error', title: 'Error', text: 'Could not update.', confirmButtonColor: '#1e3a5f' });
    }
};

// Step form
const showStepForm = ref(false);
const editingStep = ref<any>(null);
const stepForm = reactive({ step_order: 1, delay_hours: 24, template_file: '', subject_template: '' });

const openStepForm = (step: any = null) => {
    if (step) {
        editingStep.value = step;
        stepForm.step_order = step.step_order;
        stepForm.delay_hours = step.delay_hours;
        stepForm.template_file = step.template_file;
        stepForm.subject_template = step.subject_template;
    } else {
        editingStep.value = null;
        stepForm.step_order = (steps.value.length || 0) + 1;
        stepForm.delay_hours = 24;
        stepForm.template_file = '';
        stepForm.subject_template = '';
    }
    showStepForm.value = true;
};

const saveStep = async () => {
    try {
        const token = getAuthToken();
        if (editingStep.value) {
            await $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}/steps/${editingStep.value.id}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
                body: { ...stepForm },
            });
            $swal.fire({ icon: 'success', title: 'Updated', confirmButtonColor: '#1e3a5f' });
        } else {
            await $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}/steps`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' },
                body: { ...stepForm },
            });
            $swal.fire({ icon: 'success', title: 'Created', confirmButtonColor: '#1e3a5f' });
        }
        showStepForm.value = false;
        await load();
    } catch (err: any) {
        $swal.fire({ icon: 'error', title: 'Error', text: err?.data?.error || 'Could not save step.', confirmButtonColor: '#1e3a5f' });
    }
};

const deleteStep = async (step: any) => {
    const result = await $swal.fire({ icon: 'warning', title: 'Delete Step', text: 'Remove this step?', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
    if (!result.isConfirmed) return;
    try {
        const token = getAuthToken();
        await $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}/steps/${step.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        });
        $swal.fire({ icon: 'success', title: 'Deleted', confirmButtonColor: '#1e3a5f' });
        await load();
    } catch (err) {
        $swal.fire({ icon: 'error', title: 'Error', text: 'Could not delete step.', confirmButtonColor: '#1e3a5f' });
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
            <NuxtLink to="/admin/email-funnels" class="text-sm text-primary-blue-100 hover:text-primary-blue-80 mb-2 inline-block">&larr; Back to Funnels</NuxtLink>
            <div v-if="funnel" class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">{{ funnel.name }}</h1>
                    <p class="text-sm text-gray-500 mt-1">Slug: {{ funnel.slug }} &middot; Trigger: {{ funnel.trigger_type }} &middot; Target: {{ funnel.target_user_type }}</p>
                </div>
                <div class="flex items-center gap-3">
                    <button @click="toggleActive" :class="funnel.is_active ? 'text-green-600' : 'text-gray-400'" class="text-sm font-medium cursor-pointer">
                        {{ funnel.is_active ? 'Active' : 'Inactive' }}
                    </button>
                    <NuxtLink :to="`/admin/email-funnels/${funnel.id}/stats`" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">Stats</NuxtLink>
                    <NuxtLink :to="`/admin/email-funnels/${funnel.id}/enrollments`" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">Enrollments</NuxtLink>
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-12">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
        </div>

        <template v-else-if="funnel">
            <!-- Steps Section -->
            <div class="bg-white shadow rounded-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 class="text-base font-semibold text-gray-900">Email Steps ({{ steps.length }})</h3>
                    <button @click="openStepForm()" class="px-3 py-1.5 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium cursor-pointer">
                        <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" /> Add Step
                    </button>
                </div>

                <div v-if="!steps.length" class="py-12 text-center text-gray-400">
                    <font-awesome-icon :icon="['fas', 'envelope-open-text']" class="text-4xl mb-3" />
                    <p>No steps configured. Add the first email in this sequence.</p>
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delay (hrs)</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="s in steps" :key="s.id" class="hover:bg-gray-50">
                                <td class="px-4 py-3 text-sm text-gray-900">{{ s.step_order }}</td>
                                <td class="px-4 py-3 text-sm text-gray-700">{{ s.delay_hours }}h</td>
                                <td class="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{{ s.subject_template }}</td>
                                <td class="px-4 py-3 text-sm font-mono text-gray-600">{{ s.template_file }}</td>
                                <td class="px-4 py-3">
                                    <span :class="s.is_active ? 'text-green-600' : 'text-gray-400'" class="text-sm">{{ s.is_active ? 'Yes' : 'No' }}</span>
                                </td>
                                <td class="px-4 py-3 text-sm text-right">
                                    <button @click="openStepForm(s)" class="text-primary-blue-100 hover:text-primary-blue-80 font-medium cursor-pointer mr-3">Edit</button>
                                    <button @click="deleteStep(s)" class="text-red-600 hover:text-red-800 font-medium cursor-pointer">Delete</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Step Form Modal -->
            <div v-if="showStepForm" class="fixed inset-0 z-50 flex items-center justify-center">
                <div class="absolute inset-0 bg-black/60" @click="showStepForm = false"></div>
                <div class="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
                    <button @click="showStepForm = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer">
                        <font-awesome-icon :icon="['fas', 'xmark']" class="text-xl" />
                    </button>
                    <h3 class="text-lg font-bold text-gray-900 mb-4">{{ editingStep ? 'Edit Step' : 'Add Step' }}</h3>
                    <form @submit.prevent="saveStep" class="space-y-3">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Step Order</label>
                                <input v-model.number="stepForm.step_order" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm" required />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Delay (hours)</label>
                                <input v-model.number="stepForm.delay_hours" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm" required />
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Subject Template</label>
                            <input v-model="stepForm.subject_template" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm" required />
                            <p class="text-xs text-gray-400 mt-1">Use {{first_name}}, {{pdf_title}} as placeholders.</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Template File</label>
                            <input v-model="stepForm.template_file" type="text" placeholder="lead-generator-a2-problem.html" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm font-mono" required />
                            <p class="text-xs text-gray-400 mt-1">Filename in backend/src/templates/</p>
                        </div>
                        <div class="flex items-center gap-3 pt-2">
                            <button type="submit" class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium cursor-pointer">{{ editingStep ? 'Update' : 'Add' }} Step</button>
                            <button type="button" @click="showStepForm = false" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        </template>
        </div>
    </div>
    </div>
</template>
