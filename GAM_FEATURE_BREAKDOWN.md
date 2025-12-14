# Google Ad Manager Integration - Granular Feature Breakdown

## Overview

This document breaks down the 8-week Google Ad Manager integration into **40 atomic features** that can be implemented efficiently. Each feature is designed to be completed in 1-3 days, can be tested independently, and provides incremental value.

---

## Sprint Organization (8 Sprints × 5 Features Each)

### Sprint 1: OAuth & Authentication Foundation (Week 1)
**Goal:** Establish authentication and basic API connectivity

#### Feature 1.1: Extend Google OAuth Scopes for GAM
**Priority:** P0 (Blocker)  
**Effort:** 4 hours  
**Dependencies:** None  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Update `GoogleOAuthService.getScopes()` to include `https://www.googleapis.com/auth/dfp`
- [ ] Update OAuth consent screen in Google Cloud Console
- [ ] Add GAM scope to environment variables
- [ ] Test OAuth flow with new scope in dev environment

**Acceptance Criteria:**
- OAuth flow completes with GAM scope included
- Token response includes GAM API access
- No breaking changes to existing GA integration

**Files Modified:**
- `backend/src/services/GoogleOAuthService.ts`
- `.env.example`

---

#### Feature 1.2: Create GoogleAdManagerService Skeleton
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** None  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Create `backend/src/services/GoogleAdManagerService.ts`
- [ ] Implement singleton pattern
- [ ] Add `getAuthenticatedClient()` method (reuse OAuth service)
- [ ] Add placeholder methods for core functionality
- [ ] Add TypeScript interfaces for GAM data types

**Acceptance Criteria:**
- Service instantiates successfully
- Can create authenticated GAM API client
- All methods have JSDoc comments
- Follows existing service patterns (GA service)

**Files Created:**
- `backend/src/services/GoogleAdManagerService.ts`
- `backend/src/types/IGoogleAdManager.ts`

---

#### Feature 1.3: Create GoogleAdManagerDriver Skeleton
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** Feature 1.2  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Create `backend/src/drivers/GoogleAdManagerDriver.ts`
- [ ] Implement `IAPIDriver` interface
- [ ] Add `authenticate()` method
- [ ] Add skeleton methods for sync operations
- [ ] Add error handling structure

**Acceptance Criteria:**
- Driver implements IAPIDriver interface
- Follows GoogleAnalyticsDriver pattern
- Can authenticate with GAM API
- Returns proper success/failure responses

**Files Created:**
- `backend/src/drivers/GoogleAdManagerDriver.ts`

**Files Modified:**
- `backend/src/types/EDataSourceType.ts` (add GOOGLE_AD_MANAGER enum)

---

#### Feature 1.4: Database Schema & Migration
**Priority:** P0 (Blocker)  
**Effort:** 4 hours  
**Dependencies:** None  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Create migration file for `dra_google_ad_manager` schema
- [ ] Add `GOOGLE_AD_MANAGER` to data source type enum
- [ ] Update DRADataSource model metadata structure
- [ ] Test migration up/down in dev database

**Acceptance Criteria:**
- Schema `dra_google_ad_manager` created successfully
- Migration is reversible (up/down)
- No data loss on migration
- Enum updated in database

**Files Created:**
- `backend/src/migrations/YYYYMMDDHHMMSS-create-gam-schema.ts`

**Files Modified:**
- `backend/src/types/EDataSourceType.ts`
- Database enum type

---

#### Feature 1.5: Unit Tests for OAuth Extension
**Priority:** P1  
**Effort:** 4 hours  
**Dependencies:** Features 1.1, 1.2, 1.3  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Create `GoogleAdManagerService.unit.test.ts`
- [ ] Test OAuth client creation with GAM scope
- [ ] Test authentication success/failure scenarios
- [ ] Test singleton pattern
- [ ] Mock googleapis responses

**Acceptance Criteria:**
- 100% code coverage for new OAuth methods
- All tests pass
- Tests run in <5 seconds

**Files Created:**
- `backend/src/services/__tests__/GoogleAdManagerService.unit.test.ts`

---

### Sprint 2: Network Listing & API Connectivity (Week 2)
**Goal:** List GAM networks and verify API access

#### Feature 2.1: Implement listNetworks() Method
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Sprint 1 complete  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Implement `GoogleAdManagerService.listNetworks()`
- [ ] Call GAM NetworkService API
- [ ] Parse and transform network response
- [ ] Add error handling for API failures
- [ ] Add retry logic with exponential backoff

