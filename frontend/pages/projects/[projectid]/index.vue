<script setup>
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectsStore } from '@/stores/projects';
import { useDashboardsStore } from '~/stores/dashboards';
import { useSubscriptionStore } from '@/stores/subscription';
import { useGoogleAnalytics } from '@/composables/useGoogleAnalytics';
import { useGoogleAdManager } from '@/composables/useGoogleAdManager';
import { useGoogleAds } from '@/composables/useGoogleAds';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import pdfImage from '/assets/images/pdf.png';
import excelImage from '/assets/images/excel.png';
import postgresqlImage from '/assets/images/postgresql.png';
import mysqlImage from '/assets/images/mysql.png';
import mariadbImage from '/assets/images/mariadb.png';
import googleAnalyticsImage from '/assets/images/google-analytics.png';
import googleAdManagerImage from '/assets/images/google-ad-manager.png';
import googleAdsImage from '/assets/images/google-ads.png';

const dataSourceStore = useDataSourceStore();
const projectsStore = useProjectsStore();
const dashboardsStore = useDashboardsStore();
const subscriptionStore = useSubscriptionStore();
const analytics = useGoogleAnalytics();
const gam = useGoogleAdManager();
const ads = useGoogleAds();
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();

// Get project ID from route
const projectId = parseInt(String(route.params.projectid));

// Get project permissions
const permissions = useProjectPermissions(projectId);

// Debug logging for permissions
if (import.meta.client) {
    // Log project data when it changes
    watch(() => projectsStore.projects, (projects) => {
        const currentProject = projects.find(p => p.id === projectId);
        console.log('📦 Projects Store Updated:', {
            totalProjects: projects.length,
            currentProjectId: projectId,
            currentProject: currentProject,
            user_role: currentProject?.user_role,
            is_owner: currentProject?.is_owner
        });
    }, { immediate: true, deep: true });
    
    // Log permission values when they change
    watch([permissions.canCreate, permissions.canUpdate, permissions.canDelete, permissions.role], () => {
        console.log('🔐 Data Sources Permissions Check:', {
            projectId: projectId,
            canCreate: permissions.canCreate.value,
            canUpdate: permissions.canUpdate.value,
            canDelete: permissions.canDelete.value,
            role: permissions.role.value,
            isViewer: permissions.isViewer.value
        });
    }, { immediate: true });
}

const dashboardCount = computed(() => {
    const allDashboards = dashboardsStore.getDashboards();
    return allDashboards.filter((d) => {
        const dProjectId = d.project_id || d.project?.id;
        return dProjectId === projectId;
    }).length;
});

const state = reactive({
    show_dialog: false,
    show_sync_history_dialog: false,
    selected_data_source_for_history: null,
    syncing: {},
    sync_history: [],
    loading: true,
    showTierLimitModal: false,
    tierLimitError: null,
    data_sources: computed(() => {
        const allDataSources = dataSourceStore.getDataSources();
        // Filter data sources by project ID
        return allDataSources
            .filter((ds) => {
                const dsProjectId = ds.project_id || ds.project?.id;
                return dsProjectId === projectId;
            })
            .map((dataSource) => ({
                id: dataSource.id,
                name: dataSource.name,
                data_type: dataSource.data_type,
                connection_details: dataSource.connection_details,
                user_id: dataSource.user_platform_id,
                project_id: dataSource.project_id,
                dataModels: dataSource.DataModels?.length || 0,
            }));
    }),
    available_data_sources: [
        {
            name: 'Google Analytics',
            url: `${route.fullPath}/data-sources/connect/google-analytics`,
            image_url: googleAnalyticsImage,
        },
        {
            name: 'Google Ad Manager',
            url: `${route.fullPath}/data-sources/connect/google-ad-manager`,
            image_url: googleAdManagerImage,
        },
        {
            name: 'Google Ads',
            url: `${route.fullPath}/data-sources/connect/google-ads`,
            image_url: googleAdsImage, // Reusing GAM image for now
        },
        {
            name: 'PDF',
            url: `${route.fullPath}/data-sources/connect/pdf`,
            image_url: pdfImage,
        },
        {
            name: 'Excel File',
            url: `${route.fullPath}/data-sources/connect/excel`,
            image_url: excelImage,
        },
        {
            name: 'PostgreSQL',
            url: `${route.fullPath}/data-sources/connect/postgresql`,
            image_url: postgresqlImage,
        },
        {
            name: 'MySQL',
            url: `${route.fullPath}/data-sources/connect/mysql`,
            image_url: mysqlImage,
        },
        {
            name: 'MariaDB',
            url: `${route.fullPath}/data-sources/connect/mariadb`,
            image_url: mariadbImage,
        },
    ],
    selected_tab: 'data_sources',
});

