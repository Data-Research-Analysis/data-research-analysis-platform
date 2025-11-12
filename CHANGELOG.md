# Changelog

All notable changes to the Data Research Analysis Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

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

## Earlier Commits (June 2025 and before)

### Infrastructure & Setup
- Initial Docker setup (DRA-10)
- CI/CD with Jenkins (DRA-15)
- Database migrations system (DRA-25)
- Testing infrastructure (DRA-44)

### Authentication & User Management
- Registration flow (DRA-19)
- Login flow (DRA-20)
- Email verification (DRA-22)
- Forgot password (DRA-21)
- Google reCAPTCHA integration (DRA-8)

### Core Features
- Project management (DRA-24)
- Data source connections (PostgreSQL DRA-31, Excel DRA-32)
- Data model builder (DRA-26, DRA-30)
- TypeORM migration from Sequelize (DRA-58)

### UI/UX
- Landing page development (DRA-7, DRA-12)
- Navigation drawer (DRA-12)
- Privacy policy & Terms (DRA-13, DRA-14)
- Marketing pages (DRA-9, DRA-33)

---

## Summary Statistics

**Total Commits Analyzed:** 300+
**Date Range:** June 2025 - November 2025
**Major Features Delivered:** 50+
**Lines of Code:** 100,000+ added

**Key Milestones:**
- Q2 2025: Foundation (Auth, Projects, Data Sources)
- Q3 2025: Dashboards & Visualizations
- Q4 2025: SSR Migration, Performance Optimization, Article Management

---

*This changelog is generated from git commit history and file changes. Each entry represents actual code modifications, not just commit messages.*
