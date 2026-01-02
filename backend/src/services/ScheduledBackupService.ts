import cron, { ScheduledTask } from 'node-cron';
import { Cron } from 'croner';
import { QueueService } from './QueueService.js';
import { DatabaseBackupService } from './DatabaseBackupService.js';
import { ScheduledBackupProcessor } from '../processors/ScheduledBackupProcessor.js';
import { EBackupTriggerType } from '../types/EBackupTriggerType.js';
import { EBackupRunStatus } from '../types/EBackupRunStatus.js';
import { ISchedulerStatus, ISchedulerConfig } from '../interfaces/IScheduledBackupRun.js';
import { SocketIODriver } from '../drivers/SocketIODriver.js';
import { ISocketEvent } from '../types/ISocketEvent.js';

/**
 * Scheduled Backup Service
 * Manages automated database backups using cron scheduling
 * 
 * Features:
 * - Configurable cron schedule via environment variables
 * - Automatic cleanup of old backups based on retention policy
 * - Start/stop scheduler dynamically
 * - Manual backup triggering
 * - Tracks last and next run times
 */
export class ScheduledBackupService {
    private static instance: ScheduledBackupService;
    private scheduledTask?: ScheduledTask;
    private lastRunTime: Date | null = null;
    private isSchedulerRunning: boolean = false;

    // Configuration from environment variables
    private BACKUP_SCHEDULE: string;
    private BACKUP_ENABLED: boolean;
    private BACKUP_RETENTION_DAYS: number;
    private BACKUP_SYSTEM_USER_ID: number;

    private constructor() {
        // Load configuration from environment
        this.BACKUP_SCHEDULE = process.env.BACKUP_SCHEDULE || '0 0 * * *'; // Default: Daily at midnight
        this.BACKUP_ENABLED = process.env.BACKUP_ENABLED !== 'false'; // Default: enabled
        this.BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
        this.BACKUP_SYSTEM_USER_ID = parseInt(process.env.BACKUP_SYSTEM_USER_ID || '1');

        // Initialize last run time from database
        this.initializeLastRunTime();

        // Start scheduler if enabled
        if (this.BACKUP_ENABLED) {
            this.startScheduler();
        }
    }

    public static getInstance(): ScheduledBackupService {
        if (!ScheduledBackupService.instance) {
            ScheduledBackupService.instance = new ScheduledBackupService();
        }
        return ScheduledBackupService.instance;
    }

    /**
     * Initialize last run time from database
     */
    private async initializeLastRunTime(): Promise<void> {
        try {
            const processor = ScheduledBackupProcessor.getInstance();
            const lastRun = await processor.getLastCompletedRun();
            
            if (lastRun && lastRun.completed_at) {
                this.lastRunTime = lastRun.completed_at;
                console.log(`📅 Last backup run loaded: ${this.lastRunTime.toISOString()}`);
            }
        } catch (error) {
            console.warn('⚠️ Could not load last run time from database:', error);
        }
    }

    /**
     * Start the scheduled backup task
     */
    public startScheduler(): boolean {
        try {
            if (this.scheduledTask) {
                console.log('⚠️ Scheduler already running');
                return false;
            }

            // Validate cron expression
            if (!cron.validate(this.BACKUP_SCHEDULE)) {
                console.error(`❌ Invalid cron expression: ${this.BACKUP_SCHEDULE}`);
                return false;
            }

            this.scheduledTask = cron.schedule(this.BACKUP_SCHEDULE, async () => {
                await this.executeScheduledBackup();
            });

            this.isSchedulerRunning = true;
            console.log(`✅ Scheduled backup service started (schedule: ${this.BACKUP_SCHEDULE})`);
            console.log(`   Next run: ${this.getNextRunTime()?.toISOString()}`);
            
            return true;
        } catch (error) {
            console.error('❌ Error starting scheduler:', error);
            return false;
        }
    }

    /**
     * Stop the scheduled backup task
     */
    public stopScheduler(): boolean {
        try {
            if (!this.scheduledTask) {
                console.log('⚠️ Scheduler not running');
                return false;
            }

            this.scheduledTask.stop();
            this.scheduledTask = undefined;
            this.isSchedulerRunning = false;
            
            console.log('🛑 Scheduled backup service stopped');
            return true;
        } catch (error) {
            console.error('❌ Error stopping scheduler:', error);
            return false;
        }
    }

    /**
     * Check if scheduler is currently running
     */
    public isRunning(): boolean {
        return this.isSchedulerRunning && this.scheduledTask !== undefined;
    }

    /**
     * Update the cron schedule and restart scheduler
     */
    public updateSchedule(cronExpression: string): boolean {
        try {
            // Validate new cron expression
            if (!cron.validate(cronExpression)) {
                console.error(`❌ Invalid cron expression: ${cronExpression}`);
                return false;
            }

            const wasRunning = this.isRunning();
            
            // Stop existing scheduler
            if (wasRunning) {
                this.stopScheduler();
            }

            // Update schedule
            this.BACKUP_SCHEDULE = cronExpression;
            process.env.BACKUP_SCHEDULE = cronExpression;

            // Restart if it was running
            if (wasRunning) {
                return this.startScheduler();
            }

            console.log(`✅ Backup schedule updated to: ${cronExpression}`);
            return true;
        } catch (error) {
            console.error('❌ Error updating schedule:', error);
            return false;
        }
    }

