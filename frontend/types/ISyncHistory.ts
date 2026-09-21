/**
 * Common sync status/history contract.
 *
 * Every API-backed data source (Google Ads, Google Analytics, Google Ad
 * Manager, Meta Ads, LinkedIn Ads, HubSpot, Klaviyo) exposes the same sync
 * status shape through its `sync-status` endpoint:
 *
 *     { lastSyncTime: string | null, syncHistory: SyncHistoryEntry[] }
 *
 * Entries are TypeORM `sync_history` rows (camelCase). The mapper below also
 * tolerates the legacy snake_case fields (`started_at`, `records_synced`, ...)
 * and the platform-specific variants used by older backends, so a single
 * conversion can render history for every data source.
 */

export interface ISyncHistoryEntry {
    id: number | string;
    syncType?: string;
    status: string;
    startedAt?: string | Date | null;
    completedAt?: string | Date | null;
    durationMs?: number;
    recordsSynced?: number;
    recordsFailed?: number;
    errorMessage?: string | null;
    createdAt?: string | Date | null;
    metadata?: Record<string, any>;
}

export interface ISyncHistoryStatus {
    lastSyncTime: string | null;
    syncHistory: ISyncHistoryEntry[];
}

/**
 * Row shape expected by the SyncHistoryTable component.
 */
export interface ISyncHistoryRow {
    id: number | string;
    sync_started_at: string | null;
    sync_completed_at: string | null;
    status: string;
    rows_synced: number;
    error_message: string | null;
}

/**
 * Normalize a backend sync history entry into the SyncHistoryTable row shape.
 * Handles the common camelCase TypeORM fields, the legacy snake_case fields,
 * and the per-platform variants (`timestamp` / `recordCount` / `error` for
 * LinkedIn, `sync_started` / `sync_completed` for GAM, ...).
 */
export function toSyncHistoryRow(entry: any): ISyncHistoryRow {
    return {
        id: entry.id ?? Math.random(),
        sync_started_at: entry.startedAt || entry.started_at || entry.sync_started_at || entry.sync_started || entry.timestamp || null,
        sync_completed_at: entry.completedAt || entry.completed_at || entry.sync_completed_at || entry.sync_completed || null,
        status: (entry.status || 'pending').toLowerCase(),
        rows_synced: entry.recordsSynced ?? entry.records_synced ?? entry.recordCount ?? entry.rows_synced ?? 0,
        error_message: entry.errorMessage || entry.error_message || entry.error || null,
    };
}

/**
 * Normalize a sync-status endpoint response into the common contract,
 * tolerating backends that still return the legacy snake_case keys.
 */
export function toSyncHistoryStatus(response: any): ISyncHistoryStatus {
    return {
        lastSyncTime: response?.lastSyncTime ?? response?.last_sync ?? null,
        syncHistory: (response?.syncHistory || response?.sync_history || []).map((entry: any) => ({
            id: entry.id,
            syncType: entry.syncType || entry.sync_type,
            status: entry.status,
            startedAt: entry.startedAt ?? entry.started_at ?? null,
            completedAt: entry.completedAt ?? entry.completed_at ?? null,
            durationMs: entry.durationMs ?? entry.duration_ms ?? null,
            recordsSynced: entry.recordsSynced ?? entry.records_synced ?? null,
            recordsFailed: entry.recordsFailed ?? entry.records_failed ?? null,
            errorMessage: entry.errorMessage ?? entry.error_message ?? null,
            createdAt: entry.createdAt ?? entry.created_at ?? null,
            metadata: entry.metadata,
        })),
    };
}
