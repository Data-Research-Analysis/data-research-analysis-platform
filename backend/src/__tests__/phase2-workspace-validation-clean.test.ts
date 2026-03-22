/**
 * Phase 2 Multi-Tenancy Workspace Validation Tests
 * 
 * Tests workspace ownership validation at database level:
 * - Data Sources (workspace_id constraints)
 * - Data Models (workspace_id constraints)
 * - Dashboards (workspace_id constraints)
 * 
 * Verifies:
 * 1. All resources have non-null workspace_id after migration
 * 2. Resources belong to correct organization/workspace
 * 3. Database constraints are properly applied
 */

import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRADashboard } from '../models/DRADashboard.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAWorkspace } from '../models/DRAWorkspace.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRAProject } from '../models/DRAProject.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { EUserType } from '../types/EUserType.js';

describe('Phase 2 Workspace Validation', () => {
    let testOrg1: DRAOrganization;
    let testOrg2: DRAOrganization;
    let workspace1: DRAWorkspace;
    let workspace2: DRAWorkspace;
    let user1: DRAUsersPlatform;
    let project1: DRAProject;
    let project2: DRAProject;

    beforeAll(async () => {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        // Create test organizations
        const orgRepo = AppDataSource.getRepository(DRAOrganization);
        testOrg1 = orgRepo.create({
            name: 'Test Org 1 - Phase 2',
            domain: null,
            logo_url: null,
            is_active: true,
            settings: {},
        });
        await orgRepo.save(testOrg1);

        testOrg2 = orgRepo.create({
            name: 'Test Org 2 - Phase 2',
            domain: null,
            logo_url: null,
            is_active: true,
            settings: {},
        });
        await orgRepo.save(testOrg2);

        // Create workspaces
        const workspaceRepo = AppDataSource.getRepository(DRAWorkspace);
        workspace1 = workspaceRepo.create({
            name: 'Workspace 1',
            organization_id: testOrg1.id,
        });
        await workspaceRepo.save(workspace1);

        workspace2 = workspaceRepo.create({
            name: 'Workspace 2',
            organization_id: testOrg2.id,
        });
        await workspaceRepo.save(workspace2);

        // Create test users (only one needed for database tests)
        const userRepo = AppDataSource.getRepository(DRAUsersPlatform);
        user1 = userRepo.create({
            email: 'phase2-test1@example.com',
            password: 'hashedpassword123',
            first_name: 'Phase2',
            last_name: 'User1',
            user_type: EUserType.ADMIN,
        });
        await userRepo.save(user1);

        // Create test projects
        const projectRepo = AppDataSource.getRepository(DRAProject);
        project1 = projectRepo.create({
            name: 'Test Project 1',
            users_platform: user1,
            organization: testOrg1,
            workspace: workspace1,
        });
        await projectRepo.save(project1);

        project2 = projectRepo.create({
            name: 'Test Project 2',
            users_platform: user1,
            organization: testOrg2,
            workspace: workspace2,
        });
        await projectRepo.save(project2);
    });

    afterAll(async () => {
        // Cleanup test data
        const manager = AppDataSource.manager;
        
        await manager.delete(DRAProject, { id: project1.id });
        await manager.delete(DRAProject, { id: project2.id });
        await manager.delete(DRAUsersPlatform, { id: user1.id });
        await manager.delete(DRAWorkspace, { id: workspace1.id });
        await manager.delete(DRAWorkspace, { id: workspace2.id });
        await manager.delete(DRAOrganization, { id: testOrg1.id });
        await manager.delete(DRAOrganization, { id: testOrg2.id });

        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    describe('Data Source Workspace Validation', () => {
        let dataSource1: DRADataSource;
        let dataSource2: DRADataSource;

        beforeEach(async () => {
            const dsRepo = AppDataSource.getRepository(DRADataSource);
            
            dataSource1 = dsRepo.create({
                project: project1,
                data_type: EDataSourceType.CSV,
                name: 'Test DS Workspace 1',
                connection_details: {
                    data_source_type: EDataSourceType.CSV,
                    schema: 'dra_csv',
                },
                organization: testOrg1,
                workspace: workspace1,
            });
            await dsRepo.save(dataSource1);

            dataSource2 = dsRepo.create({
                project: project2,
                data_type: EDataSourceType.CSV,
                name: 'Test DS Workspace 2',
                connection_details: {
                    data_source_type: EDataSourceType.CSV,
                    schema: 'dra_csv',
                },
                organization: testOrg2,
                workspace: workspace2,
            });
            await dsRepo.save(dataSource2);
        });

        afterEach(async () => {
            const manager = AppDataSource.manager;
            await manager.delete(DRADataSource, { id: dataSource1.id });
            await manager.delete(DRADataSource, { id: dataSource2.id });
        });

        test('should have non-null workspace_id', async () => {
            expect(dataSource1.workspace_id).toBe(workspace1.id);
            expect(dataSource2.workspace_id).toBe(workspace2.id);
        });

        test('should belong to correct organization', async () => {
            expect(dataSource1.organization_id).toBe(testOrg1.id);
            expect(dataSource2.organization_id).toBe(testOrg2.id);
        });

        test('should only find data sources in same workspace', async () => {
            const dsRepo = AppDataSource.getRepository(DRADataSource);
            const sourcesInWS1 = await dsRepo.find({ where: { workspace_id: workspace1.id } });
            expect(sourcesInWS1.length).toBeGreaterThan(0);
            expect(sourcesInWS1.every(ds => ds.workspace_id === workspace1.id)).toBe(true);
        });
    });

    describe('Data Model Workspace Validation', () => {
        let dataModel1: DRADataModel;
        let dataModel2: DRADataModel;

        beforeEach(async () => {
            const dmRepo = AppDataSource.getRepository(DRADataModel);
            
            dataModel1 = dmRepo.create({
                schema: 'public',
                name: 'test_model_ws1',
                sql_query: 'SELECT 1',
                query: {} as any,
                organization: testOrg1,
                workspace: workspace1,
            });
            await dmRepo.save(dataModel1);

            dataModel2 = dmRepo.create({
                schema: 'public',
                name: 'test_model_ws2',
                sql_query: 'SELECT 1',
                query: {} as any,
                organization: testOrg2,
                workspace: workspace2,
            });
            await dmRepo.save(dataModel2);
        });

        afterEach(async () => {
            const manager = AppDataSource.manager;
            await manager.delete(DRADataModel, { id: dataModel1.id });
            await manager.delete(DRADataModel, { id: dataModel2.id });
        });

        test('should have non-null workspace_id', async () => {
            expect(dataModel1.workspace_id).toBe(workspace1.id);
            expect(dataModel2.workspace_id).toBe(workspace2.id);
        });

        test('should belong to correct organization', async () => {
            expect(dataModel1.organization_id).toBe(testOrg1.id);
            expect(dataModel2.organization_id).toBe(testOrg2.id);
        });

        test('should only find data models in same workspace', async () => {
            const dmRepo = AppDataSource.getRepository(DRADataModel);
            const modelsInWS1 = await dmRepo.find({ where: { workspace_id: workspace1.id } });
            expect(modelsInWS1.length).toBeGreaterThan(0);
            expect(modelsInWS1.every(dm => dm.workspace_id === workspace1.id)).toBe(true);
        });
    });

    describe('Dashboard Workspace Validation', () => {
        let dashboard1: DRADashboard;
        let dashboard2: DRADashboard;

        beforeEach(async () => {
            const dashRepo = AppDataSource.getRepository(DRADashboard);
            
            dashboard1 = dashRepo.create({
                project: project1,
                name: 'Test Dashboard WS1',
                data: { charts: [] },
                organization: testOrg1,
                workspace: workspace1,
            });
            await dashRepo.save(dashboard1);

            dashboard2 = dashRepo.create({
                project: project2,
                name: 'Test Dashboard WS2',
                data: { charts: [] },
                organization: testOrg2,
                workspace: workspace2,
            });
            await dashRepo.save(dashboard2);
        });

        afterEach(async () => {
            const manager = AppDataSource.manager;
            await manager.delete(DRADashboard, { id: dashboard1.id });
            await manager.delete(DRADashboard, { id: dashboard2.id });
        });

        test('should have non-null workspace_id', async () => {
            expect(dashboard1.workspace_id).toBe(workspace1.id);
            expect(dashboard2.workspace_id).toBe(workspace2.id);
        });

        test('should belong to correct organization', async () => {
            expect(dashboard1.organization_id).toBe(testOrg1.id);
            expect(dashboard2.organization_id).toBe(testOrg2.id);
        });

        test('should only find dashboards in same workspace', async () => {
            const dashRepo = AppDataSource.getRepository(DRADashboard);
            const dashboardsInWS1 = await dashRepo.find({ where: { workspace_id: workspace1.id } });
            expect(dashboardsInWS1.length).toBeGreaterThan(0);
            expect(dashboardsInWS1.every(d => d.workspace_id === workspace1.id)).toBe(true);
        });
    });

    describe('Migration Verification', () => {
        test('all data sources should have non-null workspace_id', async () => {
            const dsRepo = AppDataSource.getRepository(DRADataSource);
            const nullWorkspaceCount = await dsRepo
                .createQueryBuilder('ds')
                .where('ds.workspace_id IS NULL')
                .getCount();

            expect(nullWorkspaceCount).toBe(0);
        });

        test('all data models should have non-null workspace_id', async () => {
            const dmRepo = AppDataSource.getRepository(DRADataModel);
            const nullWorkspaceCount = await dmRepo
                .createQueryBuilder('dm')
                .where('dm.workspace_id IS NULL')
                .getCount();

            expect(nullWorkspaceCount).toBe(0);
        });

        test('all dashboards should have non-null workspace_id', async () => {
            const dashRepo = AppDataSource.getRepository(DRADashboard);
            const nullWorkspaceCount = await dashRepo
                .createQueryBuilder('d')
                .where('d.workspace_id IS NULL')
                .getCount();

            expect(nullWorkspaceCount).toBe(0);
        });

        test('all data sources should have matching organization_id and workspace.organization_id', async () => {
            const result = await AppDataSource.query(`
                SELECT COUNT(*) as mismatch_count
                FROM dra_data_sources ds
                JOIN dra_workspaces w ON ds.workspace_id = w.id
                WHERE ds.organization_id != w.organization_id
            `);

            expect(parseInt(result[0].mismatch_count)).toBe(0);
        });
    });
});
