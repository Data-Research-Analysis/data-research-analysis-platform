# UC-06 — Dashboard & Visualisation

**Domain:** Dashboard & Visualisation  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner** | Primary Human | Full dashboard permissions |
| **Project Member (Editor+)** | Primary Human | Can create and edit dashboards |
| **Project Member (Viewer)** | Primary Human | Read-only access to dashboards |
| **Guest** | Primary Human | Can view publicly shared dashboards via link |
| **DashboardProcessor** | Secondary System | Core business logic for dashboard CRUD |
| **RBAC Middleware** | Secondary System | `requireDashboardPermission`, `authorize()` |
| **Tier Enforcement** | Secondary System | `enforceDashboardLimit` |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|               Dashboard & Visualisation                   |
|                                                           |
|  UC-DASH-01  List Dashboards                             |
|  UC-DASH-02  Create Dashboard                            |
|  UC-DASH-03  Update Dashboard (widgets/layout/data)      |
|  UC-DASH-04  Delete Dashboard                            |
|  UC-DASH-05  Generate Public Export Link                 |
|  UC-DASH-06  View Public Dashboard                       |
|  UC-DASH-07  Execute Dashboard Query                     |
+-----------------------------------------------------------+

Project Owner/Editor -----> UC-DASH-01 through UC-DASH-07
Project Viewer -----------> UC-DASH-01, UC-DASH-07
Guest --------------------> UC-DASH-06
DashboardProcessor <------- UC-DASH-02 through UC-DASH-07

<<include>>:
  UC-DASH-02 <<include>> Enforce Dashboard Tier Limit
  UC-DASH-02 <<include>> RBAC Permission Check (CREATE)
  UC-DASH-03 <<include>> RBAC Permission Check (UPDATE)
  UC-DASH-04 <<include>> RBAC Permission Check (DELETE)
  UC-DASH-05 <<include>> RBAC Permission Check (SHARE + READ)
  UC-DASH-07 <<include>> Execute Query on Data Model

<<extend>>:
  UC-DASH-03 <<extend>> Real-time Widget Data Refresh
  UC-DASH-06 <<extend>> Token Validation for Private Links
