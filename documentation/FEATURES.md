# Features

The features that have been marked as checked have been implemented, while those that are planned are marked as unchecked.

#### Completion/In-Progress

- [x] is a completed task
- [-] is an in-progress or gated task
- [ ] is a pending task

---

## 1. Platform, Access & Commerce

### Authentication & Accounts
- [x] **User Authentication** — email/password login with reCAPTCHA and show/hide password
- [x] **User Registration** — free registration, email verification, resend verification
- [x] **Password Management** — forgot-password flow, reset codes, password update
- [x] **Account Lifecycle**
  - [x] Self-service account cancellation (immediate or end-of-billing-period)
  - [x] Cancellation reasons and admin review
  - [x] Data export before deletion
  - [x] 30-day retention with automated deletion warnings
  - [x] Account reactivation
- [x] **User Management System (Admin)** — list, create, edit, delete users; change admin/user type
- [x] **Email Preferences** — subscription updates, expiration warnings, renewal reminders, promotional opt-in/out

### Organizations, Workspaces & Projects
- [x] **Multi-Tenant Architecture** — Organization → Workspace → Project hierarchy
- [x] **Organizations** — create, update, delete, switch, list; organization-level subscription
- [x] **Workspaces** — create, update, delete, switch, member management; workspace-scoped isolation
- [x] **Projects** — create, rename, describe, delete; project settings and advanced-tools visibility
- [x] **Organization Invitations** — invite, accept/decline, resend, cancel, expiry
- [x] **Workspace Invitations** — role-based access (admin, editor, viewer)
- [x] **Project Members & Invitations** — invite by email, accept/decline, change role, remove, expiry
- [x] **Organization Branding** — logo, primary/secondary colors, branded public reports and dashboards (Professional Plus+)

### Roles & Permissions
- [x] **Platform Roles** — admin vs regular user; admins bypass tier checks
- [x] **Organization Roles** — owner, admin, member
- [x] **Workspace Roles** — admin, editor, viewer
- [x] **Project Marketing Roles** — Analyst (full read/write, member management), Manager (read + publish/dashboard editing), CMO (read-only)
- [x] **Role-Based Access Control** — route guards, resource permissions, owner-only deletion
- [x] **Advanced-Tools Entitlement** — data models, dashboards, reports, AI insights, and engineering connectors gated to Professional+ and an org-level setting

### SSO & Enterprise Identity
- [x] **SAML 2.0 SSO** — IdP configuration, signed assertions/responses, replay protection
- [x] **Just-in-Time Provisioning** — optional auto-provisioning of SSO users
- [x] **SSO Enforcement** — disable password login for an organization
- [x] **Domain Verification** — DNS TXT verification for SSO domains
- [x] **SP Metadata & Single Logout** — metadata generation, IdP-initiated logout
- [x] **One-Time Code Exchange** — short-lived code exchanged for JWT after SAML callback

### Billing & Subscriptions
- [x] **Subscription Tiers (2026 plans)** — Free, Starter, Professional, Professional Plus, Enterprise
  - [x] Free — $0, 1 project, 4 channels, 1 plan build/month (Basic), 10 AI generations/month
  - [x] Starter — $29/mo or $276/yr, 1 project, unlimited channels, 5 plan builds/month, Advanced mode + deck export
  - [x] Professional — $129/mo or $1,236/yr, unlimited projects, unlimited plan builds, AI chat, 5M rows, 2–5 members, advanced tools
  - [x] Professional Plus — $399/mo or $3,828/yr, 100M rows, 6–100 members, priority support, branding
  - [x] Enterprise — $2,499/mo or $23,990/yr, unlimited rows/members, SAML SSO, custom SLAs
