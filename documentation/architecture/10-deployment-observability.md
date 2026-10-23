# 10 — Deployment & Observability

## Docker topology (`docker-compose.yml`)

Six services on `docker_test_network` (all `env_file: ./.env`, backend also `backend/.env`, `VIRTUAL_HOST` per service):

| Service | Build/image | Ports | Role |
|---|---|---|---|
| `frontend.dataresearchanalysis.test` | `docker/frontend/Dockerfile` (node:22-alpine, `USER node`) | 3000 | Nuxt dev (`npm install && NUXT_HOST=0.0.0.0 npm run dev`) |
| `backend.dataresearchanalysis.test` | `docker/backend/Dockerfile` (ubuntu:22.04 + Node 24 via NodeSource + PostgreSQL 18 client + Ghostscript + GraphicsMagick + python3/python-pptx, non-root `appuser` matching host UID) | 3002 | Express API + Socket.IO (`npm install && npm run dev`) |
| `database.dataresearchanalysis.test` | `citusdata/citus` | 5434→5432 | Primary PostgreSQL (external volume) |
| `redis.dataresearchanalysis.test` | `redis:7-alpine` | 6379 | Cache/sessions (AUTH commented out) |
| `mysql-test-database.*` | `mysql` (oraclelinux9) | 3306 | External MySQL test source |
| `mariadb-test-database.*` | `mariadb` (lts-ubi9) | 3307 | External MariaDB test source |

Root `package.json` orchestrates with `setup-cli.js` (`dockerode`): `npm run setup`, `setup:build`, `setup:health`, `setup:validate`, `setup:status`, `setup:logs`, `setup:restart`, etc.

## Production process management (PM2)

- `frontend/ecosystem.config.cjs` — `DRA-Frontend-Marketing`, fork mode ×1, `./.output/server/index.mjs` (Nuxt production server), port `NUXT_PORT`.
- `backend/ecosystem.config.cjs` — `DRA-Backend-Marketing`, fork mode ×1, `ts-node src/index.ts` (dev-style from source). **Note**: worker threads (`workers/service.js`) import from `../../dist/`, so production workers require a prior `npm run build`; PM2 instances are single-fork (no cluster mode).

## CI (Jenkinsfile)

Two stages, **build only** (no test/deploy stages):
1. **Build Frontend** — writes `.env` from Jenkins credentials (`NUXT_API_URL, NUXT_RECAPTCHA_SITE_KEY, NUXT_PORT, NUXT_GTM_ID, NUXT_PLATFORM_ENABLED`), then `npm ci && npm run build`.
2. **Build Backend** — writes `backend/.env` from credentials (`PUBLIC_BACKEND_URL, PORT, RECAPTCHA_SECRET, JWT_SECRET, PASSWORD_SALT, DB_DRIVER, POSTGRESQL_*` incl. `_MIGRATIONS` variants, `NODE_ENV, MAIL_*`), then `npm ci`.

All secrets come from Jenkins credentials entries.

## Environment configuration (`.env.example` + `backend/.env.example`)

Key groups (architecturally relevant):

