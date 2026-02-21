<script setup lang="ts">
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectsStore } from '@/stores/projects';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import { useGoogleAnalytics } from '@/composables/useGoogleAnalytics';
import { useGoogleAdManager } from '@/composables/useGoogleAdManager';
import { useGoogleAds } from '@/composables/useGoogleAds';
import { useReCaptcha } from "vue-recaptcha-v3";
import googleAnalyticsImage from '/assets/images/google-analytics.png';
import googleAdManagerImage from '/assets/images/google-ad-manager.png';
import googleAdsImage from '/assets/images/google-ads.png';
import postgresqlImage from '/assets/images/postgresql.png';
import mysqlImage from '/assets/images/mysql.png';
import mariadbImage from '/assets/images/mariadb.png';
import pdfImage from '/assets/images/pdf.png';
import excelImage from '/assets/images/excel.png';
import metaImage from '/assets/images/meta.png';
import mongodbImage from '/assets/images/mongodb.png';

const dataSourceStore = useDataSourceStore();
const projectsStore = useProjectsStore();
const analytics = useGoogleAnalytics();
const gam = useGoogleAdManager();
const ads = useGoogleAds();
const recaptcha = useReCaptcha();
const nuxtApp = useNuxtApp();
const $swal = nuxtApp.$swal as any;
const route = useRoute();
const router = useRouter();

// Get IDs from route
const projectId = parseInt(String(route.params.projectid));
const dataSourceId = parseInt(String(route.params.datasourceid));

// Get project permissions
const permissions = useProjectPermissions(projectId);

const state = reactive({
    loading: true,
    syncing: false,
    loadingSyncHistory: false,
    sync_history: [] as any[],
    show_schedule_modal: false,
    dataSource: null as any | null,
    // Edit form fields
    showEditForm: false,
    host: '',
    port: '',
    schema: '',
    database_name: '',
    username: '',
    password: '',
    host_error: false,
    port_error: false,
    schema_error: false,
    database_name_error: false,
    username_error: false,
    password_error: false,
    formLoading: false,
    showAlert: false,
    errorMessages: [] as string[],
    connectionSuccess: false,
    showPassword: false,
    // Schedule form fields
    scheduleFormLoading: false,
    sync_enabled: true,
    sync_schedule: 'manual',
    sync_schedule_time: '02:00',
});

// Get real-time sync status from store
const realtimeSyncStatus = computed(() => {
    return dataSourceStore.getSyncStatus(dataSourceId);
});

// Get data source icon
function getDataSourceIcon(dataType: string) {
    const icons: Record<string, string> = {
        'google_analytics': googleAnalyticsImage,
        'google_ad_manager': googleAdManagerImage,
        'google_ads': googleAdsImage,
        'postgresql': postgresqlImage,
        'mysql': mysqlImage,
        'mariadb': mariadbImage,
        'excel': excelImage,
        'pdf': pdfImage,
        'meta': metaImage,
        'mongodb': mongodbImage
    };
    return icons[dataType] || postgresqlImage;
}

// Get sync status
function getSyncStatus() {
    if (!state.dataSource) return { status: 'idle', text: 'Idle', color: 'gray' };
    if (!['google_analytics', 'google_ad_manager', 'google_ads'].includes(state.dataSource.data_type)) {
        return { status: 'n/a', text: 'Not applicable', color: 'gray' };
    }

    // Check real-time status from store first
    if (realtimeSyncStatus.value.status === 'syncing' || state.syncing) {
        return { status: 'syncing', text: 'Syncing...', color: 'blue' };
    }

    const lastSync = state.dataSource.connection_details?.api_connection_details?.api_config?.last_sync;
    
    if (!lastSync) {
        return { status: 'never', text: 'Never synced', color: 'yellow' };
    }

    const diffHours = (new Date().getTime() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) {
        return { status: 'up-to-date', text: 'Up to date', color: 'green' };
    } else if (diffHours < 48) {
        return { status: 'stale', text: 'Needs sync', color: 'yellow' };
    } else {
        return { status: 'very-stale', text: 'Outdated', color: 'red' };
    }
}

// Get last sync time formatted
function getLastSyncTime() {
    if (!state.dataSource) return 'Never';
    const lastSync = state.dataSource.connection_details?.api_connection_details?.api_config?.last_sync;
    if (!lastSync) return 'Never';
    
    const now = new Date();
    const syncDate = new Date(lastSync);
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
}

