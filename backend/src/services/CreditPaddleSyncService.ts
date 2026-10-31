import { Paddle } from '@paddle/paddle-node-sdk';
import { Repository } from 'typeorm';
import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRACreditPack } from '../models/DRACreditPack.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';

export interface ICreditPackSyncResult {
    name: string;
    paddle_price_id: string;
    action: 'created' | 'matched';
}

export interface ICreditPackSyncResults {
    product_id: string;
    product_name: string;
    packs: ICreditPackSyncResult[];
    errors: string[];
    synced_at: string;
}

const CREDIT_PACKS_PRODUCT_NAME = 'Data Research Analysis — Credit Packs';
const PRO_CREDITS_PRODUCT_NAME = 'Data Research Analysis — Pro Credits';
/** $9.80 per 1,000 credits / month. */
const PRO_CREDITS_UNIT_MONTHLY_CENTS = 980;
/** $9.80 × 12 × 0.8 = $94.08 per 1,000 credits / year (about 20% off). */
const PRO_CREDITS_UNIT_ANNUAL_CENTS = 9480;

export interface IProCreditsPriceSyncResult {
    price_id: string;
    action: 'created' | 'matched';
    amount_cents: number;
    interval: 'month' | 'year';
}

export interface IProCreditsSyncResults {
    product_id: string;
    product_name: string;
    tier_id: number | null;
    tier_name: string;
    monthly: IProCreditsPriceSyncResult | null;
    annual: IProCreditsPriceSyncResult | null;
    errors: string[];
    synced_at: string;
}

/**
 * Creates/backfills the Paddle "Credit Packs" product and one-time prices
 * (plan §3.2). Idempotent: matches the product by name and prices by amount,
 * creating only what is missing. Updates dra_credit_packs.paddle_price_id.
 */
export class CreditPaddleSyncService {
    private static instance: CreditPaddleSyncService | null = null;

    public static getInstance(): CreditPaddleSyncService {
        if (!CreditPaddleSyncService.instance) {
            CreditPaddleSyncService.instance = new CreditPaddleSyncService();
        }
        return CreditPaddleSyncService.instance;
    }

    public async sync(paddle: Paddle): Promise<ICreditPackSyncResults> {
        const results: ICreditPackSyncResults = {
            product_id: '',
            product_name: CREDIT_PACKS_PRODUCT_NAME,
            packs: [],
            errors: [],
            synced_at: new Date().toISOString(),
        };

        try {
            const product = await this.findOrCreateProduct(paddle);
            results.product_id = product.id;

            const packRepo = (await getAppDataSource()).getRepository(DRACreditPack);
            const packs = await packRepo.find({
                order: { sort_order: 'ASC', id: 'ASC' },
            });

            const existingPrices: any[] = [];
            for await (const price of paddle.prices.list({ productId: product.id, status: ['active'] })) {
                existingPrices.push(price);
            }

            for (const pack of packs) {
                try {
                    const amountCents = Math.round(Number(pack.price_usd) * 100);
                    const description = pack.name;
                    const match = existingPrices.find(
                        (p: any) =>
                            !p.billingCycle &&
                            p.unitPrice?.currencyCode === 'USD' &&
                            parseInt(p.unitPrice?.amount ?? '0', 10) === amountCents
                    );

                    let priceId: string;
                    let action: 'created' | 'matched';
                    if (match) {
                        priceId = match.id;
                        action = 'matched';
                    } else {
                        const created = await paddle.prices.create({
                            productId: product.id,
                            description,
                            unitPrice: { amount: String(amountCents), currencyCode: 'USD' }
                        });
                        priceId = created.id;
                        action = 'created';
                    }

                    if (pack.paddle_price_id !== priceId) {
                        pack.paddle_price_id = priceId;
                        await packRepo.save(pack);
                    }
                    results.packs.push({ name: pack.name, paddle_price_id: priceId, action });
                } catch (err: any) {
                    console.error(`[CreditPaddleSync] Error syncing pack ${pack.name}:`, err);
                    results.errors.push(`Pack ${pack.name}: ${err.message}`);
                }
            }
        } catch (err: any) {
            console.error('[CreditPaddleSync] Sync failed:', err);
            results.errors.push(err.message);
        }

        return results;
    }

