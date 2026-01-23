import cron from 'node-cron';
import { PostgresDataSource } from '../datasources/PostgresDataSource.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { EUserType } from '../types/EUserType.js';
import { ITokenDetails } from '../types/ITokenDetails.js';
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
            timezone: 'UTC'
        });
        
        this.cronJob.start();

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
                .leftJoinAndSelect('ds.users_platform', 'up')
                .where('ds.sync_enabled = :enabled', { enabled: true })
                .andWhere('ds.sync_schedule IS NOT NULL')
                .andWhere('ds.sync_schedule != :manual', { manual: 'manual' })
                .andWhere('ds.next_scheduled_sync <= :now', { now })
                .andWhere('ds.data_type IN (:...types)', { 
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
            console.log(`[Scheduler] ⏰ Triggering scheduled sync for: ${dataSource.name} (ID: ${dataSource.id})`);

            const processor = DataSourceProcessor.getInstance();

            // Get API connection details for OAuth token information
            const apiConnectionDetails = dataSource.connection_details?.api_connection_details;
            if (!apiConnectionDetails) {
                console.error(`[Scheduler] No API connection details found for data source ${dataSource.id}`);
                return;
            }

            // Get user details from database
            if (!dataSource.users_platform?.id) {
                console.error(`[Scheduler] No user associated with data source ${dataSource.id}`);
                return;
            }

            const host = process.env.POSTGRESQL_HOST || 'localhost';
            const port = parseInt(process.env.POSTGRESQL_PORT || '5432');
            const database = process.env.POSTGRESQL_DB_NAME || 'postgres_dra_db';
            const username = process.env.POSTGRESQL_USERNAME || 'postgres';
            const password = process.env.POSTGRESQL_PASSWORD || 'password';
            const db = PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);

            if (!db.isInitialized) {
                await db.initialize();
            }

            const user = await db.getRepository(DRAUsersPlatform).findOne({
                where: { id: dataSource.users_platform.id }
            });

            if (!user) {
                console.error(`[Scheduler] User not found for data source ${dataSource.id}`);
                return;
            }

            // Build token details for sync
            const tokenDetails: ITokenDetails = {
                user_id: user.id,
                email: user.email,
                user_type: EUserType.NORMAL,
                iat: Math.floor(Date.now() / 1000)
            };

            // Trigger sync based on data source type
            switch (dataSource.data_type) {
                case EDataSourceType.GOOGLE_ANALYTICS:
                    await processor.syncGoogleAnalyticsDataSource(dataSource.id, tokenDetails);
                    break;

                case EDataSourceType.GOOGLE_AD_MANAGER:
                    await processor.syncGoogleAdManagerDataSource(dataSource.id, tokenDetails);
                    break;

                case EDataSourceType.GOOGLE_ADS:
                    await processor.syncGoogleAdsDataSource(dataSource.id, user.id);
                    break;

                default:
                    console.warn(`[Scheduler] Unsupported data source type: ${dataSource.data_type}`);
                    return;
            }

            // Update next scheduled sync time
            await this.updateNextScheduledSync(dataSource);

            console.log(`[Scheduler] ✅ Scheduled sync triggered successfully for: ${dataSource.name}`);

        } catch (error: any) {
            console.error(`[Scheduler] ❌ Failed to trigger sync for ${dataSource.name}:`, error.message);
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

            const nextRun = this.calculateNextRun(
                (dataSource as any).sync_schedule,
                (dataSource as any).sync_schedule_time
            );

            await db
                .getRepository(DRADataSource)
                .createQueryBuilder()
                .update()
                .set({
                    next_scheduled_sync: nextRun,
                    created_at: new Date()
                } as any)
                .where('id = :id', { id: dataSource.id })
                .execute();

            console.log(`[Scheduler] Next sync for ${dataSource.name} scheduled for: ${nextRun.toISOString()}`);

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
