# Changelog

All notable changes to the Data Research Analysis Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## 2025-12-06

### Added - Complete AI Data Modeler System (DRA-217)
**Files:** 30+ modified/new (backend services, controllers, routes, models, migrations, frontend components, stores, documentation)
- **AI-Powered Data Model Creation:** Integrated Google Gemini AI for intelligent, conversational data model building
- **Redis Session Management:** 24-hour TTL for active sessions with automatic cleanup
- **Database Persistence:** PostgreSQL tables for conversation history and model storage
- **Chat Interface Components:**
  - ai-data-modeler-drawer.vue: Main chat interface with navigation drawer
  - ai-chat-input.vue: Message input with send functionality
  - ai-chat-message.vue: Message display with user/assistant formatting
  - Historical conversation loading and resumption
- **Backend Services:**
  - RedisAISessionService: Complete session lifecycle management (create, save, transfer, clear)
  - GeminiService: AI integration with streaming responses
  - SchemaCollectorService: Database schema extraction and context building
  - AIDataModelerController: REST API endpoints for chat operations
- **Database Schema:**
  - dra_ai_data_model_conversations: Conversation metadata (draft/saved/archived status)
  - dra_ai_data_model_messages: Individual messages with role and content
  - Foreign keys and cascade deletion for data integrity
- **Documentation:** ai-data-modeler-implementation.md, ai-data-modeler-quick-start.md (568+ lines)
- **System Prompts:** Extensive AI roles for robust model generation with schema understanding
- **Features:** Auto-detection of JOINs, aggregate functions, column selection, WHERE conditions

### Fixed - Critical Query Reconstruction Issues (DRA-217)
**Files:** DataSourceProcessor.ts, data-model-builder.vue, JSON-QUERY-RECONSTRUCTION-FIX.md (608 lines), join-conditions-manager-*.md
- **JOIN Conditions Sync Issue:**
  - Fixed dual state management where `state.join_conditions` (component) was not syncing to `state.data_table.join_conditions` (backend)
  - Backend was receiving empty JOIN arrays causing PostgreSQL 42P01 errors
  - Implemented explicit sync after auto-detection in `applyAIGeneratedModel()`
  - Added sync verification with console logging
- **Aggregate Column Handling:**
  - Fixed GROUP BY containing aggregate-only columns (COUNT, SUM, AVG, etc.)
  - Three-layer defense: validation filter, application filter, defensive check
  - Columns used only in aggregates marked with `is_selected_column: false`
  - Automatic filtering prevents PostgreSQL 42803 errors
- **SQL Reconstruction from JSON:**
  - Backend `reconstructSQLFromJSON()` method rebuilds complete SQL with proper JOINs
  - Parses JSON query structure to construct FROM/JOIN clauses
  - Handles table aliases, WHERE conditions, GROUP BY, HAVING, ORDER BY
  - Prevents "missing FROM-clause entry for table" errors
  - Comprehensive logging for debugging query construction
- **Visual Indicators:**
  - Green borders for tables included via JOINs
  - Purple info boxes explaining aggregate-only column usage
  - Calculator icons for columns in aggregate functions
- **Documentation Updates:**
  - JSON-QUERY-RECONSTRUCTION-FIX.md: Backend reconstruction details with examples
  - join-conditions-manager-implementation.md: Full implementation guide (750+ lines)
  - join-conditions-manager-quick-reference.md: Troubleshooting guide with console diagnostics

### Enhanced - Data Model Builder Improvements (DRA-217)
**Files:** data-model-builder.vue (4203 lines)
- AI model application in edit mode with historical chat loading
- System prompt improvements for context-aware model generation
- Enhanced auto-detection algorithm for complex multi-table JOINs
- Defensive programming patterns for robust error handling
- Console diagnostic commands for debugging state synchronization

---

## 2025-12-03

### Fixed - Data Sources Not Loading on Login (DRA-218)
**Files:** Frontend pages/components, middleware
- Data sources now load correctly when user selects a project
- Eliminated need for manual page refresh after login
- Removed unnecessary console.log statements for cleaner logs

---

## 2025-11-30

### Enhanced - AI Data Modeler Integration
**Files:** ai-data-modeler-drawer.vue, data-model-builder.vue
- Integrated AI data modeler into edit data model page
- Fixed bug where historical chat conversations were not loading in navigation drawer
- Improved chat state management and conversation persistence

---

## 2025-11-26

### Added - Advanced View in Data Model Builder (DRA-215)
**Files:** data-model-builder.vue, related components
- **Simple View:** Existing controls for basic users (backwards compatible)
- **Advanced View:** Additional controls for power users
  - Column transforms for data manipulation
  - Aggregate column configuration (COUNT, SUM, AVG, MIN, MAX)
  - Advanced filtering and grouping options
  - Aggregate columns selectable in appropriate controls
- View toggle allows users to switch between complexity levels
- Enhanced query building capabilities with advanced SQL features

### Enhanced - Chart Tooltips and Visualization (DRA-215)
**Files:** Chart components
- Added detailed tooltips to all chart types (table, pie, bar, line, etc.)
- Improved data point clarity and user understanding
- Enhanced hover interactions with contextual information
- Better visualization of data relationships

