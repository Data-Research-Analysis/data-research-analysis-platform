# Documentation

This directory contains the documentation that is actively maintained for the Data Research Analysis (DRA) platform. It was audited on **2026-10-22** against the codebase; one-time implementation notes, phase plans, and superseded documents were removed (see [Removed documents](#removed-documents-2026-10-22)).

## Start here

| Document | Purpose |
|---|---|
| [FEATURES.md](FEATURES.md) | Feature inventory (`[x]` implemented, `[-]` gated/in progress, `[ ]` planned) |
| [product-market-business-review.md](product-market-business-review.md) | Product, market, competitor, and business-model review |
| [architecture/README.md](architecture/README.md) | Authoritative subsystem architecture docs + UML diagram index |
| [comprehensive-architecture-documentation.md](comprehensive-architecture-documentation.md) | High-level architecture narrative linking to the subsystem docs |
| [SETUP.md](SETUP.md) | Local setup, Docker orchestration, migrations, seeders, test accounts |
| [use-cases/USE-CASES-MASTER.md](use-cases/USE-CASES-MASTER.md) | Current actor catalogue and use-case catalogue (incl. Plan Studio) |

## Guides and runbooks

| Document | Purpose |
|---|---|
| [data-model-composition-guide.md](data-model-composition-guide.md) | Building models from models, medallion layers, lineage, layer recommendations |
| [data-quality-formulas-and-calculations.md](data-quality-formulas-and-calculations.md) | Quality scoring formulas, checks, and cleaning behaviour |
| [join-conditions-manager-quick-reference.md](join-conditions-manager-quick-reference.md) | JOIN condition manager behaviour and data structures |
| [ai-data-modeler-join-architecture.md](ai-data-modeler-join-architecture.md) | AI data modeler and JOIN-inference architecture |
| [ai-usage-instrumentation-plan.md](ai-usage-instrumentation-plan.md) | AI usage metering spec and per-feature cost tracking |
| [notifications-quick-implementation-guide.md](notifications-quick-implementation-guide.md) | Adding notifications to processors/services |
| [scheduled-backups-quick-start.md](scheduled-backups-quick-start.md) | Backup configuration and operations |
| [Table-Rename-Scripts.md](Table-Rename-Scripts.md) | Hash-based physical table rename runbook |
| [ssr-quick-reference.md](ssr-quick-reference.md) | SSR rules, validation, and test commands |
| [phase2-testing-guide.md](phase2-testing-guide.md) | Multi-tenancy/workspace test procedures |
| [phase2-testing-quick-reference.md](phase2-testing-quick-reference.md) | Multi-tenancy test command cheat sheet |
| [phase2-testing-checklist.md](phase2-testing-checklist.md) | Manual multi-tenancy test checklist |
| [screenshots.md](screenshots.md) | Product screenshots |

## Integrations

| Document | Purpose |
|---|---|
| [google_analytics/](google_analytics/) | GA4 user guide, API guide, report types, troubleshooting, technical doc |
| [google_ads/](google_ads/) | Google Ads user guide, API guide, report types, technical doc |
| [google_ads_manager/](google_ads_manager/) | GAM user guide, API guide, report types, troubleshooting, quick reference, technical doc |

> Marketing connector details for Meta Ads, LinkedIn Ads, HubSpot, and Klaviyo live in [architecture/07-integrations.md](architecture/07-integrations.md).

## Documentation policy

- **Code is authoritative.** When a document disagrees with the code, fix the document; do not treat older prose as a specification.
- **No point-in-time implementation diaries.** Completed work belongs in [`CHANGELOG.md`](../CHANGELOG.md); durable design belongs in `architecture/`.
- **No duplicated references.** Keep one canonical document per topic and link to it.
- **Counts and API versions are verified** at the date shown in each document; update them when the code changes.

## Removed documents (2026-10-22)

These files were deleted because they were historical, duplicative, or contradicted the current codebase. Their durable content is covered by the documents above and by `CHANGELOG.md`.

| Removed document(s) | Reason |
|---|---|
| `ATTRIBUTION_PHASE_2_IMPLEMENTATION.md`, `attribution-phase-1-complete.md`, `marketing-attribution-implementation-analysis.md`, `attribution-tab-visibility.md` | Phase/implementation diaries for work now shipped; attribution models, touchpoints, funnels, and tab visibility are documented in [architecture/06-ai-plan-studio.md](architecture/06-ai-plan-studio.md) and [FEATURES.md](FEATURES.md). |
| `OAUTH_SECURITY_FIX.md`, `OAUTH_SECURITY_IMPLEMENTATION_SUMMARY.md`, `OAUTH_MANUAL_TESTING_GUIDE.md` | Historical security-fix notes (Dec 2025); current OAuth flow, token storage, and remaining gaps are in [architecture/07-integrations.md](architecture/07-integrations.md) and [architecture/09-security.md](architecture/09-security.md). |
| `encryption-implementation-summary.md` | Implementation summary superseded by [architecture/09-security.md](architecture/09-security.md) (AES-256-GCM, key handling, ValueTransformer). |
| `RBAC_IMPLEMENTATION.md` | 1,600-line implementation history; the current role/permission matrix and middleware chain are in [architecture/04-authentication-rbac.md](architecture/04-authentication-rbac.md). |
| `PR-361-medallion-architecture.md` | Describes `bronze/silver/gold` values and `validateLayerAssignment()` that do not exist in code; the actual enum and detector behaviour (including the detection defect) are in [architecture/03-data-architecture.md](architecture/03-data-architecture.md). |
| `data-model-health-enforcement-implementation.md` | DRA-281 implementation summary; health statuses, issue codes, thresholds, and re-analysis job are in [architecture/03-data-architecture.md](architecture/03-data-architecture.md). |
| `NAVIGATION_COMPLETE_SUMMARY.md`, `NAVIGATION_INSTRUMENTATION.md`, `NAVIGATION_PERFORMANCE_OPTIMIZATIONS.md` | One-time navigation performance project notes; the current middleware/SSR pipeline is in [architecture/02-frontend-architecture.md](architecture/02-frontend-architecture.md). |
| `ssr-complete-summary.md`, `ssr-phases-8-9-documentation.md` | Phase-completion diaries; current SSR rules and validation are in [ssr-quick-reference.md](ssr-quick-reference.md) and [architecture/02-frontend-architecture.md](architecture/02-frontend-architecture.md). |
| `excel-preview-workflow-implementation.md`, `excel-preview-workflow-testing.md`, `excel-upload-option-a-frontend.md`, `large-excel-upload-implementation.md` | Implementation/testing diaries for a shipped upload workflow; current Excel/CSV pipeline is in [architecture/07-integrations.md](architecture/07-integrations.md) and [FEATURES.md](FEATURES.md). |
| `rate-limiting-implementation.md`, `RATE_LIMITING_TEST_REPORT.md` | Implementation/test report for GAM throttling; current rate limiters and GAM token bucket are in [architecture/07-integrations.md](architecture/07-integrations.md) and [architecture/09-security.md](architecture/09-security.md). |
| `regional-cookie-consent-implementation-summary.md` | Implementation diary; regional consent strategy and Consent Mode v2 are in [architecture/09-security.md](architecture/09-security.md). |
| `scheduled-backups-implementation.md` | Implementation diary; current backup/restore architecture is in [architecture/10-deployment-observability.md](architecture/10-deployment-observability.md); operations remain in [scheduled-backups-quick-start.md](scheduled-backups-quick-start.md). |
| `sitemap-implementation.md` | Implementation diary; sitemap/SEO features are in [FEATURES.md](FEATURES.md), and the removed database schema reference was stale. |
| `notifications-implementation-summary.md` | Completion summary; notification architecture is in [architecture/08-background-jobs.md](architecture/08-background-jobs.md); the developer how-to remains in [notifications-quick-implementation-guide.md](notifications-quick-implementation-guide.md). |
| `join-conditions-manager-implementation.md` | Implementation detail; the user-facing behaviour remains in [join-conditions-manager-quick-reference.md](join-conditions-manager-quick-reference.md). |
| `ai-data-modeler-implementation.md`, `ai-data-modeler-quick-start.md` | Superseded by [architecture/06-ai-plan-studio.md](architecture/06-ai-plan-studio.md); the deeper JOIN reference remains in [ai-data-modeler-join-architecture.md](ai-data-modeler-join-architecture.md). |
| `ai-search-optimization-implementation.md`, `ai-optimization-quick-reference.md` | One-time SEO/AI-search project notes; current structured-data/SEO features are in [FEATURES.md](FEATURES.md). |
| `account-cancellation-implementation-plan.md`, `account-cancellation-quick-start.md`, `account-cancellation-complete-summary.md`, `account-cancellation-email-system.md` | Planning/implementation set for a shipped flow; current cancellation, retention, deletion, and email behaviour are in [architecture/05-billing-subscription.md](architecture/05-billing-subscription.md). |
| `paddle-integration-plan.md`, `paddle-testing-guide.md`, `paddle-hybrid-subscription-phase-1-complete.md`, `paddle-hybrid-subscription-quick-reference.md`, `paddle-complete-flow-activity-diagram.md` | Pre-launch planning/testing/activity-diagram set; Paddle is live and the current checkout, webhook, lifecycle, ledger, and promo-code behaviour are in [architecture/05-billing-subscription.md](architecture/05-billing-subscription.md) and the subscription-billing UML diagram. |
| `organization-billing-implementation-plan.md`, `admin-organization-subscription-history-implementation-plan.md` | Planning documents for shipped admin/billing UI; current billing architecture is in [architecture/05-billing-subscription.md](architecture/05-billing-subscription.md). |
| `cli-setup-tool-implementation-plan.md` | The setup CLI is shipped; current commands and workflows are in [SETUP.md](SETUP.md). |
| `mongodb-import-strategy.md` | 1,700-line strategy/plan; the implemented import pipeline and its `$group`/`$lookup` limitations are documented in [architecture/07-integrations.md](architecture/07-integrations.md). |
| `migration-strategy-phase-7.md`, `markdown-testing-plan.md` | Article-markdown migration/testing plans for completed work; the feature is recorded in [FEATURES.md](FEATURES.md) and `CHANGELOG.md`. |
| `GOOGLE_ADS_DEVELOPER_TOKEN_LIMITATION.md` | v22-era limitation note; Google Ads v25 makes the developer token optional (access moved to Google Cloud projects in Sept 2026), as documented in [architecture/07-integrations.md](architecture/07-integrations.md). |
| `GOOGLE_ADS_MANAGER_ACCOUNT_FIX.md`, `GOOGLE_ADS_MANAGER_IMPLEMENTATION.md` | Historical MCC fix/implementation notes; MCC expansion (up to 10 clients) is documented in [architecture/07-integrations.md](architecture/07-integrations.md) and [google_ads/](google_ads/). |
| `GOOGLE_DATA_SOURCES_COMPLETE_SYSTEM_IMPLEMENTATION.md` | Stale (Jan 2026) "70% complete" phase plan; current Google connector behaviour is in [architecture/07-integrations.md](architecture/07-integrations.md). |
| `LINKEDIN_ADS_IMPLEMENTATION.md` | Implementation summary; current LinkedIn API version, scopes, tables, and gating are in [architecture/07-integrations.md](architecture/07-integrations.md). |
| `google_ads/GITHUB_FEATURE_REQUEST_GOOGLE_ADS.md`, `google_ads/GA_TYPES_REFERENCE.md` | Feature request is historical; the types reference duplicated and contradicted `backend/src/types/IGoogleAds.ts`. |
| `google_ads_manager/CURRENT_IMPLEMENTATION_STATUS.md`, `GAM_FEATURE_BREAKDOWN.md`, `GITHUB_FEATURE_REQUEST_GAM.md`, `GOOGLE_AD_MANAGER_IMPLEMENTATION_PLAN.md` | Stale v1.0 "2 report types" status/planning docs; the current six implemented types and the five advertised types are documented in [google_ads_manager/](google_ads_manager/) and [architecture/07-integrations.md](architecture/07-integrations.md). |
| `competitive-analysis.md` | Superseded by [product-market-business-review.md](product-market-business-review.md); contained outdated pricing ($49–99/$299), Gemini 2.0, missing Plan Studio, and features that have since shipped. |
| `database/database-schema.dbml`, `database/Data Research Analysis ERD.png` | Generated Feb 2026; described 31 tables (including deprecated `dra_user_subscriptions`) out of 77 current entities and predated org/workspace tenancy and Plan Studio. TypeORM entities plus migrations are authoritative; see [architecture/03-data-architecture.md](architecture/03-data-architecture.md) and the backend class diagram. |
| `use-cases/UC-01…UC-10-*.md` | Written Feb 2026 against the deprecated user-level subscription/private-beta model and pre-dating org/workspace tenancy, Paddle, and Plan Studio. Replaced by the rewritten [USE-CASES-MASTER.md](use-cases/USE-CASES-MASTER.md), which is code-aligned and includes Plan Studio. |
| `issue-274-closing-comment.md` | A copy-paste GitHub issue comment, not repository documentation. |
| `pull-requests/` (empty), `database/` after removals | Empty/unused directories. |
