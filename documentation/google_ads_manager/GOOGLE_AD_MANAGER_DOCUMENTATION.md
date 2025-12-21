# Google Ad Manager Data Source - Technical Documentation

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
│  Connection Page  →  useGoogleAdManager  →  Data Source Store  │
│  (google-ad-manager.vue)     (Composable)                       │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP Requests
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                │
├─────────────────────────────────────────────────────────────────┤
│  Routes  →  DataSourceProcessor  →  GoogleAdManagerDriver      │
│           →  GoogleAdManagerService (Google API Client)         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              Google Ad Manager API (Google Cloud)               │
│  OAuth 2.0  | Ad Manager Networks  | Report Generation         │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                         │
│  Schema: dra_google_ad_manager                                  │
│  Tables: revenue, geography, etc.                               │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack
- **Frontend**: Vue 3, Nuxt 3, TypeScript, Composables
- **Backend**: Node.js, Express, TypeScript, TypeORM
- **Google APIs**: Google Ad Manager API, OAuth 2.0
- **Database**: PostgreSQL
- **Authentication**: JWT + Google OAuth 2.0

---

## File Structure

### Frontend Files

```
frontend/
├── pages/projects/[projectid]/data-sources/connect/
│   └── google-ad-manager.vue          # 4-step connection wizard
├── composables/
│   ├── useGoogleAdManager.ts          # GAM operations composable
│   └── useGoogleOAuth.ts              # OAuth operations
├── stores/
│   └── data_sources.ts                # Data source state management
└── types/
    └── IGoogleAdManager.ts            # TypeScript interfaces
```

### Backend Files

```
backend/src/
├── routes/
│   ├── google_ad_manager.ts           # API routes
│   ├── oauth.ts                       # OAuth callback handling
│   └── googleAdManagerRateLimit.ts    # Rate limiting config
├── services/
│   ├── GoogleAdManagerService.ts      # GAM API client
│   └── GoogleOAuthService.ts          # OAuth service
├── drivers/
│   └── GoogleAdManagerDriver.ts       # Data sync logic
├── processors/
│   └── DataSourceProcessor.ts         # Business logic layer
└── migrations/
    └── 1765698670655-AddGoogleAdManagerDataSource.ts
```

---

## Data Flow

### 1. Authentication Flow

```
User clicks "Sign in with Google"
              ↓
Frontend: useGoogleOAuth.initiateAuth('ad_manager')
              ↓
Backend: /api/oauth/initiate (POST)
              ↓
Google OAuth consent screen
              ↓
User approves → Google redirects to /oauth/callback
              ↓
Backend: Exchanges auth code for tokens
              ↓
Frontend: Stores tokens in session
              ↓
Step 2: Load networks
```

### 2. Network Selection & Configuration Flow

```
Frontend: useGoogleAdManager.listNetworks(accessToken)
              ↓
Backend: /api/google-ad-manager/networks (POST)
              ↓
GoogleAdManagerService.listNetworks()
              ↓
Returns: IGAMNetwork[] {networkCode, networkId, displayName}
              ↓
User selects network + configures reports/dates
              ↓
Frontend: useGoogleAdManager.addDataSource(config)
              ↓
Backend: /api/google-ad-manager/add-data-source (POST)
              ↓
DataSourceProcessor.addGoogleAdManagerDataSource()
              ↓
Creates hybrid connection details + saves to database
```

### 3. Data Sync Flow

```
Manual: User clicks "Sync Now" button
Auto: Scheduled job triggers (hourly/daily/weekly)
              ↓
Frontend/Scheduler: useGoogleAdManager.syncNow(dataSourceId)
              ↓
Backend: /api/google-ad-manager/sync/:dataSourceId (POST)
              ↓
DataSourceProcessor.syncGoogleAdManagerDataSource()
              ↓
GoogleAdManagerDriver.syncToDatabase()
              ↓
FOR EACH report type (revenue, geography):
    GoogleAdManagerService.buildReportQuery()
              ↓
    GoogleAdManagerService.runReport()
              ↓
    GoogleAdManagerDriver.transformData()
              ↓
    GoogleAdManagerDriver.bulkUpsert() → PostgreSQL
              ↓
Update last_sync timestamp in database
```

### 4. Data Retrieval Flow

