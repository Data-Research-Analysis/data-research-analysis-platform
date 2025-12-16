/**
 * Scheduler Service
 * Manages scheduled Google Ad Manager data synchronization jobs
 */

import cron, { ScheduledTask } from 'node-cron';
import { GoogleAdManagerDriver } from '../drivers/GoogleAdManagerDriver.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { SyncConfigValidator } from '../types/IAdvancedSyncConfig.js';

export interface ScheduledJob {
    dataSourceId: number;
    schedule: string;
    task: ScheduledTask;
    enabled: boolean;
    connectionDetails: IAPIConnectionDetails;
    lastRun?: Date;
    nextRun?: Date;
    runCount: number;
}

export class SchedulerService {
    private static instance: SchedulerService;
    private jobs: Map<number, ScheduledJob> = new Map();
    private gamDriver: GoogleAdManagerDriver;
    private dataSourceProcessor: DataSourceProcessor;

    private constructor() {
        this.gamDriver = GoogleAdManagerDriver.getInstance();
        this.dataSourceProcessor = DataSourceProcessor.getInstance();
        console.log('✅ SchedulerService initialized');
    }

    public static getInstance(): SchedulerService {
        if (!SchedulerService.instance) {
            SchedulerService.instance = new SchedulerService();
        }
        return SchedulerService.instance;
    }

    /**
     * Initialize scheduler by loading all data sources with schedules
     */
    async initialize(): Promise<void> {
        try {
            console.log('🔄 Scheduler service initialized and ready');
            console.log('ℹ️  Jobs will be scheduled automatically when advanced sync config is saved');
            // Jobs are scheduled via API when users save advanced sync configuration
            // This method exists for future expansion (e.g., loading persisted schedules)
        } catch (error) {
            console.error('❌ Failed to initialize scheduler:', error);
            throw error;
        }
    }

    /**
     * Schedule a sync job for a data source
     */
    async scheduleJob(
        dataSourceId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        try {
            // Validate advanced config exists
            if (!connectionDetails.api_config?.advanced_sync_config?.frequency) {
                console.warn(`⚠️  No sync frequency configured for data source ${dataSourceId}`);
                return false;
            }

            const { frequency } = connectionDetails.api_config.advanced_sync_config;
            
            // Skip manual frequency
            if (frequency.type === 'manual') {
                console.log(`ℹ️  Data source ${dataSourceId} is set to manual sync`);
                return false;
            }

            // Get cron expression
            const cronExpression = SyncConfigValidator.getCronExpression(frequency);
            
            if (!cronExpression) {
                console.error(`❌ Failed to generate cron expression for data source ${dataSourceId}`);
                return false;
            }

            // Validate cron expression
            if (!cron.validate(cronExpression)) {
                console.error(`❌ Invalid cron expression: ${cronExpression}`);
                return false;
            }

            // Cancel existing job if exists
            if (this.jobs.has(dataSourceId)) {
                await this.cancelJob(dataSourceId);
            }

            // Create scheduled task
            const task = cron.schedule(
                cronExpression,
                async () => {
                    await this.executeJob(dataSourceId, connectionDetails);
                },
                {
                    timezone: 'UTC'
                }
            );
            task.start();

            // Store job information
            this.jobs.set(dataSourceId, {
                dataSourceId,
                schedule: cronExpression,
                task,
                enabled: true,
                connectionDetails,
                runCount: 0,
                nextRun: this.getNextRunTime(cronExpression)
            });

            console.log(`✅ Scheduled job for data source ${dataSourceId} with cron: ${cronExpression}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to schedule job for data source ${dataSourceId}:`, error);
            return false;
        }
    }

