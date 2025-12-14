/**
 * Sync Event Emitter
 * Provides event-based notifications for data synchronization status updates
 */

import { EventEmitter } from 'events';

export enum SyncEventType {
    SYNC_STARTED = 'sync:started',
    SYNC_PROGRESS = 'sync:progress',
    SYNC_REPORT_COMPLETED = 'sync:report:completed',
    SYNC_REPORT_FAILED = 'sync:report:failed',
    SYNC_COMPLETED = 'sync:completed',
    SYNC_FAILED = 'sync:failed',
    SYNC_STATUS_CHANGED = 'sync:status:changed',
}

export interface SyncStartedEvent {
    dataSourceId: number;
    syncId: number;
    reportTypes: string[];
    startedAt: Date;
}

export interface SyncProgressEvent {
    dataSourceId: number;
    syncId: number;
    reportType: string;
    progress: number; // 0-100
    recordsSynced: number;
    recordsFailed: number;
    currentStep: string;
}

export interface SyncReportCompletedEvent {
    dataSourceId: number;
    syncId: number;
    reportType: string;
    recordsSynced: number;
    recordsFailed: number;
    durationMs: number;
}

export interface SyncReportFailedEvent {
    dataSourceId: number;
    syncId: number;
    reportType: string;
    error: string;
    attempt: number;
}

export interface SyncCompletedEvent {
    dataSourceId: number;
    syncId: number;
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
    totalRecordsSynced: number;
    totalRecordsFailed: number;
    durationMs: number;
    completedAt: Date;
}

export interface SyncFailedEvent {
    dataSourceId: number;
    syncId: number;
    error: string;
    failedAt: Date;
}

export interface SyncStatusChangedEvent {
    dataSourceId: number;
    syncId: number;
    oldStatus: string;
    newStatus: string;
    timestamp: Date;
}

/**
 * Singleton event emitter for sync events
 */
export class SyncEventEmitter extends EventEmitter {
    private static instance: SyncEventEmitter;

    private constructor() {
        super();
        this.setMaxListeners(50); // Increase listener limit for multiple clients
    }

    public static getInstance(): SyncEventEmitter {
        if (!SyncEventEmitter.instance) {
            SyncEventEmitter.instance = new SyncEventEmitter();
        }
        return SyncEventEmitter.instance;
    }

    /**
     * Emit sync started event
     */
    public emitSyncStarted(event: SyncStartedEvent): void {
        console.log(`📡 [SyncEvent] Sync started for data source ${event.dataSourceId} (sync ID: ${event.syncId})`);
        this.emit(SyncEventType.SYNC_STARTED, event);
    }

    /**
     * Emit sync progress event
     */
    public emitSyncProgress(event: SyncProgressEvent): void {
        console.log(`📡 [SyncEvent] Progress: ${event.reportType} - ${event.progress}% (${event.recordsSynced} records)`);
        this.emit(SyncEventType.SYNC_PROGRESS, event);
    }

    /**
     * Emit report completed event
     */
    public emitReportCompleted(event: SyncReportCompletedEvent): void {
        console.log(`📡 [SyncEvent] Report completed: ${event.reportType} - ${event.recordsSynced} records in ${event.durationMs}ms`);
        this.emit(SyncEventType.SYNC_REPORT_COMPLETED, event);
    }

    /**
     * Emit report failed event
     */
    public emitReportFailed(event: SyncReportFailedEvent): void {
        console.log(`📡 [SyncEvent] Report failed: ${event.reportType} - ${event.error} (attempt ${event.attempt})`);
        this.emit(SyncEventType.SYNC_REPORT_FAILED, event);
    }

    /**
     * Emit sync completed event
     */
    public emitSyncCompleted(event: SyncCompletedEvent): void {
        console.log(`📡 [SyncEvent] Sync completed for data source ${event.dataSourceId} - Status: ${event.status}`);
        this.emit(SyncEventType.SYNC_COMPLETED, event);
    }

    /**
     * Emit sync failed event
     */
    public emitSyncFailed(event: SyncFailedEvent): void {
        console.log(`📡 [SyncEvent] Sync failed for data source ${event.dataSourceId} - ${event.error}`);
        this.emit(SyncEventType.SYNC_FAILED, event);
    }

    /**
     * Emit status changed event
     */
    public emitStatusChanged(event: SyncStatusChangedEvent): void {
        console.log(`📡 [SyncEvent] Status changed: ${event.oldStatus} → ${event.newStatus}`);
        this.emit(SyncEventType.SYNC_STATUS_CHANGED, event);
    }

    /**
     * Subscribe to sync events for a specific data source
     */
    public subscribeToDataSource(
        dataSourceId: number,
        callback: (eventType: SyncEventType, data: any) => void
    ): () => void {
        const handler = (data: any) => {
            if (data.dataSourceId === dataSourceId) {
                callback(SyncEventType.SYNC_STARTED, data);
            }
        };

        // Subscribe to all event types
        const eventTypes = Object.values(SyncEventType);
        const handlers = eventTypes.map(eventType => {
            const specificHandler = (data: any) => {
                if (data.dataSourceId === dataSourceId) {
                    callback(eventType, data);
                }
            };
            this.on(eventType, specificHandler);
            return { eventType, handler: specificHandler };
        });

        // Return unsubscribe function
        return () => {
            handlers.forEach(({ eventType, handler }) => {
                this.removeListener(eventType, handler);
            });
        };
    }

    /**
     * Get event statistics
     */
    public getStats(): {
        totalListeners: number;
        eventTypes: Record<string, number>;
    } {
        const eventTypes = Object.values(SyncEventType);
        const stats: Record<string, number> = {};

        eventTypes.forEach(eventType => {
            stats[eventType] = this.listenerCount(eventType);
        });

        return {
            totalListeners: eventTypes.reduce((sum, type) => sum + this.listenerCount(type), 0),
            eventTypes: stats,
        };
    }
}
