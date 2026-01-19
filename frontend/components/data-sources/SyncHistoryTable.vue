<script setup lang="ts">
interface SyncHistoryEntry {
    id: number | string;
    sync_started_at: string;
    sync_completed_at?: string;
    status: 'success' | 'failed' | 'pending' | 'running' | 'completed';
    rows_synced?: number;
    error_message?: string;
}

interface Props {
    syncHistory: SyncHistoryEntry[];
    loading?: boolean;
    maxRows?: number;
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    maxRows: 20
});

const emit = defineEmits<{
    (e: 'view-details', syncId: number | string): void;
}>();

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
function getSyncDuration(sync: SyncHistoryEntry) {
    if (!sync.sync_completed_at || !sync.sync_started_at) return '-';
    const duration = (new Date(sync.sync_completed_at).getTime() - new Date(sync.sync_started_at).getTime()) / 1000;
    if (duration < 60) {
        return `${Math.round(duration)}s`;
    } else {
        return `${Math.round(duration / 60)}m ${Math.round(duration % 60)}s`;
    }
}

const displayedHistory = computed(() => {
    return props.syncHistory.slice(0, props.maxRows);
});
</script>

<template>
    <div class="w-full">
        <!-- Loading State -->
        <div v-if="loading" class="space-y-2">
            <div v-for="i in 5" :key="i" class="animate-pulse flex gap-4">
                <div class="h-4 bg-gray-200 rounded flex-1"></div>
                <div class="h-4 bg-gray-200 rounded w-20"></div>
                <div class="h-4 bg-gray-200 rounded w-16"></div>
                <div class="h-4 bg-gray-200 rounded w-24"></div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="!syncHistory || syncHistory.length === 0" class="text-center py-12 text-gray-500">
            <font-awesome icon="fas fa-history" class="text-4xl mb-3" />
            <p>No sync history available</p>
        </div>

        <!-- History Table -->
        <div v-else class="overflow-x-auto rounded-lg overflow-hidden ring-1 ring-gray-200 ring-inset">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Duration
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rows Synced
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="sync in displayedHistory" :key="sync.id" class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {{ formatSyncDate(sync.sync_completed_at || sync.sync_started_at) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <SyncStatusBadge 
                                :status="sync.status === 'success' ? 'completed' : sync.status" 
                                size="sm" />
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {{ getSyncDuration(sync) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {{ sync.rows_synced || '-' }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Show More Link -->
        <div v-if="syncHistory.length > maxRows" class="mt-4 text-center">
            <p class="text-sm text-gray-600">
                Showing {{ maxRows }} of {{ syncHistory.length }} syncs
            </p>
        </div>
    </div>
</template>
