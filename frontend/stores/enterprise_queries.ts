import {defineStore} from 'pinia'
import { ref } from 'vue';
import { useAppFetch } from '@/composables/useAppFetch';
import type { IEnterpriseQuery } from '~/types/IEnterpriseQuery';
import { getAuthToken } from '~/composables/AuthToken';
import { baseUrl } from '~/composables/Utils';

export const useEnterpriseQueryStore = defineStore('enterpriseQueryDRA', () => {
    const enterpriseQueries = ref<IEnterpriseQuery[]>([])

    function setEnterpriseQueries(queriesList: IEnterpriseQuery[]) {
        enterpriseQueries.value = queriesList;
        if (import.meta.client) {
            try {
                localStorage.setItem('enterpriseQueries', JSON.stringify(queriesList));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[EnterpriseQueryStore] localStorage quota exceeded for enterpriseQueries.');
                } else {
                    console.error('[EnterpriseQueryStore] Error saving enterpriseQueries to localStorage:', error);
                }
            }
        }
    }

    function getEnterpriseQueries() {
        if (import.meta.client && localStorage.getItem('enterpriseQueries')) {
            enterpriseQueries.value = JSON.parse(localStorage.getItem('enterpriseQueries') || 'null') || [];
        }
        return enterpriseQueries.value;
    }

    function clearEnterpriseQueries() {
        enterpriseQueries.value = [];
        if (import.meta.client) {
            localStorage.removeItem('enterpriseQueries');
        }
    }

    async function retrieveEnterpriseQueries() {
        const token = getAuthToken();
        if (!token) {
            setEnterpriseQueries([]);
            return;
        }
        const url = `${baseUrl()}/admin/enterprise-queries/list`;
        const data = await useAppFetch<any>(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        setEnterpriseQueries(data);
    }

    return {
        enterpriseQueries,
        setEnterpriseQueries,
        getEnterpriseQueries,
        clearEnterpriseQueries,
        retrieveEnterpriseQueries,
    }
});