```
User queries data via SQL editor
              ↓
Query executed on dra_google_ad_manager schema
              ↓
Tables: revenue, geography (with networkCode prefix)
              ↓
Data displayed in analysis interface
```

---

## Key Components

### Frontend Components

#### 1. **google-ad-manager.vue** (Connection Wizard)
**Location**: `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`

**Role**: 4-step wizard for connecting Google Ad Manager

**Steps**:
1. **Authentication** - Google Sign-In
2. **Network Selection** - Choose Ad Manager network
3. **Configuration** - Select reports, date range, sync frequency
4. **Confirmation** - Review and connect

**Key State**:
```typescript
{
    currentStep: 1-4,
    accessToken: string,
    refreshToken: string,
    networks: IGAMNetwork[],
    selectedNetwork: IGAMNetwork,
    selectedReportTypes: string[],
    dateRange: string,
    syncFrequency: 'daily' | 'weekly' | 'manual'
}
```

**Key Functions**:
- `initiateGoogleSignIn()` - Start OAuth flow
- `loadNetworks()` - Fetch available networks
- `selectNetwork()` - Choose network
- `connect()` - Final connection + initial sync

#### 2. **useGoogleAdManager.ts** (Composable)
**Location**: `frontend/composables/useGoogleAdManager.ts`

**Role**: Encapsulates all GAM-related frontend operations

**Exported Functions**:

| Function | Purpose | Returns |
|----------|---------|---------|
| `listNetworks(accessToken)` | Get accessible GAM networks | `IGAMNetwork[]` |
| `getReportTypes()` | Get available report types | `IGAMReportType[]` |
| `addDataSource(config)` | Create new GAM data source | `number \| null` (ID) |
| `syncNow(dataSourceId)` | Trigger manual sync | `boolean` |
| `getSyncStatus(dataSourceId)` | Get sync status/history | `IGAMSyncStatus` |
| `formatSyncTime(timestamp)` | Format last sync time | `string` |
| `validateDateRange()` | Validate date range | `{isValid, error}` |

**Usage Example**:
```typescript
const gam = useGoogleAdManager();

// List networks
const networks = await gam.listNetworks(accessToken);

// Add data source
const config = {
    name: 'My Ad Network',
    network_code: '12345',
    report_types: ['revenue', 'geography'],
    start_date: '2024-01-01',
    end_date: '2024-01-31',
    sync_frequency: 'daily'
};
const dataSourceId = await gam.addDataSource(config);

// Trigger sync
const success = await gam.syncNow(dataSourceId);
```

---

### Backend Components

#### 3. **GoogleAdManagerService.ts** (Google API Client)
**Location**: `backend/src/services/GoogleAdManagerService.ts`

**Role**: Handles all communication with Google Ad Manager API

**Key Methods**:

| Method | Purpose | Parameters |
|--------|---------|------------|
| `listNetworks(accessToken)` | Get list of accessible networks | access token |
| `buildRevenueReportQuery()` | Create revenue report query | network_code, start_date, end_date |
| `buildGeographyReportQuery()` | Create geography report query | network_code, start_date, end_date |
| `runReport(query, connectionDetails)` | Execute report and wait for completion | report query, connection details |

**Report Types Supported**:
1. **Revenue Report**: Impressions, Clicks, Revenue, CPM, CTR by Ad Unit & Country
2. **Geography Report**: Performance by Country, Region, City

**Rate Limiting**:
- Uses `RateLimiter` class
- Configured per-user limits
- Respects Google API quotas

#### 4. **GoogleAdManagerDriver.ts** (Data Sync Driver)
**Location**: `backend/src/drivers/GoogleAdManagerDriver.ts`

**Role**: Syncs data from Google Ad Manager API to PostgreSQL

**Key Methods**:

| Method | Purpose |
|--------|---------|
| `syncToDatabase()` | Main sync orchestration method |
| `syncRevenueData()` | Sync revenue report data |
| `syncGeographyData()` | Sync geography report data |
| `transformRevenueData()` | Transform API response to DB format |
| `validateRevenueData()` | Validate data before insertion |
| `bulkUpsert()` | Bulk insert/update with conflict resolution |

