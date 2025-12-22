# Google Ads Integration - Technical Documentation

## Overview

The Google Ads integration enables the Data Research Analysis platform to sync advertising campaign data from Google Ads accounts into PostgreSQL for analysis and querying via the AI Data Modeler. This document provides a comprehensive technical reference for developers working with the Google Ads integration.

### Key Features

- **OAuth 2.0 Authentication**: Secure connection via Google OAuth
- **Multi-Account Support**: Select and sync from multiple Google Ads accounts
- **4 Report Types**: Campaign, Keyword, Geographic, and Device performance data
- **Automatic Token Refresh**: Handles token expiration automatically
- **Retry Logic**: Built-in error handling and retry mechanisms
- **PostgreSQL Storage**: Data stored in dedicated schemas with proper indexing
- **AI Data Modeler Integration**: Seamless querying through natural language

---

## System Architecture

### High-Level Flow

```mermaid
graph TB
    A[User] -->|1. Initiates OAuth| B[Frontend - google-ads.vue]
    B -->|2. Redirects to Google| C[Google OAuth]
    C -->|3. Auth Code| D[Frontend - callback.vue]
    D -->|4. Exchange Code| E[Backend - GoogleOAuthService]
    E -->|5. Tokens| F[DataSourceProcessor]
    F -->|6. Create Data Source| G[PostgreSQL - dra DB]
    A -->|7. Trigger Sync| H[Backend - google_ads.ts]
    H -->|8. Sync Request| I[GoogleAdsDriver]
    I -->|9. Fetch Data| J[GoogleAdsService - Google Ads API]
    J -->|10. Campaign Data| I
    I -->|11. Store Data| K[PostgreSQL - dra_google_ads schema]
    A -->|12. Query Data| L[AI Data Modeler]
    L -->|13. SQL Query| K
```

### Component Overview

| Component | Type | Responsibility |
|-----------|------|----------------|
| **google-ads.vue** | Frontend | Connection wizard UI |
| **callback.vue** | Frontend | OAuth callback handler |
| **google_ads.ts** | Backend Routes | API endpoints |
| **GoogleAdsDriver** | Backend Driver | Data sync orchestration |
| **GoogleAdsService** | Backend Service | Google Ads API client |
| **GoogleOAuthService** | Backend Service | OAuth token management |
| **DataSourceProcessor** | Backend Processor | Data source CRUD |
| **PostgreSQL** | Database | Data storage |

---

## File Structure

### Backend Files

```
backend/src/
├── drivers/
│   └── GoogleAdsDriver.ts           # Core sync logic
├── services/
│   ├── GoogleAdsService.ts          # Google Ads API client
│   └── GoogleOAuthService.ts        # OAuth token management
├── processors/
│   └── DataSourceProcessor.ts       # Data source management
├── routes/
│   └── google_ads.ts                # API endpoints
└── types/
    └── IGoogleAds.ts                # TypeScript interfaces
```

### Frontend Files

```
frontend/pages/projects/[projectid]/data-sources/
├── connect/
│   └── google-ads.vue               # Connection wizard
└── oauth/
    └── callback.vue                 # OAuth callback (shared)
```

### Database Structure

```
PostgreSQL Database: dra
├── public schema
│   ├── data_sources                 # Data source registry
│   └── sync_history                 # Sync execution history
└── dra_google_ads schema
    ├── campaigns_{id}               # Campaign performance data
    ├── keywords_{id}                # Keyword performance data
    ├── geographic_{id}              # Geographic performance data
    └── devices_{id}                 # Device performance data
```

---

## Data Flow

### 1. Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Google
    
    User->>Frontend: Click "Connect Google Ads"
    Frontend->>Backend: GET /api/oauth/google/url
    Backend->>Frontend: OAuth URL
    Frontend->>Google: Redirect to OAuth
    Google->>User: Login & Grant Access
    Google->>Frontend: Redirect with auth code
    Frontend->>Backend: POST /api/oauth/google/callback
    Backend->>Google: Exchange code for tokens
    Google->>Backend: Access + Refresh tokens
    Backend->>Frontend: Tokens
    Frontend->>Frontend: Store tokens in component state
```

**Key Steps:**

1. User clicks "Sign in with Google" button
2. Frontend requests OAuth URL from backend (`/api/oauth/google/url?service=google_ads`)
3. Backend generates OAuth URL with appropriate scopes
4. User is redirected to Google for consent
5. Google redirects back to `/oauth/callback?service=google_ads&code=...`
6. Frontend exchanges auth code for tokens via `/api/oauth/google/callback`
7. Tokens are returned to frontend and stored in wizard state

**OAuth Scopes Required:**
- `https://www.googleapis.com/auth/adwords` - Full Google Ads access

### 2. Account Selection Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant GoogleAds
    
    User->>Frontend: Complete OAuth
    Frontend->>Backend: POST /api/google-ads/accounts
    Backend->>GoogleAds: List accessible accounts
    GoogleAds->>Backend: Account list
    Backend->>Frontend: Formatted accounts
    Frontend->>User: Display account picker
    User->>Frontend: Select account
    Frontend->>Frontend: Store customer_id
