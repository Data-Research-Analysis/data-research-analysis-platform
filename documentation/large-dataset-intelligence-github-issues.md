# GitHub Issues: Intelligent Data Model Builder + Large Dataset Protection

---

## Parent Issue (Epic)

### [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

**Labels:** `epic` `enhancement` `data-models` `dashboard` `performance`

**Description:**

Enterprises with large data sources (1M+ rows) currently have no protection against accidentally building unaggregated data models that make the chart builder and dashboard viewer unusable. A poorly structured data model sends millions of raw rows to the browser, crashing the tab before a single chart renders.

This epic makes the data model builder intelligent and self-aware. It detects whether a model is structured correctly for chart building (has aggregation, appropriate WHERE filters, or is a small dimension table), warns the user inline while they build, blocks chart queries at both the backend and frontend if the model is unsafe, and uses AI to suggest targeted fixes when a model is flagged.

**Architecture summary:**

The platform's design intent is correct — the data model IS the OLAP layer and should produce a chart-ready result set (hundreds to thousands of rows). The problem is users who accidentally build unaggregated models against large fact tables. The solution is not to add aggregation at chart query time (a workaround), but to enforce correct model design earlier in the pipeline.

```
Layer 1 — Structural analysis (instant, client-side from query JSON)
    Does the model have aggregation? WHERE clause? What type is it?
    → inline warning in builder while user is building

Layer 2 — Source size check (fast, reads dra_table_metadata)
    What is the total row count of the source tables being joined?
    → if source is large with no aggregation/filter, elevate to block

Layer 3 — Output size enforcement (authoritative, row_count on dra_data_models)
    Set at save time. Blocks chart queries above threshold.
    → backend 422 hard block on chart query endpoint
```

**Sub-issues:**

- [ ] #1 — Migration: add `model_type`, `health_status`, `health_issues`, `source_row_count` to `dra_data_models`
- [ ] #2 — `DataModelHealthService` singleton (pure JSON analysis)
- [ ] #3 — Platform settings: `max_data_model_rows` + `large_source_table_threshold`
- [ ] #4 — Persist health status at model save time
- [ ] #5 — Health API endpoints: `GET /data-model/:id/health` + `PATCH /:id/model-type`
- [ ] #6 — Data model builder: inline health panel + `useDataModelHealth` composable
- [ ] #7 — Data model builder: health warning during preview run
- [ ] #8 — Backend hard block (HTTP 422) in `executeQueryOnDataModel`
- [ ] #9 — Frontend chart builder gate + oversized model modal
- [ ] #10 — AI-assisted model fix: `POST /data-model/:id/suggest-optimization`
- [ ] #11 — Health badge on data model list + detail pages
- [ ] #12 — Post-sync health re-check + notification on threshold crossing
- [ ] #13 — Per-chart independent async loading states in dashboard
- [ ] #14 — Dashboard-level filter bar

**Critical path (minimum viable enforcement):** #1 → #2 → #3 → #4 → #6 → #8 → #9

---

---

## Dependency Graph

```
#3 (platform settings)
    ↓
#1 (migration) ──────────────┐
    ↓                        │
#2 (HealthService) ──────────┤
    ↓                        │
#4 (persist at save) ────────┤
    ↓                        │
#5 (health endpoints)        │
    ↓                        │
#6 (builder health panel) ───┤
    ↓                        │
#7 (preview warnings)        │
                             ↓
#8 (backend 422 block) ─────→#9 (frontend gate + modal)
    ↓                              ↓
#10 (AI suggestions) ◄─────────────┘
    
#11 (health badges) ── depends on #4
#12 (post-sync recheck) ── depends on #2, #4

#13 (async chart loading) ── independent
#14 (filter bar) ── depends on #13
```

## Critical Path (minimum viable enforcement)

`#1 → #2 → #3 → #4 → #6 → #8 → #9`

---

> Sub-issues have been extracted to individual files in `documentation/issues/`:
> [issue-01](issues/issue-01-migration-model-health-columns.md) · [issue-02](issues/issue-02-data-model-health-service.md) · [issue-03](issues/issue-03-platform-settings-thresholds.md) · [issue-04](issues/issue-04-persist-health-status-on-save.md) · [issue-05](issues/issue-05-health-api-endpoints.md) · [issue-06](issues/issue-06-builder-inline-health-panel.md) · [issue-07](issues/issue-07-builder-preview-health-warning.md) · [issue-08](issues/issue-08-backend-hard-block-422.md) · [issue-09](issues/issue-09-frontend-chart-builder-gate.md) · [issue-10](issues/issue-10-ai-assisted-model-fix.md) · [issue-11](issues/issue-11-health-badge-data-model-pages.md) · [issue-12](issues/issue-12-post-sync-health-recheck.md) · [issue-13](issues/issue-13-per-chart-async-loading.md) · [issue-14](issues/issue-14-dashboard-filter-bar.md)