- [x] **Paddle Billing** — checkout overlay, billing portal, payment methods, invoices, proration previews
- [x] **Paddle Webhooks** — HMAC-verified subscription/payment/refund events with idempotency
- [x] **Upgrade / Downgrade / Cancel** — self-service upgrades, downgrade requests with admin approval, cancellation and reactivation
- [x] **Promo Codes** — percentage/fixed discounts, usage limits, expiry, tier restrictions, Paddle discount sync
- [x] **Grace Periods & Dunning** — payment-failure handling, retries, grace-period downgrades
- [x] **Subscription Analytics (Admin)** — MRR by tier, churn, involuntary churn, trial conversion, tier counts
- [x] **Real-Time Tier Enforcement** — projects, channels, data models, dashboards, rows, members, AI generations, plan builds
- [x] **Upgrade Ladders** — per-resource upgrade suggestions returned by usage stats and shown in limit modals
- [x] **AI Usage & Cost Tracking** — per-feature AI call logs, token/cost rollups, org/user breakdowns
- [x] **AI Cost Ceilings** — fair-use monthly ceilings enforced on plan builds and AI analysis

### Admin & Operations
- [x] **Admin Dashboard** — users, projects, data sources, dashboards, models, AI usage/cost, system health, content, cancellations
- [x] **Organization Management (Admin)** — tier, members, billing, SSO, domain verification, deactivation
- [x] **Subscription Tier Management (Admin)** — CRUD tiers, Paddle product/price/discount sync, subscription reconciliation
- [x] **Enterprise Inquiries & Contact Requests** — capture, review, convert to user accounts
- [x] **Paid-Plan Interest** — interested users list, CSV export, launch notifications
- [x] **Platform Settings** — maintenance mode, registration toggle, retention, export limits, notification toggles
- [x] **Job Management** — background job monitoring, queue stats, retry failed jobs
- [x] **Database Backups & Restore** — manual/scheduled backups, retention, one-click restore, real-time progress
- [x] **Sitemap Management** — add/edit/publish/delete URLs and priorities
- [x] **Product Analytics** — product event tracking with PII redaction

---

## 2. Paid Media Plan Builder (Flagship)

### Plan Creation & Modes
- [x] **Plan Portfolio** — list plans with status, completed steps, artifacts, markets, budget/currency, alignment state
- [x] **Basic Mode** — website → AI-researched plan with no follow-up questions
- [x] **Advanced Mode** — full client briefing: industry, product, competitors, existing channels, team size, build mode, autonomy, notes (Starter+)
- [x] **Plan Brief Inputs** — plan name, website, platforms, target markets, budget/currency, funnel coverage, start/end dates, existing campaigns
- [x] **Platform Selection** — Google Search, Google Display, Meta Ads, LinkedIn Ads
- [x] **Editable Brief** — update strategic inputs after creation
- [x] **Plan-Build Quotas** — creation gated by tier allowance; 402 responses trigger upgrade flow

### Plan Pipeline (18 steps, 0–17)
- [x] **Plan intake** — confirm funnel coverage and build mode (gate)
- [x] **Creative brief** (gate)
- [x] **Market research**
- [x] **Competitor research**
- [x] **Company paid audit**
- [x] **Audience analysis**
- [x] **Keyword research** — confirm destination URLs live (gate)
- [x] **Ad copy**
- [x] **Creatives**
- [x] **Landing page copy**
- [x] **Landing page implementation**
- [x] **Media plan**
- [x] **Tracking setup** (gate)
- [x] **Campaign build guide**
- [x] **Setup checklist** — pre-launch QA (gate)
- [x] **Results review**
- [x] **Client presentation deck**
- [x] **Plan index**

### Execution & Collaboration
- [x] **Agentic Execution Engine** — durable per-plan queue with limited concurrency
- [x] **Human Gates** — AI pauses for approval with selectable options or free-text answers
- [x] **Plan Chat** — streaming natural-language questions and change requests
- [x] **Execution Controls** — start, pause, resume, retry a step, skip with reason, run step-by-step
- [x] **Progress Visibility** — progress header, step timeline, live process log
- [x] **Tool-Calling Agent** — web search/fetch, state/artifact I/O, ask-user, marketing metrics, connected accounts, benchmarks, sandboxed scripts
- [x] **Skill Packs** — 18 paid-media skill packs (`backend/skills/paid-media/`) with shared orchestrator/guardrail guidance
- [x] **Plan Notifications** — real-time socket events and in-app notifications