---

## 2025-11-23

### Fixed - Navigation and JOIN Detection Issues
**Files:** Home page, data-model-builder.vue, middleware
- **Home Page Redirect:** Logged-in users now properly redirected to projects page
- **JOIN Detection Bug:** Fixed issue where multiple tables were not being correctly joined
  - Auto-detection algorithm improved for complex schemas
  - Multiple JOINs no longer missed or skipped
  - Proper handling of multi-table relationships

---

## 2025-11-20

### Added - Column Selection with Checkboxes (DRA-214)
**Files:** data-model-builder.vue, table selection components
- Checkbox added to each column in source tables for easy selection
- Eliminates need to drag columns for model building
- Improved user experience with faster column addition
- Drag-and-drop still available for users who prefer it

### Added - Chart Filtering Functionality (DRA-55)
**Files:** Chart components (table, pie, bar charts)
- Implemented filtering between table, pie chart, horizontal and vertical bar charts
- Cross-chart filtering for interactive data exploration
- Detailed tooltips added to all chart types
- Additional chart types filtering in testing phase

---

## 2025-11-18

### Fixed - Text Editor and Dashboard Issues (DRA-211)
**Files:** text-editor.vue, edit dashboard components, public dashboard pages
- Text content now loads correctly in edit dashboard text editor component
- Fixed TipTap editor showing in public dashboard URLs (should be read-only HTML)
- Removed unnecessary console.log statements

### Added - Article Publishing Management (DRA-213)
**Files:** Article edit pages, backend routes
- Implemented unpublish article functionality
- Added publish/unpublish toggle in edit article page
- Improved article lifecycle management
- Status tracking for published vs draft articles

---

## 2025-11-16

### Fixed - Column Alias and Chart Rendering (DRA-212)
**Files:** data-model-builder.vue, chart components, backend processors
- Column alias names now properly considered when creating data models
- Aliases reflected in query results and chart labels
- Fixed boolean and numerical column types not rendering charts correctly
- Chart type detection improved for all data types

---

## 2025-11-15

### Fixed - Aggregate and Calculated Columns (DRA-208)
**Files:** data-model-builder.vue, DataSourceProcessor.ts
- Fixed bug where aggregate columns (COUNT, SUM, AVG) were not being handled correctly
- Calculated columns now working properly in data model builder
- Removed unnecessary code for cleaner implementation
- Improved validation for aggregate function usage

---

## 2025-11-14

### Added - Database Backup and Restore System (DRA-101)
**Files:** 23 modified/new (backend services, routes, workers, frontend pages, composables, Docker)
- Implemented comprehensive database backup and restore functionality for PostgreSQL
- Backend: DatabaseBackupService with pg_dump/psql integration, ZIP compression, metadata management
- Frontend: Dashboard, backup creation, and restore pages with drag-drop file upload
- Real-time progress updates via Socket.IO for backup/restore operations
- Queue system integration for background job processing
- Docker: Updated Dockerfile to install PostgreSQL 17 client tools
- Storage: Automatic directory structure (sql, temp, metadata) with cleanup policies
- Security: Admin-only access with JWT token validation including user_type field
- Features: Backup list with download/delete, restore with typed confirmation, automatic logout after restore

### Optimized - Middleware API Calls (DRA-208)
**Files:** 3 modified (01-authorization, 02-load-data, 03-validate-data middleware) + MIDDLEWARE_OPTIMIZATION_SUMMARY.md
- **Authorization Optimization:** Skip token validation API for public routes (40% reduction in auth calls)
- **Route-Specific Data Loading:** Load only required data based on current route pattern
  - `/projects` → Projects only
  - `/projects/[id]` → Projects + Data Sources
  - `/projects/[id]/data-sources/**` → Add Data Models
  - `/projects/[id]/dashboards/**` → Add Dashboards
  - `/admin/articles/**` → Categories + Articles only
  - `/admin/users/**` → Users only
  - `/admin/database/**` → No data loading
- **Smart Caching:** 5-minute timestamp-based cache per data type, prevents redundant API calls
- **Validation Optimization:** Skip validation for routes without parameters (50% reduction)
- **Overall Impact:** 60-85% reduction in API calls, significantly faster page loads, reduced backend load

## 2025-11-12

### Fixed - Article Editor Redirects (DRA-203)
**Files:** 7 modified (text-editor.vue, middleware files, article pages, api-loader.ts, prefetch-links.client.ts)
- Prevented automatic redirects when editing/typing in article editor
- Added image upload tracking with inline visual feedback
- Excluded image upload endpoints from global loader
- Disabled prefetch on `/admin` routes to prevent navigation interference
- Added navigation guards with unsaved changes warning
- Wrapped middleware in try-finally blocks for proper batch context cleanup

### Added - Batch Loading System (DRA-202)
**Files:** 4 modified (useGlobalLoader.ts, route-loader middleware, authorization, load-data)
- Implemented batch loading context system for unified loader experience
- Single global loader shows during entire navigation lifecycle
- Batch tracking with unique IDs per route change
- Context cleanup ensures no loader state leakage

