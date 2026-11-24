/**
 * Sync window resolution for API-backed data sources.
 *
 * The stored sync window on a data source lives in
 * `connection_details.api_connection_details.api_config` and is expressed in
 * one of two mutually exclusive forms:
 *
 *  - rolling:  `sync_window_days` (and optionally `sync_window_preset`) — the
 *              window is N days back from "today" on every sync, so scheduled
 *              syncs always bring the most recent data.
 *  - fixed:    `start_date` / `end_date` — an explicit historical range used
 *              for one-off backfills; the window never moves.
 *
 * Drivers call `resolveSyncWindow` instead of reading `start_date`/`end_date`
 * directly so both forms behave consistently across source types.
 */
export interface IResolvedSyncWindow {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
}

export interface ISyncWindowConfig {
    window_type?: 'rolling' | 'fixed';
    sync_window_days?: number;
    sync_window_preset?: string;
    start_date?: string;
    end_date?: string;
}

/** Format a Date as YYYY-MM-DD (local time, matching the connect wizards). */
function toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function daysAgoIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toIsoDate(d);
}

function todayIso(): string {
    return toIsoDate(new Date());
}

/**
 * Resolve the effective date window from an api_config.
 *
 * Resolution order:
 *  1. `sync_window_days` set → rolling window (today - N → today)
 *  2. `start_date`/`end_date` set → fixed window
 *  3. neither → 30-day rolling default
 */
export function resolveSyncWindow(apiConfig?: Partial<ISyncWindowConfig>): IResolvedSyncWindow {
    const config = apiConfig || {};

    if (config.sync_window_days && config.sync_window_days > 0) {
        return {
            startDate: daysAgoIso(config.sync_window_days),
            endDate: todayIso(),
        };
    }

    if (config.start_date && config.end_date) {
        return {
            startDate: config.start_date,
            endDate: config.end_date,
        };
    }

    return {
        startDate: daysAgoIso(30),
        endDate: todayIso(),
    };
}

/**
 * Build the normalized config payload to persist for a chosen window form.
 * Rolling configs store the day count; fixed configs store the explicit dates.
 */
export function buildSyncWindowConfig(
    windowType: 'rolling' | 'fixed',
    syncWindowDays: number | null,
    startDate: string | null,
    endDate: string | null
): ISyncWindowConfig {
    if (windowType === 'fixed' && startDate && endDate) {
        return {
            window_type: 'fixed',
            start_date: startDate,
            end_date: endDate,
            sync_window_days: undefined,
            sync_window_preset: undefined,
        };
    }

    const days = syncWindowDays && syncWindowDays > 0 ? syncWindowDays : 30;
    return {
        window_type: 'rolling',
        sync_window_days: days,
        sync_window_preset: days === 7 ? 'last_7_days' : days === 30 ? 'last_30_days' : days === 90 ? 'last_90_days' : days === 365 ? 'last_365_days' : 'custom',
        start_date: undefined,
        end_date: undefined,
    };
}
