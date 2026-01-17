import { Seeder } from '@jorgebodega/typeorm-seeding';
import { DataSource } from 'typeorm';
import { DRAProject } from '../models/DRAProject.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { EProjectRole } from '../types/EProjectRole.js';

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
        
        // Use transaction to ensure both project and member entry are created
        await manager.transaction(async (transactionManager) => {
            const project = new DRAProject();
            project.name = 'DRA Demo Project';
            project.description = 'This is a demo project created for testing purposes.';
            project.users_platform = user;
            project.created_at = new Date();
            const savedProject = await transactionManager.save(project);
            
            // Create project member entry with owner role
            const projectMember = new DRAProjectMember();
            projectMember.project = savedProject;
            projectMember.user = user;
            projectMember.role = EProjectRole.OWNER;
            projectMember.added_at = new Date();
            await transactionManager.save(projectMember);
            
            console.log('✅ Created demo project with owner member entry');
        });
    }
}