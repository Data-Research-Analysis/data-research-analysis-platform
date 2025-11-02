import {defineStore} from 'pinia'
import type { IDashboard } from '~/types/IDashboard';
export const useDashboardsStore = defineStore('dashboardsDRA', () => {
    const dashboards = ref<IDashboard[]>([])
    const selectedDashboard = ref<IDashboard>()
    const columnsAdded = ref<string[]>([])
    
    // Only access localStorage on client side
    if (import.meta.client) {
        if (localStorage.getItem('dashboards')) {
            dashboards.value = JSON.parse(localStorage.getItem('dashboards') || '[]')
        }
        if (localStorage.getItem('selectedDashboard')) {
            selectedDashboard.value = JSON.parse(localStorage.getItem('selectedDashboard') || 'null')
        }
    }
    function setDashboards(dashboardsList: IDashboard[]) {
        dashboards.value = dashboardsList
        if (import.meta.client) {
            localStorage.setItem('dashboards', JSON.stringify(dashboardsList))
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
        }
    }
    function getDashboards() {
        return dashboards.value;
    }
    async function retrieveDashboards() {
        const token = getAuthToken();
        if (!token) {
            dashboards.value = [];
            return;
        }
        const url = `${baseUrl()}/dashboard/list`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setDashboards(data)
    }
    async function retrievePublicDashboard(key: string) {
        const responseToken = await getGeneratedToken();
        const token = responseToken.token;
        const url = `${baseUrl()}/dashboard/public-dashboard-link/${encodeURIComponent(key)}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "non-auth",
            },
        });
        const data = await response.json();
        setSelectedDashboard(data)
        return data;
    }
    function getSelectedDashboard() {
        return selectedDashboard.value
    }
    function getColumnsAdded() {
        return columnsAdded.value;
    }
    function clearDashboards() {
        dashboards.value = []
        if (import.meta.client) {
            localStorage.removeItem('dashboards')
        }
    }
    function clearSelectedDashboard() {
        selectedDashboard.value = undefined
        if (import.meta.client) {
            localStorage.removeItem('selectedDashboard')
        }
    }
    function clearColumnsAdded() {
        columnsAdded.value = []
        if (import.meta.client) {
            localStorage.removeItem('columnsAdded')
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