### Deliverables, Export & Launch
- [x] **Versioned Artifacts** — markdown, JSON, CSV, HTML with version history and user edits
- [x] **Artifact Viewer** — preview and download non-previewable files
- [x] **Media Plan & Setup Checklist** — generated XLSX deliverables
- [x] **Client Presentation Deck** — generated PPTX strategy deck
- [x] **Plan Pack Export** — ZIP containing plan deliverables
- [x] **Publish & Freeze** — publish a plan and optionally create draft campaigns per platform
- [x] **Targets from Plan** — plan targets written to campaigns/ad groups/ad sets for intelligence tracking
- [x] **Results Sync** — pull actual campaign results back into the plan
- [x] **Plan Alignment** — mark one plan as the project's current plan for plan-vs-actuals
- [x] **Outcomes & Benchmarks** — record outcomes, compare planned vs actual, recompute industry/market benchmarks

### Guest Plans
- [x] **No-Signup Plan Preview** — 24-hour guest plan from a website field
- [x] **First Seven Steps (0–6)** — guest users can run through keyword research (step 6); later steps are locked
- [x] **Register-to-Keep** — guest plan claimed into a new free account on registration
- [x] **Automatic Invalidation** — guest plans expire after 24 hours

---

## 3. Data Sources & Integrations

### Marketing & Advertising Connectors
- [x] **Google Ads** — OAuth, manager/MCC support, v25 API, 11 report types (campaigns, ad groups, ads, campaign/ad-group insights, demographics, devices, geography, placements, keywords, conversion actions)
- [x] **Google Analytics 4** — OAuth, property selection, 6 report presets (traffic, acquisition, pages, geo, device/tech, events)
- [x] **Google Ad Manager** — OAuth, network selection, 5 advertised report types (revenue, inventory, orders/line items, geography, device/browser); 6 types are implemented in the driver (`revenue`, `geography`, `device`, `ad_unit`, `advertiser`, `time_series`), while `inventory`/`orders` currently fall back to the revenue query
- [x] **Meta Ads** — OAuth, v25 API, campaigns, ad sets, ads, creatives, custom conversions, insights, ad-set/demographic/device/placement breakdowns
- [-] **LinkedIn Ads** — OAuth, campaigns, creatives, analytics; production-gated ("coming soon" for non-admins)
- [-] **HubSpot** — OAuth, contacts, deals, daily pipeline snapshots; production-gated
- [-] **Klaviyo** — private API key, campaign/flow metrics and attributed revenue; production-gated
- [x] **Offline Campaign Data** — manual spend, impressions, leads, pipeline value, notes per channel
- [x] **Auto-Onboarding** — marketing sources auto-create data models and dashboards on connection
- [x] **Data Classification** — marketing campaign, CRM/sales, budget/finance, offline marketing, brand research, general analytics

### Engineering Connectors
- [x] **PostgreSQL** — connection validation, schema/table discovery, query execution
- [x] **MySQL**
- [x] **MariaDB**
- [x] **MongoDB** — connection string, collection import, aggregation-pipeline editor
- [x] **Excel / CSV** — multi-file, multi-sheet, type inference, duplicate-column review, preview, socket progress
- [x] **PDF Import with OCR** — multi-page table/text extraction (Ghostscript + AWS Textract)
- [x] **Smart Connection Wizard** — source selection and queue-based OAuth flow
- [x] **Quick-Start Templates** — Multi-Channel Ads, Ads + CRM, E-commerce, Lead Gen

### Connection, Sync & Credentials
- [x] **Schema Auto-Detection** — tables, columns, relationships; batch detection
- [x] **KPI/Dimension Classification** — spend, impressions, clicks, conversions, revenue, ROAS, CTR, CPC, CPA, CPL, CPM, reach, profit, deals, email metrics, dimensions
- [x] **Scheduled Sync** — manual, hourly, daily, weekly, monthly with run time
- [x] **Sync History & Status** — start/completion/failure, rows synced, duration, 30-day stats
- [x] **Real-Time Sync Events** — Socket.IO progress and notifications
- [x] **Encrypted Credentials** — AES-256-GCM at rest for connection details and OAuth tokens
- [x] **Token Refresh & Re-Authorization** — OAuth token refresh and credential editing

---

## 4. Data Models & Governance

