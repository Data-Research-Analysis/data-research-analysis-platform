import { AccountCancellationProcessor } from "../processors/AccountCancellationProcessor.js";
import { NotificationProcessor } from "../processors/NotificationProcessor.js";
import { PlatformSettingsProcessor } from "../processors/PlatformSettingsProcessor.js";
import { DataDeletionService } from "../services/DataDeletionService.js";
import { NotificationHelperService } from "../services/NotificationHelperService.js";
import { EmailService } from "../services/EmailService.js";
import { NotificationType } from "../types/NotificationTypes.js";
import cron from 'node-cron';

/**
 * ScheduledDeletionJob - Automated job for account cancellation lifecycle
 * Runs daily to:
 * 1. Send 7-day deletion warnings
 * 2. Send 1-day final warnings
 * 3. Delete expired accounts
 */
export class ScheduledDeletionJob {
    private static instance: ScheduledDeletionJob;
    private cronTask: cron.ScheduledTask | null = null;
    private isRunning: boolean = false;
    
    private constructor() {}
    
    public static getInstance(): ScheduledDeletionJob {
        if (!ScheduledDeletionJob.instance) {
            ScheduledDeletionJob.instance = new ScheduledDeletionJob();
        }
        return ScheduledDeletionJob.instance;
    }

    /**
     * Start the scheduled job
     * Runs daily at 2:00 AM server time
     */
    public start(): void {
        if (this.cronTask) {
            console.log('[ScheduledDeletion] Job already running');
            return;
        }

        // Run daily at 2:00 AM
        this.cronTask = cron.schedule('0 2 * * *', async () => {
            await this.run();
        });

        console.log('[ScheduledDeletion] Job started - will run daily at 2:00 AM');
    }

    /**
     * Stop the scheduled job
     */
    public stop(): void {
        if (this.cronTask) {
            this.cronTask.stop();
            this.cronTask = null;
            console.log('[ScheduledDeletion] Job stopped');
        }
    }

