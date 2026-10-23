# Data Research Analysis Platform — Use Case Catalogue

**Document Title:** DRA Platform Use Case Specification  
**Version:** 2.0  
**Date:** 2026-10-22  
**Status:** Code-aligned. Supersedes the February 2026 detailed use-case set (removed because it described the deprecated user-level subscription/private-beta model).  
**Related:** [FEATURES.md](../FEATURES.md) · [architecture/](../architecture/README.md) · [product-market-business-review.md](../product-market-business-review.md)

---

## 1. System Context

DRA is a multi-tenant SaaS with two connected products:

1. **Plan Studio** — an AI paid-media plan builder that researches a business, produces a channel-by-channel plan and creative deliverables, and launches targets into campaign tracking.
2. **Marketing intelligence stack** — data-source ingestion, medallion-layered data models, dashboards/reports, attribution, funnels, anomaly detection, budget optimization, and AI insights.

```
Guest / User ──HTTPS/JWT──> Nuxt 3 SSR frontend ──> Express API ──> PostgreSQL + Redis
                                     │                  ├──> Gemini (Plan Studio / AI features)
                                     │                  ├──> Paddle (billing)
                                     │                  └──> Marketing & engineering data sources
                                     └── Socket.IO progress/chat events
```

## 2. Actors

| Actor | Type | Description |
|---|---|---|
| **Guest** | Primary human | Unauthenticated visitor; can run a 24-hour guest plan preview (steps 0–6) and public report/dashboard shares. |
| **Registered User** | Primary human | Authenticated account holder. |
| **Organization Owner / Admin / Member** | Primary human | Organization-level roles; owner controls billing and destructive org actions. |
| **Workspace Admin / Editor / Viewer** | Primary human | Workspace-scoped access roles. |
| **Project Analyst / Manager / CMO** | Primary human | Project marketing roles (analyst full read/write, manager read + publish, CMO read-only). |
| **Platform Admin** | Primary human | Cross-tenant administration (users, orgs, tiers, AI usage, backups, content, settings). |
| **AI Engine (Gemini 2.5 Flash)** | Secondary system | Plan agent, AI data modeler, insights, analysis, join inference, widget specs. |
| **Paddle** | Secondary system | Checkout, subscriptions, invoices, payment webhooks, adjustments/refunds. |
| **Marketing platforms** | Secondary system | Google Ads, GA4, Google Ad Manager, Meta Ads, LinkedIn Ads, HubSpot, Klaviyo. |
| **Engineering data sources** | Secondary system | PostgreSQL, MySQL, MariaDB, MongoDB, Excel/CSV, PDF+OCR. |
| **Redis** | Secondary system | AI sessions, OAuth token sessions, SSO state, tier-count cache, guest-plan tokens, rate-limit overrides. |
| **Socket.IO** | Secondary system | Sync/upload/PDF progress, plan messages, notifications, backup progress. |
| **Queue / worker threads** | Secondary system | theta-mn-queue jobs (PDF, Textract, file deletion, backup/restore, MongoDB sync, Excel upload) and the email worker. |

## 3. Global Business Rules

