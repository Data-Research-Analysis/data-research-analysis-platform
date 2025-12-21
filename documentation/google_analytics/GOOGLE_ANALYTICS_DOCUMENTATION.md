# Google Analytics Data Source - Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Data Flow](#data-flow)
4. [Key Components](#key-components)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Common Modifications](#common-modifications)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vue 3 + Nuxt)                 │
├─────────────────────────────────────────────────────────────────┤
│  Connection Page  →  useGoogleAnalytics  →  Data Source Store  │
│  (google-analytics.vue)      (Composable)                       │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP Requests
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                │
├─────────────────────────────────────────────────────────────────┤
│  Routes  →  DataSourceProcessor  →  GoogleAnalyticsDriver      │
│           →  GoogleAnalyticsService (Google API Client)         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              Google Analytics 4 API (Google Cloud)              │
│  OAuth 2.0  | GA4 Properties  | Data API (Reports)             │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                         │
│  Schema: dra_google_analytics                                   │
│  Tables: traffic_overview, page_performance, events, etc.       │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack
- **Frontend**: Vue 3, Nuxt 3, TypeScript, Composables
- **Backend**: Node.js, Express, TypeScript, TypeORM
- **Google APIs**: Google Analytics Data API (GA4), OAuth 2.0
- **Database**: PostgreSQL
- **Authentication**: JWT + Google OAuth 2.0

---

## File Structure

### Frontend Files

```
frontend/
├── pages/projects/[projectid]/data-sources/connect/
│   └── google-analytics.vue           # 3-step connection wizard
├── composables/
│   ├── useGoogleAnalytics.ts          # GA operations composable
│   └── useGoogleOAuth.ts              # OAuth operations
├── stores/
│   └── data_sources.ts                # Data source state management
└── types/
    └── IGoogleAnalytics.ts            # TypeScript interfaces
```

### Backend Files

```
backend/src/
├── routes/
│   ├── google_analytics.ts            # API routes
│   └── oauth.ts                       # OAuth callback handling
├── services/
│   ├── GoogleAnalyticsService.ts      # GA4 API client
│   └── GoogleOAuthService.ts          # OAuth service
├── drivers/
│   └── GoogleAnalyticsDriver.ts       # Data sync logic
├── processors/
│   └── DataSourceProcessor.ts         # Business logic layer
└── migrations/
    └── 1733788800000-AddGoogleAnalyticsDataSource.ts
```

---

## Data Flow

### 1. Authentication Flow

```
User clicks "Sign in with Google"
              ↓
Frontend: useGoogleOAuth.initiateAuth(projectId)
              ↓
Backend: /api/oauth/initiate (POST)
              ↓
Google OAuth consent screen (Analytics read scopes)
              ↓
User approves → Google redirects to /oauth/callback
              ↓
Backend: Exchanges auth code for tokens
              ↓
Frontend: Stores tokens in session
              ↓
Step 2: Load properties
```

### 2. Property Selection & Configuration Flow

```
Frontend: useGoogleAnalytics.listProperties(accessToken)
              ↓
Backend: /api/google-analytics/properties (POST)
              ↓
GoogleAnalyticsService.listProperties()
              ↓
Returns: IGoogleAnalyticsProperty[] {name, displayName}
              ↓
User selects property + configures sync frequency
              ↓
Frontend: useGoogleAnalytics.addDataSource(config)
              ↓
Backend: /api/google-analytics/add-data-source (POST)
              ↓
DataSourceProcessor.addGoogleAnalyticsDataSource()
              ↓
Creates hybrid connection details + saves to database
```

### 3. Data Sync Flow

```
Manual: User clicks "Sync Now" button
Auto: Scheduled job triggers (hourly/daily/weekly)
              ↓
Frontend/Scheduler: useGoogleAnalytics.syncNow(dataSourceId)
              ↓
Backend: /api/google-analytics/sync/:dataSourceId (POST)
              ↓
DataSourceProcessor.syncGoogleAnalyticsDataSource()
              ↓
GoogleAnalyticsDriver.syncToDatabase()
              ↓
FOR EACH report type (6 reports total):
    GoogleAnalyticsService.runReport()
              ↓
    Transform rows to tabular format
              ↓
    Insert into respective table → PostgreSQL
              ↓
Update last_sync timestamp in database
```

### 4. Data Retrieval Flow

```
User queries data via SQL editor
              ↓
Query executed on dra_google_analytics schema
              ↓
Tables: traffic_overview, page_performance, user_acquisition,
        geographic, device_data, events
              ↓
Data displayed in analysis interface
```

---

## Key Components

### Frontend Components

#### 1. **google-analytics.vue** (Connection Wizard)
**Location**: `frontend/pages/projects/[projectid]/data-sources/connect/google-analytics.vue`

**Role**: 3-step wizard for connecting Google Analytics (simpler than GAM)

**Steps**:
1. **Authentication** - Google Sign-In
2. **Property Selection** - Choose GA4 property
3. **Configuration** - Name data source, select sync frequency

**Key State**:
```typescript
{
    currentStep: 1-3,
    accessToken: string,
    refreshToken: string,
    properties: IGoogleAnalyticsProperty[],
    selectedProperty: IGoogleAnalyticsProperty,
    dataSourceName: string,
    syncFrequency: 'hourly' | 'daily' | 'weekly' | 'manual'
}
```

**Key Functions**:
- `initiateGoogleSignIn()` - Start OAuth flow
- `loadProperties()` - Fetch available GA4 properties
- `selectProperty()` - Choose property
- `connectAndSync()` - Final connection + initial sync

**Differences from GAM**:
- ✅ No report type selection (syncs all 6 reports automatically)
- ✅ No date range selection (always syncs last 30 days)
- ✅ Simpler configuration (just name + frequency)

#### 2. **useGoogleAnalytics.ts** (Composable)
**Location**: `frontend/composables/useGoogleAnalytics.ts`

**Role**: Encapsulates all GA-related frontend operations

**Exported Functions**:

| Function | Purpose | Returns |
|----------|---------|---------|
| `listProperties(accessToken)` | Get accessible GA4 properties | `IGoogleAnalyticsProperty[]` |
| `getReportPresets()` | Get available report configurations | `Record<string, IReportPreset>` |
| `addDataSource(config)` | Create new GA data source | `boolean` |
| `syncNow(dataSourceId)` | Trigger manual sync | `boolean` |
| `getSyncStatus(dataSourceId)` | Get sync status/history | `IGoogleAnalyticsSyncStatus` |
| `formatSyncTime(timestamp)` | Format last sync time | `string` |
| `getSyncFrequencyText(frequency)` | Get frequency display text | `string` |

**Usage Example**:
```typescript
const analytics = useGoogleAnalytics();

// List properties
const properties = await analytics.listProperties(accessToken);

// Add data source
const config = {
    name: 'My Website Analytics',
    property_id: 'properties/123456789',
    access_token: 'ya29...',
    refresh_token: '1//...',
    token_expiry: '2024-12-20T00:00:00Z',
    project_id: 7,
    sync_frequency: 'daily',
    account_name: 'My Website'
};
const success = await analytics.addDataSource(config);

// Trigger sync
const syncSuccess = await analytics.syncNow(dataSourceId);
```

**Report Presets** (Hardcoded):
```typescript
{
    traffic_overview: {
        dimensions: ['date', 'sessionSource', 'sessionMedium'],
        metrics: ['sessions', 'totalUsers', 'newUsers', ...]
    },
    user_acquisition: { ... },
    page_performance: { ... },
    geographic: { ... },
    device: { ... },
    events: { ... }
}
```

---

### Backend Components

#### 3. **GoogleAnalyticsService.ts** (Google API Client)
**Location**: `backend/src/services/GoogleAnalyticsService.ts`

**Role**: Handles all communication with Google Analytics Data API (GA4)

**Key Methods**:

| Method | Purpose | Parameters |
|--------|---------|------------|
| `listProperties(accessToken)` | Get list of accessible GA4 properties | access token |
| `getMetadata(propertyId, connectionDetails)` | Get available dimensions & metrics | property_id, connection |
| `runReport(propertyId, connectionDetails, dimensions, metrics, dateRanges)` | Execute GA4 report | property_id, dimensions, metrics, dates |
| `transformReportToRows(response)` | Convert API response to tabular format | API response |
| `getReportPresets()` | Get predefined report configurations | none |

**GA4 Data API**:
- Uses `googleapis` library (`google.analyticsdata('v1beta')`)
- Report generation is **instant** (no async wait like GAM)
- Supports 10,000+ rows per report
- Automatic pagination for large datasets

**Date Range Format**:
```typescript
[
    { startDate: '30daysAgo', endDate: 'today' }
]
// Or specific dates:
[
    { startDate: '2024-01-01', endDate: '2024-01-31' }
]
```

#### 4. **GoogleAnalyticsDriver.ts** (Data Sync Driver)
**Location**: `backend/src/drivers/GoogleAnalyticsDriver.ts`

**Role**: Syncs data from GA4 API to PostgreSQL

**Key Methods**:

| Method | Purpose |
|--------|---------|
| `syncToDatabase()` | Main sync orchestration method |
| `syncTrafficOverview()` | Sync traffic data (sessions, users, pageviews) |
| `syncPagePerformance()` | Sync page-level metrics |
| `syncUserAcquisition()` | Sync acquisition channels |
| `syncGeographic()` | Sync country/city data |
| `syncDeviceData()` | Sync device & browser data |
| `syncEvents()` | Sync custom events |
| `updateLastSyncTime()` | Update last_sync timestamp |

**Sync Process**:
1. Create schema `dra_google_analytics` if not exists
2. Create 6 report tables if not exist
3. For each report type:
   - Build dimensions & metrics arrays
   - Call `GoogleAnalyticsService.runReport()`
   - Transform response to row format
   - Bulk insert into table (TRUNCATE then INSERT)
4. Update last_sync timestamp
5. Return success

**Important**: Unlike GAM, GA sync uses **TRUNCATE + INSERT** strategy instead of upsert. This ensures data consistency and avoids duplicates.

#### 5. **DataSourceProcessor.ts** (Business Logic)
**Location**: `backend/src/processors/DataSourceProcessor.ts`

**Role**: Orchestrates data source creation and sync operations

**Key Methods**:

```typescript
addGoogleAnalyticsDataSource(
    name: string,
    connectionDetails: IAPIConnectionDetails,
    tokenDetails: ITokenDetails,
    projectId: number
): Promise<number | null>
```
- Creates schema `dra_google_analytics`
- Saves data source with **hybrid connection details**
- Returns data source ID

```typescript
syncGoogleAnalyticsDataSource(
    dataSourceId: number,
    tokenDetails: ITokenDetails  
): Promise<boolean>
```
- Validates data source
- Extracts API connection details
- Delegates to GoogleAnalyticsDriver
- Updates last_sync timestamp
- Returns success status

**Hybrid Connection Structure** (Same as GAM):
```typescript
{
    data_source_type: 'google_analytics',
    host: 'localhost',               // PostgreSQL host
    port: 5432,                      // PostgreSQL port
    schema: 'dra_google_analytics',  // Schema name
    database: 'dra_db',              // Database name
    username: 'dra_user',            // DB username
    password: 'password',            // DB password
    api_connection_details: {        // GA API details
        api_config: {
            property_id: 'properties/123456789',
            account_name: 'My Website',
            sync_frequency: 'daily',
            last_sync: Date,         // ← IMPORTANT for sync status
        },
        access_token: 'ya29...',
        refresh_token: '1//...',
        token_expiry: Date
    }
}
```

---

## API Endpoints

### 1. **List Properties**
```http
POST /api/google-analytics/properties
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
    "access_token": "ya29..."
}

Response:
{
    "properties": [
        {
            "name": "properties/123456789",
            "displayName": "My Website"
        }
    ]
}
```

### 2. **Get Metadata**
```http
GET /api/google-analytics/metadata/:propertyId
Authorization: Bearer <JWT_TOKEN>

Response:
{
    "dimensions": [{name: "date", ...}, {name: "country", ...}],
    "metrics": [{name: "sessions", ...}, {name: "totalUsers", ...}]
}
```

### 3. **Get Report Presets**
```http
GET /api/google-analytics/report-presets
Authorization: Bearer <JWT_TOKEN>

Response:
{
    "traffic_overview": {
        "name": "Traffic Overview",
        "dimensions": ["date", "sessionSource", "sessionMedium"],
        "metrics": ["sessions", "totalUsers", "newUsers", ...]
    },
    ...
}
```

### 4. **Add Data Source**
```http
POST /api/google-analytics/add-data-source
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
    "name": "My Website Analytics",
    "property_id": "properties/123456789",
    "access_token": "ya29...",
    "refresh_token": "1//...",
    "token_expiry": "2024-12-20T00:00:00Z",
    "project_id": 7,
    "sync_frequency": "daily",
    "account_name": "My Website"
}

Response:
{
    "success": true,
    "data_source_id": 42,
    "message": "Google Analytics data source added successfully"
}
```

### 5. **Sync Data**
```http
POST /api/google-analytics/sync/:dataSourceId
Authorization: Bearer <JWT_TOKEN>

Response:
{
    "success": true,
    "message": "Sync completed successfully"
}
```

### 6. **Get Sync Status**
```http
GET /api/google-analytics/sync-status/:dataSourceId
Authorization: Bearer <JWT_TOKEN>

Response:
{
    "last_sync": "2024-01-20T14:30:00Z",
    "sync_frequency": "daily",
    "history": [...]
}
```

---

## Database Schema

### Schema Name
`dra_google_analytics`

### Tables Created

#### 1. Traffic Overview (`<dataSourceId>_traffic_overview`)
```sql
CREATE TABLE dra_google_analytics."42_traffic_overview" (
    id SERIAL PRIMARY KEY,
    date DATE,
    session_source VARCHAR(255),
    session_medium VARCHAR(255),
    sessions BIGINT,
    total_users BIGINT,
    new_users BIGINT,
    screen_page_views BIGINT,
    average_session_duration DECIMAL(10,2),
    bounce_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Page Performance (`<dataSourceId>_page_performance`)
```sql
CREATE TABLE dra_google_analytics."42_page_performance" (
    id SERIAL PRIMARY KEY,
    page_path VARCHAR(1024),
    page_title VARCHAR(512),
    screen_page_views BIGINT,
    average_session_duration DECIMAL(10,2),
    bounce_rate DECIMAL(5,2),
    exit_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. User Acquisition (`<dataSourceId>_user_acquisition`)
```sql
CREATE TABLE dra_google_analytics."42_user_acquisition" (
    id SERIAL PRIMARY KEY,
    date DATE,
    first_user_source VARCHAR(255),
    first_user_medium VARCHAR(255),
    first_user_campaign VARCHAR(255),
    new_users BIGINT,
    sessions BIGINT,
    engagement_rate DECIMAL(5,2),
    conversions BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Geographic (`<dataSourceId>_geographic`)
```sql
CREATE TABLE dra_google_analytics."42_geographic" (
    id SERIAL PRIMARY KEY,
    country VARCHAR(255),
    city VARCHAR(255),
    total_users BIGINT,
    sessions BIGINT,
    screen_page_views BIGINT,
    average_session_duration DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. Device Data (`<dataSourceId>_device_data`)
```sql
CREATE TABLE dra_google_analytics."42_device_data" (
    id SERIAL PRIMARY KEY,
    device_category VARCHAR(100),
    operating_system VARCHAR(100),
    browser VARCHAR(100),
    total_users BIGINT,
    sessions BIGINT,
    screen_page_views BIGINT,
    bounce_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 6. Events (`<dataSourceId>_events`)
```sql
CREATE TABLE dra_google_analytics."42_events" (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(255),
    date DATE,
    event_count BIGINT,
    event_value DECIMAL(15,2),
    conversions BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Data Strategy
- **TRUNCATE + INSERT**: Each sync clears and refreshes data
- **No duplicates**: TRUNCATE ensures clean slate
- **Historical syncs**: Override date range in driver to sync historical data
- **Table naming**: `<dataSourceId>_<reportType>` for multi-tenant support

---

## Common Modifications

### 1. Add a New Report Type

**Step 1**: Update Frontend Preset
```typescript
// frontend/composables/useGoogleAnalytics.ts
const getReportPresets = (): Record<string, IReportPreset> => {
    return {
        // existing reports...
        custom_conversions: {
            name: 'Custom Conversions',
            dimensions: ['date', 'eventName'],
            metrics: ['conversions', 'totalRevenue']
        }
    };
};
```

**Step 2**: Add Backend Sync Method
```typescript
// backend/src/drivers/GoogleAnalyticsDriver.ts
async syncCustomConversions(
    manager: any,
    schemaName: string,
    dataSourceId: number,
    propertyId: string,
    connectionDetails: IAPIConnectionDetails
): Promise<void> {
    const tableName = `${schemaName}."${dataSourceId}_custom_conversions"`;
    
    // Create table
    await manager.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
            id SERIAL PRIMARY KEY,
            date DATE,
            event_name VARCHAR(255),
            conversions BIGINT,
            total_revenue DECIMAL(15,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Run report
    const reportData = await this.gaService.runReport(
        propertyId,
        connectionDetails,
        ['date', 'eventName'],
        ['conversions', 'totalRevenue'],
        [{ startDate: '30daysAgo', endDate: 'today' }]
    );
    
    // Transform and insert
    const rows = this.gaService.transformReportToRows(reportData);
    await manager.query(`TRUNCATE TABLE ${tableName}`);
    
    for (const row of rows) {
        await manager.query(`
            INSERT INTO ${tableName}
            (date, event_name, conversions, total_revenue)
            VALUES ($1, $2, $3, $4)
        `, [row.date, row.eventName, row.conversions, row.totalRevenue]);
    }
}
```

**Step 3**: Register in Main Sync
```typescript
// backend/src/drivers/GoogleAnalyticsDriver.ts
async syncToDatabase(...) {
    // ... existing syncs
    await this.syncCustomConversions(manager, schemaName, dataSourceId, propertyId, connectionDetails);
}
```

### 2. Change Date Range for Sync

**Modify in Driver**:
```typescript
// backend/src/drivers/GoogleAnalyticsDriver.ts
async syncTrafficOverview(...) {
    const reportData = await this.gaService.runReport(
        propertyId,
        connectionDetails,
        ['date', 'sessionSource', 'sessionMedium'],
        ['sessions', 'totalUsers', ...],
        [{ startDate: '90daysAgo', endDate: 'today' }] // ← Change from 30 to 90 days
    );
}
```

Apply same change to all 6 sync methods.

### 3. Add Sync Frequency Option

**Frontend**:
```vue
<!-- frontend/pages/projects/[projectid]/data-sources/connect/google-analytics.vue -->
<select v-model="state.syncFrequency">
    <option value="manual">Manual</option>
    <option value="hourly">Hourly</option>
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option> <!-- ← Add -->
</select>
```

**Backend Validation**:
```typescript
// backend/src/routes/google_analytics.ts
body('sync_frequency').optional().isIn(['hourly', 'daily', 'weekly', 'monthly', 'manual'])
```

### 4. Customize Dimensions/Metrics

**Example**: Add UTM parameters to traffic overview

```typescript
// backend/src/drivers/GoogleAnalyticsDriver.ts
async syncTrafficOverview(...) {
    const reportData = await this.gaService.runReport(
        propertyId,
        connectionDetails,
        [
            'date',
            'sessionSource',
            'sessionMedium',
            'sessionCampaignName',  // ← Add
            'sessionCampaignId'     // ← Add
        ],
        ['sessions', 'totalUsers', ...],
        [{ startDate: '30daysAgo', endDate: 'today' }]
    );
    
    // Update table schema to include new columns
    await manager.query(`
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS session_campaign_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS session_campaign_id VARCHAR(255)
    `);
}
```

---

## Troubleshooting

### Common Issues

#### 1. **"Properties not loading"**

**Symptoms**: Empty properties list after authentication

**Causes**:
- Insufficient OAuth scopes
- No GA4 properties in account
- Using old Universal Analytics (deprecated)

**Fix**:
```typescript
// frontend/composables/useGoogleOAuth.ts
// Ensure correct scopes for Analytics
const SCOPES = [
    'https://www.googleapis.com/auth/analytics.readonly', // ← Required for GA4
    'https://www.googleapis.com/auth/userinfo.email'
];
```

**Check**: Verify user has GA4 properties at https://analytics.google.com

#### 2. **"Sync works but no data in tables"**

**Symptoms**: Sync completes successfully but tables are empty

**Debug Steps**:
1. Check if property has recent data
2. Verify date range matches data availability
3. Check backend logs for API errors

**Common Causes**:
- GA4 property is new (< 24 hours of data)
- Date range outside available data
- Reporting API not enabled

**Fix**: Adjust date range or wait for data to accumulate

#### 3. **"Missing dimensions/metrics errors"**

**Symptoms**: Sync fails with "Unknown dimension" or "Unknown metric" error

**Cause**: GA4 API doesn't support requested dimension/metric

**Fix**: Check available dimensions/metrics:
```http
GET /api/google-analytics/metadata/:propertyId
```

Or visit: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema

#### 4. **"Token expired" errors**

**Symptoms**: Sync works initially, fails after some time

**Cause**: Refresh token not being used properly

**Fix**: Verify token refresh in `GoogleOAuthService.ts`:
```typescript
// Should automatically refresh when access token expires
const client = this.getAuthenticatedClient(connectionDetails);
// This handles token refresh internally via googleapis
```

#### 5. **"Quota exceeded" errors**

**Symptoms**: Sync fails with "quota" or "rate limit" error

**Cause**: Google Analytics API has daily quotas

**Limits**:
- 25,000 API requests per day (per project)
- 10 concurrent requests

**Fix**:
- Reduce sync frequency
- Optimize reports (fewer dimensions/metrics)
- Request quota increase from Google Cloud Console

#### 6. **"Duplicate tables" warning**

**Symptoms**: Multiple tables for same data source

**Cause**: Table naming collision

**Explanation**: Tables are named `<dataSourceId>_<reportType>`, so each data source ID gets unique tables. This is expected behavior.

**Not an issue** unless you have orphaned tables from deleted data sources.

**Cleanup**:
```sql
-- Find orphaned tables
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'dra_google_analytics';

-- Drop specific table
DROP TABLE dra_google_analytics."42_traffic_overview";
```

---

## Quick Reference

### Key File Paths (for easy navigation)

**Frontend**:
- Connection Wizard: `frontend/pages/projects/[projectid]/data-sources/connect/google-analytics.vue`
- Composable: `frontend/composables/useGoogleAnalytics.ts`
- Types: `frontend/types/IGoogleAnalytics.ts`

**Backend**:
- Routes: `backend/src/routes/google_analytics.ts`
- Service: `backend/src/services/GoogleAnalyticsService.ts`
- Driver: `backend/src/drivers/GoogleAnalyticsDriver.ts`
- Processor: `backend/src/processors/DataSourceProcessor.ts`

### Data Flow Summary

```
User Action → Frontend Composable → Backend Route → 
DataSourceProcessor → GoogleAnalyticsDriver → 
GoogleAnalyticsService → Google GA4 API → 
PostgreSQL (dra_google_analytics schema)
```

### Critical Code Locations

**Sync Status Display** (Same fix pattern as GAM):
```javascript
// frontend/pages/projects/[projectid]/index.vue
const lastSync = dataSource.connection_details?.api_connection_details?.api_config?.last_sync;
```

**Add Data Source**:
```typescript
// backend/src/processors/DataSourceProcessor.ts:1945
addGoogleAnalyticsDataSource()
```

**Trigger Sync**:
```typescript
// backend/src/processors/DataSourceProcessor.ts:2010
syncGoogleAnalyticsDataSource()
```

### Report Types (6 Total)

1. **Traffic Overview** - Sessions, users, sources
2. **Page Performance** - Page views, bounce rates
3. **User Acquisition** - New users by channel
4. **Geographic** - Users by country/city
5. **Device Data** - Device categories, browsers, OS
6. **Events** - Custom event tracking

---

## GA vs GAM Comparison

| Feature | Google Analytics | Google Ad Manager |
|---------|------------------|-------------------|
| **Steps** | 3 (Auth, Property, Config) | 4 (Auth, Network, Config, Confirm) |
| **Report Selection** | ❌ No (all 6 reports auto-synced) | ✅ Yes (user selects reports) |
| **Date Range** | ❌ No (fixed 30 days) | ✅ Yes (user customizable) |
| **API** | GA4 Data API (instant) | Ad Manager API (async jobs) |
| **Data Strategy** | TRUNCATE + INSERT | UPSERT (conflict resolution) |
| **Schema** | `dra_google_analytics` | `dra_google_ad_manager` |
| **Complexity** | 🟢 Simple | 🟡 Moderate |

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-20  
**Maintainer**: Data Research Analysis Team