    /**
     * Manually trigger a backup (outside of schedule)
     */
    public async triggerManualBackup(userId: number): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`📅 Manual backup triggered by user ${userId}`);
                
                // Create backup run record
                const processor = ScheduledBackupProcessor.getInstance();
                const backupRun = await processor.createBackupRun(userId, EBackupTriggerType.MANUAL);

                // Update status to processing
                await processor.updateBackupRunStatus(backupRun.id, EBackupRunStatus.PROCESSING);

                // Emit start event
                await SocketIODriver.getInstance().emitEvent(
                    ISocketEvent.SCHEDULED_BACKUP_STARTED,
                    JSON.stringify({
                        run_id: backupRun.id,
                        trigger_type: EBackupTriggerType.MANUAL,
                        timestamp: new Date().toISOString()
                    })
                );

                // Add backup job to queue
                await QueueService.getInstance().addDatabaseBackupJob(userId);

                console.log(`✅ Manual backup job queued (run #${backupRun.id})`);
                resolve();
            } catch (error) {
                console.error('❌ Error triggering manual backup:', error);
                reject(error);
            }
        });
    }

    /**
     * Execute scheduled backup (called by cron)
     */
    private async executeScheduledBackup(): Promise<void> {
        try {
            this.lastRunTime = new Date();
            console.log(`📅 Scheduled backup triggered at ${this.lastRunTime.toISOString()}`);

            // Create backup run record
            const processor = ScheduledBackupProcessor.getInstance();
            const backupRun = await processor.createBackupRun(
                this.BACKUP_SYSTEM_USER_ID, 
                EBackupTriggerType.SCHEDULED
            );

            // Update status to processing
            await processor.updateBackupRunStatus(backupRun.id, EBackupRunStatus.PROCESSING);

            // Emit start event
            await SocketIODriver.getInstance().emitEvent(
                ISocketEvent.SCHEDULED_BACKUP_STARTED,
                JSON.stringify({
                    run_id: backupRun.id,
                    trigger_type: EBackupTriggerType.SCHEDULED,
                    timestamp: this.lastRunTime.toISOString()
                })
            );

            // Add backup job to queue
            await QueueService.getInstance().addDatabaseBackupJob(this.BACKUP_SYSTEM_USER_ID);

            console.log(`✅ Scheduled backup job queued (run #${backupRun.id})`);

            // Cleanup old backups after successful queue
            await this.cleanupOldBackups();
        } catch (error) {
            console.error('❌ Error executing scheduled backup:', error);
        }
    }

    /**
     * Clean up old backup files based on retention policy
     */
    private async cleanupOldBackups(): Promise<void> {
        try {
            const backupService = DatabaseBackupService.getInstance();
            const deletedCount = await backupService.cleanupOldBackups(this.BACKUP_RETENTION_DAYS);
            
            if (deletedCount > 0) {
                console.log(`🧹 Cleaned up ${deletedCount} old backup files (retention: ${this.BACKUP_RETENTION_DAYS} days)`);
            }

            // Also cleanup old backup run records
            const processor = ScheduledBackupProcessor.getInstance();
            const deletedRecords = await processor.deleteOldBackupRuns(this.BACKUP_RETENTION_DAYS);
            
            if (deletedRecords > 0) {
                console.log(`🧹 Cleaned up ${deletedRecords} old backup run records`);
            }
        } catch (error) {
            console.error('⚠️ Error during backup cleanup:', error);
        }
    }

    /**
     * Get next scheduled run time
     */
    public getNextRunTime(): Date | null {
        if (!this.isRunning()) {
            return null;
        }

        try {
            // Parse cron expression to calculate next run using croner
            const cronJob = new Cron(this.BACKUP_SCHEDULE);
            const nextRun = cronJob.nextRun();
            return nextRun || null;
        } catch (error) {
            console.error('Error calculating next run time:', error);
            return null;
        }
    }

    /**
     * Get last run time
     */
    public getLastRunTime(): Date | null {
        return this.lastRunTime;
    }

    /**
     * Get scheduler status
     */
    public async getStatus(): Promise<ISchedulerStatus> {
        const processor = ScheduledBackupProcessor.getInstance();
        const stats = await processor.getBackupStats();

        return {
            scheduler_enabled: this.BACKUP_ENABLED,
            is_running: this.isRunning(),
            current_schedule: this.BACKUP_SCHEDULE,
            next_run: this.getNextRunTime(),
            last_run: this.getLastRunTime(),
            total_runs: stats.total_runs,
            successful_runs: stats.successful_runs,
            failed_runs: stats.failed_runs
        };
    }

    /**
     * Get scheduler configuration
     */
    public getConfig(): ISchedulerConfig {
        return {
            schedule: this.BACKUP_SCHEDULE,
            enabled: this.BACKUP_ENABLED,
            retention_days: this.BACKUP_RETENTION_DAYS,
            system_user_id: this.BACKUP_SYSTEM_USER_ID
        };
    }

    /**
     * Update scheduler configuration
     */
    public async updateConfig(config: Partial<ISchedulerConfig>): Promise<void> {
        if (config.schedule !== undefined && config.schedule !== this.BACKUP_SCHEDULE) {
            this.updateSchedule(config.schedule);
        }

        if (config.enabled !== undefined && config.enabled !== this.BACKUP_ENABLED) {
            this.BACKUP_ENABLED = config.enabled;
            process.env.BACKUP_ENABLED = config.enabled.toString();
            
            if (config.enabled && !this.isRunning()) {
                this.startScheduler();
            } else if (!config.enabled && this.isRunning()) {
                this.stopScheduler();
            }
        }

        if (config.retention_days !== undefined) {
            this.BACKUP_RETENTION_DAYS = config.retention_days;
            process.env.BACKUP_RETENTION_DAYS = config.retention_days.toString();
        }

        if (config.system_user_id !== undefined) {
            this.BACKUP_SYSTEM_USER_ID = config.system_user_id;
            process.env.BACKUP_SYSTEM_USER_ID = config.system_user_id.toString();
        }

        console.log('✅ Scheduler configuration updated');
    }
}
