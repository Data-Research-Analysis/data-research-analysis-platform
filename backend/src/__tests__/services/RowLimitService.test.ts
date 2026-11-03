import { RowLimitService } from '../../services/RowLimitService.js';
import { ESubscriptionTier } from '../../types/ESubscriptionTier.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { OrganizationService } from '../../services/OrganizationService.js';

// Mock DBDriver and OrganizationService
jest.mock('../../drivers/DBDriver.js');
jest.mock('../../services/OrganizationService.js');

describe('RowLimitService', () => {
    let service: RowLimitService;
    let mockManager: any;
    let mockDriver: any;
    let mockGetOrgSubscriptionTierForUser: jest.Mock;

    beforeEach(() => {
        service = RowLimitService.getInstance();

        mockManager = {
            findOne: jest.fn(),
        };

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

    describe('getUserTier', () => {
        it('should return tier from org subscription', async () => {
            const mockTier = {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
            };
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({ tier: mockTier, orgSubscription: null });

            const result = await service.getUserTier(1);

            expect(result).toBe(ESubscriptionTier.FREE);
        });

        it('should return existing tier for subscribed user', async () => {
            const mockTier = {
                id: 2,
                tier_name: ESubscriptionTier.PROFESSIONAL,
                max_rows_per_data_model: '5000000',
            };
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({ tier: mockTier, orgSubscription: { id: 1 } });

            const result = await service.getUserTier(1);

            expect(result).toBe(ESubscriptionTier.PROFESSIONAL);
        });

        it('should return FREE tier on error', async () => {
            mockGetOrgSubscriptionTierForUser.mockRejectedValue(new Error('DB error'));

            const result = await service.getUserTier(1);

            expect(result).toBe(ESubscriptionTier.FREE);
        });
    });

    describe('getRowLimit', () => {
        it('should return row limit from database', async () => {
            const mockTier = {
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
            };
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({ tier: mockTier, orgSubscription: null });

            const result = await service.getRowLimit(1);

            expect(result).toBe(100000);
        });

        it('should return -1 for enterprise tier', async () => {
            const mockTier = {
                tier_name: ESubscriptionTier.ENTERPRISE,
                max_rows_per_data_model: '-1',
            };
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({ tier: mockTier, orgSubscription: null });

            const result = await service.getRowLimit(1);

            expect(result).toBe(-1);
        });

        it('should return FREE tier limit on error', async () => {
            mockGetOrgSubscriptionTierForUser.mockRejectedValue(new Error('DB error'));

            const result = await service.getRowLimit(1);

            expect(result).toBe(100000);
        });
    });

    describe('exceedsLimit', () => {
        it('should return true when row count exceeds limit', async () => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: { max_rows_per_data_model: '100000' },
                orgSubscription: null,
            });

            const result = await service.exceedsLimit(1, 150000);

            expect(result).toBe(true);
        });

        it('should return false when row count is within limit', async () => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: { max_rows_per_data_model: '100000' },
                orgSubscription: null,
            });

            const result = await service.exceedsLimit(1, 50000);

            expect(result).toBe(false);
        });

        it('should return false for enterprise tier (unlimited)', async () => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: { max_rows_per_data_model: '-1' },
                orgSubscription: null,
            });

            const result = await service.exceedsLimit(1, 999999999);

            expect(result).toBe(false);
        });
    });

    describe('applyLimitToQuery', () => {
        beforeEach(() => {
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: { max_rows_per_data_model: '100000' },
                orgSubscription: null,
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
            mockGetOrgSubscriptionTierForUser.mockResolvedValue({
                tier: { max_rows_per_data_model: '-1' },
                orgSubscription: null,
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
        it('should be a no-op (org-level subscriptions manage tiers)', async () => {
            // assignFreeTier is now a no-op; should resolve without any DB writes
            await expect(service.assignFreeTier(1)).resolves.toBeUndefined();
        });
    });

    describe('getUsageStats', () => {
        it('should return the tier and row allowance', async () => {
            const mockTier = {
                id: 3,
                tier_name: ESubscriptionTier.PROFESSIONAL,
                max_rows_per_data_model: '5000000',
                price_per_month_usd: '29.99',
            };

            mockGetOrgSubscriptionTierForUser.mockResolvedValue({ tier: mockTier, orgSubscription: null });

            const result = await service.getUsageStats(1);

            expect(result).toEqual({
                tier: {
                    id: 3,
                    tier_name: ESubscriptionTier.PROFESSIONAL,
                    max_rows_per_data_model: '5000000',
                    price_per_month_usd: '29.99',
                },
                rowLimit: 5000000,
            });
        });

        it('should return an unlimited row allowance for Enterprise', async () => {
            const mockTier = {
                id: 5,
                tier_name: ESubscriptionTier.ENTERPRISE,
                max_rows_per_data_model: '-1',
                price_per_month_usd: '99.99',
            };

            mockGetOrgSubscriptionTierForUser.mockResolvedValue({ tier: mockTier, orgSubscription: null });

            const result = await service.getUsageStats(1);

            expect(result).toEqual({
                tier: {
                    id: 5,
                    tier_name: ESubscriptionTier.ENTERPRISE,
                    max_rows_per_data_model: '-1',
                    price_per_month_usd: '99.99',
                },
                rowLimit: -1,
            });
        });
    });
});
