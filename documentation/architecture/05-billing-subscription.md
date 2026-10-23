# 05 — Billing & Subscriptions

## Overview

Billing is org-scoped. Each `DRAOrganization` has exactly one `DRAOrganizationSubscription` (1:1) resolved to a `DRASubscriptionTier`. Paddle is the PSP; local tables track subscriptions, webhook events, and an immutable payment ledger.

```
Paddle ──webhook──> routes/paddle-webhook.ts ──> SubscriptionProcessor
                                                  ├── DRAOrganizationSubscription (1:1 org)
                                                  ├── DRAPaymentTransaction (ledger)
                                                  ├── DRAPaddleWebhookEvent (idempotency/audit)
                                                  └── DRASubscriptionTier
```

## Tier ladder (seeded `06-20260108-SubscriptionTierSeeder.ts`)

Tiers compared by **`tier_rank`** (0/10/20/30/40). Limits with `-1` mean unlimited.

| Rank | Tier | Monthly | Annual | max_projects | max_data_sources/project | max_dashboards | max_rows/model | max_models/source | max_members | AI gens/mo | plans/mo | AI cost ceiling |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | Free | $0 | $0 | 1 | 4 | 5 | 50,000 | 3 | 0 (solo) | 10 | 1 | — |
| 10 | Starter | $29 | $276 | 1 | ∞ | 15 | 500,000 | ∞ | 0 (solo) | 100 | 5 | — |
| 20 | Professional | $129 | $1,236 | ∞ | ∞ | ∞ | 5,000,000 | ∞ | 5 | ∞ | ∞ | $10 |
| 30 | Professional Plus | $399 | $3,828 | ∞ | ∞ | ∞ | 100,000,000 | ∞ | 100 | ∞ | ∞ | $50 |
| 40 | Enterprise | $2,499 | $23,990 | ∞ | ∞ | ∞ | ∞ | ∞ | ∞ | ∞ | ∞ | SLA |

Boolean entitlements: `plan_advanced_mode_allowed` (Starter+), `plan_ai_chat_allowed` (Professional+), `plan_deck_export_allowed` (rank ≥ 10), `advanced_tools_allowed` (rank ≥ 20 — gates the whole BI layer: data models, dashboards, reports, AI insights, engineering connectors).

Annual = 20% off. The seeder only inserts missing tiers (never updates); `09-PaddlePriceIdSeeder` fills placeholder Paddle IDs; real IDs come from the admin panel or `PaddleSyncService`. Paddle product/price creation on tier CRUD lives in `SubscriptionTierProcessor` (auto-creates/archives Paddle entities on create/price-change/delete; refuses delete with active subscriptions).

## Checkout flow

`POST /subscription/checkout` (JWT + expensiveOperationsLimiter):

1. Verify caller is org member or admin; reject Free tier.
2. Pick `paddle_price_id_monthly`/`_annual`.
3. Optional promo: `PromoCodeService.validatePromoCode` → `paddleDiscountId` + final price.
4. `getOrCreateCustomer(ownerEmail, org.name, {organizationId})`; creates an inactive Free subscription row if none exists.
5. Create Paddle transaction with `customData: { organizationId, tierId, billingCycle, promoCodeId? }`.
6. Return `{ sessionId, checkoutUrl, priceId, ... }` → frontend `usePaddle` opens checkout overlay and polls `POST /subscription/check-activation`.

## Webhook handling (`routes/paddle-webhook.ts`, mounted `/paddle/webhook`, no auth)

- **HMAC-SHA256** over `"{ts}:{rawBody}"` with `PADDLE_WEBHOOK_SECRET` (`Paddle-Signature: ts=...;h1=...`), timing-safe compare, 5-min skew window.
- **Idempotency**: `INSERT ... ON CONFLICT (event_id) DO NOTHING` into `dra_paddle_webhook_events`.
- Handled event types (10): `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.payment_succeeded` / `transaction.completed`, `subscription.payment_failed` / `transaction.payment_failed`, `customer.updated` (no-op), `adjustment.created` / `adjustment.updated` (refunds/credits → ledger).
- **Tier-change race guard**: Redis `pending_tier_change:{subId}` with 90 s TTL; stale `subscription.updated` during the window is ignored.
- Always returns 200 for application errors (prevents Paddle retries); 500 only for transient infra errors.

## Subscription lifecycle (`SubscriptionProcessor`, 1966 lines)

| State | Conditions |
|---|---|
| Free | `tier_rank = 0`, no Paddle subscription |
| Active paid | `is_active=true`, `paddle_subscription_id` set, no cancellation, no grace |
| Pending cancellation | Paddle `scheduledChange.action === 'cancel'` (surfaced as `scheduled_cancellation`) |
| Grace period | `last_payment_failed_at` set + `grace_period_ends_at` future (`grace_period_days` default 14; permanent payment failures get `max(7, floor(base/2))` days) — access retained |
| Cancelled/expired | `cancelled_at` + `ends_at < now` → job downgrades to Free |
| Trial | `trial_ends_at` column exists; no trial flow implemented |