**Acceptance Criteria:**
- Returns array of accessible networks
- Includes network ID, name, display name, timezone
- Handles API errors gracefully
- Logs network count retrieved

**Files Modified:**
- `backend/src/services/GoogleAdManagerService.ts`

---

#### Feature 2.2: Create /networks API Endpoint
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** Feature 2.1  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Create `backend/src/routes/google_ad_manager.ts`
- [ ] Add POST `/api/google-ad-manager/networks` endpoint
- [ ] Add JWT authentication middleware
- [ ] Add request validation (access_token required)
- [ ] Add rate limiting (expensive operations limiter)

**Acceptance Criteria:**
- Endpoint returns network list successfully
- Requires valid JWT token
- Returns 401 for unauthenticated requests
- Returns 429 when rate limit exceeded
- Response includes network metadata

**Files Created:**
- `backend/src/routes/google_ad_manager.ts`

**Files Modified:**
- `backend/src/index.ts` (register new routes)

---

#### Feature 2.3: Create useGoogleAdManager Composable
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** Feature 2.2  
**Assignee:** Frontend Dev 1

**Tasks:**
- [ ] Create `frontend/composables/useGoogleAdManager.ts`
- [ ] Implement `listNetworks()` method
- [ ] Add error handling and loading states
- [ ] Use existing useApiRequest composable
- [ ] Add TypeScript interfaces

**Acceptance Criteria:**
- Composable follows existing patterns (useGoogleAnalytics)
- Returns reactive state for loading/error/data
- Properly typed with TypeScript
- Error messages are user-friendly

**Files Created:**
- `frontend/composables/useGoogleAdManager.ts`
- `frontend/types/IGoogleAdManager.ts`

---

#### Feature 2.4: Network List UI Component
**Priority:** P1  
**Effort:** 8 hours  
**Dependencies:** Feature 2.3  
**Assignee:** Frontend Dev 2

**Tasks:**
- [ ] Create `frontend/components/data-sources/NetworkSelector.vue`
- [ ] Display network list with radio buttons
- [ ] Show network name, ID, timezone
- [ ] Add search/filter functionality
- [ ] Add loading skeleton
- [ ] Style with Tailwind CSS

**Acceptance Criteria:**
- Networks display in clean list format
- User can select one network (radio button)
- Search filters networks by name
- Loading state shows skeleton
- Responsive on mobile

**Files Created:**
- `frontend/components/data-sources/NetworkSelector.vue`

---

#### Feature 2.5: Integration Test for Network Listing
**Priority:** P1  
**Effort:** 4 hours  
**Dependencies:** Features 2.1, 2.2  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Create `google-ad-manager.integration.test.ts`
- [ ] Test end-to-end network listing flow
- [ ] Mock GAM API responses
- [ ] Test error scenarios (invalid token, API down)
- [ ] Test rate limiting

**Acceptance Criteria:**
- Integration test covers full flow
- Tests pass with mocked API
- Error cases tested
- Rate limiting verified

**Files Created:**
- `backend/src/routes/__tests__/google-ad-manager.integration.test.ts`

---

### Sprint 3: Connection Wizard UI (Week 3)
**Goal:** Build user-facing connection wizard

#### Feature 3.1: Create Connection Wizard Page Structure
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Sprint 2 complete  
**Assignee:** Frontend Dev 1

**Tasks:**
- [ ] Create `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`
- [ ] Implement 4-step wizard structure
- [ ] Add step navigation (next, back, skip)
- [ ] Add progress indicator
- [ ] Add responsive layout

**Acceptance Criteria:**
- 4 steps visible: Auth, Network, Config, Confirm
- Progress bar shows current step
- Next/Back buttons functional
- Mobile responsive
- Follows existing GA wizard pattern

**Files Created:**
- `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`

---

#### Feature 3.2: Step 1 - OAuth Authentication UI
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** Feature 3.1  
**Assignee:** Frontend Dev 2

**Tasks:**
- [ ] Implement Step 1: Google Sign-In
- [ ] Add "Sign In with Google" button
- [ ] Display GAM permissions explanation
- [ ] Handle OAuth callback
- [ ] Store tokens in composable state

**Acceptance Criteria:**
- Sign-in button triggers OAuth flow
- Redirects to Google consent screen
- Returns to wizard after auth
- Tokens stored securely (backend session)
- Error handling for auth failures