- **Server**: `PORT` (3002), `PUBLIC_BACKEND_URL`, `FRONTEND_URL`, `BACKEND_URL`, `NODE_ENV`.
- **Security**: `JWT_SECRET`, `PASSWORD_SALT`, `RECAPTCHA_SECRET`, `ENCRYPTION_KEY` (64-hex AES-256; fail-fast), `ENCRYPTION_ENABLED`.
- **Rate limits**: `RATE_LIMIT_ENABLED` + `RATE_LIMIT_{AUTH,EXPENSIVE,API,AI,OAUTH}_{WINDOW_MS,MAX}` (documented; the limiters hardcode limits — env values are aspirational).
- **Databases**: `DB_DRIVER`, `POSTGRESQL_HOST/PORT/USERNAME/PASSWORD/DB_NAME`, **`POSTGRESQL_HOST_MIGRATIONS/PORT_MIGRATIONS`** (migrations datasource), optional `MYSQLDB_*`/`MARIADB_*`.
- **Redis/queue**: `REDIS_HOST/PORT/PASSWORD/DB`, `DATA_DRIVER`, `QUEUE_STATUS_INTERVAL`, `NUM_WORKERS`.
- **Email**: `MAIL_*`, `EMAIL_ENABLED`, `EMAIL_RATE_LIMIT_*`, `SUPPORT_EMAIL`, `ADMIN_EMAIL`.
- **Socket.IO**: `SOCKETIO_SERVER_URL/PORT`, `SOCKETIO_CLIENT_URL/PORT`.
- **AWS**: `AWS_ACCESS_KEY_ID/SECRET/REGION`, `AWS_S3_IMAGES_EXTRACT_BUCKET`, `IMAGE_PAGE_WIDTH/HEIGHT`.
- **AI**: `GEMINI_API_KEY`, `PLAN_MODEL`, `PLAN_SEARCH_PROVIDER`, `PLAN_SKILLS_DIR`, `PLAN_SCRIPT_*`, `PLAN_BENCHMARK_MIN_SAMPLE`, `PLAN_ANALYTICS_ENABLED`, `MAX_EXCEL_FILE_SIZE_MB`, `MAX_QUEUED_UPLOADS_PER_USER`.
- **Ad platforms**: `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `GOOGLE_ADS_DEVELOPER_TOKEN` (optional since Sept 2026), `META_APP_ID/SECRET/REDIRECT_URI`, `LINKEDIN_CLIENT_ID/SECRET/REDIRECT_URI`, `HUBSPOT_CLIENT_ID/SECRET/REDIRECT_URI`.
- **Paddle**: `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_VENDOR_ID`.
- **Schedulers (code-only flags)**: `BACKUP_ENABLED`, `BACKUP_SCHEDULE`, `BACKUP_RETENTION_DAYS`, `SYNC_SCHEDULER_ENABLED`, `SCHEDULED_DELETION_ENABLED`, `HEALTH_REANALYSIS_ENABLED`, `EMAIL_FUNNEL_ENABLED`, `EMAIL_FUNNEL_DAILY_LIMIT`, `EMAIL_FUNNEL_UNSUBSCRIBE_SECRET`, `PAYMENT_ALERT_EMAIL`.
- **Geo**: `MAXMIND_LICENSE_KEY`.
- **Frontend**: `NUXT_API_URL`, `NUXT_PUBLIC_SITE_URL`, `NUXT_RECAPTCHA_SITE_KEY`, `NUXT_GTM_ID`, `NUXT_PLATFORM_ENABLED/_REGISTRATION_ENABLED/_LOGIN_ENABLED`, `NUXT_PADDLE_ENVIRONMENT/CLIENT_TOKEN`, `NUXT_PADDLE_CHECKOUT_ENABLED`.

## Observability

### Logging (`WinstonLoggerService`)

Winston singleton, JSON format, `error.log` + `combined.log` + colorized console. Currently the structured **SSO audit logger** (`sso_audit` events); most other code logs via `console.*`.

### Backend performance (`utils/PerformanceMetrics.ts`)

- `PerformanceMetrics` (named timers, memory snapshots) + `PerformanceAggregator` (avg/min/max/p50/p95/p99, success/error rates, `getSlowestOperations`, `getBottleneckAnalysis`); singleton `globalPerformanceAggregator`.
- Routes `GET /performance/metrics`, `/metrics/:operationName`, `/slowest`, `/bottlenecks`, `/count`, `DELETE /metrics` (JWT).
- Performance tests (`__tests__/performance/api-response-time.test.ts`): login <500 ms, token validation <50 ms, data-source create <300 ms/read <100 ms/update+delete <200 ms, 10 concurrent GETs <1 s, sustained avg <100 ms/max <300 ms, >5 RPS.

### Frontend performance

- `useSSRPerformance` — Web Vitals (TTFB/FCP/LCP/TBT/hydration) with budgets (600/1800/2500/300/1000 ms), `PerformanceObserver` + `sendMetricsToAnalytics`.
- `usePerformanceMonitor` — singleton client metrics: cache hit rate, API-call counter, navigation timings (FAST <500 ms → VERY SLOW ≥4 s), per-route breakdown.
- `usePerformanceMetrics` — fetches backend `/performance/*`, filters GAM Sync ops, computes a performance grade A–F.
- `navigation-perf.client.ts`, `prefetch-links.client.ts` plugins; `SSRPerformance.ts` budget checks.

### Other infrastructure

- **Redis** (`config/redis.config.ts`): ioredis singleton, `keyPrefix: 'dra:ai:'`, retry strategy `min(times*50, 2000)`, `RedisTTL` all 86400 s. Consumers: AI sessions, SSO SAML + replay + OTC, OAuth sessions, tier counts/overrides, guest-plan tokens.
- **Rate-limit store**: in-memory (no Redis store) — per-process.
- **Sitemap**: `SitemapProcessor.generateXmlSitemap()` merges manual entries + published articles; `GET /sitemap.xml` / `sitemap.txt`; frontend `server/routes/sitemap.*` proxy with 1 h cache.
- **Product analytics**: `ProductEventProcessor` (batch ≤100, properties ≤32 KB) → `DRAProductEvent` with PII stripping; gated by `PLAN_ANALYTICS_ENABLED` (note: `PLAN_ANALYTICS_ENABLED=false` means ingest disabled).

## Testing strategy

- **Backend** (Jest 30, ts-jest): unit tests per processor/service, integration tests per route group, e2e (dashboard/data-model/data-source/registration), security tests (SQLi, cross-org access, auth), performance tests, migrations tests. Scripts: `test`, `test:unit`, `test:integration`, `test:ratelimit`, `test:coverage`.
- **Frontend** (Vitest + @nuxt/test-utils): component tests, SSR-compatibility suite (31+ checks), store tests. `npm run validate:ssr` (8 checks).
- **Migrations**: `migration:run/generate/create/revert` against `PostgresDSMigrations.ts`; seeders via `@jorgebodega/typeorm-seeding`.
