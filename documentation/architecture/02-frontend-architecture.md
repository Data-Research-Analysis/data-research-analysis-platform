# 02 — Frontend Architecture

## Overview

Nuxt 3.17 SSR application under `frontend/` (Vue 3.5, Pinia 3, Tailwind CSS 4, Vite 6). Hybrid rendering: **full SSR for marketing/SEO pages**, **client-only data loading for the protected app** (`server: false` in `useAuthenticatedFetch`/`useCurrentUser`).

**Counts (2026-10-22):** 129 pages · 218 components · 91 composables · 23 Pinia stores · 8 global middlewares · 18 plugins · 2 layouts · 9 constants · 72 type files · 2 server routes · 11 test files.

## Nuxt configuration (`nuxt.config.ts`)

- `ssr: true`; `compatibilityDate: '2024-11-01'`.
- **Lazy components**: `components: [{ path: '~/components', pathPrefix: false, lazy: true }]` — every component code-split; charts/Tiptap/dialogs load on demand.
- Modules: `@pinia/nuxt`; `@nuxt/test-utils/module` only when `NODE_ENV !== 'production'`.
- `experimental`: payloadExtraction, viewTransition, inlineSSRStyles (appManifest off, componentIslands off).
- `routeRules`: `/_nuxt/**` and `/assets/**` → immutable cache; `/attribution` → 301 to `/projects`.
- **GTM + Consent Mode v2** only when `NUXT_GTM_ID` set: defaults denied before GTM loads, `url_passthrough` + `ads_data_redaction`.
- `runtimeConfig.public`: `apiBase` (←`NUXT_API_URL`), `siteUrl`, Paddle (`paddleEnvironment`/`paddleClientToken`/`paddleCheckoutEnabled`), `gtmId`, reCAPTCHA site key, socketio URLs, platform toggles (`NUXT_PLATFORM_ENABLED`/`_REGISTRATION_ENABLED`/`_LOGIN_ENABLED`).

## Global middleware pipeline (execution order)

```
00-route-loader → 00a-redirectOldRoutes → 00b-normalize-path → 01-authorization
→ 02-load-data → 03-validate-data → 04-project-role → 05-advanced-tools
```

| Middleware | Responsibility |
|---|---|
| `00-route-loader.global.ts` | Batch loader: one global loader (SweetAlert) spans all parallel middleware API calls per navigation (batched 100 ms after route change). |
| `00a-redirectOldRoutes.global.ts` | Deprecation redirect map (currently empty); SSR → HTTP 301; client → 2s notice banner + auto-navigate. |
| `00b-normalize-path.global.ts` | Canonicalization: strip trailing slashes, lowercase fixed static routes, 301 to canonical. Prevents soft-404s. |
| `01-authorization.global.ts` | Auth guard: `/logout` teardown; real 404 for unmatched; public allow-list (articles, public shares, verify/forgot, oauth, connect, invitations, guest, resources); token validated against `/auth/validate-token` (30s in-memory cache, transient fail-open); gates `/admin/**` on `user_type === 'admin'`. |
| `02-load-data.global.ts` | Client-only smart data loader: `ROUTE_DATA_REQUIREMENTS` regex map → parallel entity loads (`projects:metadata`, `dataSources:metadata`, `dataModels:metadata`, `dashboards:metadata`, `usageStats:metadata`, …); 5-min localStorage TTLs via `useCacheManager`; RBAC `my_role` staleness; cache-hit tracking. |
| `03-validate-data.global.ts` | Route-param validation against stores (project exists, data source belongs to project, etc.); redirects on invalid. |
| `04-project-role.global.ts` | Client-side project RBAC: analyst > manager > cmo; OWNER-only patterns (`/settings`), MANAGER+ (`/campaigns`, `/insights`), ANALYST-only (`/channels`, `/data-models`, `/invitations`, `/settings/members`); admin bypass. |
| `05-advanced-tools.global.ts` | Gates advanced routes (`data-models|dashboards|reports|ai-insights|channels/:id/data-models`) via `useAdvancedTools().canSeeAdvanced` (plan entitlement × org `show_advanced_tools`); redirects to channels. |

## Pinia stores (23)

Setup-style stores: refs → `set*` mutators (write localStorage, guarded by `import.meta.client`) → `get*` lazy rehydrate → `retrieve*` async API actions → `clear*` teardown. Module-level `initialized` guard for one-time hydration.

| Store | Purpose |
|---|---|
| `logged_in_user.ts` | Current user (`/auth/me`), token cookie. |
| `subscription.ts` | Tier stats + usage (`/subscription/current`, `/subscription/usage`), 5-min auto-refresh, ~20 entitlement computeds, `resetForOrganizationChange()`. |
| `projects.ts` | Projects list, selected project, `myProjectRole` (RBAC normalization), pending invitations, `alignPlan`. |
| `organizations.ts` | Organizations, selected org/workspace, members, `setAdvancedTools`, branding. |
| `paid_media_plans.ts` (720 ln) | Plan CRUD, 18-step run, gates, streaming messages, artifacts, export ZIP, publish, results sync, guest-plan funnel; Socket.IO listeners with reconnect re-sync. |
| `data_sources.ts` (1107 ln) | Data sources + per-provider OAuth/sync for Google/Meta/LinkedIn; real-time `syncStatus`/`syncErrors` maps. |
| `data_models.ts` (1042 ln) | Models, table metadata, refresh status/jobs, paginated data cache, composition. |
| `dashboards.ts` | Dashboard CRUD + public share retrieval. |
| `campaigns.ts` (580 ln) | Campaigns, channels, platform link suggestions, offline data entry. |
| `ai-data-modeler.ts` (1183 ln) | AI model-builder chat drawer, conversations, drafts, suggested joins, retry w/ backoff. |
| `insights.ts` (756 ln) | AI insights sessions/reports. |
| `notifications.ts`, `articles.ts`, `promo_codes.ts`, `scheduled-backups.ts`, `sitemap.ts`, `user_management.ts`, `enterprise_queries.ts`, `email_preferences.ts`, `funnel.ts`, `intelligenceHub.ts`, `intelligenceStore.ts`, `admin/subscription-tiers.ts` | Feature-specific state. |