### Added - Navigation Performance Optimizations (DRA-205)
**Files:** 21 modified (middleware, pages, components, plugins, documentation)
- Created 5 skeleton components (text, box, card, grid, table) for instant perceived loading
- Implemented parallel API loading with `Promise.all()` (60% faster data loading)
- Added token validation caching (30-second duration, 0ms on cache hit)
- Created prefetch plugin with hover and viewport detection
- Added performance instrumentation with timing logs
- Integrated skeleton loaders in projects, dashboards, and data-models pages
- Documentation: Added 3 comprehensive markdown files (NAVIGATION_*.md)

---

## 2025-11-11

### Added - Global Loader System (DRA-202)
**Files:** 4 new files (useGlobalLoader.ts, route-loader middleware, api-loader plugin, sweetalert2 updates)
- Global loader displays on route changes and API calls
- Automatic loader management via composable
- SweetAlert2 integration for loading states
- API interceptor plugin for fetch requests

### Added - Data Model Refresh (DRA-96)
**Files:** Backend (migration, processor, routes) + Frontend (data-models page)
- Refresh button added to each data model card
- Dashboard validation with `needs_validation` column
- Backend validation logic for dashboard data integrity
- Processor methods for model refresh and dashboard validation

---

## 2025-11-09

### Added - Edit Data Source Functionality (DRA-118)
**Files:** 3 new edit pages (mariadb, mysql, postgresql) + backend processor/routes
- Edit pages for MariaDB, MySQL, and PostgreSQL data sources
- Backend update logic with connection validation
- Renamed `postgres.vue` to `postgresql.vue` for consistency

### Changed - Console Log Cleanup
**Files:** 6 files (backend setup, models, services, frontend middleware, plugins)
- Removed unnecessary console.log statements

### Documentation - Architecture Updates
**Files:** 15 documentation files (diagrams, comprehensive docs)
- Added cascade deletion sequence diagram (PNG + PUML)
- Updated all PlantUML diagrams with new content
- Expanded comprehensive architecture documentation (588 lines → 1697 lines)
- Enhanced frontend components, backend models, and services class diagrams

### Fixed - SSR Data Store Integration
**Files:** 18 files (stores, middleware, pages, composables)
- Fixed Pinia store + localStorage interaction for SSR
- Refactored API calling to only refresh when data changes in database
- Improved store retrieval logic with better caching

---

## 2025-11-08

### Fixed - Cascade Deletion Logic
**Files:** Backend models (all entities), processors (DataModel, DataSource, Project)
- Added `onDelete: 'CASCADE'` to all foreign key relationships
- Implemented multi-level deletion logic
- Fixed referential integrity constraints

### Changed - Data Retrieval Guards
**Files:** load-data middleware
- Disabled guard preventing data retrieval on each request

---

## 2025-11-07

### Added - Project Descriptions (DRA-199)
**Files:** Migration, DRAProject model, processor, create/edit pages
- Optional description field for projects
- Substring display on project cards
- Full description shown inside project view

---

## 2025-11-04

### Changed - Data Loading Architecture Refactor (DRA-198)
**Files:** 10 files (new middleware, layout refactor, store updates)
- Created new `02-load-data.global.ts` middleware for centralized data loading
- Created `03-validate-data.global.ts` for data existence validation
- Renamed `authorization.global.ts` to `01-authorization.global.ts` for order clarity
- Removed 124 lines of data loading logic from default layout
- Pages now retrieve data from stores instead of direct API calls
- More robust and maintainable middleware flow

---

## 2025-11-03

### Fixed - SSR Migration Bugs (DRA-197)
**Files:** 32 files (major refactor - composables, middleware, pages, stores, plugins)
- Created 9 new SSR-compatible composables (useAuthenticatedFetch, useProjects, useDashboards, etc.)
- Added `init-user.client.ts` plugin for client-side user initialization
- Renamed `vuetippy.ts` to `vuetippy.client.ts` for client-only execution
- Fixed API calling patterns for SSR compatibility
- Updated all pages to use new composables
- Added 68 new composable functions across 7 files
- Backend: Added user validation endpoints

### Fixed - Minor Bugs
**Files:** useProjects composable, useDataSources composable
- Fixed useProjects auto-import issue
- Fixed loader showing indefinitely in data sources

---

## 2025-11-02

### Added - Server-Side Rendering (SSR) Enabled (DRA-197)
**Files:** 45 files (massive migration - documentation, composables, stores, pages, tests)
- Enabled SSR (was client-only due to performance issues)
- Created 4 comprehensive SSR documentation files (517-698 lines each)
- Added `SSRPerformance.ts` composable with 285 lines
- Created error.vue page for error handling
- Added 2 test files (ssr-compatibility + validation utilities)
- Updated all stores for SSR compatibility
- Modified 18 components for SSR hydration
- Added app.vue with SSR-specific logic

### Added - Markdown Support for Articles (DRA-196)
**Files:** 19 files (backend utilities, frontend editor, tests, migrations, documentation)
- Comprehensive markdown-to-HTML conversion system
- Two-way editing (markdown ↔ visual editor)
- Added markdown column to articles table
- Backend ArticleMigrationUtility (257 lines)
- Test file with 457 test cases
- Migration documentation (377 lines)
- Updated TipTap editor with markdown toggle

