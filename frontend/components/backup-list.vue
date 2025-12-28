<script setup lang="ts">
interface IBackupMetadata {
    id: string;
    filename: string;
    filepath: string;
    size: number;
    created_at: Date | string;
    created_by: number;
    database_name: string;
}

const props = defineProps<{
    backups: readonly IBackupMetadata[];
    loading?: boolean;
}>();

const emit = defineEmits<{
    download: [backupId: string];
    delete: [backupId: string];
    refresh: [];
}>();

const { $swal } = useNuxtApp();

// Format file size
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// Format date
const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Get relative time
const getRelativeTime = (date: Date | string): string => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(date);
};

// Download backup
const downloadBackup = (backupId: string) => {
    emit('download', backupId);
};

// Delete backup with confirmation
const deleteBackup = async (backup: IBackupMetadata) => {
    const result = await $swal.fire({
        title: 'Delete Backup?',
        html: `
            <p class="mb-2">Are you sure you want to delete this backup?</p>
            <p class="text-sm text-gray-600 mb-2"><strong>File:</strong> ${backup.filename}</p>
            <p class="text-sm text-gray-600 mb-2"><strong>Size:</strong> ${formatFileSize(backup.size)}</p>
            <p class="text-sm text-red-600 font-semibold">This action cannot be undone!</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#DC2626'
    });

    if (result.isConfirmed) {
        emit('delete', backup.id);
    }
};

// Refresh list
const refreshList = () => {
    emit('refresh');
};
</script>

<template>
    <div class="bg-white rounded-lg shadow-md ring-1 ring-gray-200 ring-inset overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">Available Backups</h3>
            <button
                @click="refreshList"
                class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                :disabled="loading"
            >
                <font-awesome-icon 
                    icon="fa-solid fa-sync-alt" 
                    :class="['mr-2', loading ? 'animate-spin' : '']" 
                />
                Refresh
            </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="px-6 py-8 text-center">
            <spinner class="mx-auto mb-3" />
            <p class="text-gray-600">Loading backups...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="!backups || backups.length === 0" class="px-6 py-8 text-center">
            <font-awesome-icon icon="fa-solid fa-database" class="text-6xl text-gray-300 mb-4" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">No Backups Found</h4>
            <p class="text-gray-600">Create your first backup to get started</p>
        </div>

        <!-- Backup List -->
        <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Backup File
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Size
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                        </th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Database
                        </th>
                        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="backup in backups" :key="backup.id" class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center">
                                <font-awesome-icon icon="fa-solid fa-file-archive" class="text-blue-500 text-xl mr-3" />
                                <div>
                                    <div class="text-sm font-medium text-gray-900">
                                        {{ backup.filename }}
                                    </div>
                                    <div class="text-xs text-gray-500">
                                        ID: {{ backup.id }}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900">{{ formatFileSize(backup.size) }}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900">{{ formatDate(backup.created_at) }}</div>
                            <div class="text-xs text-gray-500">{{ getRelativeTime(backup.created_at) }}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900">{{ backup.database_name }}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div class="flex items-center justify-end space-x-2">
                                <button
                                    @click="downloadBackup(backup.id)"
                                    class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    v-tippy="{ content: 'Download Backup' }"
                                >
                                    <font-awesome-icon icon="fa-solid fa-download" class="mr-1" />
                                    Download
                                </button>
                                <button
                                    @click="deleteBackup(backup)"
                                    class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    v-tippy="{ content: 'Delete Backup' }"
                                >
                                    <font-awesome-icon icon="fa-solid fa-trash" />
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div v-if="backups && backups.length > 0" class="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <div class="text-sm text-gray-600">
                Total: <span class="font-semibold">{{ backups.length }}</span> backup{{ backups.length !== 1 ? 's' : '' }}
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Additional styles if needed */
</style>
