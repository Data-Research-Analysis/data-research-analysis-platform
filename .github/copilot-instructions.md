# Data Research Analysis Platform - AI Coding Agent Instructions

## Project Overview
Full-stack data analytics platform (similar to Tableau/Power BI) built with Vue3/Nuxt3 SSR frontend, Node.js/Express/TypeScript backend, and PostgreSQL. Users connect multiple data sources (PostgreSQL, MySQL, MariaDB, CSV, Excel, PDF), build data models with AI assistance, and create interactive dashboards.

## Architecture Essentials

### Backend: Singleton Processor Pattern
**Critical**: Business logic lives in singleton Processors (11 total), NOT controllers/routes. Controllers are thin orchestrators.

**Pattern Example** ([AuthProcessor.ts](backend/src/processors/AuthProcessor.ts)):
```typescript
export class AuthProcessor {
    private static instance: AuthProcessor;
    public static getInstance(): AuthProcessor {
        if (!AuthProcessor.instance) {
            AuthProcessor.instance = new AuthProcessor();
        }
        return AuthProcessor.instance;
    }
    // All auth business logic here
}
```

**Processors**: `AuthProcessor`, `ProjectProcessor`, `DataSourceProcessor`, `DataModelProcessor`, `DashboardProcessor`, `UserProcessor`, `UserManagementProcessor`, `TokenProcessor`, `ArticleProcessor`, `CategoryProcessor`, `PrivateBetaUserProcessor`

### Frontend: Pinia Stores with localStorage Sync
**Pattern**: All 9 Pinia stores automatically sync to localStorage on client ([projects.ts](frontend/stores/projects.ts)):
```typescript
function setProjects(projectsList: IProject[]) {
    projects.value = projectsList
    if (import.meta.client) {
        localStorage.setItem('projects', JSON.stringify(projectsList));
        enableRefreshDataFlag('setProjects');
    }
}
```

**Stores**: `projects`, `data_sources`, `data_models`, `dashboards`, `logged_in_user`, `articles`, `private_beta_users`, `user_management`, `ai-data-modeler`

### TypeORM Models with Automatic Encryption
**Critical**: Sensitive fields (connection_details, credentials) auto-encrypt via `ValueTransformer` ([DRADataSource.ts](backend/src/models/DRADataSource.ts)):
```typescript
const connectionDetailsTransformer: ValueTransformer = {
    to(value): any { return EncryptionService.getInstance().encrypt(value); },
    from(value): any { return EncryptionService.getInstance().decrypt(value); }
};

@Entity('dra_data_sources')
export class DRADataSource {
    @Column({ type: 'jsonb', transformer: connectionDetailsTransformer })
    connection_details!: IConnectionDetails
}
```

## Developer Workflows

### Setup & Migration Commands
```bash
# Create required volumes first
docker volume create data_research_analysis_postgres_data
docker volume create data_research_analysis_redis_data

# Build and start services
docker-compose build && docker-compose up

# Inside backend container/directory:
npm run migration:run                      # Run migrations
npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/*.ts
npm run migration:generate -- --name=CreateNewFeature
npm run migration:revert                   # Rollback last migration
```

### Testing Strategy
**Backend (Jest with ES modules)**: 15+ test suites covering services, processors, routes, middleware, and utilities
```bash
cd backend
npm test                    # All tests (31+ tests)
npm run test:fast          # Skip slow DB/integration tests
npm run test:coverage      # Coverage report (80% threshold)
npm run test:ratelimit     # Rate limit integration tests only
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
```

**Test Categories**:
- **Unit Tests**: EncryptionService, OAuthSessionService, GoogleOAuthService, GoogleAdManagerService, RetryHandler, PerformanceMetrics
- **Integration Tests**: Rate limiting (5 limiters), OAuth session lifecycle, DataModelProcessor, DataSourceProcessor cross-source transforms
- **Processor Tests**: DataModelProcessor (column name generation), DataSourceProcessor (column name consistency)
- **Middleware Tests**: Rate limit middleware, authentication
- **Route Tests**: OAuth session CRUD, rate limit enforcement
- **Feature Tests**: Article markdown support (slow, skipped in fast mode)

**Frontend (Vitest + Nuxt Test Utils)**: 4+ SSR compatibility test suites
```bash
cd frontend
npm test                   # Run all Vitest tests
npm run validate:ssr       # 8 SSR validation checks - CRITICAL before commit
```

**Test Suites**:
- **SSR Compatibility** ([ssr-compatibility.nuxt.test.ts](frontend/tests/ssr-compatibility.nuxt.test.ts)): 31+ tests validating components render without browser APIs
  - Core components: tabs, overlay-dialog, footer-nav, header-nav
  - Pages: index, dashboard, data-model-builder, login, register, privacy-policy
  - Guards: window.location, document.cookie, localStorage, addEventListener
- **Component Tests**: hero.nuxt.test.ts, notched-card.nuxt.test.ts, text-editor.nuxt.test.ts
- **SSR Validation Script** ([validate-ssr.cjs](frontend/scripts/validate-ssr.cjs)): 8 automated checks
  - nuxt.config.ts SSR enabled
  - Client-only plugins configured
  - Browser API guards (window, document, localStorage)
  - Store initialization patterns
  - Cookie usage (useCookie vs document.cookie)

**Test Configuration**:
- **Backend**: Jest with ts-jest, ES modules support, test DB on port 5434, setup file generates encryption keys
- **Frontend**: Vitest with Nuxt environment, happy-dom for SSR simulation, playwright-core for E2E ready
- **Coverage Goals**: Backend 80% threshold (branches/functions/lines/statements)

### Custom Scripts
```bash
# Backend table rename workflow (used during refactoring)
npm run rename:analyze      # Analyze tables for rename
npm run rename:execute:dry-run  # Test rename without changes
npm run rename:execute      # Execute actual rename
npm run rename:verify       # Verify rename success
```

## SSR Requirements (Nuxt3)
**CRITICAL**: Frontend uses SSR. Code breaking SSR breaks production builds.

### Always Guard Browser APIs
```typescript
// ❌ WRONG - crashes SSR
window.open('url')
localStorage.getItem('key')

// ✅ CORRECT - SSR-safe
if (import.meta.client) {
    window.open('url')
    localStorage.getItem('key')
}
```