| Rule | Statement |
|---|---|
| BR-01 | Protected routes require a valid JWT; the token is cookie-bound (`dra_auth_token`, 3-day cookie) and has no `exp` claim. |
| BR-02 | Tenancy is enforced in the application: Organization → Workspace → Project. There are no PostgreSQL RLS policies. |
| BR-03 | Organization/workspace context comes from `X-Organization-Id` / `X-Workspace-Id`; project access is checked by RBAC middleware. |
| BR-04 | Subscription limits are enforced by `TierEnforcementService`; violations return HTTP **402** with an `upgradeTiers` ladder. |
| BR-05 | Advanced tools (data models, dashboards, reports, AI insights, engineering connectors) require `advanced_tools_allowed` (Professional+). |
| BR-06 | Data-source credentials, OAuth tokens, and MongoDB connection strings are encrypted at rest with AES-256-GCM. |
| BR-07 | All Gemini calls are metered by feature key in `dra_ai_call_logs`; per-tier AI cost ceilings are enforced. |
| BR-08 | Guest plans expire after 24 hours and are limited to steps 0–6; claiming one attaches it to the user's organization and consumes one plan build. |
| BR-09 | Plan creation consumes one plan-build allowance; plan execution is durable, one step at a time, and pauses at human gates. |
| BR-10 | Public report/dashboard shares use non-auth keys; all other data access is authenticated and tenant-scoped. |
| BR-11 | SQL execution is validated; AI-generated SQL is SELECT-only with table allow-listing, and DDL/admin operations are blocked. |
| BR-12 | Marketing connectors LinkedIn, HubSpot, and Klaviyo are production-gated for non-admins; Meta is not gated. |
| BR-13 | Rate limits apply to auth, expensive operations, AI, insights, MongoDB sync, invitations, and SSO callbacks. |

## 4. Use Case Catalogue

### 4.1 Authentication & Identity

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-AUTH-01 | Register account | Guest | `POST /auth/register` → user + verification email; reCAPTCHA and password policy enforced. |
| UC-AUTH-02 | Verify email | Guest | Verification code/link → account activated. |
| UC-AUTH-03 | Log in with email/password | Guest | `POST /auth/login` → JWT cookie; `authLimiter` applies. |
| UC-AUTH-04 | Log in with Google | Guest | Google OAuth callback → account link/create → JWT. |
| UC-AUTH-05 | Reset password | Guest | Forgot-password code → password update. |
| UC-AUTH-06 | Log out | User | Clears the auth cookie/session. |
| UC-AUTH-07 | SAML SSO login | Guest/User | `/auth/saml/*` → signed assertion → one-time code → JWT; JIT provisioning and domain verification per org. |
| UC-AUTH-08 | Enforce SSO for an org | Org owner/admin | Password login disabled for the organization. |

### 4.2 Organizations, Workspaces & Projects

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-TEN-01 | Create/switch organization | User | Organization created with personal workspace/project defaults. |
| UC-TEN-02 | Manage organization members | Org owner/admin | Invite, accept/decline, resend, cancel, change role, remove. |
| UC-TEN-03 | Create/manage workspace | Org admin | Workspace CRUD; unique slug per org; member roles admin/editor/viewer. |
| UC-TEN-04 | Create/manage project | Org member | Project CRUD; project requires org + workspace. |
| UC-TEN-05 | Invite project members | Project analyst | Invite by email; assign analyst/manager/cmo; expiry and resend. |
| UC-TEN-06 | Configure organization branding | Org owner/admin | Logo/colors used on public reports and dashboards (Professional Plus+). |
| UC-TEN-07 | Configure organization SSO | Org owner/admin + platform admin | SAML IdP metadata, domain verification, enforcement, JIT. |

### 4.3 Plan Studio (Flagship)

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-PLAN-01 | Run a guest plan | Guest | Website + platforms/markets/dates → 24 h plan; executes steps 0–6, then locks. |
| UC-PLAN-02 | Claim a guest plan | Guest → User | Registration/claim → plan attached to the user's "Lead-in Plans" project; token revoked. |
| UC-PLAN-03 | Create a plan (basic) | User | Website → AI plan with no follow-up questions; consumes one plan build. |
| UC-PLAN-04 | Create a plan (advanced) | User (Starter+) | Full brief (industry, product, competitors, channels, team, autonomy) → plan. |
| UC-PLAN-05 | Run/pause/resume a plan | Plan owner | Durable `PlanExecutionEngine` executes one step at a time; pause/resume/retry/skip. |
| UC-PLAN-06 | Answer a human gate | Plan owner | Gate options or free text → execution resumes (basic mode auto-approves). |
| UC-PLAN-07 | Chat with the plan | Plan owner | Streaming plan chat; change requests and questions. |
| UC-PLAN-08 | View/download artifacts | Plan owner | Versioned markdown/JSON/CSV/XLSX/PPTX artifacts; ZIP plan-pack export. |
| UC-PLAN-09 | Publish/launch a plan | Plan owner | Plan marked complete; optional draft campaigns per platform and targets written to `dra_campaign_targets`. |
| UC-PLAN-10 | Sync plan results | Plan owner | Pull actual channel/offline metrics into plan outcomes for plan-vs-actuals. |
| UC-PLAN-11 | Align plan to project | Plan owner | One plan becomes the project's current plan for comparison. |
| UC-PLAN-12 | Review outcomes/benchmarks | Plan owner | Compare planned vs actual; recompute learned benchmarks (min sample 30). |

