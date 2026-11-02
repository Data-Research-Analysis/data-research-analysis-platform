# Product, Market & Business Review

**Document type:** Product, market, competitor, and business-model analysis  
**Prepared:** 2026-11-01 (supersedes the 2026-10-22 review)  
**Updated:** 2026-11-02 — 30-day metering and trust recommendations implemented  
**Scope:** Data Research Analysis (DRA) as implemented in this repository  
**Method:** Code and documentation review, packaging/tier inspection, credit-economy inspection, legal-copy review, and external market/competitor research. All product claims below are grounded in the codebase; external figures are cited with dates because vendor pricing and market estimates change frequently.

> **What changed since the previous review.** The commercial model has moved from five tier-gated subscription plans (Free, Starter, Professional, Professional Plus, Enterprise) to a credit-based model with three commercial positions (Free, Pro, Enterprise). The product is now un-gated: every feature is available on every plan, seats are unlimited, and credits are pooled at the workspace level. Free and Pro differ only by monthly credit volume and data allowance. This revision re-bases the product, packaging, unit-economics, competitor, and recommendation sections on the credit economy. The market-size and demand sections are retained because the external market did not materially change in ten days; they are marked as refreshed where re-checked.

> **Changes applied on 2026-11-01.** Annual Pro pricing now uses the Paddle-equivalent $94.80 per 1,000 credits per year ($7.90/month equivalent) on both the landing pricing section and the pricing component. The unenforced volume-scaled row-allowance and hourly-sync claims were removed from the pricing cards and the refund/cancellation policies. The tier seeders now create only Free, Professional, and Enterprise with credit allowances, and `1800000006000-ReconcileCreditTiers` reconciles existing databases.

> **Changes applied on 2026-11-02 — 30-day metering and trust recommendations implemented.** All nine items in §7.1 are now implemented and covered by regression tests: plan builds and per-call AI are fail-closed; guest claims reserve the plan-build price at claim time; one-time pack refunds reverse wallet credits idempotently and write both ledgers; pricing and policy copy are aligned; low-balance alerts, workspace spend caps, per-member limits, and explicit auto-recharge consent are live; `CREDITS_ENABLED` defaults on with a startup warning and an admin ledger-vs-`ai_call_logs` reconciliation endpoint; and the credit funnel is instrumented. The remaining commercial work is the 90-day agenda: pack repricing, rollover caps, plan-build margin calibration, and agency packaging. See §7.1 for the implementation matrix.

---

## 1. Executive summary

- DRA is not a generic BI tool. It is an **AI paid-media operating system**: an 18-step Plan Studio that turns a website and brief into a channel-by-channel plan, produces launch-ready artifacts, then tracks actual campaign performance against those targets with attribution, alerts, dashboards, and reports.
- The strongest differentiator is still the **closed loop**: plan → launch → targets → actuals → benchmarks. Most AI plan generators stop at a document; most measurement tools start after the plan exists. DRA is one of the few products that owns both ends.
- The product is broad and unusually complete for its stage: 4 live marketing connectors, 3 production-gated connectors, 6 engineering/file ingestion paths, medallion data models, 6 attribution models, AI insights, public reports/dashboards, SSO, and org-scoped billing.
- **The business model is now credit-based and Juma-style.** One product, zero feature gates, unlimited seats, workspace-pooled credits. Free includes 1,000 credits in the first month (500 monthly grant + 500 one-time onboarding bonus) and 500 credits/month thereafter. Pro is a single card with a 5,000–100,000 credit slider at **$9.80 per 1,000 credits/month** ($7.90 per 1,000 on annual), i.e. $49–$980/month. Credit packs are $9/1,000, $40/5,000, and $70/10,000, available to Pro only. Auto-recharge is Pro-only. Only successful runs should charge; failed runs consume zero.
- **The old packaging tensions are gone.** There is no Starter solo cliff, no all-or-nothing BI tier, no seat-based expansion, no project/dashboard/model/AI-generation/plan-build quotas, and no feature locks on advanced mode, AI chat, deck export, engineering connectors, or the BI layer. The only remaining capacity guardrails are the data-row allowance, the credit balance, and RBAC; sync cadence is a user-selected setting on every plan, not a tier gate.
- **The commercial risk has shifted from too many gates to margin calibration and policy economics.** The 30-day remediation closed the fail-open credit paths: plan builds and per-call AI are fail-closed, guest claims require the plan-build hold, pack refunds reverse wallet credits, and spend controls are live. The remaining commercial issues are pack pricing below subscription rates, uncapped Pro rollover, and a plan-build price calibrated from only four successful builds across one organization and one model. These are now the most important business-model issues, not feature gaps.
- The market is favorable. Marketing analytics is roughly **$6–8B in 2026** growing at **13–17%**, and marketing planning software is roughly **$3B** growing at **~9%**. CMOs are shifting budget into paid media (31.4% of budget, a five-year high) while marketing technology’s share of budget has fallen to a five-year low, which favors consolidated “plan + prove” platforms over another point tool.
- The competitive field is splitting into AI-native plan generators (Juma, Ad IQ, Draper, Medusa, Accelerate, TurboAgents), data connectors (Supermetrics, Funnel, Improvado, Adverity), client-reporting tools (AgencyAnalytics, Whatagraph), and measurement platforms (Northbeam, Triple Whale, Recast, Measured). **Juma now runs the closest commercial playbook**: credit-based pricing, unlimited seats, no feature gates, $49 for 5,000 credits, top-ups, auto-recharge, and a free tier. DRA matches Juma’s entry price and credit philosophy, but differentiates with paid-media depth and the plan-to-actual loop.
- The biggest commercial risks are **metering leakage, margin calibration, bill shock/credit anxiety, free-credit farming, and enterprise compliance**. AI output quality still lacks public evaluation and case studies, and SOC 2/ISO 27001 are still absent.
- Recommended strategic move: the 30-day metering and trust blockers are now closed, so metering is no longer the launch gate. The next move is to protect the plan-build margin, close the pack-arbitrage and rollover-liability gaps, use the Free plan and guest plan as the activation wedge, sell Pro by credit volume rather than features, package agencies through pooled credits and client workspaces, and defer enterprise push until compliance and references exist.

---

## 2. Product definition and positioning

### 2.1 What the product is

DRA combines two products that are usually sold separately:

1. **Plan Studio** — an agentic paid-media planner. A user supplies a website, platforms, markets, budget, and (optionally) a full brief. An 18-step pipeline with 5 human gates researches the market and competitors, audits current paid activity, builds audiences and keywords, writes ad and landing-page copy, produces creatives, assembles a media plan, defines tracking, generates a campaign build guide and QA checklist, reviews results, and exports a strategy deck. Outputs are versioned artifacts (Markdown, JSON, CSV, XLSX, PPTX, HTML) plus a ZIP plan pack.
2. **Marketing intelligence stack** — data ingestion from ad platforms and databases, medallion-layered data models, dashboards, reports, attribution, funnels, anomaly detection, budget optimization, AI insights, and public share surfaces.

The connective tissue is **plan-to-actual tracking**: publishing a plan can create draft campaigns and write targets (CTR, CPC, CPA, CPL, ROAS, budgets, flight dates) into campaign and ad-set records; results sync back into the plan; outcomes feed learned benchmarks that are reused by later plans.

### 2.2 Product pillars

| Pillar | What it does | Commercial role |
|---|---|---|
| Plan Studio | AI research, plan creation, creative/campaign deliverables, launch | Acquisition and differentiation; the flagship credit action |
| Data ingestion | Google Ads, GA4, GAM, Meta Ads; SQL, MongoDB, Excel/CSV, PDF+OCR | Activation and switching costs; free on every plan |
| Data models and BI | Visual models, lineage, health, quality, dashboards, reports | Retention and expansion; free on every plan |
| Intelligence | KPIs, alerts, budget optimizer, attribution, funnels | Recurring value and proof; free on every plan |
| AI assistance | Data modeler, insights, report generation, plan chat | Metered by credits; available on every plan |
| Growth engine | Blog, lead magnets, email funnels, SEO pages, consent | CAC reduction and PLG |
| Platform and trust | Multi-tenancy, RBAC, SSO, encryption, billing, admin | Enterprise readiness |
| Credit economy | Wallet, ledger, action pricing, packs, auto-recharge, rollover, admin console | Monetization and margin control |

### 2.3 Ideal customer profile

**Primary ICP (recommended beachhead):** marketing teams of 3–30 people at B2B SaaS, technology, and considered-purchase B2C companies spending roughly **$50k–$1M per month** on paid media across Google, Meta, and LinkedIn. They have a CMO or VP Marketing who owns the plan and a performance marketer or analyst who executes and reports.

**Secondary ICP:** boutique agencies and fractional CMOs managing 5–50 clients. They need repeatable planning, client-ready decks, branded reports, and fast onboarding. The credit model helps technically (unlimited seats, pooled credits, no per-seat tax) but the product still lacks a mature white-label client portal and per-client billing.

**Buying committee:**

| Role | Primary need | Product surface |
|---|---|---|
| CMO / VP Marketing | Defensible plan, budget allocation, ROI narrative | Plan Studio, intelligence overview, reports, CMO read-only role |
| Performance marketer | Channel plans, targets, campaign build, optimization | Plan Studio, campaign targets, budget optimizer, alerts |
| Marketing analyst / ops | Data connection, models, attribution, dashboards | Connectors, data modeler, attribution, dashboards |
| CFO / finance | Spend justification, plan vs actual, predictable software cost | Reports, public shares, outcomes/benchmarks, credit ledger |
| Agency account lead | Multi-client planning and branded reporting | Workspaces/projects, unlimited seats, pooled credits, public reports (partial) |

### 2.4 Jobs to be done

1. “Give me a defensible paid-media plan for this budget without a three-week strategy cycle.”
2. “Tell me where to spend, how much, and what creative to run.”
3. “Turn the plan into campaigns and targets without re-keying everything.”
4. “Show me whether the plan worked, and prove it to my CFO.”
5. “Stop rebuilding the same reports across five ad platforms.”
6. “Give my team AI leverage without letting it touch production data recklessly.”
7. “Let the whole team use the product without buying a seat for every person.”
8. “Let me pay for the work we actually run, not for features we might never use.”

### 2.5 Positioning statement

> For mid-market marketing teams that need a paid-media plan they can defend and then prove, DRA is the AI operating system that builds the plan, launches the targets, and measures the actuals in one place. Every tool is included on every plan, the whole team shares one credit pool, and you only pay when an action succeeds. Unlike AI plan generators that stop at a document, or measurement platforms that start after the plan, DRA closes the loop from strategy to spend to outcome.

The current public messaging approximates this (“One product, every tool on every plan. Pay only for what your team actually runs.”). The weakness is not the claim; it is proving it consistently, making credit consumption legible, and removing friction between the claim and the first “aha” moment.

---

## 3. Feature listing and review

### 3.1 Feature inventory

Status key: **Live** = implemented and generally available; **Gated** = implemented but production-gated (connector rollout, not pricing); **Partial** = implemented with material limitations; **Planned** = not implemented.

