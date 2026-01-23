import { DataModelRefreshService, RefreshOptions, RefreshResult } from "./DataModelRefreshService.js";
import EventEmitter from 'events';

export interface RefreshJob {
    id: string;
    dataModelId: number;
    options: RefreshOptions;
    priority: number; // 1 = highest (user), 2 = medium (scheduled), 3 = low (cascade)
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    result?: RefreshResult;
    error?: string;
    retryCount: number;
    maxRetries: number;
}

export class RefreshQueueService extends EventEmitter {
    private static instance: RefreshQueueService;
    private queue: RefreshJob[] = [];
    private runningJobs: Map<string, RefreshJob> = new Map();
    private completedJobs: Map<string, RefreshJob> = new Map();
    private maxConcurrentJobs: number = 3;
    private isProcessing: boolean = false;
    private jobIdCounter: number = 0;

    private constructor() {
        super();
    }

    public static getInstance(): RefreshQueueService {
        if (!RefreshQueueService.instance) {
            RefreshQueueService.instance = new RefreshQueueService();
        }
        return RefreshQueueService.instance;
    }

    /**
     * Add a single refresh job to the queue
     */
    public async addJob(dataModelId: number, options: RefreshOptions): Promise<string> {
        const jobId = this.generateJobId();
        const priority = this.getPriority(options.triggeredBy);

        const job: RefreshJob = {
            id: jobId,
            dataModelId,
            options,
            priority,
            status: 'pending',
            createdAt: new Date(),
            retryCount: 0,
            maxRetries: 3
        };

        this.queue.push(job);
        this.sortQueue();

        console.log(`[RefreshQueue] Job ${jobId} added for model ${dataModelId} (priority: ${priority}, queue size: ${this.queue.length})`);

        // Emit job added event
        this.emit('job:added', {
            jobId,
            dataModelId,
            priority,
            queueSize: this.queue.length
        });

        // Start processing if not already running
        if (!this.isProcessing) {
            this.startProcessing();
        }

        return jobId;
    }

    /**
     * Add multiple refresh jobs to the queue
     */
    public async queueRefreshForModels(modelIds: number[], options: RefreshOptions): Promise<string[]> {
        const jobIds: string[] = [];

        for (const modelId of modelIds) {
            const jobId = await this.addJob(modelId, options);
            jobIds.push(jobId);
        }

        console.log(`[RefreshQueue] Queued ${jobIds.length} models for refresh`);
        return jobIds;
    }

    /**
     * Get the status of a job
     */
    public getJobStatus(jobId: string): RefreshJob | undefined {
        // Check running jobs
        if (this.runningJobs.has(jobId)) {
            return this.runningJobs.get(jobId);
        }

        // Check completed jobs
        if (this.completedJobs.has(jobId)) {
            return this.completedJobs.get(jobId);
        }

        // Check pending jobs
        return this.queue.find(job => job.id === jobId);
    }

