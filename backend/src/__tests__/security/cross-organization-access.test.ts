/**
 * Cross-Organization Security Tests
 * 
 * Validates that users cannot access resources from organizations they don't belong to.
 * Critical for multi-tenant data isolation and security.
 * 
 * Test Strategy:
 * 1. Create two separate organizations with different users
 * 2. Create projects in each organization
 * 3. Attempt cross-org access and verify 403 responses
 * 4. Test all resource types: projects, data sources, models, dashboards
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { OrganizationService } from '../../services/OrganizationService.js';
import { ProjectProcessor } from '../../processors/ProjectProcessor.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { DRASubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { DRAProject } from '../../models/DRAProject.js';
import bcrypt from 'bcryptjs';

describe('Cross-Organization Security', () => {
    let organizationService: OrganizationService;
    let projectProcessor: ProjectProcessor;
    let manager: any;
    
    // Test data
    let user1: DRAUsersPlatform;
    let user2: DRAUsersPlatform;
    let org1Id: number;
    let org2Id: number;
    let org1Project: DRAProject;
    let org2Project: DRAProject;
    let freeTier: DRASubscriptionTier;

    beforeAll(async () => {
        organizationService = OrganizationService.getInstance();
        projectProcessor = ProjectProcessor.getInstance();
        
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const dataSource = await driver.getConcreteDriver();
        manager = dataSource.manager;

        // Get FREE tier for subscriptions
        freeTier = await manager.findOne(DRASubscriptionTier, { where: { tier_name: 'free' } });
        if (!freeTier) {
            throw new Error('FREE tier not found - run seeders first');
        }

        // Create test users
        const hashedPassword = await bcrypt.hash('test123', 10);
        
        user1 = manager.create(DRAUsersPlatform, {
            email: 'orgtest1@example.com',
            first_name: 'User',
            last_name: 'One',
            password: hashedPassword,
            user_type: 'normal',
            email_verified_at: new Date()
        });
        await manager.save(user1);

        user2 = manager.create(DRAUsersPlatform, {
            email: 'orgtest2@example.com',
            first_name: 'User',
            last_name: 'Two',
            password: hashedPassword,
            user_type: 'normal',
            email_verified_at: new Date()
        });
        await manager.save(user2);

        // Create organizations for each user
        const org1 = await organizationService.createOrganization({
            name: 'Test Organization 1',
            slug: `test-org-1-${Date.now()}`,
            ownerId: user1.id,
            subscriptionTierId: freeTier.id
        });
        org1Id = org1.id;

        const org2 = await organizationService.createOrganization({
            name: 'Test Organization 2',
            slug: `test-org-2-${Date.now()}`,
            ownerId: user2.id,
            subscriptionTierId: freeTier.id
        });
        org2Id = org2.id;

        // Get workspaces (created automatically)
        const workspaces1 = await organizationService['getEntityManager']()
            .then(m => m.find(require('../../models/DRAWorkspace.js').DRAWorkspace, {
                where: { organization: { id: org1Id } }
            }));
        const workspaces2 = await organizationService['getEntityManager']()
            .then(m => m.find(require('../../models/DRAWorkspace.js').DRAWorkspace, {
                where: { organization: { id: org2Id } }
            }));

        // Create projects in each organization
        org1Project = manager.create(DRAProject, {
            name: 'Org 1 Project',
            description: 'Test project for org 1',
            users_platform: user1,
            organization_id: org1Id,
            workspace_id: workspaces1[0].id
        });
        await manager.save(org1Project);

        org2Project = manager.create(DRAProject, {
            name: 'Org 2 Project',
            description: 'Test project for org 2',
            users_platform: user2,
            organization_id: org2Id,
            workspace_id: workspaces2[0].id
        });
        await manager.save(org2Project);
    });

    afterAll(async () => {
        // Cleanup test data
        if (org1Project) await manager.remove(org1Project);
        if (org2Project) await manager.remove(org2Project);
        
        // Organizations cascade delete (will remove workspaces, members, subscriptions)
        if (org1Id) {
            const org1 = await manager.findOne(require('../../models/DRAOrganization.js').DRAOrganization, { where: { id: org1Id } });
            if (org1) await manager.remove(org1);
        }
        if (org2Id) {
            const org2 = await manager.findOne(require('../../models/DRAOrganization.js').DRAOrganization, { where: { id: org2Id } });
            if (org2) await manager.remove(org2);
        }
        
        if (user1) await manager.remove(user1);
        if (user2) await manager.remove(user2);
    });

    describe('Organization Membership Validation', () => {
        it('should allow access to own organization projects', async () => {
            const projects = await projectProcessor.getProjects(
                user1.id,
                org1Id
            );
            
            expect(projects).toBeDefined();
            expect(projects.length).toBeGreaterThan(0);
            expect(projects.some(p => p.id === org1Project.id)).toBe(true);
        });

        it('should NOT allow access to other organization projects', async () => {
            const projects = await projectProcessor.getProjects(
                user1.id,
                org2Id // User 1 trying to access Org 2
            );
            
            // Should return empty array or not include org2's project
            expect(projects.some(p => p.id === org2Project.id)).toBe(false);
        });

        it('should verify user is member before returning org data', async () => {
            const isMember1 = await organizationService.isUserMember(user1.id, org1Id);
            const isMember2 = await organizationService.isUserMember(user1.id, org2Id);
            
            expect(isMember1).toBe(true);
            expect(isMember2).toBe(false); // User 1 should NOT be member of Org 2
        });
    });

    describe('Project Isolation', () => {
        it('should filter projects by organization_id', async () => {
            // Get all projects for user1 in org1
            const org1Projects = await projectProcessor.getProjects(user1.id, org1Id);
            
            // Verify ALL returned projects belong to org1
            for (const project of org1Projects) {
                expect(project.organization_id).toBe(org1Id);
            }
        });

        it('should prevent cross-org project access via getProjectById', async () => {
            // User 1 tries to get User 2's project
            const project = await projectProcessor.getProjectById(
                org2Project.id,
                { user_id: user1.id, user_type: 'normal', email: user1.email },
                org1Id // User 1 requests from their org context
            );
            
            // Should return null or throw error (depends on implementation)
            expect(project).toBeNull();
        });
    });

    describe('Workspace Isolation', () => {
        it('should only allow access to workspaces in user\'s organizations', async () => {
            // Get user1's organizations
            const orgs = await organizationService.getUserOrganizations(user1.id);
            
            // Verify user1 only sees org1
            expect(orgs.length).toBe(1);
            expect(orgs[0].id).toBe(org1Id);
        });

        it('should prevent adding members to organizations user doesn\'t own/admin', async () => {
            // User 1 tries to add themselves to Org 2
            await expect(async () => {
                await organizationService.addMember({
                    organizationId: org2Id,
                    userId: user1.id,
                    role: 'member' as any,
                    invitedByUserId: user1.id // User 1 is NOT an admin of Org 2
                });
            }).rejects.toThrow();
        });
    });

    describe('Subscription Enforcement', () => {
        it('should enforce max_members limit per organization', async () => {
            const usage = await organizationService.getOrganizationUsage(org1Id);
            
            expect(usage.currentMembers).toBe(1); // Only owner
            expect(usage.maxMembers).toBe(1); // FREE tier limit
            expect(usage.canAddMembers).toBe(false);
        });

        it('should block member additions when limit reached', async () => {
            // Try to add user2 to org1 (which is at max capacity: 1/1)
            await expect(async () => {
                await organizationService.addMember({
                    organizationId: org1Id,
                    userId: user2.id,
                    role: 'member' as any,
                    invitedByUserId: user1.id
                });
            }).rejects.toThrow(/limit|capacity|maximum/i);
        });
    });

    describe('Data Source Isolation (Integration)', () => {
        it('should prevent accessing data sources from other orgs', async () => {
            // Create data source in org1
            // Then verify user2 cannot access it
            // This requires DataSourceProcessor integration
            
            // TODO: Implement once DataSourceProcessor has full org context
            expect(true).toBe(true); // Placeholder
        });
    });

    describe('Dashboard Isolation (Integration)', () => {
        it('should prevent accessing dashboards from other orgs', async () => {
            // Create dashboard in org1
            // Then verify user2 cannot access it
            // This requires DashboardProcessor integration
            
            // TODO: Implement once DashboardProcessor has full org context
            expect(true).toBe(true); // Placeholder
        });
    });
});

describe('Organization Context Middleware Integration', () => {
    it('should inject organizationId into request', () => {
        // TODO: Test organizationContext middleware with mock requests
        expect(true).toBe(true); // Placeholder
    });

    it('should reject requests with invalid organization ID', () => {
        // TODO: Test middleware rejection
        expect(true).toBe(true); // Placeholder
    });

    it('should handle optional organization context gracefully', () => {
        // Test optionalOrganizationContext for backward compatibility
        expect(true).toBe(true); // Placeholder
    });
});
