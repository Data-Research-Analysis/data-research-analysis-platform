export interface IBackupRun {
    id: number;
    backup_id: string | null;
    trigger_type: 'scheduled' | 'manual';
    status: 'queued' | 'processing' | 'completed' | 'failed';
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
    backup_size_bytes: number | null;
    backup_filepath: string | null;
    triggered_by_user_id: number;
    created_at: string;
    updated_at: string;
}
