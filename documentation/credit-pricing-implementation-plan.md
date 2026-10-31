# Credit-Based Pricing Implementation Plan

Status: Phases 0–4 complete (calibration, ledger/service/metering, Paddle packs+checkout+webhook+auto-recharge, gate removal, frontend pricing/billing/legal) — verified (typecheck, migrations applied, smoke tests, Paddle sandbox product/price validation, Nuxt builds). Phase 5 complete: tier credit allowances + rollover-aware `grantMonthly` (mid-month plan-change re-grant, concurrency-safe monthly-pool expiry that preserves pack credits), webhook monthly-grant wiring, daily `CreditRolloverJob` (calendar-month grants for Free/Pro/annual), automatic low-balance auto-recharge trigger (in-flight guarded), guest-plan claim metering + post-claim balance notice, variable-credit Pro price IDs synced onto the Pro tier (`paddle_credits_unit_price_id_monthly/_annual`), legacy paid-subscription override backfill, admin credit console (`/admin/credits`: wallets/ledger, action prices, packs, grants/adjustments/recharge/sync), org-mode credit pricing on `/pricing?orgId=…` (volume slider, mid-cycle Paddle quantity updates, checkout for new Pro subscriptions) with `/pricing` now a public route, policy-compliant Pro→Free downgrades (scheduled at period end via Paddle `next_billing_period`; hourly expiry job switches to Free, expires the Pro monthly pool and preserves pack credits), and `CreditWalletService` unit tests. Remaining (operational): sandbox saved-card auto-recharge run + webhook loop after container rebuild, production grandfathering/announcement, and flipping `CREDITS_ENABLED=true` per environment.
Last updated: 2026-10-30
Scope: Migration from tier-gated subscription pricing to Juma-style credit pricing (one product, no feature gates, unlimited seats, credits pooled at workspace level).

---

## 1. Target model (decided)

Adopt the Juma.ai pricing philosophy:

- **One product. Zero feature gates.** Advanced tools (data models, dashboards, reports, AI insights) are available on every plan, including Free. Free vs paid differ only by credit volume.
- **Unlimited seats on every plan.** Credits are pooled at the workspace (org) level. No per-seat pricing.
- **Free tier** = monthly credit grant (500 credits) so the guest-plan funnel and first plan build (500 cr) still work.
- **Pro** = one card with a credit-volume slider (5,000 → 100,000 credits/month), plus top-up packs and auto-recharge.
- **Only successful runs charge.** Failed AI runs consume 0 credits.
- **Data allowance scales with credit volume** (rows), and sync/refresh cadence scales with plan size. These are capacity allowances, not feature gates.
- **Enterprise** = custom (SSO, private deployment, contracts, SLA). This is a procurement tier, not a feature gate.

Guiding rule for the whole classification:

1. **FREE (never credits):** user labor (manual building/editing/configuring) and read-only consumption (viewing, querying, public links).
2. **CREDITS (discrete, user-triggered, real marginal cost):** AI generation and compute-heavy runs (plan builds, AI analysis, model analysis, attribution, exports).
3. **TIER/ALLOWANCE (continuous capacity, never credits):** rows, sync cadence, channel counts, seats (unlimited).

### 1.1 Action → credit table (provisional; calibrate in Phase 0)

1 credit = $0.01. Prices are value-banded (raw-cost floor × margin factor), rounded to clean numbers. Marked **(c)** = calibrated from `ai_call_logs` (Phase 0, 2026-10-29); everything else is provisional until 2–3 months of data accumulate.

