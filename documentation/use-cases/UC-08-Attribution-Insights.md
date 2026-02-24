# UC-08 — Attribution & Insights

**Domain:** Attribution & Insights  
**Version:** 1.0  
**Date:** 2026-02-24  
**Standard:** UML 2.5 / IEEE 830 / Cockburn Fully-Dressed Format

---

## Actor Catalogue

| Actor | Type | Description |
|---|---|---|
| **Project Owner / Editor** | Primary Human | Configures attribution models and views reports |
| **Project Viewer** | Primary Human | Views reports read-only |
| **External Tracking Client** | Primary System | Any system or webpage posting attribution events to the API |
| **AttributionProcessor** | Secondary System | Singleton processor for all attribution operations |
| **InsightsProcessor** | Secondary System | Singleton processor for AI-generated insight generation |
| **Rate Limiter** | Secondary System | `expensiveOperationsLimiter` — 30 req / 15 min on report generation |

---

## Domain Use Case Diagram

```
+-----------------------------------------------------------+
|            <<system boundary>>                            |
|                Attribution & Insights                     |
|                                                           |
|  UC-ATT-01  Track Attribution Event                      |
|  UC-ATT-02  Generate Attribution Report                  |
|  UC-ATT-03  View Attribution Report                      |
|  UC-ATT-04  Perform Funnel Analysis                      |
|  UC-ATT-05  View Customer Journey Map                    |
|  UC-ATT-06  Set Attribution Tab Visibility               |
|  UC-INS-01  Generate AI Insights for Dataset             |
|  UC-INS-02  View AI Insights                             |
+-----------------------------------------------------------+

Project Owner/Editor -----> UC-ATT-02 through UC-ATT-06,
                            UC-INS-01, UC-INS-02
Project Viewer -----------> UC-ATT-03, UC-ATT-05, UC-INS-02
External Tracking Client -> UC-ATT-01
AttributionProcessor <----- UC-ATT-01 through UC-ATT-05
InsightsProcessor <-------- UC-INS-01, UC-INS-02

<<include>>:
  UC-ATT-02 <<include>> Enforce Expensive Operations Rate Limit
  UC-ATT-04 <<include>> Validate Funnel Steps
  UC-INS-01 <<include>> AI Engine Call (Gemini)

<<extend>>:
  UC-ATT-02 <<extend>> Attribution Tab Visibility Check
```

---

## UC-ATT-01 — Track Attribution Event

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-01 |
| **Use Case Name** | Track Attribution Event |
| **Primary Actor** | External Tracking Client |
| **Secondary Actors** | AttributionProcessor |
| **Priority** | High |
| **Trigger** | `POST /attribution/track` — fired when a user performs a pageview, interaction, or conversion |
| **Preconditions** | Caller is authenticated (JWT). `projectId`, `userIdentifier`, `eventType` provided. |
| **Postconditions (Success)** | Event persisted to `dra_attribution_events` with timestamp and metadata. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Tracking Client | Sends event payload: `{ projectId, userIdentifier, eventType, eventName, eventValue, pageUrl, referrer, utmParams, customData }`. |
| 2 | System | Validates JWT. |
| 3 | System | Validates required fields: `projectId`, `userIdentifier`, `eventType`. |
| 4 | System | Defaults `eventTimestamp` to `now()` if not provided. |
| 5 | System | `AttributionProcessor.trackEvent()` — persists event record. |
| 6 | System | HTTP 201 with event confirmation. |

### Alternative Flows

**ALT-ATT01A — Missing Required Fields**
- At step 3: HTTP 400: *"Missing required fields: projectId, userIdentifier, eventType."*

**ALT-ATT01B — Invalid Timestamp Format**
- At step 4: parse error; defaults to `now()`.

### Business Rules
- BR-ATT-01: Every event is associated with a `projectId` for multi-tenant isolation.
- BR-ATT-02: `userIdentifier` is client-supplied (cookie, session, hashed email) — not a platform user ID.

---

## UC-ATT-02 — Generate Attribution Report

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-02 |
| **Use Case Name** | Generate Attribution Report |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | AttributionProcessor, Rate Limiter |
| **Priority** | High |
| **Trigger** | `POST /attribution/reports` |
| **Preconditions** | 1. User authenticated. 2. Project has event data in date range. 3. Valid attribution model specified. |
| **Postconditions (Success)** | Attribution report persisted and returned with channel credit scores. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Configures report: `projectId`, `reportName`, `attributionModel` (first_touch / last_touch / linear / time_decay), `startDate`, `endDate`. |
| 2 | Client | `POST /attribution/reports`. |
| 3 | System | `expensiveOperationsLimiter` check (30 req / 15 min). |
| 4 | System | Validates all required fields. |
| 5 | System | `AttributionProcessor.generateReport()` — queries event data in date range; applies selected model algorithm; calculates credit distribution across touchpoints. |
| 6 | System | Persists report to `dra_attribution_reports`. |
| 7 | System | Returns report with channel breakdowns and conversion paths. |

### Alternative Flows

