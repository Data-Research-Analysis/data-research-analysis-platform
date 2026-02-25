<script setup lang="ts">
import { useLoggedInUserStore } from '@/stores/logged_in_user';
import { useProjectsStore } from '@/stores/projects';

definePageMeta({ layout: 'marketing-project' });

const route = useRoute();
const router = useRouter();
const loggedInUserStore = useLoggedInUserStore();
const projectsStore = useProjectsStore();
const config = useRuntimeConfig();

const projectId = parseInt(String(route.params.projectid));

// Role-based routing — runs client-side only so SSR serves the Overview to crawlers
onMounted(async () => {
    try {
        const loggedInUser = loggedInUserStore.getLoggedInUser();
        if (!loggedInUser?.id) return;

        // Fetch the current user's project-member record to check marketing_role
        const member = await $fetch<{ marketing_role: string | null }>(
            `${config.public.apiBase}/projects/${projectId}/members/me`,
            { credentials: 'include' },
        ).catch(() => null);

        if (member?.marketing_role === 'manager') {
            return navigateTo(`/marketing-projects/${projectId}/campaigns`);
        } else if (member?.marketing_role === 'analyst' || !member?.marketing_role) {
            // analyst or no role — route to data sources
            return navigateTo(`/marketing-projects/${projectId}/data-sources`);
        }
        // 'cmo' stays on the Overview page
    } catch {
        // Silently fall through to Overview on any error
    }
});
</script>

<template>
    <div class="p-8 text-center text-gray-500">
        <font-awesome-icon :icon="['fas', 'chart-pie']" class="text-4xl mb-4 text-gray-400" />
        <h2 class="text-xl font-semibold text-gray-700">Marketing Overview</h2>
        <p class="text-sm mt-2 text-gray-400">
            Coming soon — campaign performance, KPIs, and AI insights will appear here.
        </p>
    </div>
</template>
