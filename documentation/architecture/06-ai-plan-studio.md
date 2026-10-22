# 06 — AI & Plan Studio

## Gemini integration (`GeminiService`, 783 lines)

- Model: `gemini-2.5-flash` default (env `PLAN_MODEL` for plan agent paths). Streaming via `sendMessageStream`/`runWithTools`; non-streaming `sendMessage`/`askQuestion`/`generateWidgetSpec`/`generateDataModelAnalysis`/`generateMarketingAnalysis`.
- Prompts: domain templates in `constants/system-prompts.ts` (AI data modeler two-prompt architecture, quality/attribution/insights expert prompts) and `templates/` (`DataModelAnalysisPrompt.ts`, `MarketingAnalysisPrompt.ts`), all temperature 0.3 with JSON-output parsing (markdown-fence stripping + field defaulting).
- Retry: no token-level retry; robustness layered at the plan agent (`maxToolCalls ?? 40`, transient-empty nudges ×2) and `PlanExecutionEngine` (step retries ×3, `isTransientFailure()`).
- **Every call is instrumented** by `AICallTrackerService.track()` (fire-and-forget) with `usageMetadata` (prompt/cached/candidate/thought tokens), latency, status → one `DRAAICallLog` row.

## AI feature keys (17) — per-feature usage comparison

`plan_build`, `plan_chat`, `data_modeler_chat`, `data_model_chat`, `ai_insights_generate`, `ai_insights_chat`, `ai_insights_report_chat`, `ai_analysis`, `report_widget`, `data_model_analysis`, `join_inference`, `anomaly_detection`, `budget_optimization`, `search_grounding`, `attribution`, `dashboard_auto_generate` + `dashboard_widget_spec` (reserved).

Cost model: `MODEL_RATES` USD/M tokens — gemini-2.5-flash 0.30/2.50/0.03 (in/cached/out), flash-lite 0.10/0.40/0.01, 2.5-pro 1.25/10.00/0.125. Rollups: `getMonthlyOrgRollup/UserRollup/Cost`, `getActionCosts` (per plan/conversation). Admin UI at `frontend/pages/admin/ai-usage.vue` over `routes/admin/ai-usage.ts`.

## Paid Media Plan Studio

### Pipeline (`constants/planSteps.ts`)

**18 step definitions** (stepNumber 0–17) across 5 phases, with **5 human gates**:

| # | stepKey | Phase | Gate | Artifacts |
|---|---|---|---|---|
| 0 | `intake` | discover | confirm_funnel_build_mode | — |
| 1 | `pm-brief` | discover | confirm_brief | 01-creative-brief |
| 2 | `pm-market-research` | discover | — | 02-market-research |
| 3 | `pm-competitor-research` | discover | — | 03-competitor-paid-media-research |
| 4 | `pm-company-paid-audit` | discover | — | 03a-company-paid-media-audit |
| 5 | `pm-audience-analysis` | discover | — | 04-audience-analysis-avatars |
| 6 | `pm-keyword-research` | define | confirm_urls_live | 05-keyword-destination-url-plan |
| 7 | `pm-ad-copy` | define | — | 06-ad-copy |
| 8 | `pm-creatives` | define | — | 07-creatives |
| 9 | `pm-landing-page-copy` | build | — | 08-landing-page-copy |
| 10 | `pm-landing-page-implementation` | build | — | 09-landing-page-implementation |
| 11 | `pm-media-plan` | build | — | 10-media-plan (+ 10-media-plan-xlsx script) |
| 12 | `pm-tracking-setup` | build | confirm_tracking | 11-tracking-setup |
| 13 | `pm-campaign-build` | launch | — | 12-campaign-build-guide |
| 14 | `pm-setup-checklist` | launch | pre_launch_qa | 13-setup-checklist (+ xlsx script) |
| 15 | `pm-results-review` | present | — | 14-results-review |
| 16 | `pm-client-presentation` | present | — | 00-strategy-deck-content (json) + 00-digital-marketing-strategy-deck (pptx script) |
| 17 | `plan-index` | present | — | 00-plan-index |

Defaults: autonomy `assisted`, currency USD, mode `basic`, funnel coverage `bofu_mofu`, build mode `test_only`. **Guest cut-off: step 6** (24 h no-account preview).

