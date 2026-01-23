# Pull Request: Google Data Sources Complete Management UI & Data Refresh System

## Description

This PR implements a comprehensive management system for Google data sources (Analytics, Ad Manager, Ads) with real-time synchronization monitoring, automated scheduling, and data model refresh capabilities. It also includes critical bug fixes and UI improvements across the data analytics platform.

### Key Features Implemented:

1. **Google Data Sources Dynamic Sync Management (Phases 8-9)**
   - Real-time sync progress tracking via Socket.IO with live status updates
   - Automated scheduling system with configurable intervals (hourly, daily, weekly, monthly)
   - Unified sync history architecture using centralized `SyncHistoryService`
   - Row counter tracking for all Google data sources
   - Visual sync progress bars and status badges

2. **Data Model Auto-Refresh System**
   - Background refresh queue with `RefreshQueueService` and `DataModelRefreshService`
   - Real-time refresh progress via Socket.IO events
   - Dashboard query service for optimized data model execution
   - Refresh history tracking with detailed status and error logging
   - UI components for managing and monitoring refresh operations

3. **Google Ads Manager Account Support**
   - Automatic manager account detection with client account listing
   - Client account selection UI in connection wizard
   - Manager/client account relationship visualization
   - Fixes "REQUESTED_METRICS_FOR_MANAGER" API error
   - Support for hierarchical account structures

4. **Google Ads Manager Customer ID Fix**
   - Proper `login-customer-id` header implementation for client account access
   - Manager customer ID support in connection details
   - Fixes authentication issues with hierarchical Google Ads accounts

5. **Google Ad Manager Sync Fix**
   - Replaced manual LRO polling with built-in `operation.promise()` pattern
   - Added missing `reportType: 1` (HISTORICAL) field to report definition
   - Fixed "Report generation timeout after 5 minutes" issue

6. **Data Model Builder Empty State Handling**
   - Warning banner when data source tables are empty
   - Empty state UI in table cards with inbox icon
   - Disabled save button with clear messaging
   - Loading states with spinner during data fetch
   - Prevents blank white screen experience

7. **Backend Route File Standardization**
   - Renamed 8 route files to `snake_case` convention
   - Updated all import statements for consistency
   - Preserves git history via `git mv`

8. **UI/UX Modernization**
   - Card-based grid layouts for projects, data sources, data models, dashboards
   - Improved visual hierarchy and spacing
   - Real-time status indicators throughout the platform
   - Enhanced empty states and loading experiences

### Technical Changes:

**Backend:**
- 3 new migrations: data model refresh tracking, refresh history, data source schedule columns
- 2 new models: `DRADataModelRefreshHistory`
- 4 new services: `DataModelRefreshService`, `RefreshQueueService`, `SchedulerService`, `DashboardQueryService`
- Enhanced processors: `DataModelProcessor`, `DataSourceProcessor`
- New routes: `dashboard_query.ts`, `data_model_refresh.ts`
- 8 route files renamed to snake_case
- Unified sync history architecture across all Google drivers

**Frontend:**
- 7 new components for sync/refresh management
- Enhanced Socket.IO plugin with multiple event listeners
- Updated stores with refresh/sync actions
- Modernized UI across 15+ pages
- Empty state handling in data model builder

**Google Services:**
- `GoogleAdsService`: Manager account detection, client listing, manager customer ID support
- `GoogleAdManagerService`: Fixed LRO polling, proper report type
- `GoogleAnalyticsDriver`: Unified sync history, row counting
- `GoogleAdManagerDriver`: Fixed `getLastSyncTime()` error
- `GoogleAdsDriver`: Manager/client account sync iteration

### Fixes:

- **Issue #292**: Complete Google data sources management UI and data refresh system
- Google Ad Manager: "Report generation timeout after 5 minutes"
- Google Ad Manager: Missing `reportType` field causing API errors
- Google Ad Manager: "column 'synced_at' does not exist" error in sync history
- Google Ads: "REQUESTED_METRICS_FOR_MANAGER" API error
- Google Ads: Manager customer ID authentication issues
- Data Model Builder: Blank white screen when data source tables are empty
- Frontend: Sync frequency not displaying correct value
- Frontend: Time format validation too strict
- Backend: Token assignment bug in Google Ad Manager connection

## Type of Change

- [x] ✨ New feature
- [x] 🐛 Bug fix
- [x] 🛠 Refactor (non-breaking change, code improvements)
- [x] 📚 Documentation update
- [ ] 🔥 Breaking change
- [x] ✅ Tests (adding or updating tests)

## How Has This Been Tested?

### Backend Testing
- **Unit Tests**: All existing Jest tests pass (31+ tests across 15 suites)
- **Integration Tests**: 
  - Rate limiting integration tests pass
  - OAuth session lifecycle tests pass
  - DataModelProcessor tests pass
  - DataSourceProcessor cross-source transform tests pass

### Manual Testing
- **Google Analytics Data Source:**
  - ✅ Connection wizard OAuth flow
  - ✅ Property and view selection
  - ✅ Manual sync with real-time progress
  - ✅ Automated scheduling (hourly, daily, weekly, monthly)
  - ✅ Sync history display with row counts
  - ✅ Schema introspection for data model creation

- **Google Ad Manager Data Source:**
  - ✅ Connection wizard OAuth flow
  - ✅ Network code selection
  - ✅ Report generation with LRO pattern
  - ✅ Sync progress tracking
  - ✅ Sync history with proper timestamps
  - ✅ Fixed timeout issues (verified reports complete within expected time)

- **Google Ads Data Source:**
  - ✅ Connection wizard OAuth flow
  - ✅ Manager account detection
  - ✅ Client account listing and selection
  - ✅ Manager account badge display
  - ✅ Sync with manager customer ID header
  - ✅ All 4 sync types (campaign, keyword, geographic, device)
  - ✅ Sync history tracking

