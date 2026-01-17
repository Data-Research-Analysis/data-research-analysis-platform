import { TierEnforcementService } from '../../services/TierEnforcementService.js';
import { TierLimitError } from '../../types/TierLimitError.js';
import { ESubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { EUserType } from '../../types/EUserType.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { getRedisClient } from '../../config/redis.config.js';

// Mock dependencies
jest.mock('../../drivers/DBDriver.js');
jest.mock('../../config/redis.config.js');

describe('TierEnforcementService', () => {
    let service: TierEnforcementService;
    let mockManager: any;
    let mockDriver: any;
    let mockRedis: any;

    beforeEach(() => {
        service = TierEnforcementService.getInstance();

        // Mock Redis client
        mockRedis = {
            get: jest.fn(),
            set: jest.fn(),
            incr: jest.fn(),
            expire: jest.fn(),
            ttl: jest.fn(),
            del: jest.fn(),
        };
        (getRedisClient as jest.Mock).mockReturnValue(mockRedis);

        // Mock TypeORM manager
        mockManager = {
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
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
            // Mock active subscription
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve({
                        id: 1,
                        subscription_tier: mockFreeTier,
                        is_active: true,
                    });
                }
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.NORMAL,
                    });
                }
                return Promise.resolve(null);
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
                    tier_name: ESubscriptionTier.PRO,
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
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve({
                        id: 1,
                        subscription_tier: { ...mockFreeTier, max_projects: null },
                        is_active: true,
                    });
                }
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.NORMAL,
                    });
                }
                return Promise.resolve(null);
            });
            mockManager.count.mockResolvedValue(1000); // Many projects

            await expect(service.canCreateProject(1)).resolves.toBeUndefined();
        });

        it('should bypass limit for admin users', async () => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.ADMIN,
                    });
                }
                return Promise.resolve(null);
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
            mockRedis.get.mockResolvedValue(
                JSON.stringify({
                    userId: 1,
                    resource: 'projects',
                    overrideCount: 10,
                    grantedBy: 2,
                })
            );
            mockManager.count.mockResolvedValue(10); // At override limit
            mockManager.find.mockResolvedValue([]);

            await expect(service.canCreateProject(1)).rejects.toThrow(TierLimitError);
        });
    });

    describe('canCreateDataSource', () => {
        const mockStarterTier = {
            id: 2,
            tier_name: ESubscriptionTier.PRO,
            max_data_sources_per_project: 5,
            price_per_month_usd: 9.99,
        };

        beforeEach(() => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve({
                        id: 1,
                        subscription_tier: mockStarterTier,
                        is_active: true,
                    });
                }
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.NORMAL,
                    });
                }
                return Promise.resolve(null);
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
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.ADMIN,
                    });
                }
                return Promise.resolve(null);
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
            tier_name: ESubscriptionTier.PRO,
            max_dashboards: 20,
            price_per_month_usd: 29.99,
        };

        beforeEach(() => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve({
                        id: 1,
                        subscription_tier: mockProTier,
                        is_active: true,
                    });
                }
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.NORMAL,
                    });
                }
                return Promise.resolve(null);
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
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.ADMIN,
                    });
                }
                return Promise.resolve(null);
            });
            mockManager.count.mockResolvedValue(100);

            await expect(service.canCreateDashboard(1)).resolves.toBeUndefined();
        });
    });

    describe('canUseAIGeneration', () => {
        const mockStarterTier = {
            id: 2,
            tier_name: ESubscriptionTier.PRO,
            ai_generations_per_month: 50,
            price_per_month_usd: 9.99,
        };

        beforeEach(() => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve({
                        id: 1,
                        subscription_tier: mockStarterTier,
                        is_active: true,
                    });
                }
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.NORMAL,
                    });
                }
                return Promise.resolve(null);
            });
            mockRedis.get.mockResolvedValue(null);
        });

        it('should allow AI generation when under monthly limit', async () => {
            mockRedis.get.mockResolvedValueOnce(null); // No override
            mockRedis.get.mockResolvedValueOnce('30'); // 30 generations used

            await expect(service.canUseAIGeneration(1)).resolves.toBeUndefined();
        });

        it('should throw TierLimitError when at monthly limit', async () => {
            mockRedis.get.mockResolvedValueOnce(null); // No override
            mockRedis.get.mockResolvedValueOnce('50'); // 50 generations used
            mockManager.find.mockResolvedValue([]);

            await expect(service.canUseAIGeneration(1)).rejects.toThrow(TierLimitError);
            await expect(service.canUseAIGeneration(1)).rejects.toMatchObject({
                resource: 'ai_generation',
                currentUsage: 50,
                limit: 50,
            });
        });

        it('should allow unlimited AI generations when limit is null', async () => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve({
                        id: 1,
                        subscription_tier: {
                            ...mockStarterTier,
                            ai_generations_per_month: null,
                        },
                        is_active: true,
                    });
                }
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.NORMAL,
                    });
                }
                return Promise.resolve(null);
            });
            mockRedis.get.mockResolvedValue('1000');

            await expect(service.canUseAIGeneration(1)).resolves.toBeUndefined();
        });

        it('should bypass limit for admin users', async () => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUsersPlatform') {
                    return Promise.resolve({
                        id: 1,
                        user_type: EUserType.ADMIN,
                    });
                }
                return Promise.resolve(null);
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
            mockRedis.incr.mockResolvedValue(5);

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

    describe('getUsageStats', () => {
        const mockStarterTier = {
            id: 2,
            tier_name: ESubscriptionTier.PRO,
            max_projects: 10,
            max_data_sources_per_project: 5,
            max_dashboards: 15,
            ai_generations_per_month: 50,
            row_limit: 10000,
            price_per_month_usd: 9.99,
        };

        beforeEach(() => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve({
                        id: 1,
                        subscription_tier: mockStarterTier,
                        is_active: true,
                    });
                }
                return Promise.resolve(null);
            });
            mockManager.count.mockImplementation((entity: any) => {
                if (entity.name === 'DRAProject') return Promise.resolve(5);
                if (entity.name === 'DRADataSource') return Promise.resolve(20);
                if (entity.name === 'DRADashboard') return Promise.resolve(10);
                return Promise.resolve(0);
            });
            mockRedis.get.mockResolvedValue('30'); // AI generations
        });

        it('should return comprehensive usage statistics', async () => {
            const stats = await service.getUsageStats(1);

            expect(stats).toMatchObject({
                tier: ESubscriptionTier.PRO,
                tierDetails: {
                    id: 2,
                    tierName: ESubscriptionTier.PRO,
                    pricePerMonth: 9.99,
                },
                rowLimit: 10000,
                projectCount: 5,
                maxProjects: 10,
                dataSourceCount: 20,
                maxDataSources: 5,
                dashboardCount: 10,
                maxDashboards: 15,
                aiGenerationsPerMonth: 50,
                aiGenerationsUsed: 30,
                canCreateProject: true,
                canCreateDataSource: false, // 20 > 5
                canCreateDashboard: true,
                canUseAIGeneration: true,
            });
        });

        it('should handle unlimited tiers correctly', async () => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve({
                        id: 1,
                        subscription_tier: {
                            ...mockStarterTier,
                            max_projects: null,
                            ai_generations_per_month: null,
                        },
                        is_active: true,
                    });
                }
                return Promise.resolve(null);
            });

            const stats = await service.getUsageStats(1);

            expect(stats.canCreateProject).toBe(true);
            expect(stats.canUseAIGeneration).toBe(true);
            expect(stats.maxProjects).toBeNull();
            expect(stats.aiGenerationsPerMonth).toBeNull();
        });

        it('should default to FREE tier when no subscription found', async () => {
            mockManager.findOne.mockImplementation((entity: any) => {
                if (entity.name === 'DRAUserSubscription') {
                    return Promise.resolve(null);
                }
                if (entity.name === 'DRASubscriptionTier') {
                    return Promise.resolve({
                        id: 1,
                        tier_name: ESubscriptionTier.FREE,
                        max_projects: 3,
                        row_limit: 1000,
                        price_per_month_usd: 0,
                    });
                }
                return Promise.resolve(null);
            });

            const stats = await service.getUsageStats(1);

            expect(stats.tier).toBe(ESubscriptionTier.FREE);
            expect(stats.maxProjects).toBe(3);
        });
    });
});