### Added - Data Encryption (Security)
**Files:** 10 files (new EncryptionService, tests, migration, documentation)
- Two-way encryption for `connection_details` column in data sources
- AES-256-GCM encryption algorithm
- EncryptionService with 226 lines
- Comprehensive test suite (499 lines)
- Added encryption key to environment configuration
- Encryption implementation summary documentation (424 lines)

---

## 2025-10-30 to 2025-10-29

### Fixed - Data Type Handling
**Files:** DataModelProcessor, DataSourceProcessor
- Fixed timezone format saving for date/time columns
- Fixed JSON column type handling bugs
- Enhanced data type parsing methods
- Added 368 lines of type handling logic

---

## 2025-10-29

### Added - Test Database Infrastructure
**Files:** Docker files, shell scripts, documentation
- Added MariaDB and MySQL test databases in docker-compose
- Created database reset scripts (mariadb-reset.sh, mysql-reset.sh)
- Added test database Dockerfiles
- Documentation: MariaDB-Fix-Summary.md (116 lines), MySQL-Fix-Summary.md (147 lines)

### Fixed - Data Model Building
**Files:** DataModelProcessor, DataSourceProcessor
- Fixed null values being saved in data models
- Improved data population logic

---

## 2025-10-27

### Fixed - UI and Data Model Bugs
**Files:** data-model-builder.vue, DataSourceProcessor
- Fixed overflow in data model builder results table
- Fixed column name bug in build data model method

---

## 2025-10-26

### Fixed - PDF Processing
**Files:** AmazonTextExtractDriver, custom-data-table, data-model-builder
- Refactored PDF data source processing
- Fixed Amazon Textract integration bugs
- Improved text wrapping in data tables

### Fixed - User Interface
**Files:** header-nav.vue
- Fixed first character display in user menu

---

## 2025-10-25

### Added - User Management System (DRA-138)
**Files:** 11 new files (processor, routes, pages, store, types)
- Complete user management in admin panel
- User creation, editing, and deletion
- User list with 180 lines in index page
- Email sending for newly created users
- Welcome email template (184 lines)

### Added - Private Beta User Management (DRA-139)
**Files:** Backend processor/routes + frontend pages/store
- Private beta user list in admin panel
- Convert beta users to full users
- Conditional UI for conversion status
- Email notifications for conversions

### Fixed - Authorization Security Bug
**Files:** authorization.global.ts middleware
- Fixed major bug allowing unauthorized access
- Improved middleware logic (47 lines → 47 lines refactored)

### Fixed - User Deletion with Cascade
**Files:** UserManagementProcessor
- Users now properly deleted with all associated data
- Handles referential integrity

---

## 2025-10-24

### Changed - Private Beta Preparation (DRA-135)
**Files:** Multiple configuration and frontend files
- Updated data sources section on homepage
- Added environment conditionals for production
- Fixed Socket.IO environment handling
- Updated image imports for dynamic loading
- Replaced waitlist form with private beta form

---

## 2025-10-19 to 2025-10-18

### Fixed - Dashboard Data Models
**Files:** DataSourceProcessor
- Fixed bug where not all data models showed in dashboard

### Added - Chart Interactivity
**Files:** Chart components
- Added click handlers to charts for future filtering

### Documentation - Architecture and Configuration
**Files:** PlantUML files, README, .env.example
- Updated architecture diagrams
- Added explanatory comments to environment files
- Reorganized README sections

---

## 2025-10-18 to 2025-10-17

### Added - Excel Multi-Sheet Support (DRA-132)
**Files:** custom-data-table, excel connect page
- Multiple sheets support in Excel data source
- Sheet selection in data table
- Column renaming functionality
- Add row/column functionality

---

## 2025-10-14

### Added - PDF Multi-Page Support (DRA-129)
**Files:** Backend processors, queue system, frontend components
- Multiple pages support in PDF data source
- PDF to images conversion via queue
- Amazon Textract integration
- Non-table text extraction
- Excel file generation from extracted data

---

## 2025-10-01 to 2025-09-27

### Added - PDF Data Source Foundation (DRA-129)
**Files:** Socket.IO setup, queue infrastructure
- Working on PDF upload data source
- Socket.IO and queue setup

---

## 2025-09-21

### Added - Forgot Password Flow (DRA-21)
**Files:** Backend processor/routes, frontend pages
- Complete forgot password implementation
- Email verification with codes

### Fixed - Dashboard Export
**Files:** Dashboard pages, chart components
- Fixed chart overflow in exported dashboards
- Added overflow-x-auto styling

---

## 2025-09-18 to 2025-09-15

### Added - Public Dashboard Export (DRA-124)
**Files:** DashboardExportMetaData model, public dashboard page
- Public dashboard accessible without authentication
- Enhanced multi-line chart (287 lines → 418 lines)
- Export to image functionality (html-to-image integration)

### Enhanced - Chart Improvements
**Files:** Vertical bar chart, stacked bar chart
- X-axis rotation and dynamic positioning
- Y-axis label customization
- Large number formatting (1000 → 1k, 1M → 1m)

