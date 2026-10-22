# AI Usage Instrumentation Plan & Spec

Status: In implementation — backend instrumentation live (2026-10-22). Context caching (§6.2) and credit metering (§7) remain deferred.
Last updated: 2026-10-22
Scope: Backend instrumentation + tier/plan definitions. No architecture changes.

---

## 1. Purpose

Track and monitor every instance of AI (Gemini) usage across the platform so that:

1. We can compare heterogeneous features (18-step plan builder vs. a one-call insight)
   on a common, cost-based unit.
2. We can design fair-use ceilings for "unlimited AI" tiers from real data instead of
   guessing.
3. We get a per-org / per-user / per-feature cost picture that protects margin without
   a user-facing credit system (deferred, see §7).

The approved approach: **measure tokens from Gemini `usageMetadata` at a single choke
point, convert to USD cost using published model rates, and group calls into
user-facing actions for comparison.**

---

## 2. Updated subscription plan definitions

Resolved during discussion. These supersede earlier plan limits where they conflict.

### Free
- 1 project
- 1 paid media plan build / month
- 1 user
- Marketing intelligence overview only (no advanced BI tools)
- 4 channels per project: Google Ads, Meta, Google Analytics, Google Ad Manager
- CMO role only
- No deck/PPT export

### Starter
- 1 project
- 5 paid media plan builds / month
- 1 user
- Marketing intelligence overview only (no advanced BI tools)
- Unlimited channels per project
- CMO role only
- Deck/PPT export **allowed** (decision 2026-10-21; reverses the earlier
  "Starter must not receive deck export" decision)

### Professional
- Unlimited projects
- Unlimited paid media plan builds / month
- 2–5 users
- Roles: CMO + Manager + Analyst
- Marketing intelligence overview
- Advanced BI tools:
  - 5 million rows per **manual** data model (AI-built data models: no row cap)
  - Unlimited data sources / channels
  - Unlimited data models
  - Unlimited dashboards
  - Unlimited reports
  - Unlimited AI insights & generations (subject to fair-use ceiling, §6.4)

### Professional Plus
- Same as Professional, except:
  - 6–100 users
  - 100 million rows per manual data model

### Enterprise
- Same as Professional Plus, except:
  - 100+ users
  - Unlimited rows per manual data model
  - Enterprise items: SAML 2.0 SSO, SSO domain enforcement + JIT provisioning,
    white-glove onboarding, custom feature development, direct engineering support,
    uptime SLA, custom SLAs, volume discounts

