import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRASubscriptionTier, ESubscriptionTier } from "../models/DRASubscriptionTier.js";

export class SubscriptionTierSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running SubscriptionTierSeeder');

        const manager = dataSource.manager;
        const tierRepo = manager.getRepository(DRASubscriptionTier);

        const tiers = [
            {
                tier_name: ESubscriptionTier.FREE,
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
                tier_name: ESubscriptionTier.STARTER,
                max_rows_per_data_model: 500000, // 500K rows
                max_projects: 10,
                max_data_sources_per_project: 15,
                max_dashboards: 15,
                max_data_models_per_data_source: null, // unlimited
                max_members_per_project: 0, // Solo only
                ai_generations_per_month: 100,
                price_per_month_usd: 29,
                price_per_year_usd: 278
            },
            {
                tier_name: ESubscriptionTier.PROFESSIONAL,
                max_rows_per_data_model: 5000000, // 5M rows
                max_projects: null, // unlimited
                max_data_sources_per_project: null, // unlimited
                max_dashboards: null, // unlimited
                max_data_models_per_data_source: null, // unlimited
                max_members_per_project: 5, // 2-5 sub-users (stored as max, UI shows "2-5")
                ai_generations_per_month: 500,
                price_per_month_usd: 129,
                price_per_year_usd: 1238
            },
            {
                tier_name: ESubscriptionTier.PROFESSIONAL_PLUS,
                max_rows_per_data_model: 100000000, // 100M rows
                max_projects: null, // unlimited
                max_data_sources_per_project: null, // unlimited
                max_dashboards: null, // unlimited
                max_data_models_per_data_source: null, // unlimited
                max_members_per_project: 100, // 6-100 sub-users
                ai_generations_per_month: null, // unlimited
                price_per_month_usd: 399,
                price_per_year_usd: 3829
            },
            {
                tier_name: ESubscriptionTier.ENTERPRISE,
                max_rows_per_data_model: -1, // unlimited (kept as -1 for row limit service compatibility)
                max_projects: null, // unlimited
                max_data_sources_per_project: null, // unlimited
                max_dashboards: null, // unlimited
                max_data_models_per_data_source: null, // unlimited
                max_members_per_project: null, // unlimited sub-users
                ai_generations_per_month: null, // unlimited
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
                // Update price_per_year_usd on existing tiers so the new column is populated
                if (existing.price_per_year_usd === null || existing.price_per_year_usd === undefined) {
                    existing.price_per_year_usd = tierData.price_per_year_usd ?? null;
                    await tierRepo.save(existing);
                    console.log(`✅ Updated price_per_year_usd for tier: ${tierData.tier_name}`);
                } else {
                    console.log(`⏭️  Tier already exists: ${tierData.tier_name}`);
                }
            }
        }

        console.log('✅ Subscription tiers seeded successfully');
    }
}