**ALT-ATT02A — No Event Data in Date Range**
- At step 5: HTTP 400: *"No event data found for the specified date range."*

**ALT-ATT02B — Invalid Attribution Model**
- At step 4: HTTP 400: *"Invalid attribution model."*

**ALT-ATT02C — Rate Limit Hit**
- At step 3: HTTP 429.

### Attribution Model Definitions
| Model | Description |
|---|---|
| `first_touch` | 100% credit to first interaction |
| `last_touch` | 100% credit to last interaction before conversion |
| `linear` | Credit evenly distributed across all touchpoints |
| `time_decay` | More credit to touchpoints closer to conversion |

---

## UC-ATT-03 — View Attribution Report

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-03 |
| **Use Case Name** | View Attribution Report |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | User navigates to Attribution tab; `GET /attribution/reports/:projectId` |
| **Postconditions (Success)** | List of generated attribution reports returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens Attribution tab for a project. |
| 2 | Client | Requests reports list. |
| 3 | System | Validates JWT; validates project membership. |
| 4 | System | Returns reports ordered by generation date (newest first). |

### Alternative Flows

**ALT-ATT03A — Tab Visibility Hidden**
- If admin has set attribution tab visibility to hidden for this project tier: tab not rendered.

---

## UC-ATT-04 — Perform Funnel Analysis

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-04 |
| **Use Case Name** | Perform Funnel Analysis |
| **Primary Actor** | Project Owner / Editor |
| **Trigger** | `POST /attribution/funnel` with funnel step definitions |
| **Preconditions** | At least 2 funnel steps defined; event data exists. |
| **Postconditions (Success)** | Funnel analysis showing conversion rates at each step returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Defines funnel steps (ordered sequence of `eventType` or `eventName` values). |
| 2 | Client | `POST /attribution/funnel` with `IFunnelAnalysisRequest`. |
| 3 | System | Validates steps (min 2). |
| 4 | System | `AttributionProcessor.analyzeFunnel()` — calculates users entering at each step and drop-off rates. |
| 5 | System | Returns funnel data: entry count per step, conversion %, drop-off %. |

### Alternative Flows

**ALT-ATT04A — Fewer Than 2 Steps**
- HTTP 400: *"Funnel requires at least 2 steps."*

**ALT-ATT04B — No Users Match First Step**
- Returns funnel with 0 entries at step 1.

---

## UC-ATT-05 — View Customer Journey Map

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-05 |
| **Use Case Name** | View Customer Journey Map |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | `POST /attribution/journey` with `IJourneyMapRequest` |
| **Postconditions (Success)** | Sankey/path diagram data showing common user journey paths returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Opens journey map view; selects project and date range. |
| 2 | System | `AttributionProcessor.buildJourneyMap()` — aggregates event sequences by `userIdentifier`. |
| 3 | System | Returns top N journey paths with conversion rates. |

---

## UC-ATT-06 — Set Attribution Tab Visibility

| Field | Value |
|---|---|
| **Use Case ID** | UC-ATT-06 |
| **Use Case Name** | Set Attribution Tab Visibility |
| **Primary Actor** | Platform Admin |
| **Trigger** | Admin toggles attribution tab visibility setting |
| **Postconditions (Success)** | Attribution tab shown/hidden for specified project/tier scope. |

---

## UC-INS-01 — Generate AI Insights for Dataset

| Field | Value |
|---|---|
| **Use Case ID** | UC-INS-01 |
| **Use Case Name** | Generate AI Insights for Dataset |
| **Primary Actor** | Project Owner / Editor |
| **Secondary Actors** | InsightsProcessor, AI Engine (Gemini) |
| **Priority** | Medium |
| **Trigger** | User clicks "Generate Insights" on a data model or dashboard |
| **Preconditions** | 1. User authenticated. 2. Data model has data. 3. AI tier limit not exceeded. |
| **Postconditions (Success)** | AI-generated natural language insights persisted and returned. |

### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Clicks "Generate Insights" for a data model. |
| 2 | System | AI rate limit check. |
| 3 | System | `InsightsProcessor` samples data from the model (summary statistics). |
| 4 | System | Sends data summary + schema context to Gemini. |
| 5 | AI Engine | Returns natural language analysis: trends, anomalies, key metrics. |
| 6 | System | Persists insight record with model reference. |
| 7 | System | Returns insight text to client. |

### Alternative Flows

**ALT-INS01A — AI Tier Limit Exceeded**
- HTTP 403 with upgrade prompt.

**ALT-INS01B — Empty Dataset**
- HTTP 400: *"Cannot generate insights: no data available."*

**ALT-INS01C — Gemini API Error**
- HTTP 502.

---

## UC-INS-02 — View AI Insights

| Field | Value |
|---|---|
| **Use Case ID** | UC-INS-02 |
| **Use Case Name** | View AI Insights |
| **Primary Actor** | Project Owner / Editor / Viewer |
| **Trigger** | User opens insights panel for a data model |
| **Postconditions (Success)** | Previously generated insights displayed. |

### Alternative Flows

**ALT-INS02A — No Insights Generated**
- Empty state prompts user to run UC-INS-01.
