# AI Data Modeler Implementation Summary

## Overview
AI Data Modeler integrates Google Gemini AI into the data model builder with **Redis-based session persistence** and **database storage on save**. Sessions are stored in Redis during model creation (24-hour TTL), then transferred to PostgreSQL when the data model is finalized.

## Implementation Date
January 2025 (Initial) | Updated January 2025 (Redis + Database Persistence)

## Architecture

### Backend Components

#### 1. Redis Configuration (`/backend/src/config/redis.config.ts`)
- **Purpose**: Redis client singleton for session management
- **Configuration**:
  - Host/Port/Password/DB from environment variables
  - Connection error handling and event logging
  - TTL Constants: 24 hours (SESSION_TTL), 1 hour (TEMP_DATA_TTL)
- **Methods**:
  - `getRedisClient()`: Returns singleton Redis instance
  - `closeRedisClient()`: Cleanup on server shutdown

#### 2. Redis AI Session Service (`/backend/src/services/RedisAISessionService.ts`)
- **Purpose**: Complete Redis-based session lifecycle management
- **Key Prefix**: `dra:ai:` (all session keys use this namespace)
- **Data Structures**:
  - **Metadata**: Hash (`session:metadata:{dataSourceId}:{userId}`) - conversationId, timestamps, model info
  - **Messages**: List (`session:messages:{dataSourceId}:{userId}`) - JSON-serialized conversation history
  - **Model Draft**: Hash (`session:model-draft:{dataSourceId}:{userId}`) - Work-in-progress model state
  - **Schema Context**: String (`session:schema:{dataSourceId}:{userId}`) - Markdown schema for AI
- **Methods**:
  - `createSession()`: Initialize new session with metadata + schema context
  - `saveMessage()`: Append message to conversation list
  - `getMessages()`: Retrieve full message history
  - `saveModelDraft()`: Update model draft with versioning
  - `getModelDraft()`: Retrieve current draft state
  - `transferToDatabase()`: Save session to PostgreSQL + clear Redis
  - `clearAllSessionData()`: Remove all Redis keys for session
  - `sessionExists()`: Check if active session in Redis

#### 3. Database Schema (`/backend/src/migrations/1764493430612-CreateAIConversationTables.ts`)
- **Tables Created**:
  - **dra_ai_data_model_conversations**: 
    - Stores conversation metadata (title, status, timestamps)
    - Foreign keys: data_source_id, user_id, data_model_id
    - Status enum: 'draft', 'saved', 'archived'
    - Indexes: composite (data_source_id, user_id), saved_at
  - **dra_ai_data_model_messages**:
    - Stores individual messages with role and content
    - Foreign key: conversation_id (CASCADE delete)
    - Role enum: 'user', 'assistant'
    - Index: conversation_id for efficient queries

#### 4. TypeORM Entities

**DRAAIDataModelConversation** (`/backend/src/models/DRAAIDataModelConversation.ts`)
- **Relations**: ManyToOne to DataSource, User, DataModel (with CASCADE/SET NULL)
- **Key Feature**: Foreign key columns auto-created by TypeORM from `@JoinColumn`
- **Properties**: title, status, saved_at, created_at, updated_at

**DRAAIDataModelMessage** (`/backend/src/models/DRAAIDataModelMessage.ts`)
- **Relations**: ManyToOne to Conversation (CASCADE delete)
- **Properties**: role, content, timestamp

#### 5. System Prompt (`/backend/src/constants/system-prompts.ts`)
- Exports `AI_DATA_MODELER_SYSTEM_PROMPT`
- Defines Principal Database Architect role
- Structured three-section response format:
  - Structural Analysis & Integrity Check
  - Recommended Analytical Data Models (2-3 models)
  - SQL Implementation Strategy

#### 6. Schema Collector Service (`/backend/src/services/SchemaCollectorService.ts`)
- **Purpose**: Introspect database schemas to collect table metadata
- **Methods**:
  - `collectSchema(dataSource, schemaName)`: Main entry point
  - `collectPostgresSchema()`: PostgreSQL-specific implementation
  - `collectMySQLSchema()`: MySQL/MariaDB-specific implementation