| Action | Feature key / surface | Decision | Provisional credits | Calibrated |
|---|---|---|---|---|
| Paid media plan build (18 steps) | `plan_build` | CREDITS | 150 | **500 (c)** |
| Plan chat Q&A | `plan_chat` | CREDITS | 2 | 2–5 (no data) |
| Deck PPTX export | plan deliverables | CREDITS | 50 | 50 (no data) |
| XLSX / ZIP pack export | plan deliverables | CREDITS | 10–20 | 10–20 (no data) |
| Guest plan build | `plan_build` (guest) | CREDITS (free grant covers) | 150 | 500 (c) |
| One-click AI model generation | AI Data Modeler | CREDITS | 20 | 20 (no data) |
| AI join suggestions | `join_inference` | CREDITS | 10 | **5 (c)** |
| Conversational modeler / model chat | `data_modeler_chat`, `data_model_chat` | CREDITS | 2/msg | 2/msg (no data) |
| AI model analysis | `data_model_analysis` | CREDITS (row-banded ×1/×2/×3) | 15 / 30 / 60 | 15 / 30 / 60 (no data) |
| Data quality + AI remediation | data quality service | CREDITS | 10–20 | 10–20 (no data) |
| Ready-made AI analysis | `ai_analysis` | CREDITS | 10 | **10 (c)** |
| Budget optimizer run | `budget_optimization` | CREDITS | 10 | 10 (no data) |
| Attribution model run | `attribution` | CREDITS (event-banded) | 25 | 25 (no data) |
| Generate AI insights | `ai_insights_generate` | CREDITS | 5 | 5 (no data) |
| Insights / report follow-up chat | `ai_insights_chat`, `ai_insights_report_chat` | CREDITS | 1 | 1–2 (no data) |
| AI report generation | report builder | CREDITS | 10–20 | 10–20 (no data) |
| AI-insight dashboard widget regenerate | `dashboard_widget_spec` | CREDITS | 5 | 5 (no data) |
| Auto-generated dashboard | `dashboard_auto_generate` | CREDITS | 30 | 30 (no data) |
| PDF export | reports | CREDITS | 5 | 5 (no data) |
| Web search grounding | `search_grounding` | CREDITS | 3 | **1 (c)** |
| Anomaly / performance alerts (background) | `anomaly_detection` | ALLOWANCE (cadence by plan) | — | — |
| Manual dashboard / report / model building | — | FREE | — | — |
| Viewing, queries, public links | — | FREE | — | — |
| Connect channel (OAuth) | — | FREE | — | — |
| Scheduled syncs / refreshes | — | ALLOWANCE (cadence by plan) | — | — |
| Row storage (materialized) | — | ALLOWANCE (5M / 100M / ∞ equivalents) | — | — |
| Engineering connectors | — | FREE (all plans) | — | — |

Banding rule (only where cost scales with data): model analysis, attribution, and AI report generation use row/event size bands. Everything else is a fixed price per deliverable, priced at the P90 real cost so variance is absorbed.

### 1.2 Plan positions

| Position | Monthly credits | Data allowance (rows) | Sync cadence |
|---|---|---|---|
| Free | 500 | ~100k | daily |
| Pro 5k | 5,000 | ~1M | daily |
| Pro 10k | 10,000 | ~2M | daily |
| Pro 25k | 25,000 | ~5M | hourly |
| Pro 50k | 50,000 | ~25M | hourly |
| Pro 100k | 100,000 | ~100M | hourly |
| Enterprise | custom | custom | custom |

Free credits reset monthly. Pro monthly credits reset monthly; **purchased top-up packs roll over** (permanent until used). Pro subscription credits may also roll over (decision in Phase 0 — Juma rolls Pro credits over).

---

## 2. Phase 0 — Price calibration (do first, everything depends on it)

1. Pull real cost-per-action distributions from `ai_call_logs` (already live; has `feature_key`, `action_id`, `cost_usd`, `status`, `org_id`, `created_at`).
2. Compute per feature: count, mean, P50, P90 cost per action over the last 2–3 months. Exclude `status != success`.
3. For banded actions (model analysis, attribution, AI report gen): split by model row/event size band and compute P90 per band.
4. Set each credit price = `P90 cost × 3–5` margin factor, rounded to clean numbers, sanity-checked against the Juma reference (~$49/5,000 credits ≈ $0.0098/credit; 100–500 credit deliverables).
5. Verify total org economics: median agency (assume 5–20 plan builds + analyses/month) should land in Pro 5k–25k, not below Free or above 100k.
6. Decide: Pro credit rollover (recommend yes, Juma parity), pack sizes/prices, auto-recharge threshold defaults, free grant size.
7. Write results into the action table (§1.1) and the credit pack catalog (§4).

### 2.1 Phase 0 results (2026-10-29)

Tool: `backend/scripts/credit-price-calibration.ts` (npm run `calibrate:credits`) — computes per-action cost distributions from `ai_call_logs`, writes `documentation/credit-pricing-calibration.json`.

