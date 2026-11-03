import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { expensiveOperationsLimiter } from '../middleware/rateLimit.js';
import { CreditCheckoutService, PackPurchaseForbiddenError } from '../processors/CreditCheckoutService.js';
import { CreditWalletService } from '../services/CreditWalletService.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { getAppDataSource } from '../datasources/PostgresDS.js';

const router = express.Router();
const checkout = CreditCheckoutService.getInstance();
const walletService = CreditWalletService.getInstance();

async function assertOrgAdmin(userId: number, orgId: number): Promise<void> {
    const member = await (await getAppDataSource()).getRepository(DRAOrganizationMember).findOne({
        where: { organization_id: orgId, users_platform_id: userId, is_active: true },
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        const error: any = new Error('Only workspace owners or admins can change credit limits');
        error.statusCode = 403;
        throw error;
    }
}

/**
 * GET /credits/balance — workspace credit balance + recent ledger.
 * Credits are pooled at the org level; per-user attribution is visible in the
 * ledger rows (action/user attribution from ai_call_logs).
 */
router.get('/balance', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const orgId = await checkout.resolveOrgId(userId);
        if (!orgId) {
            res.status(404).json({ success: false, error: 'No organization found for user' });
            return;
        }
        const { wallet, transactions } = await walletService.getWalletWithLedger(orgId, 50);
        res.json({
            success: true,
            data: {
                org_id: orgId,
                credits_enabled: CreditWalletService.isEnabled(),
                can_buy_packs: await checkout.canBuyPacks(orgId),
                wallet: {
                    balance_credits: Number(wallet.balance_credits),
                    rollover_balance: Number(wallet.rollover_balance),
                    monthly_credits_remaining: Number(wallet.monthly_credits_remaining),
                    monthly_grant_amount: Number(wallet.monthly_grant_amount),
                    monthly_credits_granted_at: wallet.monthly_credits_granted_at,
                    monthly_spent_credits: Number(wallet.monthly_spent_credits ?? 0),
                    spend_cap_credits:
                        wallet.spend_cap_credits !== null && wallet.spend_cap_credits !== undefined
                            ? Number(wallet.spend_cap_credits)
                            : null,
                    auto_recharge_threshold: wallet.auto_recharge_threshold !== null ? Number(wallet.auto_recharge_threshold) : null,
                    auto_recharge_pack_id: wallet.auto_recharge_pack_id,
                    auto_recharge_consent_at: wallet.auto_recharge_consent_at ?? null,
                    currency: wallet.currency,
                },
                transactions: transactions.map((t) => ({
                    id: t.id,
                    type: t.type,
                    amount: Number(t.amount),
                    source: t.source,
                    action_key: t.action_key,
                    action_ref_id: t.action_ref_id,
                    status: t.status,
                    description: t.description,
                    created_at: t.created_at,
                })),
            },
        });
    } catch (error: any) {
        console.error('[GET /credits/balance]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/** GET /credits/packs — active credit packs (Pro only; Free gets an empty list). */
router.get('/packs', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const orgId = await checkout.resolveOrgId(userId);
        if (!orgId || !(await checkout.canBuyPacks(orgId))) {
            res.json({ success: true, data: [] });
            return;
        }
        const packs = await checkout.listPacks();
        res.json({
            success: true,
            data: packs.map((p) => ({
                id: p.id,
                name: p.name,
                credits: Number(p.credits),
                price_usd: Number(p.price_usd),
                sort_order: p.sort_order,
            })),
        });
    } catch (error: any) {
        console.error('[GET /credits/packs]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /credits/purchase
 * Create a one-time Paddle checkout for a credit pack.
 * Body: { packId }
 */
router.post('/purchase', validateJWT, expensiveOperationsLimiter, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const packId = parseInt(req.body.packId, 10);
        if (!packId) {
            res.status(400).json({ success: false, error: 'packId is required' });
            return;
        }
        const result = await checkout.purchase(userId, packId);
        res.json({ success: true, data: result });
    } catch (error: any) {
        if (error instanceof PackPurchaseForbiddenError) {
            res.status(403).json({ success: false, error: error.message });
            return;
        }
        console.error('[POST /credits/purchase]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /credits/auto-recharge — current auto-recharge settings.
 */
router.get('/auto-recharge', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const settings = await checkout.getAutoRecharge(userId);
        res.json({ success: true, data: settings });
    } catch (error: any) {
        console.error('[GET /credits/auto-recharge]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /credits/auto-recharge
 * Set/clear auto-recharge. Body: { threshold, packId } — packId null disables.
 * When the balance drops below threshold, the configured pack is charged to
 * the org's saved payment method (webhook credits the wallet).
 */
router.post('/auto-recharge', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const threshold = parseFloat(req.body.threshold);
        const packId = req.body.packId !== null && req.body.packId !== undefined && req.body.packId !== ''
            ? parseInt(req.body.packId, 10)
            : null;
        if (Number.isNaN(threshold) || threshold < 0) {
            res.status(400).json({ success: false, error: 'threshold must be a non-negative number' });
            return;
        }
        const wallet = await checkout.setAutoRecharge(userId, threshold, packId, req.body?.consent === true);
        res.json({
            success: true,
            data: {
                org_id: wallet.org_id,
                threshold: wallet.auto_recharge_threshold !== null ? Number(wallet.auto_recharge_threshold) : null,
                pack_id: wallet.auto_recharge_pack_id,
                consent_at: wallet.auto_recharge_consent_at ?? null,
            },
        });
    } catch (error: any) {
        if (error instanceof PackPurchaseForbiddenError) {
            res.status(403).json({ success: false, error: error.message });
            return;
        }
        console.error('[POST /credits/auto-recharge]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /credits/spend-cap — set/clear the workspace hard monthly spend cap.
 * Body: { cap: number | null }. Requires owner/admin.
 */
router.post('/spend-cap', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const orgId = await checkout.resolveOrgId(userId);
        if (!orgId) {
            res.status(404).json({ success: false, error: 'No organization found for user' });
            return;
        }
        await assertOrgAdmin(userId, orgId);
        const raw = req.body.cap;
        const cap = raw === null || raw === undefined || raw === '' ? null : Number(raw);
        const wallet = await walletService.setSpendCap(orgId, cap);
        res.json({
            success: true,
            data: {
                org_id: orgId,
                spend_cap_credits:
                    wallet.spend_cap_credits !== null && wallet.spend_cap_credits !== undefined
                        ? Number(wallet.spend_cap_credits)
                        : null,
                monthly_spent_credits: Number(wallet.monthly_spent_credits ?? 0),
            },
        });
    } catch (error: any) {
        const status = error?.statusCode ?? 500;
        console.error('[POST /credits/spend-cap]', error);
        res.status(status).json({ success: false, error: error.message });
    }
});

/** GET /credits/member-limits — workspace member monthly limits. */
router.get('/member-limits', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const orgId = await checkout.resolveOrgId(userId);
        if (!orgId) {
            res.status(404).json({ success: false, error: 'No organization found for user' });
            return;
        }
        await assertOrgAdmin(userId, orgId);
        const rows = await walletService.listMemberLimits(orgId);
        res.json({
            success: true,
            data: rows.map((r) => ({
                user_id: r.user_id,
                monthly_limit_credits:
                    r.monthly_limit_credits !== null && r.monthly_limit_credits !== undefined
                        ? Number(r.monthly_limit_credits)
                        : null,
                monthly_spent_credits: Number(r.monthly_spent_credits ?? 0),
                period_start: r.period_start,
            })),
        });
    } catch (error: any) {
        const status = error?.statusCode ?? 500;
        console.error('[GET /credits/member-limits]', error);
        res.status(status).json({ success: false, error: error.message });
    }
});

/**
 * POST /credits/member-limits — set/clear one member's monthly limit.
 * Body: { userId: number, limit: number | null }.
 */
router.post('/member-limits', validateJWT, async (req: Request, res: Response) => {
    try {
        const actorId = req.body.tokenDetails.user_id;
        const orgId = await checkout.resolveOrgId(actorId);
        if (!orgId) {
            res.status(404).json({ success: false, error: 'No organization found for user' });
            return;
        }
        await assertOrgAdmin(actorId, orgId);
        const memberUserId = parseInt(req.body.userId, 10);
        if (!memberUserId) {
            res.status(400).json({ success: false, error: 'userId is required' });
            return;
        }
        const raw = req.body.limit;
        const limit = raw === null || raw === undefined || raw === '' ? null : Number(raw);
        const row = await walletService.setMemberLimit(orgId, memberUserId, limit);
        res.json({
            success: true,
            data: {
                user_id: row.user_id,
                monthly_limit_credits:
                    row.monthly_limit_credits !== null && row.monthly_limit_credits !== undefined
                        ? Number(row.monthly_limit_credits)
                        : null,
                monthly_spent_credits: Number(row.monthly_spent_credits ?? 0),
                period_start: row.period_start,
            },
        });
    } catch (error: any) {
        const status = error?.statusCode ?? 500;
        console.error('[POST /credits/member-limits]', error);
        res.status(status).json({ success: false, error: error.message });
    }
});

export default router;
