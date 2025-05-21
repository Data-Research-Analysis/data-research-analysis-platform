import {defineStore} from 'pinia'
import type { IVisualization } from '~/types/IVisualization';
export const useVisualizationsStore = defineStore('visualizationsDRA', () => {
    const visualizations = ref<IVisualization[]>([])
    const selectedVisualization = ref<IVisualization>()
    
    if (localStorage.getItem('visualizations')) {
        visualizations.value = JSON.parse(localStorage.getItem('visualizations') || '[]')
    }
    if (localStorage.getItem('selectedVisualization')) {
        selectedVisualization.value = JSON.parse(localStorage.getItem('selectedVisualization') || 'null')
    }
    function setVisualizations(visualizationsList: IVisualization[]) {
        visualizations.value = visualizationsList
        localStorage.setItem('visualizations', JSON.stringify(visualizationsList))
    }
    function setSelectedDataSource(visualization: IVisualization) {
        selectedVisualization.value = visualization
        localStorage.setItem('selectedVisualization', JSON.stringify(visualization))
    }
    function getVisualizations() {
        return visualizations.value;
    }
    async function retrieveVisualizations() {
        const token = getAuthToken();
        if (!token) {
            visualizations.value = [];
            return;
        }
        const url = `${baseUrl()}/visualizations/list`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setVisualizations(data)
    }

    function getSelectedDataSource() {
        return selectedVisualization.value
    }
    function clearDataSources() {
        visualizations.value = []
        localStorage.removeItem('visualizations')
    }
    function clearSelectedDataSource() {
        selectedVisualization.value = undefined
        localStorage.removeItem('selectedVisualization')
    }
    async function retrieveTablesFromDataModels(projectId: number, dataSourceId: number) {
        const token = getAuthToken();
        if (!token) {
            visualizations.value = [];
            return;
        }
        const url = `${baseUrl()}/data-models/tables/`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify({
                project_id: projectId,
                data_source_id: dataSourceId
            })
        });
        const data = await response.json();
        setVisualizations(data)
    }
    return {
        visualizations,
        selectedVisualization,
        setVisualizations,
        setSelectedDataSource,
        getVisualizations,
        retrieveVisualizations,
        clearDataSources,
        getSelectedDataSource,
        clearSelectedDataSource,
        retrieveTablesFromDataModels,
    }
});