### Data Fetching Patterns
- Use `onServerPrefetch()` for data needed on initial render
- Use `onMounted()` for client-only data/DOM operations
- Use `useCookie()` instead of `document.cookie`
- Run `npm run validate:ssr` before every commit

## Project-Specific Conventions

### API Call Structure (Frontend to Backend)
**CRITICAL**: Proper API calling patterns to avoid common mistakes.

#### Backend Route Structure
- **NO `/api/` prefix**: Backend routes are mounted directly (e.g., `/admin/platform-settings`, `/projects`, `/data-sources`)
- Routes are defined in `backend/src/routes/` and mounted in `backend/src/server.ts`
- Admin routes use `/admin/` prefix (e.g., `/admin/database/backup`, `/admin/platform-settings`)

#### Frontend API Calls - Correct Pattern
```typescript
// ✅ CORRECT - Use runtimeConfig with backend base URL
const config = useRuntimeConfig();
const response = await $fetch(`${config.public.apiBase}/admin/platform-settings`, {
    method: 'GET',
    credentials: 'include'
});
```

#### Common Mistakes to AVOID
```typescript
// ❌ WRONG - Missing apiBase (calls frontend URL)
await $fetch('/admin/platform-settings')

// ❌ WRONG - Incorrect /api/ prefix (backend doesn't use this)
await $fetch(`${config.public.apiBase}/api/admin/platform-settings`)

// ❌ WRONG - Hardcoded frontend URL
await $fetch('http://frontend.dataresearchanalysis.test:3000/admin/platform-settings')
```

#### Configuration
- **Runtime Config**: `nuxt.config.ts` defines `apiBase` as `process.env.NUXT_API_URL || 'http://localhost:3002'`
- **No `/api/` suffix**: The `apiBase` does NOT include `/api/` - routes are direct
- **Example URLs**: 
  - Dev: `http://localhost:3002/projects`
  - Docker: `http://backend.dataresearchanalysis.test:3002/admin/platform-settings`