Key paths:

- **`changeTier`** — main live upgrade/downgrade path (also `executeUpgrade`). Blocks paid→paid without a Paddle subscription; downgrade validation (`validateDowngrade` — only projects + active admins/members) with `DOWNGRADE_BLOCKED` + violations; downgrade to Free cancels Paddle immediately; DB updated before Paddle API (`prorated_immediately`), with Redis tier-change lock.
- **`previewUpgrade`** — owner-only, uses `paddle.previewSubscriptionUpdate`.
- **`cancelSubscription`** — `paddle.cancel(next_billing_period)`; does **not** set local `cancelled_at` (waits for webhook).
- **`handleFailedPayment`** — grace windows + `PaymentAlertService` alerts + emails.
- **`processGracePeriodExpiry`** / **`processExpiredCancelledSubscriptions`** — daily jobs downgrade to Free.
- **`getPaymentMethod` / `validatePaymentMethod`** — card details, expiry vs month, Paddle status (`canceled|past_due` invalid).
- **`getPaymentHistory`** — merges Paddle transactions with local ledger.
- **`syncSubscriptionFromPaddle`** — owner-only reconciliation.

## Payment ledger & refunds

- `DRAPaymentTransaction` — immutable ledger: `charge|refund|credit|adjustment`, unique `paddle_transaction_id`, negative amounts for refunds/credits.
- Refunds arrive as Paddle **adjustments** (`adjustment.created`/`updated`) → ledger rows (status `completed` when Paddle `approved`).
- **Known defect**: `handleSuccessfulPayment` writes `charge` rows with `amount = 0`, so `admin/subscription-analytics/revenue-by-month` nets zero from the ledger (MRR is unaffected — it uses tier prices). No `transaction.refunded` handler exists.

## Promo codes (`PromoCodeProcessor` / `PromoCodeService`)

- Types: `percentage`, `fixed_amount` (Paddle-compatible), `free_trial`, `upgraded_tier` (DRA-only).
- Fields: code (unique A-Z0-9-), discount value/duration, validity window, max uses (global + per user), tier allowlist, user allowlist, email-domain restriction, `new_users_only`, Paddle discount id.
- Redemption is transactional with `pessimistic_write` lock; Paddle discount created/archived in sync.
- **Known gap**: promo redemptions are never recorded from webhooks (`customData.promoCodeId` is dropped in the webhook call sites).

## Billing jobs (see [08 — Background Jobs](08-background-jobs.md))

- `subscriptionGracePeriodJob` — daily 02:00: grace expiry + reminders at 7/3/1 days (portal link).
- `expiredSubscriptionDowngradeJob` — daily 03:00.
- `paymentMethodExpiryJob` — 1st of month 09:00: card-expiry warnings.
- `cleanupWebhookEventsJob` — Sunday 03:00: GDPR 90-day TTL on processed webhook payloads.

## Paddle sync (admin, manual)

- `PaddleSyncService` — `POST /admin/paddle/sync`: products/prices → tiers, discounts → promo codes; retires changed tiers (rename + `is_active=false`, migrate subscriptions).
- `PaddleSubscriptionSyncService` — `POST /admin/paddle/sync-subscriptions`: per-subscription reconciliation (404 → inactive; syncs cancelled_at/ends_at; understands `active|trialing|canceled|past_due|paused` + scheduled cancel).
- Neither runs on cron.

## Account cancellation

- `POST /account/cancel` — per **user** (not org/subscription): retention window from platform settings (`data_retention_days`), `deletion_scheduled_at = effective + retentionDays`, status `pending`; reasons categorized.
- `POST /account/reactivate`, `POST /account/export-data`, data-model exports.
- `ScheduledDeletionJob` — daily 02:00: 7-day/1-day warnings then `DataDeletionService.deleteUserData` (single transaction: revoke OAuth tokens, delete files, cascade-delete projects/notifications, purge Redis sessions, **anonymize user record** and owned-org billing IDs, confirmation email).
- **Known gap**: account cancellation does **not** cancel the org's Paddle subscription.

## Frontend consumption

- `GET /subscription/current` → `RowLimitService.getUsageStats()` (tier/rank/row limit/counts).
- `GET /subscription/usage` → `TierEnforcementService.getUsageStats()` (canCreate*, plan flags, `upgradeTiers` for 7 resource types).
- `GET /subscription/tiers` (public) → active tiers + Paddle price IDs + feature subset.
- Store: `stores/subscription.ts` (localStorage `subscriptionStats`/`usageStats`, 5-min refresh, org-change reset); `useTierLimits` reads `upgradeTiers`; `TierLimitModal` renders the ladder; `useApiErrorHandler` renders 402 payloads; `usePaddle` drives checkout.
