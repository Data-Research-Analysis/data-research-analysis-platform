# Google Ads TypeScript Types Reference

## Overview

This document provides a comprehensive reference for all TypeScript interfaces and types used in the Google Ads integration. These types ensure type safety across the frontend and backend components and serve as the contract between different layers of the application.

**Location**: `/home/dataresearchanalysis/backend/src/types/IGoogleAds.ts`

---

## Table of Contents

1. [Enums](#enums)
2. [Core Interfaces](#core-interfaces)
3. [API Request/Response Types](#api-requestresponse-types)
4. [Account Types](#account-types)
5. [Sync Configuration Types](#sync-configuration-types)
6. [Status Types](#status-types)
7. [Usage Examples](#usage-examples)

---

## Enums

### GoogleAdsReportType

Enum defining supported Google Ads report types.

```typescript
enum GoogleAdsReportType {
    CAMPAIGN = 'CAMPAIGN',
    KEYWORD = 'KEYWORD',
    GEOGRAPHIC = 'GEOGRAPHIC',
    DEVICE = 'DEVICE'
}
```

**Values**:
| Value | Description | Use Case |
|-------|-------------|----------|
| `CAMPAIGN` | Campaign performance report | Track overall campaign metrics (spend, conversions, ROAS) |
| `KEYWORD` | Keyword performance report | Analyze keyword-level data (CPC, quality score, match types) |
| `GEOGRAPHIC` | Geographic performance report | Understand performance by location (country, region, city) |
| `DEVICE` | Device performance report | Compare performance across devices (mobile, desktop, tablet) |

**Usage**:
```typescript
import { GoogleAdsReportType } from '../types/IGoogleAds';

// Type-safe report type usage
const reportType: GoogleAdsReportType = GoogleAdsReportType.CAMPAIGN;

// Convert string to enum
function getReportType(str: string): GoogleAdsReportType {
  const map: Record<string, GoogleAdsReportType> = {
    'campaign': GoogleAdsReportType.CAMPAIGN,
    'keyword': GoogleAdsReportType.KEYWORD,
    'geographic': GoogleAdsReportType.GEOGRAPHIC,
    'device': GoogleAdsReportType.DEVICE
  };
  
  return map[str.toLowerCase()] || GoogleAdsReportType.CAMPAIGN;
}
```

---

## Core Interfaces

### IGoogleAdsReportQuery

Defines the structure for querying Google Ads data.

```typescript
interface IGoogleAdsReportQuery {
    customerId: string;        // Google Ads customer ID (format: 123-456-7890)
    startDate: string;         // YYYY-MM-DD
    endDate: string;           // YYYY-MM-DD
    reportType: GoogleAdsReportType;
    metrics: string[];         // e.g., ['impressions', 'clicks', 'cost']
    dimensions: string[];      // e.g., ['campaign_name', 'date']
}
```

**Properties**:

| Property | Type | Required | Description | Example |
|----------|------|-----------|-------------|---------|
| `customerId` | `string` | Yes | Google Ads customer ID with hyphens | `"123-456-7890"` |
| `startDate` | `string` | Yes | Start date in ISO format | `"2024-01-01"` |
| `endDate` | `string` | Yes | End date in ISO format | `"2024-01-31"` |
| `reportType` | `GoogleAdsReportType` | Yes | Type of report to generate | `GoogleAdsReportType.CAMPAIGN` |
| `metrics` | `string[]` | Yes | Metrics to include in report | `['impressions', 'clicks', 'cost']` |
| `dimensions` | `string[]` | Yes | Dimensions to group by | `['campaign_name', 'date']` |

**Example**:
```typescript
const campaignQuery: IGoogleAdsReportQuery = {
  customerId: '123-456-7890',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  reportType: GoogleAdsReportType.CAMPAIGN,
  metrics: [
    'impressions',
    'clicks',
    'cost',
    'conversions',
    'conversionsValue'
  ],
  dimensions: [
    'campaign.id',
    'campaign.name',
    'segments.date'
  ]
};

// Use in service
const response = await googleAdsService.runReport(accessToken, campaignQuery);
```

### IGoogleAdsReportResponse

Structure of the response from Google Ads API.

```typescript
interface IGoogleAdsReportResponse {
    rows: IGoogleAdsRow[];
    totalRows: number;
    queryResourceConsumption: number;
}
```

**Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `rows` | `IGoogleAdsRow[]` | Array of data rows returned from the query |
| `totalRows` | `number` | Total number of rows in the result set |
| `queryResourceConsumption` | `number` | API quota units consumed by this query |

**Example**:
```typescript
const response: IGoogleAdsReportResponse = {
  rows: [
    {
      campaign: { id: '123', name: 'Summer Sale', status: 'ENABLED' },
      metrics: {
        impressions: 10000,
        clicks: 500,
        costMicros: 25000000,  // $25
        conversions: 50,
        conversionsValue: 5000,
        ctr: 0.05,
        averageCpc: 50000,     // $0.05
        averageCpm: 2500000    // $2.50
      },
      segments: { date: '2024-01-15' }
    }
  ],
  totalRows: 1,
  queryResourceConsumption: 100
};

// Process rows
response.rows.forEach(row => {
  const costInDollars = row.metrics.costMicros / 1000000;
  console.log(`Campaign ${row.campaign?.name}: $${costInDollars}`);
});
```

### IGoogleAdsRow

Represents a single row of Google Ads data.

```typescript
interface IGoogleAdsRow {
    campaign?: {
        id: string;
        name: string;
        status: string;
    };
    adGroup?: {
        name: string;
    };
    adGroupCriterion?: {
        keyword?: {
            text: string;
            matchType: string;
        };
        qualityInfo?: {
            qualityScore: number;
        };
    };
    metrics: {
        impressions: number;
        clicks: number;
        costMicros: number;        // Cost in micros (1,000,000 = $1)
        conversions: number;
        conversionsValue: number;
        ctr: number;
        averageCpc: number;
        averageCpm: number;
    };
    segments?: {
        date: string;
        device: string;
        geoTargetCountry: string;
        geoTargetRegion: string;
        geoTargetCity: string;
    };
}
```

**Properties**:

| Property | Type | Optional | Description |
|----------|------|----------|-------------|
| `campaign` | `object` | Yes | Campaign information (ID, name, status) |
| `adGroup` | `object` | Yes | Ad group information |
| `adGroupCriterion` | `object` | Yes | Keyword and quality score data |
| `metrics` | `object` | No | Performance metrics (required) |
| `segments` | `object` | Yes | Segmentation dimensions (date, device, geo) |

**Metrics Object**:
- `impressions`: Number of times ad was shown
- `clicks`: Number of clicks on ad
- `costMicros`: Cost in micros (divide by 1,000,000 for dollars/euros)
- `conversions`: Number of conversions
- `conversionsValue`: Total conversion value in account currency
- `ctr`: Click-through rate (0-1 decimal)
- `averageCpc`: Average cost-per-click in micros
- `averageCpm`: Average cost-per-thousand-impressions in micros

**Campaign Status Values**:
- `ENABLED`: Campaign is active
- `PAUSED`: Campaign is paused
- `REMOVED`: Campaign is removed/deleted

**Keyword Match Types**:
- `EXACT`: Exact match
- `PHRASE`: Phrase match
- `BROAD`: Broad match

**Device Types**:
- `MOBILE`: Mobile devices
- `DESKTOP`: Desktop computers
- `TABLET`: Tablet devices

**Example Usage**:
```typescript
// Transform campaign row to database format
function transformCampaignRow(row: IGoogleAdsRow) {
  return {
    date: row.segments?.date,
    campaign_id: row.campaign?.id,
    campaign_name: row.campaign?.name,
    campaign_status: row.campaign?.status,
    impressions: row.metrics.impressions,
    clicks: row.metrics.clicks,
    cost: row.metrics.costMicros / 1000000,  // Convert to dollars
    conversions: row.metrics.conversions,
    conversion_value: row.metrics.conversionsValue,
    ctr: row.metrics.ctr,
    average_cpc: row.metrics.averageCpc / 1000000,
    average_cpm: row.metrics.averageCpm / 1000000
  };
}

// Transform keyword row
function transformKeywordRow(row: IGoogleAdsRow) {
  return {
    date: row.segments?.date,
    campaign_id: row.campaign?.id,
    campaign_name: row.campaign?.name,
    ad_group_name: row.adGroup?.name,
    keyword_text: row.adGroupCriterion?.keyword?.text,
    match_type: row.adGroupCriterion?.keyword?.matchType,
    quality_score: row.adGroupCriterion?.qualityInfo?.qualityScore,
    impressions: row.metrics.impressions,
    clicks: row.metrics.clicks,
    cost: row.metrics.costMicros / 1000000,
    conversions: row.metrics.conversions,
    ctr: row.metrics.ctr,
    average_cpc: row.metrics.averageCpc / 1000000
  };
}
```

---

## API Request/Response Types

### IGoogleAdsSyncConfig

Configuration for creating a new Google Ads data source.

```typescript
interface IGoogleAdsSyncConfig {
    name: string;
    customerId: string;
    accessToken: string;
    refreshToken: string;
    reportTypes: string[];      // ['campaign', 'keyword', 'geographic', 'device']
    startDate: string;
    endDate: string;
}
```

**Properties**:

| Property | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `name` | `string` | Yes | Display name for data source | `"Q1 Marketing Campaigns"` |
| `customerId` | `string` | Yes | Google Ads customer ID | `"123-456-7890"` |
| `accessToken` | `string` | Yes | OAuth access token | `"ya29.a0AfH6SM..."` |
| `refreshToken` | `string` | Yes | OAuth refresh token | `"1//0gKN2Dw8..."` |
| `reportTypes` | `string[]` | Yes | Report types to sync | `["campaign", "keyword"]` |
| `startDate` | `string` | Yes | Sync start date | `"2024-01-01"` |
| `endDate` | `string` | Yes | Sync end date | `"2024-01-31"` |

**Example**:
```typescript
// Frontend: Creating data source
const syncConfig: IGoogleAdsSyncConfig = {
  name: 'Q1 Marketing Campaigns',
  customerId: '123-456-7890',
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  reportTypes: ['campaign', 'keyword', 'geographic'],
  startDate: '2024-01-01',
  endDate: '2024-03-31'
};

// API call
const response = await fetch('/api/google-ads/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(syncConfig)
});

const { dataSourceId } = await response.json();
```

---

## Account Types

### IGoogleAdsAccount

Represents a Google Ads account.

```typescript
interface IGoogleAdsAccount {
    customerId: string;
    descriptiveName: string;
    currencyCode: string;
    timeZone: string;
}
```

**Properties**:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `customerId` | `string` | Unique Google Ads customer ID | `"123-456-7890"` |
| `descriptiveName` | `string` | Account display name | `"Acme Corp Main Account"` |
| `currencyCode` | `string` | ISO 4217 currency code | `"USD"`, `"EUR"`, `"GBP"` |
| `timeZone` | `string` | IANA timezone identifier | `"America/New_York"` |

**Example**:
```typescript
// Backend: List accounts response
const accounts: IGoogleAdsAccount[] = [
  {
    customerId: '123-456-7890',
    descriptiveName: 'Acme Corp Main Account',
    currencyCode: 'USD',
    timeZone: 'America/New_York'
  },
  {
    customerId: '987-654-3210',
    descriptiveName: 'Acme Corp - EU',
    currencyCode: 'EUR',
    timeZone: 'Europe/London'
  }
];

// Frontend: Display accounts
accounts.forEach(account => {
  console.log(`${account.descriptiveName} (${account.customerId})`);
  console.log(`Currency: ${account.currencyCode}, Timezone: ${account.timeZone}`);
});
```

### IGoogleAdsReportTypeDefinition

Metadata for a report type.

```typescript
interface IGoogleAdsReportTypeDefinition {
    id: string;
    name: string;
    description: string;
    dimensions: string[];
    metrics: string[];
}
```

**Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique report type identifier |
| `name` | `string` | Human-readable name |
| `description` | `string` | What data this report provides |
| `dimensions` | `string[]` | Available dimensions |
| `metrics` | `string[]` | Available metrics |

**Example**:
```typescript
const campaignReportType: IGoogleAdsReportTypeDefinition = {
  id: 'campaign',
  name: 'Campaign Performance',
  description: 'Ad spend, conversions, and ROAS by campaign',
  dimensions: ['Date', 'Campaign'],
  metrics: [
    'Cost',
    'Conversions',
    'Conversion Value',
    'ROAS',
    'CTR',
    'CPC',
    'CPM',
    'Impressions',
    'Clicks'
  ]
};

const keywordReportType: IGoogleAdsReportTypeDefinition = {
  id: 'keyword',
  name: 'Keyword Performance',
  description: 'CPC, quality score, and conversions by keyword',
  dimensions: ['Date', 'Campaign', 'Ad Group', 'Keyword', 'Match Type'],
  metrics: [
    'Impressions',
    'Clicks',
    'Cost',
    'Conversions',
    'CTR',
    'CPC',
    'Quality Score'
  ]
};

// Frontend: Display report types
function renderReportTypes(reportTypes: IGoogleAdsReportTypeDefinition[]) {
  reportTypes.forEach(type => {
    console.log(`${type.name}: ${type.description}`);
    console.log(`Dimensions: ${type.dimensions.join(', ')}`);
    console.log(`Metrics: ${type.metrics.join(', ')}`);
  });
}
```

---

## Sync Configuration Types

### IAPIConnectionDetails

Extended type for Google Ads connection details (used throughout platform).

```typescript
interface IAPIConnectionDetails {
    oauth_access_token: string;
    oauth_refresh_token: string;
    token_expiry?: Date;
    api_config?: {
        customer_id: string;
        report_types: string[];
        start_date: string;
        end_date: string;
    };
}
```

**Properties**:

| Property | Type | Optional | Description |
|----------|------|----------|-------------|
| `oauth_access_token` | `string` | No | Current OAuth access token |
| `oauth_refresh_token` | `string` | No | OAuth refresh token |
| `token_expiry` | `Date` | Yes | When access token expires |
| `api_config` | `object` | Yes | Google Ads-specific configuration |

**Example**:
```typescript
// Stored in database as JSONB
const connectionDetails: IAPIConnectionDetails = {
  oauth_access_token: 'ya29.a0AfH6SM...',
  oauth_refresh_token: '1//0gKN2Dw8...',
  token_expiry: new Date('2024-01-15T11:30:00Z'),
  api_config: {
    customer_id: '123-456-7890',
    report_types: ['campaign', 'keyword', 'geographic'],
    start_date: '2024-01-01',
    end_date: '2024-01-31'
  }
};

// Driver uses this to sync
async function syncDataSource(dataSourceId: number) {
  const dataSource = await getDataSource(dataSourceId);
  const details: IAPIConnectionDetails = dataSource.connection_details;
  
  // Check if token needs refresh
  if (details.token_expiry && new Date() > details.token_expiry) {
    const newTokens = await refreshAccessToken(details.oauth_refresh_token);
    details.oauth_access_token = newTokens.access_token;
    details.token_expiry = new Date(newTokens.expiry_date);
  }
  
  // Sync each report type
  for (const reportType of details.api_config.report_types) {
    await syncReportType(reportType, details);
  }
}
```

---

## Status Types

### IGoogleAdsSyncStatus

Current status of a Google Ads data source sync.

```typescript
interface IGoogleAdsSyncStatus {
    lastSyncTime: string | null;
    status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    recordsSynced: number;
    recordsFailed: number;
    error?: string;
}
```

**Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `lastSyncTime` | `string \| null` | ISO timestamp of last sync, or null if never synced |
| `status` | Enum | Current sync status |
| `recordsSynced` | `number` | Records successfully synced in last run |
| `recordsFailed` | `number` | Records that failed to sync |
| `error` | `string` | Error message if status is `FAILED` |

**Status Values**:
- `IDLE`: No sync in progress, ready to sync
- `RUNNING`: Sync currently in progress
- `COMPLETED`: Last sync completed successfully
- `FAILED`: Last sync failed with error

**Example**:
```typescript
// Backend: Get sync status
async function getSyncStatus(dataSourceId: number): Promise<IGoogleAdsSyncStatus> {
  const history = await getSyncHistory(dataSourceId, 1);
  const lastSync = history[0];
  
  if (!lastSync) {
    return {
      lastSyncTime: null,
      status: 'IDLE',
      recordsSynced: 0,
      recordsFailed: 0
    };
  }
  
  return {
    lastSyncTime: lastSync.completed_at?.toISOString() || null,
    status: lastSync.status as any,
    recordsSynced: lastSync.records_synced,
    recordsFailed: lastSync.records_failed,
    error: lastSync.error_message
  };
}

// Frontend: Display status
function renderSyncStatus(status: IGoogleAdsSyncStatus) {
  if (status.status === 'IDLE') {
    console.log('Ready to sync');
  } else if (status.status === 'RUNNING') {
    console.log('Sync in progress...');
  } else if (status.status === 'COMPLETED') {
    console.log(`Last sync: ${status.lastSyncTime}`);
    console.log(`Records synced: ${status.recordsSynced}`);
  } else if (status.status === 'FAILED') {
    console.error(`Sync failed: ${status.error}`);
  }
}
```

---

## Usage Examples

### Complete Type-Safe Workflow

```typescript
import {
  GoogleAdsReportType,
  IGoogleAdsReportQuery,
  IGoogleAdsReportResponse,
  IGoogleAdsRow,
  IGoogleAdsSyncConfig,
  IGoogleAdsAccount,
  IGoogleAdsSyncStatus
} from '../types/IGoogleAds';

// 1. List accounts
async function getAccounts(accessToken: string): Promise<IGoogleAdsAccount[]> {
  const response = await fetch('/api/google-ads/accounts', {
    method: 'POST',
    body: JSON.stringify({ accessToken })
  });
  
  const data = await response.json();
  return data.accounts as IGoogleAdsAccount[];
}

// 2. Create data source
async function createDataSource(
  config: IGoogleAdsSyncConfig
): Promise<number> {
  const response = await fetch('/api/google-ads/add', {
    method: 'POST',
    body: JSON.stringify(config)
  });
  
  const data = await response.json();
  return data.dataSourceId;
}

// 3. Build query
function buildCampaignQuery(
  customerId: string,
  startDate: string,
  endDate: string
): IGoogleAdsReportQuery {
  return {
    customerId,
    startDate,
    endDate,
    reportType: GoogleAdsReportType.CAMPAIGN,
    metrics: [
      'impressions',
      'clicks',
      'costMicros',
      'conversions',
      'conversionsValue'
    ],
    dimensions: [
      'campaign.id',
      'campaign.name',
      'segments.date'
    ]
  };
}

// 4. Run report
async function runReport(
  accessToken: string,
  query: IGoogleAdsReportQuery
): Promise<IGoogleAdsReportResponse> {
  const service = GoogleAdsService.getInstance();
  return await service.runReport(accessToken, query);
}

// 5. Transform data
function transformCampaignData(rows: IGoogleAdsRow[]) {
  return rows.map(row => ({
    date: row.segments?.date,
    campaign_id: row.campaign?.id,
    campaign_name: row.campaign?.name,
    campaign_status: row.campaign?.status,
    impressions: row.metrics.impressions,
    clicks: row.metrics.clicks,
    cost: row.metrics.costMicros / 1000000,
    conversions: row.metrics.conversions,
    conversion_value: row.metrics.conversionsValue,
    ctr: row.metrics.ctr,
    average_cpc: row.metrics.averageCpc / 1000000,
    average_cpm: row.metrics.averageCpm / 1000000
  }));
}

// 6. Check status
async function checkSyncStatus(
  dataSourceId: number
): Promise<IGoogleAdsSyncStatus> {
  const response = await fetch(`/api/google-ads/status/${dataSourceId}`);
  const data = await response.json();
  return data.status as IGoogleAdsSyncStatus;
}

// Complete workflow
async function completeWorkflow() {
  // Get accounts
  const accounts = await getAccounts('your_access_token');
  console.log('Available accounts:', accounts);
  
  // Create data source
  const config: IGoogleAdsSyncConfig = {
    name: 'Q1 Campaigns',
    customerId: accounts[0].customerId,
    accessToken: 'your_access_token',
    refreshToken: 'your_refresh_token',
    reportTypes: ['campaign', 'keyword'],
    startDate: '2024-01-01',
    endDate: '2024-03-31'
  };
  
  const dataSourceId = await createDataSource(config);
  console.log('Data source created:', dataSourceId);
  
  // Trigger sync
  await fetch(`/api/google-ads/sync/${dataSourceId}`, { method: 'POST' });
  
  // Poll status
  let status: IGoogleAdsSyncStatus;
  do {
    await new Promise(resolve => setTimeout(resolve, 5000));
    status = await checkSyncStatus(dataSourceId);
    console.log('Status:', status.status);
  } while (status.status === 'RUNNING');
  
  if (status.status === 'COMPLETED') {
    console.log(`Sync completed! ${status.recordsSynced} records synced.`);
  } else {
    console.error(`Sync failed: ${status.error}`);
  }
}
```

### Type Guards and Validation

```typescript
// Type guard for report type
function isValidReportType(value: string): value is GoogleAdsReportType {
  return Object.values(GoogleAdsReportType).includes(value as GoogleAdsReportType);
}

// Validate sync config
function validateSyncConfig(config: any): config is IGoogleAdsSyncConfig {
  return (
    typeof config.name === 'string' &&
    typeof config.customerId === 'string' &&
    typeof config.accessToken === 'string' &&
    typeof config.refreshToken === 'string' &&
    Array.isArray(config.reportTypes) &&
    config.reportTypes.every((t: any) => typeof t === 'string') &&
    typeof config.startDate === 'string' &&
    typeof config.endDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(config.startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(config.endDate)
  );
}

// Usage
const userInput = JSON.parse(requestBody);

if (validateSyncConfig(userInput)) {
  // TypeScript now knows userInput is IGoogleAdsSyncConfig
  const dataSourceId = await createDataSource(userInput);
} else {
  throw new Error('Invalid sync configuration');
}
```

---

## Related Documentation

- [Google Ads Technical Documentation](./GOOGLE_ADS_DOCUMENTATION.md)
- [Google Ads User Guide](./GA_USER_GUIDE.md)
- [Google Ads API Integration Guide](./GA_API_INTEGRATION_GUIDE.md)
- [Google Ads Report Types Reference](./GA_REPORT_TYPES_REFERENCE.md)

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Google Ads API Field Reference](https://developers.google.com/google-ads/api/fields/v16/overview)