### Data Model Builder
- [x] **Visual Builder** — select tables/columns, transforms, aliases, joins, calculated columns, aggregates, GROUP BY, filters
- [x] **SQL Preview & Data Preview** — preview generated SQL and sample rows
- [x] **Cross-Source Models** — join tables across multiple data sources via federated materialization
- [x] **AI Join Suggestions** — confidence-scored join recommendations
- [x] **Join Catalog** — save and reuse join patterns
- [x] **Data Layers** — Raw/Bronze, Clean/Silver, Business Ready/Gold with guided walkthrough (note: automatic layer detection is unreliable for saved models; see [architecture/03](architecture/03-data-architecture.md))
- [x] **Model Composition & Lineage** — derived models, upstream/downstream lineage graph, layer-flow warnings
- [x] **Model Health** — healthy/warning/blocked classification, issue detection, reanalysis job
- [x] **Refresh** — manual refresh, auto-refresh toggle, cascade refresh to dependent models, refresh history
- [x] **Explore** — column selection, filters, sorting, grouping, pagination, CSV export
- [x] **Global Model Limits** — enforced across all data sources, with usage/capacity display

### AI Data Modeler
- [x] **One-Click Model Generation** — schema analysis → preset templates → apply to builder
- [x] **Conversational Modeler** — chat to analyze schemas and build models
- [x] **AI Model Analysis** — key insights, patterns, anomalies, marketing recommendations, data-quality score
- [x] **Ask AI** — model-scoped natural-language Q&A over the model and its data
- [x] **Cross-Source Sessions** — analyze multiple sources together and suggest joins
- [x] **Redis-Backed Sessions** — data model, data quality, attribution, and insights session types

### Data Quality & Governance
- [x] **Data Quality Analysis** — nulls, duplicates, type consistency, outliers, 0–100 score
- [x] **Quality Dimensions** — completeness (35%), validity (30%), uniqueness (20%), consistency (15%)
- [x] **AI Remediation** — AI-generated cleaning SQL with dry-run, transaction, savepoint/rollback
- [x] **Quality History** — stored history and recommendations
- [x] **SQL Safety** — DDL/admin operations blocked; SELECT-only AI SQL with table whitelisting
- [x] **Row Limits & Export** — tier row caps, CSV/Excel/JSON export with limits

---

## 5. Marketing Intelligence Overview

### Overview & KPIs
- [x] **Unified Overview** — date range, KPI cards, channel comparison, AI alerts, campaign performance, budget optimization
- [x] **KPI Cards** — ROAS, CPA, CPL, CTR, CPC, conversion rate with sparklines and trend semantics
- [x] **Prior-Period Comparison** — channel and campaign deltas vs the previous period
- [x] **Top Campaigns** — ranked campaigns with spend and performance
- [x] **Marketing Onboarding** — detect sources, auto-create models, generate dashboards

### Channels & Campaigns
- [x] **Channel Comparison Matrix** — spend, impressions, clicks, conversions, CTR, CPA, ROAS; sortable with expandable rows
- [x] **Campaign Performance Table** — filters, sorting, pagination, drill-down
- [x] **Campaign Drill-Down** — KPI cards, trend chart, dimension breakdowns (ad group, device, geo, placement)
- [x] **Campaign Settings** — read-only status, budget, schedule, bid/optimization, audience context
- [x] **Campaign Targets** — CTR, CPC, CPA, CPL, ROAS, daily/lifetime budgets, flight dates, currency, notes
- [x] **Campaign Records** — objectives, budgets, target leads/CPL/ROAS, lifecycle statuses
- [x] **External Campaign Linking** — link/unlink DRA campaigns to live ad-platform campaigns
- [x] **Ready-Made AI Analysis** — executive summary, KPI commentary, charts, spend recommendations, risks, next steps

### Alerts & Optimization
- [x] **AI Alerts** — anomaly, performance, and budget alerts with critical/warning/info severity
- [x] **Target-Aware Alerts** — alerts measured against campaign and ad-set targets
- [x] **Alert Context** — ad-set context, metric units, deduplication across insight tables
- [x] **Budget Optimizer** — maximize ROAS/conversions or minimize CPA; current vs recommended allocation, estimated impact, daily pacing, AI explanation
- [x] **Channel Floors/Caps** — 5% minimum and 40% maximum per channel

