# UC-04 — AI Data Modeler

**Domain:** AI Data Modeler  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner / Editor** | Primary Human | Initiates and drives AI modelling sessions |
| **AI Engine (Gemini 2.0 Flash)** | Secondary System | Google Gemini; generates structured model recommendations |
| **Redis** | Secondary System | Session store with 24-hour TTL for active conversations |
| **PostgreSQL** | Secondary System | Persistent store for saved conversations and data models |
| **Rate Limiter (AI)** | Secondary System | `aiOperationsLimiter` — 20 req / hour |
| **Tier Enforcement** | Secondary System | `enforceAIGenerationLimit` — AI generation cap per tier |
| **SchemaCollectorService** | Secondary System | Introspects database tables and columns |
| **SchemaFormatter** | Secondary System | Converts schema to Markdown for AI prompt context |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|                  AI Data Modeler                          |
|                                                           |
|  UC-AI-01  Initialise Single-Source AI Session           |
|  UC-AI-02  Initialise Cross-Source AI Session            |
|  UC-AI-03  Send Natural Language Message to AI           |
|  UC-AI-04  View AI Model Recommendation                  |
|  UC-AI-05  Update Model Draft in Redis                   |
|  UC-AI-06  Get Session State                             |
|  UC-AI-07  Save AI Session to Database                   |
|  UC-AI-08  Cancel / Discard AI Session                   |
|  UC-AI-09  View Saved Conversation History               |
|  UC-AI-10  Get Suggested JOIN Relationships              |
+-----------------------------------------------------------+

Project Owner/Editor -----> All UCs
AI Engine (Gemini) <------- UC-AI-03, UC-AI-04
Redis <--------------------- UC-AI-01 through UC-AI-08
PostgreSQL <---------------- UC-AI-07, UC-AI-09

<<include>>:
  UC-AI-01 <<include>> Schema Introspection
  UC-AI-01 <<include>> Format Schema to Markdown
  UC-AI-02 <<include>> Multi-Source Schema Collection
  UC-AI-03 <<include>> Enforce AI Rate Limit
  UC-AI-03 <<include>> Enforce AI Tier Limit
  UC-AI-07 <<include>> Transfer Redis Session to PostgreSQL

<<extend>>:
  UC-AI-03 <<extend>> Cross-Source Modelling (if isCrossSource=true)
  UC-AI-07 <<extend>> Clear Redis Session on Save