| Area | Feature | Status | Review note |
|---|---|---|---|
| Plan Studio | 18-step pipeline (0–17), 5 human gates | Live | Deepest differentiator; step-level retry, pause/resume, skip, live logs |
| Plan Studio | Basic and Advanced modes | Live | Both available on every plan; Basic auto-approves gates |
| Plan Studio | 18 skill packs, 11 tools, 3 sandbox scripts | Live | Real agentic execution, not a single prompt |
| Plan Studio | Versioned artifacts and ZIP plan pack | Live | 20 artifact contracts; XLSX media plan/checklist and PPTX deck; metered by credits |
| Plan Studio | Publish, campaign creation, targets, results sync | Live | Targets flow to campaign/ad-set records and intelligence |
| Plan Studio | Outcomes and learned benchmarks | Live | Network-effect seed, but benchmark volume is still small |
| Plan Studio | Guest plan (24 h, steps 0–6) | Live | Strong PLG wedge; claimed plan is charged to the workspace wallet |
| Plan Studio | Plan chat and change requests | Live | Available on every plan; 2 credits per call |
| Plan Studio | Plan build credit metering | Live | Fail-closed reserve → settle/release; insufficient credits return 402 before create/start/resume |
| Data | Google Ads (v25, 11 sync types, MCC) | Live | Strong depth |
| Data | GA4 (6 presets) | Live | Adequate for SMB reporting |
| Data | Google Ad Manager (6 implemented report types) | Live | 5 advertised; `inventory`/`orders` fall back to revenue |
| Data | Meta Ads (v25, campaigns/ads/creatives/insights/breakdowns) | Live | Strong depth |
| Data | LinkedIn Ads, HubSpot, Klaviyo | Gated | Built but “coming soon” for non-admins; not a pricing gate |
| Data | PostgreSQL, MySQL, MariaDB, MongoDB | Live | Available on every plan |
| Data | Excel/CSV and PDF+OCR | Live | Practical ingestion differentiator |
| Data | Cloud warehouses (Snowflake, BigQuery, Redshift, SQL Server) | Planned | Major gap versus data-platform competitors |
| Models | Visual builder, joins, calculated columns, aggregates | Live | Available on every plan |
| Models | Cross-source models, AI join suggestions, join catalog | Live | Good mid-market capability; join inference metered |
| Models | Medallion layers, lineage, health, refresh | Live | Layer auto-detection is unreliable for saved models |
| Models | AI data modeler and model-scoped Q&A | Live | Strong, but AI trust/proof is thin; metered |
| Quality | Data-quality scoring and AI remediation | Live | Weighted 35/30/20/15; dry-run and transaction safety; metered |
| Intelligence | KPI overview, channel comparison, campaign drill-down | Live | Clear CMO/performance-marketer value |
| Intelligence | Campaign/ad-set targets and target-aware alerts | Live | Direct link back to Plan Studio |
| Intelligence | Anomaly detection (4 methods) | Live | Rolling stats, budget pacing, target breaches, optional AI |
| Intelligence | Budget optimizer | Live | 5% floor / 40% cap per channel; AI explanation; metered |
| Attribution | 6 models incl. Shapley data-driven | Live | Strong for SMB; no incrementality or MMM; metered |
| Attribution | Funnel builder, UTM tester, gclid matching | Live | Practical and differentiated |
| Reporting | AI insights, reports, public shares, dashboards | Live | Broad; scheduled email delivery and client portal are gaps |
| Reporting | Chart library and PNG export | Partial | No map, waterfall, sankey, gauge (planned) |
| Growth | Blog, lead magnets, email funnels, broadcasts, consent | Live | Real PLG/content infrastructure |
| Security | AES-256-GCM, JWT, RBAC, SSO, rate limits, backups | Live | Strong application security; no SOC 2/ISO 27001 |
| Billing | Credit wallet, ledger, action pricing, packs, auto-recharge | Live | Core credit economy is implemented; 30-day metering and policy blockers are fixed |
| Billing | Paddle checkout, webhooks, grace, promo codes | Live | Org-scoped; legacy ledger/promo defects persist |
| Billing | Admin credit console | Live | Wallets/ledger, action-price edits, packs, grants/adjustments, recharge, Paddle sync |

### 3.2 Detailed review by pillar

#### Plan Studio — strongest asset, clearest moat

**Strengths**

- The pipeline is genuinely agentic: 18 skill packs, shared guardrails, prerequisite/artifact/gate contracts, tool-calling with web search/fetch, marketing metrics, connected accounts, benchmarks, and sandboxed scripts.
- Human gates are placed at the right moments (funnel/build mode, brief, destination URLs, tracking, pre-launch QA). This is a credible answer to the “AI hallucinated a plan” objection.
- Deliverables are operational, not just narrative: XLSX media plan, setup checklist, PPTX strategy deck, campaign build guide, tracking setup, ZIP pack.
- The plan becomes a measurable object: publish creates campaigns and targets; results sync; outcomes recompute benchmarks.
- Guest plan is an unusually strong acquisition asset: no signup, 24 hours, website in, partial plan out, claim-to-keep.
- The credit model makes the flagship action legible: a full plan build is 500 credits (about $4.90 at monthly Pro pricing), and failed builds are supposed to cost zero.

**Weaknesses**

- The guest experience stops at step 6, before the media plan, creative, deck, and launch artifacts. The visitor sees the research, not the payoff. Conversion may suffer unless the locked-state preview is compelling.
- Plan quality is not evidenced. There is no visible evaluation harness, accuracy benchmark, or published sample-plan audit. For a product whose core promise is “defensible plan,” this is the largest trust gap.
- Collaboration is thin: no comments, approvals, or reviewer workflow inside a plan beyond gates and chat.
- No pre-spend forecasting or scenario modeling (planned). Competitors increasingly offer budget scenarios and predicted CPA/ROAS.
- Launch support is uneven: Google/Meta are live; LinkedIn is gated; TikTok appears in the platform-to-channel map but has no live connector.
- The 18-step depth is a strength for quality but a risk for time-to-value. “Defensible plan in minutes” sets an expectation the full pipeline may not meet on first run.
- **Credit enforcement is now fail-closed for the flagship action.** Plan creation, start, and resume require a funded `plan_build` hold; `reconcilePlanCredits` rethrows credit errors; and insufficient credits return a 402 with a billing CTA. This was the most important commercial defect in the previous review and is now closed; the remaining trust work is plan-quality evidence, not metering.

**Assessment:** Category-leading depth. The proof layer still needs work, but credit enforcement is now fail-closed. This is the feature to lead with, the feature to instrument most heavily, and the feature whose metering must stay covered by regression tests.

#### Data ingestion — good SMB coverage, mid-market gaps

**Strengths**

- Google Ads and Meta Ads are deep (v25 APIs, many sync types, MCC support, breakdowns).
- GA4 and GAM cover the Google stack; GAM’s implemented types exceed what is advertised, though two advertised types fall back to revenue.
- Engineering sources (PostgreSQL, MySQL, MariaDB, MongoDB) plus Excel/CSV and PDF+OCR make DRA usable when the data is not clean or API-native. These are now available on every plan, not just Professional+.
- Auto-onboarding creates models and dashboards on connection, reducing time-to-value.
- Encrypted credentials, token refresh, sync history, and scheduled sync are production-grade basics.

**Weaknesses**

- No Snowflake, BigQuery, Redshift, or SQL Server. This is a standard mid-market/enterprise requirement and a direct gap versus Supermetrics, Funnel, Improvado, and Adverity.
- Only four marketing connectors are live. No TikTok Ads, Microsoft Ads, Amazon Ads, Pinterest, Snapchat, Shopify, Salesforce, or generic CRM beyond a gated HubSpot.
- Scheduled sync only fires automatically for GA4, GAM, Google Ads, and Meta. Other sources require manual or job-specific handling.
- Connector reliability and schema drift are not visibly monitored beyond sync history; at scale this becomes a support cost.
- **Hourly syncs are not a tier entitlement.** The channel settings expose hourly/daily/weekly/monthly/manual to every plan, and the scheduler does not check tier or credit volume. The public “hourly at 25k+” claim has been removed; cadence is now described as a user-selected setting.

**Assessment:** Sufficient to win SMB paid-media teams; not sufficient for data-mature mid-market buyers without warehouse connectors.

#### Data models and BI — strong no-code layer, now available to everyone

**Strengths**

- Visual modeling with joins, calculated columns, aggregates, filters, GROUP BY, SQL preview, and data preview is accessible to marketers.
- Cross-source models and AI join suggestions address the hardest practical problem in marketing data.
- Medallion layers, lineage, health classification, cascade refresh, and quality scoring are governance features usually absent at this price point.
- AI data modeler and model-scoped Q&A reduce dependence on analysts.
- Removing the Professional+ gate is a major adoption unlock: the “track results” promise is now available on Free and Pro, not only at the old $129 tier.

**Weaknesses**

- Automatic layer detection is unreliable for saved models, which undermines the medallion story.
- No semantic layer, dbt integration, or warehouse-native modeling; the product is its own modeling environment.
- Dashboards are broad but not best-in-class: no scheduled email delivery, no map/waterfall/sankey/gauge, PNG export only.
- Public reports/dashboards are strong for sharing but not a full white-label client portal with client logins and per-client domains.
- No embedded/white-label analytics yet (planned), which limits agency and SaaS distribution.
- Removing the gate also removes a former upgrade lever; the credit model must now carry expansion on its own.

**Assessment:** A credible “BI for marketers” layer that creates switching costs. It should be positioned as the proof layer for plans, not as a general-purpose BI replacement.

#### Intelligence, attribution, and optimization — good breadth, missing causal measurement

**Strengths**

- KPI cards, prior-period comparisons, channel matrix, campaign drill-down, targets, and alerts map directly to weekly marketing operations.
- Target-aware alerts connect plan commitments to actual performance, which is rare.
- Budget optimizer with channel floors/caps and AI explanation is immediately useful.
- Six attribution models, including Shapley data-driven attribution, plus funnel analysis, gclid matching, and a UTM tester, is strong for an SMB/mid-market product.
- Anomaly detection combines statistical, budget-pacing, target-breach, and optional AI methods.
- Every intelligence surface is now available on Free, which makes the Free plan a genuine full-product trial.

**Weaknesses**

- No incrementality testing (geo holdouts, lift tests), no MMM, and no causal calibration. In 2026, sophisticated buyers increasingly treat MTA as directional and ask for causal proof.
- No cross-device identity graph, server-side tracking, or mobile app attribution.
- No creative analytics (which creative attributes drive performance), a growing category among DTC measurement tools.
- No forecasting or scenario planning before spend.
- Alert delivery is in-app/email; no Slack/Teams integration.

**Assessment:** Strong operational intelligence for teams that need “what changed and where to shift budget.” Not yet a measurement science platform; do not position it against Northbeam/Measured on causal rigor.

#### AI insights, reports, and dashboards — broad, but trust and delivery need work

**Strengths**

- AI insights stream, persist, support follow-up chat, and can be published as dashboard widgets.
- Report builder combines KPI cards, AI insight sections, text, dashboards, and data tables.
- Public share links with expiry and revocation, plus branded public dashboards, are practical for client and executive communication.
- 17 AI feature keys with per-feature cost tracking and per-action credit prices is mature cost governance for a young product.
- Cached AI analysis results are free; only real generations reserve credits.

**Weaknesses**