```

**Key Steps:**

1. After OAuth, frontend calls `/api/google-ads/accounts` with access token
2. `GoogleAdsService.listAccounts()` queries Google Ads API
3. Accounts are formatted with name, ID (customer ID), and type
4. User selects account from UI
5. Customer ID is stored for data source creation

### 3. Configuration Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    
    User->>Frontend: Select report types
    User->>Frontend: Choose date range
    Frontend->>Frontend: Validate configuration
    User->>Frontend: Click "Complete Setup"
    Frontend->>Backend: POST /api/google-ads/add
    Backend->>Backend: Create data source record
    Backend->>Frontend: data_source_id
    Frontend->>User: Redirect to  data sources page
```

**Key Steps:**

1. User selects report types (Campaign, Keyword, Geographic, Device)
2. User selects date range (Last 30/90 days or custom)
3. Frontend validates all required fields
4. `POST /api/google-ads/add` creates data source with config
5. Data source is saved with `api_config`:
   ```json
   {
     "customer_id": "123-456-7890",
     "report_types": ["campaign", "keyword"],
     "start_date": "2024-01-01",
     "end_date": "2024-01-31"
   }
   ```

### 4. Data Sync Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Driver
    participant Service
    participant GoogleAds
    participant PostgreSQL
    
    User->>Frontend: Click "Sync Now"
    Frontend->>Backend: POST /api/google-ads/sync/{id}
    Backend->>Driver: syncToDatabase()
    Driver->>Driver: Create sync record
    Driver->>Driver: Refresh tokens if expired
    Driver->>Service: runReport(query)
    Service->>GoogleAds: Execute GAQL query
    GoogleAds->>Service: Report data
    Service->>Driver: Formatted data
    Driver->>PostgreSQL: Bulk upsert
    PostgreSQL->>Driver: Success
    Driver->>Driver: Update sync record
    Driver->>Backend: Sync result
    Backend->>Frontend: Success response
```

**Key Steps:**

1. User triggers manual sync from data sources page
2. `POST /api/google-ads/sync/:id` initiates sync
3. `GoogleAdsDriver.syncToDatabase()` orchestrates the process:
   - Creates sync history record with status "RUNNING"
   - Refreshes OAuth tokens if expired
   - Creates schema `dra_google_ads` if needed
   - Iterates through configured report types
   - For each report type:
     - Creates table if not exists
     - Builds GAQL query
     - Fetches data from Google Ads API
     - Transforms data
     - Performs bulk upsert (UNIQUE constraint on date + dimension keys)
   - Updates sync history with results
4. Sync history tracks: records synced, records failed, errors, duration

---

## Key Components

### Frontend Components

#### google-ads.vue
**Purpose**: 3-step connection wizard for Google Ads setup

**Location**: `/home/dataresearchanalysis/frontend/pages/projects/[projectid]/data-sources/connect/google-ads.vue`

**Features**:
- **Step 1**: Google OAuth authentication with Google logo button
- **Step 2**: Account selection from accessible Google Ads accounts
- **Step 3**: Report type selection + date range configuration
- Responsive design matching Analytics/Ad Manager wizard styling
- Form validation and error handling
- Loading states for async operations

**Key State**:
```typescript
const wizardState = ref({
  step: 1,
  isAuthenticated: false,
  accessToken: '',
  refreshToken: '',
  customerAccounts: [],
  selectedCustomerId: '',
  selectedReportTypes: ['campaign'],
  dateRange: 'last30days',
  customStartDate: '',
  customEndDate: '',
  isLoading: false
});
```

**Key Methods**:
- `handleGoogleSignIn()`: Initiates OAuth flow
- `fetchAccounts()`: Retrieves accessible accounts
- `completeSetup()`: Creates data source

#### callback.vue
**Purpose**: Shared OAuth callback handler for all Google services

**Location**: `/home/dataresearchanalysis/frontend/pages/projects/[projectid]/data-sources/oauth/callback.vue`

**Logic for Google Ads**:
```javascript
if (service === 'google_ads') {
  // Store tokens in session/local storage or pass via URL
  router.push({
    path: `/projects/${projectId}/data-sources/connect/google-ads`,
    query: { 
      accessToken, 
      refreshToken,
      step: '2'
    }
  });
}
```

### Backend Components

#### GoogleAdsDriver.ts

**Purpose**: Core driver for data synchronization

**Location**: `/home/dataresearchanalysis/backend/src/drivers/GoogleAdsDriver.ts`

**Key Methods**:

| Method | Purpose | Returns |
|--------|---------|---------|
| `authenticate()` | Validates OAuth tokens | `boolean` |
| `syncToDatabase()` | Orchestrates full sync | `boolean` |
| `syncReportType()` | Syncs specific report type | `{recordsSynced, recordsFailed}` |
| `syncCampaignData()` | Syncs campaign performance | `{recordsSynced, recordsFailed}` |
| `syncKeywordData()` | Syncs keyword performance | `{recordsSynced, recordsFailed}` |
| `syncGeographicData()` | Syncs geographic performance | `{recordsSynced, recordsFailed}` |
| `syncDeviceData()` | Syncs device performance | `{recordsSynced, recordsFailed}` |
| `bulkUpsert()` | Efficient batch insert/update | `void` |
| `getSyncHistory()` | Retrieves sync records | `SyncHistory[]` |
| `getSchema()` | Returns table schema definition | `object` |

**Sync Logic Flow** (pseudocode):
```typescript
async syncToDatabase(dataSourceId, connectionDetails) {
  // 1. Create sync record
  const syncRecord = await createSyncRecord(dataSourceId);
  
  // 2. Authenticate
  const isAuth = await this.authenticate(connectionDetails);
  if (!isAuth) throw new Error('Authentication failed');
  
  // 3. Create schema
  await createSchemaIfNotExists('dra_google_ads');
  
  // 4. Get report types from config
  const reportTypes = connectionDetails.api_config.report_types;
  
  // 5. Sync each report type
  for (const reportType of reportTypes) {
    await this.syncReportType(reportType, ...);
  }
  
  // 6. Update sync record with results
  await updateSyncRecord(syncRecord.id, { status: 'COMPLETED' });
}
```

**Transform Methods**:
Each report type has a transform method to convert Google Ads API response to database format:

```typescript
private transformCampaignData(row: any): object {
  return {
    date: row.segments.date,
    campaign_id: row.campaign.id,
    campaign_name: row.campaign.name,
    campaign_status: row.campaign.status,
    impressions: parseInt(row.metrics.impressions) || 0,
    clicks: parseInt(row.metrics.clicks) || 0,
    cost: (parseInt(row.metrics.cost_micros) / 1000000) || 0,
    conversions: parseFloat(row.metrics.conversions) || 0,
    conversion_value: parseFloat(row.metrics.conversions_value) || 0,
    ctr: parseFloat(row.metrics.ctr) || 0,
    average_cpc: (parseInt(row.metrics.average_cpc) / 1000000) || 0,
    average_cpm: (parseInt(row.metrics.average_cpm) / 1000000) || 0
  };
}
```

#### GoogleAdsService.ts

**Purpose**: Google Ads API client wrapper

**Location**: `/home/dataresearchanalysis/backend/src/services/GoogleAdsService.ts`

**Configuration**:
```typescript
private readonly API_VERSION = 'v16';
private readonly DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
```

**Key Methods**:

| Method | Purpose | API Endpoint |
|--------|---------|--------------|
| `listAccounts()` | List accessible accounts | `customers:listAccessibleCustomers` |
| `getAccountDetails()` | Get account info | `customers/{customerId}/googleAds:search` |
| `runReport()` | Execute GAQL query | `customers/{customerId}/googleAds:searchStream` |
| `buildCampaignQuery()` | Build campaign GAQL | N/A (query builder) |
| `buildKeywordQuery()` | Build keyword GAQL | N/A (query builder) |
| `buildGeographicQuery()` | Build geo GAQL | N/A (query builder) |
| `buildDeviceQuery()` | Build device GAQL | N/A (query builder) |

**Sample GAQL Query** (Campaign Report):
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.ctr,
  metrics.average_cpc,
  metrics.average_cpm,
  segments.date
FROM campaign
WHERE segments.date BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY segments.date DESC
```

