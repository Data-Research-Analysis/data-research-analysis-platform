import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRACreditWallet } from '../models/DRACreditWallet.js';
import { DRACreditTransaction, CreditTransactionType } from '../models/DRACreditTransaction.js';
import { DRACreditPack } from '../models/DRACreditPack.js';
import { DRAActionPrice } from '../models/DRAActionPrice.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRACreditMemberLimit } from '../models/DRACreditMemberLimit.js';
import { CreditInsufficientError } from '../types/CreditInsufficientError.js';
import { CreditSpendLimitError } from '../types/CreditSpendLimitError.js';
import { randomUUID } from 'node:crypto';

/**
 * Workspace credit wallet service (implementation plan §5.1).
 *
 * All balance changes run in a transaction with a pessimistic row lock on the
 * org wallet and write an immutable DRACreditTransaction ledger row, so
 * concurrent consumption can never drive a balance negative or lose a write.
 *
 * Consumption semantics (plan §5.1):
 *  - per_call actions (chats, grounding, join inference): consume() after the
 *    successful call.
 *  - per_action multi-step actions (plan build, analyses, exports):
 *    reserve() at start (holds the balance), settle() on completion,
 *    release() on failure. Failed runs consume 0 credits.
 *
 * Meter points gate on CreditWalletService.isEnabled() (CREDITS_ENABLED).
 */

export const CREDITS_ENABLED = (): boolean => process.env.CREDITS_ENABLED === 'true';

const DEFAULT_MONTHLY_GRANT = 500;

/**
 * One-time bonus for new Free workspaces. With the Free monthly allowance of
 * 500 (exactly one paid-media plan build), this gives new users 1,000 in their
 * first month so they can build a plan and still export/analyse/chat about it.
 * It is a `bonus` ledger row, not part of the monthly pool, so it does not
 * expire at the next monthly rollover.
 */
const ONBOARDING_BONUS_CREDITS = 500;

export interface IConsumeOptions {
    actionRefId?: string | null;
    bandIndex?: number;
    description?: string;
    /** Member attribution for per-member monthly limits. */
    userId?: number | null;
}

export interface IConsumeResult {
    credits: number;
    balance: number;
    reservationId?: string;
}

type AutoRechargeTrigger = (orgId: number) => Promise<unknown>;

interface OrgMemberCacheEntry {
    ids: number[];
    at: number;
}

export class CreditWalletService {
    private static instance: CreditWalletService | null = null;
    private autoRechargeTrigger: AutoRechargeTrigger | null = null;
    /** Cached org member ids so credit-update events don't hit the DB per call. */
    private memberCache = new Map<number, OrgMemberCacheEntry>();
    private static readonly MEMBER_CACHE_TTL_MS = 60_000;

    public static getInstance(): CreditWalletService {
        if (!CreditWalletService.instance) {
            CreditWalletService.instance = new CreditWalletService();
        }
        return CreditWalletService.instance;
    }

    public static resetInstance(): void {
        CreditWalletService.instance = null as any;
    }

    /**
     * Register the low-balance hook (wired at startup to
     * CreditCheckoutService.maybeAutoRecharge). Kept as a setter so the wallet
     * service does not import the checkout service (circular dependency).
     */
    public setAutoRechargeTrigger(trigger: AutoRechargeTrigger | null): void {
        this.autoRechargeTrigger = trigger;
    }

    public static isEnabled(): boolean {
        return CREDITS_ENABLED();
    }

    // -------------------------------------------------- Wallet access

    public async getWallet(orgId: number): Promise<DRACreditWallet> {
        const dataSource = await getAppDataSource();
        const repo = dataSource.getRepository(DRACreditWallet);
        let wallet = await repo.findOne({ where: { org_id: orgId } });
        if (!wallet) {
            wallet = repo.create({
                org_id: orgId,
                balance_credits: 0,
                monthly_grant_amount: DEFAULT_MONTHLY_GRANT,
            });
            try {
                wallet = await repo.save(wallet);
            } catch {
                // Unique-constraint race: another request created it first.
                wallet = (await repo.findOne({ where: { org_id: orgId } }))!;
            }
        }
        return wallet;
    }

    public async getBalance(orgId: number): Promise<number> {
        const wallet = await this.getWallet(orgId);
        return Number(wallet.balance_credits);
    }

    public async getWalletWithLedger(
        orgId: number,
        limit = 100
    ): Promise<{ wallet: DRACreditWallet; transactions: DRACreditTransaction[] }> {
        const dataSource = await getAppDataSource();
        const wallet = await this.getWallet(orgId);
        const transactions = await dataSource
            .getRepository(DRACreditTransaction)
            .find({
                where: { org_id: orgId },
                order: { created_at: 'DESC', id: 'DESC' },
                take: limit,
            });
        return { wallet, transactions };
    }

