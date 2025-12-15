# Google Ad Manager - Sprint 6 Feature 6.1 Summary
## Advanced Sync Configuration

**Status**: 🔄 IN PROGRESS (80% Complete)
**Date**: January 2025
**Sprint**: Sprint 6, Feature 1

---

## Overview

Feature 6.1 introduces advanced sync configuration capabilities for Google Ad Manager, giving users granular control over their data synchronization:

- **Date Range Presets**: 10 built-in presets (today, yesterday, last 7/30/90 days, thisMonth/lastMonth/Quarter/Year, custom)
- **Custom Report Fields**: Select specific dimensions and metrics per report type
- **Dimension Filters**: Filter data by specific dimension values (equals, contains, in, etc.)
- **Metric Filters**: Filter data by metric thresholds (greater than, less than, between, etc.)
- **Sync Frequency**: Manual, hourly, daily, weekly, or monthly scheduling with cron integration
- **Advanced Options**: Incremental sync, deduplication, data validation, max records per report
- **Email Notifications**: Configurable alerts for sync completion and failures

---

## Implementation Details

### Backend Components

#### 1. Advanced Configuration Types (`backend/src/types/IAdvancedSyncConfig.ts`)
**Size**: 462 lines
**Status**: ✅ COMPLETE

**Key Interfaces**:
```typescript
- DateRangePreset: Preset date ranges with dynamic calculation
- ReportFieldConfig: Custom dimension/metric selection per report
- SyncFrequency: Scheduling configuration (manual/hourly/daily/weekly/monthly)
- DimensionFilter: Filter data by dimension values (6 operators)
- MetricFilter: Filter data by metric thresholds (4 operators)
- AdvancedSyncConfig: Complete configuration interface
```

**Constants**:
- `DATE_RANGE_PRESETS`: 10 presets with getDates() functions
- `REPORT_DIMENSIONS`: Available dimensions per report type (5 report types)
- `REPORT_METRICS`: Available metrics per report type (5 report types)

**Validator**:
- `SyncConfigValidator.validate()`: Comprehensive validation logic
- `SyncConfigValidator.getDateRange()`: Extract dates from preset or custom
- `SyncConfigValidator.getCronExpression()`: Convert frequency to cron format

#### 2. API Endpoints (`backend/src/routes/google_ad_manager.ts`)
**Status**: ✅ COMPLETE

**Endpoints Added**:
1. **GET `/api/google-ad-manager/date-presets`**
   - Returns all 10 date range presets with calculated dates
   - Response includes id, label, description, start/end dates
   
2. **GET `/api/google-ad-manager/report-fields`**
   - Returns REPORT_DIMENSIONS and REPORT_METRICS
   - Used for UI field selection dropdowns
   
3. **POST `/api/google-ad-manager/validate-config`**
   - Validates AdvancedSyncConfig
   - Returns validation result with errors array

#### 3. Connection Details Types (`backend/src/types/IAPIConnectionDetails.ts`)
**Status**: ✅ COMPLETE

**Changes**:
- Added `advanced_sync_config?: AdvancedSyncConfig` to api_config
- Imported AdvancedSyncConfig type
- No database migration needed (JSONB column already supports it)

### Frontend Components

#### 1. Advanced Sync Composable (`frontend/composables/useAdvancedSyncConfig.ts`)
**Size**: 339 lines
**Status**: ✅ COMPLETE

**Key Features**:
- `fetchDatePresets()`: Fetch all date range presets from API
- `fetchReportFields()`: Fetch available dimensions and metrics
- `validateConfig()`: Validate configuration using backend validator
- `getDatesForPreset()`: Get dates for a specific preset
- `getDimensionsForReport()`: Get available dimensions for report type
- `getMetricsForReport()`: Get available metrics for report type
- `createDefaultConfig()`: Create default configuration
- `formatFrequency()`: Format frequency for display
- `isValidEmail()`: Email validation helper
- `initialize()`: Load presets and fields on mount

**State Management**:
- `datePresets`: Array of all available presets
- `reportFieldOptions`: Dimensions and metrics per report type
- `isLoading`: Loading state
- `error`: Error message state

#### 2. Advanced Sync Config Component (`frontend/components/AdvancedSyncConfig.vue`)
**Size**: 595 lines
**Status**: ✅ COMPLETE

**UI Sections**:
1. **Collapsible Advanced Config Toggle**
   - Show/hide advanced options
   
2. **Date Range Configuration**
   - Preset selector with 10 options
   - Dynamic date display
   - Custom date inputs when "custom" selected
   
3. **Report Field Configuration**
   - Per-report dimension selection (checkboxes)
   - Per-report metric selection (checkboxes)
   - Formatted field names
   