---

## 2025-09-14 to 2025-09-13

### Fixed - Chart Data and UX
**Files:** Stacked bar chart, horizontal bar chart, dashboard pages
- Fixed USER-DEFINED column not being added
- Fixed data bugs in stacked bar chart
- Improved dashboard sidebar expand/collapse
- Fixed export data validation bug

---

## 2025-09-13 to 2025-09-06

### Added - Dashboard Export Infrastructure (DRA-75)
**Files:** New model/migration, export page, dashboard enhancements
- DRADashboardExportMetaData table
- Public dashboard export page (655 lines)
- Dashboard UX improvements

### Added - Bubble Chart (DRA-70)
**Files:** bubble-chart.vue component
- Complete bubble chart implementation (144 lines)
- Integration in create/edit dashboard

### Fixed - Calculated Columns
**Files:** DataModelProcessor, DataSourceProcessor
- Fixed bug where calculated columns not showing in dashboard
- Added to both data model and data source processing

---

## 2025-09-05 to 2025-09-04

### Added - Excel Data Source Completion (DRA-32)
**Files:** DataSourceProcessor, custom data table, backend types
- Completed Excel data source implementation
- Table drop logic for dra_excel schema
- Column selection and removal
- Data table with edit capabilities
- Fixed data focus bug in input fields

---

## 2025-08-29 to 2025-08-24

### Added - Excel Data Source Foundation (DRA-32)
**Files:** CustomDataTable component, ExcelFileService, frontend pages
- Working on Excel file data source
- Custom data table component (704 lines)
- File upload and parsing

---

## 2025-08-16

### Added - MariaDB Data Source (DRA-114)
**Files:** MariaDB driver/datasource, connection page
- Complete MariaDB data source implementation
- MariaDBDriver with 126 lines
- Connection page (247 lines)

### Added - MySQL Data Source (DRA-31)
**Files:** MySQL driver/datasource, UtilityService updates, connection page  
- Complete MySQL data source implementation
- MySQLDriver with 126 lines
- Enhanced UtilityService (172 new lines)
- Connection page (247 lines)

---

## 2025-08-12 to 2025-08-11

### Added - Chart Components
**Files:** Treemap, table chart, multi-line chart
- Treemap chart (344 lines)
- Table chart with scrolling (435 lines)
- Enhanced multi-line chart (804 lines)

---

## 2025-08-10

### Added - Stacked Bar Chart (DRA-67)
**Files:** stacked-bar-chart.vue
- Complete implementation (276 lines)
- X/Y axis label customization

### Added - Screenshot Images (DRA-110)
**Files:** 8 PNG screenshots in backend/public/screenshots
- Dashboard, data model builder, projects, data sources views

---

## 2025-08-09 to 2025-08-08

### Added - Calculated Field Numeric Input (DRA-108)
**Files:** data-model-builder component
- Numeric field input for calculated columns
- Allows numbers in expressions

### Added - Vertical Bar-Line Chart (DRA-66)
**Files:** vertical-bar-chart.vue, dashboard pages
- Combined bar and line chart visualization
- Enhanced settings configuration

---

## 2025-08-04 to 2025-08-03

### Fixed - Calculated Column Single Table Bug (DRA-109)
**Files:** data-model-builder.vue
- Fixed bug where calculated column not added with single table

### Added - Table Dialog for Charts (DRA-107)
**Files:** Dashboard create/edit pages
- Table view dialog for selected charts
- Displays underlying data

---

## 2025-08-02

### Added - Calculated Column Feature (DRA-105)
**Files:** data-model-builder (225 lines), vertical bar chart updates
- Comprehensive calculated column implementation
- Expression builder for custom fields
- Integration with charts

---

## 2025-07-26

### Changed - Landing Page Redesign (DRA-104)
**Files:** 22 files (components, assets, pages)
- Story Brand framework (Marketing Made Simple)
- New components: problems.vue, we-understand.vue, why-dra.vue, join-wait-list.vue
- Added hero images (data-cloud-analytics.png, fedup-user.png)
- Removed features.vue and about.vue (157 lines removed)
- Total 532 additions, 305 deletions

---

## 2025-07-20

### Added - Data Model Column Control (DRA-62)
**Files:** data-model-builder, dashboard pages
- Prevent specific columns from being added while allowing joins
- Column alias for GROUP BY aggregates
- Fixed column alias spacing bugs

---

## 2025-07-17 to 2025-07-16

### Added - Sitemap and Horizontal Bar Chart (DRA-103, DRA-65)
**Files:** sitemap.txt, horizontal-bar-chart component
- Public sitemap.txt file
- Horizontal bar chart (173 lines)
- X/Y axis label inputs for vertical bar chart

---

## 2025-07-13

### Fixed - Deployment Issues (DRA-100)
**Files:** Backend index, auth routes, Jenkinsfile, docker-compose
- ESM compatibility fixes throughout backend
- Try-catch blocks in authentication
- Removed testdb service from docker-compose
- Updated Jenkinsfile deployment logic

---

## 2025-07-12 to 2025-07-10