## Composables (91)

Core groups:

- **HTTP/auth**: `useAppFetch` (batch-loader-aware `$fetch.create`), `useAuthenticatedFetch` (client-only `useAsyncData` + bearer + org headers), `useAuthenticatedMutation`, `useCurrentUser`, `useApiErrorHandler`, `AuthToken.ts` (`dra_auth_token` cookie, 3-day, strict), `useLogout` (tears down all stores), `useOrganizationContext` (emits `X-Organization-Id`/`X-Workspace-Id`).
- **Access**: `useProjectRole`, `useProjectPermissions`, `useTierLimits` (pre-create checks → `TierLimitModal`), `useAdvancedTools`, `useOrganizationManagement`, `useWorkspaceManagement`.
- **Data**: `useProjects`, `useDataSources`, `useDataModels`, `useDataModelChat`, `useDataModelAnalysis`, `useDataModelHealth`, `useDataExplorer`, `useSchemaAnalyzer`, `usePresetGenerator`, file-uploads helpers.
- **Charts/reports**: `useDashboards`, `useChartAutoConfig`, `useReportBuilder`, `useReportGenerator`, `useReportTemplates`, `useReports`, `usePublicDashboard`.
- **Connectors**: `useMetaAds`, `useGoogleAds`, `useGoogleAdManager`, `useGAMExport`, `useGAMScheduler`, `useGAMRateLimit`, `useLinkedInAds`, `useHubSpot`, `useKlaviyo`, `useGoogleAnalytics`, `useGoogleOAuth`, `useSyncStatus`.
- **Intelligence**: `useCampaignPerformance`, `useCampaignAnalysis`, `useCampaignDrillDown`, `useCampaignTargets`, `useBudgetOptimization`, `useFunnelAnalysis`, `useAnomalyAlerts`, `useAttributionModels`, `useAIMarketingAnalysis`.
- **Billing**: `usePaddle` (checkout overlay, activation polling 2s×10, billing portal), `useDatabaseBackup`, `useDatabaseRestore`, `useAdminStats`.
- **Perf/UX**: `useSSRPerformance` (TTFB/FCP/LCP/TBT budgets), `usePerformanceMonitor`, `useGlobalLoader`, `useCacheManager`, `useStaleWhileRevalidate`, `useFetchWithETag`, `usePrefetch`, `useGtm`, `useConversion`, `useGeolocation`, `useMarkdown` (marked → DOMPurify allow-list), `useBranding`.

## Plugins (18)

Client-only: `api-loader` (no-op now — loader moved into `useAppFetch`), `init-user` (parallel `/auth/me`), `socketio` (lazy Socket.IO client, auth handshake, reconnection 10×, sync/model-refresh/cache-invalidation listeners), `paddle` (Paddle v2 CDN SDK), `ga-consent` (ordered LAST — restores Consent Mode v2 within GTM's 3000 ms window; regional EU/US/RoW), `recaptcha` (vue-recaptcha-v3), `htmlToImage`, `draggable`, `sweetalert2`, `vuetippy.client`, `prefetch-links`, `navigation-perf`, `localStorage-migration`, `blog-subscribe`, `lead-generator-placement`, `geolocation-dev-tools` (dev). Universal: `fontawesome` (curated icon subset); server: `vuetippy.server`.

## SSR strategy

- Full SSR for marketing pages (SEO); protected app pages use client-only data + `useCookie` auth (`dra_auth_token`), no localStorage tokens.
- `error.vue` renders SSR-safe 404/500 with recovery actions.
- `app.vue` wraps `NuxtPage`, injects Organization JSON-LD at setup (present in SSR HTML), and prefetches user/projects/data-sources after 1.5 s idle (`requestIdleCallback`).
- Validation: `npm run validate:ssr` (8 checks via `scripts/validate-ssr.cjs`); `tests/ssr-compatibility.nuxt.test.ts` (31+ checks).

## Component conventions

- Charts: `components/charts/` (10 chart types) driven by `constants/dashboard.ts` (12 types incl. `text_block`, `vertical_bar_line` combo, `funnel_steps`).
- Base UI kit: `components/base/` (10 `Base*` primitives).
- Markdown: `useMarkdown` → `marked` (GFM) → `isomorphic-dompurify` allow-list (`p br strong em u code pre h1-h6 ul ol li blockquote a`; attrs `href class` only).
- Export: `htmlToImage` lazy provider; Tiptap-based `text-editor.vue`.
- Navigation: `constants/navigation.ts` role-gated `NavSection`/`NavLeafItem` shared by `sidebar.vue`/`project-sidebar.vue`.

## Tests

Vitest + `@nuxt/test-utils` (`environment: 'nuxt'`). Component tests (`hero`, `notched-card`, `text-editor`, `TierLimitModal`), SSR checks, and store tests (`projects.rbac`, `subscription`, `admin-subscription-tiers`, `organizations-clear`).
