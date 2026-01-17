import { AppDataSource } from '../../datasources/PostgresDSMigrations.js';
import { ProjectProcessor } from '../../processors/ProjectProcessor.js';
import { DRAProject } from '../../models/DRAProject.js';
import { DRAProjectMember } from '../../models/DRAProjectMember.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { EProjectRole } from '../../types/EProjectRole.js';
import { ITokenDetails } from '../../types/ITokenDetails.js';
import { EUserType } from '../../types/EUserType.js';

/**
 * RBAC Tests for ProjectProcessor
 * Tests that getProjects returns correct is_owner and user_role values
 * for different project membership scenarios
 */
describe('ProjectProcessor RBAC Tests', () => {
    let projectProcessor: ProjectProcessor;
    let ownerUser: DRAUsersPlatform;
    let adminUser: DRAUsersPlatform;
    let editorUser: DRAUsersPlatform;
    let viewerUser: DRAUsersPlatform;
    let nonMemberUser: DRAUsersPlatform;
    let testProject: DRAProject;

    beforeAll(async () => {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        projectProcessor = ProjectProcessor.getInstance();
    });

    beforeEach(async () => {
        const manager = AppDataSource.manager;

        // Create test users
        ownerUser = manager.create(DRAUsersPlatform, {
            email: `owner-${Date.now()}@test.com`,
            password: 'testpass',
            first_name: 'Owner',
            last_name: 'User',
            user_type: EUserType.NORMAL
        });
        await manager.save(ownerUser);

        adminUser = manager.create(DRAUsersPlatform, {
            email: `admin-${Date.now()}@test.com`,
            password: 'testpass',
            first_name: 'Admin',
            last_name: 'User',
            user_type: EUserType.NORMAL
        });
        await manager.save(adminUser);

        editorUser = manager.create(DRAUsersPlatform, {
            email: `editor-${Date.now()}@test.com`,
            password: 'testpass',
            first_name: 'Editor',
            last_name: 'User',
            user_type: EUserType.NORMAL
        });
        await manager.save(editorUser);

        viewerUser = manager.create(DRAUsersPlatform, {
            email: `viewer-${Date.now()}@test.com`,
            password: 'testpass',
            first_name: 'Viewer',
            last_name: 'User',
            user_type: EUserType.NORMAL
        });
        await manager.save(viewerUser);

        nonMemberUser = manager.create(DRAUsersPlatform, {
            email: `nonmember-${Date.now()}@test.com`,
            password: 'testpass',
            first_name: 'NonMember',
            last_name: 'User',
            user_type: EUserType.NORMAL
        });
        await manager.save(nonMemberUser);

        // Create test project
        testProject = manager.create(DRAProject, {
            name: `RBAC Test Project ${Date.now()}`,
            description: 'Testing RBAC',
            users_platform: ownerUser,
            created_at: new Date()
        });
        await manager.save(testProject);

        // Create owner member entry
        const ownerMember = manager.create(DRAProjectMember, {
            project: testProject,
            user: ownerUser,
            role: EProjectRole.OWNER,
            added_at: new Date()
        });
        await manager.save(ownerMember);

        // Create admin member
        const adminMember = manager.create(DRAProjectMember, {
            project: testProject,
            user: adminUser,
            role: EProjectRole.ADMIN,
            added_at: new Date(),
            invited_by: ownerUser
        });
        await manager.save(adminMember);

        // Create editor member
        const editorMember = manager.create(DRAProjectMember, {
            project: testProject,
            user: editorUser,
            role: EProjectRole.EDITOR,
            added_at: new Date(),
            invited_by: ownerUser
        });
        await manager.save(editorMember);

        // Create viewer member
        const viewerMember = manager.create(DRAProjectMember, {
            project: testProject,
            user: viewerUser,
            role: EProjectRole.VIEWER,
            added_at: new Date(),
            invited_by: ownerUser
        });
        await manager.save(viewerMember);
    });

    afterEach(async () => {
        const manager = AppDataSource.manager;

        // Clean up members
        const members = await manager.find(DRAProjectMember, {
            where: { project: { id: testProject.id } }
        });
        if (members.length > 0) {
            await manager.remove(members);
        }

        // Clean up project
        if (testProject) {
            await manager.remove(testProject);
        }

        // Clean up users
        const users = [ownerUser, adminUser, editorUser, viewerUser, nonMemberUser];
        for (const user of users) {
            if (user) {
                await manager.remove(user);
            }
        }
    });

    afterAll(async () => {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    describe('Owner RBAC', () => {
        it('should return is_owner=true and user_role=owner for project owner', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: ownerUser.id,
                email: ownerUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects).toHaveLength(1);
            expect(projects[0].id).toBe(testProject.id);
            expect(projects[0].is_owner).toBe(true);
            expect(projects[0].user_role).toBe('owner');
        });

        it('should include all members array for owner', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: ownerUser.id,
                email: ownerUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects[0].members).toBeDefined();
            expect(projects[0].members).toHaveLength(4); // owner + admin + editor + viewer
            expect(projects[0].members.some(m => m.role === 'owner')).toBe(true);
            expect(projects[0].members.some(m => m.role === 'admin')).toBe(true);
            expect(projects[0].members.some(m => m.role === 'editor')).toBe(true);
            expect(projects[0].members.some(m => m.role === 'viewer')).toBe(true);
        });
    });

    describe('Admin RBAC', () => {
        it('should return is_owner=false and user_role=admin for admin member', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: adminUser.id,
                email: adminUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects).toHaveLength(1);
            expect(projects[0].id).toBe(testProject.id);
            expect(projects[0].is_owner).toBe(false);
            expect(projects[0].user_role).toBe('admin');
        });

        it('should include members array for admin', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: adminUser.id,
                email: adminUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects[0].members).toBeDefined();
            expect(projects[0].members).toHaveLength(4);
        });
    });

    describe('Editor RBAC', () => {
        it('should return is_owner=false and user_role=editor for editor member', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: editorUser.id,
                email: editorUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects).toHaveLength(1);
            expect(projects[0].id).toBe(testProject.id);
            expect(projects[0].is_owner).toBe(false);
            expect(projects[0].user_role).toBe('editor');
        });

        it('should include members array for editor', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: editorUser.id,
                email: editorUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects[0].members).toBeDefined();
            expect(projects[0].members).toHaveLength(4);
        });
    });

    describe('Viewer RBAC', () => {
        it('should return is_owner=false and user_role=viewer for viewer member', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: viewerUser.id,
                email: viewerUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects).toHaveLength(1);
            expect(projects[0].id).toBe(testProject.id);
            expect(projects[0].is_owner).toBe(false);
            expect(projects[0].user_role).toBe('viewer');
        });

        it('should include members array for viewer', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: viewerUser.id,
                email: viewerUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects[0].members).toBeDefined();
            expect(projects[0].members).toHaveLength(4);
        });
    });

    describe('Non-Member RBAC', () => {
        it('should not return projects where user is not a member', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: nonMemberUser.id,
                email: nonMemberUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(projects).toHaveLength(0);
        });
    });

    describe('Multiple Projects RBAC', () => {
        let ownedProject: DRAProject;
        let memberProject: DRAProject;

        beforeEach(async () => {
            const manager = AppDataSource.manager;

            // Create project owned by adminUser
            ownedProject = manager.create(DRAProject, {
                name: `Owned Project ${Date.now()}`,
                users_platform: adminUser,
                created_at: new Date()
            });
            await manager.save(ownedProject);

            const ownedMember = manager.create(DRAProjectMember, {
                project: ownedProject,
                user: adminUser,
                role: EProjectRole.OWNER,
                added_at: new Date()
            });
            await manager.save(ownedMember);

            // Create project where adminUser is just an editor
            memberProject = manager.create(DRAProject, {
                name: `Member Project ${Date.now()}`,
                users_platform: ownerUser,
                created_at: new Date()
            });
            await manager.save(memberProject);

            const memberEntry = manager.create(DRAProjectMember, {
                project: memberProject,
                user: adminUser,
                role: EProjectRole.EDITOR,
                added_at: new Date(),
                invited_by: ownerUser
            });
            await manager.save(memberEntry);
        });

        afterEach(async () => {
            const manager = AppDataSource.manager;

            if (ownedProject) {
                const ownedMembers = await manager.find(DRAProjectMember, {
                    where: { project: { id: ownedProject.id } }
                });
                if (ownedMembers.length > 0) {
                    await manager.remove(ownedMembers);
                }
                await manager.remove(ownedProject);
            }

            if (memberProject) {
                const memberMembers = await manager.find(DRAProjectMember, {
                    where: { project: { id: memberProject.id } }
                });
                if (memberMembers.length > 0) {
                    await manager.remove(memberMembers);
                }
                await manager.remove(memberProject);
            }
        });

        it('should correctly differentiate between owned and member projects', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: adminUser.id,
                email: adminUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            // Should return 3 projects: testProject (admin), ownedProject (owner), memberProject (editor)
            expect(projects).toHaveLength(3);

            // Find each project
            const ownedProj = projects.find(p => p.id === ownedProject.id);
            const memberProj = projects.find(p => p.id === memberProject.id);
            const adminProj = projects.find(p => p.id === testProject.id);

            // Verify owned project
            expect(ownedProj).toBeDefined();
            expect(ownedProj!.is_owner).toBe(true);
            expect(ownedProj!.user_role).toBe('owner');

            // Verify member project (editor)
            expect(memberProj).toBeDefined();
            expect(memberProj!.is_owner).toBe(false);
            expect(memberProj!.user_role).toBe('editor');

            // Verify admin project
            expect(adminProj).toBeDefined();
            expect(adminProj!.is_owner).toBe(false);
            expect(adminProj!.user_role).toBe('admin');
        });
    });

    describe('Data Type Validation', () => {
        it('should return is_owner as boolean not string', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: ownerUser.id,
                email: ownerUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(typeof projects[0].is_owner).toBe('boolean');
            expect(projects[0].is_owner).toBe(true);
        });

        it('should return user_role as string', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: viewerUser.id,
                email: viewerUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(typeof projects[0].user_role).toBe('string');
            expect(projects[0].user_role).toBe('viewer');
        });

        it('should return members as array', async () => {
            const tokenDetails: ITokenDetails = {
                user_id: ownerUser.id,
                email: ownerUser.email,
                user_type: EUserType.NORMAL,
                iat: Date.now()
            };

            const projects = await projectProcessor.getProjects(tokenDetails);
            
            expect(Array.isArray(projects[0].members)).toBe(true);
        });
    });
});