- **Returns**: `TableSchema[]` with columns, primary keys, foreign keys

#### 7. Schema Formatter Utility (`/backend/src/utilities/SchemaFormatter.ts`)
- **Purpose**: Format collected schema into markdown for AI consumption
- **Methods**:
  - `formatSchemaToMarkdown(tables)`: Creates comprehensive markdown documentation
  - `extractRelationships(tables)`: Determines One-to-Many, One-to-One, Many-to-Many relationships
  - `getSchemaSummary(tables)`: Returns statistics (table count, columns, foreign keys)

#### 8. Gemini Service (`/backend/src/services/GeminiService.ts`)
- **Purpose**: Wrapper for Google Gemini API
- **Configuration**:
  - Model: `gemini-2.0-flash-exp`
  - Max Output Tokens: 8192
  - Temperature: 0.7
- **Methods**:
  - `initializeConversation(conversationId, schemaContext)`: Creates chat session with system instruction
  - `sendMessage(conversationId, message)`: Sends message to existing conversation
  - `sendMessageStream(conversationId, message)`: Optional streaming support
  - `destroyConversation(conversationId)`: Cleanup
  - `cleanupExpiredSessions()`: Auto-cleanup every 10 minutes
- **Session Management**: In-memory `Map<string, ChatSession>` with 1-hour timeout

#### 9. AI Data Modeler Controller (`/backend/src/controllers/AIDataModelerController.ts`)
- **Purpose**: HTTP endpoints for AI session management (Redis + Database)
- **Redis-Based Session Methods**:
  - `initializeSession()`: Check Redis for existing session, restore or create new
  - `sendMessageWithRedis()`: Send message to Gemini + save to Redis
  - `updateModelDraft()`: Update work-in-progress model in Redis
  - `getSession()`: Retrieve full session state from Redis
  - `saveConversation()`: Transfer Redis session to database + cleanup
  - `cancelSession()`: Clear Redis session without saving
  - `getSavedConversation()`: Load conversation from database by data_model_id
- **Legacy Methods** (backward compatibility):
  - `initializeConversation()`: Original in-memory implementation
  - `sendMessage()`: Original implementation
  - `closeConversation()`: Original cleanup
- **Helper Methods**:
  - `getDataSourceDetails()`: Queries DRADataSource with user verification
  - `createDataSource()`: Factory for TypeORM DataSources

#### 10. Routes (`/backend/src/routes/ai_data_modeler.ts`)
- **Redis Session Routes**:
  - **POST** `/api/ai-data-modeler/session/initialize` - Initialize/restore session
  - **POST** `/api/ai-data-modeler/session/chat` - Send message (auto-saves to Redis)
  - **POST** `/api/ai-data-modeler/session/model-draft` - Update draft model
  - **GET** `/api/ai-data-modeler/session/:dataSourceId` - Get session state
  - **POST** `/api/ai-data-modeler/session/save` - Save to database + clear Redis
  - **DELETE** `/api/ai-data-modeler/session/:dataSourceId` - Cancel session
  - **GET** `/api/ai-data-modeler/conversations/:dataModelId` - Get saved conversation
- **Legacy Routes** (backward compatibility):
  - **POST** `/api/ai-data-modeler/initialize`
  - **POST** `/api/ai-data-modeler/chat`
  - **DELETE** `/api/ai-data-modeler/conversation/:conversationId`
- **Middleware**: `validateJWT`, `express-validator` on all routes

### Frontend Components

#### 1. Pinia Store (`/frontend/stores/ai-data-modeler.ts`)
- **State**:
  - `isDrawerOpen`: boolean
  - `conversationId`: string | null (temporary Redis ID or database ID)
  - `messages`: IMessage[] (conversation history)
  - `isLoading`: boolean (message send in progress)
  - `isInitializing`: boolean (session initialization in progress)
  - `schemaSummary`: ISchemaSummary | null (table/column statistics)
  - `schemaContext`: string | null (markdown schema for AI)
  - `error`: string | null (error message display)
  - `currentDataSourceId`: number | null (active data source)
  - `modelDraft`: any | null (work-in-progress model state)
  - `sessionSource`: 'new' | 'redis' | 'database' (origin of session)
  - `isDirty`: boolean (unsaved changes indicator)
  - `isRestored`: boolean (session restored from Redis)