- No scheduled report delivery (email/Slack) and no client portal; competitors like AgencyAnalytics and Whatagraph win on automated client reporting.
- AI output quality is not evaluated publicly; “AI insight” trust depends on visible accuracy and reviewer controls.
- Report/dashboard design depth is below dedicated reporting tools; chart types and layout controls are limited.
- No annotations, goals, or commentary workflow for month-end reporting.
- Per-call AI charges are now pre-authorized before chat, grounding, and join-inference calls. A zero-balance workspace is blocked before the model request, matching the public “actions pause until you top up” promise.

**Assessment:** Good enough to retain users and demonstrate value; not yet a reason to switch from a dedicated reporting tool. The plan-to-report link is the differentiator.

#### Credit economy and billing — the new commercial core

**Strengths**

- **Workspace-level wallet and immutable ledger.** `dra_credit_wallets`, `dra_credit_transactions`, `dra_credit_packs`, and `dra_action_prices` are implemented with transactional balance updates, pessimistic row locks, and idempotency keys.
- **Reserve/settle/release semantics** for multi-step actions: plan builds, data-quality runs, AI analyses, attribution, report generation, and exports can hold credits at start, settle on success, and release on failure.
- **Only-successful-runs-charge intent** is implemented for per-action flows and documented in the Terms and refund policy.
- **Fail-closed metering and spend controls.** Plan builds, per-call AI, and guest claims now block unfunded actions with a 402; workspaces can set a hard monthly spend cap, admins can set per-member limits, and owners/admins receive 20%/10% low-balance email and in-app alerts. Auto-recharge requires explicit saved-card consent and has a clear off switch.
- **Monthly grants and rollover.** Free gets 500 credits/month and does not roll over; Pro monthly credits roll over; purchased packs never expire. `CreditRolloverJob` grants daily for Free, Pro monthly, and annual subscriptions.
- **Onboarding bonus.** New Free workspaces receive a one-time 500-credit bonus, giving 1,000 credits in month one. The bonus is a separate ledger type and survives the Free monthly reset.
- **Pro variable-credit subscription.** The customer chooses 5,000–100,000 credits in 5,000-credit steps; Paddle charges a per-1,000-credit recurring price with quantity = credits/1,000. The webhook reconciles the actual purchased quantity rather than trusting custom data.
- **Packs and auto-recharge.** One-time Paddle packs are implemented, and saved-card auto-recharge is wired with an in-flight guard and a Pro-only check.
- **Admin console.** Admins can view wallets/ledger, edit action prices, manage packs, grant/adjust credits, trigger auto-recharge, and sync Paddle products.
- **Legal alignment.** Terms, refund, cancellation, and privacy pages now describe credits, successful-run charging, rollover, packs, auto-recharge, and credit-usage data.

**Weaknesses and defects**

- **Resolved (2026-11-02): plan-build metering is fail-closed.** Creation, start, and resume require a funded `plan_build` hold; the running status is not persisted until the hold exists; `reconcilePlanCredits` rethrows credit errors; and the API returns 402 with a billing CTA.
- **Resolved (2026-11-02): per-call metering is pre-authorized.** Chat, grounding, join inference, and other per-call actions check the balance before the model request. A zero-balance workspace is blocked before consuming AI.
- **Resolved (2026-11-02): guest claim metering is fail-closed.** The guest build remains unmetered because no wallet exists yet; at registration the monthly grant is applied and the 500-credit `plan_build` hold must succeed before the plan is attached. Insufficient credits return 402. The hold is settled on completion and released if the claim fails or the plan cannot continue.
- **Resolved (2026-11-02): pack refunds are reconciled to the credit wallet.** The webhook resolves the org from the original Paddle transaction, reverses the wallet credit idempotently on the adjustment id, and records both the financial-ledger and credit-ledger entries. Refunded credits no longer remain spendable.
- **Open (90-day): pack pricing is below subscription pricing per credit.** Pro monthly is $9.80/1,000; the 5,000 pack is $8.00/1,000 and the 10,000 pack is $7.00/1,000. A Pro 5k customer who needs 10k can buy a 5k pack for $40 instead of upgrading to 10k for $98. This cannibalizes the main expansion lever.
- **Open (90-day): Pro rollover is uncapped.** The code adds each month’s Pro grant without expiring unused Pro credits, so unused credits can accumulate indefinitely. Juma, the reference model, rolls plan credits for one month and expires them after that; top-ups last 12 months. DRA’s uncapped rollover creates a usage liability and weakens the case for volume upgrades.
- **Resolved (2026-11-02): Free pack policy copy is consistent.** Pack credits remain usable after downgrade, including on Free; Free workspaces cannot buy new packs. The cancellation and refund pages now state the same policy.
- **Resolved (2026-11-02): low-balance and spend controls are live.** Owners/admins receive 20% and 10% balance alerts by email and in-app socket; workspaces have a hard monthly spend cap; admins can set per-member monthly limits; and auto-recharge requires explicit saved-card consent with an easy off switch. Per-member limits are enforced for attributed spend (AI calls and plan builds); broader reservation attribution is a follow-up.
- **Resolved (2026-11-02): credit-rate copy is aligned.** The pricing surfaces now say credits are “about 1 cent each” and note that exact rates vary by plan and pack, instead of claiming a flat $0.01.
- **Open (90-day): the public data-allowance claim is simplified.** Pricing and policy copy no longer claims “1M–100M rows” or “~100k”; it now describes a plan-based data-row allowance per data model. The underlying limit remains a static tier field, so volume-scaled rows are a future product decision rather than a current promise.
- **Resolved (2026-11-02): `CREDITS_ENABLED` defaults on and is observable.** `.env.example` now defaults to `true`, the server logs a launch-blocking warning when metering is off, and `GET /admin/credits/reconciliation?month=YYYY-MM` compares per-call ledger charges against `ai_call_logs` so operators can verify reconciliation per environment.
- **Open: legacy billing defects persist.** Successful payments can still be written with `amount = 0`; promo redemptions are not recorded from webhooks; account cancellation does not cancel the org’s Paddle subscription. These are revenue-leakage and reconciliation risks independent of credits.

**Assessment:** The credit economy is a strong strategic move and is more than a pricing-page change: it is a full wallet/ledger/metering system. The 30-day remediation closed the fail-open paths and added the trust controls, so metering is no longer the paid-acquisition blocker. The remaining pre-scale work is pack repricing, rollover policy, plan-build margin calibration, and the legacy billing defects.

#### Growth, CMS, and email — a real CAC asset

**Strengths**

- Seven problem-focused SEO landing pages with research stats, ROI strips, FAQs, and CTAs.
- Lead magnets, gated downloads, placements, popups, and email funnels with tracking.
- Broadcasts, unsubscribe handling, and consent management (GTM Consent Mode v2, regional cookie consent).
- Guest plan CTA and website-first entry reduce signup friction.
- The pricing page now includes a credit estimator and a transparent per-action table, which is a strong trust asset for a usage-based model.

**Weaknesses**

- Some statistics are third-party and should be periodically re-verified; stale stats undermine the research-led brand.
- No visible case studies, customer logos, or third-party reviews on the site.
- Content targets pain points well but rarely shows the product output (sample plans, decks, dashboards).
- No comparison pages against Juma, Ad IQ, Draper, AgencyAnalytics, Supermetrics, or Northbeam.
- No credit-lifecycle email sequence: no “you have 20% credits left”, no “here is what a plan costs”, no “you are close to your monthly volume” nudge.

**Assessment:** Above-average PLG/content infrastructure for a product at this stage. Add proof assets and a credit-lifecycle email program.

#### Platform, security, and commerce — solid foundation, enterprise gaps

**Strengths**

- Org → workspace → project tenancy with owner/admin/member and analyst/manager/CMO roles.
- SAML 2.0 SSO with JIT provisioning, domain verification, enforcement, and single logout.
- AES-256-GCM encryption for credentials and OAuth tokens; JWT auth; rate limiting; SQL safety; AI guardrails.
- Paddle handles tax and payments; webhooks are HMAC-verified and idempotent; grace periods and dunning exist.
- Admin tooling covers users, orgs, tiers, AI usage/cost, credit wallets, backups, jobs, content, and cancellations.
- Unlimited seats and no feature gates simplify procurement and remove a major source of internal entitlement bugs.

**Weaknesses**

- No SOC 2 or ISO 27001. This alone blocks many mid-market and enterprise deals.
- No PostgreSQL RLS; tenancy is enforced in application code. Adequate today, but a diligence concern at scale.
- No SCIM provisioning, audit-log UI, data residency, or customer-managed keys.
- Enterprise tier is custom and admin-managed (`credits_per_month = 0`), which is appropriate but needs a clear sales-operations playbook for granting and reconciling credits.
- No standard self-serve trial flow; the Free plan is the trial. That is acceptable, but there is no time-boxed urgency and no trial-conversion instrumentation.
- **CMO data-model exclusion is not defense-in-depth.** The frontend route guard blocks `/data-models` for CMO, but `backend/src/constants/permissions.ts` still grants CMO `DATA_MODEL_VIEW` and `DATA_MODEL_EXECUTE`. A CMO using the API directly can read or execute data models. Add a backend role check if the rule is “CMOs never see data models.”
- Credit-specific compliance is thin: auto-recharge consent, spend caps, credit expiry disclosure, and refund reversal need explicit product and legal treatment.

**Assessment:** Strong application security for an early-stage product; enterprise compliance, credit-policy clarity, and billing correctness are the gating items.

### 3.3 Feature maturity scorecard

| Capability | Depth | Differentiation | Commercial readiness | Priority |
|---|---|---|---|---|
| Plan Studio | High | High | Medium | Protect and prove; metering is fail-closed |
| Plan-to-actual loop | High | High | Medium | Protect and prove |
| Credit economy | Medium | Medium | Medium | Correctness and refunds fixed; scale with pack/rollover economics |
| Marketing connectors | Medium | Low | Medium | Expand |
| Engineering/file ingestion | Medium | Medium | High | Maintain |
| Data models/BI | High | Medium | High | Maintain |
| Attribution/funnels | Medium | Medium | High | Extend |
| AI insights/reports | Medium | Medium | High | Improve delivery |
| Growth/PLG engine | High | Medium | High | Add proof and credit lifecycle |
| Security/compliance | Medium | Low | Low | Close SOC 2 gap |
| Billing/ops | Medium | Low | Medium | Maintain metering; fix legacy billing |

### 3.4 Packaging inconsistencies and product defects to resolve

