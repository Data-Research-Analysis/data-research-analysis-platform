# UC-02 — Project Management

**Domain:** Project Management  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Registered User** | Primary Human | Any authenticated user |
| **Project Owner** | Primary Human | The user who created the project; holds all project permissions |
| **Project Member** | Primary Human | A user invited to collaborate; has role-scoped permissions |
| **Email Service** | Secondary System | Delivers project invitation emails |
| **Invitation Service** | Secondary System | `InvitationService.getInstance()` — manages invitation tokens |
| **RBAC Middleware** | Secondary System | `authorize()` + `requireProjectPermission()` — permission enforcement |
| **Tier Enforcement** | Secondary System | `enforceProjectLimit` — subscription tier project cap |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|               Project Management                          |
|                                                           |
|  UC-PROJ-01  Create Project                              |
|  UC-PROJ-02  List Projects                               |
|  UC-PROJ-03  Delete Project                              |
|  UC-PROJ-04  View Project Detail                         |
|  UC-PROJ-05  Invite Member to Project                    |
|  UC-PROJ-06  Accept Project Invitation                   |
|  UC-PROJ-07  Decline / Cancel Invitation                 |
|  UC-PROJ-08  List Project Members                        |
|  UC-PROJ-09  Remove Project Member                       |
|  UC-PROJ-10  Update Member Role                          |
+-----------------------------------------------------------+

Project Owner ---> UC-PROJ-01, UC-PROJ-03, UC-PROJ-05,
                   UC-PROJ-09, UC-PROJ-10
Registered User -> UC-PROJ-02, UC-PROJ-04
Project Member --> UC-PROJ-08
Guest (invited) -> UC-PROJ-06, UC-PROJ-07
Email Service <--- UC-PROJ-05

<<include>>:
  UC-PROJ-01 <<include>> Enforce Tier Project Limit
  UC-PROJ-03 <<include>> Cascade Delete (Data Sources, Models, Dashboards)
  UC-PROJ-05 <<include>> Validate Email Format
  UC-PROJ-05 <<include>> Validate Role

<<extend>>:
  UC-PROJ-05 <<extend>> Add User Directly (if invitee already registered)