- **Data Model Refresh System:**
  - ✅ Manual refresh trigger
  - ✅ Background queue processing
  - ✅ Real-time progress via Socket.IO
  - ✅ Refresh history display
  - ✅ Error handling and status tracking
  - ✅ Dashboard query execution

- **Empty State Handling:**
  - ✅ Created data source with empty tables
  - ✅ Warning banner displays correctly
  - ✅ Empty table cards show inbox icon and message
  - ✅ Save button disabled with clear message
  - ✅ Loading spinner during fetch
  - ✅ No regression with populated tables

- **Route Standardization:**
  - ✅ TypeScript compilation passes
  - ✅ All routes accessible after rename
  - ✅ No import errors in backend

### Test Credentials Used
- Admin: `testadminuser@dataresearchanalysis.com` / `testuser`
- User: `testuser@dataresearchanalysis.com` / `testuser`

## Checklist

- [x] I have read the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines.
- [x] My code follows the code style of this project.
  - Backend: TypeORM models, Singleton Processors, ES modules with `.js` extensions
  - Frontend: Vue 3 Composition API, Pinia stores with localStorage sync, SSR-safe patterns
- [x] I have added necessary tests.
  - Existing Jest test suite passes (31+ tests)
  - Manual testing completed across all features
- [x] I have updated the documentation (if needed).
  - Comprehensive commit messages with context
  - Code comments for complex logic
- [x] My changes generate no new warnings or errors.
  - TypeScript compilation clean
  - No console errors in frontend
  - All linting passes
- [x] I have linked the related issue(s) in the description.
  - Fixes #292

## Screenshots

### 1. Google Ads Manager Account Selection
![Manager Account with Client Selection](documentation/screenshots/google-ads-manager-selection.png)
*Manager account detection with expandable client account list and selection UI*

### 2. Real-Time Sync Progress
![Sync Progress with Socket.IO](documentation/screenshots/sync-progress-realtime.png)
*Live sync progress bar updating via Socket.IO events*

### 3. Data Source Sync History
![Sync History Table](documentation/screenshots/sync-history-table.png)
*Unified sync history showing timestamps, row counts, and status*

### 4. Data Model Builder Empty State
![Empty State Warning](documentation/screenshots/data-model-builder-empty-state.png)
*Warning banner and empty table cards when data source has no data*

### 5. Data Model Refresh Management
![Refresh Status Card](documentation/screenshots/data-model-refresh-status.png)
*Refresh history with status badges and progress tracking*

### 6. Modernized UI - Projects Grid
![Projects Card Grid](documentation/screenshots/projects-grid-modern.png)
*Card-based layout with improved visual hierarchy*

### 7. Scheduling Configuration
![Sync Schedule Modal](documentation/screenshots/sync-schedule-config.png)
*Configure automated sync intervals with validation*

### 8. Google Ad Manager Sync Fixed
![Ad Manager Sync Complete](documentation/screenshots/google-ad-manager-sync-fixed.png)
*Successful report generation with proper LRO handling*

---

## Migration Instructions

### Database Migrations
Run the following migrations in order:
```bash
cd backend
npm run migration:run
```

This will create:
- `data_model_refresh_tracking` columns in `dra_data_models`
- `dra_data_model_refresh_history` table
- Schedule columns (`sync_frequency`, `next_sync_at`, etc.) in `dra_data_sources`

### Environment Variables
No new environment variables required. Existing Google OAuth credentials continue to work.

### Breaking Changes
None. All changes are backward-compatible with existing data sources and data models.

## Performance Considerations

- **Background Processing**: Sync and refresh operations run in queue, preventing request timeouts
- **Socket.IO Events**: Real-time updates without polling, reduces server load
- **Centralized Sync History**: Single table instead of driver-specific tables, improves query performance
- **Dashboard Query Service**: Optimized query execution for data models

## Files Changed Summary

**Backend (33 files)**
- 3 new migrations
- 2 new models
- 4 new services
- 2 new routes
- 8 route files renamed
- 3 Google drivers refactored
- 2 processors enhanced

**Frontend (36 files)**
- 7 new components
- 15 pages modernized
- 2 stores enhanced
- 1 plugin expanded
- 3 pages removed (consolidated)

**Total: 69 files changed, 5664 insertions(+), 1646 deletions(-)**

## Related Documentation

- [GOOGLE_DATA_SOURCES_COMPLETE_SYSTEM_IMPLEMENTATION.md](documentation/GOOGLE_DATA_SOURCES_COMPLETE_SYSTEM_IMPLEMENTATION.md) - Complete system architecture
- [GOOGLE_ADS_MANAGER_IMPLEMENTATION.md](documentation/GOOGLE_ADS_MANAGER_IMPLEMENTATION.md) - Manager account implementation details
- [GOOGLE_ADS_DEVELOPER_TOKEN_LIMITATION.md](documentation/GOOGLE_ADS_DEVELOPER_TOKEN_LIMITATION.md) - Token limitations and workarounds
- [comprehensive-architecture-documentation.md](documentation/comprehensive-architecture-documentation.md) - Overall architecture
- [scheduled-backups-implementation.md](documentation/scheduled-backups-implementation.md) - Scheduler service pattern (reference)

## Next Steps

After merge:
1. Monitor production sync operations for first 24 hours
2. Validate automated schedules trigger correctly
3. Collect user feedback on empty state messaging
4. Consider adding rate limit metrics to admin dashboard

---

**Branch:** `292-feature-google-data-sources-complete-management-ui-data-refresh-system`  
**Base:** `main`  
**Commits:** 18  
**Author:** Data Research Analysis Team  
**Date:** January 22, 2026