| Issue | Evidence | Business impact | Status (2026-11-02) |
|---|---|---|---|
| Plan build can run without credits | `PaidMediaPlanService.reconcilePlanCredits` rethrows credit errors; create/start/resume hold `plan_build` before running | Free usage of the flagship action; direct margin leakage | **Resolved** — fail-closed pre-check and reservation, 402 with billing CTA |
| Per-call AI actions failed open (pre-2026-11-02) | `AICallTrackerService.authorizePerCall` runs before chat/grounding/join-inference calls | Chat/grounding free at zero balance; contradicts “actions pause” | **Resolved** — pre-authorized before the model request |
| Guest claim failed open (pre-2026-11-02) | `GuestPlanProcessor` grants monthly credits and holds `plan_build` before claiming; 402 if unfunded | Lead keeps a plan without the 500-credit charge | **Resolved** — claim hold, settle/release, 402 |
| Pack refunds not reversed in wallet | `paddle-webhook` resolves the original purchase and calls `CreditWalletService.reversePurchase` | Refunded credits remain spendable | **Resolved** — idempotent wallet reversal plus financial and credit ledger entries |
| Packs cheaper per credit than subscription | $8/1k and $7/1k packs vs $9.80/1k Pro monthly | Pro users top up instead of increasing volume; expansion cannibalization | **Open** — 90-day repricing |
| Uncapped Pro rollover | `grantMonthly` never expires Pro credits; `credits_rollover = true` | Accumulating usage liability; weaker upgrade pressure | **Open** — 90-day rollover cap |
| Free pack lockout vs pack usability on Free | `CreditCheckoutService.canBuyPacks`; refund/cancellation copy | Policy confusion; support disputes | **Resolved** — copy now states packs stay usable on Free, but Free cannot buy new packs |
| “1 credit = $0.01” overstated effective price (pre-2026-11-02) | Pro $9.80/1k, annual $7.90/1k, packs $7–$9/1k | Minor trust issue; makes the product look more expensive than it is | **Resolved** — copy now says “about 1 cent each” |
| `CREDITS_ENABLED` defaults false | `backend/.env.example` | Metering may be off in an environment while credit copy is live | **Resolved** — defaults true, startup warning, admin reconciliation endpoint |
| No low-balance email / spend cap / per-member limit (pre-2026-11-02) | Wallet service now emits alerts and enforces caps | Bill shock; admin control gap | **Resolved** — 20%/10% alerts, workspace cap, member limits, auto-recharge consent |
| Free tier can be farmed | 500 credits/month + 500 onboarding per workspace; unlimited seats; no per-IP guest quota | Multiple accounts can generate free plan builds | **Open** — 90-day identity/rate limits |
| CMO data-model exclusion is frontend-only | `permissions.ts` grants CMO `DATA_MODEL_VIEW`/`EXECUTE`; route guard blocks `/data-models` in the UI | A CMO can read/execute data models through the API; violates the intended CMO access rule | **Open** |
| Stale internal docs | `FEATURES.md`, `architecture/05-billing-subscription.md`, the architecture index, data/RBAC docs, comprehensive architecture, and use-cases now describe the credit model | Internal misalignment; support and sales errors | **Resolved** — documentation updated 2026-11-02 |
| Legacy billing defects persist | Zero-amount charge rows, promo redemption gap, account cancellation not cancelling Paddle | Revenue reconciliation and refund risk | **Open** |

### 3.5 Resolved in the 2026-11-01 revision

| Issue | Fix | Commit |
|---|---|---|
| Annual Pro price differs by page | Both the landing section and the pricing component now use the Paddle annual rate: $94.80 per 1,000 credits/year ($7.90/month equivalent, $474/year for 5k). | `44e9bb7b` |
| Row allowance claim not volume-scaled | Pricing cards, refund policy, and cancellation policy no longer claim “1M–100M” or “~100k”; they describe a plan-based data-row allowance per data model. | `01789f7e`, `06f9022a` |
| Hourly sync claim not enforced | The “hourly at 25k+” claim was removed; cadence is described as a user-selected, scheduled setting on every plan. | `01789f7e`, `06f9022a` |
| Stale tier seeders | Seeders now create only Free, Professional, and Enterprise with credit allowances and no Starter/Professional Plus mappings. | `96f4533b` |
| Existing databases not reconciled | `1800000006000-ReconcileCreditTiers` restores Free/Pro allowances, repairs zero row limits, and deactivates unused legacy tiers. | `24318c7c` |

### 3.6 Resolved in the 2026-11-02 revision

| Issue | Fix | Commit |
|---|---|---|
| Plan builds could run unfunded | Pre-flight and reserve `plan_build` before create/start/resume; reconcile rethrows credit errors; 402 with billing CTA. | `dd67f842` |
| Per-call AI could run at zero balance | Pre-authorize chat, grounding, and join inference before the model request. | `4de99038` |
| Guest claims could skip the charge | Apply the monthly grant and hold 500 credits before claiming; 402 if unfunded. | `f835b0a8` |
| Refunded packs stayed spendable | Resolve the original purchase and reverse wallet credits idempotently; write both ledgers. | `ef29490a` |
| Pricing and policy copy disagreed | “About 1 cent”; consistent Free/pack cancellation and refund language. | `f5e6bb9d` |
| No spend caps or low-balance alerts | 20%/10% alerts, workspace spend cap, per-member limits, auto-recharge consent. | `588aed15` |
| Metering status was not observable | `CREDITS_ENABLED` defaults true; startup warning; admin reconciliation endpoint; funnel events. | `dc4af79a` |
| No regression coverage | Wallet tests for fail-closed plan builds, per-call zero balance, guest claims, spend caps, refunds, rollover. | `cb8ecf31` |
| Stale internal documentation | FEATURES, billing architecture, architecture index, data/RBAC docs, comprehensive architecture, and use-cases now describe the credit model. | working tree |

---

## 4. Market review

### 4.1 Market size and growth

Estimates vary by definition. The ranges below are more useful than a single point estimate.

| Market | 2026 estimate | Forecast | CAGR | Source |
|---|---:|---|---:|---|
| Marketing analytics (broad) | $8.02B | $14.55B by 2031 | 12.65% | Mordor Intelligence, Jul 2026 (re-checked Nov 2026) |
| Marketing analytics software | $6.10B | $14.25B by 2033 | 12.9% | Coherent Market Insights, Apr 2026 |
| Marketing analytics (alternative) | $7.24B | $13.47B by 2030 | 16.8% | The Business Research Company, Sep 2026 (re-checked Nov 2026) |
| Marketing planning software | $3.18B | $5.04B by 2032 | 8.75% | PW Consulting, Jun 2026 |

DRA sits at the intersection of these categories. A defensible framing is: **a ~$6–8B marketing analytics market plus a ~$3B planning market, with meaningful overlap in the “plan and prove” workflow.** The company should not claim the full sum as TAM; it should define a narrower serviceable market around paid-media planning and measurement for SMB/mid-market teams.

### 4.2 Demand drivers

- **Paid media is taking a larger share of budget.** Gartner’s 2026 CMO survey puts paid media at **31.4%** of marketing expense, a five-year high, with 53% of CMOs planning to increase it. Digital channels are **67.5%** of marketing expense.
- **Budgets are flat but expectations are higher.** Marketing budgets average **7.8% of revenue**, up only 1.3% year over year; 56% of CMOs say they lack the budget to deliver their strategy.
- **AI spend is rising faster than AI readiness.** CMOs allocate **15.3%** of budget to AI, but only **30%** report mature AI readiness; 70% say internal processes are not mature enough to scale AI. This favors products that embed AI into an existing workflow rather than selling “AI” as a standalone capability.
- **Martech share is at a five-year low (19.4%).** Buyers are consolidating tools and demanding measurable outcomes. A platform that replaces a planner, a reporting tool, and part of a measurement stack has a stronger consolidation story than another point solution.
- **Reallocation is continuous.** About 20% of CMOs reallocate more than 5% of budget monthly, 38% quarterly, and 14% continuously. Products that shorten the plan-to-reallocation cycle have a clear operational rationale.
- **Measurement pressure is rising.** Privacy restrictions, signal loss, and CFO scrutiny push buyers beyond last-click. DRA’s six attribution models and funnel analysis are table stakes; causal/incrementality proof is the next expectation.
- **Usage-based pricing is becoming normal for AI-heavy tools.** Juma’s 2026 move to credit-based pricing with unlimited seats, no feature gates, and “failed Flows cost zero” validates the model DRA has adopted. Buyers increasingly expect to pay for output, not seats, and to see a published cost per deliverable.
- **AI cost variability favors metering.** Model prices, token volumes, and retry rates change. A credit layer protects gross margin better than a flat “unlimited AI” promise, provided the credit prices are calibrated and enforced.

### 4.3 Buyer behavior and buying criteria

Mid-market buyers typically evaluate in this order:

1. **Can it produce a plan we trust?** (research quality, human review, artifacts, defensibility)
2. **Can it connect our channels without a data team?** (connectors, onboarding, schema handling)
3. **Can it show plan vs actual?** (targets, dashboards, attribution, reports)
4. **Can our team and stakeholders use it?** (roles, sharing, branding, permissions)
5. **Can we predict and control the cost?** (credit price per deliverable, spend caps, low-balance alerts, rollover rules)
6. **Is it safe and procurable?** (SSO, SOC 2, DPA, data residency, references)
7. **Is it worth the price?** (credit volume fit, expansion path, ROI proof)

Enterprise buyers add procurement, security review, implementation services, and SLA requirements. DRA is currently stronger on 1–4 than on 5–7.

### 4.4 Segment attractiveness

| Segment | Size | Pain | Willingness to pay | DRA fit | Verdict |
|---|---|---|---|---|---|
| SMB (1–5 marketers, <$50k/mo spend) | Very large | High | Low ($0–$98) | High | Volume/PLG |
| Mid-market (5–30 marketers, $50k–$1M/mo) | Large | Very high | Medium ($98–$490) | High | **Beachhead** |
| Enterprise (>$1M/mo, 30+ marketers) | Smaller | High | High (custom, $2.5k+/mo) | Medium | Later, after compliance |
| Boutique agencies / fractional CMOs | Large | Very high | Medium ($245–$980) | Medium-high | **Second beachhead** |
| Data teams / analytics centers of excellence | Medium | Medium | Medium | Low-medium | Not the buyer |

The most attractive near-term segment is mid-market marketing teams that already spend on multiple channels and have a reporting pain but no data science team. They can self-serve, value the plan artifacts, and upgrade credit volume as usage grows. Agencies are more attractive than before because unlimited seats and pooled credits remove the per-client seat tax, but the missing client portal still caps the agency opportunity.

### 4.5 Regulatory and technology shifts

- **Privacy and consent:** GDPR/CCPA consent, first-party data, and cookie deprecation increase the value of owned data pipelines and attribution alternatives.
- **AI governance:** Buyers increasingly ask for model transparency, data-use boundaries, human review, and auditability. DRA’s VERIFIED/ESTIMATE/NOT VERIFIED semantics and human gates are assets; they need to be visible in sales materials.
- **Platform API volatility:** Google Ads v25, Meta v25, and GAM changes create maintenance cost and a credibility risk if syncs break. Connector reliability is a product feature, not an ops detail.
- **Agentic interfaces:** Buyers are moving from dashboards to “ask and act.” DRA’s plan chat and AI insights fit this shift, but competitors are shipping agents that can also execute budget changes. DRA’s execution is currently plan/launch-oriented, not in-platform bid/budget automation.
- **Usage-based billing regulation:** Auto-recharge is a recurring charge against a saved payment method. It needs explicit consent, easy cancellation, clear thresholds, and refund handling. Credit expiry and rollover must be disclosed in plain language. These are trust requirements, not just legal boilerplate.
- **Cost volatility:** AI model price changes and provider shifts can change unit economics quickly. The credit catalog must be re-calibrated monthly and protected by margin guardrails.

---

## 5. Competitor analysis

### 5.1 Competitive categories

