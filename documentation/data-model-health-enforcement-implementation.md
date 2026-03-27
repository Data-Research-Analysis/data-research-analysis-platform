# Intelligent Data Model Health Enforcement & Large Dataset Protection

## Overview

This document summarises the complete implementation of the **DRA-281** epic — a multi-layer system that detects, warns about, and blocks data models that are too large or structurally unsuitable for the chart builder, and uses AI to suggest targeted fixes.

**Branch:** `DRA-281-Intelligent-Data-Model-Builder-Large-Dataset-Protection`

---

## Architecture: Three-Layer Enforcement

```
Layer 1 — Structural analysis (instant, from query JSON)
    Does the model have aggregation? WHERE clause? What type is it?
    → inline warning in builder while user is building

Layer 2 — Source size check (fast, reads dra_table_metadata)
    What is the total row count of the source tables being joined?
    → if source is large with no aggregation/filter, block is triggered

Layer 3 — Output size enforcement (authoritative, row_count on dra_data_models)
    Set at save time. Blocks chart queries above threshold.
    → backend HTTP 422 hard block on chart query endpoint
```

The core design principle: **the data model IS the OLAP layer**. Fix is enforcing correct model design upstream — not adding aggregation at chart query time.

---

## Implementation Summary

### Issue #1 — Migration: Health Columns (`a5d1f7e4`)

Added four columns to `dra_data_models`:

| Column | Type | Purpose |
|---|---|---|
| `model_type` | `varchar(50) NULLABLE` | User/AI classification: `dimension`, `fact`, `aggregated` |
| `health_status` | `varchar(50) DEFAULT 'unknown'` | Computed status: `healthy`, `warning`, `blocked`, `unknown` |
| `health_issues` | `jsonb DEFAULT '[]'` | Serialised `IHealthIssue[]` from `DataModelHealthService` |
| `source_row_count` | `bigint NULLABLE` | Cached total rows across all source tables |

**Files changed:** TypeORM migration, `DRADataModel` entity, `IDataModel` frontend type.

---

### Issue #2 — `DataModelHealthService` (`b978bb64`)

Created `backend/src/services/DataModelHealthService.ts` — a singleton that analyses a data model's structural query JSON and source metadata to produce an `IDataModelHealthReport`.

**Key methods:**
- `analyse(query, modelType, sourceMeta, maxOutputRows, largeSourceThreshold)` — pure synchronous analysis
- `recomputeAndPersist(dataModelId)` — queries live row counts + source metadata, runs analysis, persists `health_status`/`health_issues`/`source_row_count`/`row_count`
- `loadThresholds()` — reads `max_data_model_rows` and `large_source_table_threshold` from platform settings

**Status determination logic:**
- `healthy` — output rows ≤ threshold, source acceptable, model type handled
- `warning` — large source detected with insufficient aggregation/filtering  
- `blocked` — output rows exceed hard limit, or large unfiltered source identified as fact table
- `unknown` — analysis failed or no data

---

### Issue #3 — Platform Settings Thresholds (`58952f87`)

Added two configurable platform settings:

| Key | Default | Description |
|---|---|---|
| `max_data_model_rows` | `100000` | Output row count above which a model is `blocked` |
| `large_source_table_threshold` | `500000` | Source table row count triggering structural checks |

Settings are managed via `/admin/platform-settings` and seeded by default.

---

### Issue #4 — Persist Health at Save Time (`61e7a32d`)

Modified `DataModelProcessor` build and update paths to call `DataModelHealthService.recomputeAndPersist()` after every successful model save. Health status is always fresh immediately after a build.

---

### Issue #5 — Health API Endpoints (`201f6f18`)

Two new REST endpoints:

```
GET  /data-model/:id/health
    → Returns { persisted, live, stale } — both cached and freshly-computed health reports

PATCH /data-model/:id/model-type
    → Updates model_type (dimension|fact|aggregated|null) and recomputes health
```

Both endpoints use `requireDataModelPermission` for RBAC enforcement.

---

### Issue #6 — Builder Inline Health Panel + `useDataModelHealth` Composable (`886a9711`)

Created `frontend/composables/useDataModelHealth.ts` — polls `GET /data-model/:id/health` and exposes reactive `healthStatus`, `healthIssues`, `sourceRowCount`, `rowCount`, `stale`.

Added an inline health panel to `data-model-builder.vue` that renders:
- Green banner for healthy models
- Amber panel with issue list for warning models
- Red pulsing panel with blocking issues for blocked models
- Model type selector (dimension / fact / aggregated) always visible

---

### Issue #7 — Builder Preview Health Warning (`479d2ebd`)

Added two UX gates to the builder's "Run Query" / "Save Model" flow:

1. **Pre-run confirmation dialog** — if health status is `warning` or `blocked`, a SweetAlert modal warns user before executing a preview query
2. **Post-run blocked warning banner** — if the model is `blocked` after saving, a persistent banner appears at the top of the builder pointing back to the health panel

