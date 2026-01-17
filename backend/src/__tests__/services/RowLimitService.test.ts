import { RowLimitService } from '../../services/RowLimitService.js';
import { ESubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { DBDriver } from '../../drivers/DBDriver.js';

// Mock DBDriver
jest.mock('../../drivers/DBDriver.js');

describe('RowLimitService', () => {
    let service: RowLimitService;
    let mockTierRepository: any;
    let mockSubscriptionRepository: any;
    let mockUserRepository: any;
    let mockProjectRepository: any;
    let mockDataSourceRepository: any;
    let mockDashboardRepository: any;
    let mockDriver: any;

    beforeEach(() => {
        service = RowLimitService.getInstance();

        // Create mock repositories
        mockTierRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        mockSubscriptionRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        mockUserRepository = { findOne: jest.fn() };
        mockProjectRepository = { count: jest.fn() };
        mockDataSourceRepository = { count: jest.fn() };
        mockDashboardRepository = { count: jest.fn() };

        // Create mock driver
        mockDriver = {
            getRepository: jest.fn((entity) => {
                if (entity.name === 'DRASubscriptionTier') return mockTierRepository;
                if (entity.name === 'DRAUserSubscription') return mockSubscriptionRepository;
                if (entity.name === 'DRAUsersPlatform') return mockUserRepository;
                if (entity.name === 'DRAProjects') return mockProjectRepository;
                if (entity.name === 'DRADataSource') return mockDataSourceRepository;
                if (entity.name === 'DRADashboards') return mockDashboardRepository;
                return {};
            }),
        };

        // Mock DBDriver.getInstance().getDriver()
        (DBDriver.getInstance as jest.Mock) = jest.fn().mockReturnValue({
            getDriver: jest.fn().mockResolvedValue(mockDriver),
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getUserTier', () => {
        it('should return FREE tier for new user without subscription', async () => {
            const mockFreeTier = {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
            };

            mockSubscriptionRepository.findOne.mockResolvedValue(null);
            mockTierRepository.findOne.mockResolvedValue(mockFreeTier);
            mockSubscriptionRepository.create.mockReturnValue({
                users_platform_id: 1,
                subscription_tier_id: 1,
            });
            mockSubscriptionRepository.save.mockResolvedValue({});

            const result = await service.getUserTier(1);

            expect(result).toEqual(mockFreeTier);
            expect(mockSubscriptionRepository.save).toHaveBeenCalled();
        });

        it('should return existing tier for subscribed user', async () => {
            const mockProTier = {
                id: 2,
                tier_name: ESubscriptionTier.PRO,
                max_rows_per_data_model: '5000000',
            };

            const mockSubscription = {
                subscription_tier: mockProTier,
            };

            mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);

            const result = await service.getUserTier(1);

            expect(result).toEqual(mockProTier);
            expect(mockSubscriptionRepository.save).not.toHaveBeenCalled();
        });
    });

    describe('getRowLimit', () => {
        it('should return row limit from database', async () => {
            const mockFreeTier = {
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
            };

            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: mockFreeTier,
            });

            const result = await service.getRowLimit(1);

            expect(result).toBe(100000);
        });

        it('should return -1 for enterprise tier', async () => {
            const mockEnterpriseTier = {
                tier_name: ESubscriptionTier.ENTERPRISE,
                max_rows_per_data_model: '-1',
            };

            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: mockEnterpriseTier,
            });

            const result = await service.getRowLimit(1);

            expect(result).toBe(-1);
        });

        it('should auto-assign FREE tier if none exists', async () => {
            const mockFreeTier = {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
            };

            mockSubscriptionRepository.findOne.mockResolvedValue(null);
            mockTierRepository.findOne.mockResolvedValue(mockFreeTier);
            mockSubscriptionRepository.create.mockReturnValue({});
            mockSubscriptionRepository.save.mockResolvedValue({});

            const result = await service.getRowLimit(1);

            expect(result).toBe(100000);
            expect(mockSubscriptionRepository.save).toHaveBeenCalled();
        });
    });

    describe('exceedsLimit', () => {
        it('should return true when row count exceeds limit', async () => {
            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: { max_rows_per_data_model: '100000' },
            });

            const result = await service.exceedsLimit(1, 150000);

            expect(result).toBe(true);
        });

        it('should return false when row count is within limit', async () => {
            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: { max_rows_per_data_model: '100000' },
            });

            const result = await service.exceedsLimit(1, 50000);

            expect(result).toBe(false);
        });

        it('should return false for enterprise tier (unlimited)', async () => {
            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: { max_rows_per_data_model: '-1' },
            });

            const result = await service.exceedsLimit(1, 999999999);

            expect(result).toBe(false);
        });
    });

    describe('applyLimitToQuery', () => {
        beforeEach(() => {
            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: { max_rows_per_data_model: '100000' },
            });
        });

        it('should append LIMIT when none exists', async () => {
            const query = 'SELECT * FROM users';
            const result = await service.applyLimitToQuery(1, query);

            expect(result).toBe('SELECT * FROM users LIMIT 100000');
        });

        it('should replace existing LIMIT with tier limit when smaller', async () => {
            const query = 'SELECT * FROM users LIMIT 500000';
            const result = await service.applyLimitToQuery(1, query);

            expect(result).toBe('SELECT * FROM users LIMIT 100000');
        });

        it('should keep existing LIMIT when smaller than tier limit', async () => {
            const query = 'SELECT * FROM users LIMIT 50000';
            const result = await service.applyLimitToQuery(1, query);

            expect(result).toBe('SELECT * FROM users LIMIT 50000');
        });

        it('should not modify query for enterprise tier (unlimited)', async () => {
            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: { max_rows_per_data_model: '-1' },
            });

            const query = 'SELECT * FROM users';
            const result = await service.applyLimitToQuery(1, query);

            expect(result).toBe(query);
        });

        it('should handle LIMIT with OFFSET', async () => {
            const query = 'SELECT * FROM users LIMIT 200000 OFFSET 100';
            const result = await service.applyLimitToQuery(1, query);

            expect(result).toBe('SELECT * FROM users LIMIT 100000 OFFSET 100');
        });

        it('should handle case-insensitive LIMIT', async () => {
            const query = 'SELECT * FROM users limit 200000';
            const result = await service.applyLimitToQuery(1, query);

            expect(result).toBe('SELECT * FROM users LIMIT 100000');
        });
    });

    describe('assignFreeTier', () => {
        it('should assign FREE tier to user', async () => {
            const mockFreeTier = {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
            };

            mockTierRepository.findOne.mockResolvedValue(mockFreeTier);
            mockSubscriptionRepository.create.mockReturnValue({
                users_platform_id: 1,
                subscription_tier_id: 1,
            });
            mockSubscriptionRepository.save.mockResolvedValue({
                id: 1,
                users_platform_id: 1,
                subscription_tier_id: 1,
            });

            const result = await service.assignFreeTier(1);

            expect(result).toBeDefined();
            expect(mockSubscriptionRepository.save).toHaveBeenCalled();
        });

        it('should throw error if FREE tier not found', async () => {
            mockTierRepository.findOne.mockResolvedValue(null);

            await expect(service.assignFreeTier(1)).rejects.toThrow(
                'FREE subscription tier not found'
            );
        });
    });

    describe('getUsageStats', () => {
        it('should return comprehensive usage statistics', async () => {
            const mockProTier = {
                tier_name: ESubscriptionTier.PRO,
                max_rows_per_data_model: '5000000',
                max_projects: 10,
                max_data_sources_per_project: 5,
                max_dashboards: 20,
                ai_generations_per_month: 100,
            };

            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: mockProTier,
            });
            mockProjectRepository.count.mockResolvedValue(3);
            mockDataSourceRepository.count.mockResolvedValue(8);
            mockDashboardRepository.count.mockResolvedValue(5);

            const result = await service.getUsageStats(1);

            expect(result).toEqual({
                tier: ESubscriptionTier.PRO,
                rowLimit: 5000000,
                projectCount: 3,
                maxProjects: 10,
                dataSourceCount: 8,
                maxDataSources: 5,
                dashboardCount: 5,
                maxDashboards: 20,
                aiGenerationsPerMonth: 100,
            });
        });

        it('should handle null limits as unlimited', async () => {
            const mockEnterpriseTier = {
                tier_name: ESubscriptionTier.ENTERPRISE,
                max_rows_per_data_model: '-1',
                max_projects: null,
                max_data_sources_per_project: null,
                max_dashboards: null,
                ai_generations_per_month: null,
            };

            mockSubscriptionRepository.findOne.mockResolvedValue({
                subscription_tier: mockEnterpriseTier,
            });
            mockProjectRepository.count.mockResolvedValue(50);
            mockDataSourceRepository.count.mockResolvedValue(100);
            mockDashboardRepository.count.mockResolvedValue(30);

            const result = await service.getUsageStats(1);

            expect(result).toEqual({
                tier: ESubscriptionTier.ENTERPRISE,
                rowLimit: -1,
                projectCount: 50,
                maxProjects: null,
                dataSourceCount: 100,
                maxDataSources: null,
                dashboardCount: 30,
                maxDashboards: null,
                aiGenerationsPerMonth: null,
            });
        });
    });
});
