# Issue #13 — Per-chart independent async loading states in dashboard

**Labels:** `frontend` `performance` `high`
**Size:** Medium | **Track:** Dashboard UX | **Depends on:** nothing (independent)
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

The current `state.response_from_data_models_rows` in the dashboard component is a single shared object. When multiple charts load simultaneously they share state — a slow chart can block or overwrite data for fast charts. On dashboards with 5 charts, all five execute sequentially instead of in parallel.

### Change

Replace `response_from_data_models_rows` with a `Map<chartId, IChartLoadState>`:

```typescript
interface IChartLoadState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    rows: any[];
    error: string | null;
    errorCode: 'DATA_MODEL_OVERSIZED' | 'QUERY_FAILED' | null;
    healthIssues: IHealthIssue[];  // from 422 payload, for modal display
}
```

`executeQueryOnDataModels(chartId)` updates only its own entry in the map. Each chart component receives its own state slice. On dashboard mount, all chart queries fire simultaneously via `Promise.allSettled()` — none block each other.

Each chart container renders immediately with a skeleton card (`animate-pulse` TailwindCSS classes on placeholder blocks, sized to match the chart's configured dimensions) while its query resolves. A fast KPI chart renders in 200ms even if a bar chart with a complex model is still loading.

---

## Acceptance Criteria

- [ ] `chartLoadStates: Map<string, IChartLoadState>` replaces `response_from_data_models_rows`
- [ ] `executeQueryOnDataModels(chartId)` updates only its own map entry
- [ ] Dashboard mount fires all chart queries simultaneously via `Promise.allSettled()`
- [ ] Each chart renders independently — a loading chart does not block a ready chart
- [ ] Skeleton card shown for each chart while `status === 'loading'`
- [ ] `errorCode: 'DATA_MODEL_OVERSIZED'` triggers the modal from Issue #9
- [ ] All existing chart functionality (column picker, type switching, save flow) continues to work

---

## Files to Change

- `frontend/pages/projects/[projectid]/dashboards/[dashboardid]/index.vue` — replace shared state with `Map`, refactor `executeQueryOnDataModels()`, add `Promise.allSettled()` on mount