---

### Issue #8 — Backend Hard Block HTTP 422 (`959e88b0`)

Modified `DataModelProcessor.executeQueryOnDataModel()` to accept an optional `dataModelId` parameter. Before executing, it performs a pre-flight health check:

- Loads the `DRADataModel` entity
- If `health_status` is `blocked` (and row_count exceeds threshold), throws `DataModelOversizedException`

Created `backend/src/types/errors/DataModelOversizedException.ts` — extends `Error`, carries `modelId`, `modelName`, `rowCount`, `sourceRowCount`, `healthStatus`, `healthIssues`, `threshold`.

The route handler catches `DataModelOversizedException` and returns:
```json
HTTP 422
{ "error": "DATA_MODEL_OVERSIZED", "modelId": ..., "modelName": ..., "rowCount": ..., ... }
```

---

### Issue #9 — Frontend Chart Builder Gate + Oversized Model Modal (`6b46912f`)

**Sidebar gate (`components/sidebar.vue`):**
- Blocked models: red-themed row with "Too large for charts", row count badge, disabled column list (`opacity-50 pointer-events-none`), "Fix this model" NuxtLink
- Warning models: amber border + triangle icon — still interactive
- All models receive `health_status`, `model_type`, `source_row_count` from `IDataModelTable`

**Oversized model modal (dashboard `index.vue`):**
- `executeQueryOnDataModels()` and `openTableDialog()` both catch HTTP 422 with `error: 'DATA_MODEL_OVERSIZED'`
- Opens a full blocking modal with:
  - Red header with model name and row/threshold summary
  - Health issues list (amber cards each with title, description, recommendation)
  - Footer: "Fix this model" NuxtLink, "Ask AI" button, admin-only session bypass, dismiss

---

### Issue #10 — AI-Assisted Model Fix Suggestions (`139d089b`)

**Backend:**
Added `DataModelProcessor.suggestModelOptimization(dataModelId)`:
- Loads model + health issues + SQL query
- Builds a structured prompt for Gemini: model name, row counts, health issues list, current SQL
- Calls `GeminiService` via `initializeConversation` + `sendMessage`
- Strips markdown fences, JSON-parses response
- Validates each `revisedSQL` starts with `SELECT` (injection guard)
- Returns `{ analysis: string; suggestions: Array<{ description, revisedSQL }> }` (max 3)

Added `POST /data-model/:id/suggest-optimization` with `aiOperationsLimiter`.

**Frontend:**
- Added `pendingSQLSuggestion` ref + `setPendingSQLSuggestion`/`clearPendingSQLSuggestion` to `data_models` Pinia store
- Oversized model modal: "Ask AI" button triggers `askAIToSuggestFix()` → loading spinner → AI analysis paragraph + suggestion cards with "Apply" button
- `applyAISuggestion(suggestion)` stores pending SQL to store and navigates to the builder edit page

---

### Issue #11 — Builder Pre-fill from AI Suggestion Store (`23e1dea3`)

Both data model edit pages (`/data-sources/.../edit.vue` and `/data-models/[id]/edit.vue`) now check `dataModelsStore.pendingSQLSuggestion` in `onMounted`. If a matching suggestion exists for the current `dataModelId`:

- Populates `state.ai_suggestion = { description, sql }`
- Clears the store entry
- Renders a purple "AI Suggestion Applied" banner above the builder with the description, the revised SQL in a monospace pre block, and a dismiss button

The user copies the revised SQL and pastes it directly into the builder's SQL editor, then rebuilds.

---

### Issue #12 — Admin Health Dashboard Page (`a5e42be6`)

**Backend:**
- Created `backend/src/routes/admin/data_model_health.ts` with:
  - `GET /admin/data-model-health/summary` — returns per-status counts + top 100 problem models (blocked/warning) with project name and owner email
  - `POST /admin/data-model-health/reanalyze` — triggers `runDataModelHealthReanalysis()` fire-and-forget
- Extended `AdminStatsProcessor.getOverviewStats()` to include `dataModelHealth` counts via `IAdminOverviewStats`

**Frontend:**
- New page `frontend/pages/admin/data-model-health.vue`:
  - Summary stat cards (healthy / warning / blocked / unknown)
  - Filterable problem models table with expandable health issue details per model
  - "Re-analyze All" button (fires `POST /admin/data-model-health/reanalyze`)
  - "View project data models" link per model
- Added Data Model Health section to `frontend/pages/admin/index.vue` linking to `/admin/data-model-health`

---

### Issue #13 — Nightly Health Re-analysis Cron Job (`0e3b22b5`)

Created `backend/src/jobs/reanalyzeDataModelHealth.ts`:
- `startDataModelHealthReanalysisJob()` — registers a `node-cron` schedule at `0 2 * * *` (02:00 UTC); respects `HEALTH_REANALYSIS_ENABLED=false` env flag
- `runDataModelHealthReanalysis()` — exported; iterates all `dra_data_models`, calls `DataModelHealthService.recomputeAndPersist()` per model, logs updated/failed counts

