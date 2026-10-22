# 07 — Integrations

## Connector inventory

`EDataSourceType` (14 values): `EXCEL, CSV, PDF, POSTGRESQL, MYSQL, MARIADB, MONGODB, GOOGLE_ANALYTICS, GOOGLE_AD_MANAGER, GOOGLE_ADS, META_ADS, LINKEDIN_ADS, HUBSPOT, KLAVIYO`.

| Connector | Service | Processor | Driver | Route mount | Ingest schema | Scheduler-eligible | Production-gated |
|---|---|---|---|---|---|---|---|
| GA4 | GoogleAnalyticsService | GoogleAnalyticsProcessor | GoogleAnalyticsDriver | `/google-analytics` | `dra_google_analytics` | Yes | No |
| Google Ads | GoogleAdsService | GoogleAdsProcessor | GoogleAdsDriver | `/google-ads` | `dra_google_ads` | Yes | No |
| Google Ad Manager | GoogleAdManagerService | GoogleAdManagerProcessor | GoogleAdManagerDriver | `/google-ad-manager` | `dra_google_ad_manager` | Yes | No |
| Meta Ads | MetaAdsService + MetaOAuthService | MetaAdsProcessor | MetaAdsDriver | `/meta-ads` | `dra_meta_ads` | Yes | No |
| LinkedIn Ads | LinkedInAdsService + LinkedInOAuthService | LinkedInAdsProcessor | LinkedInAdsDriver | `/linkedin-ads` | `dra_linkedin_ads` | No | **Yes** (add/sync) |
| HubSpot | HubSpotService + HubSpotOAuthService | HubSpotProcessor | HubSpotDriver | `/hubspot` | `dra_hubspot` | No | **Yes** (add/sync) |
| Klaviyo | KlaviyoService | KlaviyoProcessor | KlaviyoDriver | `/klaviyo` | `dra_klaviyo` | No | **Yes** (add/sync) |
| PostgreSQL/MySQL/MariaDB | — | DataSourceProcessor | Postgres/MySQL/MariaDBDriver | `/data-source` | live external (no copy) | No | No |
| MongoDB | MongoDBNativeService + MongoDBImportService | DataSourceProcessor | MongoDBDriver | `/data-source` | `dra_mongodb` (imported) | No | No |
| Excel/CSV | ExcelFileService + file parsers | ExcelDataSourceProcessor | — | `/data-source` | `dra_excel` | No | No |
| PDF+OCR | PDFService + AWSService + TextExtractDriver | PDFDataSourceProcessor | — | `/data-source` | `dra_pdf` | No | No |

`requiresProductionAccess` (403 for non-admins; "integration under review") applies only to LinkedIn/HubSpot/Klaviyo `POST /add` + `POST /sync/:id`. Read-only/auxiliary routes (`/connect`, `/callback`, `/accounts`, `/sync-status`) are open. **Meta is NOT gated** despite the middleware's doc comment naming it.

## Google OAuth flow (shared by GA4/GAM/Google Ads)

1. `GET /oauth/google/auth-url?service=...&project_id=...` (JWT) → Google URL with `access_type=offline`, `prompt=consent`, and a `state` = base64 `{user_id, service, project_id, timestamp}`.
2. Browser redirects to Google → Google calls back `GET /oauth/google/callback` (no JWT) → **redirect to frontend** `/oauth/google/callback?code=...&state=...`.
3. Frontend `POST /oauth/google/callback` (JWT) with `{code, state}` → verifies `state.user_id === tokenDetails.user_id` → `exchangeCodeForTokens` → `OAuthSessionService.storeTokens(userId, projectId, tokens)` → returns `{session_id, ...}` (tokens never leave the backend).
4. Frontend stores only `session_id` in `sessionStorage`; tokens encrypted at rest in Redis (15-min TTL, 30-min cleanup).