- **Actions**:
  - `initializeConversation(dataSourceId)`: 
    - Calls `/session/initialize` endpoint
    - Auto-restores from Redis if draft exists
    - Sets sessionSource and isRestored flags
  - `sendMessage(message)`: 
    - Calls `/session/chat` endpoint
    - Auto-saves message pair to Redis
  - `updateModelDraft(draft)`: 
    - Calls `/session/model-draft` endpoint
    - Saves model state to Redis
    - Sets isDirty flag
  - `saveConversation(dataSourceId, dataModelId, title)`:
    - Calls `/session/save` endpoint
    - Transfers Redis session to database
    - Clears Redis and resets state
  - `cancelSession(dataSourceId)`:
    - Calls DELETE `/session/:dataSourceId`
    - Clears Redis without saving
    - Resets state
  - `loadSavedConversation(dataModelId)`:
    - Calls GET `/conversations/:dataModelId`
    - Loads conversation from database (read-only)
  - `resetState()`: Clears all state variables

#### 2. Type Definitions (`/frontend/types/IAIDataModeler.ts`)
- `IMessage`:
  - `id`: string
  - `role`: 'user' | 'assistant'
  - `content`: string
  - `timestamp`: Date
- `ISchemaSummary`:
  - `tableCount`: number
  - `totalColumns`: number
  - `totalForeignKeys`: number
  - `avgColumnsPerTable`: number

#### 3. AI Chat Message Component (`/frontend/components/ai-chat-message.vue`)
- **Purpose**: Display individual chat messages with markdown rendering
- **Features**:
  - Different styling for user (blue, right) vs assistant (gray, left)
  - `marked.parse()` for assistant markdown rendering
  - Comprehensive CSS for tables, code blocks, headings, lists
  - Relative timestamp formatting (Just now, X minutes ago, etc.)
  - Slide-in animation

#### 4. AI Chat Input Component (`/frontend/components/ai-chat-input.vue`)
- **Purpose**: Input field for user messages
- **Features**:
  - Auto-resize textarea (max 150px)
  - Enter key to send
  - Disabled state when loading
  - Loading spinner in send button
  - Emits `send` event with message

#### 5. AI Data Modeler Drawer (`/frontend/components/ai-data-modeler-drawer.vue`)
- **Purpose**: Main UI container for AI chat
- **Features**:
  - Sliding drawer from right (700px width)
  - Header with schema info (table/column count)
  - Loading state during initialization
  - Error state with retry button
  - Empty state before first message
  - Scrollable messages container with auto-scroll
  - Fixed input at bottom
  - Slide-in/slide-out animation
  - Uses `Teleport` to render at body level

#### 6. Integration with Data Model Builder (`/frontend/components/data-model-builder.vue`)
- **Added**:
  - "Build with AI" button in header (purple, with sparkle icon)
  - Import of `useAIDataModelerStore`
  - `openAIDataModeler()` function to open drawer
  - `<AIDataModelerDrawer />` component at bottom of template

## Dependencies

### Backend
```json
{
  "@google/genai": "^0.21.0",
  "ioredis": "^5.4.2",
  "uuid": "^11.0.4",
  "@types/uuid": "^10.0.0"
}
```

### Frontend
```json
{
  "marked": "^11.0.0"
}
```

## Environment Variables

### Backend
- `GEMINI_API_KEY`: Required for Google Gemini API access
- `REDIS_HOST`: Redis server hostname (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)
- `REDIS_PASSWORD`: Redis authentication password (optional)
- `REDIS_DB`: Redis database number (default: 0)

## Database Schema

### New Tables (Migration: 1764493430612)