**API Request Format**:
```typescript
const response = await axios.post(
  `https://googleads.googleapis.com/${this.API_VERSION}/customers/${customerId}/googleAds:searchStream`,
  { query: gaqlQuery },
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': this.DEVELOPER_TOKEN,
      'Content-Type': 'application/json'
    }
  }
);
```

#### GoogleOAuthService.ts

**Purpose**: Manages OAuth token lifecycle

**Location**: `/home/dataresearchanalysis/backend/src/services/GoogleOAuthService.ts`

**Key Methods**:

| Method | Purpose |
|--------|---------|
| `getAuthUrl()` | Generates OAuth consent URL |
| `getTokenFromCode()` | Exchanges auth code for tokens |
| `refreshAccessToken()` | Refreshes expired token |
| `isTokenExpired()` | Checks token expiry |

**Token Refresh Logic**:
```typescript
public async refreshAccessToken(refreshToken: string) {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  
  return {
    access_token: response.data.access_token,
    expiry_date: Date.now() + (response.data.expires_in * 1000)
  };
}
```

---

## API Endpoints

### Authentication

#### GET /api/oauth/google/url

Generate OAuth consent URL.

**Query Parameters**:
- `service` (required): Must be `google_ads`

**Response**:
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### POST /api/oauth/google/callback

Exchange authorization code for tokens.

**Request Body**:
```json
{
  "code": "4/0AX4XfWh...",
  "service": "google_ads"
}
```

**Response**:
```json
{
  "access_token": "ya29.a0AfH6SM...",
  "refresh_token": "1//0gKN2D...",
  "expiry_date": 1706789123456
}
```

### Google Ads Endpoints

#### POST /api/google-ads/accounts

List accessible Google Ads accounts.

**Request Body**:
```json
{
  "accessToken": "ya29.a0AfH6SM..."
}
```

**Response**:
```json
{
  "success": true,
  "accounts": [
    {
      "id": "123-456-7890",
      "name": "My Ad Account",
      "type": "CUSTOMER"
    }
  ]
}
```

#### GET /api/google-ads/report-types

Get available report types.

**Response**:
```json
{
  "success": true,
  "reportTypes": [
    {
      "id": "campaign",
      "name": "Campaign Performance",
      "description": "Ad spend, conversions, and ROAS by campaign",
      "dimensions": ["Date", "Campaign"],
      "metrics": ["Cost", "Conversions", "Conversion Value", "ROAS", "CTR", "CPC", "CPM"]
    },
    {
      "id": "keyword",
      "name": "Keyword Performance",
      "description": "CPC, quality score, and conversions by keyword",
      "dimensions": ["Date", "Campaign", "Ad Group", "Keyword", "Match Type"],
      "metrics": ["Impressions", "Clicks", "Cost", "Conversions", "CTR", "CPC", "Quality Score"]
    },
    {
      "id": "geographic",
      "name": "Geographic Performance",
      "description": "Performance by country, region, city",
      "dimensions": ["Date", "Country", "Region", "City"],
      "metrics": ["Impressions", "Clicks", "Cost", "Conversions", "Conversion Value"]
    },
    {
      "id": "device",
      "name": "Device Performance",
      "description": "Mobile, desktop, tablet breakdown",
      "dimensions": ["Date", "Device"],
      "metrics": ["Impressions", "Clicks", "Cost", "Conversions", "Conversion Value", "CTR", "CPC"]
    }
  ]
}
```

#### POST /api/google-ads/add

Create new Google Ads data source.

**Request Body**:
```json
{
  "name": "Marketing Campaigns Q1",
  "customerId": "123-456-7890",
  "accessToken": "ya29.a0AfH6SM...",
  "refreshToken": "1//0gKN2D...",
  "reportTypes": ["campaign", "keyword"],
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

**Response**:
```json
{
  "success": true,
  "dataSourceId": 42
}
```

#### POST /api/google-ads/sync/:id

Trigger manual sync for data source.

**Parameters**:
- `id`: Data source ID

**Response**:
```json
{
  "success": true,
  "message": "Sync completed successfully"
}
```

#### GET /api/google-ads/status/:id

Get sync status and history.

**Parameters**:
- `id`: Data source ID

**Response**:
```json
{
  "success": true,
  "status": {
    "lastSyncTime": "2024-01-15T10:30:00Z",
    "status": "COMPLETED",
    "recordsSynced": 1250,
    "recordsFailed": 0,
    "error": null
  },
  "history": [
    {
      "id": 156,
      "started_at": "2024-01-15T10:29:45Z",
      "completed_at": "2024-01-15T10:30:15Z",
      "status": "COMPLETED",
      "records_synced": 1250,
      "records_failed": 0
    }
  ]
}
```

---

## Database Schema

### Data Source Registry

**Table**: `public.data_sources`

Stores data source configuration.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `user_id` | INTEGER | Owner user ID |
| `project_id` | INTEGER | Associated project |
| `source_type` | VARCHAR | `'google_ads'` |
| `name` | TEXT | User-defined name |
| `connection_details` | JSONB | OAuth tokens + config |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Last update time |

**Sample `connection_details`**:
```json
{
  "oauth_access_token": "ya29.a0AfH6SM...",
  "oauth_refresh_token": "1//0gKN2D...",
  "token_expiry": "2024-01-15T11:30:00Z",
  "api_config": {
    "customer_id": "123-456-7890",
    "report_types": ["campaign", "keyword"],
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }
}
```

### Sync History

**Table**: `public.sync_history`

Tracks all sync executions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `data_source_id` | INTEGER | FK to data_sources |
| `sync_type` | VARCHAR | `'MANUAL'` or `'SCHEDULED'` |
| `status` | VARCHAR | `'PENDING'`, `'RUNNING'`, `'COMPLETED'`, `'FAILED'` |
| `started_at` | TIMESTAMP | Sync start time |
| `completed_at` | TIMESTAMP | Sync end time |
| `records_synced` | INTEGER | Successful records |
| `records_failed` | INTEGER | Failed records |
| `error_message` | TEXT | Error details if failed |
| `sync_config` | JSONB | Snapshot of sync params |

### Campaign Performance Data

**Schema**: `dra_google_ads`  
**Table**: `campaigns_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | No | Primary key |
| `date` | DATE | No | Report date |
| `campaign_id` | VARCHAR(255) | No | Google Ads campaign ID |
| `campaign_name` | TEXT | Yes | Campaign name |
| `campaign_status` | VARCHAR(50) | Yes | ENABLED, PAUSED, REMOVED |
| `impressions` | BIGINT | Yes | Number of impressions |
| `clicks` | BIGINT | Yes | Number of clicks |
| `cost` | DECIMAL(15,2) | Yes | Cost in account currency |
| `conversions` | DECIMAL(10,2) | Yes | Conversion count |
| `conversion_value` | DECIMAL(15,2) | Yes | Total conversion value |
| `ctr` | DECIMAL(10,4) | Yes | Click-through rate (0.0-1.0) |
| `average_cpc` | DECIMAL(10,2) | Yes | Average cost-per-click |
| `average_cpm` | DECIMAL(10,2) | Yes | Average cost-per-thousand |
| `customer_id` | VARCHAR(255) | No | Google Ads customer ID |
| `synced_at` | TIMESTAMP | Yes | Last sync timestamp |

**Indexes**:
- `UNIQUE(date, campaign_id)` - Prevents duplicates

### Keyword Performance Data

**Schema**: `dra_google_ads`  
**Table**: `keywords_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | No | Primary key |
| `date` | DATE | No | Report date |
| `campaign_id` | VARCHAR(255) | No | Campaign ID |
| `campaign_name` | TEXT | Yes | Campaign name |
| `ad_group_id` | VARCHAR(255) | No | Ad group ID |
| `ad_group_name` | TEXT | Yes | Ad group name |
| `keyword_id` | VARCHAR(255) | No | Keyword ID |
| `keyword_text` | TEXT | Yes | Keyword text |
| `match_type` | VARCHAR(50) | Yes | EXACT, PHRASE, BROAD |
| `impressions` | BIGINT | Yes | Impressions |
| `clicks` | BIGINT | Yes | Clicks |
| `cost` | DECIMAL(15,2) | Yes | Cost |
| `conversions` | DECIMAL(10,2) | Yes | Conversions |
| `ctr` | DECIMAL(10,4) | Yes | Click-through rate |
| `average_cpc` | DECIMAL(10,2) | Yes | Avg CPC |
| `quality_score` | INTEGER | Yes | 1-10 quality score |
| `customer_id` | VARCHAR(255) | No | Customer ID |
| `synced_at` | TIMESTAMP | Yes | Sync timestamp |

**Indexes**:
- `UNIQUE(date, keyword_id)`

### Geographic Performance Data

**Schema**: `dra_google_ads`  
**Table**: `geographic_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | No | Primary key |
| `date` | DATE | No | Report date |
| `country_code` | VARCHAR(10) | Yes | ISO country code (US, GB, etc.) |
| `country_name` | TEXT | Yes | Country name |
| `region_code` | VARCHAR(50) | Yes | Region/state code |
| `region_name` | TEXT | Yes | Region/state name |
| `city_name` | TEXT | Yes | City name |
| `impressions` | BIGINT | Yes | Impressions |
| `clicks` | BIGINT | Yes | Clicks |
| `cost` | DECIMAL(15,2) | Yes | Cost |
| `conversions` | DECIMAL(10,2) | Yes | Conversions |
| `conversion_value` | DECIMAL(15,2) | Yes | Conversion value |
| `customer_id` | VARCHAR(255) | No | Customer ID |
| `synced_at` | TIMESTAMP | Yes | Sync timestamp |

**Indexes**:
- `UNIQUE(date, country_code, region_code, city_name)`

### Device Performance Data

**Schema**: `dra_google_ads`  
**Table**: `devices_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | No | Primary key |
| `date` | DATE | No | Report date |
| `device_type` | VARCHAR(50) | No | MOBILE, DESKTOP, TABLET |
| `impressions` | BIGINT | Yes | Impressions |
| `clicks` | BIGINT | Yes | Clicks |
| `cost` | DECIMAL(15,2) | Yes | Cost |
| `conversions` | DECIMAL(10,2) | Yes | Conversions |
| `conversion_value` | DECIMAL(15,2) | Yes | Conversion value |
| `ctr` | DECIMAL(10,4) | Yes | Click-through rate |
| `average_cpc` | DECIMAL(10,2) | Yes | Avg CPC |
| `customer_id` | VARCHAR(255) | No | Customer ID |
| `synced_at` | TIMESTAMP | Yes | Sync timestamp |

**Indexes**:
- `UNIQUE(date, device_type)`

---

## Common Modifications

### Adding a New Report Type

To add a new report type (e.g., "Ad Group Performance"):

**1. Update TypeScript Types** (`IGoogleAds.ts`):
```typescript
export enum GoogleAdsReportType {
  CAMPAIGN = 'CAMPAIGN',
  KEYWORD = 'KEYWORD',
  GEOGRAPHIC = 'GEOGRAPHIC',
  DEVICE = 'DEVICE',
  AD_GROUP = 'AD_GROUP'  // Add new type
}
```

**2. Add Query Builder** (`GoogleAdsService.ts`):
```typescript
private buildAdGroupQuery(startDate: string, endDate: string): string {
  return `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      segments.date
    FROM ad_group
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date DESC
  `;
}

public getReportType(reportTypeString: string): GoogleAdsReportType {
  const map: Record<string, GoogleAdsReportType> = {
    // ... existing mappings
    'ad_group': GoogleAdsReportType.AD_GROUP,
    'adgroup': GoogleAdsReportType.AD_GROUP
  };
  // ...
}
```

**3. Add Sync Method** (`GoogleAdsDriver.ts`):
```typescript
private async syncAdGroupData(
  manager: any,
  schemaName: string,
  dataSourceId: number,
  startDate: string,
  endDate: string,
  connectionDetails: IAPIConnectionDetails
): Promise<{ recordsSynced: number; recordsFailed: number }> {
  const tableName = `ad_groups_${dataSourceId}`;
  const fullTableName = `${schemaName}.${tableName}`;
  
  // Create table
  await manager.query(`
    CREATE TABLE IF NOT EXISTS ${fullTableName} (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      ad_group_id VARCHAR(255) NOT NULL,
      ad_group_name TEXT,
      ad_group_status VARCHAR(50),
      campaign_id VARCHAR(255),
      campaign_name TEXT,
      impressions BIGINT DEFAULT 0,
      clicks BIGINT DEFAULT 0,
      cost DECIMAL(15,2) DEFAULT 0,
      conversions DECIMAL(10,2) DEFAULT 0,
      customer_id VARCHAR(255) NOT NULL,
      synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, ad_group_id)
    )
  `);
  
  // Fetch data
  const query: IGoogleAdsReportQuery = {
    customerId: connectionDetails.api_config.customer_id,
    reportType: GoogleAdsReportType.AD_GROUP,
    startDate,
    endDate
  };
  
  const response = await this.adsService.runReport(
    connectionDetails.oauth_access_token,
    query
  );
  
  // Transform and upsert
  const transformedData = response.results.map(row => this.transformAdGroupData(row));
  await this.bulkUpsert(manager, fullTableName, transformedData, ['date', 'ad_group_id']);
  
  return { recordsSynced: transformedData.length, recordsFailed: 0 };
}

private transformAdGroupData(row: any): object {
  return {
    date: row.segments.date,
    ad_group_id: row.ad_group.id,
    ad_group_name: row.ad_group.name,
    ad_group_status: row.ad_group.status,
    campaign_id: row.campaign.id,
    campaign_name: row.campaign.name,
    impressions: parseInt(row.metrics.impressions) || 0,
    clicks: parseInt(row.metrics.clicks) || 0,
    cost: (parseInt(row.metrics.cost_micros) / 1000000) || 0,
    conversions: parseFloat(row.metrics.conversions) || 0
  };
}
```