    /**
     * Main execution method (can be called manually for testing)
     */
    public async run(): Promise<void> {
        if (this.isRunning) {
            console.log('[ScheduledDeletion] Job already running, skipping this cycle');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            console.log('[ScheduledDeletion] ========== Job Starting ==========');
            console.log(`[ScheduledDeletion] Time: ${new Date().toISOString()}`);

            // Check if auto-deletion is enabled
            const settingsProcessor = PlatformSettingsProcessor.getInstance();
            const autoDeleteEnabled = await settingsProcessor.isAutoDeleteEnabled();

            if (!autoDeleteEnabled) {
                console.log('[ScheduledDeletion] Auto-deletion is disabled in settings, skipping');
                return;
            }

            const stats = {
                sevenDayNotifications: 0,
                oneDayNotifications: 0,
                accountsDeleted: 0,
                errors: 0
            };

            // Step 1: Send 7-day notifications
            await this.send7DayNotifications(stats);

            // Step 2: Send 1-day notifications
            await this.send1DayNotifications(stats);

            // Step 3: Delete expired accounts
            await this.deleteExpiredAccounts(stats);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            
            console.log('[ScheduledDeletion] ========== Job Completed ==========');
            console.log(`[ScheduledDeletion] Duration: ${duration}s`);
            console.log(`[ScheduledDeletion] 7-day notifications sent: ${stats.sevenDayNotifications}`);
            console.log(`[ScheduledDeletion] 1-day notifications sent: ${stats.oneDayNotifications}`);
            console.log(`[ScheduledDeletion] Accounts deleted: ${stats.accountsDeleted}`);
            console.log(`[ScheduledDeletion] Errors: ${stats.errors}`);

        } catch (error) {
            console.error('[ScheduledDeletion] Critical error in job execution:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Send 7-day warning notifications
     */
    private async send7DayNotifications(stats: any): Promise<void> {
        try {
            const processor = AccountCancellationProcessor.getInstance();
            const notificationProcessor = NotificationProcessor.getInstance();
            const emailService = EmailService.getInstance();
            const settingsProcessor = PlatformSettingsProcessor.getInstance();

            // Check if 7-day notifications are enabled
            const enabled = await settingsProcessor.getSetting<boolean>('notification_7_days_enabled');
            if (enabled === false) {
                console.log('[ScheduledDeletion] 7-day notifications are disabled');
                return;
            }

            const cancellations = await processor.getCancellationsRequiringNotification(7);
            console.log(`[ScheduledDeletion] Found ${cancellations.length} accounts requiring 7-day notification`);

            for (const cancellation of cancellations) {
                try {
                    const user = cancellation.users_platform;
                    const deletionDate = cancellation.deletion_scheduled_at!;

                    // Send in-app notification
                    await notificationProcessor.createNotification({
                        userId: user.id,
                        type: NotificationType.ACCOUNT_CANCELLATION_REMINDER_7_DAYS,
                        title: '7 Days Until Account Deletion',
                        message: `Your account data will be permanently deleted in 7 days (${deletionDate.toLocaleDateString()}). Export your data now or reactivate your account to prevent deletion.`,
                        metadata: {
                            cancellationId: cancellation.id,
                            deletionDate: deletionDate.toISOString(),
                            daysRemaining: 7
                        }
                    });

                    // Send email notification
                    try {
                        await emailService.sendAccountCancellationReminder7Days(
                            user.email,
                            `${user.first_name} ${user.last_name}`,
                            deletionDate
                        );
                        console.log(`[ScheduledDeletion] 7-day email sent to ${user.email}`);
                    } catch (emailError) {
                        console.error(`[ScheduledDeletion] Failed to send 7-day email to ${user.email}:`, emailError);
                        // Continue - email failure shouldn't stop notification tracking
                    }

                    await processor.markNotificationSent(cancellation.id, 7);
                    stats.sevenDayNotifications++;

                } catch (error) {
                    console.error(`[ScheduledDeletion] Error sending 7-day notification for cancellation ${cancellation.id}:`, error);
                    stats.errors++;
                }
            }

        } catch (error) {
            console.error('[ScheduledDeletion] Error in send7DayNotifications:', error);
            stats.errors++;
        }
    }

    /**
     * Send 1-day final warning notifications
     */
    private async send1DayNotifications(stats: any): Promise<void> {
        try {
            const processor = AccountCancellationProcessor.getInstance();
            const notificationProcessor = NotificationProcessor.getInstance();
            const emailService = EmailService.getInstance();
            const deletionService = DataDeletionService.getInstance();
            const settingsProcessor = PlatformSettingsProcessor.getInstance();

            // Check if 1-day notifications are enabled
            const enabled = await settingsProcessor.getSetting<boolean>('notification_1_day_enabled');
            if (enabled === false) {
                console.log('[ScheduledDeletion] 1-day notifications are disabled');
                return;
            }

            const cancellations = await processor.getCancellationsRequiringNotification(1);
            console.log(`[ScheduledDeletion] Found ${cancellations.length} accounts requiring 1-day notification`);

            for (const cancellation of cancellations) {
                try {
                    const user = cancellation.users_platform;
                    const deletionDate = cancellation.deletion_scheduled_at!;

                    // Get data counts for the email
                    const dataEstimate = await deletionService.estimateUserDataSize(user.id);

                    // Send in-app notification
                    await notificationProcessor.createNotification({
                        userId: user.id,
                        type: NotificationType.ACCOUNT_CANCELLATION_REMINDER_1_DAY,
                        title: 'FINAL WARNING: Account Deletion Tomorrow',
                        message: `This is your final warning. Your account data will be permanently deleted tomorrow (${deletionDate.toLocaleDateString()}). This action cannot be undone. Export your data now or reactivate your account.`,
                        metadata: {
                            cancellationId: cancellation.id,
                            deletionDate: deletionDate.toISOString(),
                            daysRemaining: 1
                        }
                    });

                    // Send email notification with data counts
                    try {
                        await emailService.sendAccountCancellationReminder1Day(
                            user.email,
                            `${user.first_name} ${user.last_name}`,
                            deletionDate,
                            {
                                projectCount: dataEstimate.projects,
                                dataSourceCount: dataEstimate.dataSources,
                                dataModelCount: dataEstimate.dataModels,
                                dashboardCount: dataEstimate.dashboards
                            }
                        );
                        console.log(`[ScheduledDeletion] 1-day email sent to ${user.email}`);
                    } catch (emailError) {
                        console.error(`[ScheduledDeletion] Failed to send 1-day email to ${user.email}:`, emailError);
                        // Continue - email failure shouldn't stop notification tracking
                    }

                    await processor.markNotificationSent(cancellation.id, 1);
                    stats.oneDayNotifications++;

                } catch (error) {
                    console.error(`[ScheduledDeletion] Error sending 1-day notification for cancellation ${cancellation.id}:`, error);
                    stats.errors++;
                }
            }

        } catch (error) {
            console.error('[ScheduledDeletion] Error in send1DayNotifications:', error);
            stats.errors++;
        }
    }

    /**
     * Delete accounts past their retention period
     */
    private async deleteExpiredAccounts(stats: any): Promise<void> {
        try {
            const processor = AccountCancellationProcessor.getInstance();
            const deletionService = DataDeletionService.getInstance();

            const pendingDeletion = await processor.getCancellationsPendingDeletion();
            console.log(`[ScheduledDeletion] Found ${pendingDeletion.length} accounts to delete`);

            for (const cancellation of pendingDeletion) {
                try {
                    const userId = cancellation.users_platform.id;
                    
                    console.log(`[ScheduledDeletion] Deleting user ${userId}...`);
                    
                    // Execute deletion
                    await deletionService.deleteUserData(userId);
                    
                    // Mark as deleted in cancellation record
                    await processor.markDataDeleted(cancellation.id);
                    
                    stats.accountsDeleted++;
                    
                    console.log(`[ScheduledDeletion] Successfully deleted user ${userId}`);

                } catch (error) {
                    console.error(`[ScheduledDeletion] Error deleting account ${cancellation.id}:`, error);
                    stats.errors++;
                    // Continue with other deletions
                }
            }

        } catch (error) {
            console.error('[ScheduledDeletion] Error in deleteExpiredAccounts:', error);
            stats.errors++;
        }
    }

    /**
     * Get job status
     */
    public getStatus(): { running: boolean, scheduled: boolean, isExecuting: boolean } {
        return {
            running: this.cronTask !== null,
            scheduled: this.cronTask !== null,
            isExecuting: this.isRunning
        };
    }
}
