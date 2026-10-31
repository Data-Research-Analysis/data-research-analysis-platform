import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { expensiveOperationsLimiter } from '../middleware/rateLimit.js';
import { CreditCheckoutService, PackPurchaseForbiddenError } from '../processors/CreditCheckoutService.js';
import { CreditWalletService } from '../services/CreditWalletService.js';

const router = express.Router();
const checkout = CreditCheckoutService.getInstance();
const walletService = CreditWalletService.getInstance();

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
        const wallet = await checkout.setAutoRecharge(userId, threshold, packId);
        res.json({
            success: true,
            data: {
                org_id: wallet.org_id,
                threshold: wallet.auto_recharge_threshold !== null ? Number(wallet.auto_recharge_threshold) : null,
                pack_id: wallet.auto_recharge_pack_id,
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

export default router;
