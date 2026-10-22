# Google Ads API Integration Guide

> **Last reviewed:** 2026-10-22 against `backend/src/routes/google_ads.ts`, `backend/src/services/GoogleAdsService.ts`, and `backend/src/drivers/GoogleAdsDriver.ts`.

## Overview

This guide documents the DRA REST surface for Google Ads. The backend calls the Google Ads REST API **v25**; the frontend never talks to Google Ads directly except during the OAuth consent popup.

- **Backend base URL (local):** `http://backend.dataresearchanalysis.test:3002` (mounted at `/google-ads`)
- **OAuth routes:** `/oauth/google/*`
- **Auth:** JWT in the `dra_auth_token` cookie (or `Authorization: Bearer` where supported)
- **Schema:** `dra_google_ads`
- **Default sync types:** 11 (see [GA_REPORT_TYPES_REFERENCE.md](GA_REPORT_TYPES_REFERENCE.md))

## Authentication

### OAuth flow

1. `GET /oauth/google/auth-url?service=google_ads&project_id=<id>` (JWT) → Google consent URL with `access_type=offline` and `prompt=consent`.
2. Google redirects to `GET /oauth/google/callback` (no JWT) → backend redirects the browser to the frontend callback with `code` + `state`.
3. Frontend calls `POST /oauth/google/callback` (JWT) with `{ code, state }`; the backend verifies the state user, exchanges the code, and stores tokens in an encrypted Redis session (15-minute TTL).
4. The frontend receives only a `session_id`; it calls `POST /google-ads/accounts` with an access token obtained from the backend session.

Required Google scope: `https://www.googleapis.com/auth/adwords`.

### Developer token

`GOOGLE_ADS_DEVELOPER_TOKEN` is **optional**. The `developer-token` header is added only when the variable is non-empty. Access levels are managed in Google Cloud projects since September 2026.

## Endpoints

### List accessible accounts

`POST /google-ads/accounts`

```json
{ "accessToken": "<google access token>" }
```

Response:

```json
{
  "success": true,
  "accounts": [
    { "customerId": "123-456-7890", "descriptiveName": "Acme Ads", "currencyCode": "USD", "timeZone": "America/New_York", "isManager": false }
  ]
}
```

Manager accounts are expanded into their client accounts (up to 10); client entries include the manager customer id used for the `login-customer-id` header.

### Get sync types

`GET /google-ads/report-types`

Returns the 11 descriptors (`id`, `name`, `description`, `dimensions`, `metrics`). This endpoint does not require a JWT in the current implementation.

### Create a data source

`POST /google-ads/add`

```json
{
  "name": "Google Ads - Acme",
  "customerId": "123-456-7890",
  "accessToken": "<access token>",
  "refreshToken": "<refresh token>",
  "managerCustomerId": "111-222-3333",
  "reportTypes": ["campaigns", "ad_groups", "ads", "insights", "keyword_insights"],
  "startDate": "2026-09-01",
  "endDate": "2026-10-22"
}
```

Required: `name`, `customerId`, `accessToken`, `refreshToken`. `managerCustomerId`, `reportTypes`, and `project_id` are optional. `startDate`/`endDate` default to the last 30 days when omitted. The endpoint creates the `DRADataSource`, returns `dataSourceId`, and starts the initial sync in the background.

### Trigger a sync

`POST /google-ads/sync/:id`

Runs synchronously for the request and returns `{ success: true }` when all selected types complete. Partial type failures are recorded in `sync_history`; check `GET /google-ads/status/:id`.

### Get sync status

`GET /google-ads/status/:id`

```json
{
  "success": true,
  "lastSyncTime": "2026-10-22T10:00:00.000Z",
  "syncHistory": [
    { "syncType": "SCHEDULED", "status": "COMPLETED", "startedAt": "...", "completedAt": "...", "rowsSynced": 1234 }
  ]
}
```

## Sync type ids

`campaigns`, `ad_groups`, `ads`, `insights`, `ad_group_insights`, `demographic_insights`, `device_insights`, `geographic_insights`, `placement_insights`, `keyword_insights`, `conversion_actions`.

Legacy ids (`campaign`, `keyword`, `geographic`, `device`, `ad_group`) are normalized automatically.

## Error handling

Standard shape:

```json
{ "success": false, "error": "Human-readable message" }
```

| HTTP | Meaning |
|---|---|
| 400 | Missing/invalid fields, invalid data source id |
| 401 | Missing/invalid JWT or no `user_id` in token details |
| 403 | Caller lacks access to the data source/project |
| 429 | Rate limit (DRA limiter or Google quota) |
| 500 | Google API or persistence failure |

Common Google Ads errors:

| Error | Fix |
|---|---|
| `REQUESTED_METRICS_FOR_MANAGER` | Use a client account, or let the driver expand the MCC. |
| `PERMISSION_DENIED` | Check Cloud project access / developer token. |
| `RESOURCE_EXHAUSTED` | Quota exceeded; retry after backoff or reduce the request. |
| `AUTHENTICATION_ERROR` | Refresh token invalid/revoked; re-authorize. |

## Rate limits and retries

- Inbound: DRA `generalApiLimiter` / `expensiveOperationsLimiter` apply at the app level.
- Outbound: `RetryHandler` uses the `rate_limit` profile — 5 retries, 5 s → 60 s exponential backoff, ±20 % jitter.
- Each sync type is isolated; a failed type does not abort the rest.

## JavaScript example

```javascript
const base = 'http://backend.dataresearchanalysis.test:3002';

async function createGoogleAdsSource({ accessToken, refreshToken, customerId }) {
  const res = await fetch(`${base}/google-ads/add`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Google Ads - Acme',
      customerId,
      accessToken,
      refreshToken,
      reportTypes: ['campaigns', 'ad_groups', 'ads', 'insights', 'keyword_insights']
    })
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}
```

## Related documents

- [GOOGLE_ADS_DOCUMENTATION.md](GOOGLE_ADS_DOCUMENTATION.md) — architecture and sync behaviour
- [GA_REPORT_TYPES_REFERENCE.md](GA_REPORT_TYPES_REFERENCE.md) — tables and fields
- [GA_USER_GUIDE.md](GA_USER_GUIDE.md) — end-user guide
- [architecture/07-integrations.md](../architecture/07-integrations.md) — cross-connector architecture
