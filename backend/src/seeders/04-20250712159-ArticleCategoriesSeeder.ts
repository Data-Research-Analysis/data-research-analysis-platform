import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRACategory } from "../models/DRACategory.js";

export class ArticleCategoriesSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running ArticleCategoriesSeeder');

        const categories = [
            'Data Analysis',
            'Data Analytics',
            'Data Engineering',
            'Generative AI',
            'Data Science',
            'Platform News',
            'Technology',
            'Programming',
            'Computer Science',
        ];
        const manager = dataSource.manager;
        const user = await manager.findOne(DRAUsersPlatform, {
            where: { email: 'testuser@dataresearchanalysis.com' },
        });
        if (!user) {
            console.error('❌ User not found');
            return;
        }
        
        let createdCount = 0;
        let skippedCount = 0;
        
        for (const categoryTitle of categories) {
            // Check if category already exists
            const existingCategory = await manager.findOne(DRACategory, {
                where: { title: categoryTitle }
            });
            
            if (!existingCategory) {
                const category = new DRACategory();
                category.title = categoryTitle;
                category.users_platform = user;
                await manager.save(category);
                console.log(`✅ Created category: ${categoryTitle}`);
                createdCount++;
            } else {
                console.log(`⏭️  Category already exists: ${categoryTitle}`);
                skippedCount++;
            }
        }
        
        console.log(`✅ Article categories seeding completed: ${createdCount} created, ${skippedCount} skipped`);
    }
}