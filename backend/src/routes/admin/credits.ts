import { Router, Request, Response } from 'express';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRACreditWallet } from '../../models/DRACreditWallet.js';
import { DRACreditTransaction } from '../../models/DRACreditTransaction.js';
import { DRACreditPack } from '../../models/DRACreditPack.js';
import { DRAOrganization } from '../../models/DRAOrganization.js';
import { DRAOrganizationSubscription } from '../../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { DRAActionPrice } from '../../models/DRAActionPrice.js';
import { CreditWalletService } from '../../services/CreditWalletService.js';
import { CreditPaddleSyncService } from '../../services/CreditPaddleSyncService.js';
import { PaddleService } from '../../services/PaddleService.js';
import { CreditCheckoutService } from '../../processors/CreditCheckoutService.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';

const router = Router();
const walletService = CreditWalletService.getInstance();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ error: 'Forbidden — Admin access required' });
    }
    next();
}

router.use(validateJWT, requireAdmin);

/**
 * GET /admin/credits/overview — every organization with its wallet balance.
 *
 * Orgs are the source of truth, not wallets: wallets are created lazily on
 * first grant/consumption, so a Free user who has never signed in has no
 * wallet row and used to be missing from this table. Listing orgs (with a
 * LEFT JOIN-style map) shows everyone, including orgs whose wallet has not
 * been created yet, with a 0 balance.
 */
