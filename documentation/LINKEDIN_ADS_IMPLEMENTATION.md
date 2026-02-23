# LinkedIn Ads Integration — Complete Implementation Summary

## Overview

Full LinkedIn Marketing API integration for the Data Research Analysis platform. Users connect a LinkedIn Ads account via OAuth 2.0, and the system syncs campaign groups, campaigns, creatives, and daily/monthly analytics into a dedicated PostgreSQL schema (`dra_linkedin_ads`).

---

## Architecture Overview

```
LinkedIn OAuth 2.0
      │
      ▼
LinkedInOAuthService          — token exchange, refresh, revocation
      │
      ▼
LinkedInAdsService            — Marketing API v202601 HTTP client
      │
      ▼
LinkedInAdsDriver             — syncs API data → PostgreSQL tables
      │
      ▼
dra_linkedin_ads schema       — ad_accounts, campaigns, creatives, analytics
```

---

## Environment Variables

These must be set in your `.env` (or Docker environment) before using this integration:

| Variable | Description | Example |
|---|---|---|
| `LINKEDIN_CLIENT_ID` | LinkedIn Developer App Client ID | `86abc123def456` |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn Developer App Client Secret | `secret_value` |
| `LINKEDIN_REDIRECT_URI` | OAuth redirect URI (must match app settings) | `https://yourdomain.com/oauth/linkedin/callback` |

### LinkedIn Developer App Setup

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Create a new app (or use existing)
3. Under **Auth**, add the redirect URI
4. Under **Products**, request access to **Marketing Developer Platform**
5. Copy the **Client ID** and **Client Secret**

> **Note**: The `r_ads` and `r_ads_reporting` scopes require the Marketing Developer Platform product to be approved.

---

## Database Schema

Migration file: `backend/src/migrations/1771800000000-AddLinkedInAdsDataSource.ts`

### Schema: `dra_linkedin_ads`

The driver creates one schema and up to 6 tables per data source (physical names are prefixed with the data source ID):

| Logical Table | Physical Table Pattern | Description |
|---|---|---|
| `ad_accounts` | `ds_{id}_ad_accounts` | Ad account metadata |
| `campaign_groups` | `ds_{id}_campaign_groups` | Campaign group metadata |
| `campaigns` | `ds_{id}_campaigns` | Campaign metadata |
| `creatives` | `ds_{id}_creatives` | Creative/ad metadata |
| `campaign_analytics` | `ds_{id}_campaign_analytics` | Daily campaign-level KPIs |
| `account_analytics` | `ds_{id}_account_analytics` | Monthly account KPIs |

---

## Backend Components

### 1. Types — `backend/src/types/ILinkedInAds.ts`

Key interfaces:
- `ILinkedInAdAccount` — ad account fields
- `ILinkedInCampaign` — campaign fields  
- `ILinkedInCampaignGroup` — campaign group fields
- `ILinkedInCreative` — creative fields
- `ILinkedInAnalyticsRecord` — analytics record from `adAnalytics`
- `ILinkedInDate` / `ILinkedInDateRange` — structured date objects (year/month/day, NOT ISO strings)
- `ILinkedInTokens` — access/refresh token envelope
- `ILinkedInSyncConfig` — stored in `connection_details.api_config`
- `LINKEDIN_PERFORMANCE_FIELDS` — comma-separated fields for performance analytics
- `LINKEDIN_DEMOGRAPHIC_FIELDS` — comma-separated fields for demographic analytics

### 2. Connection Details Schema — `IAPIConnectionDetails`

LinkedIn-specific fields added to `api_config`:

```typescript
api_config?: {
    linkedin_ads_access_token?: string;
    linkedin_ads_refresh_token?: string;
    linkedin_ads_token_expires_at?: number;  // Unix ms timestamp
    linkedin_ads_account_id?: number;        // Long integer (NOT a URN)
    linkedin_ads_account_name?: string;
    start_date?: string;                     // ISO "YYYY-MM-DD"
    end_date?: string;                       // ISO "YYYY-MM-DD"
}
```

### 3. LinkedInOAuthService — `backend/src/services/LinkedInOAuthService.ts`

Singleton service handling the OAuth 2.0 PKCE-compatible flow.

