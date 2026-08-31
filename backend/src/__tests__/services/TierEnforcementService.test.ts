import { TierEnforcementService } from '../../services/TierEnforcementService.js';
import { TierLimitError } from '../../types/TierLimitError.js';
import { ESubscriptionTier } from '../../types/ESubscriptionTier.js';
import { EUserType } from '../../types/EUserType.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { getRedisClient } from '../../config/redis.config.js';
import { OrganizationService } from '../../services/OrganizationService.js';

// Mock dependencies
jest.mock('../../drivers/DBDriver.js');
jest.mock('../../config/redis.config.js');
jest.mock('../../services/OrganizationService.js');

describe('TierEnforcementService', () => {
    let service: TierEnforcementService;
    let mockManager: any;
    let mockDriver: any;
    let mockRedis: any;
    let mockGetOrgSubscriptionTierForUser: jest.Mock;

    beforeEach(() => {
        // Mock Redis client BEFORE constructing the singleton so it is captured
        mockRedis = {
            get: jest.fn(),
            set: jest.fn(),
            setex: jest.fn(),
            incr: jest.fn(),
            expire: jest.fn(),
            ttl: jest.fn(),
            del: jest.fn(),
        };
        (getRedisClient as jest.Mock).mockReturnValue(mockRedis);

        // Reset the singleton so it re-initialises with the mocked dependencies
        (TierEnforcementService as any).instance = undefined;
        service = TierEnforcementService.getInstance();

        // Mock TypeORM manager
        mockManager = {
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            query: jest.fn().mockResolvedValue([{ count: '0' }]),
            createQueryBuilder: jest.fn((entity: any) => {
                const qb: any = {};
                qb.innerJoin = jest.fn(() => qb);
                qb.where = jest.fn(() => qb);
                qb.getCount = jest.fn(() => Promise.resolve(0));
                return qb;
            }),
        };

        // Mock driver
        mockDriver = {
            getConcreteDriver: jest.fn().mockResolvedValue({
                manager: mockManager,
            }),
        };

        (DBDriver.getInstance as jest.Mock) = jest.fn().mockReturnValue({
            getDriver: jest.fn().mockResolvedValue(mockDriver),
        });

        // Mock OrganizationService singleton
        mockGetOrgSubscriptionTierForUser = jest.fn();
        (OrganizationService.getInstance as jest.Mock) = jest.fn().mockReturnValue({
            getOrgSubscriptionTierForUser: mockGetOrgSubscriptionTierForUser,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('isAdmin', () => {
        it('should return true for admin users', async () => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.ADMIN,
            });

            const result = await service.isAdmin(1);
            expect(result).toBe(true);
            expect(mockManager.findOne).toHaveBeenCalledWith(
                expect.anything(),
                { where: { id: 1 } }
            );
        });

        it('should return false for non-admin users', async () => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.NORMAL,
            });

            const result = await service.isAdmin(1);
            expect(result).toBe(false);
        });

        it('should return false when user not found', async () => {
            mockManager.findOne.mockResolvedValue(null);

            const result = await service.isAdmin(1);
            expect(result).toBe(false);
        });

        it('should handle database errors gracefully', async () => {
            (DBDriver.getInstance as jest.Mock) = jest.fn().mockReturnValue({
                getDriver: jest.fn().mockResolvedValue(null),
            });

            const result = await service.isAdmin(1);
            expect(result).toBe(false);
        });
    });

    describe('canCreateProject', () => {
        const mockFreeTier = {
            id: 1,
            tier_name: ESubscriptionTier.FREE,
            max_projects: 3,
            price_per_month_usd: 0,
        };

        beforeEach(() => {
            // Default: normal user, FREE tier via org subscription
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.NORMAL,
            });
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: mockFreeTier,
                orgSubscription: { id: 1 },
            });
            mockRedis.get.mockResolvedValue(null); // No override
        });

        it('should allow creation when under limit', async () => {
            mockManager.count.mockResolvedValue(2); // 2 projects, limit is 3

            await expect(service.canCreateProject(1)).resolves.toBeUndefined();
        });

        it('should throw TierLimitError when at limit', async () => {
            mockManager.count.mockResolvedValue(3); // 3 projects, limit is 3
            mockManager.find.mockResolvedValue([
                {
                    tier_name: ESubscriptionTier.PROFESSIONAL,
                    max_projects: 10,
                    price_per_month_usd: 9.99,
                },
            ]);

            await expect(service.canCreateProject(1)).rejects.toThrow(TierLimitError);
            await expect(service.canCreateProject(1)).rejects.toMatchObject({
                tierName: ESubscriptionTier.FREE,
                resource: 'project',
                currentUsage: 3,
                limit: 3,
            });
        });

        it('should allow unlimited projects when max_projects is null', async () => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: { ...mockFreeTier, max_projects: null },
                orgSubscription: { id: 1 },
            });
            mockManager.count.mockResolvedValue(1000); // Many projects

            await expect(service.canCreateProject(1)).resolves.toBeUndefined();
        });

        it('should bypass limit for admin users', async () => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.ADMIN,
            });
            mockManager.count.mockResolvedValue(100); // Over limit

            await expect(service.canCreateProject(1)).resolves.toBeUndefined();
        });

        it('should use override limit when present', async () => {
            mockRedis.get.mockResolvedValue(
                JSON.stringify({
                    userId: 1,
                    resource: 'projects',
                    overrideCount: 10,
                    grantedBy: 2,
                })
            );
            mockManager.count.mockResolvedValue(5); // Under override limit

            await expect(service.canCreateProject(1)).resolves.toBeUndefined();
        });

        it('should enforce override limit when exceeded', async () => {
            // First redis.get is the override lookup, second is the count cache (miss -> DB count)
            mockRedis.get.mockResolvedValueOnce(
                JSON.stringify({
                    userId: 1,
                    resource: 'projects',
                    overrideCount: 10,
                    grantedBy: 2,
                })
            );
            mockRedis.get.mockResolvedValueOnce(null);
            mockManager.count.mockResolvedValue(10); // At override limit
            mockManager.find.mockResolvedValue([]);

            await expect(service.canCreateProject(1)).rejects.toThrow(TierLimitError);
        });
    });

    describe('canCreateDataSource', () => {
        const mockStarterTier = {
            id: 2,
            tier_name: ESubscriptionTier.PROFESSIONAL,
            max_data_sources_per_project: 5,
            price_per_month_usd: 9.99,
        };

        beforeEach(() => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.NORMAL,
            });
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: mockStarterTier,
                orgSubscription: { id: 1 },
            });
            mockRedis.get.mockResolvedValue(null);
        });

        it('should allow creation when under per-project limit', async () => {
            mockManager.count.mockResolvedValue(3); // 3 data sources in project

            await expect(service.canCreateDataSource(1, 100)).resolves.toBeUndefined();
        });

        it('should throw TierLimitError when at per-project limit', async () => {
            mockManager.count.mockResolvedValue(5); // 5 data sources, limit is 5
            mockManager.find.mockResolvedValue([]);

            await expect(service.canCreateDataSource(1, 100)).rejects.toThrow(TierLimitError);
            await expect(service.canCreateDataSource(1, 100)).rejects.toMatchObject({
                resource: 'data_source',
                currentUsage: 5,
                limit: 5,
            });
        });

        it('should bypass limit for admin users', async () => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.ADMIN,
            });
            mockManager.count.mockResolvedValue(100);

            await expect(service.canCreateDataSource(1, 100)).resolves.toBeUndefined();
        });

        it('should use override limit when present', async () => {
            mockRedis.get.mockResolvedValue(
                JSON.stringify({
                    userId: 1,
                    resource: 'data_sources',
                    overrideCount: 15,
                })
            );
            mockManager.count.mockResolvedValue(10);

            await expect(service.canCreateDataSource(1, 100)).resolves.toBeUndefined();
        });
    });

    describe('canCreateDashboard', () => {
        const mockProTier = {
            id: 3,
            tier_name: ESubscriptionTier.PROFESSIONAL,
            max_dashboards: 20,
            price_per_month_usd: 29.99,
        };

        beforeEach(() => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.NORMAL,
            });
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: mockProTier,
                orgSubscription: { id: 1 },
            });
            mockRedis.get.mockResolvedValue(null);
        });

        it('should allow creation when under limit', async () => {
            mockManager.count.mockResolvedValue(15);

            await expect(service.canCreateDashboard(1)).resolves.toBeUndefined();
        });

        it('should throw TierLimitError when at limit', async () => {
            mockManager.count.mockResolvedValue(20);
            mockManager.find.mockResolvedValue([]);

            await expect(service.canCreateDashboard(1)).rejects.toThrow(TierLimitError);
        });

        it('should bypass limit for admin users', async () => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.ADMIN,
            });
            mockManager.count.mockResolvedValue(100);

            await expect(service.canCreateDashboard(1)).resolves.toBeUndefined();
        });
    });

    describe('canUseAIGeneration', () => {
        const mockStarterTier = {
            id: 2,
            tier_name: ESubscriptionTier.PROFESSIONAL,
            ai_generations_per_month: 50,
            price_per_month_usd: 9.99,
        };

        beforeEach(() => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.NORMAL,
            });
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: mockStarterTier,
                orgSubscription: { id: 1 },
            });
            mockRedis.get.mockResolvedValue(null);
        });

        it('should allow AI generation when under monthly limit', async () => {
            mockRedis.get.mockResolvedValueOnce(null); // No override
            mockRedis.get.mockResolvedValueOnce('30'); // 30 generations used

            await expect(service.canUseAIGeneration(1)).resolves.toBeUndefined();
        });

        it('should throw TierLimitError when at monthly limit', async () => {
            mockRedis.get.mockImplementation((key: string) => {
                if (key === 'ai-generation-count:1') return Promise.resolve('50');
                return Promise.resolve(null);
            });
            mockManager.find.mockResolvedValue([]);

            await expect(service.canUseAIGeneration(1)).rejects.toThrow(TierLimitError);
            await expect(service.canUseAIGeneration(1)).rejects.toMatchObject({
                resource: 'ai_generation',
                currentUsage: 50,
                limit: 50,
            });
        });

        it('should allow unlimited AI generations when limit is null', async () => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: { ...mockStarterTier, ai_generations_per_month: null },
                orgSubscription: { id: 1 },
            });
            mockRedis.get.mockResolvedValue('1000');

            await expect(service.canUseAIGeneration(1)).resolves.toBeUndefined();
        });

        it('should bypass limit for admin users', async () => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.ADMIN,
            });
            mockRedis.get.mockResolvedValue('1000');

            await expect(service.canUseAIGeneration(1)).resolves.toBeUndefined();
        });

        it('should use override limit when present', async () => {
            mockRedis.get.mockResolvedValueOnce(
                JSON.stringify({
                    userId: 1,
                    resource: 'ai_generations',
                    overrideCount: 100,
                })
            );
            mockRedis.get.mockResolvedValueOnce('75'); // Under override

            await expect(service.canUseAIGeneration(1)).resolves.toBeUndefined();
        });
    });

    describe('incrementAIGenerationCount', () => {
        it('should increment Redis counter with 31-day expiration', async () => {
            mockRedis.incr.mockResolvedValue(1); // First increment => sets expiry

            await service.incrementAIGenerationCount(1);

            expect(mockRedis.incr).toHaveBeenCalledWith('ai-generation-count:1');
            expect(mockRedis.expire).toHaveBeenCalledWith(
                'ai-generation-count:1',
                31 * 24 * 60 * 60
            );
        });

        it('should handle Redis errors gracefully', async () => {
            mockRedis.incr.mockRejectedValue(new Error('Redis error'));

            await expect(service.incrementAIGenerationCount(1)).rejects.toThrow('Redis error');
        });
    });

    describe('canCreateDataModel', () => {
        const mockStarterTier = {
            id: 2,
            tier_name: ESubscriptionTier.PROFESSIONAL,
            max_data_models_per_data_source: 3,
            price_per_month_usd: 9.99,
        };

        beforeEach(() => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.NORMAL,
            });
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: mockStarterTier,
                orgSubscription: { id: 1 },
            });
            mockRedis.get.mockResolvedValue(null); // No override
        });

        it('should allow creation when under global limit (sources × models per source)', async () => {
            // 2 data sources, 3 models per source => capacity 6
            mockManager.count.mockImplementation((entity: any) => {
                if (entity.name === 'DRADataSource') return Promise.resolve(2);
                if (entity.name === 'DRADataModel') return Promise.resolve(5); // under 6
                return Promise.resolve(0);
            });

            await expect(service.canCreateDataModel(1)).resolves.toBeUndefined();
        });

        it('should throw TierLimitError when at global limit', async () => {
            // 1 data source, 3 models per source => capacity 3
            mockManager.count.mockImplementation((entity: any) => {
                if (entity.name === 'DRADataSource') return Promise.resolve(1);
                if (entity.name === 'DRADataModel') return Promise.resolve(3); // at 3
                return Promise.resolve(0);
            });
            mockManager.find.mockResolvedValue([]);

            await expect(service.canCreateDataModel(1)).rejects.toThrow(TierLimitError);
            await expect(service.canCreateDataModel(1)).rejects.toMatchObject({
                tierName: ESubscriptionTier.PROFESSIONAL,
                resource: 'data_model',
                currentUsage: 3,
                limit: 3,
            });
        });

        it('should distribute models across sources without distinction', async () => {
            // 2 data sources => capacity 6; all 6 models on one source still blocks
            mockManager.count.mockImplementation((entity: any) => {
                if (entity.name === 'DRADataSource') return Promise.resolve(2);
                if (entity.name === 'DRADataModel') return Promise.resolve(6); // 6 on any source(s)
                return Promise.resolve(0);
            });
            mockManager.find.mockResolvedValue([]);

            await expect(service.canCreateDataModel(1)).rejects.toThrow(TierLimitError);
        });

        it('should increase capacity when a new data source is created', async () => {
            mockManager.count.mockImplementation((entity: any) => {
                if (entity.name === 'DRADataSource') return Promise.resolve(2); // now 2 sources
                if (entity.name === 'DRADataModel') return Promise.resolve(6); // capacity is 6, exactly at
                return Promise.resolve(0);
            });
            mockManager.find.mockResolvedValue([]);

            // With 2 sources, 6 models is at the limit -> blocked
            await expect(service.canCreateDataModel(1)).rejects.toThrow(TierLimitError);

            // Same count with 3 sources (capacity 9) is allowed
            mockManager.count.mockImplementation((entity: any) => {
                if (entity.name === 'DRADataSource') return Promise.resolve(3);
                if (entity.name === 'DRADataModel') return Promise.resolve(6);
                return Promise.resolve(0);
            });

            await expect(service.canCreateDataModel(1)).resolves.toBeUndefined();
        });

        it('should count cross-source models toward the global limit', async () => {
            mockManager.count.mockImplementation((entity: any) => {
                if (entity.name === 'DRADataSource') return Promise.resolve(1);
                if (entity.name === 'DRADataModel') return Promise.resolve(4); // includes cross-source, > 3
                return Promise.resolve(0);
            });
            mockManager.find.mockResolvedValue([]);

            await expect(service.canCreateDataModel(1)).rejects.toThrow(TierLimitError);
        });

        it('should allow unlimited data models when limit is null', async () => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: { ...mockStarterTier, max_data_models_per_data_source: null },
                orgSubscription: { id: 1 },
            });
            mockManager.count.mockResolvedValue(1000);

            await expect(service.canCreateDataModel(1)).resolves.toBeUndefined();
        });

        it('should bypass limit for admin users', async () => {
            mockManager.findOne.mockResolvedValue({
                id: 1,
                user_type: EUserType.ADMIN,
            });
            mockManager.count.mockResolvedValue(1000);

            await expect(service.canCreateDataModel(1)).resolves.toBeUndefined();
        });

        it('should use override limit when present', async () => {
            mockRedis.get.mockResolvedValue(
                JSON.stringify({
                    userId: 1,
                    resource: 'data_models',
                    overrideCount: 10,
                })
            );
            mockManager.count.mockImplementation((entity: any) => {
                if (entity.name === 'DRADataSource') return Promise.resolve(1);
                if (entity.name === 'DRADataModel') return Promise.resolve(9); // under 10
                return Promise.resolve(0);
            });

            await expect(service.canCreateDataModel(1)).resolves.toBeUndefined();
        });
    });

    describe('getUsageStats', () => {
        const mockStarterTier = {
            id: 2,
            tier_name: ESubscriptionTier.PROFESSIONAL,
            max_projects: 10,
            max_data_sources_per_project: 5,
            max_data_models_per_data_source: 3,
            max_dashboards: 15,
            ai_generations_per_month: 50,
            max_rows_per_data_model: 10000,
            price_per_month_usd: 9.99,
        };

        beforeEach(() => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: mockStarterTier,
                orgSubscription: { id: 1 },
            });
            // getUsageStats uses QueryBuilder counts, not manager.count
            mockManager.createQueryBuilder.mockImplementation((entity: any) => {
                const qb: any = {};
                qb.innerJoin = jest.fn(() => qb);
                qb.where = jest.fn(() => qb);
                qb.getCount = jest.fn(() => {
                    if (entity.name === 'DRAProject') return Promise.resolve(5);
                    if (entity.name === 'DRADataSource') return Promise.resolve(20);
                    if (entity.name === 'DRADashboard') return Promise.resolve(10);
                    if (entity.name === 'DRADataModel') return Promise.resolve(30);
                    return Promise.resolve(0);
                });
                return qb;
            });
            mockRedis.get.mockResolvedValue('30'); // AI generations
        });

        it('should return comprehensive usage statistics', async () => {
            const stats = await service.getUsageStats(1);

            expect(stats).toMatchObject({
                tier: ESubscriptionTier.PROFESSIONAL,
                tierDetails: {
                    id: 2,
                    tierName: ESubscriptionTier.PROFESSIONAL,
                    pricePerMonth: 9.99,
                },
                rowLimit: 10000,
                projectCount: 5,
                maxProjects: 10,
                dataSourceCount: 20,
                maxDataSources: 5,
                dataModelCount: 30,
                // Global capacity = 20 sources × 3 models per source = 60
                maxDataModels: 60,
                maxDataModelsPerDataSource: 3,
                dashboardCount: 10,
                maxDashboards: 15,
                aiGenerationsPerMonth: 50,
                aiGenerationsUsed: 30,
                canCreateProject: true,
                canCreateDataSource: false, // 20 > 5
                canCreateDataModel: true, // 30 < 60
                canCreateDashboard: true,
                canUseAIGeneration: true,
            });
        });

        it('should handle unlimited tiers correctly', async () => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: {
                    ...mockStarterTier,
                    max_projects: null,
                    ai_generations_per_month: null,
                    max_data_models_per_data_source: null,
                },
                orgSubscription: { id: 1 },
            });

            const stats = await service.getUsageStats(1);

            expect(stats.canCreateProject).toBe(true);
            expect(stats.canUseAIGeneration).toBe(true);
            expect(stats.maxProjects).toBeNull();
            expect(stats.aiGenerationsPerMonth).toBeNull();
            expect(stats.maxDataModels).toBeNull();
            expect(stats.maxDataModelsPerDataSource).toBeNull();
            expect(stats.canCreateDataModel).toBe(true);
        });

        it('should default to FREE tier when org has no subscription', async () => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: {
                    id: 1,
                    tier_name: ESubscriptionTier.FREE,
                    max_projects: 3,
                    row_limit: 1000,
                    price_per_month_usd: 0,
                },
                orgSubscription: null,
            });

            const stats = await service.getUsageStats(1);

            expect(stats.tier).toBe(ESubscriptionTier.FREE);
            expect(stats.maxProjects).toBe(3);
        });
    });
});
