# AI Data Modeler - Quick Start Guide

## Setup

### 1. Install Dependencies

#### Backend
```bash
cd backend
npm install
```

Required packages:
- `@google/genai`: Google Gemini API client
- `ioredis`: Redis client for session management
- `uuid`: Generate conversation IDs

#### Frontend
```bash
cd frontend
npm install
```

Required packages:
- `marked`: Markdown parser for AI responses

### 2. Configure Environment

Create or update `backend/.env`:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here

# Redis Configuration (optional - defaults shown)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

Get your API key from: https://aistudio.google.com/app/apikey

### 3. Setup Redis

#### Option A: Local Redis (Development)
```bash
# Install Redis
brew install redis  # macOS
# OR
sudo apt install redis-server  # Ubuntu

# Start Redis
redis-server
```

#### Option B: Docker Redis
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

### 4. Run Database Migrations

```bash
cd backend
npm run migration:run
```

This creates the following tables:
- `dra_ai_data_model_conversations`
- `dra_ai_data_model_messages`

### 5. Start Services

Ensure Redis is running, then:

#### Backend
```bash
cd backend
npm run dev
```

#### Frontend
```bash
cd frontend
npm run dev
```

## Usage

### For End Users

1. **Navigate to Data Model Builder**
   - Go to Projects → Select Project → Data Sources → Select Data Source → Create Data Model

2. **Open AI Assistant**
   - Click the blue "Build with AI" button in the top-right corner
   - If you have an existing draft, it will be restored automatically
   - Wait for schema analysis to complete (5-10 seconds) for new sessions

3. **Ask Questions**
   - Type your question in the input field
   - Press Enter or click Send
   - AI will analyze your schema and provide recommendations
   - All messages are automatically saved to Redis

4. **Example Questions**
   - "What data models should I create for sales analysis?"
   - "How can I optimize this schema for performance?"
   - "What relationships exist between these tables?"
   - "Suggest a star schema for business intelligence"
   - "How should I model customer lifetime value?"

5. **Session Persistence**
   - **Page Refresh**: Your conversation is automatically restored from Redis
   - **Draft State**: All chat history and model changes are saved in Redis (24-hour TTL)
   - **Final Save**: When you save the data model, conversation transfers to database permanently
   - **Cancel/Leave**: Cancelling discards the draft from Redis without saving

6. **Close Assistant**
   - Click the X button in the top-right of the drawer
   - Session remains in Redis for restoration
   - Click "Discard Draft" to permanently clear the session

### For Developers

#### Backend Endpoints

**Initialize or Restore Session**
```bash
POST /api/ai-data-modeler/session/initialize
Authorization: Bearer <jwt_token>
Authorization-Type: auth
Content-Type: application/json

{
  "dataSourceId": 123
}

# Response (New Session)
{
  "conversationId": "temp-uuid-v4",
  "messages": [],
  "modelDraft": null,
  "schemaContext": {...},
  "schemaSummary": {...},
  "source": "new"
}

# Response (Restored from Redis)
{
  "conversationId": "temp-uuid-v4",
  "messages": [{...}],
  "modelDraft": {...},
  "schemaContext": {...},
  "source": "redis"
}
```

**Send Message (Auto-saves to Redis)**
```bash
POST /api/ai-data-modeler/session/chat
Authorization: Bearer <jwt_token>
Authorization-Type: auth
Content-Type: application/json

{
  "dataSourceId": 123,
  "message": "What data models should I create?"
}

# Response
{
  "userMessage": {
    "role": "user",
    "content": "What data models...",
    "timestamp": "2025-01-15T10:30:00Z"
  },
  "assistantMessage": {
    "role": "assistant",
    "content": "# Structural Analysis...",
    "timestamp": "2025-01-15T10:30:05Z"
  }
}
```

**Update Model Draft (Auto-saves to Redis)**
```bash
POST /api/ai-data-modeler/session/model-draft
Authorization: Bearer <jwt_token>
Authorization-Type: auth
Content-Type: application/json

{
  "dataSourceId": 123,
  "modelState": {
    "tables": {...},
    "relationships": [...],
    "indexes": [...]
  }
}

# Response
{
  "success": true,
  "version": 5,
  "lastModified": "2025-01-15T10:35:00Z"
}
```

**Get Current Session**
```bash
GET /api/ai-data-modeler/session/123
Authorization: Bearer <jwt_token>
Authorization-Type: auth

# Response
{
  "metadata": {...},
  "messages": [...],
  "modelDraft": {...},
  "schemaContext": {...}
}
```

