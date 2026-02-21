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
