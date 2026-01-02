import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAScheduledBackupRun } from '../models/DRAScheduledBackupRun.js';
import { EBackupTriggerType } from '../types/EBackupTriggerType.js';
import { EBackupRunStatus } from '../types/EBackupRunStatus.js';
import { IScheduledBackupRun, IBackupStats } from '../interfaces/IScheduledBackupRun.js';

/**
 * Processor for Scheduled Backup Run Management
 * Handles all business logic for backup run tracking and history
 */
export class ScheduledBackupProcessor {
    private static instance: ScheduledBackupProcessor;

    private constructor() {}

    public static getInstance(): ScheduledBackupProcessor {
        if (!ScheduledBackupProcessor.instance) {
            ScheduledBackupProcessor.instance = new ScheduledBackupProcessor();
        }
        return ScheduledBackupProcessor.instance;
    }

    /**
     * Create a new backup run record
     */
    public async createBackupRun(
        userId: number, 
        triggerType: EBackupTriggerType
    ): Promise<DRAScheduledBackupRun> {
        return new Promise<DRAScheduledBackupRun>(async (resolve, reject) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    throw new Error('Database driver not available');
                }

                const manager = concreteDriver.manager;
                
                const backupRun = new DRAScheduledBackupRun();
                backupRun.triggered_by_user_id = userId;
                backupRun.trigger_type = triggerType;
                backupRun.status = EBackupRunStatus.QUEUED;
                backupRun.started_at = new Date();

                const savedRun = await manager.save(backupRun);
                console.log(`✅ Created backup run #${savedRun.id} (${triggerType})`);
                
                resolve(savedRun);
            } catch (error) {
                console.error('Error creating backup run:', error);
                reject(error);
            }
        });
    }

    /**
     * Update backup run status and details
     */
    public async updateBackupRunStatus(
        runId: number,
        status: EBackupRunStatus,
        data?: Partial<DRAScheduledBackupRun>
    ): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    throw new Error('Database driver not available');
                }

                const manager = concreteDriver.manager;
                
                const updateData: any = {
                    status,
                    ...data
                };

                // Set completion time for completed/failed status
                if (status === EBackupRunStatus.COMPLETED || status === EBackupRunStatus.FAILED) {
                    updateData.completed_at = new Date();
                }

                await manager.update(DRAScheduledBackupRun, { id: runId }, updateData);
                console.log(`✅ Updated backup run #${runId} to status: ${status}`);
                
                resolve();
            } catch (error) {
                console.error('Error updating backup run status:', error);
                reject(error);
            }
        });
    }

    /**
     * Get backup runs with pagination and filtering
     */
    public async getBackupRuns(
        page: number = 1,
        limit: number = 20,
        filters?: { status?: EBackupRunStatus; trigger_type?: EBackupTriggerType; }
    ): Promise<{ runs: DRAScheduledBackupRun[], total: number }> {
        return new Promise(async (resolve, reject) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    throw new Error('Database driver not available');
                }

                const manager = concreteDriver.manager;
                const skip = (page - 1) * limit;

                const queryBuilder = manager
                    .createQueryBuilder(DRAScheduledBackupRun, 'run')
                    .leftJoinAndSelect('run.triggered_by_user', 'user')
                    .orderBy('run.started_at', 'DESC');

                // Apply filters
                if (filters?.status) {
                    queryBuilder.andWhere('run.status = :status', { status: filters.status });
                }
                if (filters?.trigger_type) {
                    queryBuilder.andWhere('run.trigger_type = :trigger_type', { trigger_type: filters.trigger_type });
                }

                const [runs, total] = await queryBuilder
                    .skip(skip)
                    .take(limit)
                    .getManyAndCount();

                resolve({ runs, total });
            } catch (error) {
                console.error('Error fetching backup runs:', error);
                reject(error);
            }
        });
    }

    /**
     * Get a single backup run by ID
     */
    public async getBackupRunById(runId: number): Promise<DRAScheduledBackupRun | null> {
        return new Promise(async (resolve, reject) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    throw new Error('Database driver not available');
                }

                const manager = concreteDriver.manager;
                
                const run = await manager.findOne(DRAScheduledBackupRun, {
                    where: { id: runId },
                    relations: ['triggered_by_user']
                });

                resolve(run);
            } catch (error) {
                console.error('Error fetching backup run by ID:', error);
                reject(error);
            }
        });
    }

    /**
     * Get backup statistics
     */
    public async getBackupStats(): Promise<IBackupStats> {
        return new Promise(async (resolve, reject) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    throw new Error('Database driver not available');
                }

                const manager = concreteDriver.manager;
                
                const totalRuns = await manager.count(DRAScheduledBackupRun);
                
                const successfulRuns = await manager.count(DRAScheduledBackupRun, {
                    where: { status: EBackupRunStatus.COMPLETED }
                });
                
                const failedRuns = await manager.count(DRAScheduledBackupRun, {
                    where: { status: EBackupRunStatus.FAILED }
                });

                // Calculate average duration for completed runs
                const completedRuns = await manager.find(DRAScheduledBackupRun, {
                    where: { status: EBackupRunStatus.COMPLETED },
                    select: ['started_at', 'completed_at']
                });

                let avgDuration = 0;
                if (completedRuns.length > 0) {
                    const totalDuration = completedRuns.reduce((sum, run) => {
                        if (run.completed_at) {
                            const duration = (new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000;
                            return sum + duration;
                        }
                        return sum;
                    }, 0);
                    avgDuration = Math.round(totalDuration / completedRuns.length);
                }

                // Calculate total backup size
                const result = await manager
                    .createQueryBuilder(DRAScheduledBackupRun, 'run')
                    .select('SUM(run.backup_size_bytes)', 'total')
                    .where('run.status = :status', { status: EBackupRunStatus.COMPLETED })
                    .getRawOne();

                const totalBackupSize = parseInt(result?.total || '0');

                const stats: IBackupStats = {
                    total_runs: totalRuns,
                    successful_runs: successfulRuns,
                    failed_runs: failedRuns,
                    avg_duration_seconds: avgDuration,
                    total_backup_size_bytes: totalBackupSize
                };

                resolve(stats);
            } catch (error) {
                console.error('Error calculating backup stats:', error);
                reject(error);
            }
        });
    }

    /**
     * Get the most recent completed backup run
     */
    public async getLastCompletedRun(): Promise<DRAScheduledBackupRun | null> {
        return new Promise(async (resolve, reject) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    throw new Error('Database driver not available');
                }

                const manager = concreteDriver.manager;

                const lastRun = await manager
                    .createQueryBuilder(DRAScheduledBackupRun, 'run')
                    .where('run.status = :status', { status: EBackupRunStatus.COMPLETED })
                    .orderBy('run.completed_at', 'DESC')
                    .limit(1)
                    .getOne();

                resolve(lastRun);
            } catch (error) {
                console.error('Error getting last completed run:', error);
                reject(error);
            }
        });
    }

    /**
     * Delete old backup run records
     */
    public async deleteOldBackupRuns(olderThanDays: number): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
                const concreteDriver = await driver.getConcreteDriver();
                if (!concreteDriver) {
                    throw new Error('Database driver not available');
                }

                const manager = concreteDriver.manager;
                
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

                const result = await manager
                    .createQueryBuilder()
                    .delete()
                    .from(DRAScheduledBackupRun)
                    .where('started_at < :cutoffDate', { cutoffDate })
                    .execute();

                const deletedCount = result.affected || 0;
                console.log(`🧹 Deleted ${deletedCount} old backup run records (older than ${olderThanDays} days)`);

                resolve(deletedCount);
            } catch (error) {
                console.error('Error deleting old backup runs:', error);
                reject(error);
            }
        });
    }
}
