<script setup lang="ts">
definePageMeta({
    middleware: 'authorization',
    layout: 'default'
});

useHead({
    title: 'Database Management - Admin | Data Research Analysis',
    meta: [
        { name: 'robots', content: 'noindex, nofollow' }
    ]
});

const router = useRouter();
const { $swal } = useNuxtApp();

// Use backup composable
const { 
    backups, 
    isLoadingBackups, 
    listBackups, 
    downloadBackup, 
    deleteBackup 
} = useDatabaseBackup();

// Navigate to backup page
const goToBackup = () => {
    router.push('/admin/database/backup');
};

// Navigate to restore page
const goToRestore = () => {
    router.push('/admin/database/restore');
};

// Handle backup download
const handleDownloadBackup = async (backupId: string) => {
    await downloadBackup(backupId);
};

// Handle backup delete
const handleDeleteBackup = async (backupId: string) => {
    await deleteBackup(backupId);
};

// Handle refresh
const handleRefresh = async () => {
    await listBackups();
};

// Load backups on mount
onMounted(async () => {
    await listBackups();
});
</script>

<template>
    <div>
        <sidebar-admin
            :activeLink="10"
        />
        <div class="w-full lg:ml-[280px] min-h-screen bg-gray-50">
            <div class="p-6 lg:p-8">
                <!-- Breadcrumbs -->
                <breadcrumbs 
                    :links="[
                        { name: 'Admin Dashboard', url: '/admin' },
                        { name: 'Database Management', url: '/admin/database' }
                    ]"
                />

                <!-- Page Header -->
                <div class="mt-6 mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Database Management</h1>
                    <p class="mt-2 text-gray-600">
                        Create backups and restore your database from backup files
                    </p>
                </div>

                <!-- Action Cards Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <!-- Create Backup Card -->
                    <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <div class="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                                    <font-awesome-icon icon="fa-solid fa-database" class="text-2xl" />
                                </div>
                            </div>
                            <div class="ml-4 flex-1">
                                <h3 class="text-lg font-semibold text-gray-900">Create Backup</h3>
                                <p class="mt-2 text-sm text-gray-600">
                                    Create a complete backup of your database as a compressed ZIP file
                                </p>
                                <button
                                    @click="goToBackup"
                                    class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <font-awesome-icon icon="fa-solid fa-download" class="mr-2" />
                                    Create Backup
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Restore Database Card -->
                    <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <div class="flex items-center justify-center h-12 w-12 rounded-md bg-orange-500 text-white">
                                    <font-awesome-icon icon="fa-solid fa-upload" class="text-2xl" />
                                </div>
                            </div>
                            <div class="ml-4 flex-1">
                                <h3 class="text-lg font-semibold text-gray-900">Restore Database</h3>
                                <p class="mt-2 text-sm text-gray-600">
                                    Upload a backup file to restore your database
                                </p>
                                <button
                                    @click="goToRestore"
                                    class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                                >
                                    <font-awesome-icon icon="fa-solid fa-upload" class="mr-2" />
                                    Restore Database
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Warning Notice -->
                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <font-awesome-icon icon="fa-solid fa-exclamation-triangle" class="text-yellow-400 text-xl" />
                        </div>
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-yellow-800">Important Notice</h3>
                            <div class="mt-2 text-sm text-yellow-700">
                                <ul class="list-disc list-inside space-y-1">
                                    <li>Database restore will completely replace your current database</li>
                                    <li>All users will be logged out after a restore operation</li>
                                    <li>Backup operations may take several minutes depending on database size</li>
                                    <li>Do not close your browser during backup or restore operations</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200 mb-8">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Information</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="text-sm text-gray-600">Database Type</div>
                            <div class="mt-1 text-lg font-semibold text-gray-900">PostgreSQL</div>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="text-sm text-gray-600">Backup Format</div>
                            <div class="mt-1 text-lg font-semibold text-gray-900">SQL (ZIP Compressed)</div>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="text-sm text-gray-600">Max Backup Size</div>
                            <div class="mt-1 text-lg font-semibold text-gray-900">500 MB</div>
                        </div>
                    </div>
                </div>

                <!-- Backup List Component -->
                <backup-list
                    :backups="backups"
                    :loading="isLoadingBackups"
                    @download="handleDownloadBackup"
                    @delete="handleDeleteBackup"
                    @refresh="handleRefresh"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Additional styles if needed */
</style>
