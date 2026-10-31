import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock('~/composables/useAppFetch', () => ({ useAppFetch: mockFetch }));
vi.mock('~/composables/AuthToken', () => ({ getAuthToken: () => 'test-token' }));
vi.mock('~/composables/Utils', () => ({ baseUrl: () => 'http://api.test' }));
vi.mock('~/stores/organizations', () => ({
    useOrganizationsStore: () => ({ currentOrganization: null })
}));

import { useSubscriptionStore } from '~/stores/subscription';

describe('Subscription Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        if (import.meta.client) {
            localStorage.clear();
        }
    });

    it('fetches subscription data successfully', async () => {
        mockFetch.mockResolvedValueOnce({
            success: true,
            data: {
                tier: { id: 3, tier_name: 'PROFESSIONAL', max_rows_per_data_model: '5000000', price_per_month_usd: '29.99' },
                rowLimit: 5000000,
            },
        });

        const store = useSubscriptionStore();
        await store.fetchSubscription();

        expect(store.tierName).toBe('PROFESSIONAL');
        expect(store.rowLimit).toBe(5000000);
        expect(mockFetch).toHaveBeenCalledWith('http://api.test/subscription/current', expect.any(Object));
    });

    it('handles unlimited row allowances', async () => {
        mockFetch.mockResolvedValueOnce({
            success: true,
            data: {
                tier: { id: 4, tier_name: 'ENTERPRISE', max_rows_per_data_model: '-1', price_per_month_usd: '99.99' },
                rowLimit: -1,
            },
        });

        const store = useSubscriptionStore();
        await store.fetchSubscription();

        expect(store.tierName).toBe('ENTERPRISE');
        expect(store.isUnlimited).toBe(true);
    });

    it('handles errors gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Failed to fetch subscription'));

        const store = useSubscriptionStore();

        await expect(store.fetchSubscription()).rejects.toThrow('Failed to fetch subscription');
        expect(store.error).toBe('Failed to fetch subscription');
    });

    it('fetches usage statistics with feature entitlements', async () => {
        mockFetch.mockResolvedValueOnce({
            success: true,
            data: {
                tier: 'PROFESSIONAL',
                tierDetails: { id: 3, tierName: 'PROFESSIONAL', pricePerMonth: 29.99 },
                rowLimit: 5000000,
                creditsEnabled: false,
                creditBalance: null,
            },
        });

        const store = useSubscriptionStore();
        await store.fetchUsageStats();

        expect(store.usageStats?.tier).toBe('PROFESSIONAL');
        expect(store.usageStats?.rowLimit).toBe(5000000);
        expect(mockFetch).toHaveBeenCalledWith('http://api.test/subscription/usage', expect.any(Object));
    });

    it('exposes credit mode fields from usage stats', async () => {
        mockFetch.mockResolvedValueOnce({
            success: true,
            data: {
                tier: 'STARTER',
                tierDetails: { id: 2, tierName: 'STARTER', pricePerMonth: 9.99 },
                rowLimit: 500000,
                creditsEnabled: true,
                creditBalance: 1200,
            },
        });

        const store = useSubscriptionStore();
        await store.fetchUsageStats();

        expect(store.creditsEnabled).toBe(true);
        expect(store.creditBalance).toBe(1200);
    });

    it('starts and stops auto-refresh', () => {
        vi.useFakeTimers();
        mockFetch.mockResolvedValue({
            success: true,
            data: {
                tier: 'FREE',
                tierDetails: { id: 1, tierName: 'FREE', pricePerMonth: 0 },
                rowLimit: 100000,
                creditsEnabled: false,
                creditBalance: null,
            },
        });

        const store = useSubscriptionStore();
        expect(() => {
            store.startAutoRefresh();
            store.stopAutoRefresh();
        }).not.toThrow();

        vi.useRealTimers();
    });
});
