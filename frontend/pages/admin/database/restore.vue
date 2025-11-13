<script setup lang="ts">
definePageMeta({
    middleware: 'authorization',
    layout: 'default'
});

useHead({
    title: 'Restore Database - Admin | Data Research Analysis',
    meta: [
        { name: 'robots', content: 'noindex, nofollow' }
    ]
});

const router = useRouter();
const { $swal } = useNuxtApp();

// Use restore composable
const {
    selectedFile,
    isRestoring,
    restoreProgress,
    restoreStatus,
    currentStep,
    selectFile,
    uploadAndRestore,
    validateBackupFile,
    setupRestoreListeners,
    cleanupRestoreListeners
} = useDatabaseRestore();

// File input ref
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

// Handle file selection
const onFileSelected = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const file = target.files[0];
        if (validateBackupFile(file)) {
            selectFile(file);
        }
    }
};

// Trigger file input
const triggerFileInput = () => {
    fileInput.value?.click();
};

// Drag and drop handlers
const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    isDragging.value = true;
};

const onDragLeave = () => {
    isDragging.value = false;
};

const onDrop = (event: DragEvent) => {
    event.preventDefault();
    isDragging.value = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
        const file = event.dataTransfer.files[0];
        if (validateBackupFile(file)) {
            selectFile(file);
        }
    }
};

// Format file size
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// Remove selected file
const removeFile = () => {
    selectFile(null);
    if (fileInput.value) {
        fileInput.value.value = '';
    }
};