**4. Update Sync Dispatcher** (`GoogleAdsDriver.ts`):
```typescript
private async syncReportType(...): Promise<{...}> {
  const reportType = this.adsService.getReportType(reportTypeString);
  
  switch (reportType) {
    // ... existing cases
    case GoogleAdsReportType.AD_GROUP:
      return await this.syncAdGroupData(manager, schemaName, dataSourceId, startDate, endDate, connectionDetails);
    // ...
  }
}
```

**5. Update Frontend** (`google-ads.vue`):
```vue
<template>
  <!-- Add to report type checkboxes -->
  <label>
    <input type="checkbox" value="ad_group" v-model="selectedReportTypes" />
    Ad Group Performance
  </label>
</template>
```

**6. Update API Route** (`google_ads.ts`):
```typescript
router.get('/report-types', async (req, res) => {
  const reportTypes = [
    // ... existing types
    {
      id: 'ad_group',
      name: 'Ad Group Performance',
      description: 'Performance metrics by ad group',
      dimensions: ['Date', 'Ad Group', 'Campaign'],
      metrics: ['Impressions', 'Clicks', 'Cost', 'Conversions', 'CTR', 'CPC']
    }
  ];
  // ...
});
```

### Modifying Date Range Logic

To change the default date range or add new presets:

