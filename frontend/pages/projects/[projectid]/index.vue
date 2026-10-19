<script setup lang="ts">
import { useLoggedInUserStore } from '@/stores/logged_in_user';
import { useProjectsStore } from '@/stores/projects';
import { getAuthToken } from '~/composables/AuthToken';

definePageMeta({ layout: 'project' });

const route = useRoute();
const loggedInUserStore = useLoggedInUserStore();
const projectsStore = useProjectsStore();
const config = useRuntimeConfig();

const projectId = parseInt(String(route.params.projectid));

onMounted(async () => {
    try {
        const loggedInUser = loggedInUserStore.getLoggedInUser();
        if (!loggedInUser?.id) return;

        // Resolve membership: role + marketing_role
        const response = await $fetch<{ success: boolean; data: { role: string; marketing_role: string | null } }>(
            `${config.public.apiBase}/project/${projectId}/members/me`,
            {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                },
            },
        ).catch(() => null);

        const member = response?.data ?? null;

        // Marketing-first resolver: a fresh project with no plans and no
        // connected marketing data lands in the Paid Media Loop.
        const plansResponse = await $fetch<{ success: boolean; data: unknown[] }>(
            `${config.public.apiBase}/plans?projectId=${projectId}`,
            {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                },
            },
        ).catch(() => null);

        const planCount = Array.isArray(plansResponse?.data) ? plansResponse.data.length : 0;
        const project = projectsStore.projects.find((p: any) => p.id === projectId);
        const hasMarketingSource = (project?.data_sources_count ?? 0) > 0;

        if (planCount === 0 && !hasMarketingSource) {
            return navigateTo(`/projects/${projectId}/plan`);
        }

        return navigateTo(`/projects/${projectId}/intelligence`);
    } catch {
        return navigateTo(`/projects/${projectId}/plan`);
    }
});
</script>

<template>
    <div class="flex items-center justify-center min-h-[60vh]">
        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-primary-blue-100" />
    </div>
</template>