### 4.4 Data Sources & Sync

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-DS-01 | Connect Google Ads | User | OAuth → account/MCC selection → data source + initial sync (11 default sync types). |
| UC-DS-02 | Connect GA4 | User | OAuth → property selection → data source + 6 report presets. |
| UC-DS-03 | Connect Google Ad Manager | User | OAuth → network selection → data source; 6 implemented report types. |
| UC-DS-04 | Connect Meta Ads | User | OAuth (`ads_read`, `business_management`) → ad account → 10 sync types. |
| UC-DS-05 | Connect LinkedIn Ads | Admin (gated) | OAuth → ad account → 6 tables; production-gated. |
| UC-DS-06 | Connect HubSpot | Admin (gated) | OAuth v3 → contacts/deals/pipeline snapshots. |
| UC-DS-07 | Connect Klaviyo | Admin (gated) | API key → campaigns/flows metrics. |
| UC-DS-08 | Connect SQL database | User (Professional+) | Validate credentials → schema/table discovery → live queries. |
| UC-DS-09 | Import MongoDB | User (Professional+) | Connection string → collection import into `dra_mongodb`; full/incremental. |
| UC-DS-10 | Upload Excel/CSV | User | Multi-file/sheet upload → preview → typed tables in `dra_excel`; socket progress. |
| UC-DS-11 | Import PDF with OCR | User | Ghostscript + AWS Textract → tables in `dra_pdf`. |
| UC-DS-12 | Configure sync schedule | User | Manual/hourly/daily/weekly/monthly; only GA4/GAM/Google Ads/Meta fire automatically. |
| UC-DS-13 | Review sync history/status | User | Sync ledger, row counts, duration, failures, retry. |
| UC-DS-14 | Edit/re-authorize credentials | User | Encrypted credential update or OAuth re-consent. |

### 4.5 Data Models, AI Modeler & Quality

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-DM-01 | Build a model visually | User (Professional+) | Tables/columns, joins, calculated columns, aggregates, filters, GROUP BY → SQL + preview. |
| UC-DM-02 | Generate a model with AI | User | Conversational AI data modeler → draft model → save. |
| UC-DM-03 | Get AI join suggestions | User | Schema analysis → confidence-scored joins; join catalog. |
| UC-DM-04 | Compose a model from models | User | Derived model, lineage graph, layer-flow warnings. |
| UC-DM-05 | Assign medallion layer | User/admin | `raw_data` / `clean_data` / `business_ready`; bulk migration wizard. |
| UC-DM-06 | Refresh a model | User/system | Atomic table swap; manual, cascade from source sync, or API; history retained. |
| UC-DM-07 | Review model health | User | healthy/warning/blocked, issue codes, nightly re-analysis. |
| UC-DM-08 | Explore model data | User | Column select, filters, sort, group, paginate, CSV export within tier row limits. |
| UC-DM-09 | Run data-quality analysis | User | Profile, weighted score, duplicates/outliers/consistency checks. |
| UC-DM-10 | Apply AI cleaning SQL | User | Dry-run + savepoint transaction; strategy allow-list. |
| UC-DM-11 | Ask AI about a model | User | Model-scoped Q&A over schema/sample data. |

