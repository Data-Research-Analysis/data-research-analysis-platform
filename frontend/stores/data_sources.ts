import {defineStore} from 'pinia'
import type { IDataSource } from '~/types/IDataSource';
export const useDataSourceStore = defineStore('dataSourcesDRA', () => {
    const dataSources = ref<IDataSource[]>([])
    const selectedDataSource = ref<IDataSource>()
    const tablesFromDataSource = ref<IDataSource[]>([])
    
    if (localStorage.getItem('projects')) {
        dataSources.value = JSON.parse(localStorage.getItem('dataSources') || '[]')
    }
    if (localStorage.getItem('selectedProject')) {
        selectedDataSource.value = JSON.parse(localStorage.getItem('selectedDataSource') || 'null')
    }
    function setDataSources(dataSourcesList: IDataSource[]) {
        dataSources.value = dataSourcesList
        localStorage.setItem('dataSources', JSON.stringify(dataSourcesList))
    }
    function setSelectedDataSource(dataSource: IDataSource) {
        selectedDataSource.value = dataSource
        localStorage.setItem('selectedDataSource', JSON.stringify(dataSource))
    }
    function getDataSources() {
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
        return selectedDataSource.value
    }
    function clearDataSources() {
        dataSources.value = []
        localStorage.removeItem('dataSources')
    }
    function clearSelectedDataSource() {
        selectedDataSource.value = undefined
        localStorage.removeItem('selectedDataSource')
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