4. **Sync Frequency Configuration**
   - Type selector (manual/hourly/daily/weekly/monthly)
   - Conditional inputs:
     - Hourly: interval (1-24 hours)
     - Daily: hour and minute
     - Weekly: day of week, hour, minute
     - Monthly: day of month, hour, minute
   - Schedule display with formatFrequency()
   
5. **Sync Options**
   - Incremental sync toggle
   - Deduplication toggle
   - Data validation toggle
   
6. **Max Records Configuration**
   - Number input (100-1,000,000)
   - Helpful description
   
7. **Email Notifications**
   - Notify on completion checkbox
   - Notify on failure checkbox
   - Email list management (add/remove emails)
   - Email validation
   
8. **Validation Errors Display**
   - Real-time validation feedback
   - Error list display

**Two-way Data Binding**:
- Uses v-model pattern with modelValue prop
- Emits update:modelValue on changes
- Watches for parent prop changes (reportTypes)

---

## Pending Work (20% Remaining)

### 1. GoogleAdManagerDriver Integration ⏳
**File**: `backend/src/drivers/GoogleAdManagerDriver.ts`

**Required Changes**:
- Read `advanced_sync_config` from `connectionDetails.api_config`
- Apply date range from preset or custom dates
- Filter dimensions/metrics in report queries
- Apply dimension filters to query
- Apply metric filters to results
- Respect maxRecordsPerReport limit
- Handle incremental sync (query only new data since last sync)

**Pseudo-code**:
```typescript
// In syncReportType method:
const advancedConfig = connectionDetails.api_config?.advanced_sync_config;

// Apply date range
const { startDate, endDate } = this.getDateRangeFromConfig(advancedConfig);

// Get custom fields
const reportFieldConfig = advancedConfig?.reportFieldConfigs?.find(
  c => c.reportType === reportType
);
const dimensions = reportFieldConfig?.dimensions || defaultDimensions;
const metrics = reportFieldConfig?.metrics || defaultMetrics;

// Build query with filters
const query = this.buildQueryWithFilters(
  reportType,
  dimensions,
  metrics,
  advancedConfig?.dimensionFilters,
  advancedConfig?.metricFilters,
  advancedConfig?.maxRecordsPerReport
);

// Execute query and apply metric filters post-query
const results = await this.executeQuery(query);
const filteredResults = this.applyMetricFilters(results, advancedConfig?.metricFilters);
```

### 2. GAM Wizard Integration ⏳
**File**: `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`

**Required Changes**:
- Import AdvancedSyncConfig component
- Add AdvancedSyncConfig component to Step 3 (Configuration)
- Pass selectedReportTypes to AdvancedSyncConfig
- Include advanced config in connection payload when creating data source
- Update state to hold advanced config object

**Pseudo-code**:
```vue
<template>
  <!-- Existing Step 3 content -->
  
  <!-- After basic configuration -->
  <AdvancedSyncConfig
    v-model="state.advancedConfig"
    :report-types="state.selectedReportTypes"
  />
</template>

<script setup lang="ts">
import AdvancedSyncConfig from '~/components/AdvancedSyncConfig.vue';
import { useAdvancedSyncConfig } from '~/composables/useAdvancedSyncConfig';

// Add to state
state.advancedConfig = createDefaultConfig(networkCode);

// Include in connection details
api_config: {
  ...existingConfig,
  advanced_sync_config: state.advancedConfig
}
</script>
```

### 3. Unit Tests ⏳
**Files**:
- `backend/src/types/__tests__/IAdvancedSyncConfig.test.ts` (NEW)
- `backend/src/routes/__tests__/google_ad_manager_advanced.test.ts` (NEW)

**Test Coverage Needed**:
1. **SyncConfigValidator Tests** (~20 tests):
   - ✅ Valid configuration
   - ❌ Missing network code
   - ❌ Invalid date range (start > end)
   - ❌ Empty report types
   - ❌ Invalid report type
   - ❌ Custom date without dates
   - ❌ Invalid dimension filter operator
   - ❌ Invalid metric filter operator
   - ❌ Empty filter values
   - ❌ Invalid email format
   - ❌ Max records out of range
   - ✅ Valid hourly frequency
   - ✅ Valid daily frequency
   - ✅ Valid weekly frequency
   - ✅ Valid monthly frequency
   - ❌ Invalid frequency interval
   - ✅ getDateRange() with preset
   - ✅ getDateRange() with custom dates
   - ✅ getCronExpression() for each frequency type
   