router.get('/overview', async (req: Request, res: Response) => {
    try {
        const organizations = await AppDataSource.getRepository(DRAOrganization).find({
            select: ['id', 'name'],
            where: { is_active: true },
            order: { id: 'ASC' },
        });
        const wallets = await AppDataSource.getRepository(DRACreditWallet).find();
        const walletByOrg = new Map(wallets.map((w) => [w.org_id, w]));
        // Billing context so the admin table shows the plan next to the wallet.
        const subscriptions = await AppDataSource.getRepository(DRAOrganizationSubscription).find();
        const tiers = await AppDataSource.getRepository(DRASubscriptionTier).find();
        const subByOrg = new Map(subscriptions.map((s) => [s.organization_id, s]));
        const tierById = new Map(tiers.map((t) => [t.id, t]));
        const rows = organizations.map((org) => {
            const w = walletByOrg.get(org.id);
            const sub = subByOrg.get(org.id);
            const tier = sub ? tierById.get(sub.subscription_tier_id) ?? null : null;
            return {
                org_id: org.id,
                org_name: org.name,
                has_wallet: Boolean(w),
                tier_id: sub?.subscription_tier_id ?? null,
                tier_name: tier?.tier_name ?? null,
                billing_cycle: sub?.billing_cycle ?? null,
                credits_per_month_override:
                    sub?.credits_per_month_override !== null && sub?.credits_per_month_override !== undefined
                        ? Number(sub.credits_per_month_override)
                        : null,
                subscription_is_active: sub?.is_active ?? false,
                cancelled_at: sub?.cancelled_at ?? null,
                ends_at: sub?.ends_at ?? null,
                grace_period_ends_at: sub?.grace_period_ends_at ?? null,
                paddle_subscription_id: sub?.paddle_subscription_id ?? null,
                price_per_month_usd: tier ? Number(tier.price_per_month_usd) : null,
                price_per_year_usd: tier ? Number(tier.price_per_year_usd) : null,
                balance_credits: Number(w?.balance_credits ?? 0),
                rollover_balance: Number(w?.rollover_balance ?? 0),
                monthly_credits_remaining: Number(w?.monthly_credits_remaining ?? 0),
                monthly_grant_amount: Number(w?.monthly_grant_amount ?? 500),
                monthly_credits_granted_at: w?.monthly_credits_granted_at ?? null,
                auto_recharge_threshold:
                    w?.auto_recharge_threshold !== null && w?.auto_recharge_threshold !== undefined
                        ? Number(w.auto_recharge_threshold)
                        : null,
                auto_recharge_pack_id: w?.auto_recharge_pack_id ?? null,
                currency: w?.currency ?? 'USD',
            };
        });
        rows.sort((a, b) => b.balance_credits - a.balance_credits);
        res.json({
            success: true,
            data: {
                credits_enabled: CreditWalletService.isEnabled(),
                wallets: rows,
            },
        });
    } catch (error: any) {
        console.error('[GET /admin/credits/overview]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** GET /admin/credits/org/:orgId — wallet + ledger for one org. */
router.get('/org/:orgId', async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.orgId, 10);
        if (!orgId) {
            res.status(400).json({ success: false, error: 'orgId is required' });
            return;
        }
        const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10), 500);
        const { wallet, transactions } = await walletService.getWalletWithLedger(orgId, limit);
        const organization = await AppDataSource.getRepository(DRAOrganization).findOne({
            where: { id: orgId },
            select: ['id', 'name'],
        });
        const subscription = await AppDataSource.getRepository(DRAOrganizationSubscription).findOne({
            where: { organization_id: orgId },
        });
        const tier = subscription
            ? await AppDataSource.getRepository(DRASubscriptionTier).findOne({
                  where: { id: subscription.subscription_tier_id },
              })
            : null;
        res.json({
            success: true,
            data: {
                org_id: orgId,
                org_name: organization?.name ?? null,
                subscription: subscription
                    ? {
                          tier_id: subscription.subscription_tier_id,
                          tier_name: tier?.tier_name ?? null,
                          billing_cycle: subscription.billing_cycle,
                          credits_per_month_override:
                              subscription.credits_per_month_override !== null && subscription.credits_per_month_override !== undefined
                                  ? Number(subscription.credits_per_month_override)
                                  : null,
                          is_active: subscription.is_active,
                          cancelled_at: subscription.cancelled_at,
                          ends_at: subscription.ends_at,
                          grace_period_ends_at: subscription.grace_period_ends_at,
                          paddle_subscription_id: subscription.paddle_subscription_id,
                          paddle_customer_id: subscription.paddle_customer_id,
                          price_per_month_usd: tier ? Number(tier.price_per_month_usd) : null,
                          price_per_year_usd: tier ? Number(tier.price_per_year_usd) : null,
                      }
                    : null,
                wallet: {
                    balance_credits: Number(wallet.balance_credits),
                    rollover_balance: Number(wallet.rollover_balance),
                    monthly_credits_remaining: Number(wallet.monthly_credits_remaining),
                    monthly_grant_amount: Number(wallet.monthly_grant_amount),
                    monthly_credits_granted_at: wallet.monthly_credits_granted_at,
                    auto_recharge_threshold: wallet.auto_recharge_threshold !== null ? Number(wallet.auto_recharge_threshold) : null,
                    auto_recharge_pack_id: wallet.auto_recharge_pack_id,
                    currency: wallet.currency,
                },
                transactions: transactions.map((t) => ({
                    id: t.id,
                    type: t.type,
                    amount: Number(t.amount),
                    source: t.source,
                    action_key: t.action_key,
                    action_ref_id: t.action_ref_id,
                    reservation_id: t.reservation_id,
                    status: t.status,
                    paddle_transaction_id: t.paddle_transaction_id,
                    description: t.description,
                    created_at: t.created_at,
                })),
            },
        });
    } catch (error: any) {
        console.error('[GET /admin/credits/org/:orgId]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** GET /admin/credits/action-prices — the pricing table. */
router.get('/action-prices', async (req: Request, res: Response) => {
    try {
        const prices = await AppDataSource.getRepository(DRAActionPrice).find({
            order: { action_key: 'ASC' },
        });
        res.json({
            success: true,
            data: prices.map((p) => ({
                id: p.id,
                action_key: p.action_key,
                display_name: p.display_name,
                credits: Number(p.credits),
                charge_mode: p.charge_mode,
                band_type: p.band_type,
                band_multipliers: p.band_multipliers,
                is_active: p.is_active,
            })),
        });
    } catch (error: any) {
        console.error('[GET /admin/credits/action-prices]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** PUT /admin/credits/action-prices/:id — edit a price. */
router.put('/action-prices/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const repo = AppDataSource.getRepository(DRAActionPrice);
        const price = await repo.findOne({ where: { id } });
        if (!price) {
            res.status(404).json({ success: false, error: 'Action price not found' });
            return;
        }
        const { display_name, credits, charge_mode, band_type, band_multipliers, is_active } = req.body ?? {};
        if (display_name !== undefined) price.display_name = String(display_name);
        if (credits !== undefined) price.credits = Number(credits);
        if (charge_mode !== undefined) price.charge_mode = charge_mode === 'per_call' ? 'per_call' : 'per_action';
        if (band_type !== undefined) price.band_type = band_type === 'row_band' || band_type === 'event_band' ? band_type : 'fixed';
        if (band_multipliers !== undefined) price.band_multipliers = Array.isArray(band_multipliers) ? band_multipliers.map(Number) : null;
        if (is_active !== undefined) price.is_active = Boolean(is_active);
        await repo.save(price);
        res.json({ success: true, data: { id: price.id, action_key: price.action_key, credits: Number(price.credits) } });
    } catch (error: any) {
        console.error('[PUT /admin/credits/action-prices/:id]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** GET /admin/credits/packs — pack catalog. */
router.get('/packs', async (req: Request, res: Response) => {
    try {
        const packs = await AppDataSource.getRepository(DRACreditPack).find({
            order: { sort_order: 'ASC', id: 'ASC' },
        });
        res.json({
            success: true,
            data: packs.map((p) => ({
                id: p.id,
                name: p.name,
                credits: Number(p.credits),
                price_usd: Number(p.price_usd),
                paddle_price_id: p.paddle_price_id,
                is_active: p.is_active,
                sort_order: p.sort_order,
            })),
        });
    } catch (error: any) {
        console.error('[GET /admin/credits/packs]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** POST /admin/credits/packs — create a pack. */
router.post('/packs', async (req: Request, res: Response) => {
    try {
        const { name, credits, price_usd, paddle_price_id, is_active, sort_order } = req.body ?? {};
        if (!name || !credits || !price_usd) {
            res.status(400).json({ success: false, error: 'name, credits and price_usd are required' });
            return;
        }
        const pack = AppDataSource.getRepository(DRACreditPack).create({
            name: String(name),
            credits: Number(credits),
            price_usd: Number(price_usd),
            paddle_price_id: paddle_price_id ? String(paddle_price_id) : null,
            is_active: is_active !== undefined ? Boolean(is_active) : true,
            sort_order: sort_order !== undefined ? Number(sort_order) : 0,
        });
        await AppDataSource.getRepository(DRACreditPack).save(pack);
        res.status(201).json({ success: true, data: { id: pack.id } });
    } catch (error: any) {
        console.error('[POST /admin/credits/packs]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** PUT /admin/credits/packs/:id — update a pack. */
router.put('/packs/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const repo = AppDataSource.getRepository(DRACreditPack);
        const pack = await repo.findOne({ where: { id } });
        if (!pack) {
            res.status(404).json({ success: false, error: 'Pack not found' });
            return;
        }
        const { name, credits, price_usd, paddle_price_id, is_active, sort_order } = req.body ?? {};
        if (name !== undefined) pack.name = String(name);
        if (credits !== undefined) pack.credits = Number(credits);
        if (price_usd !== undefined) pack.price_usd = Number(price_usd);
        if (paddle_price_id !== undefined) pack.paddle_price_id = paddle_price_id ? String(paddle_price_id) : null;
        if (is_active !== undefined) pack.is_active = Boolean(is_active);
        if (sort_order !== undefined) pack.sort_order = Number(sort_order);
        await repo.save(pack);
        res.json({ success: true, data: { id: pack.id } });
    } catch (error: any) {
        console.error('[PUT /admin/credits/packs/:id]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** POST /admin/credits/org/:orgId/adjust — support credit adjustment (signed). */
router.post('/org/:orgId/adjust', async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.orgId, 10);
        const { amount, description } = req.body ?? {};
        if (!orgId || amount === undefined || !description) {
            res.status(400).json({ success: false, error: 'orgId, amount and description are required' });
            return;
        }
        const balance = await walletService.adjust(orgId, Number(amount), String(description));
        res.json({ success: true, data: { org_id: orgId, balance_credits: balance } });
    } catch (error: any) {
        console.error('[POST /admin/credits/org/:orgId/adjust]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** POST /admin/credits/org/:orgId/grant — apply (or re-apply) the monthly grant. */
router.post('/org/:orgId/grant', async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.orgId, 10);
        if (!orgId) {
            res.status(400).json({ success: false, error: 'orgId is required' });
            return;
        }
        const { amount } = req.body ?? {};
        const balance = await walletService.grantMonthly(orgId, amount !== undefined ? Number(amount) : undefined);
        res.json({ success: true, data: { org_id: orgId, balance_credits: balance } });
    } catch (error: any) {
        console.error('[POST /admin/credits/org/:orgId/grant]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/credits/paddle-sync-packs
 * Create/backfill the Paddle "Credit Packs" product and one-time prices, then
 * store the price IDs on dra_credit_packs. Sandbox first (§8).
 */
router.post('/paddle-sync-packs', async (req: Request, res: Response) => {
    try {
        const paddle = PaddleService.getInstance().getPaddleClient();
        const results = await CreditPaddleSyncService.getInstance().sync(paddle);
        res.json({ success: true, data: results });
    } catch (error: any) {
        console.error('[POST /admin/credits/paddle-sync-packs]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/credits/paddle-sync-pro-credits
 * Create/backfill the Paddle "Pro Credits" product and the two recurring
 * per-1,000-credit prices, then store the price IDs on the PROFESSIONAL tier.
 * Sandbox first (§8).
 */
router.post('/paddle-sync-pro-credits', async (req: Request, res: Response) => {
    try {
        const paddle = PaddleService.getInstance().getPaddleClient();
        const results = await CreditPaddleSyncService.getInstance().syncProCredits(paddle);
        res.json({ success: true, data: results });
    } catch (error: any) {
        console.error('[POST /admin/credits/paddle-sync-pro-credits]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/credits/org/:orgId/recharge
 * Manually trigger the auto-recharge check for an org (sandbox validation of
 * the saved-payment-method charge before it runs on a schedule).
 */
router.post('/org/:orgId/recharge', async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.orgId, 10);
        if (!orgId) {
            res.status(400).json({ success: false, error: 'orgId is required' });
            return;
        }
        const result = await CreditCheckoutService.getInstance().maybeAutoRecharge(orgId);
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[POST /admin/credits/org/:orgId/recharge]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** PUT /admin/credits/org/:orgId/auto-recharge — set/clear auto-recharge from the admin console. */
router.put('/org/:orgId/auto-recharge', async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.orgId, 10);
        if (!orgId) {
            res.status(400).json({ success: false, error: 'orgId is required' });
            return;
        }
        const threshold = parseFloat(req.body.threshold);
        const packId =
            req.body.packId !== null && req.body.packId !== undefined && req.body.packId !== ''
                ? parseInt(req.body.packId, 10)
                : null;
        if (Number.isNaN(threshold) || threshold < 0) {
            res.status(400).json({ success: false, error: 'threshold must be a non-negative number' });
            return;
        }
        if (packId !== null) {
            const pack = await AppDataSource.getRepository(DRACreditPack).findOne({
                where: { id: packId, is_active: true },
            });
            if (!pack) {
                res.status(400).json({ success: false, error: 'Credit pack not found or inactive' });
                return;
            }
        }
        const wallet = await CreditWalletService.getInstance().setAutoRecharge(orgId, threshold, packId);
        res.json({
            success: true,
            data: {
                org_id: orgId,
                threshold: wallet.auto_recharge_threshold !== null ? Number(wallet.auto_recharge_threshold) : null,
                pack_id: wallet.auto_recharge_pack_id,
            },
        });
    } catch (error: any) {
        console.error('[PUT /admin/credits/org/:orgId/auto-recharge]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
