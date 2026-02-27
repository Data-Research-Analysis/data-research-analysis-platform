<script setup>

definePageMeta({ layout: 'marketing-project' });
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectsStore } from '@/stores/projects';
import { useDashboardsStore } from '~/stores/dashboards';
import { useSubscriptionStore } from '@/stores/subscription';
import { useLoggedInUserStore } from '@/stores/logged_in_user';
import { useGoogleAnalytics } from '@/composables/useGoogleAnalytics';
import { useGoogleAdManager } from '@/composables/useGoogleAdManager';
import { useGoogleAds } from '@/composables/useGoogleAds';
import { useMetaAds } from '@/composables/useMetaAds';
import { useLinkedInAds } from '@/composables/useLinkedInAds';
import { useHubSpot } from '@/composables/useHubSpot';
import { useKlaviyo } from '@/composables/useKlaviyo';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import { useTruncation } from '@/composables/useTruncation';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { DATA_SOURCE_CLASSIFICATIONS } from '@/utils/dataSourceClassifications';
import pdfImage from '/assets/images/pdf.png';
import excelImage from '/assets/images/excel.png';
import postgresqlImage from '/assets/images/postgresql.png';
import mysqlImage from '/assets/images/mysql.png';
import mariadbImage from '/assets/images/mariadb.png';
import googleAnalyticsImage from '/assets/images/google-analytics.png';
import googleAdManagerImage from '/assets/images/google-ad-manager.png';
import googleAdsImage from '/assets/images/google-ads.png';
import metaAdsImage from '/assets/images/meta.png';
import mongodbImage from '/assets/images/mongodb.png';
import linkedInAdsImage from '/assets/images/linkedin.png';
import hubspotImage from '/assets/images/hubspot.png';
import klaviyoImage from '/assets/images/klaviyo.png';

const dataSourceStore = useDataSourceStore();
const projectsStore = useProjectsStore();
const dashboardsStore = useDashboardsStore();
const subscriptionStore = useSubscriptionStore();
const loggedInUserStore = useLoggedInUserStore();
const analytics = useGoogleAnalytics();
const gam = useGoogleAdManager();
const ads = useGoogleAds();
const metaAds = useMetaAds();
const linkedInAds = useLinkedInAds();
const hubspot = useHubSpot();
const klaviyo = useKlaviyo();
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const { isTitleTruncated } = useTruncation();

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
    classificationFilter: null,
    showClassifyModal: false,
    classifyTargetId: null,
    classifyLoading: false,
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
                classification: dataSource.classification ?? null,
            }))
            .filter((ds) => {
                if (!state.classificationFilter) return true;
                return ds.classification === state.classificationFilter;
            });
    }),
    available_data_sources: [
        {
            name: 'Google Analytics',
            url: `${route.fullPath}/connect/google-analytics`,
            image_url: googleAnalyticsImage,
        },
        {
            name: 'Google Ad Manager',
            url: `${route.fullPath}/connect/google-ad-manager`,
            image_url: googleAdManagerImage,
        },
        {
            name: 'Google Ads',
            url: `${route.fullPath}/connect/google-ads`,
            image_url: googleAdsImage,
        },
        {
            name: 'Meta Ads',
            url: `${route.fullPath}/connect/meta-ads`,
            image_url: metaAdsImage,
            coming_soon: !FEATURE_FLAGS.META_ADS_ENABLED,
        },
        {
            name: 'LinkedIn Ads',
            url: `${route.fullPath}/connect/linkedin-ads`,
            image_url: linkedInAdsImage,
            coming_soon: !FEATURE_FLAGS.LINKEDIN_ADS_ENABLED,
        },
        {
            name: 'HubSpot CRM',
            url: `${route.fullPath}/connect/hubspot`,
            image_url: hubspotImage,
            coming_soon: !FEATURE_FLAGS.HUBSPOT_ENABLED,
        },
        {
            name: 'Klaviyo Email',
            url: `${route.fullPath}/connect/klaviyo`,
            image_url: klaviyoImage,
            coming_soon: !FEATURE_FLAGS.KLAVIYO_ENABLED,
        },
        {
            name: 'PDF',
            url: `${route.fullPath}/connect/pdf`,
            image_url: pdfImage,
        },
        {
            name: 'Excel File',
            url: `${route.fullPath}/connect/excel`,
            image_url: excelImage,
        },
        {
            name: 'PostgreSQL',
            url: `${route.fullPath}/connect/postgresql`,
            image_url: postgresqlImage,
        },
        {
            name: 'MySQL',
            url: `${route.fullPath}/connect/mysql`,
            image_url: mysqlImage,
        },
        {
            name: 'MariaDB',
            url: `${route.fullPath}/connect/mariadb`,
            image_url: mariadbImage,
        },
        {
            name: 'MongoDB',
            url: `${route.fullPath}/connect/mongodb`,
            image_url: mongodbImage,
        },
    ],
    selected_tab: 'data_sources',
});

