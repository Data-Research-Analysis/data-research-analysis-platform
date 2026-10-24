# Skill Runner tools

The Skill Runner exposes a fixed tool surface. Per-step tool allowlists are declared in each skill's `manifest.json` under `tools`.

| Tool | Purpose | Backing |
|---|---|---|
| `web_search` | research steps | SearchProvider (Gemini Google-Search grounding by default; pluggable Tavily/Brave/Serper) |
| `web_fetch` | fetch a URL, extract readable text | fetch + readability, robots-respecting, cached |
| `write_artifact` | write a deliverable | PlanArtifactService |
| `read_artifact` | read a prior deliverable | PlanArtifactService |
| `read_state` | read the plan state | PlanStateService |
| `write_state` | merge into the plan state | PlanStateService |
| `ask_user` | raise a gate | step.gate + Socket.IO `plan:step:gate` |
| `run_script` | xlsx/pptx generation | PlanScriptSandbox (registered script ids only) |
| `query_marketing_metrics` | real performance context | MarketingMetricsService, IntelligenceReportProcessor |
| `list_connected_accounts` | which ad sources exist | DRADataSource by project |
| `read_benchmarks` | learned benchmark lookups | PlanBenchmarkService |
| `keyword_volume_research` | verified search volumes and CPCs | GoogleAdsService → KeywordPlanIdeaService (connected Google Ads account) |

Tool registration is per-skill via `manifest.tools`. A copy step cannot call `web_search`; a research step cannot `run_script`.