**Frontend** (`google-ads.vue`):
```vue
<template>
  <select v-model="dateRange">
    <option value="last7days">Last 7 Days</option>
    <option value="last30days">Last 30 Days</option>
    <option value="last90days">Last 90 Days</option>
    <option value="last6months">Last 6 Months</option> <!-- NEW -->
    <option value="custom">Custom Range</option>
  </select>
</template>

<script setup>
const getDateRangeValues = () => {
  const today = new Date();
  const formatDate = (date) => date.toISOString().split('T')[0];
  
  switch (dateRange.value) {
    case 'last7days':
      return {
        start: formatDate(new Date(today.setDate(today.getDate() - 7))),
        end: formatDate(new Date())
      };
    case 'last6months':  // NEW
      return {
        start: formatDate(new Date(today.setMonth(today.getMonth() - 6))),
        end: formatDate(new Date())
      };
    // ...
  }
};
</script>
```

### Changing Sync Strategy

**Current**: Manual sync only  
**Goal**: Add scheduled sync capability

**1. Add Schedule Config to Data Source**:
```typescript
// In DataSourceProcessor.addGoogleAdsDataSource()
connection_details: {
  // ... existing fields
  api_config: {
    // ... existing config
    sync_schedule: {
      enabled: true,
      frequency: 'daily',  // 'hourly', 'daily', 'weekly'
      time: '02:00'  // UTC time for daily/weekly
    }
  }
}
```

