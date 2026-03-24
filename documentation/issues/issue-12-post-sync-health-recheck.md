# Issue #12 — Post-sync health re-check + notification on threshold crossing

**Labels:** `backend` `scheduler` `notifications` `high`
**Size:** Small | **Track:** Enforcement | **Depends on:** #2, #4
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

A data model that was chart-ready (8,000 rows) after one sync may become blocked (3M rows) after the next sync brings in a year of new data. The platform must detect this transition and notify the model owner before they discover it when trying to build a chart.

### A — Post-refresh recount hook in `DataModelProcessor.triggerCascadeRefresh()`

After the model refresh completes, call `DataModelHealthService.getInstance().recomputeAndPersist(dataModelId)`. This runs `SELECT COUNT(*) FROM "schema"."name"` on the local physical table (fast — not the remote source), re-runs the full health analysis, and persists updated fields.

### B — Threshold transition detection in `recomputeAndPersist()`

Compare old vs new `health_status`:
- `healthy/warning → blocked`: model just became oversized after a sync
- `blocked → healthy/warning`: model has recovered (e.g. user applied a fix and data synced)

### C — Notifications

Two new entries in `NotificationTypes.ts`:
- `data_model_oversized_after_sync`
- `data_model_chart_ready_after_sync`

**Notification message — oversized transition:**
> **"[Raw Events Table] is now too large for chart building"**
> After today's sync, this model now contains 3,247,891 rows — above your platform limit of 50,000. Charts using this model have been paused. [Fix this model →]

**Notification message — recovery:**
> **"[Raw Events Table] is now chart-ready"**
> After today's sync, this model contains 42,000 rows — within the 50,000 row limit. Charts using this model will work normally.

`NotificationProcessor.getInstance().createNotification()` called for the model owner following the existing notification pattern.

---

## Acceptance Criteria

- [ ] `triggerCascadeRefresh()` calls `recomputeAndPersist()` after refresh completes
- [ ] `recomputeAndPersist()` correctly detects `healthy/warning → blocked` transitions
- [ ] `recomputeAndPersist()` correctly detects `blocked → healthy/warning` transitions
- [ ] `data_model_oversized_after_sync` notification sent on oversized transition
- [ ] `data_model_chart_ready_after_sync` notification sent on recovery transition
- [ ] Notifications are sent only to the model owner (not all project members)
- [ ] Transition detection failure does not break the sync flow — errors are logged and suppressed

---

## Files to Change

- `backend/src/services/DataModelHealthService.ts` — `recomputeAndPersist()` method with transition detection
- `backend/src/processors/DataModelProcessor.ts` — call `recomputeAndPersist()` in `triggerCascadeRefresh()`
- `backend/src/types/NotificationTypes.ts` — two new notification type entries
