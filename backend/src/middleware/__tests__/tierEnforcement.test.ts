import { Request, Response, NextFunction } from 'express';
import { TierEnforcementService } from '../../services/TierEnforcementService.js';
import { TierLimitError } from '../../types/TierLimitError.js';
import { ESubscriptionTier } from '../../models/DRASubscriptionTier.js';
import {
    enforceProjectLimit,
    enforceDataSourceLimit,
    enforceDashboardLimit,
    enforceAIGenerationLimit,
} from '../tierEnforcement.js';

// Mock TierEnforcementService
jest.mock('../../services/TierEnforcementService.js');

describe('Tier Enforcement Middleware', () => {
    let mockReq: any;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockService: jest.Mocked<TierEnforcementService>;

    beforeEach(() => {
        mockReq = {
            user: {
                user_id: 1,
                email: 'test@example.com',
            },
            body: {},
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        mockNext = jest.fn();

        // Mock service instance
        mockService = {
            canCreateProject: jest.fn(),
            canCreateDataSource: jest.fn(),
            canCreateDashboard: jest.fn(),
            canUseAIGeneration: jest.fn(),
            incrementAIGenerationCount: jest.fn(),
            isAdmin: jest.fn(),
            getUsageStats: jest.fn(),
        } as any;

        (TierEnforcementService.getInstance as jest.Mock).mockReturnValue(mockService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('enforceProjectLimit', () => {
        it('should call next() when user can create project', async () => {
            mockService.canCreateProject.mockResolvedValue(undefined);

            await enforceProjectLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockService.canCreateProject).toHaveBeenCalledWith(1);
            expect(mockNext).toHaveBeenCalledWith();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should return 402 when project limit exceeded', async () => {
            const tierError = new TierLimitError(
                ESubscriptionTier.FREE,
                'project',
                3,
                3,
                [
                    {
                        tierName: ESubscriptionTier.PRO,
                        limit: 10,
                        pricePerMonth: 9.99,
                    },
                ]
            );
            mockService.canCreateProject.mockRejectedValue(tierError);

            await enforceProjectLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(402);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'TierLimitError',
                    message: expect.stringContaining('limit'),
                    tierName: ESubscriptionTier.FREE,
                    resource: 'project',
                    currentUsage: 3,
                    limit: 3,
                    upgradeTiers: expect.arrayContaining([
                        expect.objectContaining({
                            tierName: ESubscriptionTier.PRO,
                        }),
                    ]),
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 when user not authenticated', async () => {
            mockReq.user = undefined;

            await enforceProjectLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'User not authenticated',
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 500 on unexpected errors', async () => {
            mockService.canCreateProject.mockRejectedValue(new Error('Database error'));

            await enforceProjectLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining('Database error'),
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('enforceDataSourceLimit', () => {
        beforeEach(() => {
            mockReq.body = { project_id: 100 };
        });

        it('should call next() when user can create data source', async () => {
            mockService.canCreateDataSource.mockResolvedValue(undefined);

            await enforceDataSourceLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockService.canCreateDataSource).toHaveBeenCalledWith(1, 100);
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should return 402 when data source limit exceeded', async () => {
            const tierError = new TierLimitError(
                ESubscriptionTier.PRO,
                'data_source',
                5,
                5,
                []
            );
            mockService.canCreateDataSource.mockRejectedValue(tierError);

            await enforceDataSourceLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(402);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    resource: 'data_source',
                    currentUsage: 5,
                    limit: 5,
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 400 when project_id missing', async () => {
            mockReq.body = {};

            await enforceDataSourceLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining('project_id'),
                })
            );
            expect(mockService.canCreateDataSource).not.toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should enforce per-project limits', async () => {
            mockReq.body = { project_id: 200 };
            mockService.canCreateDataSource.mockResolvedValue(undefined);

            await enforceDataSourceLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockService.canCreateDataSource).toHaveBeenCalledWith(1, 200);
            expect(mockNext).toHaveBeenCalledWith();
        });
    });

    describe('enforceDashboardLimit', () => {
        it('should call next() when user can create dashboard', async () => {
            mockService.canCreateDashboard.mockResolvedValue(undefined);

            await enforceDashboardLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockService.canCreateDashboard).toHaveBeenCalledWith(1);
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should return 402 when dashboard limit exceeded', async () => {
            const tierError = new TierLimitError(
                ESubscriptionTier.PRO,
                'dashboard',
                20,
                20,
                []
            );
            mockService.canCreateDashboard.mockRejectedValue(tierError);

            await enforceDashboardLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(402);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    resource: 'dashboard',
                    currentUsage: 20,
                    limit: 20,
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('enforceAIGenerationLimit', () => {
        it('should call next() and increment counter when user can use AI', async () => {
            mockService.canUseAIGeneration.mockResolvedValue(undefined);
            mockService.incrementAIGenerationCount.mockResolvedValue(undefined);

            await enforceAIGenerationLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockService.canUseAIGeneration).toHaveBeenCalledWith(1);
            expect(mockService.incrementAIGenerationCount).toHaveBeenCalledWith(1);
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should return 402 when AI generation limit exceeded', async () => {
            const tierError = new TierLimitError(
                ESubscriptionTier.PRO,
                'ai_generation',
                50,
                50,
                [
                    {
                        tierName: ESubscriptionTier.PRO,
                        limit: 200,
                        pricePerMonth: 29.99,
                    },
                ]
            );
            mockService.canUseAIGeneration.mockRejectedValue(tierError);

            await enforceAIGenerationLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(402);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    resource: 'ai_generation',
                    currentUsage: 50,
                    limit: 50,
                    upgradeTiers: expect.arrayContaining([
                        expect.objectContaining({
                            tierName: ESubscriptionTier.PRO,
                        }),
                    ]),
                })
            );
            expect(mockService.incrementAIGenerationCount).not.toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should not increment counter if limit check fails', async () => {
            mockService.canUseAIGeneration.mockRejectedValue(
                new TierLimitError(ESubscriptionTier.FREE, 'ai_generation', 10, 10, [])
            );

            await enforceAIGenerationLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockService.incrementAIGenerationCount).not.toHaveBeenCalled();
        });

        it('should handle counter increment errors gracefully', async () => {
            mockService.canUseAIGeneration.mockResolvedValue(undefined);
            mockService.incrementAIGenerationCount.mockRejectedValue(
                new Error('Redis connection error')
            );

            await enforceAIGenerationLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining('Redis connection error'),
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('Admin Bypass', () => {
        it('should allow admin users to bypass all limits', async () => {
            mockService.canCreateProject.mockResolvedValue(undefined);

            await enforceProjectLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
        });
    });

    describe('Error Response Format', () => {
        it('should return consistent 402 error format', async () => {
            const tierError = new TierLimitError(
                ESubscriptionTier.FREE,
                'project',
                5,
                5,
                [
                    {
                        tierName: ESubscriptionTier.PRO,
                        limit: 10,
                        pricePerMonth: 9.99,
                    },
                    {
                        tierName: ESubscriptionTier.PRO,
                        limit: 50,
                        pricePerMonth: 29.99,
                    },
                ]
            );
            mockService.canCreateProject.mockRejectedValue(tierError);

            await enforceProjectLimit(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'TierLimitError',
                    tierName: ESubscriptionTier.FREE,
                    resource: 'project',
                    currentUsage: 5,
                    limit: 5,
                    upgradeTiers: expect.arrayContaining([
                        {
                            tierName: ESubscriptionTier.PRO,
                            limit: 10,
                            pricePerMonth: 9.99,
                        },
                        {
                            tierName: ESubscriptionTier.PRO,
                            limit: 50,
                            pricePerMonth: 29.99,
                        },
                    ]),
                    upgradeUrl: expect.stringContaining('/pricing'),
                })
            );
        });
    });
});
