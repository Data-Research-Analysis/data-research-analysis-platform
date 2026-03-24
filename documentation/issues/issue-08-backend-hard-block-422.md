# Issue #8 — Backend hard block (HTTP 422) in `executeQueryOnDataModel`

**Labels:** `backend` `security` `critical`
**Size:** Small | **Track:** Enforcement | **Depends on:** #1, #3, #4
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

The backend is the last line of defence. Regardless of what the frontend does, the chart query endpoint must refuse to execute against a blocked data model. This prevents bypasses (direct API calls, browser DevTools, etc.).

### Pre-flight check in `DataModelProcessor.executeQueryOnDataModel()` before running any SQL

```typescript
const dataModel = await manager.findOneOrFail(DRADataModel, { where: { id: dataModelId } });
const threshold = await PlatformSettingsService.getInstance().getNumber('max_data_model_rows', 50000);

if (
    threshold > 0 &&
    (dataModel.health_status === 'blocked' ||
    (dataModel.row_count !== null && dataModel.row_count > threshold))
) {
    throw new DataModelOversizedException({
        modelId: dataModel.id,
        modelName: dataModel.name,
        rowCount: dataModel.row_count,
        sourceRowCount: dataModel.source_row_count,
        healthStatus: dataModel.health_status,
        healthIssues: dataModel.health_issues,
        threshold
    });
}
```

HTTP 422 (Unprocessable Entity) is semantically correct — the request is syntactically valid but violates a business rule.

### Response payload

```json
{
    "error": "DATA_MODEL_OVERSIZED",
    "modelId": 42,
    "modelName": "Raw Events",
    "rowCount": 847000,
    "sourceRowCount": 980000,
    "threshold": 50000,
    "healthStatus": "blocked",
    "healthIssues": [
        {
            "code": "FULL_TABLE_SCAN_LARGE_SOURCE",
            "severity": "error",
            "title": "No aggregation on large source table",
            "description": "Source tables contain 980,000 rows with no aggregation or WHERE filter.",
            "recommendation": "Add a GROUP BY clause with aggregate functions (SUM, COUNT, AVG) to reduce output rows."
        }
    ],
    "message": "This data model contains 847,000 rows which exceeds the 50,000 row chart-building limit."
}
```

> **Security note:** All values in the error payload are loaded from the `DRADataModel` entity (trusted server-side data). No user-supplied input is reflected in the error response.

---

## Acceptance Criteria

- [ ] `DataModelOversizedException` typed error class created
- [ ] Pre-flight check runs before any SQL execution in `executeQueryOnDataModel()`
- [ ] HTTP 422 returned with the structured payload above
- [ ] Setting `max_data_model_rows = 0` in platform settings disables the block
- [ ] `health_issues` array from the stored model is included in the 422 payload
- [ ] No user input is reflected in error messages

---

## Files to Change

- `backend/src/processors/DataModelProcessor.ts` — pre-flight check in `executeQueryOnDataModel()`
- `backend/src/types/errors/DataModelOversizedException.ts` — **new typed error class**
- `backend/src/routes/data_model.ts` — catch `DataModelOversizedException`, return 422