#### Pattern Examples from Codebase
- See [invitations/index.vue](frontend/pages/invitations/index.vue#L119) for reference implementation
- All API calls MUST use `${useRuntimeConfig().public.apiBase}/route-path`

### File Organization
- **Backend**: Models in `/models` (TypeORM entities), entities in `/entities` (simpler), types in `/types`, interfaces in `/interfaces`
- **Routes**: All routes in `/routes`, admin routes in `/routes/admin`
- **Middleware**: Authentication in `middleware/authenticate.ts`, rate limiting in `middleware/rateLimit.ts`

### Rate Limiting (Express)
Multiple limiters defined in [middleware/rateLimit.ts](backend/src/middleware/rateLimit.ts):
- `generalApiLimiter`: 1000 req/15min (default, applied globally)
- `authLimiter`: 10 req/15min (login/register)
- `expensiveOperationsLimiter`: 30 req/15min (dashboard exports, AI operations)
- `oauthCallbackLimiter`: 10 req/15min
- `aiOperationsLimiter`: 20 req/hour

### Icon Usage
**CRITICAL**: Inline `<svg>` blocks are **forbidden** in `.vue` files. Always use the globally registered `<font-awesome-icon>` component.

**Setup**: `frontend/plugins/fontawesome.ts` registers the full `fas` (solid), `far` (regular), and `fab` (brands) libraries globally.

```vue
<!-- ❌ WRONG - Inline SVG is forbidden -->
<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path d="M6 18L18 6M6 6l12 12" />
</svg>

<!-- ✅ CORRECT - Use font-awesome-icon -->
<font-awesome-icon :icon="['fas', 'xmark']" class="w-5 h-5" />
```

**Common icon mappings**:
- Close/X → `['fas', 'xmark']`
- Back arrow → `['fas', 'arrow-left']`
- Forward arrow → `['fas', 'arrow-right']`
- Loading spinner → `['fas', 'spinner']` + `class="animate-spin"`
- Checkmark → `['fas', 'check']`
- Warning triangle → `['fas', 'triangle-exclamation']`
- Info circle → `['fas', 'circle-info']`
- Trash/Delete → `['fas', 'trash']`
- Plus/Add → `['fas', 'plus']`
- Google logo → `['fab', 'google']`

### TypeScript ES Modules
**Important**: Backend uses ES modules (`"type": "module"` in package.json). All imports must include `.js` extension:
```typescript
import { AuthProcessor } from './processors/AuthProcessor.js';  // ✅ Required
import { AuthProcessor } from './processors/AuthProcessor';     // ❌ Breaks
```

### Migration Strategy
TypeORM migrations in [backend/src/migrations](backend/src/migrations). Use datasource: `PostgresDSMigrations.ts`. Always test with dry-run first. Database operations use transactions for cascade deletes.

### Docker Development
3 main services: `frontend.dataresearchanalysis.test`, `backend.dataresearchanalysis.test`, `database.dataresearchanalysis.test`. Add to hosts file. Access frontend at http://frontend.dataresearchanalysis.test:3000 (see [README.md](README.md)).

## Database Backup & Restore
**Admin-only feature** using background job queue with Socket.IO progress updates.

### Backup Process
```bash
# Backend: /routes/admin/database.ts
POST /admin/database/backup
```
- Creates pg_dump SQL file
- Compresses to ZIP with metadata JSON
- Stores in `backend/private/backups/`
- Queued via `QueueService` for background processing
- Real-time progress via Socket.IO (`backup-progress` event)

### Restore Process
```bash
POST /admin/database/restore
```
- Uploads ZIP file (multer, max 500MB default)
- Validates backup structure (SQL + metadata.json)
- Drops all tables with CASCADE
- Restores from SQL dump
- Background processing with progress events

### Key Implementation
[DatabaseBackupService.ts](backend/src/services/DatabaseBackupService.ts) handles:
- `createBackup(userId)`: pg_dump → ZIP → metadata
- `restoreBackup(zipPath, userId)`: Extract → validate → restore → cleanup
- Automatic cleanup of temp files

## AI Data Modeler
**One-click data model generation** using Google Gemini 2.0 Flash with Redis session persistence.

### Architecture
- **Redis Sessions**: 24-hour TTL for active conversations
- **Database Persistence**: Transfer to PostgreSQL on save
- **Schema Context**: Markdown-formatted database schema fed to AI
- **System Prompt**: Structured 3-section responses (Analysis, Models, SQL)

### Key Components
```typescript
// Redis-based session management
RedisAISessionService.getInstance()
  .createSession(dataSourceId, userId, schema)
  .saveMessage(message)
  .saveModelDraft(draft)
  .transferToDatabase(dataModelId)  // Save & clear Redis

// Schema introspection
SchemaCollectorService.collectSchema(dataSource, schemaName)
SchemaFormatter.formatSchemaToMarkdown(tables)

// Gemini integration
GeminiService.getInstance()
  .initializeConversation(conversationId, schemaContext)
  .sendMessage(conversationId, userPrompt)
```

### Data Flow
1. User connects data source → Schema introspection
2. AI initializes with markdown schema context
3. User sends natural language request
4. Gemini returns structured model recommendations
5. User applies model → Saves to data_models table
6. Conversation persists in PostgreSQL for history

### Tables
- `dra_ai_data_model_conversations`: Session metadata, status (draft/saved/archived)
- `dra_ai_data_model_messages`: Individual messages (role: user/assistant)

See [ai-data-modeler-implementation.md](documentation/ai-data-modeler-implementation.md) for full architecture.

## Test Credentials
- **Admin**: testadminuser@dataresearchanalysis.com / testuser
- **User**: testuser@dataresearchanalysis.com / testuser

## Key Documentation
- [comprehensive-architecture-documentation.md](documentation/comprehensive-architecture-documentation.md): Full architecture, PlantUML diagrams, class diagrams
- [ssr-quick-reference.md](documentation/ssr-quick-reference.md): SSR patterns, guards, validation
- [encryption-implementation-summary.md](documentation/encryption-implementation-summary.md): Encryption architecture
- [OAUTH_SECURITY_IMPLEMENTATION_SUMMARY.md](documentation/OAUTH_SECURITY_IMPLEMENTATION_SUMMARY.md): OAuth flows

## Common Pitfalls
1. **Forgetting `.js` extension in imports** - breaks ES module resolution
2. **Not guarding browser APIs with `import.meta.client`** - SSR crashes
3. **Putting business logic in controllers** - belongs in Processors
4. **Direct localStorage access without store** - breaks reactivity
5. **Skipping `npm run validate:ssr`** - SSR bugs slip through
6. **Not syncing localStorage in Pinia actions** - state inconsistency
7. **Forgetting to run migrations after model changes** - schema mismatch
8. **Missing `useRuntimeConfig().public.apiBase` in API calls** - calls frontend instead of backend
9. **Adding `/api/` prefix to API routes** - backend routes don't use this prefix
10. **Using inline `<svg>` blocks in `.vue` files** - forbidden; use `<font-awesome-icon>` instead (see Icon Usage)
11. **Writing custom CSS in `<style>` blocks** - forbidden; use only TailwindCSS utility classes for all styling in `.vue` files; never add `<style scoped>` or `<style>` blocks

## Pull Request Template

**CRITICAL**: Whenever the user asks you to write a pull request markdown document, ALWAYS use exactly this template and fill in the relevant sections based on the changes made:

```markdown
## Description

Please include a summary of the changes and the related issue(s). 
Explain the motivation and the context behind the changes.

Fixes: # (issue)

## Type of Change

Please delete options that are not relevant:

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 🛠 Refactor (non-breaking change, code improvements)
- [ ] 📚 Documentation update
- [ ] 🔥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] ✅ Tests (adding or updating tests)

## How Has This Been Tested?

Please describe the tests that you ran to verify your changes.
Provide instructions so we can reproduce and validate the behavior.

- [ ] Unit Tests
- [ ] Integration Tests
- [ ] Manual Testing

## Checklist

Please check all the boxes that apply:

- [ ] I have read the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines.
- [ ] My code follows the code style of this project.
- [ ] I have added necessary tests.
- [ ] I have updated the documentation (if needed).
- [ ] My changes generate no new warnings or errors.
- [ ] I have linked the related issue(s) in the description.

## Screenshots (if applicable)

> Add screenshots to help explain your changes if visual updates are involved.

---
```

---

## Data Source Architecture Overview

All API-integrated data sources write into a dedicated PostgreSQL schema named `dra_{type}` (e.g. `dra_hubspot`, `dra_klaviyo`, `dra_linkedin_ads`). Physical table names are always generated via `TableMetadataService.generatePhysicalTableName()` and follow the format `ds{dataSourceId}_{hash8}` (e.g. `ds42_a1b2c3d4`). The logical name (e.g. `contacts`, `deals`) is stored in `dra_table_metadata`. **Never** hardcode table names — always call `generatePhysicalTableName` first, then register with `storeTableMetadata`.

File-based sources (Excel, PDF) and NoSQL (MongoDB) use the same `ds{id}_{hash}` naming under their own schemas (`dra_excel`, `dra_pdf`, `dra_mongodb`).

Traditional database connections (PostgreSQL, MySQL, MariaDB) use the actual schema name of the remote database and their own table names unchanged.

---

## Adding a New Data Source — Complete Checklist

When implementing a new data source, these files **must** be updated in order:

### Backend
1. `backend/src/types/EDataSourceType.ts` — add `NEW_TYPE = 'new_type'` to enum
2. `backend/src/models/DRADataSource.ts` — add `'new_type'` to the `@Column({ enum: [...] })` list
3. `backend/src/services/NewTypeService.ts` — create singleton service (see pattern below)
4. `backend/src/processors/NewTypeProcessor.ts` — create singleton processor (see pattern below)
5. `backend/src/routes/new_type.ts` — create route file (see pattern below)
6. `backend/src/index.ts` — mount route: `app.use('/new-type', newType);`
7. `backend/src/processors/DataSourceProcessor.ts` — add `EDataSourceType.NEW_TYPE` delete block
8. `backend/src/processors/DataModelProcessor.ts` — add `'dra_new_type'` to the condition in **THREE** places (see critical section below)
9. `backend/src/services/DataSamplingService.ts` — add `'new_type': 'dra_new_type'` to `apiIntegratedSchemas` map
10. **Sync history** — the processor's `syncDataSource()` **MUST** use `SyncHistoryService` (see pattern below); add `getNewTypeSyncStatus()` method; add `GET /new-type/sync-status/:id` route

### Frontend
10. `frontend/constants/featureFlags.ts` — add `NEW_TYPE_ENABLED: false`
11. `frontend/composables/useNewType.ts` — create composable (see pattern below)
12. `frontend/pages/connect/new-type.vue` — create connect page
13. `frontend/pages/marketing-projects/[projectid]/data-sources/index.vue` — add to 13 locations (see registry)
14. `frontend/pages/marketing-projects/[projectid]/data-sources/[datasourceid]/index.vue` — add to 9 locations (see registry)

---

## Backend Layer Architecture for API Data Sources

Every API-integrated data source uses one of two architectures. **Choose based on complexity.**

### Pattern A — Service + Driver + Processor (Google*, Meta Ads, LinkedIn Ads)
Used when the sync logic is complex enough to warrant a dedicated Driver.

```
XxxService      → raw API calls, data insertion
XxxDriver       → owns SyncHistoryService; createSyncRecord/markAsRunning/completeSyncRecord/markAsFailed; getSyncHistory(); getLastSyncTime()
XxxProcessor    → thin orchestrator; calls driver.sync(); calls driver.getSyncHistory() for the route handler
```

`SyncHistoryService` lives **only in the Driver**. The Processor never imports it directly.

```typescript
// XxxProcessor.syncDataSource() — delegates entirely to driver
const driver = XxxDriver.getInstance();
return driver.syncDataSource(dataSourceId, connectionDetails);

// XxxProcessor.getXxxSyncStatus()
const driver = XxxDriver.getInstance();
return { lastSyncTime: await driver.getLastSyncTime(id), syncHistory: await driver.getSyncHistory(id, 10) };
```

### Pattern B — Service + Processor only (HubSpot, Klaviyo)
Used for simpler sources with no Driver. `SyncHistoryService` is called directly from the Processor because there is no Driver layer.

```
XxxService      → raw API calls, data insertion
XxxProcessor    → calls SyncHistoryService directly; owns createSyncRecord/markAsRunning/completeSyncRecord/markAsFailed; getXxxSyncStatus()
```

**When adding a new source**, prefer Pattern A (create a Driver) if the sync has multiple report types, pagination, or retry complexity. Use Pattern B only for straightforward single-endpoint sources.

---

## Backend Service Implementation Pattern

```typescript
// backend/src/services/NewTypeService.ts
import { RetryHandler } from './RetryHandler.js';

export class NewTypeService {
    private static instance: NewTypeService;
    private constructor() { console.log('📘 NewType Service initialized'); }
    public static getInstance(): NewTypeService {
        if (!NewTypeService.instance) NewTypeService.instance = new NewTypeService();
        return NewTypeService.instance;
    }

    async syncAll(dataSourceId: number, usersPlatformId: number, apiKey?: string): Promise<boolean> {
        // 1. Create schema: CREATE SCHEMA IF NOT EXISTS dra_new_type
        // 2. For each logical table (contacts, events, etc.):
        //    a. const physicalName = await TableMetadataService.getInstance().generatePhysicalTableName(dataSourceId, 'contacts');
        //    b. await TableMetadataService.getInstance().storeTableMetadata(manager, { dataSourceId, usersPlatformId, schemaName: 'dra_new_type', physicalTableName: physicalName, logicalTableName: 'contacts', ... });
        //    c. CREATE TABLE IF NOT EXISTS dra_new_type."${physicalName}" (...)
        //    d. INSERT data
        // 3. Use RetryHandler.execute() for external API calls
        return true;
    }

    private async makeRequest<T>(url: string, headers: Record<string, string>): Promise<T> {
        return RetryHandler.execute(() => fetch(url, { headers }).then(r => r.json()));
    }
}
```

---

## Backend Processor Implementation Pattern

The template below shows **Pattern B** (no Driver). For Pattern A, `SyncHistoryService` moves into the Driver and the Processor only calls `driver.sync()` and `driver.getSyncHistory()`.

```typescript
// backend/src/processors/NewTypeProcessor.ts
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { NewTypeService } from '../services/NewTypeService.js';

export class NewTypeProcessor {
    private static instance: NewTypeProcessor;
    private constructor() {}
    public static getInstance(): NewTypeProcessor {
        if (!NewTypeProcessor.instance) NewTypeProcessor.instance = new NewTypeProcessor();
        return NewTypeProcessor.instance;
    }

    async addDataSource(params: { projectId: number; userId: number; apiKey: string; name: string }): Promise<number> {
        const manager = AppDataSource.manager;
        const ds = manager.create(DRADataSource, {
            project_id: params.projectId,
            data_type: EDataSourceType.NEW_TYPE,
            name: params.name,
            connection_details: {
                data_source_type: EDataSourceType.NEW_TYPE,
                schema: 'dra_new_type',
                api_connection_details: {
                    api_config: { api_key: params.apiKey, last_sync: null }
                }
            }
        });
        const saved = await manager.save(ds);
        // Fire-and-forget initial sync
        this.syncDataSource(saved.id, params.userId).catch(console.error);
        return saved.id;
    }

    async syncDataSource(dataSourceId: number, userId: number): Promise<boolean> {
        const manager = AppDataSource.manager;
        const ds = await manager.findOneOrFail(DRADataSource, { where: { id: dataSourceId } });
        const apiKey = ds.connection_details.api_connection_details?.api_config?.api_key;

        // REQUIRED: create sync history record before calling the service
        const syncRecord = await SyncHistoryService.getInstance().createSyncRecord(dataSourceId, SyncType.MANUAL);
        await SyncHistoryService.getInstance().markAsRunning(syncRecord.id);

        let success: boolean;
        try {
            success = await NewTypeService.getInstance().syncAll(dataSourceId, userId, apiKey);
        } catch (err: any) {
            await SyncHistoryService.getInstance().markAsFailed(syncRecord.id, err.message || 'Sync failed');
            throw err;
        }

        if (success) {
            await SyncHistoryService.getInstance().completeSyncRecord(syncRecord.id, 0 /* replace with actual record count */, 0);
            ds.connection_details.api_connection_details!.api_config.last_sync = new Date();
            await manager.save(ds);
        }
        return success;
    }

    // REQUIRED: expose sync history for the frontend
    async getNewTypeSyncStatus(dataSourceId: number): Promise<{ lastSyncTime: Date | null; syncHistory: any[] }> {
        const svc = SyncHistoryService.getInstance();
        const lastSync = await svc.getLastSync(dataSourceId);
        const syncHistory = await svc.getSyncHistory(dataSourceId, 10);
        return { lastSyncTime: lastSync?.completedAt || null, syncHistory };
    }

    // OAuth sources only:
    async getOAuthUrl(state: string): Promise<{ configured: boolean; authUrl?: string }> { ... }
    async exchangeCode(code: string): Promise<IAPIConnectionDetails> { ... }
}
```

---

## Backend Route Implementation Pattern

```typescript
// backend/src/routes/new_type.ts
import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProductionAccess } from '../middleware/requiresProductionAccess.js';
import { NewTypeProcessor } from '../processors/NewTypeProcessor.js';

const router = Router();
const processor = NewTypeProcessor.getInstance();

// API-key source: no OAuth endpoints needed
router.post('/add', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const { projectId, name, apiKey } = req.body;
        const dataSourceId = await processor.addDataSource({ projectId, userId: req.user!.id, name, apiKey });
        res.json({ success: true, dataSourceId });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/sync/:id', validateJWT, requiresProductionAccess, async (req, res) => {
    try {
        const dataSourceId = parseInt(req.params.id);
        await processor.syncDataSource(dataSourceId, req.user!.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// REQUIRED: sync history endpoint — consumed by both frontend pages
router.get('/sync-status/:id', validateJWT, async (req, res) => {
    try {
        const dataSourceId = parseInt(req.params.id);
        const { lastSyncTime, syncHistory } = await processor.getNewTypeSyncStatus(dataSourceId);
        res.json({ success: true, lastSyncTime, syncHistory });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// OAuth source: add GET /connect and GET /callback
// Callback must NOT use validateJWT (browser redirect, no bearer token available)
// Callback pattern: redirect to `${frontendUrl}/connect/new-type?tokens=${base64urlPayload}&state=${state}`
// Token payload: Buffer.from(JSON.stringify({ oauth_access_token, oauth_refresh_token, ... })).toString('base64url')

export default router;
```

### Route Mounting in `backend/src/index.ts`
```typescript
import newType from './routes/new_type.js';
// Add near lines 227-229 alongside other data source routes:
app.use('/new-type', newType);
```
The global `generalApiLimiter` (100 req/min) is already applied at line 205-209 and covers all routes automatically. Only add a specific limiter if the route is expensive (use `expensiveOperationsLimiter`) or AI-related (use `aiOperationsLimiter`).

---

## EDataSourceType Enum

```typescript
// backend/src/types/EDataSourceType.ts
export enum EDataSourceType {
    EXCEL = 'excel', CSV = 'csv', PDF = 'pdf',
    POSTGRESQL = 'postgresql', MYSQL = 'mysql', MARIADB = 'mariadb', MONGODB = 'mongodb',
    GOOGLE_ANALYTICS = 'google_analytics', GOOGLE_AD_MANAGER = 'google_ad_manager',
    GOOGLE_ADS = 'google_ads', META_ADS = 'meta_ads', LINKEDIN_ADS = 'linkedin_ads',
    HUBSPOT = 'hubspot', KLAVIYO = 'klaviyo',
    // ADD NEW TYPES HERE
}
```
**Also update** the `@Column({ type: 'enum', enum: ['excel', 'csv', ...] })` array in `backend/src/models/DRADataSource.ts` — TypeORM requires the string values in the enum column definition as well.

---

## TypeORM DRADataSource Model Key Fields

- `data_type`: enum column — **must add string value to list** when adding a new source
- `connection_details`: `jsonb` column with `connectionDetailsTransformer` — auto-encrypts on write, decrypts on read via `EncryptionService`
- `sync_schedule`, `sync_schedule_time`, `sync_enabled`, `next_scheduled_sync`: scheduling columns (already exist, no changes needed)
- `@OneToMany(() => DRATableMetadata, ...)`: metadata cascades on delete automatically

### IAPIConnectionDetails Structure
```typescript
{
    oauth_access_token?: string,     // OAuth sources
    oauth_refresh_token?: string,    // OAuth sources
    token_expiry?: Date,             // OAuth sources
    api_config: {
        // Source-specific: account IDs, advertiser IDs, date ranges, selected accounts
        api_key?: string,            // API-key sources (Klaviyo, etc.)
        last_sync: Date | null,      // SET BY PROCESSOR after successful sync (not by service)
    }
}
```
`last_sync` is set in the **Processor** after `ServiceInstance.syncAll()` returns `true`. Never set it inside the Service.

---

## TableMetadataService Contract

```typescript
// Every service that writes API data MUST call both methods before CREATE TABLE:

const tableMeta = TableMetadataService.getInstance();

// 1. Generate physical table name (deterministic hash of dataSourceId + logicalName)
const physicalName = await tableMeta.generatePhysicalTableName(dataSourceId, 'contacts');
// returns: 'ds42_a1b2c3d4'

// 2. Register metadata (upserts on schemaName + physicalTableName)
await tableMeta.storeTableMetadata(manager, {
    dataSourceId,
    usersPlatformId,
    schemaName: 'dra_new_type',
    physicalTableName: physicalName,
    logicalTableName: 'contacts',
    columnNames: ['id', 'email', 'name'],
    rowCount: data.length,
});

// 3. Then CREATE TABLE / INSERT
await dbConnector.query(`CREATE TABLE IF NOT EXISTS dra_new_type."${physicalName}" (...)`);
```
Other service methods: `getDataSourceTableMetadata(manager, dataSourceId)`, `getPhysicalTableName(manager, dataSourceId, logicalName)`, `deleteTableMetadata(manager, dataSourceId)`.

---

## DataSourceProcessor Delete Pattern

In `backend/src/processors/DataSourceProcessor.ts` `deleteDataSource()` method, add a new block for each new source:

```typescript
if (dataSource.data_type === EDataSourceType.NEW_TYPE) {
    try {
        // Step 1: Drop tables tracked in metadata
        const metadataResults = await dbConnector.query(
            `SELECT physical_table_name FROM dra_table_metadata
             WHERE schema_name = 'dra_new_type' AND data_source_id = $1`,
            [dataSource.id]
        );
        for (const row of metadataResults) {
            await dbConnector.query(`DROP TABLE IF EXISTS dra_new_type."${row.physical_table_name}" CASCADE`);
        }
        // Step 2: Fallback for tables not tracked in metadata
        const fallbackTables = await dbConnector.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'dra_new_type' AND table_name LIKE $1`,
            [`ds${dataSource.id}_%`]
        );
        for (const row of fallbackTables) {
            await dbConnector.query(`DROP TABLE IF EXISTS dra_new_type."${row.table_name}" CASCADE`);
        }
    } catch (error) { console.error('Error dropping NewType tables:', error); }
}
```

---

## DataModelProcessor — Three-Branch Column Naming (CRITICAL)

**File**: `backend/src/processors/DataModelProcessor.ts`

API-integrated schemas use a **short** column naming format `tableName_columnName` because the physical table name already encodes the data source context (`ds{id}_{hash}`). All traditional database schemas use the long format `schema_tableName_columnName`.

The schema allowlist condition appears in **exactly three places** — you must update **all three** when adding a new source:

```typescript
// The condition looks like this (simplified):
const isApiIntegratedSchema =
    schemaName === 'dra_excel' || schemaName === 'dra_pdf' || schemaName === 'dra_mongodb' ||
    schemaName === 'dra_google_analytics' || schemaName === 'dra_google_ad_manager' ||
    schemaName === 'dra_google_ads' || schemaName === 'dra_meta_ads' ||
    schemaName === 'dra_linkedin_ads' || schemaName === 'dra_hubspot' || schemaName === 'dra_klaviyo';
    // ADD: || schemaName === 'dra_new_type'
