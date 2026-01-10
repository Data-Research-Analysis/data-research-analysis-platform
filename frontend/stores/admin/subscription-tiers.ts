import { defineStore } from 'pinia';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import { enableRefreshDataFlag } from '~/composables/Utils';
import { ESubscriptionTier } from '~/types/subscriptions/ESubscriptionTier';
import type { ISubscriptionTier } from '~/types/subscriptions/ISubscriptionTier';

export const useSubscriptionTiersStore = defineStore('subscriptionTiers', () => {
    const tiers = ref<ISubscriptionTier[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    function setTiers(tiersList: ISubscriptionTier[]) {
        tiers.value = tiersList;
        if (import.meta.client) {
            localStorage.setItem('subscriptionTiers', JSON.stringify(tiersList));
            enableRefreshDataFlag('setTiers');
        }
    }

    function getTiers() {
        if (import.meta.client && localStorage.getItem('subscriptionTiers')) {
            tiers.value = JSON.parse(localStorage.getItem('subscriptionTiers') || '[]');
        }
        return tiers.value;
    }

    async function fetchTiers(includeInactive: boolean = false) {
        loading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/subscription-tiers${includeInactive ? '?includeInactive=true' : ''}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch tiers: ${response.statusText}`);
            }

            const data = await response.json();
            setTiers(data.data || data);
            return data.data || data;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error fetching subscription tiers:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function createTier(tierData: Partial<ISubscriptionTier>) {
        loading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/subscription-tiers`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: JSON.stringify(tierData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to create tier: ${response.statusText}`);
            }

            const data = await response.json();
            // Refresh tiers list after creating
            await fetchTiers();
            return data.data || data;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error creating subscription tier:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function updateTier(id: number, tierData: Partial<ISubscriptionTier>) {
        loading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/subscription-tiers/${id}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: JSON.stringify(tierData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update tier: ${response.statusText}`);
            }

            const data = await response.json();
            // Refresh tiers list after updating
            await fetchTiers();
            return data.data || data;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error updating subscription tier:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function deleteTier(id: number) {
        loading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/admin/subscription-tiers/${id}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to delete tier: ${response.statusText}`);
            }

            const data = await response.json();
            // Refresh tiers list after deleting
            await fetchTiers();
            return data;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error deleting subscription tier:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    function clearTiers() {
        tiers.value = [];
        if (import.meta.client) {
            localStorage.removeItem('subscriptionTiers');
            enableRefreshDataFlag('clearTiers');
        }
    }

    return {
        tiers,
        loading,
        error,
        setTiers,
        getTiers,
        fetchTiers,
        createTier,
        updateTier,
        deleteTier,
        clearTiers,
    };
});
