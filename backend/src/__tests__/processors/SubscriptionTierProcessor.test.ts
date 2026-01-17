import { SubscriptionTierProcessor } from '../SubscriptionTierProcessor.js';
import { ESubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { DBDriver } from '../../drivers/DBDriver.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';

// Mock DBDriver
jest.mock('../../drivers/DBDriver.js');

describe('SubscriptionTierProcessor', () => {
    let processor: SubscriptionTierProcessor;
    let mockRepository: any;
    let mockDriver: any;

    beforeEach(() => {
        processor = SubscriptionTierProcessor.getInstance();
        
        // Create mock repository
        mockRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
        };

        // Create mock driver
        mockDriver = {
            getRepository: jest.fn().mockReturnValue(mockRepository),
        };

        // Mock DBDriver.getInstance().getDriver()
        (DBDriver.getInstance as jest.Mock) = jest.fn().mockReturnValue({
            getDriver: jest.fn().mockResolvedValue(mockDriver),
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getAllTiers', () => {
        it('should return all active tiers by default', async () => {
            const mockTiers = [
                { id: 1, tier_name: ESubscriptionTier.FREE, max_rows_per_data_model: '100000', is_active: true },
                { id: 2, tier_name: ESubscriptionTier.PRO, max_rows_per_data_model: '5000000', is_active: true },
            ];

            mockRepository.find.mockResolvedValue(mockTiers);

            const result = await processor.getAllTiers();

            expect(result).toEqual(mockTiers);
            expect(mockRepository.find).toHaveBeenCalledWith({
                where: { is_active: true },
                order: { max_rows_per_data_model: 'ASC' },
            });
        });

        it('should return all tiers including inactive when includeInactive is true', async () => {
            const mockTiers = [
                { id: 1, tier_name: ESubscriptionTier.FREE, is_active: true },
                { id: 2, tier_name: ESubscriptionTier.PRO, is_active: false },
            ];

            mockRepository.find.mockResolvedValue(mockTiers);

            const result = await processor.getAllTiers(true);

            expect(result).toEqual(mockTiers);
            expect(mockRepository.find).toHaveBeenCalledWith({
                order: { max_rows_per_data_model: 'ASC' },
            });
        });
    });

    describe('getTierById', () => {
        it('should return tier by id', async () => {
            const mockTier = { id: 1, tier_name: ESubscriptionTier.FREE };
            mockRepository.findOne.mockResolvedValue(mockTier);

            const result = await processor.getTierById(1);

            expect(result).toEqual(mockTier);
            expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
        });

        it('should return null if tier not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            const result = await processor.getTierById(999);

            expect(result).toBeNull();
        });
    });

    describe('getTierByName', () => {
        it('should return tier by name', async () => {
            const mockTier = { id: 1, tier_name: ESubscriptionTier.FREE };
            mockRepository.findOne.mockResolvedValue(mockTier);

            const result = await processor.getTierByName(ESubscriptionTier.FREE);

            expect(result).toEqual(mockTier);
            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { tier_name: ESubscriptionTier.FREE },
            });
        });
    });

    describe('createTier', () => {
        it('should create a valid tier', async () => {
            const tierData = {
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: 100000,                max_projects: null,
                max_data_sources_per_project: null,
                max_dashboards: null,
                ai_generations_per_month: null,                price_per_month_usd: 0,
                is_active: true,
            };

            mockRepository.findOne.mockResolvedValue(null); // No existing tier
            mockRepository.create.mockReturnValue(tierData);
            mockRepository.save.mockResolvedValue({ id: 1, ...tierData });

            const result = await processor.createTier(tierData);

            expect(result).toEqual({ id: 1, ...tierData });
            expect(mockRepository.save).toHaveBeenCalled();
        });

        it('should reject tier with duplicate name', async () => {
            const tierData = {
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: 100000,
                max_projects: null,
                max_data_sources_per_project: null,
                max_dashboards: null,
                ai_generations_per_month: null,
                price_per_month_usd: 0,
            };

            mockRepository.findOne.mockResolvedValue({ id: 1, tier_name: ESubscriptionTier.FREE });

            await expect(processor.createTier(tierData)).rejects.toThrow(
                'Subscription tier with name FREE already exists'
            );
        });

        it('should reject tier with negative row limit', async () => {
            const tierData = {
                tier_name: ESubscriptionTier.PRO,
                max_rows_per_data_model: -5,
                max_projects: null,
                max_data_sources_per_project: null,
                max_dashboards: null,
                ai_generations_per_month: null,
                price_per_month_usd: 0,
            };

            await expect(processor.createTier(tierData)).rejects.toThrow(
                'max_rows_per_data_model must be positive or -1 for unlimited'
            );
        });

        it('should allow -1 for unlimited rows', async () => {
            const tierData = {
                tier_name: ESubscriptionTier.ENTERPRISE,
                max_rows_per_data_model: -1,
                max_projects: null,
                max_data_sources_per_project: null,
                max_dashboards: null,
                ai_generations_per_month: null,
                price_per_month_usd: 3000,
                is_active: true,
            };

            mockRepository.findOne.mockResolvedValue(null);
            mockRepository.create.mockReturnValue(tierData);
            mockRepository.save.mockResolvedValue({ id: 1, ...tierData });

            const result = await processor.createTier(tierData);

            expect(result.max_rows_per_data_model).toBe(-1);
        });
    });

    describe('updateTier', () => {
        it('should update tier limits', async () => {
            const existingTier = {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
            };

            const updateData = {
                max_rows_per_data_model: 50000,
            };

            mockRepository.findOne.mockResolvedValue(existingTier);
            mockRepository.update.mockResolvedValue({ affected: 1 });
            mockRepository.findOne.mockResolvedValueOnce(existingTier).mockResolvedValueOnce({
                ...existingTier,
                max_rows_per_data_model: '50000',
            });

            const result = await processor.updateTier(1, updateData);

            expect(result.max_rows_per_data_model).toBe('50000');
            expect(mockRepository.update).toHaveBeenCalledWith(1, updateData);
        });

        it('should throw error if tier not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(processor.updateTier(999, {})).rejects.toThrow(
                'Subscription tier with id 999 not found'
            );
        });

        it('should validate updated values', async () => {
            const existingTier = { id: 1, tier_name: ESubscriptionTier.PRO };
            mockRepository.findOne.mockResolvedValue(existingTier);

            await expect(
                processor.updateTier(1, { max_rows_per_data_model: -5 })
            ).rejects.toThrow('max_rows_per_data_model must be positive or -1 for unlimited');
        });
    });

    describe('deleteTier', () => {
        it('should soft delete tier by setting is_active to false', async () => {
            const existingTier = {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                is_active: true,
            };

            mockRepository.findOne.mockResolvedValue(existingTier);
            mockRepository.update.mockResolvedValue({ affected: 1 });

            const result = await processor.deleteTier(1);

            expect(result).toBe(true);
            expect(mockRepository.update).toHaveBeenCalledWith(1, { is_active: false });
        });

        it('should throw error if tier not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(processor.deleteTier(999)).rejects.toThrow(
                'Subscription tier with id 999 not found'
            );
        });

        it('should prevent deletion if active subscriptions exist', async () => {
            const existingTier = {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                user_subscriptions: [{ id: 1, is_active: true }],
            };

            mockRepository.findOne.mockResolvedValue(existingTier);

            await expect(processor.deleteTier(1)).rejects.toThrow(
                'Cannot delete tier with active subscriptions'
            );
        });
    });
});
