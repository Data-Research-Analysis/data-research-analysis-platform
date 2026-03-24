# Issue #6 — Data model builder: inline health panel + `useDataModelHealth` composable

**Labels:** `frontend` `ux` `critical`
**Size:** Medium | **Track:** Intelligence | **Depends on:** #2, #5
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

The data model builder becomes self-aware. A persistent **Model Health** panel in the builder sidebar updates in real time as the user adds/removes columns, WHERE conditions, and aggregations.

### Client-side analysis (zero network cost)

A new composable `useDataModelHealth.ts` mirrors the `DataModelHealthService` logic on the frontend. It is reactive to `state.data_table` changes and computes the health status instantly:

```typescript
const hasAggregation = computed(() =>
    state.data_table.query_options.group_by?.aggregate_functions?.length > 0 ||
    state.data_table.query_options.group_by?.aggregate_expressions?.length > 0
);
const hasWhere = computed(() => state.data_table.query_options.where?.length > 0);
// etc.
```

The source size check (`resolveSourceTableMeta`) fires once when the first column is added — not on every keystroke.

### Health panel states

**Healthy (green, `circle-check` icon):**
```
✓ Model Health · Ready for charts
  ✓ Aggregation detected (SUM of revenue, COUNT of orders)
  ✓ WHERE clause filters date range
  Source: 980,000 rows → Model: ~42,000 rows
```

**Warning (amber, `triangle-exclamation` icon):**
```
⚠ Model Health · Review recommended
  ⚠ No aggregation detected
    This model returns individual rows, not summary data.
    [Add an aggregation ↗]  [Mark as Dimension table]
  Source: 45,000 rows (within chart limit)
```

**Blocked (red, `circle-xmark` icon):**
```
✗ Model Health · Cannot be used for charts
  ✗ No aggregation, no WHERE filters
    Source tables contain 980,000 rows.
    Without filtering or aggregation this model will produce
    ~980,000 rows — above the 50,000 row limit.
  [Add GROUP BY / aggregation ↗]
  [Add WHERE filters ↗]
  [Ask AI to suggest a fix →]
  [Mark as Dimension table (I know what I'm doing)]
```

### "Mark as Dimension table" flow

Shows a confirmation dialog — *"Dimension models bypass aggregation checks. Only use this for small lookup tables. Large tables must have aggregation."* On confirm, calls `PATCH /data-model/:id/model-type` (Issue #5). Health panel immediately flips to green.

All icons use `<font-awesome-icon>`. All styling uses TailwindCSS utility classes only — no `<style>` blocks.

---

## Acceptance Criteria

- [ ] `useDataModelHealth.ts` composable created, reactive to `state.data_table`
- [ ] Health panel renders in the builder sidebar
- [ ] Panel updates instantly (no API call) when user adds/removes aggregations or WHERE conditions
- [ ] Source size check fires once on first column add, not on every interaction
- [ ] "Mark as Dimension table" calls `PATCH /:id/model-type` and updates panel on success
- [ ] `['fas', 'circle-check']`, `['fas', 'triangle-exclamation']`, `['fas', 'circle-xmark']` icons used for status
- [ ] No `<style>` blocks added — TailwindCSS only
- [ ] No inline SVGs

---

## Files to Change

- `frontend/components/data-model-builder.vue` — health panel section in sidebar
- `frontend/composables/useDataModelHealth.ts` — **new composable**