```

---

## UC-DASH-01 — List Dashboards

| Field | Value |
|---|---|
| **Use Case ID** | UC-DASH-01 |
| **Use Case Name** | List Dashboards |
| **Primary Actor** | Registered User |
| **Trigger** | `GET /dashboards/list` on dashboards page load |
| **Preconditions** | User is authenticated. |
| **Postconditions (Success)** | All dashboards the user can access (scoped to owned projects and memberships) returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | `GET /dashboards/list` with JWT. |
| 2 | System | `validateJWT`; extracts `user_id`. |
| 3 | System | `DashboardProcessor.getDashboards()` — queries by project membership. |
| 4 | System | Returns dashboard array. |

### Alternative Flows

**ALT-DASH01A — No Dashboards**
- Returns empty array; client renders empty state.

---

## UC-DASH-02 — Create Dashboard

| Field | Value |
|---|---|
| **Use Case ID** | UC-DASH-02 |
| **Use Case Name** | Create Dashboard |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | DashboardProcessor, Tier Enforcement |
| **Priority** | Critical |
| **Trigger** | User clicks "New Dashboard"; `POST /dashboards/add` |
| **Preconditions** | 1. User authenticated. 2. `DASHBOARD_CREATE` permission held. 3. Dashboard tier limit not reached. 4. Project exists and user has `CREATE` permission on it. |
| **Postconditions (Success)** | Dashboard record created in `dra_dashboards` with initial `data` JSON. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "New Dashboard"; enters name; selects project. |
| 2 | Client | `POST /dashboards/add` with `{ project_id, data: { name, widgets: [] } }`. |
| 3 | System | `validateJWT`. |
| 4 | System | `enforceDashboardLimit`. |
| 5 | System | Validates `project_id` (integer, non-empty) and `data` (non-empty). |
| 6 | System | `authorize(DASHBOARD_CREATE)` and `requireProjectPermission(CREATE)` checks. |
| 7 | System | `DashboardProcessor.addDashboard()` — inserts record. |
| 8 | System | HTTP 200: *"The dashboard has been added."* |
| 9 | Client | Pinia `dashboards` store updated; navigate to new dashboard. |

### Alternative Flows

**ALT-DASH02A — Tier Limit Reached**
- At step 4: HTTP 403 with upgrade prompt.

**ALT-DASH02B — Insufficient Permission**
- At step 6: HTTP 403.

**ALT-DASH02C — Invalid data Payload**
- At step 5: HTTP 422.

### Business Rules
- BR-DASH-01: Dashboard `data` is stored as a JSON blob (widgets, layout, filters).
- BR-DASH-02: Creation is gated by subscription tier dashboard limits.

---

## UC-DASH-03 — Update Dashboard

| Field | Value |
|---|---|
| **Use Case ID** | UC-DASH-03 |
| **Use Case Name** | Update Dashboard (widgets / layout / data) |
| **Primary Actor** | Project Owner / Editor |
| **Priority** | Critical |
| **Trigger** | User saves dashboard after editing; `POST /dashboards/update/:dashboard_id` |
| **Preconditions** | 1. User has `DASHBOARD_EDIT` permission. 2. `requireDashboardPermission(UPDATE)` passes. |
| **Postconditions (Success)** | `dra_dashboards.data` updated with new widget configuration, layout, and filter state. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Adds/removes widgets; resizes/repositions; configures data bindings; saves. |
| 2 | Client | `POST /dashboards/update/:dashboard_id` with `{ project_id, data: { ... } }`. |
| 3 | System | Validates JWT; validates `dashboard_id` (integer) and `project_id` (integer). |
| 4 | System | `authorize(DASHBOARD_EDIT)` + `requireDashboardPermission(UPDATE)`. |
| 5 | System | `DashboardProcessor.updateDashboard()` — replaces `data` blob. |
| 6 | System | HTTP 200: *"The dashboard has been updated."* |
| 7 | Client | Pinia store updated; user sees saved state. |

### Alternative Flows

**ALT-DASH03A — Concurrent Edit Conflict**
- Two users edit the same dashboard simultaneously; last-write-wins (no optimistic locking).

**ALT-DASH03B — Linked Data Model Deleted**
- Widget bound to deleted model renders error state but does not block save.

**ALT-DASH03C — Insufficient Permission**
- HTTP 403.

---

## UC-DASH-04 — Delete Dashboard

| Field | Value |
|---|---|
| **Use Case ID** | UC-DASH-04 |
| **Use Case Name** | Delete Dashboard |
| **Primary Actor** | Project Owner |
| **Trigger** | `DELETE /dashboards/delete/:dashboard_id` |
| **Preconditions** | User has `DASHBOARD_DELETE` permission. |
| **Postconditions (Success)** | Dashboard and public export link records deleted. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Confirms deletion. |
| 2 | System | Validates JWT; `authorize(DASHBOARD_DELETE)`; `requireDashboardPermission(DELETE)`. |
| 3 | System | `DashboardProcessor.deleteDashboard()`. |
| 4 | System | HTTP 200: *"The dashboard has been deleted."* |

### Alternative Flows

**ALT-DASH04A — Dashboard Has Active Public Link**
- Public link record also deleted; any external viewers lose access.

**ALT-DASH04B — Insufficient Permission**
- HTTP 403.

---

## UC-DASH-05 — Generate Public Export Link

| Field | Value |
|---|---|
| **Use Case ID** | UC-DASH-05 |
| **Use Case Name** | Generate Public Export Link |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `GET /dashboards/generate-public-export-link/:dashboard_id` |
| **Preconditions** | User has `DASHBOARD_SHARE` and `READ` permission on the dashboard. |
| **Postconditions (Success)** | A unique public key generated and stored; shareable URL returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Share" → "Generate Public Link". |
| 2 | System | `authorize(DASHBOARD_SHARE)` + `requireDashboardPermission(READ)`. |
| 3 | System | `DashboardProcessor.generatePublicExportLink()` — generates unique key; stores in `dra_dashboard_public_links`. |
| 4 | System | HTTP 200 with `key`. |
| 5 | Client | Constructs shareable URL: `{frontend}/public-dashboard/{key}`; displays to user. |

### Alternative Flows

**ALT-DASH05A — Key Already Exists**
- Returns existing key (idempotent regeneration).

---

## UC-DASH-06 — View Public Dashboard

| Field | Value |
|---|---|
| **Use Case ID** | UC-DASH-06 |
| **Use Case Name** | View Public Dashboard |
| **Primary Actor** | Guest |
| **Trigger** | Guest navigates to `/public-dashboard/[key]`; system calls `GET /dashboards/public-dashboard-link/:dashboard_key` |
| **Preconditions** | Valid, non-expired public key. |
| **Postconditions (Success)** | Dashboard rendered read-only; no authentication required. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Accesses shareable URL. |
| 2 | System | `GET /dashboards/public-dashboard-link/:dashboard_key`. |
| 3 | System | Validates + URL-encodes key; looks up in public links table. |
| 4 | System | `DashboardProcessor.getPublicDashboard()` — fetches dashboard data and executes widget queries. |
| 5 | System | Dashboard data returned. |
| 6 | Client | Renders read-only dashboard (no editing controls). |

### Alternative Flows

**ALT-DASH06A — Invalid Key / Dashboard Deleted**
- HTTP 400: *"The public dashboard link could not be retrieved."*
- Client renders 404 page.

---

## UC-DASH-07 — Execute Dashboard Query

| Field | Value |
|---|---|
| **Use Case ID** | UC-DASH-07 |
| **Use Case Name** | Execute Dashboard Query |
| **Primary Actor** | Project Member / Guest (via public link) |
| **Trigger** | `POST /dashboard-query/execute` on widget render or dashboard filter change |
| **Preconditions** | Dashboard loaded; widget data binding configured. |
| **Postconditions (Success)** | Query result set returned for widget rendering. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | Widget requests data on load or after filter change. |
| 2 | System | Validates JWT (or public key for guest access). |
| 3 | System | Constructs query from widget's data binding configuration. |
| 4 | System | Executes query via `DataModelProcessor.executeQueryOnDataModel()`. |
| 5 | System | Returns result set. |
| 6 | Client | Widget renders chart/table/metric using result. |

### Alternative Flows

**ALT-DASH07A — Data Model No Longer Exists**
- Widget shows error state: *"Data model not found."*

**ALT-DASH07B — Query Timeout**
- Widget shows timeout error.

**ALT-DASH07C — Row Limit Applied**
- Result set truncated with notification shown on widget.