const project = computed(() => {
    return projectsStore.getSelectedProject();
});

function openDialog() {
    state.show_dialog = true;
}

function closeDialog() {
    state.show_dialog = false;
}

async function deleteDataSource(dataSourceId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the data source?",
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
    const data = await execute(`/data-source/delete/${dataSourceId}`, {
        method: 'DELETE'
    });

    if (data) {
        $swal.fire(`The data source has been deleted successfully.`);
        await dataSourceStore.retrieveDataSources(); // Refresh data sources list
    } else {
        $swal.fire(`There was an error deleting the data source.`);
    }
}

async function setSelectedDataSource(dataSourceId) {
    const dataSource = state.data_sources.find((dataSource) => dataSource.id === dataSourceId);
    dataSourceStore.setSelectedDataSource(dataSource);
}

/**
 * Navigate to data source detail page
 */
function goToDataSource(dataSourceId) {
    router.push(`/projects/${projectId}/data-sources/${dataSourceId}`);
}

/**
 * Get data source image by type
 */
function getDataSourceImage(dataType) {
    const images = {
        'google_analytics': googleAnalyticsImage,
        'google_ad_manager': googleAdManagerImage,
        'google_ads': googleAdsImage,
        'postgresql': postgresqlImage,
        'mysql': mysqlImage,
        'mariadb': mariadbImage,
        'pdf': pdfImage,
        'excel': excelImage
    };
    return images[dataType] || postgresqlImage;
}

/**
 * Sync a single Google Analytics or Google Ad Manager data source
 */
async function syncDataSource(dataSourceId) {
    try {
        state.syncing[dataSourceId] = true;

        const dataSource = state.data_sources.find(ds => ds.id === dataSourceId);
        const isGAM = dataSource?.data_type === 'google_ad_manager';
        const isAds = dataSource?.data_type === 'google_ads';
        const serviceName = isAds ? 'Google Ads' : (isGAM ? 'Google Ad Manager' : 'Google Analytics');

        $swal.fire({
            title: 'Syncing...',
            text: `Fetching latest data from ${serviceName}`,
            icon: 'info',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                $swal.showLoading();
            }
        });

        console.log('Starting sync for data source ID:', dataSourceId);
        const success = isAds ? await ads.syncNow(dataSourceId) : (isGAM ? await gam.syncNow(dataSourceId) : await analytics.syncNow(dataSourceId));

        if (success) {
            await $swal.fire({
                title: 'Sync Complete!',
                text: `${serviceName} data has been updated`,
                icon: 'success',
                timer: 2000
            });

            // Refresh data sources to show updated last_sync timestamp
            await dataSourceStore.retrieveDataSources();
        } else {
            await $swal.fire({
                title: 'Sync Failed',
                text: `Could not sync ${serviceName} data. Please try again.`,
                icon: 'error'
            });
        }
    } catch (error) {
        await $swal.fire({
            title: 'Error',
            text: 'An error occurred during sync',
            icon: 'error'
        });
    } finally {
        state.syncing[dataSourceId] = false;
    }
}

/**
 * Bulk sync all Google Analytics and Google Ad Manager data sources in project
 */
