<script setup lang="ts">
definePageMeta({ layout: 'default' });
const route = useRoute();
const config = useRuntimeConfig();
const id = computed(() => parseInt(route.params.id as string));

const stats = ref<any>(null);
const funnel = ref<any>(null);
const loading = ref(true);

const load = async () => {
    loading.value = true;
    try {
        const token = getAuthToken();
        const [sRes, fRes] = await Promise.all([
            $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}/stats`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
            $fetch(`${config.public.apiBase}/admin/email-funnels/${id.value}`, {
                headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            }) as any,
        ]);
        if (sRes.success) stats.value = sRes.data;
        if (fRes.success) funnel.value = fRes.data;
    } catch (err) {
        console.error('[admin/email-funnels/stats] error:', err);
    } finally {
        loading.value = false;
    }
};

onMounted(load);
</script>

<template>
    <div class="max-w-6xl mx-auto px-4 py-8">
        <NuxtLink :to="`/admin/email-funnels/${id}`" class="text-sm text-primary-blue-100 hover:text-primary-blue-80 mb-4 inline-block">&larr; Back to Funnel</NuxtLink>
        <h1 class="text-2xl font-bold text-gray-900 mb-6">{{ funnel?.name || 'Loading...' }} — Stats</h1>

        <div v-if="loading" class="flex justify-center py-12">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
        </div>

        <template v-else-if="stats">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-white shadow rounded-lg p-5">
                    <p class="text-sm text-gray-500">Total Enrollments</p>
                    <p class="text-2xl font-bold text-gray-900">{{ stats.totalEnrollments }}</p>
                </div>
                <div class="bg-white shadow rounded-lg p-5">
                    <p class="text-sm text-gray-500">Active</p>
                    <p class="text-2xl font-bold text-green-600">{{ stats.activeEnrollments }}</p>
                </div>
                <div class="bg-white shadow rounded-lg p-5">
                    <p class="text-sm text-gray-500">Completed</p>
                    <p class="text-2xl font-bold text-blue-600">{{ stats.completedEnrollments }}</p>
                </div>
                <div class="bg-white shadow rounded-lg p-5">
                    <p class="text-sm text-gray-500">Unsubscribes</p>
                    <p class="text-2xl font-bold text-red-600">{{ stats.totalUnsubscribes }}</p>
                </div>
            </div>

            <div class="bg-white shadow rounded-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-base font-semibold text-gray-900">Step Performance</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opens</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="s in stats.stepStats" :key="s.stepId" class="hover:bg-gray-50">
                                <td class="px-4 py-3 text-sm text-gray-900">{{ s.stepOrder }}</td>
                                <td class="px-4 py-3 text-sm font-mono text-gray-600">{{ s.templateFile }}</td>
                                <td class="px-4 py-3 text-sm text-gray-900">{{ s.sent }}</td>
                                <td class="px-4 py-3 text-sm text-gray-900">{{ s.opens }}</td>
                                <td class="px-4 py-3 text-sm text-gray-900">{{ s.clicks }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
    </div>
</template>