**Coverage caveat — data is thin.** Instrumentation went live 2026-10-24, so the current window is only 5 days: 491 successful calls, $4.92 total, **1 org, 1 model (gemini-2.5-flash)**, 4 features. Numbers below are the best available floor, but the margin rule and clean rounding absorb the sample error; re-run monthly and ratchet prices only when distributions shift materially (change nothing for the first 60–90 days).

| Feature | Actions | Mean $ | P50 $ | P90 $ | Max $ | P90 ×3 | P90 ×5 | Set credits |
|---|---|---|---|---|---|---|---|---|
| `plan_build` | 4 | 1.1898 | 1.1066 | 1.6413 | 1.6413 | 492 | 821 | **500** |
| `ai_analysis` | 1 | 0.0255 | 0.0255 | 0.0255 | 0.0255 | 8 | 13 | **10** |
| `join_inference` | 1 | 0.0088 | 0.0088 | 0.0088 | 0.0088 | 3 | 4 | **5** |
| `search_grounding` | 97 | 0.0013 | 0.0013 | 0.0021 | 0.0042 | 1 | 1 | **1** |

Notes:

- **`plan_build` 150 → 500 is the single biggest change.** The provisional 150 cr ($1.50) was *below* the observed P90 cost ($1.64) — the flagship action was mispriced. At 500 cr (~$5.00) an agency doing 5–20 builds/month lands at 2,500–10,000 cr → Pro 5k–10k, inside the target band. Guest funnel preserved: the Free grant rises to 500 cr (exactly one build + light usage).
- **`search_grounding` 3 → 1.** Observed cost is ~$0.001–0.004/call; 1 cr ($0.01) is ≥ ×2.4 of the max observed cost.
- **Banding:** no data yet for `data_model_analysis` / `attribution` / AI report gen — provisional band tables stand until those features log volume. The script supports `--bands` (token-banded P90, a proxy for row/event size) and showed a 1.9× spread between smallest and largest plan builds, confirming fixed-price + reserve/release is the right shape for plan builds.
- **Org economics:** the one active org spent $4.76 over 5 days (~$28.5/mo raw AI cost). At the locked prices with ×3–5 margin that is ~$86–143/mo credit value (≈ 8.6k–14.3k credits) → Pro 10k–25k. Consistent with the target.

Phase 0 decisions (locked):

- **Pro monthly credits roll over** (Juma parity). Purchased packs roll over permanently. Free grant resets monthly and does not roll over.
- **Credit packs:** 1,000 cr / $9, 5,000 cr / $40, 10,000 cr / $70 (≈ $0.009/credit, in line with the $0.0098 Juma reference).
- **Auto-recharge default:** threshold = 25% of the monthly credit volume (min 250 cr), recharge to full volume using the smallest pack by default; user-editable threshold + pack.
- **Free grant:** 500 cr/month (one plan build + light usage; covers guest funnel).
- Re-run calibration monthly; hold prices for the first 60–90 days regardless of minor shifts.

---

## 3. Paddle settings (dashboard work)

### 3.1 Current state (to be replaced)

- 5 subscription products/tiers (Free, Starter, Professional, Professional Plus, Enterprise) with monthly + annual prices and a discount, synced via `/admin/paddle/sync` into `dra_subscription_tiers` (`paddle_product_id`, `paddle_price_id_monthly`, `paddle_price_id_annual`, `paddle_discount_id`).
- Webhooks already handle `subscription.*` and `transaction.*` events with HMAC verification.

### 3.2 New product/price structure

| Paddle product | Type | Prices |
|---|---|---|
| **Data Research Analysis — Pro** (subscription) | Recurring | One price per credit volume: 5k, 10k, 25k, 50k, 100k credits/mo. Monthly billing. Optional annual prices (−20%) if kept. |
| **Data Research Analysis — Credit Packs** (one-time) | One-time / non-recurring | Pack prices, e.g. 1,000 credits / $9, 5,000 / $40, 10,000 / $70. One price per pack. |
| **Enterprise** | Custom / quote | Keep existing Enterprise product or move to custom pricing; do not gate features — it covers SSO, private deployment, SLA, contracts. |

Sandbox objects created 2026-10-29 via `CreditPaddleSyncService` (admin `POST /admin/credits/paddle-sync-packs`); price IDs stored on `dra_credit_packs.paddle_price_id`:

