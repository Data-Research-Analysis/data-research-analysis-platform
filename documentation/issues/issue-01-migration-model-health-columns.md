# Issue #1 — Migration: `model_type`, `health_status`, `health_issues`, `source_row_count` on `dra_data_models`

**Labels:** `migration` `backend` `critical`
**Size:** Small | **Track:** Intelligence | **Depends on:** nothing
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

The `dra_data_models` table needs four new columns to support health tracking and model classification. These columns are consumed by every other issue in this epic — they must land first.

- `model_type` — user or AI assigned classification: `'dimension' | 'fact' | 'aggregated' | null`. Dimension models bypass all aggregation enforcement checks.
- `health_status` — computed by `DataModelHealthService`: `'healthy' | 'warning' | 'blocked' | 'unknown'`. Persisted at model save time so it is readable anywhere without re-computation.
- `health_issues` — `JSONB` array of `IHealthIssue` objects describing exactly which checks failed and what the user should do. Persisted so the chart builder can surface them in a modal without a second API call.
- `source_row_count` — cached sum of all source table row counts from `dra_table_metadata`. Stored so the model list and dashboard can display source size without a JOIN.

---

## Acceptance Criteria

- [ ] TypeORM migration adds all four columns with correct types and defaults
- [ ] `DRADataModel` entity updated with the four new fields and correct TypeScript types
- [ ] `IDRADataModel` TypeScript interface updated
- [ ] Migration runs cleanly with `npm run migration:run` against an existing database (existing rows receive defaults: `model_type = NULL`, `health_status = 'unknown'`, `health_issues = '[]'`, `source_row_count = NULL`)
- [ ] Migration is reversible with `npm run migration:revert`

---

## Files to Change

- `backend/src/migrations/` — new migration file `AddModelHealthToDRADataModels`
- `backend/src/models/DRADataModel.ts`
- `backend/src/types/IDataModel.ts` (or equivalent interface file)
