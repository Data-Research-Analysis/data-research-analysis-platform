# 01 — Backend Architecture

## Overview

The backend is an Express + TypeScript (ESM) monolith under `backend/src`, organized in the canonical flow:

```
HTTP → route file (Express Router) → per-route middleware → controller (optional) → processor → service → driver/DataSource → TypeORM entity
```

- **Route files**: 81 (54 root + 27 under `routes/admin/`), mounted in `backend/src/index.ts` (≈82 `app.use` mounts, some prefixes shared).
- **Controllers**: 6 thin HTTP adapters (`controllers/`) for analysis-heavy domains (AI data modeler, insights, campaigns, funnels, marketing metrics, campaign targets).
- **Processors**: 45 singleton business-logic classes.
- **Services**: 122 (110 root + `adapters/` 1, `detection/` 5, `file-uploads/` 6).
- **Drivers**: 19 abstractions over DB/file/mail/socket/external APIs.
- **Middleware**: 13 modules applied per-route.

## Boot sequence (`backend/src/index.ts`)

Top-level awaits because `"type": "module"`:

1. **Crash handling**: `unhandledRejection` → log only; `uncaughtException` → graceful `httpServer.close()` + `process.exit(1)` with a 10s force-exit timeout.
2. **Shared HTTP server**: `createServer(app)` used by Express and Socket.IO.
3. **`UtilityService.initialize()`** — loads dotenv, builds the Postgres DataSource (5 retries, exponential backoff 1s→16s), validates `ENCRYPTION_KEY` (fail-fast on invalid AES-256 key), starts queue workers, registers the cascade-refresh trigger (`SyncEventEmitter SYNC_COMPLETED → RefreshQueueService → DataModelRefreshService`).
4. **`GeolocationService.initialize()`** — independent of DB readiness (geolocation must work when DB is down).
5. **DB gate + AppDataSource cache** — resolves `DBDriver → PostgresDriver → DataSource`, primes `getAppDataSource()`, initializes `NotificationProcessor`.
6. **`OAuthSessionService`** — starts 30-minute orphan-session cleanup.
7. **`PlanExecutionEngine.initialize()`** — durable paid-media plan loop (recovery + gate-pausing).
8. **Schedulers** (env-gated):
   - `ScheduledBackupService.startScheduler()` (default `0 0 * * *`)
   - `SchedulerService.initialize()` (every-minute data-source sync scheduler)
9. **7 cron jobs** (see [08 — Background Jobs & Queues](08-background-jobs.md)).
10. **`QueueService.run()`** — starts θ-mn-queue workers. *(Note: also started inside `UtilityService.initialize()` — potential double start.)*
11. **`EmailFunnelWorker.start()`** — 5-minute poller.
12. **Express pipeline**: trust proxy → 10-min request/response timeout → CORS (effectively allow-all with credentials) → bodyParser `1000mb` → compression (gzip/Brotli, >1KB) → **`generalApiLimiter`** (100 req/min per user or IP) → route mounts → static `/uploads` + `/`.
13. **Socket.IO on shared server**, then `httpServer.listen(PORT)` (default 3002).

## Middleware pipeline

Applied per-route from `backend/src/middleware`:

| Middleware | Responsibility |
|---|---|
| `authenticate.ts` (`validateJWT`) | Validates Bearer JWT via `TokenProcessor.validateToken`; `authorization-type: auth` populates `req.tokenDetails`/`req.user_id`; `non-auth` allows anonymous token. Missing header passes through (protection is opt-in per route). |
| `authorize.ts` (`authorize`, `authorizeAll`) | RBAC permission check (ANY/ALL) via `RBACService` against `Permission` enum; resolves project id from params/body/query or via resource relations. |
| `rbacMiddleware.ts` | `requireProjectAccess`, `requireProjectPermission`, `requireDataSourcePermission`, `requireDataModelPermission`, `requireDashboardPermission` via `PermissionService` (`EAction`/`EResourceType`). |
| `organizationContext.ts` | Resolves org from `X-Organization-Id` → query → body; verifies membership (admins bypass as OWNER); sets `req.organizationId`/`req.organizationRole`; also `requireOrganizationRole` (OWNER>ADMIN>MEMBER) and `optionalOrganizationContext`. |
| `workspaceContext.ts` | Resolves workspace from `X-Workspace-Id` → query → body (must run after org context); validates org membership; sets `req.workspaceId`/`req.workspaceRole`; `requireWorkspaceRole` (ADMIN>EDITOR>VIEWER). |
| `requiresProjectRole.ts` | Marketing-role gate (`analyst`/`manager`/`cmo`) for intelligence/reporting/planning; project creator and admins → `analyst`; sets `req.projectRole`. |
| `tierEnforcement.ts` | Plan-limit guards returning HTTP 402 `TierLimitError`: project, data source, data model, dashboard, AI generation (increments counter), AI cost ceiling (monthly USD), plan builds, sub-user, advanced tools. |
| `requiresProductionAccess.ts` | 403 non-admins on LinkedIn/HubSpot/Klaviyo add+sync ("integration under review"). |
| `rateLimit.ts` | 9 limiters (see [09 — Security](09-security.md)). |
| `validator.ts` (`validate`) | express-validator chains, 400 with `errors[]`; `validatePasswordStrength`. |
| `validation.ts` | Legacy manual validators: `sanitizeInput` (XSS strip), SQL-injection regex, `validateDataSource/DataModel/Dashboard/UserInput`. |
| `etagCache.ts` | MD5 ETag on GET, 304 handling, `Cache-Control: private, no-cache, must-revalidate`. |
| `validateFileUpload.ts` | Excel upload chain: size (`MAX_EXCEL_FILE_SIZE_MB` default 50), type (xlsx/xls/xlsm/csv), queue-size (placeholder/no-op). |

