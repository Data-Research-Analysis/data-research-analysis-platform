import {defineStore} from 'pinia'
import type { IDataSource } from '~/types/IDataSource';
export const useDataSourceStore = defineStore('dataSourcesDRA', () => {
    const dataSources = ref<IDataSource[]>([])
    const selectedDataSource = ref<IDataSource>()
    
    function setDataSources(dataSourcesList: IDataSource[]) {
        dataSources.value = dataSourcesList
        if (import.meta.client) {
            localStorage.setItem('dataSources', JSON.stringify(dataSourcesList));
            enableRefreshDataFlag('setDataSources');
        }
    }
    function setSelectedDataSource(dataSource: IDataSource) {
        selectedDataSource.value = dataSource
        if (import.meta.client) {
            localStorage.setItem('selectedDataSource', JSON.stringify(dataSource));
        }
    }
    function getDataSources() {
        if (import.meta.client && localStorage.getItem('dataSources')) {
            dataSources.value = JSON.parse(localStorage.getItem('dataSources') || '[]')
        }
        return dataSources.value;
    }
    async function retrieveDataSources() {
        const token = getAuthToken();
        if (!token) {
            dataSources.value = [];
            return;
        }
        const url = `${baseUrl()}/data-source/list`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setDataSources(data)
    }

    function getSelectedDataSource() {
        if (import.meta.client && localStorage.getItem('selectedDataSource')) {
            selectedDataSource.value = JSON.parse(localStorage.getItem('selectedDataSource') || 'null')
        }        
        return selectedDataSource.value
    }
    function clearDataSources() {
        dataSources.value = []
        if (import.meta.client) {
            localStorage.removeItem('dataSources');
            enableRefreshDataFlag('clearDataSources');
        }
    }
    function clearSelectedDataSource() {
        selectedDataSource.value = undefined
        if (import.meta.client) {
            localStorage.removeItem('selectedDataSource');
        }
    }
    async function retrieveTablesFromDataSources(dataSourceId: string) {
        const token = getAuthToken();
        if (!token) {
            dataSources.value = [];
            return;
        }
        const url = `${baseUrl()}/data-source/tables/`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setDataSources(data)
    }
    return {
        dataSources,
        selectedDataSource,
        setDataSources,
        setSelectedDataSource,
        getDataSources,
        retrieveDataSources,
        clearDataSources,
        getSelectedDataSource,
        clearSelectedDataSource,
        retrieveTablesFromDataSources,
    }
});