```

**Location 1** (~line 651): CREATE TABLE column generation — `columnName = tableName_columnName`
**Location 2** (~line 770): `columnDataTypes` map population — same condition
**Location 3** (~line 830): INSERT `rowKey` construction — same condition

Failing to add to all three will cause AI-generated data model tables to have malformed column names or empty rows for the new source.

---

## DataSamplingService — apiIntegratedSchemas Map (AI Insights)

**File**: `backend/src/services/DataSamplingService.ts` (~line 540)

```typescript
const apiIntegratedSchemas: Record<string, string> = {
    'google_analytics': 'dra_google_analytics',
    'google_ad_manager': 'dra_google_ad_manager',
    'google_ads': 'dra_google_ads',
    'meta_ads': 'dra_meta_ads',
    'linkedin_ads': 'dra_linkedin_ads',
    'hubspot': 'dra_hubspot',
    'klaviyo': 'dra_klaviyo',
    'excel': 'dra_excel',
    'pdf': 'dra_pdf',
    'mongodb': 'dra_mongodb',
    // ADD: 'new_type': 'dra_new_type',
};
```
This map is used by AI Insights to route data source lookups to the correct internal schema. **Not adding here means AI Insights cannot read data from the new source**, even if it is fully synced.

---

## SchemaCollectorService

**File**: `backend/src/services/SchemaCollectorService.ts`

Handles schema introspection for: `postgresql`, `mysql`/`mariadb`, `mongodb`. For API-integrated sources stored in internal PostgreSQL (`dra_xxx` schemas), the caller passes the `dra_xxx` schema name and the service queries internal PostgreSQL directly. No source-type branching is needed in `SchemaCollectorService` for new API-integrated sources — it works automatically as long as data exists in the `dra_new_type` schema.

---

## GeminiService

**File**: `backend/src/services/GeminiService.ts`

- **Not a singleton class** — exported as `getGeminiService()` factory that returns a module-level instance
- Model: `gemini-2.5-flash` (`@google/genai`)
- Active chat sessions stored in `Map<conversationId, ChatSession>` with 1-hour TTL (auto-cleanup)
- `initializeConversation(id, schemaContext, systemPrompt)` — injects schema markdown as the first user message in chat history before any user turn, enabling schema-aware responses
- `sendMessage(id, message): Promise<string>` — appends to history, sends to Gemini, returns text
- `sendMessageStream(id, message, onChunk)` — streaming variant used by AI Insights
- Conversation IDs are UUIDs; they differ between AI Data Modeler (Redis-keyed) and AI Insights (project+user keyed)

---

## AI Data Modeler — How New Sources Feed In

**Flow**:
1. Frontend store `useAIDataModelerStore.openDrawer(dataSourceId)` calls `initializeConversation(dataSourceId)`
2. `POST /ai-data-modeler/session/initialize` → `SchemaCollectorService.collectSchema(dataSource, schemaName)`
3. For API-integrated sources, `schemaName` = `dra_new_type`; service queries internal PG and returns table/column list
4. Schema formatted to markdown → injected as Gemini conversation context
5. Session metadata stored in Redis (24hr TTL), transferred to `dra_ai_data_model_conversations` on save

**For new API sources**: works automatically as long as data has been synced into the `dra_new_type` schema. No code changes needed in the AI Data Modeler pipeline beyond the `DataModelProcessor` three-branch update above.

---

## AI Insights — How New Sources Feed In

**Flow**:
1. `POST /insights/session/initialize { projectId, dataSourceIds }` → `InsightsProcessor.initializeSession()`
2. `DataSamplingService.buildInsightContext()` maps each `data_type` → schema name via `apiIntegratedSchemas`
3. For each table in the schema: samples 50 rows, computes statistics (min/max/null count/distinct)
4. Markdown context built → stored in Redis key `schema_context:insights:{projectId}:{userId}`
5. Gemini initialized with `AI_INSIGHTS_EXPERT_PROMPT` + markdown schema context
6. Real-time progress via Socket.IO event `insight-analysis-progress`:
   - `{ phase: 'sampling', progress: 10 }`
   - `{ phase: 'computing_stats', progress: 60 }`
   - `{ phase: 'analyzing', progress: 70 }`
   - `{ phase: 'complete', progress: 100 }`

**For new source**: MUST add `'new_type': 'dra_new_type'` to `apiIntegratedSchemas` in `DataSamplingService`.

Rate limiting: `insightsLimiter` (15 req/hr per user) on `/session/initialize` and `/session/generate`; `aiOperationsLimiter` (30 req/min) on `/session/chat`.

---

## Rate Limiter Selection Guide

All limiters are defined in `backend/src/middleware/rateLimit.ts` and exported for per-route use.

| Limiter | Window | Max | Key By | Use For |
|---------|--------|-----|--------|---------|
| `authLimiter` | 15 min | 5 | IP | Login, register, password reset |
| `expensiveOperationsLimiter` | 1 min | 10 | IP | File uploads, manual sync triggers |
| `generalApiLimiter` | 1 min | 100 | IP | Applied globally in `index.ts` line 205 |
| `oauthCallbackLimiter` | 5 min | 10 | IP | OAuth callbacks (`skipSuccessfulRequests: true`) |
| `aiOperationsLimiter` | 1 min | 30 | `user_{id}` | AI chat, session init, AI data modeler |
| `insightsLimiter` | 1 hr | 15 | `insights_user_{id}` | AI Insights init + generate |
| `mongoDBOperationsLimiter` | 15 min | 30 | IP | MongoDB aggregations |
| `invitationLimiter` | 15 min | 10 | IP | Team invitations |

**Data source CRUD/sync routes**: no explicit limiter needed (covered by global `generalApiLimiter`). Add `expensiveOperationsLimiter` for sync endpoints that trigger long background jobs.

---

## Frontend Composable Pattern

Two patterns exist — use **Pattern B (direct `$fetch`)** for new sources:

### Pattern B: Direct $fetch (HubSpot, Klaviyo — PREFERRED)
```typescript
// frontend/composables/useNewType.ts
export const useNewType = () => {
    const config = useRuntimeConfig();

    const authHeaders = (): Record<string, string> => {
        const token = useCookie('auth_token').value;
        if (!token) throw new Error('Authentication required');
        return { 'Authorization': `Bearer ${token}`, 'Authorization-Type': 'auth', 'Content-Type': 'application/json' };
    };

    // OAuth source: browser redirects away, returns Promise<void>
    const startOAuthFlow = async (projectId: number): Promise<void> => {
        const response = await $fetch<{ success: boolean; authUrl: string }>(
            `${config.public.apiBase}/new-type/connect?projectId=${projectId}`,
            { headers: authHeaders() }
        );
        if (response.authUrl && import.meta.client) window.location.href = response.authUrl;
    };

    const addDataSource = async (params: { projectId: number; name: string; apiKey: string }): Promise<number | null> => {
        const response = await $fetch<{ success: boolean; dataSourceId: number }>(
            `${config.public.apiBase}/new-type/add`,
            { method: 'POST', headers: authHeaders(), body: params }
        );
        return response.success ? response.dataSourceId : null;
    };

    const syncNow = async (dataSourceId: number): Promise<boolean> => {
        const response = await $fetch<{ success: boolean }>(
            `${config.public.apiBase}/new-type/sync/${dataSourceId}`,
            { method: 'POST', headers: authHeaders() }
        );
        return response.success;
    };

    // OAuth sources: decode callback query parameter
    const parseCallbackTokens = (tokenPayload: string) => {
        try { return JSON.parse(atob(tokenPayload)); } catch { return null; }
    };

    const formatSyncTime = (timestamp: string | null): string => {
        if (!timestamp) return 'Never synced';
        const diff = Date.now() - new Date(timestamp).getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return `${Math.floor(diff / 86400000)} days ago`;
    };

    // REQUIRED: fetch sync history from the backend
    const getSyncStatus = async (dataSourceId: number): Promise<{ lastSyncTime: string | null; syncHistory: any[] } | null> => {
        try {
            const response = await $fetch<{ success: boolean; lastSyncTime: string | null; syncHistory: any[] }>(
                `${config.public.apiBase}/new-type/sync-status/${dataSourceId}`,
                { headers: authHeaders() }
            );
            return response?.success ? { lastSyncTime: response.lastSyncTime, syncHistory: response.syncHistory } : null;
        } catch (error) {
            console.error('[useNewType] Failed to get sync status:', error);
            return null;
        }
    };

    return { startOAuthFlow, addDataSource, syncNow, parseCallbackTokens, formatSyncTime, getSyncStatus };
};
```

**Minimum required exports for all composables**: `syncNow(dataSourceId): Promise<boolean>`, `formatSyncTime(timestamp): string`, `getSyncStatus(dataSourceId): Promise<...>`. OAuth sources also need `startOAuthFlow`, `addDataSource`, `parseCallbackTokens`.

---

## Connect Page Patterns

### OAuth Source
```vue
<!-- frontend/pages/connect/new-type.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'marketing-project' });
import { useNewType } from '@/composables/useNewType';
const route = useRoute();
const projectId = parseInt(String(route.params.projectid));
const newType = useNewType();
const state = reactive({ loading: false, error: null as string | null });