| Category | Representative vendors | What they win on | What they lack for DRA’s buyer |
|---|---|---|---|
| AI plan generators | Juma, Ad IQ, Draper, Medusa, Accelerate (InMobi), TurboAgents | Speed, low price, URL-to-plan, creative direction, credit pricing | Tracking, attribution, BI, launch loop, enterprise controls |
| Data connectors / ETL | Supermetrics, Funnel.io, Improvado, Adverity, Windsor.ai, Coupler.io | Connector breadth, warehouse delivery, governance | Planning, creative, campaign targets, CMO narrative |
| Client reporting / dashboards | AgencyAnalytics, Whatagraph, DashThis, Swydo, Looker Studio, Power BI | White-label reporting, scheduled delivery, agency workflow | Plan generation, optimization, attribution depth |
| Attribution / measurement | Northbeam, Triple Whale, Rockerbox, Measured, Recast, Mutinex, Prescient AI | Causal measurement, MMM, incrementality, pixel depth | Planning, creative, campaign build, SMB price point |
| Marketing planning / budgeting | Uptempo (Allocadia), Anaplan, Planful, Marmind, Etropo | Enterprise budget workflow, finance integration, scenario planning | AI execution, channel-level creative, ad-platform tracking |
| Suites / platforms | Google Marketing Platform, Meta, HubSpot, Salesforce, Adobe, Semrush | Distribution, bundling, data access | Paid-media-plan-first workflow, cross-platform neutrality |

### 5.2 Direct AI plan competitors

| Vendor | Offer | Pricing signal | Strength | Gap vs DRA |
|---|---|---|---|---|
| Juma | AI marketing workspace with 700+ Flows across content, paid media, SEO, social, analytics, and strategy; brand/project context; credit-based pricing | **$49/mo Pro Starter for 5,000 credits; free 300 credits/user; 5k–100k credit volumes; top-ups; auto-recharge; unlimited seats; no feature gates** | Brand, breadth, agency workflows, credit-pricing leadership | No ad-platform BI/attribution, no plan-to-actual targets, paid media is one Flow category rather than the operating system |
| Ad IQ (nibunam.ai) | 9-platform campaign plan, personas, targeting, bids, creative briefs | 3 free reports, then from $49/mo | Cheap, fast, launch-ready detail | No ongoing measurement or plan-vs-actual |
| Draper (askdraper.ai) | 10-question strategy, channel selection, creative angles, PDF/PPTX | Free while in beta | Low friction, strategy-deck output | No data connections, tracking, or BI |
| Medusa | Brief-to-media-plan, personas, channel mix, flighting, live pacing vs plan | Not publicly listed | Closest to DRA’s plan-to-actual loop | Agency media-planning focus; no attribution/BI breadth |
| Accelerate (InMobi) | URL-to-cross-channel plan, creatives, launch, analytics | Backed by InMobi; likely free/ads-supported | Distribution and one-click launch | Less depth in research, governance, and reporting |
| TurboAgents Ad Strategist | URL-to-paid-ads plan, personas, creative, budget, readiness score | Not publicly listed | Strong packaged output and scoring | No tracking loop or BI |

**Implication:** DRA cannot win on “AI plan in minutes” alone; that is becoming commoditized at $0–$49. Juma now matches DRA’s credit philosophy and entry price, and has broader marketing breadth. DRA wins only if the plan is visibly better and if the plan remains the operating object after launch.

### 5.3 Adjacent competitor benchmarks

| Vendor | Published entry price | Model | Relevance to DRA |
|---|---:|---|---|
| Juma | $49/mo for 5,000 credits; free 300 credits/user | Credits, unlimited seats, no feature gates | Closest commercial model; DRA matches $9.80/1k entry price |
| Supermetrics | $44/mo annual ($55 monthly) | Sources/users/rows/destinations | Data plumbing; potential partner or competitor for connectors |
| Funnel.io | $300/mo annual (Starter) | Connectors/destinations/Flexpoints | Mid-market data hub; much higher price |
| Improvado | Free Limited; $100/mo MCP; custom Advanced | Rows/year + AI/MCP actions | Governance-first; enterprise sales |
| AgencyAnalytics | $20/client/mo annual | Per managed client | Agency reporting benchmark; DRA lacks client portal |
| Whatagraph | ~$699–$812/mo annual | Source credits | Agency reporting; higher price floor |
| Northbeam | $1,500/mo Starter; $3,500/mo Professional | Ad spend/data volume | Attribution benchmark; DRA is far cheaper but less causal |
| Triple Whale | Free; $219/mo Foundation; $749/mo Automate | GMV/package | DTC measurement + AI; strong brand |
| Recast | ~$2k–$8k/mo; ~$35k ACV | SaaS MMM | Measurement science; not a planning tool |
| Measured | ~$50k–$200k+/yr | Managed MMM + experiments | Enterprise causal measurement |
| Uptempo (Allocadia) | ~$2k+/mo; ~$66k average contract | Per user/enterprise | Enterprise planning/budgeting; no AI execution |
| Ad IQ | $49/mo | Reports/month | Direct low-end AI plan competitor |

### 5.4 Positioning map

```
                     Enterprise / managed
                              ^
                              |
        Measured / Recast     |     Uptempo / Anaplan
        Northbeam             |     (planning + finance)
        Triple Whale          |
                              |
   Measurement <--------------+--------------> Planning / creation
                              |
        AgencyAnalytics       |     Juma / Ad IQ / Draper
        Whatagraph            |     Medusa / Accelerate
        Supermetrics/Funnel   |     DRA (plan + measure)
                              |
                     SMB / self-serve
```

DRA’s intended position is the upper-right of the self-serve quadrant: more measurement than AI plan generators, more planning than reporting tools, and far cheaper than measurement platforms. Juma now occupies much of the “planning/creation, credit-based, unlimited seats” space, so DRA must make the **measurement half** of the loop unmistakable in positioning and onboarding.

### 5.5 Competitive moats and vulnerabilities

**Potential moats**

- **Workflow lock-in:** once a team connects channels, builds models, sets targets, and publishes plans, switching means rebuilding the operating layer.
- **Proprietary benchmark loop:** plan outcomes feed learned benchmarks; at scale this can become a data advantage.
- **Skill-pack IP:** 18 domain-specific packs with contracts and guardrails are harder to copy than a prompt.
- **Credit ledger and calibrated action pricing:** a working wallet, ledger, reserve/settle system, and per-action cost catalog is operational IP that takes time to get right. It also produces proprietary cost data.
- **Open-source community:** MIT licensing can drive adoption, integrations, and trust; it also constrains pricing power.
- **Multi-tenant enterprise features:** SSO, RBAC, branding, and audit-ready controls are meaningful for mid-market.
- **Sunk credit balance:** rollover and pack credits create a mild switching cost, though uncapped rollover also creates a liability.

**Vulnerabilities**

- **Open-source cloning:** the entire product, including pricing logic, is MIT-licensed. Competitors can fork it; the moat must be hosted operations, brand, data, and enterprise trust.
- **Foundation-model commoditization:** plan quality can be replicated with better prompts and tools; DRA must own the workflow and data, not the model.
- **Juma’s head start on the credit playbook:** Juma already has credit pricing, unlimited seats, no feature gates, auto-recharge, top-ups, a free tier, and a much broader Flow library. DRA’s differentiation must be paid-media depth and measurement, not the pricing model itself.
- **Incumbent bundling:** Google/Meta offer free planning and measurement; HubSpot/Salesforce can bundle AI planning into existing suites.
- **AI trust:** a few bad plans can damage the brand faster than good plans build it.
- **Integration fragility:** platform API changes can break the core promise.
- **Price compression:** AI-native competitors are pricing at $0–$49, forcing DRA to justify the premium with measurable outcomes.
- **Credit-model trust:** bill shock, unclear rollover, failed-run charging, and refund friction can damage trust faster than feature gaps.

### 5.6 Likely win/loss themes

**DRA wins when**

- The buyer needs a plan and a way to prove it, not another dashboard.
- The team is too small for a data engineer but too sophisticated for spreadsheets.
- Multi-channel spend and plan-vs-actual accountability are real pains.
- The buyer values unlimited seats and no feature gates.
- The buyer wants to pay for output rather than seats, and values a published per-action cost table.
- The guest plan or a sample plan demonstrates quality quickly.

**DRA loses when**

- The buyer primarily needs causal measurement (Northbeam/Measured/Recast win).
- The buyer primarily needs connector breadth or a warehouse (Funnel/Supermetrics/Improvado win).
- The buyer is an agency needing a mature white-label client portal (AgencyAnalytics/Whatagraph win).
- The buyer is enterprise and requires SOC 2, SCIM, data residency, and references.
- The buyer only wants a cheap strategy document (Ad IQ/Draper/Juma win).
- The buyer wants a flat, predictable monthly price with unlimited AI and no credit anxiety.
- AI output quality is inconsistent or the first plan takes too long.
- Credit metering feels unfair (charged for failures, unclear rollover, surprise auto-recharge).

---

## 6. Business model analysis

### 6.1 Revenue architecture

- **Model:** credit-based SaaS, billed per workspace/organization, sold self-serve via Paddle with sales-assisted Enterprise.
- **Commercial positions:** Free, Pro (variable credit volume), Enterprise.
- **Billing:** monthly or annual; annual is ~20% off; Paddle is merchant of record.
- **Value metrics:** monthly credits, credits consumed per action, data-row allowance, Enterprise contract. Sync cadence is user-selected and not a tier value metric.
- **Seats:** unlimited on every plan.
- **Feature gating:** none. Every feature is available on Free, Pro, and Enterprise.
- **Expansion:** credit-volume upgrades (5k → 10k → 25k → 50k → 100k), credit packs, auto-recharge, annual prepay, Enterprise contracts.
- **Entitlements:** only capacity guardrails and RBAC remain. CMO read-only and the intended CMO exclusion from data models are access-control rules, not pricing gates. The data-model exclusion is currently enforced mainly by the frontend route guard.
- **Credit rules:** monthly grants; Free does not roll over; Pro rolls over; packs never expire; only successful runs should charge; failed runs release reservations.

### 6.2 Pricing and packaging

| Position | Price | Monthly credits | Data allowance | Sync cadence | Seats | Top-ups |
|---|---|---:|---|---|---|---|
| Free | $0 | 1,000 in first month (500 grant + 500 one-time bonus), then 500/month | 50k rows per data model (seeded; admin-configurable) | Manual/daily/weekly/hourly where supported | Unlimited | Not available |
| Pro 5k | $49/mo; $474/yr ($39.50/mo equivalent) | 5,000 | 5M rows per data model (seeded; admin-configurable) | Manual/daily/weekly/hourly where supported | Unlimited | Packs + auto-recharge |
| Pro 10k | $98/mo; $948/yr ($79/mo equivalent) | 10,000 | Same | Same | Unlimited | Packs + auto-recharge |
| Pro 25k | $245/mo; $2,370/yr ($197.50/mo equivalent) | 25,000 | Same | Same | Unlimited | Packs + auto-recharge |
| Pro 50k | $490/mo; $4,740/yr ($395/mo equivalent) | 50,000 | Same | Same | Unlimited | Packs + auto-recharge |
| Pro 100k | $980/mo; $9,480/yr ($790/mo equivalent) | 100,000 | Same | Same | Unlimited | Packs + auto-recharge |
| Enterprise | Custom | Custom (admin-managed; tier `credits_per_month = 0`) | Custom | Custom | Unlimited | Custom |

**Credit packs (Pro only):**

| Pack | Price | Effective price per credit | Rollover |
|---|---:|---:|---|
| 1,000 credits | $9.00 | $0.0090 | Never expires |
| 5,000 credits | $40.00 | $0.0080 | Never expires |
| 10,000 credits | $70.00 | $0.0070 | Never expires |