    /**
     * Creates/backfills the Paddle "Pro Credits" product and the two recurring
     * per-1,000-credit prices used by the variable-credit Pro plan, then stores
     * the price IDs on the PROFESSIONAL tier. Idempotent.
     */
    public async syncProCredits(paddle: Paddle): Promise<IProCreditsSyncResults> {
        const results: IProCreditsSyncResults = {
            product_id: '',
            product_name: PRO_CREDITS_PRODUCT_NAME,
            tier_id: null,
            tier_name: '',
            monthly: null,
            annual: null,
            errors: [],
            synced_at: new Date().toISOString(),
        };

        try {
            const tierRepo = (await getAppDataSource()).getRepository(DRASubscriptionTier);
            const tier = await this.findProTier(tierRepo);

            // Prefer the product already attached to the Pro tier (it may have
            // been created manually in the Paddle dashboard). Only create/find
            // by name when the tier has no product yet.
            let product: any = null;
            if (tier?.paddle_product_id) {
                try {
                    product = await paddle.products.get(tier.paddle_product_id);
                } catch (err: any) {
                    results.errors.push(
                        `Pro tier product ${tier.paddle_product_id} not found in Paddle: ${err?.message}`
                    );
                }
            }
            if (!product) {
                product = await this.findOrCreateProCreditsProduct(paddle);
            }
            results.product_id = product.id;
            results.product_name = product.name ?? PRO_CREDITS_PRODUCT_NAME;

            const existingPrices: any[] = [];
            for await (const price of paddle.prices.list({ productId: product.id, status: ['active'] })) {
                existingPrices.push(price);
            }

            results.monthly = await this.ensureProCreditsPrice(
                paddle,
                product.id,
                existingPrices,
                'month',
                PRO_CREDITS_UNIT_MONTHLY_CENTS,
                '1,000 Pro credits / month'
            );
            results.annual = await this.ensureProCreditsPrice(
                paddle,
                product.id,
                existingPrices,
                'year',
                PRO_CREDITS_UNIT_ANNUAL_CENTS,
                '1,000 Pro credits / month (billed annually)'
            );

            if (!tier) {
                results.errors.push('Variable-credit Pro subscription tier not found');
            } else {
                tier.paddle_product_id = product.id;
                tier.paddle_credits_unit_price_id_monthly = results.monthly.price_id;
                tier.paddle_credits_unit_price_id_annual = results.annual.price_id;
                await tierRepo.save(tier);
                results.tier_id = tier.id;
                results.tier_name = tier.tier_name;
            }
        } catch (err: any) {
            console.error('[CreditPaddleSync] Pro credits sync failed:', err);
            results.errors.push(err.message);
        }

        return results;
    }

    /**
     * Locate the variable-credit Pro tier. Tier names are display-cased and
     * have changed over time ("Professional", "Data Research Analysis Pro"), so
     * match on the name shape instead of an exact string.
     */
    private async findProTier(repo: Repository<DRASubscriptionTier>): Promise<DRASubscriptionTier | null> {
        const tiers = await repo.find({ order: { tier_rank: 'ASC' } });
        const isPro = (name: string) =>
            /pro/i.test(name) && !/plus|free|enterprise/i.test(name);
        return tiers.find((t) => isPro(t.tier_name)) ?? null;
    }

    private async ensureProCreditsPrice(
        paddle: Paddle,
        productId: string,
        existingPrices: any[],
        interval: 'month' | 'year',
        amountCents: number,
        description: string
    ): Promise<IProCreditsPriceSyncResult> {
        // Reuse whatever recurring USD price already exists for this interval.
        // The dashboard-managed product may use a slightly different amount
        // (e.g. a rounded annual price); reusing it keeps checkout stable and
        // avoids creating duplicate prices on every sync.
        const match = existingPrices.find(
            (p: any) =>
                p.billingCycle?.interval === interval &&
                p.unitPrice?.currencyCode === 'USD'
        );
        if (match) {
            return {
                price_id: match.id,
                action: 'matched',
                amount_cents: parseInt(match.unitPrice?.amount ?? String(amountCents), 10),
                interval,
            };
        }
        const created = await paddle.prices.create({
            productId,
            description,
            unitPrice: { amount: String(amountCents), currencyCode: 'USD' },
            billingCycle: { interval, frequency: 1 },
        });
        return { price_id: created.id, action: 'created', amount_cents: amountCents, interval };
    }

    private async findOrCreateProCreditsProduct(paddle: Paddle): Promise<any> {
        let product: any = null;
        for await (const p of paddle.products.list({ status: ['active'] })) {
            if ((p.name as string) === PRO_CREDITS_PRODUCT_NAME) {
                product = p;
                break;
            }
        }
        if (!product) {
            product = await paddle.products.create({
                name: PRO_CREDITS_PRODUCT_NAME,
                description: 'Recurring Pro credit subscriptions for Data Research Analysis',
                taxCategory: 'saas',
            });
        }
        return product;
    }

    private async findOrCreateProduct(paddle: Paddle): Promise<any> {
        let product: any = null;
        for await (const p of paddle.products.list({ status: ['active'] })) {
            if ((p.name as string) === CREDIT_PACKS_PRODUCT_NAME) {
                product = p;
                break;
            }
        }
        if (!product) {
            product = await paddle.products.create({
                name: CREDIT_PACKS_PRODUCT_NAME,
                description: 'One-time credit top-ups for Data Research Analysis',
                taxCategory: 'saas',
            });
        }
        return product;
    }
}
