# Issue #5 — Health API endpoints: `GET /data-model/:id/health` + `PATCH /:id/model-type`

**Labels:** `backend` `api` `high`
**Size:** Small | **Track:** Intelligence | **Depends on:** #1, #2, #4
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

Two new lightweight endpoints:

### `GET /data-model/:id/health`

Returns the persisted health report and a live re-analysis side-by-side, so the frontend can detect stale health data after source syncs:

```json
{
    "persisted": {
        "health_status": "warning",
        "health_issues": [...],
        "row_count": 42000,
        "source_row_count": 980000,
        "model_type": null
    },
    "live": {
        "health_status": "blocked",
        "health_issues": [...],
        "source_row_count": 1240000
    },
    "stale": true
}
```

`stale: true` means the live analysis disagrees with the persisted status (source tables have grown since last save). The frontend uses this to prompt "Source data has changed — re-run this model to update its health status."

### `PATCH /data-model/:id/model-type`

Allows setting `model_type` without triggering a full model rebuild:

```json
{ "model_type": "dimension" }
```

Validates against `['dimension', 'fact', 'aggregated', null]`. Re-runs health analysis with the new type, persists updated `health_status` and `health_issues`, returns the new report. This is the mechanism for the "Mark as Dimension table" action in the builder.

Both endpoints require `validateJWT` and verify the requesting user owns or has access to the data model.

---

## Acceptance Criteria

- [ ] `GET /data-model/:id/health` returns both persisted and live reports
- [ ] `stale: true` is set when live `health_status` differs from persisted `health_status`
- [ ] `PATCH /data-model/:id/model-type` validates the `model_type` value
- [ ] `PATCH` re-runs health analysis and returns an updated report instantly
- [ ] Both endpoints are protected with `validateJWT`
- [ ] 404 returned if the data model does not exist or does not belong to the user's project

---

## Files to Change

- `backend/src/routes/data_model.ts` — two new route handlers
- `backend/src/processors/DataModelProcessor.ts` — `getModelHealth()` and `setModelType()` methods