### Channel limits
- Channel caps are **per project** (consistent with `max_data_sources_per_project`).
- Free = 4 per project (1 project ⇒ 4 org-wide). Starter = unlimited per project.
- The Free 4-channel set matches the marketing copy ("Google Ads, Meta, Google
  Analytics, and Google Ad Manager — connected securely via OAuth").

### Free preview (guest plan builder) quota logic
- Guest builds a plan without an account; preview valid 24 hours.
- If the user registers **before** the 24h expiry: the kept plan **consumes** the
  monthly build quota (1 build).
- If the user registers **after** expiry: quota is untouched until a new plan is
  actually built.
- Implementation requirement: the guest plan must be invalidated server-side after
  24h so the "after expiry" branch is enforceable.

---

## 3. Current AI surface audit (what is tracked today)

| Surface | Endpoint / path | Counted today |
|---|---|---|
| AI Data Modeler chat | `/ai-data-modeler/session/chat` | ✅ per message (incremented *before* the call) |
| Attribution | `/ai-data-modeler/attribution/message` | ✅ per message |
| Intelligence AI analysis | `/intelligence/ai-analysis/:projectId` | ✅ per run, only when data exists |
| Marketing intelligence AI insights | `/insights/session/generate`, `/insights/session/chat`, `/insights/reports/:id/chat` | ❌ rate-limited only |
| Report builder widgets | `generateWidgetSpec` (InsightsController, dashboard route) | ❌ |
| Dashboard auto-generate | `/dashboard/auto-generate` | ❌ |
| Data model chat | `/:data_model_id/chat/ask` | ❌ |
| Plan builder chat refinement | free-form Q&A (`PaidMediaPlanProcessor.askQuestion`) | ❌ |
| Paid media plan build (18 steps) | `PlanExecutionEngine` steps | ❌ (plan creation consumes 1 *plan build*, not an AI generation) |
| Anomaly alerts | `AnomalyDetectionService` (direct `genAI`) | ❌ |
| Budget optimization | `BudgetOptimizationService` (direct `genAI`) | ❌ |
| Web-search grounding | `SearchProvider` (direct `genAI`) | ❌ |
| Join inference, data model analysis | `JoinInferenceService`, `DataModelAnalysisService` | ❌ |

Key finding: **most AI cost lives in un-tracked surfaces.** "Unlimited AI" is already
de-facto true everywhere except data modeler chat and AI analysis. The instrumentation
closes this gap.

---

## 4. Comparison framework: cost per user-facing action

Raw token counts are not comparable across features because of model mix (Flash vs Pro),
input/output price asymmetry (~8×), caching, and multi-call actions (18-step plan build).

**Rule: the comparable unit is `cost_usd` per user-facing action.**

Two layers:

1. **Per call (Layer 1):** multiply `usageMetadata` token counts by the model's
   published rates → `cost_usd` per Gemini call.
2. **Per action (Layer 2):** group the N calls of one user-facing action (e.g. all 18
   plan-builder steps under `plan_id`) → cost per action. This is what gets compared
   across features.

Worked estimates (Gemini 2.5 Flash, standard pricing):

| User-facing action | Calls | Approx cost/action |
|---|---|---|
| Paid media plan build | 18 steps (~3K in + 2K out each) | ~$0.24 (falls to ~$0.10 with context caching) |
| AI insight run | 1 call (~20K in + 3K out) | ~$0.014 |
| AI analysis report | 1 heavy call (~40K in + 6K out) | ~$0.027 |
| Data modeler chat message | 1 call (cached history) | ~$0.004 |
| Dashboard auto-generate | 4–6 calls | ~$0.05–0.08 |

---

## 5. Instrumentation spec

### 5.1 Data source

Gemini responses expose `usageMetadata`:

- `promptTokenCount` (total input)
- `cachedContentTokenCount` (cached input)
- `candidatesTokenCount` (output, includes thinking tokens on reasoning models)
- `promptTokensDetails` / `candidatesTokensDetails` (per-modality breakdown)

### 5.2 Event table: `ai_call_logs`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `created_at` | timestamptz | index |
| `user_id` | int FK | null for system/guest |
| `org_id` | int FK | null for guest |
| `project_id` | int FK nullable | |
| `feature_key` | varchar enum | see §5.3 |
| `action_id` | varchar nullable | plan_id / conversation_id / session_id — groups multi-call actions |
| `model_id` | varchar | e.g. `gemini-2.5-flash` |
| `input_tokens` | int | |
| `cached_input_tokens` | int | default 0 |
| `output_tokens` | int | |
| `thought_tokens` | int | subset of output, default 0 |
| `total_tokens` | int | computed |
| `status` | varchar | `success` \| `failed` \| `fallback` \| `skipped_no_data` |
| `error_info` | text nullable | truncated error |
| `latency_ms` | int | |
| `cost_usd` | decimal(12,6) | computed at write time from model rates |
| `cache_enabled` | boolean | whether the call used caching config |

Indexes: `(org_id, created_at)`, `(feature_key, created_at)`,
`(action_id)` (partial where action_id not null).

### 5.3 Feature keys (fixed enum)

```
plan_build               — 18-step paid media plan build (action = plan_id)
plan_chat                — free-form plan Q&A refinement (action = plan_id)
data_modeler_chat        — AI data modeler session chat (action = conversation_id)
attribution              — attribution session messages
ai_insights_generate     — /insights/session/generate
ai_insights_chat         — /insights/session/chat
ai_insights_report_chat  — /insights/reports/:id/chat
report_widget            — generateWidgetSpec (report builder widgets)
dashboard_auto_generate  — /dashboard/auto-generate
dashboard_widget_spec    — widget spec generation on dashboard routes
data_model_chat          — /:data_model_id/chat/ask
ai_analysis              — /intelligence/ai-analysis
join_inference           — JoinInferenceService
data_model_analysis      — DataModelAnalysisService
anomaly_detection        — AnomalyDetectionService
budget_optimization      — BudgetOptimizationService
search_grounding         — SearchProvider (web grounding)
```

### 5.4 Cost calculator

Per model, standard pricing (verify at implementation time against
ai.google.dev/gemini-api/docs/pricing; current as of 2026-10-19):

| Model | Input /1M | Output /1M | Cached input /1M |
|---|---|---|---|
| Gemini 2.5 Flash | $0.30 | $2.50 | $0.03 |
| Gemini 2.5 Flash Lite | $0.10 | $0.40 | $0.01 |
| Gemini 2.5 Pro (≤200K) | $1.25 | $10.00 | $0.125 |

```
cost_usd =
  input_tokens       * in_rate +
  cached_input_tokens * cache_rate +
  output_tokens      * out_rate
```

- Output price includes thinking tokens on reasoning models; `thought_tokens` is
  stored for analytics but already inside `output_tokens`.
- Model, rates, and model routing are configured centrally; cost is computed in the
  instrumentation helper, not per call site.

### 5.5 Instrumentation points (choke points)

All calls funnel through a single `trackAICall(...)` helper. Callers supply
`feature_key` and `action_id` via an async-local/context value so deep call sites do
not have to thread parameters.

1. **`GeminiService` (primary choke point):** wrap every `generateContent` /
   `generateContentStream` call site (lines ~127, 181, 267, 316, 445, 485, 537).
   This automatically covers: data modeler chat, ai_analysis, report widgets,
   plan builder Q&A, data model chat, join inference, data model analysis,
   dashboard widget spec.
2. **Direct `genAI` call sites** that bypass GeminiService:
   - `AnomalyDetectionService` (~line 1245)
   - `BudgetOptimizationService` (~line 867)
   - `SearchProvider` (~line 33)
   These call the same `trackAICall` helper directly.
3. **Plan execution engine:** the 18-step plan build must set
   `feature_key = plan_build`, `action_id = plan_id` for the whole build so all steps
   roll up under one action. `enforcePlanBuildLimit` continues to gate plan creation
   (1 build per created plan).
4. **Streaming responses:** record usage after stream completion (token counts are
   known only when the stream ends).

Failure semantics: log even failed/fallback calls (`status = failed|fallback`) so
wasted spend is visible. Do **not** block or retry the AI call on a log failure —
instrumentation is fire-and-forget (in-process queue or async write).

### 5.6 Rollups (read side)

- **Action rollup:** `SUM(cost_usd), COUNT(*)` grouped by `(feature_key, action_id)`.
- **Monthly org rollup:** per `(org_id, feature_key, month)`:
  `cost_usd`, `call_count`, `actions_count`, `active_users`.
- **Monthly user rollup:** per `(user_id, feature_key, month)` for top-user analysis.
- **Cost share:** `cost_usd` by `feature_key` — tells us where the bill lives.

---

## 6. Usage in the plan design

### 6.1 What counts as "a generation"

Decision still open; recommended default (proposed 2026-10-21):

- **Chat surfaces:** count **per session**, not per message (first message in a
  conversation = 1; subsequent turns free) with an abuse cap (~first 10–15 turns,
  then per-message). Matches the user's mental model and the plan-build framing;
  extra turns are cheap once context caching is on.
- **Plan builds:** the existing plan-build quota is the unit (1 created plan = 1 build).
- **BI-layer generation surfaces** (insights, reports, dashboard auto-gen): count per
  user-facing action for monitoring; the user-facing plan says "unlimited" (fair-use).

### 6.2 Context caching (biggest cost lever)

- The plan builder repeats the same website/site context across all 18 steps: enable
  `cacheToTtl` so steps 2–17 read cached input at ~90% off.
- Multi-turn chats benefit the same way.
- This is a separate, cheap work item and should land with or before instrumentation.

### 6.3 Model routing

- Flash-Lite for trivial text tasks, Flash for plan builds / insights / analysis,
  Pro only for complex joins or attribution. Routing choices are made centrally and
  are visible in `model_id` per call.

### 6.4 Fair-use ceilings (to be calibrated with real data)

- Marketed as unlimited on Professional+; enforced as generous monthly cost ceilings
  per org using the rollups. Proposed anchors to start: Pro ~$10/org/mo AI cost,
  Pro+ ~$50/org/mo, Enterprise: SLA-based. Numbers get set from §4 estimates after
  2 months of live data, not before.
- Ceilings are enforced server-side at the choke point; no user-facing credit concept.

### 6.5 Revisit trigger (when to consider a real metering/credit system)

If AI cost exceeds **~10% of subscription revenue for two consecutive months**, we
implement credit-based add-ons. The `ai_call_logs` data will already be in place to
rate credits. Industry context: ~80% of new AI pricing is capacity-based (bundled
allowance + overages), and only ~13% of companies fully pass inference costs through —
deferral is the standard early-stage move.

---

## 7. Out of scope for this iteration

- User-facing credit wallet / credit purchases (deferred per §6.5).
- Token billing/invoices (Zuora-style billing pipeline).
- Any change to the subscription tier schema or project architecture.

---

## 8. Open decisions to finalize at implementation

1. Generation-count semantics per surface (adopt §6.1 default or per-message).
2. Fair-use ceiling dollar values per tier (§6.4 anchors).
3. Whether the usage card shows AI-usage meters publicly or server-side only.
4. Storage: `ai_call_logs` in the app DB vs. a separate analytics store; retention
   policy (proposal: 24 months active + monthly aggregate rollup forever).
5. Guest-plan instrumentation (no org/user yet) — track with a session id so preview
   builds are visible but never tied to an org until registration.
6. Exact model routing table per feature.

---

## 9. Suggested implementation order (when scheduled)

1. `ai_call_logs` table + `trackAICall` helper + GeminiService wrap (incl. streaming
   and the 3 direct call sites).
2. Plan execution engine action grouping (`plan_build`, `plan_id`).
3. Context caching on plan builder + chat history.
4. Cost calculator wiring + monthly rollup queries + a monitoring view.
5. Free preview 24h invalidation + quota semantics (§2).
6. Fair-use ceilings + server-side enforcement.
7. Plan/tier data updates per §2 (seeder/migration, no architecture change).
8. Re-evaluate credits at the §6.5 trigger.