```
Product: pro_01m63ckhjhf0z79046rjrnvp6s  "Data Research Analysis — Credit Packs"
  pri_01m63cn9jfcz0m2j544n3kgcje  1,000 credits  $9.00   (one-time, no billingCycle — verified)
  pri_01m63cn9v7tct6a9w0jj5x7tb4  5,000 credits  $40.00  (one-time)
  pri_01m63cna3mppvk2nf7e12khacx 10,000 credits  $70.00  (one-time)
```

Validated in sandbox: one-time price has no `billingCycle`; `transactions.create` with it returns a draft transaction with a checkout URL and item type `one-time`. The saved-payment-method auto-recharge path is implemented but the saved-card charge itself still needs a sandbox run with a card on file.

Specific settings to make in the Paddle dashboard:

1. **Products → create "DRA Pro":**
   - Product name shown on checkout: "Data Research Analysis Pro".
   - Do NOT attach a feature matrix in Paddle; features are identical across prices.
2. **Prices on "DRA Pro":** one price per credit volume; billing period monthly (and annual equivalents if kept). Set tax mode per your existing tax settings (Paddle handles MoR/VAT). Enable "price description" so the checkout line item reads "5,000 credits / month".
3. **Products → create "DRA Credit Packs":** one-time (non-recurring) prices per pack size. Verify in sandbox that a one-time price triggers `transaction.completed` (not a subscription event).
4. **Discounts/promo codes:** keep existing promo-code sync. Decide whether promo codes apply to credit packs or only subscriptions; configure accordingly.
5. **Saved payment methods (for auto-recharge):** enable card saving so app-initiated top-up transactions can reuse the stored payment method. Verify in sandbox that an app-created one-time transaction can charge a saved card (this is the risky API assumption — test early).
6. **Checkout:** keep Checkout Overlay mode for Pro signup and pack purchase. Overlay checkout lets the customer edit item quantity (Paddle Billing has no "disable quantity" setting for a single variable item). The webhook is therefore the source of truth: persist `credits` from the actual subscription/transaction item `quantity × 1,000` (fetch the entity from Paddle when an event omits `items`), never from `customData`. If a fixed quantity is required, use one price per credit volume with `quantity.minimum = quantity.maximum = 1` instead of the per-1,000-credit price. For auto-recharge, create transactions server-side via the Paddle SDK (like the existing `createCheckoutSession` path in `SubscriptionProcessor`) using the pack price IDs.
7. **Webhooks:** no new event types expected (`transaction.completed` / `transaction.payment_failed` already handled); keep HMAC secret. Add handling if sandbox shows a distinct event for one-time transactions.
8. **Customer portal:** unchanged — portal remains for subscription management; pack purchase flows through checkout.
9. **Sandbox first:** build a full test matrix (§8) in sandbox before touching production products. Use `PADDLE_ENVIRONMENT=sandbox`.

### 3.3 Custom amount consideration (optional)

For "buy exactly what I need" auto-recharge, Paddle supports custom-amount checkouts. Prefer fixed pack price IDs for v1 (simpler ledger math, predictable revenue); revisit custom amounts later.

---

## 4. Database & schema changes

New models (backend/src/models):

1. **`DRACreditWallet`** (or columns on `DRAOrganizationSubscription`): `org_id` (unique), `balance_credits`, `monthly_credits_granted_at`, `monthly_grant_amount`, `rollover_balance`, `auto_recharge_threshold`, `auto_recharge_pack_id`, `currency`. One row per org. Balance updated transactionally.
2. **`DRACreditTransaction`** — immutable ledger (mirror `DRAPaymentTransaction` pattern): `id`, `org_id`, `type` (`grant|purchase|consume|refund|expire|adjust`), `amount` (positive/negative), `source` (`subscription_month|pack|promo|support|refund`), `action_key` nullable, `action_ref_id` nullable (plan_id / ai_call_log id), `paddle_transaction_id` nullable, `description`, `created_at`. Every balance change writes a row.
3. **`DRACreditPack`** — pack catalog: `id`, `name`, `credits`, `price_usd`, `paddle_price_id` (one-time price), `is_active`, `sort_order`.
4. **`DRAActionPrice`** — per-action credit pricing: `id`, `action_key` (matches `AI_FEATURE_KEYS` + non-AI keys like `plan_deck_export`), `display_name`, `credits`, `band_type` (`fixed|row_band|event_band`), `band_multipliers` (JSON), `is_active`. Admin-editable (same pattern as subscription-tier CRUD).

Modify existing:

