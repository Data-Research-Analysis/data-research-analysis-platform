import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSubscriptionStore } from '~/stores/subscription';
import { ESubscriptionTier } from '~/types/subscription';

// Mock $fetch
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

describe('Subscription Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        if (import.meta.client) {
            localStorage.clear();
        }
    });

    it('fetches subscription data successfully', async () => {
        const mockSubscriptionData = {
            tier: ESubscriptionTier.PRO,
            rowLimit: 5000000,
            projectCount: 3,
            maxProjects: 10,
            dataSourceCount: 8,
            maxDataSources: 5,
            dashboardCount: 5,
            maxDashboards: 20,
            aiGenerationsPerMonth: 100,
        };

        mockFetch.mockResolvedValueOnce({ success: true, data: mockSubscriptionData });

        const store = useSubscriptionStore();
        await store.fetchSubscription();

        expect(store.tier).toBe(ESubscriptionTier.PRO);
        expect(store.rowLimit).toBe(5000000);
        expect(store.projectCount).toBe(3);
        expect(store.maxProjects).toBe(10);
        expect(mockFetch).toHaveBeenCalledWith('/subscription/current', expect.any(Object));
    });

    it('handles unlimited values correctly', async () => {
        const mockEnterpriseData = {
            tier: ESubscriptionTier.ENTERPRISE,
            rowLimit: -1,
            projectCount: 50,
            maxProjects: null,
            dataSourceCount: 100,
            maxDataSources: null,
            dashboardCount: 30,
            maxDashboards: null,
            aiGenerationsPerMonth: null,
        };

        mockFetch.mockResolvedValueOnce({ success: true, data: mockEnterpriseData });

        const store = useSubscriptionStore();
        await store.fetchSubscription();

        expect(store.tier).toBe(ESubscriptionTier.ENTERPRISE);
        expect(store.rowLimit).toBe(-1);
        expect(store.maxProjects).toBeNull();
        expect(store.maxDataSources).toBeNull();
    });

    it('computes isUnlimited correctly', async () => {
        const mockData = {
            tier: ESubscriptionTier.ENTERPRISE,
            rowLimit: -1,
            projectCount: 0,
            maxProjects: null,
            dataSourceCount: 0,
            maxDataSources: null,
            dashboardCount: 0,
            maxDashboards: null,
            aiGenerationsPerMonth: null,
        };

        mockFetch.mockResolvedValueOnce({ success: true, data: mockData });

        const store = useSubscriptionStore();
        await store.fetchSubscription();

        expect(store.isUnlimited).toBe(true);
    });

    it('computes isUnlimited as false for limited tiers', async () => {
        const mockData = {
            tier: ESubscriptionTier.FREE,
            rowLimit: 100000,
            projectCount: 0,
            maxProjects: 5,
            dataSourceCount: 0,
            maxDataSources: 3,
            dashboardCount: 0,
            maxDashboards: 10,
            aiGenerationsPerMonth: 50,
        };

        mockFetch.mockResolvedValueOnce({ success: true, data: mockData });

        const store = useSubscriptionStore();
        await store.fetchSubscription();

        expect(store.isUnlimited).toBe(false);
    });

    it('handles errors gracefully', async () => {
        const errorMessage = 'Failed to fetch subscription';
        mockFetch.mockRejectedValueOnce(new Error(errorMessage));

        const store = useSubscriptionStore();
        
        await expect(store.fetchSubscription()).rejects.toThrow(errorMessage);
        expect(store.error).toBe(errorMessage);
    });

    it('syncs to localStorage on client', async () => {
        if (!import.meta.client) return;

        const mockData = {
            tier: ESubscriptionTier.FREE,
            rowLimit: 100000,
            projectCount: 1,
            maxProjects: 5,
            dataSourceCount: 2,
            maxDataSources: 3,
            dashboardCount: 1,
            maxDashboards: 10,
            aiGenerationsPerMonth: 50,
        };

        mockFetch.mockResolvedValueOnce({ success: true, data: mockData });

        const store = useSubscriptionStore();
        await store.fetchSubscription();

        const stored = localStorage.getItem('subscription');
        const parsed = JSON.parse(stored!);
        
        expect(parsed.tier).toBe(ESubscriptionTier.FREE);
        expect(parsed.rowLimit).toBe(100000);
    });

    describe('Tier Enforcement - Usage Stats', () => {
        it('fetches usage statistics with canCreate flags', async () => {
            const mockUsageStats = {
                tier: ESubscriptionTier.STARTER,
                tierDetails: {
                    id: 2,
                    tierName: ESubscriptionTier.STARTER,
                    pricePerMonth: 9.99,
                },
                rowLimit: 500000,
                projectCount: 5,
                maxProjects: 10,
                dataSourceCount: 15,
                maxDataSources: 5,
                dashboardCount: 8,
                maxDashboards: 15,
                aiGenerationsPerMonth: 50,
                aiGenerationsUsed: 25,
                canCreateProject: true,
                canCreateDataSource: false,
                canCreateDashboard: true,
                canUseAIGeneration: true,
            };

            mockFetch.mockResolvedValueOnce({ success: true, data: mockUsageStats });

            const store = useSubscriptionStore();
            await store.fetchUsageStats();

            expect(store.usageStats).toBeDefined();
            expect(store.usageStats?.tier).toBe(ESubscriptionTier.STARTER);
            expect(store.usageStats?.projectCount).toBe(5);
            expect(store.usageStats?.maxProjects).toBe(10);
            expect(store.usageStats?.canCreateProject).toBe(true);
            expect(store.usageStats?.canCreateDataSource).toBe(false);
            expect(mockFetch).toHaveBeenCalledWith('/subscription/usage', expect.any(Object));
        });

        it('computes canCreateProject correctly', async () => {
            const mockUsageStats = {
                tier: ESubscriptionTier.FREE,
                tierDetails: { id: 1, tierName: ESubscriptionTier.FREE, pricePerMonth: 0 },
                rowLimit: 100000,
                projectCount: 3,
                maxProjects: 3,
                dataSourceCount: 0,
                maxDataSources: 3,
                dashboardCount: 0,
                maxDashboards: 5,
                aiGenerationsPerMonth: 10,
                aiGenerationsUsed: 5,
                canCreateProject: false,
                canCreateDataSource: true,
                canCreateDashboard: true,
                canUseAIGeneration: true,
            };

            mockFetch.mockResolvedValueOnce({ success: true, data: mockUsageStats });

            const store = useSubscriptionStore();
            await store.fetchUsageStats();

            expect(store.canCreateProject).toBe(false);
        });

        it('computes canCreateDataSource correctly', async () => {
            const mockUsageStats = {
                tier: ESubscriptionTier.STARTER,
                tierDetails: { id: 2, tierName: ESubscriptionTier.STARTER, pricePerMonth: 9.99 },
                rowLimit: 500000,
                projectCount: 2,
                maxProjects: 10,
                dataSourceCount: 20,
                maxDataSources: 5,
                dashboardCount: 5,
                maxDashboards: 15,
                aiGenerationsPerMonth: 50,
                aiGenerationsUsed: 10,
                canCreateProject: true,
                canCreateDataSource: false,
                canCreateDashboard: true,
                canUseAIGeneration: true,
            };

            mockFetch.mockResolvedValueOnce({ success: true, data: mockUsageStats });

            const store = useSubscriptionStore();
            await store.fetchUsageStats();

            expect(store.canCreateDataSource).toBe(false);
        });

        it('computes canUseAIGeneration correctly', async () => {
            const mockUsageStats = {
                tier: ESubscriptionTier.FREE,
                tierDetails: { id: 1, tierName: ESubscriptionTier.FREE, pricePerMonth: 0 },
                rowLimit: 100000,
                projectCount: 1,
                maxProjects: 3,
                dataSourceCount: 2,
                maxDataSources: 3,
                dashboardCount: 1,
                maxDashboards: 5,
                aiGenerationsPerMonth: 10,
                aiGenerationsUsed: 10,
                canCreateProject: true,
                canCreateDataSource: true,
                canCreateDashboard: true,
                canUseAIGeneration: false,
            };

            mockFetch.mockResolvedValueOnce({ success: true, data: mockUsageStats });

            const store = useSubscriptionStore();
            await store.fetchUsageStats();

            expect(store.canUseAIGeneration).toBe(false);
        });

        it('computes aiGenerationsRemaining correctly', async () => {
            const mockUsageStats = {
                tier: ESubscriptionTier.STARTER,
                tierDetails: { id: 2, tierName: ESubscriptionTier.STARTER, pricePerMonth: 9.99 },
                rowLimit: 500000,
                projectCount: 3,
                maxProjects: 10,
                dataSourceCount: 8,
                maxDataSources: 5,
                dashboardCount: 5,
                maxDashboards: 15,
                aiGenerationsPerMonth: 50,
                aiGenerationsUsed: 30,
                canCreateProject: true,
                canCreateDataSource: false,
                canCreateDashboard: true,
                canUseAIGeneration: true,
            };

            mockFetch.mockResolvedValueOnce({ success: true, data: mockUsageStats });

            const store = useSubscriptionStore();
            await store.fetchUsageStats();

            expect(store.aiGenerationsRemaining).toBe(20);
        });

        it('handles unlimited AI generations correctly', async () => {
            const mockUsageStats = {
                tier: ESubscriptionTier.ENTERPRISE,
                tierDetails: { id: 4, tierName: ESubscriptionTier.ENTERPRISE, pricePerMonth: 99.99 },
                rowLimit: -1,
                projectCount: 10,
                maxProjects: null,
                dataSourceCount: 50,
                maxDataSources: null,
                dashboardCount: 20,
                maxDashboards: null,
                aiGenerationsPerMonth: null,
                aiGenerationsUsed: 1000,
                canCreateProject: true,
                canCreateDataSource: true,
                canCreateDashboard: true,
                canUseAIGeneration: true,
            };

            mockFetch.mockResolvedValueOnce({ success: true, data: mockUsageStats });

            const store = useSubscriptionStore();
            await store.fetchUsageStats();

            expect(store.canUseAIGeneration).toBe(true);
            expect(store.aiGenerationsRemaining).toBeGreaterThan(0);
        });

        it('auto-refreshes usage stats when enabled', async () => {
            const mockUsageStats = {
                tier: ESubscriptionTier.PRO,
                tierDetails: { id: 3, tierName: ESubscriptionTier.PRO, pricePerMonth: 29.99 },
                rowLimit: 5000000,
                projectCount: 5,
                maxProjects: 50,
                dataSourceCount: 10,
                maxDataSources: 10,
                dashboardCount: 10,
                maxDashboards: 30,
                aiGenerationsPerMonth: 200,
                aiGenerationsUsed: 50,
                canCreateProject: true,
                canCreateDataSource: true,
                canCreateDashboard: true,
                canUseAIGeneration: true,
            };

            mockFetch.mockResolvedValue({ success: true, data: mockUsageStats });

            const store = useSubscriptionStore();
            store.startAutoRefresh();

            expect(store.refreshInterval).toBeDefined();

            store.stopAutoRefresh();
            expect(store.refreshInterval).toBeNull();
        });

        it('syncs usage stats to localStorage on client', async () => {
            if (!import.meta.client) return;

            const mockUsageStats = {
                tier: ESubscriptionTier.STARTER,
                tierDetails: { id: 2, tierName: ESubscriptionTier.STARTER, pricePerMonth: 9.99 },
                rowLimit: 500000,
                projectCount: 3,
                maxProjects: 10,
                dataSourceCount: 5,
                maxDataSources: 5,
                dashboardCount: 3,
                maxDashboards: 15,
                aiGenerationsPerMonth: 50,
                aiGenerationsUsed: 15,
                canCreateProject: true,
                canCreateDataSource: false,
                canCreateDashboard: true,
                canUseAIGeneration: true,
            };

            mockFetch.mockResolvedValueOnce({ success: true, data: mockUsageStats });

            const store = useSubscriptionStore();
            await store.fetchUsageStats();

            const stored = localStorage.getItem('usageStats');
            expect(stored).toBeDefined();
            
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(parsed.tier).toBe(ESubscriptionTier.STARTER);
                expect(parsed.projectCount).toBe(3);
                expect(parsed.canCreateProject).toBe(true);
            }
        });
    });
});
