export enum NotificationType {
    // Project Management Notifications (12 types)
    PROJECT_CREATED = 'project_created',
    PROJECT_UPDATED = 'project_updated',
    PROJECT_DELETED = 'project_deleted',
    PROJECT_SHARED = 'project_shared',
    PROJECT_INVITATION = 'project_invitation',
    PROJECT_MEMBER_ADDED = 'project_member_added',
    PROJECT_MEMBER_REMOVED = 'project_member_removed',
    PROJECT_ROLE_CHANGED = 'project_role_changed',
    INVITATION_ACCEPTED = 'invitation_accepted',
    INVITATION_DECLINED = 'invitation_declined',
    INVITATION_EXPIRED = 'invitation_expired',
    INVITATION_CANCELLED = 'invitation_cancelled',

    // Data Source Operations (14 types)
    DATA_SOURCE_CREATED = 'data_source_created',
    DATA_SOURCE_UPDATED = 'data_source_updated',
    DATA_SOURCE_DELETED = 'data_source_deleted',
    DATA_SOURCE_CONNECTION_FAILED = 'data_source_connection_failed',
    DATA_SOURCE_CONNECTION_RESTORED = 'data_source_connection_restored',
    DATA_SOURCE_SYNC_STARTED = 'data_source_sync_started',
    DATA_SOURCE_SYNC_COMPLETE = 'data_source_sync_complete',
    DATA_SOURCE_SYNC_FAILED = 'data_source_sync_failed',
    DATA_SOURCE_SCHEDULED_SYNC_COMPLETE = 'data_source_scheduled_sync_complete',
    DATA_SOURCE_SCHEDULED_SYNC_FAILED = 'data_source_scheduled_sync_failed',
    DATA_SOURCE_SYNC_LARGE_DATASET = 'data_source_sync_large_dataset',
    SYNC_SCHEDULE_ENABLED = 'sync_schedule_enabled',
    SYNC_SCHEDULE_CHANGED = 'sync_schedule_changed',
    SYNC_SCHEDULE_DISABLED = 'sync_schedule_disabled',

    // OAuth & Authentication (2 types)
    OAUTH_TOKEN_EXPIRING = 'oauth_token_expiring',
    OAUTH_TOKEN_EXPIRED = 'oauth_token_expired',

    // Data Model Operations (4 types)
    DATA_MODEL_CREATED = 'data_model_created',
    DATA_MODEL_UPDATED = 'data_model_updated',
    DATA_MODEL_DELETED = 'data_model_deleted',
    DATA_MODEL_QUERY_FAILED = 'data_model_query_failed',

    // AI Data Modeler (4 types)
    AI_CONVERSATION_STARTED = 'ai_conversation_started',
    AI_MODEL_READY = 'ai_model_ready',
    AI_CONVERSATION_SAVED = 'ai_conversation_saved',
    AI_PROCESSING_ERROR = 'ai_processing_error',

    // Dashboard Operations (9 types)
    DASHBOARD_CREATED = 'dashboard_created',
    DASHBOARD_UPDATED = 'dashboard_updated',
    DASHBOARD_DELETED = 'dashboard_deleted',
    DASHBOARD_SHARED = 'dashboard_shared',
    DASHBOARD_COMMENT = 'dashboard_comment',
    DASHBOARD_EXPORT_STARTED = 'dashboard_export_started',
    DASHBOARD_EXPORT_COMPLETE = 'dashboard_export_complete',
    DASHBOARD_EXPORT_FAILED = 'dashboard_export_failed',
    DASHBOARD_EXPORT_READY = 'dashboard_export_ready',

    // User Account Operations (6 types)
    ACCOUNT_CREATED = 'account_created',
    ACCOUNT_UPDATE = 'account_update',
    EMAIL_VERIFIED = 'email_verified',
    PASSWORD_CHANGED = 'password_changed',
    PASSWORD_RESET_REQUESTED = 'password_reset_requested',
    SECURITY_ALERT = 'security_alert',

    // Subscription Management (6 types)
    SUBSCRIPTION_ASSIGNED = 'subscription_assigned',
    SUBSCRIPTION_UPGRADED = 'subscription_upgraded',
    SUBSCRIPTION_DOWNGRADED = 'subscription_downgraded',
    SUBSCRIPTION_EXPIRING = 'subscription_expiring',
    SUBSCRIPTION_EXPIRED = 'subscription_expired',
    TIER_LIMIT_REACHED = 'tier_limit_reached',

    // Payment Operations (3 types)
    PAYMENT_RECEIVED = 'payment_received',
    PAYMENT_FAILED = 'payment_failed',
    INVOICE_GENERATED = 'invoice_generated',

    // Database Backup Notifications (7 types - Admin only)
    BACKUP_COMPLETED = 'backup_completed',
    BACKUP_FAILED = 'backup_failed',
    SCHEDULED_BACKUP_COMPLETE = 'scheduled_backup_complete',
    SCHEDULED_BACKUP_FAILED = 'scheduled_backup_failed',
    RESTORE_STARTED = 'restore_started',
    RESTORE_COMPLETED = 'restore_completed',
    RESTORE_FAILED = 'restore_failed',

    // Admin User Management (4 types - Admin only)
    USER_CREATED_BY_ADMIN = 'user_created_by_admin',
    USER_UPDATED_BY_ADMIN = 'user_updated_by_admin',
    USER_DELETED_BY_ADMIN = 'user_deleted_by_admin',
    USER_ROLE_CHANGED = 'user_role_changed',

    // System Notifications (4 types)
    SYSTEM_UPDATE = 'system_update',
    MAINTENANCE_SCHEDULED = 'maintenance_scheduled',
    SERVICE_DEGRADATION = 'service_degradation',
    SERVICE_RESTORED = 'service_restored',

    // Content Management (2 types)
    ARTICLE_PUBLISHED = 'article_published',
    ARTICLE_UPDATED = 'article_updated'
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
