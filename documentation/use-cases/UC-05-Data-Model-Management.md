# UC-05 — Data Model Management

**Domain:** Data Model Management  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner** | Primary Human | Full control over data models |
| **Project Member (Editor+)** | Primary Human | Can create, edit, and refresh data models per RBAC |
| **Project Member (Viewer)** | Primary Human | Read-only access to data models |
| **DataModelProcessor** | Secondary System | Core business logic for all data model operations |
| **CrossSourceJoinService** | Secondary System | Handles cross-source join query construction |
| **RBAC Middleware** | Secondary System | `requireDataModelPermission`, `requireProjectPermission`, `authorize()` |
| **Tier Enforcement** | Secondary System | `enforceDataModelLimit` — subscription cap on data models |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|               Data Model Management                       |
|                                                           |
|  UC-DM-01  List Data Models for Project                  |
|  UC-DM-02  Build Data Model via Query Builder            |
|  UC-DM-03  Execute Ad-hoc Query on Data Model            |
|  UC-DM-04  Refresh Data Model                            |
|  UC-DM-05  Copy Data Model                               |
|  UC-DM-06  Delete Data Model                             |
|  UC-DM-07  Get Tables from All Project Data Models       |
|  UC-DM-08  Configure Join Conditions                     |
|  UC-DM-09  Preview Data Model Results                    |
+-----------------------------------------------------------+

Project Owner/Editor -----> UC-DM-01 through UC-DM-09
Project Viewer -----------> UC-DM-01, UC-DM-07, UC-DM-09

<<include>>:
  UC-DM-02 <<include>> Enforce Data Model Tier Limit
  UC-DM-02 <<include>> Validate SQL Query
  UC-DM-02 <<include>> RBAC Permission Check
  UC-DM-03 <<include>> RBAC Permission Check (EXECUTE)
  UC-DM-05 <<include>> RBAC Permission Check (CREATE + READ)
  UC-DM-08 <<include>> Cross-Source Join Validation

<<extend>>:
  UC-DM-02 <<extend>> Cross-Source Join (if multiple data sources)