### Changed - Full ESM Migration (DRA-100)
**Files:** 55 backend files (models, processors, routes, drivers)
- Complete migration to ES Modules
- Updated all imports/exports
- TypeScript config changes
- 517 additions, 324 deletions

---

## 2025-07-11 to 2025-07-09

### Added - Vertical Bar Chart & Donut Chart (DRA-63, DRA-65)
**Files:** vertical-bar-chart (147 lines), donut-chart (117 lines)
- Complete vertical bar chart implementation
- Complete donut chart implementation

### Fixed - User Registration
**Files:** AuthProcessor
- Fixed user_type not being set during registration

---

## 2025-07-06 to 2025-07-05

### Added - Public Articles System (DRA-81, DRA-93)
**Files:** Backend routes/processors, frontend pages, store updates
- Public article view by slug
- Public articles list
- Added `slug` and `created_at` columns to articles
- Article routes and processor methods
- Frontend articles pages and navigation

### Added - Article Management CRUD (DRA-76, DRA-79, DRA-80)
**Files:** Multiple backend/frontend files for articles
- Edit article functionality with image upload
- Delete article functionality
- List articles with publish/draft status
- Image upload API endpoint
- TipTap text editor integration
- Article store with 20+ methods

---

## 2025-07-04 to 2025-07-03

### Added - Article Categories CRUD (DRA-85, DRA-86, DRA-87, DRA-88)
**Files:** Backend processors/routes, frontend pages
- List article categories
- Add article category
- Edit article category
- Delete article category
- Article-Category relationship tables

---

## 2025-07-03 to 2025-07-01

### Added - Article Infrastructure (DRA-76, DRA-82)
**Files:** Models, migrations, processors, components, pages
- DRAArticle, DRACategory, DRAArticleCategory models
- Article creation with multi-select categories
- TipTap text editor component (155 lines)
- Admin routes authorization
- User type system (Admin vs Regular)
- Admin sidebar component (46 lines)

---

## 2025-06-29 to 2025-06-28

### Added - Text Editor Component (DRA-83, DRA-84)
**Files:** text-editor.vue, TipTap dependencies
- TipTap headless editor integration (239 lines)
- Rich text editing capabilities
- Text justification and alignment
- Integrated into dashboard

---

## 2025-06-26 to 2025-06-21

### Added - Dashboard Edit & List (DRA-54, DRA-52)
**Files:** Backend processor/routes, frontend pages
- Edit dashboard functionality
- List dashboards feature
- Sidebar dashboard navigation
- Dashboard data types (IDimension, ILocation, IColumn)

---

## 2025-06-20

### Added - Dashboard Foundation (DRA-53)
**Files:** DRADashboard model, processor, routes, pie chart, pages
- Created dashboard infrastructure
- Removed visualization models (replaced with embedded dashboard data)
- Pie chart component (116 lines)
- Dashboard create page (210 lines)
- Drag and resize functionality for chart placement

---

## 2025-06-18 to 2025-06-05

### Added - Dashboard Drag & Resize (DRA-53)
**Files:** Dashboard create page iterations
- Draggable div implementation
- Resize functionality with visual controls
- Grid-based layout system
- Multiple iterations to optimize UX

---

## 2025-06-05 to 2025-06-01

### Changed - Dashboard Flow Redesign
**Files:** 19 files (visualization to dashboard flow)
- Removed individual visualization creation flow
- Implemented direct dashboard creation (similar to Power BI)
- Added drag and resize functionality for chart placement
- Created pie-chart and multi-line-chart components
- Improved user experience with direct chart placement

---

## 2025-05-31

### Changed - Visualization Models Update
**Files:** Backend models, frontend visualization page
- Updated DRAVisualization and DRAVisualizationModel
- Added chart type asset images (gray and colored versions)
- Enhanced visualization creation flow
- Added D3.js plugin

---

## 2025-05-28 to 2025-05-21

### Added - Visualization System
**Files:** 50 files (models, processors, routes, pages, stores)
- Visualization infrastructure with DRAVisualization model
- Chart type assets (11 chart types)
- Tabs component for project navigation
- Sidebar enhancements for visualization listing
- data_exists.global middleware for data validation
- Visualization store with CRUD operations

### Fixed - Data Model Builder
**Files:** DataModelProcessor
- Fixed incorrect table joining in query builder
- Improved JOIN clause generation

---

## 2025-05-17

### Changed - Sequelize to TypeORM Migration (DRA-58)
**Files:** 65 files (complete data layer overhaul)
- Replaced Sequelize ORM with TypeORM
- Renamed all models with DRA prefix (DRAProject, DRADataSource, etc.)
- Created PostgresDSMigrations.ts and PostgresDataSource.ts
- New migration system using TypeORM
- Refactored all processors for TypeORM syntax
- Updated seeders to TypeORM format
- Docker configuration updates
- 2078 additions, 1338 deletions

---

## 2025-05-04 to 2025-05-03

### Added - Edit Data Model (DRA-49)
**Files:** data-model-builder component, edit page, backend processor
- Complete edit functionality for data models
- Extracted data-model-builder into reusable component (763 lines)
- Backend update methods in DataModelProcessor