async function bulkSyncAllGoogleDataSources() {
    const googleDataSources = state.data_sources.filter(ds =>
        ds.data_type === 'google_analytics' || ds.data_type === 'google_ad_manager' || ds.data_type === 'google_ads'
    );

    if (googleDataSources.length === 0) {
        await $swal.fire({
            title: 'No Google Data Sources',
            text: 'There are no Google Analytics or Ad Manager data sources to sync.',
            icon: 'info'
        });
        return;
    }

    const { value: confirm } = await $swal.fire({
        title: `Sync ${googleDataSources.length} Data Source${googleDataSources.length > 1 ? 's' : ''}?`,
        text: 'This will sync all Google Analytics, Ad Manager, and Ads data sources in this project.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Sync All',
        cancelButtonText: 'Cancel'
    });

    if (!confirm) return;

    await $swal.fire({
        title: 'Syncing...',
        html: `Syncing 0 of ${googleDataSources.length} data sources...`,
        icon: 'info',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            $swal.showLoading();
        }
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < googleDataSources.length; i++) {
        const ds = googleDataSources[i];
        $swal.update({
            html: `Syncing ${i + 1} of ${googleDataSources.length} data sources...<br><small>${ds.name}</small>`
        });

        const isGAM = ds.data_type === 'google_ad_manager';
        const isAds = ds.data_type === 'google_ads';
        const success = isAds ? await ads.syncNow(ds.id) : (isGAM ? await gam.syncNow(ds.id) : await analytics.syncNow(ds.id));
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    await dataSourceStore.retrieveDataSources();

    await $swal.fire({
        title: 'Bulk Sync Complete',
        html: `<div>✅ Successful: ${successCount}</div><div>❌ Failed: ${failCount}</div>`,
        icon: successCount > 0 && failCount === 0 ? 'success' : 'warning'
    });
}

/**
 * View sync history for a data source
 */
async function viewSyncHistory(dataSourceId) {
    state.selected_data_source_for_history = dataSourceId;

    const dataSource = state.data_sources.find(ds => ds.id === dataSourceId);
    const isGAM = dataSource?.data_type === 'google_ad_manager';
    const isAds = dataSource?.data_type === 'google_ads';

    try {
        // Show loading
        $swal.fire({
            title: 'Loading...',
            text: 'Fetching sync history',
            icon: 'info',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                $swal.showLoading();
            }
        });

        const status = isAds ? await ads.getSyncStatus(dataSourceId) : (isGAM ? await gam.getSyncStatus(dataSourceId) : await analytics.getSyncStatus(dataSourceId));

        $swal.close();

        if (status && status.sync_history) {
            state.sync_history = status.sync_history;
            state.show_sync_history_dialog = true;
        } else {
            await $swal.fire({
                title: 'No History',
                text: 'No sync history available for this data source.',
                icon: 'info'
            });
        }
    } catch (error) {
        console.error('Failed to fetch sync history:', error);
        $swal.close(); // Close loading if open
        await $swal.fire({
            title: 'Error',
            text: 'Failed to fetch sync history. Please try again.',
            icon: 'error'
        });
    }
}

/**
 * Close sync history dialog
 */
function closeSyncHistoryDialog() {
    state.show_sync_history_dialog = false;
    state.selected_data_source_for_history = null;
    state.sync_history = [];
}

/**
 * Get last sync time formatted
 */
function getLastSyncTime(dataSource) {
    if (dataSource.data_type !== 'google_analytics' && dataSource.data_type !== 'google_ad_manager' && dataSource.data_type !== 'google_ads') return null;
    const lastSync = dataSource.connection_details?.api_connection_details?.api_config?.last_sync;
    const isGAM = dataSource.data_type === 'google_ad_manager';
    const isAds = dataSource.data_type === 'google_ads';
    return lastSync ? (isAds ? ads.formatSyncTime(lastSync) : (isGAM ? gam.formatSyncTime(lastSync) : analytics.formatSyncTime(lastSync))) : 'Never';
}

/**
 * Get sync frequency text
 */
function getSyncFrequency(dataSource) {
    if (dataSource.data_type !== 'google_analytics' && dataSource.data_type !== 'google_ad_manager' && dataSource.data_type !== 'google_ads') return null;
    const frequency = dataSource.connection_details?.api_connection_details?.api_config?.sync_frequency || 'manual';
    const isGAM = dataSource.data_type === 'google_ad_manager';
    const isAds = dataSource.data_type === 'google_ads';
    return isAds ? 'Manual' : (isGAM ? gam.getSyncFrequencyText(frequency) : analytics.getSyncFrequencyText(frequency));
}

/**
 * Check if data source was recently synced (within 24 hours)
 */
