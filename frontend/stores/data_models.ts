import {defineStore} from 'pinia'
import type { IDataModel } from '~/types/IDataModel';
import type { IDataModelTable } from '~/types/IDataModelTable';
export const useDataModelsStore = defineStore('dataModelsDRA', () => {
    const dataModels = ref<IDataModel[]>([])
    const selectedDataModel = ref<IDataModel>()
    const dataModelTables = ref<IDataModelTable[]>([])

    function setDataModels(dataModelsList: IDataModel[]) {
        dataModels.value = dataModelsList;
        if (import.meta.client) {
            localStorage.setItem('dataModels', JSON.stringify(dataModelsList));
            enableRefreshDataFlag('setDataModels');
        }
    }
    function setSelectedDataModel(dataModel: IDataModel) {
        selectedDataModel.value = dataModel;
        if (import.meta.client) {
            localStorage.setItem('selectedDataModel', JSON.stringify(dataModel));
        }
    }
    function setDataModelTables(dataModelTablesList: IDataModelTable[]) {
        dataModelTables.value = dataModelTablesList;
        if (import.meta.client) {
            localStorage.setItem('dataModelTables', JSON.stringify(dataModelTablesList));
            enableRefreshDataFlag('setDataModelTables');
        }
    }
    function getDataModels() {
        if (import.meta.client && localStorage.getItem('dataModels')) {
            dataModels.value = JSON.parse(localStorage.getItem('dataModels') || '[]');
        }
        return dataModels.value;
    }
    function getDataModelTables() {
        if (import.meta.client && localStorage.getItem('dataModelTables')) {
            dataModelTables.value = JSON.parse(localStorage.getItem('dataModelTables') || '[]');
        }
        return dataModelTables.value;
    }
    async function retrieveDataModels(projectId: number) {
        const token = getAuthToken();
        if (!token) {
            dataModels.value = [];
            return;
        }
        const url = `${baseUrl()}/data-model/list/${projectId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setDataModels(data)
    }
    async function retrieveDataModelTables(projectId: number) {
        if (!projectId) {
            setDataModelTables([]);
            return;
        }
        const token = getAuthToken();
        if (!token) {
            setDataModelTables([]);
            return;
        }
        const url = `${baseUrl()}/data-model/tables/project/${projectId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setDataModelTables(data);
    }
    function getSelectedDataModel() {
        if (import.meta.client && localStorage.getItem('selectedDataModel')) {
            selectedDataModel.value = JSON.parse(localStorage.getItem('selectedDataModel') || 'null');
        }
        return selectedDataModel.value
    }
    function clearDataModels() {
        dataModels.value = []
        if (import.meta.client) {
            localStorage.removeItem('dataModels');
            enableRefreshDataFlag('clearDataModels');
        }
    }
    function clearSelectedDataModel() {
        selectedDataModel.value = undefined
        if (import.meta.client) {
            localStorage.removeItem('selectedDataModel');
        }
    }
    
    /**
     * NEW METHODS FOR CROSS-DATA-SOURCE SUPPORT
     */
    
    /**
     * Fetch tables from all data sources in a project
     * Used for cross-source data model building
     */
    async function fetchAllProjectTables(projectId: number) {
        const token = getAuthToken();
        if (!token) {
            console.error('[CrossSource] No auth token available');
            return [];
        }
        
        try {
            const url = `${baseUrl()}/data-model/projects/${projectId}/all-tables`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch tables: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[CrossSource] Error fetching all project tables:', error);
            return [];
        }
    }
    
    /**
     * Get join suggestions between two tables
     */
    async function suggestJoins(leftTable: any, rightTable: any) {
        const token = getAuthToken();
        if (!token) {
            console.error('[CrossSource] No auth token available');
            return [];
        }
        
        try {
            const url = `${baseUrl()}/data-model/suggest-joins`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: JSON.stringify({
                    leftTable,
                    rightTable
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to suggest joins: ${response.statusText}`);
            }
            
            const suggestions = await response.json();
            return suggestions;
        } catch (error) {
            console.error('[CrossSource] Error suggesting joins:', error);
            return [];
        }
    }
    
    /**
     * Save a successful join to the catalog for future reuse
     */
    async function saveJoinToCatalog(joinDefinition: any) {
        const token = getAuthToken();
        if (!token) {
            console.error('[CrossSource] No auth token available');
            return false;
        }
        
        try {
            const url = `${baseUrl()}/data-model/save-join-to-catalog`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: JSON.stringify(joinDefinition)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save join: ${response.statusText}`);
            }
            
            return true;
        } catch (error) {
            console.error('[CrossSource] Error saving join to catalog:', error);
            return false;
        }
    }
    
    return {
        dataModels,
        selectedDataModel,
        setDataModels,
        setSelectedDataModel,
        setDataModelTables,
        getDataModels,
        getDataModelTables,
        retrieveDataModels,
        retrieveDataModelTables,
        clearDataModels,
        getSelectedDataModel,
        clearSelectedDataModel,
        // Cross-source methods
        fetchAllProjectTables,
        suggestJoins,
        saveJoinToCatalog,
    }
});