Registered in `backend/src/index.ts` startup sequence alongside the invitation expiration job.

---

## File Inventory

### New Backend Files

| File | Purpose |
|---|---|
| `backend/src/types/errors/DataModelOversizedException.ts` | Typed exception for oversized model hard block |
| `backend/src/services/DataModelHealthService.ts` | Health analysis singleton |
| `backend/src/routes/admin/data_model_health.ts` | Admin health summary + manual reanalyze endpoints |
| `backend/src/jobs/reanalyzeDataModelHealth.ts` | Nightly cron job for health re-analysis |

### Modified Backend Files

| File | Changes |
|---|---|
| `backend/src/models/DRADataModel.ts` | +4 health columns |
| `backend/src/processors/DataModelProcessor.ts` | Persist health on save; pre-flight 422 gate; suggestModelOptimization() |
| `backend/src/routes/data_model.ts` | GET /:id/health; PATCH /:id/model-type; POST /:id/suggest-optimization; 422 catch |
| `backend/src/processors/AdminStatsProcessor.ts` | +dataModelHealth to IAdminOverviewStats |
| `backend/src/index.ts` | Mount admin health route; register nightly cron job |
| `backend/src/migrations/` | Migration adding health columns |

### New Frontend Files

| File | Purpose |
|---|---|
| `frontend/composables/useDataModelHealth.ts` | Reactive health polling composable |
| `frontend/pages/admin/data-model-health.vue` | Admin health dashboard |

### Modified Frontend Files

| File | Changes |
|---|---|
| `frontend/types/IDataModel.ts` | +health fields |
| `frontend/types/IDataModelTable.ts` | +`health_status`, `model_type`, `source_row_count` |
| `frontend/stores/data_models.ts` | +`pendingSQLSuggestion` ref + set/clear actions |
| `frontend/components/data-model-builder.vue` | Inline health panel; pre-run dialog; post-run banner |
| `frontend/components/sidebar.vue` | Blocked/warning visual gates with disabled columns |
| `frontend/pages/projects/[projectid]/dashboards/[dashboardid]/index.vue` | Oversized model modal; 422 catch; AI suggestion flow |
| `frontend/pages/projects/[projectid]/data-sources/[datasourceid]/data-models/[datamodelid]/edit.vue` | AI suggestion banner |
| `frontend/pages/projects/[projectid]/data-models/[id]/edit.vue` | AI suggestion banner |
| `frontend/pages/admin/index.vue` | +Data Model Health section |

---

## Commit History

| Hash | Issue | Summary |
|---|---|---|
| `a5d1f7e4` | #1 | Migration: health columns on dra_data_models |
| `b978bb64` | #2 | DataModelHealthService singleton |
| `58952f87` | #3 | Platform settings: thresholds |
| `61e7a32d` | #4 | Persist health status on every model save |
| `201f6f18` | #5 | Health API endpoints |
| `886a9711` | #6 | Builder inline health panel + composable |
| `479d2ebd` | #7 | Builder preview health warning |
| `959e88b0` | #8 | Backend hard block HTTP 422 |
| `6b46912f` | #9 | Frontend chart builder gate + oversized modal |
| `139d089b` | #10 | AI-assisted model fix suggestions |
| `23e1dea3` | #11 | Builder pre-fill from AI suggestion store |
| `a5e42be6` | #12 | Admin health dashboard page |
| `0e3b22b5` | #13 | Nightly health re-analysis cron job |

---

## Configuration

All runtime behaviour is controlled by platform settings and environment variables:

| Setting / Env Var | Default | Effect |
|---|---|---|
| `max_data_model_rows` (platform settings) | `100000` | Hard block threshold for output row count |
| `large_source_table_threshold` (platform settings) | `500000` | Source row count threshold for structural checks |
| `HEALTH_REANALYSIS_ENABLED` (env) | `true` | Set to `false` to disable nightly cron job |

---

## Testing Checklist

- [ ] Build a large unaggregated model → health_status = `blocked` after save
- [ ] Add GROUP BY aggregation → health_status improves to `warning` or `healthy`
- [ ] Mark model as `dimension` type → health check bypasses row-count enforcement
- [ ] Dashboard chart query on blocked model → returns HTTP 422, modal appears
- [ ] "Ask AI" in modal → suggestion cards appear with revised SQL
- [ ] "Apply" suggestion → navigates to builder edit page with AI banner
- [ ] Admin `/admin/data-model-health` → shows blocked/warning models correctly
- [ ] "Re-analyze All" button → returns immediately, health updates after background run
- [ ] Nightly cron schedule confirmed at 02:00 UTC in server logs
- [ ] `HEALTH_REANALYSIS_ENABLED=false` suppresses cron registration