**Sync Process**:
1. Create schema `dra_google_ad_manager` if not exists
2. For each report type:
   - Build report query
   - Run report via GoogleAdManagerService
   - Transform data to PostgreSQL format
   - Validate data integrity
   - Bulk upsert with deduplication
3. Update last_sync timestamp
4. Return sync statistics

**Data Validation**:
- Required fields check
- Numeric validation
- Revenue range validation
- Date format validation

#### 5. **DataSourceProcessor.ts** (Business Logic)
**Location**: `backend/src/processors/DataSourceProcessor.ts`

**Role**: Orchestrates data source creation and sync operations

**Key Methods**:

```typescript
addGoogleAdManagerDataSource(
    name: string,
    connectionDetails: IAPIConnectionDetails,
    tokenDetails: ITokenDetails,
    projectId: number
): Promise<number | null>
```
- Creates schema
- Saves data source with **hybrid connection details**
- Returns data source ID

```typescript
syncGoogleAdManagerDataSource(
    dataSourceId: number,
    tokenDetails: ITokenDetails  
): Promise<boolean>
```
- Validates data source
- Extracts API connection details
- Delegates to GoogleAdManagerDriver
- Updates last_sync timestamp
- Returns success status

**Hybrid Connection Structure**:
```typescript
{
    data_source_type: 'google_ad_manager',
    host: 'localhost',               // PostgreSQL host
    port: 5432,                      // PostgreSQL port
    schema: 'dra_google_ad_manager', // Schema name
    database: 'dra_db',              // Database name
    username: 'dra_user',            // DB username
    password: 'password',            // DB password
    api_connection_details: {        // GAM API details
        api_config: {
            network_code: '12345',
            network_id: '67890',
            network_name: 'My Network',
            report_types: ['revenue', 'geography'],
            start_date: '2024-01-01',
            end_date: '2024-01-31',
            sync_frequency: 'daily',
            last_sync: Date,         // ← IMPORTANT for sync status
            ...
        },
        access_token: 'ya29...',
        refresh_token: '1//...',
        token_expiry: Date
    }
}
```

---

## API Endpoints

### 1. **List Networks**
```http
POST /api/google-ad-manager/networks
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
    "access_token": "ya29..."
}

Response:
{
    "networks": [
        {
            "networkId": "67890",
            "networkCode": "12345",
            "displayName": "My Ad Network",
            "currencyCode": "USD"
        }
    ]
}
```

### 2. **Get Report Types**
```http
GET /api/google-ad-manager/report-types
Authorization: Bearer <JWT_TOKEN>

Response:
{
    "report_types": [
        {
            "id": "revenue",
            "name": "Revenue Report",
            "description": "Ad revenue, impressions, clicks...",
            "dimensions": ["Date", "Ad Unit", "Country"],
            "metrics": ["Impressions", "Clicks", "Revenue", "CPM", "CTR"]
        }
    ]
}
```

### 3. **Add Data Source**
```http
POST /api/google-ad-manager/add-data-source
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
    "name": "My Ad Network Revenue",
    "network_code": "12345",
    "network_id": "67890",
    "network_name": "My Ad Network",
    "report_types": ["revenue", "geography"],
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "access_token": "ya29...",
    "refresh_token": "1//...",
    "token_expiry": "2024-12-20T00:00:00Z",
    "project_id": 7,
    "sync_frequency": "daily"
}

Response:
{
    "success": true,
    "data_source_id": 42,
    "message": "Data source added successfully"
}
```

### 4. **Sync Data**
```http
POST /api/google-ad-manager/sync/:dataSourceId
Authorization: Bearer <JWT_TOKEN>

Response:
{
    "success": true,
    "message": "Sync completed successfully",
    "records_synced": 1250
}
```

### 5. **Get Sync Status**
```http
GET /api/google-ad-manager/sync-status/:dataSourceId
Authorization: Bearer <JWT_TOKEN>

Response:
{
    "last_sync": "2024-01-20T14:30:00Z",
    "sync_frequency": "daily",
    "next_sync": "2024-01-21T02:00:00Z",
    "status": "completed"
}
```

---

## Database Schema

### Schema Name
`dra_google_ad_manager`

### Tables Created

