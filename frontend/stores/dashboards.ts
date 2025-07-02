import {defineStore} from 'pinia'
import type { IDashboard } from '~/types/IDashboard';
export const useDashboardsStore = defineStore('dashboardsDRA', () => {
    const dashboards = ref<IDashboard[]>([])
    const selectedDashboard = ref<IDashboard>()
    const columnsAdded = ref<string[]>([])
    
    if (localStorage.getItem('dashboards')) {
        dashboards.value = JSON.parse(localStorage.getItem('dashboards') || '[]')
    }
    if (localStorage.getItem('selectedDashboard')) {
        selectedDashboard.value = JSON.parse(localStorage.getItem('selectedDashboard') || 'null')
    }
    function setDashboards(dashboardsList: IDashboard[]) {
        dashboards.value = dashboardsList
        localStorage.setItem('dashboards', JSON.stringify(dashboardsList))
    }
    function setSelectedDashboard(dashboard: IDashboard) {
        selectedDashboard.value = dashboard
        localStorage.setItem('selectedDashboard', JSON.stringify(dashboard))
    }
    function setColumnsAdded(columnNames: string[]) {
        columnsAdded.value = columnNames
        localStorage.setItem('columnsAdded', JSON.stringify(columnNames))
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
    function getSelectedDashboard() {
        return selectedDashboard.value
    }
    function getColumnsAdded() {
        return columnsAdded.value;
    }
    function clearDashboards() {
        dashboards.value = []
        localStorage.removeItem('dashboards')
    }
    function clearSelectedDashboard() {
        selectedDashboard.value = undefined
        localStorage.removeItem('selectedDashboard')
    }
    function clearColumnsAdded() {
        columnsAdded.value = []
        localStorage.removeItem('columnsAdded')
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
        getSelectedDashboard,
        getColumnsAdded,
        clearSelectedDashboard,
        clearColumnsAdded,
    }
});
