/**
 * Google Ad Manager Scheduler Interfaces
 */

export interface ScheduledJob {
    id: number;
    dataSourceId: number;
    dataSourceName: string;
    reportTypes: string[];
    schedule: string;
    nextRun: string;
    lastRun?: string;
    status: 'active' | 'paused' | 'error';
}

export interface SchedulerStats {
    totalJobs: number;
    activeJobs: number;
    pausedJobs: number;
    errorJobs: number;
    jobsRunToday: number;
    avgExecutionTime: number;
}
