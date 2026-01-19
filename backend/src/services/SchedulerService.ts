import cron from 'node-cron';
import { PostgresDataSource } from '../datasources/PostgresDataSource.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { GoogleAnalyticsService } from './GoogleAnalyticsService.js';
import { GoogleAdManagerService } from './GoogleAdManagerService.js';
import { GoogleAdsService } from './GoogleAdsService.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { In } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

export interface ScheduledSync {
    dataSourceId: number;
    dataSourceName: string;
    schedule: string; // cron expression
    nextRun: Date;
    lastRun?: Date;
    enabled: boolean;
}

/**
 * Background scheduler service for automated data source syncs
 * Runs as a cron job checking for due syncs every minute
 */
export class SchedulerService {
    private static instance: SchedulerService;
    private cronJob: cron.ScheduledTask | null = null;
    private runningSyncs: Map<number, boolean> = new Map(); // Track running syncs to prevent overlaps
    private initialized: boolean = false;

    private constructor() {}

    public static getInstance(): SchedulerService {
        if (!SchedulerService.instance) {
            SchedulerService.instance = new SchedulerService();
        }
        return SchedulerService.instance;
    }

    /**
     * Initialize and start the scheduler
     * Runs every minute to check for due syncs
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            console.log('[Scheduler] Already initialized');
            return;
        }

        console.log('[Scheduler] Initializing background scheduler...');

        // Schedule to run every minute
        this.cronJob = cron.schedule('* * * * *', async () => {
            await this.processDueSyncs();
        }, {
            scheduled: true,
            timezone: 'UTC'
        });

        this.initialized = true;
        console.log('✅ Scheduler service initialized - checking for syncs every minute');
    }

    /**
     * Stop the scheduler
     */
    public stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            this.initialized = false;
            console.log('[Scheduler] Stopped');
        }
    }

    /**
     * Process all data sources that are due for sync
     */
    private async processDueSyncs(): Promise<void> {
        try {
            const host = process.env.POSTGRESQL_HOST || 'localhost';
            const port = parseInt(process.env.POSTGRESQL_PORT || '5432');
            const database = process.env.POSTGRESQL_DB_NAME || 'postgres_dra_db';
            const username = process.env.POSTGRESQL_USERNAME || 'postgres';
            const password = process.env.POSTGRESQL_PASSWORD || 'password';
            const dataSource = PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);

            if (!dataSource.isInitialized) {
                await dataSource.initialize();
            }

            const now = new Date();

            // Find all data sources that are:
            // 1. Enabled for automatic sync
            // 2. Have a schedule configured
            // 3. Next sync time is due (now >= next_scheduled_sync)
            const dueSources = await dataSource
                .getRepository(DRADataSource)
                .createQueryBuilder('ds')
                .where('ds.sync_enabled = :enabled', { enabled: true })
                .andWhere('ds.sync_schedule IS NOT NULL')
                .andWhere('ds.sync_schedule != :manual', { manual: 'manual' })
                .andWhere('ds.next_scheduled_sync <= :now', { now })
                .andWhere('ds.type IN (:...types)', { 
                    types: [
                        EDataSourceType.GOOGLE_ANALYTICS,
                        EDataSourceType.GOOGLE_AD_MANAGER,
                        EDataSourceType.GOOGLE_ADS
                    ] 
                })
                .getMany();

            if (dueSources.length === 0) {
                // Uncomment for debugging: console.log(`[Scheduler] No data sources due for sync`);
                return;
            }

            console.log(`[Scheduler] Found ${dueSources.length} data source(s) due for sync`);

            // Process each due source
            for (const source of dueSources) {
                await this.triggerScheduledSync(source);
            }

        } catch (error: any) {
            console.error('[Scheduler] Error processing due syncs:', error.message);
        }
    }

    /**
     * Trigger a scheduled sync for a specific data source
     */
    private async triggerScheduledSync(dataSource: DRADataSource): Promise<void> {
        // Prevent overlapping syncs
        if (this.runningSyncs.get(dataSource.id)) {
            console.log(`[Scheduler] Sync already running for data source ${dataSource.id}, skipping`);
            return;
        }

        this.runningSyncs.set(dataSource.id, true);

        try {
            console.log(`[Scheduler] ⏰ Triggering scheduled sync for: ${dataSource.display_name} (ID: ${dataSource.id})`);

            // Trigger sync based on data source type
            switch (dataSource.type) {
                case EDataSourceType.GOOGLE_ANALYTICS:
                    await GoogleAnalyticsService.getInstance().sync(dataSource.id);
                    break;

                case EDataSourceType.GOOGLE_AD_MANAGER:
                    await GoogleAdManagerService.getInstance().sync(dataSource.id);
                    break;

                case EDataSourceType.GOOGLE_ADS:
                    await GoogleAdsService.getInstance().sync(dataSource.id);
                    break;

                default:
                    console.warn(`[Scheduler] Unsupported data source type: ${dataSource.type}`);
                    return;
            }

            // Update next scheduled sync time
            await this.updateNextScheduledSync(dataSource);

            console.log(`[Scheduler] ✅ Scheduled sync triggered successfully for: ${dataSource.display_name}`);

        } catch (error: any) {
            console.error(`[Scheduler] ❌ Failed to trigger sync for ${dataSource.display_name}:`, error.message);
        } finally {
            this.runningSyncs.delete(dataSource.id);
        }
    }

    /**
     * Calculate and update the next scheduled sync time for a data source
     */
    private async updateNextScheduledSync(dataSource: DRADataSource): Promise<void> {
        try {
            const host = process.env.POSTGRESQL_HOST || 'localhost';
            const port = parseInt(process.env.POSTGRESQL_PORT || '5432');
            const database = process.env.POSTGRESQL_DB_NAME || 'postgres_dra_db';
            const username = process.env.POSTGRESQL_USERNAME || 'postgres';
            const password = process.env.POSTGRESQL_PASSWORD || 'password';
            const db = PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);

            if (!db.isInitialized) {
                await db.initialize();
            }

            const nextRun = this.calculateNextRun(dataSource.sync_schedule, dataSource.sync_schedule_time);

            await db
                .getRepository(DRADataSource)
                .update(
                    { id: dataSource.id },
                    { 
                        next_scheduled_sync: nextRun,
                        updated_at: new Date()
                    }
                );

            console.log(`[Scheduler] Next sync for ${dataSource.display_name} scheduled for: ${nextRun.toISOString()}`);

        } catch (error: any) {
            console.error(`[Scheduler] Error updating next sync time:`, error.message);
        }
    }

    /**
     * Calculate the next run time based on schedule frequency
     */
    private calculateNextRun(schedule: string, scheduleTime?: Date | string): Date {
        const now = new Date();

        switch (schedule) {
            case 'hourly':
                // Next hour
                return new Date(now.getTime() + 60 * 60 * 1000);

            case 'daily': {
                // Next day at specified time (or midnight if no time specified)
                const nextRun = new Date(now);
                nextRun.setDate(nextRun.getDate() + 1);

                if (scheduleTime) {
                    const time = typeof scheduleTime === 'string' ? new Date(scheduleTime) : scheduleTime;
                    nextRun.setHours(time.getHours(), time.getMinutes(), 0, 0);
                } else {
                    nextRun.setHours(0, 0, 0, 0);
                }

                return nextRun;
            }

            case 'weekly': {
                // Next week same day at specified time
                const nextRun = new Date(now);
                nextRun.setDate(nextRun.getDate() + 7);

                if (scheduleTime) {
                    const time = typeof scheduleTime === 'string' ? new Date(scheduleTime) : scheduleTime;
                    nextRun.setHours(time.getHours(), time.getMinutes(), 0, 0);
                } else {
                    nextRun.setHours(0, 0, 0, 0);
                }

                return nextRun;
            }

            case 'monthly': {
                // Next month same date at specified time
                const nextRun = new Date(now);
                nextRun.setMonth(nextRun.getMonth() + 1);

                if (scheduleTime) {
                    const time = typeof scheduleTime === 'string' ? new Date(scheduleTime) : scheduleTime;
                    nextRun.setHours(time.getHours(), time.getMinutes(), 0, 0);
                } else {
                    nextRun.setHours(0, 0, 0, 0);
                }

                return nextRun;
            }

            default:
                // Default to daily if unknown schedule
                const nextRun = new Date(now);
                nextRun.setDate(nextRun.getDate() + 1);
                nextRun.setHours(0, 0, 0, 0);
                return nextRun;
        }
    }

    /**
     * Get currently running syncs
     */
    public getRunningSyncs(): number[] {
        return Array.from(this.runningSyncs.keys());
    }

    /**
     * Check if scheduler is running
     */
    public isRunning(): boolean {
        return this.initialized && this.cronJob !== null;
    }
}