### Skills (`backend/skills/paid-media/`, 18 packs)

Each pack = `manifest.json` + `SKILL.md`; shared `_shared/guardrails.md`, `_shared/tools.md`, `_shared/orchestrator.md`. All: gemini-2.5-flash, temp 0.3, `maxToolCalls: 40`. `SkillRegistryService` validates prerequisites, artifact contracts, gate contracts, output contracts. **11 tools** in `SkillToolRegistry`: `web_search`, `web_fetch`, `read_state`, `write_state`, `read_artifact`, `write_artifact`, `ask_user` (raises gates, refuses private-ID questions), `query_marketing_metrics`, `list_connected_accounts`, `read_benchmarks`, `run_script`. **3 sandbox scripts** (`PlanScriptSandbox`): `media-plan-xlsx`, `setup-checklist-xlsx` (node-xlsx), `strategy-deck-pptx` (python-pptx, 120 s timeout).

### Execution engine (`PlanExecutionEngine`)

- In-memory durable loop: one step per iteration; plan re-enqueued after every step so state re-reads fresh from DB; 60 s heartbeat; stale `running` steps (>45 min) healed.
- Boot recovery: `recoverInterruptedSteps()` + `requeueIncompletePlans()`.
- **Gate pausing**: `waiting_for_input` blocks the loop; `basic` mode auto-approves gates (`SkillRunnerService.autoApproveGate`); `advanced` waits for the user. Guest plans pause at step >6 (`guest_limit_reached` event).
- Failure policy: non-transient → fail plan; transient → 3 retries; completion when all steps completed/skipped. Events + notifications via `PlanEventService` + `NotificationHelperService`.
- Steps stream messages over Socket.IO (`plan:message`); per-step messages persisted to `DRAPaidMediaPlanMessage` and rehydrated as Gemini contents.

### State, artifacts, export

- `PlanStateService` — `get/merge/replace/setVerification/validate` over plan JSONB `state`; VERIFIED/ESTIMATE/NOT VERIFIED semantics.
- Artifacts: `DRAPaidMediaPlanArtifact` (markdown/json/csv/xlsx/pptx/html/image; versioned `is_current`); **20 artifact contracts** (18 text + XLSX + PPTX binaries).
- `PlanExportService.exportPlan` — streams ZIP (archiver, level 9) of `README.txt` + `plan-state.md` + all current artifacts, named `{slug}.zip`.

### Launch, targets, outcomes, benchmarks

- `PlanLaunchService.publish` — sets plan `completed`; creates campaigns per platform (`PLATFORM_TO_CHANNEL`: google_search/google_display→google_ads, meta_ads, linkedin_ads, tiktok_ads), objective from funnel coverage; links campaigns to plan; creates targets via `CampaignTargetsService.upsert` (budget split, flight dates).
- `CampaignTargetsService` — `dra_campaign_targets` (campaign + ad-set levels; 16+ target fields: CTR, clicks, impressions, ROAS, leads, conversions, revenue, CPC/CPM/CPA/CPL, frequency, budgets, flight dates). Routes: read analyst/manager/cmo; write manager/cmo. These targets surface in the intelligence overview's ad-group/ad-set targets.
- `PlanOutcomeService.sync` — pulls `IntelligenceReportProcessor.getDigitalChannelMetrics` + offline metrics into `DRAPlanOutcome` (source `platform_sync`/`offline`; default last month).
- `PlanBenchmarkService.recompute` — aggregates outcomes into `dra_plan_benchmarks` (metrics cpc/cpm/ctr/cvr/cpl/roas/cpa, `MIN_SAMPLE=30`); feeds learned benchmarks into skill prompts.

### Guest plans (24 h preview)

- `GuestPlanService` — Redis token mapping (`guest-plan:token:*` ↔ `guest-plan:plan:*`, 24 h TTL), 32-byte base64url tokens.
- `GuestPlanProcessor` — create (website + platforms/markets/dates, forced `basic`), server-side 24 h expiry, steps ≤6, gate answers + free-form chat, `claimGuestPlan` attaches to user's "Lead-in Plans" project/org/workspace, clears guest markers, revokes token, consumes one monthly plan build, re-enqueues remaining steps.
- Engine heartbeat hard-deletes guest plans older than 24 h.

