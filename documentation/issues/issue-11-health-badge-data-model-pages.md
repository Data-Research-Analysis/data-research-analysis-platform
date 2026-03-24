# Issue #11 — Health badge on data model list + detail pages

**Labels:** `frontend` `ux` `high`
**Size:** Small | **Track:** UX | **Depends on:** #4
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

Give users visibility into model health before they open the chart builder. Every data model entry on the list page and the detail page header shows a status badge.

### Badge states

| Status | Icon | Badge text |
|---|---|---|
| `healthy` | `['fas', 'circle-check']` green | "42,000 rows · Chart ready" |
| `warning` | `['fas', 'triangle-exclamation']` amber | "42,000 rows · Review model" |
| `blocked` | `['fas', 'circle-xmark']` red | "847K rows · Too large" |
| `unknown` | `['fas', 'circle-question']` grey | "Not yet analysed — run model to check" |
| `model_type = 'dimension'` | `['fas', 'table-columns']` blue | "Dimension table · Checks bypassed" |

Clicking any non-healthy badge opens a popover or small panel listing the `health_issues` with their `title`, `description`, and `recommendation` fields rendered in plain English.

Row counts above 1,000 are formatted as `42K`, `1.2M` etc. for readability.

---

## Acceptance Criteria

- [ ] Badge rendered on every model row in the data model list page
- [ ] Badge rendered in the model detail page header
- [ ] All five status states have correct icon, colour, and text
- [ ] Clicking a non-healthy badge shows the `health_issues` detail
- [ ] Row counts formatted with K/M suffixes
- [ ] All icons use `<font-awesome-icon>` — no inline SVGs
- [ ] No `<style>` blocks — TailwindCSS only

---

## Files to Change

- `frontend/pages/projects/[projectid]/data-models/index.vue`
- `frontend/pages/projects/[projectid]/data-models/[modelid]/index.vue`
