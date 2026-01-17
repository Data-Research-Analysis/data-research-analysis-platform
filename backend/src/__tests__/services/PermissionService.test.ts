import { PermissionService, EProjectRole, EAction } from '../../services/PermissionService.js';
import PostgresDSMigrations from '../../datasources/PostgresDSMigrations.js';
import { DRAProject } from '../../models/DRAProject.js';
import { DRAProjectMember } from '../../models/DRAProjectMember.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { DRADataSource } from '../../models/DRADataSource.js';
import { DRADataModel } from '../../models/DRADataModel.js';
import { DRADashboard } from '../../models/DRADashboard.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';

describe('PermissionService', () => {
    let permissionService: PermissionService;
    let testUser: DRAUsersPlatform;
    let testProject: DRAProject;
    let testDataSource: DRADataSource;
    let testDataModel: DRADataModel;
    let testDashboard: DRADashboard;

    beforeAll(async () => {
        if (!PostgresDSMigrations.isInitialized) {
            await PostgresDSMigrations.initialize();
        }
        permissionService = PermissionService.getInstance();
    });

    beforeEach(async () => {
        // Create test user
        const manager = PostgresDSMigrations.manager;
        testUser = manager.create(DRAUsersPlatform, {
            email: `test-${Date.now()}@example.com`,
            password: 'testpassword',
            name: 'Test User'
        });
        await manager.save(testUser);

        // Create test project owned by test user
        testProject = manager.create(DRAProject, {
            name: `Test Project ${Date.now()}`,
            users_platform: testUser
        });
        await manager.save(testProject);

        // Create test data source
        testDataSource = manager.create(DRADataSource, {
            name: `Test DataSource ${Date.now()}`,
            data_type: EDataSourceType.POSTGRESQL,
            project: testProject,
            connection_details: {}
        });
        await manager.save(testDataSource);

        // Create test data model
        testDataModel = manager.create(DRADataModel, {
            name: `Test DataModel ${Date.now()}`,
            project: testProject,
            data_source: testDataSource
        });
        await manager.save(testDataModel);

        // Create test dashboard
        testDashboard = manager.create(DRADashboard, {
            data: {},
            project: testProject,
            users_platform: testUser
        });
        await manager.save(testDashboard);
    });

    afterEach(async () => {
        const manager = PostgresDSMigrations.manager;
        
        // Clean up in reverse order of dependencies
        if (testDashboard) {
            await manager.remove(testDashboard);
        }
        if (testDataModel) {
            await manager.remove(testDataModel);
        }
        if (testDataSource) {
            await manager.remove(testDataSource);
        }
        
        // Remove project members
        const members = await manager.find(DRAProjectMember, {
            where: { project: { id: testProject.id } }
        });
        if (members.length > 0) {
            await manager.remove(members);
        }
        
        if (testProject) {
            await manager.remove(testProject);
        }
        if (testUser) {
            await manager.remove(testUser);
        }
    });

    afterAll(async () => {
        if (PostgresDSMigrations.isInitialized) {
            await PostgresDSMigrations.destroy();
        }
    });

    describe('Permission Matrix', () => {
        it('should allow owners all actions', () => {
            expect(permissionService.canPerformAction(EProjectRole.OWNER, EAction.CREATE)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.OWNER, EAction.READ)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.OWNER, EAction.UPDATE)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.OWNER, EAction.DELETE)).toBe(true);
        });

        it('should allow admins all actions except delete', () => {
            expect(permissionService.canPerformAction(EProjectRole.ADMIN, EAction.CREATE)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.ADMIN, EAction.READ)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.ADMIN, EAction.UPDATE)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.ADMIN, EAction.DELETE)).toBe(false);
        });

        it('should allow editors create, read, update', () => {
            expect(permissionService.canPerformAction(EProjectRole.EDITOR, EAction.CREATE)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.EDITOR, EAction.READ)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.EDITOR, EAction.UPDATE)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.EDITOR, EAction.DELETE)).toBe(false);
        });

        it('should allow viewers only read', () => {
            expect(permissionService.canPerformAction(EProjectRole.VIEWER, EAction.CREATE)).toBe(false);
            expect(permissionService.canPerformAction(EProjectRole.VIEWER, EAction.READ)).toBe(true);
            expect(permissionService.canPerformAction(EProjectRole.VIEWER, EAction.UPDATE)).toBe(false);
            expect(permissionService.canPerformAction(EProjectRole.VIEWER, EAction.DELETE)).toBe(false);
        });
    });

    describe('getUserProjectRole', () => {
        it('should return owner role for project owner', async () => {
            const manager = PostgresDSMigrations.manager;
            const role = await permissionService.getUserProjectRole(testUser.id, testProject.id, manager);
            expect(role).toBe(EProjectRole.OWNER);
        });

        it('should return admin role for admin member', async () => {
            const manager = PostgresDSMigrations.manager;
            
            // Create another user
            const memberUser = manager.create(DRAUsersPlatform, {
                email: `member-${Date.now()}@example.com`,
                password: 'testpassword',
                name: 'Member User'
            });
            await manager.save(memberUser);

            // Add as admin member
            const member = manager.create(DRAProjectMember, {
                project: testProject,
                user: memberUser,
                role: EProjectRole.ADMIN
            });
            await manager.save(member);

            const role = await permissionService.getUserProjectRole(memberUser.id, testProject.id, manager);
            expect(role).toBe(EProjectRole.ADMIN);

            // Cleanup
            await manager.remove(member);
            await manager.remove(memberUser);
        });

        it('should return null for non-member', async () => {
            const manager = PostgresDSMigrations.manager;
            
            // Create another user who is not a member
            const nonMemberUser = manager.create(DRAUsersPlatform, {
                email: `nonmember-${Date.now()}@example.com`,
                password: 'testpassword',
                name: 'Non-member User'
            });
            await manager.save(nonMemberUser);

            const role = await permissionService.getUserProjectRole(nonMemberUser.id, testProject.id, manager);
            expect(role).toBeNull();

            // Cleanup
            await manager.remove(nonMemberUser);
        });
    });

    describe('hasProjectAccess', () => {
        it('should return true for project owner', async () => {
            const manager = PostgresDSMigrations.manager;
            const hasAccess = await permissionService.hasProjectAccess(testUser.id, testProject.id, manager);
            expect(hasAccess).toBe(true);
        });

        it('should return true for project member', async () => {
            const manager = PostgresDSMigrations.manager;
            
            const memberUser = manager.create(DRAUsersPlatform, {
                email: `member2-${Date.now()}@example.com`,
                password: 'testpassword',
                name: 'Member User 2'
            });
            await manager.save(memberUser);

            const member = manager.create(DRAProjectMember, {
                project: testProject,
                user: memberUser,
                role: EProjectRole.VIEWER
            });
            await manager.save(member);

            const hasAccess = await permissionService.hasProjectAccess(memberUser.id, testProject.id, manager);
            expect(hasAccess).toBe(true);

            // Cleanup
            await manager.remove(member);
            await manager.remove(memberUser);
        });

        it('should return false for non-member', async () => {
            const manager = PostgresDSMigrations.manager;
            
            const nonMemberUser = manager.create(DRAUsersPlatform, {
                email: `nonmember2-${Date.now()}@example.com`,
                password: 'testpassword',
                name: 'Non-member User 2'
            });
            await manager.save(nonMemberUser);

            const hasAccess = await permissionService.hasProjectAccess(nonMemberUser.id, testProject.id, manager);
            expect(hasAccess).toBe(false);

            // Cleanup
            await manager.remove(nonMemberUser);
        });
    });

    describe('Resource Permission Checks', () => {
        it('should check permissions for data source', async () => {
            const manager = PostgresDSMigrations.manager;
            
            // Owner can delete
            const canDelete = await permissionService.canPerformActionOnDataSource(
                testUser.id,
                testDataSource.id,
                EAction.DELETE,
                manager
            );
            expect(canDelete).toBe(true);
        });

        it('should check permissions for data model', async () => {
            const manager = PostgresDSMigrations.manager;
            
            // Owner can update
            const canUpdate = await permissionService.canPerformActionOnDataModel(
                testUser.id,
                testDataModel.id,
                EAction.UPDATE,
                manager
            );
            expect(canUpdate).toBe(true);
        });

        it('should check permissions for dashboard', async () => {
            const manager = PostgresDSMigrations.manager;
            
            // Owner can delete
            const canDelete = await permissionService.canPerformActionOnDashboard(
                testUser.id,
                testDashboard.id,
                EAction.DELETE,
                manager
            );
            expect(canDelete).toBe(true);
        });

        it('should deny viewer delete permissions on data source', async () => {
            const manager = PostgresDSMigrations.manager;
            
            const viewerUser = manager.create(DRAUsersPlatform, {
                email: `viewer-${Date.now()}@example.com`,
                password: 'testpassword',
                name: 'Viewer User'
            });
            await manager.save(viewerUser);

            const member = manager.create(DRAProjectMember, {
                project: testProject,
                user: viewerUser,
                role: EProjectRole.VIEWER
            });
            await manager.save(member);

            const canDelete = await permissionService.canPerformActionOnDataSource(
                viewerUser.id,
                testDataSource.id,
                EAction.DELETE,
                manager
            );
            expect(canDelete).toBe(false);

            // Cleanup
            await manager.remove(member);
            await manager.remove(viewerUser);
        });
    });

    describe('getProjectPermissions', () => {
        it('should return all permissions for owner', async () => {
            const manager = PostgresDSMigrations.manager;
            const permissions = await permissionService.getProjectPermissions(testUser.id, testProject.id, manager);
            
            expect(permissions.canCreate).toBe(true);
            expect(permissions.canRead).toBe(true);
            expect(permissions.canUpdate).toBe(true);
            expect(permissions.canDelete).toBe(true);
            expect(permissions.role).toBe(EProjectRole.OWNER);
        });

        it('should return limited permissions for viewer', async () => {
            const manager = PostgresDSMigrations.manager;
            
            const viewerUser = manager.create(DRAUsersPlatform, {
                email: `viewer2-${Date.now()}@example.com`,
                password: 'testpassword',
                name: 'Viewer User 2'
            });
            await manager.save(viewerUser);

            const member = manager.create(DRAProjectMember, {
                project: testProject,
                user: viewerUser,
                role: EProjectRole.VIEWER
            });
            await manager.save(member);

            const permissions = await permissionService.getProjectPermissions(viewerUser.id, testProject.id, manager);
            
            expect(permissions.canCreate).toBe(false);
            expect(permissions.canRead).toBe(true);
            expect(permissions.canUpdate).toBe(false);
            expect(permissions.canDelete).toBe(false);
            expect(permissions.role).toBe(EProjectRole.VIEWER);

            // Cleanup
            await manager.remove(member);
            await manager.remove(viewerUser);
        });

        it('should return no permissions for non-member', async () => {
            const manager = PostgresDSMigrations.manager;
            
            const nonMemberUser = manager.create(DRAUsersPlatform, {
                email: `nonmember3-${Date.now()}@example.com`,
                password: 'testpassword',
                name: 'Non-member User 3'
            });
            await manager.save(nonMemberUser);

            const permissions = await permissionService.getProjectPermissions(nonMemberUser.id, testProject.id, manager);
            
            expect(permissions.canCreate).toBe(false);
            expect(permissions.canRead).toBe(false);
            expect(permissions.canUpdate).toBe(false);
            expect(permissions.canDelete).toBe(false);
            expect(permissions.role).toBeNull();

            // Cleanup
            await manager.remove(nonMemberUser);
        });
    });
});
