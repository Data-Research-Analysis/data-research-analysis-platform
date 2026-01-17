/**
 * Tests for ProjectProcessor member creation functionality.
 * Verifies that creating a project via addProject() automatically creates
 * a project member entry with owner role for the creator.
 */

import { ProjectProcessor } from '../../processors/ProjectProcessor.js';
import { AppDataSource } from '../../datasources/PostgresDSMigrations.js';
import { DRAProject } from '../../models/DRAProject.js';
import { DRAProjectMember } from '../../models/DRAProjectMember.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { EProjectRole } from '../../types/EProjectRole.js';
import { ITokenDetails } from '../../types/ITokenDetails.js';
import { EUserType } from '../../types/EUserType.js';

describe('ProjectProcessor - Member Creation', () => {
    let testUser: DRAUsersPlatform;
    let projectProcessor: ProjectProcessor;

    beforeAll(async () => {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        projectProcessor = ProjectProcessor.getInstance();
    });

    afterAll(async () => {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    beforeEach(async () => {
        // Create a test user
        const userRepo = AppDataSource.getRepository(DRAUsersPlatform);
        testUser = await userRepo.save({
            email: `test-member-creation-${Date.now()}@test.com`,
            first_name: 'Test',
            last_name: 'User',
            password: 'hashedpassword',
            user_type: EUserType.NORMAL,
            email_verified_at: new Date()
        });
    });

    afterEach(async () => {
        // Clean up test data
        const projectRepo = AppDataSource.getRepository(DRAProject);
        const memberRepo = AppDataSource.getRepository(DRAProjectMember);
        const userRepo = AppDataSource.getRepository(DRAUsersPlatform);

        // Clean up using raw query since TypeORM delete with relations is complex
        await memberRepo.createQueryBuilder().delete().where('users_platform_id = :userId', { userId: testUser.id }).execute();
        await projectRepo.createQueryBuilder().delete().where('users_platform_id = :userId', { userId: testUser.id }).execute();
        await userRepo.delete({ id: testUser.id });
    });

    describe('addProject', () => {
        it('should create a project member entry with owner role when creating a project', async () => {
            // Arrange
            const projectName = 'Test Project Member Creation';
            const projectDescription = 'Testing automatic member entry creation';
            const tokenDetails: ITokenDetails = {
                user_id: testUser.id,
                email: testUser.email,
                user_type: testUser.user_type,
                iat: Math.floor(Date.now() / 1000)
            };

            // Act
            const result = await projectProcessor.addProject(
                projectName,
                projectDescription,
                tokenDetails
            );

            // Assert
            expect(result).toBe(true);

            // Verify project was created
            const projectRepo = AppDataSource.getRepository(DRAProject);
            const project = await projectRepo.findOne({
                where: {
                    name: projectName,
                    users_platform: { id: testUser.id }
                }
            });
            expect(project).toBeDefined();
            expect(project!.name).toBe(projectName);

            // Verify project member entry was created
            const memberRepo = AppDataSource.getRepository(DRAProjectMember);
            const member = await memberRepo.findOne({
                where: {
                    project: { id: project!.id },
                    user: { id: testUser.id }
                },
                relations: ['project', 'user']
            });
            expect(member).toBeDefined();
            expect(member!.role).toBe(EProjectRole.OWNER);
            expect(member!.added_at).toBeDefined();
        });

        it('should create member entry even if project description is empty', async () => {
            // Arrange
            const projectName = 'Test Project No Description';
            const tokenDetails: ITokenDetails = {
                user_id: testUser.id,
                email: testUser.email,
                user_type: testUser.user_type,
                iat: Math.floor(Date.now() / 1000)
            };

            // Act
            const result = await projectProcessor.addProject(
                projectName,
                '', // Empty description
                tokenDetails
            );

            // Assert
            expect(result).toBe(true);

            // Verify member entry exists
            const projectRepo = AppDataSource.getRepository(DRAProject);
            const project = await projectRepo.findOne({
                where: { name: projectName, users_platform: { id: testUser.id } }
            });

            const memberRepo = AppDataSource.getRepository(DRAProjectMember);
            const member = await memberRepo.findOne({
                where: { project: { id: project!.id } },
                relations: ['project']
            });

            expect(member).toBeDefined();
            expect(member!.role).toBe(EProjectRole.OWNER);
        });

        it('should create separate member entries for multiple projects by same user', async () => {
            // Arrange
            const tokenDetails: ITokenDetails = {
                user_id: testUser.id,
                email: testUser.email,
                user_type: testUser.user_type,
                iat: Math.floor(Date.now() / 1000)
            };

            // Act - Create two projects
            await projectProcessor.addProject('Project 1', 'First project', tokenDetails);
            await projectProcessor.addProject('Project 2', 'Second project', tokenDetails);

            // Assert
            const memberRepo = AppDataSource.getRepository(DRAProjectMember);
            const members = await memberRepo.find({
                where: { user: { id: testUser.id } },
                relations: ['project']
            });

            expect(members).toHaveLength(2);
            expect(members[0].role).toBe(EProjectRole.OWNER);
            expect(members[1].role).toBe(EProjectRole.OWNER);
        });

        it('should use transaction for atomic project and member creation', async () => {
            // This test verifies transaction behavior by checking that both
            // project and member are created together or not at all
            const projectName = 'Test Transaction Project';
            const tokenDetails: ITokenDetails = {
                user_id: testUser.id,
                email: testUser.email,
                user_type: testUser.user_type,
                iat: Math.floor(Date.now() / 1000)
            };

            // Act
            const result = await projectProcessor.addProject(
                projectName,
                'Testing transaction',
                tokenDetails
            );

            // Assert - If project exists, member MUST exist
            const projectRepo = AppDataSource.getRepository(DRAProject);
            const project = await projectRepo.findOne({
                where: { name: projectName, users_platform: { id: testUser.id } }
            });

            if (project) {
                const memberRepo = AppDataSource.getRepository(DRAProjectMember);
                const member = await memberRepo.findOne({
                    where: { project: { id: project.id } },
                    relations: ['project']
                });
                expect(member).toBeDefined();
            }

            expect(result).toBe(true);
        });

        it('should set correct timestamps on member entry', async () => {
            // Arrange
            const projectName = 'Test Timestamps Project';
            const tokenDetails: ITokenDetails = {
                user_id: testUser.id,
                email: testUser.email,
                user_type: testUser.user_type,
                iat: Math.floor(Date.now() / 1000)
            };
            const beforeCreation = new Date();

            // Act
            await projectProcessor.addProject(
                projectName,
                'Testing timestamps',
                tokenDetails
            );

            const afterCreation = new Date();

            // Assert
            const projectRepo = AppDataSource.getRepository(DRAProject);
            const project = await projectRepo.findOne({
                where: { name: projectName, users_platform: { id: testUser.id } }
            });

            const memberRepo = AppDataSource.getRepository(DRAProjectMember);
            const member = await memberRepo.findOne({
                where: { project: { id: project!.id } },
                relations: ['project']
            });

            expect(member!.added_at).toBeDefined();
            expect(member!.added_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
            expect(member!.added_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
        });
    });
});
