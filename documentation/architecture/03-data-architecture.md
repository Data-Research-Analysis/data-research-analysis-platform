# 03 — Data Architecture

## Overview

PostgreSQL is the platform's primary database (TypeORM 0.3, `synchronize: false`, schema managed exclusively by migrations). Two schema families coexist:

1. **Platform metadata**: `public` schema with `dra_*` table names (plus `ai_call_logs`, `data_model_summaries`, `sync_history`).
2. **Ingested data**: one dedicated Postgres schema per source type — `dra_excel`, `dra_pdf`, `dra_mongodb`, `dra_google_analytics`, `dra_google_ad_manager`, `dra_google_ads`, `dra_meta_ads`, `dra_linkedin_ads`, `dra_hubspot`, `dra_klaviyo`.

**Counts:** 77 TypeORM entities (`backend/src/models`, 76 model files + `backend/src/entities/SyncHistory.ts`), 137 migrations, 9 seeders.

## Tenancy hierarchy

```
DRAOrganization (tenant + billing unit)
  └─ DRAWorkspace (slug unique per org)
       └─ DRAProject (organization_id + workspace_id NOT NULL)
            ├─ DRADataSource → DRADataModel → DRADataModelRefreshHistory / DRADataModelLineage
            ├─ DRADashboard → DRADashboardExportMetaData
            ├─ DRACampaign → DRACampaignChannel → DRACampaignOfflineData
            ├─ DRAPaidMediaPlan (nullable for guest plans)
            └─ DRAReport (project + creator only; no O/W columns)
```

Membership chain: `dra_organization_members` (owner/admin/member) → `dra_workspace_members` (admin/editor/viewer) → `dra_project_members` (marketing persona analyst/manager/cmo). One `DRAOrganizationSubscription` per org covers all members.

**Column coverage:** `organization_id` on 23 entities (+ `DRAAICallLog.org_id` = 24), `workspace_id` on 13, explicit `project_id` on 8 (DataSource, Dashboard, Campaign, PaidMediaPlan, Report, AIInsightReport, AICallLog, ProductEvent), direct user reference on 36 entities. Isolation is **application-level only — no PostgreSQL RLS policies**.

Tenancy gaps worth knowing: `DRAReport`/`DRAReportItem`/`DRAReportShareKey` lack org/workspace columns (access via project + creator); `DRADataModel` has no direct `project_id` (project derived through data source or O/W); marketing-automation tables (EmailFunnel*, LeadGenerator*, Broadcast*) are platform-global.

## Entity groups

| Group | Entities |
|---|---|
| Auth/users | DRAUsersPlatform, DRAVerificationCode, DRAEmailPreferences |
| Tenancy | DRAOrganization, DRAWorkspace, DRAOrganizationMember, DRAWorkspaceMember, DRAOrganizationInvitation, DRAProjectMember, DRAProjectInvitation, DRASSOConfiguration, DRASSOUserMapping, DRADomainVerification |
| Projects | DRAProject |
| Data sources | DRADataSource, DRATableMetadata, DRAMongoDBSyncHistory, DRACrossSourceJoinCatalog |
| Data models | DRADataModel, DRADataModelSource, DRADataModelLineage, DRADataModelRefreshHistory |
| Dashboards | DRADashboard, DRADashboardExportMetaData |
| AI | DRAAIDataModelConversation, DRAAIDataModelMessage, DRAAIInsightReport, DRAAIInsightMessage, DRAAIJoinSuggestion, DRAAICallLog |
| Plans | DRAPaidMediaPlan, DRAPaidMediaPlanStep, DRAPaidMediaPlanMessage, DRAPaidMediaPlanArtifact, DRAPaidMediaPlanEvent, DRAPlanBenchmark, DRAPlanOutcome |
| Campaigns | DRACampaign, DRACampaignChannel, DRACampaignOfflineData |
| Billing | DRASubscriptionTier, DRAOrganizationSubscription, DRAPaymentTransaction, DRAPaddleWebhookEvent, DRAPromoCode, DRAPromoCodeRedemption, DRADowngradeRequest, DRAEnterpriseContactRequest, DRAAccountCancellation |
| Content | DRAArticle, DRAArticleCategory, DRAArticleVersion, DRACategory, DRASitemapEntry |
| Notifications | DRANotification |
| Reports | DRAReport, DRAReportItem, DRAReportShareKey |
| Growth | DRALeadGenerator (+ Lead, PagePlacement, RelatedResource), DRAEmailFunnel (+ Step, Enrollment, SentLog, Unsubscribe), DRAEmailBroadcast (+ Log), DRABlogSubscriber, DRABlogDigestSend, DRABlogDigestArticle, DRAEnterpriseQuery |
| Platform | DRAPlatformSettings, DRAScheduledBackupRun, DRAProductEvent |