**Files Modified:**
- `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`

---

#### Feature 3.3: Step 2 - Network Selection UI
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** Features 3.1, 2.4  
**Assignee:** Frontend Dev 1

**Tasks:**
- [ ] Implement Step 2: Network selection
- [ ] Integrate NetworkSelector component
- [ ] Load networks on step entry
- [ ] Handle no networks found scenario
- [ ] Add "Refresh Networks" button

**Acceptance Criteria:**
- Networks load automatically when reaching step 2
- User can select one network
- Loading state while fetching
- Error message if no networks found
- Can retry network loading

**Files Modified:**
- `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`

---

#### Feature 3.4: Add GAM Icon & Branding
**Priority:** P2  
**Effort:** 2 hours  
**Dependencies:** None  
**Assignee:** Frontend Dev 2

**Tasks:**
- [ ] Add Google Ad Manager logo to assets
- [ ] Update data source icon mapping
- [ ] Add GAM to data source selector
- [ ] Style GAM data source card

**Acceptance Criteria:**
- GAM appears in "Add Data Source" list
- Icon displays correctly
- Branding matches Google guidelines
- Card has proper hover states

**Files Modified:**
- `frontend/assets/images/` (add GAM logo)
- `frontend/pages/projects/[projectid]/index.vue`

---

#### Feature 3.5: Step 3 - Basic Configuration UI
**Priority:** P1  
**Effort:** 8 hours  
**Dependencies:** Feature 3.3  
**Assignee:** Frontend Dev 1

**Tasks:**
- [ ] Implement Step 3: Configuration
- [ ] Add data source name input
- [ ] Add sync frequency selector (hourly, daily, weekly, manual)
- [ ] Add form validation
- [ ] Pre-fill name with network name

**Acceptance Criteria:**
- Name input validates (3+ characters, no special chars)
- Sync frequency selector functional
- Default to "daily"
- Validation errors display clearly
- Cannot proceed with invalid config

**Files Modified:**
- `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`

---

### Sprint 4: Revenue Report Implementation (Week 4)
**Goal:** Implement first report type (Revenue)

#### Feature 4.1: Revenue Report Query Builder
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Sprint 3 complete  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Implement `GoogleAdManagerService.buildRevenueReportQuery()`
- [ ] Define dimensions: DATE, AD_UNIT_NAME, COUNTRY_NAME
- [ ] Define metrics: IMPRESSIONS, REVENUE, CPM, FILL_RATE
- [ ] Add date range parameters
- [ ] Add network code parameter

**Acceptance Criteria:**
- Generates valid GAM report query
- All dimensions and metrics included
- Date range configurable
- Query follows GAM API specification

**Files Modified:**
- `backend/src/services/GoogleAdManagerService.ts`

---

#### Feature 4.2: Revenue Report Execution
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Feature 4.1  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Implement `GoogleAdManagerService.runReport()`
- [ ] Call GAM ReportService API
- [ ] Poll for report completion (async)
- [ ] Download report results
- [ ] Parse CSV/JSON response

**Acceptance Criteria:**
- Report executes successfully
- Polling completes within 2 minutes
- Results parsed correctly
- Error handling for failed reports
- Logs report execution time

**Files Modified:**
- `backend/src/services/GoogleAdManagerService.ts`

---

#### Feature 4.3: Revenue Data Transformation
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** Feature 4.2  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Implement `GoogleAdManagerDriver.transformRevenueData()`
- [ ] Map GAM columns to PostgreSQL schema
- [ ] Handle null/missing values
- [ ] Convert data types (strings → numbers, dates)
- [ ] Calculate derived metrics (CTR, etc.)

**Acceptance Criteria:**
- All GAM columns mapped correctly
- Data types match PostgreSQL schema
- Null handling prevents errors
- Derived metrics calculated accurately
- No data loss in transformation

**Files Modified:**
- `backend/src/drivers/GoogleAdManagerDriver.ts`

---

#### Feature 4.4: Revenue Table Creation & Sync
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Feature 4.3  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Implement `GoogleAdManagerDriver.syncRevenueData()`
- [ ] Create table: `dra_google_ad_manager.revenue_{network_id}`
- [ ] Define schema with indexes
- [ ] Implement UPSERT logic (avoid duplicates)
- [ ] Batch insert for performance (1000 rows at a time)

