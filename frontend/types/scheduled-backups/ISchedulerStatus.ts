export interface ISchedulerStatus {
    scheduler_enabled: boolean;
    is_running: boolean;
    current_schedule: string;
    next_run: string | null;
    last_run: string | null;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
}