async function connectWithNewType() {
    state.loading = true;
    state.error = null;
    try { await newType.startOAuthFlow(projectId); }
    catch (e: any) { state.error = e.message; state.loading = false; }
}
</script>
<!-- Template: back link + card with brand-color header + "What gets synced" bullet list + CTA button -->
```

### API Key Source
```vue
<!-- Form with API key input field, validates key, calls newType.addDataSource({apiKey, projectId, name}) -->
<!-- On success: router.push(`/marketing-projects/${projectId}/data-sources`) -->
```

### OAuth Callback Page
```vue
<!-- frontend/pages/connect/new-type-callback.vue -->
<!-- On mounted (import.meta.client): reads ?tokens= param from route.query -->
<!-- Decodes via parseCallbackTokens() → calls newType.addDataSource(tokens) → redirects to data sources -->
```

---

## Feature Flags

```typescript
// frontend/constants/featureFlags.ts
export const FEATURE_FLAGS = {
    META_ADS_ENABLED: false,
    LINKEDIN_ADS_ENABLED: false,
    HUBSPOT_ENABLED: false,
    KLAVIYO_ENABLED: false,
    NEW_TYPE_ENABLED: false,  // Set to true only after production API access approved
} as const;
```

- `false` → shows as "Coming Soon" chip to non-admin users in the connect dialog
- `true` → fully accessible to all users
- Admin users bypass the `coming_soon` check and can always connect any source regardless of this flag

---

## Available Data Sources List (Connect Dialog)

In `frontend/pages/marketing-projects/[projectid]/data-sources/index.vue`, the `state.available_data_sources` array drives the connect dialog. Add a new entry:

```typescript
import newTypeImage from '@/assets/images/connectors/new-type.png';