**dra_ai_data_model_conversations**
- `id`: SERIAL PRIMARY KEY
- `data_source_id`: INTEGER (FK to dra_data_sources, CASCADE delete)
- `user_id`: INTEGER (FK to dra_users_platform, CASCADE delete)
- `data_model_id`: INTEGER (FK to dra_data_models, SET NULL on delete)
- `title`: VARCHAR(255) NOT NULL
- `status`: ENUM('draft', 'saved', 'archived') DEFAULT 'draft'
- `saved_at`: TIMESTAMP WITH TIME ZONE
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Indexes**: 
  - `IDX_ai_conversations_data_source_user` (data_source_id, user_id)
  - `IDX_ai_conversations_saved_at` (saved_at)

**dra_ai_data_model_messages**
- `id`: SERIAL PRIMARY KEY
- `conversation_id`: INTEGER (FK to dra_ai_data_model_conversations, CASCADE delete)
- `role`: ENUM('user', 'assistant') NOT NULL
- `content`: TEXT NOT NULL
- `timestamp`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- **Index**: `IDX_ai_messages_conversation` (conversation_id)

### Existing Tables Used
- `dra_data_sources`: For data source connection details
- `dra_users_platform`: For user authentication
- `dra_data_models`: Links conversations to saved models

## API Flow

### Session Initialization Flow (Redis-First)
1. User enters create-data-model page or clicks "Build with AI"
2. Frontend calls `initializeConversation(dataSourceId)`
3. Store calls `POST /api/ai-data-modeler/session/initialize` with `dataSourceId`
4. Backend:
   - Validates user access to data source via `DRADataSource` query
   - **Checks Redis** for existing session: `dra:ai:session:metadata:{dataSourceId}:{userId}`
   - **If session exists in Redis** (restoration):
     - Retrieves metadata, messages, model draft, schema context from Redis
     - Returns full session state with `source: 'redis'`
   - **If no session** (new):
     - Creates TypeORM DataSource connection
     - Uses `SchemaCollectorService` to introspect schema
     - Formats schema to markdown via `SchemaFormatterUtility`
     - Creates Gemini conversation with system prompt + schema context
     - Saves metadata + schema context to Redis (24-hour TTL)
     - Returns new session with `source: 'new'`
5. Frontend:
   - Stores `conversationId`, `messages`, `modelDraft`, `schemaContext`
   - Sets `isRestored: true` if source is 'redis'
   - Sets `sessionSource` to 'new' or 'redis'
   - Displays appropriate UI (restored banner or fresh start)

### Chat Flow (Redis Auto-Save)
1. User types message and clicks send
2. Frontend calls `sendMessage(message)`
3. Store calls `POST /api/ai-data-modeler/session/chat` with `dataSourceId` and `message`
4. Backend:
   - Verifies Gemini conversation exists (or recreates from Redis context)
   - Sends message to Gemini API
   - **Saves both messages to Redis** (user + assistant) with timestamps
   - Returns message pair
5. Frontend:
   - Adds user message to `messages` array
   - Adds AI response to `messages` array
   - Auto-scrolls to bottom
   - Session automatically persisted in Redis

### Model Draft Update Flow (Redis Auto-Save)
1. User modifies model structure (tables, relationships, etc.)
2. Frontend calls `updateModelDraft(draft)`
3. Store calls `POST /api/ai-data-modeler/session/model-draft`
4. Backend:
   - Serializes model draft to JSON
   - **Saves to Redis hash** with version + timestamp
   - Returns success with version number
5. Frontend:
   - Sets `isDirty: true` (unsaved changes indicator)
   - Draft persisted in Redis (restored on refresh)

### Save to Database Flow (Redis → PostgreSQL Transfer)
1. User finalizes data model and saves
2. Frontend calls `saveConversation(dataSourceId, dataModelId, title)`
3. Store calls `POST /api/ai-data-modeler/session/save`
4. Backend:
   - Retrieves all session data from Redis
   - Creates `DRAAIDataModelConversation` record (status: 'saved')
   - Bulk inserts `DRAAIDataModelMessage` records
   - **Deletes all Redis keys** for this session
   - Returns database conversation ID
5. Frontend:
   - Resets state (conversationId, messages, modelDraft)
   - Sets `isDirty: false`
   - Session permanently stored in database