```

---

## UC-PROJ-01 — Create Project

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-01 |
| **Use Case Name** | Create Project |
| **Primary Actor** | Registered User |
| **Secondary Actors** | Tier Enforcement |
| **Priority** | Critical |
| **Trigger** | User submits new project form: `POST /projects/add` |
| **Preconditions** | 1. User is authenticated. 2. User has not reached their subscription tier project limit. |
| **Postconditions (Success)** | New project record created in `dra_projects`. User assigned as Project Owner. |
| **Postconditions (Failure)** | No project created. User receives error message. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Create Project"; enters `project_name` (required) and optional `description`. |
| 2 | System | Validates JWT. |
| 3 | System | `enforceProjectLimit` checks subscription tier; verifies user's active project count is below cap. |
| 4 | System | Validates `project_name` (non-empty, sanitised). |
| 5 | System | Calls `ProjectProcessor.addProject()`; inserts row with `owner_id = user_id`. |
| 6 | System | Returns HTTP 200: *"The project has been added."* |
| 7 | Client | Updates Pinia `projects` store; syncs localStorage; navigates to new project. |

### Alternative Flows

**ALT-01A — Project Limit Reached (Tier Enforcement)**
- At step 3: HTTP 403 with tier upgrade prompt.
- Use case ends.

**ALT-01B — Empty Project Name**
- At step 4: HTTP 422 validation error.
- Use case ends.

**ALT-01C — Database Error**
- At step 5: HTTP 400: *"The project could not be created."*

### Business Rules
- BR-PROJ-01: Project name must not be empty.
- BR-PROJ-02: Project creation is gated by subscription tier project limits.
- BR-PROJ-03: The creating user automatically becomes the Project Owner.

---

## UC-PROJ-02 — List Projects

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-02 |
| **Use Case Name** | List Projects |
| **Primary Actor** | Registered User |
| **Trigger** | Page load of projects dashboard; client calls `GET /projects/list` |
| **Preconditions** | User is authenticated. |
| **Postconditions (Success)** | All projects the user owns or is a member of are returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | `GET /projects/list` with JWT. |
| 2 | System | `validateJWT` extracts `user_id`. |
| 3 | System | `ProjectProcessor.getProjects()` queries projects by owner and membership. |
| 4 | System | Returns project array. |
| 5 | Client | Populates Pinia `projects` store; renders project list. |

### Alternative Flows

**ALT-02A — No Projects**
- Returns empty array `[]`. Client renders empty state prompt.

---

## UC-PROJ-03 — Delete Project

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-03 |
| **Use Case Name** | Delete Project |
| **Primary Actor** | Project Owner |
| **Secondary Actors** | RBAC Middleware |
| **Priority** | High |
| **Trigger** | Owner clicks "Delete Project"; calls `DELETE /projects/delete/:project_id` |
| **Preconditions** | 1. User is the Project Owner. 2. `Permission.PROJECT_DELETE` granted. |
| **Postconditions (Success)** | Project and all associated data sources, data models, and dashboards cascade-deleted. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Owner | Confirms deletion dialog. |
| 2 | System | Validates JWT and `project_id` param. |
| 3 | System | `authorize(Permission.PROJECT_DELETE)` verifies ownership/role. |
| 4 | System | `ProjectProcessor.deleteProject()` initiates cascade delete (data sources → models → dashboards → invitations → members). |
| 5 | System | HTTP 200: *"The project has been deleted."* |
| 6 | Client | Removes project from Pinia store and localStorage. |

### Alternative Flows

**ALT-03A — Insufficient Permission (non-owner member)**
- At step 3: HTTP 403 Forbidden.

**ALT-03B — Project Not Found**
- At step 4: HTTP 400: *"The project could not be deleted."*

### Business Rules
- BR-PROJ-04: Only the Project Owner may delete a project.
- BR-PROJ-05: Deletion is irreversible; all child entities are cascade-deleted.

---

## UC-PROJ-04 — View Project Detail

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-04 |
| **Use Case Name** | View Project Detail |
| **Primary Actor** | Project Owner / Project Member |
| **Trigger** | User navigates to `/projects/[projectid]` |
| **Postconditions (Success)** | Project summary, linked data sources, models and dashboards displayed. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to project page. |
| 2 | Client | Fetches project data, linked data sources, data models, dashboards. |
| 3 | System | Verifies membership/ownership on each child resource request. |
| 4 | Client | Renders project detail view. |

### Alternative Flows

**ALT-04A — User Not a Member**
- HTTP 403; redirected to projects list.

---

## UC-PROJ-05 — Invite Member to Project

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-05 |
| **Use Case Name** | Invite Member to Project |
| **Primary Actor** | Project Owner |
| **Secondary Actors** | Email Service, Invitation Service |
| **Priority** | High |
| **Trigger** | Owner submits invitation form: `POST /project-invitations` |
| **Preconditions** | 1. Actor is authenticated. 2. Actor has write permission on the project. |
| **Postconditions (Success)** | Invitation email dispatched; `dra_project_invitations` record created. Or, if invitee already registered, added directly. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Owner | Enters invitee `email` and selects `role` (Viewer / Editor / Admin). |
| 2 | System | `invitationLimiter` rate check (10 req / 15 min). |
| 3 | System | Validates: `projectId`, `email` (RFC format), `role` (valid `EProjectRole`). |
| 4 | System | `InvitationService.createInvitation()` checks if email is already a registered user. |
| 5a | System (if registered) | Adds user directly to project with selected role; returns `addedDirectly: true`. |
| 5b | System (if not registered) | Creates invitation record with token; dispatches invitation email. |
| 6 | System | HTTP 200/201 success response. |

### Alternative Flows

**ALT-05A — User Already a Project Member**
- At step 4: conflict detected.
- HTTP 409: *"User is already a member of this project."*

**ALT-05B — Invalid Email Format**
- At step 3: HTTP 400: *"Invalid email format."*

**ALT-05C — Invalid Role**
- At step 3: HTTP 400: *"Invalid role. Must be one of: viewer, editor, admin."*

**ALT-05D — Rate Limit Exceeded**
- At step 2: HTTP 429.

**ALT-05E — Email Bounces / Delivery Failure**
- At step 5b: Email Service returns error; record still created; system logs failure.

### Business Rules
- BR-PROJ-06: Valid roles are defined by `EProjectRole` enum.
- BR-PROJ-07: If invitee email matches an existing user, they are added directly without requiring an invitation acceptance flow.

---

## UC-PROJ-06 — Accept Project Invitation

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-06 |
| **Use Case Name** | Accept Project Invitation |
| **Primary Actor** | Guest / Registered User (invitee) |
| **Trigger** | Invitee clicks acceptance link in invitation email |
| **Preconditions** | Invitation token exists, is unexpired, and has not been accepted. |
| **Postconditions (Success)** | Invitee added to project with assigned role. Invitation record marked accepted. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Invitee | Clicks invitation link (contains token). |
| 2 | System | Validates token; looks up invitation record. |
| 3 | System | If invitee not registered → redirects to `/register` with token preserved. |
| 4 | System | If registered and authenticated → adds to project membership table. |
| 5 | System | Marks invitation as `accepted`; redirects to project. |

### Alternative Flows

**ALT-06A — Token Expired**
- HTTP 400: *"Invitation has expired. Please ask the project owner to re-invite you."*

**ALT-06B — Already a Member**
- At step 4: duplicate membership prevented; redirected to project directly.

---

## UC-PROJ-07 — Decline / Cancel Invitation

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-07 |
| **Use Case Name** | Decline / Cancel Invitation |
| **Primary Actor** | Guest / Registered User (invitee) or Project Owner |
| **Trigger** | `DELETE /project-invitations/:invitationId` |
| **Postconditions (Success)** | Invitation record deleted; no membership created. |

### Alternative Flows

**ALT-07A — Invitation Not Found**
- HTTP 404.

---

## UC-PROJ-08 — List Project Members

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-08 |
| **Use Case Name** | List Project Members |
| **Primary Actor** | Project Member / Owner |
| **Trigger** | Client calls `GET /project-members/:projectId` |
| **Postconditions (Success)** | Array of members with roles returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | Requests member list with JWT. |
| 2 | System | Verifies user is a member of the project. |
| 3 | System | Returns members array with `user_id`, `name`, `email`, `role`. |

---

## UC-PROJ-09 — Remove Project Member

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-09 |
| **Use Case Name** | Remove Project Member |
| **Primary Actor** | Project Owner |
| **Trigger** | Owner clicks "Remove" on a member: `DELETE /project-members/:memberId` |
| **Preconditions** | Actor has admin/owner permission on the project. |
| **Postconditions (Success)** | Member record deleted; user loses project access. |

### Alternative Flows

**ALT-09A — Attempt to Remove Owner**
- Prevented by business rule. HTTP 400: *"Cannot remove the project owner."*

---

## UC-PROJ-10 — Update Member Role

| Field | Value |
|---|---|
| **Use Case ID** | UC-PROJ-10 |
| **Use Case Name** | Update Member Role |
| **Primary Actor** | Project Owner |
| **Trigger** | Owner changes role from member list UI: `PUT /project-members/:memberId` |
| **Postconditions (Success)** | Member role updated; RBAC permissions change immediately on next request. |

### Alternative Flows

**ALT-10A — Invalid Role**
- HTTP 400 with valid role list.

**ALT-10B — Downgrading Own Role**
- If owner demotes themselves: requires confirmation; another owner must exist first.