// In state.available_data_sources array:
{
    name: 'New Type Platform',
    url: `${route.fullPath}/connect/new-type`,
    image_url: newTypeImage,
    coming_soon: !FEATURE_FLAGS.NEW_TYPE_ENABLED
}
```

---

## Pinia Store Conventions

- **Store ID**: `'{entityNameCamelCase}DRA'` — e.g., `'dataSourcesDRA'`, `'aiDataModelerDRA'`, `'projectsDRA'`
- **Actions**: `setXxx(value)`, `retrieveXxx()` (async API fetch), `clearXxx()`, `getXxx()` (reads localStorage + sets ref)
- **localStorage sync** (MUST wrap in `import.meta.client` guard):
  ```typescript
  function setDataSources(list: IDataSource[]) {
      dataSources.value = list;
      if (import.meta.client) {
          localStorage.setItem('dataSources', JSON.stringify(list));
          enableRefreshDataFlag('setDataSources');
      }
  }
  ```
- **localStorage keys**: human-readable camelCase matching the entity name
- `enableRefreshDataFlag('actionName')` must be called after every state mutation that other components might need to react to

---

## Data Source Detail Page Allowlist Registry

**File**: `frontend/pages/marketing-projects/[projectid]/data-sources/[datasourceid]/index.vue`

When adding a new API-integrated source (e.g. `'new_type'`), update ALL 9 locations:

1. `import { useNewType }` + `const newType = useNewType()` after existing composable imports
2. `getDataSourceIcon()` map: `'new_type': newTypeImage`
3. `getSyncStatus()` guard condition: add `'new_type'` to the source type array
4. `triggerSync()`: add `isNewType` flag + `'New Type'` in `serviceName` ternary + `newType.syncNow(dataSourceId)` in dispatch chain
5. `loadSyncHistory()`: add `'new_type'` to early-return guard (for sources without history endpoint return `sync_history.value = []`)
6. `onMounted` — `loadSyncHistory` trigger condition array
7. Schedule button `v-if` type array
8. Sync Controls section `v-if` type array
9. Sync History section `v-if` type array

---

## Data Source Index Page Allowlist Registry

**File**: `frontend/pages/marketing-projects/[projectid]/data-sources/index.vue`

When adding a new API-integrated source, update ALL 13 locations:

1. `import { useNewType }` + `const newType = useNewType()` at top of `<script setup>`
2. `getDataSourceImage()` map: add `'new_type': newTypeImage`
3. `syncDataSource()`: add `isNewType` flag + include in `serviceName` ternary + add `newType.syncNow(ds.id)` branch to dispatch chain
4. `bulkSyncAllGoogleDataSources()` (or equivalent bulk method): add `'new_type'` to filter condition + per-item dispatch handler + dialog/toast text
5. Bulk sync button `v-if`: include `'new_type'` in the data sources type check
6. `viewSyncHistory()`: add `'new_type'` to early return guard (for sources without dedicated history endpoint)
7. `getLastSyncTime()`: guard condition + `newType.formatSyncTime(ds.connection_details...)` in dispatch
8. `getSyncFrequency()`: guard condition + return `'Manual'` for API-key sources (no automated sync schedule)
9. `isRecentlySynced()`: guard condition for the type
10. Sync Status card `v-if`: include `'new_type'` in allowed types array
11. Sync Now button `v-if`: include `'new_type'` in allowed types array
12. Sync History button `v-if`: include `'new_type'` in allowed types array (even if early-returned, still show/hide correctly)
13. `state.available_data_sources` array: add new entry object (see Available Data Sources section above)

---

## Socket.IO Events Reference

| Event | Direction | Payload | Used By |
|-------|-----------|---------|---------|
| `insight-analysis-progress` | Server → Client | `{ phase: string, progress: number, message?: string }` | AI Insights |
| `backup-progress` | Server → Client | `{ progress: number, status: string }` | Database Backup |
| `restore-progress` | Server → Client | `{ progress: number, status: string }` | Database Restore |
| `sync-progress` | Server → Client | `{ dataSourceId: number, progress: number }` | Data source sync (where applicable) |

AI Insights phases in order: `sampling (10%)` → `computing_stats (60%)` → `analyzing (70%)` → `complete (100%)`.

---

## Data Storage Flow Summary

```
External API → NewTypeService.syncAll()
    → TableMetadataService.generatePhysicalTableName() → 'ds{id}_{hash8}'
    → TableMetadataService.storeTableMetadata()        → dra_table_metadata row
    → CREATE TABLE dra_new_type."ds{id}_{hash8}"       → internal PostgreSQL
    → INSERT rows

DataModelProcessor (AI model building):
    → reads dra_table_metadata to discover tables
    → joins with dra_new_type."ds{id}_{hash8}"
    → uses short column naming: tableName_columnName

DataSamplingService (AI Insights):
    → apiIntegratedSchemas maps 'new_type' → 'dra_new_type'
    → queries dra_new_type."ds{id}_{hash8}" for sample rows
    → builds markdown context for Gemini

SchemaCollectorService (AI Data Modeler):
    → queries information_schema for dra_new_type tables
    → returns column list for Gemini schema context
    → no source-type branching needed
```
