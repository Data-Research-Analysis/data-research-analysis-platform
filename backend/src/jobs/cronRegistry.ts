import type { ScheduledTask } from 'node-cron';

/**
 * Runtime registry for scheduled cron jobs.
 *
 * Each job module registers its node-cron task here when started so the admin
 * jobs page can report whether the job is actually scheduled/running in this
 * process, when it last executed, and whether it was skipped (env-disabled).
 */

interface JobRuntimeInfo {
    task: ScheduledTask | null;
    enabled: boolean;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastFailedAt: string | null;
    lastManualRunAt: string | null;
    lastManualResult: string | null;
}

const runtimes = new Map<string, JobRuntimeInfo>();

export function registerCronTask(key: string, task: ScheduledTask | null, enabled: boolean): void {
    const info: JobRuntimeInfo = {
        task,
        enabled,
        lastStartedAt: null,
        lastFinishedAt: null,
        lastFailedAt: null,
        lastManualRunAt: null,
        lastManualResult: null,
    };

    if (task) {
        task.on('execution:started', () => {
            info.lastStartedAt = new Date().toISOString();
        });
        task.on('execution:finished', () => {
            info.lastFinishedAt = new Date().toISOString();
        });
        task.on('execution:failed', () => {
            info.lastFailedAt = new Date().toISOString();
        });
    }

    runtimes.set(key, info);
}

export function recordManualRun(key: string, resultSummary: string): void {
    const info = runtimes.get(key);
    if (!info) return;
    info.lastManualRunAt = new Date().toISOString();
    info.lastManualResult = resultSummary;
}

export interface CronRuntimeStatus {
    enabled: boolean;
    status: string;
    nextRunAt: string | null;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastFailedAt: string | null;
    lastManualRunAt: string | null;
    lastManualResult: string | null;
}

export async function getCronRuntimeStatus(key: string): Promise<CronRuntimeStatus | null> {
    const info = runtimes.get(key);
    if (!info) return null;

    let status = 'unknown';
    let nextRunAt: string | null = null;

    if (!info.enabled) {
        status = 'disabled';
    } else if (info.task) {
        status = await info.task.getStatus();
        const next = info.task.getNextRun();
        nextRunAt = next ? next.toISOString() : null;
    } else {
        status = 'not-scheduled';
    }

    return {
        enabled: info.enabled,
        status,
        nextRunAt,
        lastStartedAt: info.lastStartedAt,
        lastFinishedAt: info.lastFinishedAt,
        lastFailedAt: info.lastFailedAt,
        lastManualRunAt: info.lastManualRunAt,
        lastManualResult: info.lastManualResult,
    };
}