**Save to Database (Clears Redis)**
```bash
POST /api/ai-data-modeler/session/save
Authorization: Bearer <jwt_token>
Authorization-Type: auth
Content-Type: application/json

{
  "dataSourceId": 123,
  "dataModelId": 456,
  "title": "Sales Analytics Model"
}

# Response
{
  "conversationId": 789,
  "success": true,
  "message": "Conversation saved to database successfully"
}
```

**Cancel Session (Clears Redis)**
```bash
DELETE /api/ai-data-modeler/session/123
Authorization: Bearer <jwt_token>
Authorization-Type: auth

# Response
{
  "success": true,
  "message": "Session cancelled and cleared successfully"
}
```

**Get Saved Conversation**
```bash
GET /api/ai-data-modeler/conversations/456
Authorization: Bearer <jwt_token>
Authorization-Type: auth

# Response
{
  "conversation": {
    "id": 789,
    "title": "Sales Analytics Model",
    "status": "saved",
    "messages": [...]
  },
  "source": "database"
}
```

#### Frontend Store Usage

```typescript
import { useAIDataModelerStore } from '~/stores/ai-data-modeler';

const aiDataModelerStore = useAIDataModelerStore();

// Initialize or restore conversation when entering create-data-model page
await aiDataModelerStore.initializeConversation(dataSourceId);

// Check if session was restored from Redis
if (aiDataModelerStore.isRestored) {
  console.log('Restored session with', aiDataModelerStore.messages.length, 'messages');
}

// Send message (auto-saves to Redis)
await aiDataModelerStore.sendMessage('What models should I create?');

// Update model draft as user makes changes (auto-saves to Redis)
aiDataModelerStore.updateModelDraft({
  tables: [...],
  relationships: [...],
  indexes: [...]
});

// Save conversation to database when model is finalized
await aiDataModelerStore.saveConversation(
  dataSourceId,
  dataModelId,
  'My Model Title'
);

// Cancel session if user leaves without saving (clears Redis)
aiDataModelerStore.cancelSession(dataSourceId);

// Load previously saved conversation from database
await aiDataModelerStore.loadSavedConversation(dataModelId);

// Access state
const {
  messages,
  isLoading,
  error,
  schemaSummary,
  modelDraft,
  isDirty,
  isRestored,
  sessionSource
} = aiDataModelerStore;
```

#### Component Integration

```vue
<template>
  <div>
    <button @click="openAI">Ask AI</button>
    <AIDataModelerDrawer />
  </div>
</template>

<script setup>
import { useAIDataModelerStore } from '~/stores/ai-data-modeler';
import AIDataModelerDrawer from '~/components/ai-data-modeler-drawer.vue';

const aiStore = useAIDataModelerStore();

function openAI() {
  aiStore.openDrawer(dataSource.value.id);
}
</script>
```

## Troubleshooting

### Common Issues

**1. "API key not found" error**
```bash
# Solution: Set GEMINI_API_KEY in backend/.env
echo "GEMINI_API_KEY=your_key_here" >> backend/.env
```

**2. Redis connection failed**
```bash
# Solution: Ensure Redis is running
# Local: redis-cli ping (should return PONG)
# Docker: docker ps | grep redis
docker-compose up -d redis

# Check Redis config in backend/.env
REDIS_HOST=localhost
REDIS_PORT=6379
```

**3. "Session not found" error**
```bash
# Solution: Redis session expired (24-hour TTL) or was cleared
# Reinitialize by refreshing the create-data-model page
# Session auto-restores if still in Redis
```

**4. "Data source not found" error**
```bash
# Solution: User doesn't have access to data source
# Verify dataSourceId belongs to current user
```

**5. Schema introspection fails**
```bash
# Solution: Check data source connection details
# Test connection in Data Sources page
```

**6. Markdown not rendering**
```bash
# Solution: Check marked package is installed
cd frontend && npm install marked
```

**7. Session not restoring after page refresh**
```bash
# Solution: Check browser console for errors
# Verify dataSourceId matches the session in Redis
# Check Redis keys: redis-cli KEYS "dra:ai:session:*"
```

### Debug Mode

#### Backend
```typescript
// RedisAISessionService.ts - Enable Redis debugging
const result = await this.getSessionMetadata(dataSourceId, userId);
console.log('Redis session metadata:', result);

// GeminiService.ts - Enable detailed logging
console.log('Gemini request:', message);
console.log('Gemini response:', response);
```

#### Frontend
```typescript
// Check store state in Vue DevTools
// Or use console
const aiStore = useAIDataModelerStore();
console.log('Current state:', aiStore.$state);
console.log('Session source:', aiStore.sessionSource); // 'new', 'redis', or 'database'
console.log('Is restored:', aiStore.isRestored);
console.log('Is dirty:', aiStore.isDirty);
```

