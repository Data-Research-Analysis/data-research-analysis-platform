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
            console.error('User not found');
            return;
        }
        for (const categoryTitle of categories) {
            const category = new DRACategory();
            category.title = categoryTitle;
            category.users_platform = user;
            await manager.save(category);
        }
    }
}