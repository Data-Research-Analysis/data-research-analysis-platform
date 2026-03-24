# Issue #9 — Frontend chart builder gate + oversized model modal

**Labels:** `frontend` `ux` `critical`
**Size:** Small | **Track:** Enforcement | **Depends on:** #8
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

Two enforcement points in the dashboard chart builder so users cannot inadvertently trigger blocked queries.

### Point A — Proactive column picker gate (before any query fires)

The data model list in the chart builder column picker reads `health_status` and `row_count` from the store (returned by existing data model list endpoints after Issue #4). Models with `health_status === 'blocked'` render as:

```
[✗] Raw Events Table · 847,000 rows · Too large for charts
    Add GROUP BY / aggregation to this model before using it in charts.
    [Fix this model ↗]
```

All column checkboxes for blocked models are disabled (`opacity-50 pointer-events-none`). Models with `health_status === 'warning'` render with an amber indicator and remain selectable (warning, not a block).

### Point B — Reactive gate (422 response handler)

When `executeQueryOnDataModels()` receives a 422 `DATA_MODEL_OVERSIZED` response, render a full-screen blocking modal with:

- Row count and threshold rendered in human-readable format (e.g. "847,000 rows · 50,000 limit")
- `healthIssues` rendered as a structured list with icons and recommendations
- **"Fix this model"** button → navigates to the data model builder
- **"Ask AI to suggest a fix"** button → calls Issue #10's endpoint and renders suggestions
- Admin users only: **"Bypass for this session"** button → sets a per-session flag and retries the query once

---

## Acceptance Criteria

- [ ] Blocked model column rows in picker are visually distinct and non-interactive
- [ ] Warning model column rows show amber indicator but remain usable
- [ ] 422 response from any chart query triggers the blocking modal
- [ ] `healthIssues` from the 422 payload are rendered in the modal
- [ ] "Fix this model" navigates to the correct data model builder route
- [ ] "Ask AI to suggest a fix" button visible and wired to Issue #10 flow
- [ ] Admin-only bypass button only appears for users with admin role
- [ ] No `<style>` blocks — TailwindCSS only

---

## Files to Change

- `frontend/pages/projects/[projectid]/dashboards/[dashboardid]/index.vue` — Point A in column picker, Point B modal on 422 handler
- `frontend/stores/data_models.ts` — confirm `health_status`, `row_count`, `source_row_count`, `model_type` in store state
