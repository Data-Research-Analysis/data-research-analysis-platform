# Issue #10 — AI-assisted model fix: `POST /data-model/:id/suggest-optimization`

**Labels:** `backend` `frontend` `ai` `medium`
**Size:** Medium | **Track:** Intelligence | **Depends on:** #8
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

When a model is blocked, users need a clear path to fix it. The "Ask AI to suggest a fix" button sends the model's stored `health_issues`, `sql_query`, and column list to Gemini, which returns up to 3 structured suggestions with plain-English descriptions and revised SQL.

### Backend — `POST /data-model/:id/suggest-optimization`

1. Load `DRADataModel` — get `sql_query`, `health_issues`, `row_count`, `source_row_count`, and column type information from the stored `query` JSON
2. Build Gemini prompt using the structured `health_issues` (already contains plain-English descriptions of the problems) — no re-analysis needed
3. Parse and validate Gemini's JSON response — each suggested `revisedSQL` must start with `SELECT` (validated via case-insensitive trim check before returning — prevents prompt injection from producing harmful SQL)
4. Return:
   ```json
   {
       "analysis": "This model performs a full table scan on 980,000 rows with no filtering.",
       "suggestions": [
           {
               "description": "Group by channel and month, summing revenue",
               "revisedSQL": "SELECT channel, DATE_TRUNC('month', event_date) AS month, SUM(revenue) AS total_revenue FROM ..."
           }
       ]
   }
   ```

Rate limited with `aiOperationsLimiter`. Requires `validateJWT`.

### Frontend — suggestion cards in the oversized model modal

After clicking "Ask AI to suggest a fix", the button shows `['fas', 'spinner'] animate-spin`. On response, the modal expands to show:

- **Analysis paragraph** (plain English)
- Up to 3 **suggestion cards**, each with:
  - Plain-English description
  - SQL displayed in a code block
  - **"Apply this suggestion"** button → navigates to the data model builder with the suggested SQL pre-filled via store state

The user reviews, runs, and saves the suggestion manually. AI suggests, human decides.

---

## Acceptance Criteria

- [ ] `POST /data-model/:id/suggest-optimization` endpoint created
- [ ] All returned `revisedSQL` values are validated as `SELECT` statements before being sent to the frontend
- [ ] Gemini prompt uses stored `health_issues` descriptions (not re-computed)
- [ ] Route uses `aiOperationsLimiter`
- [ ] Frontend spinner shows while request is in flight
- [ ] Up to 3 suggestion cards rendered with description + SQL code block
- [ ] "Apply this suggestion" pre-fills the data model builder query editor
- [ ] No `<style>` blocks — TailwindCSS only

---

## Files to Change

- `backend/src/processors/DataModelProcessor.ts` — `suggestModelOptimization()` method
- `backend/src/routes/data_model.ts` — `POST /:id/suggest-optimization` route (uses `aiOperationsLimiter`)
- `frontend/pages/projects/[projectid]/dashboards/[dashboardid]/index.vue` — suggestion cards in modal
- `frontend/stores/data_models.ts` — store pre-filled SQL suggestion for handoff to builder