**Per-action credit prices (seeded `dra_action_prices`):**

| Action | Credits | Charge mode | Banding |
|---|---:|---|---|
| Paid media plan build | 500 | Per action | Fixed |
| Plan chat Q&A | 2 | Per call | Fixed |
| Client presentation deck (PPTX) export | 50 | Per action | Fixed |
| Plan XLSX / ZIP pack export | 15 | Per action | Fixed |
| One-click AI model generation | 20 | Per action | Fixed |
| AI join suggestions | 5 | Per call | Fixed |
| Conversational modeler chat | 2 | Per call | Fixed |
| Model chat | 2 | Per call | Fixed |
| AI model analysis | 15 | Per action | Row band ×1/×2/×3 (15/30/60) |
| Data quality + AI remediation | 15 | Per action | Fixed |
| Ready-made AI analysis | 10 | Per action | Fixed |
| Budget optimizer run | 10 | Per action | Fixed |
| Attribution model run | 25 | Per action | Event band ×1/×2/×3 (25/50/75) |
| Generate AI insights | 5 | Per action | Fixed |
| Insights follow-up chat | 1 | Per call | Fixed |
| Report follow-up chat | 1 | Per call | Fixed |
| AI report generation | 15 | Per action | Row band ×1/×2/×3 (15/30/45) |
| Report PDF export | 5 | Per action | Fixed |
| AI-insight dashboard widget regenerate | 5 | Per action | Fixed |
| Auto-generated dashboard | 30 | Per action | Fixed |
| Web search grounding | 1 | Per call | Fixed |

**What works**

- The ladder is now trivially explainable: Free → Pro by credit volume → Enterprise by contract. No feature matrix, no seat math, no “which tier unlocks dashboards?” conversations.
- The Free plan is a genuine full-product trial: every feature, unlimited seats, 1,000 credits in month one. This is a much stronger activation story than the old Free/Starter gates.
- Pro at $49 for 5,000 credits matches Juma’s entry price and is far cheaper than measurement or data-platform alternatives. It is an easy self-serve entry point.
- Unlimited seats remove the old Starter solo cliff and make team adoption frictionless.
- Annual pricing at ~20% off improves cash flow and gives price-sensitive buyers a reason to commit.
- Packs and auto-recharge give Pro users a way to handle spikes without changing their base volume.
- The per-action table is a trust asset: buyers can estimate cost before signing up.
- The onboarding bonus (500 credits) is a smart activation tactic: it lets a new user build a plan and still export/analyse/chat about it.

**What does not work**

- **Pack economics undermine volume upgrades.** Packs are cheaper per credit than the monthly subscription. A Pro 5k user who needs 10k can buy a 5k pack for $40 instead of upgrading to 10k for $98. This is the single clearest revenue-architecture flaw.
- **Pro rollover is uncapped.** The code never expires unused Pro credits, so they accumulate indefinitely. This creates a usage liability and reduces the incentive to buy a larger monthly volume. Juma caps plan-credit rollover at one month and expires top-ups after 12 months.
- **Free cannot buy packs.** This protects the Pro upgrade path, but it also blocks a $9 impulse top-up from the highest-intent free users. Consider a small “first top-up” path or a time-boxed upgrade offer instead.
- **Spend controls are now live.** The 30-day remediation added 20%/10% low-balance email and in-app alerts, a hard workspace monthly spend cap, per-member limits for admins, and explicit saved-card auto-recharge consent with an off switch. This closes the main bill-shock and admin-control gap versus Juma.
- **The Free plan may be too generous for a solo user.** 500 credits/month is exactly one plan build, forever. A solo marketer can stay on Free indefinitely for one plan per month and never pay. That may be the right acquisition trade-off, but it should be tested against a 300- or 400-credit Free grant.
- **Enterprise is opaque.** Custom pricing is appropriate, but the value bridge from $980 to a custom contract needs a published “why” (SSO, private deployment, SLAs, onboarding, custom credits, support).
- **The data-allowance and sync-cadence copy has been simplified.** Pricing and policy pages no longer claim volume-scaled rows or hourly-at-25k; they describe a static per-plan row allowance and user-selected cadence. Implementing volume scaling remains a product decision, not a copy gap.
- **The credit-rate copy is aligned.** The pricing surfaces now say credits are “about 1 cent each” and note that exact rates vary by plan and pack, replacing the imprecise flat $0.01 anchor.

### 6.3 Willingness to pay and price positioning

| Alternative | Approx. monthly cost | What the buyer gets | DRA comparison |
|---|---:|---|---|
| Juma | $49 for 5,000 credits; 5k–100k volumes | AI marketing workspace, 700+ Flows, unlimited seats, no gates | DRA matches entry price and credit philosophy; DRA is deeper in paid media and measurement, narrower in content/SEO |
| Ad IQ | $49 | AI plan, no tracking | DRA Pro 5k is the same entry price but includes tracking and BI |
| Supermetrics | $44–$177 | Data extraction | DRA includes extraction + planning + BI in one credit pool |
| AgencyAnalytics | $20/client | Client reporting | DRA is cheaper for a single team, lacks client portal |
| Triple Whale | $219–$749 | DTC attribution + AI | DRA is cheaper but less causal/pixel-deep |
| Northbeam | $1,500–$3,500 | MTA/MMM | DRA is far cheaper, not a measurement-science replacement |
| Funnel.io | $300–$600 | Data hub | DRA is cheaper, narrower connectors |
| Uptempo | ~$2,000+ | Enterprise planning | DRA is cheaper, less finance-grade |
| Recast | ~$2,000–$8,000 | MMM | Different job; DRA does not compete on causal modeling |

**Interpretation:** DRA is priced as a productivity/operating tool, not as a measurement platform. That is the right initial strategy: it lowers the barrier to entry and avoids direct comparison with $1,500+/mo attribution vendors. The risk is under-monetizing the plan-to-actual loop, which is the most valuable part. A Pro 10k–25k plan at $98–$245 that replaces a $300 data tool, a $200 reporting tool, and a strategy cycle is a strong value story; the company should quantify that in sales. But the pack arbitrage and uncapped rollover make it too easy for customers to pay less than the value they receive.

### 6.4 Illustrative unit economics

The following is a model, not actual company data. It uses the calibrated P90 AI costs from `documentation/credit-pricing-calibration.json` (5 days of data, 1 organization, 1 model) and an assumed 85% gross margin after infrastructure, payment fees, and support.

**Revenue per action at different credit prices:**

| Price basis | Revenue per credit | Plan build (500 cr) | AI analysis (10 cr) | Join inference (5 cr) | Search grounding (1 cr) |
|---|---:|---:|---:|---:|---:|
| Pro monthly ($9.80/1k) | $0.0098 | $4.90 | $0.098 | $0.049 | $0.0098 |
| Pro annual ($7.90/1k) | $0.0079 | $3.95 | $0.079 | $0.0395 | $0.0079 |
| 5k pack ($8.00/1k) | $0.0080 | $4.00 | $0.080 | $0.040 | $0.0080 |
| 10k pack ($7.00/1k) | $0.0070 | $3.50 | $0.070 | $0.035 | $0.0070 |

**Calibrated cost and gross margin per action:**

| Action | Credits | P90 AI cost | Revenue at monthly Pro | Gross margin at monthly Pro | Gross margin at annual Pro |
|---|---:|---:|---:|---:|---:|
| Plan build | 500 | $1.64 | $4.90 | $3.26 (67%) | $2.31 (58%) |
| AI analysis | 10 | $0.0255 | $0.098 | $0.0725 (74%) | $0.0535 (68%) |
| Join inference | 5 | $0.0088 | $0.049 | $0.0402 (82%) | $0.0307 (78%) |
| Search grounding | 1 | $0.0021 | $0.0098 | $0.0077 (79%) | $0.0058 (73%) |

**Interpretation**

- Plan builds are the margin anchor and the main cost risk. At monthly Pro pricing the gross margin is healthy (~67%) before infrastructure, but at annual pricing it falls to ~58%, and at 10k-pack pricing to ~53%. If the plan-build P90 cost doubles to ~$3.28, the annual margin drops to ~17%. The calibration sample is too thin to treat the current price as settled.
- Other actions have very high margins. The business is effectively “one expensive flagship action plus a long tail of cheap AI actions.”
- The flagship price (500 credits) was raised from the provisional 150 because the observed P90 cost was $1.64 and 150 credits ($1.50) was below cost. That was the right call, but it was based on four successful builds. Re-run calibration monthly for the first 90 days and do not change prices on noise.
- Free-tier subsidy is manageable only if conversion is decent. If every Free workspace uses its full 500-credit grant, the AI cost is ~$1.64/month per workspace, plus infrastructure. The first month is ~$3.28 because of the onboarding bonus. At 1,000 free workspaces that is ~$1,640/month in AI cost; at a 5% conversion to $49 Pro, the gross profit from 50 conversions is ~$2,080, leaving little after infrastructure. At 10% conversion, the economics improve materially. Free-tier generosity and conversion rate are therefore linked.
- The blended ARPA is lower than the old tier model and more sensitive to mix. A Pro-only mix lands around **$147/month**; a mix with 5% Enterprise lands around **$248/month**. Enterprise is a large share of revenue even at a small logo share.

**Illustrative ARPA mixes:**

| Mix | 5k | 10k | 25k | 50k | 100k | Enterprise | Blended ARPA |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pro-only | 45% | 30% | 15% | 8% | 2% | 0% | **$147** |
| With Enterprise | 45% | 28% | 14% | 8% | 0% | 5% | **$248** |

**CAC payback and LTV (illustrative, 3% monthly churn):**

| Metric | Pro-only ARPA | Blended ARPA |
|---|---:|---:|
| Gross profit per account (85% margin) | ~$125/mo | ~$211/mo |
| CAC (assumed) | $600–$1,500 | $600–$1,500 |
| CAC payback | 4.8–12.0 months | 2.8–7.1 months |
| LTV at 3% monthly churn | ~$4,167 | ~$7,033 |
| LTV/CAC | 2.8x–6.9x | 4.7x–11.7x |

These ratios are healthy on paper, but the Pro-only case is much tighter than the old model. The real constraints are activation, credit utilization, and churn, not gross margin. If activation is weak, CAC rises; if credit pricing feels unfair or plans are inconsistent, churn rises. Both are product problems, not pricing problems.

### 6.5 Illustrative revenue scenarios

Assumed paid-customer mix: 45% Pro 5k, 30% Pro 10k, 15% Pro 25k, 8% Pro 50k, 2% Pro 100k. The blended column adds a 5% Enterprise mix (45/28/14/8/0/5). Annual pricing ignored for simplicity.

| Paid customers | Pro-only MRR | Pro-only ARR | Blended MRR | Blended ARR |
|---:|---:|---:|---:|---:|
| 100 | $14,700 | ~$176k | $24,794 | ~$298k |
| 500 | $73,500 | ~$882k | $123,970 | ~$1.49M |
| 2,000 | $294,000 | ~$3.53M | $495,880 | ~$5.95M |
| 5,000 | $735,000 | ~$8.82M | $1.24M | ~$14.9M |

The model shows why the mid-market mix matters: Enterprise is only 5% of logos but roughly half of revenue at the 100-customer stage. A viable path can be built on Pro alone, but the fastest ARR path requires a credible Enterprise motion once compliance is ready. It also shows that the old $129/$399 tiers produced higher ARPA at the same logo count; the credit model trades ARPA for lower friction and broader adoption. That trade is reasonable only if conversion and credit utilization are strong.

