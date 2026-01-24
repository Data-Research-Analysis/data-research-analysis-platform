import {defineStore} from 'pinia'
import type { IDashboard } from '~/types/IDashboard';
export const useDashboardsStore = defineStore('dashboardsDRA', () => {
    const dashboards = ref<IDashboard[]>([])
    const selectedDashboard = ref<IDashboard>()
    const columnsAdded = ref<string[]>([])
    
    function setDashboards(dashboardsList: IDashboard[]) {
        dashboards.value = dashboardsList
        if (import.meta.client) {
            localStorage.setItem('dashboards', JSON.stringify(dashboardsList))
            enableRefreshDataFlag('setDashboards');
        }
    }
    function setSelectedDashboard(dashboard: IDashboard) {
        selectedDashboard.value = dashboard
        if (import.meta.client) {
            localStorage.setItem('selectedDashboard', JSON.stringify(dashboard))
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
        if (import.meta.client && localStorage.getItem('dashboards')) {
            dashboards.value = JSON.parse(localStorage.getItem('dashboards') || '[]')
        }
        return dashboards.value;
    }
    async function retrieveDashboards() {
        const token = getAuthToken();
        if (!token) {
            dashboards.value = [];
            return;
        }
        const url = `${baseUrl()}/dashboard/list`;
        const data = await $fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        setDashboards(data)
    }
    async function retrievePublicDashboard(key: string) {
        const responseToken = await getGeneratedToken();
        const token = responseToken.token;
        const url = `${baseUrl()}/dashboard/public-dashboard-link/${encodeURIComponent(key)}`;
        const data = await $fetch(url, {
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
        if (import.meta.client && localStorage.getItem('selectedDashboard')) {
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
