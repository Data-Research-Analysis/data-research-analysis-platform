<script setup lang="ts">
const { $swal } = useNuxtApp();
const router = useRouter();

useHead({
    title: 'Create Backup - Admin | Data Research Analysis',
    meta: [
        { name: 'robots', content: 'noindex, nofollow' }
    ]
});


// Use backup composable
const {
    isBackupInProgress,
    backupProgress,
    backupStatus,
    backupComplete,
    backupMetadata,
    createBackup,
    downloadBackup,
    setupBackupListener,
    cleanupBackupListener
} = useDatabaseBackup();

// Socket.IO listener with callback
setupBackupListener((data) => {
    $swal.fire({
        icon: 'success',
        title: 'Backup Created!',
        text: 'Your database backup has been created successfully.',
        confirmButtonText: 'View Backups',
        showCancelButton: true,
        cancelButtonText: 'Stay Here'
    }).then((result: any) => {
        if (result.isConfirmed) {
            router.push('/admin/database');
        }
    });
});

// Download backup handler
const handleDownloadBackup = async () => {
    if (!backupMetadata.value || !backupMetadata.value.backup_id) {
        await $swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Backup information not available'
        });
        return;
    }

    await downloadBackup(backupMetadata.value.backup_id);
};

// Go back to dashboard
const goBack = () => {
    router.push('/admin/database');
};

// Lifecycle
onMounted(() => {
    setupBackupListener((data) => {
        $swal.fire({
            icon: 'success',
            title: 'Backup Created!',
            text: 'Your database backup has been created successfully.',
            confirmButtonText: 'View Backups',
            showCancelButton: true,
            cancelButtonText: 'Stay Here'
        }).then((result: any) => {
            if (result.isConfirmed) {
                router.push('/admin/database');
            }
        });
    });
});

onUnmounted(() => {
    cleanupBackupListener();
});
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
            :activeLink="10"
        />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 p-6 lg:p-8">
               <h2>Backup Database</h2>

                <!-- Main Content -->
                <div class="max-w-4xl mt-6">
                    <!-- Backup Creation Card -->
                    <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200 mb-6">
                        <div v-if="!isBackupInProgress && !backupComplete">
                            <h3 class="text-lg font-semibold text-gray-900 mb-4">Ready to Create Backup</h3>
                            <p class="text-gray-600 mb-6">
                                Click the button below to start creating a backup of your database. 
                                The backup will be saved as a compressed ZIP file containing SQL data.
                            </p>
                            
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <h4 class="text-sm font-semibold text-blue-900 mb-2">What will be backed up?</h4>
                                <ul class="text-sm text-blue-800 space-y-1">
                                    <li>• All database tables and data</li>
                                    <li>• Database schema and structure</li>
                                    <li>• Indexes and constraints</li>
                                    <li>• Sequences and triggers</li>
                                </ul>
                            </div>

                            <button
                                @click="createBackup"
                                class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <font-awesome-icon icon="fa-solid fa-database" class="mr-2" />
                                Create Backup Now
                            </button>
                        </div>

                        <!-- Progress Display -->
                        <div v-if="isBackupInProgress" class="space-y-4">
                            <h3 class="text-lg font-semibold text-gray-900">Creating Backup...</h3>
                            
                            <!-- Progress Bar -->
                            <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                                <div 
                                    class="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
                                    :style="{ width: `${backupProgress}%` }"
                                >
                                    <span v-if="backupProgress > 10" class="text-xs text-white font-semibold">
                                        {{ backupProgress }}%
                                    </span>
                                </div>
                            </div>

                            <!-- Status Message -->
                            <div class="flex items-center text-gray-700">
                                <spinner class="mr-3" />
                                <span class="text-sm">{{ backupStatus }}</span>
                            </div>

                            <!-- Warning -->
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div class="flex">
                                    <font-awesome-icon icon="fa-solid fa-exclamation-triangle" class="text-yellow-500 mt-1 mr-3" />
                                    <p class="text-sm text-yellow-800">
                                        Please do not close this page while the backup is being created.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Completion Display -->
                        <div v-if="backupComplete && backupMetadata" class="space-y-4">
                            <div class="flex items-center text-green-600 mb-4">
                                <font-awesome-icon icon="fa-solid fa-check-circle" class="text-3xl mr-3" />
                                <h3 class="text-lg font-semibold">Backup Created Successfully!</h3>
                            </div>

                            <!-- Backup Details -->
                            <div class="bg-gray-50 rounded-lg p-4 space-y-2">
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600">Backup File:</span>
                                    <span class="font-medium text-gray-900">{{ backupMetadata.backup_file }}</span>
                                </div>
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600">Size:</span>
                                    <span class="font-medium text-gray-900">
                                        {{ (backupMetadata.backup_size / (1024 * 1024)).toFixed(2) }} MB
                                    </span>
                                </div>
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600">Created:</span>
                                    <span class="font-medium text-gray-900">
                                        {{ new Date(backupMetadata.timestamp).toLocaleString() }}
                                    </span>
                                </div>
                            </div>

                            <!-- Actions -->
                            <div class="flex space-x-4">
                                <button
                                    @click="handleDownloadBackup"
                                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                    <font-awesome-icon icon="fa-solid fa-download" class="mr-2" />
                                    Download Backup
                                </button>
                                <button
                                    @click="goBack"
                                    class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Back to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Back Button (when not in progress) -->
                    <div v-if="!isBackupInProgress">
                        <button
                            @click="goBack"
                            class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                        >
                            <font-awesome-icon icon="fa-solid fa-arrow-left" class="mr-2" />
                            Back to Database Management
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Additional styles if needed */
</style>