**Acceptance Criteria:**
- Table created with correct schema
- Data inserted successfully
- UPSERT prevents duplicates on (date, ad_unit_id, country_code)
- Handles 100K+ rows efficiently
- Transaction rollback on errors

**Files Modified:**
- `backend/src/drivers/GoogleAdManagerDriver.ts`

---

#### Feature 4.5: Revenue Report Unit Tests
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Features 4.1-4.4  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Test report query generation
- [ ] Test report execution with mocked API
- [ ] Test data transformation logic
- [ ] Test table creation and sync
- [ ] Test error scenarios

**Acceptance Criteria:**
- 90%+ code coverage
- All tests pass
- Mock API responses realistic
- Edge cases covered (empty results, API errors)

**Files Modified:**
- `backend/src/services/__tests__/GoogleAdManagerService.unit.test.ts`
- `backend/src/drivers/__tests__/GoogleAdManagerDriver.unit.test.ts`

---

### Sprint 5: Additional Report Types (Week 5)
**Goal:** Implement remaining 4 report types

#### Feature 5.1: Inventory Report Implementation
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** Sprint 4 complete  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Implement `buildInventoryReportQuery()`
- [ ] Implement `syncInventoryData()`
- [ ] Create table: `inventory_{network_id}`
- [ ] Define schema (ad_unit, device, requests, impressions, fill_rate)

**Acceptance Criteria:**
- Query generates successfully
- Data syncs to PostgreSQL
- Schema matches specification
- UPSERT on (date, ad_unit_id, device_category)

**Files Modified:**
- `backend/src/services/GoogleAdManagerService.ts`
- `backend/src/drivers/GoogleAdManagerDriver.ts`

---

#### Feature 5.2: Orders & Line Items Report
**Priority:** P0 (Blocker)  
**Effort:** 6 hours  
**Dependencies:** Feature 5.1  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Implement `buildOrdersReportQuery()`
- [ ] Implement `syncOrdersData()`
- [ ] Create table: `orders_{network_id}`
- [ ] Define schema (order, line_item, advertiser, delivery_status)

**Acceptance Criteria:**
- Query includes order and line item dimensions
- Data syncs successfully
- UPSERT on (date, line_item_id)

**Files Modified:**
- `backend/src/services/GoogleAdManagerService.ts`
- `backend/src/drivers/GoogleAdManagerDriver.ts`

---

#### Feature 5.3: Geographic Performance Report
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Feature 5.2  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Implement `buildGeographyReportQuery()`
- [ ] Implement `syncGeographyData()`
- [ ] Create table: `geography_{network_id}`
- [ ] Define schema (country, region, city, revenue)

**Acceptance Criteria:**
- Geographic dimensions included
- Data syncs correctly
- UPSERT on (date, country_code, region, city)

**Files Modified:**
- `backend/src/services/GoogleAdManagerService.ts`
- `backend/src/drivers/GoogleAdManagerDriver.ts`

---

#### Feature 5.4: Device & Browser Report
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Feature 5.3  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Implement `buildDeviceReportQuery()`
- [ ] Implement `syncDeviceData()`
- [ ] Create table: `device_{network_id}`
- [ ] Define schema (device_category, browser, OS)

**Acceptance Criteria:**
- Device and browser dimensions included
- Data syncs successfully
- UPSERT on (date, device_category, browser_name)

**Files Modified:**
- `backend/src/services/GoogleAdManagerService.ts`
- `backend/src/drivers/GoogleAdManagerDriver.ts`

---

#### Feature 5.5: Report Type Selector Component
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Features 5.1-5.4  
**Assignee:** Frontend Dev 1

**Tasks:**
- [ ] Create `ReportTypeSelector.vue` component
- [ ] Display checkbox list of report types
- [ ] Show description for each report
- [ ] Add "Select All" / "Deselect All" buttons
- [ ] Store selections in component state

**Acceptance Criteria:**
- All 5 report types listed
- Descriptions are clear and concise
- User can select multiple reports
- At least 1 report must be selected
- Visual indication of selection

**Files Created:**
- `frontend/components/data-sources/ReportTypeSelector.vue`

---

### Sprint 6: Configuration & Sync (Week 6)
**Goal:** Complete configuration UI and sync orchestration

#### Feature 6.1: Date Range Picker Component
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** None  
**Assignee:** Frontend Dev 2