### Cancel Session Flow (Redis Cleanup)
1. User abandons model creation (closes page, clicks cancel)
2. Frontend calls `cancelSession(dataSourceId)`
3. Store calls `DELETE /api/ai-data-modeler/session/:dataSourceId`
4. Backend:
   - **Deletes all Redis keys** for this session
   - Returns success
5. Frontend:
   - Resets all state
   - No data persisted

### Load Saved Conversation Flow (Database Read)
1. User views previously saved data model
2. Frontend calls `loadSavedConversation(dataModelId)`
3. Store calls `GET /api/ai-data-modeler/conversations/:dataModelId`
4. Backend:
   - Queries `DRAAIDataModelConversation` with user verification
   - Joins `DRAAIDataModelMessage` records (ordered by timestamp)
   - Returns conversation + messages with `source: 'database'`
5. Frontend:
   - Displays read-only conversation history
   - No Redis session created (historical view only)

## Session Management

### Redis Session Structure
```
dra:ai:session:metadata:{dataSourceId}:{userId}
  - conversationId (string)
  - dataSourceId (string)
  - userId (string)
  - createdAt (ISO timestamp)
  - lastActivity (ISO timestamp)
  - TTL: 24 hours

dra:ai:session:messages:{dataSourceId}:{userId}
  - List of JSON objects: [{role, content, timestamp}, ...]
  - TTL: 24 hours

dra:ai:session:model-draft:{dataSourceId}:{userId}
  - modelState (JSON string)
  - version (number)
  - lastModified (ISO timestamp)
  - TTL: 24 hours

dra:ai:session:schema:{dataSourceId}:{userId}
  - Markdown-formatted schema context
  - TTL: 24 hours
```

### Session Lifecycle
- **Creation**: On initialize, temporary UUID generated for Redis
- **Storage**: 
  - Draft state: Redis (24-hour TTL)
  - Saved state: PostgreSQL (permanent)
- **Restoration**: Automatic on page refresh (checks Redis first)
- **Timeout**: 24 hours in Redis (auto-expires)
- **Cleanup**: 
  - On save: Redis → Database transfer + Redis delete
  - On cancel: Redis delete only
  - On expiry: Redis auto-expires (TTL)
  - Gemini sessions: 1-hour timeout with automatic cleanup

### Chat History Persistence
- **During Creation**: Stored in Redis (survives page refresh)
- **After Save**: Transferred to PostgreSQL (permanent record)
- **On Cancel**: Deleted from Redis (no permanent record)

## Security

### Authentication
- All endpoints protected by `validateJWT` middleware
- User ID extracted from JWT token (`tokenDetails`)

### Authorization
- Data source access verified via user relationship:
  ```typescript
  manager.findOne(DRADataSource, {
    where: { id: dataSourceId, users_platform: user }
  })
  ```

### Data Protection
- Connection details auto-decrypted by TypeORM transformer
- Database passwords never sent to frontend
- Gemini API key stored in backend environment only
- Redis password required in production (REDIS_PASSWORD env var)
- Redis session keys include userId to prevent cross-user access
- Database conversation queries always include user verification

## Error Handling

### Backend
- HTTP 400: Invalid request (missing parameters)
- HTTP 404: Resource not found (data source, conversation)
- HTTP 500: Internal server error (with details in development)

### Frontend
- Error state in drawer with retry button
- Toast notifications for network errors
- Loading states during async operations

## Testing Checklist

### Backend - Redis Session Management
- [ ] Initialize new session (first time user)
- [ ] Initialize and restore session from Redis
- [ ] Send message and verify Redis persistence
- [ ] Update model draft and verify Redis save
- [ ] Get session state from Redis
- [ ] Save conversation to database (Redis → PostgreSQL transfer)
- [ ] Cancel session and verify Redis cleanup
- [ ] Load saved conversation from database
- [ ] Session restoration after page refresh
- [ ] Session expiry after 24 hours (TTL)
- [ ] Multiple concurrent sessions (different users/data sources)
- [ ] Invalid data source ID
- [ ] Data source owned by different user
- [ ] Redis connection failure handling
- [ ] Database migration successful

