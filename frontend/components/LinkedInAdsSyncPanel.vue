<script setup lang="ts">
import { useLinkedInAds } from '@/composables/useLinkedInAds';
import type { ILinkedInSyncStatus } from '~/types/ILinkedInAds';

const props = defineProps<{
    dataSourceId: number;
    canSync?: boolean;
}>();

const emit = defineEmits<{
    (e: 'synced'): void;
}>();

const linkedInAds = useLinkedInAds();
const { $swal } = useNuxtApp() as any;

const state = reactive({
    syncing: false,
    loadingStatus: true,
    syncStatus: null as ILinkedInSyncStatus | null,
});

// ─── Sync Logic ─────────────────────────────────────────────────────────────

async function loadSyncStatus() {
    state.loadingStatus = true;
    try {
        state.syncStatus = await linkedInAds.getSyncStatus(props.dataSourceId);
    } catch (err) {
        console.error('[LinkedInAdsSyncPanel] Failed to load sync status:', err);
    } finally {
        state.loadingStatus = false;
    }
}

async function triggerSync() {
    state.syncing = true;
    try {
        const success = await linkedInAds.syncNow(props.dataSourceId);
        if (success) {
            await $swal.fire({
                title: 'Sync Started!',
                text: 'LinkedIn Ads sync has been initiated',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
            });
            emit('synced');
            await loadSyncStatus();
        } else {
            await $swal.fire({
                title: 'Sync Failed',
                text: 'Could not sync LinkedIn Ads data. Please try again.',
                icon: 'error',
            });
        }
    } catch (err: any) {
        await $swal.fire({
            title: 'Error',
            text: err.message || 'An error occurred during sync',
            icon: 'error',
        });
    } finally {
        state.syncing = false;
    }
}

// ─── Computed Display Helpers ────────────────────────────────────────────────

const lastSyncText = computed(() => {
    const ts = state.syncStatus?.lastSyncTime;
    if (!ts) return 'Never';
    return linkedInAds.formatSyncTime(ts);
});

const syncStatusInfo = computed((): { status: string; text: string; color: string } => {
    if (state.syncing) {
        return { status: 'syncing', text: 'Syncing...', color: 'blue' };
    }
    const last = state.syncStatus?.lastSyncTime;
    if (!last) {
        return { status: 'never', text: 'Never synced', color: 'yellow' };
    }
    const diffHours = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) return { status: 'up-to-date', text: 'Up to date', color: 'green' };
    if (diffHours < 48) return { status: 'stale', text: 'Needs sync', color: 'yellow' };
    return { status: 'very-stale', text: 'Outdated', color: 'red' };
});

const syncHistory = computed(() => {
    return (state.syncStatus?.syncHistory || []).map((h: any) => ({
        id: h.id || Math.random(),
        sync_started_at: h.startedAt || h.started_at || h.timestamp,
        sync_completed_at: h.completedAt || h.completed_at || null,
        status: (h.status || 'pending').toLowerCase(),
        rows_synced: h.recordsSynced ?? h.records_synced ?? 0,
        error_message: h.errorMessage || h.error_message || h.error || null,
    }));
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
    loadSyncStatus();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Sync Controls Card -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">LinkedIn Ads Sync Controls</h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Current Status -->
                <div>
                    <h3 class="text-sm font-medium text-gray-700 mb-3">Current Status</h3>

                    <div class="space-y-3" v-if="!state.loadingStatus">
                        <!-- Status Badge -->
                        <div class="flex items-center gap-2">
                            <span :class="{
                                'bg-green-100 text-green-800': syncStatusInfo.color === 'green',
                                'bg-yellow-100 text-yellow-800': syncStatusInfo.color === 'yellow',
                                'bg-red-100 text-red-800': syncStatusInfo.color === 'red',
                                'bg-blue-100 text-blue-800': syncStatusInfo.color === 'blue',
                                'bg-gray-100 text-gray-800': syncStatusInfo.color === 'gray',
                            }" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium">
                                <span v-if="syncStatusInfo.status === 'syncing'" class="animate-spin mr-1">⟳</span>
                                {{ syncStatusInfo.text }}
                            </span>
                        </div>

                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Last Synced</span>
                            <span class="text-sm text-gray-900 font-medium">{{ lastSyncText }}</span>
                        </div>
                    </div>

                    <!-- Loading skeleton -->
                    <div v-else class="space-y-3 animate-pulse">
                        <div class="h-6 bg-gray-200 rounded w-24"></div>
                        <div class="h-4 bg-gray-200 rounded w-40"></div>
                    </div>
                </div>

                <!-- Actions -->
                <div>
                    <h3 class="text-sm font-medium text-gray-700 mb-3">Actions</h3>
                    <div class="space-y-3">
                        <button
                            v-if="canSync !== false"
                            @click="triggerSync"
                            :disabled="state.syncing"
                            class="w-full px-4 py-3 bg-[#0077B5] text-white rounded-lg hover:bg-[#005f91] transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                            <font-awesome-icon v-if="state.syncing" :icon="['fas', 'spinner']" class="animate-spin h-4 w-4" />
                            <font-awesome-icon v-else :icon="['fas', 'rotate']" class="h-4 w-4" />
                            {{ state.syncing ? 'Syncing...' : 'Sync Now' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sync History Card -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Sync History</h2>

            <SyncHistoryTable
                :sync-history="syncHistory"
                :loading="state.loadingStatus"
                :max-rows="20" />
        </div>
    </div>
</template>
