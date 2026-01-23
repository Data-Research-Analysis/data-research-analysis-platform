/**
 * Notification Types Enum
 * 
 * Defines all possible notification types in the platform.
 * Each type corresponds to a specific event that triggers a notification.
 */
export enum NotificationType {
    // Project Management Notifications (5 types)
    PROJECT_INVITATION = 'project_invitation',
    PROJECT_MEMBER_ADDED = 'project_member_added',
    PROJECT_MEMBER_REMOVED = 'project_member_removed',
    PROJECT_ROLE_CHANGED = 'project_role_changed',
    INVITATION_ACCEPTED = 'invitation_accepted',
    INVITATION_DECLINED = 'invitation_declined',

    // Subscription Management Notifications (5 types)
    SUBSCRIPTION_ASSIGNED = 'subscription_assigned',
    SUBSCRIPTION_UPGRADED = 'subscription_upgraded',
    SUBSCRIPTION_DOWNGRADED = 'subscription_downgraded',
    SUBSCRIPTION_EXPIRING = 'subscription_expiring',
    SUBSCRIPTION_EXPIRED = 'subscription_expired',

    // Database Backup Notifications (2 types - Admin only)
    BACKUP_COMPLETED = 'backup_completed',
    BACKUP_FAILED = 'backup_failed'
}

/**
 * Interface for creating a new notification
 */
export interface ICreateNotificationData {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
    metadata?: Record<string, any>;
    expiresAt?: Date | null;
}

/**
 * Interface for notification data returned to clients
 */
export interface INotificationData {
    id: number;
    type: NotificationType;
    title: string;
    message: string;
    link: string | null;
    metadata: Record<string, any>;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
}