#### Redis Debugging
```bash
# Check active sessions
redis-cli KEYS "dra:ai:session:*"

# View session metadata
redis-cli HGETALL "dra:ai:session:metadata:123:456"

# View message count
redis-cli LLEN "dra:ai:session:messages:123:456"

# View model draft
redis-cli HGETALL "dra:ai:session:model-draft:123:456"

# Check TTL on session data
redis-cli TTL "dra:ai:session:metadata:123:456"
```

### Check API Key
```bash
# Test Gemini API directly
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

## Tips & Best Practices

### For Users

1. **Be Specific**: Instead of "Help me", ask "What star schema should I create for sales analysis?"

2. **Provide Context**: Mention your business domain (e-commerce, finance, healthcare, etc.)

3. **Iterative Refinement**: Start broad, then ask follow-up questions to refine recommendations

4. **Schema Quality**: AI works best with well-named tables and columns (avoid abbreviations)

### For Developers

1. **Error Handling**: Always wrap API calls in try-catch blocks

2. **Loading States**: Show loading indicators during async operations

3. **Redis Session Management**: 
   - Sessions auto-expire after 24 hours
   - Always handle cases where Redis data may be cleared
   - Call `cancelSession()` when user explicitly abandons model creation
   - Call `saveConversation()` only after data model is successfully saved

4. **Rate Limiting**: Implement debouncing for message sends and model draft updates

5. **Markdown Security**: `marked` is configured for safe rendering, don't disable sanitization

6. **Model Draft Tracking**: Use `isDirty` flag to warn users before leaving unsaved changes

7. **Session Restoration**: Check `isRestored` and `sessionSource` to provide appropriate UI feedback

## Performance

### Expected Response Times

- **Initialize (New Session)**: 5-10 seconds (schema introspection + Redis save)
- **Initialize (Restore from Redis)**: < 1 second (Redis read)
- **Send Message**: 2-5 seconds (Gemini API + Redis save)
- **Update Model Draft**: < 100ms (Redis hash update)
- **Save to Database**: 1-3 seconds (PostgreSQL insert + Redis cleanup)
- **Cancel Session**: < 500ms (Redis delete)

### Optimization Tips

1. **Schema Size**: Limit to relevant tables if possible (< 100 tables)
2. **Redis Performance**: 
   - Redis operations are sub-100ms for typical session sizes
   - 24-hour TTL prevents unbounded growth
   - Use Redis pipelining for batch operations
3. **Caching**: Schema context cached in Redis for session duration
4. **Streaming**: Enable streaming for faster perceived response time
5. **Model Draft Updates**: Debounce draft saves to avoid excessive Redis writes

## Security Checklist

- [ ] GEMINI_API_KEY stored in environment variables (not in code)
- [ ] JWT validation enabled on all endpoints
- [ ] User access to data sources verified before initialization
- [ ] Connection details never exposed to frontend
- [ ] HTTPS enabled in production
- [ ] Rate limiting configured on API endpoints
- [ ] Redis password configured (REDIS_PASSWORD in .env)
- [ ] Redis accessible only from backend (not exposed to internet)
- [ ] Session keys include userId to prevent cross-user access
- [ ] Database conversations include user_id for access control

## Monitoring

### Key Metrics

- **Conversation Initialization Rate**: Tracks usage (new vs restored sessions)
- **Average Messages Per Conversation**: Tracks engagement
- **Session Restoration Rate**: % of sessions restored from Redis
- **Save vs Cancel Rate**: % of sessions saved to database vs abandoned
- **Redis Cache Hit Rate**: Efficiency of session restoration
- **Error Rate**: Tracks reliability
- **Response Time**: Tracks performance (Gemini API + Redis)
- **Session TTL Expiration Rate**: Sessions that expire before save/cancel

### Logging

#### Backend
```typescript
console.log('[AI Data Modeler] Initialize', { userId, dataSourceId });
console.log('[AI Data Modeler] Message', { conversationId, messageLength });
console.log('[AI Data Modeler] Error', { error, context });
```

#### Frontend
```typescript
console.log('[AI Store] Drawer opened', { dataSourceId });
console.log('[AI Store] Message sent', { messageLength });
console.log('[AI Store] Error', { error, action });
```

## Next Steps

After successful setup:

1. Test with sample data source
2. Review AI responses for accuracy
3. Gather user feedback
4. Iterate on system prompt
5. Monitor usage metrics

## Support Resources

- **API Documentation**: `/documentation/ai-data-modeler-implementation.md`
- **System Prompt**: `/backend/src/constants/system-prompts.ts`
- **Example Usage**: Check data-model-builder component
- **Community**: GitHub Issues

## Version History

- **v1.0.0** (January 2025): Initial implementation
  - Google Gemini integration
  - Schema introspection
  - Chat interface
  - Markdown rendering
