export interface IBackupMetadata {
    id: string;
    filename: string;
    filepath: string;
    size: number;
    created_at: Date;
    created_by: number;
    database_name: string;
}