    /**
     * Get queue statistics
     */
    public getQueueStats() {
        return {
            pending: this.queue.length,
            running: this.runningJobs.size,
            completed: this.completedJobs.size,
            maxConcurrent: this.maxConcurrentJobs,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Clear completed jobs (for cleanup)
     */
    public clearCompletedJobs(olderThanMinutes: number = 60): void {
        const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
        const beforeSize = this.completedJobs.size;

        for (const [jobId, job] of this.completedJobs.entries()) {
            if (job.completedAt && job.completedAt < cutoffTime) {
                this.completedJobs.delete(jobId);
            }
        }

        const clearedCount = beforeSize - this.completedJobs.size;
        if (clearedCount > 0) {
            console.log(`[RefreshQueue] Cleared ${clearedCount} completed jobs older than ${olderThanMinutes} minutes`);
        }
    }

    /**
     * Start processing the queue
     */
    private async startProcessing(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        console.log(`[RefreshQueue] Starting queue processing (max concurrent: ${this.maxConcurrentJobs})`);

        while (this.queue.length > 0 || this.runningJobs.size > 0) {
            // Process jobs while under concurrency limit
            while (this.runningJobs.size < this.maxConcurrentJobs && this.queue.length > 0) {
                const job = this.getNextJob();
                if (job) {
                    this.processJob(job);
                }
            }

            // Wait a bit before checking again
            await this.sleep(500);
        }

        this.isProcessing = false;
        console.log(`[RefreshQueue] Queue processing stopped (queue empty)`);
    }

    /**
     * Get the next job from the queue (highest priority first)
     */
    private getNextJob(): RefreshJob | undefined {
        if (this.queue.length === 0) {
            return undefined;
        }

        // Queue is already sorted by priority
        return this.queue.shift();
    }

    /**
     * Process a single job
     */
    private async processJob(job: RefreshJob): Promise<void> {
        job.status = 'running';
        job.startedAt = new Date();
        this.runningJobs.set(job.id, job);

        console.log(`[RefreshQueue] Processing job ${job.id} for model ${job.dataModelId} (running: ${this.runningJobs.size}/${this.maxConcurrentJobs})`);

        // Emit job started event
        this.emit('job:started', {
            jobId: job.id,
            dataModelId: job.dataModelId
        });

        try {
            const refreshService = DataModelRefreshService.getInstance();
            const result = await refreshService.refreshDataModel(job.dataModelId, job.options);

            job.result = result;

            if (result.success) {
                job.status = 'completed';
                console.log(`[RefreshQueue] ✅ Job ${job.id} completed successfully`);

                // Emit job completed event
                this.emit('job:completed', {
                    jobId: job.id,
                    dataModelId: job.dataModelId,
                    result
                });
            } else {
                // Job failed, retry if possible
                if (job.retryCount < job.maxRetries) {
                    job.retryCount++;
                    console.log(`[RefreshQueue] ⚠️ Job ${job.id} failed, retrying (${job.retryCount}/${job.maxRetries})`);
                    
                    // Re-queue with exponential backoff
                    await this.sleep(Math.pow(2, job.retryCount) * 1000);
                    job.status = 'pending';
                    this.queue.push(job);
                    this.sortQueue();
                    
                    this.runningJobs.delete(job.id);
                    return;
                } else {
                    job.status = 'failed';
                    job.error = result.error;
                    console.error(`[RefreshQueue] ❌ Job ${job.id} failed after ${job.maxRetries} retries`);

                    // Emit job failed event
                    this.emit('job:failed', {
                        jobId: job.id,
                        dataModelId: job.dataModelId,
                        error: result.error
                    });
                }
            }

        } catch (error: any) {
            job.status = 'failed';
            job.error = error.message;
            console.error(`[RefreshQueue] ❌ Job ${job.id} threw exception:`, error.message);

            // Emit job failed event
            this.emit('job:failed', {
                jobId: job.id,
                dataModelId: job.dataModelId,
                error: error.message
            });
        } finally {
            job.completedAt = new Date();
            this.runningJobs.delete(job.id);
            this.completedJobs.set(job.id, job);

            console.log(`[RefreshQueue] Job ${job.id} finished (queue: ${this.queue.length}, running: ${this.runningJobs.size})`);
        }
    }

    /**
     * Sort queue by priority (1 = highest)
     */
    private sortQueue(): void {
        this.queue.sort((a, b) => {
            // First sort by priority (lower number = higher priority)
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            // Then by creation time (FIFO for same priority)
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
    }

    /**
     * Get priority based on trigger type
     */
    private getPriority(triggeredBy: RefreshOptions['triggeredBy']): number {
        switch (triggeredBy) {
            case 'user':
                return 1; // Highest priority
            case 'schedule':
                return 2; // Medium priority
            case 'cascade':
                return 3; // Low priority
            case 'api':
                return 2; // Medium priority
            default:
                return 3;
        }
    }

    /**
     * Generate unique job ID
     */
    private generateJobId(): string {
        this.jobIdCounter++;
        return `refresh_job_${Date.now()}_${this.jobIdCounter}`;
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
