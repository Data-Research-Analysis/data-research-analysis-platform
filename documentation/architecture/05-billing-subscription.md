# 05 — Billing, Credits & Subscriptions

## Overview

Billing is org-scoped. Each `DRAOrganization` has exactly one `DRAOrganizationSubscription` and one `DRACreditWallet`. Paddle is the PSP; local tables track the subscription, the financial ledger, the credit ledger, action prices, packs, and per-member spend limits.

Every paid action is metered in credits through `CreditWalletService`. The subscription/tier row determines the monthly grant and rollover policy; the wallet and `DRACreditTransaction` ledger are the source of truth for consumption and balance.

```
Paddle ──webhook──> routes/paddle-webhook.ts ──> SubscriptionProcessor + CreditCheckoutService
                                                  ├── DRAOrganizationSubscription (1:1 org)
                                                  ├── DRAPaymentTransaction (financial ledger)
                                                  ├── DRAPaddleWebhookEvent (idempotency/audit)
                                                  ├── DRASubscriptionTier (plan metadata)
                                                  ├── DRACreditWallet (1:1 org)
                                                  ├── DRACreditTransaction (credit ledger)
                                                  ├── DRACreditPack (pack catalog)
                                                  ├── DRAActionPrice (per-action pricing)
                                                  └── DRACreditMemberLimit (per-member caps)
```

## Plans & pricing

The product has three commercial positions: **Free**, **Pro**, and **Enterprise**. Every feature is available on every plan, seats are unlimited, and credits are pooled in one organization wallet shared by all workspaces and projects.

| Plan | Monthly credits | Price | Rollover | Data rows / model | Packs | Auto-recharge |
|---|---:|---|---|---|---|---|
| Free | 500 | $0 | No | 50,000 | No | No |
| Pro | 5,000–100,000 (5,000-credit steps) | $9.80 per 1,000 credits/month; $94.80 per 1,000 credits/year annual ($7.90/month equivalent) | Yes | 5,000,000 | Yes | Yes |
| Enterprise | Admin-managed | Custom contract | Yes | Unlimited | Yes | Yes |

- Pro entry price is **$49/month for 5,000 credits** (annual **$474/year** for 5,000 credits). The checkout accepts a `credits` value from 5,000 to 100,000 in 5,000-credit increments.
- New Free workspaces receive a one-time **500-credit onboarding bonus**, so month one has 1,000 credits (500 grant + 500 bonus). The bonus is a separate ledger type and survives the Free monthly reset.
- Free monthly credits do **not** roll over. Pro monthly credits roll over; pack credits never expire.
- Packs are one-time Paddle prices: **$9 / 1,000**, **$40 / 5,000**, and **$70 / 10,000**. Packs are Pro-only; pack credits remain usable after a downgrade, including on Free, but Free workspaces cannot buy new packs.
- The only remaining capacity guardrails are the **data-row allowance** (`max_rows_per_data_model`), the **credit balance/spend cap**, and **RBAC**. Project, channel, data-model, dashboard, AI-generation, plan-build, and seat quotas are not tier-gated.
- `ai_cost_ceiling_usd` remains nullable on the tier table for compatibility but is not used as a fair-use ceiling; credits replace it.

Legacy tiers were reconciled by `1800000006000-ReconcileCreditTiers`, which restores Free/Pro allowances, repairs zero row limits, and deactivates unused Starter/Professional Plus tiers. The seeder now creates only Free (`tier_rank = 0`), Data Research Analysis Pro (`tier_rank = 20`), and Enterprise (`tier_rank = 40`).

## Credit wallet

`dra_credit_wallets` has one row per organization (`org_id` is unique).

| Field | Purpose |
|---|---|
| `balance_credits` | Current spendable balance (grants + bonus + packs − consumption ± adjustments). |
| `rollover_balance` | Portion of the balance carried from a previous month. |
| `monthly_credits_remaining` | Unused part of the current month's grant. Non-rollover plans expire only this amount, preserving pack credits. |
| `monthly_grant_amount` | Monthly allowance resolved from the plan (or the per-subscription credit override). |
| `monthly_credits_granted_at` | Idempotency guard for the current UTC month's grant. |
| `monthly_spent_credits` | Credits consumed in the current UTC month; reset on the monthly grant. |
| `spend_cap_credits` | Hard monthly workspace spend cap; `null` means no cap. |
| `auto_recharge_threshold` / `auto_recharge_pack_id` | Auto-recharge trigger and pack selection. |
| `auto_recharge_consent_at` | Explicit saved-card consent timestamp. |
| `first_consumption_at` | First credit consumption, used for funnel instrumentation. |
| `low_balance_alert_20_sent_at` / `low_balance_alert_10_sent_at` | Low-balance alert deduplication per period. |
| `currency` | Billing currency (currently USD). |