## Drivers (`backend/src/drivers`, 19)

| Driver | Abstracts |
|---|---|
| `DBDriver` | Factory over `IDBDriver` keyed by `EDataSourceType` (Postgres/MySQL/MariaDB/MongoDB; CSV/EXCEL/PDF fall through to Postgres). |
| `PostgresDriver` / `MySQLDriver` / `MariaDBDriver` | External DB connections + `information_schema` introspection. |
| `MongoDBDriver` | Native Mongo via connection string; collection schema inference + aggregation. |
| `SocketIODriver` | The live real-time layer: JWT-authenticated sockets, `user-{id}` and `admin-dashboard` rooms, `emitEvent`/`emitToUser`/`emitToRoom`. |
| `MailDriver` / `NodeMailerDriver` | SMTP facade + Nodemailer transport. |
| `FileDriver` / `HTMLFileDriver` | HTML template reads for `TemplateEngineService`. |
| `TextExtractDriver` / `AmazonTextExtractDriver` | AWS Textract OCR for PDF pages → `CPage`/`CLine`/`CWord`. |
| `GoogleAnalyticsDriver`, `GoogleAdManagerDriver`, `GoogleAdsDriver`, `MetaAdsDriver`, `LinkedInAdsDriver`, `HubSpotDriver`, `KlaviyoDriver` | `IAPIDriver` implementations that sync external APIs into `dra_*` schemas. |

## Processors (45 singletons)

All follow private-constructor + static `getInstance()` (verified across all 45; `PaidMediaPlanProcessor`/`GuestPlanProcessor`/`ProductEventProcessor` internally construct others). Grouped by domain:

- **Auth/account**: `AuthProcessor`, `TokenProcessor`, `UserProcessor`, `UserManagementProcessor`, `AccountCancellationProcessor`, `SSOProcessor`, `OAuthProcessor`, `EmailPreferencesProcessor`.
- **Tenancy**: `OrganizationProcessor`, `ProjectProcessor` (792 lines — cascade deletion coordinator).
- **Data**: `DataSourceProcessor` (925 lines), `ExcelDataSourceProcessor`, `PDFDataSourceProcessor`, `DataModelProcessor`, `QueryEngineProcessor` (1833 lines — SQL/Mongo execution, row limits), `DataQualityProcessor`, `TableMetadataService`-backed flows.
- **BI**: `DashboardProcessor`, `InsightsProcessor` (1511 lines), `IntelligenceReportProcessor` (1113 lines), `ReportProcessor`, `AttributionProcessor`.
- **Marketing**: `CampaignProcessor`, `OfflineTrackingProcessor`, `CampaignTargetsController`-backed `CampaignTargetsService`, `MarketingMetricsController`-backed services.
- **Ads/CRM**: `GoogleAnalyticsProcessor`, `GoogleAdManagerProcessor`, `GoogleAdsProcessor`, `MetaAdsProcessor`, `LinkedInAdsProcessor`, `HubSpotProcessor`, `KlaviyoProcessor`.
- **Plan studio**: `PaidMediaPlanProcessor`, `GuestPlanProcessor`, `PlanBenchmarkService`-backed flows.
- **Billing**: `SubscriptionProcessor` (1966 lines), `SubscriptionTierProcessor`, `PromoCodeProcessor`.
- **Content/growth**: `ArticleProcessor`, `CategoryProcessor`, `SitemapProcessor`, `LeadGeneratorProcessor`, `EmailFunnelProcessor`, `EnterpriseQueryProcessor`.
- **Platform**: `PlatformSettingsProcessor`, `ProductEventProcessor`, `AdminStatsProcessor`, `ScheduledBackupProcessor`, `NotificationProcessor`.

## Controllers (6)

Static-method HTTP adapters for new, analysis-heavy domains (most routes skip controllers and call processors directly):

- `AIDataModelerController` (2466 lines) — AI modeler sessions, chat, schema collection, joins, data-quality/attribution expert modes.
- `InsightsController` (479 lines) — AI insights session + generation (202 + Socket.IO progress).
- `CampaignController`, `FunnelController`, `MarketingMetricsController`, `CampaignTargetsController`.

## Datasources

- `PostgresDataSource.ts` — factory for runtime + external Postgres connections (`type: "postgres"`, `synchronize: false`, 77 entities).
- `PostgresDS.ts` — runtime singleton cache: `getAppDataSource()` (and a `@deprecated` `AppDataSource` Proxy still used in places).
- `PostgresDSMigrations.ts` — **migrations-only datasource** on a separate host/port (`POSTGRESQL_HOST_MIGRATIONS`/`PORT_MIGRATIONS`); all `npm run migration:*` scripts target it.
- `MySQLDataSource.ts` / `MariaDBDataSource.ts` — external-source connections, empty entity/migration lists (runtime introspection).

## Conventions & notes

- TypeScript: `target es2022`, `module/moduleResolution NodeNext`, `strict: false`, decorators enabled (TypeORM), ESM with `.js` import extensions.
- Migrations are run only through `PostgresDSMigrations.ts`; runtime datasource has `synchronize: false`.
- **Dormant code**: `routes/google_ad_manager_rate_limit.ts` never mounted; `websockets/WebSocketManager.ts` (ws-based) never instantiated (superseded by Socket.IO); `workers/service.js` is a stale compiled artifact (imports `../../dist/`).
- **Legacy leftovers**: `PrivateBetaUserProcessor` no longer exists → `EnterpriseQueryProcessor`; `dra_private_beta_users` renamed to `dra_enterprise_queries`; beta email templates remain.

See [03 — Data Architecture](03-data-architecture.md) for entity/datasource detail and [04 — Authentication & RBAC](04-authentication-rbac.md) for the full access-control stack.
