import {defineStore} from 'pinia'
import type { IEnterpriseQuery } from '~/types/IEnterpriseQuery';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import { enableRefreshDataFlag } from '~/composables/Utils';

export const useEnterpriseQueryStore = defineStore('enterpriseQueryStore', () => {
    const enterpriseQueries = ref<IEnterpriseQuery[]>([]);

    function setEnterpriseQueries(queriesList: IEnterpriseQuery[]) {
        enterpriseQueries.value = queriesList;
        if (import.meta.client) {
            try {
                localStorage.setItem('enterpriseQueries', JSON.stringify(queriesList));
                enableRefreshDataFlag('setEnterpriseQueries');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[EnterpriseQueryStore] localStorage quota exceeded.');
                    enableRefreshDataFlag('setEnterpriseQueries');
                } else {
                    console.error('[EnterpriseQueryStore] Error saving to localStorage:', error);
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
            enableRefreshDataFlag('clearEnterpriseQueries');
        }
    }
    
    async function retrieveEnterpriseQueries() {
        const token = getAuthToken();
        if (!token) {
            setEnterpriseQueries([]);
            return;
        }
        const url = `${baseUrl()}/admin/enterprise-queries/list`;
        const data = await $fetch(url, {
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