---

## 2025-05-02

### Documentation - Project Templates
**Files:** GitHub issue templates, CONTRIBUTING.md
- Bug report template
- Feature request template
- Contributing guidelines

---

## 2025-05-01

### Added - Testing Infrastructure (DRA-44)
**Files:** Vitest config, test files for hero and notched-card components
- Unit testing setup with Vitest
- Component test examples
- 7889 additions to package-lock.json

### Added - Delete Data Model (DRA-30)
**Files:** Backend processor/routes, frontend data models page
- Delete data model functionality
- Authentication conditions in footer navigation
- Renamed methods for consistency

### Added - Pull Request Template
**Files:** .github/PULL_REQUEST_TEMPLATE.md
- PR template with 43 lines

---

## 2025-04-29 to 2025-04-27

### Added - Landing Page Enhancements
**Files:** README, components, assets
- Animated GIFs in README (build-data-model, data-sources, platform)
- Hero section video (55MB platform.mp4)
- Data source logos (Excel, MariaDB, MongoDB, MySQL, PostgreSQL)
- add-external-data-source and build-data-model components
- Git LFS enabled for large files
- Navigation drawer auto-close on link click

### Added - Access Control Toggle
**Files:** Frontend .env, composables, navigation components
- Environment variable to enable/disable platform access
- Conditional login/register link visibility

---

## 2025-04-26

### Added - Data Model Builder Complete
**Files:** 17 files (processors, routes, stores, pages)
- Full data model creation flow completed
- GROUP BY, ORDER BY, OFFSET, LIMIT clause support
- Column selection with drag-drop interface
- JOIN operations between tables
- WHERE clause filtering
- DataModelProcessor with query generation
- data_models store with 66 lines

---

## 2025-04-19

### Added - Query Builder Enhancements
**Files:** data-models/create.vue, overlay-dialog
- ORDER BY, OFFSET, LIMIT clauses
- Improved drag-drop UX for column selection
- 268 additions to create page

---

## 2025-04-14

### Added - Query Builder Foundation
**Files:** data-models/create page, DataSourceProcessor
- Drag-drop query builder (312 lines)
- Column selection clause
- FROM and JOIN clauses
- WHERE clause (in progress)
- Changed header flag to Authorization-Type

---

## 2025-04-12 to 2025-04-11

### Fixed - Authorization Issues
**Files:** Backend middleware, frontend composables
- Debugging Authorization-Type header
- Console logging for API failure tracking
- Hidden cloud access links temporarily

---

## 2025-04-07

### Added - PostgreSQL Data Source Foundation (DRA-31)
**Files:** 62 files (major feature)
- PostgreSQL connection functionality
- Data source creation flow
- Data models infrastructure
- Breadcrumbs component
- Sidebar with data source/model navigation
- Stores: data_sources, data_models, projects
- Types: IDataSource, IDataModel, IDataModelColumn, IDataModelRelationship
- Backend: DataSourceProcessor (141 lines), PostgresDriver enhancements
- Demo seeders for data sources
- Frontend pages for connecting to PostgreSQL, creating/viewing data models

---

## 2025-04-01

### Added - Data Source Infrastructure
**Files:** Backend migrations, drivers, models
- Data sources, data models, columns, relationships migrations
- Enhanced PostgresDriver and DBDriver
- Foundation for data source management

---

## 2025-03-28

### Documentation - Planned Features
**Files:** README.md
- Added comprehensive planned features section

---

## 2025-03-26

### Added - Projects Flow (DRA-24)
**Files:** 26 files (complete project management)
- Project creation, listing, and management
- notched-card component for project cards
- authorization.global middleware
- Projects seeder with demo data
- SweetAlert2 integration
- Enhanced header navigation with dropdown menu
- Token validation improvements

---

## 2025-03-25

### Added - Loading Spinner
**Files:** Login and register pages
- Improved spinner component
- Loading states for authentication

---

## 2025-03-23

### Added - Cloud Access Menu
**Files:** Navigation drawer
- Cloud access menu in mobile navigation

---

## 2025-03-22

### Added - Email Verification System (DRA-22)
**Files:** 32 files (complete email flow)
- Email verification with codes
- Unsubscribe functionality
- Resend verification code
- HTML email templates
- NodeMailer driver integration
- Template engine service
- VerificationCodes model and migration
- Documentation: README, CHANGELOG, CODE_OF_CONDUCT, LICENSE

---

## 2025-03-19

### Changed - Data Layer Refactor (DRA-26)
**Files:** Backend drivers, models, processors
- Improved DBDriver and PostgresDriver structure
- Better error handling and connection management
- Refactored data access patterns

---

## 2025-03-16

### Added - Login Flow (DRA-20)
**Files:** 15 files (authentication system)
- Complete login implementation
- Menu dropdown component
- Auth composable
- Enhanced header navigation with user menu
- Projects page foundation
- Token-based authentication

---

## 2025-03-15

### Added - Registration Flow (DRA-19)
**Files:** 18 files (user registration)
- Complete registration UI and backend
- UsersPlatform model and migration
- AuthProcessor for user management
- Validator middleware
- Form validation composable
- VueTippy integration for tooltips

