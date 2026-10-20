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

        // Marketing-first resolver: routing is driven by whether a paid media
        // plan exists and whether marketing channels are connected.
        //   no plan                  -> Plan builder (the on-ramp)
        //   plan, no connected data  -> Plan detail (the plan is the deliverable)
        //   plan + connected data    -> Intelligence Overview (the payoff screen)
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
        // Only marketing channels (ad platforms) count — engineering connectors
        // such as PDF/Postgres uploads must not flip the default destination.
        const hasMarketingChannel = (project?.marketing_channels_count ?? project?.data_sources_count ?? 0) > 0;

        if (planCount === 0 || !hasMarketingChannel) {
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
