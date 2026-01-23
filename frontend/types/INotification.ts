export enum NotificationType {
    PROJECT_INVITATION = 'project_invitation',
    PROJECT_MEMBER_ADDED = 'project_member_added',
    PROJECT_MEMBER_REMOVED = 'project_member_removed',
    DATA_SOURCE_SYNC_COMPLETE = 'data_source_sync_complete',
    DATA_SOURCE_SYNC_FAILED = 'data_source_sync_failed',
    DASHBOARD_SHARED = 'dashboard_shared',
    DASHBOARD_COMMENT = 'dashboard_comment',
    SYSTEM_UPDATE = 'system_update',
    ACCOUNT_UPDATE = 'account_update',
    SUBSCRIPTION_EXPIRING = 'subscription_expiring',
    PAYMENT_RECEIVED = 'payment_received',
    PAYMENT_FAILED = 'payment_failed',
    SECURITY_ALERT = 'security_alert',
}

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

export interface ICreateNotificationData {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
    metadata?: Record<string, any>;
    expiresAt?: Date | null;
}

export interface INotificationListResponse {
    notifications: INotificationData[];
    total: number;
    page: number;
    limit: number;
}