    /**
     * Set/clear auto-recharge.
     *
     * Enabling auto-recharge is a saved-card recurring charge, so it requires
     * explicit consent (`consent === true`) the first time. Disabling
     * (`packId === null`) is always allowed and is the off switch.
     */
    public async setAutoRecharge(
        orgId: number,
        threshold: number,
        packId: number | null,
        consent?: boolean
    ): Promise<DRACreditWallet> {
        const wallet = await this.getWallet(orgId);
        if (packId !== null) {
            if (consent === true) {
                wallet.auto_recharge_consent_at = new Date();
            } else if (!wallet.auto_recharge_consent_at) {
                throw new Error(
                    'Auto-recharge requires explicit consent to charge your saved payment method'
                );
            }
        }
        wallet.auto_recharge_threshold = threshold;
        wallet.auto_recharge_pack_id = packId;
        const dataSource = await getAppDataSource();
        return dataSource.getRepository(DRACreditWallet).save(wallet);
    }

    /** Set/clear the workspace hard monthly spend cap (null = no cap). */
    public async setSpendCap(orgId: number, cap: number | null): Promise<DRACreditWallet> {
        if (cap !== null && (!Number.isFinite(cap) || cap < 0)) {
            throw new Error('Spend cap must be a non-negative number or null');
        }
        const wallet = await this.getWallet(orgId);
        wallet.spend_cap_credits = cap;
        const dataSource = await getAppDataSource();
        return dataSource.getRepository(DRACreditWallet).save(wallet);
    }