2. **API Endpoint Tests** (~10 tests):
   - ✅ GET /date-presets returns all presets
   - ✅ GET /date-presets calculates dates correctly
   - ✅ GET /report-fields returns dimensions and metrics
   - ✅ POST /validate-config accepts valid config
   - ❌ POST /validate-config rejects invalid config
   - ❌ POST /validate-config returns error details
   - ❌ Authentication required for all endpoints
   
3. **Integration Tests** (~5 tests):
   - ✅ End-to-end config creation and validation
   - ✅ Sync with advanced config
   - ✅ Date preset application
   - ✅ Field filtering in sync
   - ✅ Metric filtering post-query

---

## Statistics

### Code Metrics
- **Backend Files Created**: 1
- **Backend Files Modified**: 2
- **Frontend Files Created**: 2
- **Total Lines of Code**: ~1,400 LOC
  - Backend Types: 462 lines
  - Frontend Composable: 339 lines
  - Frontend Component: 595 lines
  - Type Updates: ~10 lines

### Features Implemented
- ✅ 10 date range presets with dynamic calculation
- ✅ 5 report types with custom dimensions/metrics
- ✅ 6 dimension filter operators
- ✅ 4 metric filter operators
- ✅ 5 sync frequency types (manual, hourly, daily, weekly, monthly)
- ✅ 3 API endpoints for configuration management
- ✅ Comprehensive validation logic
- ✅ Email notification preferences
- ✅ Advanced sync options (incremental, deduplication, validation)

### Dependencies
- No new dependencies added
- Uses existing Vue 3, TypeScript, Express infrastructure
- Future: Will require `node-cron` for scheduling (Feature 6.5)

---

## Usage Examples

### Example 1: Revenue Report with Last 30 Days
```typescript
const config: AdvancedSyncConfig = {
  dateRangePreset: 'last30days',
  reportTypes: ['revenue'],
  networkCode: '123456',
  incrementalSync: false,
  deduplication: true,
  dataValidation: true,
  notifyOnFailure: true,
  notificationEmails: ['admin@example.com']
};
```

### Example 2: Multiple Reports with Custom Fields and Daily Schedule
```typescript
const config: AdvancedSyncConfig = {
  dateRangePreset: 'last90days',
  reportTypes: ['revenue', 'inventory', 'orders'],
  reportFieldConfigs: [
    {
      reportType: 'revenue',
      dimensions: ['AD_UNIT_NAME', 'ADVERTISER_NAME', 'ORDER_NAME'],
      metrics: ['TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS', 'TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE']
    },
    {
      reportType: 'inventory',
      dimensions: ['AD_UNIT_NAME', 'AD_UNIT_CODE'],
      metrics: ['TOTAL_AD_REQUESTS', 'TOTAL_MATCHED_REQUESTS']
    }
  ],
  dimensionFilters: [
    {
      dimension: 'ADVERTISER_NAME',
      operator: 'contains',
      values: ['Premium']
    }
  ],
  metricFilters: [
    {
      metric: 'TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE',
      operator: 'greaterThan',
      value: 1000
    }
  ],
  frequency: {
    type: 'daily',
    hour: 2,
    minute: 0
  },
  networkCode: '123456',
  maxRecordsPerReport: 50000,
  incrementalSync: true,
  deduplication: true,
  dataValidation: true,
  notifyOnComplete: true,
  notifyOnFailure: true,
  notificationEmails: ['admin@example.com', 'analyst@example.com']
};
```

### Example 3: Weekly Inventory Report with Metric Filtering
```typescript
const config: AdvancedSyncConfig = {
  dateRangePreset: 'thisMonth',
  reportTypes: ['inventory'],
  metricFilters: [
    {
      metric: 'TOTAL_AD_REQUESTS',
      operator: 'between',
      value: 10000,
      maxValue: 100000
    }
  ],
  frequency: {
    type: 'weekly',
    dayOfWeek: 1, // Monday
    hour: 9,
    minute: 0
  },
  networkCode: '123456',
  incrementalSync: false,
  deduplication: true,
  dataValidation: true,
  notifyOnComplete: false,
  notifyOnFailure: true,
  notificationEmails: ['admin@example.com']
};
```

---

## API Reference

### GET /api/google-ad-manager/date-presets
**Description**: Fetch all available date range presets with calculated dates

**Request**:
```http
GET /api/google-ad-manager/date-presets
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "today",
      "label": "Today",
      "description": "Data for today only",
      "dates": {
        "startDate": "2025-01-15",
        "endDate": "2025-01-15"
      }
    },
    {
      "id": "last30days",
      "label": "Last 30 Days",
      "description": "Data from the past 30 days",
      "dates": {
        "startDate": "2024-12-16",
        "endDate": "2025-01-15"
      }
    }
    // ... 8 more presets
  ]
}
```