#### 1. Revenue Table (`<networkCode>_revenue`)
```sql
CREATE TABLE dra_google_ad_manager."12345_revenue" (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    ad_unit VARCHAR(255),
    country VARCHAR(100),
    impressions BIGINT,
    clicks BIGINT,
    revenue DECIMAL(15,2),
    cpm DECIMAL(10,2),
    ctr DECIMAL(5,2),
    network_code VARCHAR(50),
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, ad_unit, country, network_code)
);
```

#### 2. Geography Table (`<networkCode>_geography`)
```sql
CREATE TABLE dra_google_ad_manager."12345_geography" (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    country VARCHAR(100),
    region VARCHAR(255),
    city VARCHAR(255),
    impressions BIGINT,
    clicks BIGINT,
    revenue DECIMAL(15,2),
    network_code VARCHAR(50),
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, country, region, city, network_code)
);
```

### Conflict Resolution
- Uses `ON CONFLICT` clause with `UNIQUE` constraints
- Updates existing records on conflict
- Preserves historical data

---

## Common Modifications

### 1. Add a New Report Type

**Step 1**: Update Frontend Type
```typescript
// frontend/types/IGoogleAdManager.ts
export type GAMReportType = 'revenue' | 'geography' | 'inventory'; // ← Add here
```

**Step 2**: Add Report Definition
```typescript
// frontend/composables/useGoogleAdManager.ts
const getReportTypes = (): IGAMReportType[] => {
    return [
        // existing reports...
        {
            id: 'inventory',
            name: 'Inventory Report',
            description: 'Ad inventory availability',
            dimensions: ['Date', 'Ad Unit'],
            metrics: ['Total Impressions', 'Available Impressions']
        }
    ];
};
```

**Step 3**: Add Backend Report Builder
```typescript
// backend/src/services/GoogleAdManagerService.ts
buildInventoryReportQuery(
    networkCode: string,
    startDate: string,
    endDate: string
): IGAMReportQuery {
    return {
        dimensions: ['DATE', 'AD_UNIT_NAME'],
        columns: ['TOTAL_INVENTORY_LEVEL', 'FORECASTED_INVENTORY'],
        // ... rest of query
    };
}
```

**Step 4**: Add Sync Method
```typescript
// backend/src/drivers/GoogleAdManagerDriver.ts
async syncInventoryData(
    manager: any,
    schemaName: string,
    networkCode: string,
    startDate: string,
    endDate: string,
    connectionDetails: IAPIConnectionDetails
): Promise<{recordsSynced: number; recordsFailed: number}> {
    // Build query
    const reportQuery = this.gamService.buildInventoryReportQuery(
        networkCode, startDate, endDate
    );
    
    // Run report
    const reportResponse = await this.gamService.runReport(
        reportQuery, connectionDetails
    );
    
    // Transform and insert
    const transformedData = this.transformInventoryData(reportResponse, networkCode);
    await this.bulkUpsert(manager, `${schemaName}."${networkCode}_inventory"`, transformedData, ['date', 'ad_unit', 'network_code']);
    
    return { recordsSynced: transformedData.length, recordsFailed: 0 };
}
```

**Step 5**: Register in Sync Dispatcher
```typescript
// backend/src/drivers/GoogleAdManagerDriver.ts
async syncReportType(...) {
    switch (service.getReportType(reportTypeString)) {
        case GAMReportType.REVENUE:
            return await this.syncRevenueData(...);
        case GAMReportType.GEOGRAPHY:
            return await this.syncGeographyData(...);
        case GAMReportType.INVENTORY: // ← Add here
            return await this.syncInventoryData(...);
        default:
            throw new Error(`Unknown report type: ${reportTypeString}`);
    }
}
```

### 2. Modify Sync Frequency Options

**Frontend**:
```vue
<!-- frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue -->
<select v-model="state.syncFrequency">
    <option value="manual">Manual</option>
    <option value="hourly">Hourly</option> <!-- ← Add new option -->
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option> <!-- ← Add new option -->
</select>
```

**Backend Validation**:
```typescript
// backend/src/routes/google_ad_manager.ts
body('sync_frequency').optional().isIn(['hourly', 'daily', 'weekly', 'monthly', 'manual'])
```

### 3. Change Date Range Limits

```typescript
// frontend/composables/useGoogleAdManager.ts
const validateDateRange = (startDate: string, endDate: string) => {
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 730) { // ← Change from 365 to 730 (2 years)
        return { isValid: false, error: 'Date range cannot exceed 730 days' };
    }
    
    return { isValid: true };
};
```

