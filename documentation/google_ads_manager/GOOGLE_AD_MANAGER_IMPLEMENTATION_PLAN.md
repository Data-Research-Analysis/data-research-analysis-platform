# Google Ad Manager Integration - Complete Implementation Plan

> **Implementation Status**: This document describes the Google Ad Manager integration. The **current simplified implementation** focuses on core functionality.
> 
> ## What is Currently Implemented ✅
> - ✅ OAuth 2.0 authentication
> - ✅ Network selection
> - ✅ **2 Report Types**: Revenue and Geography reports only
> - ✅ Date range: Last 30 days (preset)
> - ✅ Sync frequencies: Daily, Weekly, Manual
> - ✅ PostgreSQL storage in `dra_google_ad_manager` schema
> - ✅ AI Data Modeler integration
>
> ## What is NOT Currently Implemented ⏸️
> - ⏸️ Inventory, Orders, Device reports (code exists but not exposed in UI)
> - ⏸️ Advanced sync configuration
> - ⏸️ Hourly sync frequency
> - ⏸️ Custom date ranges
> - ⏸️ Ad unit filtering
>
> ## What is Not Included ❌
> - ❌ Admin dashboard (use AI Data Modeler instead)
> - ❌ Export panel (use platform's standard export)
>
> For detailed current implementation status, see [`CURRENT_IMPLEMENTATION_STATUS.md`](./CURRENT_IMPLEMENTATION_STATUS.md)

---

## Executive Summary

This document outlines the comprehensive implementation plan for integrating Google Ad Manager (GAM) as a data source in the Data Research Analysis Platform. This integration will enable marketing executives to import their advertising performance data, inventory metrics, and revenue analytics directly into the platform for unified analysis and visualization.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Business Value](#business-value)
3. [Technical Architecture](#technical-architecture)
4. [Implementation Phases](#implementation-phases)
5. [API Integration Details](#api-integration-details)
6. [Data Model](#data-model)
7. [Security Considerations](#security-considerations)
8. [Testing Strategy](#testing-strategy)
9. [Timeline & Resources](#timeline--resources)
10. [Success Metrics](#success-metrics)

---

## Feature Overview

### What is Google Ad Manager?

Google Ad Manager is an ad management platform for large publishers who have significant direct sales. It provides granular controls and supports multiple ad exchanges and networks, including Google's AdSense and Ad Exchange.

### Key Capabilities to Integrate

1. **Revenue & Earnings Data**
   - Total earnings by date, ad unit, geography
   - eCPM (effective Cost Per Mille) metrics
   - Fill rate and impression metrics
   - Revenue by advertiser, order, line item

2. **Inventory Performance**
   - Ad unit performance (impressions, clicks, CTR)
   - Inventory availability and utilization
   - Geographic and device breakdown
   - Ad size performance

3. **Order & Line Item Management**
   - Campaign delivery status
   - Pacing and delivery forecasts
   - Creative performance
   - Advertiser/agency analytics

4. **Audience Analytics**
   - User demographics
   - Geographic distribution
   - Device and platform metrics
   - Time-based patterns

---

## Business Value

### For Marketing Executives

1. **Unified Reporting**
   - Consolidate GAM data with Google Analytics, CRM, and other sources
   - Cross-platform revenue attribution
   - Holistic view of digital advertising performance

2. **Data-Driven Optimization**
   - Identify top-performing ad units and placements
   - Optimize pricing strategies based on historical eCPM
   - Improve inventory yield management

3. **Custom Dashboards**
   - Build executive dashboards with AI Data Modeler
   - Create custom KPIs specific to business needs
   - Schedule automated reports

4. **Historical Analysis**
   - Trend analysis over extended periods
   - Year-over-year comparisons
   - Seasonal pattern identification

5. **Strategic Planning**
   - Forecast revenue based on historical data
   - Capacity planning for high-traffic periods
   - Advertiser performance benchmarking

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Nuxt.js/Vue)                    │
├─────────────────────────────────────────────────────────────┤
│  - OAuth Authentication Flow (Google Sign-In)               │
│  - Network & Ad Unit Selection Interface                     │
│  - Report Configuration UI                                   │
│  - Sync Status & Progress Tracking                          │
│  - Data Source Management                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Node.js/Express)               │
├─────────────────────────────────────────────────────────────┤
│  GoogleAdManagerController                                   │
│    - /api/google-ad-manager/networks (list networks)        │
│    - /api/google-ad-manager/ad-units (list ad units)        │
│    - /api/google-ad-manager/reports (get report types)      │
│    - /api/google-ad-manager/add-data-source                 │
│    - /api/google-ad-manager/sync/:dataSourceId              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       Service Layer                          │
├─────────────────────────────────────────────────────────────┤
│  GoogleAdManagerService                                      │
│    - listNetworks()                                          │
│    - getInventory()                                          │
│    - runReport()                                             │
│    - getReportData()                                         │
│                                                              │
│  GoogleOAuthService (Reuse from GA)                         │
│    - OAuth 2.0 flow management                              │
│    - Token refresh handling                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       Driver Layer                           │
├─────────────────────────────────────────────────────────────┤
│  GoogleAdManagerDriver                                       │
│    - authenticate()                                          │
│    - syncToDatabase()                                        │
│    - syncRevenueData()                                       │
│    - syncInventoryMetrics()                                  │
│    - syncOrdersLineItems()                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           PostgreSQL Database (dra_google_ad_manager)        │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│    - revenue_{network_id}                                    │
│    - inventory_{network_id}                                  │
│    - orders_{network_id}                                     │
│    - line_items_{network_id}                                 │
│    - ad_units_{network_id}                                   │
│    - demographics_{network_id}                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation & OAuth (Week 1-2)

**Backend Components:**

1. **Create GoogleAdManagerService** (`backend/src/services/GoogleAdManagerService.ts`)
   ```typescript
   - listNetworks(): List accessible GAM networks
   - getNetworkMetadata(): Get network details and timezone
   - getAdUnits(): Fetch ad unit hierarchy
   - getInventory(): Get inventory structure
   - runReport(): Execute GAM report query
   - getReportData(): Retrieve report results
   ```

2. **Create GoogleAdManagerDriver** (`backend/src/drivers/GoogleAdManagerDriver.ts`)
   ```typescript
   - authenticate(): Verify OAuth credentials
   - syncToDatabase(): Main sync orchestration
   - syncRevenueData(): Sync earnings and eCPM
   - syncInventoryMetrics(): Sync ad unit performance
   - syncOrdersLineItems(): Sync campaign data
   - createOrUpdateTables(): Dynamic table management
   ```

3. **OAuth Configuration**
   - Extend `GoogleOAuthService` to include GAM API scopes:
     - `https://www.googleapis.com/auth/dfp` (Ad Manager API)
   - Update OAuth callback handler to support GAM
   - Add GAM-specific token management

4. **Database Schema**
   - Create migration for `dra_google_ad_manager` schema
   - Add data source type enum: `GOOGLE_AD_MANAGER`
   - Update data source metadata table

**Frontend Components:**

1. **OAuth Flow Page** (`frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`)
   - Step 1: Google Sign-In with GAM permissions
   - Step 2: Network selection (multi-network support)
   - Step 3: Configuration (data source name, sync frequency)
   - Step 4: Confirmation and sync trigger

2. **Composable** (`frontend/composables/useGoogleAdManager.ts`)
   ```typescript
   - listNetworks()
   - getAdUnits()
   - getReportTypes()
   - addDataSource()
   - syncDataSource()
   ```

**Deliverables:**
- ✅ OAuth flow working with GAM API
- ✅ Network listing functional
- ✅ Basic authentication and token management
- ✅ Database schema created

---

### Phase 2: Report Types & Data Sync (Week 3-4)

**Report Definitions:**

1. **Revenue & Earnings Report**
   ```typescript
   dimensions: ['DATE', 'AD_UNIT_NAME', 'COUNTRY_NAME']
   metrics: ['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS', 
             'TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE',
             'TOTAL_LINE_ITEM_LEVEL_ALL_REVENUE']
   ```

2. **Ad Unit Performance Report**
   ```typescript
   dimensions: ['AD_UNIT_NAME', 'DATE', 'DEVICE_CATEGORY_NAME']
   metrics: ['TOTAL_IMPRESSIONS', 'TOTAL_CLICKS', 
             'TOTAL_AD_REQUESTS', 'FILL_RATE']
   ```

3. **Order & Line Item Report**
   ```typescript
   dimensions: ['ORDER_NAME', 'LINE_ITEM_NAME', 'ADVERTISER_NAME', 'DATE']
   metrics: ['LINE_ITEM_IMPRESSIONS', 'LINE_ITEM_CLICKS', 
             'LINE_ITEM_REVENUE', 'LINE_ITEM_COST_PER_UNIT']
   ```

4. **Geographic Performance Report**
   ```typescript
   dimensions: ['COUNTRY_NAME', 'REGION_NAME', 'CITY_NAME', 'DATE']
   metrics: ['IMPRESSIONS', 'REVENUE', 'CLICKS', 'CTR']
   ```

5. **Device & Browser Report**
   ```typescript
   dimensions: ['DEVICE_CATEGORY_NAME', 'BROWSER_NAME', 'DATE']
   metrics: ['IMPRESSIONS', 'REVENUE', 'REQUESTS', 'FILL_RATE']
   ```

**Data Sync Implementation:**

```typescript
// Sync Process Flow
1. Authenticate with GAM API
2. Create schema: dra_google_ad_manager
3. For each selected report type:
   a. Run report query with date range
   b. Poll for report completion
   c. Download report data
   d. Transform to PostgreSQL schema
   e. Create/update table: {report_type}_{network_id}
   f. Bulk insert/upsert data
4. Update last_sync_timestamp
5. Log sync statistics
```

**Table Naming Convention:**
```
dra_google_ad_manager.revenue_{network_id}
dra_google_ad_manager.inventory_{network_id}
dra_google_ad_manager.orders_{network_id}
dra_google_ad_manager.line_items_{network_id}
dra_google_ad_manager.ad_units_{network_id}
dra_google_ad_manager.geography_{network_id}
```

**Deliverables:**
- ✅ All 5 core reports implemented
- ✅ Data transformation pipeline working
- ✅ PostgreSQL sync operational
- ✅ Error handling and retry logic

---

### Phase 3: UI/UX & Configuration (Week 5)

**Frontend Pages:**

1. **Connection Wizard** (`google-ad-manager.vue`)
   ```vue
   <template>
     <div class="gam-connect-wizard">
       <!-- Step 1: Authentication -->
       <div v-if="currentStep === 1">
         <h2>Connect Google Ad Manager</h2>
         <p>Sign in with Google to access your Ad Manager networks</p>
         <button @click="initiateAuth">Sign In with Google</button>
       </div>
       
       <!-- Step 2: Network Selection -->
       <div v-if="currentStep === 2">
         <h2>Select Ad Manager Network</h2>
         <NetworkSelector 
           :networks="networks"
           @select="selectNetwork" />
       </div>
       
       <!-- Step 3: Report Configuration -->
       <div v-if="currentStep === 3">
         <h2>Configure Data Import</h2>
         <input v-model="dataSourceName" placeholder="Data Source Name" />
         <ReportTypeSelector 
           :types="reportTypes"
           v-model="selectedReports" />
         <DateRangePicker v-model="dateRange" />
         <SyncFrequencySelector v-model="syncFrequency" />
       </div>
       
       <!-- Step 4: Confirmation -->
       <div v-if="currentStep === 4">
         <h2>Review & Connect</h2>
         <SummaryCard :config="configuration" />
         <button @click="connectAndSync">Connect & Sync Data</button>
       </div>
     </div>
   </template>
   ```

2. **Data Source Card** (Update existing component)
   - Add Google Ad Manager icon and branding
   - Display network name and ID
   - Show sync status and last sync time
   - Revenue metrics preview (if available)

3. **Sync Settings Page**
   - Configure sync frequency (hourly, daily, weekly, manual)
   - Select specific report types to sync
   - Date range configuration
   - Ad unit filtering options

**Components:**

1. **NetworkSelector.vue**
   - Display list of accessible networks
   - Show network name, ID, and timezone
   - Radio/checkbox selection for single/multiple networks

2. **ReportTypeSelector.vue**
   - Checkbox list of available report types
   - Description of each report
   - Data preview for each type

3. **AdUnitFilter.vue**
   - Tree view of ad unit hierarchy
   - Filter to specific ad units or placements
   - Search functionality

**Deliverables:**
- ✅ Complete connection wizard
- ✅ Configuration interface
- ✅ Management dashboard
- ✅ Responsive design for mobile/tablet

---

### Phase 4: Data Model Integration (Week 6)

**DataModelProcessor Updates:**

Similar to Google Analytics implementation, update column name handling:

```typescript
// Location 1: CREATE TABLE
if (column.schema === 'dra_google_ad_manager' || 
    column.schema === 'dra_google_analytics' || 
    column.schema === 'dra_excel' || 
    column.schema === 'dra_pdf') {
    columnName = `${column.table_name}_${column.column_name}`;
}

// Location 2: Column data types map
// Same logic as Location 1

// Location 3: INSERT row key extraction
// Same logic as Location 1
```

**DataSourceProcessor Updates:**

Extend special schema handling:

```typescript
} else if (column && (
    column.schema === 'dra_excel' || 
    column.schema === 'dra_pdf' || 
    column.schema === 'dra_google_analytics' ||
    column.schema === 'dra_google_ad_manager')) {
    // For special schemas, always use table_name regardless of aliases
    columnName = `${column.table_name}`.length > 20 
        ? `${column.table_name}`.slice(-20) + `_${column.column_name}`
        : `${column.table_name}` + `_${column.column_name}`;
}
```

**AI Data Modeler Integration:**

1. **Schema Recognition**
   - Update schema collector to recognize GAM tables
   - Include GAM-specific metrics in context

2. **Suggested Models**
   - "Revenue by Geography and Device"
   - "Ad Unit Performance Comparison"
   - "Order Delivery & Pacing Analysis"
   - "Advertiser Revenue Breakdown"

3. **Natural Language Examples**
   ```
   "Show me total revenue by country for the last 30 days"
   "Compare ad unit performance across mobile and desktop"
   "Which advertisers generated the most revenue this month?"
   "Show fill rate trends by ad unit over time"
   ```

**Deliverables:**
- ✅ GAM data available in AI Data Modeler
- ✅ Data model creation working
- ✅ Special schema handling implemented
- ✅ Column name generation consistent

---

### Phase 5: Testing & Quality Assurance (Week 7)

**Unit Tests:**

1. **GoogleAdManagerService.unit.test.ts**
   ```typescript
   - Test network listing with mock API
   - Test report query generation
   - Test data transformation logic
   - Test error handling (invalid tokens, API errors)
   ```

2. **GoogleAdManagerDriver.unit.test.ts**
   ```typescript
   - Test authentication flow
   - Test table creation logic
   - Test data insertion with various data types
   - Test schema migration
   ```

3. **DataModelProcessor.unit.test.ts** (Extend existing)
   ```typescript
   - Test GAM column name generation
   - Test special schema handling
   - Test consistency across all 3 locations
   - Test with truncated table names
   ```

**Integration Tests:**

1. **google-ad-manager.integration.test.ts**
   ```typescript
   - Test end-to-end OAuth flow
   - Test network fetching with real API (dev environment)
   - Test report execution and data sync
   - Test data model creation from GAM data
   ```

2. **Rate Limiting Tests**
   ```typescript
   - Test GAM endpoints with rate limiters
   - Verify 429 responses when exceeded
   - Test retry logic with exponential backoff
   ```

**Manual Testing Checklist:**

- [ ] OAuth flow completes successfully
- [ ] Networks load correctly
- [ ] Report configuration saves properly
- [ ] Data sync completes without errors
- [ ] Tables created with correct schema
- [ ] Data visible in data sources list
- [ ] AI Data Modeler recognizes GAM tables
- [ ] Data models create successfully
- [ ] Charts and visualizations display correctly
- [ ] Sync status updates in real-time
- [ ] Error messages are user-friendly
- [ ] Mobile responsiveness verified

**Performance Testing:**

- Test sync with large datasets (1M+ rows)
- Measure sync duration for various date ranges
- Monitor memory usage during sync
- Test concurrent syncs (multiple users)

**Deliverables:**
- ✅ 40+ unit tests (100% pass rate)
- ✅ 10+ integration tests
- ✅ Manual test cases documented
- ✅ Performance benchmarks established

---

### Phase 6: Documentation & Deployment (Week 8)

**User Documentation:**

1. **Getting Started Guide** (`documentation/google-ad-manager-quick-start.md`)
   - Prerequisites (GAM account, network access)
   - Step-by-step connection instructions
   - Screenshots for each step
   - Troubleshooting common issues

2. **Report Types Reference** (`documentation/gam-report-types.md`)
   - Description of each report type
   - Available dimensions and metrics
   - Use cases and examples
   - Data refresh frequency

3. **API Integration Guide** (`documentation/gam-api-integration.md`)
   - OAuth setup instructions
   - API scopes and permissions
   - Rate limits and quotas
   - Error codes and handling

**Developer Documentation:**

1. **Implementation Summary** (`documentation/gam-implementation-summary.md`)
   - Architecture overview
   - Code structure
   - Database schema
   - Testing approach

2. **API Endpoints Reference**
   - Request/response formats
   - Authentication requirements
   - Rate limiting details
   - Example requests

**Deployment:**

1. **Environment Variables**
   ```bash
   # Add to .env
   GOOGLE_AD_MANAGER_ENABLED=true
   GAM_API_VERSION=v202311
   GAM_NETWORK_CODE=<default_network_code>
   ```

2. **Database Migration**
   ```sql
   -- Run migration
   CREATE SCHEMA IF NOT EXISTS dra_google_ad_manager;
   
   -- Update data source types
   ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'google_ad_manager';
   ```

3. **OAuth Credentials**
   - Update Google Cloud Console project
   - Add GAM API to enabled APIs
   - Add scopes to OAuth consent screen
   - Test OAuth flow in production

4. **Monitoring**
   - Set up logging for GAM sync jobs
   - Create alerts for sync failures
   - Monitor API quota usage
   - Track sync performance metrics

**CHANGELOG Update:**

Add entry for GAM integration:
```markdown
## 2025-12-XX

### Added - Google Ad Manager Data Source Integration
**Files:** GoogleAdManagerService, GoogleAdManagerDriver, google-ad-manager.vue, documentation
- **Complete GAM Integration:** OAuth 2.0 authentication with Ad Manager API
- **Revenue Analytics:** Import earnings, eCPM, fill rate, and impression metrics
- **Inventory Management:** Ad unit performance tracking across devices and geographies
- **Order & Line Item Tracking:** Campaign delivery and advertiser analytics
- **Data Storage:** PostgreSQL storage in `dra_google_ad_manager` schema
- **AI Data Modeler Support:** Full integration for custom model creation
- **Report Types:**
  - Revenue & Earnings by date, ad unit, geography
  - Ad Unit Performance (impressions, clicks, CTR, fill rate)
  - Order & Line Item delivery metrics
  - Geographic performance analysis
  - Device & Browser breakdown
- **Features:**
  - Multi-network support
  - Flexible sync frequency (hourly, daily, weekly, manual)
  - Custom date range selection
  - Ad unit filtering
  - Real-time sync status
- **Documentation:** Quick start guide, API reference, report types documentation

### Enhanced - Data Model Builder
**Files:** DataModelProcessor.ts, DataSourceProcessor.ts
- Added `dra_google_ad_manager` to special schema handling
- Consistent column naming: `{table_name}_{column_name}` format
- Maintains backward compatibility with GA, Excel, PDF sources
```

**Deliverables:**
- ✅ Complete documentation package
- ✅ Production deployment ready
- ✅ Monitoring and alerts configured
- ✅ CHANGELOG updated

---

## API Integration Details

### Google Ad Manager API Overview

**API Endpoints Used:**

1. **NetworkService**
   - `getAllNetworks()`: List accessible networks
   - `getCurrentNetwork()`: Get active network details

2. **InventoryService**
   - `getAdUnitsByStatement()`: Fetch ad unit hierarchy
   - `getAdUnitTree()`: Get complete ad unit structure

3. **ReportService**
   - `runReportJob()`: Execute report query
   - `getReportJobStatus()`: Check report completion
   - `getReportDownloadURL()`: Get download link for results

4. **OrderService** (Optional - Phase 2+)
   - `getOrdersByStatement()`: Fetch orders
   - `getLineItemsByStatement()`: Fetch line items

**OAuth Scopes Required:**

```
https://www.googleapis.com/auth/dfp
```

**API Rate Limits:**

- **Reports:** 10 concurrent reports per network
- **API Calls:** 20 queries per second (QPS) per network
- **Daily Quota:** Based on network size (typically 50K-200K requests/day)

**Retry Strategy:**

```typescript
const retryConfig = {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    backoffMultiplier: 2, // Exponential backoff
    retryableErrors: [500, 502, 503, 504, 429]
};
```

---

## Data Model

### Database Schema

**Schema:** `dra_google_ad_manager`

**Table Structure:**

#### 1. Revenue Report Table (`revenue_{network_id}`)

```sql
CREATE TABLE dra_google_ad_manager.revenue_{network_id} (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    ad_unit_name VARCHAR(255),
    ad_unit_id BIGINT,
    country_name VARCHAR(100),
    country_code VARCHAR(10),
    total_impressions BIGINT DEFAULT 0,
    total_clicks BIGINT DEFAULT 0,
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    cpm DECIMAL(10, 4) DEFAULT 0,
    cpc DECIMAL(10, 4) DEFAULT 0,
    ctr DECIMAL(8, 6) DEFAULT 0,
    fill_rate DECIMAL(8, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, ad_unit_id, country_code)
);

CREATE INDEX idx_revenue_date ON revenue_{network_id}(date);
CREATE INDEX idx_revenue_ad_unit ON revenue_{network_id}(ad_unit_id);
CREATE INDEX idx_revenue_country ON revenue_{network_id}(country_code);
```

#### 2. Inventory Report Table (`inventory_{network_id}`)

```sql
CREATE TABLE dra_google_ad_manager.inventory_{network_id} (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    ad_unit_name VARCHAR(255),
    ad_unit_id BIGINT,
    device_category VARCHAR(50),
    ad_requests BIGINT DEFAULT 0,
    matched_requests BIGINT DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    fill_rate DECIMAL(8, 6) DEFAULT 0,
    match_rate DECIMAL(8, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, ad_unit_id, device_category)
);
```

#### 3. Orders/Line Items Table (`orders_{network_id}`)

```sql
CREATE TABLE dra_google_ad_manager.orders_{network_id} (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    order_id BIGINT,
    order_name VARCHAR(255),
    line_item_id BIGINT,
    line_item_name VARCHAR(255),
    advertiser_name VARCHAR(255),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0,
    cost_per_unit DECIMAL(10, 4) DEFAULT 0,
    delivery_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, line_item_id)
);
```

#### 4. Geographic Performance Table (`geography_{network_id}`)

```sql
CREATE TABLE dra_google_ad_manager.geography_{network_id} (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    country_name VARCHAR(100),
    country_code VARCHAR(10),
    region_name VARCHAR(100),
    city_name VARCHAR(100),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0,
    ctr DECIMAL(8, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, country_code, region_name, city_name)
);
```

### Data Source Metadata

```typescript
interface GoogleAdManagerDataSource {
    id: number;
    name: string;
    type: 'google_ad_manager';
    project_id: number;
    created_by: number;
    connection_details: {
        oauth_access_token: string;
        oauth_refresh_token: string;
        token_expiry: Date;
        api_config: {
            network_code: string;
            network_id: string;
            network_name: string;
            selected_reports: string[];
            date_range: {
                start_date: string;
                end_date: string;
            };
            ad_unit_filter?: string[];
        }
    };
    sync_config: {
        frequency: 'hourly' | 'daily' | 'weekly' | 'manual';
        last_sync: Date;
        next_sync: Date;
        auto_sync_enabled: boolean;
    };
}
```

---

## Security Considerations

### Authentication & Authorization

1. **OAuth 2.0 Implementation**
   - Use existing GoogleOAuthService
   - Store tokens encrypted in backend sessions (CWE-312 compliant)
   - No client-side token storage
   - Automatic token refresh before expiry

2. **API Credentials**
   - Google Cloud Project with GAM API enabled
   - OAuth client ID and secret in environment variables
   - Restricted to authorized domains only
   - Production vs. development credentials separation

3. **User Permissions**
   - Verify user has network access before sync
   - Scope JWT tokens to specific projects
   - Audit logging for all GAM operations
   - Rate limiting on GAM endpoints

### Data Protection

1. **Sensitive Data Handling**
   - Encrypt OAuth tokens using AES-256-GCM
   - No revenue data in client-side state
   - Sanitize all user inputs
   - SQL injection prevention (parameterized queries)

2. **Network Security**
   - HTTPS only for all API communications
   - CORS restrictions on frontend
   - API key validation on every request
   - Webhook signature verification (if applicable)

3. **Compliance**
   - GDPR: User data can be deleted on request
   - CCPA: Data export available
   - SOC 2: Audit trails for all operations
   - Privacy policy updated to include GAM data handling

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests:** 90%+ coverage
- **Integration Tests:** Core flows 100% covered
- **E2E Tests:** Critical user journeys
- **Performance Tests:** Load and stress testing

### Test Environments

1. **Development:** Mock GAM API responses
2. **Staging:** Sandbox GAM account
3. **Production:** Real user accounts (opt-in beta)

### Continuous Integration

```yaml
# .github/workflows/gam-tests.yml
name: GAM Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Unit Tests
        run: npm test -- GoogleAdManager
      - name: Run Integration Tests
        run: npm run test:integration -- gam
      - name: Code Coverage
        run: npm run coverage
```

---

## Timeline & Resources

### 8-Week Implementation Plan

| Week | Phase | Tasks | Team |
|------|-------|-------|------|
| 1-2 | Foundation | OAuth, Services, Drivers, Basic UI | 2 Backend, 1 Frontend |
| 3-4 | Reports & Sync | Report types, Data transformation, PostgreSQL sync | 2 Backend |
| 5 | UI/UX | Complete wizard, Configuration, Management | 2 Frontend |
| 6 | Integration | Data Model support, AI integration | 1 Backend, 1 Frontend |
| 7 | Testing | Unit, Integration, E2E, Performance | 1 QA, 1 Backend |
| 8 | Docs & Deploy | Documentation, Deployment, Monitoring | 1 DevOps, 1 Docs |

### Resource Requirements

**Team:**
- 2 Backend Developers (full-time)
- 2 Frontend Developers (full-time)
- 1 QA Engineer (weeks 7-8)
- 1 DevOps Engineer (week 8)
- 1 Technical Writer (week 8)
- 1 Product Manager (oversight)

**Infrastructure:**
- Google Cloud Project with GAM API enabled
- Staging GAM account/network for testing
- Development database instance
- CI/CD pipeline updates

**Third-Party:**
- Google Ad Manager API access
- OAuth 2.0 credentials
- No additional costs (using existing Google Cloud project)

---

## Success Metrics

### Technical Metrics

1. **Reliability**
   - Sync success rate: >99.5%
   - API uptime: 99.9%
   - Average sync duration: <5 minutes for 30 days of data

2. **Performance**
   - OAuth flow completion: <30 seconds
   - Network listing: <2 seconds
   - Report execution: <60 seconds
   - Data model creation: <10 seconds

3. **Quality**
   - Zero critical bugs in production
   - <5 bug reports per week
   - Unit test coverage: >90%
   - Integration test coverage: 100% of critical paths

### Business Metrics

1. **Adoption**
   - 100 users connect GAM in first month
   - 50% of new users explore GAM within first week
   - 80% user satisfaction score

2. **Usage**
   - Average 10 data models created per user
   - Daily sync rate: 70%+ of connected sources
   - Average 5 dashboards using GAM data per user

3. **Value**
   - Reduce manual reporting time by 80%
   - Enable 5+ new use cases not possible before
   - Increase platform engagement by 25%

---

## Risk Assessment & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| GAM API rate limits exceeded | High | Medium | Implement exponential backoff, queue system |
| OAuth token refresh failures | High | Low | Graceful degradation, user notification |
| Large dataset performance issues | Medium | Medium | Pagination, incremental sync, optimization |
| API version deprecation | Medium | Low | Monitor Google announcements, version abstraction |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low user adoption | High | Low | User training, documentation, onboarding flow |
| Support burden | Medium | Medium | Comprehensive docs, troubleshooting guide |
| Competitive feature parity | Low | Low | Unique AI-powered insights, superior UX |

---

## Future Enhancements (Post-Launch)

### Phase 2 Features (3-6 months)

1. **Advanced Reporting**
   - Custom report builder
   - Scheduled report exports
   - Automated anomaly detection

2. **Forecasting & Predictions**
   - Revenue forecasting using historical data
   - Inventory optimization recommendations
   - Seasonal trend predictions

3. **Multi-Network Support**
   - Manage multiple GAM networks simultaneously
   - Cross-network analytics
   - Consolidated reporting

4. **Real-Time Dashboards**
   - WebSocket-based live updates
   - Real-time revenue tracking
   - Alert system for anomalies

5. **Integration Enhancements**
   - Google Analytics + GAM unified view
   - Cross-platform attribution
   - Advertiser performance benchmarking

---

## Appendix

### A. GAM API Reference Links

- [Ad Manager API Guide](https://developers.google.com/ad-manager/api/start)
- [Report Service Documentation](https://developers.google.com/ad-manager/api/reference/v202311/ReportService)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)

### B. Sample API Responses

See separate document: `GAM_API_SAMPLES.md`

### C. Error Codes Reference

See separate document: `GAM_ERROR_CODES.md`

### D. UI/UX Mockups

See Figma: `GAM_Integration_Mockups.fig`

---

## Approval & Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | ___________ | _______ | ___________ |
| Tech Lead | ___________ | _______ | ___________ |
| Engineering Manager | ___________ | _______ | ___________ |
| QA Lead | ___________ | _______ | ___________ |

---

**Document Version:** 1.0  
**Last Updated:** December 14, 2025  
**Author:** AI Implementation Team  
**Status:** Draft - Pending Approval