### 6.6 Expansion and net revenue retention levers

1. **Credit-volume upgrades:** 5k → 10k → 25k → 50k → 100k. This is the primary expansion lever, but it is currently undermined by cheaper packs.
2. **Credit packs:** handle spikes and seasonal demand. Price them at or above the subscription per-credit rate, or restrict them to a top-up ceiling, so they do not cannibalize upgrades.
3. **Auto-recharge:** convenience and involuntary-churn protection. Pair it with a hard monthly cap and clear consent.
4. **Annual prepay:** ~20% discount improves cash flow; use it to lock in 10k–100k customers.
5. **Data-allowance upgrades:** row allowance is currently a static per-tier field (50k Free, 5M Pro), not scaled by credit volume. If volume-scaled allowances are implemented later, this becomes a real expansion lever for data-heavy buyers; the copy no longer promises it.
6. **Agency packaging:** pooled credits, unlimited seats, multiple client workspaces, branded client portal, per-client reporting. Price at 25k–100k credits.
7. **White-label client portal:** a paid add-on or Pro/Enterprise feature; directly competes with AgencyAnalytics/Whatagraph on their core use case.
8. **Enterprise contracts:** SSO, private deployment, SLAs, custom credits, onboarding services.
9. **Onboarding/services:** productized onboarding for 25k+ and Enterprise ($1,500–$10,000); improves activation and expands ACV.
10. **Referral credits:** Juma uses referral credits; DRA has no referral program. A small credit referral bonus can lower CAC.
11. **Low-balance and upgrade nudges:** email/in-app alerts at 20%/10% balance, “you are close to your monthly volume”, and “a pack is cheaper than upgrading” (only if intentional).
12. **Promo codes:** keep for launches and win-backs, but measure redemption and credit grant cost.

### 6.7 Go-to-market motion

**Current motion:** content/SEO → problem landing pages → guest plan or Free signup → credit estimator → Paddle checkout → Pro. Sales-assisted Enterprise via contact form.

**Strengths**

- Website-first product experience matches the core promise.
- Guest plan is a differentiated, low-friction top of funnel.
- Seven problem pages target specific, high-intent pains.
- The Free plan is now a full-product trial, which is a stronger wedge than a gated free tier.
- The credit estimator and per-action price table reduce pricing friction.
- Email funnels and lead magnets are already instrumented.
- Transparent public pricing reduces sales friction for SMB and mid-market.

**Gaps**

- No case studies, customer logos, or third-party reviews.
- No comparison pages against Juma, Ad IQ, Draper, AgencyAnalytics, Supermetrics, or Northbeam.
- No agency partner program or directory presence.
- No outbound motion for 25k+ and Enterprise.
- No credit-lifecycle email program (welcome, first plan, low balance, upgrade, rollover).
- The site rarely shows the actual plan output; buyers cannot see quality before signing up.
- No in-app spend caps or low-balance warnings, which makes the usage-based model feel riskier than it needs to.
- Enterprise sales collateral does not explain the credit model or the custom-credit process.

**Recommended motion:** product-led growth for Free/Pro, product-led sales for 25k+ (in-app upgrade + founder-assisted demo), partner-led for agencies, and Enterprise only after SOC 2 and references exist. Add a credit-health onboarding sequence: show the balance, explain what a plan costs, show the estimator, and warn before exhaustion.

### 6.8 Moat assessment

| Moat | Current strength | Potential | Notes |
|---|---|---|---|
| Workflow integration | Medium | High | Plan → launch → measure is hard to replicate end-to-end |
| Credit ledger and cost calibration | Medium | High | Operational IP and proprietary cost data; hard to copy well |
| Proprietary benchmarks | Low | High | Requires outcome volume and data rights |
| Skill-pack IP | Medium | Medium | Copyable, but domain contracts take time |
| Open-source community | Low-medium | Medium | Distribution and trust; also limits pricing power |
| Switching costs | Medium | High | Grows with connected data, models, targets, and credit balance |
| Brand | Low | Medium | No visible proof assets yet |
| Enterprise trust | Low | High | SOC 2, references, SLAs are prerequisites |

### 6.9 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Credit metering regresses to fail-open | Low | High | Fail-closed gates implemented 2026-11-02; keep regression tests and monitor the ledger reconciliation endpoint |
| Plan-build margin mis-calibrated | Medium | High | Re-run calibration monthly; use P90 by model; add cost guardrails |
| Pack arbitrage cannibalizes upgrades | High | Medium | Reprice packs at/above subscription per-credit, or cap pack volume |
| Uncapped rollover liability | Medium | Medium | Cap Pro rollover (e.g., one month) and pack expiry (e.g., 12 months) or price unlimited rollover |
| Bill shock / credit anxiety | Medium | Medium | Implemented: 20%/10% alerts, workspace spend cap, per-member limits, auto-recharge consent; keep the estimator visible |
| Free credit farming | Medium | Medium | Identity/rate limits, device/IP signals, onboarding bonus per verified org |
| Free tier too generous | Medium | High | Test 300/400/500 credit grants; time-box the onboarding bonus |
| Row/sync claims not implemented | Low | Medium | Copy now describes a static plan allowance and user-selected cadence; volume-scaled rows remain an optional 90-day lever |
| `CREDITS_ENABLED` off in production | Low | High | Default true; startup warning; `/admin/credits/reconciliation` compares the ledger to `ai_call_logs` |
| Pack refunds not reversed | Low | Medium | Implemented: resolve the original purchase, reverse wallet credits idempotently, record both ledgers |
| Auto-recharge saved-card failure | Medium | High | Sandbox-validate; fallback to checkout; clear consent and caps |
| Enterprise deals blocked by compliance | High | High | SOC 2 Type I/II, DPA, security page, references |
| Connector breakage | Medium | High | Monitoring, alerting, fallback syncs, status page |
| Price compression from Juma/AI plan tools | High | Medium | Emphasize tracking loop and ROI proof, not plan generation alone |
| Open-source cloning | Medium | Medium | Compete on hosted reliability, data, brand, enterprise features |
| Churn after plan export | Medium | High | Make tracking the default next step; gate/share outcomes |
| Over-broad positioning | High | Medium | Narrow to paid-media operating system for mid-market |
| Dependency on Gemini/Paddle | Medium | Medium | Abstraction layer, multi-model option, payment fallback |
| Support burden from credit disputes | Medium | Medium | Clear ledger, refund policy, admin adjustments, self-serve usage view |
| Stale internal documentation | Low | Medium | Updated 2026-11-02 across FEATURES, billing architecture, architecture index, data/RBAC docs, comprehensive architecture, and use-cases; keep docs in sync with future credit changes |

---

## 7. Strategic recommendations

### 7.1 Next 30 days — fix metering and trust blockers (implemented 2026-11-02)

All nine items below are implemented and covered by regression tests. This table is the status of record; §7.2 covers the remaining 90-day commercial work.

| # | Recommendation | Status | Implementation |
|---|---|---|---|
| 1 | Make plan-build credits fail-closed | **Implemented** | `ensureCanAfford('plan_build')` before creation; `ensureReserved` before start/resume and before the running status is persisted; `reconcilePlanCredits` rethrows credit errors; 402 payload with `upgradeUrl`; plan modal CTA. |
| 2 | Make per-call metering fail-closed or pre-authorized | **Implemented** | `AICallTrackerService.authorizePerCall` runs before chat, grounding, and join-inference calls; zero-balance workspaces are blocked before the model request; 402 handling in plan chat and AI modeler. |
| 3 | Fix guest claim metering | **Implemented** | Guest builds remain unmetered because no wallet exists yet. At claim, the monthly grant is applied and a 500-credit `plan_build` hold must succeed before the plan is attached; unfunded claims return 402; the hold settles on completion or releases on failure. |
| 4 | Fix pack refund reconciliation | **Implemented** | Paddle `adjustment` events resolve the org from the original transaction, call `reversePurchase` idempotently on the adjustment id, and write both the financial and credit ledger entries. |
| 5 | Align pricing and policy copy | **Implemented** | “About 1 cent” replaces the flat $0.01 claim; Free/pack cancellation and refund language now states packs stay usable on Free while Free cannot buy new packs. |
| 6 | Add low-balance and spend-control features | **Implemented** | 20%/10% email and in-app alerts; hard workspace monthly spend cap; per-member limits with admin APIs; explicit auto-recharge consent and an off switch. Per-member limits are enforced for attributed spend (AI calls and plan builds); broader reservation attribution is a follow-up. |
| 7 | Verify `CREDITS_ENABLED` per environment | **Implemented** | `.env.example` defaults to `true`; startup logs a launch-blocking warning when off; `GET /admin/credits/reconciliation?month=YYYY-MM` compares per-call ledger charges with `ai_call_logs`. |
| 8 | Instrument the credit funnel | **Implemented** | Events for grant, first consumption, plan build, settled export/analysis actions, exhaustion, pack purchase, volume upgrade, and rollover. |
| 9 | Add regression tests | **Implemented** | `CreditWalletService` suite covers insufficient-credit plan builds, per-call zero balance, guest claim reservations, spend caps, pack refunds, idempotency, and rollover (26 tests passing). |

### 7.2 Next 90 days — fix packaging economics and prove the loop

1. **Reprice credit packs** at or above the subscription per-credit rate, or restrict packs to a top-up ceiling. Test whether volume upgrades or packs become the dominant expansion path.
2. **Cap Pro rollover** at one month (Juma parity) and set a pack expiry (e.g., 12 months), or explicitly price “unlimited rollover” as a premium feature.
3. **Decide whether to implement volume-scaled data allowances.** The copy now describes the static per-tier allowance; credit-scaled rows remain an optional expansion lever.
4. **Decide whether to gate sync cadence by credit volume.** The copy now treats cadence as user-selected; gating it would require scheduler and channel-settings enforcement.
5. **Package an agency plan**: pooled credits, unlimited seats, multiple client workspaces, branded client portal, per-client reporting. Price at 25k–100k credits.
6. **Publish two or three sample plans** (anonymized) with artifacts, screenshots, and a short “how the AI researched this” narrative.
7. **Publish a plan-quality benchmark**: compare DRA plans against human-built plans on completeness, channel mix, budget rationale, and artifact readiness.
8. **Launch comparison pages**: DRA vs Juma, Ad IQ, Draper, AgencyAnalytics, Supermetrics, Northbeam (positioning, not feature wars).
9. **Add a credit estimator in-app** and label every action with its credit cost before the user runs it.
10. **Add annual prepay incentives** for 10k+ volumes.

### 7.3 Next 180 days — move upmarket deliberately

1. Start **SOC 2 Type I** and publish a security/trust page; target Type II within 12 months.
2. Add **SCIM**, audit-log UI, and data-residency options for Enterprise.
3. Add **incrementality-lite** (geo holdouts or pre/post tests) and a **forecasting/scenario** module; do not build a full MMM yet.
4. Add **Slack/Teams alerts** and **scheduled report delivery**.
5. Build an **agency partner program** with co-marketing, templates, and revenue share.
6. Publish **three customer case studies** with quantified outcomes (hours saved, spend reallocated, ROAS improvement, reporting time reduced).
7. Add **referral credits** and a simple partner/affiliate tracking surface.
8. Add **multi-model routing** or a cost-aware model selector to protect plan-build margin.

