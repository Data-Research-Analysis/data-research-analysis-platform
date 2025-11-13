export interface IBackupMetadata {
    id: string;
    filename: string;
    filepath: string;
    size: number;
    created_at: Date | string;
    created_by: number;
    database_name: string;
}

export const useDatabaseBackup = () => {
    const { $swal, $socketio } = useNuxtApp();
    
    // State
    const isBackupInProgress = ref(false);
    const backupProgress = ref(0);
    const backupStatus = ref('');
    const backupComplete = ref(false);
    const backupMetadata = ref<any>(null);
    const backups = ref<IBackupMetadata[]>([]);
    const isLoadingBackups = ref(false);

    /**
     * Create a new database backup
     */
    const createBackup = async (): Promise<boolean> => {
        const result = await $swal.fire({
            title: 'Create Database Backup?',
            text: 'This will create a complete backup of your database. This may take several minutes.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Create Backup',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#3B82F6',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                try {
                    const response = await $fetch(`${baseUrl()}/admin/database/backup`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${getCookie('token')}`,
                            'Authorization-Type': 'auth'
                        }
                    });
                    return response;
                } catch (error: any) {
                    $swal.showValidationMessage(`Request failed: ${error.message}`);
                }
            },
            allowOutsideClick: () => !$swal.isLoading()
        });

        if (result.isConfirmed) {
            isBackupInProgress.value = true;
            backupProgress.value = 0;
            backupStatus.value = 'Backup job queued, waiting for processing...';
            backupComplete.value = false;
            backupMetadata.value = null;
            return true;
        }

        return false;
    };

    /**
     * List all available backups
     */
    const listBackups = async (): Promise<void> => {
        isLoadingBackups.value = true;
        try {
            const response: any = await $fetch(`${baseUrl()}/admin/database/backups`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${getCookie('token')}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (response && response.backups) {
                backups.value = response.backups;
            }
        } catch (error: any) {
            console.error('Error loading backups:', error);
            await $swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load backups list'
            });
        } finally {
            isLoadingBackups.value = false;
        }
    };

    /**
     * Download a backup file
     */
    const downloadBackup = async (backupId: string): Promise<void> => {
        try {
            const url = `${baseUrl()}/admin/database/backup/${backupId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${getCookie('token')}`,
                    'Authorization-Type': 'auth'
                }
            });

            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `backup_${backupId}.zip`;

            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);

            await $swal.fire({
                icon: 'success',
                title: 'Download Started',
                text: 'Your backup file is being downloaded',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Download error:', error);
            await $swal.fire({
                icon: 'error',
                title: 'Download Failed',
                text: 'Failed to download the backup file'
            });
        }
    };

    /**
     * Delete a backup
     */
    const deleteBackup = async (backupId: string): Promise<boolean> => {
        try {
            await $fetch(`${baseUrl()}/admin/database/backup/${backupId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getCookie('token')}`,
                    'Authorization-Type': 'auth'
                }
            });

            await $swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: 'Backup deleted successfully',
                timer: 2000,
                showConfirmButton: false
            });

            // Refresh the list
            await listBackups();
            return true;
        } catch (error: any) {
            console.error('Error deleting backup:', error);
            await $swal.fire({
                icon: 'error',
                title: 'Delete Failed',
                text: error.message || 'Failed to delete backup'
            });
            return false;
        }
    };

    /**
     * Setup Socket.IO listener for backup completion
     */
    const setupBackupListener = (onComplete?: (data: any) => void) => {
        $socketio.on('database-backup-complete', (data: string) => {
            const parsed = JSON.parse(data);
            console.log('Backup complete:', parsed);
            
            backupProgress.value = 100;
            backupStatus.value = 'Backup completed successfully!';
            backupComplete.value = true;
            backupMetadata.value = parsed;
            isBackupInProgress.value = false;

            if (onComplete) {
                onComplete(parsed);
            }
        });
    };

    /**
     * Cleanup Socket.IO listener
     */
    const cleanupBackupListener = () => {
        $socketio.off('database-backup-complete');
    };

    /**
     * Reset backup state
     */
    const resetBackupState = () => {
        isBackupInProgress.value = false;
        backupProgress.value = 0;
        backupStatus.value = '';
        backupComplete.value = false;
        backupMetadata.value = null;
    };

    /**
     * Get backup info
     */
    const getBackupInfo = async (backupId: string): Promise<IBackupMetadata | null> => {
        try {
            const response: any = await $fetch(`${baseUrl()}/admin/database/backup/${backupId}/info`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${getCookie('token')}`,
                    'Authorization-Type': 'auth'
                }
            });

            return response.backup || null;
        } catch (error) {
            console.error('Error getting backup info:', error);
            return null;
        }
    };

    return {
        // State
        isBackupInProgress: readonly(isBackupInProgress),
        backupProgress: readonly(backupProgress),
        backupStatus: readonly(backupStatus),
        backupComplete: readonly(backupComplete),
        backupMetadata: readonly(backupMetadata),
        backups: readonly(backups),
        isLoadingBackups: readonly(isLoadingBackups),

        // Methods
        createBackup,
        listBackups,
        downloadBackup,
        deleteBackup,
        setupBackupListener,
        cleanupBackupListener,
        resetBackupState,
        getBackupInfo
    };
};
