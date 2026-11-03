import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock('@/composables/useAppFetch', () => ({ useAppFetch: mockFetch }));
vi.mock('~/composables/AuthToken', () => ({ getAuthToken: () => 'test-token' }));
vi.mock('~/composables/Utils', () => ({ baseUrl: () => 'http://api.test' }));

import { useSubscriptionTiersStore } from '~/stores/admin/subscription-tiers';
import { ESubscriptionTier } from '~/types/subscriptions/ESubscriptionTier';

describe('Admin Subscription Tiers Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        if (import.meta.client) {
            localStorage.clear();
        }
    });

    it('fetches all tiers successfully', async () => {
        const mockTiers = [
            {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
                price_per_month_usd: '0',
                is_active: true,
            },
            {
                id: 2,
                tier_name: ESubscriptionTier.PROFESSIONAL,
                max_rows_per_data_model: '5000000',
                price_per_month_usd: '99',
                is_active: true,
            },
        ];

        mockFetch.mockResolvedValueOnce({ success: true, data: mockTiers });

        const store = useSubscriptionTiersStore();
        await store.fetchTiers();

        expect(store.tiers).toEqual(mockTiers);
        expect(mockFetch).toHaveBeenCalledWith('http://api.test/admin/subscription-tiers', expect.any(Object));
    });

    it('fetches inactive tiers when requested', async () => {
        mockFetch.mockResolvedValueOnce({ success: true, data: [] });

        const store = useSubscriptionTiersStore();
        await store.fetchTiers(true);

        expect(mockFetch).toHaveBeenCalledWith('http://api.test/admin/subscription-tiers?includeInactive=true', expect.any(Object));
    });

    it('creates a new tier successfully and refreshes the list', async () => {
        const newTier = {
            tier_name: ESubscriptionTier.PROFESSIONAL,
            max_rows_per_data_model: '20000000',
            price_per_month_usd: '299',
            is_active: true,
        };
        const createdTier = { id: 3, ...newTier };

        mockFetch
            .mockResolvedValueOnce({ success: true, data: createdTier })
            .mockResolvedValueOnce({ success: true, data: [createdTier] });

        const store = useSubscriptionTiersStore();
        const result = await store.createTier(newTier);

        expect(result).toEqual(createdTier);
        expect(store.tiers).toEqual([createdTier]);
        expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://api.test/admin/subscription-tiers', {
            method: 'POST',
            body: newTier,
            headers: expect.any(Object),
        });
    });

    it('updates an existing tier successfully and refreshes the list', async () => {
        const updateData = {
            max_rows_per_data_model: '150000',
            price_per_month_usd: '15',
        };
        const updatedTier = {
            id: 1,
            tier_name: ESubscriptionTier.FREE,
            ...updateData,
            is_active: true,
        };

        mockFetch
            .mockResolvedValueOnce({ success: true, data: updatedTier })
            .mockResolvedValueOnce({ success: true, data: [updatedTier] });

        const store = useSubscriptionTiersStore();
        const result = await store.updateTier(1, updateData);

        expect(result).toEqual(updatedTier);
        expect(store.tiers).toEqual([updatedTier]);
        expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://api.test/admin/subscription-tiers/1', {
            method: 'PUT',
            body: updateData,
            headers: expect.any(Object),
        });
    });

    it('deletes a tier successfully and refreshes the list with inactive tiers', async () => {
        const deletedTier = {
            id: 1,
            tier_name: ESubscriptionTier.FREE,
            max_rows_per_data_model: '100000',
            price_per_month_usd: '0',
            is_active: false,
        };

        mockFetch
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValueOnce({ success: true, data: [deletedTier] });

        const store = useSubscriptionTiersStore();
        await store.deleteTier(1);

        expect(store.tiers).toEqual([deletedTier]);
        expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://api.test/admin/subscription-tiers/1', {
            method: 'DELETE',
            headers: expect.any(Object),
        });
        expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://api.test/admin/subscription-tiers?includeInactive=true', expect.any(Object));
    });

    it('handles errors gracefully', async () => {
        const errorMessage = 'Failed to fetch tiers';
        mockFetch.mockRejectedValueOnce(new Error(errorMessage));

        const store = useSubscriptionTiersStore();

        await expect(store.fetchTiers()).rejects.toThrow(errorMessage);
        expect(store.error).toBe(errorMessage);
    });

    it('syncs to localStorage on client', async () => {
        if (!import.meta.client) return;

        const mockTiers = [
            {
                id: 1,
                tier_name: ESubscriptionTier.FREE,
                max_rows_per_data_model: '100000',
                is_active: true,
            },
        ];

        mockFetch.mockResolvedValueOnce({ success: true, data: mockTiers });

        const store = useSubscriptionTiersStore();
        await store.fetchTiers();

        const stored = localStorage.getItem('subscriptionTiers');
        expect(stored).toBe(JSON.stringify(mockTiers));
    });
});
