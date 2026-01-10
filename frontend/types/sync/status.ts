export interface ISyncStatus {
    dataSourceId: number;
    syncId: number;
    status: 'idle' | 'starting' | 'running' | 'completed' | 'failed';
    currentReport?: string;
    progress: number; // 0-100
    recordsSynced: number;
    recordsFailed: number;
    errors: string[];
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
}

export interface ISyncEvent {
    type: string;
    eventType?: string;
    data?: any;
    timestamp: string;
}
