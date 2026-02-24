# Data Research Analysis Platform — Complete Use Case Specification

**Document Title:** DRA Platform Use Case Specification  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format  
**Authors:** Generated from full codebase analysis (routes, processors, services, models)

---

## Table of Contents

1. [Authentication & Identity Management](#uc-01--authentication--identity-management)
2. [Project Management](#uc-02--project-management)
3. [Data Source Management](#uc-03--data-source-management)
4. [AI Data Modeler](#uc-04--ai-data-modeler)
5. [Data Model Management](#uc-05--data-model-management)
6. [Dashboard & Visualisation](#uc-06--dashboard--visualisation)
7. [Data Quality](#uc-07--data-quality)
8. [Attribution & Insights](#uc-08--attribution--insights)
9. [Platform Administration](#uc-09--platform-administration)
10. [Account & Notification Management](#uc-10--account--notification-management)

---

## System Overview

### Platform Description
The Data Research Analysis (DRA) Platform is a full-stack analytics application providing end-to-end data pipeline management: from data source connection through AI-assisted data modelling to interactive dashboard publishing. It is comparable in scope to Tableau / Power BI with an integrated AI data modelling layer.

### Technology Stack
| Layer | Technology |
|---|---|
| Frontend | Vue 3 / Nuxt 3 (SSR) |
| Backend | Node.js / Express / TypeScript (ES Modules) |
| Database | PostgreSQL (TypeORM) |
| AI | Google Gemini 2.0 Flash |
| Session Cache | Redis (24-hour TTL) |
| Auth | JWT + Google OAuth |
| File Processing | Multer, ExcelFileService, PDFService |
| Real-time | Socket.IO |
| Background Jobs | QueueService + ScheduledBackupProcessor |

---

## Master Actor Catalogue

| Actor | Type | Role |
|---|---|---|
| **Guest** | Primary Human | Unauthenticated visitor |
| **Registered User** | Primary Human | Authenticated account holder |
| **Project Owner** | Primary Human | Project creator with full project permissions |
| **Project Member (Editor)** | Primary Human | Collaborator with write access to project resources |
| **Project Member (Viewer)** | Primary Human | Read-only access to project resources |
| **Platform Admin** | Primary Human | Superuser with access to all admin routes |
| **External Tracking Client** | Primary System | External service posting attribution events |
| **AI Engine (Gemini 2.0 Flash)** | Secondary System | Google Gemini; generates data model and insight recommendations |
| **OAuth Provider** | Secondary System | Google, LinkedIn, Meta — identity and ad data |
| **External Database** | Secondary System | PostgreSQL, MySQL, MariaDB, MongoDB |
| **Email Service** | Secondary System | Transactional email (verification, invitations, notifications) |
| **Redis** | Secondary System | AI session store (24h TTL) |
| **QueueService** | Secondary System | Background async job processing |
| **Socket.IO** | Secondary System | Real-time progress events |
| **Scheduler / Cron** | Secondary System | Triggers automated scheduled backups |

---

## Global Business Rules

| Rule ID | Rule |
|---|---|
| BR-GLOBAL-01 | All protected routes require a valid JWT issued by the platform |
| BR-GLOBAL-02 | All sensitive connection details (DB credentials, OAuth tokens) are AES-encrypted at rest via TypeORM `ValueTransformer` |
| BR-GLOBAL-03 | Role-Based Access Control (RBAC) is enforced on all data resource operations via `authorize()` and `requireXPermission()` middleware |
| BR-GLOBAL-04 | Subscription tier limits are enforced before any resource creation (projects, data sources, dashboards, AI calls) |
| BR-GLOBAL-05 | All API routes apply the `generalApiLimiter` (1000 req / 15 min); sensitive routes apply stricter limiters |
| BR-GLOBAL-06 | Frontend uses Nuxt 3 SSR; all browser API access must be guarded with `import.meta.client` |
| BR-GLOBAL-07 | All Pinia store mutations sync to localStorage for client-side persistence |
| BR-GLOBAL-08 | ES module `.js` extension required on all backend TypeScript imports |

---


---

# UC-01 — Authentication & Identity Management

**Domain:** Authentication & Identity Management  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Guest** | Primary Human | Unauthenticated visitor with no session |
| **Registered User** | Primary Human | Authenticated account holder with a valid JWT |
| **Email Service** | Secondary System | Transactional email provider (SMTP/SendGrid) |
| **OAuth Provider** | Secondary System | Google Identity Platform |
| **JWT Middleware** | Secondary System | Internal `validateJWT` middleware; validates and decodes tokens on every protected request |
| **Rate Limiter** | Secondary System | `authLimiter` — 10 requests / 15 min on login and register routes |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|           <<system boundary>>                             |
|        Authentication & Identity Management               |
|                                                           |
|  UC-AUTH-01  Register Account                            |
|  UC-AUTH-02  Login with Email / Password                 |
|  UC-AUTH-03  Login via Google OAuth                      |
|  UC-AUTH-04  Verify Email Address                        |
|  UC-AUTH-05  Resend Verification Code                    |
|  UC-AUTH-06  Forgot / Reset Password                     |
|  UC-AUTH-07  Logout                                      |
|  UC-AUTH-08  Validate Token (session check)              |
|  UC-AUTH-09  Get Authenticated User Profile              |
|  UC-AUTH-10  Unsubscribe via Email Link                  |
+-----------------------------------------------------------+

Actors:
  Guest ---------> UC-AUTH-01, UC-AUTH-02, UC-AUTH-03,
                   UC-AUTH-04, UC-AUTH-05, UC-AUTH-06,
                   UC-AUTH-10
  Registered User -> UC-AUTH-07, UC-AUTH-08, UC-AUTH-09
  Email Service <-- UC-AUTH-01 (sends verification email)
                    UC-AUTH-06 (sends reset password email)
  OAuth Provider <- UC-AUTH-03

<<include>> relationships:
  UC-AUTH-02 <<include>> Validate Input Fields
  UC-AUTH-02 <<include>> Generate JWT Token
  UC-AUTH-03 <<include>> Generate JWT Token
  UC-AUTH-01 <<include>> Send Verification Email
  UC-AUTH-06 <<include>> Send Password Reset Email

<<extend>> relationships:
  UC-AUTH-02 <<extend>> Enforce Rate Limit
  UC-AUTH-01 <<extend>> Enforce Rate Limit
```

---

## UC-AUTH-01 — Register Account

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-01 |
| **Use Case Name** | Register Account |
| **Primary Actor** | Guest |
| **Secondary Actors** | Email Service |
| **Priority** | Critical |
| **Trigger** | Guest submits the registration form |
| **Preconditions** | 1. Guest is not authenticated. 2. Guest has navigated to `/register`. |
| **Postconditions (Success)** | 1. User record created in `dra_users` with `email_verified = false`. 2. Verification email dispatched. 3. 200 response returned. |
| **Postconditions (Failure)** | No user record created. Guest receives an error message. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Navigates to `/register` and fills in `first_name`, `last_name`, `email`, `password` (min 8 chars). |
| 2 | System | Applies `authLimiter` rate limit check (10 req / 15 min). |
| 3 | System | Validates all fields using express-validator; checks password strength via `validatePasswordStrength` middleware. |
| 4 | System | Checks for duplicate email in `dra_users`. |
| 5 | System | Hashes password with bcrypt and persists new user record. |
| 6 | System | Generates a unique verification token and stores it. |
| 7 | System | Dispatches a verification email containing a link with the token. |
| 8 | System | Returns HTTP 200 with message: *"User registered successfully. Please check your email…"* |
| 9 | Guest | Checks email inbox and clicks the verification link. |

### Alternative Flows

**ALT-01A — Email Already Registered**
- At step 4: duplicate found.
- System returns HTTP 400: *"User already exists for the given email, please provide a new email."*
- Use case ends.

**ALT-01B — Rate Limit Exceeded**
- At step 2: limit breached.
- System returns HTTP 429 with `Retry-After` header.
- Use case ends.

**ALT-01C — Weak Password**
- At step 3: `validatePasswordStrength` fails.
- System returns HTTP 422 with password policy violation message.
- Use case ends.

**ALT-01D — Missing / Invalid Fields**
- At step 3: validation errors.
- System returns HTTP 422 with field-level validation errors.
- Use case ends.

### Business Rules
- BR-AUTH-01: Password minimum length is 8 characters.
- BR-AUTH-02: Email must be a valid RFC 5321 address.
- BR-AUTH-03: Duplicate email addresses are rejected.
- BR-AUTH-04: Verification link must be sent before the user can log in.

---

## UC-AUTH-02 — Login with Email / Password

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-02 |
| **Use Case Name** | Login with Email / Password |
| **Primary Actor** | Guest |
| **Secondary Actors** | JWT Middleware, Rate Limiter |
| **Priority** | Critical |
| **Trigger** | Guest submits the login form |
| **Preconditions** | 1. Guest has a verified, active account. 2. Guest is on `/login`. |
| **Postconditions (Success)** | 1. JWT access token returned. 2. User session established on client. 3. Guest is redirected to the project list. |
| **Postconditions (Failure)** | No token issued. Guest receives error message. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Submits `email` and `password` to `POST /login`. |
| 2 | System | Applies `authLimiter`. |
| 3 | System | `validateJWT` checks for an existing valid token; if valid, redirects to dashboard (already logged in). |
| 4 | System | Validates `email` and `password` fields (non-empty). |
| 5 | System | Looks up user by email in `dra_users`; verifies bcrypt hash. |
| 6 | System | Checks `email_verified = true`. |
| 7 | System | Generates and returns signed JWT. |
| 8 | Client | Stores JWT; redirects to projects dashboard. |

### Alternative Flows

**ALT-02A — Invalid Credentials**
- At step 5: email not found or password mismatch.
- HTTP 400: *"User not found for the provided email and password."*
- Use case ends.

**ALT-02B — Email Not Verified**
- At step 6: `email_verified = false`.
- HTTP 403 with prompt to verify email.
- Use case ends.

**ALT-02C — Already Authenticated**
- At step 3: valid JWT detected.
- System skips login flow; redirects to dashboard.

**ALT-02D — Rate Limit Exceeded**
- At step 2: HTTP 429 returned.

### Business Rules
- BR-AUTH-05: Only verified accounts may receive a JWT.
- BR-AUTH-06: Failed authentication must not reveal whether the email exists (generic error message).

---

## UC-AUTH-03 — Login via Google OAuth

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-03 |
| **Use Case Name** | Login via Google OAuth |
| **Primary Actor** | Guest |
| **Secondary Actors** | OAuth Provider (Google), JWT Middleware |
| **Priority** | High |
| **Trigger** | Guest clicks "Sign in with Google" |
| **Preconditions** | Google OAuth credentials configured on backend. |
| **Postconditions (Success)** | JWT issued; user record created or updated. |
| **Postconditions (Failure)** | Guest returned to login page with error. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Clicks "Sign in with Google". |
| 2 | System | Redirects to Google OAuth consent screen. |
| 3 | Google | Authenticates user and returns authorisation code to `/oauth/callback`. |
| 4 | System | Exchanges code for Google access token and ID token. |
| 5 | System | Extracts `email`, `given_name`, `family_name` from ID token. |
| 6 | System | Upserts user in `dra_users` (creates if new, updates if existing). |
| 7 | System | Issues platform JWT. |
| 8 | Client | Stores JWT; redirects to projects dashboard. |

### Alternative Flows

**ALT-03A — OAuth Callback Failure (state mismatch / denied)**
- At step 3: Google returns error.
- System logs and redirects to `/login?error=oauth_failed`.

**ALT-03B — Email Associated with Password Account**
- At step 6: email exists with `auth_method = password`.
- System merges OAuth identity or prompts user to login with password.

---

## UC-AUTH-04 — Verify Email Address

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-04 |
| **Use Case Name** | Verify Email Address |
| **Primary Actor** | Guest |
| **Trigger** | Guest clicks verification link from email |
| **Preconditions** | Verification token exists and is unexpired. |
| **Postconditions (Success)** | `email_verified = true` on user record. Guest prompted to log in. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Clicks verification link: `GET /verify-email/:code`. |
| 2 | System | Validates `:code` (non-empty, param check). |
| 3 | System | Looks up token; checks expiry. |
| 4 | System | Sets `email_verified = true`, invalidates token. |
| 5 | System | Returns HTTP 200: *"Email verified successfully. Please login to continue."* |
| 6 | Guest | Navigated to login page. |

### Alternative Flows

**ALT-04A — Token Expired or Invalid**
- At step 3: token not found or expired.
- HTTP 400: *"Email verification failed. The code has expired. Please try again."*

---

## UC-AUTH-05 — Resend Verification Code

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-05 |
| **Use Case Name** | Resend Verification Code |
| **Primary Actor** | Guest |
| **Trigger** | Guest requests a new verification code via `GET /resend-code/:code` |
| **Preconditions** | Original code exists in system (even if expired). |
| **Postconditions (Success)** | New verification code generated and emailed. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Requests resend with current/original code. |
| 2 | System | Validates original code exists. |
| 3 | System | Generates new token; sends new verification email. |
| 4 | System | HTTP 200: *"New code sent."* |

### Alternative Flows

**ALT-05A — Original Code Not Found**
- At step 2: HTTP 400: *"New code generation has failed. It is most likely that the provided code is incorrect…"*

---

## UC-AUTH-06 — Forgot / Reset Password

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-06 |
| **Use Case Name** | Forgot / Reset Password |
| **Primary Actor** | Guest |
| **Secondary Actors** | Email Service |
| **Trigger** | Guest navigates to `/forgot-password` and submits their email |
| **Postconditions (Success)** | Password reset email sent; user can set new password via link. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Submits email address on forgot-password form. |
| 2 | System | Looks up account; generates password reset token with expiry. |
| 3 | System | Sends password reset email with tokenised link. |
| 4 | Guest | Clicks link; lands on reset form; submits new password. |
| 5 | System | Validates new password strength; hashes and updates record. |
| 6 | System | Invalidates reset token. |
| 7 | System | Redirects to login page. |

### Alternative Flows

**ALT-06A — Email Not Found**
- At step 2: system responds identically (HTTP 200) to prevent email enumeration.

**ALT-06B — Reset Token Expired**
- At step 4: token invalid → HTTP 400; Guest prompted to request a new link.

---

## UC-AUTH-07 — Logout

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-07 |
| **Use Case Name** | Logout |
| **Primary Actor** | Registered User |
| **Trigger** | User clicks "Logout" |
| **Postconditions (Success)** | JWT cleared from client; user redirected to `/login`. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks Logout. |
| 2 | Client | Removes JWT from storage; clears Pinia store state and localStorage. |
| 3 | Client | Redirects to `/login`. |

*Note: Backend is stateless (JWT); no server-side session invalidation is required.*

---

## UC-AUTH-08 — Validate Token (Session Check)

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-08 |
| **Use Case Name** | Validate Token |
| **Primary Actor** | Registered User (client-initiated on page load) |
| **Trigger** | Client calls `GET /validate-token` to check session validity |
| **Postconditions (Success)** | HTTP 200 — session still valid. |
| **Postconditions (Failure)** | HTTP 401 — client clears token and redirects to login. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | Sends `GET /validate-token` with `Authorization: Bearer <token>`. |
| 2 | System | `validateJWT` verifies signature and expiry. |
| 3 | System | HTTP 200: *"validated token"* |

### Alternative Flows

**ALT-08A — Token Expired or Tampered**
- HTTP 401 returned; client clears auth state.

---

## UC-AUTH-09 — Get Authenticated User Profile

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-09 |
| **Use Case Name** | Get Authenticated User Profile |
| **Primary Actor** | Registered User |
| **Trigger** | Client calls `GET /me` |
| **Postconditions (Success)** | User profile object returned (name, email, role, subscription tier). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | `GET /me` with JWT. |
| 2 | System | `validateJWT` extracts `user_id` from token. |
| 3 | System | Fetches user by `user_id` from `dra_users`. |
| 4 | System | Returns user object. |

### Alternative Flows

**ALT-09A — User Not Found (deleted)**
- HTTP 404 returned.

**ALT-09B — No Token**
- HTTP 401 returned.

---

## UC-AUTH-10 — Unsubscribe via Email Link

| Field | Value |
|---|---|
| **Use Case ID** | UC-AUTH-10 |
| **Use Case Name** | Unsubscribe via Email Link |
| **Primary Actor** | Guest / Registered User |
| **Trigger** | User clicks unsubscribe link in an email; browser calls `GET /unsubscribe/:code` |
| **Postconditions (Success)** | User's `email_subscribed` flag set to `false`. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks unsubscribe link from email. |
| 2 | System | Validates `:code`. |
| 3 | System | Sets `email_subscribed = false` for corresponding user. |
| 4 | System | HTTP 200: *"Unsubscribed successfully."* |

### Alternative Flows

**ALT-10A — Invalid Code**
- HTTP 400: *"Unsubscription failed. Please try again."*

---

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

---

# UC-03 — Data Source Management

**Domain:** Data Source Management  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner** | Primary Human | Full control over data sources |
| **Project Member (Editor+)** | Primary Human | Can add and manage data sources per RBAC |
| **OAuth Provider** | Secondary System | Google (GA4, Ads, Ad Manager), LinkedIn, Meta |
| **External Database** | Secondary System | PostgreSQL, MySQL, MariaDB, MongoDB |
| **File System** | Secondary System | File storage for CSV, Excel, PDF uploads |
| **Multer** | Secondary System | File upload middleware; enforces MIME and size limits |
| **Tier Enforcement** | Secondary System | `enforceDataSourceLimit` — subscription data source cap |
| **Encryption Service** | Secondary System | AES encrypt/decrypt on `connection_details` field |
| **RBAC Middleware** | Secondary System | `requireProjectPermission`, `requireDataSourcePermission` |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|             Data Source Management                        |
|                                                           |
|  UC-DS-01   Test Database Connection                     |
|  UC-DS-02   Connect Relational Database (PG/MySQL/Maria) |
|  UC-DS-03   Connect MongoDB                              |
|  UC-DS-04   Upload CSV File                              |
|  UC-DS-05   Upload Excel File                            |
|  UC-DS-06   Upload PDF File                              |
|  UC-DS-07   Connect Google Analytics 4                   |
|  UC-DS-08   Connect Google Ads                           |
|  UC-DS-09   Connect Google Ad Manager                    |
|  UC-DS-10   Connect LinkedIn Ads                         |
|  UC-DS-11   Connect Meta Ads                             |
|  UC-DS-12   List Data Sources                            |
|  UC-DS-13   View Data Source Schema / Preview            |
|  UC-DS-14   Refresh Data Source                          |
|  UC-DS-15   Delete Data Source                           |
+-----------------------------------------------------------+

Project Owner / Editor ---> UC-DS-01 through UC-DS-15
OAuth Provider <----------- UC-DS-07, UC-DS-08, UC-DS-09,
                            UC-DS-10, UC-DS-11
External Database <-------- UC-DS-01, UC-DS-02, UC-DS-03
File System <-------------- UC-DS-04, UC-DS-05, UC-DS-06

<<include>>:
  UC-DS-02 <<include>> UC-DS-01 (test connection before save)
  UC-DS-03 <<include>> UC-DS-01
  UC-DS-02 <<include>> Enforce Data Source Tier Limit
  UC-DS-05 <<include>> Validate File Type and Size
  UC-DS-09 <<include>> OAuth Authorisation Flow

<<extend>>:
  UC-DS-02 <<extend>> Auto-encrypt Connection Details
  UC-DS-05 <<extend>> Async Large-File Processing
```

---

## UC-DS-01 — Test Database Connection

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-01 |
| **Use Case Name** | Test Database Connection |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | External Database |
| **Priority** | Critical |
| **Trigger** | User clicks "Test Connection" on data source form; `POST /data-sources/test-connection` |
| **Preconditions** | User is authenticated. Connection parameters provided. |
| **Postconditions (Success)** | HTTP 200: connection confirmed; no record persisted. |
| **Postconditions (Failure)** | HTTP 400; connection refused or timed out. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Fills in `data_source_type`, `host`, `port`, `database_name`, `username`, `password` (or `connection_string` for MongoDB). |
| 2 | System | Validates JWT. |
| 3 | System | Validates required fields per data source type. |
| 4 | System | Constructs `IDBConnectionDetails` object. |
| 5 | System | `DataSourceProcessor.connectToDataSource()` attempts live connection. |
| 6 | System | HTTP 200: *"The data source has been connected."* |

### Alternative Flows

**ALT-DS01A — Missing Required Fields (non-MongoDB)**
- At step 3: HTTP 400: *"Please provide all connection fields (host, port, database_name, username, password)."*

**ALT-DS01B — MongoDB Missing Connection String**
- At step 3: HTTP 400: *"MongoDB requires a connection_string…"*

**ALT-DS01C — Connection Refused / Timeout**
- At step 5: HTTP 400: *"The data source could not be connected."*

**ALT-DS01D — Invalid Credentials**
- At step 5: authentication error from external DB; HTTP 400.

### Business Rules
- BR-DS-01: Connection test does not persist any data.
- BR-DS-02: For MongoDB, a connection string is mandatory; individual host/port fields are optional.

---

## UC-DS-02 — Connect Relational Database (PostgreSQL / MySQL / MariaDB)

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-02 |
| **Use Case Name** | Connect Relational Database |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | External Database, Tier Enforcement, Encryption Service |
| **Priority** | Critical |
| **Trigger** | User submits connection form: `POST /data-sources/add-data-source` |
| **Preconditions** | 1. User authenticated. 2. Data source tier limit not reached. 3. User has `CREATE` permission on project. |
| **Postconditions (Success)** | Data source record created in `dra_data_sources` with encrypted `connection_details`. Schema introspected and cached. |
| **Postconditions (Failure)** | No record created. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects DB type (PostgreSQL / MySQL / MariaDB); enters host, port, schema, database, username, password; submits. |
| 2 | System | Validates JWT. |
| 3 | System | `enforceDataSourceLimit` checks tier cap. |
| 4 | System | Validates fields; constructs `IDBConnectionDetails`. |
| 5 | System | `requireProjectPermission(CREATE)` verifies RBAC. |
| 6 | System | Calls `DataSourceProcessor.connectToDataSource()` — live connection test. |
| 7 | System | On success: calls `DataSourceProcessor.addDataSource()` — persists record; TypeORM `ValueTransformer` auto-encrypts `connection_details`. |
| 8 | System | HTTP 200: *"The data source has been connected."* |
| 9 | Client | Adds data source to Pinia store; syncs localStorage. |

### Alternative Flows

**ALT-DS02A — Tier Limit Reached**
- At step 3: HTTP 403 with upgrade prompt.

**ALT-DS02B — Connection Test Fails**
- At step 6: HTTP 400; record not saved.

**ALT-DS02C — Insufficient Permission**
- At step 5: HTTP 403.

### Business Rules
- BR-DS-03: `connection_details` is auto-encrypted at rest via TypeORM `ValueTransformer`.
- BR-DS-04: Connection must be verified live before persistence.
- BR-DS-05: Data source creation respects subscription tier caps.

---

## UC-DS-03 — Connect MongoDB

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-03 |
| **Use Case Name** | Connect MongoDB |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | User selects MongoDB type and provides `connection_string`; `POST /data-sources/add-data-source` |
| **Preconditions** | Same as UC-DS-02. |
| **Postconditions (Success)** | MongoDB data source persisted with `schema = 'dra_mongodb'` (synthetic). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "MongoDB"; enters `connection_string` (e.g., `mongodb+srv://...`). |
| 2–7 | System | Same as UC-DS-02 steps 2–7, with `schema` auto-set to `'dra_mongodb'`. |
| 8 | System | HTTP 200 confirmation. |

---

## UC-DS-04 — Upload CSV File

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-04 |
| **Use Case Name** | Upload CSV File |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | File System, Multer |
| **Trigger** | User uploads `.csv` file on data source connect page |
| **Preconditions** | User authenticated; file ≤ 500 MB; MIME: `text/csv` or `application/csv`. |
| **Postconditions (Success)** | CSV parsed; data source record created; data stored in backend. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "CSV" and chooses file; submits via multipart form. |
| 2 | System | `excelUpload` multer validates MIME (`text/csv`) and extension (`.csv`); file size ≤ 500 MB. |
| 3 | System | File saved to `public/uploads/excel/` with timestamped name. |
| 4 | System | `ExcelFileService` parses CSV; extracts headers and rows. |
| 5 | System | Data source record persisted; data populated. |
| 6 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-DS04A — Invalid File Type**
- At step 2: Multer `fileFilter` rejects; HTTP 400: *"Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed."*

**ALT-DS04B — File Exceeds 500 MB**
- At step 2: HTTP 413.

**ALT-DS04C — Parse Error (malformed CSV)**
- At step 4: HTTP 400 with parse error message.

---

## UC-DS-05 — Upload Excel File

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-05 |
| **Use Case Name** | Upload Excel File |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | File System, Multer, ExcelFileService |
| **Priority** | High |
| **Trigger** | User uploads `.xlsx` or `.xls` file |
| **Preconditions** | File ≤ 500 MB; MIME: `application/vnd.ms-excel` or OOXML. |
| **Postconditions (Success)** | Excel data parsed; data source created. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects Excel type; selects file; submits. |
| 2 | System | Multer validates type/size; saves with `{timestamp}_{sanitisedName}`. |
| 3 | System | `ExcelFileService` reads workbook; extracts sheets/columns/rows. |
| 4 | System | For large files (async path): job queued; immediate acknowledgement returned. |
| 5 | System | On completion: data source record persisted; user notified via notification. |

### Alternative Flows

**ALT-DS05A — File Too Large (> 500 MB)**
- HTTP 413.

**ALT-DS05B — Corrupted Excel File**
- At step 3: parse error; HTTP 400.

**ALT-DS05C — Large File Async Failure**
- Job fails in queue; error logged; notification sent to user.

### Business Rules
- BR-DS-06: Filenames are sanitised (non-alphanumeric chars replaced with `_`) to prevent path traversal.
- BR-DS-07: Large Excel files are processed asynchronously via job queue.

---

## UC-DS-06 — Upload PDF File

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-06 |
| **Use Case Name** | Upload PDF File |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | File System, Multer, PDFService |
| **Trigger** | User uploads `.pdf` file |
| **Postconditions (Success)** | PDF text extracted; data source created. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "PDF"; uploads file via `upload` (pdf multer config). |
| 2 | System | File saved to `public/uploads/pdfs/` (original filename preserved). |
| 3 | System | `PDFService` extracts text content and structures it. |
| 4 | System | Data source record persisted. |

### Alternative Flows

**ALT-DS06A — Encrypted PDF**
- At step 3: extraction fails; HTTP 400.

**ALT-DS06B — Non-PDF File**
- Multer rejects; HTTP 400.

---

## UC-DS-07 — Connect Google Analytics 4

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-07 |
| **Use Case Name** | Connect Google Analytics 4 |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (Google) |
| **Trigger** | User initiates GA4 OAuth flow from connect page |
| **Postconditions (Success)** | GA4 data source created; OAuth tokens encrypted and stored. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "Google Analytics 4"; clicks "Connect with Google". |
| 2 | System | Redirects to Google OAuth with GA4 scopes. |
| 3 | Google | Returns authorisation code to `/oauth/callback`. |
| 4 | System | Exchanges code for access + refresh tokens. |
| 5 | System | Fetches available GA4 properties from Google API. |
| 6 | User | Selects property; confirms. |
| 7 | System | Persists data source with encrypted tokens. |

### Alternative Flows

**ALT-DS07A — OAuth Denied by User**
- At step 3: redirect back with `error=access_denied`.

**ALT-DS07B — Token Exchange Failure**
- At step 4: HTTP 400; user prompted to retry.

**ALT-DS07C — No GA4 Properties Found**
- At step 5: HTTP 400: *"No GA4 properties found for this account."*

---

## UC-DS-08 — Connect Google Ads

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-08 |
| **Use Case Name** | Connect Google Ads |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (Google) |
| **Trigger** | User initiates Google Ads OAuth flow |
| **Postconditions (Success)** | Google Ads data source created with developer token and OAuth tokens stored encrypted. |

### Main Success Scenario (same OAuth flow as UC-DS-07 with Google Ads scopes and Manager Account selection)

### Alternative Flows

**ALT-DS08A — Manager Account Limitation**
- Certain developer tokens only allow access to test accounts; HTTP 400 with explanation.

**ALT-DS08B — No Ads Accounts Found**
- HTTP 400: *"No Google Ads accounts found."*

---

## UC-DS-09 — Connect Google Ad Manager

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-09 |
| **Use Case Name** | Connect Google Ad Manager |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (Google) |
| **Trigger** | User initiates Google Ad Manager OAuth flow from `/data-sources/connect/google-ad-manager` |
| **Postconditions (Success)** | Ad Manager data source created; network codes and encrypted tokens stored. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects "Google Ad Manager"; clicks connect. |
| 2 | System | Initiates OAuth with Ad Manager API scopes. Rate limited by `google_ad_manager_rate_limit`. |
| 3 | Google | Returns authorisation code. |
| 4 | System | Exchanges for tokens; fetches available networks. |
| 5 | User | Selects AdManager network. |
| 6 | System | Stores data source record with encrypted credentials. |

### Alternative Flows

**ALT-DS09A — Rate Limit Hit on Ad Manager API**
- `google_ad_manager_rate_limit` returns HTTP 429.

---

## UC-DS-10 — Connect LinkedIn Ads

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-10 |
| **Use Case Name** | Connect LinkedIn Ads |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (LinkedIn) |
| **Trigger** | User initiates LinkedIn OAuth flow |
| **Postconditions (Success)** | LinkedIn Ads data source created with OAuth tokens stored encrypted. |

### Alternative Flows

**ALT-DS10A — LinkedIn OAuth Denied** → redirect to connect page with error.

**ALT-DS10B — No Ad Accounts on LinkedIn Account** → HTTP 400.

---

## UC-DS-11 — Connect Meta Ads

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-11 |
| **Use Case Name** | Connect Meta Ads |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | OAuth Provider (Meta / Facebook) |
| **Trigger** | User initiates Meta OAuth flow |
| **Postconditions (Success)** | Meta Ads data source created. |

### Alternative Flows

**ALT-DS11A — Meta OAuth Denied** → redirect with error.

**ALT-DS11B — No Ad Accounts** → HTTP 400.

---

## UC-DS-12 — List Data Sources

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-12 |
| **Use Case Name** | List Data Sources |
| **Primary Actor** | Registered User |
| **Trigger** | `GET /data-sources/list` |
| **Postconditions (Success)** | Array of data sources (with decrypted connection_details) returned for authorised user. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | `GET /data-sources/list` with JWT. |
| 2 | System | `DataSourceProcessor.getDataSources()` queries by user/project membership. |
| 3 | System | TypeORM `ValueTransformer` auto-decrypts `connection_details` on read. |
| 4 | System | Returns array. |

---

## UC-DS-13 — View Data Source Schema / Preview

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-13 |
| **Use Case Name** | View Data Source Schema / Preview |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | User clicks on a data source to view its schema; `GET /data-sources/schema/:data_source_id` |
| **Postconditions (Success)** | Table/column list with data types returned. |

### Alternative Flows

**ALT-DS13A — Source Unreachable**
- Live schema fetch fails; cached schema returned if available; otherwise HTTP 400.

---

## UC-DS-14 — Refresh Data Source

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-14 |
| **Use Case Name** | Refresh Data Source |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `POST /data-sources/refresh/:data_source_id` |
| **Postconditions (Success)** | Schema re-introspected; new data fetched from external source. |

### Alternative Flows

**ALT-DS14A — External Source Unavailable**
- HTTP 400; last-known data retained.

---

## UC-DS-15 — Delete Data Source

| Field | Value |
|---|---|
| **Use Case ID** | UC-DS-15 |
| **Use Case Name** | Delete Data Source |
| **Primary Actor** | Project Owner |
| **Trigger** | `DELETE /data-sources/delete/:data_source_id` |
| **Preconditions** | Actor has delete permission via RBAC. |
| **Postconditions (Success)** | Data source record and associated files deleted. Any dependent data models flagged as broken. |

### Alternative Flows

**ALT-DS15A — Data Source Has Dependent Data Models**
- Dependent models set to `broken` state; user warned of impact before confirmation.

**ALT-DS15B — Insufficient Permission**
- HTTP 403.

---

# UC-04 — AI Data Modeler

**Domain:** AI Data Modeler  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner / Editor** | Primary Human | Initiates and drives AI modelling sessions |
| **AI Engine (Gemini 2.0 Flash)** | Secondary System | Google Gemini; generates structured model recommendations |
| **Redis** | Secondary System | Session store with 24-hour TTL for active conversations |
| **PostgreSQL** | Secondary System | Persistent store for saved conversations and data models |
| **Rate Limiter (AI)** | Secondary System | `aiOperationsLimiter` — 20 req / hour |
| **Tier Enforcement** | Secondary System | `enforceAIGenerationLimit` — AI generation cap per tier |
| **SchemaCollectorService** | Secondary System | Introspects database tables and columns |
| **SchemaFormatter** | Secondary System | Converts schema to Markdown for AI prompt context |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|                  AI Data Modeler                          |
|                                                           |
|  UC-AI-01  Initialise Single-Source AI Session           |
|  UC-AI-02  Initialise Cross-Source AI Session            |
|  UC-AI-03  Send Natural Language Message to AI           |
|  UC-AI-04  View AI Model Recommendation                  |
|  UC-AI-05  Update Model Draft in Redis                   |
|  UC-AI-06  Get Session State                             |
|  UC-AI-07  Save AI Session to Database                   |
|  UC-AI-08  Cancel / Discard AI Session                   |
|  UC-AI-09  View Saved Conversation History               |
|  UC-AI-10  Get Suggested JOIN Relationships              |
+-----------------------------------------------------------+

Project Owner/Editor -----> All UCs
AI Engine (Gemini) <------- UC-AI-03, UC-AI-04
Redis <--------------------- UC-AI-01 through UC-AI-08
PostgreSQL <---------------- UC-AI-07, UC-AI-09

<<include>>:
  UC-AI-01 <<include>> Schema Introspection
  UC-AI-01 <<include>> Format Schema to Markdown
  UC-AI-02 <<include>> Multi-Source Schema Collection
  UC-AI-03 <<include>> Enforce AI Rate Limit
  UC-AI-03 <<include>> Enforce AI Tier Limit
  UC-AI-07 <<include>> Transfer Redis Session to PostgreSQL

<<extend>>:
  UC-AI-03 <<extend>> Cross-Source Modelling (if isCrossSource=true)
  UC-AI-07 <<extend>> Clear Redis Session on Save
```

---

## UC-AI-01 — Initialise Single-Source AI Session

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-01 |
| **Use Case Name** | Initialise Single-Source AI Session |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | AI Engine, Redis, SchemaCollectorService, SchemaFormatter |
| **Priority** | Critical |
| **Trigger** | User opens AI Data Modeler for a data source; `POST /ai-data-modeler/session/initialize` |
| **Preconditions** | 1. User authenticated. 2. Data source exists and is reachable. 3. AI rate limit and tier limit not exceeded. |
| **Postconditions (Success)** | Redis session created with schema context; Gemini conversation initialised; session state returned to client. |
| **Postconditions (Failure)** | No session created; error returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to AI Data Modeler for a data source. |
| 2 | Client | `POST /ai-data-modeler/session/initialize` with `{ dataSourceId }`. |
| 3 | System | Validates JWT; applies `aiOperationsLimiter`. |
| 4 | System | Validates `dataSourceId` (integer, non-empty). |
| 5 | System | `SchemaCollectorService.collectSchema()` — introspects the data source tables, columns, types, relationships. |
| 6 | System | `SchemaFormatter.formatSchemaToMarkdown()` — converts schema to structured Markdown prompt. |
| 7 | System | Creates Redis session with 24-hour TTL; stores schema context and conversation state. |
| 8 | System | Sends system prompt + schema Markdown to Gemini to initialise conversation context. |
| 9 | System | Returns session state (sessionId, available tables, initial AI greeting) to client. |

### Alternative Flows

**ALT-AI01A — Rate Limit Exceeded**
- At step 3: HTTP 429.

**ALT-AI01B — Data Source Unreachable During Schema Introspection**
- At step 5: HTTP 400: *"Schema introspection failed. Ensure the data source is connected and reachable."*

**ALT-AI01C — Empty Schema (no tables)**
- At step 5: schema collected but empty.
- System continues; AI initialised with warning that no tables were found.

**ALT-AI01D — Restore Existing Session**
- At step 7: Redis session already exists for `dataSourceId + userId`.
- System restores existing session instead of creating new one; returns prior state.

**ALT-AI01E — Tier AI Limit Reached**
- At step 3: `enforceAIGenerationLimit` returns HTTP 403 with upgrade prompt.

### Business Rules
- BR-AI-01: Redis sessions expire after 24 hours (TTL enforced at creation).
- BR-AI-02: Schema is formatted as Markdown and prepended to the system prompt.
- BR-AI-03: Sessions are scoped per `dataSourceId + userId` pair.
- BR-AI-04: Existing Redis sessions are restored, not overwritten (continued conversation).

---

## UC-AI-02 — Initialise Cross-Source AI Session

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-02 |
| **Use Case Name** | Initialise Cross-Source AI Session |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | AI Engine, Redis, Multiple SchemaCollectors |
| **Priority** | High |
| **Trigger** | `POST /ai-data-modeler/session/initialize-cross-source` with `{ projectId, dataSources: [] }` |
| **Preconditions** | 1. User authenticated. 2. At least one data source provided. 3. All listed data sources belong to the project and are accessible to the user. |
| **Postconditions (Success)** | Cross-source Redis session initialised with merged schema from all selected data sources. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects multiple data sources; initiates cross-source AI session. |
| 2 | Client | `POST /ai-data-modeler/session/initialize-cross-source` with `{ projectId, dataSources: [id1, id2, ...] }`. |
| 3 | System | Validates JWT; rate limit check. |
| 4 | System | Validates `projectId` and `dataSources` array (min 1 element). |
| 5 | System | Iterates `dataSources`; calls `SchemaCollectorService` for each; collects merged schema. |
| 6 | System | Merges schemas with source tagging (table prefixed with source name). |
| 7 | System | `SchemaFormatter` produces combined Markdown. |
| 8 | System | Creates Redis session with cross-source flag; initialises Gemini with merged context. |
| 9 | System | Returns session state. |

### Alternative Flows

**ALT-AI02A — One or More Sources Unreachable**
- At step 5: partial schema collection.
- System proceeds with reachable sources; warns user about unavailable sources.

**ALT-AI02B — Empty dataSources Array**
- At step 4: HTTP 400: *"dataSources must be a non-empty array."*

---

## UC-AI-03 — Send Natural Language Message to AI

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-03 |
| **Use Case Name** | Send Natural Language Message to AI |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | AI Engine (Gemini), Redis |
| **Priority** | Critical |
| **Trigger** | User types a message and sends; `POST /ai-data-modeler/session/chat` |
| **Preconditions** | 1. Active Redis session exists. 2. Rate and tier limits not exceeded. |
| **Postconditions (Success)** | AI response stored in Redis; structured response (Analysis / Models / SQL) returned to client. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Types natural language request (e.g., *"Create a model that shows monthly revenue by region"*). |
| 2 | Client | `POST /ai-data-modeler/session/chat` with `{ message, dataSourceId, conversationId?, isCrossSource? }`. |
| 3 | System | Validates JWT; applies `aiOperationsLimiter`; enforces `enforceAIGenerationLimit`. |
| 4 | System | Validates `message` (non-empty). |
| 5 | System | Retrieves session from Redis (`dataSourceId + userId`). |
| 6 | System | Appends user message to Redis conversation history. |
| 7 | System | Sends conversation history + user message to Gemini API. |
| 8 | AI Engine | Returns structured 3-section response: **Analysis** (schema interpretation), **Models** (recommended data model), **SQL** (generated query). |
| 9 | System | Stores AI response in Redis conversation history. |
| 10 | System | Returns AI response to client. |
| 11 | Client | Renders AI response in chat UI; displays Model and SQL recommendations. |

### Alternative Flows

**ALT-AI03A — No Active Session**
- At step 5: Redis session not found (expired or never created).
- HTTP 400: *"No active session found. Please initialise a session first."*
- Use case ends; client prompted to re-initialise.

**ALT-AI03B — Gemini API Failure**
- At step 7: Gemini returns error or timeout.
- HTTP 502: *"AI service temporarily unavailable. Please try again."*

**ALT-AI03C — Rate Limit Exceeded**
- At step 3: HTTP 429 with `Retry-After` header.

**ALT-AI03D — Tier Limit Exceeded**
- At step 3: HTTP 403 with upgrade prompt.

**ALT-AI03E — Cross-Source Message Routing**
- At step 5: `isCrossSource = true`; system routes to cross-source session handler.

### Business Rules
- BR-AI-05: AI responses follow a structured 3-section format (Analysis / Models / SQL).
- BR-AI-06: Full conversation history is sent to Gemini on each turn (context window).
- BR-AI-07: AI operations are capped at 20 requests per hour per user.

---

## UC-AI-04 — View AI Model Recommendation

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-04 |
| **Use Case Name** | View AI Model Recommendation |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | AI response received from UC-AI-03 |
| **Postconditions** | User sees structured model recommendations with SQL queries and can apply or iterate. |

*This use case is entirely client-side rendering following UC-AI-03.*

---

## UC-AI-05 — Update Model Draft in Redis

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-05 |
| **Use Case Name** | Update Model Draft in Redis |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | User modifies the proposed model interactively; `POST /ai-data-modeler/session/model-draft` |
| **Preconditions** | Active Redis session exists. |
| **Postconditions (Success)** | Updated `modelState` persisted to Redis session draft. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Edits columns, joins, or filters on the proposed model UI. |
| 2 | Client | `POST /ai-data-modeler/session/model-draft` with `{ dataSourceId, modelState }`. |
| 3 | System | Validates JWT; validates `modelState` is object; validates `dataSourceId`. |
| 4 | System | `RedisAISessionService.saveModelDraft()` updates draft state in Redis. |
| 5 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-AI05A — Session Expired**
- Redis session TTL elapsed; HTTP 400; user prompted to re-initialise.

---

## UC-AI-06 — Get Session State

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-06 |
| **Use Case Name** | Get Session State |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `GET /ai-data-modeler/session/:dataSourceId` (on page load or tab switch) |
| **Postconditions (Success)** | Full session state (messages, model draft, schema) returned from Redis. |

### Alternative Flows

**ALT-AI06A — No Session Found**
- HTTP 404; client prompts user to start a new session.

---

## UC-AI-07 — Save AI Session to Database

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-07 |
| **Use Case Name** | Save AI Session to Database |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | Redis, PostgreSQL |
| **Priority** | High |
| **Trigger** | User clicks "Save Model"; `POST /ai-data-modeler/session/save` |
| **Preconditions** | Active Redis session exists; `title` provided. |
| **Postconditions (Success)** | Conversation and model persisted to `dra_ai_data_model_conversations` and `dra_ai_data_model_messages`. Redis session cleared. Data model record created in `dra_data_models`. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Save"; provides title for the session/model. |
| 2 | Client | `POST /ai-data-modeler/session/save` with `{ dataSourceId, title }`. |
| 3 | System | Validates JWT; validates `dataSourceId` and `title`. |
| 4 | System | `RedisAISessionService.transferToDatabase()`: reads all messages and model draft from Redis. |
| 5 | System | Inserts conversation record into `dra_ai_data_model_conversations` with `status = 'saved'`. |
| 6 | System | Inserts all messages into `dra_ai_data_model_messages`. |
| 7 | System | Creates or updates data model record in `dra_data_models`. |
| 8 | System | Clears Redis session. |
| 9 | System | HTTP 200 with `dataModelId`. |

### Alternative Flows

**ALT-AI07A — Redis Session Already Expired**
- At step 4: session not found; HTTP 400.
- User must re-initiate session or work from saved history.

**ALT-AI07B — Missing Title**
- At step 3: HTTP 422.

---

## UC-AI-08 — Cancel / Discard AI Session

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-08 |
| **Use Case Name** | Cancel / Discard AI Session |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `DELETE /ai-data-modeler/session/:dataSourceId` |
| **Postconditions (Success)** | Redis session deleted; no database record created. |

### Alternative Flows

**ALT-AI08A — Session Already Expired**
- Redis key not found; HTTP 200 (idempotent).

---

## UC-AI-09 — View Saved Conversation History

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-09 |
| **Use Case Name** | View Saved Conversation History |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `GET /ai-data-modeler/conversations/:dataModelId` |
| **Postconditions (Success)** | Full conversation history retrieved from PostgreSQL for the specified data model. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to saved data model's AI conversation history. |
| 2 | Client | `GET /ai-data-modeler/conversations/:dataModelId` with JWT. |
| 3 | System | Queries `dra_ai_data_model_conversations` and `dra_ai_data_model_messages`. |
| 4 | System | Returns messages ordered by timestamp. |

### Alternative Flows

**ALT-AI09A — No History Found**
- HTTP 404 or empty array.

---

## UC-AI-10 — Get Suggested JOIN Relationships

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-10 |
| **Use Case Name** | Get Suggested JOIN Relationships |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `GET /ai-data-modeler/suggested-joins/:dataSourceId` |
| **Postconditions (Success)** | AI-recommended JOIN pairs returned based on schema analysis (foreign key patterns, naming conventions). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens join configuration; requests AI-suggested joins. |
| 2 | System | Introspects schema for the data source. |
| 3 | System | Analyses column names, types, and naming patterns to infer FK relationships. |
| 4 | System | Returns ordered list of join suggestions with confidence scores. |

### Alternative Flows

**ALT-AI10A — No Join Candidates Found**
- Returns empty array with message: *"No join candidates detected in schema."*

---

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

---

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

---

# UC-07 — Data Quality

**Domain:** Data Quality  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner / Editor** | Primary Human | Initiates quality checks and applies cleaning rules |
| **Project Viewer** | Primary Human | Read-only access to quality reports |
| **DataQualityProcessor** | Secondary System | Singleton processor for all quality analysis operations |
| **RBAC Middleware** | Secondary System | `authorize(DATA_MODEL_VIEW)` and `authorize(DATA_MODEL_EDIT)` |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|                    Data Quality                           |
|                                                           |
|  UC-DQ-01  Analyse Data Model (Generate Quality Report)  |
|  UC-DQ-02  Apply Cleaning Rules to Data Model            |
|  UC-DQ-03  View Latest Quality Report                    |
+-----------------------------------------------------------+

Project Owner/Editor -----> UC-DQ-01, UC-DQ-02, UC-DQ-03
Project Viewer -----------> UC-DQ-03

<<include>>:
  UC-DQ-01 <<include>> RBAC Permission Check (VIEW)
  UC-DQ-02 <<include>> RBAC Permission Check (EDIT)
  UC-DQ-02 <<include>> Validate Cleaning Configuration

<<extend>>:
  UC-DQ-01 <<extend>> Flag Data Quality Issues
```

---

## UC-DQ-01 — Analyse Data Model (Generate Quality Report)

| Field | Value |
|---|---|
| **Use Case ID** | UC-DQ-01 |
| **Use Case Name** | Analyse Data Model |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | DataQualityProcessor |
| **Priority** | High |
| **Trigger** | `POST /data-quality/analyze/:data_model_id` |
| **Preconditions** | 1. User is authenticated. 2. User has `DATA_MODEL_VIEW` permission. 3. Data model exists and has data. |
| **Postconditions (Success)** | Quality report generated: completeness, accuracy metrics, null rates, anomalies, duplicate rates per column. |
| **Postconditions (Failure)** | HTTP 500 with error message. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to data quality tab for a data model; clicks "Run Quality Check". |
| 2 | Client | `POST /data-quality/analyze/:data_model_id`. |
| 3 | System | Validates JWT; `authorize(DATA_MODEL_VIEW)`. |
| 4 | System | Validates `data_model_id` (integer). |
| 5 | System | `DataQualityProcessor.analyzeDataModel()` — executes profiling queries: null rates, distinct counts, type mismatches, value distributions, duplicate detection, completeness scores. |
| 6 | System | Computes overall quality score. |
| 7 | System | Persists quality report. |
| 8 | System | Returns quality report JSON with per-column and overall metrics. |

### Alternative Flows

**ALT-DQ01A — Invalid Data Model ID**
- At step 4: HTTP 400: *"Invalid data model ID."*

**ALT-DQ01B — Empty Data Model (No Rows)**
- At step 5: quality check completes with 100% null rate; report indicates empty dataset.

**ALT-DQ01C — Unsupported Column Type**
- At step 5: column skipped for type-specific checks; noted in report as "skipped".

**ALT-DQ01D — Analysis Execution Error**
- At step 5: HTTP 500: *"Failed to analyze data model."*

### Business Rules
- BR-DQ-01: Quality analysis covers: null/missing value rates, duplicate detection, type consistency, value range outliers, and completeness scores.
- BR-DQ-02: Per-column metrics must be computed independently.
- BR-DQ-03: An overall quality score (0–100) is calculated as a weighted composite of individual metrics.

---

## UC-DQ-02 — Apply Cleaning Rules to Data Model

| Field | Value |
|---|---|
| **Use Case ID** | UC-DQ-02 |
| **Use Case Name** | Apply Cleaning Rules to Data Model |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | DataQualityProcessor |
| **Priority** | High |
| **Trigger** | `POST /data-quality/clean/:data_model_id` with cleaning configuration |
| **Preconditions** | 1. User has `DATA_MODEL_EDIT` permission. 2. `cleaningConfig` object provided. 3. A quality report exists (UC-DQ-01 run first). |
| **Postconditions (Success)** | Cleaning rules applied; data model updated; new quality report generated. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Reviews quality report; selects cleaning rules (e.g., fill nulls with median, remove duplicates, standardise date formats). |
| 2 | Client | `POST /data-quality/clean/:data_model_id` with `{ cleaningConfig: { rules: [...] } }`. |
| 3 | System | Validates JWT; `authorize(DATA_MODEL_EDIT)`. |
| 4 | System | Validates `data_model_id` (integer). |
| 5 | System | Validates `cleaningConfig` object (required). |
| 6 | System | Merges `dataModelId` into config; `DataQualityProcessor.applyCleaningRules()` — executes cleaning transforms. |
| 7 | System | Returns updated quality metrics. |

### Alternative Flows

**ALT-DQ02A — Missing cleaningConfig**
- At step 5: HTTP 400: *"Cleaning configuration is required."*

**ALT-DQ02B — Invalid Rule in Configuration**
- At step 6: individual rule fails validation; rule skipped; remainder applied; partial report returned.

**ALT-DQ02C — Insufficient Permission**
- HTTP 403.

### Business Rules
- BR-DQ-04: Cleaning rules are non-destructive on source data; they transform the data model layer only.
- BR-DQ-05: A new quality report is automatically generated after cleaning.

---

## UC-DQ-03 — View Latest Quality Report

| Field | Value |
|---|---|
| **Use Case ID** | UC-DQ-03 |
| **Use Case Name** | View Latest Quality Report |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | `GET /data-quality/report/:data_model_id/latest` |
| **Preconditions** | User authenticated; at least one quality report exists for the model. |
| **Postconditions (Success)** | Most recent quality report returned and rendered. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens data quality view for a data model. |
| 2 | Client | `GET /data-quality/report/:data_model_id/latest`. |
| 3 | System | Validates JWT; validates `data_model_id`. |
| 4 | System | Fetches most recently generated report. |
| 5 | System | Returns report JSON. |
| 6 | Client | Renders per-column quality cards, overall score, and recommendations. |

### Alternative Flows

**ALT-DQ03A — No Report Generated Yet**
- HTTP 404: *"No quality report found."* Client prompts user to run analysis first.

---

# UC-08 — Attribution & Insights

**Domain:** Attribution & Insights  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner / Editor** | Primary Human | Configures attribution models and views reports |
| **Project Viewer** | Primary Human | Views reports read-only |
| **External Tracking Client** | Primary System | Any system or webpage posting attribution events to the API |
| **AttributionProcessor** | Secondary System | Singleton processor for all attribution operations |
| **InsightsProcessor** | Secondary System | Singleton processor for AI-generated insight generation |
| **Rate Limiter** | Secondary System | `expensiveOperationsLimiter` — 30 req / 15 min on report generation |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|                Attribution & Insights                     |
|                                                           |
|  UC-ATT-01  Track Attribution Event                      |
|  UC-ATT-02  Generate Attribution Report                  |
|  UC-ATT-03  View Attribution Report                      |
|  UC-ATT-04  Perform Funnel Analysis                      |
|  UC-ATT-05  View Customer Journey Map                    |
|  UC-ATT-06  Set Attribution Tab Visibility               |
|  UC-INS-01  Generate AI Insights for Dataset             |
|  UC-INS-02  View AI Insights                             |
+-----------------------------------------------------------+

Project Owner/Editor -----> UC-ATT-02 through UC-ATT-06,
                            UC-INS-01, UC-INS-02
Project Viewer -----------> UC-ATT-03, UC-ATT-05, UC-INS-02
External Tracking Client -> UC-ATT-01
AttributionProcessor <----- UC-ATT-01 through UC-ATT-05
InsightsProcessor <-------- UC-INS-01, UC-INS-02

<<include>>:
  UC-ATT-02 <<include>> Enforce Expensive Operations Rate Limit
  UC-ATT-04 <<include>> Validate Funnel Steps
  UC-INS-01 <<include>> AI Engine Call (Gemini)

<<extend>>:
  UC-ATT-02 <<extend>> Attribution Tab Visibility Check
```

---

## UC-ATT-01 — Track Attribution Event

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-01 |
| **Use Case Name** | Track Attribution Event |
| **Primary Actor** | External Tracking Client |
| **Secondary Actors** | AttributionProcessor |
| **Priority** | High |
| **Trigger** | `POST /attribution/track` — fired when a user performs a pageview, interaction, or conversion |
| **Preconditions** | Caller is authenticated (JWT). `projectId`, `userIdentifier`, `eventType` provided. |
| **Postconditions (Success)** | Event persisted to `dra_attribution_events` with timestamp and metadata. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Tracking Client | Sends event payload: `{ projectId, userIdentifier, eventType, eventName, eventValue, pageUrl, referrer, utmParams, customData }`. |
| 2 | System | Validates JWT. |
| 3 | System | Validates required fields: `projectId`, `userIdentifier`, `eventType`. |
| 4 | System | Defaults `eventTimestamp` to `now()` if not provided. |
| 5 | System | `AttributionProcessor.trackEvent()` — persists event record. |
| 6 | System | HTTP 201 with event confirmation. |

### Alternative Flows

**ALT-ATT01A — Missing Required Fields**
- At step 3: HTTP 400: *"Missing required fields: projectId, userIdentifier, eventType."*

**ALT-ATT01B — Invalid Timestamp Format**
- At step 4: parse error; defaults to `now()`.

### Business Rules
- BR-ATT-01: Every event is associated with a `projectId` for multi-tenant isolation.
- BR-ATT-02: `userIdentifier` is client-supplied (cookie, session, hashed email) — not a platform user ID.

---

## UC-ATT-02 — Generate Attribution Report

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-02 |
| **Use Case Name** | Generate Attribution Report |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | AttributionProcessor, Rate Limiter |
| **Priority** | High |
| **Trigger** | `POST /attribution/reports` |
| **Preconditions** | 1. User authenticated. 2. Project has event data in date range. 3. Valid attribution model specified. |
| **Postconditions (Success)** | Attribution report persisted and returned with channel credit scores. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Configures report: `projectId`, `reportName`, `attributionModel` (first_touch / last_touch / linear / time_decay), `startDate`, `endDate`. |
| 2 | Client | `POST /attribution/reports`. |
| 3 | System | `expensiveOperationsLimiter` check (30 req / 15 min). |
| 4 | System | Validates all required fields. |
| 5 | System | `AttributionProcessor.generateReport()` — queries event data in date range; applies selected model algorithm; calculates credit distribution across touchpoints. |
| 6 | System | Persists report to `dra_attribution_reports`. |
| 7 | System | Returns report with channel breakdowns and conversion paths. |

### Alternative Flows

**ALT-ATT02A — No Event Data in Date Range**
- At step 5: HTTP 400: *"No event data found for the specified date range."*

**ALT-ATT02B — Invalid Attribution Model**
- At step 4: HTTP 400: *"Invalid attribution model."*

**ALT-ATT02C — Rate Limit Hit**
- At step 3: HTTP 429.

### Attribution Model Definitions
| Model | Description |
|---|---|
| `first_touch` | 100% credit to first interaction |
| `last_touch` | 100% credit to last interaction before conversion |
| `linear` | Credit evenly distributed across all touchpoints |
| `time_decay` | More credit to touchpoints closer to conversion |

---

## UC-ATT-03 — View Attribution Report

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-03 |
| **Use Case Name** | View Attribution Report |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | User navigates to Attribution tab; `GET /attribution/reports/:projectId` |
| **Postconditions (Success)** | List of generated attribution reports returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens Attribution tab for a project. |
| 2 | Client | Requests reports list. |
| 3 | System | Validates JWT; validates project membership. |
| 4 | System | Returns reports ordered by generation date (newest first). |

### Alternative Flows

**ALT-ATT03A — Tab Visibility Hidden**
- If admin has set attribution tab visibility to hidden for this project tier: tab not rendered.

---

## UC-ATT-04 — Perform Funnel Analysis

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-04 |
| **Use Case Name** | Perform Funnel Analysis |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `POST /attribution/funnel` with funnel step definitions |
| **Preconditions** | At least 2 funnel steps defined; event data exists. |
| **Postconditions (Success)** | Funnel analysis showing conversion rates at each step returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Defines funnel steps (ordered sequence of `eventType` or `eventName` values). |
| 2 | Client | `POST /attribution/funnel` with `IFunnelAnalysisRequest`. |
| 3 | System | Validates steps (min 2). |
| 4 | System | `AttributionProcessor.analyzeFunnel()` — calculates users entering at each step and drop-off rates. |
| 5 | System | Returns funnel data: entry count per step, conversion %, drop-off %. |

### Alternative Flows

**ALT-ATT04A — Fewer Than 2 Steps**
- HTTP 400: *"Funnel requires at least 2 steps."*

**ALT-ATT04B — No Users Match First Step**
- Returns funnel with 0 entries at step 1.

---

## UC-ATT-05 — View Customer Journey Map

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-05 |
| **Use Case Name** | View Customer Journey Map |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | `POST /attribution/journey` with `IJourneyMapRequest` |
| **Postconditions (Success)** | Sankey/path diagram data showing common user journey paths returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens journey map view; selects project and date range. |
| 2 | System | `AttributionProcessor.buildJourneyMap()` — aggregates event sequences by `userIdentifier`. |
| 3 | System | Returns top N journey paths with conversion rates. |

---

## UC-ATT-06 — Set Attribution Tab Visibility

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-06 |
| **Use Case Name** | Set Attribution Tab Visibility |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin toggles attribution tab visibility setting |
| **Postconditions (Success)** | Attribution tab shown/hidden for specified project/tier scope. |

---

## UC-INS-01 — Generate AI Insights for Dataset

| Field | Value |
|---|---|
| **Use Case ID** | UC-INS-01 |
| **Use Case Name** | Generate AI Insights for Dataset |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | InsightsProcessor, AI Engine (Gemini) |
| **Priority** | Medium |
| **Trigger** | User clicks "Generate Insights" on a data model or dashboard |
| **Preconditions** | 1. User authenticated. 2. Data model has data. 3. AI tier limit not exceeded. |
| **Postconditions (Success)** | AI-generated natural language insights persisted and returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Generate Insights" for a data model. |
| 2 | System | AI rate limit check. |
| 3 | System | `InsightsProcessor` samples data from the model (summary statistics). |
| 4 | System | Sends data summary + schema context to Gemini. |
| 5 | AI Engine | Returns natural language analysis: trends, anomalies, key metrics. |
| 6 | System | Persists insight record with model reference. |
| 7 | System | Returns insight text to client. |

### Alternative Flows

**ALT-INS01A — AI Tier Limit Exceeded**
- HTTP 403 with upgrade prompt.

**ALT-INS01B — Empty Dataset**
- HTTP 400: *"Cannot generate insights: no data available."*

**ALT-INS01C — Gemini API Error**
- HTTP 502.

---

## UC-INS-02 — View AI Insights

| Field | Value |
|---|---|
| **Use Case ID** | UC-INS-02 |
| **Use Case Name** | View AI Insights |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | User opens insights panel for a data model |
| **Postconditions (Success)** | Previously generated insights displayed. |

### Alternative Flows

**ALT-INS02A — No Insights Generated**
- Empty state prompts user to run UC-INS-01.

---

# UC-09 — Platform Administration

**Domain:** Platform Administration  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Platform Admin** | Primary Human | Superuser with full system access; all admin routes protected by admin-role check |
| **Scheduler** | Secondary System | Cron/job scheduler triggering automated backup jobs |
| **DatabaseBackupService** | Secondary System | `pg_dump` + ZIP compression + restore operations |
| **QueueService** | Secondary System | Background job queue for async backup/restore |
| **Socket.IO** | Secondary System | Real-time progress events (`backup-progress`) to admin client |
| **Email Service** | Secondary System | Sends transactional and subscription-related emails |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|               Platform Administration                     |
|                                                           |
|  UC-ADM-01  Manage Users                                 |
|  UC-ADM-02  Manage Subscription Tiers                    |
|  UC-ADM-03  View / Manage User Subscriptions             |
|  UC-ADM-04  Manage Private Beta Users (Allowlist)        |
|  UC-ADM-05  Trigger Manual Database Backup               |
|  UC-ADM-06  Restore Database from Backup                 |
|  UC-ADM-07  Configure Scheduled Backups                  |
|  UC-ADM-08  Manage Platform Settings                     |
|  UC-ADM-09  Manage Articles / Blog (CMS)                 |
|  UC-ADM-10  Manage Article Categories                    |
|  UC-ADM-11  Manage Sitemap                               |
|  UC-ADM-12  Manage Account Cancellation Requests         |
|  UC-ADM-13  Upload / Manage Images                       |
+-----------------------------------------------------------+

Platform Admin -----------> All UCs
Scheduler ---------------> UC-ADM-07 (triggers UC-ADM-05)
DatabaseBackupService <---- UC-ADM-05, UC-ADM-06
QueueService <------------- UC-ADM-05, UC-ADM-06
Socket.IO <---------------- UC-ADM-05, UC-ADM-06

<<include>>:
  UC-ADM-05 <<include>> pg_dump Execution
  UC-ADM-05 <<include>> ZIP Compression
  UC-ADM-05 <<include>> Store in backend/private/backups/
  UC-ADM-06 <<include>> Validate ZIP Structure
  UC-ADM-06 <<include>> Drop All Tables CASCADE
  UC-ADM-06 <<include>> Restore SQL Dump
  UC-ADM-07 <<include>> Schedule Backup Job (ScheduledBackupProcessor)

<<extend>>:
  UC-ADM-05 <<extend>> Real-time Progress via Socket.IO
  UC-ADM-06 <<extend>> Real-time Progress via Socket.IO
```

---

## UC-ADM-01 — Manage Users

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-01 |
| **Use Case Name** | Manage Users |
| **Primary Actor** | Platform Admin |
| **Priority** | High |
| **Trigger** | Admin navigates to `/admin/users` |
| **Preconditions** | Actor authenticated with admin role. |
| **Postconditions** | Users listed; admin can view detail, suspend, or delete accounts. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Navigates to user management panel. |
| 2 | Client | `GET /admin/users` — fetches paginated user list. |
| 3 | System | Returns users with subscription tier, status, registration date. |
| 4 | Admin | Selects a user; views detail. |
| 5 | Admin | Optionally: suspends account (`PATCH /admin/users/:id/suspend`) or deletes (`DELETE /admin/users/:id`). |
| 6 | System | Persists status change; returns success. |

### Alternative Flows

**ALT-ADM01A — Delete Admin Account**
- Prevented; HTTP 400: *"Cannot delete admin accounts."*

**ALT-ADM01B — User Not Found**
- HTTP 404.

**ALT-ADM01C — Delete User with Active Subscription**
- System cancels subscription first; then deletes user.

### Business Rules
- BR-ADM-01: Admin accounts cannot be deleted via the admin panel.
- BR-ADM-02: User deletion cascades to projects (if user is sole owner) and membership records.

---

## UC-ADM-02 — Manage Subscription Tiers

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-02 |
| **Use Case Name** | Manage Subscription Tiers |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin navigates to `/admin/subscription-tiers` |
| **Postconditions** | Tiers created/updated/deleted; changes immediately affect tier enforcement for all users. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens subscription tiers panel. |
| 2 | Client | `GET /admin/subscription-tiers` — fetches all tiers. |
| 3 | Admin | Edits tier (name, price, project limit, data source limit, dashboard limit, row limit, AI generation limit). |
| 4 | Client | `PATCH /admin/subscription-tiers/:id`. |
| 5 | System | Validates tier fields; persists; returns updated tier. |

### Alternative Flows

**ALT-ADM02A — Delete Tier with Active Subscribers**
- HTTP 409: *"Cannot delete tier with active subscribers. Migrate users first."*

**ALT-ADM02B — Invalid Tier Limits (negative values)**
- HTTP 422.

---

## UC-ADM-03 — View / Manage User Subscriptions

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-03 |
| **Use Case Name** | View / Manage User Subscriptions |
| **Primary Actor** | Platform Admin |
| **Trigger** | `GET /admin/user-subscriptions` |
| **Postconditions** | Admin can view and override subscription assignments. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens user subscriptions panel. |
| 2 | System | Returns list of `dra_user_subscriptions` joined with user and tier details. |
| 3 | Admin | Selects a user; reassigns tier (`PATCH /admin/user-subscriptions/:userId`). |

### Alternative Flows

**ALT-ADM03A — User Already on Selected Tier**
- Idempotent update; HTTP 200.

---

## UC-ADM-04 — Manage Private Beta Users (Allowlist)

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-04 |
| **Use Case Name** | Manage Private Beta Users |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin navigates to `/admin/private-beta-users` |
| **Postconditions** | Emails added to or removed from `dra_private_beta_users`; only allowlisted emails can register. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens private beta panel. |
| 2 | Client | `GET /admin/private-beta-users` — fetches allowlist. |
| 3 | Admin | Adds email(s) (`POST /admin/private-beta-users`) or removes (`DELETE /admin/private-beta-users/:id`). |
| 4 | System | Updates allowlist; new entries immediately affect registration gate. |

### Alternative Flows

**ALT-ADM04A — Duplicate Email**
- HTTP 409.

---

## UC-ADM-05 — Trigger Manual Database Backup

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-05 |
| **Use Case Name** | Trigger Manual Database Backup |
| **Primary Actor** | Platform Admin |
| **Secondary Actors** | DatabaseBackupService, QueueService, Socket.IO |
| **Priority** | Critical |
| **Trigger** | `POST /admin/database/backup` |
| **Preconditions** | Admin authenticated. No backup currently in progress. |
| **Postconditions (Success)** | ZIP backup file created in `backend/private/backups/`. Metadata JSON included. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Clicks "Backup Now" in the database admin panel. |
| 2 | Client | `POST /admin/database/backup`. |
| 3 | System | Validates admin JWT. |
| 4 | System | Enqueues backup job via `QueueService`. |
| 5 | System | HTTP 202: *"Backup job queued."* |
| 6 | QueueService | Processes job: calls `DatabaseBackupService.createBackup(userId)`. |
| 7 | DatabaseBackupService | Runs `pg_dump`; produces SQL file. |
| 8 | DatabaseBackupService | Creates metadata JSON (`{ timestamp, userId, version, tables }`). |
| 9 | DatabaseBackupService | Compresses SQL + metadata into ZIP with timestamp-based filename. |
| 10 | DatabaseBackupService | Stores in `backend/private/backups/`. |
| 11 | System | Emits `backup-progress` events via Socket.IO at each step. |
| 12 | Admin | Sees real-time progress bar; receives completion notification. |

### Alternative Flows

**ALT-ADM05A — Backup Already in Progress**
- At step 4: HTTP 409: *"A backup is already in progress."*

**ALT-ADM05B — pg_dump Fails**
- At step 7: job fails; `backup-progress` event with `status: error` emitted; admin notified.

**ALT-ADM05C — Insufficient Disk Space**
- At step 9: compression fails; partial files cleaned up; error reported.

### Business Rules
- BR-ADM-03: Backups are processed asynchronously to avoid blocking the HTTP response.
- BR-ADM-04: Backup files must include `metadata.json` alongside the SQL dump.
- BR-ADM-05: Backup filenames include UTC timestamp to ensure uniqueness.

---

## UC-ADM-06 — Restore Database from Backup

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-06 |
| **Use Case Name** | Restore Database from Backup |
| **Primary Actor** | Platform Admin |
| **Secondary Actors** | DatabaseBackupService, QueueService, Socket.IO |
| **Priority** | Critical |
| **Trigger** | `POST /admin/database/restore` with uploaded ZIP file (max 500 MB) |
| **Preconditions** | 1. Admin authenticated. 2. No active backup in progress. 3. ZIP file is a valid platform backup. |
| **Postconditions (Success)** | All tables dropped and recreated; data restored from SQL dump. Platform operational. |
| **Postconditions (Failure)** | Restore aborted; database may be in partial state; admin alerted. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Uploads a backup ZIP file via restore UI. |
| 2 | Client | `POST /admin/database/restore` (multipart; max 500 MB). |
| 3 | System | Validates admin JWT. |
| 4 | System | Multer receives file; validates size ≤ 500 MB. |
| 5 | System | Enqueues restore job via `QueueService`. |
| 6 | System | HTTP 202: *"Restore job queued."* |
| 7 | QueueService | Processes job: calls `DatabaseBackupService.restoreBackup(zipPath, userId)`. |
| 8 | DatabaseBackupService | Extracts ZIP; validates structure (`SQL file + metadata.json` present). |
| 9 | DatabaseBackupService | Validates metadata (schema version compatibility). |
| 10 | DatabaseBackupService | Issues `DROP TABLE ... CASCADE` for all tables. |
| 11 | DatabaseBackupService | Executes SQL dump against database. |
| 12 | DatabaseBackupService | Cleans up temp extraction files. |
| 13 | System | Emits `backup-progress` events throughout. |
| 14 | Admin | Receives completion event; platform fully restored. |

### Alternative Flows

**ALT-ADM06A — Invalid ZIP Structure**
- At step 8: missing SQL file or metadata.json; HTTP 400: *"Invalid backup structure."* Restore aborted.

**ALT-ADM06B — Schema Version Mismatch**
- At step 9: metadata indicates incompatible version; admin warned; restore proceeds with confirmation.

**ALT-ADM06C — SQL Restore Failure**
- At step 11: error in SQL; transaction rolled back where possible; admin alerted with error details.

**ALT-ADM06D — File Exceeds 500 MB**
- At step 4: HTTP 413.

### Business Rules
- BR-ADM-06: Restore drops ALL tables with CASCADE — this is irreversible.
- BR-ADM-07: Restore must not run concurrently with backup.
- BR-ADM-08: Temp files are always cleaned up (success or failure).

---

## UC-ADM-07 — Configure Scheduled Backups

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-07 |
| **Use Case Name** | Configure Scheduled Backups |
| **Primary Actor** | Platform Admin |
| **Secondary Actors** | ScheduledBackupProcessor, Scheduler |
| **Trigger** | Admin configures backup schedule via `/admin/database` settings |
| **Postconditions (Success)** | Cron schedule persisted; `ScheduledBackupProcessor` runs backups on schedule. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Sets backup frequency (daily / weekly / monthly) and retention policy. |
| 2 | Client | `POST /admin/scheduled-backups` with cron expression and retention settings. |
| 3 | System | Persists schedule to `dra_scheduled_backups`. |
| 4 | Scheduler | On trigger: invokes `ScheduledBackupProcessor.runBackup()`. |
| 5 | System | Executes UC-ADM-05 flow; retains N most recent backups per retention policy. |

### Alternative Flows

**ALT-ADM07A — Invalid Cron Expression**
- HTTP 422.

---

## UC-ADM-08 — Manage Platform Settings

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-08 |
| **Use Case Name** | Manage Platform Settings |
| **Primary Actor** | Platform Admin |
| **Trigger** | `GET / PATCH /admin/platform-settings` |
| **Postconditions (Success)** | Global platform configuration updated (e.g., maintenance mode, registration enabled, beta gate toggled). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens platform settings. |
| 2 | Client | `GET /admin/platform-settings` — loads current settings. |
| 3 | Admin | Modifies settings. |
| 4 | Client | `PATCH /admin/platform-settings` with updated values. |
| 5 | System | Validates and persists. |

### Alternative Flows

**ALT-ADM08A — Invalid Setting Value**
- HTTP 422 with field-level errors.

---

## UC-ADM-09 — Manage Articles / Blog (CMS)

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-09 |
| **Use Case Name** | Manage Articles / Blog (CMS) |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin accesses `/admin/articles` |
| **Postconditions** | Articles created, edited, published, or archived. Markdown content supported. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens article management. |
| 2 | Admin | Creates article: title, slug, body (Markdown), category, published flag. |
| 3 | Client | `POST /admin/articles` with article data. |
| 4 | System | `ArticleProcessor.addArticle()` — persists; validates slug uniqueness. |
| 5 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-ADM09A — Duplicate Slug**
- HTTP 409: *"Slug already in use."*

---

## UC-ADM-10 — Manage Article Categories

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-10 |
| **Use Case Name** | Manage Article Categories |
| **Primary Actor** | Platform Admin |
| **Trigger** | `GET/POST/PATCH/DELETE /admin/categories` |
| **Postconditions** | Article categories created, updated, or deleted. |

### Alternative Flows

**ALT-ADM10A — Delete Category with Articles**
- HTTP 409: articles must be recategorised first.

---

## UC-ADM-11 — Manage Sitemap

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-11 |
| **Use Case Name** | Manage Sitemap |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin accesses `/admin/sitemap` |
| **Postconditions** | `sitemap.xml` regenerated and served. |

---

## UC-ADM-12 — Manage Account Cancellation Requests

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-12 |
| **Use Case Name** | Manage Account Cancellation Requests |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin navigates to `/admin/account-cancellations` |
| **Postconditions** | Cancellation requests reviewed; accounts processed for deletion or retention. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens cancellation requests list. |
| 2 | Client | `GET /admin/account-cancellations`. |
| 3 | System | Returns pending requests with user details, subscription, reason. |
| 4 | Admin | Approves cancellation → `POST /admin/account-cancellations/:id/approve`. |
| 5 | System | `AccountCancellationProcessor.processApproval()` — cancels subscription; schedules account deletion; sends confirmation email. |

### Alternative Flows

**ALT-ADM12A — Cancellation Already Processed**
- HTTP 409.

---

## UC-ADM-13 — Upload / Manage Images

| Field | Value |
|---|---|
| **Use Case ID** | UC-ADM-13 |
| **Use Case Name** | Upload / Manage Images |
| **Primary Actor** | Platform Admin |
| **Trigger** | `POST /admin/images/upload` (multipart) |
| **Postconditions** | Image file saved to backend public assets; URL returned for use in articles/platform content. |

### Alternative Flows

**ALT-ADM13A — Invalid File Type**
- HTTP 400: only JPG/PNG/GIF/WebP accepted.

**ALT-ADM13B — File Too Large**
- HTTP 413.

---

# UC-10 — Account & Notification Management

**Domain:** Account & Notification Management  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Registered User** | Primary Human | Any authenticated user managing their own account |
| **Email Service** | Secondary System | Transactional email delivery |
| **NotificationProcessor** | Secondary System | Singleton processor for notification CRUD |
| **AccountCancellationProcessor** | Secondary System | Handles cancellation request lifecycle |
| **UserProcessor / UserSubscriptionProcessor** | Secondary System | Profile updates and subscription management |
| **EmailPreferencesProcessor** | Secondary System | Email preference management |
| **Rate Limiter** | Secondary System | General API limiter on account routes |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|           Account & Notification Management               |
|                                                           |
|  UC-ACC-01  Update Profile / Account Settings            |
|  UC-ACC-02  Change Password                              |
|  UC-ACC-03  Manage Email Notification Preferences        |
|  UC-ACC-04  View Notifications (paginated)               |
|  UC-ACC-05  Get Unread Notification Count                |
|  UC-ACC-06  Mark Notification as Read                    |
|  UC-ACC-07  Mark All Notifications as Read               |
|  UC-ACC-08  Delete Notification                          |
|  UC-ACC-09  View Subscription Plan & Usage               |
|  UC-ACC-10  Request Account Cancellation                 |
|  UC-ACC-11  Unsubscribe via Email Link                   |
+-----------------------------------------------------------+

Registered User ---------> UC-ACC-01 through UC-ACC-11
Email Service <------------ UC-ACC-10, UC-ACC-11
NotificationProcessor <---- UC-ACC-04 through UC-ACC-08
AccountCancellationProcessor <- UC-ACC-10

<<include>>:
  UC-ACC-01 <<include>> Validate JWT
  UC-ACC-02 <<include>> Validate Password Strength
  UC-ACC-06 <<include>> Validate Notification Ownership
  UC-ACC-08 <<include>> Validate Notification Ownership

<<extend>>:
  UC-ACC-10 <<extend>> Cancel Active Subscription
```

---

## UC-ACC-01 — Update Profile / Account Settings

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-01 |
| **Use Case Name** | Update Profile / Account Settings |
| **Primary Actor** | Registered User |
| **Priority** | Medium |
| **Trigger** | User edits profile in Settings; `PATCH /account/profile` |
| **Preconditions** | User is authenticated. |
| **Postconditions (Success)** | User's `first_name`, `last_name`, or other profile fields updated in `dra_users`. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to Settings; edits `first_name`, `last_name`. |
| 2 | Client | `PATCH /account/profile` with `{ first_name, last_name }`. |
| 3 | System | Validates JWT; validates fields (non-empty, sanitised). |
| 4 | System | `UserProcessor.updateProfile()` — persists changes. |
| 5 | System | HTTP 200: *"Profile updated successfully."* |
| 6 | Client | Updates Pinia `logged_in_user` store; syncs localStorage. |

### Alternative Flows

**ALT-ACC01A — Invalid Field Length**
- HTTP 422 with field errors.

---

## UC-ACC-02 — Change Password

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-02 |
| **Use Case Name** | Change Password |
| **Primary Actor** | Registered User |
| **Priority** | High |
| **Trigger** | User submits password change form in Account Settings |
| **Preconditions** | 1. User authenticated. 2. Current password correct. |
| **Postconditions (Success)** | Password hash updated; no tokens invalidated (user remains logged in). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Enters `current_password`, `new_password`, `confirm_new_password`. |
| 2 | Client | Submits via `PATCH /account/change-password`. |
| 3 | System | Validates JWT. |
| 4 | System | Validates `new_password` against strength rules. |
| 5 | System | Verifies `current_password` against stored bcrypt hash. |
| 6 | System | Hashes new password; updates `dra_users`. |
| 7 | System | HTTP 200: *"Password changed successfully."* |

### Alternative Flows

**ALT-ACC02A — Current Password Incorrect**
- At step 5: HTTP 400: *"Current password is incorrect."*

**ALT-ACC02B — New Password Same as Current**
- HTTP 400: *"New password must differ from current password."*

**ALT-ACC02C — Weak New Password**
- At step 4: HTTP 422 with policy message.

**ALT-ACC02D — New Password / Confirm Mismatch**
- Client-side validation; HTTP 422 if bypassed.

### Business Rules
- BR-ACC-01: Passwords must be at least 8 characters and meet strength requirements.
- BR-ACC-02: Current password must always be verified before allowing a change.

---

## UC-ACC-03 — Manage Email Notification Preferences

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-03 |
| **Use Case Name** | Manage Email Notification Preferences |
| **Primary Actor** | Registered User |
| **Trigger** | User toggles preferences in `/settings/notifications`; `PATCH /email-preferences` |
| **Postconditions (Success)** | User's email preference flags updated; no further emails sent for disabled categories. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens notification preferences; toggles categories (marketing, product updates, security alerts). |
| 2 | Client | `PATCH /email-preferences` with `{ marketing_emails: false, ... }`. |
| 3 | System | Validates JWT; validates preference flags (boolean). |
| 4 | System | `EmailPreferencesProcessor.updatePreferences()` — persists changes. |
| 5 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-ACC03A — Unsubscribe All**
- All flags set to `false`; equivalent to UC-ACC-11.

---

## UC-ACC-04 — View Notifications (Paginated)

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-04 |
| **Use Case Name** | View Notifications (Paginated) |
| **Primary Actor** | Registered User |
| **Priority** | Medium |
| **Trigger** | User opens notification panel; `GET /notifications` |
| **Preconditions** | User authenticated. |
| **Postconditions (Success)** | Paginated notification list returned with read/unread status. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks notification bell; panel opens. |
| 2 | Client | `GET /notifications?page=1&limit=20`. |
| 3 | System | Validates JWT; extracts `user_id`. |
| 4 | System | Validates pagination params: `page ≥ 1`, `1 ≤ limit ≤ 100`. |
| 5 | System | `NotificationProcessor.getUserNotifications()` — queries `dra_notifications` by `user_id` ordered by `created_at DESC`. |
| 6 | System | Returns `{ notifications, pagination: { page, limit, total, totalPages } }`. |

### Alternative Flows

**ALT-ACC04A — Invalid Page Parameter**
- At step 4: HTTP 400: *"Page must be >= 1."*

**ALT-ACC04B — Limit Exceeds Max (100)**
- `limit` clamped to 100 silently.

**ALT-ACC04C — No Notifications**
- Returns empty array with `total: 0`.

### Business Rules
- BR-ACC-03: Notification list is scoped strictly to the authenticated user; no cross-user access.
- BR-ACC-04: Maximum page size is 100.

---

## UC-ACC-05 — Get Unread Notification Count

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-05 |
| **Use Case Name** | Get Unread Notification Count |
| **Primary Actor** | Registered User |
| **Trigger** | `GET /notifications/unread-count` on page load / polling |
| **Postconditions (Success)** | Integer count of unread notifications returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Client | Polls `GET /notifications/unread-count`. |
| 2 | System | Validates JWT; `user_id` extracted. |
| 3 | System | `NotificationProcessor.getUnreadCount()` — `COUNT WHERE user_id = ? AND read = false`. |
| 4 | System | Returns `{ success: true, unreadCount: N }`. |
| 5 | Client | Updates notification badge in header nav. |

---

## UC-ACC-06 — Mark Notification as Read

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-06 |
| **Use Case Name** | Mark Notification as Read |
| **Primary Actor** | Registered User |
| **Trigger** | User clicks a notification; `PATCH /notifications/:id/read` |
| **Preconditions** | Notification exists and belongs to the user. |
| **Postconditions (Success)** | Notification `read = true`; unread count decremented. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks a notification item. |
| 2 | Client | `PATCH /notifications/:id/read`. |
| 3 | System | Validates JWT; validates notification belongs to user (`NotificationNotFoundError` / `UnauthorizedNotificationAccessError`). |
| 4 | System | `NotificationProcessor.markAsRead()` — sets `read = true`. |
| 5 | System | HTTP 200. |
| 6 | Client | Updates badge count; marks item visually as read. |

### Alternative Flows

**ALT-ACC06A — Notification Not Found**
- HTTP 404 (`NotificationNotFoundError`).

**ALT-ACC06B — Notification Belongs to Different User**
- HTTP 403 (`UnauthorizedNotificationAccessError`).

---

## UC-ACC-07 — Mark All Notifications as Read

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-07 |
| **Use Case Name** | Mark All Notifications as Read |
| **Primary Actor** | Registered User |
| **Trigger** | `PATCH /notifications/read-all` |
| **Postconditions (Success)** | All user notifications set to `read = true`; unread count becomes 0. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Mark all as read". |
| 2 | Client | `PATCH /notifications/read-all`. |
| 3 | System | Validates JWT; `NotificationProcessor.markAllAsRead(userId)`. |
| 4 | System | Bulk UPDATE on `dra_notifications WHERE user_id = ? AND read = false`. |
| 5 | System | HTTP 200. |

---

## UC-ACC-08 — Delete Notification

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-08 |
| **Use Case Name** | Delete Notification |
| **Primary Actor** | Registered User |
| **Trigger** | `DELETE /notifications/:id` |
| **Preconditions** | Notification exists and belongs to user. |
| **Postconditions (Success)** | Notification record permanently deleted. |

### Alternative Flows

**ALT-ACC08A — Notification Not Found**
- HTTP 404.

**ALT-ACC08B — Unauthorised**
- HTTP 403.

---

## UC-ACC-09 — View Subscription Plan & Usage

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-09 |
| **Use Case Name** | View Subscription Plan & Usage |
| **Primary Actor** | Registered User |
| **Trigger** | User navigates to account/billing page; `GET /subscription/current` and `GET /subscription/usage` |
| **Postconditions (Success)** | Current subscription tier, usage metrics (projects, data sources, dashboards, row counts, AI generations) returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens account/subscription page. |
| 2 | Client | Parallel: `GET /subscription/current` and `GET /subscription/usage`. |
| 3 | System | `RowLimitService.getUsageStats(userId)` — project count, data source count, row counts. |
| 4 | System | `TierEnforcementService.getUsageStats(userId)` — tier limit flags (near/over limit). |
| 5 | System | Returns both datasets. |
| 6 | Client | Renders usage bars, tier name, upgrade CTA if near limits. |

### Alternative Flows

**ALT-ACC09A — No Subscription Record**
- Defaults to free tier display.

---

## UC-ACC-10 — Request Account Cancellation

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-10 |
| **Use Case Name** | Request Account Cancellation |
| **Primary Actor** | Registered User |
| **Secondary Actors** | Email Service, AccountCancellationProcessor |
| **Priority** | Medium |
| **Trigger** | User submits cancellation request form |
| **Preconditions** | User is authenticated. |
| **Postconditions (Success)** | Cancellation request recorded in `dra_account_cancellations`; confirmation email sent; Platform Admin notified. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to account cancellation page; provides reason (optional); confirms intent. |
| 2 | Client | `POST /account/cancel` with `{ reason }`. |
| 3 | System | Validates JWT; validates request is not duplicate. |
| 4 | System | `AccountCancellationProcessor.createRequest()` — inserts cancellation record with `status = pending`. |
| 5 | System | Sends confirmation email to user: *"We've received your cancellation request…"* |
| 6 | System | Sends admin notification. |
| 7 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-ACC10A — Cancellation Already Pending**
- HTTP 409: *"A cancellation request is already pending for your account."*

**ALT-ACC10B — Active Paid Subscription**
- At step 4: system notes subscription details; admin must process manual subscription cancellation before account deletion.

**ALT-ACC10C — User Changes Mind (Withdrawal Period)**
- User submits `POST /account/cancel/withdraw` before admin processes: request status set to `withdrawn`.

### Business Rules
- BR-ACC-05: Cancellation requests are not auto-processed; admin review is required (see UC-ADM-12).
- BR-ACC-06: Active paid subscriptions must be manually cancelled before account deletion is finalised.

---

## UC-ACC-11 — Unsubscribe via Email Link

*(See UC-AUTH-10; same flow but routed from the Account domain context.)*

| Field | Value |
|---|---|
| **Use Case ID** | UC-ACC-11 |
| **Use Case Name** | Unsubscribe via Email Link |
| **Primary Actor** | Registered User |
| **Trigger** | User clicks unsubscribe link in any platform email |
| **Postconditions (Success)** | `email_subscribed = false`; no further marketing/notification emails. |

*Delegates to UC-AUTH-10.*
