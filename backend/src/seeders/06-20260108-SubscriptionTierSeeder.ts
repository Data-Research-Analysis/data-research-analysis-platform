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
                max_projects: 3,
                max_data_sources_per_project: 5,
                max_dashboards: 5,
                max_data_models_per_data_source: 3,
                max_members_per_project: 0, // Solo only
                ai_generations_per_month: 10,
                price_per_month_usd: 0,
                price_per_year_usd: 0
            },
            {
                tier_name: 'Starter',
                tier_rank: 10,
                max_rows_per_data_model: 500000, // 500K rows
                max_projects: 10,
                max_data_sources_per_project: 15,
                max_dashboards: 15,
                max_data_models_per_data_source: -1, // unlimited
                max_members_per_project: 0, // Solo only
                ai_generations_per_month: 100,
                price_per_month_usd: 29,
                price_per_year_usd: 276
            },
            {
                tier_name: 'Professional',
                tier_rank: 20,
                max_rows_per_data_model: 5000000, // 5M rows
                max_projects: -1, // unlimited
                max_data_sources_per_project: -1, // unlimited
                max_dashboards: -1, // unlimited
                max_data_models_per_data_source: -1, // unlimited
                max_members_per_project: 5, // 2-5 sub-users (stored as max, UI shows "2-5")
                ai_generations_per_month: 500,
                price_per_month_usd: 129,
                price_per_year_usd: 1236
            },
            {
                tier_name: 'Professional Plus',
                tier_rank: 30,
                max_rows_per_data_model: 100000000, // 100M rows
                max_projects: -1, // unlimited
                max_data_sources_per_project: -1, // unlimited
                max_dashboards: -1, // unlimited
                max_data_models_per_data_source: -1, // unlimited
                max_members_per_project: 100, // 6-100 sub-users
                ai_generations_per_month: -1, // unlimited
                price_per_month_usd: 399,
                price_per_year_usd: 3828
            },
            {
                tier_name: 'Enterprise',
                tier_rank: 40,
                max_rows_per_data_model: -1, // unlimited (kept as -1 for row limit service compatibility)
                max_projects: -1, // unlimited
                max_data_sources_per_project: -1, // unlimited
                max_dashboards: -1, // unlimited
                max_data_models_per_data_source: -1, // unlimited
                max_members_per_project: -1, // unlimited sub-users
                ai_generations_per_month: -1, // unlimited
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