**Tasks:**
- [ ] Create `DateRangePicker.vue` component (or use existing)
- [ ] Support presets: Last 7 days, 30 days, 90 days, Custom
- [ ] Validate date range (max 365 days)
- [ ] Default to last 30 days
- [ ] Style with Tailwind

**Acceptance Criteria:**
- Presets work correctly
- Custom date picker functional
- Validation prevents invalid ranges
- Dates stored in ISO format

**Files Created/Modified:**
- `frontend/components/common/DateRangePicker.vue`

---

#### Feature 6.2: Step 4 - Confirmation UI
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Sprint 5 complete  
**Assignee:** Frontend Dev 1

**Tasks:**
- [ ] Implement Step 4: Review & Confirm
- [ ] Display configuration summary
- [ ] Show network name, selected reports, date range
- [ ] Add "Connect & Sync" button
- [ ] Add loading state during sync

**Acceptance Criteria:**
- Summary displays all configuration
- User can go back to edit
- Button triggers sync process
- Loading indicator during sync
- Success/error messages displayed

**Files Modified:**
- `frontend/pages/projects/[projectid]/data-sources/connect/google-ad-manager.vue`

---

#### Feature 6.3: Add Data Source API Endpoint
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Sprint 5 complete  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Create POST `/api/google-ad-manager/add-data-source` endpoint
- [ ] Validate request body (name, network_id, reports, date_range)
- [ ] Create DRADataSource record
- [ ] Store OAuth tokens encrypted (reuse OAuthSessionService)
- [ ] Return data source ID

**Acceptance Criteria:**
- Data source created in database
- Tokens stored encrypted
- Returns 201 with data source object
- Validation errors return 400
- Rate limited

**Files Modified:**
- `backend/src/routes/google_ad_manager.ts`

---

#### Feature 6.4: Sync Orchestration
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Features 6.3, Sprint 5  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Implement `GoogleAdManagerDriver.syncToDatabase()`
- [ ] Orchestrate all report syncs in sequence
- [ ] Log progress for each report
- [ ] Handle partial failures gracefully
- [ ] Update last_sync_timestamp

**Acceptance Criteria:**
- All selected reports sync
- Progress logged to console
- Partial failures don't stop other reports
- Sync statistics logged (rows inserted, duration)
- Transaction management for data consistency

**Files Modified:**
- `backend/src/drivers/GoogleAdManagerDriver.ts`

---

#### Feature 6.5: Sync Status Tracking
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Feature 6.4  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Add sync status fields to DRADataSource
- [ ] Implement status updates during sync
- [ ] Create GET endpoint for sync status
- [ ] Add error logging for failed syncs
- [ ] Store last sync statistics

**Acceptance Criteria:**
- Status tracked: pending, in_progress, completed, failed
- Frontend can poll for status updates
- Error messages stored and retrievable
- Statistics include row counts and duration

**Files Modified:**
- `backend/src/models/DRADataSource.ts`
- `backend/src/routes/google_ad_manager.ts`

---

### Sprint 7: Data Model Integration (Week 7)
**Goal:** Enable GAM data in Data Model Builder and AI Data Modeler

#### Feature 7.1: Update DataModelProcessor for GAM
**Priority:** P0 (Blocker)  
**Effort:** 4 hours  
**Dependencies:** Sprint 6 complete  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Add `dra_google_ad_manager` to special schema handling (3 locations)
- [ ] Update column name generation logic
- [ ] Update row key extraction logic
- [ ] Follow same pattern as GA fix

**Acceptance Criteria:**
- GAM tables use `table_name_column` format
- Consistent across CREATE TABLE, data types map, INSERT
- No null values when creating data models
- Backward compatible with GA, Excel, PDF

**Files Modified:**
- `backend/src/processors/DataModelProcessor.ts`

---

#### Feature 7.2: Update DataSourceProcessor for GAM
**Priority:** P0 (Blocker)  
**Effort:** 4 hours  
**Dependencies:** Feature 7.1  
**Assignee:** Backend Dev 1

**Tasks:**
- [ ] Add `dra_google_ad_manager` to special schema handling (3 locations)
- [ ] Update column name generation
- [ ] Update alias generation
- [ ] Match DataModelProcessor changes

**Acceptance Criteria:**
- GAM columns named consistently
- Data source creation works
- Column aliases correct
- Tests pass

**Files Modified:**
- `backend/src/processors/DataSourceProcessor.ts`

---

