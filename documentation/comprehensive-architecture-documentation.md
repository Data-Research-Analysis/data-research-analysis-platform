# Data Research Analysis Platform — Comprehensive Architecture Documentation

> **Status**: Reviewed and updated against the codebase on 2026-10-22. This document is the high-level narrative; the per-subsystem details live in [`documentation/architecture/`](architecture/README.md).

## Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Tenancy & Access Model](#tenancy--access-model)
- [Backend Layering](#backend-layering)
- [Data Architecture](#data-architecture)
- [AI & Plan Studio](#ai--plan-studio)
- [Billing & Subscriptions](#billing--subscriptions)
- [Integrations](#integrations)
- [Background Processing](#background-processing)
- [Security](#security)
- [Frontend Architecture](#frontend-architecture)
- [Key Architectural Decisions](#key-architectural-decisions)
- [Technology Stack](#technology-stack)
- [PlantUML Diagrams Index](#plantuml-diagrams-index)
- [References](#references)

## Overview

The Data Research Analysis Platform (DRA) is a full-stack SaaS for marketing intelligence and AI-driven paid-media planning. Users connect marketing data sources, build medallion-layered data models, visualize in dashboards, run an AI **Plan Studio** that produces exportable paid-media plans, and launch them into campaign tracking with attribution, funnel analysis, anomaly detection, and shareable reports.

**Scale (2026-10):** backend 81 route files / 45 processors / 122 services / 19 drivers / 77 entities / 137 migrations; frontend 129 pages / 218 components / 91 composables / 23 Pinia stores.

### Key Features
- **Plan Studio**: 18-step AI plan pipeline (steps 0–17, 5 user gates), 18 skill packs, 11 tools, 3 sandbox scripts, 20 artifact contracts, ZIP export, guest (24 h no-account) previews, launch-to-campaign with north-star targets.
- **Multi-tenant workspaces**: Organization → Workspace → Project with org/workspace/project roles and subscription tiers.
- **Data ingestion**: 14 data source types — Google Ads (v25, 11 report types, MCC), GA4 (6 presets), Google Ad Manager, Meta Ads (v25), LinkedIn Ads, HubSpot, Klaviyo, PostgreSQL/MySQL/MariaDB (live), MongoDB (imported), Excel/CSV, PDF+OCR (Ghostscript + AWS Textract).
- **Data modeling**: materialized SQL models in PostgreSQL, medallion layers (`raw_data`/`clean_data`/`business_ready`), lineage, health scoring, refresh with atomic table swap, AI data modeler with Redis sessions.
- **Marketing intelligence**: campaign analysis, 6 attribution models, funnels, anomaly detection (4 methods), budget optimization, AI insights, report builder with public shares.
- **AI metering**: every Gemini call logged (`DRAAICallLog`) by feature key for per-feature cost comparison and per-tier cost ceilings.
- **Billing**: Paddle checkout/webhooks, 5-tier ladder (Free/Starter/Professional/Professional Plus/Enterprise), grace periods, promo codes, GDPR 90-day webhook TTL.
- **Security**: AES-256-GCM at rest, JWT + SAML SSO, reCAPTCHA, proxy-aware rate limiting, SQL validation, DOMPurify markdown sanitization, consent-mode-v2 cookie compliance, account deletion pipeline.

## System Architecture

```
Browser (Nuxt 3 SSR)  ──HTTP/JWT──>  Express API (port 3002)  ──>  PostgreSQL + Redis
        │                                │  (Socket.IO on same HTTP server)
        └── real-time events (sync/plan/backup progress)  <───┘
```

- **Frontend**: Nuxt 3.17 SSR/CSR hybrid with lazy components, Pinia stores, 8 global middlewares, 18 plugins.
- **Backend**: Express + TypeScript ESM monolith — routes → controllers → processors → services → drivers.
- **Database**: PostgreSQL (TypeORM, 77 entities, 137 migrations, dedicated migrations datasource).
- **Cache/session**: Redis 7 (ioredis) — AI sessions, OAuth tokens, SSO SAML state, tier count caches, guest-plan tokens.
- **Queue**: theta-mn-queue (7 named queues) + Node worker_threads for PDF/OCR/backup/restore/Excel/MongoDB.
- **Real-time**: Socket.IO on the shared HTTP server (JWT-authenticated, per-user rooms).
- **Cloud**: AWS S3 + Textract for OCR; SMTP for email; Paddle for billing; Gemini for AI.
- **Background**: 7 cron jobs + email-funnel worker + durable PlanExecutionEngine + sync/backup/deletion schedulers.

## Tenancy & Access Model

See [04 — Authentication & RBAC](architecture/04-authentication-rbac.md) and [tenancy-hierarchy-class-diagram.puml](architecture/tenancy-hierarchy-class-diagram.puml).

```
DRAOrganization ── 1:1 subscription / tier
  └─ DRAWorkspace (slug unique per org)
       └─ DRAProject (org + workspace NOT NULL)
            ├─ DataSource ── DataModel ── Lineage / RefreshHistory
            ├─ Dashboard / Campaign / PaidMediaPlan / Report / AIInsightReport
```

- **Roles**: platform (`admin`/`normal`), org (`owner`/`admin`/`member`), workspace (`admin`/`editor`/`viewer`), project marketing personas (`analyst`/`manager`/`cmo`) with an 18-permission matrix in `constants/permissions.ts`.
- **Context resolution**: `X-Organization-Id` → `organizationContext`; `X-Workspace-Id` → `workspaceContext`; project RBAC via `authorize`/`rbacMiddleware`/`requiresProjectRole`.
- **Tier enforcement**: `TierEnforcementService` (Redis-backed 30s count cache) + 9 middlewares returning HTTP 402 `TierLimitError` with an `upgradeTiers` ladder for the UI.
- Isolation is application-level (no Postgres RLS).

## Backend Layering

See [01 — Backend Architecture](architecture/01-backend-architecture.md).

**Request flow**: HTTP → route file → per-route middleware → controller (optional) → processor → service → driver/DataSource → TypeORM entity.

- **Boot sequence** (`index.ts`): crash handlers → shared HTTP server → `UtilityService.initialize()` (dotenv, DB connect with retries, ENCRYPTION_KEY validation, queue workers) → GeolocationService → NotificationProcessor → OAuthSessionService → PlanExecutionEngine → backup/sync schedulers → 7 cron jobs → queue + email worker → Express pipeline (CORS, 1000 mb body, compression, global rate limiter) → Socket.IO → listen.
- **Middleware stack** (13 modules): validateJWT, authorize/RBAC, org/workspace context, requiresProjectRole, tierEnforcement, requiresProductionAccess, rate limiting, validation, ETag caching, file-upload validation.
- **45 singleton processors** (private constructor + `getInstance()`), from `AuthProcessor` to `SubscriptionProcessor` (1966 lines).
 - **122 services**: core (`UtilityService`, `EncryptionService`), tier/RBAC (`TierEnforcementService`, `RBACService`, `PermissionService`, `OrganizationService`), AI (`GeminiService`, `AICallTrackerService`, `RedisAISessionService`), plan studio (engine/state/skill/artifact/export/launch/benchmark), data (`DataModelRefreshService`, `DataModelHealthService`, `DataModelLayerService`, quality services), connectors, billing, schedulers.
- **19 drivers**: DB factory (`DBDriver`), Socket.IO, mail, file, Textract, and 7 `IAPIDriver` connectors.
- **6 controllers** for analysis-heavy domains (AIDataModelerController is 2466 lines).

## Data Architecture

See [03 — Data Architecture](architecture/03-data-architecture.md).

- **Schema families**: `public` for metadata (`dra_*` tables) + per-source ingest schemas (`dra_excel`, `dra_pdf`, `dra_mongodb`, `dra_google_analytics`, `dra_google_ad_manager`, `dra_google_ads`, `dra_meta_ads`, `dra_linkedin_ads`, `dra_hubspot`, `dra_klaviyo`).
- **Physical naming**: ingest tables `ds{id}_{md5[:8]}` (`TableMetadataService`); data-model outputs `public."{name}_dra_{uuid}"`.
- **Medallion layers**: `raw_data` / `clean_data` / `business_ready` on `DRADataModel.data_layer` with `DataModelLayerService` detection heuristics (transforms/filtering/dedup/aggregation/joins) and bulk-assignment wizards + admin migration.
- **Refresh**: atomic `CREATE TABLE AS ... RENAME` swap via `DataModelRefreshService`, driven by the in-memory `RefreshQueueService` (3 concurrent, priorities, 3 retries) — manual/cascade/API triggered.
- **Health**: `DataModelHealthService` classifies models (`healthy|warning|blocked|unknown`) with issue codes; nightly re-analysis job.
- **Quality**: profiling + weighted scores (completeness/validity/uniqueness/consistency), IQR outliers, cross-column consistency, cleaning strategies with savepoint dry-runs.
- **Migrations**: 137 timestamped migrations run against `PostgresDSMigrations.ts` (separate host/port); 9 idempotent seeders.
- Tables without entities: attribution/funnel/quality/targets/summaries — managed by raw SQL.

## AI & Plan Studio

See [06 — AI & Plan Studio](architecture/06-ai-plan-studio.md) and [plan-execution-engine-sequence-diagram.puml](architecture/plan-execution-engine-sequence-diagram.puml).

- **Gemini** (`gemini-2.5-flash` default): streaming + non-streaming, domain prompt templates, 17 AI feature keys for usage tracking.
- **Plan Studio**: 18 steps (0–17) across discover/define/build/launch/present with 5 gates; 18 skill packs (`backend/skills/paid-media/`); 11 tools; 3 sandbox scripts (2×XLSX, 1×PPTX); 20 artifact contracts; ZIP export; guest plans (24 h, steps ≤6); launch → campaigns + north-star targets (`dra_campaign_targets`); benchmarks learned from outcomes.
- **Durable execution**: `PlanExecutionEngine` drives one step per iteration, re-enqueues after each, heals stale running steps (45 min), auto-approves gates in basic mode, pauses in advanced, expires guest plans.
- **AI Data Modeler**: Redis session + PG persistence, schema collection, join inference, chat, model drafts, cross-source support, data-quality/attribution expert modes.
- **AI Insights & Reports**: streaming generation over Socket.IO, widget spec generation, report builder with public shares, intelligence hub with AI analysis.
- **Metering**: `AICallTrackerService` writes one `DRAAICallLog` per Gemini call (tokens, latency, USD cost by model rate) — used by `enforceAICostCeiling` and the admin AI-usage UI.

## Billing & Subscriptions

See [05 — Billing & Subscriptions](architecture/05-billing-subscription.md).

- **5 tiers** by `tier_rank` (0/10/20/30/40): Free $0, Starter $29/$276, Professional $129/$1,236, Professional Plus $399/$3,828, Enterprise $2,499/$23,990 (annual = 20% off). Limits include projects/sources/dashboards/rows/members/AI generations/plan builds/AI cost ceiling.
- **Paddle**: checkout via pre-built transaction (frontend overlay), HMAC-verified webhooks (10 event types) with idempotency on `dra_paddle_webhook_events`, grace periods (default 14 days), immediate/downgrade paths with `prorated_immediately`, payment ledger (`DRAPaymentTransaction`), promo codes synced to Paddle discounts, manual admin sync (`/admin/paddle/sync*`).
- **Lifecycle states**: Free / Active paid / Pending cancellation / Grace / Cancelled-expired (job downgrades to Free) / Trial (column exists, no flow).
- **Account cancellation** is per-user (retention + deletion via `ScheduledDeletionJob` + `DataDeletionService`); it does **not** cancel the org's Paddle subscription.
- **Frontend**: `subscription` store + `usePaddle` + `TierLimitModal` + `/subscription/{current,usage,tiers}` endpoints.

## Integrations

See [07 — Integrations](architecture/07-integrations.md).

- **Shared Google OAuth**: scopes per service (analytics/dfp/adwords), encrypted Redis token sessions (15-min TTL), refresh on demand; documented gaps (no PKCE, unsigned state, no OAuth rate limiter, session ownership).
- **Google Ads v25** (11 report types, MCC up to 10 clients, per-client tables, developer token optional since Sept 2026), **GA4** (6 presets), **GAM** (6 code-level report types vs 5 advertised — mismatch), **Meta v25** (10 types, `ads_read` + `business_management` only), **LinkedIn** (202601 API, 6 tables), **HubSpot** (OAuth v3, 3 tables), **Klaviyo** (API key, 3 tables).
- **Engineering**: live Postgres/MySQL/MariaDB; MongoDB import (full/incremental, adaptive batches, partial pipeline translation — `$group`/`$lookup` TODO); Excel/CSV (queue, 3 retries, 500 MB route / 50 MB validated); PDF+OCR (Ghostscript worker + Textract).
- **Sync**: `SyncHistoryService` ledger; `SchedulerService` every minute — only GA4/GAM/Google Ads/Meta eligible; MongoDB/Excel queue jobs; Socket.IO progress channels.
- **Gating**: LinkedIn/HubSpot/Klaviyo add+sync are admin-only (`requiresProductionAccess`); Meta is not gated.
- **Onboarding**: adding an ad-platform source auto-creates models + a paid-media dashboard.

## Background Processing

See [08 — Background Jobs & Queues](architecture/08-background-jobs.md).

- **7 cron jobs**: webhook cleanup (Sun 03:00, 90-day TTL), invitation expiry (hourly), expired-subscription downgrade (03:00), payment-method expiry (1st of month 09:00), data-model health re-analysis (02:00), subscription grace period (02:00), account deletion lifecycle (02:00).
- **EmailFunnelWorker**: 5-minute poller, daily cap.
- **Queue** (theta-mn-queue): PDF conversion, text extraction, file deletion, DB backup, DB restore, MongoDB sync, Excel upload — processed via worker threads or inline, purged at startup.
- **Schedulers**: data-source sync (every minute), scheduled backups (`0 0 * * *` default, retention 30 days), refresh queue (in-memory, 3 concurrent), PlanExecutionEngine (durable).
- Env toggles: `BACKUP_ENABLED`, `SYNC_SCHEDULER_ENABLED`, `SCHEDULED_DELETION_ENABLED`, `EMAIL_FUNNEL_ENABLED`, `HEALTH_REANALYSIS_ENABLED`, `RATE_LIMIT_ENABLED`, `PLAN_ANALYTICS_ENABLED`.

## Security

See [09 — Security](architecture/09-security.md).

- **Encryption**: AES-256-GCM with 64-hex `ENCRYPTION_KEY`, versioned envelope, TypeORM ValueTransformer on data-source credentials; OAuth tokens encrypted in Redis.
- **Rate limiting**: 9 express-rate-limit limiters (global 100/min, auth 5/15 min, AI 30/min, insights 15/h, …), proxy-aware IP detection, plus an outbound token-bucket (`RateLimiterRegistry`) for GAM.
- **Validation**: express-validator chains, password strength, SQL-injection regexes, `SQLValidationService` allowlist, `AISQLValidatorService` table whitelist, DOMPurify allow-list on the frontend, reCAPTCHA v3.
- **Auth**: JWT (non-expiring payload, 3-day strict cookie, no refresh flow), bcrypt with salt, anti-enumeration password reset, SAML SSO with replay protection + one-time codes + DNS TXT domain verification + Enterprise-tier gate.
- **Privacy**: Consent Mode v2 with regional defaults (MaxMind GeoLite2), 90-day webhook TTL, account deletion pipeline with user anonymization and billing-ID nulling, product-event PII stripping.
- **Known debt**: effectively open CORS, unsigned OAuth state, in-memory rate-limit stores, no RLS, some legacy admin routes with processor-level auth.

## Frontend Architecture

See [02 — Frontend Architecture](architecture/02-frontend-architecture.md).

- **Nuxt 3.17 SSR**: full SSR for marketing, client-only data for the app; lazy components; immutable cache route rules; GTM + Consent Mode v2.
- **Middleware pipeline**: `00-route-loader → 00a/00b → 01-authorization → 02-load-data → 03-validate-data → 04-project-role → 05-advanced-tools`.
- **23 Pinia stores** (localStorage-synced setup stores), **91 composables** (HTTP/auth, access, data, connectors, intelligence, billing, perf), **18 plugins** (socketio, paddle, ga-consent, recaptcha, htmlToImage, …).
- **Charting**: 12 chart types in `constants/dashboard.ts` rendered by custom d3 components; html-to-image export.
- **Markdown**: `marked` → `isomorphic-dompurify` allow-list.
- **SSR validation**: `npm run validate:ssr` (8 checks) + 31-check SSR test suite.

## Key Architectural Decisions

1. **ESM + TypeScript monolith** (`.js` import extensions, top-level await boot).
2. **Shared HTTP server** for Express + Socket.IO.
3. **Singleton processors/services** with static `getInstance()`.
4. **Driver factory** over `EDataSourceType` (`DBDriver`), `IAPIDriver` for connectors.
5. **Application-level multi-tenancy** (no RLS): org → workspace → project with RBAC.
6. **Centralized tier enforcement** (402 + upgrade ladder), Redis 30s count cache.
7. **Transparent encryption** via TypeORM ValueTransformer (AES-256-GCM).
8. **Materialized data models** (physical tables, atomic refresh swap).
9. **Per-source ingest schemas** with hash-based physical table names.
10. **Per-feature AI cost tracking** (`DRAAICallLog`) with tier ceilings.
11. **Durable plan execution engine** with gate pausing and auto-approval in basic mode.
12. **Cascade deletion with physical cleanup** inside transactions.
13. **Medallion layers** (`raw_data`/`clean_data`/`business_ready`) with lineage and health.
14. **Hybrid SSR**: server-rendered marketing, client-only app data.

## Technology Stack

| Area | Stack |
|---|---|
| Backend | Node 24, TypeScript 5.9 (ESM, NodeNext), Express 4.21, Socket.IO 4 |
| Database | PostgreSQL (Citus dev image), TypeORM 0.3, 137 migrations |
| Cache/queue | Redis 7 (ioredis), theta-mn-queue, worker_threads |
| AI | Google Gemini (`gemini-2.5-flash`), `@google/genai` |
| Billing | Paddle (`@paddle/paddle-node-sdk`) |
| Ad/CRM APIs | Google Ads v25, GA4 v1beta, GAM, Meta v25, LinkedIn 202601, HubSpot OAuth v3, Klaviyo |
| OCR/storage | AWS S3 + Textract, Ghostscript |
| Email | Nodemailer + Handlebars |
| Frontend | Nuxt 3.17, Vue 3.5, Pinia 3, Tailwind 4, Vite 6, d3 |
| Auth | JWT, bcryptjs, passport-saml, reCAPTCHA v3 |
| Tests | Jest 30 (backend), Vitest + @nuxt/test-utils (frontend) |
| Ops | Docker Compose (6 services), PM2, Jenkins, Winston |

## PlantUML Diagrams Index

All `.puml` sources live in [`documentation/architecture/`](architecture/README.md) with rendered `.png` files. Highlights:

- **Entities**: [backend-models-class-diagram.puml](architecture/backend-models-class-diagram.puml)
- **Services**: [services-architecture-class-diagram.puml](architecture/services-architecture-class-diagram.puml)
- **Frontend**: [frontend-components-class-diagram.puml](architecture/frontend-components-class-diagram.puml)
- **Tenancy**: [tenancy-hierarchy-class-diagram.puml](architecture/tenancy-hierarchy-class-diagram.puml)
- **Request pipeline**: [request-pipeline-sequence-diagram.puml](architecture/request-pipeline-sequence-diagram.puml)
- **Plan engine**: [plan-execution-engine-sequence-diagram.puml](architecture/plan-execution-engine-sequence-diagram.puml)
- **Flows**: authentication, api-integration, realtime-communication, cascade-deletion, subscription-billing, google-oauth-data-sources, ai-data-modeler, ai-insights, attribution, data-quality, data-manipulation, database-backup-restore, notifications, project-members-invitations, mongodb-integration, excel-pdf-data-manipulation, pdf-processing, account-cancellation.

## References

- [documentation/README.md](README.md) — documentation index, policy, and removed-document log
- [architecture/README.md](architecture/README.md) — index of subsystem docs and diagram inventory
- [FEATURES.md](FEATURES.md) — feature-level inventory (`[x]` / `[-]` / `[ ]`)
- [CHANGELOG.md](../CHANGELOG.md) — chronological change history
- [product-market-business-review.md](product-market-business-review.md) — product/market/business analysis
- [SETUP.md](SETUP.md) — setup & orchestration guide
