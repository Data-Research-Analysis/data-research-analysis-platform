# 08 — Background Jobs & Queues

## Overview

Background processing is layered: **cron jobs** (node-cron), a **persistent queue** (theta-mn-queue) driving **worker threads**, and **in-process schedulers/pollers**. All are started from `backend/src/index.ts`.

## Cron jobs (`backend/src/jobs/`, started in `index.ts` lines 193–236)

| Job | Schedule (UTC) | Purpose | Disable |
|---|---|---|---|
| `cleanupWebhookEventsJob` | `0 3 * * 0` (Sunday) | Hard-delete **processed** Paddle webhook payloads older than 90 days (GDPR storage limitation); unprocessed retained | — |
| `expireInvitations` | `0 * * * *` (hourly) | Mark 7-day-expired project invitations expired (`InvitationService.expireOldInvitations`) | — |
| `expiredSubscriptionDowngradeJob` | `0 3 * * *` (daily) | Downgrade cancelled-and-ended Paddle subscriptions to FREE (`SubscriptionProcessor.processExpiredCancelledSubscriptions`) | — |
| `paymentMethodExpiryJob` | `0 9 1 * *` (1st of month) | Email owners when card expires next calendar month | — |
| `reanalyzeDataModelHealth` | `0 2 * * *` (daily) | Recompute health for every data model (`DataModelHealthService.recomputeAndPersist`) | `HEALTH_REANALYSIS_ENABLED=false` |
| `subscriptionGracePeriodJob` | `0 2 * * *` (daily) | Expire grace periods to FREE + reminder emails at 7/3/1 days | — |

Non-cron worker: **`EmailFunnelWorker`** — `setInterval` 5 min (immediate first run), `processReadySteps()` + `processBroadcasts()`, daily cap `EMAIL_FUNNEL_DAILY_LIMIT` (default 200). Gated by `EMAIL_FUNNEL_ENABLED`.

## Queue architecture (`QueueService`, theta-mn-queue)

7 named queues, initialized and **purged on startup**:

1. `DRAPdfConversionQueue` — `addPDFConversionJob(fileName)`
2. `DRATextExtractionQueue` — `addTextExtractionJob(fileName)`
3. `DRAFileDeletionQueue` — `addFilesDeletionJob(userId)`
4. `DRADatabaseBackupQueue` — `addDatabaseBackupJob(userId)`
5. `DRADatabaseRestoreQueue` — `addDatabaseRestoreJob(zipFilePath, userId)`
6. `DRAMongoDBSyncQueue` — `addMongoDBSyncJob(dataSourceId, syncType, userId)`
7. `DRAExcelUploadQueue` — `addExcelUploadJob({userId, projectId, dataSourceName, fileId, data})`

`run()` polls every `QUEUE_STATUS_INTERVAL` (default 5000 ms) and dispatches:
- PDF/TextExtraction/FileDeletion/Backup/Restore → `WorkerService.runWorker(EOperation, ...)` (worker thread)
- Mongo sync → inline `MongoDBImportService.importDataSource` (batch 1000, adaptive, incremental)
- Excel → `processExcelUploadJob` (3 retries, 2 s/4 s/8 s backoff, Socket.IO progress)

> Note: `QueueService.run()` is invoked both inside `UtilityService.initialize()` and again in `index.ts` — potential double start (workers are idempotent-ish).

## Worker threads (`WorkerService` + `workers/service.js`)

`runWorker()` spawns `worker_threads.Worker` at `workers/service.js` (imports from `../../dist/` — a TS build is required in production). Five operations:

- `PDF_TO_IMAGES` — Ghostscript `gs -dNOSAFER -dNOPAUSE -sDEVICE=pnggray -dBATCH -r600` (600 DPI grayscale PNGs)
- `EXTRACT_TEXT_FROM_IMAGE` — S3 upload + AWS Textract (`AmazonTextExtractDriver` → `CPage/CLine/CWord`)
- `DELETE_FILES(userId)` — per-user upload cleanup
- `DATABASE_BACKUP(userId)` — `DatabaseBackupService.createBackup()` (pg_dump)
- `DATABASE_RESTORE(zipFilePath, userId)` — restore with progress callback

Completion messages post back to the main thread (`*_COMPLETE`, `SCHEDULED_BACKUP_*`, `DATABASE_RESTORE_PROGRESS`), then `SCHEDULED_BACKUP_COMPLETED/FAILED` Socket.IO events.

## Schedulers

- **`SchedulerService`** — every-minute data-source sync cron (see [07 — Integrations](07-integrations.md)). Only GA4/GAM/Google Ads/Meta eligible. Gated by `SYNC_SCHEDULER_ENABLED`.
- **`ScheduledBackupService`** — `BACKUP_SCHEDULE` (default `0 0 * * *`), `BACKUP_ENABLED`, `BACKUP_RETENTION_DAYS` (default 30); creates run records, enqueues backup jobs, cleans old backups; next-run via `croner`.
- **`ScheduledDeletionJob`** — daily 02:00 account-cancellation lifecycle (7-day/1-day warnings → `DataDeletionService.deleteUserData`). Gated by `SCHEDULED_DELETION_ENABLED` + platform setting `auto_delete_enabled`.
- **`RefreshQueueService`** — in-memory priority queue for data-model refresh (max 3 concurrent; priorities user=1, schedule/api=2, cascade=3; 3 retries exponential). **Per-process only.**
- **`PlanExecutionEngine`** — durable plan loop (see [06 — AI & Plan Studio](06-ai-plan-studio.md)); 60 s heartbeat, 45-min stale-running heal, guest-plan TTL cleanup.
- **`OAuthSessionService`** — 30-min orphan-session cleanup interval.

## Job/env toggles (all checked at boot)

`BACKUP_ENABLED`, `SYNC_SCHEDULER_ENABLED`, `SCHEDULED_DELETION_ENABLED`, `EMAIL_FUNNEL_ENABLED`, `HEALTH_REANALYSIS_ENABLED`, `RATE_LIMIT_ENABLED`, `PLAN_ANALYTICS_ENABLED`, `BACKUP_SCHEDULE`.

## Notable caveats

- In-memory schedulers/queues are single-process; multi-instance deployments won't share queue state, concurrency limits, or the refresh queue.
- Manual admin triggers for billing jobs: `POST /admin/jobs/expired-subscriptions`, `POST /admin/jobs/grace-periods`.
