import { NotificationProcessor } from '../processors/NotificationProcessor.js';
import { NotificationType, ICreateNotificationData } from '../types/NotificationTypes.js';
import { EProjectRole } from '../types/EProjectRole.js';

/**
 * NotificationHelperService - Singleton service for creating notifications
 * 
 * Provides convenient helper methods for creating notifications for various platform events.
 * Wraps NotificationProcessor with business logic for notification content and metadata.
 */
export class NotificationHelperService {
    private static instance: NotificationHelperService;
    private notificationProcessor = NotificationProcessor.getInstance();

    private constructor() {}

    public static getInstance(): NotificationHelperService {
        if (!NotificationHelperService.instance) {
            NotificationHelperService.instance = new NotificationHelperService();
        }
        return NotificationHelperService.instance;
    }

    // ==================== PROJECT MANAGEMENT ====================

    async notifyProjectCreated(userId: number, projectId: number, projectName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.PROJECT_CREATED,
                title: 'Project Created',
                message: `Project "${projectName}" has been created successfully.`,
                link: `/projects/${projectId}`,
                metadata: { projectId, projectName }
            });
        } catch (error) {
            console.error('Failed to create project created notification:', error);
        }
    }

    async notifyProjectUpdated(userId: number, projectId: number, projectName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.PROJECT_UPDATED,
                title: 'Project Updated',
                message: `Project "${projectName}" has been updated.`,
                link: `/projects/${projectId}`,
                metadata: { projectId, projectName }
            });
        } catch (error) {
            console.error('Failed to create project updated notification:', error);
        }
    }

    async notifyProjectDeleted(userId: number, projectName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.PROJECT_DELETED,
                title: 'Project Deleted',
                message: `Project "${projectName}" has been deleted.`,
                link: '/projects',
                metadata: { projectName }
            });
        } catch (error) {
            console.error('Failed to create project deleted notification:', error);
        }
    }

    async notifyProjectShared(userId: number, projectId: number, projectName: string, sharedByName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.PROJECT_SHARED,
                title: 'Project Shared With You',
                message: `${sharedByName} shared project "${projectName}" with you.`,
                link: `/projects/${projectId}`,
                metadata: { projectId, projectName, sharedByName }
            });
        } catch (error) {
            console.error('Failed to create project shared notification:', error);
        }
    }

    async notifyProjectMemberAdded(userId: number, projectId: number, projectName: string, memberName: string, role: EProjectRole): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.PROJECT_MEMBER_ADDED,
                title: 'New Project Member',
                message: `${memberName} joined project "${projectName}" as ${role}.`,
                link: `/projects/${projectId}/members`,
                metadata: { projectId, projectName, memberName, role }
            });
        } catch (error) {
            console.error('Failed to create member added notification:', error);
        }
    }

    async notifyProjectMemberRemoved(userId: number, projectId: number, projectName: string, memberName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.PROJECT_MEMBER_REMOVED,
                title: 'Member Removed',
                message: `${memberName} was removed from project "${projectName}".`,
                link: `/projects/${projectId}/members`,
                metadata: { projectId, projectName, memberName }
            });
        } catch (error) {
            console.error('Failed to create member removed notification:', error);
        }
    }

    async notifyProjectRoleChanged(userId: number, projectId: number, projectName: string, newRole: EProjectRole): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.PROJECT_ROLE_CHANGED,
                title: 'Role Changed',
                message: `Your role in project "${projectName}" was changed to ${newRole}.`,
                link: `/projects/${projectId}`,
                metadata: { projectId, projectName, newRole }
            });
        } catch (error) {
            console.error('Failed to create role changed notification:', error);
        }
    }

    async notifyInvitationAccepted(userId: number, projectId: number, projectName: string, acceptedByName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.INVITATION_ACCEPTED,
                title: 'Invitation Accepted',
                message: `${acceptedByName} accepted your invitation to join "${projectName}".`,
                link: `/projects/${projectId}/members`,
                metadata: { projectId, projectName, acceptedByName }
            });
        } catch (error) {
            console.error('Failed to create invitation accepted notification:', error);
        }
    }

    async notifyInvitationDeclined(userId: number, projectId: number, projectName: string, declinedByEmail: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.INVITATION_DECLINED,
                title: 'Invitation Declined',
                message: `${declinedByEmail} declined your invitation to join "${projectName}".`,
                link: `/projects/${projectId}/members`,
                metadata: { projectId, projectName, declinedByEmail }
            });
        } catch (error) {
            console.error('Failed to create invitation declined notification:', error);
        }
    }

    async notifyInvitationExpired(userId: number, projectName: string, invitedEmail: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.INVITATION_EXPIRED,
                title: 'Invitation Expired',
                message: `Your invitation to ${invitedEmail} for project "${projectName}" has expired.`,
                link: '/projects',
                metadata: { projectName, invitedEmail },
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            });
        } catch (error) {
            console.error('Failed to create invitation expired notification:', error);
        }
    }

    // ==================== DATA SOURCE OPERATIONS ====================

    async notifyDataSourceCreated(userId: number, dataSourceId: number, dataSourceName: string, dataSourceType: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_SOURCE_CREATED,
                title: 'Data Source Created',
                message: `Data source "${dataSourceName}" (${dataSourceType}) has been created.`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, dataSourceType }
            });
        } catch (error) {
            console.error('Failed to create data source created notification:', error);
        }
    }

    async notifyDataSourceDeleted(userId: number, dataSourceName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_SOURCE_DELETED,
                title: 'Data Source Deleted',
                message: `Data source "${dataSourceName}" has been deleted.`,
                link: '/data-sources',
                metadata: { dataSourceName }
            });
        } catch (error) {
            console.error('Failed to create data source deleted notification:', error);
        }
    }

    async notifyDataSourceConnectionFailed(userId: number, dataSourceId: number, dataSourceName: string, error: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_SOURCE_CONNECTION_FAILED,
                title: 'Connection Failed',
                message: `Failed to connect to "${dataSourceName}". Error: ${error}`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, error }
            });
        } catch (error) {
            console.error('Failed to create connection failed notification:', error);
        }
    }

    async notifyDataSourceSyncComplete(userId: number, dataSourceId: number, dataSourceName: string, recordCount: number, duration?: number): Promise<void> {
        try {
            const durationText = duration ? ` in ${Math.round(duration / 1000)}s` : '';
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_SOURCE_SYNC_COMPLETE,
                title: 'Sync Completed',
                message: `Successfully synced ${recordCount.toLocaleString()} records from "${dataSourceName}"${durationText}.`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, recordCount, duration }
            });
        } catch (error) {
            console.error('Failed to create sync complete notification:', error);
        }
    }

    async notifyDataSourceSyncFailed(userId: number, dataSourceId: number, dataSourceName: string, error: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_SOURCE_SYNC_FAILED,
                title: 'Sync Failed',
                message: `Failed to sync data from "${dataSourceName}". Error: ${error}`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, error }
            });
        } catch (error) {
            console.error('Failed to create sync failed notification:', error);
        }
    }

    async notifyScheduledSyncComplete(userId: number, dataSourceId: number, dataSourceName: string, recordCount: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_SOURCE_SCHEDULED_SYNC_COMPLETE,
                title: 'Scheduled Sync Completed',
                message: `Scheduled sync completed for "${dataSourceName}". ${recordCount.toLocaleString()} records synced.`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, recordCount }
            });
        } catch (error) {
            console.error('Failed to create scheduled sync complete notification:', error);
        }
    }

    async notifyScheduledSyncFailed(userId: number, dataSourceId: number, dataSourceName: string, error: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_SOURCE_SCHEDULED_SYNC_FAILED,
                title: 'Scheduled Sync Failed',
                message: `Scheduled sync failed for "${dataSourceName}". Error: ${error}`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, error }
            });
        } catch (error) {
            console.error('Failed to create scheduled sync failed notification:', error);
        }
    }

    async notifyLargeDatasetSync(userId: number, dataSourceId: number, dataSourceName: string, recordCount: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_SOURCE_SYNC_LARGE_DATASET,
                title: 'Large Dataset Sync',
                message: `Syncing ${recordCount.toLocaleString()} records from "${dataSourceName}". This may take a while.`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, recordCount }
            });
        } catch (error) {
            console.error('Failed to create large dataset notification:', error);
        }
    }

    async notifySyncScheduleChanged(userId: number, dataSourceId: number, dataSourceName: string, schedule: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.SYNC_SCHEDULE_CHANGED,
                title: 'Sync Schedule Updated',
                message: `Sync schedule for "${dataSourceName}" changed to ${schedule}.`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, schedule }
            });
        } catch (error) {
            console.error('Failed to create sync schedule changed notification:', error);
        }
    }

    async notifyOAuthTokenExpiring(userId: number, dataSourceId: number, dataSourceName: string, expiresIn: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.OAUTH_TOKEN_EXPIRING,
                title: 'Token Expiring Soon',
                message: `OAuth token for "${dataSourceName}" expires in ${expiresIn} days. Please reconnect to avoid sync failures.`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName, expiresIn }
            });
        } catch (error) {
            console.error('Failed to create token expiring notification:', error);
        }
    }

    async notifyOAuthTokenExpired(userId: number, dataSourceId: number, dataSourceName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.OAUTH_TOKEN_EXPIRED,
                title: 'Token Expired',
                message: `OAuth token for "${dataSourceName}" has expired. Please reconnect to resume syncing.`,
                link: `/data-sources/${dataSourceId}`,
                metadata: { dataSourceId, dataSourceName }
            });
        } catch (error) {
            console.error('Failed to create token expired notification:', error);
        }
    }

    // ==================== DATA MODEL OPERATIONS ====================

    async notifyDataModelCreated(userId: number, dataModelId: number, dataModelName: string, dataSourceName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_MODEL_CREATED,
                title: 'Data Model Created',
                message: `Data model "${dataModelName}" created from "${dataSourceName}".`,
                link: `/data-models/${dataModelId}`,
                metadata: { dataModelId, dataModelName, dataSourceName }
            });
        } catch (error) {
            console.error('Failed to create data model created notification:', error);
        }
    }

    async notifyDataModelDeleted(userId: number, dataModelName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_MODEL_DELETED,
                title: 'Data Model Deleted',
                message: `Data model "${dataModelName}" has been deleted.`,
                link: '/data-models',
                metadata: { dataModelName }
            });
        } catch (error) {
            console.error('Failed to create data model deleted notification:', error);
        }
    }

    async notifyDataModelQueryFailed(userId: number, dataModelId: number, dataModelName: string, error: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DATA_MODEL_QUERY_FAILED,
                title: 'Query Execution Failed',
                message: `Query failed for data model "${dataModelName}". Error: ${error}`,
                link: `/data-models/${dataModelId}`,
                metadata: { dataModelId, dataModelName, error }
            });
        } catch (error) {
            console.error('Failed to create query failed notification:', error);
        }
    }

    // ==================== AI DATA MODELER ====================

    async notifyAIModelReady(userId: number, dataSourceId: number, conversationId: string, modelCount: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.AI_MODEL_READY,
                title: 'AI Models Ready',
                message: `AI generated ${modelCount} data model recommendations. Review and apply them.`,
                link: `/ai-data-modeler/${dataSourceId}`,
                metadata: { dataSourceId, conversationId, modelCount }
            });
        } catch (error) {
            console.error('Failed to create AI model ready notification:', error);
        }
    }

    async notifyAIProcessingError(userId: number, dataSourceId: number, error: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.AI_PROCESSING_ERROR,
                title: 'AI Processing Error',
                message: `AI data modeler encountered an error: ${error}`,
                link: `/ai-data-modeler/${dataSourceId}`,
                metadata: { dataSourceId, error }
            });
        } catch (error) {
            console.error('Failed to create AI error notification:', error);
        }
    }

    // ==================== DASHBOARD OPERATIONS ====================

    async notifyDashboardCreated(userId: number, dashboardId: number, dashboardName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DASHBOARD_CREATED,
                title: 'Dashboard Created',
                message: `Dashboard "${dashboardName}" has been created.`,
                link: `/dashboards/${dashboardId}`,
                metadata: { dashboardId, dashboardName }
            });
        } catch (error) {
            console.error('Failed to create dashboard created notification:', error);
        }
    }

    async notifyDashboardShared(userId: number, dashboardId: number, dashboardName: string, sharedByName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DASHBOARD_SHARED,
                title: 'Dashboard Shared',
                message: `${sharedByName} shared dashboard "${dashboardName}" with you.`,
                link: `/dashboards/${dashboardId}`,
                metadata: { dashboardId, dashboardName, sharedByName }
            });
        } catch (error) {
            console.error('Failed to create dashboard shared notification:', error);
        }
    }

    async notifyDashboardExportComplete(userId: number, dashboardId: number, dashboardName: string, downloadUrl: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DASHBOARD_EXPORT_COMPLETE,
                title: 'Export Complete',
                message: `Dashboard "${dashboardName}" export is ready for download.`,
                link: downloadUrl,
                metadata: { dashboardId, dashboardName, downloadUrl }
            });
        } catch (error) {
            console.error('Failed to create export complete notification:', error);
        }
    }

    async notifyDashboardExportFailed(userId: number, dashboardId: number, dashboardName: string, error: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.DASHBOARD_EXPORT_FAILED,
                title: 'Export Failed',
                message: `Failed to export dashboard "${dashboardName}". Error: ${error}`,
                link: `/dashboards/${dashboardId}`,
                metadata: { dashboardId, dashboardName, error }
            });
        } catch (error) {
            console.error('Failed to create export failed notification:', error);
        }
    }

    // ==================== USER & SUBSCRIPTION ====================

    async notifyAccountCreated(userId: number, userName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.ACCOUNT_CREATED,
                title: 'Welcome!',
                message: `Welcome to Data Research Analysis, ${userName}! Your account has been created successfully.`,
                link: '/dashboard',
                metadata: { userName }
            });
        } catch (error) {
            console.error('Failed to create account created notification:', error);
        }
    }

    async notifyEmailVerified(userId: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.EMAIL_VERIFIED,
                title: 'Email Verified',
                message: 'Your email address has been verified successfully.',
                link: '/dashboard',
                metadata: {}
            });
        } catch (error) {
            console.error('Failed to create email verified notification:', error);
        }
    }

    async notifyPasswordChanged(userId: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.PASSWORD_CHANGED,
                title: 'Password Changed',
                message: 'Your password has been changed successfully. If you did not make this change, please contact support immediately.',
                link: '/settings/security',
                metadata: {}
            });
        } catch (error) {
            console.error('Failed to create password changed notification:', error);
        }
    }

    async notifySecurityAlert(userId: number, alertType: string, details: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.SECURITY_ALERT,
                title: 'Security Alert',
                message: `${alertType}: ${details}`,
                link: '/settings/security',
                metadata: { alertType, details }
            });
        } catch (error) {
            console.error('Failed to create security alert notification:', error);
        }
    }

    async notifySubscriptionAssigned(userId: number, tierName: string, expiresAt: Date): Promise<void> {
        try {
            console.log(`[NotificationHelperService] Creating subscription_assigned notification for user ${userId}, tier: ${tierName}`);
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.SUBSCRIPTION_ASSIGNED,
                title: 'Subscription Assigned',
                message: `You have been assigned ${tierName} subscription. Enjoy your new features!`,
                link: '/settings/subscription',
                metadata: { tierName, expiresAt }
            });
            console.log(`[NotificationHelperService] Successfully created subscription_assigned notification`);
        } catch (error) {
            console.error('[NotificationHelperService] Failed to create subscription assigned notification:', error);
        }
    }

    async notifySubscriptionUpgraded(userId: number, oldTier: string, newTier: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.SUBSCRIPTION_UPGRADED,
                title: 'Subscription Upgraded',
                message: `Your subscription has been upgraded from ${oldTier} to ${newTier}.`,
                link: '/settings/subscription',
                metadata: { oldTier, newTier }
            });
        } catch (error) {
            console.error('Failed to create subscription upgraded notification:', error);
        }
    }

    async notifySubscriptionExpiring(userId: number, tierName: string, daysRemaining: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.SUBSCRIPTION_EXPIRING,
                title: 'Subscription Expiring Soon',
                message: `Your ${tierName} subscription expires in ${daysRemaining} days. Renew to keep your features.`,
                link: '/settings/subscription',
                metadata: { tierName, daysRemaining }
            });
        } catch (error) {
            console.error('Failed to create subscription expiring notification:', error);
        }
    }

    async notifySubscriptionExpired(userId: number, tierName: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.SUBSCRIPTION_EXPIRED,
                title: 'Subscription Expired',
                message: `Your ${tierName} subscription has expired. Some features may be limited.`,
                link: '/settings/subscription',
                metadata: { tierName }
            });
        } catch (error) {
            console.error('Failed to create subscription expired notification:', error);
        }
    }

    async notifyTierLimitReached(userId: number, limitType: string, currentCount: number, maxAllowed: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.TIER_LIMIT_REACHED,
                title: 'Tier Limit Reached',
                message: `You've reached your ${limitType} limit (${currentCount}/${maxAllowed}). Upgrade to create more.`,
                link: '/settings/subscription',
                metadata: { limitType, currentCount, maxAllowed }
            });
        } catch (error) {
            console.error('Failed to create tier limit notification:', error);
        }
    }

    // ==================== ADMIN OPERATIONS ====================

    async notifyBackupCompleted(userId: number, backupId: string, size: number): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.BACKUP_COMPLETED,
                title: 'Backup Completed',
                message: `Database backup completed successfully. Size: ${(size / 1024 / 1024).toFixed(2)} MB`,
                link: '/admin/backups',
                metadata: { backupId, size }
            });
        } catch (error) {
            console.error('Failed to create backup completed notification:', error);
        }
    }

    async notifyBackupFailed(userId: number, error: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.BACKUP_FAILED,
                title: 'Backup Failed',
                message: `Database backup failed. Error: ${error}`,
                link: '/admin/backups',
                metadata: { error }
            });
        } catch (error) {
            console.error('Failed to create backup failed notification:', error);
        }
    }

    async notifyRestoreCompleted(userId: number, backupId: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.RESTORE_COMPLETED,
                title: 'Restore Completed',
                message: `Database restore from backup ${backupId} completed successfully.`,
                link: '/admin/backups',
                metadata: { backupId }
            });
        } catch (error) {
            console.error('Failed to create restore completed notification:', error);
        }
    }

    async notifyRestoreFailed(userId: number, backupId: string, error: string): Promise<void> {
        try {
            await this.notificationProcessor.createNotification({
                userId,
                type: NotificationType.RESTORE_FAILED,
                title: 'Restore Failed',
                message: `Database restore from backup ${backupId} failed. Error: ${error}`,
                link: '/admin/backups',
                metadata: { backupId, error }
            });
        } catch (error) {
            console.error('Failed to create restore failed notification:', error);
        }
    }

    // ==================== SYSTEM NOTIFICATIONS ====================

    async notifySystemUpdate(userIds: number[], version: string, features: string[]): Promise<void> {
        try {
            for (const userId of userIds) {
                await this.notificationProcessor.createNotification({
                    userId,
                    type: NotificationType.SYSTEM_UPDATE,
                    title: 'System Update',
                    message: `Platform updated to version ${version}. New features: ${features.join(', ')}`,
                    link: '/changelog',
                    metadata: { version, features }
                });
            }
        } catch (error) {
            console.error('Failed to create system update notification:', error);
        }
    }

    async notifyMaintenanceScheduled(userIds: number[], startTime: Date, duration: number): Promise<void> {
        try {
            for (const userId of userIds) {
                await this.notificationProcessor.createNotification({
                    userId,
                    type: NotificationType.MAINTENANCE_SCHEDULED,
                    title: 'Scheduled Maintenance',
                    message: `System maintenance scheduled for ${startTime.toLocaleString()}. Expected duration: ${duration} minutes.`,
                    link: '/status',
                    metadata: { startTime, duration }
                });
            }
        } catch (error) {
            console.error('Failed to create maintenance notification:', error);
        }
    }
}