---

## 6. Attribution & Funnels

- [x] **Funnel Library** — create, view, edit, delete funnels
- [x] **Funnel Builder** — ordered stages with UTM rules (source, medium, campaign, term, content), operators, AND/OR logic
- [x] **Stage Preview** — estimated matched events before saving
- [x] **Funnel Analysis** — conversion rate, stage counts, drop-off, step-to-step conversion, channel breakdown, average time between stages
- [x] **Attribution Models** — first touch, last touch, linear, time decay (7-day half-life), position-based (U-shaped), data-driven (Shapley)
- [x] **Model Comparison** — side-by-side multi-model credit comparison
- [x] **Ad-Platform Attribution** — touchpoints from Google Ads, Meta, LinkedIn, GAM, GA4, HubSpot, Klaviyo, and offline tables
- [x] **gclid Tracking** — persisted on attribution events and used in funnel matching
- [x] **UTM Setup Guide** — copyable Google Ads templates, Meta URL parameters, recommended stage mappings
- [x] **URL Tester** — shows which funnel stages a tagged URL would match

---

## 7. AI Insights, Reports & Dashboards

### AI Insights
- [x] **Data-Source Selection** — choose which project sources the AI analyzes
- [x] **Streaming Insight Generation** — trends, anomalies, correlations, distributions, recommendations
- [x] **Follow-Up Chat** — ask follow-up questions about generated insights
- [x] **Saved Insight Reports** — auto-persisted, list, reopen, delete, continue as conversation
- [x] **Publish to Dashboard** — add insight charts as AI-insight widgets
- [x] **Cross-Source Insights** — analyze multiple data models together

### Reports
- [x] **Report Library** — draft/published reports and a templates tab
- [x] **AI Report Generation** — generate from a data model, with or without AI insights
- [x] **Template Reports** — data-model-aware templates with dimension selection
- [x] **Report Builder** — KPI card rows, AI insight sections, text blocks, embedded dashboards, data tables
- [x] **Report AI & KPI Items** — categorized insights, metric cards with trends/sparklines
- [x] **Publish & Share** — public links with 7/30/90-day expiry, copy and revoke
- [x] **Public Report View** — print-first, branded header/footer, no-index share surface
- [x] **Batch KPI Endpoint** — bulk KPI fetching

### Dashboards
- [x] **Dashboard Library** — list, create, delete; role- and plan-gated
- [x] **Drag-and-Drop Builder** — draggable/resizable cards and sections
- [x] **Chart Types** — table, text block, pie, donut, vertical bar, horizontal bar, combo, stacked bar, line, treemap, bubble, funnel steps
- [x] **Chart Auto-Configuration** — infer charts from model columns
- [x] **AI-Insight Widgets** — per-widget date ranges, auto-loaded data, regenerate from natural language
- [x] **Export** — PNG image export
- [x] **Public Dashboards** — anonymous keyed links with organization branding and interactive dates
- [x] **Auto-Generated Dashboards** — Performance Overview, Channel Breakdown, Campaign Performance, Time Analysis

---

## 8. Growth, Content & Email Marketing

### Articles & CMS
- [x] **Public Articles** — index, categories, related articles, author/date metadata, structured data
- [x] **Article Editor** — rich text (headings, lists, links, images, code, quotes), draft/publish
- [x] **Version History** — preview and restore prior versions
- [x] **Categories** — add, rename, delete
- [x] **Articles Digest** — select published articles, preview, send to subscribers
- [x] **Sitemap & SEO** — sitemap entries, `llms.txt`, structured data, canonical/OG tags, robots rules

### Lead Generation
- [x] **Lead Magnets** — PDF resources with slug, description, gated/open toggle
- [x] **Page Placements** — per-page display frequency, additional content, active toggle
- [x] **Auto-Popup** — anonymous-visitor placements with frequency caps and download suppression
- [x] **Gated Downloads** — gate form, one-time download token (1-hour TTL), email copy of link
- [x] **Lead Analytics** — views, downloads, leads, conversion rate, CSV export
- [x] **Public Resources Library** — free guides/templates with gated/open labels

