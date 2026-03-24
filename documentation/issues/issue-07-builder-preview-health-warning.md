# Issue #7 — Data model builder: health warning during preview run

**Labels:** `frontend` `ux` `high`
**Size:** Small | **Track:** Intelligence | **Depends on:** #6
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

When the user clicks Run / Preview in the data model builder, the current flow executes the query and shows sample rows. This issue adds two health-aware interventions.

### Intervention A — Pre-run confirmation (blocked models)

If the health status is `blocked` before the query runs, show a confirmation dialog before firing the query:

> *"This model has no aggregation and its source tables are large. Running the preview may be slow or time out. The model in its current state cannot be used for chart building. Continue anyway?"*

Options: **Continue** (fires the preview), **Cancel** (returns to builder), **Ask AI to fix this** (opens Issue #10 flow).

### Intervention B — Post-run result warning

After the preview query returns results and the row count exceeds `max_data_model_rows`:

```
⚠ This query returned 847,000 rows.

This data model will be blocked from chart building (limit: 50,000 rows).

Options:
  [Add aggregation (GROUP BY + aggregate function)]
  [Add WHERE filters to reduce scope]
  [Mark as Dimension table]
  [Ask AI to suggest a fix →]
  ──────────────────────────────
  Preview results (first 100 rows shown below):
  [results table]
```

The user can still see the preview data — the warning sits above it with clear context.

---

## Acceptance Criteria

- [ ] Pre-run confirmation dialog shown when `computedHealthStatus === 'blocked'`
- [ ] Post-run warning panel shown when `result.rows.length > max_data_model_rows`
- [ ] Warning sits above the results table, not replacing it
- [ ] All three action buttons in the post-run warning are functional
- [ ] No `<style>` blocks — TailwindCSS only

---

## Files to Change

- `frontend/components/data-model-builder.vue` — modify preview result handler and add pre-run confirmation dialog
