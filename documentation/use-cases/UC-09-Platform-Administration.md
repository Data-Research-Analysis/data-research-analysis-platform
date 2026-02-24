# UC-09 — Platform Administration

**Domain:** Platform Administration  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Platform Admin** | Primary Human | Superuser with full system access; all admin routes protected by admin-role check |
| **Scheduler** | Secondary System | Cron/job scheduler triggering automated backup jobs |
| **DatabaseBackupService** | Secondary System | `pg_dump` + ZIP compression + restore operations |
| **QueueService** | Secondary System | Background job queue for async backup/restore |
| **Socket.IO** | Secondary System | Real-time progress events (`backup-progress`) to admin client |
| **Email Service** | Secondary System | Sends transactional and subscription-related emails |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|               Platform Administration                     |
|                                                           |
|  UC-ADM-01  Manage Users                                 |
|  UC-ADM-02  Manage Subscription Tiers                    |
|  UC-ADM-03  View / Manage User Subscriptions             |
|  UC-ADM-04  Manage Private Beta Users (Allowlist)        |
|  UC-ADM-05  Trigger Manual Database Backup               |
|  UC-ADM-06  Restore Database from Backup                 |
|  UC-ADM-07  Configure Scheduled Backups                  |
|  UC-ADM-08  Manage Platform Settings                     |
|  UC-ADM-09  Manage Articles / Blog (CMS)                 |
|  UC-ADM-10  Manage Article Categories                    |
|  UC-ADM-11  Manage Sitemap                               |
|  UC-ADM-12  Manage Account Cancellation Requests         |
|  UC-ADM-13  Upload / Manage Images                       |
+-----------------------------------------------------------+

Platform Admin -----------> All UCs
Scheduler ---------------> UC-ADM-07 (triggers UC-ADM-05)
DatabaseBackupService <---- UC-ADM-05, UC-ADM-06
QueueService <------------- UC-ADM-05, UC-ADM-06
Socket.IO <---------------- UC-ADM-05, UC-ADM-06

<<include>>:
  UC-ADM-05 <<include>> pg_dump Execution
  UC-ADM-05 <<include>> ZIP Compression
  UC-ADM-05 <<include>> Store in backend/private/backups/
  UC-ADM-06 <<include>> Validate ZIP Structure
  UC-ADM-06 <<include>> Drop All Tables CASCADE
  UC-ADM-06 <<include>> Restore SQL Dump
  UC-ADM-07 <<include>> Schedule Backup Job (ScheduledBackupProcessor)

<<extend>>:
  UC-ADM-05 <<extend>> Real-time Progress via Socket.IO
  UC-ADM-06 <<extend>> Real-time Progress via Socket.IO
