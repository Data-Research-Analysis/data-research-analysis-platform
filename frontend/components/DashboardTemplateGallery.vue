<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRuntimeConfig, useNuxtApp, navigateTo } from '#app';
import type { IDashboard } from '~/types/IDashboard';
import { getAuthToken } from '~/composables/AuthToken';

const props = defineProps<{ projectId: number }>();

const config = useRuntimeConfig();
const { $swal } = useNuxtApp() as any;

const templates = ref<IDashboard[]>([]);
const loadingTemplates = ref(true);
const fetchError = ref<string | null>(null);
const cloningId = ref<number | null>(null);

async function fetchTemplates() {
    loadingTemplates.value = true;
    fetchError.value = null;
    try {
        const token = getAuthToken();
        if (!token) {
            fetchError.value = 'Not authenticated — please log in and try again.';
            return;
        }
        const data = await $fetch<IDashboard[]>(`${config.public.apiBase}/dashboard/templates`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        templates.value = data ?? [];
    } catch (err: any) {
        const status = err?.status ?? err?.statusCode;
        const msg = err?.data?.message ?? err?.message ?? String(err);
        console.error('[DashboardTemplateGallery] Failed to fetch templates:', err);
        fetchError.value = status
            ? `Server returned ${status}: ${msg}`
            : `Could not reach the backend: ${msg}`;
    } finally {
        loadingTemplates.value = false;
    }
}

async function cloneTemplate(templateId: number) {
    cloningId.value = templateId;
    try {
        const token = getAuthToken();
        if (!token) return;
        const result = await $fetch<{ message: string; dashboard: IDashboard }>(
            `${config.public.apiBase}/dashboard/clone-template`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ template_id: templateId, project_id: props.projectId }),
            },
        );

        if (result?.dashboard?.id) {
            await $swal.fire({
                icon: 'success',
                title: 'Dashboard created!',
                text: 'Dashboard created from template. Start customising!',
                timer: 2000,
                showConfirmButton: false,
            });
            await navigateTo(`/marketing-projects/${props.projectId}/dashboards/${result.dashboard.id}`);
        }
    } catch (err: any) {
        const msg = err?.data?.message ?? 'The dashboard could not be created from this template.';
        await $swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
        cloningId.value = null;
    }
}

onMounted(() => {
    fetchTemplates();
});
</script>

<template>
    <div>
        <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
            <div class="mb-6">
                <h2 class="font-bold text-2xl text-gray-900">Dashboard Templates</h2>
                <p class="text-sm text-gray-500 mt-1">
                    Choose a pre-built template to get started immediately. Your copy is fully editable — add, remove, and reconfigure any widget.
                </p>
            </div>

            <!-- Skeleton loader -->
            <div v-if="loadingTemplates" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                    v-for="i in 5"
                    :key="i"
                    class="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse"
                >
                    <div class="h-24 bg-gray-200"></div>
                    <div class="p-5">
                        <div class="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                        <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
                        <div class="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
                        <div class="flex gap-2 mb-4">
                            <div class="h-5 bg-gray-200 rounded-full w-12"></div>
                            <div class="h-5 bg-gray-200 rounded-full w-12"></div>
                            <div class="h-5 bg-gray-200 rounded-full w-12"></div>
                        </div>
                        <div class="h-10 bg-gray-200 rounded-lg"></div>
                    </div>
                </div>
            </div>

            <!-- Fetch error state -->
            <div v-else-if="fetchError" class="text-center py-16">
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-400 text-5xl mb-4" />
                <p class="text-lg font-semibold text-gray-700">Failed to load templates</p>
                <p class="text-sm text-red-500 mt-2 mb-4 font-mono">{{ fetchError }}</p>
                <button
                    class="inline-flex items-center px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white text-sm rounded-lg transition-colors"
                    @click="fetchTemplates"
                >
                    <font-awesome-icon :icon="['fas', 'rotate-right']" class="mr-2" />
                    Retry
                </button>
            </div>

            <!-- Template grid -->
            <div
                v-else-if="templates.length > 0"
                class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                <TemplateCard
                    v-for="template in templates"
                    :key="template.id"
                    :template="template"
                    :loading="cloningId === template.id"
                    @use="cloneTemplate"
                />
            </div>

            <!-- Empty state -->
            <div v-else class="text-center py-16">
                <font-awesome-icon :icon="['fas', 'layer-group']" class="text-gray-300 text-6xl mb-4" />
                <p class="text-lg font-semibold text-gray-600">No templates available</p>
                <p class="text-sm text-gray-400 mt-2 mb-4">
                    The template seed migration has not been run yet.
                </p>
                <div class="inline-block text-left bg-gray-50 border border-gray-200 rounded-lg px-5 py-4 text-sm font-mono text-gray-700">
                    cd backend<br>
                    npm run migration:run
                </div>
            </div>
        </tab-content-panel>
    </div>
</template>
