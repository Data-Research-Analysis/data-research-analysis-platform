import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRASubscriptionTier, ESubscriptionTier } from "../models/DRASubscriptionTier.js";

/**
 * Paddle Price ID Seeder
 * 
 * Populates Paddle price IDs for subscription tiers.
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
 * @see documentation/paddle-integration-plan.md
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
                tier_name: ESubscriptionTier.FREE,
                paddle_product_id: null, // FREE tier has no Paddle product
                paddle_price_id_monthly: null,
                paddle_price_id_annual: null
            },
            {
                tier_name: ESubscriptionTier.STARTER,
                paddle_product_id: 'pro_starter_placeholder', // Replace with actual product ID (e.g., pro_01h...)
                paddle_price_id_monthly: 'pri_starter_monthly_placeholder', // Replace with actual monthly price ID (e.g., pri_01h...)
                paddle_price_id_annual: 'pri_starter_annual_placeholder' // Replace with actual annual price ID (e.g., pri_01h...)
            },
            {
                tier_name: ESubscriptionTier.PROFESSIONAL,
                paddle_product_id: 'pro_professional_placeholder',
                paddle_price_id_monthly: 'pri_professional_monthly_placeholder',
                paddle_price_id_annual: 'pri_professional_annual_placeholder'
            },
            {
                tier_name: ESubscriptionTier.PROFESSIONAL_PLUS,
                paddle_product_id: 'pro_professional_plus_placeholder',
                paddle_price_id_monthly: 'pri_professional_plus_monthly_placeholder',
                paddle_price_id_annual: 'pri_professional_plus_annual_placeholder'
            },
            {
                tier_name: ESubscriptionTier.ENTERPRISE,
                paddle_product_id: 'pro_enterprise_placeholder',
                paddle_price_id_monthly: 'pri_enterprise_monthly_placeholder',
                paddle_price_id_annual: 'pri_enterprise_annual_placeholder'
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