// Start restore with confirmation
const startRestore = async () => {
    if (!selectedFile.value) {
        await $swal.fire({
            icon: 'error',
            title: 'No File Selected',
            text: 'Please select a backup file to restore'
        });
        return;
    }

    // Confirmation dialog with typed confirmation
    const confirmResult = await $swal.fire({
        title: 'Restore Database?',
        html: `
            <div class="text-left">
                <p class="mb-4 text-red-600 font-semibold">⚠️ WARNING: This action will:</p>
                <ul class="list-disc list-inside space-y-2 mb-4 text-sm">
                    <li>Delete the current database completely</li>
                    <li>Replace it with the backup data</li>
                    <li>Log out all users</li>
                    <li>Require you to log in again</li>
                </ul>
                <p class="mb-4">Type <strong>RESTORE</strong> to confirm:</p>
                <input 
                    id="confirm-input" 
                    type="text" 
                    class="swal2-input" 
                    placeholder="Type RESTORE"
                />
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Restore Database',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#DC2626',
        preConfirm: () => {
            const input = document.getElementById('confirm-input') as HTMLInputElement;
            if (input.value !== 'RESTORE') {
                $swal.showValidationMessage('Please type RESTORE to confirm');
                return false;
            }
            return true;
        }
    });

    if (!confirmResult.isConfirmed) {
        return;
    }

    // Upload and restore using composable
    await uploadAndRestore();
};

// Socket.IO listener with callback (for success modal)
setupRestoreListeners((success, message) => {
    if (success) {
        $swal.fire({
            icon: 'success',
            title: 'Restore Complete!',
            text: 'Your database has been restored. You will be logged out now.',
            confirmButtonText: 'OK',
            allowOutsideClick: false
        }).then(() => {
            // Clear token and redirect to login
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.href = '/auth/login';
        });
    } else {
        $swal.fire({
            icon: 'error',
            title: 'Restore Failed',
            text: message || 'Failed to restore database'
        });
    }
});

// Go back
const goBack = () => {
    router.push('/admin/database');
};

// Cleanup on unmount
onUnmounted(() => {
    cleanupRestoreListeners();
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
                        { name: 'Database Management', url: '/admin/database' },
                        { name: 'Restore Database', url: '/admin/database/restore' }
                    ]"
                />

                <!-- Page Header -->
                <div class="mt-6 mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Restore Database</h1>
                    <p class="mt-2 text-gray-600">
                        Upload a backup file to restore your database
                    </p>
                </div>

                <!-- Main Content -->
                <div class="max-w-4xl">
                    <!-- Warning Banner -->
                    <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <font-awesome-icon icon="fa-solid fa-exclamation-triangle" class="text-red-400 text-xl" />
                            </div>
                            <div class="ml-3">
                                <h3 class="text-sm font-medium text-red-800">Critical Warning</h3>
                                <div class="mt-2 text-sm text-red-700">
                                    <p class="font-semibold mb-2">This operation will:</p>
                                    <ul class="list-disc list-inside space-y-1">
                                        <li>Completely delete your current database</li>
                                        <li>Replace it with the backup data</li>
                                        <li>Log out all active users</li>
                                        <li>Cannot be undone</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Restore Card -->
                    <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200 mb-6">
                        <div v-if="!isRestoring && !restoreComplete">
                            <h3 class="text-lg font-semibold text-gray-900 mb-4">Upload Backup File</h3>

                            <!-- File Upload Area -->
                            <div
                                @click="triggerFileInput"
                                @dragover="onDragOver"
                                @dragleave="onDragLeave"
                                @drop="onDrop"
                                :class="[
                                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                                    isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                                ]"
                            >
                                <input
                                    ref="fileInput"
                                    type="file"
                                    accept=".zip"
                                    class="hidden"
                                    @change="onFileSelected"
                                />

                                <div v-if="!selectedFile">
                                    <font-awesome-icon icon="fa-solid fa-cloud-upload-alt" class="text-5xl text-gray-400 mb-4" />
                                    <p class="text-lg font-medium text-gray-700 mb-2">
                                        Drop your backup file here, or click to browse
                                    </p>
                                    <p class="text-sm text-gray-500">
                                        ZIP files only, max 500MB
                                    </p>
                                </div>

                                <div v-else class="flex items-center justify-center space-x-4">
                                    <font-awesome-icon icon="fa-solid fa-file-archive" class="text-4xl text-blue-600" />
                                    <div class="text-left">
                                        <p class="font-medium text-gray-900">{{ selectedFile.name }}</p>
                                        <p class="text-sm text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
                                    </div>
                                    <button
                                        @click.stop="removeFile"
                                        class="text-red-600 hover:text-red-800"
                                    >
                                        <font-awesome-icon icon="fa-solid fa-times-circle" class="text-2xl" />
                                    </button>
                                </div>
                            </div>

                            <!-- Instructions -->
                            <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 class="text-sm font-semibold text-blue-900 mb-2">Before you restore:</h4>
                                <ul class="text-sm text-blue-800 space-y-1">
                                    <li>• Ensure the backup file is from a compatible database version</li>
                                    <li>• Notify all users that the system will be unavailable</li>
                                    <li>• The restore process may take several minutes</li>
                                    <li>• Do not close your browser during the restore process</li>
                                </ul>
                            </div>

                            <!-- Action Buttons -->
                            <div class="mt-6 flex space-x-4">
                                <button
                                    @click="startRestore"
                                    :disabled="!selectedFile"
                                    :class="[
                                        'inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white',
                                        selectedFile 
                                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                                            : 'bg-gray-400 cursor-not-allowed'
                                    ]"
                                >
                                    <font-awesome-icon icon="fa-solid fa-upload" class="mr-2" />
                                    Start Restore
                                </button>
                                <button
                                    @click="goBack"
                                    class="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>

                        <!-- Restore Progress -->
                        <div v-if="isRestoring" class="space-y-4">
                            <h3 class="text-lg font-semibold text-gray-900">Restoring Database...</h3>
                            
                            <!-- Progress Bar -->
                            <div class="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                                <div 
                                    class="bg-gradient-to-r from-orange-500 to-red-600 h-6 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
                                    :style="{ width: `${restoreProgress}%` }"
                                >
                                    <span v-if="restoreProgress > 5" class="text-xs text-white font-bold">
                                        {{ restoreProgress }}%
                                    </span>
                                </div>
                            </div>

                            <!-- Status Message -->
                            <div class="flex items-center text-gray-700">
                                <spinner class="mr-3" />
                                <span class="text-sm font-medium">{{ restoreStatus }}</span>
                            </div>

                            <!-- Current Progress Details -->
                            <div class="bg-gray-50 rounded-lg p-4">
                                <div class="text-sm text-gray-600 space-y-2">
                                    <div class="flex items-center">
                                        <div class="w-32">Current Step:</div>
                                        <div class="font-medium text-gray-900">{{ restoreStatus }}</div>
                                    </div>
                                    <div class="flex items-center">
                                        <div class="w-32">Progress:</div>
                                        <div class="font-medium text-gray-900">{{ restoreProgress }}%</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Critical Warning -->
                            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div class="flex">
                                    <font-awesome-icon icon="fa-solid fa-exclamation-circle" class="text-red-500 mt-1 mr-3" />
                                    <p class="text-sm text-red-800 font-semibold">
                                        DO NOT close this page or refresh your browser during the restore process!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Back Button -->
                    <div v-if="!isRestoring && !restoreComplete">
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
