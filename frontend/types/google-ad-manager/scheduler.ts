export interface IScheduledJob {
  dataSourceId: number;
  dataSourceName?: string;
  schedule: string; // cron expression
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  runCount: number;
}

export interface ISchedulerStats {
  totalJobs: number;
  enabledJobs: number;
  disabledJobs: number;
  totalRuns: number;
  lastJobRun: string | null;
}
