export const useDatabaseRestore = () => {
    const { $swal, $socketio } = useNuxtApp();
    
    // State
    const selectedFile = ref<File | null>(null);
    const isRestoring = ref(false);
    const restoreProgress = ref(0);
    const restoreStatus = ref('');
    const restoreComplete = ref(false);
    const restoreSuccess = ref(false);
    const currentStep = ref('');

    /**
     * Validate backup file
     */
    const validateFile = (file: File): boolean => {
        // Check file type
        if (!file.name.endsWith('.zip')) {
            $swal.fire({
                icon: 'error',
                title: 'Invalid File Type',
                text: 'Please select a ZIP file containing the database backup'
            });
            return false;
        }

        // Check file size (500MB max)
        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
            $swal.fire({
                icon: 'error',
                title: 'File Too Large',
                text: 'Backup file must be less than 500MB'
            });
            return false;
        }

        return true;
    };

    /**
     * Set selected file
     */
    const setSelectedFile = (file: File | null): boolean => {
        if (file && !validateFile(file)) {
            return false;
        }
        selectedFile.value = file;
        return true;
    };

    /**
     * Clear selected file
     */
    const clearSelectedFile = () => {
        selectedFile.value = null;
    };

    /**
     * Format file size
     */
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    /**
     * Start restore process
     */
    const startRestore = async (): Promise<boolean> => {
        if (!selectedFile.value) {
            await $swal.fire({
                icon: 'error',
                title: 'No File Selected',
                text: 'Please select a backup file to restore'
            });
            return false;
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
            return false;
        }

        // Upload and restore
        try {
            const formData = new FormData();
            formData.append('backup', selectedFile.value);

            isRestoring.value = true;
            restoreProgress.value = 0;
            restoreStatus.value = 'Uploading backup file...';
            currentStep.value = 'Uploading';

            const response = await $fetch(`${baseUrl()}/admin/database/restore`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getCookie('token')}`,
                    'Authorization-Type': 'auth'
                },
                body: formData
            });

            restoreProgress.value = 10;
            restoreStatus.value = 'Backup uploaded, starting restore process...';
            currentStep.value = 'Processing';
            return true;

        } catch (error: any) {
            isRestoring.value = false;
            await $swal.fire({
                icon: 'error',
                title: 'Upload Failed',
                text: error.message || 'Failed to upload backup file'
            });
            return false;
        }
    };

    /**
     * Setup Socket.IO listeners for restore progress
     */
    const setupRestoreListeners = (
        onProgress?: (progress: number, status: string) => void,
        onComplete?: (success: boolean, message: string) => void
    ) => {
        // Progress updates
        $socketio.on('database-restore-progress', (data: string) => {
            const parsed = JSON.parse(data);
            console.log('Restore progress:', parsed);
            
            restoreProgress.value = parsed.progress;
            restoreStatus.value = parsed.status;
            currentStep.value = parsed.status;

            if (onProgress) {
                onProgress(parsed.progress, parsed.status);
            }
        });

        // Completion
        $socketio.on('database-restore-complete', (data: string) => {
            const parsed = JSON.parse(data);
            console.log('Restore complete:', parsed);
            
            isRestoring.value = false;
            restoreComplete.value = true;
            restoreSuccess.value = parsed.success;

            if (parsed.success) {
                restoreProgress.value = 100;
                restoreStatus.value = 'Database restored successfully!';
                currentStep.value = 'Complete';

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
                currentStep.value = 'Failed';
                $swal.fire({
                    icon: 'error',
                    title: 'Restore Failed',
                    text: parsed.message || 'Failed to restore database'
                });
            }

            if (onComplete) {
                onComplete(parsed.success, parsed.message);
            }
        });
    };

    /**
     * Cleanup Socket.IO listeners
     */
    const cleanupRestoreListeners = () => {
        $socketio.off('database-restore-progress');
        $socketio.off('database-restore-complete');
    };

    /**
     * Reset restore state
     */
    const resetRestoreState = () => {
        selectedFile.value = null;
        isRestoring.value = false;
        restoreProgress.value = 0;
        restoreStatus.value = '';
        restoreComplete.value = false;
        restoreSuccess.value = false;
        currentStep.value = '';
    };

    /**
     * Get current progress percentage
     */
    const getProgressPercentage = computed(() => restoreProgress.value);

    /**
     * Check if restore is in progress
     */
    const isInProgress = computed(() => isRestoring.value);

    /**
     * Check if file is selected
     */
    const hasSelectedFile = computed(() => selectedFile.value !== null);

    /**
     * Get selected file info
     */
    const selectedFileInfo = computed(() => {
        if (!selectedFile.value) return null;
        
        return {
            name: selectedFile.value.name,
            size: selectedFile.value.size,
            formattedSize: formatFileSize(selectedFile.value.size),
            type: selectedFile.value.type
        };
    });

    return {
        // State
        selectedFile: readonly(selectedFile),
        isRestoring: readonly(isRestoring),
        restoreProgress: readonly(restoreProgress),
        restoreStatus: readonly(restoreStatus),
        restoreComplete: readonly(restoreComplete),
        restoreSuccess: readonly(restoreSuccess),
        currentStep: readonly(currentStep),

        // Computed
        getProgressPercentage,
        isInProgress,
        hasSelectedFile,
        selectedFileInfo,

        // Methods
        validateBackupFile: validateFile,
        selectFile: setSelectedFile,
        uploadAndRestore: startRestore,
        clearSelectedFile,
        formatFileSize,
        setupRestoreListeners,
        cleanupRestoreListeners,
        resetRestoreState
    };
};
