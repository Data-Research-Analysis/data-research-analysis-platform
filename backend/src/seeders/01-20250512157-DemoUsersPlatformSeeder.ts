import bcrypt  from 'bcryptjs';
import { Seeder } from '@jorgebodega/typeorm-seeding';
import { DataSource } from 'typeorm';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { UtilityService } from '../services/UtilityService.js';
import { EUserType } from '../types/EUserType.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAWorkspace } from '../models/DRAWorkspace.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAWorkspaceMember } from '../models/DRAWorkspaceMember.js';

export class DemoUsersPlatformSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running DemoUsersPlatformSeeder');
        const manager = dataSource.manager;

        // Check and create admin user
        let adminUser = await manager.findOne(DRAUsersPlatform, {
            where: { email: 'testadminuser@dataresearchanalysis.com' }
        });

        if (!adminUser) {
            let user = new DRAUsersPlatform();
            user.email = 'testadminuser@dataresearchanalysis.com';
            user.first_name = 'TestAdmin';
            user.last_name = 'User';
            user.user_type = EUserType.ADMIN;
            let salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
            let password = 'testuser';
            let encryptedPassword = await bcrypt.hash(password, salt);
            user.password = encryptedPassword;
            adminUser = await manager.save(user);
            console.log('✅ Created admin user: testadminuser@dataresearchanalysis.com');
        } else {
            console.log('⏭️  Admin user already exists: testadminuser@dataresearchanalysis.com');
        }

        // Check and create normal user
        let normalUser = await manager.findOne(DRAUsersPlatform, {
            where: { email: 'testuser@dataresearchanalysis.com' }
        });

        if (!normalUser) {
            let user = new DRAUsersPlatform();
            user.email = 'testuser@dataresearchanalysis.com';
            user.first_name = 'Test';
            user.last_name = 'User';
            user.user_type = EUserType.NORMAL;
            let salt = parseInt(UtilityService.getInstance().getConstants('PASSWORD_SALT'));
            let password = 'testuser';
            let encryptedPassword = await bcrypt.hash(password, salt);
            user.password = encryptedPassword;
            normalUser = await manager.save(user);
            console.log('✅ Created normal user: testuser@dataresearchanalysis.com');
        } else {
            console.log('⏭️  Normal user already exists: testuser@dataresearchanalysis.com');
        }

        // Create organization and workspace for admin user
        await this.ensureOrgAndWorkspace(manager, adminUser, 'TestAdmin Organization');

        // Create organization and workspace for normal user
        await this.ensureOrgAndWorkspace(manager, normalUser, 'Test Organization');
    }

    private async ensureOrgAndWorkspace(manager: any, user: DRAUsersPlatform, orgName: string) {
        // Find or create organization
        let orgMember = await manager.findOne(DRAOrganizationMember, {
            where: { users_platform_id: user.id },
            relations: ['organization'],
        });
        let organization: DRAOrganization;
        if (orgMember) {
            organization = orgMember.organization;
            console.log(`⏭️  Organization already exists for ${user.email}`);
        } else {
            organization = manager.create(DRAOrganization, {
                name: orgName,
            });
            organization = await manager.save(organization);
            orgMember = manager.create(DRAOrganizationMember, {
                organization,
                users_platform_id: user.id,
                role: 'owner',
            });
            await manager.save(orgMember);
            console.log(`✅ Created organization for ${user.email}: ${orgName}`);
        }

        // Find or create workspace
        let wsMember = await manager.findOne(DRAWorkspaceMember, {
            where: { users_platform_id: user.id, workspace: { organization_id: organization.id } },
            relations: ['workspace'],
        });
        let workspace: DRAWorkspace;
        if (wsMember) {
            workspace = wsMember.workspace;
            console.log(`⏭️  Workspace already exists for ${user.email}`);
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
            console.log(`✅ Created workspace for ${user.email}: Default Workspace`);
        }
    }
}
