# Issue #4 — Persist health status at model save time

**Labels:** `backend` `critical`
**Size:** Small | **Track:** Intelligence | **Depends on:** #1, #2, #3
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

Wire `DataModelHealthService` into the existing `DataModelProcessor.updateDataModelOnQuery()` save flow so that every model save automatically computes and persists its health status. The row count is also stored here — this is zero-cost since `rows` is already in memory from the INSERT.

### Changes to `updateDataModelOnQuery()` after the INSERT completes

**1. Store row count:**
```typescript
dataModel.row_count = rows.length;
dataModel.last_refreshed_at = new Date();
```

**2. Resolve source metadata and run health analysis:**
```typescript
const queryParsed = JSON.parse(queryJSON);
const sourceMeta = await DataModelHealthService.getInstance().resolveSourceTableMeta(queryParsed);
const threshold = await PlatformSettingsService.getInstance().getNumber('max_data_model_rows', 50000);
const largeSourceThreshold = await PlatformSettingsService.getInstance().getNumber('large_source_table_threshold', 100000);
const report = DataModelHealthService.getInstance().analyse(queryParsed, dataModel.model_type, sourceMeta, threshold, largeSourceThreshold);
```

**3. Persist health fields:**
```typescript
dataModel.health_status = report.overallStatus;
dataModel.health_issues = report.issues;
dataModel.source_row_count = sourceMeta.reduce((s, t) => s + (t.rowCount ?? 0), 0);
```

**4. Override with authoritative output row count:** If `rows.length > threshold`, force `health_status = 'blocked'` and append a `ROW_COUNT_EXCEEDS_THRESHOLD` issue to `health_issues` — even if the SQL structure analysis returned `warning`.

---

## Acceptance Criteria

- [ ] `row_count` is set on every model save (not just health-flagged models)
- [ ] `health_status`, `health_issues`, and `source_row_count` are persisted on every save
- [ ] A model that passes structural analysis but whose output exceeds `max_data_model_rows` is stored as `blocked`
- [ ] Health analysis failure (e.g. `dra_table_metadata` lookup error) does not prevent the model save — it logs a warning and falls back to `health_status = 'unknown'`
- [ ] Existing model saves are not broken (backward compatible)

---

## Files to Change

- `backend/src/processors/DataModelProcessor.ts` — `updateDataModelOnQuery()` method