### Backend - Legacy Endpoints
- [ ] Initialize conversation (legacy in-memory)
- [ ] Send message (legacy)
- [ ] Close conversation (legacy)
- [ ] Session cleanup after 1 hour (Gemini)
- [ ] Backward compatibility with existing clients

### Frontend
- [ ] Initialize conversation (new session)
- [ ] Initialize conversation (restore from Redis)
- [ ] Display restored session banner
- [ ] Send message and see auto-save indicator
- [ ] Update model draft (isDirty flag)
- [ ] Save conversation (clears Redis)
- [ ] Cancel session (warns about unsaved changes)
- [ ] Load saved conversation (read-only view)
- [ ] Markdown rendering in AI responses
- [ ] Auto-scroll to new messages
- [ ] Loading states during API calls
- [ ] Error states with retry
- [ ] Keyboard shortcuts (Enter to send)
- [ ] Session source indicator (new/redis/database)

### Integration
- [ ] PostgreSQL data source
- [ ] MySQL data source
- [ ] MariaDB data source
- [ ] Complex schemas with relationships
- [ ] Schemas with no relationships
- [ ] Large schemas (100+ tables)
- [ ] Multiple foreign keys per table
- [ ] Composite primary keys
- [ ] End-to-end: Create → Refresh → Modify → Save → View
- [ ] End-to-end: Create → Refresh → Modify → Cancel → Verify cleanup
- [ ] Redis persistence across server restarts
- [ ] Database persistence after save

## Known Limitations

1. **Redis Dependency**: System requires Redis for session management (mitigated with Docker Compose setup)
2. **24-Hour TTL**: Draft sessions auto-expire after 24 hours if not saved
3. **Gemini Session Timeout**: AI context resets after 1 hour of inactivity (conversation history preserved in Redis)
4. **No Streaming**: AI responses return all at once (streaming available but not implemented in UI)
5. **No Export**: Cannot export chat history or recommendations (can view saved conversations in database)
6. **One Active Draft**: One draft session per data source per user at a time

## Future Enhancements

### Phase 2 (High Priority)
- [ ] Export conversation to PDF/Markdown
- [ ] Apply AI recommendations directly to data model builder (one-click)
- [ ] Streaming responses with real-time updates
- [ ] Conversation history panel (list all saved conversations)
- [ ] Search across saved conversations

### Phase 3 (Medium Priority)
- [ ] Multi-modal support (upload ERD images)
- [ ] Code generation for data models (SQL DDL export)
- [ ] Integration with query builder
- [ ] Conversation branching (save multiple versions)
- [ ] AI-powered query optimization

### Phase 4 (Future)
- [ ] Collaborative sessions (team chat)
- [ ] Role-based conversation templates
- [ ] Custom AI training on organization schemas
- [ ] Automated documentation generation

## File Naming Conventions

- Backend routes: `snake_case` (e.g., `ai_data_modeler.ts`)
- Backend utilities: `PascalCase` (e.g., `SchemaFormatter.ts`)
- Backend services: `PascalCase` (e.g., `GeminiService.ts`)
- Frontend components: `kebab-case` (e.g., `ai-chat-message.vue`)
- Frontend stores: `kebab-case` (e.g., `ai-data-modeler.ts`)

## Git Branch
- `DRA-217-Design-The-Flow-And-Use-Case-For-Implementing-AI-Data-Modeler`

## Related Documentation
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Redis Documentation](https://redis.io/docs/)
- [ioredis Documentation](https://github.com/redis/ioredis)
- [Marked.js Documentation](https://marked.js.org/)
- [TypeORM Documentation](https://typeorm.io/)
- [Pinia Store Documentation](https://pinia.vuejs.org/)

## Support
For issues or questions, refer to:
- **Backend logs**: Check console output for Gemini API errors, Redis connection issues
- **Frontend console**: Check network tab for API request/response details
- **Redis debugging**: Use `redis-cli` to inspect session keys
- **Environment**: Ensure `GEMINI_API_KEY` and Redis credentials are set in backend `.env`
- **Database**: Run migrations to create conversation tables
