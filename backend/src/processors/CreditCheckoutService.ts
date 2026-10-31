import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRACreditPack } from '../models/DRACreditPack.js';
import { DRACreditWallet } from '../models/DRACreditWallet.js';
import { CreditWalletService } from '../services/CreditWalletService.js';
import { OrganizationService } from '../services/OrganizationService.js';
import { PaddleService } from '../services/PaddleService.js';

/**
 * User-facing credit checkout flows (implementation plan §5.4):
 * pack purchase via one-time Paddle checkout, auto-recharge settings, and
 * the auto-recharge trigger (saved payment method — sandbox-validated).
 *
 * Credits are pooled at the workspace (org) level; the caller's personal org
 * is the workspace for now.
 */

export interface IPackPurchaseResult {
    sessionId: string;
    checkoutUrl: string | null;
    priceId: string;
    packId: number;
    packName: string;
    customerId?: string;
}

export class CreditCheckoutService {
    private static instance: CreditCheckoutService | null = null;
    /** Orgs with an auto-recharge charge in flight (prevents duplicate charges). */
    private recharging = new Set<number>();

    public static getInstance(): CreditCheckoutService {
        if (!CreditCheckoutService.instance) {
            CreditCheckoutService.instance = new CreditCheckoutService();
        }
        return CreditCheckoutService.instance;
    }

    /** Resolve the user's workspace org id via their owner membership. */
    public async resolveOrgId(userId: number): Promise<number | null> {
        const manager = AppDataSource.manager;
        const { orgSubscription } = await OrganizationService.getInstance().getOrgSubscriptionTierForUser(
            userId,
            manager
        );
        return orgSubscription?.organization_id ?? null;
    }

    public async listPacks(): Promise<DRACreditPack[]> {
        return AppDataSource.getRepository(DRACreditPack).find({
            where: { is_active: true },
            order: { sort_order: 'ASC', id: 'ASC' },
        });
    }

    /**
     * Create a one-time Paddle checkout for a credit pack.
     * customData: { organizationId, packId } — the webhook branches on packId.
     */
    public async purchase(userId: number, packId: number): Promise<IPackPurchaseResult> {
        const orgId = await this.resolveOrgId(userId);
        if (!orgId) {
            throw new Error('No organization found for user');
        }

        const pack = await AppDataSource.getRepository(DRACreditPack).findOne({
            where: { id: packId, is_active: true },
        });
        if (!pack) {
            throw new Error(`Credit pack not found or inactive: ${packId}`);
        }
        if (!pack.paddle_price_id) {
            throw new Error('Pack has no Paddle price configured — run the credit pack Paddle sync');
        }

        const paddle = PaddleService.getInstance();

        // Reuse the org's existing Paddle customer; create one if missing.
        // Organizations have no email field — use the owner's email.
        const organization = await AppDataSource.getRepository(DRAOrganization).findOne({
            where: { id: orgId },
            relations: ['subscription', 'members', 'members.user'],
        });
        let customerId = organization?.subscription?.paddle_customer_id ?? undefined;
        if (!customerId && organization) {
            const ownerMember = organization.members.find((m) => m.role === 'owner');
            const customerEmail = ownerMember?.user?.email ?? organization.name;
            const customer = await paddle.getOrCreateCustomer(
                customerEmail,
                organization.name,
                { organizationId: orgId }
            );
            customerId = customer.id;
            if (organization.subscription) {
                organization.subscription.paddle_customer_id = customerId;
                await AppDataSource.manager.save(organization.subscription);
            }
        }

        const transaction = await paddle.createOneTimeCheckout(
            pack.paddle_price_id,
            customerId,
            { organizationId: orgId, packId }
        );

        return {
            sessionId: transaction.id,
            checkoutUrl: transaction.checkout?.url ?? null,
            priceId: pack.paddle_price_id,
            packId: pack.id,
            packName: pack.name,
            customerId,
        };
    }

    /** Set/clear auto-recharge: threshold credits + pack to buy on recharge. */
    public async setAutoRecharge(
        userId: number,
        threshold: number,
        packId: number | null
    ): Promise<DRACreditWallet> {
        const orgId = await this.resolveOrgId(userId);
        if (!orgId) throw new Error('No organization found for user');
        if (packId !== null) {
            const pack = await AppDataSource.getRepository(DRACreditPack).findOne({
                where: { id: packId, is_active: true },
            });
            if (!pack) throw new Error(`Credit pack not found or inactive: ${packId}`);
        }
        return CreditWalletService.getInstance().setAutoRecharge(orgId, threshold, packId);
    }

    public async getAutoRecharge(userId: number): Promise<{
        org_id: number;
        threshold: number | null;
        pack_id: number | null;
    }> {
        const orgId = await this.resolveOrgId(userId);
        if (!orgId) throw new Error('No organization found for user');
        const wallet = await CreditWalletService.getInstance().getWallet(orgId);
        return {
            org_id: orgId,
            threshold: wallet.auto_recharge_threshold !== null ? Number(wallet.auto_recharge_threshold) : null,
            pack_id: wallet.auto_recharge_pack_id,
        };
    }

    /**
     * Auto-recharge trigger: if the balance is below the configured threshold
     * and a pack is set, initiate a one-time transaction against the org's
     * saved payment method. The wallet is credited by the transaction.completed
     * webhook (idempotent on the Paddle transaction id).
     *
     * Returns null when auto-recharge is not configured or the balance is fine.
     * Throws when no saved payment method exists or Paddle rejects the
     * saved-method charge — the caller should fall back to checkout top-up.
     */
    public async maybeAutoRecharge(orgId: number): Promise<{
        initiated: boolean;
        transactionId?: string;
        reason: string;
    } | null> {
        const wallet = await CreditWalletService.getInstance().getWallet(orgId);
        if (
            wallet.auto_recharge_threshold === null ||
            wallet.auto_recharge_threshold === undefined ||
            wallet.auto_recharge_pack_id === null
        ) {
            return null;
        }
        const balance = Number(wallet.balance_credits);
        const threshold = Number(wallet.auto_recharge_threshold);
        if (balance >= threshold) {
            return { initiated: false, reason: `Balance ${balance} >= threshold ${threshold}` };
        }

        const pack = await AppDataSource.getRepository(DRACreditPack).findOne({
            where: { id: wallet.auto_recharge_pack_id, is_active: true },
        });
        if (!pack?.paddle_price_id) {
            return { initiated: false, reason: 'Auto-recharge pack missing or has no Paddle price' };
        }

        const organization = await AppDataSource.getRepository(DRAOrganization).findOne({
            where: { id: orgId },
            relations: ['subscription'],
        });
        const customerId = organization?.subscription?.paddle_customer_id;
        if (!customerId) {
            return { initiated: false, reason: 'No Paddle customer on file for org' };
        }

        if (this.recharging.has(orgId)) {
            return { initiated: false, reason: 'Auto-recharge already in progress' };
        }
        this.recharging.add(orgId);
        try {
            const transaction = await PaddleService.getInstance().chargeSavedPaymentMethod(
                pack.paddle_price_id,
                customerId,
                { organizationId: orgId, packId: pack.id }
            );
            return {
                initiated: true,
                transactionId: transaction.id,
                reason: `Charged saved payment method for ${pack.name}`,
            };
        } finally {
            this.recharging.delete(orgId);
        }
    }
}