// Get sync frequency
function getSyncFrequency() {
    if (!state.dataSource) return 'Manual';
    const frequency = state.dataSource.sync_schedule || 'manual';
    const frequencyMap: Record<string, string> = {
        'manual': 'Manual',
        'hourly': 'Hourly',
        'daily': 'Daily',
        'weekly': 'Weekly',
        'monthly': 'Monthly'
    };
    return frequencyMap[frequency] || 'Manual';
}

// Trigger manual sync
async function triggerSync() {
    if (!state.dataSource) return;
    
    state.syncing = true;

    try {
        const isGAM = state.dataSource.data_type === 'google_ad_manager';
        const isAds = state.dataSource.data_type === 'google_ads';
        const serviceName = isAds ? 'Google Ads' : (isGAM ? 'Google Ad Manager' : 'Google Analytics');

        const success = isAds 
            ? await ads.syncNow(dataSourceId) 
            : (isGAM ? await gam.syncNow(dataSourceId) : await analytics.syncNow(dataSourceId));

        if (success) {
            await $swal.fire({
                title: 'Sync Started!',
                text: `${serviceName} sync has been initiated`,
                icon: 'success',
                timer: 2000
            });

            // Refresh data source
            await loadDataSource();
            await loadSyncHistory();
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
        state.syncing = false;
    }
}

// Load sync history
async function loadSyncHistory() {
    if (!state.dataSource) return;
    if (!['google_analytics', 'google_ad_manager', 'google_ads'].includes(state.dataSource.data_type)) return;

    state.loadingSyncHistory = true;

    try {
        const isGAM = state.dataSource.data_type === 'google_ad_manager';
        const isAds = state.dataSource.data_type === 'google_ads';

        const status = isAds 
            ? await ads.getSyncStatus(dataSourceId) 
            : (isGAM ? await gam.getSyncStatus(dataSourceId) : await analytics.getSyncStatus(dataSourceId));

        if (status && 'sync_history' in status && status.sync_history) {
            state.sync_history = status.sync_history;
        } else {
            state.sync_history = [];
        }
    } catch (error) {
        console.error('Failed to fetch sync history:', error);
        state.sync_history = [];
    } finally {
        state.loadingSyncHistory = false;
    }
}

// Format sync date
function formatSyncDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Calculate sync duration
function getSyncDuration(sync: any) {
    if (!sync.sync_completed_at || !sync.sync_started_at) return '-';
    const duration = (new Date(sync.sync_completed_at).getTime() - new Date(sync.sync_started_at).getTime()) / 1000;
    if (duration < 60) {
        return `${Math.round(duration)}s`;
    } else {
        return `${Math.round(duration / 60)}m ${Math.round(duration % 60)}s`;
    }
}

// Delete data source
async function deleteDataSource() {
    const { value: confirm } = await $swal.fire({
        title: 'Delete Data Source?',
        text: `This will permanently delete "${state.dataSource?.name}" and all associated data models. This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#ef4444'
    });

    if (!confirm) return;

    try {
        // TODO: Implement delete data source API call
        await $swal.fire({
            title: 'Deleted!',
            text: 'Data source has been deleted',
            icon: 'success',
            timer: 2000
        });

        // Navigate back to project page
        router.push(`/projects/${projectId}`);
    } catch (error) {
        await $swal.fire({
            title: 'Error',
            text: 'Failed to delete data source',
            icon: 'error'
        });
    }
}

// Toggle edit form
function toggleEditForm() {
    if (!state.dataSource) return;
    
    state.showEditForm = !state.showEditForm;
    
    // Pre-populate form when opening
    if (state.showEditForm && state.dataSource.connection_details) {
        state.host = state.dataSource.connection_details.host || '';
        state.port = state.dataSource.connection_details.port?.toString() || '';
        state.schema = state.dataSource.connection_details.schema || '';
        state.database_name = state.dataSource.connection_details.database || '';
        state.username = state.dataSource.connection_details.username || '';
        state.password = '';
    }
}

// Validate form fields
function validateFields() {
    state.errorMessages = [];
    state.host_error = !validate(state.host, "", [validateRequired]);
    state.port_error = !validate(state.port, "", [validateRequired]);
    state.schema_error = !validate(state.schema, "", [validateRequired]);
    state.database_name_error = !validate(state.database_name, "", [validateRequired]);
    state.username_error = !validate(state.username, "", [validateRequired]);
    state.password_error = !validate(state.password, "", [validateRequired]);
    
    if (state.host_error) state.errorMessages.push("Please enter a valid host.");
    if (state.port_error) state.errorMessages.push("Please enter a valid port.");
    if (state.schema_error) state.errorMessages.push("Please enter a valid schema.");
    if (state.database_name_error) state.errorMessages.push("Please enter a valid database name.");
    if (state.username_error) state.errorMessages.push("Please enter a valid username.");
    if (state.password_error) state.errorMessages.push("Please enter a valid password.");
}

// Test connection
async function testConnection() {
    if (!['postgresql', 'mysql', 'mariadb'].includes(state.dataSource?.data_type)) return;
    
    state.formLoading = true;
    state.showAlert = false;
    state.errorMessages = [];
    validateFields();
    
    if (state.host_error || state.port_error || state.database_name_error || state.username_error || state.password_error) {
        state.showAlert = true;
        state.formLoading = false;
        return;
    }
    
    const recaptchaToken = recaptcha ? await getRecaptchaToken(recaptcha, 'dataSourceEditForm') : null;
    const token = getAuthToken();
    
    if (recaptchaToken) {
        try {
            await $fetch(`${baseUrl()}/data-source/test-connection`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {
                    data_source_type: state.dataSource.data_type,
                    host: state.host,
                    port: state.port,
                    schema: state.schema,
                    database_name: state.database_name,
                    username: state.username,
                    password: state.password,
                },
            });
            
            state.connectionSuccess = true;
            state.errorMessages.push("Connection successful!");
        } catch (error: any) {
            state.connectionSuccess = false;
            state.errorMessages.push(error.data?.message || 'Connection test failed.');
        }
        state.showAlert = true;
    }
    state.formLoading = false;
}

// Update data source
async function updateDataSource() {
    if (!['postgresql', 'mysql', 'mariadb'].includes(state.dataSource?.data_type)) return;
    
    state.formLoading = true;
    state.showAlert = false;
    state.errorMessages = [];
    validateFields();
    
    if (state.host_error || state.port_error || state.database_name_error || state.username_error || state.password_error) {
        state.showAlert = true;
        state.formLoading = false;
        return;
    }
    
    const recaptchaToken = recaptcha ? await getRecaptchaToken(recaptcha, 'dataSourceEditForm') : null;
    const token = getAuthToken();
    
    if (recaptchaToken) {
        try {
            const data = await $fetch<{ message: string }>(`${baseUrl()}/data-source/update-data-source/${dataSourceId}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {
                    data_source_type: state.dataSource.data_type,
                    host: state.host,
                    port: state.port,
                    schema: state.schema,
                    database_name: state.database_name,
                    username: state.username,
                    password: state.password,
                }
            });
            
            state.connectionSuccess = true;
            state.errorMessages.push(data.message);
            await dataSourceStore.retrieveDataSources();
            await loadDataSource();
            state.showAlert = true;
            state.formLoading = false;
            
            // Close form after 2 seconds
            setTimeout(() => {
                state.showEditForm = false;
                state.showAlert = false;
            }, 2000);
        } catch (error: any) {
            state.connectionSuccess = false;
            state.errorMessages.push(error.data?.message || 'Failed to update data source');
            state.showAlert = true;
            state.formLoading = false;
        }
    } else {
        state.formLoading = false;
    }
}

