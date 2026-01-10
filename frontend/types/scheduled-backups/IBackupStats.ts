export interface IBackupStats {
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    avg_duration_seconds: number;
    total_backup_size_bytes: number;
}