5. **`DRASubscriptionTier`**: repurpose or extend — add `credits_per_month`, `data_row_allowance` (reuse `max_rows_per_data_model`), `sync_cadence_minutes`, `credits_rollover` (bool). Existing boolean feature gates (`advanced_tools_allowed`, `plan_advanced_mode_allowed`, `plan_ai_chat_allowed`, `plan_deck_export_allowed`) become obsolete → set true everywhere or drop in a later migration.
6. **`ai_call_logs`**: add nullable `credits_consumed` decimal so consumption is traceable per AI call without a separate join.
7. New migration files in `backend/src/migrations/` (follow existing `1775...-Create*.ts` naming).

---

## 5. Backend changes

### 5.1 Credit wallet service (new)

`backend/src/services/CreditWalletService.ts`:

- `getBalance(orgId)`, `grantMonthly(orgId)` (idempotent per month), `consume(orgId, actionKey, refId, { reserve })` with atomic decrement (pessimistic lock / `UPDATE ... WHERE balance >= amount`), `purchase(orgId, packId, paddleTxId)` (idempotent on `paddle_transaction_id`), `refund`, `expire`, `rollover` job, `canAfford(orgId, actionKey)`.
- Insufficient balance → new error type `CreditInsufficientError` (mirror `TierLimitError` / 402 pattern) carrying `balance`, `required`, and upgrade/pack CTA hints.
- **Only-successful-runs-charge semantics:** for multi-step actions (plan build), *reserve* credits at start (hold), *release* on failure, *settle* on completion. For single AI calls, consume after the call returns success. Failed/`skipped_no_data` calls consume 0.
- Reservation must be concurrency-safe (Redis lock on org wallet during reserve/settle).

### 5.2 Meter points (wire consumption)

- **Plan build:** `PaidMediaPlanProcessor` / `PlanExecutionEngine` — replace `enforcePlanBuildLimit` consumption with reserve-on-create → settle-on-complete / release-on-failure. Guest plans: charge against the guest session's grant; on registration, transfer to the org wallet (mirror the existing guest → account claim logic).
- **Plan chat / artifact exports:** consume per action (`plan_chat`, `plan_deck_export`, `plan_pack_export`).
- **AI generation surfaces:** in `AICallTrackerService.track()` (the single choke point) — after a successful tracked call, look up `DRAActionPrice` by `feature_key` and consume credits (org from call context). This automatically covers insights, analysis, modeler chat, join inference, dashboard auto-gen, report widgets, anomaly/budget/search (subject to the allowance rules in §5.3).
- **Band multipliers:** `consume` resolves `band_type` → for `row_band`/`event_band`, compute multiplier from model rows/event count passed by the caller (call sites: `DataModelAnalysisService`, attribution, AI report generation).

### 5.3 Replace tier enforcement (remove gates)

`TierEnforcementService` and `middleware/tierEnforcement.ts`:

- Remove feature gates: `advanced_tools_allowed`, `plan_advanced_mode_allowed`, `plan_ai_chat_allowed`, `plan_deck_export_allowed` — all surfaces unlock for every plan. Keep admin bypass.
- Keep only allowance checks: rows per model (from credit-plan allowance), sync/refresh cadence, and credit balance before credit actions.
- Remove seat/member limits (`max_members_per_project`) and project/dashboard/data-model count limits → unlimited (Juma parity).
- Keep RBAC entirely (project marketing roles, workspace roles, CMO read-only, CMOs not seeing data models) — this is access control, independent of pricing.
- Upgrade ladders / limit modals: replaced by "insufficient credits" CTA (buy pack / upgrade credit volume).

### 5.4 Paddle integration (extend existing)

- `SubscriptionProcessor` / `routes/subscription.ts`: keep subscription checkout (now "choose credit volume"), add:
  - `POST /credits/packs` — list packs.
  - `POST /credits/purchase` — create one-time checkout for a pack (customData: `{ organizationId, packId }`).
  - `POST /credits/auto-recharge` — set threshold + pack; server-side transaction creation against saved payment method (verify in sandbox).
- `paddle-webhook.ts`: on `transaction.completed`, branch on `customData.packId` → `CreditWalletService.purchase` (idempotent). Existing subscription handlers unchanged.
- `routes/admin/ai-usage.ts` + new `routes/admin/credits.ts`: credit ledger, balances, per-org breakdown, action-price CRUD, support credit adjustment.