#### Feature 7.3: Unit Tests for GAM Data Model Support
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Features 7.1, 7.2  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Extend DataModelProcessor.unit.test.ts
- [ ] Add GAM column name generation tests
- [ ] Test special schema handling
- [ ] Test consistency across 3 locations
- [ ] Test with truncated table names

**Acceptance Criteria:**
- 16+ tests covering GAM scenarios
- 100% pass rate
- Edge cases tested
- Matches GA test patterns

**Files Modified:**
- `backend/src/processors/__tests__/DataModelProcessor.unit.test.ts`
- `backend/src/processors/__tests__/DataSourceProcessor.unit.test.ts`

---

#### Feature 7.4: Frontend Data Model Builder Update
**Priority:** P1  
**Effort:** 4 hours  
**Dependencies:** Feature 7.2  
**Assignee:** Frontend Dev 1

**Tasks:**
- [ ] Update `data-model-builder.vue` alias generation
- [ ] Add GAM to special schema handling in buildSQLQuery()
- [ ] Match backend column naming
- [ ] Test data model creation with GAM tables

**Acceptance Criteria:**
- GAM tables appear in data model builder
- Column names match backend format
- Aliases generated correctly
- Data models create successfully

**Files Modified:**
- `frontend/components/data-model-builder.vue`

---

#### Feature 7.5: AI Data Modeler Schema Recognition
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** Features 7.1, 7.2  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Update SchemaCollectorService to recognize GAM tables
- [ ] Include GAM metrics in AI context
- [ ] Add GAM-specific model suggestions
- [ ] Test natural language queries with GAM data

**Acceptance Criteria:**
- GAM tables appear in schema collector
- AI recognizes GAM columns and metrics
- Can generate models using GAM data
- Suggested models include GAM use cases

**Files Modified:**
- `backend/src/services/SchemaCollectorService.ts`

---

### Sprint 8: Testing, Documentation & Launch (Week 8)
**Goal:** Final QA, documentation, and production deployment

#### Feature 8.1: Integration Test Suite
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Sprint 7 complete  
**Assignee:** QA Engineer + Backend Dev 1

**Tasks:**
- [ ] Create comprehensive integration tests
- [ ] Test end-to-end OAuth flow
- [ ] Test network listing
- [ ] Test all 5 report types syncing
- [ ] Test data model creation from GAM data
- [ ] Test error scenarios and edge cases

**Acceptance Criteria:**
- 20+ integration tests
- All critical paths covered
- Tests run in CI/CD pipeline
- Mock API responses realistic
- Performance benchmarks established

**Files Created:**
- `backend/src/routes/__tests__/google-ad-manager-e2e.integration.test.ts`

---

#### Feature 8.2: Manual QA Checklist Execution
**Priority:** P0 (Blocker)  
**Effort:** 12 hours  
**Dependencies:** Feature 8.1  
**Assignee:** QA Engineer

**Tasks:**
- [ ] Execute 50-item manual test checklist
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test mobile responsiveness (iOS, Android)
- [ ] Test with real GAM account (staging)
- [ ] Verify sync performance with large datasets
- [ ] Test rate limiting behavior
- [ ] Verify error messages are user-friendly

**Acceptance Criteria:**
- All test cases pass
- No critical bugs found
- Performance meets targets (<5 min for 30 days)
- Mobile experience smooth
- Error handling verified

**Test Results Document:**
- Create GAM_QA_REPORT.md with results

---

#### Feature 8.3: User Documentation
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** None (can start Week 7)  
**Assignee:** Technical Writer + Frontend Dev 2

**Tasks:**
- [ ] Write "Getting Started with GAM" guide
- [ ] Create report types reference document
- [ ] Write troubleshooting guide
- [ ] Create FAQ section
- [ ] Record 5-minute video tutorial
- [ ] Add screenshots and annotated images

**Acceptance Criteria:**
- Documentation covers entire user flow
- Screenshots clear and annotated
- Video tutorial under 5 minutes
- FAQ addresses common questions
- Hosted on docs site

**Files Created:**
- `documentation/google-ad-manager-quick-start.md`
- `documentation/gam-report-types.md`
- `documentation/gam-troubleshooting.md`
- `documentation/gam-faq.md`

---

#### Feature 8.4: Developer Documentation
**Priority:** P1  
**Effort:** 6 hours  
**Dependencies:** None (can start Week 7)  
**Assignee:** Backend Dev 2