### 4.6 Dashboards, Reports & AI Insights

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-BI-01 | Create a dashboard | User (Professional+) | Drag-and-drop cards/sections; 12 chart types. |
| UC-BI-02 | Configure a chart | User | Model/columns/aggregation → chart auto-configuration; AI widget spec. |
| UC-BI-03 | Export a dashboard | User | PNG export. |
| UC-BI-04 | Share a dashboard publicly | User | Anonymous keyed link with org branding. |
| UC-BI-05 | Generate AI insights | User | Select sources → streaming insights → follow-up chat → saved report. |
| UC-BI-06 | Publish insight to dashboard | User | AI-insight widget with date range and regeneration. |
| UC-BI-07 | Build a report | User | KPI cards, AI sections, text, tables, embedded dashboards, widgets. |
| UC-BI-08 | Generate a report with AI | User | One-click from a data model, optional AI analysis. |
| UC-BI-09 | Share a report publicly | User | Public key with 7/30/90-day expiry; revoke. |

### 4.7 Marketing Intelligence

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-INT-01 | View project overview | User | KPI cards, prior-period deltas, channel comparison, top campaigns, alerts. |
| UC-INT-02 | Drill into a campaign | User | KPI cards, trend, dimensions (ad group/device/geo/placement), settings. |
| UC-INT-03 | Set campaign/ad-set targets | Manager/CMO | CTR/CPC/CPA/CPL/ROAS/budgets/flight dates; used by target-aware alerts. |
| UC-INT-04 | Link external campaigns | Manager | Link/unlink DRA campaigns to platform campaigns. |
| UC-INT-05 | Review AI alerts | User | Anomaly/performance/budget alerts with severity and ad-set context. |
| UC-INT-06 | Optimize budget | User | Max ROAS/conversions or min CPA; current vs recommended allocation, pacing, AI explanation. |
| UC-INT-07 | Analyze attribution | User | 6 models (first/last/linear/time-decay/U-shaped/Shapley data-driven), model comparison. |
| UC-INT-08 | Build/analyze a funnel | User | UTM-based stages, preview, conversion/drop-off, channel breakdown. |
| UC-INT-09 | Run AI marketing analysis | User | Executive summary, KPI commentary, spend recommendations, risks, next steps (cost-ceiling enforced). |

