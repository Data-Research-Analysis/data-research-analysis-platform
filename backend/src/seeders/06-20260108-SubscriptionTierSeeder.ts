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
 * - 10: Starter
 * - 20: Professional
 * - 30: Professional Plus
 * - 40: Enterprise
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
                price_per_year_usd: 0
            },
            {
                tier_name: 'Starter',
                tier_rank: 10,
                max_rows_per_data_model: 500000, // 500K rows
                ai_cost_ceiling_usd: null,
                price_per_month_usd: 29,
                price_per_year_usd: 276
            },
            {
                tier_name: 'Professional',
                tier_rank: 20,
                max_rows_per_data_model: 5000000, // 5M rows per manual model
                ai_cost_ceiling_usd: 10, // fair-use anchor
                price_per_month_usd: 129,
                price_per_year_usd: 1236
            },
            {
                tier_name: 'Professional Plus',
                tier_rank: 30,
                max_rows_per_data_model: 100000000, // 100M rows
                ai_cost_ceiling_usd: 50, // fair-use anchor
                price_per_month_usd: 399,
                price_per_year_usd: 3828
            },
            {
                tier_name: 'Enterprise',
                tier_rank: 40,
                max_rows_per_data_model: -1, // unlimited (kept as -1 for row limit service compatibility)
                ai_cost_ceiling_usd: null, // SLA-based
                price_per_month_usd: 2499,
                price_per_year_usd: 23990
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
