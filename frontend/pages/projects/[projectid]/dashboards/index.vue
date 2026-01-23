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

            <!-- Create Button -->
            <div v-if="permissions.canCreate.value" class="mb-6 mt-6">
                <NuxtLink 
                    v-if="subscriptionStore.canCreateDashboard"
                    :to="`/projects/${project.id}/dashboards/create`"
                    class="inline-flex items-center px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors"
                >
                    <font-awesome icon="fas fa-plus" class="mr-2" />
                    Create Dashboard
                </NuxtLink>
                <button
                    v-else
                    @click="checkDashboardLimit"
                    class="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed"
                >
                    <font-awesome icon="fas fa-plus" class="mr-2" />
                    Create Dashboard
                    <span class="ml-2 text-xs text-red-500">Limit Reached</span>
                </button>
            </div>

            <!-- Skeleton loader for loading state -->
            <div v-if="state.loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div v-for="i in 6" :key="i" class="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
                    <div class="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div class="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div class="h-4 bg-gray-200 rounded w-full mt-6"></div>
                </div>
            </div>

            <!-- Cards Grid -->
            <div v-else-if="dashboards.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                    v-for="dashboard in dashboards" 
                    :key="dashboard.id"
                    class="relative bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg hover:border-primary-blue-100 transition-all duration-200"
                >
                    <!-- Validation Alert Badge -->
                    <div 
                        v-if="dashboard.needs_validation"
                        v-tippy="{ content: 'This dashboard uses data models that have been updated. Please review and update the dashboard.' }"
                        class="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-10"
                    >
                        <font-awesome icon="fas fa-exclamation-triangle" class="text-xs" />
                        Needs Update
                    </div>

                    <!-- Action Buttons (Top Right) -->
                    <div class="absolute top-4 right-4 flex space-x-2">
                        <!-- Delete Button -->
                        <button
                            v-if="permissions.canDelete.value"
                            @click="deleteDashboard(dashboard.id)"
                            class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            v-tippy="{ content: 'Delete Dashboard' }"
                        >
                            <font-awesome icon="fas fa-trash" />
                        </button>
                    </div>

                    <!-- Dashboard Info -->
                    <div class="space-y-4 pr-20">
                        <!-- Dashboard Name -->
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">
                                Dashboard {{ dashboard.id }}
                            </h3>
                        </div>

                        <!-- Dashboard Metadata (placeholder for future enhancements) -->
                        <div class="text-xs text-gray-500">
                            <font-awesome icon="far fa-chart-bar" class="mr-1" />
                            Interactive Dashboard
                        </div>
                    </div>

                    <!-- View Dashboard Button -->
                    <NuxtLink 
                        :to="`/projects/${project.id}/dashboards/${dashboard.id}`"
                        class="mt-4 w-full block text-center bg-primary-blue-300 hover:bg-primary-blue-100 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                        View Dashboard
                    </NuxtLink>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-12">
                <font-awesome icon="fas fa-chart-bar" class="text-gray-400 text-6xl mb-4" />
                <p class="text-xl font-semibold text-gray-900">No dashboards yet</p>
                <p class="text-sm text-gray-500 mt-2 mb-4">
                    Create your first dashboard to visualize your data
                </p>
                <NuxtLink 
                    v-if="permissions.canCreate.value && subscriptionStore.canCreateDashboard"
                    :to="`/projects/${project.id}/dashboards/create`"
                    class="inline-flex items-center px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors"
                >
                    <font-awesome icon="fas fa-plus" class="mr-2" />
                    Create Dashboard
                </NuxtLink>
                <button
                    v-else-if="permissions.canCreate.value"
                    @click="checkDashboardLimit"
                    class="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed"
                >
                    <font-awesome icon="fas fa-plus" class="mr-2" />
                    Create Dashboard
                    <span class="ml-2 text-xs text-red-500">Limit Reached</span>
                </button>
            </div>
        </tab-content-panel>
    </div>
</template>