**2. Create Scheduler Service**:
```typescript
// backend/src/services/SyncScheduler.ts
export class SyncScheduler {
  public async scheduleSyncs() {
    const dataSources = await this.getScheduledDataSources();
    
    for (const ds of dataSources) {
      const schedule = ds.connection_details.api_config.sync_schedule;
      
      if (this.shouldRunSync(schedule)) {
        await DataSourceProcessor.getInstance().syncGoogleAdsDataSource(
          ds.id,
          ds.user_id
        );
      }
    }
  }
  
  private shouldRunSync(schedule: any): boolean {
    // Implement scheduling logic
    const now = new Date();
    if (schedule.frequency === 'daily') {
      return now.getUTCHours() === parseInt(schedule.time.split(':')[0]);
    }
    // ...
  }
}
```

**3. Add Cron Job**:
```typescript
// backend/src/index.ts
import cron from 'node-cron';

// Run every hour
cron.schedule('0 * * * *', async () => {
  await SyncScheduler.getInstance().scheduleSyncs();
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid developer token"

**Symptoms**: Sync fails with API error about developer token

**Causes**:
- Missing or incorrect `GOOGLE_ADS_DEVELOPER_TOKEN` in `.env`
- Developer token not approved by Google

**Solutions**:
1. Verify `.env` has correct developer token:
   ```bash
   GOOGLE_ADS_DEVELOPER_TOKEN=your_token_here
   ```
2. Check token status in Google Ads API Center
3. Ensure token is approved for production use (test tokens have limitations)

#### 2. "Customer not found" / "Permission denied"

**Symptoms**: Account list is empty or specific account cannot be accessed

**Causes**:
- OAuth token doesn't have access to the customer account
- Customer ID format is incorrect
- Account is managed by MCC and requires additional permissions

**Solutions**:
1. Ensure customer ID format is correct: `123-456-7890` (with hyphens)
2. Verify the OAuth user has access to the account in Google Ads UI
3. For MCC accounts, ensure proper manager account permissions

#### 3. "Token expired" errors during sync

**Symptoms**: Sync fails midway with authentication error

**Causes**:
- Access token expired during long sync
- Token refresh failed

**Solutions**:
1. Check `GoogleAdsDriver.authenticate()` is called before sync
2. Verify refresh token is valid
3. Check `.env` has correct OAuth credentials:
   ```bash
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

