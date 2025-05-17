import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DataSource } from "typeorm";
import { DRAProject } from '../models/DRAProject';
import { DRAUsersPlatform } from "../models/DRAUsersPlatform";

export class DemoProjectsSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running DemoProjectsSeeder');
        const manager = dataSource.manager;
        const user = await manager.findOne(DRAUsersPlatform, {
            where: { email: 'testuser@dataresearchanalysis.com' },
        });
        if (!user) {
            console.error('User not found');
            return;
        }
        const project = new DRAProject();
        project.name = 'DRA Demo Project';
        project.users_platform = user; // Assuming the user with ID 1 exists
        project.created_at = new Date();
        await manager.save(project);
    }
}