// Open schedule modal
function openScheduleModal() {
    // Pre-populate with current settings
    if (state.dataSource) {
        state.sync_enabled = state.dataSource.sync_enabled ?? true;
        state.sync_schedule = state.dataSource.sync_schedule || 'manual';
        state.sync_schedule_time = state.dataSource.sync_schedule_time || '02:00';
    }
    state.show_schedule_modal = true;
}

// Close schedule modal
function closeScheduleModal() {
    state.show_schedule_modal = false;
    state.scheduleFormLoading = false;
}

// Save schedule configuration
async function saveScheduleConfiguration() {
    if (!state.dataSource) return;

    state.scheduleFormLoading = true;

    try {
        const token = getAuthToken();
        await $fetch(`${baseUrl()}/data-source/${dataSourceId}/schedule`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: {
                sync_enabled: state.sync_enabled,
                sync_schedule: state.sync_schedule,
                sync_schedule_time: state.sync_schedule === 'manual' ? null : state.sync_schedule_time
            }
        });

        await $swal.fire({
            title: 'Success',
            text: 'Schedule configuration updated successfully',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
        
        // Reload data source to get updated values
        await dataSourceStore.retrieveDataSources();
        await loadDataSource();
        closeScheduleModal();
    } catch (error) {
        console.error('Failed to update schedule:', error);
        await $swal.fire({
            title: 'Error',
            text: 'An error occurred while updating the schedule',
            icon: 'error'
        });
    } finally {
        state.scheduleFormLoading = false;
    }
}

// Navigate to data models
function goToDataModels() {
    router.push(`/projects/${projectId}/data-sources/${dataSourceId}/data-models`);
}

// Load data source
async function loadDataSource() {
    try {
        await dataSourceStore.retrieveDataSources();
        const allDataSources = dataSourceStore.getDataSources();
        state.dataSource = allDataSources.find((ds: any) => ds.id === dataSourceId);
        
        if (!state.dataSource) {
            throw new Error('Data source not found');
        }
        
        // Validate that data source belongs to the project in the URL
        const dsProjectId = state.dataSource.project_id || state.dataSource.project?.id;
        if (dsProjectId !== projectId) {
            console.error(`Data source ${dataSourceId} belongs to project ${dsProjectId}, not ${projectId}`);
            throw new Error('Data source does not belong to this project');
        }
    } catch (error) {
        console.error('Failed to load data source:', error);
        await $swal.fire({
            title: 'Error',
            text: 'Data source not found or you do not have access to it',
            icon: 'error'
        });
        router.push(`/projects/${projectId}`);
    }
}

// Load on mount
onMounted(async () => {
    try {
        state.loading = true;
        await loadDataSource();
        
        // Load sync history for Google sources
        if (state.dataSource && ['google_analytics', 'google_ad_manager', 'google_ads'].includes(state.dataSource.data_type)) {
            await loadSyncHistory();
        }
    } catch (error) {
        // Error already handled in loadDataSource(), just keep loading true to prevent error template flash
        console.error('Mount error:', error);
        return;
    } finally {
        state.loading = false;
    }
});
</script>

<template>
    <!-- Main Content -->
    <div class="w-full mt-5 p-5" v-if="!state.loading && state.dataSource">
        <!-- Header -->
        <div class="flex items-start justify-between mb-8">
            <div class="flex items-center gap-4">
                <img 
                    :src="getDataSourceIcon(state.dataSource.data_type)" 
                    :alt="state.dataSource.data_type"
                    class="h-16 w-16 object-contain" />
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">{{ state.dataSource.name }}</h1>
                    <p class="text-gray-600 capitalize mt-1">
                        {{ state.dataSource.data_type.replace('_', ' ') }}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button
                    v-if="permissions.canUpdate.value && ['google_analytics', 'google_ad_manager', 'google_ads'].includes(state.dataSource.data_type)"
                    @click="openScheduleModal"
                    class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2 cursor-pointer">
                    <font-awesome icon="fas fa-calendar" />
                    Schedule
                </button>
                <button
                    v-if="permissions.canDelete.value"
                    @click="deleteDataSource"
                    class="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200 flex items-center gap-2 cursor-pointer">
                    <font-awesome icon="fas fa-trash" />
                    Delete
                </button>
            </div>
        </div>

        <!-- Sync Controls (Google sources only) -->
        <div v-if="['google_analytics', 'google_ad_manager', 'google_ads'].includes(state.dataSource.data_type)"
            class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Sync Controls</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Current Status -->
                <div>
                    <h3 class="text-sm font-medium text-gray-700 mb-3">Current Status</h3>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <SyncStatusBadge :status="getSyncStatus().status as any" />
                        </div>
                        
                        <!-- Progress bar when syncing -->
                        <div v-if="realtimeSyncStatus.status === 'syncing' && realtimeSyncStatus.progress > 0">
                            <SyncProgressBar 
                                :progress="realtimeSyncStatus.progress" 
                                label="Sync Progress" 
                                color="blue" />
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Last Synced</span>
                            <span class="text-sm text-gray-900 font-medium">{{ getLastSyncTime() }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Frequency</span>
                            <span class="text-sm text-gray-900 font-medium">{{ getSyncFrequency() }}</span>
                        </div>
                    </div>
                </div>

                <!-- Sync Actions -->
                <div>
                    <h3 class="text-sm font-medium text-gray-700 mb-3">Actions</h3>
                    <div class="space-y-3">
                        <button
                            v-if="permissions.canUpdate.value"
                            @click="triggerSync"
                            :disabled="state.syncing"
                            class="w-full px-4 py-3 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                            <font-awesome :icon="state.syncing ? 'fas fa-spinner fa-spin' : 'fas fa-sync'" />
                            {{ state.syncing ? 'Syncing...' : 'Sync Now' }}
                        </button>
                        <button
                            @click="goToDataModels"
                            class="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer">
                            <font-awesome icon="fas fa-table" />
                            View Data Models ({{ state.dataSource.DataModels?.length || 0 }})
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Non-Google source actions -->
        <div v-else class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Data Models</h2>
            <p class="text-gray-600 mb-4">
                View and manage data models created from this data source.
            </p>
            <button
                @click="goToDataModels"
                class="px-6 py-3 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 flex items-center gap-2 cursor-pointer">
                <font-awesome icon="fas fa-table" />
                View Data Models ({{ state.dataSource.DataModels?.length || 0 }})
            </button>
        </div>

        <!-- Sync History (Google sources only) -->
        <div v-if="['google_analytics', 'google_ad_manager', 'google_ads'].includes(state.dataSource.data_type)"
            class="bg-white border border-gray-200 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Sync History</h2>

            <SyncHistoryTable 
                :sync-history="state.sync_history" 
                :loading="state.loadingSyncHistory"
                :max-rows="20" />
        </div>

        <!-- Connection Settings (for database sources) -->
        <div v-if="['postgresql', 'mysql', 'mariadb'].includes(state.dataSource.data_type)"
            class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-semibold text-gray-900">Connection Settings</h2>
                <button
                    v-if="permissions.canUpdate.value"
                    @click="toggleEditForm"
                    class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 flex items-center gap-2 cursor-pointer">
                    <font-awesome :icon="state.showEditForm ? 'fas fa-times' : 'fas fa-edit'" />
                    {{ state.showEditForm ? 'Cancel' : 'Edit Connection' }}
                </button>
            </div>

            <!-- View Mode -->
            <div v-if="!state.showEditForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-600">Host</label>
                    <p class="text-sm text-gray-900 mt-1">{{ state.dataSource.connection_details?.host || 'N/A' }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600">Port</label>
                    <p class="text-sm text-gray-900 mt-1">{{ state.dataSource.connection_details?.port || 'N/A' }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600">Schema</label>
                    <p class="text-sm text-gray-900 mt-1">{{ state.dataSource.connection_details?.schema || 'N/A' }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600">Database</label>
                    <p class="text-sm text-gray-900 mt-1">{{ state.dataSource.connection_details?.database || 'N/A' }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600">Username</label>
                    <p class="text-sm text-gray-900 mt-1">{{ state.dataSource.connection_details?.username || 'N/A' }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600">Password</label>
                    <p class="text-sm text-gray-900 mt-1">••••••••</p>
                </div>
            </div>

            <!-- Edit Mode -->
            <div v-else>
                <div v-if="state.showAlert"
                    class="p-4 mb-4 rounded-lg"
                    :class="{ 'bg-green-100 text-green-800': state.connectionSuccess, 'bg-red-100 text-red-800': !state.connectionSuccess }">
                    <div class="font-semibold mb-1">{{ state.connectionSuccess ? 'Success!' : 'Error!' }}</div>
                    <div v-for="message in state.errorMessages" :key="message" class="text-sm">
                        {{ message }}
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Host</label>
                        <input
                            v-model="state.host"
                            type="text"
                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                            :class="state.host_error ? 'border-red-500 bg-red-50' : ''"
                            placeholder="Enter host address"
                            :disabled="state.formLoading" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Port</label>
                        <input
                            v-model="state.port"
                            type="text"
                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                            :class="state.port_error ? 'border-red-500 bg-red-50' : ''"
                            placeholder="Enter port number"
                            :disabled="state.formLoading" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Schema</label>
                        <input
                            v-model="state.schema"
                            type="text"
                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                            :class="state.schema_error ? 'border-red-500 bg-red-50' : ''"
                            placeholder="Enter schema name"
                            :disabled="state.formLoading" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Database Name</label>
                        <input
                            v-model="state.database_name"
                            type="text"
                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                            :class="state.database_name_error ? 'border-red-500 bg-red-50' : ''"
                            placeholder="Enter database name"
                            :disabled="state.formLoading" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Username</label>
                        <input
                            v-model="state.username"
                            type="text"
                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                            :class="state.username_error ? 'border-red-500 bg-red-50' : ''"
                            placeholder="Enter username"
                            :disabled="state.formLoading" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <div class="relative">
                            <input
                                v-model="state.password"
                                :type="state.showPassword ? 'text' : 'password'"
                                class="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                                :class="state.password_error ? 'border-red-500 bg-red-50' : ''"
                                placeholder="Enter password (required to update)"
                                :disabled="state.formLoading" />
                            <button
                                type="button"
                                @click="state.showPassword = !state.showPassword"
                                class="absolute right-3 top-3 text-gray-600 hover:text-gray-800"
                                :disabled="state.formLoading">
                                <font-awesome :icon="state.showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'" class="cursor-pointer" />
                            </button>
                        </div>
                    </div>
                </div>

                <div class="flex gap-3">
                    <button
                        @click="testConnection"
                        :disabled="state.formLoading"
                        class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                        Test Connection
                    </button>
                    <button
                        @click="updateDataSource"
                        :disabled="state.formLoading"
                        class="px-6 py-3 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                        Update Connection
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Loading State -->
    <div v-else-if="state.loading" class="w-full">
        <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
        </div>
    </div>
    
    <!-- Error State -->
    <div v-else class="w-full">
        <div class="text-center py-12">
            <font-awesome icon="fas fa-exclamation-triangle" class="text-red-500 text-6xl mb-4" />
            <p class="text-xl font-semibold text-gray-900">Data Source Not Found</p>
            <p class="text-gray-600 mt-2">The data source you're looking for doesn't exist or you don't have access to it.</p>
            <NuxtLink :to="`/projects/${projectId}`" class="inline-block mt-4 px-6 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 cursor-pointer">
                Back to Project
            </NuxtLink>
        </div>
    </div>

    <!-- Schedule Modal -->
    <overlay-dialog v-if="state.show_schedule_modal" @close="closeScheduleModal" :yOffset="90" :enable-scrolling="false">
        <template #overlay>
            <div class="w-full p-6 bg-white rounded-lg">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">Configure Sync Schedule</h2>
                </div>

                <div class="space-y-6">
                    <!-- Enable/Disable Sync -->
                    <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <label class="text-sm font-medium text-gray-900">Enable Automatic Sync</label>
                            <p class="text-sm text-gray-600 mt-1">Turn on automatic synchronization for this data source</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" v-model="state.sync_enabled" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <!-- Schedule Frequency -->
                    <div>
                        <label class="block text-sm font-medium text-gray-900 mb-2">Sync Frequency</label>
                        <select v-model="state.sync_schedule" 
                            :disabled="!state.sync_enabled"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed">
                            <option value="manual">Manual (no automatic sync)</option>
                            <option value="hourly">Every Hour</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-2">Choose how often the data source should automatically sync</p>
                    </div>

                    <!-- Schedule Time (only for daily/weekly/monthly) -->
                    <div v-if="['daily', 'weekly', 'monthly'].includes(state.sync_schedule)">
                        <label class="block text-sm font-medium text-gray-900 mb-2">Sync Time (UTC)</label>
                        <input type="time" v-model="state.sync_schedule_time"
                            :disabled="!state.sync_enabled"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" />
                        <p class="text-xs text-gray-500 mt-2">All times are in UTC timezone</p>
                    </div>

                    <!-- Info Box -->
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div class="flex gap-3">
                            <font-awesome icon="fas fa-info-circle" class="text-blue-600 mt-0.5" />
                            <div class="text-sm text-blue-900">
                                <p class="font-medium mb-1">Automatic Sync Information</p>
                                <ul class="list-disc list-inside space-y-1 text-blue-800">
                                    <li><strong>Hourly:</strong> Syncs at the top of every hour</li>
                                    <li><strong>Daily:</strong> Syncs once per day at the specified time</li>
                                    <li><strong>Weekly:</strong> Syncs once per week on the same day at the specified time</li>
                                    <li><strong>Monthly:</strong> Syncs once per month on the same date at the specified time</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-6">
                    <button @click="closeScheduleModal"
                        :disabled="state.scheduleFormLoading"
                        class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                        Cancel
                    </button>
                    <button @click="saveScheduleConfiguration"
                        :disabled="state.scheduleFormLoading"
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        <font-awesome v-if="state.scheduleFormLoading" icon="fas fa-spinner" spin />
                        <span>{{ state.scheduleFormLoading ? 'Saving...' : 'Save Configuration' }}</span>
                    </button>
                </div>
            </div>
        </template>
    </overlay-dialog>
</template>