### Key relationships

- **DRAUsersPlatform** — central account; `ManyToOne → DRASubscriptionTier` (nullable); `OneToMany` projects/data_sources/data_models/dashboards/articles/categories with `cascade: ["remove","update"]`.
- **DRAOrganization** — `OneToMany` workspaces + members (cascade); `OneToOne → DRAOrganizationSubscription`; `OneToMany` projects.
- **DRAWorkspace** — `ManyToOne → DRAOrganization` (`onDelete: CASCADE`); `@Unique(['organization','slug'])`.
- **DRAProject** — `ManyToOne` user/org/workspace all CASCADE; `current_plan_id` → `dra_paid_media_plans` `ON DELETE SET NULL`.
- **DRADataSource** — `connection_details` JSONB **encrypted via TypeORM ValueTransformer** (AES-256-GCM, legacy plaintext tolerated), `connection_string` encrypted (Mongo); sync schedule/status fields; `OneToMany` data_models, table_metadata (cascade remove,update).
- **DRADataModel** — `data_layer` enum `raw_data|clean_data|business_ready` (nullable), `layer_config` JSONB, `health_status`/`health_issues`, refresh state, `OneToMany` refresh_history + parent/child lineages. No `project_id`.
- **DRASubscriptionTier** — tier ladder with per-tier limits; `OneToMany → DRAOrganizationSubscription`.
- **DRAOrganizationSubscription** — `organization_id` unique (1:1 with org); Paddle ids, billing cycle, grace/failure state, member caps.
- **DRAPaidMediaPlan** — project/org/workspace nullable (guest support); `is_guest`, `guest_token`, JSONB `state`/`settings`; `OneToMany` steps (cascade remove).
- **DRADataModelLineage** — child/parent edges; unique pair; no tenant columns.
- **DRADataModelRefreshHistory** — one row per refresh attempt (status, timings, row deltas, trigger, error, SQL).

## Medallion architecture (bronze/silver/gold equivalent)

Enum values (code is authoritative — the older `PR-361` doc describing `bronze/silver/gold` and `validateLayerAssignment()` does **not** match the code):

| Layer | Enum value | Validation rule |
|---|---|---|
| Bronze | `raw_data` | None; preserve source structure |
| Silver | `clean_data` | ≥1 of transformation / filtering / deduplication |
| Gold | `business_ready` | Aggregation (GROUP BY + aggregate fn) **or** joins |

- Detection heuristics in `DataModelLayerService.ts`: `detectTransformations` (CASE/CAST/CONCAT/TRUNC/etc.), `detectFiltering` (where/having), `detectDeduplication` (distinct), `detectAggregation` (COUNT/SUM/AVG… + groupBy), `detectJoins`. `recommendLayer()`: aggregation/joins → business_ready; transform/filter/dedup → clean_data; else raw_data.
- **Known defect**: the layer detector reads top-level `select/from/where/groupBy/join` keys, but real stored `DRADataModel.query` uses `columns` + `query_options`, so detection almost always returns `raw_data`; `DataModelHealthService.analyse()` correctly uses `query_options`. Layer validation is effectively a no-op on real models.
- Assignment paths: `QueryEngineProcessor` writes `dataLayer` on save; `PATCH /data-model/:id` (layer_config/data_layer only); bulk wizard (`GET /data-model/project/:projectId/layer-migration`, `POST /data-model/bulk-assign-layers`); admin `routes/admin/medallion-migration.ts` (`/candidates`, `/stats`, `/bulk-classify`, `/set-all-raw`).
- Health integrates layers: `LAYER_MISMATCH_*`, `NON_STANDARD_LAYER_FLOW` codes in `DataModelHealthService`.

## Migrations (137)

- Dedicated migrations datasource `PostgresDSMigrations.ts` (separate `POSTGRESQL_HOST_MIGRATIONS`/`PORT_MIGRATIONS`); scripts `migration:run/generate/create/revert` target it.
- Naming: `<epoch-ms>-PascalCaseDescription.ts`; class `Description<epochms>`.
- Phase timeline: Foundation (Dec 2024) → Accounts/content/sync/subscriptions/RBAC (Jul 2025–Jan 2026) → Refresh + data infra (Jan–Feb 2026) → Marketing: campaigns/funnels/attribution/reports (Feb–Mar 2026) → Multi-tenancy + billing (Mar–Apr 2026) → Lead-gen/SSO/composition (Apr–Jun 2026) → Email funnels/digest/targets (Jul–Sep 2026) → Plan Studio + AI usage + 2026 tiers (Oct–Dec 2026, 23 migrations).
- Anomalies: `1781454109000000000-DropDRAColumnsTable.ts` has a 19-digit prefix and sorts after all 2026 migrations on a fresh DB; several duplicate prefixes rely on filename order; later migrations are guarded (`IF NOT EXISTS`) because earlier ones were replayed on existing databases.