    /** Set/clear a member's monthly limit (null = no member-specific cap). */
    public async setMemberLimit(
        orgId: number,
        userId: number,
        limit: number | null
    ): Promise<DRACreditMemberLimit> {
        if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
            throw new Error('Member limit must be a non-negative number or null');
        }
        const dataSource = await getAppDataSource();
        const repo = dataSource.getRepository(DRACreditMemberLimit);
        let row = await repo.findOne({ where: { org_id: orgId, user_id: userId } });
        if (!row) {
            row = repo.create({
                org_id: orgId,
                user_id: userId,
                monthly_limit_credits: limit,
                monthly_spent_credits: 0,
                period_start: CreditWalletService.currentPeriodStart(),
            });
        } else {
            row.monthly_limit_credits = limit;
        }
        return repo.save(row);
    }

    /** List member limits for a workspace. */
    public async listMemberLimits(orgId: number): Promise<DRACreditMemberLimit[]> {
        const dataSource = await getAppDataSource();
        return dataSource.getRepository(DRACreditMemberLimit).find({ where: { org_id: orgId } });
    }

    // -------------------------------------------------- Pricing

    /**
     * Row-band index (0/1/2) for row_band-priced actions (report_widget,
     * data_model_analysis). Provisional thresholds follow the plan's row
     * allowances: <100k rows ×1, 100k–1M ×2, ≥1M ×3.
     */
    public static bandIndexForRowCount(rowCount: number): number {
        if (rowCount >= 1_000_000) return 2;
        if (rowCount >= 100_000) return 1;
        return 0;
    }

    /**
     * Event-band index (0/1/2) for event_band-priced actions (attribution).
     * Same provisional thresholds as the row bands: <100k events ×1,
     * 100k–1M ×2, ≥1M ×3.
     */
    public static bandIndexForEventCount(eventCount: number): number {
        if (eventCount >= 1_000_000) return 2;
        if (eventCount >= 100_000) return 1;
        return 0;
    }

    public async getActionPrice(actionKey: string): Promise<DRAActionPrice | null> {
        const dataSource = await getAppDataSource();
        return dataSource
            .getRepository(DRAActionPrice)
            .findOne({ where: { action_key: actionKey, is_active: true } });
    }

    /** Credit price for an action, applying the band multiplier when given. */
    public async creditsFor(actionKey: string, bandIndex?: number): Promise<number> {
        const price = await this.getActionPrice(actionKey);
        if (!price) return 0;
        let credits = Number(price.credits);
        const multipliers = price.band_multipliers;
        if (bandIndex !== undefined && multipliers && multipliers.length > 0) {
            const idx = Math.max(0, Math.min(bandIndex, multipliers.length - 1));
            credits = credits * multipliers[idx];
        }
        return Math.round(credits);
    }

    public async canAfford(orgId: number, actionKey: string, bandIndex?: number): Promise<boolean> {
        const required = await this.creditsFor(actionKey, bandIndex);
        if (required <= 0) return true;
        const balance = await this.getBalance(orgId);
        return balance >= required;
    }

    /**
     * Fail-closed affordability gate. Throws CreditInsufficientError when the
     * workspace cannot cover the action. Callers should run this before
     * creating/starting expensive work (plan builds) or before a per-call AI
     * request.
     */
    public async ensureCanAfford(
        orgId: number,
        actionKey: string,
        bandIndex?: number
    ): Promise<number> {
        if (!CREDITS_ENABLED()) return 0;
        const required = await this.creditsFor(actionKey, bandIndex);
        if (required <= 0) return 0;
        const balance = await this.getBalance(orgId);
        if (balance < required) {
            throw new CreditInsufficientError(actionKey, required, balance);
        }
        return required;
    }

    /**
     * Pre-authorize a per-call action (chat, grounding, join inference).
     * Per-action deliverables are excluded: they are reserved at their own
     * boundary. Throws CreditInsufficientError when the call must not start.
     */
    public async authorizePerCall(orgId: number, actionKey: string): Promise<void> {
        if (!CREDITS_ENABLED()) return;
        const price = await this.getActionPrice(actionKey);
        if (!price || price.charge_mode !== 'per_call') return;
        await this.ensureCanAfford(orgId, actionKey);
    }

    // -------------------------------------------------- Ledger writes

    /**
     * Core apply: lock the org wallet row, mutate the balance, write a ledger
     * row, commit. Throws CreditInsufficientError if the balance would go
     * negative.
     */
    private async applyTransaction(
        orgId: number,
        type: CreditTransactionType,
        amount: number,
        source: string,
        opts: {
            actionKey?: string | null;
            actionRefId?: string | null;
            reservationId?: string | null;
            status?: DRACreditTransaction['status'];
            paddleTransactionId?: string | null;
            description?: string | null;
            setMonthlyGrantedAt?: boolean;
            setMonthlyGrantAmount?: number;
            /** Expire the unused monthly pool, computed under the wallet lock. */
            expireMonthlyRemaining?: boolean;
            /** Abort when this UTC month already has a grant (idempotency). */
            skipIfGrantedThisMonth?: boolean;
            /** Abort when a ledger row with this source+type already exists (idempotency). */
            skipIfExistingSource?: { source: string; type: CreditTransactionType };
            /** Member attribution for per-member monthly limits. */
            userId?: number | null;
        } = {}
    ): Promise<number> {
        const dataSource = await getAppDataSource();
        const runner = dataSource.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        try {
            const wallet = await runner.manager
                .createQueryBuilder(DRACreditWallet, 'wallet')
                .setLock('pessimistic_write')
                .where('wallet.org_id = :orgId', { orgId })
                .getOne();
            if (!wallet) {
                throw new Error(`Credit wallet not found for org ${orgId}`);
            }

            // Re-check idempotency under the lock so two concurrent grants (the
            // cron job and a Paddle renewal webhook) cannot both apply.
            if (opts.skipIfGrantedThisMonth && wallet.monthly_credits_granted_at) {
                const last = new Date(wallet.monthly_credits_granted_at);
                const now = new Date();
                if (
                    last.getUTCFullYear() === now.getUTCFullYear() &&
                    last.getUTCMonth() === now.getUTCMonth()
                ) {
                    await runner.rollbackTransaction();
                    return Number(wallet.balance_credits);
                }
            }

            // One-time credits (onboarding bonus) are idempotent on source+type.
            // Checked under the wallet lock so concurrent org-creation paths
            // cannot grant the bonus twice.
            if (opts.skipIfExistingSource) {
                const existing = await runner.manager.findOne(DRACreditTransaction, {
                    where: {
                        org_id: orgId,
                        source: opts.skipIfExistingSource.source,
                        type: opts.skipIfExistingSource.type,
                    },
                });
                if (existing) {
                    await runner.rollbackTransaction();
                    return Number(wallet.balance_credits);
                }
            }

            // Expire only the unused monthly pool. Computed under the lock so a
            // concurrent grant cannot expire the same credits twice.
            let effectiveAmount = amount;
            if (opts.expireMonthlyRemaining) {
                effectiveAmount = -Math.min(
                    Number(wallet.monthly_credits_remaining ?? 0),
                    Number(wallet.balance_credits)
                );
                if (effectiveAmount === 0) {
                    await runner.rollbackTransaction();
                    return Number(wallet.balance_credits);
                }
            }

            const isConsumption = type === 'consume' && effectiveAmount < 0;
            const consumedAmount = isConsumption ? Math.abs(effectiveAmount) : 0;

            // Hard workspace monthly spend cap. Enforced before any balance
            // mutation so a capped workspace can never consume AI.
            if (isConsumption && wallet.spend_cap_credits !== null && wallet.spend_cap_credits !== undefined) {
                const cap = Number(wallet.spend_cap_credits);
                const spent = Number(wallet.monthly_spent_credits ?? 0);
                if (cap >= 0 && spent + consumedAmount > cap) {
                    throw new CreditSpendLimitError('workspace', cap, spent, consumedAmount);
                }
            }

            // Per-member monthly limit (admin-controlled). Only enforced when
            // the caller attributes the consumption to a member.
            if (isConsumption && opts.userId) {
                const memberRepo = runner.manager.getRepository(DRACreditMemberLimit);
                const periodStart = CreditWalletService.currentPeriodStart();
                let limit = await memberRepo.findOne({
                    where: { org_id: orgId, user_id: opts.userId },
                });
                if (!limit) {
                    limit = memberRepo.create({
                        org_id: orgId,
                        user_id: opts.userId,
                        monthly_limit_credits: null,
                        monthly_spent_credits: 0,
                        period_start: periodStart,
                    });
                } else if (String(limit.period_start).slice(0, 10) !== periodStart) {
                    limit.period_start = periodStart;
                    limit.monthly_spent_credits = 0;
                }
                const memberCap =
                    limit.monthly_limit_credits !== null && limit.monthly_limit_credits !== undefined
                        ? Number(limit.monthly_limit_credits)
                        : null;
                if (memberCap !== null && memberCap >= 0) {
                    const used = Number(limit.monthly_spent_credits ?? 0);
                    if (used + consumedAmount > memberCap) {
                        throw new CreditSpendLimitError('member', memberCap, used, consumedAmount);
                    }
                }
                limit.monthly_spent_credits = Number(limit.monthly_spent_credits ?? 0) + consumedAmount;
                await memberRepo.save(limit);
            }

            const newBalance = Number(wallet.balance_credits) + effectiveAmount;
            if (newBalance < 0) {
                throw new CreditInsufficientError(
                    opts.actionKey ?? 'credit_action',
                    -effectiveAmount,
                    Number(wallet.balance_credits)
                );
            }

            const isFirstConsumption = isConsumption && !wallet.first_consumption_at;
            let alertThreshold: 20 | 10 | null = null;
            if (isConsumption) {
                wallet.monthly_spent_credits = Number(wallet.monthly_spent_credits ?? 0) + consumedAmount;
                if (isFirstConsumption) {
                    wallet.first_consumption_at = new Date();
                }
                const baseline = Math.max(1, Number(wallet.monthly_grant_amount ?? 0));
                const ratio = newBalance / baseline;
                if (ratio <= 0.1 && !wallet.low_balance_alert_10_sent_at) {
                    alertThreshold = 10;
                    wallet.low_balance_alert_20_sent_at = wallet.low_balance_alert_20_sent_at ?? new Date();
                    wallet.low_balance_alert_10_sent_at = new Date();
                } else if (ratio <= 0.2 && !wallet.low_balance_alert_20_sent_at) {
                    alertThreshold = 20;
                    wallet.low_balance_alert_20_sent_at = new Date();
                }
            } else if (type === 'release' && effectiveAmount > 0) {
                // A released hold was never spent: give the spend counter back
                // so failed builds do not count against the monthly cap.
                wallet.monthly_spent_credits = Math.max(
                    0,
                    Number(wallet.monthly_spent_credits ?? 0) - effectiveAmount
                );
            }

            wallet.balance_credits = newBalance;
            if (opts.setMonthlyGrantedAt) {
                wallet.monthly_credits_granted_at = new Date();
                wallet.monthly_spent_credits = 0;
                wallet.low_balance_alert_20_sent_at = null;
                wallet.low_balance_alert_10_sent_at = null;
            }
            if (opts.setMonthlyGrantAmount !== undefined) {
                wallet.monthly_grant_amount = opts.setMonthlyGrantAmount;
            }
            // Monthly-pool accounting: grants add to the pool, consumption and
            // expiration draw it down, releases restore it. Pack purchases,
            // refunds and support adjustments never touch the monthly pool.
            if (type === 'grant' || type === 'expire' || type === 'consume' || type === 'release') {
                wallet.monthly_credits_remaining = Math.max(
                    0,
                    Number(wallet.monthly_credits_remaining ?? 0) + effectiveAmount
                );
            }
            await runner.manager.save(wallet);

            const tx = runner.manager.create(DRACreditTransaction, {
                org_id: orgId,
                type,
                amount: effectiveAmount,
                source,
                action_key: opts.actionKey ?? null,
                action_ref_id: opts.actionRefId ?? null,
                reservation_id: opts.reservationId ?? null,
                status: opts.status ?? 'settled',
                paddle_transaction_id: opts.paddleTransactionId ?? null,
                description: opts.description ?? null,
            });
            await runner.manager.save(tx);

            await runner.commitTransaction();

            // Push the new balance to the org's connected members so the header
            // counter and wallet panel update without a page refresh.
            void this.notifyCreditsUpdate(orgId, newBalance);

            // Low-balance email/in-app alerts (20% and 10% of the monthly
            // allowance). Fire-and-forget; never block metering.
            if (alertThreshold !== null) {
                void this.dispatchLowBalanceAlert(orgId, newBalance, alertThreshold);
            }

            // Credit funnel instrumentation (best effort).
            if (type === 'grant') {
                this.trackEvent('credit_granted', orgId, { amount: effectiveAmount });
            } else if (type === 'purchase') {
                this.trackEvent('credit_pack_purchased', orgId, { amount: effectiveAmount });
            } else if (isFirstConsumption) {
                this.trackEvent('credit_first_consumption', orgId, {
                    action_key: opts.actionKey ?? null,
                    amount: consumedAmount,
                });
            } else if (isConsumption && newBalance <= 0) {
                this.trackEvent('credit_exhausted', orgId, {
                    action_key: opts.actionKey ?? null,
                });
            }

            // Low-balance hook: only on spend (consume/reserve), never on
            // grants/purchases. Fire-and-forget so metering is never blocked by
            // a Paddle call.
            if (type === 'consume' && this.autoRechargeTrigger) {
                const threshold = wallet.auto_recharge_threshold;
                if (threshold !== null && threshold !== undefined && newBalance < Number(threshold)) {
                    void Promise.resolve(this.autoRechargeTrigger(orgId)).catch((err) => {
                        console.warn(
                            '[CreditWallet] Auto-recharge trigger failed (non-fatal):',
                            (err as Error)?.message
                        );
                    });
                }
            }

            return newBalance;
        } catch (error) {
            await runner.rollbackTransaction();
            throw error;
        } finally {
            await runner.release();
        }
    }

    // -------------------------------------------------- Monthly grant

    /**
     * Emit a `credits:update` socket event to the org's connected members.
     * Member ids are cached briefly because per-call charges can be frequent.
     */
    private async notifyCreditsUpdate(orgId: number, balance: number): Promise<void> {
        try {
            let cached = this.memberCache.get(orgId);
            if (!cached || Date.now() - cached.at > CreditWalletService.MEMBER_CACHE_TTL_MS) {
                const { getAppDataSource } = await import('../datasources/PostgresDS.js');
                const { DRAOrganizationMember } = await import('../models/DRAOrganizationMember.js');
                const dataSource = await getAppDataSource();
                const members = await dataSource.getRepository(DRAOrganizationMember).find({
                    where: { organization_id: orgId, is_active: true },
                    select: ['users_platform_id'],
                });
                cached = {
                    ids: members.map((m) => m.users_platform_id),
                    at: Date.now(),
                };
                this.memberCache.set(orgId, cached);
            }
            if (cached.ids.length === 0) return;

            const { SocketIODriver } = await import('../drivers/SocketIODriver.js');
            const driver = SocketIODriver.getInstance();
            for (const userId of cached.ids) {
                void driver
                    .emitToUser(userId, 'credits:update', { orgId, balance })
                    .catch(() => undefined);
            }
        } catch (err) {
            console.warn('[CreditWallet] Failed to emit credits:update (non-fatal):', (err as Error)?.message);
        }
    }

    /** UTC first-of-month as YYYY-MM-DD, used by per-member period counters. */
    private static currentPeriodStart(): string {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
            .toISOString()
            .slice(0, 10);
    }

    /** Best-effort credit funnel event; analytics must never break metering. */
    private trackEvent(name: string, orgId: number, properties: Record<string, any>): void {
        void import('./ProductAnalyticsService.js')
            .then(({ ProductAnalyticsService }) =>
                ProductAnalyticsService.getInstance().record({
                    eventName: name,
                    organizationId: orgId,
                    properties,
                    source: 'backend',
                })
            )
            .catch((err) =>
                console.warn('[CreditWallet] Credit funnel event failed (non-fatal):', (err as Error)?.message)
            );
    }

    /**
     * Send a low-balance email and in-app socket alert to the org's owners and
     * admins. Fire-and-forget: alerts never block or fail a charge.
     */
    private async dispatchLowBalanceAlert(
        orgId: number,
        balance: number,
        threshold: 20 | 10
    ): Promise<void> {
        try {
            const dataSource = await getAppDataSource();
            const { DRAOrganizationMember } = await import('../models/DRAOrganizationMember.js');
            const members = await dataSource.getRepository(DRAOrganizationMember).find({
                where: { organization_id: orgId, is_active: true },
                relations: ['user'],
            });
            const recipients = members.filter(
                (m) => (m.role === 'owner' || m.role === 'admin') && m.user?.email
            );
            if (recipients.length === 0) return;

            const { SocketIODriver } = await import('../drivers/SocketIODriver.js');
            const driver = SocketIODriver.getInstance();
            const payload = { orgId, balance, threshold };
            for (const member of recipients) {
                void driver
                    .emitToUser(member.users_platform_id, 'credits:low_balance', payload)
                    .catch(() => undefined);
            }

            const { EmailService } = await import('./EmailService.js');
            const { UtilityService } = await import('./UtilityService.js');
            const billingUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000'}/billing`;
            const html = `
                <p>Your workspace credit balance is low.</p>
                <p><strong>${Math.round(balance).toLocaleString()} credits</strong> remaining
                   (${threshold}% threshold reached).</p>
                <p>AI actions and plan builds pause when the balance reaches zero.
                   Top up a credit pack or increase your monthly credits to keep working.</p>
                <p><a href="${billingUrl}">Manage credits</a></p>
            `;
            for (const member of recipients) {
                void EmailService.getInstance()
                    .sendEmail({
                        to: member.user!.email,
                        subject:
                            threshold === 10
                                ? 'Only 10% of your workspace credits remain'
                                : 'Only 20% of your workspace credits remain',
                        html,
                    })
                    .catch(() => undefined);
            }
        } catch (err) {
            console.warn('[CreditWallet] Low-balance alert failed (non-fatal):', (err as Error)?.message);
        }
    }

    /** Resolve the org's active subscription tier and variable-credit override. */
    private async resolveBillingForOrg(        orgId: number
    ): Promise<{ tier: DRASubscriptionTier | null; override: number | null }> {
        const dataSource = await getAppDataSource();
        const org = await dataSource
            .getRepository(DRAOrganization)
            .findOne({
                where: { id: orgId },
                relations: ['subscription', 'subscription.subscription_tier'],
            });
        const subscription = org?.subscription;
        if (!subscription || !subscription.is_active) {
            return { tier: null, override: null };
        }
        return {
            tier: subscription.subscription_tier ?? null,
            override:
                subscription.credits_per_month_override !== null &&
                subscription.credits_per_month_override !== undefined
                    ? Number(subscription.credits_per_month_override)
                    : null,
        };
    }

    /**
     * Idempotent per UTC month: applies the monthly credit grant once per month.
     *
     * Grant amount comes from the per-subscription override (variable-credit
     * Pro), otherwise the tier's credits_per_month, otherwise the Free default.
     * Tiers without a configured allowance (0, e.g. ENTERPRISE custom) and no
     * override are admin-managed and skipped. When the tier does not roll over
     * (FREE), only the unused part of the previous monthly grant is expired —
     * purchased pack credits are preserved.
     */
    public async grantMonthly(orgId: number, amount?: number): Promise<number> {
        const wallet = await this.getWallet(orgId);
        const now = new Date();
        const grantedThisMonth =
            wallet.monthly_credits_granted_at !== null &&
            wallet.monthly_credits_granted_at !== undefined &&
            (() => {
                const last = new Date(wallet.monthly_credits_granted_at);
                return (
                    last.getUTCFullYear() === now.getUTCFullYear() &&
                    last.getUTCMonth() === now.getUTCMonth()
                );
            })();

        const { tier, override } = await this.resolveBillingForOrg(orgId);
        const tierGrant = tier ? Number(tier.credits_per_month) : 0;
        const grant = amount ?? override ?? (tier ? tierGrant : DEFAULT_MONTHLY_GRANT);
        if (!Number.isFinite(grant) || grant <= 0) {
            // Custom tier with no configured allowance — admin-managed.
            return Number(wallet.balance_credits);
        }

        // Already granted this month: only continue when the allowance itself
        // changed (upgrade/downgrade). A Paddle upgrade mid-month must not wait
        // for the next calendar month, but duplicate webhooks for the same
        // allowance stay no-ops.
        if (grantedThisMonth) {
            if (Number(wallet.monthly_grant_amount) === Number(grant)) {
                return Number(wallet.balance_credits);
            }
        }

        // Non-rollover tiers (FREE, or orgs without a subscription): expire the
        // unused monthly grant before applying the new one. Pack credits are
        // never expired. A mid-month allowance change (upgrade/downgrade) also
        // resets the monthly pool to the new volume so allowances never stack.
        const rollover = grantedThisMonth
            ? false
            : (tier ? Boolean(tier.credits_rollover) : false);
        if (!rollover) {
            await this.applyTransaction(orgId, 'expire', 0, 'subscription_month', {
                description: 'Previous monthly grant expired (non-rollover plan)',
                expireMonthlyRemaining: true,
            });
        }

        return this.applyTransaction(orgId, 'grant', grant, 'subscription_month', {
            description: grantedThisMonth ? 'Monthly credit grant (plan change)' : 'Monthly credit grant',
            setMonthlyGrantedAt: true,
            setMonthlyGrantAmount: grant,
            // Concurrency guard only on the normal path; a plan change is
            // intentionally allowed to re-grant within the month.
            skipIfGrantedThisMonth: !grantedThisMonth,
        });
    }

    /**
     * One-time onboarding bonus for a new Free workspace (granted at org
     * creation, after the first monthly grant). Idempotent per org.
     *
     * Written as type `bonus`, which is not part of the monthly pool, so the
     * unused part survives the next month's non-rollover expiry.
     */
    public async grantOnboardingBonus(
        orgId: number,
        amount: number = ONBOARDING_BONUS_CREDITS
    ): Promise<number> {
        await this.getWallet(orgId);
        const { tier } = await this.resolveBillingForOrg(orgId);
        const isFree =
            !tier ||
            (Number(tier.tier_rank) <= 0 && /free/i.test(String(tier.tier_name ?? '')));
        if (!isFree) {
            return this.getBalance(orgId);
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            return this.getBalance(orgId);
        }
        return this.applyTransaction(orgId, 'bonus', amount, 'onboarding', {
            description: 'One-time onboarding bonus',
            skipIfExistingSource: { source: 'onboarding', type: 'bonus' },
        });
    }

    // -------------------------------------------------- Consumption
    /** Immediate per-call/per-action charge (no hold). */
    public async consume(
        orgId: number,
        actionKey: string,
        opts: IConsumeOptions = {}
    ): Promise<IConsumeResult> {
        if (!CREDITS_ENABLED()) return { credits: 0, balance: await this.getBalance(orgId) };
        const credits = await this.creditsFor(actionKey, opts.bandIndex);
        if (credits <= 0) return { credits: 0, balance: await this.getBalance(orgId) };
        const balance = await this.applyTransaction(
            orgId,
            'consume',
            -credits,
            actionKey === 'plan_build' ? 'plan_build' : 'system',
            {
                actionKey,
                actionRefId: opts.actionRefId ?? null,
                description: opts.description ?? `Consumed by ${actionKey}`,
                userId: opts.userId ?? null,
            }
        );
        return { credits, balance };
    }

    /**
     * Reserve credits for a multi-step action. Decrements the balance and
     * marks the ledger row 'reserved'. Returns a reservation id.
     */
    public async reserve(
        orgId: number,
        actionKey: string,
        actionRefId: string,
        bandIndex?: number,
        userId?: number | null
    ): Promise<IConsumeResult> {
        if (!CREDITS_ENABLED()) return { credits: 0, balance: await this.getBalance(orgId) };
        const credits = await this.creditsFor(actionKey, bandIndex);
        if (credits <= 0) return { credits: 0, balance: await this.getBalance(orgId) };
        const reservationId = randomUUID();
        const balance = await this.applyTransaction(
            orgId,
            'consume',
            -credits,
            actionKey === 'plan_build' ? 'plan_build' : 'system',
            {
                actionKey,
                actionRefId,
                reservationId,
                status: 'reserved',
                description: `Reserved for ${actionKey} (${actionRefId})`,
                userId: userId ?? null,
            }
        );
        return { credits, balance, reservationId };
    }

    /** Settle a reservation (charge becomes final). */
    public async settle(orgId: number, actionKey: string, actionRefId: string): Promise<number> {
        if (!CREDITS_ENABLED()) return 0;
        const dataSource = await getAppDataSource();
        const repo = dataSource.getRepository(DRACreditTransaction);
        const reserved = await repo.findOne({
            where: { action_key: actionKey, action_ref_id: actionRefId, status: 'reserved' },
            order: { id: 'DESC' },
        });
        if (!reserved) return 0;
        reserved.status = 'settled';
        await repo.save(reserved);
        return Number(reserved.amount);
    }

    /** Release a reservation on failure — credits are returned (0 charged). */
    public async release(orgId: number, actionKey: string, actionRefId: string): Promise<number> {
        if (!CREDITS_ENABLED()) return 0;
        const dataSource = await getAppDataSource();
        const repo = dataSource.getRepository(DRACreditTransaction);
        const reserved = await repo.findOne({
            where: { action_key: actionKey, action_ref_id: actionRefId, status: 'reserved' },
            order: { id: 'DESC' },
        });
        if (!reserved) return 0;
        const credits = Number(reserved.amount);
        const balance = await this.applyTransaction(
            orgId,
            'release',
            -credits,
            'plan_build',
            {
                reservationId: reserved.reservation_id ?? undefined,
                description: `Released reservation for ${actionKey} (${actionRefId})`,
            }
        );
        reserved.status = 'released';
        await repo.save(reserved);
        return balance;
    }

    /**
     * Idempotent reservation for an action ref: reuses an existing active
     * reservation instead of holding twice.
     */
    public async ensureReserved(
        orgId: number,
        actionKey: string,
        actionRefId: string,
        bandIndex?: number,
        userId?: number | null
    ): Promise<IConsumeResult> {
        const dataSource = await getAppDataSource();
        const existing = await dataSource
            .getRepository(DRACreditTransaction)
            .findOne({
                where: { action_key: actionKey, action_ref_id: actionRefId, status: 'reserved' },
                order: { id: 'DESC' },
            });
        if (existing) {
            return {
                credits: Number(existing.amount),
                balance: await this.getBalance(orgId),
                reservationId: existing.reservation_id ?? undefined,
            };
        }
        return this.reserve(orgId, actionKey, actionRefId, bandIndex, userId);
    }

    // -------------------------------------------------- Purchase / refund / adjust

    /** Credit a pack purchase. Idempotent on paddle_transaction_id. */
    public async purchase(
        orgId: number,
        packId: number,
        opts: { paddleTransactionId?: string | null; description?: string } = {}
    ): Promise<IConsumeResult> {
        const dataSource = await getAppDataSource();
        if (opts.paddleTransactionId) {
            const existing = await dataSource
                .getRepository(DRACreditTransaction)
                .findOne({ where: { paddle_transaction_id: opts.paddleTransactionId } });
            if (existing) {
                return { credits: Number(existing.amount), balance: await this.getBalance(orgId) };
            }
        }
        const pack = await dataSource.getRepository(DRACreditPack).findOne({ where: { id: packId } });
        if (!pack) {
            throw new Error(`Credit pack not found: ${packId}`);
        }
        const balance = await this.applyTransaction(
            orgId,
            'purchase',
            Number(pack.credits),
            'pack',
            {
                paddleTransactionId: opts.paddleTransactionId ?? null,
                description: opts.description ?? `Purchased ${pack.name}`,
            }
        );
        return { credits: Number(pack.credits), balance };
    }

    /** Support/admin adjustment (signed). Negative must be covered by balance. */
    public async adjust(orgId: number, amount: number, description: string): Promise<number> {
        if (amount === 0) return this.getBalance(orgId);
        return this.applyTransaction(orgId, 'adjust', amount, 'support', { description });
    }

    /** Refund credits (pack refund / incorrect charge). */
    public async refund(
        orgId: number,
        amount: number,
        description: string,
        paddleTransactionId?: string | null
    ): Promise<number> {
        if (amount <= 0) throw new Error('Refund amount must be positive');
        return this.applyTransaction(orgId, 'refund', amount, 'refund', {
            paddleTransactionId: paddleTransactionId ?? null,
            description,
        });
    }

    /** Look up the wallet ledger row for an original Paddle purchase. */
    public async findPurchaseByPaddleTransaction(
        paddleTransactionId: string
    ): Promise<DRACreditTransaction | null> {
        const dataSource = await getAppDataSource();
        return dataSource.getRepository(DRACreditTransaction).findOne({
            where: { paddle_transaction_id: paddleTransactionId, type: 'purchase' },
        });
    }

    /**
     * Reverse a pack purchase when Paddle issues a refund/chargeback.
     *
     * Debits the credits the purchase added, clamped to the current balance so
     * the wallet can never go negative (already-spent credits are a financial
     * loss, not a negative wallet). Idempotent on the Paddle adjustment id: a
     * replayed `adjustment.updated` cannot reverse twice.
     *
     * Returns the balance after the reversal and the credits actually removed.
     */
    public async reversePurchase(
        orgId: number,
        credits: number,
        opts: {
            paddleAdjustmentId?: string | null;
            originalTransactionId?: string | null;
            description?: string;
        } = {}
    ): Promise<{ balance: number; reversed: number }> {
        if (!Number.isFinite(credits) || credits <= 0) {
            return { balance: await this.getBalance(orgId), reversed: 0 };
        }
        const dataSource = await getAppDataSource();
        if (opts.paddleAdjustmentId) {
            const existing = await dataSource.getRepository(DRACreditTransaction).findOne({
                where: { paddle_transaction_id: opts.paddleAdjustmentId, type: 'refund' },
            });
            if (existing) {
                return { balance: await this.getBalance(orgId), reversed: 0 };
            }
        }

        const balance = await this.getBalance(orgId);
        const reversed = Math.min(credits, Math.max(0, balance));
        if (reversed <= 0) {
            console.warn(
                `[CreditWallet] Pack refund for org ${orgId} found no spendable credits to reverse (refund ${credits})`
            );
            return { balance, reversed: 0 };
        }
        if (reversed < credits) {
            console.warn(
                `[CreditWallet] Partial pack refund reversal for org ${orgId}: ${reversed} of ${credits} credits still in balance`
            );
        }

        const newBalance = await this.applyTransaction(orgId, 'refund', -reversed, 'refund', {
            paddleTransactionId: opts.paddleAdjustmentId ?? null,
            actionRefId: opts.originalTransactionId ?? null,
            description:
                opts.description ??
                `Reversed ${reversed} credits from pack purchase ${opts.originalTransactionId ?? ''}`.trim(),
        });
        return { balance: newBalance, reversed };
    }
}