const project = computed(() => {
    return projectsStore.getSelectedProject();
});

// Admin users bypass all feature flags and see full functionality.
const isAdmin = computed(() => {
    return loggedInUserStore.getLoggedInUser()?.user_type === 'admin';
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
    router.push(`/marketing-projects/${projectId}/data-sources/${dataSourceId}`);
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
        'excel': excelImage,
        'meta_ads': metaAdsImage,
        'linkedin_ads': linkedInAdsImage,
        'hubspot': hubspotImage,
        'klaviyo': klaviyoImage,
        'mongodb': mongodbImage
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
        const isMetaAds = dataSource?.data_type === 'meta_ads';
        const isLinkedInAds = dataSource?.data_type === 'linkedin_ads';
        const isHubSpot = dataSource?.data_type === 'hubspot';
        const isKlaviyo = dataSource?.data_type === 'klaviyo';
        const serviceName = isHubSpot ? 'HubSpot' : (isKlaviyo ? 'Klaviyo' : (isLinkedInAds ? 'LinkedIn Ads' : (isMetaAds ? 'Meta Ads' : (isAds ? 'Google Ads' : (isGAM ? 'Google Ad Manager' : 'Google Analytics')))));

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
        const success = isHubSpot ? await hubspot.syncNow(dataSourceId) : (isKlaviyo ? await klaviyo.syncNow(dataSourceId) : (isLinkedInAds ? await linkedInAds.syncNow(dataSourceId) : (isMetaAds ? await metaAds.syncNow(dataSourceId) : (isAds ? await ads.syncNow(dataSourceId) : (isGAM ? await gam.syncNow(dataSourceId) : await analytics.syncNow(dataSourceId))))));

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
        ds.data_type === 'google_analytics' || ds.data_type === 'google_ad_manager' || ds.data_type === 'google_ads' || ds.data_type === 'meta_ads' || ds.data_type === 'linkedin_ads' || ds.data_type === 'hubspot' || ds.data_type === 'klaviyo'
    );

    if (googleDataSources.length === 0) {
        await $swal.fire({
            title: 'No API Data Sources',
            text: 'There are no Google Analytics, Ad Manager, Ads, Meta Ads, LinkedIn Ads, HubSpot, or Klaviyo data sources to sync.',
            icon: 'info'
        });
        return;
    }

    const { value: confirm } = await $swal.fire({
        title: `Sync ${googleDataSources.length} Data Source${googleDataSources.length > 1 ? 's' : ''}?`,
        text: 'This will sync all API-connected data sources (Google Analytics, Ad Manager, Google Ads, Meta Ads, LinkedIn Ads, HubSpot, Klaviyo) in this project.',
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
        const isMetaAds = ds.data_type === 'meta_ads';
        const isLinkedInAds = ds.data_type === 'linkedin_ads';
        const isHubSpotDs = ds.data_type === 'hubspot';
        const isKlaviyoDs = ds.data_type === 'klaviyo';
        const success = isHubSpotDs ? await hubspot.syncNow(ds.id) : (isKlaviyoDs ? await klaviyo.syncNow(ds.id) : (isLinkedInAds ? await linkedInAds.syncNow(ds.id) : (isMetaAds ? await metaAds.syncNow(ds.id) : (isAds ? await ads.syncNow(ds.id) : (isGAM ? await gam.syncNow(ds.id) : await analytics.syncNow(ds.id))))));
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
    const isMetaAds = dataSource?.data_type === 'meta_ads';
    const isLinkedInAds = dataSource?.data_type === 'linkedin_ads';
    const isHubSpot = dataSource?.data_type === 'hubspot';
    const isKlaviyo = dataSource?.data_type === 'klaviyo';

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

        if (isKlaviyo) {
            const status = await klaviyo.getSyncStatus(dataSourceId);
            $swal.close();
            const history = (status?.syncHistory || []).map((s) => ({
                id: s.id || Math.random(),
                sync_started_at: s.startedAt || s.started_at,
                sync_completed_at: s.completedAt || s.completed_at || null,
                status: (s.status || 'pending').toLowerCase(),
                rows_synced: s.recordsSynced ?? s.records_synced ?? 0,
                error_message: s.errorMessage || s.error_message || null,
            }));
            if (history.length > 0) {
                state.sync_history = history;
                state.show_sync_history_dialog = true;
            } else {
                await $swal.fire({ title: 'No History', text: 'No sync history available yet.', icon: 'info' });
            }
            return;
        }

        if (isHubSpot) {
            const status = await hubspot.getSyncStatus(dataSourceId);
            $swal.close();
            const history = (status?.syncHistory || []).map((s) => ({
                id: s.id || Math.random(),
                sync_started_at: s.startedAt || s.started_at,
                sync_completed_at: s.completedAt || s.completed_at || null,
                status: (s.status || 'pending').toLowerCase(),
                rows_synced: s.recordsSynced ?? s.records_synced ?? 0,
                error_message: s.errorMessage || s.error_message || null,
            }));
            if (history.length > 0) {
                state.sync_history = history;
                state.show_sync_history_dialog = true;
            } else {
                await $swal.fire({ title: 'No History', text: 'No sync history available yet.', icon: 'info' });
            }
            return;
        }

        const status = isLinkedInAds ? await linkedInAds.getSyncStatus(dataSourceId) : (isMetaAds ? await metaAds.getSyncStatus(dataSourceId) : (isAds ? await ads.getSyncStatus(dataSourceId) : (isGAM ? await gam.getSyncStatus(dataSourceId) : await analytics.getSyncStatus(dataSourceId))));

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
    if (dataSource.data_type !== 'google_analytics' && dataSource.data_type !== 'google_ad_manager' && dataSource.data_type !== 'google_ads' && dataSource.data_type !== 'meta_ads' && dataSource.data_type !== 'linkedin_ads' && dataSource.data_type !== 'hubspot' && dataSource.data_type !== 'klaviyo') return null;
    const lastSync = dataSource.connection_details?.api_connection_details?.api_config?.last_sync;
    const isGAM = dataSource.data_type === 'google_ad_manager';
    const isAds = dataSource.data_type === 'google_ads';
    const isMeta = dataSource.data_type === 'meta_ads';
    const isLinkedIn = dataSource.data_type === 'linkedin_ads';
    const isHubSpot = dataSource.data_type === 'hubspot';
    const isKlaviyo = dataSource.data_type === 'klaviyo';
    return lastSync ? (isHubSpot ? hubspot.formatSyncTime(lastSync) : (isKlaviyo ? klaviyo.formatSyncTime(lastSync) : (isLinkedIn ? linkedInAds.formatSyncTime(lastSync) : (isMeta ? metaAds.formatSyncTime(lastSync) : (isAds ? ads.formatSyncTime(lastSync) : (isGAM ? gam.formatSyncTime(lastSync) : analytics.formatSyncTime(lastSync))))))) : 'Never';
}

/**
 * Get sync frequency text
 */
function getSyncFrequency(dataSource) {
    if (dataSource.data_type !== 'google_analytics' && dataSource.data_type !== 'google_ad_manager' && dataSource.data_type !== 'google_ads' && dataSource.data_type !== 'meta_ads' && dataSource.data_type !== 'linkedin_ads' && dataSource.data_type !== 'hubspot' && dataSource.data_type !== 'klaviyo') return null;
    const frequency = dataSource.connection_details?.api_connection_details?.api_config?.sync_frequency || 'manual';
    const isGAM = dataSource.data_type === 'google_ad_manager';
    const isMeta = dataSource.data_type === 'meta_ads';
    const isAds = dataSource.data_type === 'google_ads';
    const isLinkedIn = dataSource.data_type === 'linkedin_ads';
    const isHubSpot = dataSource.data_type === 'hubspot';
    const isKlaviyo = dataSource.data_type === 'klaviyo';
    return (isAds || isMeta || isLinkedIn || isHubSpot || isKlaviyo) ? 'Manual' : (isGAM ? gam.getSyncFrequencyText(frequency) : analytics.getSyncFrequencyText(frequency));
}

/**
 * Check if data source was recently synced (within 24 hours)
 */
function isRecentlySynced(dataSource) {
    if (dataSource.data_type !== 'google_analytics' && dataSource.data_type !== 'google_ad_manager' && dataSource.data_type !== 'google_ads' && dataSource.data_type !== 'meta_ads' && dataSource.data_type !== 'linkedin_ads' && dataSource.data_type !== 'hubspot' && dataSource.data_type !== 'klaviyo') return false;
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

/**
 * Open classification modal for a specific (unclassified) data source
 */
function openClassifyModal(dataSourceId) {
    if (import.meta.client) {
        state.classifyTargetId = dataSourceId;
        state.showClassifyModal = true;
    }
}

/**
 * Save classification for an existing data source via the API
 */
async function saveClassification(classification) {
    if (!state.classifyTargetId) return;
    state.classifyLoading = true;
    const config = useRuntimeConfig();
    const token = getAuthToken();
    try {
        await $fetch(`${config.public.apiBase}/data-source/${state.classifyTargetId}/classification`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: { classification },
        });
        await dataSourceStore.retrieveDataSources();
        state.showClassifyModal = false;
        state.classifyTargetId = null;
    } catch (error) {
        $swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update classification.' });
    } finally {
        state.classifyLoading = false;
    }
}
</script>
<template>
    <div class="flex flex-col">

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
            <div v-if="!state.loading && state.data_sources.length > 0" class="mb-6 bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-2 lg:flex lg:flex-row lg:items-center lg:gap-6 gap-4">
                <div class="flex items-center gap-2">
                    <font-awesome icon="fas fa-database" class="text-primary-blue-100 text-xl shrink-0" />
                    <span class="text-2xl font-bold text-gray-900">{{ state.data_sources.length }}</span>
                    <span class="text-gray-600 text-sm">Connected Source{{ state.data_sources.length !== 1 ? 's' : '' }}</span>
                </div>
                <div class="hidden lg:block h-8 w-px bg-gray-300"></div>
                <div class="flex items-center gap-2">
                    <font-awesome icon="fas fa-chart-bar" class="text-green-600 text-xl shrink-0" />
                    <span class="text-2xl font-bold text-gray-900">
                        {{ state.data_sources.reduce((sum, ds) => sum + ds.dataModels, 0) }}
                    </span>
                    <span class="text-gray-600 text-sm">Total Models</span>
                </div>
                <div class="hidden lg:block h-8 w-px bg-gray-300"></div>
                <div class="flex items-center gap-2">
                    <font-awesome icon="fas fa-chart-line" class="text-purple-600 text-xl shrink-0" />
                    <span class="text-2xl font-bold text-gray-900">{{ dashboardCount }}</span>
                    <span class="text-gray-600 text-sm">Dashboard{{ dashboardCount !== 1 ? 's' : '' }}</span>
                </div>
                <div class="hidden lg:block h-8 w-px bg-gray-300"></div>
                <div class="flex items-center gap-2">
                    <font-awesome icon="fas fa-check-circle" class="text-green-600 text-xl shrink-0" />
                    <span class="text-2xl font-bold text-gray-900">
                        {{ state.data_sources.filter(ds => isRecentlySynced(ds)).length }}
                    </span>
                    <span class="text-gray-600 text-sm">Synced</span>
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

            <!-- Bulk Sync Button for API Data Sources -->
            <div v-if="!state.loading && permissions.canUpdate.value && state.data_sources.some(ds => ds.data_type === 'google_analytics' || ds.data_type === 'google_ad_manager' || ds.data_type === 'google_ads' || ds.data_type === 'meta_ads' || ds.data_type === 'linkedin_ads' || ds.data_type === 'hubspot' || ds.data_type === 'klaviyo')"
                class="mt-5 mb-2">
                <button @click="bulkSyncAllGoogleDataSources"
                    class="px-4 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 rounded-lg transition-colors duration-200 flex items-center gap-2 cursor-pointer">
                    <font-awesome icon="fas fa-sync" />
                    Sync All API Data Sources
                </button>
            </div>

            <!-- Actual content -->
            <div v-if="!state.loading">
                <!-- Header Section with Button -->
                <div class="flex flex-wrap items-center gap-3 mb-4">
                    <button
                        v-if="permissions.canCreate.value && state.data_sources.length"
                        @click="openDialog"
                        class="px-6 py-3 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 inline-flex items-center gap-2 cursor-pointer">
                        <font-awesome icon="fas fa-plus" />
                        Connect Data Source
                    </button>

                    <!-- Classification filter -->
                    <div v-if="state.data_sources.length || state.classificationFilter" class="flex items-center gap-2">
                        <label class="text-sm text-gray-600 whitespace-nowrap">Filter by type:</label>
                        <select
                            v-model="state.classificationFilter"
                            class="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent cursor-pointer"
                        >
                            <option :value="null">All classifications</option>
                            <option :value="''">Unclassified</option>
                            <option
                                v-for="c in DATA_SOURCE_CLASSIFICATIONS"
                                :key="c.value"
                                :value="c.value"
                            >{{ c.label }}</option>
                        </select>
                    </div>
                </div>

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
                        class="relative border border-gray-200 rounded-lg p-6 bg-white shadow-sm hover:shadow-lg hover:border-primary-blue-100 transition-all duration-200 group flex flex-col">
                        
                        <!-- Clickable area -->
                        <div class="cursor-pointer flex flex-col flex-1" @click="goToDataSource(dataSource.id)">
                            <!-- Header -->
                            <div class="flex items-start gap-4 mb-4">
                                <img 
                                    :src="getDataSourceImage(dataSource.data_type)" 
                                    :alt="dataSource.data_type"
                                    class="h-12 w-12 object-contain" />
                                <div class="flex-1 min-w-0">
                                    <h3 
                                        :ref="`dataSourceTitle-${dataSource.id}`"
                                        :data-source-title="dataSource.id"
                                        class="w-4/5 text-lg font-semibold text-gray-900 break-words"
                                        v-tippy="isTitleTruncated(dataSource.id, 'data-source-title') ? { content: dataSource.name } : undefined"
                                    >
                                        {{ dataSource.name }}
                                    </h3>
                                    <p class="text-sm text-gray-500 capitalize">
                                        {{ dataSource.data_type.replace('_', ' ') }}
                                    </p>
                                    <!-- Classification badge -->
                                    <div class="mt-2 flex items-center gap-2 flex-wrap">
                                        <classification-badge :classification="dataSource.classification" />
                                        <button
                                            v-if="!dataSource.classification && permissions.canUpdate.value"
                                            @click.stop="openClassifyModal(dataSource.id)"
                                            class="inline-flex items-center gap-1 text-xs text-primary-blue-100 hover:text-primary-blue-300 hover:underline cursor-pointer"
                                            v-tippy="{ content: 'Add a classification for this data source' }"
                                        >
                                            <font-awesome-icon :icon="['fas', 'tag']" class="text-[10px]" />
                                            Classify
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Sync Status (for API-connected sources) -->
                            <div v-if="['google_analytics', 'google_ad_manager', 'google_ads', 'meta_ads', 'linkedin_ads', 'hubspot', 'klaviyo'].includes(dataSource.data_type)"
                                class="mb-4">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-sm text-gray-600">Status</span>
                                    <span 
                                        class="inline-flex items-center gap-1 px-2 py-1 mr-10 rounded text-xs font-medium"
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
                                class="mt-auto w-full px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 hover:text-white transition-all duration-200 flex items-center justify-center gap-2 group-hover:bg-primary-blue-300 group-hover:text-white cursor-pointer">
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
                                :to="`/marketing-projects/${project.id}/data-sources/${dataSource.id}`"
                                @click.stop
                                class="bg-blue-500 hover:bg-blue-600 border border-blue-500 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors z-10"
                                v-tippy="{ content: 'Edit Data Source' }">
                                <font-awesome icon="fas fa-pen" class="text-sm text-white" />
                            </NuxtLink>

                            <!-- Sync Button (for API-connected sources) -->
                            <button
                                v-if="permissions.canUpdate.value && ['google_analytics', 'google_ad_manager', 'google_ads', 'meta_ads', 'linkedin_ads', 'hubspot', 'klaviyo'].includes(dataSource.data_type)"
                                @click.stop="syncDataSource(dataSource.id)"
                                :disabled="state.syncing[dataSource.id]"
                                class="bg-primary-blue-100 hover:bg-primary-blue-300 border border-primary-blue-100 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors z-10"
                                v-tippy="{ content: state.syncing[dataSource.id] ? 'Syncing...' : 'Sync Now' }">
                                <font-awesome 
                                    :icon="state.syncing[dataSource.id] ? 'fas fa-spinner' : 'fas fa-sync'"
                                    :class="{ 'fa-spin': state.syncing[dataSource.id] }" 
                                    class="text-sm text-white" />
                            </button>

                            <!-- Sync History Button (for API-connected sources) -->
                            <button
                                v-if="['google_analytics', 'google_ad_manager', 'google_ads', 'meta_ads', 'linkedin_ads', 'hubspot', 'klaviyo'].includes(dataSource.data_type)"
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
                    <div class="max-h-[calc(80vh-120px)] overflow-y-auto">
                        <h2 class="text-2xl font-bold mb-6 text-gray-900">Connect Data Source</h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            <template v-for="dataSource in state.available_data_sources" :key="dataSource.name">
                                <!-- Coming Soon: shown to non-admin users when the integration is under review -->
                                <div v-if="dataSource.coming_soon && !isAdmin"
                                    class="relative w-full border border-gray-200 border-solid p-10 font-bold text-center shadow-md select-none opacity-60 cursor-not-allowed"
                                    :title="`${dataSource.name} is under review and will be available soon`">
                                    <div class="flex flex-col">
                                        <img :src="dataSource.image_url" :alt="dataSource.name"
                                            class="mx-auto mb-3 h-[100px] grayscale" />
                                        {{ dataSource.name }}
                                        <span class="mt-2 inline-block mx-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                                            Coming Soon
                                        </span>
                                    </div>
                                </div>
                                <!-- Normal: fully clickable card -->
                                <NuxtLink v-else :to="dataSource.url"
                                    class="w-full border border-primary-blue-100 border-solid p-10 font-bold text-center hover:bg-gray-200 shadow-md cursor-pointer select-none">
                                    <div class="flex flex-col">
                                        <img :src="dataSource.image_url" :alt="dataSource.name"
                                            class="mx-auto mb-3 h-[100px]" />
                                        {{ dataSource.name }}
                                    </div>
                                </NuxtLink>
                            </template>
                        </div>
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

    <!-- Re-classify existing data source modal -->
    <data-source-classification-modal
        v-if="state.showClassifyModal"
        v-model="state.showClassifyModal"
        confirm-label="Save Classification"
        :loading="state.classifyLoading"
        @confirm="saveClassification"
        @cancel="state.classifyTargetId = null"
    />
</template>