## AI Data Modeler

- `AIDataModelerController` (2466 lines) + `routes/ai_data_modeler.ts`: session init/restore (validates schema table count, regenerates missing inferred joins), chat (single/cross-source), model draft, save/cancel; attribution and data-quality expert sessions; `enforceAdvancedTools` + `enforceAIGenerationLimit` + `aiOperationsLimiter`.
- `RedisAISessionService` — Redis `dra:ai:` keys (`conversation:{type}:{ds}:{user}`, `messages:`, `model-draft:`, `schema-context:`; types `data_model|data_quality|attribution|insights`), 24 h TTL; **auto-persists every message to PostgreSQL** and falls back to PG when Redis is empty.
- Schema collection: `SchemaCollectorService` + `TableMetadataService` (logical names) + `JoinInferenceService` (5 rule-based patterns + optional Gemini) + `SchemaFormatterUtility`.
- `AutoDataModelService` — auto-create raw-layer `SELECT *` models per table + derived metric models for marketing/API sources, with atomic temp-table rename swaps.
- `DataModelChatService` — separate in-memory store (1 h timeout, 50 messages, ≤200 sampled rows), context built by `DataModelContextBuilder` (lineage, health, classification, SQL, sources → markdown).

## AI Insights & Reports

- `InsightsProcessor` — session init (sampling via `DataSamplingService`), streaming generation (`insight-analysis-progress` socket), follow-up chat, chat-on-report, auto-persist draft after every generation.
- `InsightsController` returns 202 for background generation; `GET /insights/reports/...` management.
- Widgets: `createWidget` → `GeminiService.generateWidgetSpec` (SQL with `$1`/`$2` date bounds; chart types bar|line|pie|donut|kpi|table|area).
- Intelligence hub (`IntelligenceReportProcessor`): hub summary, top campaigns, digital spend, digital channel metrics, `POST /ai-analysis` → `AIMarketingAnalysisService` (cost-ceiling enforced).
- Report builder (`ReportProcessor`): reports + ordered items (dashboard, kpi_card, ai_insight, data_table, text_block, widget, insight) + **public share keys** (`DRAReportShareKey`, UUID, expiry, one per report, `GET /reports/public/:key` with non-auth token + branding).
- `ReportGeneratorService` — one-click generation from a data model: KPI cards (`KPIClassificationService`), AI insights (`generateDataModelAnalysis`), comparison table, trend note; template variant with `skipAiAnalysis`.

## Campaign analysis & intelligence

- `CampaignAnalysisService` — KPI cards, daily trend, dimension breakdowns (ad_group, keyword, device, geo), performance scoring.
- `AnomalyDetectionService` — 4 methods: rolling 30-day std-dev (×2, fallback 30%), budget-vs-actual (120%/80%), CMO target breaches (CPA/CPL/CPC/CPM/frequency/ROAS/CTR thresholds), optional Gemini enhancement.
- `BudgetOptimizationService` — daily pacing, channel allocation, estimated impact, Gemini explanation.
- `AttributionCalculatorService` — **6 models**: first_touch, last_touch, linear, time_decay (7-day half-life), u_shaped (40/40/20), data_driven (Shapley); persists weights to `dra_attribution_touchpoints` (all models per conversion).
- `FunnelAnalysisService` — auto-detects stages (Awareness→Interest→Consideration→Intent→Purchase), conversion rates/drop-offs, per-channel funnels, time-per-stage.
- `AttributionProcessor` — event tracking, channel performance, ROI, model comparison, funnel/journey analysis, reports (channel_performance | funnel_analysis | journey_map | roi_report).

## Conversation/session state (3 layers)

1. **Redis** (`RedisAISessionService`, prefix `dra:ai:`, 24 h TTL) — conversation metadata, messages, model drafts, schema context.
2. **PostgreSQL** — `dra_ai_data_model_conversations`/`messages`, `dra_ai_insight_reports`/`messages` (auto-persisted, loaded when Redis empty).
3. **In-memory Gemini sessions** (`GeminiService.chatSessions`, 1 h timeout, 10-min cleanup).