### GET /api/google-ad-manager/report-fields
**Description**: Fetch available dimensions and metrics for each report type

**Request**:
```http
GET /api/google-ad-manager/report-fields
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "dimensions": {
      "revenue": ["AD_UNIT_NAME", "ADVERTISER_NAME", "ORDER_NAME", ...],
      "inventory": ["AD_UNIT_NAME", "AD_UNIT_CODE", ...],
      "orders": ["ORDER_NAME", "ORDER_ID", "SALESPERSON_NAME", ...],
      "geography": ["COUNTRY_NAME", "REGION_NAME", "CITY_NAME", ...],
      "device": ["DEVICE_CATEGORY_NAME", "OPERATING_SYSTEM", ...]
    },
    "metrics": {
      "revenue": ["TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS", ...],
      "inventory": ["TOTAL_AD_REQUESTS", "TOTAL_MATCHED_REQUESTS", ...],
      "orders": ["ORDER_LIFETIME_IMPRESSIONS", ...],
      "geography": ["TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS", ...],
      "device": ["TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS", ...]
    }
  }
}
```

### POST /api/google-ad-manager/validate-config
**Description**: Validate an advanced sync configuration

**Request**:
```http
POST /api/google-ad-manager/validate-config
Authorization: Bearer <token>
Content-Type: application/json

{
  "dateRangePreset": "last30days",
  "reportTypes": ["revenue"],
  "networkCode": "123456",
  "frequency": {
    "type": "daily",
    "hour": 2,
    "minute": 0
  },
  "notifyOnFailure": true,
  "notificationEmails": ["admin@example.com"]
}
```

**Response (Valid)**:
```json
{
  "success": true,
  "valid": true,
  "errors": []
}
```

**Response (Invalid)**:
```json
{
  "success": true,
  "valid": false,
  "errors": [
    "Network code is required",
    "Invalid email address: invalid-email"
  ]
}
```

---

## Next Steps

### Immediate (This Feature)
1. **Integrate with GoogleAdManagerDriver** (HIGH PRIORITY)
   - Extract advanced config from connection details
   - Apply date range from config
   - Filter dimensions/metrics in queries
   - Apply filters to data
   - Respect max records limit
   
2. **Add to GAM Wizard** (HIGH PRIORITY)
   - Import and mount AdvancedSyncConfig component
   - Wire up state management
   - Include in data source creation payload
   
3. **Write Tests** (MEDIUM PRIORITY)
   - 20 validator tests
   - 10 API endpoint tests
   - 5 integration tests

### Future Features
- **Feature 6.2**: Data Export & Download
- **Feature 6.3**: Email Notifications & Alerts (will use notification emails from advanced config)
- **Feature 6.4**: Admin Dashboard UI (will display advanced config settings)
- **Feature 6.5**: Sync Scheduling & Automation (will use frequency from advanced config)

---

## Technical Notes

### Date Range Presets
All presets use UTC timezone and calculate dates dynamically at request time. This ensures dates are always current.

### JSONB Storage
The advanced_sync_config is stored in the JSONB `connection_details` column, which means:
- No schema migration needed
- Flexible structure for future enhancements
- Efficient queries using JSONB operators
- Automatic encryption via existing transformer

### Validation Strategy
Validation happens at two levels:
1. **Frontend**: Real-time validation in AdvancedSyncConfig component
2. **Backend**: Server-side validation via validate-config endpoint and SyncConfigValidator

### Performance Considerations
- Date preset calculation is O(1) for all presets except "custom"
- Field filtering reduces data volume, improving sync performance
- Metric filters apply post-query (could be optimized in future with GAM API filter support)
- Max records limit prevents memory issues with large datasets

---

## Known Limitations

1. **Metric Filters**: Applied post-query, not in GAM API query (API limitation)
2. **Dimension Filters**: Currently stored but not yet applied in driver (pending implementation)
3. **Incremental Sync**: Requires tracking of last sync timestamp (partially implemented)
4. **Scheduling**: Frequency configuration exists but actual cron scheduling in Feature 6.5
5. **Email Notifications**: Email preferences stored but actual notification service in Feature 6.3

---

## Completion Checklist

- [x] Create backend types (IAdvancedSyncConfig.ts)
- [x] Add API endpoints (3 new routes)
- [x] Update connection details type
- [x] Create frontend composable
- [x] Create frontend component (AdvancedSyncConfig.vue)
- [ ] Integrate with GoogleAdManagerDriver
- [ ] Add to GAM wizard UI
- [ ] Write unit tests (35 tests)
- [ ] Integration testing
- [ ] Documentation updates
- [ ] Performance testing

**Overall Progress**: 80% Complete

---

*Last Updated: January 15, 2025*
