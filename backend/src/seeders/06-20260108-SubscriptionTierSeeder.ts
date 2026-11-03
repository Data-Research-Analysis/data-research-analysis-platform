import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRASubscriptionTier } from "../models/DRASubscriptionTier.js";

/**
 * SubscriptionTierSeeder - Creates initial subscription tiers
 * 
 * IMPORTANT: This seeder only creates missing tiers. It will NOT update existing tiers.
 * This prevents overwriting manual configurations made via the admin panel
 * (such as Paddle IDs, custom limits, pricing changes, etc.).
 * 
 * To update Paddle IDs specifically, use: 09-20260405-PaddlePriceIdSeeder.ts
 * 
 * Tier Ranks:
 * - 0: Free
 * - 20: Professional (variable credits; the monthly allowance is stored on
 *       each subscription as credits_per_month_override)
 * - 40: Enterprise (custom contract, admin-managed)
 *
 * Starter and Professional Plus were retired in the credit-pricing model.
 * Existing databases are reconciled by the ReconcileCreditTiers migration.
 */
export class SubscriptionTierSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running SubscriptionTierSeeder');

        const manager = dataSource.manager;
        const tierRepo = manager.getRepository(DRASubscriptionTier);

        const tiers = [
            {
                tier_name: 'Free',
                tier_rank: 0,
                max_rows_per_data_model: 50000, // 50K rows
                ai_cost_ceiling_usd: null,
                price_per_month_usd: 0,
                price_per_year_usd: 0,
                credits_per_month: 500,
                credits_rollover: false
            },
            {
                tier_name: 'Data Research Analysis Pro',
                tier_rank: 20,
                max_rows_per_data_model: 5000000, // 5M rows per manual model
                ai_cost_ceiling_usd: null, // credits replace the fair-use cost ceiling
                price_per_month_usd: 49, // entry price for 5,000 credits
                price_per_year_usd: 474,
                credits_per_month: 10000, // default when no per-subscription override
                credits_rollover: true
            },
            {
                tier_name: 'Enterprise',
                tier_rank: 40,
                max_rows_per_data_model: -1, // unlimited (kept as -1 for row limit service compatibility)
                ai_cost_ceiling_usd: null,
                price_per_month_usd: 0, // custom contract, admin-managed
                price_per_year_usd: 0,
                credits_per_month: 0, // admin-managed allowance
                credits_rollover: true
            }
        ];

        for (const tierData of tiers) {
            const existing = await tierRepo.findOne({
                where: { tier_name: tierData.tier_name }
            });

            if (!existing) {
                const tier = tierRepo.create(tierData);
                await tierRepo.save(tier);
                console.log(`✅ Created tier: ${tierData.tier_name}`);
            } else {
                // Skip existing tiers to preserve manual configurations
                // (Paddle IDs, custom limits, etc. set via admin panel)
                console.log(`⏭️  Skipped existing tier: ${tierData.tier_name}`);
            }
        }

        console.log('✅ Subscription tiers seeded successfully');
    }
}