**Documented gaps**: no PKCE; state unsigned (user_id check only); no rate limiter on the Google OAuth callback routes (the SAML SSO callback does use `oauthCallbackLimiter`); session GET/DELETE don't verify ownership. Refresh: each driver refreshes on demand inside `authenticate()` (5-min expiry buffer) and persists refreshed tokens back to `DRADataSource.api_connection_details`.

## GA4 (`GoogleAnalyticsDriver`, 697 lines)

- Data API v1beta + Admin API (property discovery). 6 report presets: traffic_overview (90d), user_acquisition (90d), page_performance (30d), geographic (30d), device (30d), events (30d). Each writes hash-named tables in `dra_google_analytics` (upsert; user_acquisition recreated each sync). `SyncHistoryService` tracks runs; `sessions-summary/:projectId` aggregates traffic for the hub.

## Google Ads (`GoogleAdsService` + `GoogleAdsDriver`, 1435 lines)

- **API v25**, raw `fetch` to `googleads.googleapis.com`; OAuth scope `adwords`; **developer token optional** (`GOOGLE_ADS_DEVELOPER_TOKEN` only added when non-empty — access moved to Google Cloud projects Sept 2026; the old v22-era developer-token limitation note has been removed as obsolete).
- **MCC support**: manager account expansion to up to 10 client accounts; each client gets its own physical tables (`fileId = customerId`).
- **11 default sync types**: campaigns, ad_groups, ads, insights (campaign daily performance), ad_group_insights, demographic_insights (age+gender), device_insights, geographic_insights, placement_insights, keyword_insights, conversion_actions. Legacy configs normalized; `insights` auto-adds 6 breakdown types.
- Rate limiting: `RetryHandler` with `rate_limit` profile (5 retries, 5 s→60 s, ×2, ±20% jitter) around every report call; partial-type failure isolation.

## Google Ad Manager (`GoogleAdManagerService`, 565 lines)

- `@google-ads/admanager` Network/Report clients (scope `dfp`). **6 report types** in code (`revenue, geography, device, ad_unit, advertiser, time_series`) — but the route/UI advertises 5 (`revenue, inventory, orders, geography, device`); `inventory`/`orders` silently run the revenue query, `ad_unit`/`advertiser`/`time_series` are unreachable from the advertised list (documented mismatch).
- Rate limits: token-bucket `RateLimiterRegistry` `createForGAM()` (10 req/min, burst 20, ≥100 ms spacing) + RetryHandler.

## Meta Ads (`MetaAdsDriver`, 1815 lines)

- **API v25.0**; scopes exactly `ads_read` + `business_management`. Long-lived tokens (~60 days) via `fb_exchange_token`, `/debug_token` validated; tokens returned in JSON (no server-side session); expired → re-auth.
- **10 default sync types**: campaigns, adsets, ads, insights (level=campaign, time_increment=1), adset_insights, demographic_insights, device_insights, placement_insights, creatives, custom_conversions. Breakdown fallbacks (`device_platform` if `impression_device` unsupported). Ad-set settings captured (bidding, budgets, targeting JSONB).
- Retries: 3 attempts, 1 s→×2; explicit error-code handling (190 auth no-retry, 17/32 rate, 4 app limit).

## LinkedIn Ads (`LinkedInAdsDriver`, 907 lines)

- **API version `202601`**, `X-Restli-Protocol-Version: 2.0.0`; scopes `r_ads` + `r_ads_reporting`; access 60 days, refresh 1 year (refresh <5 days remaining); base64url tokens to frontend redirect.
- **6 tables**: ad_accounts, campaign_groups, campaigns, creatives, campaign_analytics (DAILY), account_analytics (MONTHLY). 20 performance fields (API max), 9 demographic fields (min 3 events), 15,000-element analytics cap, 45M metric-value 5-min throttle.
- Development-tier analytics 404s are skipped with a warning.

## HubSpot (OAuth v3)

- 5 scopes (`crm.objects.contacts/deals/companies/line_items.read` + `sales-email-read`); access tokens 30 min (refresh <5 min remaining); `hub_id` from OAuth v3. Sync: contacts, deals, daily pipeline snapshot (3 tables). Paged `limit=100` + cursor.