### 4.8 Billing & Subscription

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-BILL-01 | Start checkout | Org owner/admin | `POST /subscription/checkout` → Paddle transaction/checkout URL. |
| UC-BILL-02 | Complete activation | Org owner/admin | Paddle webhook + `check-activation` polling → tier updated. |
| UC-BILL-03 | Preview/perform upgrade | Org owner/admin | Proration preview; paid→paid changes via Paddle. |
| UC-BILL-04 | Request downgrade | Org owner/admin | Validation against projects/members; admin approval path where required. |
| UC-BILL-05 | Cancel/reactivate | Org owner/admin | Cancel at period end; webhook drives local state; reactivation supported. |
| UC-BILL-06 | Manage payment method/invoices | Org owner/admin | Paddle portal, payment history, ledger. |
| UC-BILL-07 | Redeem promo code | Org owner/admin | Validate code → Paddle discount → checkout. |
| UC-BILL-08 | Handle failed payment | System | Grace period, alerts/emails, downgrade after expiry. |
| UC-BILL-09 | Reconcile with Paddle | Platform admin | Manual product/price/discount/subscription sync. |
| UC-BILL-10 | Cancel account | User | Retention window, warnings, data export, deletion/anonymization (does not cancel the org's Paddle subscription). |

### 4.9 Platform Administration

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-ADM-01 | Manage users | Platform admin | List/create/edit/delete, change admin type. |
| UC-ADM-02 | Manage organizations | Platform admin | Tier, members, billing, SSO, deactivation. |
| UC-ADM-03 | Manage subscription tiers | Platform admin | CRUD limits/prices; Paddle product/price/discount sync. |
| UC-ADM-04 | Review AI usage/cost | Platform admin | Per-feature logs, org/user rollups, monthly cost. |
| UC-ADM-05 | Review subscription analytics | Platform admin | MRR by tier, churn, involuntary churn, tier counts. |
| UC-ADM-06 | Manage enterprise inquiries/paid-plan interest | Platform admin | Review, convert, export. |
| UC-ADM-07 | Manage platform settings | Platform admin | Maintenance mode, registration, retention, export limits, notification toggles. |
| UC-ADM-08 | Run/monitor jobs and backups | Platform admin | Queue stats, retries, backup/restore with progress. |
| UC-ADM-09 | Manage content and sitemap | Platform admin | Articles/categories, sitemap entries, email funnels/broadcasts. |

### 4.10 Notifications, Growth & Consent

| ID | Use case | Primary actor | Trigger / outcome |
|---|---|---|---|
| UC-GROW-01 | Download a lead magnet | Guest/User | Gated form → one-time download token → email copy. |
| UC-GROW-02 | Receive lifecycle emails | User/lead | Funnel enrollment on download/signup/upgrade; scheduled steps; unsubscribe. |
| UC-GROW-03 | Send a broadcast | Platform admin | Audience selection, preview, immediate/scheduled send, tracking. |
| UC-GROW-04 | Receive in-app notifications | User | Sync, plan, billing, invitations, backups; read/unread, 90-day expiry. |
| UC-GROW-05 | Manage cookie consent | Guest/User | Regional Consent Mode v2 defaults; ad/analytics consent signals. |
| UC-GROW-06 | Subscribe to the blog | Guest | Subscribe, confirm, digest/broadcast emails, unsubscribe. |

## 5. Cross-Cutting Use Cases

| ID | Use case | Actors | Notes |
|---|---|---|---|
| UC-X-01 | Authenticate every protected request | All | `validateJWT` → org/workspace context → RBAC → tier enforcement. |
| UC-X-02 | Enforce a tier limit | System | HTTP 402 `TierLimitError` with `upgradeTiers`; Redis 30 s count cache. |
| UC-X-03 | Stream progress in real time | System | Socket.IO channels for sync, upload, PDF, plan, backup, notifications. |
| UC-X-04 | Audit AI usage/cost | System/admin | One `DRAAICallLog` per Gemini call; per-feature keys; cost ceiling. |
| UC-X-05 | Delete data safely | User/system | Cascade deletion + physical table/schema cleanup; account deletion anonymizes the user. |
| UC-X-06 | Encrypt/decrypt secrets | System | AES-256-GCM ValueTransformer; legacy plaintext tolerated on read. |

## 6. Detailed Example — Guest Plan (UC-PLAN-01/02)

| Field | Value |
|---|---|
| **Primary actor** | Guest |
| **Trigger** | Guest submits the website field on the public plan entry point. |
| **Preconditions** | No account required; plan-build quota is not consumed until the guest registers/claims. |
| **Success outcome** | A 24-hour guest plan exists, executes steps 0–6, and can be claimed into a real organization/project. |

**Main flow**

1. Frontend calls `POST /guest/plans` with website, name, platforms, markets, budget, and currency.
2. `GuestPlanProcessor` forces `basic` mode, creates a `DRAPaidMediaPlan` with `is_guest=true`, and stores a 32-byte base64url token in Redis (`guest-plan:token:*` ↔ `guest-plan:plan:*`, 24 h TTL).
3. `PlanExecutionEngine` runs steps 0–6, pausing at the intake/brief/URL gates as needed.
4. At step 7 the engine emits `guest_limit_reached` and stops; the UI shows the registration CTA.
5. On registration/claim, the plan is attached to the user's "Lead-in Plans" project/organization/workspace, guest markers are cleared, the token is revoked, one monthly plan build is consumed, and remaining steps are re-enqueued.
6. The engine's heartbeat deletes guest plans older than 24 hours.

**Alternatives**

- **Expired token:** claim returns not-found/expired; the user starts a new plan.
- **Quota exhausted:** claim is rejected with the tier-limit payload; the user can upgrade.
- **Gate unanswered:** execution remains `waiting_for_input` until answered or the plan expires.
