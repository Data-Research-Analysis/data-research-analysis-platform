import {defineStore} from 'pinia'
import type { IDashboard } from '~/types/IDashboard';
export const useDashboardsStore = defineStore('dashboardsDRA', () => {
    const dashboards = ref<IDashboard[]>([])
    const selectedDashboard = ref<IDashboard>()
    const columnsAdded = ref<string[]>([])
    
    function setDashboards(dashboardsList: IDashboard[]) {
        dashboards.value = dashboardsList
        if (import.meta.client) {
            try {
                localStorage.setItem('dashboards', JSON.stringify(dashboardsList))
                enableRefreshDataFlag('setDashboards');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[DashboardsStore] localStorage quota exceeded for dashboards.');
                    enableRefreshDataFlag('setDashboards');
                } else {
                    console.error('[DashboardsStore] Error saving dashboards to localStorage:', error);
                }
            }
        }
    }
    function setSelectedDashboard(dashboard: IDashboard) {
        selectedDashboard.value = dashboard
        if (import.meta.client) {
            try {
                localStorage.setItem('selectedDashboard', JSON.stringify(dashboard))
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[DashboardsStore] localStorage quota exceeded for selectedDashboard.');
                } else {
                    console.error('[DashboardsStore] Error saving selectedDashboard to localStorage:', error);
                }
            }
        }
    }
    function setColumnsAdded(columnNames: string[]) {
        columnsAdded.value = columnNames
        if (import.meta.client) {
            localStorage.setItem('columnsAdded', JSON.stringify(columnNames))
            enableRefreshDataFlag('setColumnsAdded');
        }
    }
    function getDashboards() {
        // Return current value - don't overwrite with potentially stale localStorage
        return dashboards.value;
    }
    async function retrieveDashboards() {
        const token = getAuthToken();
        if (!token) {
            dashboards.value = [];
            return;
        }
        const url = `${baseUrl()}/dashboard/list`;
        
        // Get organization context headers
        const { getOrgHeaders } = useOrganizationContext();
        const orgHeaders = getOrgHeaders();
        
        const data = await $fetch<any>(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
                ...orgHeaders,
            },
        });
        setDashboards(data)
    }
    async function retrievePublicDashboard(key: string) {
        const responseToken = await getGeneratedToken();
        const token = responseToken.token;
        const url = `${baseUrl()}/dashboard/public-dashboard-link/${encodeURIComponent(key)}`;
        const data = await $fetch<any>(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "non-auth",
            },
        });
        setSelectedDashboard(data)
        return data;
    }
    function getSelectedDashboard() {
        // Load from localStorage only if not already set
        if (import.meta.client && !selectedDashboard.value && localStorage.getItem('selectedDashboard')) {
            selectedDashboard.value = JSON.parse(localStorage.getItem('selectedDashboard') || 'null')
        }
        return selectedDashboard.value
    }
    function getColumnsAdded() {
        return columnsAdded.value;
    }
    function clearDashboards() {
        dashboards.value = []
        if (import.meta.client) {
            localStorage.removeItem('dashboards');
            enableRefreshDataFlag('clearDashboards');
        }
    }
    function clearSelectedDashboard() {
        selectedDashboard.value = undefined
        if (import.meta.client) {
            localStorage.removeItem('selectedDashboard');
        }
    }
    function clearColumnsAdded() {
        columnsAdded.value = []
        if (import.meta.client) {
            localStorage.removeItem('columnsAdded');
            enableRefreshDataFlag('clearColumnsAdded');
        }
    }
    return {
        dashboards,
        selectedDashboard,
        columnsAdded,
        setDashboards,
        setSelectedDashboard,
        setColumnsAdded,
        getDashboards,
        retrieveDashboards,
        clearDashboards,
        retrievePublicDashboard,
        getSelectedDashboard,
        getColumnsAdded,
        clearSelectedDashboard,
        clearColumnsAdded,
    }
});
