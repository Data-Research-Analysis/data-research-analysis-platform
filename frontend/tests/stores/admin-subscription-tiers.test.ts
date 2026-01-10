import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSubscriptionTiersStore } from '~/stores/admin/subscription-tiers';
import { ESubscriptionTier } from '~/types/subscriptions/ESubscriptionTier';

// Mock $fetch
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

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
                tier_name: ESubscriptionTier.PRO,
                max_rows_per_data_model: '5000000',
                price_per_month_usd: '99',
                is_active: true,
            },
        ];

        mockFetch.mockResolvedValueOnce({ success: true, data: mockTiers });

        const store = useSubscriptionTiersStore();
        await store.fetchTiers();

        expect(store.tiers).toEqual(mockTiers);
        expect(mockFetch).toHaveBeenCalledWith('/admin/subscription-tiers', expect.any(Object));
    });

    it('creates a new tier successfully', async () => {
        const newTier = {
            tier_name: ESubscriptionTier.TEAM,
            max_rows_per_data_model: '20000000',
            price_per_month_usd: '299',
            is_active: true,
        };

        const createdTier = { id: 3, ...newTier };

        mockFetch.mockResolvedValueOnce({ success: true, data: createdTier });

        const store = useSubscriptionTiersStore();
        const result = await store.createTier(newTier);

        expect(result).toEqual(createdTier);
        expect(mockFetch).toHaveBeenCalledWith('/admin/subscription-tiers', {
            method: 'POST',
            body: newTier,
            headers: expect.any(Object),
        });
    });

    it('updates an existing tier successfully', async () => {
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

        mockFetch.mockResolvedValueOnce({ success: true, data: updatedTier });

        const store = useSubscriptionTiersStore();
        const result = await store.updateTier(1, updateData);

        expect(result).toEqual(updatedTier);
        expect(mockFetch).toHaveBeenCalledWith('/admin/subscription-tiers/1', {
            method: 'PUT',
            body: updateData,
            headers: expect.any(Object),
        });
    });

    it('deletes a tier successfully', async () => {
        mockFetch.mockResolvedValueOnce({ success: true });

        const store = useSubscriptionTiersStore();
        await store.deleteTier(1);

        expect(mockFetch).toHaveBeenCalledWith('/admin/subscription-tiers/1', {
            method: 'DELETE',
            headers: expect.any(Object),
        });
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

        const stored = localStorage.getItem('admin_subscription_tiers');
        expect(stored).toBe(JSON.stringify(mockTiers));
    });
});