---

## 2025-03-14

### Changed - Project Structure Reorganization
**Files:** 73 files (major restructure)
- Merged marketing and platform codebases
- Single backend and frontend folders
- Simplified project structure
- Updated Docker configuration
- Combined Jenkinsfile

---

## 2025-03-07

### Added - Google Tag Manager Integration
**Files:** Nuxt config, package.json
- Google Tag integration for analytics

---

## 2025-02-23 to 2025-02-21

### Added - CI/CD Pipeline (DRA-15)
**Files:** Jenkinsfile, ecosystem configs
- Complete Jenkins pipeline setup
- PM2 process management
- Frontend and backend deployment stages
- Environment variable management

### Fixed - Navigation and Styling
**Files:** Navigation drawer, footer, header
- Fixed navigation drawer bugs
- Improved spacing and layout
- Removed unnecessary content

---

## 2025-02-22

### Added - Legal Pages
**Files:** Privacy policy and terms & conditions pages
- Privacy policy page (359 lines)
- Terms & conditions page (218 lines)
- Scroll-to-top button
- Enhanced footer navigation

---

## 2025-02-21

### Added - Google reCAPTCHA Integration (DRA-8)
**Files:** 20 files (database and captcha)
- Google reCAPTCHA implementation
- PostgresDriver (44 lines)
- Database migrations setup
- User model
- TokenProcessor
- Home routes with authentication
- Spinner component
- WinstonLogger service

---

## 2025-02-19

### Added - Navigation Drawer (DRA-12)
**Files:** Navigation drawer component
- Mobile-responsive navigation drawer (51 lines)
- Enhanced header navigation for mobile

---

## 2025-02-17 to 2025-02-16

### Added - Docker Infrastructure (DRA-10)
**Files:** Docker configs, backend marketing
- Complete Docker setup with backend-marketing
- Database marketing service
- Backend TypeScript setup
- Environment configuration

---

## 2025-02-15

### Changed - Project Organization
**Files:** Folder structure
- Separated marketing and platform code
- Renamed folders: frontend-marketing, backend-marketing, frontend-platform, backend-platform

---

## 2025-02-14 to 2025-02-13

### Added - Landing Page Foundation (DRA-7)
**Files:** 11 files (marketing site)
- Mobile responsive landing page
- About component
- Improved community and features sections
- Removed signup form and timeline (design change)

---

## 2025-01-30

### Added - Initial Landing Page
**Files:** 34 files (initial project)
- Nuxt 3 frontend setup
- Components: hero, footer, header, community, features, timeline
- Font Awesome integration
- Tailwind CSS configuration
- Docker frontend setup
- Assets: sheets.png, logo, favicons, background SVGs

---

## 2024-12-25

### Added - First Commit
**Files:** README.md
- Initial repository creation
- Project inception

### Added - Core Platform Foundation
**Files:** Complete initial project setup

**Backend Infrastructure:**
- Express.js server setup
- TypeScript configuration
- Database migrations (9 migration files)
- Models: User, UsersPlatform, VerificationCodes, Projects, DataSources, DataModels, Columns, Relationships
- Processors: AuthProcessor, ProjectProcessor, DataSourceProcessor
- Routes: auth, home, project, data_source
- Middleware: authenticate
- Drivers: PostgresDriver, DBDriver, FileDriver, MailDriver, NodeMailerDriver, HTMLFileDriver
- Services: UtilityService, TemplateEngineService

**Frontend Infrastructure:**
- Nuxt 3 setup with TypeScript
- Tailwind CSS configuration
- Font Awesome integration
- Vue components: hero, footer-nav, header-nav, navigation-drawer, breadcrumbs, notched-card, overlay-dialog
- Pages: index (landing), login, register, projects, verify-email, unsubscribe, forgot-password, privacy-policy, terms-conditions
- Layouts: default layout with navigation
- Middleware: authorization.global
- Stores: projects (Pinia)
- Composables: Utils, AuthToken
- Types: IProject, IUsersPlatform

**Docker & CI/CD:**
- Docker Compose setup with backend, frontend, database services
- Dockerfiles for each service
- Jenkinsfile for CI/CD pipeline
- Environment configuration (.env.example files)

**Authentication & User Management:**
- Complete registration flow with email verification
- Login system with JWT tokens
- Password reset functionality
- Google reCAPTCHA integration
- User roles and permissions

**Project Management:**
- Create, list, view projects
- Project-based data organization
- Breadcrumb navigation

**Documentation:**
- README with project overview
- Contributing guidelines
- Code of conduct
- License
- Pull request and issue templates

---

## Summary Statistics

**Total Commits Analyzed:** 400+
**Date Range:** December 2024 - November 2025
**Major Features Delivered:** 50+
**Lines of Code:** 100,000+ added

**Key Milestones:**
- Q2 2025: Foundation (Auth, Projects, Data Sources)
- Q3 2025: Dashboards & Visualizations
- Q4 2025: SSR Migration, Performance Optimization, Article Management

---

*This changelog is generated from git commit history and file changes. Each entry represents actual code modifications, not just commit messages.*