### 7.4 Pricing and packaging recommendations

| Change | Rationale | Expected effect |
|---|---|---|
| Make plan-build metering fail-closed | Done 2026-11-02: the flagship action is fail-closed at zero balance | Protect margin; restore trust in the credit model |
| Reprice packs above subscription per-credit | Open (90-day): packs currently cannibalize volume upgrades | Higher expansion revenue; clearer upgrade path |
| Cap Pro rollover / set pack expiry | Open (90-day): uncapped rollover creates a usage liability | Better revenue recognition; more upgrade pressure |
| Test Free at 300/400/500 credits | Open: 500/month is one plan forever; may cannibalize Pro | Higher Free→Pro conversion; lower free subsidy |
| Add spend caps, low-balance alerts, per-member limits | Done 2026-11-02 | Lower bill shock; better retention |
| Add agency packaging | Open (90-day): unlimited seats help, but no client portal | New segment, higher ACV |
| Publish exact effective credit rates | Done 2026-11-02: copy says “about 1 cent each” | Better price perception; fewer support questions |
| Implement volume-scaled rows/cadence or fix copy | Done 2026-11-02: copy now matches the static allowance and user-selected cadence | Credibility; fewer refunds/disputes |
| Keep annual ~20% discount | Standard SaaS expectation; improves cash | Higher annual mix; lower churn |
| Keep Enterprise custom | SSO, private deployment, SLAs, custom credits | Upmarket path without feature gates |
| Do not reintroduce feature gates | The un-gated model is a core differentiator | Preserve simplicity and adoption |

Rows marked Done were completed on 2026-11-02; the remaining rows are the 90-day commercial agenda.

### 7.5 GTM recommendations

- **Positioning:** “The AI paid-media operating system: plan, launch, prove. Every tool included; pay for the work that runs.” Retire “data research analysis” as the primary category in marketing copy; keep it as the company name.
- **Beachhead:** mid-market B2B SaaS and considered-purchase B2C, 3–30 marketers, $50k–$1M/mo paid spend.
- **Wedge:** guest plan + Free 1,000 first-month credits + sample plan audit; convert on the promise of the full media plan and deck.
- **Proof:** case studies, plan-quality benchmark, customer logos, G2/Capterra reviews, security page.
- **Channels:** SEO problem pages (existing), comparison pages, LinkedIn thought leadership, webinars with fractional CMOs, agency partnerships, open-source community.
- **Sales:** product-led for Free/Pro; product-led sales for 25k+; founder-assisted Enterprise only after compliance readiness.
- **Credit lifecycle:** onboarding email sequence that explains credits, shows the estimator, warns at 20%/10%, and offers a pack or volume upgrade at the right moment.
- **Agency:** lead with unlimited seats and pooled credits; add a client portal before competing head-on with AgencyAnalytics/Whatagraph.

### 7.6 Metrics to manage

| Metric | Why it matters | Target direction |
|---|---|---|
| Guest → registered | Top-of-funnel quality | Increase |
| Registered → first full plan | Activation | Increase |
| First plan → first export/analysis | Realization of value | Increase |
| Free → paid | Monetization | Increase |
| Credit utilization (consumed / granted) | Pricing fit and value realization | Track by cohort |
| Credit exhaustion rate | Whether the plan is too small or too large | Optimize |
| Pack attach rate | Top-up behavior and cannibalization | Track; watch upgrade substitution |
| Auto-recharge adoption | Convenience and involuntary churn | Increase, with caps |
| ARPA by credit volume | Packaging health | Increase |
| Gross margin per action | Margin safety | Keep plan build >50% |
| AI cost per plan build | Unit economics | Track; keep below credit revenue |
| Credit leakage (unbilled actions) | Metering integrity | Drive to zero |
| Plan build completion rate | AI reliability | >80% |
| Time to first plan | Time-to-value | Decrease |
| Logo churn | Product-market fit | <3%/mo |
| Net revenue retention | Expansion | >100% |
| CAC payback | GTM efficiency | <12 months |
| Plan quality score | Trust | Establish and improve |
| Refund/chargeback rate | Trust and billing correctness | Keep low |

---

## 8. Open questions and data needed

1. What is the actual distribution of monthly credit consumption per org, and how many orgs hit 500, 5,000, 10,000, 25,000, and 100,000 credits?
2. What is the real AI cost per action after 60–90 days, by model and by action band? Is the plan-build P90 still ~$1.64?
3. What is the Free → Pro conversion rate, and does the 500-credit/month grant cannibalize Pro?
4. Do Pro customers expand by increasing monthly volume or by buying packs? If packs dominate, the upgrade ladder is broken.
5. How much unused Pro credit accumulates, and what is the deferred-usage liability?
6. Which actions are most used, and what is the remaining unbilled-action rate after the fail-closed rollout?
7. Do users publish plans and track actuals, or mostly export decks? The answer determines whether the moat is real.
8. What is the agency demand for a client portal, per-client workspaces, and branded reporting?
9. What compliance requirements appear most often in enterprise RFPs?
10. How accurate are plan recommendations versus actual outcomes? This is the core proof asset.
11. Did removing feature gates improve conversion and retention, or simply lower ARPA?
12. What is the auto-recharge conversion, involuntary-churn impact, and refund/chargeback rate under credits?

---

## Appendix A — Evidence base

**Code and documentation reviewed**

- `documentation/FEATURES.md` — feature inventory and status (note: still describes the old tier ladder and feature gates; needs refresh).
- `documentation/architecture/00-system-overview.md` — product context and stack.
- `documentation/architecture/05-billing-subscription.md` — billing lifecycle and legacy tier documentation (note: still describes the old tiers; needs refresh).
- `documentation/architecture/06-ai-plan-studio.md` — 18-step pipeline, 18 skill packs, artifacts, execution, guest plans.
- `documentation/use-cases/USE-CASES-MASTER.md` — actors, business rules, use cases.
- `documentation/credit-pricing-implementation-plan.md` — target credit model, action-price table, phases, rollout, risks.
- `documentation/credit-pricing-calibration.json` — Phase 0 cost calibration (5 days, 1 org, 1 model).
- `backend/src/migrations/1797000000000-CreateCreditLedger.ts` — wallet, ledger, packs, action prices, `ai_call_logs.credits_consumed`.
- `backend/src/migrations/1798000000000-AddTierCreditAllowance.ts` — tier credit allowances and rollover flags.
- `backend/src/migrations/1799000000000-AddVariableCreditPro.ts` — variable-credit Pro fields.
- `backend/src/migrations/1799001000000-DropLegacyTierLimits.ts` — removal of project/channel/model/dashboard/member/AI/plan limits.
- `backend/src/migrations/1800000000000-DropTierFeatureGates.ts` — removal of feature gates.
- `backend/src/migrations/1800000001000-AddMonthlyCreditTracking.ts` — monthly-pool tracking.
- `backend/src/migrations/1800000002000-BackfillProCreditOverrides.ts` — legacy paid-subscription backfill.
- `backend/src/migrations/1800000006000-ReconcileCreditTiers.ts` — reconciles Free/Pro allowances and retires unused Starter/Professional Plus tiers.
- `backend/src/models/DRACreditWallet.ts`, `DRACreditTransaction.ts`, `DRACreditPack.ts`, `DRAActionPrice.ts`, `DRASubscriptionTier.ts`.
- `backend/src/services/CreditWalletService.ts` — grants, consumption, reservations, purchases, refunds, rollover, onboarding bonus.
- `backend/src/services/TierEnforcementService.ts` and `backend/src/middleware/tierEnforcement.ts` — remaining allowances.
- `backend/src/services/RowLimitService.ts` — static row allowance lookup; enforced client-side in the model builder.
- `backend/src/services/AICallTrackerService.ts` — per-call metering and fail-open behavior.
- `backend/src/services/PaidMediaPlanService.ts` — plan-build reserve/settle/release and fail-open behavior.
- `backend/src/processors/GuestPlanProcessor.ts` — guest claim and credit charge.
- `backend/src/processors/PaidMediaPlanProcessor.ts` — plan start, exports, deck metering.
- `backend/src/processors/SubscriptionProcessor.ts` — variable-credit subscription, downgrade, monthly grant.
- `backend/src/processors/CreditCheckoutService.ts` — pack purchase, auto-recharge, Pro-only checks.
- `backend/src/routes/credits.ts`, `backend/src/routes/admin/credits.ts`, `backend/src/routes/paddle-webhook.ts`.
- `backend/src/jobs/creditRolloverJob.ts` — monthly grant/rollover job.
- `backend/src/seeders/06-20260108-SubscriptionTierSeeder.ts`, `backend/src/seeders/09-20260405-PaddlePriceIdSeeder.ts` — Free/Professional/Enterprise tier seed and legacy Paddle price fallback.
- `frontend/components/pricing-section.vue`, `frontend/components/CreditPricingPlans.vue`, `frontend/pages/pricing.vue`.
- `frontend/components/CreditWalletPanel.vue`, `frontend/pages/billing/index.vue`, `frontend/pages/admin/credits.vue`.
- `frontend/pages/terms-conditions.vue`, `return-refund-policy.vue`, `cancellation-policy.vue`, `privacy-policy.vue`.
- `frontend/middleware/04-project-role.global.ts` — CMO/analyst/manager route guards.
- `frontend/pages/*` — seven problem landing pages, homepage, guest plan CTA.

**External sources (accessed 2026-10-22; refreshed 2026-11-01)**

- Juma pricing, credits, and FAQ pages, Nov 2026: credit-based pricing, $49/mo for 5,000 credits, free 300 credits/user, unlimited seats, no feature gates, top-ups, auto-recharge, rollover rules.
- Mordor Intelligence, marketing analytics market, Jul 2026 (re-checked Nov 2026): $8.02B in 2026, $14.55B by 2031, 12.65% CAGR.
- The Business Research Company, marketing analytics market, Sep 2026 (re-checked Nov 2026): $7.24B in 2026, $13.47B by 2030, 16.8% CAGR.
- Coherent Market Insights, marketing analytics software market, Apr 2026.
- PW Consulting, marketing planning software market, Jun 2026.
- Gartner, 2026 CMO Spend Survey and related press releases, May–Jun 2026.
- Vendor pricing pages and comparisons: Supermetrics, Funnel.io, Improvado, Adverity, AgencyAnalytics, Whatagraph, Northbeam, Triple Whale, Recast, Measured, Uptempo/Allocadia, Juma, Ad IQ, Draper, Medusa, Accelerate, TurboAgents (various dates, Aug–Nov 2026).

**Caveats**

- External pricing is volatile; verify before quoting in sales or investor materials.
- Market-size estimates differ by definition; use ranges, not a single number.
- Unit economics and revenue scenarios are illustrative models, not company actuals. The credit-cost calibration is based on five days of data from one organization and one model; treat the plan-build margin as provisional.
- Feature claims reflect the repository state on 2026-11-02. Production flags (`CREDITS_ENABLED`), environment configuration, and actual Paddle products may differ; verify before external use.
- The credit model is implemented and the 30-day fail-closed remediation is in place. Remaining commercial risks are pack economics, uncapped rollover, plan-build margin calibration, and the legacy billing defects; the document calls these out explicitly rather than assuming the public promise is fully enforced.
