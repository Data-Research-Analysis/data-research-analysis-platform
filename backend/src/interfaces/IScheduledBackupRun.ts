import { EBackupTriggerType } from '../types/EBackupTriggerType.js';
import { EBackupRunStatus } from '../types/EBackupRunStatus.js';

export interface IScheduledBackupRun {
    id: number;
    backup_id: string | null;
    trigger_type: EBackupTriggerType;
    status: EBackupRunStatus;
    started_at: Date;
    completed_at: Date | null;
    error_message: string | null;
    backup_size_bytes: number | null;
    backup_filepath: string | null;
    triggered_by_user_id: number;
    created_at: Date;
    updated_at: Date;
}

export interface ISchedulerStatus {
    scheduler_enabled: boolean;
    is_running: boolean;
    current_schedule: string;
    next_run: Date | null;
    last_run: Date | null;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
}

export interface ISchedulerConfig {
    schedule: string;
    enabled: boolean;
    retention_days: number;
    system_user_id: number;
}

export interface IBackupStats {
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    avg_duration_seconds: number;
    total_backup_size_bytes: number;
}
