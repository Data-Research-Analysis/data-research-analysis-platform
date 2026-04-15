import { defineStore } from 'pinia';
import type { IPromoCode, IPromoCodeRedemption, IPromoCodeValidation, IPromoCodeAnalytics } from '~/types/IPromoCode';

export const usePromoCodesStore = defineStore('promoCodesDRA', () => {
    const promoCodes = ref<IPromoCode[]>([]);
    const selectedPromoCode = ref<IPromoCode | null>(null);
    const userRedemptions = ref<IPromoCodeRedemption[]>([]);
    const validatedCode = ref<IPromoCodeValidation | null>(null);

    function setPromoCodes(promoCodesList: IPromoCode[]) {
        promoCodes.value = promoCodesList;
        if (import.meta.client) {
            try {
                localStorage.setItem('promoCodes', JSON.stringify(promoCodesList));
                enableRefreshDataFlag('setPromoCodes');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[PromoCodesStore] localStorage quota exceeded for promoCodes.');
                    enableRefreshDataFlag('setPromoCodes');
                } else {
                    console.error('[PromoCodesStore] Error saving promoCodes to localStorage:', error);
                }
            }
        }
    }

    function setSelectedPromoCode(promoCode: IPromoCode | null) {
        selectedPromoCode.value = promoCode;
        if (import.meta.client) {
            try {
                if (promoCode) {
                    localStorage.setItem('selectedPromoCode', JSON.stringify(promoCode));
                } else {
                    localStorage.removeItem('selectedPromoCode');
                }
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[PromoCodesStore] localStorage quota exceeded for selectedPromoCode.');
                } else {
                    console.error('[PromoCodesStore] Error saving selectedPromoCode to localStorage:', error);
                }
            }
        }
    }

    function setUserRedemptions(redemptions: IPromoCodeRedemption[]) {
        userRedemptions.value = redemptions;
        if (import.meta.client) {
            try {
                localStorage.setItem('userRedemptions', JSON.stringify(redemptions));
                enableRefreshDataFlag('setUserRedemptions');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[PromoCodesStore] localStorage quota exceeded for userRedemptions.');
                    enableRefreshDataFlag('setUserRedemptions');
                } else {
                    console.error('[PromoCodesStore] Error saving userRedemptions to localStorage:', error);
                }
            }
        }
    }

    function setValidatedCode(validation: IPromoCodeValidation | null) {
        validatedCode.value = validation;
        if (import.meta.client) {
            try {
                if (validation) {
                    localStorage.setItem('validatedCode', JSON.stringify(validation));
                } else {
                    localStorage.removeItem('validatedCode');
                }
                enableRefreshDataFlag('setValidatedCode');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[PromoCodesStore] localStorage quota exceeded for validatedCode.');
                    enableRefreshDataFlag('setValidatedCode');
                } else {
                    console.error('[PromoCodesStore] Error saving validatedCode to localStorage:', error);
                }
            }
        }
    }

    function getPromoCodes() {
        if (import.meta.client && localStorage.getItem('promoCodes')) {
            promoCodes.value = JSON.parse(localStorage.getItem('promoCodes') || '[]');
        }
        return promoCodes.value;
    }

    function getSelectedPromoCode() {
        if (import.meta.client && localStorage.getItem('selectedPromoCode')) {
            selectedPromoCode.value = JSON.parse(localStorage.getItem('selectedPromoCode') || 'null');
        }
        return selectedPromoCode.value;
    }

    function getUserRedemptions() {
        if (import.meta.client && localStorage.getItem('userRedemptions')) {
            userRedemptions.value = JSON.parse(localStorage.getItem('userRedemptions') || '[]');
        }
        return userRedemptions.value;
    }

    function getValidatedCode() {
        if (import.meta.client && localStorage.getItem('validatedCode')) {
            validatedCode.value = JSON.parse(localStorage.getItem('validatedCode') || 'null');
        }
        return validatedCode.value;
    }

    async function retrievePromoCodes(filters?: { isActive?: boolean; campaignName?: string }) {
        const token = getAuthToken();
        if (!token) {
            console.log('[PromoCodesStore] No token, clearing promoCodes');
            promoCodes.value = [];
            return;
        }

        const params = new URLSearchParams();
        if (filters?.isActive !== undefined) {
            params.append('isActive', filters.isActive.toString());
        }
        if (filters?.campaignName) {
            params.append('campaignName', filters.campaignName);
        }

        const url = `${baseUrl()}/admin/promo-codes/list${params.toString() ? '?' + params.toString() : ''}`;

        try {
            const data = await $fetch<{ success: boolean; data: IPromoCode[] }>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (data.success) {
                setPromoCodes(data.data);
            }
        } catch (error) {
            console.error('[PromoCodesStore] Error fetching promo codes:', error);
            promoCodes.value = [];
        }
    }

    async function retrieveUserRedemptions(status?: 'active' | 'expired' | 'cancelled') {
        const token = getAuthToken();
        if (!token) {
            console.log('[PromoCodesStore] No token, clearing userRedemptions');
            userRedemptions.value = [];
            return;
        }

        const params = new URLSearchParams();
        if (status) {
            params.append('status', status);
        }

        const url = `${baseUrl()}/promo-codes/user/redemptions${params.toString() ? '?' + params.toString() : ''}`;

        try {
            const data = await $fetch<{ success: boolean; data: IPromoCodeRedemption[] }>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (data.success) {
                setUserRedemptions(data.data);
            }
        } catch (error) {
            console.error('[PromoCodesStore] Error fetching user redemptions:', error);
            userRedemptions.value = [];
        }
    }

    async function validatePromoCode(code: string, tierId: number, billingCycle: 'monthly' | 'annual'): Promise<IPromoCodeValidation> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const url = `${baseUrl()}/promo-codes/validate`;

        try {
            const response = await $fetch<{ success: boolean; data: IPromoCodeValidation }>(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: { code, tierId, billingCycle }
            });

            if (response.success) {
                setValidatedCode(response.data);
                return response.data;
            } else {
                throw new Error('Validation failed');
            }
        } catch (error: any) {
            console.error('[PromoCodesStore] Error validating promo code:', error);
            const errorValidation: IPromoCodeValidation = {
                valid: false,
                error: error.data?.error || error.message || 'Failed to validate promo code'
            };
            setValidatedCode(errorValidation);
            return errorValidation;
        }
    }

    async function createPromoCode(promoCodeData: Partial<IPromoCode>): Promise<boolean> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const url = `${baseUrl()}/admin/promo-codes/create`;

        try {
            const response = await $fetch<{ success: boolean; data: IPromoCode }>(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: promoCodeData
            });

            if (response.success) {
                // Refresh the list
                await retrievePromoCodes();
                return true;
            }
            return false;
        } catch (error) {
            console.error('[PromoCodesStore] Error creating promo code:', error);
            throw error;
        }
    }

    async function updatePromoCode(id: number, updates: Partial<IPromoCode>): Promise<boolean> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const url = `${baseUrl()}/admin/promo-codes/${id}`;

        try {
            const response = await $fetch<{ success: boolean }>(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: updates
            });

            if (response.success) {
                // Refresh the list
                await retrievePromoCodes();
                return true;
            }
            return false;
        } catch (error) {
            console.error('[PromoCodesStore] Error updating promo code:', error);
            throw error;
        }
    }

    async function deletePromoCode(id: number): Promise<boolean> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const url = `${baseUrl()}/admin/promo-codes/${id}`;

        try {
            const response = await $fetch<{ success: boolean }>(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (response.success) {
                // Refresh the list
                await retrievePromoCodes();
                return true;
            }
            return false;
        } catch (error) {
            console.error('[PromoCodesStore] Error deleting promo code:', error);
            throw error;
        }
    }

    async function togglePromoCodeActive(id: number, activate: boolean): Promise<boolean> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const action = activate ? 'activate' : 'deactivate';
        const url = `${baseUrl()}/admin/promo-codes/${id}/${action}`;

        try {
            const response = await $fetch<{ success: boolean }>(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (response.success) {
                // Refresh the list
                await retrievePromoCodes();
                return true;
            }
            return false;
        } catch (error) {
            console.error('[PromoCodesStore] Error toggling promo code:', error);
            throw error;
        }
    }

    async function getPromoCodeAnalytics(id: number): Promise<IPromoCodeAnalytics | null> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const url = `${baseUrl()}/admin/promo-codes/${id}/analytics`;

        try {
            const response = await $fetch<{ success: boolean; analytics: IPromoCodeAnalytics }>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (response.success) {
                return response.analytics;
            }
            return null;
        } catch (error) {
            console.error('[PromoCodesStore] Error fetching analytics:', error);
            return null;
        }
    }

    async function getPromoCodeRedemptions(id: number): Promise<IPromoCodeRedemption[]> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const url = `${baseUrl()}/admin/promo-codes/${id}/redemptions`;

        try {
            const response = await $fetch<{ success: boolean; redemptions: IPromoCodeRedemption[] }>(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (response.success) {
                return response.redemptions;
            }
            return [];
        } catch (error) {
            console.error('[PromoCodesStore] Error fetching redemptions:', error);
            return [];
        }
    }

    function clearPromoCodes() {
        promoCodes.value = [];
        if (import.meta.client) {
            localStorage.removeItem('promoCodes');
            enableRefreshDataFlag('clearPromoCodes');
        }
    }

    function clearSelectedPromoCode() {
        selectedPromoCode.value = null;
        if (import.meta.client) {
            localStorage.removeItem('selectedPromoCode');
        }
    }

    function clearUserRedemptions() {
        userRedemptions.value = [];
        if (import.meta.client) {
            localStorage.removeItem('userRedemptions');
            enableRefreshDataFlag('clearUserRedemptions');
        }
    }

    function clearValidatedCode() {
        validatedCode.value = null;
        if (import.meta.client) {
            localStorage.removeItem('validatedCode');
            enableRefreshDataFlag('clearValidatedCode');
        }
    }

    return {
        // State
        promoCodes,
        selectedPromoCode,
        userRedemptions,
        validatedCode,

        // Mutations
        setPromoCodes,
        setSelectedPromoCode,
        setUserRedemptions,
        setValidatedCode,

        // Getters
        getPromoCodes,
        getSelectedPromoCode,
        getUserRedemptions,
        getValidatedCode,

        // Actions
        retrievePromoCodes,
        retrieveUserRedemptions,
        validatePromoCode,
        createPromoCode,
        updatePromoCode,
        deletePromoCode,
        togglePromoCodeActive,
        getPromoCodeAnalytics,
        getPromoCodeRedemptions,

        // Clear functions
        clearPromoCodes,
        clearSelectedPromoCode,
        clearUserRedemptions,
        clearValidatedCode,
    };
});