All balance changes go through `CreditWalletService.applyTransaction`, which locks the wallet row (`pessimistic_write`), applies the balance change, writes the ledger row, and commits in one transaction.

## Credit ledger

`dra_credit_transactions` is append-only. Rows are never mutated after insert except the one allowed reservation transition (`reserved` → `settled` / `released`).

**Types:** `grant` (monthly allowance), `bonus` (one-time onboarding), `purchase` (pack), `consume` (negative), `release` (positive reservation reversal), `refund` (pack/overcharge), `expire` (rollover policy), `adjust` (support/admin correction, signed).

**Statuses:** `reserved`, `settled`, `released`.

**Idempotency:** `paddle_transaction_id` is unique for Paddle-originated rows; `source + type` guards support grants and other non-Paddle writes. Reservation rows carry `action_key`, `action_ref_id`, and `reservation_id`.

## Action pricing

`dra_action_prices` defines the credit cost for each user-facing action.

| Charge mode | Meaning | Examples |
|---|---|---|
| `per_call` | One charge per AI call; pre-authorized before the request. | Plan chat, data-modeler chat, insights follow-up, web search grounding, join inference |
| `per_action` | One charge per deliverable; reserved at the action boundary and settled on success. | Plan build, model analysis, data quality, attribution, report generation, exports, dashboard generation |

`band_type` is `fixed`, `row_band`, or `event_band`; `band_multipliers` (for example `[1, 2, 3]`) scales the base price by data size. The seeded plan-build price is **500 credits**; deck export is 50, plan pack export 15, report generation 15, and per-call chat/grounding actions are in the 1–2 credit range. Prices are editable from the admin console.

## Reserve / settle / release

Multi-step actions follow one lifecycle:

1. **Reserve** — `ensureReserved(orgId, actionKey, actionRefId)` holds the action price. The hold reduces `balance_credits` and writes a `consume` row with status `reserved`. It is idempotent on `(actionKey, actionRefId)`.
2. **Settle** — on success, the reservation row moves to `settled`; the hold becomes a charge.
3. **Release** — on failure, the reservation moves to `released` and the credits return to the wallet.

Only successful runs consume credits. Failed plan builds, exports, analyses, and report generations release their hold.

## Fail-closed enforcement

The 2026-11-02 remediation closed the fail-open paths:

- **Plan builds** — `ensureCanAfford('plan_build')` runs before creation; `ensureReserved` runs before start/resume and before the `running` status is persisted; `reconcilePlanCredits` rethrows credit errors. Insufficient credits return `402` with a billing CTA, and a plan cannot execute without a funded hold.
- **Per-call AI** — `AICallTrackerService.authorizePerCall` checks the balance before chat, grounding, and join-inference calls. A zero-balance workspace is blocked before the model request.
- **Guest claims** — guest builds are unmetered because no wallet exists yet. At claim, the monthly grant is applied and the 500-credit `plan_build` hold must succeed before the plan is attached; unfunded claims return `402`. The hold settles when the plan completes and releases if the claim cannot continue.
- **Spend caps and member limits** — `applyTransaction` rejects consumption that would exceed the workspace monthly cap or an attributed member's monthly limit. Reservations count toward the cap; released holds return the workspace spend counter.

## Spend controls & alerts

- **Low-balance alerts** — owners and admins receive email and in-app socket alerts at 20% and 10% of the monthly allowance. Alert flags reset on the monthly grant.
- **Hard monthly spend cap** — `POST /credits/spend-cap` sets or clears `spend_cap_credits`; consumption and reservations are rejected once the cap would be exceeded.
- **Per-member limits** — `GET/POST /credits/member-limits` let owners/admins set a member's monthly limit. `DRACreditMemberLimit` tracks the member's period and spend; the counter resets lazily at the start of each UTC month. Enforcement applies to attributed spend (AI calls and plan builds).
- **Auto-recharge consent** — enabling auto-recharge requires `consent: true` the first time. `POST /credits/auto-recharge` with `packId: null` is the off switch. `auto_recharge_consent_at` records consent.

## Pack purchases & auto-recharge