### 4. Add Additional Network Information

**Display in UI**:
```vue
<!-- frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue -->
<p>Currency: {{ state.selectedNetwork?.currencyCode }}</p>
<p>Time Zone: {{ state.selectedNetwork?.timeZone }}</p> <!-- ← Add -->
<p>Network Type: {{ state.selectedNetwork?.networkType }}</p> <!-- ← Add -->
```

**Update Interface**:
```typescript
// types/IGoogleAdManager.ts
export interface IGAMNetwork {
    networkId: string;
    networkCode: string;
    displayName: string;
    currencyCode: string;
    timeZone?: string; // ← Add
    networkType?: string; // ← Add
}
```

---

## Troubleshooting

### Common Issues

#### 1. **"Networks not loading"**

**Symptoms**: Empty network list after authentication

**Causes**:
- Invalid OAuth scopes
- Insufficient permissions
- Expired access token

**Fix**:
```typescript
// frontend/composables/useGoogleOAuth.ts
// Ensure correct scopes for Ad Manager
const SCOPES = [
    'https://www.googleapis.com/auth/dfp', // ← Required for GAM
    'https://www.googleapis.com/auth/userinfo.email'
];
```

#### 2. **"Sync fails silently"**

**Symptoms**: Sync button completes but no data in tables

**Debug Steps**:
1. Check backend logs for errors
2. Verify API connection details in database
3. Check rate limiter status:
```typescript
// Backend route to check rate limit
GET /api/google-ad-manager/rate-limit-status
```

**Common Causes**:
- Rate limit exceeded
- Invalid refresh token
- Report generation timeout

#### 3. **"Duplicate data in tables"**

**Symptoms**: Same records appear multiple times

**Cause**: Conflict resolution not working

**Fix**: Verify UNIQUE constraints exist:
```sql
-- Check constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_schema = 'dra_google_ad_manager' 
AND table_name = '12345_revenue';

-- Add if missing
ALTER TABLE dra_google_ad_manager."12345_revenue"
ADD CONSTRAINT unique_revenue_record 
UNIQUE(date, ad_unit, country, network_code);
```

#### 4. **"Token expired" errors**

**Symptoms**: Sync works initially, fails after some time

**Cause**: Refresh token not being used properly

**Fix**: Check token refresh logic in `GoogleOAuthService.ts`:
```typescript
// Should automatically refresh when access token expires
const client = await this.getAuthenticatedClient(connectionDetails);
// This handles token refresh internally
```

#### 5. **"Schema not found"**

**Symptoms**: Query errors when trying to access data

**Cause**: Schema not created during data source setup

**Fix**: Manually create schema:
```sql
CREATE SCHEMA IF NOT EXISTS dra_google_ad_manager;
```

Then re-sync data source.

---

## Quick Reference

### Key File Paths (for easy navigation)

**Frontend**:
- Connection Wizard: `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`
- Composable: `frontend/composables/useGoogleAdManager.ts`
- Types: `frontend/types/IGoogleAdManager.ts`

**Backend**:
- Routes: `backend/src/routes/google_ad_manager.ts`
- Service: `backend/src/services/GoogleAdManagerService.ts`
- Driver: `backend/src/drivers/GoogleAdManagerDriver.ts`
- Processor: `backend/src/processors/DataSourceProcessor.ts`

### Data Flow Summary

```
User Action → Frontend Composable → Backend Route → 
DataSourceProcessor → GoogleAdManagerDriver → 
GoogleAdManagerService → Google API → 
PostgreSQL (dra_google_ad_manager schema)
```

### Critical Code Locations

**Sync Status Display** (After GA fix):
```javascript
// frontend/pages/projects/[projectid]/index.vue
const lastSync = dataSource.connection_details?.api_connection_details?.api_config?.last_sync;
```

**Add Data Source**:
```typescript
// backend/src/processors/DataSourceProcessor.ts:2079
addGoogleAdManagerDataSource()
```

**Trigger Sync**:
```typescript
// backend/src/processors/DataSourceProcessor.ts:2144
syncGoogleAdManagerDataSource()
```

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-20  
**Maintainer**: Data Research Analysis Team