#### 4. No data returned from API

**Symptoms**: Sync completes but 0 records synced

**Causes**:
- Date range has no data
- Account has no campaigns/keywords in selected date range
- Filters in GAQL query are too restrictive

**Solutions**:
1. Check date range is valid and contains data
2. Verify campaigns exist in Google Ads UI for that date range
3. Review GAQL query in `GoogleAdsService` for overly restrictive filters
4. Check sync history for error messages:
   ```sql
   SELECT * FROM sync_history 
   WHERE data_source_id = <id> 
   ORDER BY started_at DESC 
   LIMIT 10;
   ```

#### 5. Duplicate key errors during sync

**Symptoms**: Sync fails with "duplicate key constraint" error

**Causes**:
- Unique index violation (date + dimension key already exists)
- Concurrent syncs for same data source

**Solutions**:
1. This should be handled by `bulkUpsert` with `ON CONFLICT` clause - verify implementation
2. Ensure only one sync runs at a time per data source
3. Check for race conditions in sync triggering

#### 6. Frontend OAuth callback not working

**Symptoms**: After Google consent, redirect fails or tokens not received

**Causes**:
- Incorrect redirect URI in Google Cloud Console
- `callback.vue` not handling `google_ads` service type

**Solutions**:
1. Verify redirect URI in Google Cloud Console matches:
   ```
   http://localhost:3000/projects/{projectid}/data-sources/oauth/callback
   ```
2. Check `callback.vue` has `google_ads` case in service router
3. Ensure `callbackUrl` in OAuth URL generation matches exactly

### Debugging Tools

#### Check Sync History
```sql
SELECT 
  sh.id,
  sh.data_source_id,
  sh.status,
  sh.started_at,
  sh.completed_at,
  sh.records_synced,
  sh.records_failed,
  sh.error_message
FROM sync_history sh
WHERE sh.data_source_id = <your_data_source_id>
ORDER BY sh.started_at DESC
LIMIT 20;
```

#### View Data Source Config
```sql
SELECT 
  id,
  name,
  source_type,
  connection_details->'api_config' as config,
  created_at
FROM data_sources
WHERE source_type = 'google_ads'
  AND user_id = <your_user_id>;
```

#### Check Synced Data
```sql
-- Campaign data
SELECT COUNT(*), MIN(date), MAX(date)
FROM dra_google_ads.campaigns_<data_source_id>;

-- Recent campaigns
SELECT *
FROM dra_google_ads.campaigns_<data_source_id>
ORDER BY date DESC
LIMIT 10;
```

#### Enable Debug Logging

**Backend** (`GoogleAdsDriver.ts`):
```typescript
// Add at top of methods
console.log('[DEBUG] syncToDatabase:', { dataSourceId, reportTypes });
console.log('[DEBUG] API Response:', JSON.stringify(response, null, 2));
```

**Frontend** (`google-ads.vue`):
```javascript
// Add in methods
console.log('[DEBUG] wizardState:', wizardState.value);
console.log('[DEBUG] API call:', { endpoint, payload });
```

### Logs

**Backend logs**:
```bash
# Development
npm run dev

# Production
pm2 logs backend
```

**Frontend logs**:
- Browser DevTools Console
- Network tab for API requests

---

## Security Considerations

### OAuth Tokens

- **Storage**: Tokens stored in `connection_details` JSONB (encrypted at rest)
- **Transmission**: Always HTTPS for token exchange
- **Refresh**: Automatic token refresh before expiry
- **Scope**: Minimal scope (`adwords` only, no unnecessary permissions)

### API Access

- **Authentication**: All Google Ads API endpoints require authenticated user
- **Authorization**: Users can only access their own data sources
- **Rate Limiting**: Respect Google Ads API quotas (10,000 operations/day for standard access)