- `GET /credits/packs` lists active packs.
- `POST /credits/purchase` creates a one-time Paddle checkout for a pack. `CreditCheckoutService.canBuyPacks` rejects Free workspaces.
- `POST /credits/auto-recharge` sets the threshold, pack, and consent. `CreditWalletService` triggers `maybeAutoRecharge` after a spend when the balance falls below the threshold; the in-flight guard prevents duplicate charges. A failed saved-card charge falls back to the manual pack checkout.
- Pack credits are written to the wallet as `purchase` rows and never enter the monthly pool, so they are not expired by the rollover job.

## Refunds

Paddle `adjustment.created` / `adjustment.updated` events are handled in `routes/paddle-webhook.ts`:

1. Resolve the organization from the subscription when the adjustment belongs to a subscription.
2. For one-time pack refunds, resolve the organization from the original `DRACreditTransaction` purchase row using the adjustment's original `transaction_id`.
3. Write the financial ledger row (`DRAPaymentTransaction`) with the negative refund amount.
4. Call `CreditWalletService.reversePurchase`, which is idempotent on the Paddle adjustment id, debits the purchased credits (clamped to the current balance so the wallet never goes negative), and writes the credit-ledger `refund` row.

Both the financial and credit ledgers therefore reflect the refund, and a replayed `adjustment.updated` cannot reverse twice.

## Checkout flow

`POST /subscription/checkout` (JWT + `expensiveOperationsLimiter`):

1. Validate `tierId`, `billingCycle` (`monthly`/`annual`), and `organizationId`; verify the caller is an org member or platform admin.
2. Validate optional `credits` (5,000–100,000 in 5,000-credit steps) for the Pro variable-credit plan.
3. Pick the Paddle monthly/annual price; validate an optional promo code.
4. `getOrCreateCustomer(ownerEmail, org.name, { organizationId })`; create an inactive Free subscription row if none exists.
5. Create the Paddle transaction with `customData: { organizationId, tierId, billingCycle, credits, promoCodeId? }`.
6. Return `{ sessionId, checkoutUrl, priceId, ... }`; the frontend opens the Paddle overlay and polls `POST /subscription/check-activation`.

## Webhook handling (`routes/paddle-webhook.ts`, mounted `/paddle/webhook`, no auth)

- **HMAC-SHA256** over `"{ts}:{rawBody}"` with `PADDLE_WEBHOOK_SECRET` (`Paddle-Signature: ts=...;h1=...`), timing-safe compare, 5-minute skew window.
- **Idempotency:** `INSERT ... ON CONFLICT (event_id) DO NOTHING` into `dra_paddle_webhook_events`.
- Handled event types include `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.payment_succeeded` / `transaction.completed`, `subscription.payment_failed` / `transaction.payment_failed`, `customer.updated` (no-op), and `adjustment.created` / `adjustment.updated` (refunds/credits).
- On a completed Pro transaction, the webhook reconciles the actual purchased credit quantity, updates `credits_per_month_override`, sets the billing cycle, and triggers the monthly grant.
- **Tier-change race guard:** Redis `pending_tier_change:{subId}` with a 90-second TTL; stale `subscription.updated` during the window is ignored.
- Always returns 200 for application errors (prevents Paddle retries); 500 only for transient infra errors.

## Subscription lifecycle (`SubscriptionProcessor`)

| State | Conditions |
|---|---|
| Free | `tier_rank = 0`, no Paddle subscription |
| Active paid | `is_active = true`, `paddle_subscription_id` set, no cancellation, no grace |
| Pending cancellation | Paddle `scheduledChange.action === 'cancel'` (surfaced as `scheduled_cancellation`) |
| Grace period | `last_payment_failed_at` set and `grace_period_ends_at` in the future (`grace_period_days` default 14; permanent payment failures get `max(7, floor(base/2))` days) — access retained |
| Cancelled/expired | `cancelled_at` + `ends_at < now` → job downgrades to Free |
| Trial | `trial_ends_at` column exists; no trial flow implemented |

Key paths:

- **`changeTier`** — live upgrade/downgrade path (also `executeUpgrade`). Blocks paid→paid without a Paddle subscription; validates downgrades; downgrade to Free cancels Paddle immediately; updates the DB before the Paddle API with a Redis tier-change lock.
- **`previewUpgrade`** — owner-only; uses `paddle.previewSubscriptionUpdate`.
- **`cancelSubscription`** — `paddle.cancel(next_billing_period)`; does not set local `cancelled_at` (waits for the webhook).
- **`handleFailedPayment`** — grace windows, `PaymentAlertService` alerts, and emails.
- **`processGracePeriodExpiry` / `processExpiredCancelledSubscriptions`** — daily jobs downgrade to Free.
- **`getPaymentMethod` / `validatePaymentMethod`** — card details, expiry, and Paddle status.
- **`getPaymentHistory`** — merges Paddle transactions with the local financial ledger.
- **`syncSubscriptionFromPaddle`** — owner-only reconciliation.

