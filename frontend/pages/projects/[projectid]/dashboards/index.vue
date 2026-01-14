<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDashboardsStore } from '~/stores/dashboards';
import { useSubscriptionStore } from '@/stores/subscription';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
const projectsStore = useProjectsStore();
const dashboardsStore = useDashboardsStore();
const subscriptionStore = useSubscriptionStore();
const { $swal } = useNuxtApp();
const route = useRoute();

// Get project ID from route
const projectId = parseInt(String(route.params.projectid));

// Get project permissions
const permissions = useProjectPermissions(projectId);

const state = reactive({
    loading: true,
    showTierLimitModal: false,
    tierLimitError: null,
});

const dashboards = computed(() => {
    const allDashboards = dashboardsStore.getDashboards();
    // Filter dashboards by project ID
    return allDashboards
        .filter((d) => {
            const dProjectId = d.project_id || d.project?.id;
            return dProjectId === projectId;
        })
        .map((dashboardObj) => ({
            id: dashboardObj.id,
            dashboard: dashboardObj.data,
            project_id: dashboardObj.project_id,
            user_id: dashboardObj.user_platform_id,
            needs_validation: dashboardObj.needs_validation || false,
        }));
});
const project = computed(() => {
    return projectsStore.getSelectedProject();
});

const dashboard = computed(() => {
    return dashboardsStore.getSelectedDashboard();
});

// Hide loading once data is available
onMounted(async () => {
    nextTick(() => {
        state.loading = false;
    });
    
    // Fetch usage stats and start auto-refresh
    try {
        await subscriptionStore.fetchUsageStats();
        subscriptionStore.startAutoRefresh();
    } catch (error) {
        console.error('Error fetching usage stats:', error);
    }
});

onUnmounted(() => {
    subscriptionStore.stopAutoRefresh();
});

async function deleteDashboard(dashboardId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the dashboard?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, delete it!",
    });
    if (!confirmDelete) {
        return;
    }

    const { execute } = useAuthenticatedMutation();
    const data = await execute(`/dashboard/delete/${dashboardId}`, {
        method: 'DELETE'
    });

    if (data) {
        $swal.fire(`The dashboard has been deleted successfully.`);
        await dashboardsStore.retrieveDashboards(); // Refresh dashboards list
    } else {
        $swal.fire(`There was an error deleting the dashboard.`);
    }
}

function checkDashboardLimit() {
    if (!subscriptionStore.canCreateDashboard) {
        state.showTierLimitModal = true;
        state.tierLimitError = {
            resource: 'dashboard',
            currentUsage: subscriptionStore.usageStats?.dashboardCount || 0,
            tierLimit: subscriptionStore.usageStats?.maxDashboards || 0,
            tierName: subscriptionStore.usageStats?.tier || 'FREE',
            upgradeTiers: [],
        };
        return false;
    }
    return true;
}
</script>
<template>
    <!-- Tier Limit Modal -->
    <TierLimitModal
        v-if="state.tierLimitError"
        :show="state.showTierLimitModal"
        :resource="state.tierLimitError.resource"
        :current-usage="state.tierLimitError.currentUsage"
        :tier-limit="state.tierLimitError.tierLimit"
        :tier-name="state.tierLimitError.tierName"
        :upgrade-tiers="state.tierLimitError.upgradeTiers"
        @close="state.showTierLimitModal = false"
    />
    
    <div class="flex flex-col">
        <tabs v-if="project && project.id" :project-id="project.id" />

        <!-- Dashboards Content -->
        <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
            <div class="flex justify-between items-center mb-5">
                <div class="font-bold text-2xl">
                    Dashboards
                </div>
                <!-- Usage Indicator -->
                <div v-if="subscriptionStore.usageStats" class="text-sm text-gray-600">
                    <span class="font-medium">{{ subscriptionStore.usageStats.dashboardCount }}</span>
                    <span v-if="subscriptionStore.usageStats.maxDashboards === -1">
                        / Unlimited
                    </span>
                    <span v-else>
                        / {{ subscriptionStore.usageStats.maxDashboards }}
                    </span>
                    <span class="ml-1">dashboards</span>
                    <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {{ subscriptionStore.usageStats.tier }}
                    </span>
                </div>
            </div>
            <div class="text-md">
                Dashboards are where you will be building your charts and visualizations based on your data models.
            </div>

            <!-- Skeleton loader for loading state -->
            <div v-if="state.loading"
                class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
                <div v-for="i in 6" :key="i" class="mt-10">
                    <div class="border border-primary-blue-100 border-solid p-6 shadow-md bg-white min-h-[180px]">
                        <div class="animate-pulse">
                            <div class="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                            <div class="space-y-2">
                                <div class="h-4 bg-gray-200 rounded w-full"></div>
                                <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                                <div class="h-4 bg-gray-200 rounded w-4/5"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Actual content -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
                <notched-card v-if="permissions.canCreate.value" class="justify-self-center mt-10">
                    <template #body="{ onClick }">
                        <NuxtLink 
                            v-if="subscriptionStore.canCreateDashboard"
                            :to="`/projects/${project.id}/dashboards/create`"
                        >
                            <div class="flex flex-col justify-center text-md font-bold cursor-pointer items-center">
                                <div
                                    class="bg-gray-300 border border-gray-300 border-solid rounded-full w-20 h-20 flex items-center justify-center mb-5">
                                    <font-awesome icon="fas fa-plus" class="text-4xl text-gray-500" />
                                </div>
                                Create Dashboard
                            </div>
                        </NuxtLink>
                        <div
                            v-else
                            @click="checkDashboardLimit"
                            class="flex flex-col justify-center text-md font-bold cursor-pointer items-center"
                        >
                            <div
                                class="bg-gray-300 border border-gray-300 border-solid rounded-full w-20 h-20 flex items-center justify-center mb-5">
                                <font-awesome icon="fas fa-plus" class="text-4xl text-gray-500" />
                            </div>
                            <div>Create Dashboard</div>
                            <div class="text-xs text-red-500 mt-1">Limit Reached</div>
                        </div>
                    </template>
                </notched-card>
                <div v-for="dashboard in dashboards" class="relative">
                    <notched-card class="justify-self-center mt-10">
                        <template #body="{ onClick }">
                            <!-- Validation Alert Badge -->
                            <div v-if="dashboard.needs_validation"
                                v-tippy="{ content: 'This dashboard uses data models that have been updated. Please review and update the dashboard.' }"
                                class="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-10">
                                <font-awesome icon="fas fa-exclamation-triangle" class="text-xs" />
                                Needs Update
                            </div>

                            <NuxtLink :to="`/projects/${project.id}/dashboards/${dashboard.id}`"
                                class="hover:text-gray-500 cursor-pointer">
                                <div class="flex flex-col justify-start h-full">
                                    <div class="text-md font-bold">
                                        Dashboard {{ dashboard.id }}
                                    </div>
                                </div>
                            </NuxtLink>
                        </template>
                    </notched-card>
                    <div v-if="permissions.canDelete.value" v-tippy="{ content: 'Delete Dashboard' }"
                        class="absolute top-5 -right-2 z-10 bg-red-500 hover:bg-red-700 border border-red-500 border-solid rounded-full w-10 h-10 flex items-center justify-center mb-5 cursor-pointer"
                        @click="deleteDashboard(dashboard.id)">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-white select-none" />
                    </div>
                </div>
            </div>
        </tab-content-panel>
    </div>
</template>