### Database Security

- **Schema Isolation**: Each data source uses `dra_google_ads` schema
- **Table Isolation**: Tables suffixed with `_{data_source_id}`
- **Row-Level Security**: Enforce via application layer (check user owns data source)

### Environment Variables

Required `.env` variables:
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dra
```

---

## Performance Optimization

### Bulk Operations

The `bulkUpsert` method uses PostgreSQL's `UNNEST` for efficient batch inserts:

```typescript
private async bulkUpsert(manager: any, tableName: string, data: any[], uniqueKeys: string[]) {
  if (data.length === 0) return;
  
  const batchSize = 500;  // Adjust based on row size
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    // ... bulk insert logic
  }
}
```

**Recommendation**: For large datasets (>10K rows), consider:
- Increasing `batchSize` to 1000-2000
- Using `COPY` command instead of `INSERT`
- Temporarily dropping indexes before bulk load

### Indexing

Tables automatically create unique indexes on date + dimension keys:
```sql
UNIQUE(date, campaign_id)  -- Campaigns
UNIQUE(date, keyword_id)   -- Keywords
UNIQUE(date, country_code, region_code, city_name)  -- Geographic
UNIQUE(date, device_type)  -- Devices
```

**Additional indexes** (add if needed):
```sql
CREATE INDEX idx_campaigns_date ON dra_google_ads.campaigns_{id}(date);
CREATE INDEX idx_campaigns_status ON dra_google_ads.campaigns_{id}(campaign_status);
```

### API Quota Management

Google Ads API has rate limits:
- **Standard Access**: 10,000 operations/day
- **Basic Access**: 15,000 operations/day

**Strategies**:
1. Use `searchStream` endpoint for large result sets (implemented)
2. Batch requests when possible
3. Implement exponential backoff on rate limit errors (in `RetryHandler`)
4. Cache account lists (they don't change frequently)

---

## Testing

### Manual Testing Checklist

**Authentication Flow**:
- [ ] OAuth URL generated correctly
- [ ] Google consent screen appears
- [ ] Tokens received after consent
- [ ] Callback redirects to wizard

**Account Selection**:
- [ ] Accounts list populated
- [ ] Multiple accounts displayed correctly
- [ ] Selection persists

**Configuration**:
- [ ] All report types selectable
- [ ] Date range presets work
- [ ] Custom date range validated
- [ ] Data source created successfully

**Sync**:
- [ ] Manual sync triggered
- [ ] Sync history updated
- [ ] Data appears in database
- [ ] Sync status reflects progress

**AI Data Modeler**:
- [ ] Data source appears in modeler
- [ ] Natural language queries work
- [ ] Results match expected data

### Unit Testing

**GoogleAdsService**:
```typescript
describe('GoogleAdsService', () => {
  it('should build correct campaign query', () => {
    const query = service.buildCampaignQuery('2024-01-01', '2024-01-31');
    expect(query).toContain('FROM campaign');
    expect(query).toContain('WHERE segments.date BETWEEN');
  });
  
  it('should map report type strings', () => {
    expect(service.getReportType('campaign')).toBe(GoogleAdsReportType.CAMPAIGN);
    expect(service.getReportType('geo')).toBe(GoogleAdsReportType.GEOGRAPHIC);
  });
});
```

**GoogleAdsDriver**:
```typescript
describe('GoogleAdsDriver', () => {
  it('should transform campaign data correctly', () => {
    const rawRow = {
      campaign: { id: '123', name: 'Test', status: 'ENABLED' },
      metrics: { impressions: '1000', clicks: '50', cost_micros: '5000000' },
      segments: { date: '2024-01-15' }
    };
    
    const transformed = driver['transformCampaignData'](rawRow);
    expect(transformed.campaign_id).toBe('123');
    expect(transformed.cost).toBe(5.00);
  });
});
```

### Integration Testing

**End-to-End Sync Test**:
```typescript
describe('Google Ads Integration E2E', () => {
  it('should sync campaign data from API to database', async () => {
    // 1. Create test data source
    const dataSourceId = await createTestDataSource();
    
    // 2. Trigger sync
    const result = await GoogleAdsDriver.getInstance().syncToDatabase(
      dataSourceId,
      testConnectionDetails
    );
    
    // 3. Verify data in database
    const rows = await queryDatabase(`
      SELECT COUNT(*) FROM dra_google_ads.campaigns_${dataSourceId}
    `);
    
    expect(result).toBe(true);
    expect(rows[0].count).toBeGreaterThan(0);
  });
});
```

---

## Related Documentation

- [Google Ads User Guide](./GA_USER_GUIDE.md) - End-user documentation
- [Google Ads API Integration Guide](./GA_API_INTEGRATION_GUIDE.md) - API reference
- [Google Ads Report Types Reference](./GA_REPORT_TYPES_REFERENCE.md) - Schema documentation
- [Google Ads TypeScript Types](./GA_TYPES_REFERENCE.md) - Type definitions

### External Resources

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [Google Ads Query Language (GAQL)](https://developers.google.com/google-ads/api/docs/query/overview)
- [OAuth 2.0 for Google APIs](https://developers.google.com/identity/protocols/oauth2)