### 5.5 Jobs

- `CreditRolloverJob` (daily): grant monthly credits, apply rollover rules, expire pack credits only if policy requires.
- `CreditCeilingWatchdog` (optional): alert when an org's consumed credits imply AI cost > margin threshold.

---

## 6. Frontend changes

### 6.1 Pricing page (`frontend/pages/pricing.vue`) — rewrite to Juma-style

- Single Pro card with credit-volume slider (5k–100k) and price updating per position; monthly/annual toggle optional.
- Credit estimator: "How many media plans / reports / analyses do you ship per month?" → recommended credit volume.
- Publish the per-action credit table (§1.1) with "estimates depend on data size" disclaimers.
- Messaging: "Everything included. Unlimited seats. Pay for work done. Only successful runs charge. Credits are shared across your workspace."
- Remove the compare-all-features tier matrix; replace with "what costs credits" section.
- Free: "500 free credits every month, no card required" + keep the guest-plan CTA.

### 6.2 Billing page (`frontend/pages/billing/index.vue`)

- Credit balance card: current balance, monthly grant date, rollover balance, spend this month.
- Usage breakdown per action (from `ai_call_logs` / credit transactions), per-user view (credits pooled but per-user attribution visible).
- Buy packs, set auto-recharge threshold + pack, purchase history.
- Keep subscription management + payment history sections.

### 6.3 Limit modals / CTAs

- Replace upgrade-ladder modals with: "Not enough credits — Buy a pack or increase your monthly credits."
- Remove locked-feature badges (advanced tools) from UI; keep role-based visibility (CMO etc.).

### 6.4 Guest funnel

- Guest plan build consumes from the free grant; show remaining credits on claim/registration.

---

## 7. Legal documents (privacy policy, terms, refunds, cancellation)

Files: `frontend/pages/privacy-policy.vue`, `terms-conditions.vue`, `return-refund-policy.vue`, `cancellation-policy.vue`.

### 7.1 Terms & Conditions

- Replace tier/feature language with the credit model:
  - Credits are prepaid units of usage; 1 credit ≈ value described on the pricing page; credits pooled at the workspace level; unlimited seats.
  - Monthly included credits reset each billing cycle; purchased pack credits roll over (or expire — state the chosen policy).
  - **Only successful runs consume credits**; failed or erroring runs do not.
  - Auto-recharge: authorization to charge the saved payment method up to the selected pack when balance drops below the threshold; threshold editable; confirm purchases are visible in payment history.
  - Data allowance: row allowances per plan; exceeding requires a larger plan — not a per-row charge.
  - All features available on all plans (no feature gating); RBAC/roles unchanged.
  - Material change clause: if we change credit pricing/values materially, advance notice; existing behavior under §7.3 refunds.

### 7.2 Refund Policy (`return-refund-policy.vue`)

- Keep Paddle MoR framing and the 14-day consumer right to cancel for first-time paid purchases.
- Add:
  - **Unused credit packs:** refundable within the 14-day window (first-time purchase) and on a case-by-case basis thereafter if unconsumed.
  - **Consumed credits are non-refundable** (value already delivered), except incorrect charges/system errors.
  - **Monthly subscription portion:** pro-rated only under the existing exceptional circumstances; consumed credits from the month are not refunded.
  - **On cancellation:** remaining purchased pack credits handled per policy (refund if unconsumed within window / case-by-case; free-tier and monthly grant credits are forfeited on cancellation).
  - Downgrade section: replace "tier downgrade" language with "reduce monthly credit volume" — change effective end of billing period, no refund for unused portion of the higher volume, credits above the new allowance continue until consumed or expired per rollover policy.

### 7.3 Privacy Policy

- Add a "Usage Data" section: what we record when you use credits — action type, timestamps, token/credit consumption (`ai_call_logs`), org/user attribution for pooled credits; purpose (billing, fair use, service improvement); retention (align with existing data-retention policy, e.g., 24 months + aggregates).
- Confirm/refresh third-party data-sharing statements (Paddle as MoR — already present; note credit-pack purchase data).
- Reaffirm that AI providers do not use customer data for training (existing zero-retention claims) — unchanged.

### 7.4 Cancellation Policy

- Update "Downgrade as an Alternative" and tier references to plan sizes/credit volumes.
- State explicitly what happens to credits on cancellation (per §7.2): grant credits forfeited; purchased packs per refund policy; data export window unchanged.