## Promo codes (`PromoCodeProcessor` / `PromoCodeService`)

- Types: `percentage`, `fixed_amount` (Paddle-compatible), `free_trial`, `upgraded_tier` (DRA-only).
- Fields: code (unique A-Z0-9-), discount value/duration, validity window, max uses (global + per user), plan allowlist, user allowlist, email-domain restriction, `new_users_only`, Paddle discount id.
- Redemption is transactional with a `pessimistic_write` lock; Paddle discounts are created/archived in sync.
- **Known gap:** promo redemptions are not recorded from webhooks (`customData.promoCodeId` is dropped in the webhook call sites).

## Billing and credit jobs (see [08 — Background Jobs](08-background-jobs.md))

- `creditRolloverJob` — daily at 00:15 UTC. Calls `grantMonthly` for every active org; idempotent per UTC month. Covers Free (non-rollover), monthly Pro (webhook may arrive later), annual Pro (webhook arrives once a year), and rollover plans. Pack credits are never expired.
- `subscriptionGracePeriodJob` — daily 02:00: grace expiry + reminders at 7/3/1 days.
- `expiredSubscriptionDowngradeJob` — daily 03:00.
- `paymentMethodExpiryJob` — 1st of the month 09:00: card-expiry warnings.
- `cleanupWebhookEventsJob` — Sunday 03:00: 90-day TTL on processed webhook payloads.

## Paddle sync (admin, manual)

- `PaddleSyncService` — `POST /admin/paddle/sync`: products/prices → tiers, discounts → promo codes; retires changed tiers (rename + `is_active = false`, migrate subscriptions).
- `PaddleSubscriptionSyncService` — `POST /admin/paddle/sync-subscriptions`: per-subscription reconciliation (404 → inactive; syncs `cancelled_at`/`ends_at`; understands `active|trialing|canceled|past_due|paused` + scheduled cancel).
- Neither runs on cron.

## Account cancellation

- `POST /account/cancel` — per user (not org/subscription): retention window from platform settings (`data_retention_days`), `deletion_scheduled_at = effective + retentionDays`, status `pending`; reasons categorized.
- `POST /account/reactivate`, `POST /account/export-data`, data-model exports.
- `ScheduledDeletionJob` — daily 02:00: 7-day/1-day warnings, then `DataDeletionService.deleteUserData` (single transaction: revoke OAuth tokens, delete files, cascade-delete projects/notifications, purge Redis sessions, anonymize the user record and owned-org billing IDs, confirmation email).
- **Known gap:** account cancellation does not cancel the org's Paddle subscription.

## Admin reconciliation & observability

- `CREDITS_ENABLED` must be `true` in every environment that shows credit pricing or runs paid acquisition. `.env.example` defaults it to `true`; the server logs a launch-blocking warning when it is off.
- `GET /admin/credits/reconciliation?month=YYYY-MM` compares per-call credit charges in `dra_credit_transactions` with `credits_consumed` in `ai_call_logs` and returns per-org mismatches.
- Credit funnel events: grant, first consumption, plan build, settled export/analysis actions, exhaustion, pack purchase, volume upgrade, and rollover.
- Admin console: wallets/ledger, action-price edits, packs, grants/adjustments, auto-recharge, spend/member limits, and Paddle sync.

## Frontend consumption

- `GET /credits/balance` → wallet balance, monthly allowance/spend, spend cap, auto-recharge state, and packs.
- `GET /credits/packs` → active pack catalog.
- `POST /credits/purchase` → one-time pack checkout.
- `POST /credits/auto-recharge`, `POST /credits/spend-cap`, `GET/POST /credits/member-limits` → spend controls.
- `GET /subscription/current` → subscription plus `RowLimitService.getUsageStats()` (plan/row allowance/usage counts).
- `GET /subscription/usage` → `TierEnforcementService.getUsageStats()` (legacy usage shape retained for the frontend).
- `GET /subscription/tiers` (public) → active plans + Paddle price IDs.
- Store: `stores/subscription.ts` (wallet, packs, localStorage cache, 5-minute refresh, org-change reset); `useApiErrorHandler` renders 402 payloads (`CREDIT_INSUFFICIENT`, `CREDIT_SPEND_CAP`) with the billing CTA; `usePaddle` drives checkout.