**Tasks:**
- [ ] Write API integration guide
- [ ] Document service and driver architecture
- [ ] Create database schema documentation
- [ ] Write code examples for common use cases
- [ ] Update CHANGELOG.md

**Acceptance Criteria:**
- API endpoints documented with examples
- Architecture diagrams included
- Database schema fully documented
- CHANGELOG entry complete
- Code examples tested

**Files Created:**
- `documentation/gam-api-integration.md`
- `documentation/gam-implementation-summary.md`

**Files Modified:**
- `CHANGELOG.md`

---

#### Feature 8.5: Production Deployment & Monitoring
**Priority:** P0 (Blocker)  
**Effort:** 8 hours  
**Dependencies:** Features 8.1, 8.2, 8.3  
**Assignee:** DevOps Engineer

**Tasks:**
- [ ] Deploy to production environment
- [ ] Run database migrations
- [ ] Update environment variables
- [ ] Configure monitoring and alerts
- [ ] Set up logging aggregation
- [ ] Create runbook for support team
- [ ] Verify OAuth credentials in production

**Acceptance Criteria:**
- Production deployment successful
- All migrations run successfully
- Monitoring alerts configured
- Logs aggregating correctly
- Support team trained
- Rollback plan tested

**Documentation:**
- Create GAM_DEPLOYMENT_RUNBOOK.md

---

## Parallel Development Opportunities

### Can Be Done Simultaneously (No Dependencies)

**Week 1-2:**
- Feature 1.1, 1.2, 1.3, 1.4 (all in parallel with different devs)
- Feature 2.4 (Frontend) while 2.1, 2.2 (Backend) in progress

**Week 3:**
- Feature 3.1, 3.2, 3.3 (Frontend) while Backend works on Sprint 4

**Week 5:**
- Features 5.1, 5.2, 5.3, 5.4 can be done in pairs (2 backend devs)

**Week 7-8:**
- Documentation (8.3, 8.4) can start during Week 7 while development finishing
- QA can start testing completed features before all features done

---

## Feature Dependency Graph

```
Sprint 1 Foundation
├── 1.1 OAuth Scopes (no deps)
├── 1.2 GAM Service Skeleton (no deps)
├── 1.3 GAM Driver Skeleton → 1.2
├── 1.4 Database Schema (no deps)
└── 1.5 Unit Tests → 1.1, 1.2, 1.3

Sprint 2 Network Listing
├── 2.1 listNetworks() → Sprint 1
├── 2.2 /networks Endpoint → 2.1
├── 2.3 Composable → 2.2
├── 2.4 Network UI → 2.3 (can parallelize)
└── 2.5 Integration Test → 2.1, 2.2

Sprint 3 Wizard UI
├── 3.1 Wizard Structure → Sprint 2
├── 3.2 Step 1 Auth → 3.1
├── 3.3 Step 2 Network → 3.1, 2.4
├── 3.4 Branding (no deps)
└── 3.5 Step 3 Config → 3.3

Sprint 4 Revenue Report
├── 4.1 Query Builder → Sprint 3
├── 4.2 Execution → 4.1
├── 4.3 Transform → 4.2
├── 4.4 Sync → 4.3
└── 4.5 Tests → 4.1-4.4

Sprint 5 More Reports
├── 5.1 Inventory → Sprint 4
├── 5.2 Orders → 5.1 (or parallel)
├── 5.3 Geography → 5.2 (or parallel)
├── 5.4 Device → 5.3 (or parallel)
└── 5.5 Report Selector → 5.1-5.4

Sprint 6 Sync Orchestration
├── 6.1 Date Picker (no deps)
├── 6.2 Step 4 UI → Sprint 5
├── 6.3 Add Data Source API → Sprint 5
├── 6.4 Sync Orchestration → 6.3, Sprint 5
└── 6.5 Status Tracking → 6.4

Sprint 7 Data Models
├── 7.1 DataModelProcessor → Sprint 6
├── 7.2 DataSourceProcessor → 7.1
├── 7.3 Unit Tests → 7.1, 7.2
├── 7.4 Frontend Update → 7.2
└── 7.5 AI Integration → 7.1, 7.2

Sprint 8 Launch
├── 8.1 Integration Tests → Sprint 7
├── 8.2 Manual QA → 8.1
├── 8.3 User Docs (can start Week 7)
├── 8.4 Dev Docs (can start Week 7)
└── 8.5 Deployment → 8.1, 8.2, 8.3
```

---

