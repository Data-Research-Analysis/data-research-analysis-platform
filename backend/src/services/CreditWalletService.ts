import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRACreditWallet } from '../models/DRACreditWallet.js';
import { DRACreditTransaction, CreditTransactionType } from '../models/DRACreditTransaction.js';
import { DRACreditPack } from '../models/DRACreditPack.js';
import { DRAActionPrice } from '../models/DRAActionPrice.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { CreditInsufficientError } from '../types/CreditInsufficientError.js';
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

export interface IConsumeOptions {
    actionRefId?: string | null;
    bandIndex?: number;
    description?: string;
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

    public async setAutoRecharge(
        orgId: number,
        threshold: number,
        packId: number | null
    ): Promise<DRACreditWallet> {
        const wallet = await this.getWallet(orgId);
        wallet.auto_recharge_threshold = threshold;
        wallet.auto_recharge_pack_id = packId;
        const dataSource = await getAppDataSource();
        return dataSource.getRepository(DRACreditWallet).save(wallet);
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

            const newBalance = Number(wallet.balance_credits) + effectiveAmount;
            if (newBalance < 0) {
                throw new CreditInsufficientError(
                    opts.actionKey ?? 'credit_action',
                    -effectiveAmount,
                    Number(wallet.balance_credits)
                );
            }

            wallet.balance_credits = newBalance;
            if (opts.setMonthlyGrantedAt) {
                wallet.monthly_credits_granted_at = new Date();
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
        bandIndex?: number
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
        bandIndex?: number
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
        return this.reserve(orgId, actionKey, actionRefId, bandIndex);
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
}