function isRecentlySynced(dataSource) {
    if (dataSource.data_type !== 'google_analytics' && dataSource.data_type !== 'google_ad_manager' && dataSource.data_type !== 'google_ads') return false;
    const lastSync = dataSource.connection_details?.api_connection_details?.api_config?.last_sync;
    if (!lastSync) return false;
    const diffHours = (new Date().getTime() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
}

/**
 * Format date for sync history
 */
function formatSyncDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Hide loading once data is available
onMounted(async () => {
    // Fetch usage stats for tier enforcement display
    await subscriptionStore.fetchUsageStats();
    
    nextTick(() => {
        state.loading = false;
    });
});
</script>
<template>
    <div class="flex flex-col">
        <tabs v-if="project && project.id" :project-id="project.id" />

        <!-- Data Sources Content -->
        <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
            <div class="flex justify-between items-center mb-5">
                <div class="font-bold text-2xl">
                    Data Sources
                </div>
                <!-- Usage Indicator -->
                <div v-if="subscriptionStore.usageStats" class="text-sm text-gray-600">
                    <span class="font-medium">{{ state.data_sources.length }}</span>
                    <span v-if="subscriptionStore.usageStats.maxDataSources === -1">
                        / Unlimited
                    </span>
                    <span v-else>
                        / {{ subscriptionStore.usageStats.maxDataSources }}
                    </span>
                    <span class="ml-1">data sources per project</span>
                    <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {{ subscriptionStore.usageStats.tier }}
                    </span>
                </div>
            </div>
            <!-- Stats Bar -->
            <div v-if="!state.loading && state.data_sources.length > 0" class="mb-6 bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-6">
                <div class="flex items-center gap-2">
                    <font-awesome icon="fas fa-database" class="text-primary-blue-100 text-xl" />
                    <span class="text-2xl font-bold text-gray-900">{{ state.data_sources.length }}</span>
                    <span class="text-gray-600">Connected Source{{ state.data_sources.length !== 1 ? 's' : '' }}</span>
                </div>
                <div class="h-8 w-px bg-gray-300"></div>
                <div class="flex items-center gap-2">
                    <font-awesome icon="fas fa-chart-bar" class="text-green-600 text-xl" />
                    <span class="text-2xl font-bold text-gray-900">
                        {{ state.data_sources.reduce((sum, ds) => sum + ds.dataModels, 0) }}
                    </span>
                    <span class="text-gray-600">Total Models</span>
                </div>
                <div class="h-8 w-px bg-gray-300"></div>
                <div class="flex items-center gap-2">
                    <font-awesome icon="fas fa-chart-line" class="text-purple-600 text-xl" />
                    <span class="text-2xl font-bold text-gray-900">{{ dashboardCount }}</span>
                    <span class="text-gray-600">Dashboard{{ dashboardCount !== 1 ? 's' : '' }}</span>
                </div>
                <div class="h-8 w-px bg-gray-300"></div>
                <div class="flex items-center gap-2">
                    <font-awesome icon="fas fa-check-circle" class="text-green-600 text-xl" />
                    <span class="text-2xl font-bold text-gray-900">
                        {{ state.data_sources.filter(ds => isRecentlySynced(ds)).length }}
                    </span>
                    <span class="text-gray-600">Synced</span>
                </div>
            </div>

            <div class="text-md mb-4">
                Data sources are the basic entity that you provide. A data source can range from a simple excel file to
                a PostgresSQL. This is the data that you provide which you will then work with in order to reach your
                analysis goals.
            </div>
            <!-- Skeleton loader for loading state -->
            <div v-if="state.loading"
                class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
                <div v-for="i in 6" :key="i" class="mt-10">
                    <div class="border border-primary-blue-100 border-solid p-6 shadow-md bg-white min-h-[180px] rounded-lg">
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

            <!-- Bulk Sync Button for Google Data Sources -->
            <div v-if="!state.loading && permissions.canUpdate.value && state.data_sources.some(ds => ds.data_type === 'google_analytics' || ds.data_type === 'google_ad_manager' || ds.data_type === 'google_ads')"
                class="mt-5 mb-2">
                <button @click="bulkSyncAllGoogleDataSources"
                    class="px-4 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 rounded-lg transition-colors duration-200 flex items-center gap-2 cursor-pointer">
                    <font-awesome icon="fas fa-sync" />
                    {{
                        state.data_sources.some(ds => ds.data_type === 'google_analytics') && state.data_sources.some(ds =>
                            ds.data_type === 'google_ad_manager')
                            ? 'Sync All Google Data Sources'
                            : state.data_sources.some(ds => ds.data_type === 'google_analytics')
                                ? 'Sync All Google Analytics Data Sources'
                                : 'Sync All Google Ad Manager Data Sources'
                    }}
                </button>
            </div>

            <!-- Actual content -->
            <div v-if="!state.loading">
                <!-- Header Section with Button -->
                <button
                    v-if="permissions.canCreate.value && state.data_sources.length"
                    @click="openDialog"
                    class="px-6 py-3 mb-4 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 inline-flex items-center gap-2 cursor-pointer">
                    <font-awesome icon="fas fa-plus" />
                    Connect Data Source
                </button>

                <!-- Empty State -->
                <div v-if="!state.data_sources || state.data_sources.length === 0"
                    class="text-center py-16 bg-white border border-gray-200 rounded-lg">
                    <font-awesome icon="fas fa-database" class="text-6xl text-gray-300 mb-4" />
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">No Data Sources Yet</h3>
                    <p class="text-gray-600 mb-6">
                        Connect your first data source to start building data models and dashboards
                    </p>
                    <button
                        v-if="permissions.canCreate.value"
                        @click="openDialog"
                        class="px-6 py-3 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 inline-flex items-center gap-2 cursor-pointer">
                        <font-awesome icon="fas fa-plus" />
                        Connect Data Source
                    </button>
                </div>

                <!-- Data Source Cards -->
                <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div
                        v-for="dataSource in state.data_sources"
                        :key="dataSource.id"
                        class="relative border border-gray-200 rounded-lg p-6 bg-white shadow-sm hover:shadow-lg hover:border-primary-blue-100 transition-all duration-200 group">
                        
                        <!-- Clickable area -->
                        <div class="cursor-pointer" @click="goToDataSource(dataSource.id)">
                            <!-- Header -->
                            <div class="flex items-start gap-4 mb-4">
                                <img 
                                    :src="getDataSourceImage(dataSource.data_type)" 
                                    :alt="dataSource.data_type"
                                    class="h-12 w-12 object-contain" />
                                <div class="flex-1 min-w-0">
                                    <h3 class="text-lg font-semibold text-gray-900 truncate">
                                        {{ dataSource.name }}
                                    </h3>
                                    <p class="text-sm text-gray-500 capitalize">
                                        {{ dataSource.data_type.replace('_', ' ') }}
                                    </p>
                                </div>
                            </div>

                            <!-- Sync Status (for Google sources) -->
                            <div v-if="['google_analytics', 'google_ad_manager', 'google_ads'].includes(dataSource.data_type)"
                                class="mb-4">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-sm text-gray-600">Status</span>
                                    <span 
                                        class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                                        :class="{
                                            'bg-green-100 text-green-700': isRecentlySynced(dataSource),
                                            'bg-yellow-100 text-yellow-700': !isRecentlySynced(dataSource)
                                        }">
                                        <font-awesome 
                                            :icon="isRecentlySynced(dataSource) ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'"
                                            class="text-[10px]" />
                                        {{ isRecentlySynced(dataSource) ? 'Up to date' : 'Needs sync' }}
                                    </span>
                                </div>
                                <div class="text-xs text-gray-500 mb-1">
                                    <font-awesome icon="fas fa-clock" class="mr-1" />
                                    Last synced: {{ getLastSyncTime(dataSource) }}
                                </div>
                                <div class="text-xs text-gray-500">
                                    <font-awesome icon="fas fa-calendar-alt" class="mr-1" />
                                    Frequency: {{ getSyncFrequency(dataSource) }}
                                </div>
                            </div>

                            <!-- Models Count -->
                            <div class="flex items-center justify-between mb-4">
                                <span class="text-sm text-gray-600">Data Models</span>
                                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {{ dataSource.dataModels }} Model{{ dataSource.dataModels !== 1 ? 's' : '' }}
                                </span>
                            </div>

                            <!-- Action Button -->
                            <button
                                @click.stop="goToDataSource(dataSource.id)"
                                class="w-full px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 hover:text-white transition-all duration-200 flex items-center justify-center gap-2 group-hover:bg-primary-blue-300 group-hover:text-white cursor-pointer">
                                <font-awesome icon="fas fa-arrow-right" />
                                View Details
                            </button>
                        </div>

                        <!-- Action Buttons (positioned absolutely) -->
                        <div class="absolute top-4 right-4 flex flex-col gap-2">
                            <!-- Delete Button -->
                            <button
                                v-if="permissions.canDelete.value"
                                @click.stop="deleteDataSource(dataSource.id)"
                                class="bg-red-500 hover:bg-red-700 border border-red-500 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors z-10"
                                v-tippy="{ content: 'Delete Data Source' }">
                                <font-awesome icon="fas fa-xmark" class="text-sm text-white" />
                            </button>

                            <!-- Edit Button (for database sources) -->
                            <NuxtLink
                                v-if="permissions.canUpdate.value && ['postgresql', 'mysql', 'mariadb'].includes(dataSource.data_type)"
                                :to="`/projects/${project.id}/data-sources/${dataSource.id}`"
                                @click.stop
                                class="bg-blue-500 hover:bg-blue-600 border border-blue-500 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors z-10"
                                v-tippy="{ content: 'Edit Data Source' }">
                                <font-awesome icon="fas fa-pen" class="text-sm text-white" />
                            </NuxtLink>

                            <!-- Sync Button (for Google sources) -->
                            <button
                                v-if="permissions.canUpdate.value && ['google_analytics', 'google_ad_manager', 'google_ads'].includes(dataSource.data_type)"
                                @click.stop="syncDataSource(dataSource.id)"
                                :disabled="state.syncing[dataSource.id]"
                                class="bg-primary-blue-100 hover:bg-primary-blue-300 border border-primary-blue-100 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors z-10"
                                v-tippy="{ content: state.syncing[dataSource.id] ? 'Syncing...' : 'Sync Now' }">
                                <font-awesome 
                                    :icon="state.syncing[dataSource.id] ? 'fas fa-spinner' : 'fas fa-sync'"
                                    :class="{ 'fa-spin': state.syncing[dataSource.id] }" 
                                    class="text-sm text-white" />
                            </button>

                            <!-- Sync History Button (for Google sources) -->
                            <button
                                v-if="['google_analytics', 'google_ad_manager', 'google_ads'].includes(dataSource.data_type)"
                                @click.stop="viewSyncHistory(dataSource.id)"
                                class="bg-gray-500 hover:bg-gray-600 border border-gray-500 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors z-10"
                                v-tippy="{ content: 'View Sync History' }">
                                <font-awesome icon="fas fa-history" class="text-sm text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Connect Data Source Dialog -->
            <overlay-dialog v-if="state.show_dialog" @close="closeDialog" :yOffset="90" :enable-scrolling="false">
                <template #overlay>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <template v-for="dataSource in state.available_data_sources" :key="dataSource.name">
                            <NuxtLink :to="dataSource.url"
                                class="w-full border border-primary-blue-100 border-solid p-10 font-bold text-center hover:bg-gray-200 shadow-md cursor-pointer select-none">
                                <div class="flex flex-col">
                                    <img :src="dataSource.image_url" :alt="dataSource.name"
                                        class="mx-auto mb-3 h-[100px]" />
                                    {{ dataSource.name }}
                                </div>
                            </NuxtLink>
                        </template>
                    </div>
                </template>
            </overlay-dialog>

            <!-- Sync History Dialog -->
            <overlay-dialog v-if="state.show_sync_history_dialog" @close="closeSyncHistoryDialog" :yOffset="90" :enable-scrolling="false"    >
                <template #overlay>
                    <div class="max-w-4xl w-full p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold text-gray-900">Sync History</h2>
                            <button @click="closeSyncHistoryDialog"
                                class="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                                <font-awesome icon="fas fa-times" class="text-xl" />
                            </button>
                        </div>

                        <div v-if="state.sync_history.length === 0" class="text-center py-12 text-gray-500">
                            <font-awesome icon="fas fa-history" class="text-4xl mb-3" />
                            <p>No sync history available</p>
                        </div>

                        <div v-else class="overflow-x-auto rounded-lg overflow-hidden ring-1 ring-gray-200 ring-inset">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th
                                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th
                                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th
                                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Duration
                                        </th>
                                        <th
                                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Rows Synced
                                        </th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    <tr v-for="sync in state.sync_history" :key="sync.id" class="hover:bg-gray-50">
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {{ formatSyncDate(sync.sync_completed_at) }}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <span
                                                class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                                                :class="{
                                                    'bg-green-100 text-green-700': sync.status === 'success',
                                                    'bg-red-100 text-red-700': sync.status === 'failed',
                                                    'bg-yellow-100 text-yellow-700': sync.status === 'pending'
                                                }">
                                                <font-awesome
                                                    :icon="sync.status === 'success' ? 'fas fa-check-circle' : sync.status === 'failed' ? 'fas fa-times-circle' : 'fas fa-clock'"
                                                    class="text-[10px]" />
                                                {{ sync.status }}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {{ Math.round((new Date(sync.sync_completed_at).getTime() - new
                                                Date(sync.sync_started_at).getTime()) / 1000) }}s
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {{ sync.rows_synced || '-' }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="mt-6 flex justify-end">
                            <button @click="closeSyncHistoryDialog"
                                class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200">
                                Close
                            </button>
                        </div>
                    </div>
                </template>
            </overlay-dialog>
        </tab-content-panel>
    </div>
</template>
