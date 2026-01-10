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
                max_rows_per_data_model: 100000,
                max_projects: 3,
                max_data_sources_per_project: 5,
                max_dashboards: 5,
                ai_generations_per_month: 5,
                price_per_month_usd: 0
            },
            {
                tier_name: ESubscriptionTier.PRO,
                max_rows_per_data_model: 5000000,
                max_projects: 50,
                max_data_sources_per_project: -1, // -1 = unlimited
                max_dashboards: -1,
                ai_generations_per_month: 25,
                price_per_month_usd: 99
            },
            {
                tier_name: ESubscriptionTier.TEAM,
                max_rows_per_data_model: 20000000,
                max_projects: -1,
                max_data_sources_per_project: -1,
                max_dashboards: -1,
                ai_generations_per_month: 100,
                price_per_month_usd: 299
            },
            {
                tier_name: ESubscriptionTier.BUSINESS,
                max_rows_per_data_model: 100000000,
                max_projects: -1,
                max_data_sources_per_project: -1,
                max_dashboards: -1,
                ai_generations_per_month: 500,
                price_per_month_usd: 899
            },
            {
                tier_name: ESubscriptionTier.ENTERPRISE,
                max_rows_per_data_model: -1, // -1 = unlimited
                max_projects: -1,
                max_data_sources_per_project: -1,
                max_dashboards: -1,
                ai_generations_per_month: -1,
                price_per_month_usd: 2999
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
                console.log(`⏭️  Tier already exists: ${tierData.tier_name}`);
            }
        }

        console.log('✅ Subscription tiers seeded successfully');
    }
}