**Key methods**:
```typescript
LinkedInOAuthService.getLinkedInAdsScopes(): string[]       // ['r_ads', 'r_ads_reporting']
oauthService.generateAuthorizationUrl(state): string         // OAuth redirect URL
oauthService.exchangeCode(code): Promise<ILinkedInTokens>   // Code → tokens
oauthService.refreshAccessToken(refreshToken): Promise<ILinkedInTokens>
oauthService.ensureValidToken(connectionDetails): Promise<IAPIConnectionDetails>  // Auto-refresh if < 5 days remain
oauthService.revokeToken(token): Promise<void>
```

**Token lifecycle**: Access tokens are valid for 60 days; refresh tokens for 1 year. The service auto-refreshes when `< 5 days` remain before expiry.

### 4. LinkedInAdsService — `backend/src/services/LinkedInAdsService.ts`

Singleton service wrapping all Marketing API v202601 calls with exponential-backoff retry.

**Important API notes**:
- `LinkedIn-Version: 202601` header is required on every request (v202501 is sunset)
- Analytics `dateRange` uses structured `{year, month, day}` objects, NOT ISO strings
- `fields` parameter is **required** for `/rest/adAnalytics` calls
- No pagination on analytics — max 15,000 elements per call; split by date chunks
- List/search APIs use cursor-based pagination (`pageToken` / `metadata.nextPageToken`)

**Key methods**:
```typescript
service.listAdAccounts(accessToken)
service.getCampaigns(accessToken, adAccountId)
service.getCampaignGroups(accessToken, adAccountId)
service.getCreatives(accessToken, adAccountId)
service.getPerformanceAnalytics(accessToken, adAccountId, dateRange, pivot, granularity)
service.getAccountAnalytics(accessToken, adAccountId, dateRange)
service.getDemographicAnalytics(accessToken, adAccountId, dateRange, demographicPivot)
service.validateAccessToken(accessToken): Promise<boolean>
```

### 5. LinkedInAdsDriver — `backend/src/drivers/LinkedInAdsDriver.ts`

Implements `IAPIDriver`. Orchestrates the full sync pipeline.

**Sync sequence**:
1. Validate/refresh OAuth token
2. Create `dra_linkedin_ads` schema if missing
3. Sync `ad_accounts`
4. Sync `campaign_groups`
5. Sync `campaigns`
6. Sync `creatives`
7. Sync `campaign_analytics` (DAILY granularity)
8. Sync `account_analytics` (MONTHLY granularity)
9. Update sync history record (success/failure)

**Date range**: Uses `api_config.start_date` and `api_config.end_date` if set; defaults to last 30 days → today.

### 6. Backend Routes — `backend/src/routes/linkedin_ads.ts`

All routes require Bearer token authentication via `authenticate` middleware.

| Method | Path | Description |
|---|---|---|
| `GET` | `/linkedin-ads/auth-url` | Generate OAuth authorization URL |
| `POST` | `/linkedin-ads/exchange-token` | Exchange auth code for tokens |
| `GET` | `/linkedin-ads/accounts` | List ad accounts for a token |
| `POST` | `/linkedin-ads/data-source` | Create a new LinkedIn Ads data source |
| `POST` | `/linkedin-ads/sync/:dataSourceId` | Trigger manual sync |
| `GET` | `/linkedin-ads/sync-status/:dataSourceId` | Get sync history |

---

## Frontend Components

### Pinia Store — `frontend/stores/data_sources.ts`

Added functions:
```typescript
initiateLinkedInOAuth(projectId)             // Redirect to LinkedIn auth
listLinkedInAdAccounts(accessToken)          // List available ad accounts
addLinkedInAdsDataSource(config, projectId)  // Create data source record
syncLinkedInAds(dataSourceId)               // Trigger sync
getLinkedInAdsSyncStatus(dataSourceId)      // Fetch sync history
```

### Composable — `frontend/composables/useLinkedInAds.ts`

Thin wrapper over the store with formatting utilities:
```typescript
const linkedInAds = useLinkedInAds();

await linkedInAds.addDataSource(config, projectId)
await linkedInAds.syncNow(dataSourceId)
await linkedInAds.getSyncStatus(dataSourceId)

linkedInAds.formatSyncTime(isoString)        // Human-readable date
linkedInAds.getDateRangePresets()            // { last30Days, last90Days, ... }
linkedInAds.formatSpend(amount, currency)    // "$1,234.56 USD"
linkedInAds.formatCTR(ctr)                  // "2.45%"
linkedInAds.formatCPC(cpc, currency)        // "$0.85"
```