    /**
     * Execute a scheduled sync job
     */
    private async executeJob(
        dataSourceId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<void> {
        const job = this.jobs.get(dataSourceId);
        if (!job) {
            console.error(`❌ Job not found for data source ${dataSourceId}`);
            return;
        }

        try {
            console.log(`🔄 Executing scheduled sync for data source ${dataSourceId}`);
            
            job.lastRun = new Date();
            job.runCount++;
            job.nextRun = this.getNextRunTime(job.schedule);

            // Execute sync
            const success = await this.gamDriver.syncToDatabase(dataSourceId, connectionDetails);

            if (success) {
                console.log(`✅ Scheduled sync completed successfully for data source ${dataSourceId}`);
            } else {
                console.error(`❌ Scheduled sync failed for data source ${dataSourceId}`);
            }
        } catch (error) {
            console.error(`❌ Error executing scheduled sync for data source ${dataSourceId}:`, error);
        }
    }

    /**
     * Cancel a scheduled job
     */
    async cancelJob(dataSourceId: number): Promise<boolean> {
        try {
            const job = this.jobs.get(dataSourceId);
            
            if (!job) {
                console.warn(`⚠️  No scheduled job found for data source ${dataSourceId}`);
                return false;
            }

            job.task.stop();
            this.jobs.delete(dataSourceId);
            
            console.log(`✅ Cancelled scheduled job for data source ${dataSourceId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to cancel job for data source ${dataSourceId}:`, error);
            return false;
        }
    }

    /**
     * Pause a scheduled job
     */
    async pauseJob(dataSourceId: number): Promise<boolean> {
        try {
            const job = this.jobs.get(dataSourceId);
            
            if (!job) {
                console.warn(`⚠️  No scheduled job found for data source ${dataSourceId}`);
                return false;
            }

            if (!job.enabled) {
                console.warn(`⚠️  Job ${dataSourceId} is already paused`);
                return false;
            }

            job.task.stop();
            job.enabled = false;
            
            console.log(`⏸️  Paused scheduled job for data source ${dataSourceId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to pause job for data source ${dataSourceId}:`, error);
            return false;
        }
    }

    /**
     * Resume a paused job
     */
    async resumeJob(dataSourceId: number): Promise<boolean> {
        try {
            const job = this.jobs.get(dataSourceId);
            
            if (!job) {
                console.warn(`⚠️  No scheduled job found for data source ${dataSourceId}`);
                return false;
            }

            if (job.enabled) {
                console.warn(`⚠️  Job ${dataSourceId} is already running`);
                return false;
            }

            job.task.start();
            job.enabled = true;
            job.nextRun = this.getNextRunTime(job.schedule);
            
            console.log(`▶️  Resumed scheduled job for data source ${dataSourceId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to resume job for data source ${dataSourceId}:`, error);
            return false;
        }
    }

    /**
     * Manually trigger a scheduled job immediately
     */
    async triggerJob(dataSourceId: number): Promise<boolean> {
        try {
            const job = this.jobs.get(dataSourceId);
            
            if (!job) {
                console.warn(`⚠️  No scheduled job found for data source ${dataSourceId}`);
                return false;
            }

            console.log(`🚀 Manually triggering job for data source ${dataSourceId}`);

            // Execute job using stored connection details
            await this.executeJob(dataSourceId, job.connectionDetails);
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to trigger job for data source ${dataSourceId}:`, error);
            return false;
        }
    }

    /**
     * Update a job's schedule
     */
    async updateJobSchedule(
        dataSourceId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<boolean> {
        try {
            // Cancel existing job
            await this.cancelJob(dataSourceId);
            
            // Schedule with new configuration
            return await this.scheduleJob(dataSourceId, connectionDetails);
        } catch (error) {
            console.error(`❌ Failed to update job schedule for data source ${dataSourceId}:`, error);
            return false;
        }
    }

    /**
     * Get all scheduled jobs
     */
    getScheduledJobs(): Array<{
        dataSourceId: number;
        schedule: string;
        enabled: boolean;
        lastRun?: Date;
        nextRun?: Date;
        runCount: number;
    }> {
        return Array.from(this.jobs.values()).map(job => ({
            dataSourceId: job.dataSourceId,
            schedule: job.schedule,
            enabled: job.enabled,
            lastRun: job.lastRun,
            nextRun: job.nextRun,
            runCount: job.runCount
        }));
    }

    /**
     * Get job information for a specific data source
     */
    getJob(dataSourceId: number): {
        dataSourceId: number;
        schedule: string;
        enabled: boolean;
        lastRun?: Date;
        nextRun?: Date;
        runCount: number;
    } | null {
        const job = this.jobs.get(dataSourceId);
        
        if (!job) {
            return null;
        }

        return {
            dataSourceId: job.dataSourceId,
            schedule: job.schedule,
            enabled: job.enabled,
            lastRun: job.lastRun,
            nextRun: job.nextRun,
            runCount: job.runCount
        };
    }

    /**
     * Get next run time for a cron expression
     */
    private getNextRunTime(cronExpression: string): Date | undefined {
        try {
            // Parse cron and calculate next run
            // This is a simplified version - node-cron doesn't expose this directly
            const now = new Date();
            const nextRun = new Date(now.getTime() + 60000); // Placeholder: +1 minute
            return nextRun;
        } catch (error) {
            console.error('❌ Failed to calculate next run time:', error);
            return undefined;
        }
    }

    /**
     * Get scheduler statistics
     */
    getStats(): {
        totalJobs: number;
        activeJobs: number;
        pausedJobs: number;
        totalRuns: number;
    } {
        const jobs = Array.from(this.jobs.values());
        
        return {
            totalJobs: jobs.length,
            activeJobs: jobs.filter(j => j.enabled).length,
            pausedJobs: jobs.filter(j => !j.enabled).length,
            totalRuns: jobs.reduce((sum, j) => sum + j.runCount, 0)
        };
    }

    /**
     * Stop all scheduled jobs (for graceful shutdown)
     */
    async shutdown(): Promise<void> {
        console.log('🛑 Shutting down scheduler...');
        
        for (const [dataSourceId, job] of this.jobs.entries()) {
            try {
                job.task.stop();
                console.log(`✅ Stopped job for data source ${dataSourceId}`);
            } catch (error) {
                console.error(`❌ Error stopping job for data source ${dataSourceId}:`, error);
            }
        }
        
        this.jobs.clear();
        console.log('✅ Scheduler shutdown complete');
    }
}

// Export singleton instance
export const schedulerService = SchedulerService.getInstance();