```

---

## UC-DM-01 — List Data Models for Project

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-01 |
| **Use Case Name** | List Data Models for Project |
| **Primary Actor** | Project Owner / Member |
| **Trigger** | `GET /data-models/list/:project_id` on data models page load |
| **Preconditions** | User is authenticated and a member of the project. |
| **Postconditions (Success)** | All data models for the project returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | `GET /data-models/list/:project_id` with JWT. |
| 2 | System | Validates JWT; validates `project_id` (integer). |
| 3 | System | `DataModelProcessor.getDataModels()` fetches models scoped to project and user membership. |
| 4 | System | Returns array of data model records. |

### Alternative Flows

**ALT-DM01A — Invalid project_id**
- HTTP 400: *"Invalid project_id."*

**ALT-DM01B — No Models**
- Returns empty array; client renders empty state.

---

## UC-DM-02 — Build Data Model via Query Builder

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-02 |
| **Use Case Name** | Build Data Model via Query Builder |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | DataModelProcessor, Tier Enforcement, RBAC Middleware |
| **Priority** | Critical |
| **Trigger** | User constructs a query in the data model builder and saves; `POST /data-models/update-data-model-on-query` |
| **Preconditions** | 1. User has `DATA_MODEL_EDIT` permission. 2. Data source is accessible. 3. Model tier limit not exceeded. |
| **Postconditions (Success)** | Data model record updated/created; query and JSON representation persisted. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens data model builder; selects tables, columns, joins, filters; configures aggregations. |
| 2 | Client | Constructs SQL `query` and structural `query_json` representation. |
| 3 | Client | `POST /data-models/update-data-model-on-query` with `{ data_source_id, data_model_id, query, query_json, data_model_name }`. |
| 4 | System | Validates JWT. |
| 5 | System | `authorize(Permission.DATA_MODEL_EDIT)` and `requireDataModelPermission(UPDATE)` checks. |
| 6 | System | Validates all required fields (non-empty, type checks). |
| 7 | System | `DataModelProcessor.updateDataModelOnQuery()` executes validation query against data source; on success, persists `query` and `query_json`. |
| 8 | System | HTTP 200: *"The data model has been rebuilt."* |
| 9 | Client | Updates Pinia `data_models` store. |

### Alternative Flows

**ALT-DM02A — SQL Syntax Error**
- At step 7: database returns syntax error; HTTP 400 with error details.

**ALT-DM02B — Data Source Unavailable**
- At step 7: connection refused; HTTP 400.

**ALT-DM02C — Insufficient Permission**
- At step 5: HTTP 403.

**ALT-DM02D — Empty Query**
- At step 6: HTTP 422.

**ALT-DM02E — Cross-Source Join**
- At step 7: `CrossSourceJoinService` composes a federated query across multiple data sources; same flow thereafter.

### Business Rules
- BR-DM-01: Both `query` (SQL string) and `query_json` (structural representation) are stored for round-trip fidelity.
- BR-DM-02: The query is validated by executing it (not merely parsed); execution errors abort the save.
- BR-DM-03: Data model names must be non-empty.

---

## UC-DM-03 — Execute Ad-hoc Query on Data Model

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-03 |
| **Use Case Name** | Execute Ad-hoc Query on Data Model |
| **Primary Actor** | Project Owner / Editor |
| **Priority** | High |
| **Trigger** | `POST /data-models/execute-query-on-data-model` from preview/insight context |
| **Preconditions** | 1. User has `DATA_MODEL_EXECUTE` permission. |
| **Postconditions (Success)** | Query result set returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Submits query from preview interface. |
| 2 | System | Validates JWT; `authorize(Permission.DATA_MODEL_EXECUTE)`. |
| 3 | System | Validates `query` (non-empty). |
| 4 | System | `DataModelProcessor.executeQueryOnDataModel()` — runs query against underlying data source. |
| 5 | System | Returns result set (rows and schema). |

### Alternative Flows

**ALT-DM03A — Query Exceeds Row Limit**
- Result set truncated to subscription tier row limit; `rowLimitApplied: true` flag in response.

**ALT-DM03B — Query Timeout**
- HTTP 408 or 500 with timeout message.

**ALT-DM03C — SQL Injection Attempt**
- Query sanitisation rejects dangerous patterns; HTTP 400.

---

## UC-DM-04 — Refresh Data Model

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-04 |
| **Use Case Name** | Refresh Data Model |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `POST /data-models/refresh/:data_model_id` |
| **Preconditions** | User has `UPDATE` permission on the data model. |
| **Postconditions (Success)** | Data model re-executed against current data source data; cache updated. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Refresh" on a data model. |
| 2 | System | Validates JWT; `requireDataModelPermission(UPDATE)`. |
| 3 | System | `DataModelProcessor.refreshDataModel()` re-runs stored query; updates internal data cache. |
| 4 | System | HTTP 200: *"The data model has been refreshed successfully."* |

### Alternative Flows

**ALT-DM04A — Data Source Offline**
- HTTP 400: *"The data model could not be refreshed."* Last successful data retained.

**ALT-DM04B — Stored Query No Longer Valid**
- Schema may have changed; query execution fails; HTTP 400 with details.

---

## UC-DM-05 — Copy Data Model

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-05 |
| **Use Case Name** | Copy Data Model |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `POST /data-models/copy/:data_model_id` |
| **Preconditions** | User has `DATA_MODEL_CREATE` and `READ` permission on the source model. |
| **Postconditions (Success)** | New data model created with cloned query, query_json, and name suffix " (Copy)". |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "Duplicate" on a data model. |
| 2 | System | Validates JWT; checks CREATE and READ permissions. |
| 3 | System | `DataModelProcessor.copyDataModel()` clones the model record. |
| 4 | System | Returns new model object (HTTP 200). |

### Alternative Flows

**ALT-DM05A — Model Limit Reached**
- HTTP 403 with tier upgrade message.

**ALT-DM05B — Source Model Not Found**
- HTTP 400: *"The data model could not be copied."*

---

## UC-DM-06 — Delete Data Model

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-06 |
| **Use Case Name** | Delete Data Model |
| **Primary Actor** | Project Owner |
| **Trigger** | `DELETE /data-models/delete/:data_model_id` |
| **Preconditions** | User has `DATA_MODEL_DELETE` permission. |
| **Postconditions (Success)** | Data model record and related dashboards/queries deleted. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Confirms deletion dialog. |
| 2 | System | Validates JWT; `authorize(DATA_MODEL_DELETE)`; `requireDataModelPermission(DELETE)`. |
| 3 | System | `DataModelProcessor.deleteDataModel()` — cascade deletes model and linked records. |
| 4 | System | HTTP 200: *"The data model has been deleted."* |

### Alternative Flows

**ALT-DM06A — Dependent Dashboards Exist**
- Dashboards using this model become broken (orphaned widget references).
- User warned before deletion; confirmation required.

**ALT-DM06B — Insufficient Permission**
- HTTP 403.

---

## UC-DM-07 — Get Tables from All Project Data Models

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-07 |
| **Use Case Name** | Get Tables from All Project Data Models |
| **Primary Actor** | Project Member |
| **Trigger** | `GET /data-models/tables/project/:project_id` (used by dashboard widget builder) |
| **Postconditions (Success)** | Unified list of all table/column references across project data models returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | Requests table list for dashboard widget configuration. |
| 2 | System | `requireProjectPermission(READ)`. |
| 3 | System | `DataModelProcessor.getTablesFromDataModels()` — aggregates available fields from all project models. |
| 4 | System | Returns table/column metadata. |

---

## UC-DM-08 — Configure Join Conditions

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-08 |
| **Use Case Name** | Configure Join Conditions |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | User opens Join Conditions Manager within the data model builder |
| **Postconditions (Success)** | Join conditions persisted to `query_json`; data model rebuilt. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens join manager; selects left table, right table, join type (INNER / LEFT / RIGHT / FULL), and matching columns. |
| 2 | Client | Validates column type compatibility on the frontend. |
| 3 | Client | Updates `query_json` with join conditions; calls UC-DM-02 to rebuild model. |

### Alternative Flows

**ALT-DM08A — Incompatible Column Types**
- Frontend warns before submission; HTTP 400 if still submitted.

**ALT-DM08B — Circular Join Detected**
- System detects a → b → a cycle; HTTP 400: *"Circular join reference detected."*

---

## UC-DM-09 — Preview Data Model Results

| Field | Value |
|---|---|
| **Use Case ID** | UC-DM-09 |
| **Use Case Name** | Preview Data Model Results |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | User clicks "Preview" in data model builder or detail view |
| **Postconditions (Success)** | First N rows of data model result set displayed. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks Preview (default 100-row limit). |
| 2 | System | Executes stored query via UC-DM-03 with row limit. |
| 3 | System | Returns result set; client renders table. |

### Alternative Flows

**ALT-DM09A — Empty Result Set**
- Returns empty rows array; client renders "No data" message.

**ALT-DM09B — Row Limit Applied**
- Row count capped by tier; message shown: *"Showing first N rows (tier limit applied)."*