## Klaviyo (API key, no OAuth)

- `Authorization: Klaviyo-API-Key <key>`, revision header `2024-02-15`. Key stored in encrypted `connection_details`. Sync: campaigns (+ campaign-values report, last 365 days), flows (+ flow-values report) → 3 tables.

## Engineering connectors

- **PostgreSQL/MySQL/MariaDB**: live external connections via TypeORM datasources (individual fields, no connection-string support); schema introspection via `information_schema`; queried live through `QueryEngineProcessor` (`POST /data-source/execute-query-on-external-data-source`); no import/sync.
- **MongoDB**: connection-string only (`mongodb://`/`mongodb+srv://`), native driver (Atlas/self-hosted/DocumentDB/Cosmos/replica sets). Import into `dra_mongodb` (per-collection tables `{collection}_data_source_{id}`, flattened top-level columns + `_source_document JSONB`, `_id VARCHAR(24) PRIMARY KEY`); full/incremental sync; adaptive batch sizing (default 1000); progress via Socket.IO `mongodb-sync-progress` (throttled 5 batches/5000 records). `MongoDBQueryTranslator` supports `$match/$project/$sort/$limit/$skip`; **`$group`/`$lookup` are TODO** (falls back to direct aggregation on Mongo).
- **Excel/CSV**: multer upload (500 MB route limit; 50 MB validateExcelUpload default), `ExcelFileService` + parser factory (xlsx/xls/xlsm/csv), type inference, multi-sheet, insert batches of 1000 into `dra_excel`. CSV uploads are stored as `data_type = EXCEL` (the `CSV` enum exists but no processor assigns it).
- **PDF + OCR**: Ghostscript worker (`gs -dNOSAFER ... -r600 pnggray`) converts pages, AWS Textract extracts text (`AmazonTextExtractDriver`), browser drives conversion via Socket.IO events, result posted to `/add-pdf-data-source` → `dra_pdf`. 20 MB max PDF; not synchronous in the API.

## Sync architecture

- **`SyncHistoryService`** (table `sync_history`): statuses PENDING/RUNNING/COMPLETED/FAILED/PARTIAL; types FULL/INCREMENTAL/MANUAL/SCHEDULED; 90-day cleanup. Used by all API connectors.
- **MongoDB**: its own `dra_mongodb_sync_history` per-collection ledger.
- **`SchedulerService`** (every minute UTC): only GA4, GAM, Google Ads, Meta are scheduler-eligible (`sync_enabled AND sync_schedule != 'manual' AND next_scheduled_sync <= now`); overlap guard; recomputes next run (hourly/daily/weekly/monthly at `sync_schedule_time`). LinkedIn/HubSpot/Klaviyo/MongoDB can store schedules but never fire automatically.
- **Manual sync** entry points per connector (`POST /{connector}/sync/:id`; `/add` fire-and-forget initial sync for Google Ads/Meta/LinkedIn/HubSpot/Klaviyo; MongoDB queues `mongodb-sync`, 409 if already in progress; Excel queues `excel-upload` with 3 retries).
- **Real-time**: Socket.IO `excel-upload-progress`, `mongodb-sync-progress`, `pdf-conversion-complete`/`extract-text-from-image-complete`, `dataSource:created`, plus plan/notification/backup events.
- **Dormant**: `events/SyncEventEmitter.ts` has no production emitters; `websockets/WebSocketManager.ts` (ws `/ws/sync-status`) is never initialized — superseded by Socket.IO; the cascade-refresh listener on SYNC_COMPLETED is currently unfed.
- Notifications on sync complete/failed (`NotificationHelperService`, types `data_source_sync_complete/failed`, `_scheduled_sync_*`).

## Onboarding automation

`MarketingOnboardingService.onboard()` fires when a `google_ads`/`meta_ads`/`linkedin_ads`/`google_analytics` data source is created: auto-creates data models + a paid-media dashboard. Auto-classification: ad platforms → `marketing_campaign_data`.
