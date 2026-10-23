# Google Ads Integration — Technical Documentation

> **Last reviewed:** 2026-10-22 against `backend/src/services/GoogleAdsService.ts`, `backend/src/drivers/GoogleAdsDriver.ts`, and `backend/src/routes/google_ads.ts`.

## Overview

The Google Ads connector syncs campaign settings and daily performance into the `dra_google_ads` PostgreSQL schema. It uses the Google Ads REST API **v25**, OAuth 2.0 with offline refresh tokens, and supports manager (MCC) accounts.

| Item | Current behaviour |
|---|---|
| API | Google Ads REST `v25` (`https://googleads.googleapis.com/v25`) |
| Auth | Google OAuth 2.0, scope `https://www.googleapis.com/auth/adwords`, refresh tokens stored encrypted in `DRADataSource.api_connection_details` |
| Developer token | **Optional.** `GOOGLE_ADS_DEVELOPER_TOKEN` is sent only when configured; access levels moved to Google Cloud projects in Sept 2026 |
| Manager accounts | Detected automatically; client accounts expanded (up to **10**) and each client gets its own physical tables (`fileId = customerId`, `login-customer-id` header) |
| Default sync types | **11** (see below) |
| Storage | Schema `dra_google_ads`; physical tables `ds{dataSourceId}_{md5(...)[:8]}` with logical names from `TableMetadataService` |
| Sync ledger | `sync_history` (`SyncHistoryService`) with 90-day cleanup |
| Scheduler | Eligible for automatic sync (`SchedulerService`, every minute) |

### Default sync types

`GOOGLE_DEFAULT_SYNC_TYPES` in `backend/src/types/IGoogleAds.ts`:

1. `campaigns` — campaign settings (budget, bidding, status, channel type)
2. `ad_groups` — ad group settings and CPC bid
3. `ads` — ad configuration, headlines, descriptions, final URLs
4. `insights` — campaign daily performance
5. `ad_group_insights` — ad-group daily performance
6. `demographic_insights` — age range + gender
7. `device_insights` — device performance
8. `geographic_insights` — country/region/city
9. `placement_insights` — ad network/placement/slot
10. `keyword_insights` — keyword performance and Quality Score
11. `conversion_actions` — conversion action configuration/attribution

Legacy pre-v25 names (`campaign`, `keyword`, `geographic`, `device`, `ad_group`) are normalized on sync so existing sources keep working. The legacy `campaigns` performance table is detected by its `date` + `campaign_id` columns and dropped after the schema upgrade; the new `campaigns` table holds settings.

## Architecture

```
Nuxt connect wizard
  └─ useGoogleAds → Google OAuth popup → backend OAuth callback (session_id)
       └─ POST /google-ads/add { name, customerId, accessToken, refreshToken, report_types }
            └─ GoogleAdsProcessor.addGoogleAdsDataSource()
                 ├─ DRADataSource row (encrypted credentials)
                 └─ fire-and-forget initial sync
                      └─ GoogleAdsDriver.syncGoogleAdsDataSource()
                           ├─ ensure schema dra_google_ads
                           ├─ resolve manager/client accounts
                           ├─ create/alter physical tables
                           ├─ GoogleAdsService.searchStream() per sync type
                           └─ batch upsert + SyncHistoryService rows
```

### Key files

| Layer | File |
|---|---|
| Route | `backend/src/routes/google_ads.ts` (`/google-ads`) |
| Processor | `backend/src/processors/GoogleAdsProcessor.ts` |
| Driver | `backend/src/drivers/GoogleAdsDriver.ts` |
| API service | `backend/src/services/GoogleAdsService.ts` |
| Types/constants | `backend/src/types/IGoogleAds.ts` |
| Frontend | `frontend/pages/projects/[projectid]/data-sources/connect/google-ads.vue`, `frontend/composables/useGoogleAds.ts` |

## API endpoints

All endpoints require `validateJWT` except `/report-types`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/google-ads/accounts` | List accessible accounts for an access token (`{ accessToken }`). Expands manager accounts into clients. |
| `GET` | `/google-ads/report-types` | Return the 11 sync-type descriptors (id, name, description, dimensions, metrics). |
| `POST` | `/google-ads/add` | Create a data source and start the initial sync. Requires `name`, `customerId`, `accessToken`, `refreshToken`; optional `report_types`, `manager_customer_id`, date range. |
| `POST` | `/google-ads/sync/:id` | Run a manual sync; returns when the sync completes. |
| `GET` | `/google-ads/status/:id` | Last sync time + sync history. |

## Sync behaviour

- **Date range:** default is the last 30 days; the driver accepts explicit start/end dates and splits long ranges where required.
- **Batching:** rows are upserted in batches with `ON CONFLICT` keys per table.
- **Partial failures:** each sync type is isolated; a failing type is recorded and the remaining types continue.
- **Retries:** `RetryHandler` with the `rate_limit` profile (5 retries, 5 s → 60 s, ×2 backoff, ±20 % jitter) wraps report calls.
- **Rate limits:** Google Ads API quota errors are surfaced as `RESOURCE_EXHAUSTED`; partial-type failure is preferred over failing the whole source.
- **MCC:** a manager account cannot return metrics directly (`REQUESTED_METRICS_FOR_MANAGER`); the driver expands to client accounts and requests metrics per client.

## Database shape

Every sync type has a stable logical name and a hash-based physical table. Common columns include `customer_id`, `synced_at`, and type-specific dimensions/metrics (settings tables use `id` as the platform key; insight tables use date ranges). See [GA_REPORT_TYPES_REFERENCE.md](GA_REPORT_TYPES_REFERENCE.md) for per-type fields.

```sql
-- Example: campaign performance for one source (physical table is per source)
SELECT date_start,
       campaign_name,
       spend,
       conversions,
       ROUND(conversion_value / NULLIF(spend, 0), 2) AS roas
FROM dra_google_ads."ds42_ab12cd34"
ORDER BY date_start DESC
LIMIT 100;
```

## Security and known gaps

- OAuth tokens are stored encrypted (AES-256-GCM) and never returned to the browser; the frontend holds only a Redis `session_id`.
- The Google OAuth callback routes do not have a dedicated rate limiter (the SAML SSO callback does); state is unsigned and PKCE is not used. See [architecture/07-integrations.md](../architecture/07-integrations.md).
- The connector is not production-gated.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `REQUESTED_METRICS_FOR_MANAGER` | Customer ID is an MCC. Select a client account or let the driver expand it. |
| `PERMISSION_DENIED` / developer token error | Verify Cloud project access and `GOOGLE_ADS_DEVELOPER_TOKEN` (if set). |
| `RESOURCE_EXHAUSTED` | API quota; wait for the retry/backoff window or reduce date range/sync types. |
| No data in a table | The sync type is not selected in `report_types`, the date range has no activity, or the type failed (check `sync_history` and logs). |
| Legacy table names | Existing sources are normalized; legacy tables are dropped after upgrade. |
