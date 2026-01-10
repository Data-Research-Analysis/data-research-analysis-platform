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
});