### OAuth Connect Flow — `frontend/pages/projects/[projectid]/data-sources/connect/linkedin-ads.vue`

3-step wizard:
1. **Authenticate** — calls `initiateLinkedInOAuth(projectId)` → redirects to LinkedIn
2. **Select Account** — displays available ad accounts after redirect back
3. **Configure** — set data source name and optional date range, then saves

OAuth callback route: `frontend/pages/connect/linkedin-ads.vue`
- Reads `?tokens=<base64url>` from redirect
- Stores token in `localStorage('linkedin_ads_oauth_token')`
- Redirects to the 3-step wizard page (using `linkedin_ads_pending_oauth` localStorage key)

### Sync Panel Component — `frontend/components/LinkedInAdsSyncPanel.vue`

```vue
<LinkedInAdsSyncPanel 
    :data-source-id="dataSource.id" 
    :can-sync="permissions.canUpdate.value" 
    @synced="onSynced" />
```

Shows sync status badge, last sync time, Sync Now button, and sync history table.

### Updated UI Files

| File | Change |
|---|---|
| `components/SourceBadge.vue` | LinkedIn sky-blue badge + `mdi-linkedin` icon |
| `components/CrossSourceJoinDialog.vue` | LinkedIn `'cyan'` color in join dialog |
| `components/add-external-data-source.vue` | LinkedIn logo in mobile + desktop layouts |
| `pages/projects/[projectid]/index.vue` | LinkedIn in sync controls, history, image map |
| `pages/projects/[projectid]/data-sources/[datasourceid]/index.vue` | LinkedIn in triggerSync, loadSyncHistory, template v-if arrays |

---

## Data Flow

```
User clicks "Add LinkedIn Ads"
    → initiateLinkedInOAuth(projectId)
    → Backend generates auth URL with r_ads + r_ads_reporting scopes
    → User authorizes on LinkedIn
    → LinkedIn redirects to /oauth/linkedin/callback?code=...
    → Backend exchanges code for tokens → returns base64url encoded tokens
    → /connect/linkedin-ads page decodes tokens, stores in localStorage
    → Wizard displays ad accounts
    → User selects account, sets name + date range
    → addLinkedInAdsDataSource() creates DRADataSource record with encrypted connection_details
    → User triggers sync from dashboard
    → POST /linkedin-ads/sync/:id → LinkedInAdsDriver.syncToDatabase()
    → Writes rows into dra_linkedin_ads schema tables
    → SyncHistory record updated with completion status
```

---

## Testing

Three unit test suites added in Phase 12:

| Test File | Coverage |
|---|---|
| `__tests__/services/LinkedInOAuthService.unit.test.ts` | Singleton, scopes, URL generation, env validation, expiry logic |
| `__tests__/services/LinkedInAdsService.unit.test.ts` | Singleton, API version, date helpers, accountUrn, validateAccessToken branches |
| `__tests__/drivers/LinkedInAdsDriver.unit.test.ts` | Singleton, schema constants, isoToLinkedInDate/back, default dates, getLogicalTableColumns |

All 3 files pass TypeScript compilation (`npx tsc --noEmit` → 0 errors). Integration/network tests require a valid LinkedIn access token and are excluded from the CI fast-test path.

---

## Limitations / Notes

1. **Analytics pagination**: The LinkedIn `/rest/adAnalytics` endpoint has no cursor pagination — results are capped at 15,000 elements. For high-volume accounts, split by narrower date windows.
2. **Demographic data delay**: Demographic analytics have a 12–24h reporting delay and a 2-year retention window.
3. **Privacy thresholds**: LinkedIn suppresses values with fewer than 3 events. Expect `null`/omitted fields for low-traffic creatives.
4. **Token expiry**: Access tokens last 60 days; refresh tokens 1 year. The service auto-refreshes within 5 days of expiry.
5. **Manager accounts**: The current implementation syncs a single ad account. Multi-account manager patterns (like the Google Ads manager feature) are not yet implemented for LinkedIn.
6. **API version**: LinkedIn requires `LinkedIn-Version: 202601`. The version `202501` is sunset and will return 400 errors.