### Email Marketing
- [x] **Email Funnels** — trigger types (download, blog subscribe, register, upgrade) and target user types
- [x] **Ordered Steps** — delay in hours, subject templates, template files, preview, edit, delete
- [x] **Default Funnels** — post-download, blog-subscriber, free-user onboarding (7-step), paid-user retention (7-step), cross-sell (3-step)
- [x] **Enrollment** — auto-enroll on signup and lead-magnet download
- [x] **Funnel Stats** — step-level opens and clicks
- [x] **Enrollments & Leads** — inspect leads, current step, status; search/filter
- [x] **Broadcasts** — audiences (blog subscribers, registered users, lead downloads, enterprise queries/contact requests), live preview, immediate or scheduled send
- [x] **Delivery** — BullMQ queue, retries with backoff, rate limits, failed-email retry queue
- [x] **Tracking** — open pixel, click redirect, broadcast open/click
- [x] **Unsubscribe** — branded public pages, HMAC-style tokens, per-funnel suppression
- [x] **Queue Monitoring** — pending/processing/failed counts and recent failures

### Marketing Site & Consent
- [x] **Problem Landing Pages** — 7 SEO pages with research stats, ROI strips, FAQs, CTAs
- [x] **Homepage Sections** — hero, payoff/ROI calculator, problems, why-DRA, feature guide, AI showcase, pricing, FAQ
- [x] **Guest Plan CTA** — website → free plan entry point
- [x] **Google Tag Manager** — Consent Mode v2 defaults, conversion events (`free_signup`, `demo_request`)
- [x] **Regional Cookie Consent** — EU/EEA/UK, US, rest-of-world with strictest-default fallback
- [x] **Advertising Consent** — ad consent signals; Meta Pixel loaded via GTM

---

## 9. Security, Compliance & Reliability

- [x] **Encryption at Rest** — AES-256-GCM for connection details, MongoDB strings, OAuth tokens
- [x] **Encrypted OAuth Sessions** — Redis-stored tokens with 15-minute TTL
- [x] **JWT Authentication** — bearer tokens, auth/non-auth token types for public shares
- [x] **Rate Limiting** — general API, auth, expensive operations, SSO callbacks, AI operations, insights, MongoDB, invitations
- [x] **File Upload Validation** — size/MIME checks, per-user queued-upload cap
- [x] **SQL Safety** — DDL/admin blocking, DELETE/UPDATE warnings, transaction-wrapped cleaning SQL
- [x] **AI Guardrails** — credential-request blocking, SELECT-only AI SQL, script allowlist
- [x] **Webhook Security** — Paddle HMAC verification and idempotent event storage
- [x] **SSO Security** — signed assertions, replay protection, audit logging
- [x] **GDPR / Data Deletion** — token revocation, file deletion, user anonymization, scheduled deletion warnings
- [x] **Data Retention** — configurable retention days, automatic cleanup
- [x] **Backups** — scheduled `pg_dump` backups, retention, restore, progress events
- [x] **Notifications** — in-app notification center with read/unread, history, 90-day expiry
- [x] **Observability** — structured logging, platform/system health, sync health, AI usage dashboards

---

## 10. Planned / In Progress

- [ ] **Stacked Area Chart** — dashboard visualization
- [ ] **Map / Geographic Chart** — dashboard visualization
- [ ] **Heat Map, Waterfall, Gauge, Sankey** — advanced visualizations
- [-] **LinkedIn Ads, HubSpot, Klaviyo** — built and production-gated; public rollout pending
- [ ] **Cloud Data Warehouse Connectors** — Snowflake, BigQuery, Redshift, SQL Server
- [ ] **SOC 2 Certification** — enterprise compliance
- [ ] **Public SDKs** — Node.js/Python clients
- [ ] **Embedded / White-Label Analytics** — iframe/SDK embedding
- [ ] **Pre-Spend Forecasting & Scenario Modeling** — predicted CPA/ROAS per channel before launch
- [ ] **Dark Mode** — UI theme
- [ ] **Video Tutorials & Community** — onboarding and user community