```

---

## UC-AI-01 — Initialise Single-Source AI Session

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-01 |
| **Use Case Name** | Initialise Single-Source AI Session |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | AI Engine, Redis, SchemaCollectorService, SchemaFormatter |
| **Priority** | Critical |
| **Trigger** | User opens AI Data Modeler for a data source; `POST /ai-data-modeler/session/initialize` |
| **Preconditions** | 1. User authenticated. 2. Data source exists and is reachable. 3. AI rate limit and tier limit not exceeded. |
| **Postconditions (Success)** | Redis session created with schema context; Gemini conversation initialised; session state returned to client. |
| **Postconditions (Failure)** | No session created; error returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to AI Data Modeler for a data source. |
| 2 | Client | `POST /ai-data-modeler/session/initialize` with `{ dataSourceId }`. |
| 3 | System | Validates JWT; applies `aiOperationsLimiter`. |
| 4 | System | Validates `dataSourceId` (integer, non-empty). |
| 5 | System | `SchemaCollectorService.collectSchema()` — introspects the data source tables, columns, types, relationships. |
| 6 | System | `SchemaFormatter.formatSchemaToMarkdown()` — converts schema to structured Markdown prompt. |
| 7 | System | Creates Redis session with 24-hour TTL; stores schema context and conversation state. |
| 8 | System | Sends system prompt + schema Markdown to Gemini to initialise conversation context. |
| 9 | System | Returns session state (sessionId, available tables, initial AI greeting) to client. |

### Alternative Flows

**ALT-AI01A — Rate Limit Exceeded**
- At step 3: HTTP 429.

**ALT-AI01B — Data Source Unreachable During Schema Introspection**
- At step 5: HTTP 400: *"Schema introspection failed. Ensure the data source is connected and reachable."*

**ALT-AI01C — Empty Schema (no tables)**
- At step 5: schema collected but empty.
- System continues; AI initialised with warning that no tables were found.

**ALT-AI01D — Restore Existing Session**
- At step 7: Redis session already exists for `dataSourceId + userId`.
- System restores existing session instead of creating new one; returns prior state.

**ALT-AI01E — Tier AI Limit Reached**
- At step 3: `enforceAIGenerationLimit` returns HTTP 403 with upgrade prompt.

### Business Rules
- BR-AI-01: Redis sessions expire after 24 hours (TTL enforced at creation).
- BR-AI-02: Schema is formatted as Markdown and prepended to the system prompt.
- BR-AI-03: Sessions are scoped per `dataSourceId + userId` pair.
- BR-AI-04: Existing Redis sessions are restored, not overwritten (continued conversation).

---

## UC-AI-02 — Initialise Cross-Source AI Session

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-02 |
| **Use Case Name** | Initialise Cross-Source AI Session |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | AI Engine, Redis, Multiple SchemaCollectors |
| **Priority** | High |
| **Trigger** | `POST /ai-data-modeler/session/initialize-cross-source` with `{ projectId, dataSources: [] }` |
| **Preconditions** | 1. User authenticated. 2. At least one data source provided. 3. All listed data sources belong to the project and are accessible to the user. |
| **Postconditions (Success)** | Cross-source Redis session initialised with merged schema from all selected data sources. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Selects multiple data sources; initiates cross-source AI session. |
| 2 | Client | `POST /ai-data-modeler/session/initialize-cross-source` with `{ projectId, dataSources: [id1, id2, ...] }`. |
| 3 | System | Validates JWT; rate limit check. |
| 4 | System | Validates `projectId` and `dataSources` array (min 1 element). |
| 5 | System | Iterates `dataSources`; calls `SchemaCollectorService` for each; collects merged schema. |
| 6 | System | Merges schemas with source tagging (table prefixed with source name). |
| 7 | System | `SchemaFormatter` produces combined Markdown. |
| 8 | System | Creates Redis session with cross-source flag; initialises Gemini with merged context. |
| 9 | System | Returns session state. |

### Alternative Flows

**ALT-AI02A — One or More Sources Unreachable**
- At step 5: partial schema collection.
- System proceeds with reachable sources; warns user about unavailable sources.

**ALT-AI02B — Empty dataSources Array**
- At step 4: HTTP 400: *"dataSources must be a non-empty array."*

---

## UC-AI-03 — Send Natural Language Message to AI

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-03 |
| **Use Case Name** | Send Natural Language Message to AI |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | AI Engine (Gemini), Redis |
| **Priority** | Critical |
| **Trigger** | User types a message and sends; `POST /ai-data-modeler/session/chat` |
| **Preconditions** | 1. Active Redis session exists. 2. Rate and tier limits not exceeded. |
| **Postconditions (Success)** | AI response stored in Redis; structured response (Analysis / Models / SQL) returned to client. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Types natural language request (e.g., *"Create a model that shows monthly revenue by region"*). |
| 2 | Client | `POST /ai-data-modeler/session/chat` with `{ message, dataSourceId, conversationId?, isCrossSource? }`. |
| 3 | System | Validates JWT; applies `aiOperationsLimiter`; enforces `enforceAIGenerationLimit`. |
| 4 | System | Validates `message` (non-empty). |
| 5 | System | Retrieves session from Redis (`dataSourceId + userId`). |
| 6 | System | Appends user message to Redis conversation history. |
| 7 | System | Sends conversation history + user message to Gemini API. |
| 8 | AI Engine | Returns structured 3-section response: **Analysis** (schema interpretation), **Models** (recommended data model), **SQL** (generated query). |
| 9 | System | Stores AI response in Redis conversation history. |
| 10 | System | Returns AI response to client. |
| 11 | Client | Renders AI response in chat UI; displays Model and SQL recommendations. |

### Alternative Flows

**ALT-AI03A — No Active Session**
- At step 5: Redis session not found (expired or never created).
- HTTP 400: *"No active session found. Please initialise a session first."*
- Use case ends; client prompted to re-initialise.

**ALT-AI03B — Gemini API Failure**
- At step 7: Gemini returns error or timeout.
- HTTP 502: *"AI service temporarily unavailable. Please try again."*

**ALT-AI03C — Rate Limit Exceeded**
- At step 3: HTTP 429 with `Retry-After` header.

**ALT-AI03D — Tier Limit Exceeded**
- At step 3: HTTP 403 with upgrade prompt.

**ALT-AI03E — Cross-Source Message Routing**
- At step 5: `isCrossSource = true`; system routes to cross-source session handler.

### Business Rules
- BR-AI-05: AI responses follow a structured 3-section format (Analysis / Models / SQL).
- BR-AI-06: Full conversation history is sent to Gemini on each turn (context window).
- BR-AI-07: AI operations are capped at 20 requests per hour per user.

---

## UC-AI-04 — View AI Model Recommendation

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-04 |
| **Use Case Name** | View AI Model Recommendation |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | AI response received from UC-AI-03 |
| **Postconditions** | User sees structured model recommendations with SQL queries and can apply or iterate. |

*This use case is entirely client-side rendering following UC-AI-03.*

---

## UC-AI-05 — Update Model Draft in Redis

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-05 |
| **Use Case Name** | Update Model Draft in Redis |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | User modifies the proposed model interactively; `POST /ai-data-modeler/session/model-draft` |
| **Preconditions** | Active Redis session exists. |
| **Postconditions (Success)** | Updated `modelState` persisted to Redis session draft. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Edits columns, joins, or filters on the proposed model UI. |
| 2 | Client | `POST /ai-data-modeler/session/model-draft` with `{ dataSourceId, modelState }`. |
| 3 | System | Validates JWT; validates `modelState` is object; validates `dataSourceId`. |
| 4 | System | `RedisAISessionService.saveModelDraft()` updates draft state in Redis. |
| 5 | System | HTTP 200 confirmation. |

### Alternative Flows

**ALT-AI05A — Session Expired**
- Redis session TTL elapsed; HTTP 400; user prompted to re-initialise.

---

## UC-AI-06 — Get Session State

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-06 |
| **Use Case Name** | Get Session State |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `GET /ai-data-modeler/session/:dataSourceId` (on page load or tab switch) |
| **Postconditions (Success)** | Full session state (messages, model draft, schema) returned from Redis. |

### Alternative Flows

**ALT-AI06A — No Session Found**
- HTTP 404; client prompts user to start a new session.

---

## UC-AI-07 — Save AI Session to Database

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-07 |
| **Use Case Name** | Save AI Session to Database |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | Redis, PostgreSQL |
| **Priority** | High |
| **Trigger** | User clicks "Save Model"; `POST /ai-data-modeler/session/save` |
| **Preconditions** | Active Redis session exists; `title` provided. |
| **Postconditions (Success)** | Conversation and model persisted to `dra_ai_data_model_conversations` and `dra_ai_data_model_messages`. Redis session cleared. Data model record created in `dra_data_models`. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Save"; provides title for the session/model. |
| 2 | Client | `POST /ai-data-modeler/session/save` with `{ dataSourceId, title }`. |
| 3 | System | Validates JWT; validates `dataSourceId` and `title`. |
| 4 | System | `RedisAISessionService.transferToDatabase()`: reads all messages and model draft from Redis. |
| 5 | System | Inserts conversation record into `dra_ai_data_model_conversations` with `status = 'saved'`. |
| 6 | System | Inserts all messages into `dra_ai_data_model_messages`. |
| 7 | System | Creates or updates data model record in `dra_data_models`. |
| 8 | System | Clears Redis session. |
| 9 | System | HTTP 200 with `dataModelId`. |

### Alternative Flows

**ALT-AI07A — Redis Session Already Expired**
- At step 4: session not found; HTTP 400.
- User must re-initiate session or work from saved history.

**ALT-AI07B — Missing Title**
- At step 3: HTTP 422.

---

## UC-AI-08 — Cancel / Discard AI Session

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-08 |
| **Use Case Name** | Cancel / Discard AI Session |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `DELETE /ai-data-modeler/session/:dataSourceId` |
| **Postconditions (Success)** | Redis session deleted; no database record created. |

### Alternative Flows

**ALT-AI08A — Session Already Expired**
- Redis key not found; HTTP 200 (idempotent).

---

## UC-AI-09 — View Saved Conversation History

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-09 |
| **Use Case Name** | View Saved Conversation History |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `GET /ai-data-modeler/conversations/:dataModelId` |
| **Postconditions (Success)** | Full conversation history retrieved from PostgreSQL for the specified data model. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to saved data model's AI conversation history. |
| 2 | Client | `GET /ai-data-modeler/conversations/:dataModelId` with JWT. |
| 3 | System | Queries `dra_ai_data_model_conversations` and `dra_ai_data_model_messages`. |
| 4 | System | Returns messages ordered by timestamp. |

### Alternative Flows

**ALT-AI09A — No History Found**
- HTTP 404 or empty array.

---

## UC-AI-10 — Get Suggested JOIN Relationships

| Field | Value |
|---|---|
| **Use Case ID** | UC-AI-10 |
| **Use Case Name** | Get Suggested JOIN Relationships |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `GET /ai-data-modeler/suggested-joins/:dataSourceId` |
| **Postconditions (Success)** | AI-recommended JOIN pairs returned based on schema analysis (foreign key patterns, naming conventions). |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens join configuration; requests AI-suggested joins. |
| 2 | System | Introspects schema for the data source. |
| 3 | System | Analyses column names, types, and naming patterns to infer FK relationships. |
| 4 | System | Returns ordered list of join suggestions with confidence scores. |

### Alternative Flows

**ALT-AI10A — No Join Candidates Found**
- Returns empty array with message: *"No join candidates detected in schema."*
