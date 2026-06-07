<script setup lang="ts">
import { useLoggedInUserStore } from '@/stores/logged_in_user';
import { getAuthToken } from '~/composables/AuthToken';

definePageMeta({ layout: 'project' });

const route = useRoute();
const loggedInUserStore = useLoggedInUserStore();
const config = useRuntimeConfig();

const projectId = parseInt(String(route.params.projectid));

onMounted(async () => {
    try {
        const loggedInUser = loggedInUserStore.getLoggedInUser();
        if (!loggedInUser?.id) return;

        // Fetch the current user's project-member record to check marketing_role
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

        if (member?.marketing_role === 'manager') {
            return navigateTo(`/projects/${projectId}/campaigns`);
        } else if (member?.marketing_role === 'cmo') {
            return navigateTo(`/projects/${projectId}/marketing`);
        } else {
            // analyst or no role — route to data sources
            return navigateTo(`/projects/${projectId}/data-sources`);
        }
    } catch {
        return navigateTo(`/projects/${projectId}/data-sources`);
    }
});
</script>

<template>
    <div class="flex items-center justify-center min-h-[60vh]">
        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-primary-blue-100" />
    </div>
</template>