### 7.5 Marketing copy

- Update landing/problem pages + pricing FAQ where they mention tiers, seats, or feature gates ("unlimited", "all features", "credits", "pay for work done").

---

## 8. Testing checklist (sandbox first)

1. Pro subscription checkout at each credit volume → `subscription.created/updated`, monthly grant lands, resets on cycle.
2. One-time pack purchase → `transaction.completed`, wallet credited, idempotency on webhook replay.
3. Auto-recharge: balance below threshold → app creates transaction → saved-card charge → credits added; cancel/toggle threshold.
4. Consume paths: plan build (reserve → settle/release), each AI feature key, band multipliers for large models, chat per-session semantics.
5. Insufficient credits: 402 with pack CTA; no partial consumption; concurrent consumption atomicity.
6. Failed runs consume 0 credits (kill a plan build mid-stream; force an AI failure).
7. Rollover: monthly reset, pack credits persist, pro rollover if enabled.
8. Refunds: Paddle adjustment → credit ledger entry; pack refund → balance deduction idempotent.
9. Guest plan: build with free grant, claim on registration, 24h invalidation, quota semantics.
10. RBAC: CMO visibility unchanged; roles unchanged.
11. Existing subscribers migration: current tier → mapped credit plan, balances correct, no double-grant.
12. Admin: ledger view, action-price edits, support adjustments, per-org balance.

---

## 9. Data migration & rollout

1. Phase 0 calibration locked; action prices + packs seeded.
2. Paddle sandbox products/prices created and synced; webhook tests pass.
3. Migration maps existing orgs: Free → Free grant; Starter → Pro 5k (or a Starter-equivalent credit grant honoring remaining plan builds); Professional → Pro 25k; Professional Plus → Pro 50k; Enterprise → Enterprise. **Grandfather pricing:** existing subscribers keep current price until renewal or until they change volume; communicate via email + in-app banner (advance notice, since pricing is a material change).
4. Feature-flag the credit wallet + consumption behind `CREDITS_ENABLED` while gates are still in place; flip gates off per surface after smoke tests.
5. Publish legal pages + marketing copy together with the pricing-page launch.
6. Announcement email: what credits are, how the estimator works, grandfathering terms, refund/rollover rules.

---

## 10. Risks & open questions

- **Margin calibration is the whole game:** lock prices only after Phase 0 data; publish per-action table as a trust tool.
- **Storage abuse in an un-gated model:** the data allowance (rows) is the only guardrail — enforce it server-side; monitor top row consumers.
- **Saved-card auto-recharge is the riskiest Paddle assumption** — validate in sandbox before committing; fallback is checkout-based top-up (user clicks "buy pack").
- **Paddle one-time price configuration** — confirm "one time" price type behavior and event payloads in sandbox.
- **Negative/zero balances on concurrent consume** — atomic update required.
- **Rollover policy** (Pro monthly rollover yes/no) affects grant sizes — decide in Phase 0.
- **Existing tier gate removal** touches many call sites (`TierEnforcementService`, middleware, frontend badges) — do it surface-by-surface behind the flag, not as one big-bang.
- **Tax/MoR:** unchanged — Paddle remains merchant of record for subscriptions and one-time purchases.

---

## 11. Suggested implementation order

| Phase | Work | Exit criteria |
|---|---|---|
| 0 | Price calibration from `ai_call_logs`; lock action table, packs, allowances, rollover policy | Numbers in §1.1/§1.2 approved |
| 1 | Schema (wallet, transactions, packs, action prices) + `CreditWalletService` + meter points behind `CREDITS_ENABLED` | Consumption ledger live in sandbox, balances correct |
| 2 | Paddle products/prices/packs + purchase checkout + webhook branching + auto-recharge (sandbox-validated) | Full purchase/top-up loop green in sandbox |
| 3 | Remove feature gates; keep allowances + RBAC; replace limit modals | Gates off on staging; no locked-feature UI remains |
| 4 | Frontend: pricing page, billing page, estimator, modals, guest funnel | UX review on staging |
| 5 | Legal pages, marketing copy, migration/grandfathering, announcement, production rollout | Launched; existing subscribers migrated |

Dependencies: Phase 0 before 1–2 (prices); Phase 2 webhook branching before 5 (packs); legal docs can be drafted in parallel from Phase 0.
