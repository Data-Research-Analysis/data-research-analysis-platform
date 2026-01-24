export const ISocketEvent = {
    PDF_TO_IMAGES_COMPLETE: 'pdf-conversion-complete',
    PDF_TO_IMAGES_CORRUPT: 'pdf-conversion-complete-corrupt',
    EXTRACT_TEXT_FROM_IMAGE: 'extract-text-from-image',
    EXTRACT_TEXT_FROM_IMAGE_COMPLETE: 'extract-text-from-image-complete',
    DATABASE_BACKUP_COMPLETE: 'database-backup-complete',
    DATABASE_RESTORE_PROGRESS: 'database-restore-progress',
    DATABASE_RESTORE_COMPLETE: 'database-restore-complete',
    SCHEDULED_BACKUP_STARTED: 'scheduled-backup-started',
    SCHEDULED_BACKUP_COMPLETED: 'scheduled-backup-completed',
    SCHEDULED_BACKUP_FAILED: 'scheduled-backup-failed',
    SCHEDULED_BACKUP_PROGRESS: 'scheduled-backup-progress',
    // Notification events
    NOTIFICATION_NEW: 'notification-new',
    NOTIFICATION_READ: 'notification-read',
    NOTIFICATION_MARK_ALL_READ: 'notification-mark-all-read',
    NOTIFICATION_DELETED: 'notification-deleted',
};