## Seeders (9, idempotent find-or-skip)

1. Demo users (`testadminuser@` / `testuser@`) + personal orgs + workspaces
2. Demo project + project member (analyst)
3. Demo PostgreSQL data source
4. 9 article categories
5. Sitemap entries from `public/sitemap_backup.txt`
6. **Subscription tiers** (5 tiers — see [05 — Billing](05-billing-subscription.md))
7. Platform settings (retention 30 days, auto-delete, notification toggles, thresholds)
8. Attribution demo data (10 channels, 200 events, 5 reports, 3 funnels)
9. Paddle price-ID placeholders

## Physical table naming

- Ingested tables: `TableMetadataService.generatePhysicalTableName(dataSourceId, logicalName, fileId?)` → `ds{dataSourceId}_{md5(...)[:8]}` (avoids PG's 63-char limit); human name/sheet/file_id in `dra_table_metadata`.
- Data-model output tables: `public."{name}_dra_{uuid_with_underscores}"` via `UtilityService.uniquiseName()`; UI strips `_dra_<uuid>`.
- Column names sanitized via `DataSourceSQLHelpers.sanitizeColumnName()` (non-alphanumerics → `_`, `col_` prefix, reserved-word suffix).

## Data-model refresh, health, quality

### Refresh (`DataModelRefreshService` + `RefreshQueueService`)
- Atomic swap: `CREATE TABLE "<schema>"."<name>_refresh_<epoch>" AS <sql>`, validate non-empty, then `DROP TABLE ... CASCADE` + `ALTER TABLE ... RENAME TO <name>` (rollback drops temp).
- In-memory priority queue (not Redis): max 3 concurrent, priorities user=1/schedule|api=2/cascade=3, 3 retries with exponential backoff; **per-process only** (multi-instance won't share).
- Triggers: manual (10/hour), cascade from source sync (`findDependentModels` with `auto_refresh_enabled`), API (5/hour). `GET /refresh/history/:id` (last 20).

### Scheduling
- **Data-source sync**: `SchedulerService` every minute UTC; only `GOOGLE_ANALYTICS, GOOGLE_AD_MANAGER, GOOGLE_ADS, META_ADS` are eligible; overlap guard per source; recomputes `next_scheduled_sync`.
- **Health re-analysis**: `jobs/reanalyzeDataModelHealth.ts` `0 2 * * *` (disable `HEALTH_REANALYSIS_ENABLED=false`).
- Data-model refresh itself has no cron.

### Health (`DataModelHealthService`)
Status classification (`healthy|warning|blocked|unknown`) with issue codes: `MISSING_AGGREGATE_FUNCTION`, `FULL_TABLE_SCAN_LARGE_SOURCE`, `FILTER_WITHOUT_AGGREGATION_LARGE_SOURCE`, `NO_AGGREGATION_WITH_FILTER`, `NO_AGGREGATION_NO_FILTER_SMALL_SOURCE`, plus layer-mismatch codes. Thresholds from platform settings (`max_data_model_rows` 50K, `large_source_table_threshold` 100K seeded; code defaults 100K/500K — **mismatch**).

### Data quality (`DataQualityService`/`DataQualityProcessor`/`DataQualityExecutionService`)
- Profile: null/distinct/invalid counts, numeric stats (min/max/mean/median/stddev), date ranges, regex validity (email/phone/URL).
- Scores: completeness 35% + validity 30% + uniqueness 20% + consistency 15%.
- Checks: duplicates (up to 3 inferred key columns), IQR outliers, cross-column consistency (date ordering, future dates, negative-in-positive columns, mixed casing, date format mixes).
- Cleaning: `executeCleaningSQL` (SAVEPOINT + dry-run support), strategies `auto|deduplicate|standardize|validate|impute`, blocked ops via `SQLValidationService`.
- Persistence: `dra_data_quality_reports`, `dra_data_cleaning_history`, `dra_data_quality_rules` (no TypeORM entities — documented here explicitly).

## Tables without TypeORM entities

- Attribution: `dra_attribution_channels/events/touchpoints/reports`, `dra_conversion_funnels`
- Funnels: `dra_funnel_definitions`, `dra_funnel_analysis_results`
- Quality: `dra_data_quality_reports`, `dra_data_cleaning_history`, `dra_data_quality_rules`
- Targets: `dra_campaign_targets`
- Summaries: `data_model_summaries` (no `dra_` prefix)

These are invisible to entity-based tooling and must be handled by raw SQL in migrations.
