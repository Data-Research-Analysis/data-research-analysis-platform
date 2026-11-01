import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRASubscriptionTier } from "../models/DRASubscriptionTier.js";

/**
 * Paddle Price ID Seeder
 *
 * Populates the legacy per-tier Paddle price IDs. The credit-pricing model no
 * longer sells per-tier subscription products: Pro is a single product priced
 * per 1,000 credits and credit packs are one-time prices. Those IDs are managed
 * by CreditPaddleSyncService (Admin → Credits → Sync Paddle), so this seeder
 * only keeps a fallback mapping for tiers that still use per-tier prices.
 *
 * BEHAVIOR:
 * - Only updates IDs that are currently NULL or contain "placeholder"
 * - Preserves manually configured IDs set via admin panel
 * - Safe to run multiple times without overwriting real Paddle IDs
 *
 * SETUP INSTRUCTIONS:
 * 1. Create products in Paddle Dashboard → Catalog → Products
 * 2. For each product, create 2 prices (monthly and annual)
 * 3. Copy the price IDs (format: pri_xxx) and update the values below
 * 4. Run this seeder to update the database
 *
 * Paddle Dashboard: https://sandbox-vendors.paddle.com/catalog (sandbox)
 *                   https://vendors.paddle.com/catalog (production)
 *
 * @see documentation/architecture/05-billing-subscription.md
 */
export class PaddlePriceIdSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('🏷️  Running Paddle Price ID Seeder...');

        const manager = dataSource.manager;
        const tierRepo = manager.getRepository(DRASubscriptionTier);

        /**
         * Paddle Price ID Mapping
         * 
         * REPLACE THESE WITH YOUR ACTUAL PADDLE PRICE IDs
         * Get from: Paddle Dashboard → Catalog → Products → [Product Name] → Prices
         */
        const paddlePriceIds = [
            {
                tier_name: 'Free',
                paddle_product_id: null, // FREE tier has no Paddle product
                paddle_price_id_monthly: null,
                paddle_price_id_annual: null
            },
            {
                // Legacy fallback only. The variable-credit Pro plan is sold
                // through the Pro Credits product and its per-1,000-credit
                // unit prices, which CreditPaddleSyncService configures.
                tier_name: 'Professional',
                paddle_product_id: 'pro_professional_placeholder',
                paddle_price_id_monthly: 'pri_professional_monthly_placeholder',
                paddle_price_id_annual: 'pri_professional_annual_placeholder'
            },
            {
                // Enterprise is a custom contract; no Paddle product is used.
                tier_name: 'Enterprise',
                paddle_product_id: null,
                paddle_price_id_monthly: null,
                paddle_price_id_annual: null
            }
        ];

        let updatedCount = 0;
        let skippedCount = 0;

        for (const priceData of paddlePriceIds) {
            const tier = await tierRepo.findOne({
                where: { tier_name: priceData.tier_name }
            });

            if (!tier) {
                console.log(`⚠️  Tier not found: ${priceData.tier_name} (run SubscriptionTierSeeder first)`);
                continue;
            }

            // Helper function to check if a value should be updated
            const shouldUpdate = (currentValue: string | null, newValue: string | null): boolean => {
                if (newValue === null) return false; // Don't overwrite with null
                if (currentValue === null) return true; // Update if currently null
                if (currentValue.includes('placeholder')) return true; // Update placeholders
                return false; // Preserve manually configured values
            };

            let tierUpdated = false;

            // Only update if current value is null or placeholder
            if (shouldUpdate(tier.paddle_product_id, priceData.paddle_product_id)) {
                tier.paddle_product_id = priceData.paddle_product_id;
                tierUpdated = true;
            }
            if (shouldUpdate(tier.paddle_price_id_monthly, priceData.paddle_price_id_monthly)) {
                tier.paddle_price_id_monthly = priceData.paddle_price_id_monthly;
                tierUpdated = true;
            }
            if (shouldUpdate(tier.paddle_price_id_annual, priceData.paddle_price_id_annual)) {
                tier.paddle_price_id_annual = priceData.paddle_price_id_annual;
                tierUpdated = true;
            }

            if (tierUpdated) {
                await tierRepo.save(tier);
                updatedCount++;
                console.log(`✅ Updated ${priceData.tier_name} tier with Paddle price IDs`);
            } else {
                skippedCount++;
                console.log(`⏭️  Skipped ${priceData.tier_name} (already configured)`);
            }
        }

        if (updatedCount > 0) {
            console.log(`✅ ${updatedCount} subscription tier(s) updated with Paddle price IDs`);
            console.log('');
            console.log('⚠️  REMINDER: Replace placeholder IDs with actual Paddle price IDs');
            console.log('   Update this file with real price IDs before production deployment.');
        }
        
        if (skippedCount > 0) {
            console.log(`⏭️  ${skippedCount} tier(s) skipped (already configured via admin panel)`);
        }

        console.log('');
        console.log('📋 Next steps:');
        console.log('   1. Create products and prices in Paddle Dashboard');
        console.log('   2. Update price IDs in this seeder file OR via Admin → Subscription Tiers');
        console.log('   3. Verify with: SELECT tier_name, paddle_price_id_monthly, paddle_price_id_annual FROM dra_subscription_tiers;');
    }
}