```

---

## UC-ADM-01 — Manage Users

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-01 |
| **Use Case Name** | Manage Users |
| **Primary Actor** | Platform Admin |
| **Priority** | High |
| **Trigger** | Admin navigates to `/admin/users` |
| **Preconditions** | Actor authenticated with admin role. |
| **Postconditions** | Users listed; admin can view detail, suspend, or delete accounts. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Navigates to user management panel. |
| 2 | Client | `GET /admin/users` — fetches paginated user list. |
| 3 | System | Returns users with subscription tier, status, registration date. |
| 4 | Admin | Selects a user; views detail. |
| 5 | Admin | Optionally: suspends account (`PATCH /admin/users/:id/suspend`) or deletes (`DELETE /admin/users/:id`). |
| 6 | System | Persists status change; returns success. |

### Alternative Flows

**ALT-ADM01A — Delete Admin Account**
- Prevented; HTTP 400: *"Cannot delete admin accounts."*

**ALT-ADM01B — User Not Found**
- HTTP 404.

**ALT-ADM01C — Delete User with Active Subscription**
- System cancels subscription first; then deletes user.

### Business Rules
- BR-ADM-01: Admin accounts cannot be deleted via the admin panel.
- BR-ADM-02: User deletion cascades to projects (if user is sole owner) and membership records.

---

## UC-ADM-02 — Manage Subscription Tiers

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-02 |
| **Use Case Name** | Manage Subscription Tiers |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin navigates to `/admin/subscription-tiers` |
| **Postconditions** | Tiers created/updated/deleted; changes immediately affect tier enforcement for all users. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens subscription tiers panel. |
| 2 | Client | `GET /admin/subscription-tiers` — fetches all tiers. |
| 3 | Admin | Edits tier (name, price, project limit, data source limit, dashboard limit, row limit, AI generation limit). |
| 4 | Client | `PATCH /admin/subscription-tiers/:id`. |
| 5 | System | Validates tier fields; persists; returns updated tier. |

### Alternative Flows

**ALT-ADM02A — Delete Tier with Active Subscribers**
- HTTP 409: *"Cannot delete tier with active subscribers. Migrate users first."*

**ALT-ADM02B — Invalid Tier Limits (negative values)**
- HTTP 422.

---

## UC-ADM-03 — View / Manage User Subscriptions

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-03 |
| **Use Case Name** | View / Manage User Subscriptions |
| **Primary Actor** | Platform Admin |
| **Trigger** | `GET /admin/user-subscriptions` |
| **Postconditions** | Admin can view and override subscription assignments. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens user subscriptions panel. |
| 2 | System | Returns list of `dra_user_subscriptions` joined with user and tier details. |
| 3 | Admin | Selects a user; reassigns tier (`PATCH /admin/user-subscriptions/:userId`). |

### Alternative Flows

**ALT-ADM03A — User Already on Selected Tier**
- Idempotent update; HTTP 200.

---

## UC-ADM-04 — Manage Private Beta Users (Allowlist)

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-04 |
| **Use Case Name** | Manage Private Beta Users |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin navigates to `/admin/private-beta-users` |
| **Postconditions** | Emails added to or removed from `dra_private_beta_users`; only allowlisted emails can register. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens private beta panel. |
| 2 | Client | `GET /admin/private-beta-users` — fetches allowlist. |
| 3 | Admin | Adds email(s) (`POST /admin/private-beta-users`) or removes (`DELETE /admin/private-beta-users/:id`). |
| 4 | System | Updates allowlist; new entries immediately affect registration gate. |

### Alternative Flows

**ALT-ADM04A — Duplicate Email**
- HTTP 409.

---

## UC-ADM-05 — Trigger Manual Database Backup

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-05 |
| **Use Case Name** | Trigger Manual Database Backup |
| **Primary Actor** | Platform Admin |
| **Secondary Actors** | DatabaseBackupService, QueueService, Socket.IO |
| **Priority** | Critical |
| **Trigger** | `POST /admin/database/backup` |
| **Preconditions** | Admin authenticated. No backup currently in progress. |
| **Postconditions (Success)** | ZIP backup file created in `backend/private/backups/`. Metadata JSON included. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Clicks "Backup Now" in the database admin panel. |
| 2 | Client | `POST /admin/database/backup`. |
| 3 | System | Validates admin JWT. |
| 4 | System | Enqueues backup job via `QueueService`. |
| 5 | System | HTTP 202: *"Backup job queued."* |
| 6 | QueueService | Processes job: calls `DatabaseBackupService.createBackup(userId)`. |
| 7 | DatabaseBackupService | Runs `pg_dump`; produces SQL file. |
| 8 | DatabaseBackupService | Creates metadata JSON (`{ timestamp, userId, version, tables }`). |
| 9 | DatabaseBackupService | Compresses SQL + metadata into ZIP with timestamp-based filename. |
| 10 | DatabaseBackupService | Stores in `backend/private/backups/`. |
| 11 | System | Emits `backup-progress` events via Socket.IO at each step. |
| 12 | Admin | Sees real-time progress bar; receives completion notification. |

### Alternative Flows

**ALT-ADM05A — Backup Already in Progress**
- At step 4: HTTP 409: *"A backup is already in progress."*

**ALT-ADM05B — pg_dump Fails**
- At step 7: job fails; `backup-progress` event with `status: error` emitted; admin notified.

**ALT-ADM05C — Insufficient Disk Space**
- At step 9: compression fails; partial files cleaned up; error reported.

### Business Rules
- BR-ADM-03: Backups are processed asynchronously to avoid blocking the HTTP response.
- BR-ADM-04: Backup files must include `metadata.json` alongside the SQL dump.
- BR-ADM-05: Backup filenames include UTC timestamp to ensure uniqueness.

---

## UC-ADM-06 — Restore Database from Backup

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-06 |
| **Use Case Name** | Restore Database from Backup |
| **Primary Actor** | Platform Admin |
| **Secondary Actors** | DatabaseBackupService, QueueService, Socket.IO |
| **Priority** | Critical |
| **Trigger** | `POST /admin/database/restore` with uploaded ZIP file (max 500 MB) |
| **Preconditions** | 1. Admin authenticated. 2. No active backup in progress. 3. ZIP file is a valid platform backup. |
| **Postconditions (Success)** | All tables dropped and recreated; data restored from SQL dump. Platform operational. |
| **Postconditions (Failure)** | Restore aborted; database may be in partial state; admin alerted. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Uploads a backup ZIP file via restore UI. |
| 2 | Client | `POST /admin/database/restore` (multipart; max 500 MB). |
| 3 | System | Validates admin JWT. |
| 4 | System | Multer receives file; validates size ≤ 500 MB. |
| 5 | System | Enqueues restore job via `QueueService`. |
| 6 | System | HTTP 202: *"Restore job queued."* |
| 7 | QueueService | Processes job: calls `DatabaseBackupService.restoreBackup(zipPath, userId)`. |
| 8 | DatabaseBackupService | Extracts ZIP; validates structure (`SQL file + metadata.json` present). |
| 9 | DatabaseBackupService | Validates metadata (schema version compatibility). |
| 10 | DatabaseBackupService | Issues `DROP TABLE ... CASCADE` for all tables. |
| 11 | DatabaseBackupService | Executes SQL dump against database. |
| 12 | DatabaseBackupService | Cleans up temp extraction files. |
| 13 | System | Emits `backup-progress` events throughout. |
| 14 | Admin | Receives completion event; platform fully restored. |

### Alternative Flows

**ALT-ADM06A — Invalid ZIP Structure**
- At step 8: missing SQL file or metadata.json; HTTP 400: *"Invalid backup structure."* Restore aborted.

**ALT-ADM06B — Schema Version Mismatch**
- At step 9: metadata indicates incompatible version; admin warned; restore proceeds with confirmation.

**ALT-ADM06C — SQL Restore Failure**
- At step 11: error in SQL; transaction rolled back where possible; admin alerted with error details.

**ALT-ADM06D — File Exceeds 500 MB**
- At step 4: HTTP 413.

### Business Rules
- BR-ADM-06: Restore drops ALL tables with CASCADE — this is irreversible.
- BR-ADM-07: Restore must not run concurrently with backup.
- BR-ADM-08: Temp files are always cleaned up (success or failure).

---

## UC-ADM-07 — Configure Scheduled Backups

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-07 |
| **Use Case Name** | Configure Scheduled Backups |
| **Primary Actor** | Platform Admin |
| **Secondary Actors** | ScheduledBackupProcessor, Scheduler |
| **Trigger** | Admin configures backup schedule via `/admin/database` settings |
| **Postconditions (Success)** | Cron schedule persisted; `ScheduledBackupProcessor` runs backups on schedule. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Sets backup frequency (daily / weekly / monthly) and retention policy. |
| 2 | Client | `POST /admin/scheduled-backups` with cron expression and retention settings. |
| 3 | System | Persists schedule to `dra_scheduled_backups`. |
| 4 | Scheduler | On trigger: invokes `ScheduledBackupProcessor.runBackup()`. |
| 5 | System | Executes UC-ADM-05 flow; retains N most recent backups per retention policy. |

### Alternative Flows

**ALT-ADM07A — Invalid Cron Expression**
- HTTP 422.

---

## UC-ADM-08 — Manage Platform Settings

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-08 |
| **Use Case Name** | Manage Platform Settings |
| **Primary Actor** | Platform Admin |
| **Trigger** | `GET / PATCH /admin/platform-settings` |
| **Postconditions (Success)** | Global platform configuration updated (e.g., maintenance mode, registration enabled, beta gate toggled). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens platform settings. |
| 2 | Client | `GET /admin/platform-settings` — loads current settings. |
| 3 | Admin | Modifies settings. |
| 4 | Client | `PATCH /admin/platform-settings` with updated values. |
| 5 | System | Validates and persists. |

### Alternative Flows

**ALT-ADM08A — Invalid Setting Value**
- HTTP 422 with field-level errors.

---

## UC-ADM-09 — Manage Articles / Blog (CMS)

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-09 |
| **Use Case Name** | Manage Articles / Blog (CMS) |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin accesses `/admin/articles` |
| **Postconditions** | Articles created, edited, published, or archived. Markdown content supported. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens article management. |
| 2 | Admin | Creates article: title, slug, body (Markdown), category, published flag. |
| 3 | Client | `POST /admin/articles` with article data. |
| 4 | System | `ArticleProcessor.addArticle()` — persists; validates slug uniqueness. |
| 5 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-ADM09A — Duplicate Slug**
- HTTP 409: *"Slug already in use."*

---

## UC-ADM-10 — Manage Article Categories

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-10 |
| **Use Case Name** | Manage Article Categories |
| **Primary Actor** | Platform Admin |
| **Trigger** | `GET/POST/PATCH/DELETE /admin/categories` |
| **Postconditions** | Article categories created, updated, or deleted. |

### Alternative Flows

**ALT-ADM10A — Delete Category with Articles**
- HTTP 409: articles must be recategorised first.

---

## UC-ADM-11 — Manage Sitemap

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-11 |
| **Use Case Name** | Manage Sitemap |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin accesses `/admin/sitemap` |
| **Postconditions** | `sitemap.xml` regenerated and served. |

---

## UC-ADM-12 — Manage Account Cancellation Requests

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-12 |
| **Use Case Name** | Manage Account Cancellation Requests |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin navigates to `/admin/account-cancellations` |
| **Postconditions** | Cancellation requests reviewed; accounts processed for deletion or retention. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens cancellation requests list. |
| 2 | Client | `GET /admin/account-cancellations`. |
| 3 | System | Returns pending requests with user details, subscription, reason. |
| 4 | Admin | Approves cancellation → `POST /admin/account-cancellations/:id/approve`. |
| 5 | System | `AccountCancellationProcessor.processApproval()` — cancels subscription; schedules account deletion; sends confirmation email. |

### Alternative Flows

**ALT-ADM12A — Cancellation Already Processed**
- HTTP 409.

---

## UC-ADM-13 — Upload / Manage Images

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-13 |
| **Use Case Name** | Upload / Manage Images |
| **Primary Actor** | Platform Admin |
| **Trigger** | `POST /admin/images/upload` (multipart) |
| **Postconditions** | Image file saved to backend public assets; URL returned for use in articles/platform content. |

### Alternative Flows

**ALT-ADM13A — Invalid File Type**
- HTTP 400: only JPG/PNG/GIF/WebP accepted.

**ALT-ADM13B — File Too Large**
- HTTP 413.