## Estimated Effort Summary

| Sprint | Features | Total Hours | Backend | Frontend | QA | DevOps |
|--------|----------|-------------|---------|----------|----|----|
| Sprint 1 | 5 | 24 hours | 14h | 0h | 10h | 0h |
| Sprint 2 | 5 | 32 hours | 18h | 14h | 0h | 0h |
| Sprint 3 | 5 | 30 hours | 0h | 30h | 0h | 0h |
| Sprint 4 | 5 | 36 hours | 30h | 0h | 6h | 0h |
| Sprint 5 | 5 | 30 hours | 18h | 6h | 6h | 0h |
| Sprint 6 | 5 | 34 hours | 28h | 6h | 0h | 0h |
| Sprint 7 | 5 | 24 hours | 18h | 4h | 2h | 0h |
| Sprint 8 | 5 | 42 hours | 6h | 2h | 20h | 14h |
| **Total** | **40** | **252 hours** | **132h** | **62h** | **44h** | **14h** |

**Team Capacity (8 weeks = 320 hours per person):**
- 2 Backend Devs: 640 hours (need 132h = 21% utilization)
- 2 Frontend Devs: 640 hours (need 62h = 10% utilization)
- 1 QA Engineer: 160 hours (need 44h = 28% utilization, part-time weeks 7-8)
- 1 DevOps: 40 hours (need 14h = 35% utilization, week 8 only)

**Buffer:** Significant buffer available for bug fixes, iterations, and unexpected complexity.

---

## Critical Path (Longest Dependency Chain)

```
1.1 OAuth → 1.2 Service → 1.3 Driver → 2.1 listNetworks() → 
2.2 API Endpoint → 2.3 Composable → 3.1 Wizard → 3.2 Auth UI → 
3.3 Network UI → 3.5 Config UI → 4.1 Revenue Query → 4.2 Execution → 
4.3 Transform → 4.4 Sync → 5.1 Inventory → 6.3 Add Data Source → 
6.4 Orchestration → 7.1 DataModelProcessor → 7.2 DataSourceProcessor → 
8.1 Integration Tests → 8.2 QA → 8.5 Deployment
```

**Critical Path Duration:** ~180 hours (factoring in dependencies)  
**With 2 Backend + 2 Frontend:** Can complete in 6 weeks with parallel work  
**With buffer for QA/docs:** 8 weeks is realistic

---

## Risk Mitigation Features

### High-Risk Features (Need Extra Attention)

1. **Feature 4.2: Revenue Report Execution** (8 hours)
   - Risk: GAM API rate limits, report timeout
   - Mitigation: Implement robust retry logic, exponential backoff
   - Test with large date ranges before production

2. **Feature 6.4: Sync Orchestration** (8 hours)
   - Risk: Partial failures, data consistency issues
   - Mitigation: Transaction management, comprehensive logging
   - Test with network failures mid-sync

3. **Feature 7.1-7.2: Data Model Integration** (8 hours)
   - Risk: Column name mismatches causing null values
   - Mitigation: Extensive unit tests, follow GA pattern exactly
   - Test all schema types together

---

## Daily Standups & Tracking

**Suggested Jira/GitHub Project Board Columns:**
1. Backlog (40 features queued)
2. Ready for Dev (dependencies met)
3. In Progress (assign to dev)
4. Code Review (PR submitted)
5. Testing (QA verification)
6. Done (merged, deployed)

**Daily Standup Questions:**
- What feature(s) did you complete yesterday?
- What feature are you working on today?
- Any blockers or dependencies waiting?

---

## Acceptance & Sign-Off

Each feature requires:
- [ ] Code review by peer (GitHub PR)
- [ ] Unit tests passing (if applicable)
- [ ] Manual testing by assignee
- [ ] Product owner approval (UI features)
- [ ] Merged to main branch

---

## Post-Launch Monitoring (Week 9+)

**Metrics to Track:**
- Sync success rate (target: >99.5%)
- Average sync duration (target: <5 min for 30 days)
- API error rate (target: <0.5%)
- User adoption (target: 100 users in 30 days)
- Support ticket volume

**Action Items:**
- Daily review of error logs
- Weekly sync performance analysis
- Bi-weekly user feedback review
- Monthly feature usage report

---

**Document Version:** 1.0  
**Created:** December 14, 2025  
**Status:** Ready for Sprint Planning  
**Next Step:** Review with team, assign features, create tickets
