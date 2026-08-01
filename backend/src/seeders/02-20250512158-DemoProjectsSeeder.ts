import { Seeder } from '@jorgebodega/typeorm-seeding';
import { DataSource } from 'typeorm';
import { DRAProject } from '../models/DRAProject.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAWorkspace } from '../models/DRAWorkspace.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAWorkspaceMember } from '../models/DRAWorkspaceMember.js';

export class DemoProjectsSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running DemoProjectsSeeder');
        const manager = dataSource.manager;
        const user = await manager.findOne(DRAUsersPlatform, {
            where: { email: 'testuser@dataresearchanalysis.com' },
        });
        if (!user) {
            console.error('❌ User not found');
            return;
        }

        // Find or create org for this user
        let orgMember = await manager.findOne(DRAOrganizationMember, {
            where: { users_platform_id: user.id },
            relations: ['organization'],
        });
        let organization: DRAOrganization;
        if (orgMember) {
            organization = orgMember.organization;
        } else {
            organization = manager.create(DRAOrganization, {
                name: `${user.first_name}'s Organization`,
            });
            organization = await manager.save(organization);
            orgMember = manager.create(DRAOrganizationMember, {
                organization,
                users_platform_id: user.id,
                role: 'owner',
            });
            await manager.save(orgMember);
            console.log('✅ Created organization for user');
        }

        // Find or create workspace for user in this org
        let wsMember = await manager.findOne(DRAWorkspaceMember, {
            where: { users_platform_id: user.id, workspace: { organization_id: organization.id } },
            relations: ['workspace'],
        });
        let workspace: DRAWorkspace;
        if (wsMember) {
            workspace = wsMember.workspace;
        } else {
            workspace = manager.create(DRAWorkspace, {
                name: 'Default Workspace',
                slug: 'default',
                organization,
            });
            workspace = await manager.save(workspace);
            wsMember = manager.create(DRAWorkspaceMember, {
                workspace,
                users_platform_id: user.id,
                role: 'admin',
            });
            await manager.save(wsMember);
            console.log('✅ Created workspace for user');
        }

        // Check if project already exists
        const existingProject = await manager.findOne(DRAProject, {
            where: { name: 'DRA Demo Project' },
            relations: ['users_platform']
        });

        if (!existingProject) {
            // Use transaction to ensure both project and member entry are created
            await manager.transaction(async (transactionManager) => {
                const project = new DRAProject();
                project.name = 'DRA Demo Project';
                project.description = 'This is a demo project created for testing purposes.';
                project.users_platform = user;
                project.organization = organization;
                project.workspace = workspace;
                project.created_at = new Date();
                const savedProject = await transactionManager.save(project);

                const projectMember = new DRAProjectMember();
                projectMember.project = savedProject;
                projectMember.user = user;
                projectMember.marketing_role = 'analyst';
                projectMember.added_at = new Date();
                await transactionManager.save(projectMember);

                console.log('✅ Created demo project with owner member entry');
            });
        } else {
            console.log('⏭️  Demo project already exists: DRA Demo Project');

            // Check if member entry exists
            const existingMember = await manager.findOne(DRAProjectMember, {
                where: { 
                    project: { id: existingProject.id },
                    user: { id: user.id }
                }
            });

            if (!existingMember) {
                // Add member entry only
                const projectMember = new DRAProjectMember();
                projectMember.project = existingProject;
                projectMember.user = user;
                projectMember.marketing_role = 'analyst';
                projectMember.added_at = new Date();
                await manager.save(projectMember);
                console.log('✅ Added missing member entry for demo project');
            } else {
                console.log('⏭️  Project member entry already exists');
            }
        }
    }
}