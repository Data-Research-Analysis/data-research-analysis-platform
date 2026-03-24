# Issue #14 — Dashboard-level filter bar

**Labels:** `frontend` `backend` `migration` `medium`
**Size:** Medium | **Track:** Dashboard UX | **Depends on:** #13
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

For well-designed aggregated models (e.g. `GROUP BY region, channel, month`), dashboard viewers need to slice pre-aggregated data by a dimension without editing the model or creating a new one. A collapsible filter bar above the chart grid injects WHERE conditions into chart queries at view time.

### Backend

New `filter_config JSONB DEFAULT '{}'` column on `dra_dashboards` via TypeORM migration.

```typescript
interface IDashboardFilterConfig {
    enabled: boolean;
    filters: IDashboardGlobalFilter[];
}

interface IDashboardGlobalFilter {
    id: string;                // stable UUID, persisted across saves
    label: string;             // e.g. "Date Range", "Region"
    type: 'date_range' | 'select' | 'multi_select';
    column: string;            // the column name this filter binds to across charts
    defaultValue?: any;
}
```

Column names in active filter values are validated server-side against `dra_table_metadata` before being appended to queries — prevents column-name injection attacks.

### Frontend

`DashboardFilterBar.vue` component renders above the chart grid when `filter_config.enabled`. Contains:
- Date range picker for `date_range` type filters
- Dropdown for `select` type
- Multi-select chips for `multi_select` type

When a filter value changes, all charts containing the bound `column` in their selected columns re-execute via `executeQueryOnDataModels(chartId)`. Charts without the bound column are unaffected.

A **"Configure Filters"** button in the dashboard edit toolbar opens a settings panel where the user binds columns to filter controls, names them, and chooses the widget type.

---

## Acceptance Criteria

- [ ] Migration adds `filter_config` column to `dra_dashboards`
- [ ] `DRADashboard` model and `IDashboard` types updated
- [ ] `DashboardProcessor` persists and returns `filter_config`
- [ ] `DashboardFilterBar.vue` component created
- [ ] Filter bar renders above chart grid when `filter_config.enabled = true`
- [ ] Date range picker works for `date_range` type filters
- [ ] Dropdown and multi-select work for their respective types
- [ ] Changing a filter value re-executes only charts containing the bound column
- [ ] Column name validation on backend before appending to queries (allowlist against `dra_table_metadata`)
- [ ] "Configure Filters" panel allows adding/editing/removing global filters
- [ ] Filter config persisted on dashboard save
- [ ] No `<style>` blocks — TailwindCSS only
- [ ] No inline SVGs

---

## Files to Change

- `backend/src/migrations/` — new migration `AddFilterConfigToDashboards`
- `backend/src/models/DRADashboard.ts`
- `backend/src/processors/DashboardProcessor.ts`
- `backend/src/types/IDashboard.ts`
- `frontend/components/DashboardFilterBar.vue` — **new component**
- `frontend/pages/projects/[projectid]/dashboards/[dashboardid]/index.vue`
